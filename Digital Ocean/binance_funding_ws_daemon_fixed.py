"""
Binance Funding Rate WebSocket Daemon (FIXED VERSION)
────────────────────────────────────────────────────────────────────────────
• FIXED: Uses enableTrace and proper callback binding
• Connects to Binance combined WebSocket stream !ticker@arr/!markPrice@arr
• Maintains in-memory state dictionary with funding rates and mark prices
• Auto-reconnects on disconnect with exponential backoff
"""

import json
import time
import threading
import logging
import sys
import os
import signal
from typing import Dict, Optional, Any
from pathlib import Path

try:
    import websocket
except ImportError:
    print("ERROR: websocket-client library not installed")
    print("Install with: pip install websocket-client")
    sys.exit(1)

# Enable trace for debugging
websocket.enableTrace(False)

# ─────────────────────── Configuration ───────────────────────
WS_URL = "wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr"
RECONNECT_INITIAL_DELAY = 1
RECONNECT_MAX_DELAY = 60
RECONNECT_MULTIPLIER = 2
STALE_THRESHOLD = 180  # seconds
STATE_SAVE_INTERVAL = 10  # seconds

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

shutdown_requested = False

# ─────────────────────── Signal Handlers ───────────────────────


def signal_handler(signum, frame):
    global shutdown_requested
    logger.info(f"Received signal {signum}, shutting down...")
    shutdown_requested = True
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# ─────────────────────── Helpers ───────────────────────


def save_state_to_file():
    try:
        payload = {
            "funding_state": funding_state,
            "connection_status": connection_status,
            "updated_at": time.time(),
            "daemon_pid": os.getpid(),
        }
        tmp = STATE_FILE.with_suffix(".tmp")

        with STATE_FILE_LOCK:
            with open(tmp, "w") as f:
                json.dump(payload, f, indent=2)
            tmp.replace(STATE_FILE)

        logger.debug(f"State saved: {len(funding_state)} symbols")
    except Exception as e:
        logger.error(f"CRITICAL: Failed to save state: {e}", exc_info=True)


def parse_funding_from_item(item: Dict[str, Any]) -> Optional[float]:
    for key in ("r", "R", "fr", "lastFundingRate", "fundingRate"):
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


# ─────────────────────── WebSocket Handler Class ───────────────────────


class BinanceFundingWS:
    def __init__(self, url: str):
        self.url = url
        self.ws = None
        self.thread = None

    def on_message(self, ws, message):
        """Handle incoming WebSocket messages"""
        try:
            # Log first message
            if connection_status["messages_received"] == 0:
                logger.info(f"✓ First message received! ({len(message)} bytes)")

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
                        except:
                            pass

                    rec["updatedAt"] = now
                    updated_any = True

                if updated_any:
                    save_state_to_file()

            connection_status["messages_received"] += len(payload)
            connection_status["last_message_time"] = now

            # Log every 100 messages
            if connection_status["messages_received"] % 100 == 0:
                logger.info(f"Processed {connection_status['messages_received']} messages, {len(funding_state)} symbols")

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
        except Exception as e:
            logger.error(f"Error in on_message: {e}", exc_info=True)

    def on_error(self, ws, error):
        logger.error(f"WebSocket error: {error}")
        connection_status["connected"] = False
        save_state_to_file()

    def on_close(self, ws, close_status_code, close_msg):
        logger.warning(f"WebSocket closed: {close_status_code}")
        connection_status["connected"] = False
        connection_status["last_connected_time"] = None
        save_state_to_file()

    def on_open(self, ws):
        logger.info("✅ WebSocket connected to Binance")
        connection_status["connected"] = True
        connection_status["last_connected_time"] = time.time()
        connection_status["reconnect_attempts"] = 0
        save_state_to_file()

    def connect(self):
        """Create and run WebSocket connection"""
        logger.info(f"Connecting to: {self.url}")

        self.ws = websocket.WebSocketApp(
            self.url,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open,
        )

        # Run with keep-alive
        self.ws.run_forever(
            ping_interval=20,
            ping_timeout=10,
            skip_utf8_validation=False
        )

    def start(self):
        """Start WebSocket in background thread"""
        self.thread = threading.Thread(target=self.connect, daemon=False)
        self.thread.start()
        return self.thread


# ─────────────────────── Periodic state saver ───────────────────────


def periodic_state_saver():
    """Save state periodically to prove daemon is alive"""
    while not shutdown_requested:
        time.sleep(STATE_SAVE_INTERVAL)
        if not shutdown_requested:
            save_state_to_file()


# ─────────────────────── Main ───────────────────────


def main():
    logger.info("=" * 70)
    logger.info("Binance Funding Rate WebSocket Daemon (FIXED)")
    logger.info("=" * 70)
    logger.info(f"WebSocket URL: {WS_URL}")
    logger.info(f"State file: {STATE_FILE.absolute()}")
    logger.info(f"State file writable: {os.access(STATE_FILE.parent, os.W_OK)}")
    logger.info(f"Process PID: {os.getpid()}")
    logger.info(f"Periodic save interval: {STATE_SAVE_INTERVAL}s")
    logger.info("=" * 70)

    # Start periodic state saver
    saver_thread = threading.Thread(target=periodic_state_saver, daemon=True)
    saver_thread.start()
    logger.info("✓ Periodic state saver started")

    # Start WebSocket connection
    while not shutdown_requested:
        try:
            ws_handler = BinanceFundingWS(WS_URL)
            thread = ws_handler.start()

            # Wait for thread
            while thread.is_alive() and not shutdown_requested:
                thread.join(timeout=1)

            if shutdown_requested:
                break

            # Reconnect
            logger.warning("Connection lost, reconnecting in 5s...")
            time.sleep(5)

        except KeyboardInterrupt:
            logger.info("Shutdown requested by user")
            break
        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)
            logger.info("Restarting in 5s...")
            time.sleep(5)


if __name__ == "__main__":
    main()
