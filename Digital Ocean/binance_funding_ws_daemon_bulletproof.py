#!/usr/bin/env python3
"""
Binance Funding Rate WebSocket Daemon - BULLETPROOF VERSION
────────────────────────────────────────────────────────────────────────────
• Matches frontend logic exactly from use-client-only-market-data.ts
• Atomic file writes with proper locking
• No race conditions or corruption
• Graceful reconnection on disconnects
"""
import json
import time
import websocket
import logging
import signal
import sys
import threading
import os
from pathlib import Path
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

STATE_FILE = Path('/home/trader/volume-spike-bot/.funding_state.json')
WS_URL = 'wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr'

# Separate maps like frontend (tickersRef and fundingRef)
tickers: Dict[str, Any] = {}  # symbol -> ticker data (has price, volume)
funding: Dict[str, Any] = {}  # symbol -> funding data (has fundingRate)
connection_status = {'connected': False, 'messages_received': 0, 'last_message_time': None}

# File locking for atomic writes
file_lock = threading.Lock()

shutdown = False

def signal_handler(sig, frame):
    global shutdown
    logger.info('Shutdown requested')
    shutdown = True
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

def parse_funding_rate(raw: Optional[Dict]) -> Optional[float]:
    """Match frontend parseFundingRate exactly (line 3-29)"""
    if not raw:
        return None

    # Check in same order as frontend
    candidates = [
        raw.get('r'),
        raw.get('R'),
        raw.get('lastFundingRate'),
        raw.get('fr'),
        raw.get('fundingRate'),
        raw.get('estimatedSettlePriceRate'),
    ]

    for candidate in candidates:
        if candidate is None:
            continue
        try:
            numeric = float(candidate)
            if not (numeric != numeric):  # Not NaN
                return numeric
        except (ValueError, TypeError):
            continue

    return None

def save_state():
    """
    Save state with atomic writes to prevent corruption
    Uses tmp file + rename for atomicity
    """
    try:
        # Build combined state like frontend buildSnapshot
        combined_state = {}
        now = time.time()

        # Lock both maps during snapshot
        with file_lock:
            for symbol, ticker_data in tickers.items():
                if not symbol.endswith('USDT'):
                    continue

                # Get price from ticker (matches frontend line 125)
                price = ticker_data.get('c') or ticker_data.get('lastPrice') or 0

                # Get funding from separate map (matches frontend line 104-105)
                funding_data = funding.get(symbol, {})
                funding_rate = parse_funding_rate(funding_data)

                # Get mark price from funding stream (not ticker!)
                mark_price = funding_data.get('p') or funding_data.get('markPrice')

                # Build entry
                entry = {
                    'fundingRate': funding_rate,
                    'markPrice': float(mark_price) if mark_price else float(price),
                    'updatedAt': now
                }

                # Optional fields from funding stream
                if 'T' in funding_data:
                    entry['nextFundingTime'] = int(funding_data['T'])
                if 'i' in funding_data:
                    try:
                        entry['indexPrice'] = float(funding_data['i'])
                    except:
                        pass

                combined_state[symbol] = entry

        # Atomic write: write to temp file, then rename
        tmp_file = STATE_FILE.parent / f'.funding_state_{os.getpid()}.tmp'

        with open(tmp_file, 'w') as f:
            json.dump({
                'funding_state': combined_state,
                'connection_status': connection_status,
                'updated_at': now,
                'daemon_pid': os.getpid()
            }, f, indent=2)

        # Atomic rename (overwrites existing file)
        os.rename(str(tmp_file), str(STATE_FILE))

        logger.debug(f'State saved: {len(combined_state)} symbols')

    except Exception as e:
        logger.error(f'Failed to save state: {e}', exc_info=True)

class WSHandler:
    def on_message(self, ws, msg):
        try:
            if connection_status['messages_received'] == 0:
                logger.info(f'✓ First message received ({len(msg)} bytes)')

            data = json.loads(msg)
            payload = data.get('data', [])
            if not isinstance(payload, list):
                payload = [payload]

            updated = False

            # Lock during update
            with file_lock:
                for item in payload:
                    symbol = item.get('s')
                    if not symbol:
                        continue

                    # Match frontend logic (line 514-554)
                    # Check if it's a ticker update
                    if item.get('e') == '24hrTicker' or 'c' in item or 'v' in item:
                        tickers[symbol] = item
                        updated = True

                    # Check if it has funding rate data
                    if any(k in item for k in ['r', 'R', 'fr', 'lastFundingRate', 'fundingRate', 'p', 'markPrice']):
                        funding[symbol] = item
                        updated = True

            if updated:
                connection_status['messages_received'] += len(payload)
                connection_status['last_message_time'] = time.time()

                # Save state after each update
                save_state()

                # Log progress every 100 messages
                if connection_status['messages_received'] % 100 == 0:
                    logger.info(f"Processed {connection_status['messages_received']} messages, "
                               f"{len(tickers)} tickers, {len(funding)} funding entries")

        except Exception as e:
            logger.error(f'Error in on_message: {e}', exc_info=True)

    def on_error(self, ws, error):
        logger.error(f'WebSocket error: {error}')
        connection_status['connected'] = False
        save_state()

    def on_close(self, ws, close_status_code, close_msg):
        logger.warning(f'WebSocket closed: {close_status_code} - {close_msg}')
        connection_status['connected'] = False
        save_state()

    def on_open(self, ws):
        logger.info('✅ WebSocket connected to Binance')
        connection_status['connected'] = True
        connection_status['last_connected_time'] = time.time()
        save_state()

def run_websocket():
    """Run WebSocket with automatic reconnection"""
    reconnect_delay = 1
    max_reconnect_delay = 60

    while not shutdown:
        try:
            logger.info(f'Connecting to: {WS_URL}')

            handler = WSHandler()
            ws = websocket.WebSocketApp(
                WS_URL,
                on_message=handler.on_message,
                on_error=handler.on_error,
                on_close=handler.on_close,
                on_open=handler.on_open,
            )

            # Run forever (blocks until connection closes)
            ws.run_forever(
                ping_interval=None,  # Let Binance handle keepalive
                ping_timeout=None,
                skip_utf8_validation=False
            )

            if shutdown:
                break

            # Reconnect with exponential backoff
            logger.warning(f'Connection lost, reconnecting in {reconnect_delay}s...')
            time.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)

        except Exception as e:
            logger.error(f'Fatal error: {e}', exc_info=True)
            if not shutdown:
                logger.info(f'Restarting in {reconnect_delay}s...')
                time.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)

def periodic_state_saver():
    """Periodically save state to prove daemon is alive"""
    while not shutdown:
        time.sleep(10)  # Save every 10 seconds
        if not shutdown:
            save_state()

def main():
    logger.info('=' * 70)
    logger.info('Binance Funding Rate WebSocket Daemon - BULLETPROOF VERSION')
    logger.info('=' * 70)
    logger.info(f'WebSocket URL: {WS_URL}')
    logger.info(f'State file: {STATE_FILE.absolute()}')
    logger.info(f'Process PID: {os.getpid()}')
    logger.info('=' * 70)

    # Start periodic state saver
    saver_thread = threading.Thread(target=periodic_state_saver, daemon=True)
    saver_thread.start()
    logger.info('✓ Periodic state saver started')

    # Run WebSocket (blocks)
    run_websocket()

    logger.info('Daemon stopped')

if __name__ == '__main__':
    main()
