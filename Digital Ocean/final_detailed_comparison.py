#!/usr/bin/env python3
"""
Final Detailed Comparison Report
Shows EVERY symbol with exact timestamps on EACH LINE
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
    rest_request_time = time.time()

    resp = requests.get(f'{BINANCE_API_BASE}/fapi/v1/premiumIndex', timeout=10)

    rest_response_time = time.time()
    rest_latency = (rest_response_time - rest_request_time) * 1000  # ms

    data = resp.json()

    result = {}
    for item in data:
        symbol = item.get('symbol')
        if symbol in symbols:
            result[symbol] = {
                'funding_rate': float(item.get('lastFundingRate', 0)),
                'mark_price': float(item.get('markPrice', 0)),
                'index_price': float(item.get('indexPrice', 0)),
                'next_funding_time': int(item.get('nextFundingTime', 0)),
                'request_time': rest_request_time,
                'response_time': rest_response_time,
                'latency_ms': rest_latency
            }

    return result, rest_request_time, rest_response_time

def get_websocket_data():
    """Get all data from WebSocket state file"""
    ws_request_time = time.time()

    with open(STATE_FILE, 'r') as f:
        state = json.load(f)

    ws_response_time = time.time()

    funding_state = state.get('funding_state', {})

    result = {}
    for symbol, data in funding_state.items():
        result[symbol] = {
            'funding_rate': data.get('fundingRate'),
            'mark_price': data.get('markPrice'),
            'index_price': data.get('indexPrice'),
            'next_funding_time': data.get('nextFundingTime'),
            'updated_at': data.get('updatedAt'),
            'request_time': ws_request_time,
            'response_time': ws_response_time
        }

    return result, ws_request_time, ws_response_time

def main():
    print("=" * 180)
    print("FINAL DETAILED COMPARISON REPORT - WITH TIMESTAMPS ON EACH LINE")
    print("=" * 180)
    report_time = time.time()
    print(f"Report Generated: {format_timestamp(report_time)}")
    print()

    # Get all symbols
    all_symbols = get_all_symbols()
    print(f"Total USDT Perpetual Futures: {len(all_symbols)}")
    print()

    # Get REST API data (single batch call)
    rest_data, rest_req_time, rest_resp_time = get_rest_data_batch(all_symbols)
    rest_latency = (rest_resp_time - rest_req_time) * 1000

    print("REST API Batch Call:")
    print(f"  Request:  {format_timestamp(rest_req_time)}")
    print(f"  Response: {format_timestamp(rest_resp_time)}")
    print(f"  Latency:  {rest_latency:.2f} ms")
    print()

    # Get WebSocket data
    ws_data, ws_req_time, ws_resp_time = get_websocket_data()
    ws_latency = (ws_resp_time - ws_req_time) * 1000

    print("WebSocket State Read:")
    print(f"  Request:  {format_timestamp(ws_req_time)}")
    print(f"  Response: {format_timestamp(ws_resp_time)}")
    print(f"  Latency:  {ws_latency:.2f} ms")
    print()

    # Header
    print("=" * 180)
    print("LINE-BY-LINE COMPARISON - ALL 534 SYMBOLS")
    print("=" * 180)
    print()
    print(f"{'SYMBOL':<15} {'REST TIME':<26} {'REST FR':<15} {'REST PRICE':<12} "
          f"{'WS TIME':<26} {'WS FR':<15} {'WS PRICE':<12} {'FR DIFF %':<10} {'$ DIFF %':<10} {'STATUS':<10}")
    print("-" * 180)

    perfect_matches = 0
    price_issues = []
    funding_issues = []
    null_issues = []

    for symbol in all_symbols:
        rest = rest_data.get(symbol)
        ws = ws_data.get(symbol)

        if not rest or not ws:
            continue

        # Get values
        rest_fr = rest['funding_rate']
        rest_price = rest['mark_price']
        rest_time = format_timestamp(rest['response_time'])

        ws_fr = ws['funding_rate']
        ws_price = ws['mark_price']
        ws_time = format_timestamp(ws['updated_at']) if ws.get('updated_at') else 'N/A'

        # Check for None
        if ws_fr is None or ws_price is None:
            null_issues.append(symbol)
            print(f"{symbol:<15} {rest_time:<26} {rest_fr:<15.8f} ${rest_price:<11.4f} "
                  f"{ws_time:<26} {'None':<15} ${str(ws_price) if ws_price else 'None':<11} {'N/A':<10} {'N/A':<10} {'⚠️ NULL':<10}")
            continue

        # Calculate differences
        fr_diff = abs(rest_fr - ws_fr)
        fr_pct = (fr_diff / abs(rest_fr) * 100) if rest_fr != 0 else 0

        price_diff = abs(rest_price - ws_price)
        price_pct = (price_diff / abs(rest_price) * 100) if rest_price != 0 else 0

        # Status
        fr_match = fr_pct < 0.01  # 0.01% threshold
        price_match = price_pct < 0.1  # 0.1% threshold

        if fr_match and price_match:
            status = "✅ MATCH"
            perfect_matches += 1
        else:
            status = "❌ DIFF"
            if not fr_match:
                funding_issues.append({
                    'symbol': symbol,
                    'rest_fr': rest_fr,
                    'ws_fr': ws_fr,
                    'diff_pct': fr_pct
                })
            if not price_match:
                price_issues.append({
                    'symbol': symbol,
                    'rest_price': rest_price,
                    'ws_price': ws_price,
                    'diff_pct': price_pct
                })

        # Print line
        print(f"{symbol:<15} {rest_time:<26} {rest_fr:<15.8f} ${rest_price:<11.4f} "
              f"{ws_time:<26} {ws_fr:<15.8f} ${ws_price:<11.4f} {fr_pct:<10.4f} {price_pct:<10.4f} {status:<10}")

    # Summary
    print()
    print("=" * 180)
    print("SUMMARY")
    print("=" * 180)
    print(f"Total Symbols: {len(all_symbols)}")
    print(f"Perfect Matches: {perfect_matches} ({perfect_matches/len(all_symbols)*100:.1f}%)")
    print(f"Funding Rate Issues: {len(funding_issues)}")
    print(f"Price Issues: {len(price_issues)}")
    print(f"Null Issues: {len(null_issues)}")
    print()

    if funding_issues:
        print("FUNDING RATE ISSUES (>0.01% difference):")
        print("-" * 180)
        for issue in sorted(funding_issues, key=lambda x: x['diff_pct'], reverse=True)[:20]:
            print(f"  {issue['symbol']:<15} REST: {issue['rest_fr']:.8f}  WS: {issue['ws_fr']:.8f}  Diff: {issue['diff_pct']:.4f}%")
        print()

    if price_issues:
        print("PRICE ISSUES (>0.1% difference):")
        print("-" * 180)
        for issue in sorted(price_issues, key=lambda x: x['diff_pct'], reverse=True)[:20]:
            print(f"  {issue['symbol']:<15} REST: ${issue['rest_price']:.4f}  WS: ${issue['ws_price']:.4f}  Diff: {issue['diff_pct']:.4f}%")
        print()

    if null_issues:
        print("NULL ISSUES (WebSocket has None values):")
        print("-" * 180)
        print(f"  {', '.join(null_issues[:20])}")
        if len(null_issues) > 20:
            print(f"  ... and {len(null_issues) - 20} more")
        print()

    # Final verdict
    print("=" * 180)
    print("FINAL VERDICT")
    print("=" * 180)
    success_rate = perfect_matches / len(all_symbols) * 100

    if success_rate == 100:
        print("✅ PERFECT: 100% match between REST API and WebSocket")
        print("   Safe to switch Volume Alert enrichment to WebSocket-only mode")
    elif success_rate >= 95:
        print(f"✅ EXCELLENT: {success_rate:.1f}% match between REST API and WebSocket")
        print("   Safe to switch Volume Alert enrichment to WebSocket-only mode")
    elif success_rate >= 85:
        print(f"⚠️  GOOD: {success_rate:.1f}% match between REST API and WebSocket")
        print("   Review issues before switching")
    else:
        print(f"❌ POOR: {success_rate:.1f}% match between REST API and WebSocket")
        print("   Do NOT switch to WebSocket-only mode yet")

    print()

if __name__ == '__main__':
    main()
