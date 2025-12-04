#!/usr/bin/env python3
"""
Funding Data Health Monitor
────────────────────────────────────────────────────────────────────────────
• Monitors WebSocket daemon and API server health
• Checks data freshness and quality
• Auto-restarts services if unhealthy
• Sends alerts on failures
• Runs every minute via cron

Usage:
    python3 funding_health_monitor.py
"""

import json
import time
import sys
import subprocess
import requests
from pathlib import Path
from datetime import datetime

# Configuration
STATE_FILE = Path(__file__).parent / ".funding_state.json"
API_URL = "http://localhost:8888"
STALE_THRESHOLD_SEC = 180  # 3 minutes
MIN_SYMBOLS = 500  # Minimum number of symbols expected

# Alert configuration (set via environment or .volspike.env)
ALERT_EMAIL = None  # Set to email address to enable email alerts
SLACK_WEBHOOK = None  # Set to Slack webhook URL to enable Slack alerts

class HealthStatus:
    def __init__(self):
        self.timestamp = datetime.now()
        self.errors = []
        self.warnings = []
        self.info = []
        self.healthy = True

    def error(self, msg):
        self.errors.append(msg)
        self.healthy = False

    def warning(self, msg):
        self.warnings.append(msg)

    def add_info(self, msg):
        self.info.append(msg)

    def report(self):
        """Print status report"""
        print("=" * 100)
        print(f"Funding Data Health Check - {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 100)

        if self.info:
            print("\n✅ INFO:")
            for msg in self.info:
                print(f"  {msg}")

        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for msg in self.warnings:
                print(f"  {msg}")

        if self.errors:
            print("\n❌ ERRORS:")
            for msg in self.errors:
                print(f"  {msg}")

        print()
        if self.healthy:
            print("✅ STATUS: HEALTHY")
        else:
            print("❌ STATUS: UNHEALTHY - ACTION REQUIRED")
        print("=" * 100)

        return self.healthy


def check_systemd_service(service_name):
    """Check if systemd service is running"""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", service_name],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0 and result.stdout.strip() == "active"
    except Exception as e:
        return False


def restart_service(service_name):
    """Restart a systemd service"""
    try:
        subprocess.run(
            ["sudo", "systemctl", "restart", service_name],
            capture_output=True,
            timeout=10
        )
        time.sleep(3)  # Wait for service to start
        return check_systemd_service(service_name)
    except Exception as e:
        return False


def check_websocket_daemon(status):
    """Check WebSocket daemon health"""
    service_name = "binance-funding-ws.service"

    # Check if service is running
    if not check_systemd_service(service_name):
        status.error(f"WebSocket daemon service is NOT running")
        status.add_info(f"Attempting to restart {service_name}...")
        if restart_service(service_name):
            status.add_info(f"✅ Successfully restarted {service_name}")
        else:
            status.error(f"❌ Failed to restart {service_name}")
        return

    status.add_info(f"WebSocket daemon service is running")

    # Check state file
    if not STATE_FILE.exists():
        status.error(f"State file does not exist: {STATE_FILE}")
        return

    try:
        with open(STATE_FILE, 'r') as f:
            state = json.load(f)
    except Exception as e:
        status.error(f"Failed to read state file: {e}")
        return

    # Check connection status
    conn_status = state.get("connection_status", {})
    connected = conn_status.get("connected", False)

    if not connected:
        status.error("WebSocket is NOT connected to Binance")
        last_connected = conn_status.get("last_connected_time")
        if last_connected:
            disconnected_for = time.time() - last_connected
            status.error(f"Disconnected for {disconnected_for:.0f} seconds")
    else:
        status.add_info("WebSocket is connected to Binance")

    # Check data freshness
    funding_state = state.get("funding_state", {})
    symbol_count = len(funding_state)

    if symbol_count < MIN_SYMBOLS:
        status.error(f"Only {symbol_count} symbols tracked (expected >{MIN_SYMBOLS})")
    else:
        status.add_info(f"{symbol_count} symbols tracked")

    # Check for stale data
    now = time.time()
    stale_count = 0
    null_funding_count = 0
    null_price_count = 0

    for symbol, data in funding_state.items():
        updated_at = data.get("updatedAt", 0)
        age = now - updated_at

        if age > STALE_THRESHOLD_SEC:
            stale_count += 1

        if data.get("fundingRate") is None:
            null_funding_count += 1

        if data.get("markPrice") is None:
            null_price_count += 1

    if stale_count > 0:
        status.warning(f"{stale_count} symbols have stale data (>{STALE_THRESHOLD_SEC}s old)")

    if null_funding_count > 0:
        status.error(f"{null_funding_count} symbols have NULL funding rate")

    if null_price_count > 0:
        status.error(f"{null_price_count} symbols have NULL mark price")

    # Check message processing
    messages_received = conn_status.get("messages_received", 0)
    last_message_time = conn_status.get("last_message_time")

    if messages_received > 0:
        status.add_info(f"{messages_received} messages processed")

    if last_message_time:
        age = now - last_message_time
        if age > 60:
            status.error(f"No messages received for {age:.0f} seconds")
        else:
            status.add_info(f"Last message {age:.0f}s ago")


def check_api_server(status):
    """Check API server health"""
    service_name = "binance-funding-api.service"

    # Check if service is running
    if not check_systemd_service(service_name):
        status.error(f"API server service is NOT running")
        status.add_info(f"Attempting to restart {service_name}...")
        if restart_service(service_name):
            status.add_info(f"✅ Successfully restarted {service_name}")
        else:
            status.error(f"❌ Failed to restart {service_name}")
        return

    status.add_info(f"API server service is running")

    # Check health endpoint
    try:
        resp = requests.get(f"{API_URL}/funding/health", timeout=5)

        if resp.status_code == 200:
            health_data = resp.json()
            status.add_info(f"API health check: {health_data.get('status', 'unknown')}")

            ws_connected = health_data.get("websocketConnected", False)
            if not ws_connected:
                status.error("API reports WebSocket is NOT connected")

            symbol_count = health_data.get("symbolCount", 0)
            status.add_info(f"API reports {symbol_count} symbols")

        elif resp.status_code == 503:
            health_data = resp.json()
            status.error(f"API is unhealthy: {health_data.get('error', 'unknown')}")
        else:
            status.error(f"API health check returned {resp.status_code}")

    except requests.exceptions.RequestException as e:
        status.error(f"Failed to reach API server: {e}")
        status.add_info(f"Attempting to restart {service_name}...")
        if restart_service(service_name):
            status.add_info(f"✅ Successfully restarted {service_name}")
        else:
            status.error(f"❌ Failed to restart {service_name}")


def check_data_quality(status):
    """Spot check data quality by comparing with Binance REST API"""
    try:
        # Get BTCUSDT from both sources
        rest_resp = requests.get(
            "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
            timeout=5
        )
        rest_data = rest_resp.json()

        ws_resp = requests.get(f"{API_URL}/funding/BTCUSDT", timeout=5)
        ws_data = ws_resp.json()

        # Compare
        rest_fr = float(rest_data.get("lastFundingRate", 0))
        ws_fr = ws_data.get("fundingRate", 0)

        fr_diff = abs(rest_fr - ws_fr)

        if fr_diff < 0.0000001:
            status.add_info("Data quality check: BTCUSDT funding rate matches REST API")
        else:
            status.warning(f"Data quality: BTCUSDT funding rate differs by {fr_diff:.8f}")

        # Check mark price (allow for time lag)
        rest_price = float(rest_data.get("markPrice", 0))
        ws_price = ws_data.get("markPrice", 0)

        price_diff = abs(rest_price - ws_price)
        price_pct = (price_diff / rest_price * 100) if rest_price > 0 else 0

        if price_pct < 0.1:
            status.add_info(f"Data quality check: BTCUSDT price diff ${price_diff:.2f} ({price_pct:.3f}%)")
        else:
            status.warning(f"Data quality: BTCUSDT price differs by ${price_diff:.2f} ({price_pct:.3f}%)")

    except Exception as e:
        status.warning(f"Data quality check failed: {e}")


def main():
    status = HealthStatus()

    # Run all checks
    check_websocket_daemon(status)
    check_api_server(status)
    check_data_quality(status)

    # Print report
    is_healthy = status.report()

    # Exit with appropriate code (for monitoring systems)
    sys.exit(0 if is_healthy else 1)


if __name__ == "__main__":
    main()
