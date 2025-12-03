#!/usr/bin/env python3
"""
Generate Detailed Comparison Report: REST vs WebSocket
Shows timestamps, exact values for both Funding Rates and Mark Prices
"""
import json
import time
import requests
from datetime import datetime

# Test 15 different symbols
symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT',
    'MATICUSDT', 'DOTUSDT', 'LTCUSDT', 'TRXUSDT', 'ATOMUSDT'
]

STATE_FILE = '/home/trader/volume-spike-bot/.funding_state.json'
BINANCE_API_BASE = 'https://fapi.binance.com'

def format_timestamp(ts):
    return datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

def get_rest_funding_and_price(symbol):
    # Fetch from REST API with timing
    request_time = time.time()

    try:
        # Premium index for funding rate
        funding_url = f'{BINANCE_API_BASE}/fapi/v1/premiumIndex?symbol={symbol}'
        resp = requests.get(funding_url, timeout=5)
        response_time = time.time()

        if resp.status_code != 200:
            return None

        data = resp.json()
        latency = (response_time - request_time) * 1000  # ms

        return {
            'request_time': request_time,
            'response_time': response_time,
            'latency_ms': latency,
            'funding_rate': float(data.get('lastFundingRate', 0)),
            'mark_price': float(data.get('markPrice', 0)),
            'raw_data': data
        }
    except Exception as e:
        print(f"REST API error for {symbol}: {e}")
        return None

def get_websocket_funding_and_price(symbol):
    # Fetch from WebSocket state file with timing
    request_time = time.time()

    try:
        with open(STATE_FILE, 'r') as f:
            state = json.load(f)

        response_time = time.time()
        funding_state = state.get('funding_state', {})

        if symbol not in funding_state:
            return None

        symbol_data = funding_state[symbol]
        data_age = time.time() - symbol_data.get('updatedAt', 0)

        return {
            'request_time': request_time,
            'response_time': response_time,
            'data_age_ms': data_age * 1000,
            'funding_rate': symbol_data.get('fundingRate'),
            'mark_price': symbol_data.get('markPrice'),
            'raw_data': symbol_data
        }
    except Exception as e:
        print(f"WebSocket state error for {symbol}: {e}")
        return None

def compare_values(rest_val, ws_val):
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

    # Consider match if < 0.1% difference
    match = pct_diff < 0.1

    return {
        'absolute_diff': abs_diff,
        'percent_diff': pct_diff,
        'match': match
    }

