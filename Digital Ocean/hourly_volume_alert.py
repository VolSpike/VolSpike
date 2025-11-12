"""
Hourly Volume Spike Alert – Binance USDT-Perpetuals
────────────────────────────────────────────────────
• Scans every 5 min on the clock (…:00, :05, :10, …)
• At hh:00 → uses last two *closed* hourly candles
  All other times → compares current open candle vs. previous closed
• Fires when curr ≥ 3× prev and ≥ $3 M notional
• Prints one line per symbol, magenta highlight on spikes
• Sends spikes to Telegram
• Sends spikes to multiple VolSpike backends (production + staging) with candle direction
  - Supports dual-destination posting via env vars (VOLSPIKE_API_URL + VOLSPIKE_STAGING_API_URL)
  - Posts to all configured destinations simultaneously
• Updates alerts at XX:30 (HALF-UPDATE) and XX:00 (UPDATE) for previously alerted assets
• Fetches and posts Open Interest data to all VolSpike backends every 5 minutes
"""

import os
import time
import datetime
import requests
import sys
import warnings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

warnings.filterwarnings("ignore", category=DeprecationWarning)

API = "https://fapi.binance.com"
INTERVAL = "1h"
VOLUME_MULTIPLE = 3
MIN_QUOTE_VOL = 3_000_000      # ~$3 M

# Telegram
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")

# VolSpike Integration
VOLSPIKE_API_URL = os.getenv("VOLSPIKE_API_URL")
VOLSPIKE_API_KEY = os.getenv("VOLSPIKE_API_KEY")

# VolSpike Staging Integration (optional)
VOLSPIKE_STAGING_API_URL = os.getenv("VOLSPIKE_STAGING_API_URL")
VOLSPIKE_STAGING_API_KEY = os.getenv("VOLSPIKE_STAGING_API_KEY")

# ───────────────────── VolSpike targets ──────────────────────
# Prepare VolSpike ingestion targets based on environment variables
def get_volspike_targets():
    """
    Build a list of VolSpike ingestion targets from environment.
    Supports production and staging; easy to extend for more later.
    Returns a list of dicts: { name, url, key }
    """
    targets = []
    pairs = [
        ("prod", VOLSPIKE_API_URL, VOLSPIKE_API_KEY),
        ("staging", VOLSPIKE_STAGING_API_URL, VOLSPIKE_STAGING_API_KEY),
    ]
    for name, url, key in pairs:
        if url and key:
            targets.append({"name": name, "url": url.rstrip("/"), "key": key})
        elif url or key:
            # Only one is set - warn about incomplete configuration
            missing = "key" if url else "url"
            print(f"⚠️  VolSpike[{name}] incomplete: missing {missing.upper()}")
    
    if not targets:
        print("⚠️  No VolSpike targets configured (missing URL/KEY pairs)")
    
    return targets

# Track last-alerted hour per symbol
last_alert: dict[str, datetime.datetime] = {}
# Track when the initial alert was sent (minute of the hour)
initial_alert_minute: dict[str, int] = {}

# ─────────────────────── requests session ───────────────────────
session = requests.Session()
session.mount(
    "https://",
    HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1,
                                  status_forcelist=[429, 500, 502, 503, 504]))
)

# ────────────────────────── helpers ────────────────────────────

def fmt(vol: float) -> str:
    if vol >= 1e9:
        return f"{vol/1e9:,.2f}B"
    if vol >= 1e6:
        return f"{vol/1e6:,.2f}M"
    if vol >= 1e3:
        return f"{vol/1e3:,.2f}K"
    return f"{vol:,.0f}"


def tg_send(text: str):
    # Skip if Telegram is not configured
    if not TELEGRAM_TOKEN or not CHAT_ID:
        print("⚠️  Telegram not configured (missing TELEGRAM_TOKEN or CHAT_ID), skipping...")
        return
    
    try:
        r = session.get(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            params={"chat_id": CHAT_ID, "text": text},
            timeout=5,
        )
        if r.status_code != 200:
            print(f"Telegram error {r.status_code}: {r.text[:120]}")
    except Exception as e:
        print("Telegram send exception:", e)


