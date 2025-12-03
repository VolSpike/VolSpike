"""
Binance Funding Rate WebSocket Daemon - CORRECTLY FIXED (Frontend-Style)
────────────────────────────────────────────────────────────────────────────
• Subscribes to BOTH !ticker@arr + !markPrice@arr streams (like frontend)
• Stores ticker and funding data SEPARATELY (like frontend)
• Combines them when saving state (like frontend)
• Auto-reconnects on disconnect with exponential backoff

CRITICAL FIX:
  The previous "fix" removed the !ticker@arr stream entirely, but that was wrong.
  The frontend DOES subscribe to both streams and it works perfectly because it
  processes them SEPARATELY and combines them later.

  This version follows the EXACT same pattern as the frontend:
    1. Process !ticker@arr → store in tickers dict (price, volume, etc.)
    2. Process !markPrice@arr → store in funding dict (funding rate, mark price)
    3. Combine when building state → use mark price from !markPrice@arr (NOT ticker!)
"""

import json
import time
import threading
import logging
import sys
import os
from typing import Dict, Optional, Any
from datetime import datetime, timezone
from pathlib import Path

try:
    import websocket
except ImportError:
    print("ERROR: websocket-client library not installed")
    print("Install with: pip install websocket-client")
    sys.exit(1)

# ─────────────────────── Configuration ───────────────────────
# Subscribe to BOTH streams (like frontend)
WS_URL = "wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr"
RECONNECT_INITIAL_DELAY = 1
RECONNECT_MAX_DELAY = 60
RECONNECT_MULTIPLIER = 2
STALE_THRESHOLD = 180  # seconds

STATE_FILE = Path(__file__).parent / ".funding_state.json"
STATE_FILE_LOCK = threading.Lock()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Separate storage for ticker and funding data (like frontend)
tickers: Dict[str, Dict[str, Any]] = {}  # From !ticker@arr
funding: Dict[str, Dict[str, Any]] = {}  # From !markPrice@arr

connection_status = {
    "connected": False,
    "last_connected_time": None,
    "reconnect_attempts": 0,
    "messages_received": 0,
    "last_message_time": None,
}

# ─────────────────────── Helpers ───────────────────────


def save_state_to_file():
    """
    Combine ticker + funding data and save to state file
    This matches frontend's buildSnapshot() logic
    """
    now = time.time()

    # Combine ticker and funding data (like frontend)
    combined_state = {}

    # Start with all symbols from funding dict (has funding rate + mark price)
    for symbol, funding_data in funding.items():
        combined_state[symbol] = {
            "fundingRate": funding_data.get("r") or funding_data.get("R") or funding_data.get("lastFundingRate"),
            "markPrice": funding_data.get("p"),  # Mark price from !markPrice@arr stream
            "indexPrice": funding_data.get("i"),
            "nextFundingTime": funding_data.get("T"),
            "updatedAt": now
        }

    # For symbols that only have ticker data (shouldn't happen for perpetuals, but defensive)
    for symbol, ticker_data in tickers.items():
        if symbol not in combined_state:
            combined_state[symbol] = {
                "fundingRate": None,
                "markPrice": None,  # Will be None if not in funding stream
                "indexPrice": None,
                "nextFundingTime": None,
                "updatedAt": now
            }

    # Create temp file with PID to avoid conflicts
    tmp_file = STATE_FILE.parent / f".funding_state_{os.getpid()}.tmp"

    payload = {
        "funding_state": combined_state,
        "connection_status": connection_status,
        "updated_at": now,
        "daemon_pid": os.getpid()
    }

    try:
        # Write to temp file
        with open(tmp_file, 'w') as f:
            json.dump(payload, f, indent=2)

        # Atomic rename (overwrites existing file)
        os.rename(str(tmp_file), str(STATE_FILE))

    except Exception as e:
        logger.error(f"Error saving state file: {e}")
        # Clean up temp file if it exists
        if tmp_file.exists():
            try:
                tmp_file.unlink()
            except:
                pass


# ─────────────────────── WebSocket callbacks ───────────────────────