def generate_report():
    print("=" * 100)
    print("DETAILED COMPARISON REPORT: REST API vs WebSocket")
    print("=" * 100)
    print(f"Report generated: {format_timestamp(time.time())}")
    print()

    results = []

    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{len(symbols)}] Testing {symbol}...")
        print("-" * 100)

        # Get REST data
        rest_data = get_rest_funding_and_price(symbol)

        # Small delay to let WebSocket data arrive
        time.sleep(0.5)

        # Get WebSocket data
        ws_data = get_websocket_funding_and_price(symbol)

        if not rest_data or not ws_data:
            print(f"  ⚠️  Skipped (missing data)")
            print()
            continue

        # Display REST API details
        print()
        print(f"  REST API Call:")
        print(f"    Request Time:  {format_timestamp(rest_data['request_time'])}")
        print(f"    Response Time: {format_timestamp(rest_data['response_time'])}")
        print(f"    Latency:       {rest_data['latency_ms']:.2f} ms")
        print(f"    Funding Rate:  {rest_data['funding_rate']:.8f}")
        print(f"    Mark Price:    ${rest_data['mark_price']:.4f}")

        # Display WebSocket details
        print()
        print(f"  WebSocket State:")
        print(f"    Request Time:  {format_timestamp(ws_data['request_time'])}")
        print(f"    Response Time: {format_timestamp(ws_data['response_time'])}")
        print(f"    Data Age:      {ws_data['data_age_ms']:.2f} ms")
        if ws_data['funding_rate'] is not None:
            print(f"    Funding Rate:  {ws_data['funding_rate']:.8f}")
        else:
            print(f"    Funding Rate:  None")
        if ws_data['mark_price'] is not None:
            print(f"    Mark Price:    ${ws_data['mark_price']:.4f}")
        else:
            print(f"    Mark Price:    None")

        # Compare funding rates
        funding_cmp = compare_values(rest_data['funding_rate'], ws_data['funding_rate'])

        # Compare mark prices
        price_cmp = compare_values(rest_data['mark_price'], ws_data['mark_price'])

        # Display comparison
        print()
        print(f"  Funding Rate Comparison:")
        if funding_cmp['absolute_diff'] is not None:
            print(f"    Absolute Diff: {funding_cmp['absolute_diff']:.8f}")
            print(f"    Percent Diff:  {funding_cmp['percent_diff']:.4f}%")
            print(f"    Match:         {'✅ YES' if funding_cmp['match'] else '❌ NO'}")
        else:
            print(f"    Status:        ⚠️  Cannot compare (missing data)")

        print()
        print(f"  Mark Price Comparison:")
        if price_cmp['absolute_diff'] is not None:
            print(f"    Absolute Diff: ${price_cmp['absolute_diff']:.4f}")
            print(f"    Percent Diff:  {price_cmp['percent_diff']:.4f}%")
            print(f"    Match:         {'✅ YES' if price_cmp['match'] else '❌ NO'}")
        else:
            print(f"    Status:        ⚠️  Cannot compare (missing data)")

        print()
        print("-" * 100)
        print()

        # Store results
        results.append({
            'symbol': symbol,
            'rest': rest_data,
            'ws': ws_data,
            'funding_comparison': funding_cmp,
            'price_comparison': price_cmp
        })

        # Delay between symbols
        time.sleep(1)

    # Summary statistics
    print()
    print("=" * 100)
    print("SUMMARY STATISTICS")
    print("=" * 100)
    print()

    funding_matches = sum(1 for r in results if r['funding_comparison']['match'])
    price_matches = sum(1 for r in results if r['price_comparison']['match'])
    total = len(results)

    print(f"Total Symbols Tested: {total}")
    print()
    print(f"Funding Rate Matches: {funding_matches}/{total} ({funding_matches/total*100:.1f}%)")
    print(f"Mark Price Matches:   {price_matches}/{total} ({price_matches/total*100:.1f}%)")
    print()

    # Average differences
    funding_diffs = [r['funding_comparison']['percent_diff'] for r in results if r['funding_comparison']['percent_diff'] is not None]
    price_diffs = [r['price_comparison']['percent_diff'] for r in results if r['price_comparison']['percent_diff'] is not None]

    if funding_diffs:
        avg_funding_diff = sum(funding_diffs) / len(funding_diffs)
        max_funding_diff = max(funding_diffs)
        print(f"Funding Rate - Avg Diff: {avg_funding_diff:.4f}%")
        print(f"Funding Rate - Max Diff: {max_funding_diff:.4f}%")
        print()

    if price_diffs:
        avg_price_diff = sum(price_diffs) / len(price_diffs)
        max_price_diff = max(price_diffs)
        print(f"Mark Price - Avg Diff:   {avg_price_diff:.4f}%")
        print(f"Mark Price - Max Diff:   {max_price_diff:.4f}%")
        print()

    print("=" * 100)
    print()

    # Recommendation
    if funding_matches == total and price_matches == total:
        print("✅ RECOMMENDATION: WebSocket data is IDENTICAL to REST API")
        print("   Safe to switch Volume Alert enrichment to WebSocket-only mode")
    elif funding_matches >= total * 0.95 and price_matches >= total * 0.95:
        print("✅ RECOMMENDATION: WebSocket data is HIGHLY ACCURATE (95%+ match)")
        print("   Safe to switch Volume Alert enrichment to WebSocket-only mode")
    else:
        print("⚠️  RECOMMENDATION: Review mismatches before switching")
        print("   Some symbols show significant differences")

    print()

if __name__ == '__main__':
    generate_report()
