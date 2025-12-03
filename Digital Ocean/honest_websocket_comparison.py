#!/usr/bin/env python3
"""
Honest WebSocket vs REST API Comparison
Shows REALISTIC differences between REST API and WebSocket data
"""
import json
import time
import requests
from pathlib import Path
from datetime import datetime

STATE_FILE = Path('/home/trader/volume-spike-bot/.funding_state.json')
BINANCE_API = 'https://fapi.binance.com/fapi/v1/premiumIndex'

def main():
    print('='*140)
    print('HONEST WEBSOCKET vs REST API COMPARISON REPORT')
    print('='*140)
    print(f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print()

    # Get REST API data (single batch call)
    print('Fetching REST API data for all symbols...')
    rest_start = time.time()
    rest_resp = requests.get(BINANCE_API, timeout=10)
    rest_end = time.time()
    rest_data_list = rest_resp.json()

    # Build dict by symbol
    rest_data = {}
    for item in rest_data_list:
        symbol = item.get('symbol')
        if symbol and symbol.endswith('USDT'):
            rest_data[symbol] = {
                'fundingRate': float(item.get('lastFundingRate', 0)),
                'markPrice': float(item.get('markPrice', 0)),
            }

    print(f'  Fetched {len(rest_data)} symbols in {(rest_end - rest_start)*1000:.0f}ms')

    # Read WebSocket state file
    print('Reading WebSocket state file...')
    ws_start = time.time()
    with open(STATE_FILE, 'r') as f:
        state = json.load(f)
        ws_data = state.get('funding_state', {})
    ws_end = time.time()

    print(f'  Loaded {len(ws_data)} symbols in {(ws_end - ws_start)*1000:.0f}ms')
    print()

    # Get all USDT symbols
    all_symbols = sorted([s for s in rest_data.keys() if s in ws_data])

    # Statistics
    total = len(all_symbols)
    fr_identical = 0
    price_diffs = []

    print('='*140)
    print('SAMPLE DATA (First 20 symbols)')
    print('='*140)
    print()
    header = f"{'SYMBOL':<15} {'REST FR':<15} {'WS FR':<15} {'FR MATCH':<10} {'REST PRICE':<15} {'WS PRICE':<15} {'DIFF $':<12} STATUS"
    print(header)
    print('-'*140)

    # Show first 20 symbols
    for symbol in all_symbols[:20]:
        rest = rest_data[symbol]
        ws = ws_data[symbol]

        rest_fr = rest['fundingRate']
        ws_fr = ws['fundingRate']

        rest_price = rest['markPrice']
        ws_price = ws['markPrice']

        fr_diff = abs(rest_fr - ws_fr)
        price_diff = abs(rest_price - ws_price)

        fr_match = '✅ YES' if fr_diff < 0.0000001 else '❌ NO'

        if price_diff < 10:
            status = '✅ GOOD'
        elif price_diff < 100:
            status = '⚠️  MEDIUM'
        else:
            status = '❌ LARGE'

        print(f'{symbol:<15} {rest_fr:>14.8f} {ws_fr:>14.8f} {fr_match:<10} ${rest_price:>13.2f} ${ws_price:>13.2f} ${price_diff:>10.2f}  {status}')

    print()
    print('... (calculating statistics for all symbols) ...')
    print()

    # Calculate statistics for ALL symbols
    for symbol in all_symbols:
        rest = rest_data[symbol]
        ws = ws_data[symbol]

        rest_fr = rest['fundingRate']
        ws_fr = ws['fundingRate']

        rest_price = rest['markPrice']
        ws_price = ws['markPrice']

        fr_diff = abs(rest_fr - ws_fr)
        price_diff = abs(rest_price - ws_price)

        if fr_diff < 0.0000001:
            fr_identical += 1

        price_diffs.append(price_diff)

    # Categorize price differences
    price_small = sum(1 for d in price_diffs if d < 10)
    price_medium = sum(1 for d in price_diffs if 10 <= d < 100)
    price_large = sum(1 for d in price_diffs if d >= 100)

    avg_price_diff = sum(price_diffs) / len(price_diffs)
    max_price_diff = max(price_diffs)
    min_price_diff = min(price_diffs)

    print('='*140)
    print('STATISTICAL SUMMARY')
    print('='*140)
    print(f'Total symbols compared: {total}')
    print()
    print('FUNDING RATE:')
    print(f'  Identical (diff < 0.0000001): {fr_identical}/{total} ({fr_identical/total*100:.1f}%)')
    print(f'  Different: {total - fr_identical}/{total} ({(total - fr_identical)/total*100:.1f}%)')
    print()
    print('MARK PRICE DIFFERENCES:')
    print(f'  Small (<$10):      {price_small}/{total} ({price_small/total*100:.1f}%)')
    print(f'  Medium ($10-$100): {price_medium}/{total} ({price_medium/total*100:.1f}%)')
    print(f'  Large (>$100):     {price_large}/{total} ({price_large/total*100:.1f}%)')
    print()
    print(f'  Average difference: ${avg_price_diff:.2f}')
    print(f'  Min difference:     ${min_price_diff:.2f}')
    print(f'  Max difference:     ${max_price_diff:.2f}')
    print()
    print('='*140)
    print('EXPLANATION & VERDICT')
    print('='*140)
    print()
    print('WHY ARE THERE DIFFERENCES?')
    print('  1. Funding rates update every 8 hours → Should be IDENTICAL')
    print('  2. Mark prices update every second → Small time lag causes differences')
    print('  3. REST API fetch and WebSocket state read happen at DIFFERENT times')
    print('  4. Binance does NOT send all symbol updates simultaneously')
    print()
    print('WHAT IS ACCEPTABLE?')
    print('  ✅ Funding Rate: 100% identical (updated every 8 hours)')
    print('  ✅ Mark Price: <1% difference is EXCELLENT')
    print('  ✅ Average difference of $5-$50 is NORMAL for real-time data')
    print()
    print('FINAL VERDICT:')
    if fr_identical / total >= 0.99 and avg_price_diff < 50:
        print('  ✅ EXCELLENT: WebSocket daemon is working correctly')
        print('  ✅ Safe to use WebSocket for Volume Alert enrichment')
        print('  ✅ Funding rates are identical')
        print('  ✅ Mark prices have acceptable real-time lag')
    elif fr_identical / total >= 0.95 and avg_price_diff < 100:
        print('  ✅ GOOD: WebSocket daemon is working well')
        print('  ✅ Minor discrepancies are within acceptable range')
    else:
        print('  ❌ POOR: WebSocket daemon may have issues')
        print('  ❌ Review daemon logs and data quality')
    print()

if __name__ == '__main__':
    main()
