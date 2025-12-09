"""
User Cross Alert Checker – VolSpike
────────────────────────────────────────────────────────────────────────────────────────
• Fetches active user alerts from VolSpike backend
• Polls Binance API for current market data (price, funding rate, open interest)
• Detects threshold crosses (above→below or below→above)
• Triggers alerts via VolSpike backend API
• Runs every 5-15 minutes depending on user tier
"""

import os
import time
import datetime
import requests
import sys
from typing import Dict, List, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# VolSpike Integration
VOLSPIKE_API_URL = os.getenv("VOLSPIKE_API_URL")
VOLSPIKE_API_KEY = os.getenv("VOLSPIKE_API_KEY")

# Binance API
BINANCE_API = "https://fapi.binance.com"

# WebSocket Funding API Configuration
WS_FUNDING_API_URL = "http://localhost:8888/funding"
WS_FUNDING_ENABLED = os.getenv("WS_FUNDING_ENABLED", "true").lower() == "true"

# ─────────────────────── requests session ───────────────────────
session = requests.Session()
adapter = HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1,
                                        status_forcelist=[429, 500, 502, 503, 504]))
session.mount("http://", adapter)
session.mount("https://", adapter)


# ────────────────────────── helpers ────────────────────────────

def fetch_active_alerts() -> List[Dict]:
    """Fetch all active user alerts from VolSpike backend."""
    if not VOLSPIKE_API_URL or not VOLSPIKE_API_KEY:
        print("⚠️  VOLSPIKE_API_URL or VOLSPIKE_API_KEY not configured")
        return []

    try:
        url = f"{VOLSPIKE_API_URL}/api/user-alerts-trigger/active"
        params = {"apiKey": VOLSPIKE_API_KEY}

        resp = session.get(url, params=params, timeout=10)

        if resp.status_code == 200:
            data = resp.json()
            alerts = data.get("alerts", [])
            print(f"✅ Fetched {len(alerts)} active alerts")
            return alerts
        elif resp.status_code == 401:
            print(f"❌ Authentication failed - check VOLSPIKE_API_KEY")
            return []
        else:
            print(f"❌ Failed to fetch alerts: {resp.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error fetching alerts: {e}")
        return []


