#!/usr/bin/env python3
"""
Comprehensive Funding Rate & Price Comparison
Tests ALL USDT perpetual futures: REST API vs WebSocket
"""
import json
import time
import requests
from datetime import datetime
from pathlib import Path

STATE_FILE = Path('/home/trader/volume-spike-bot/.funding_state.json')
BINANCE_API_BASE = 'https://fapi.binance.com'

def format_timestamp(ts):
    return datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

def get_all_symbols():
    """Get all USDT perpetual futures from Binance"""
    resp = requests.get(f'{BINANCE_API_BASE}/fapi/v1/exchangeInfo', timeout=10)
    data = resp.json()

    symbols = [s['symbol'] for s in data['symbols']
               if s['symbol'].endswith('USDT')
               and s['status'] == 'TRADING'
               and s['contractType'] == 'PERPETUAL']

    return sorted(symbols)

def get_rest_data_batch(symbols):
    """Get funding rate and price for all symbols from REST API"""
    print(f"Fetching REST API data for {len(symbols)} symbols...")

    resp = requests.get(f'{BINANCE_API_BASE}/fapi/v1/premiumIndex', timeout=10)
    data = resp.json()

    result = {}
    for item in data:
        symbol = item.get('symbol')
        if symbol in symbols:
            result[symbol] = {
                'funding_rate': float(item.get('lastFundingRate', 0)),
                'mark_price': float(item.get('markPrice', 0)),
                'index_price': float(item.get('indexPrice', 0)),
                'next_funding_time': int(item.get('nextFundingTime', 0))
            }

    return result

def get_websocket_data():
    """Get all data from WebSocket state file"""
    with open(STATE_FILE, 'r') as f:
        state = json.load(f)

    return state.get('funding_state', {})

def compare_values(rest_val, ws_val, threshold=0.001):
    """Compare two values and return difference stats"""
    if rest_val is None or ws_val is None:
        return {
            'absolute_diff': None,
            'percent_diff': None,
            'match': False
        }

    abs_diff = abs(rest_val - ws_val)

    if rest_val != 0:
        pct_diff = (abs_diff / abs(rest_val)) * 100
    else:
        pct_diff = 0 if ws_val == 0 else 100

    match = pct_diff < threshold

    return {
        'absolute_diff': abs_diff,
        'percent_diff': pct_diff,
        'match': match
    }