def volspike_send(sym: str, asset: str, curr_vol: float, prev_vol: float, ratio: float, 
                  price: float, funding_rate: float | None, alert_msg: str, curr_hour: datetime.datetime,
                  utc_now: datetime.datetime, is_update: bool, alert_type: str, candle_direction: str):
    """Send alert to VolSpike backend."""
    targets = get_volspike_targets()
    if not targets:
        return
    
    try:
        payload = {
            "symbol": sym,
            "asset": asset,
            "currentVolume": curr_vol,
            "previousVolume": prev_vol,
            "volumeRatio": ratio,
            "price": price,
            "fundingRate": funding_rate,
            "candleDirection": candle_direction,
            "message": alert_msg,
            "timestamp": utc_now.strftime('%Y-%m-%dT%H:%M:%SZ'),
            "hourTimestamp": curr_hour.strftime('%Y-%m-%dT%H:%M:%SZ'),
            "isUpdate": is_update,
            "alertType": alert_type,
        }
        
        candle_emoji = "🟢" if candle_direction == "bullish" else "🔴"
        for t in targets:
            try:
                r = session.post(
                    f"{t['url']}/api/volume-alerts/ingest",
                    json=payload,
                    headers={
                        "X-API-Key": t["key"],
                        "Content-Type": "application/json"
                    },
                    timeout=5
                )
                if r.status_code == 200:
                    print(f"  ✅ Posted to VolSpike[{t['name']}]: {asset} {candle_emoji}")
                else:
                    print(f"  ⚠️  VolSpike[{t['name']}] error {r.status_code}: {r.text[:120]}")
            except Exception as inner_e:
                print(f"  ⚠️  VolSpike[{t['name']}] send exception: {inner_e}")
    except Exception as e:
        print(f"  ⚠️  VolSpike send exception: {e}")


def active_perps() -> list[str]:
    r = session.get(f"{API}/fapi/v1/exchangeInfo", timeout=10)
    if r.status_code != 200:
        print("Binance HTTP", r.status_code, r.text[:120])
        return []
    info = r.json()
    if "symbols" not in info:
        print("Unexpected response:", str(info)[:200])
        return []
    return [
        s["symbol"] for s in info["symbols"]
        if s["contractType"] == "PERPETUAL"
        and s["quoteAsset"] == "USDT"
        and s["status"] == "TRADING"
    ]


def last_two_closed_klines(sym: str):
    kl = session.get(f"{API}/fapi/v1/klines",
                     params={"symbol": sym, "interval": INTERVAL, "limit": 3},
                     timeout=10).json()
    now_ms = int(time.time() * 1000)
    closed = [k for k in kl if k[6] < now_ms]
    return closed[-2:] if len(closed) >= 2 else []


def fetch_and_post_open_interest() -> None:
    """
    Fetch Open Interest for all active USDT perpetuals and post to VolSpike backend.
    Runs every 5 minutes alongside the volume scan.
    """
    targets = get_volspike_targets()
    if not targets:
        print("⚠️  Open Interest: VolSpike API not configured, skipping...")
        return
    
    try:
        print("📊 Fetching Open Interest data from Binance...", flush=True)
        
        # Get all active perpetuals
        symbols = active_perps()
        if not symbols:
            print("⚠️  Open Interest: No active symbols found")
            return
        
        # Fetch Open Interest for each symbol
        open_interest_data = []
        success_count = 0
        error_count = 0
        
        for sym in symbols:
            try:
                # Fetch Open Interest from Binance
                oi_resp = session.get(
                    f"{API}/fapi/v1/openInterest",
                    params={"symbol": sym},
                    timeout=5
                ).json()
                
                # Parse response
                if "openInterest" in oi_resp:
                    open_interest = float(oi_resp["openInterest"])
                    
                    # Get current mark price to calculate USD notional
                    mark_resp = session.get(
                        f"{API}/fapi/v1/premiumIndex",
                        params={"symbol": sym},
                        timeout=5
                    ).json()
                    
                    mark_price = float(mark_resp.get("markPrice", 0))
                    
                    # Calculate USD notional (Open Interest in contracts * Mark Price)
                    oi_usd = open_interest * mark_price
                    
                    open_interest_data.append({
                        "symbol": sym,
                        "openInterest": open_interest,
                        "openInterestUsd": oi_usd,
                        "markPrice": mark_price
                    })
                    success_count += 1
                    
            except Exception as e:
                error_count += 1
                # Silent failure for individual symbols to avoid spam
                continue
        
        if not open_interest_data:
            print(f"⚠️  Open Interest: No data fetched (errors: {error_count})")
            return
        
        # Post to VolSpike backend
        utc_now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
        payload = {
            "data": open_interest_data,
            "timestamp": utc_now.strftime('%Y-%m-%dT%H:%M:%SZ'),
            "totalSymbols": len(open_interest_data)
        }
        
        for t in targets:
            try:
                r = session.post(
                    f"{t['url']}/api/market/open-interest/ingest",
                    json=payload,
                    headers={
                        "X-API-Key": t["key"],
                        "Content-Type": "application/json"
                    },
                    timeout=10
                )
                if r.status_code == 200:
                    print(f"✅ Posted Open Interest[{t['name']}]: {len(open_interest_data)} symbols (errors: {error_count})")
                else:
                    print(f"⚠️  Open Interest[{t['name']}] post failed {r.status_code}: {r.text[:120]}")
            except Exception as inner_e:
                print(f"⚠️  Open Interest[{t['name']}] post exception: {inner_e}")
            
    except Exception as e:
        print(f"⚠️  Open Interest fetch exception: {e}")


# ─────────────────────── core scan function ─────────────────────