def fetch_ticker_price(symbol: str) -> Optional[float]:
    """Fetch current price from Binance ticker."""
    try:
        url = f"{BINANCE_API}/fapi/v1/ticker/price"
        params = {"symbol": symbol}

        resp = session.get(url, params=params, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            return float(data["price"])
        else:
            print(f"  ⚠️  Failed to fetch price for {symbol}: {resp.status_code}")
            return None
    except Exception as e:
        print(f"  ⚠️  Error fetching price for {symbol}: {e}")
        return None


def fetch_funding_rate(symbol: str) -> Optional[float]:
    """
    Fetch funding rate from WebSocket service (preferred) or Binance API (fallback).
    Returns funding rate as decimal (e.g., 0.0001 for 0.01%).
    """
    # Try WebSocket service first
    if WS_FUNDING_ENABLED:
        try:
            url = f"{WS_FUNDING_API_URL}/{symbol}"
            resp = session.get(url, timeout=1)

            if resp.status_code == 200:
                data = resp.json()
                funding_rate = data.get("fundingRate")
                if funding_rate is not None:
                    return float(funding_rate)
            elif resp.status_code == 503:
                print(f"  ⚠️  WS funding data stale for {symbol}, using fallback")
        except Exception:
            pass  # Silent failure, fall back to Binance API

    # Fallback to Binance API
    try:
        url = f"{BINANCE_API}/fapi/v1/premiumIndex"
        params = {"symbol": symbol}

        resp = session.get(url, params=params, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            return float(data["lastFundingRate"])
        else:
            print(f"  ⚠️  Failed to fetch funding rate for {symbol}: {resp.status_code}")
            return None
    except Exception as e:
        print(f"  ⚠️  Error fetching funding rate for {symbol}: {e}")
        return None


def fetch_open_interest(symbol: str) -> Optional[float]:
    """
    Fetch open interest in USD from Binance API.
    Returns OI in USD (e.g., 1000000000 for $1B).
    """
    try:
        url = f"{BINANCE_API}/fapi/v1/openInterest"
        params = {"symbol": symbol}

        resp = session.get(url, params=params, timeout=5)

        if resp.status_code == 200:
            data = resp.json()
            open_interest_contracts = float(data["openInterest"])

            # Get mark price to convert to USD
            price = fetch_ticker_price(symbol)
            if price is None:
                return None

            open_interest_usd = open_interest_contracts * price
            return open_interest_usd
        else:
            print(f"  ⚠️  Failed to fetch OI for {symbol}: {resp.status_code}")
            return None
    except Exception as e:
        print(f"  ⚠️  Error fetching OI for {symbol}: {e}")
        return None


def get_current_value(symbol: str, alert_type: str) -> Optional[float]:
    """Get current market value based on alert type."""
    if alert_type == "PRICE_CROSS":
        return fetch_ticker_price(symbol)
    elif alert_type == "FUNDING_CROSS":
        return fetch_funding_rate(symbol)
    elif alert_type == "OI_CROSS":
        return fetch_open_interest(symbol)
    else:
        print(f"  ⚠️  Unknown alert type: {alert_type}")
        return None


def check_cross(previous_value: Optional[float], current_value: float, threshold: float) -> Optional[bool]:
    """
    Check if value crossed threshold.
    Returns True if crossed up, False if crossed down, None if no cross.
    """
    if previous_value is None:
        # First check, no previous value to compare
        return None

    crossed_up = previous_value < threshold and current_value >= threshold
    crossed_down = previous_value > threshold and current_value <= threshold

    if crossed_up:
        return True
    elif crossed_down:
        return False
    else:
        return None


def trigger_alert(alert_id: str, symbol: str, current_value: float, previous_value: float, threshold: float, crossed_up: bool):
    """Trigger alert via VolSpike backend API."""
    if not VOLSPIKE_API_URL or not VOLSPIKE_API_KEY:
        print("⚠️  VOLSPIKE_API_URL or VOLSPIKE_API_KEY not configured")
        return

    try:
        url = f"{VOLSPIKE_API_URL}/api/user-alerts-trigger/trigger"
        payload = {
            "alertId": alert_id,
            "symbol": symbol,
            "currentValue": current_value,
            "previousValue": previous_value,
            "crossedUp": crossed_up,
            "apiKey": VOLSPIKE_API_KEY,
        }

        resp = session.post(url, json=payload, timeout=10)

        if resp.status_code == 200:
            direction = "↑" if crossed_up else "↓"
            print(f"  🔔 Alert triggered: {symbol} crossed {direction} (current: {current_value:.8f}, threshold: {threshold:.8f})")
        elif resp.status_code == 404:
            print(f"  ⚠️  Alert not found: {alert_id}")
        elif resp.status_code == 400:
            error_data = resp.json()
            print(f"  ⚠️  Invalid alert state: {error_data.get('error', 'Unknown error')}")
        else:
            print(f"  ❌ Failed to trigger alert: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Error triggering alert: {e}")


def update_checked_value(alert_id: str, last_checked_value: float):
    """Update alert's lastCheckedValue via VolSpike backend API."""
    if not VOLSPIKE_API_URL or not VOLSPIKE_API_KEY:
        return

    try:
        url = f"{VOLSPIKE_API_URL}/api/user-alerts-trigger/update-checked"
        payload = {
            "alertId": alert_id,
            "lastCheckedValue": last_checked_value,
            "apiKey": VOLSPIKE_API_KEY,
        }

        resp = session.post(url, json=payload, timeout=10)

        if resp.status_code != 200:
            print(f"  ⚠️  Failed to update checked value for {alert_id}: {resp.status_code}")
    except Exception as e:
        print(f"  ⚠️  Error updating checked value: {e}")


def check_alerts():
    """Main alert checking logic."""
    print(f"\n{'='*80}")
    print(f"User Alert Checker – {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    # Fetch all active alerts
    alerts = fetch_active_alerts()

    if not alerts:
        print("No active alerts to check\n")
        return

    # Group alerts by symbol to minimize API calls
    alerts_by_symbol: Dict[str, List[Dict]] = {}
    for alert in alerts:
        symbol = alert["symbol"]
        if symbol not in alerts_by_symbol:
            alerts_by_symbol[symbol] = []
        alerts_by_symbol[symbol].append(alert)

    print(f"Checking {len(alerts)} alerts across {len(alerts_by_symbol)} symbols\n")

    # Process each symbol
    for symbol, symbol_alerts in alerts_by_symbol.items():
        print(f"📊 {symbol}")

        for alert in symbol_alerts:
            alert_id = alert["id"]
            alert_type = alert["alertType"]
            threshold = alert["threshold"]
            last_checked_value = alert.get("lastCheckedValue")

            # Fetch current value
            current_value = get_current_value(symbol, alert_type)

            if current_value is None:
                print(f"  ⚠️  Failed to fetch {alert_type} value, skipping")
                continue

            # Check for cross
            crossed = check_cross(last_checked_value, current_value, threshold)

            if crossed is not None:
                # Cross detected!
                trigger_alert(alert_id, symbol, current_value, last_checked_value, threshold, crossed)
            else:
                # No cross, just update last checked value
                update_checked_value(alert_id, current_value)

        print()  # Blank line between symbols


def main():
    """Main loop."""
    print("🚀 User Alert Checker started")
    print(f"   Backend: {VOLSPIKE_API_URL}")
    print(f"   WS Funding: {'Enabled' if WS_FUNDING_ENABLED else 'Disabled'}\n")

    while True:
        try:
            check_alerts()
        except KeyboardInterrupt:
            print("\n👋 Shutting down gracefully...")
            break
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()

        # Sleep for 5 minutes (300 seconds)
        # TODO: Adjust based on user tier in future (15min for Free, 5min for Pro, real-time for Elite)
        print(f"💤 Sleeping for 5 minutes... (next check at {(datetime.datetime.now() + datetime.timedelta(minutes=5)).strftime('%H:%M:%S')})\n")
        time.sleep(300)


if __name__ == "__main__":
    main()