def on_message(ws, message: str):
    """
    Process messages from BOTH !ticker@arr and !markPrice@arr streams

    Like the frontend, we:
    1. Check which stream the message came from
    2. Store ticker and funding data SEPARATELY
    3. Combine them when saving state
    """
    try:
        data = json.loads(message)
        stream = data.get("stream", "")
        payload = data.get("data", [])

        # Ensure payload is a list
        if not isinstance(payload, list):
            payload = [payload]

        updated_any = False
        now = time.time()

        with STATE_FILE_LOCK:
            for item in payload:
                symbol = item.get("s")
                if not symbol:
                    continue

                # Process ticker data (from !ticker@arr stream)
                # Frontend checks: it?.e === '24hrTicker' || it?.c || it?.v
                if item.get("e") == "24hrTicker" or "c" in item or "v" in item:
                    tickers[symbol] = item
                    updated_any = True

                # Process funding data (from !markPrice@arr stream)
                # Frontend checks: it?.r !== undefined || it?.R !== undefined || it?.fr !== undefined || it?.lastFundingRate !== undefined
                if (
                    "r" in item or
                    "R" in item or
                    "fr" in item or
                    "lastFundingRate" in item or
                    item.get("e") == "markPriceUpdate"
                ):
                    funding[symbol] = item
                    updated_any = True

            if updated_any:
                save_state_to_file()

        connection_status["messages_received"] += len(payload)
        connection_status["last_message_time"] = now

        # Log progress every 50 messages
        if connection_status["messages_received"] % 50 == 0:
            symbols_with_both = sum(1 for s in funding.keys() if s in tickers)
            logger.info(f"Processed {connection_status['messages_received']} messages, "
                       f"{len(tickers)} tickers, {len(funding)} funding entries, "
                       f"{symbols_with_both} with both")

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)


def on_error(ws, error):
    logger.error(f"WebSocket error: {error}")
    connection_status["connected"] = False


def on_close(ws, close_status_code, close_msg):
    logger.warning(f"WebSocket closed: status={close_status_code}, msg={close_msg}")
    connection_status["connected"] = False
    connection_status["last_connected_time"] = None


def on_open(ws):
    logger.info("✅ WebSocket connected to Binance (ticker + markPrice streams)")
    connection_status["connected"] = True
    connection_status["last_connected_time"] = time.time()
    connection_status["reconnect_attempts"] = 0


# ─────────────────────── Connection loop ───────────────────────


def create_websocket():
    return websocket.WebSocketApp(
        WS_URL,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open,
    )


def connect_websocket():
    while True:
        ws = create_websocket()
        try:
            logger.info(f"Connecting to Binance WebSocket: {WS_URL}")
            # Disable client-side ping; Binance handles keepalive
            ws.run_forever(ping_interval=None, ping_timeout=None)
        except Exception as e:
            logger.error(f"WebSocket exception: {e}", exc_info=True)

        logger.warning("WebSocket disconnected, reconnecting...")
        connection_status["connected"] = False
        reconnect_with_backoff()


def reconnect_with_backoff():
    delay = RECONNECT_INITIAL_DELAY
    attempt = 0
    while delay <= RECONNECT_MAX_DELAY:
        attempt += 1
        connection_status["reconnect_attempts"] = attempt
        logger.info(f"Reconnecting in {delay}s (attempt {attempt})...")
        time.sleep(delay)
        try:
            ws = create_websocket()
            logger.info("Attempting reconnection...")
            ws.run_forever(ping_interval=None, ping_timeout=None)
            return
        except Exception as e:
            logger.warning(f"Reconnection attempt {attempt} failed: {e}")
            delay = min(delay * RECONNECT_MULTIPLIER, RECONNECT_MAX_DELAY)

    logger.warning("Max reconnect delay reached, resetting timer")
    reconnect_with_backoff()


def main():
    logger.info("=" * 70)
    logger.info("Binance Funding Rate WebSocket Daemon - TRULY FIXED")
    logger.info("=" * 70)
    logger.info(f"WebSocket URL: {WS_URL}")
    logger.info("BOTH streams: !ticker@arr + !markPrice@arr (like frontend)")
    logger.info(f"Stale threshold: {STALE_THRESHOLD}s")
    logger.info("=" * 70)

    try:
        connect_websocket()
    except KeyboardInterrupt:
        logger.info("Shutdown requested by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
