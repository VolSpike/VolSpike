#!/usr/bin/env python3
"""
Dual Alert Simulation - Compare Volume Alerts with REST vs WebSocket Funding
────────────────────────────────────────────────────────────────────────────
Simulates volume alerts using both REST and WebSocket funding rate data.
Shows side-by-side comparison to verify they produce identical results.

Usage:
    python3 simulate_dual_alerts.py
"""

import requests
import time
from datetime import datetime
from typing import Dict, Optional

# Configuration
BINANCE_API = "https://fapi.binance.com"
WS_API = "http://localhost:8888/funding"

# Test with recent high-volume symbols
TEST_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
]

session = requests.Session()

def fetch_funding_rest(symbol: str) -> Optional[float]:
    """Fetch funding rate from REST API (current method)"""
    try:
        resp = session.get(
            f"{BINANCE_API}/fapi/v1/premiumIndex",
            params={"symbol": symbol},
            timeout=5
        )
        if resp.status_code == 200:
            return float(resp.json().get("lastFundingRate", 0))
    except:
        pass
    return None

def fetch_funding_ws(symbol: str) -> Optional[float]:
    """Fetch funding rate from WebSocket API (new method)"""
    try:
        resp = session.get(f"{WS_API}/{symbol}", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("fundingRate")
    except:
        pass
    return None

def fetch_klines(symbol: str) -> Optional[Dict]:
    """Fetch recent klines to simulate volume spike detection"""
    try:
        resp = session.get(
            f"{BINANCE_API}/fapi/v1/klines",
            params={"symbol": symbol, "interval": "1h", "limit": 2},
            timeout=10
        )
        if resp.status_code == 200:
            klines = resp.json()
            if len(klines) >= 2:
                prev, curr = klines[-2], klines[-1]
                return {
                    "prev_volume": float(prev[7]),
                    "curr_volume": float(curr[7]),
                    "ratio": float(curr[7]) / float(prev[7]) if float(prev[7]) > 0 else 0,
                    "open_price": float(curr[1]),
                    "current_price": float(curr[4]),
                }
    except:
        pass
    return None

def format_alert_message(symbol: str, asset: str, volume: float, ratio: float,
                         funding: float, candle_dir: str, source: str) -> str:
    """Format volume alert message (mimics production format)"""
    vol_str = f"{volume/1e6:.2f}M" if volume >= 1e6 else f"{volume/1e3:.2f}K"
    candle_emoji = "🟢" if candle_dir == "bullish" else "🔴"
    return (
        f"[{source}] {asset} hourly volume {vol_str} ({ratio:.2f}× prev) "
        f"- Funding: {funding:+.4f}% {candle_emoji}"
    )

def simulate_alert_for_symbol(symbol: str):
    """Simulate volume alert with both REST and WS funding rates"""
    print(f"\n{'─' * 100}")
    print(f"Symbol: {symbol}")
    print(f"{'─' * 100}")

    # Fetch kline data
    kline_data = fetch_klines(symbol)
    if not kline_data:
        print(f"  ✗ Failed to fetch kline data")
        return

    # Check if it would trigger an alert (3x volume spike)
    is_spike = kline_data["ratio"] >= 3.0 and kline_data["curr_volume"] >= 3_000_000

    # Determine candle direction
    candle_dir = "bullish" if kline_data["current_price"] > kline_data["open_price"] else "bearish"
    candle_emoji = "🟢" if candle_dir == "bullish" else "🔴"

    print(f"  Volume Data:")
    print(f"    Previous: ${kline_data['prev_volume']:,.0f}")
    print(f"    Current:  ${kline_data['curr_volume']:,.0f}")
    print(f"    Ratio:    {kline_data['ratio']:.2f}×")
    print(f"    Candle:   {candle_dir.upper()} {candle_emoji}")
    print(f"    Spike:    {'YES ⚡' if is_spike else 'NO'}")

    # Fetch funding rates from both sources
    funding_rest = fetch_funding_rest(symbol)
    funding_ws = fetch_funding_ws(symbol)

    print(f"\n  Funding Rate Comparison:")
    print(f"    REST API:    {funding_rest:+.6f} ({funding_rest*100:+.4f}%)" if funding_rest is not None else "    REST API:    ERROR")
    print(f"    WebSocket:   {funding_ws:+.6f} ({funding_ws*100:+.4f}%)" if funding_ws is not None else "    WebSocket:   ERROR")

    if funding_rest is not None and funding_ws is not None:
        diff = abs(funding_rest - funding_ws)
        diff_pct = (diff / abs(funding_rest)) * 100 if funding_rest != 0 else 0

        print(f"    Difference:  {diff:.6f} ({diff_pct:.3f}%)")

        if diff_pct < 0.01:
            print(f"    Status:      ✅ IDENTICAL")
        elif diff_pct < 0.1:
            print(f"    Status:      ✅ VERY CLOSE")
        elif diff_pct < 1.0:
            print(f"    Status:      ⚠️  CLOSE")
        else:
            print(f"    Status:      ✗ SIGNIFICANT DIFFERENCE")

    # Simulate alert messages (if it were a spike)
    if is_spike or True:  # Always show for demonstration
        asset = symbol.replace("USDT", "")
        print(f"\n  Simulated Alert Messages:")

        if funding_rest is not None:
            msg_rest = format_alert_message(
                symbol, asset, kline_data["curr_volume"], kline_data["ratio"],
                funding_rest * 100, candle_dir, "REST"
            )
            print(f"    {msg_rest}")

        if funding_ws is not None:
            msg_ws = format_alert_message(
                symbol, asset, kline_data["curr_volume"], kline_data["ratio"],
                funding_ws * 100, candle_dir, "WS"
            )
            print(f"    {msg_ws}")

        # Alert payload comparison
        if funding_rest is not None and funding_ws is not None:
            print(f"\n  Alert Payload Comparison:")
            print(f"    Both payloads would be IDENTICAL except for fundingRate:")
            print(f"      REST fundingRate: {funding_rest:.6f}")
            print(f"      WS fundingRate:   {funding_ws:.6f}")
            print(f"      Impact on dashboard: {'NONE - Users would see same data' if diff_pct < 0.1 else 'MINIMAL - Negligible difference'}")

def main():
    print("\n" + "=" * 100)
    print("Dual Alert Simulation - REST vs WebSocket Funding Rate Comparison")
    print("=" * 100)
    print(f"\nThis script simulates volume alerts using both REST and WebSocket funding data.")
    print(f"It shows side-by-side comparison to verify identical results.\n")
    print(f"REST API: {BINANCE_API}")
    print(f"WebSocket API: {WS_API}")
    print(f"\nTesting {len(TEST_SYMBOLS)} symbols...\n")

    try:
        iteration = 0
        while True:
            iteration += 1
            print(f"\n\n{'=' * 100}")
            print(f"Iteration #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'=' * 100}")

            for symbol in TEST_SYMBOLS:
                simulate_alert_for_symbol(symbol)
                time.sleep(0.2)  # Rate limiting

            print(f"\n\n{'=' * 100}")
            print(f"Next check in 30 seconds... (Press Ctrl+C to stop)")
            print(f"{'=' * 100}")
            time.sleep(30)

    except KeyboardInterrupt:
        print("\n\nStopped by user.")

if __name__ == "__main__":
    main()
