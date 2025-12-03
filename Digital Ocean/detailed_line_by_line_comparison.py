#!/usr/bin/env python3
"""
Detailed Line-by-Line Comparison Report
Shows EVERY symbol with exact timestamps and values for REST vs WebSocket
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

    return result

def get_websocket_data():
    """Get all data from WebSocket state file"""
    ws_request_time = time.time()

    with open(STATE_FILE, 'r') as f:
        state = json.load(f)

    ws_response_time = time.time()
    ws_latency = (ws_response_time - ws_request_time) * 1000  # ms

    funding_state = state.get('funding_state', {})
    updated_at = state.get('updated_at', 0)

    result = {}
    for symbol, data in funding_state.items():
        result[symbol] = {
            'funding_rate': data.get('fundingRate'),
            'mark_price': data.get('markPrice'),
            'index_price': data.get('indexPrice'),
            'next_funding_time': data.get('nextFundingTime'),
            'updated_at': data.get('updatedAt'),
            'request_time': ws_request_time,
            'response_time': ws_response_time,
            'latency_ms': ws_latency,
            'data_age_ms': (time.time() - data.get('updatedAt', 0)) * 1000
        }

    return result

def main():
    print("=" * 140)
    print("DETAILED LINE-BY-LINE COMPARISON REPORT")
    print("REST API vs WebSocket - Every Symbol with Timestamps and Exact Values")
    print("=" * 140)
    report_time = time.time()
    print(f"Report Generated: {format_timestamp(report_time)}")
    print()

    # Get all symbols
    all_symbols = get_all_symbols()
    print(f"Total USDT Perpetual Futures: {len(all_symbols)}")
    print()

    # Get REST API data (single batch call)
    rest_data = get_rest_data_batch(all_symbols)

    # Get WebSocket data
    ws_data = get_websocket_data()

    print("=" * 140)
    print("REST API BATCH CALL TIMING")
    print("=" * 140)
    if rest_data:
        first_symbol = list(rest_data.keys())[0]
        rest_timing = rest_data[first_symbol]
        print(f"Request Time:  {format_timestamp(rest_timing['request_time'])}")
        print(f"Response Time: {format_timestamp(rest_timing['response_time'])}")
        print(f"Latency:       {rest_timing['latency_ms']:.2f} ms")
        print(f"Symbols Retrieved: {len(rest_data)}")
    print()

    print("=" * 140)
    print("WEBSOCKET STATE FILE TIMING")
    print("=" * 140)
    if ws_data:
        first_symbol = list(ws_data.keys())[0]
        ws_timing = ws_data[first_symbol]
        print(f"Request Time:  {format_timestamp(ws_timing['request_time'])}")
        print(f"Response Time: {format_timestamp(ws_timing['response_time'])}")
        print(f"Read Latency:  {ws_timing['latency_ms']:.2f} ms")
        print(f"Symbols Tracked: {len(ws_data)}")
    print()

    # Detailed line-by-line comparison
    print("=" * 140)
    print("DETAILED COMPARISON - ALL SYMBOLS")
    print("=" * 140)
    print()

    # Header
    print(f"{'SYMBOL':<15} {'REST FUNDING':<15} {'WS FUNDING':<15} {'FUNDING DIFF':<15} "
          f"{'REST PRICE':<15} {'WS PRICE':<15} {'PRICE DIFF':<15} {'STATUS':<10}")
    print("-" * 140)

    perfect_matches = 0
    issues = []

    for symbol in all_symbols:
        rest = rest_data.get(symbol)
        ws = ws_data.get(symbol)

        if not rest:
            print(f"{symbol:<15} {'N/A':<15} {'N/A':<15} {'N/A':<15} "
                  f"{'N/A':<15} {'N/A':<15} {'N/A':<15} {'⚠️ NO REST':<10}")
            issues.append(f"{symbol}: No REST data")
            continue

        if not ws:
            print(f"{symbol:<15} {rest['funding_rate']:<15.8f} {'N/A':<15} {'N/A':<15} "
                  f"{rest['mark_price']:<15.4f} {'N/A':<15} {'N/A':<15} {'⚠️ NO WS':<10}")
            issues.append(f"{symbol}: No WebSocket data")
            continue

        # Check for None values
        ws_funding = ws['funding_rate']
        ws_price = ws['mark_price']

        if ws_funding is None or ws_price is None:
            print(f"{symbol:<15} {rest['funding_rate']:<15.8f} {'None':<15} {'N/A':<15} "
                  f"{rest['mark_price']:<15.4f} {str(ws_price) if ws_price else 'None':<15} {'N/A':<15} {'⚠️ NULL':<10}")
            issues.append(f"{symbol}: WebSocket has None values (funding={ws_funding}, price={ws_price})")
            continue

        # Calculate differences
        funding_diff = abs(rest['funding_rate'] - ws_funding)
        funding_pct = (funding_diff / abs(rest['funding_rate']) * 100) if rest['funding_rate'] != 0 else 0

        price_diff = abs(rest['mark_price'] - ws_price)
        price_pct = (price_diff / abs(rest['mark_price']) * 100) if rest['mark_price'] != 0 else 0

        # Status
        funding_match = funding_pct < 0.01  # 0.01% threshold
        price_match = price_pct < 0.1  # 0.1% threshold

        if funding_match and price_match:
            status = "✅ MATCH"
            perfect_matches += 1
        else:
            status = "❌ DIFF"
            if not funding_match:
                issues.append(f"{symbol}: Funding mismatch {funding_pct:.4f}%")
            if not price_match:
                issues.append(f"{symbol}: Price mismatch {price_pct:.4f}%")

        # Print line
        print(f"{symbol:<15} {rest['funding_rate']:<15.8f} {ws_funding:<15.8f} {funding_pct:<14.4f}% "
              f"${rest['mark_price']:<14.4f} ${ws_price:<14.4f} {price_pct:<14.4f}% {status:<10}")

    # Summary
    print()
    print("=" * 140)
    print("SUMMARY")
    print("=" * 140)
    print(f"Total Symbols: {len(all_symbols)}")
    print(f"Perfect Matches: {perfect_matches} ({perfect_matches/len(all_symbols)*100:.1f}%)")
    print(f"Issues: {len(issues)}")
    print()

    if issues:
        print("=" * 140)
        print("ISSUES DETAIL")
        print("=" * 140)
        for issue in issues:
            print(f"  • {issue}")
        print()

    # Detailed timestamp comparison for sample symbols
    print("=" * 140)
    print("TIMESTAMP DETAILS - SAMPLE SYMBOLS (First 10)")
    print("=" * 140)
    print()

    for symbol in all_symbols[:10]:
        rest = rest_data.get(symbol)
        ws = ws_data.get(symbol)

        if not rest or not ws:
            continue

        print(f"Symbol: {symbol}")
        print(f"  REST API:")
        print(f"    Request Time:  {format_timestamp(rest['request_time'])}")
        print(f"    Response Time: {format_timestamp(rest['response_time'])}")
        print(f"    Latency:       {rest['latency_ms']:.2f} ms")
        print(f"    Funding Rate:  {rest['funding_rate']:.8f}")
        print(f"    Mark Price:    ${rest['mark_price']:.4f}")
        print()
        print(f"  WebSocket:")
        print(f"    Request Time:  {format_timestamp(ws['request_time'])}")
        print(f"    Response Time: {format_timestamp(ws['response_time'])}")
        print(f"    Read Latency:  {ws['latency_ms']:.2f} ms")
        print(f"    Data Updated:  {format_timestamp(ws['updated_at'])}")
        print(f"    Data Age:      {ws['data_age_ms']:.2f} ms")
        fr = ws['funding_rate']
        mp = ws['mark_price']
        fr_str = f"{fr:.8f}" if fr is not None else "None"
        mp_str = f"${mp:.4f}" if mp is not None else "None"
        print(f"    Funding Rate:  {fr_str}")
        print(f"    Mark Price:    {mp_str}")
        print()
        print("-" * 140)
        print()

if __name__ == '__main__':
    main()