def scan(top_of_hour: bool, is_middle_hour: bool = False) -> None:
    for sym in active_perps():
        try:
            if top_of_hour:
                prev, curr = last_two_closed_klines(sym)
            else:
                kl = session.get(f"{API}/fapi/v1/klines",
                                 params={"symbol": sym,
                                         "interval": INTERVAL, "limit": 2},
                                 timeout=10).json()
                prev, curr = kl[-2], kl[-1]
        except Exception:
            continue

        prev_vol = float(prev[7])
        curr_vol = float(curr[7])
        ratio = curr_vol / prev_vol if prev_vol else 0

        # Determine candle direction (bullish/bearish)
        open_price = float(curr[1])    # Candle open price
        current_price = float(curr[4])  # Current/close price
        is_bullish = current_price > open_price
        candle_direction = "bullish" if is_bullish else "bearish"

        curr_hour = datetime.datetime.fromtimestamp(
            curr[0] / 1000, datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)

        already_alerted = last_alert.get(sym) == curr_hour
        spike = (ratio >= VOLUME_MULTIPLE) and (
            curr_vol >= MIN_QUOTE_VOL) and not already_alerted

        # Fetch current price and funding rate for VolSpike
        price = current_price  # We already have it from the candle
        funding_rate = None
        try:
            funding_resp = session.get(f"{API}/fapi/v1/premiumIndex",
                                      params={"symbol": sym}, timeout=5).json()
            funding_rate = float(funding_resp.get("lastFundingRate", 0))
        except:
            pass  # If we can't get funding, send alert anyway

        # Check for update alerts (middle or end of hour)
        update_alert = False
        update_prefix = ""
        if already_alerted:
            initial_minute = initial_alert_minute.get(sym, 0)

            # Half update logic
            if is_middle_hour:
                # Send half update if initial alert was at hh:00, hh:05, hh:10, hh:15, hh:20
                if initial_minute <= 20:
                    update_prefix = "HALF-UPDATE: "
                    update_alert = True

            # Full update logic
            elif top_of_hour:
                # Send full update if initial alert was NOT at hh:55
                if initial_minute != 55:
                    update_prefix = "UPDATE: "
                    update_alert = True

        if spike:
            last_alert[sym] = curr_hour
            initial_alert_minute[sym] = utc_now.minute

        line = (f"{sym:<12}  prev: {fmt(prev_vol):>9}  "
                f"curr: {fmt(curr_vol):>9}  "
                f"({ratio:5.2f}×)")

        if spike or update_alert:
            asset = sym.replace("USDT", "")
            alert_msg = f"{update_prefix}{asset} hourly volume {fmt(curr_vol)} ({ratio:.2f}× prev) — VOLUME SPIKE!"
            
            # Determine alert type
            if update_prefix == "HALF-UPDATE: ":
                alert_type = "HALF_UPDATE"
            elif update_prefix == "UPDATE: ":
                alert_type = "FULL_UPDATE"
            else:
                alert_type = "SPIKE"
            
            # Add candle emoji to console output
            candle_emoji = "🟢" if is_bullish else "🔴"
            print(f"\033[95;1m{line}  ← {'VOLUME SPIKE!' if spike else (update_prefix + 'VOLUME SPIKE!')} {candle_emoji}\033[0m")
            
            # Send to Telegram
            tg_send(alert_msg)
            
            # Send to VolSpike
            volspike_send(
                sym=sym,
                asset=asset,
                curr_vol=curr_vol,
                prev_vol=prev_vol,
                ratio=ratio,
                price=price,
                funding_rate=funding_rate,
                alert_msg=alert_msg,
                curr_hour=curr_hour,
                utc_now=utc_now,
                is_update=bool(update_prefix),
                alert_type=alert_type,
                candle_direction=candle_direction
            )
        else:
            note = " (ratio hit, volume < min)" if ratio >= VOLUME_MULTIPLE and curr_vol < MIN_QUOTE_VOL else ""
            print(f"{line}{note}")


# ───────────────────────── main loop ────────────────────────────
print("Hourly-volume alert running…  (Ctrl-C to stop)")
print("📊 Open Interest tracking enabled")
while True:
    utc_now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    top_of_hour = (utc_now.minute == 0)
    is_middle_hour = (utc_now.minute == 30)

    print("Starting volume scan…", flush=True)
    try:
        scan(top_of_hour, is_middle_hour)
    except Exception as e:
        print("⚠️  Error:", e)
    
    # Fetch and post Open Interest data every 5 minutes
    try:
        fetch_and_post_open_interest()
    except Exception as e:
        print(f"⚠️  Open Interest error: {e}")

    # Sleep until next 5-minute boundary
    utc_now = datetime.datetime.utcnow()
    seconds = utc_now.minute * 60 + utc_now.second
    wait_sec = (300 - (seconds % 300)) or 300
    for r in range(wait_sec, 0, -1):
        sys.stdout.write(f"\r… next check in {r:3d}s ")
        sys.stdout.flush()
        time.sleep(1)
    print()


