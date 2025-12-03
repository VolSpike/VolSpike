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
                'markPrice': float(mark_price) if mark_price else float(price),  # Fallback to ticker price
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
        tmp_file = STATE_FILE.with_suffix('.tmp')

        with open(tmp_file, 'w') as f:
            json.dump({
                'funding_state': combined_state,
                'connection_status': connection_status,
                'updated_at': now,
                'daemon_pid': os.getpid()
            }, f, indent=2)

        # Atomic rename (overwrites existing file)
        tmp_file.replace(STATE_FILE)

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

            connection_status['messages_received'] += len(payload)
            connection_status['last_message_time'] = now
            save_state()
            
            if connection_status['messages_received'] % 100 == 0:
                logger.info(f'Processed {connection_status["messages_received"]} msgs, {len(tickers)} tickers, {len(funding)} funding')
                
        except Exception as e:
            logger.error(f'Message error: {e}', exc_info=True)
    
    def on_open(self, ws):
        logger.info('✅ WebSocket connected')
        connection_status['connected'] = True
        save_state()
    
    def on_error(self, ws, err):
        logger.error(f'WS error: {err}')
        connection_status['connected'] = False
    
    def on_close(self, ws, code, msg):
        logger.info(f'WS closed: {code}')
        connection_status['connected'] = False

logger.info('=' * 70)
logger.info('Binance Funding Rate WebSocket Daemon')
logger.info(f'URL: {WS_URL}')
logger.info('Matches frontend use-client-only-market-data.ts logic')
logger.info('=' * 70)

while not shutdown:
    try:
        handler = WSHandler()
        ws = websocket.WebSocketApp(WS_URL,
            on_message=handler.on_message,
            on_error=handler.on_error,
            on_open=handler.on_open,
            on_close=handler.on_close)
        ws.run_forever(ping_interval=None, ping_timeout=None)
        
        if not shutdown:
            logger.info('Reconnecting in 5s...')
            time.sleep(5)
    except KeyboardInterrupt:
        break
    except Exception as e:
        logger.error(f'Fatal: {e}', exc_info=True)
        time.sleep(5)

logger.info('Daemon stopped')
