"""
Binance Funding Rate WebSocket Daemon (IMPROVED VERSION)
────────────────────────────────────────────────────────────────────────────
• Connects to Binance combined WebSocket stream !ticker@arr/!markPrice@arr
• Maintains in-memory state dictionary with funding rates and mark prices
• Auto-reconnects on disconnect with exponential backoff
• Provides thread-safe access to funding data for the HTTP API server
• IMPROVED: Better error handling, verbose logging, state file monitoring
"""

import json
import time
import threading
import logging
import sys
import os
import signal
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
WS_URL = "wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr"
RECONNECT_INITIAL_DELAY = 1
RECONNECT_MAX_DELAY = 60
RECONNECT_MULTIPLIER = 2
STALE_THRESHOLD = 180  # seconds

# IMPORTANT: State file path is relative to script location
# This ensures daemon and API server use the same file
STATE_FILE = Path(__file__).parent / ".funding_state.json"
STATE_FILE_LOCK = threading.Lock()

# Periodic state save (even if no updates, to prove daemon is alive)
STATE_SAVE_INTERVAL = 10  # seconds

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

# Shutdown flag for graceful termination
shutdown_requested = False

# ─────────────────────── Signal Handlers ───────────────────────


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_requested
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    shutdown_requested = True
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# ─────────────────────── Helpers ───────────────────────


def save_state_to_file():
    """Save state to file with error handling"""
    try:
        payload = {
            "funding_state": funding_state,
            "connection_status": connection_status,
            "updated_at": time.time(),
            "daemon_pid": os.getpid(),
            "state_file_path": str(STATE_FILE.absolute()),
        }
        tmp = STATE_FILE.with_suffix(".tmp")

        with STATE_FILE_LOCK:
            # Write to temp file first
            with open(tmp, "w") as f:
                json.dump(payload, f, indent=2)

            # Atomic rename
            tmp.replace(STATE_FILE)

        logger.debug(f"State saved: {len(funding_state)} symbols, {connection_status['messages_received']} messages")

    except Exception as e:
        logger.error(f"CRITICAL: Failed to save state file: {e}", exc_info=True)
        logger.error(f"State file path: {STATE_FILE.absolute()}")
        logger.error(f"State file writable: {STATE_FILE.parent.exists() and os.access(STATE_FILE.parent, os.W_OK)}")


def parse_funding_from_item(item: Dict[str, Any]) -> Optional[float]:
    """Match frontend parseFundingRate: r, R, fr, lastFundingRate, etc."""
    for key in ("r", "R", "fr", "lastFundingRate", "fundingRate", "estimatedSettlePriceRate"):
        if key in item and item[key] is not None:
            try:
                return float(item[key])
            except (ValueError, TypeError):
                continue
    return None


def parse_mark_price_from_item(item: Dict[str, Any]) -> Optional[float]:
    for key in ("p", "markPrice", "c", "lastPrice"):
        if key in item and item[key] is not None:
            try:
                return float(item[key])
            except (ValueError, TypeError):
                continue
    return None


# ─────────────────────── WebSocket callbacks ───────────────────────


def on_message(ws, message: str):
    """Handle incoming WebSocket messages"""
    try:
        data = json.loads(message)
        payload = data.get("data", [])
        if not isinstance(payload, list):
            payload = [payload]

        updated_any = False
        now = time.time()

        with STATE_FILE_LOCK:
            for item in payload:
                symbol = item.get("s")
                if not symbol:
                    continue

                funding_rate = parse_funding_from_item(item)
                mark_price = parse_mark_price_from_item(item)
                next_funding_time = item.get("T")
                index_price = item.get("i")

                # If neither funding nor mark price present, skip
                if funding_rate is None and mark_price is None:
                    continue

                rec = funding_state.setdefault(symbol, {})

                if funding_rate is not None:
                    rec["fundingRate"] = funding_rate
                if mark_price is not None:
                    rec["markPrice"] = mark_price
                if next_funding_time is not None:
                    rec["nextFundingTime"] = int(next_funding_time)
                if index_price is not None:
                    try:
                        rec["indexPrice"] = float(index_price)
                    except (ValueError, TypeError):
                        pass

                rec["updatedAt"] = now
                updated_any = True

            if updated_any:
                save_state_to_file()

        connection_status["messages_received"] += len(payload)
        connection_status["last_message_time"] = now

        # Log every 100 messages to prove we're receiving data
        if connection_status["messages_received"] % 100 == 0:
            logger.info(f"Processed {connection_status['messages_received']} messages, {len(funding_state)} symbols")

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)