def main():
    print("=" * 100)
    print("COMPREHENSIVE COMPARISON: ALL USDT PERPETUAL FUTURES")
    print("REST API vs WebSocket - Funding Rates & Mark Prices")
    print("=" * 100)
    print(f"Report generated: {format_timestamp(time.time())}")
    print()

    # Get all symbols
    all_symbols = get_all_symbols()
    print(f"Total USDT perpetual futures on Binance: {len(all_symbols)}")
    print()

    # Get REST API data
    rest_data = get_rest_data_batch(all_symbols)
    print(f"REST API returned data for: {len(rest_data)} symbols")

    # Get WebSocket data
    ws_data = get_websocket_data()
    print(f"WebSocket tracking: {len(ws_data)} symbols")
    print()

    # Analysis buckets
    perfect_matches = []
    price_mismatches = []
    funding_mismatches = []
    missing_in_ws = []
    missing_in_rest = []
    data_quality_issues = []

    # Compare each symbol
    for symbol in all_symbols:
        rest = rest_data.get(symbol)
        ws = ws_data.get(symbol)

        if not rest:
            missing_in_rest.append(symbol)
            continue

        if not ws:
            missing_in_ws.append(symbol)
            continue

        # Check for None values
        ws_funding = ws.get('fundingRate')
        ws_price = ws.get('markPrice')

        if ws_funding is None or ws_price is None:
            data_quality_issues.append({
                'symbol': symbol,
                'issue': f"WebSocket missing data (funding={ws_funding}, price={ws_price})"
            })
            continue

        # Compare funding rates
        funding_cmp = compare_values(rest['funding_rate'], ws_funding, threshold=0.01)

        # Compare prices
        price_cmp = compare_values(rest['mark_price'], ws_price, threshold=0.1)

        # Categorize
        if funding_cmp['match'] and price_cmp['match']:
            perfect_matches.append(symbol)
        else:
            if not funding_cmp['match']:
                funding_mismatches.append({
                    'symbol': symbol,
                    'rest': rest['funding_rate'],
                    'ws': ws_funding,
                    'diff_pct': funding_cmp['percent_diff']
                })

            if not price_cmp['match']:
                price_mismatches.append({
                    'symbol': symbol,
                    'rest': rest['mark_price'],
                    'ws': ws_price,
                    'diff_pct': price_cmp['percent_diff']
                })

    # Print results
    print("=" * 100)
    print("RESULTS SUMMARY")
    print("=" * 100)
    print()

    total_compared = len(perfect_matches) + len(price_mismatches) + len(funding_mismatches)

    print(f"✅ Perfect Matches: {len(perfect_matches)}/{len(all_symbols)} ({len(perfect_matches)/len(all_symbols)*100:.1f}%)")
    print(f"❌ Price Mismatches: {len(price_mismatches)}")
    print(f"❌ Funding Mismatches: {len(funding_mismatches)}")
    print(f"⚠️  Missing in WebSocket: {len(missing_in_ws)}")
    print(f"⚠️  Missing in REST: {len(missing_in_rest)}")
    print(f"⚠️  Data Quality Issues: {len(data_quality_issues)}")
    print()

    # Show price mismatches
    if price_mismatches:
        print("=" * 100)
        print("PRICE MISMATCHES (>0.1% difference)")
        print("=" * 100)
        print()

        for item in sorted(price_mismatches, key=lambda x: x['diff_pct'], reverse=True)[:50]:
            print(f"{item['symbol']:15} REST: ${item['rest']:>12,.4f}   WS: ${item['ws']:>12,.4f}   Diff: {item['diff_pct']:>8.4f}%")

        if len(price_mismatches) > 50:
            print(f"\n... and {len(price_mismatches) - 50} more")
        print()

    # Show funding mismatches
    if funding_mismatches:
        print("=" * 100)
        print("FUNDING RATE MISMATCHES (>0.01% difference)")
        print("=" * 100)
        print()

        for item in sorted(funding_mismatches, key=lambda x: x['diff_pct'], reverse=True)[:50]:
            print(f"{item['symbol']:15} REST: {item['rest']:>12.8f}   WS: {item['ws']:>12.8f}   Diff: {item['diff_pct']:>8.4f}%")

        if len(funding_mismatches) > 50:
            print(f"\n... and {len(funding_mismatches) - 50} more")
        print()

    # Show data quality issues
    if data_quality_issues:
        print("=" * 100)
        print("DATA QUALITY ISSUES")
        print("=" * 100)
        print()

        for item in data_quality_issues[:50]:
            print(f"{item['symbol']:15} {item['issue']}")

        if len(data_quality_issues) > 50:
            print(f"\n... and {len(data_quality_issues) - 50} more")
        print()

    # Show missing symbols
    if missing_in_ws:
        print("=" * 100)
        print("MISSING IN WEBSOCKET")
        print("=" * 100)
        print()
        print(f"Total: {len(missing_in_ws)} symbols")
        print(f"Examples: {', '.join(missing_in_ws[:20])}")
        if len(missing_in_ws) > 20:
            print(f"... and {len(missing_in_ws) - 20} more")
        print()

    # Show sample perfect matches
    print("=" * 100)
    print("SAMPLE PERFECT MATCHES (first 20)")
    print("=" * 100)
    print()

    for symbol in perfect_matches[:20]:
        rest = rest_data[symbol]
        ws = ws_data[symbol]
        print(f"{symbol:15} Funding: {rest['funding_rate']:>12.8f}   Price: ${rest['mark_price']:>12,.4f}   ✅")

    print()
    print("=" * 100)
    print("FINAL VERDICT")
    print("=" * 100)
    print()

    success_rate = len(perfect_matches) / len(all_symbols) * 100 if all_symbols else 0

    if success_rate >= 95:
        print("✅ EXCELLENT: WebSocket data matches REST API with >95% accuracy")
        print("   Safe to switch to WebSocket-only mode")
    elif success_rate >= 85:
        print("⚠️  GOOD: WebSocket data matches REST API with >85% accuracy")
        print("   Review mismatches before switching")
    else:
        print("❌ POOR: WebSocket data has significant mismatches")
        print("   Do NOT switch to WebSocket-only mode yet")

    print()

if __name__ == '__main__':
    main()
