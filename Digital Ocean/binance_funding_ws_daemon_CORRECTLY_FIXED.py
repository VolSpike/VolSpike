"""
Binance Funding Rate WebSocket Daemon - CORRECTLY FIXED
────────────────────────────────────────────────────────────────────────────
• Connects ONLY to !markPrice@arr stream (not ticker stream)
• Maintains in-memory state dictionary with funding rates and mark prices
• Auto-reconnects on disconnect with exponential backoff
• Provides thread-safe access to funding data for the HTTP API server

CRITICAL FIX:
  The previous version subscribed to !ticker@arr + !markPrice@arr streams
  and incorrectly parsed the ticker 'p' field (price change) as mark price.

  This version ONLY uses !markPrice@arr which provides:
    - r = funding rate
    - p = mark price (actual mark price, not price change!)
    - i = index price
    - T = next funding time
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
# CRITICAL: Only subscribe to !markPrice@arr stream (NOT ticker stream!)
WS_URL = "wss://fstream.binance.com/stream?streams=!markPrice@arr"
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

funding_state: Dict[str, Dict[str, Any]] = {}
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
    Atomic file write using PID-based temp file and os.rename()
    This prevents FileNotFoundError and race conditions
    """
    now = time.time()

    # Create temp file with PID to avoid conflicts
    tmp_file = STATE_FILE.parent / f".funding_state_{os.getpid()}.tmp"

    payload = {
        "funding_state": funding_state,
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
    Process !markPrice@arr stream messages

    Message structure:
    {
      "stream": "!markPrice@arr",
      "data": [
        {
          "e": "markPriceUpdate",
          "E": 1764724086000,
          "s": "BTCUSDT",
          "p": "91520.00000000",  ← MARK PRICE
          "P": "91497.04220459",  ← Ignore (settlement price)
          "i": "91560.70173913",  ← INDEX PRICE
          "r": "0.00001240",      ← FUNDING RATE
          "T": 1764748800000      ← NEXT FUNDING TIME
        },
        ...
      ]
    }
    """
    try:
        data = json.loads(message)
        stream = data.get("stream", "")
        payload = data.get("data", [])

        # Ensure payload is a list
        if not isinstance(payload, list):
            payload = [payload]

        # Only process markPrice stream
        if "markPrice" not in stream:
            return

        updated_any = False
        now = time.time()

        with STATE_FILE_LOCK:
            for item in payload:
                symbol = item.get("s")
                if not symbol:
                    continue

                # Extract fields from markPrice stream
                funding_rate_str = item.get("r")
                mark_price_str = item.get("p")
                index_price_str = item.get("i")
                next_funding_time = item.get("T")

                # Parse funding rate
                funding_rate = None
                if funding_rate_str is not None:
                    try:
                        funding_rate = float(funding_rate_str)
                    except (ValueError, TypeError):
                        pass

                # Parse mark price
                mark_price = None
                if mark_price_str is not None:
                    try:
                        mark_price = float(mark_price_str)
                    except (ValueError, TypeError):
                        pass

                # Parse index price
                index_price = None
                if index_price_str is not None:
                    try:
                        index_price = float(index_price_str)
                    except (ValueError, TypeError):
                        pass

                # If no data, skip
                if funding_rate is None and mark_price is None:
                    continue

                # Update state
                rec = funding_state.setdefault(symbol, {})

                if funding_rate is not None:
                    rec["fundingRate"] = funding_rate
                if mark_price is not None:
                    rec["markPrice"] = mark_price
                if index_price is not None:
                    rec["indexPrice"] = index_price
                if next_funding_time is not None:
                    rec["nextFundingTime"] = int(next_funding_time)

                rec["updatedAt"] = now
                updated_any = True

            if updated_any:
                save_state_to_file()

        connection_status["messages_received"] += len(payload)
        connection_status["last_message_time"] = now

        # Log progress every 50 messages
        if connection_status["messages_received"] % 50 == 0:
            symbols_with_funding = sum(1 for v in funding_state.values() if v.get("fundingRate") is not None)
            logger.info(f"Processed {connection_status['messages_received']} messages, "
                       f"{len(funding_state)} symbols tracked, "
                       f"{symbols_with_funding} with funding rates")

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
    logger.info("✅ WebSocket connected to Binance !markPrice@arr stream")
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
    logger.info("Binance Funding Rate WebSocket Daemon - CORRECTLY FIXED")
    logger.info("=" * 70)
    logger.info(f"WebSocket URL: {WS_URL}")
    logger.info("ONLY !markPrice@arr stream (NOT ticker stream!)")
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