def on_error(ws, error):
    """Handle WebSocket errors"""
    logger.error(f"WebSocket error: {error}")
    connection_status["connected"] = False
    save_state_to_file()


def on_close(ws, close_status_code, close_msg):
    """Handle WebSocket close"""
    logger.warning(f"WebSocket closed: status={close_status_code}, msg={close_msg}")
    connection_status["connected"] = False
    connection_status["last_connected_time"] = None
    save_state_to_file()


def on_open(ws):
    """Handle WebSocket open"""
    logger.info("✅ WebSocket connected to Binance combined stream")
    connection_status["connected"] = True
    connection_status["last_connected_time"] = time.time()
    connection_status["reconnect_attempts"] = 0
    save_state_to_file()


# ─────────────────────── Periodic state saver ───────────────────────


def periodic_state_saver():
    """
    Background thread that saves state periodically.
    This proves the daemon is alive even if no messages are received.
    """
    while not shutdown_requested:
        time.sleep(STATE_SAVE_INTERVAL)
        if not shutdown_requested:
            save_state_to_file()
            logger.debug(f"Periodic state save (alive check)")


# ─────────────────────── Connection loop ───────────────────────


def create_websocket():
    """Create WebSocket app with callbacks"""
    return websocket.WebSocketApp(
        WS_URL,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open,
    )


def connect_websocket():
    """Main WebSocket connection loop"""
    while not shutdown_requested:
        ws = create_websocket()
        try:
            logger.info(f"Connecting to Binance WebSocket: {WS_URL}")
            # Disable client-side ping; Binance handles keepalive
            ws.run_forever(ping_interval=None, ping_timeout=None)
        except Exception as e:
            logger.error(f"WebSocket exception: {e}", exc_info=True)

        if shutdown_requested:
            logger.info("Shutdown requested, not reconnecting")
            break

        logger.warning("WebSocket disconnected, reconnecting...")
        connection_status["connected"] = False
        save_state_to_file()
        reconnect_with_backoff()


def reconnect_with_backoff():
    """Reconnect with exponential backoff"""
    delay = RECONNECT_INITIAL_DELAY
    attempt = 0
    while delay <= RECONNECT_MAX_DELAY and not shutdown_requested:
        attempt += 1
        connection_status["reconnect_attempts"] = attempt
        logger.info(f"Reconnecting in {delay}s (attempt {attempt})...")

        # Sleep in small chunks to allow quick shutdown
        for _ in range(int(delay * 2)):
            if shutdown_requested:
                return
            time.sleep(0.5)

        try:
            ws = create_websocket()
            logger.info("Attempting reconnection...")
            ws.run_forever(ping_interval=None, ping_timeout=None)
            return
        except Exception as e:
            logger.warning(f"Reconnection attempt {attempt} failed: {e}")
            delay = min(delay * RECONNECT_MULTIPLIER, RECONNECT_MAX_DELAY)

    if not shutdown_requested:
        logger.warning("Max reconnect delay reached, resetting timer")
        reconnect_with_backoff()


def main():
    """Main entry point"""
    logger.info("=" * 70)
    logger.info("Binance Funding Rate WebSocket Daemon (IMPROVED)")
    logger.info("=" * 70)
    logger.info(f"WebSocket URL: {WS_URL}")
    logger.info(f"State file: {STATE_FILE.absolute()}")
    logger.info(f"State file exists: {STATE_FILE.exists()}")
    logger.info(f"State file writable: {STATE_FILE.parent.exists() and os.access(STATE_FILE.parent, os.W_OK)}")
    logger.info(f"Process PID: {os.getpid()}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info("Combined stream (ticker + mark price)")
    logger.info(f"Stale threshold: {STALE_THRESHOLD}s")
    logger.info(f"Periodic state save interval: {STATE_SAVE_INTERVAL}s")
    logger.info("=" * 70)

    # Start periodic state saver thread
    saver_thread = threading.Thread(target=periodic_state_saver, daemon=True)
    saver_thread.start()
    logger.info("✓ Periodic state saver thread started")

    try:
        connect_websocket()
    except KeyboardInterrupt:
        logger.info("Shutdown requested by user (Ctrl+C)")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
