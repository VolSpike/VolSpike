#!/usr/bin/env python3
"""
Simple Funding Rate Verification Tool
────────────────────────────────────────────────────────────────────────────
Compares REST API vs WebSocket funding rates in real-time.
Shows side-by-side data and highlights differences.

Usage:
    python3 verify_funding_data.py
"""

import requests
import time
import sys
from datetime import datetime

# Configuration
BINANCE_API = "https://fapi.binance.com"
WS_API = "http://localhost:8888/funding"

# Test symbols (high volume pairs)
TEST_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "MATICUSDT", "DOTUSDT", "AVAXUSDT"
]

def fetch_rest_funding(symbol):
    """Get funding rate from Binance REST API"""
    try:
        resp = requests.get(
            f"{BINANCE_API}/fapi/v1/premiumIndex",
            params={"symbol": symbol},
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "funding": float(data.get("lastFundingRate", 0)),
                "mark": float(data.get("markPrice", 0)),
                "next": data.get("nextFundingTime"),
                "source": "REST"
            }
    except Exception as e:
        return {"error": str(e), "source": "REST"}
    return None

def fetch_ws_funding(symbol):
    """Get funding rate from WebSocket API"""
    try:
        resp = requests.get(f"{WS_API}/{symbol}", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "funding": data.get("fundingRate"),
                "mark": data.get("markPrice"),
                "next": data.get("nextFundingTime"),
                "age": data.get("ageSeconds", 0),
                "source": "WS"
            }
        elif resp.status_code == 404:
            return {"error": "Symbol not found", "source": "WS"}
        elif resp.status_code == 503:
            return {"error": "Data stale", "source": "WS"}
    except Exception as e:
        return {"error": str(e), "source": "WS"}
    return None

def calculate_diff(val1, val2):
    """Calculate percentage difference"""
    if val1 == 0:
        return 0
    return abs((val1 - val2) / val1) * 100

def print_header():
    """Print table header"""
    print("\n" + "=" * 130)
    print(f"{'Symbol':<12} {'REST Funding':<15} {'WS Funding':<15} {'Diff %':<10} {'REST Mark':<12} {'WS Mark':<12} {'Mark Diff %':<12} {'WS Age':<8} {'Status'}")
    print("=" * 130)

def print_comparison(symbol, rest_data, ws_data):
    """Print comparison row"""
    if not rest_data or "error" in rest_data:
        print(f"{symbol:<12} {'ERROR':<15} {'-':<15} {'-':<10} {'-':<12} {'-':<12} {'-':<12} {'-':<8} REST FAIL")
        return None

    if not ws_data or "error" in ws_data:
        ws_err = ws_data.get("error", "N/A") if ws_data else "N/A"
        print(f"{symbol:<12} {rest_data['funding']:>14.6f} {'ERROR':<15} {'-':<10} {rest_data['mark']:>11.2f} {'-':<12} {'-':<12} {'-':<8} WS FAIL: {ws_err}")
        return None

    # Calculate differences
    funding_diff = calculate_diff(rest_data["funding"], ws_data["funding"])
    mark_diff = calculate_diff(rest_data["mark"], ws_data["mark"])

    # Color code based on difference
    status = "✓ MATCH" if funding_diff < 0.01 else ("⚠ CLOSE" if funding_diff < 0.1 else "✗ DIFF")

    print(
        f"{symbol:<12} "
        f"{rest_data['funding']:>14.6f} "
        f"{ws_data['funding']:>14.6f} "
        f"{funding_diff:>9.3f}% "
        f"{rest_data['mark']:>11.2f} "
        f"{ws_data['mark']:>11.2f} "
        f"{mark_diff:>11.3f}% "
        f"{ws_data['age']:>7.1f}s "
        f"{status}"
    )

    return {
        "symbol": symbol,
        "funding_diff": funding_diff,
        "mark_diff": mark_diff,
        "ws_age": ws_data["age"]
    }

def main():
    print("\n" + "=" * 130)
    print("Funding Rate Data Verification - REST API vs WebSocket Comparison")
    print("=" * 130)
    print(f"\nTesting {len(TEST_SYMBOLS)} symbols...")
    print(f"REST API: {BINANCE_API}")
    print(f"WebSocket API: {WS_API}")

    try:
        iteration = 0
        while True:
            iteration += 1
            print(f"\n\n{'=' * 130}")
            print(f"Iteration #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print_header()

            results = []
            for symbol in TEST_SYMBOLS:
                rest_data = fetch_rest_funding(symbol)
                ws_data = fetch_ws_funding(symbol)
                result = print_comparison(symbol, rest_data, ws_data)
                if result:
                    results.append(result)
                time.sleep(0.1)  # Rate limiting

            # Summary
            if results:
                avg_funding_diff = sum(r["funding_diff"] for r in results) / len(results)
                max_funding_diff = max(r["funding_diff"] for r in results)
                avg_ws_age = sum(r["ws_age"] for r in results) / len(results)

                print("=" * 130)
                print(f"\nSummary:")
                print(f"  Successful comparisons: {len(results)}/{len(TEST_SYMBOLS)}")
                print(f"  Average funding diff: {avg_funding_diff:.4f}%")
                print(f"  Maximum funding diff: {max_funding_diff:.4f}%")
                print(f"  Average WS data age: {avg_ws_age:.1f}s")

                if max_funding_diff < 0.1:
                    print(f"  ✅ Status: EXCELLENT - Differences < 0.1%")
                elif max_funding_diff < 1.0:
                    print(f"  ⚠️  Status: GOOD - Differences < 1.0%")
                else:
                    print(f"  ✗ Status: REVIEW NEEDED - Some differences > 1.0%")

            print(f"\nNext check in 10 seconds... (Press Ctrl+C to stop)")
            time.sleep(10)

    except KeyboardInterrupt:
        print("\n\nStopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
