"""
Realtime Open Interest Poller
────────────────────────────────────────────────────────────────────────────
• Reads liquid universe from VolSpike backend
• Polls Open Interest for liquid symbols at computed intervals (5-12 seconds)
• Maintains OI history in ring buffers
• Posts OI batches to backend
• Detects and posts OI spike/dump alerts

Step 6: Skeleton with stubbed data (no real Binance calls yet)
"""

import os
import time
import datetime
import requests
import sys
import warnings
import json
from collections import deque
from typing import Dict, Tuple, Optional, List
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed

warnings.filterwarnings("ignore", category=DeprecationWarning)

# Load environment variables from .volspike.env file
# Check both /home/trader/.volspike.env (common location) and user's home directory
ENV_FILE_PATHS = [
    Path("/home/trader/.volspike.env"),  # Common location for trader user
    Path.home() / ".volspike.env",        # User's home directory (works for root or trader)
]

ENV_FILE = None
env_loaded = False

for env_path in ENV_FILE_PATHS:
    if env_path.exists():
        ENV_FILE = env_path
        try:
            with open(env_path, "r") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        # Remove quotes if present
                        value = value.strip('"').strip("'").strip()
                        os.environ[key.strip()] = value
                        env_loaded = True
            break  # Found and loaded, stop looking
        except Exception as e:
            print(f"⚠️  Warning: Failed to load {env_path}: {e}")
            continue

if not ENV_FILE:
    print(f"⚠️  Warning: .volspike.env not found in any of these locations:")
    for path in ENV_FILE_PATHS:
        print(f"      - {path}")
    print(f"   Using system environment variables instead")

# Configuration
VOLSPIKE_API_URL = os.getenv("VOLSPIKE_API_URL", "http://localhost:3001")
# Auto-add https:// if scheme is missing
if VOLSPIKE_API_URL and not VOLSPIKE_API_URL.startswith(('http://', 'https://')):
    VOLSPIKE_API_URL = f"https://{VOLSPIKE_API_URL}"
VOLSPIKE_API_KEY = os.getenv("VOLSPIKE_API_KEY", "")
MAX_REQ_PER_MIN = int(os.getenv("OI_MAX_REQ_PER_MIN", "2000"))
MIN_INTERVAL_SEC = int(os.getenv("OI_MIN_INTERVAL_SEC", "5"))
MAX_INTERVAL_SEC = int(os.getenv("OI_MAX_INTERVAL_SEC", "20"))

# ─────────────────────────────────────────────────────────────────────────────
# OI ALERT CONFIGURATION SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
# Timeframe | Threshold | Lookback  | Cooldown  | Poll Interval
# ----------|-----------|-----------|-----------|---------------
# 5 min     | ≥3%       | 5 min     | 10 min    | ~10 sec (computed)
# 15 min    | ≥7%       | 15 min    | 15 min    | ~10 sec (computed)
# 1 hour    | ≥12%      | 60 min    | 60 min    | ~10 sec (computed)
#
# Additional requirements:
# - Minimum absolute OI change: 5,000 contracts
# - Poll interval computed based on universe size and rate limits
# ─────────────────────────────────────────────────────────────────────────────

# Multi-timeframe OI Alert thresholds
# Each timeframe has: (threshold_pct, lookback_window_sec, cooldown_sec, label)
OI_ALERT_TIMEFRAMES = [
    {
        "label": "5 min",
        "threshold_pct": float(os.getenv("OI_SPIKE_THRESHOLD_PCT_5MIN", "0.03")),   # 3%
        "lookback_sec": int(os.getenv("OI_LOOKBACK_WINDOW_5MIN", "300")),            # 5 minutes
        "cooldown_sec": int(os.getenv("OI_ALERT_COOLDOWN_5MIN", "600")),             # 10 minutes
    },
    {
        "label": "15 min",
        "threshold_pct": float(os.getenv("OI_SPIKE_THRESHOLD_PCT_15MIN", "0.07")),  # 7%
        "lookback_sec": int(os.getenv("OI_LOOKBACK_WINDOW_15MIN", "900")),           # 15 minutes
        "cooldown_sec": int(os.getenv("OI_ALERT_COOLDOWN_15MIN", "900")),            # 15 minutes
    },
    {
        "label": "1 hour",
        "threshold_pct": float(os.getenv("OI_SPIKE_THRESHOLD_PCT_60MIN", "0.12")),  # 12%
        "lookback_sec": int(os.getenv("OI_LOOKBACK_WINDOW_60MIN", "3600")),          # 60 minutes
        "cooldown_sec": int(os.getenv("OI_ALERT_COOLDOWN_60MIN", "3600")),           # 60 minutes
    },
]

# Minimum absolute change in contracts (shared across all timeframes)
OI_MIN_DELTA_CONTRACTS = float(os.getenv("OI_MIN_DELTA_CONTRACTS", "5000"))

# De-duplication state tracking (per symbol per timeframe)
# Tracks whether symbol is currently "outside" threshold to prevent spam
# Key: (symbol, timeframe_label) -> "INSIDE" or "OUTSIDE"
oi_alert_state = {}  # (symbol, timeframe) -> "INSIDE" or "OUTSIDE"

# ─────────────────────── requests session ───────────────────────
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

# WebSocket Funding API Configuration
WS_FUNDING_API_URL = os.getenv("WS_FUNDING_API_URL", "http://localhost:8888/funding")
WS_FUNDING_ENABLED = os.getenv("WS_FUNDING_ENABLED", "true").lower() == "true"

# WebSocket daemon state file (contains all mark prices)
STATE_FILE = "/home/trader/volume-spike-bot/.funding_state.json"

# Persistent cooldown state file (survives script restarts)
COOLDOWN_STATE_FILE = "/home/trader/volume-spike-bot/.oi_alert_cooldowns.json"

# ─────────────────────── OI History (Ring Buffers) ───────────────────────
# symbol -> deque[(timestamp_epoch, oi_contracts, mark_price)]
# Max length: enough to cover 3 hours at chosen interval (approx 1080 for 10s interval)
oi_history: Dict[str, deque] = {}

# Alert rate limiting: (symbol, direction, timeframe_label) -> last_alert_timestamp
# This dictionary is now persisted to disk to survive script restarts
last_oi_alert_at: Dict[Tuple[str, str, str], float] = {}


def load_cooldown_state() -> Dict[Tuple[str, str, str], float]:
    """
    Load cooldown state from disk file.
    Returns empty dict if file doesn't exist or is corrupted.
    Cleans up entries older than max cooldown (1 hour).
    """
    try:
        if not os.path.exists(COOLDOWN_STATE_FILE):
            return {}

        with open(COOLDOWN_STATE_FILE, 'r') as f:
            raw_data = json.load(f)

        # Convert string keys back to tuples and filter old entries
        now = time.time()
        max_cooldown = 3600  # 1 hour - max cooldown period
        cooldowns = {}

        for key_str, timestamp in raw_data.items():
            # Skip entries older than max cooldown
            if now - timestamp > max_cooldown:
                continue

            # Parse key format: "symbol|direction|timeframe"
            parts = key_str.split('|')
            if len(parts) == 3:
                key = (parts[0], parts[1], parts[2])
                cooldowns[key] = timestamp

        print(f"✅ Loaded {len(cooldowns)} cooldown entries from disk (filtered {len(raw_data) - len(cooldowns)} expired)")
        return cooldowns
    except Exception as e:
        print(f"⚠️  Failed to load cooldown state: {e}")
        return {}


def save_cooldown_state(cooldowns: Dict[Tuple[str, str, str], float]):
    """
    Save cooldown state to disk file.
    Converts tuple keys to strings for JSON serialization.
    """
    try:
        # Convert tuple keys to strings for JSON serialization
        # Format: "symbol|direction|timeframe"
        serializable = {}
        now = time.time()
        max_cooldown = 3600  # 1 hour - max cooldown period

        for key, timestamp in cooldowns.items():
            # Only save entries that are still relevant
            if now - timestamp <= max_cooldown:
                key_str = f"{key[0]}|{key[1]}|{key[2]}"
                serializable[key_str] = timestamp

        with open(COOLDOWN_STATE_FILE, 'w') as f:
            json.dump(serializable, f)
    except Exception as e:
        print(f"⚠️  Failed to save cooldown state: {e}")


def compute_polling_interval(universe_size: int) -> int:
    """
    Compute polling interval based on universe size and rate limits.
    
    Formula:
    - polls_per_min_per_symbol = MAX_REQ_PER_MIN / universe_size
    - raw_interval = 60 / polls_per_min_per_symbol
    - Clamp to [MIN_INTERVAL_SEC, MAX_INTERVAL_SEC]
    """
    if universe_size <= 0:
        return MAX_INTERVAL_SEC
    
    polls_per_min_per_symbol = MAX_REQ_PER_MIN / universe_size
    raw_interval = 60.0 / polls_per_min_per_symbol
    
    return min(MAX_INTERVAL_SEC, max(MIN_INTERVAL_SEC, int(round(raw_interval))))


def load_liquid_universe() -> list:
    """
    Load liquid universe from VolSpike backend.
    Returns list of symbol strings.
    """
    try:
        url = f"{VOLSPIKE_API_URL}/api/market/open-interest/liquid-universe"
        response = session.get(url, timeout=10)
        
        if not response.ok:
            error_text = response.text[:200] if hasattr(response, 'text') else ''
            print(f"⚠️  Failed to fetch liquid universe: {response.status_code}")
            if error_text:
                print(f"   Response: {error_text}")
            if response.status_code == 401:
                print(f"   ⚠️  Unauthorized - This endpoint should be public. Check backend routing.")
            elif response.status_code == 404:
                print(f"   ⚠️  Endpoint not found - Make sure backend is deployed with latest code.")
            return []
        
        data = response.json()
        symbols = [s["symbol"] for s in data.get("symbols", [])]
        
        if len(symbols) == 0:
            print(f"⚠️  Liquid universe is empty (job may not have run yet)")
            print(f"   Waiting 30 seconds for liquid universe job to run...")
            print(f"   (The job runs every 5 minutes)")
            return []
        
        print(f"✅ Loaded {len(symbols)} symbols from liquid universe")
        if symbols:
            estimated_interval = data.get('symbols', [{}])[0].get('estimatedPollIntervalSec', 'N/A')
            print(f"   Estimated polling interval: {estimated_interval}s")
        
        return symbols
    except Exception as e:
        print(f"⚠️  Error loading liquid universe: {e}")
        import traceback
        traceback.print_exc()
        return []


def load_mark_prices_from_state() -> Dict[str, float]:
    """
    Load all mark prices from WebSocket daemon state file.
    Returns dict of {symbol: markPrice}.
    This replaces 341 HTTP calls with ONE file read!
    """
    try:
        with open(STATE_FILE, 'r') as f:
            state_data = json.load(f)
            funding_state = state_data.get('funding_state', {})
            mark_prices = {}
            for symbol, data in funding_state.items():
                if 'markPrice' in data and data['markPrice'] is not None and data['markPrice'] > 0:
                    mark_prices[symbol] = data['markPrice']
            print(f"📊 Loaded {len(mark_prices)} mark prices from WebSocket state file")
            return mark_prices
    except Exception as e:
        print(f"⚠️  Failed to load WebSocket state file: {e}")
        return {}


def get_funding_rate_from_state(symbol: str) -> Optional[float]:
    """
    Get current funding rate for a symbol from WebSocket daemon state file.
    Returns funding rate or None if not available.
    """
    try:
        with open(STATE_FILE, 'r') as f:
            state_data = json.load(f)
            funding_state = state_data.get('funding_state', {})
            if symbol in funding_state:
                funding_rate = funding_state[symbol].get('fundingRate')
                if funding_rate is not None:
                    return float(funding_rate)
            return None
    except Exception as e:
        return None


def fetch_oi_for_symbol(symbol: str, mark_price: float) -> Optional[Tuple[float, float]]:
    """
    Fetch Open Interest for a symbol from Binance.
    Returns (openInterest_contracts, markPrice) or None on error.
    Mark price is passed in from state file (not fetched via HTTP).
    """
    try:
        # Fetch Open Interest from Binance
        oi_url = f"https://fapi.binance.com/fapi/v1/openInterest"
        oi_response = session.get(oi_url, params={"symbol": symbol}, timeout=5)

        if not oi_response.ok:
            return None

        oi_data = oi_response.json()
        open_interest = float(oi_data.get("openInterest", 0))

        return (open_interest, mark_price)
    except Exception as e:
        print(f"⚠️  Error fetching OI for {symbol}: {e}")
        return None


def initialize_oi_history(symbols: list):
    """Initialize ring buffers for OI history (maxlen for 3 hours at 10s interval)"""
    maxlen = int(3 * 3600 / 10)  # ~1080 samples
    for symbol in symbols:
        if symbol not in oi_history:
            oi_history[symbol] = deque(maxlen=maxlen)


def get_oi_at_lookback(symbol: str, now: float, lookback_sec: int) -> Optional[Tuple[float, float]]:
    """
    Get OI value and mark price from a specific lookback time ago.

    Args:
        symbol: The trading symbol
        now: Current timestamp (epoch seconds)
        lookback_sec: How many seconds ago to look back (e.g., 300 for 5 min, 900 for 15 min)

    Returns:
        (oi_contracts, mark_price) for the closest sample to (now - lookback_sec), or None if insufficient data.
        Tolerance is dynamically set based on lookback window (10% of lookback, min 30s, max 120s).
    """
    if symbol not in oi_history or len(oi_history[symbol]) < 2:
        return None

    target_time = now - lookback_sec
    # Dynamic tolerance: 10% of lookback window, clamped to [30s, 120s]
    tolerance = min(120, max(30, lookback_sec // 10))

    # Find the closest sample to target_time within tolerance
    closest_sample = None
    min_diff = float('inf')

    for ts, oi, mark_price in oi_history[symbol]:
        diff = abs(ts - target_time)
        if diff < min_diff and diff <= tolerance:
            min_diff = diff
            closest_sample = (oi, mark_price)

    return closest_sample


def emit_oi_alert(symbol: str, direction: str, baseline: float, current: float,
                  pct_change: float, abs_change: float, timestamp: float,
                  price_change: Optional[float] = None, funding_rate: Optional[float] = None,
                  timeframe: str = "5 min") -> bool:
    """
    Post OI alert to VolSpike backend.

    Args:
        symbol: Trading symbol (e.g., BTCUSDT)
        direction: Alert direction ('UP' or 'DOWN')
        baseline: OI at lookback time
        current: Current OI
        pct_change: Percentage change (e.g., 0.03 for 3%)
        abs_change: Absolute change in contracts
        timestamp: Alert timestamp (epoch seconds)
        price_change: Optional price change during period
        funding_rate: Optional funding rate at alert time
        timeframe: Time period label (e.g., "5 min", "15 min", "1 hour")

    Returns True on success, False on error.
    """
    try:
        url = f"{VOLSPIKE_API_URL}/api/open-interest-alerts/ingest"
        payload = {
            "symbol": symbol,
            "direction": direction,
            "baseline": baseline,
            "current": current,
            "pctChange": pct_change,
            "absChange": abs_change,
            "timestamp": datetime.datetime.fromtimestamp(timestamp, tz=datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            "source": "oi_realtime_poller",
            "timeframe": timeframe,
        }

        # Add optional fields if available
        if price_change is not None:
            payload["priceChange"] = price_change
        if funding_rate is not None:
            payload["fundingRate"] = funding_rate

        response = session.post(
            url,
            json=payload,
            headers={
                "X-API-Key": VOLSPIKE_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=10
        )

        if response.ok:
            result = response.json()
            extras = []
            if price_change is not None:
                extras.append(f"price {price_change*100:+.2f}%")
            if funding_rate is not None:
                extras.append(f"funding {funding_rate*100:.3f}%")
            extras_str = f" ({', '.join(extras)})" if extras else ""
            print(f"✅ Posted OI alert: {symbol} {direction} [{timeframe}] ({pct_change*100:.2f}%){extras_str}")
            return True
        else:
            print(f"⚠️  OI alert post failed: {response.status_code} - {response.text[:100]}")
            return False
    except Exception as e:
        print(f"⚠️  Error posting OI alert: {e}")
        return False


def maybe_emit_oi_alert(symbol: str, current_oi: float, current_mark_price: float, timestamp: float):
    """
    Check if OI change warrants an alert and emit if conditions are met.
    Checks all configured timeframes (5min, 15min, 60min) independently.
    Uses de-duplication: only alert when crossing threshold from INSIDE -> OUTSIDE.
    Also calculates price change over the same period and retrieves current funding rate.
    """
    # Filter out stablecoin-to-stablecoin pairs (no need to monitor)
    if symbol == "USDCUSDT":
        return

    # Get current funding rate from WebSocket state file (shared across all timeframes)
    funding_rate = get_funding_rate_from_state(symbol)

    # Check each timeframe independently
    for tf in OI_ALERT_TIMEFRAMES:
        tf_label = tf["label"]
        tf_threshold = tf["threshold_pct"]
        tf_lookback = tf["lookback_sec"]
        tf_cooldown = tf["cooldown_sec"]

        # Get baseline data for this timeframe
        baseline_data = get_oi_at_lookback(symbol, timestamp, tf_lookback)
        if baseline_data is None:
            # Not enough history yet for this timeframe, mark as INSIDE
            oi_alert_state[(symbol, tf_label)] = "INSIDE"
            continue

        oi_baseline, mark_price_baseline = baseline_data

        if oi_baseline == 0:
            # Invalid baseline, mark as INSIDE
            oi_alert_state[(symbol, tf_label)] = "INSIDE"
            continue

        pct_change = (current_oi - oi_baseline) / oi_baseline
        abs_change = current_oi - oi_baseline

        # Calculate price change over the lookback period
        price_change = None
        if mark_price_baseline > 0 and current_mark_price > 0:
            price_change = (current_mark_price - mark_price_baseline) / mark_price_baseline

        # Determine if currently OUTSIDE threshold
        is_outside = abs(pct_change) >= tf_threshold

        # Get previous state (default to INSIDE) for this timeframe
        state_key = (symbol, tf_label)
        previous_state = oi_alert_state.get(state_key, "INSIDE")

        # Only alert on INSIDE -> OUTSIDE transition (de-duplication)
        if is_outside and previous_state == "INSIDE":
            # Determine direction and emit alert
            alert_emitted = False

            if pct_change >= tf_threshold and abs_change >= OI_MIN_DELTA_CONTRACTS:
                direction = "UP"

                # Check cooldown: don't alert if same (symbol, direction, timeframe) within cooldown period
                cooldown_key = (symbol, direction, tf_label)
                if cooldown_key in last_oi_alert_at:
                    time_since_last = timestamp - last_oi_alert_at[cooldown_key]
                    if time_since_last < tf_cooldown:
                        # Silent skip during cooldown
                        continue

                extras = []
                if price_change is not None:
                    extras.append(f"price {price_change*100:+.2f}%")
                if funding_rate is not None:
                    extras.append(f"funding {funding_rate*100:.3f}%")
                extras_str = f" | {', '.join(extras)}" if extras else ""
                print(f"🔺 OI SPIKE [{tf_label}]: {symbol} {direction} | {tf_label} ago: {oi_baseline:.0f} | Current: {current_oi:.0f} | Change: {pct_change*100:.2f}% (+{abs_change:.0f}){extras_str}")
                emit_oi_alert(symbol, direction, oi_baseline, current_oi, pct_change, abs_change, timestamp, price_change, funding_rate, tf_label)
                alert_emitted = True
                last_oi_alert_at[cooldown_key] = timestamp
                save_cooldown_state(last_oi_alert_at)  # Persist to disk

            elif pct_change <= -tf_threshold and abs_change <= -OI_MIN_DELTA_CONTRACTS:
                direction = "DOWN"

                # Check cooldown: don't alert if same (symbol, direction, timeframe) within cooldown period
                cooldown_key = (symbol, direction, tf_label)
                if cooldown_key in last_oi_alert_at:
                    time_since_last = timestamp - last_oi_alert_at[cooldown_key]
                    if time_since_last < tf_cooldown:
                        # Silent skip during cooldown
                        continue

                extras = []
                if price_change is not None:
                    extras.append(f"price {price_change*100:+.2f}%")
                if funding_rate is not None:
                    extras.append(f"funding {funding_rate*100:.3f}%")
                extras_str = f" | {', '.join(extras)}" if extras else ""
                print(f"🔻 OI DUMP [{tf_label}]: {symbol} {direction} | {tf_label} ago: {oi_baseline:.0f} | Current: {current_oi:.0f} | Change: {pct_change*100:.2f}% ({abs_change:.0f}){extras_str}")
                emit_oi_alert(symbol, direction, oi_baseline, current_oi, pct_change, abs_change, timestamp, price_change, funding_rate, tf_label)
                alert_emitted = True
                last_oi_alert_at[cooldown_key] = timestamp
                save_cooldown_state(last_oi_alert_at)  # Persist to disk

            # Only mark as OUTSIDE if we actually emitted an alert
            if alert_emitted:
                oi_alert_state[state_key] = "OUTSIDE"

        elif not is_outside:
            # Back inside threshold, reset state for this timeframe
            oi_alert_state[state_key] = "INSIDE"

        # If is_outside and previous_state == "OUTSIDE", silently skip (de-duplication)


def post_oi_batch(samples: list) -> bool:
    """
    Post OI batch to VolSpike backend.
    Splits large batches into chunks to avoid timeouts.
    Returns True on success, False on error.
    """
    if not samples:
        return True
    
    # Split into chunks of 100 symbols to avoid timeouts
    CHUNK_SIZE = 100
    chunks = [samples[i:i + CHUNK_SIZE] for i in range(0, len(samples), CHUNK_SIZE)]
    
    success_count = 0
    for chunk_idx, chunk in enumerate(chunks):
        try:
            url = f"{VOLSPIKE_API_URL}/api/market/open-interest/ingest"
            payload = {
                "data": chunk,
                "timestamp": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                "totalSymbols": len(chunk),
                "source": "realtime",
            }
            
            response = session.post(
                url,
                json=payload,
                headers={
                    "X-API-Key": VOLSPIKE_API_KEY,
                    "Content-Type": "application/json",
                },
                timeout=60  # Increased timeout for large batches
            )
            
            if response.ok:
                result = response.json()
                inserted = result.get('inserted', 0)
                if len(chunks) > 1:
                    print(f"✅ Posted OI batch chunk {chunk_idx + 1}/{len(chunks)}: {len(chunk)} symbols ({inserted} inserted)")
                else:
                    print(f"✅ Posted OI batch: {len(chunk)} symbols ({inserted} inserted)")
                success_count += 1
            else:
                print(f"⚠️  OI batch chunk {chunk_idx + 1}/{len(chunks)} failed: {response.status_code} - {response.text[:100]}")
                return False
        except Exception as e:
            print(f"⚠️  Error posting OI batch chunk {chunk_idx + 1}/{len(chunks)}: {e}")
            return False
    
    # All chunks succeeded
    if len(chunks) > 1:
        print(f"✅ Posted all {len(chunks)} chunks: {len(samples)} total symbols")
    return True


def main_loop():
    """Main polling loop"""
    print("🚀 Starting Realtime OI Poller (Step 9: Full Implementation)")
    print(f"   Environment file: {ENV_FILE} ({'found' if ENV_FILE.exists() else 'NOT FOUND'})")
    
    if WS_FUNDING_ENABLED:
        print(f"🔌 WebSocket funding service: ENABLED (WebSocket-only mode, NO REST fallback)")
        print(f"   API URL: {WS_FUNDING_API_URL}")
    else:
        print("🔌 WebSocket funding service: DISABLED (will use 0 for mark prices)")
    
    # Check configuration
    if not VOLSPIKE_API_URL or VOLSPIKE_API_URL == "http://localhost:3001":
        print(f"❌ ERROR: VOLSPIKE_API_URL not set correctly!")
        print(f"   Current value: {VOLSPIKE_API_URL}")
        print(f"   Expected: https://volspike-production.up.railway.app")
        print(f"   Please check /home/trader/.volspike.env file")
        sys.exit(1)
    
    if not VOLSPIKE_API_KEY:
        print("❌ ERROR: VOLSPIKE_API_KEY not set!")
        print("   Please check /home/trader/.volspike.env file")
        sys.exit(1)
    
    print(f"   Backend URL: {VOLSPIKE_API_URL}")
    print(f"   API Key: {'*' * min(20, len(VOLSPIKE_API_KEY))}... (set)")
    print(f"   Max req/min: {MAX_REQ_PER_MIN}")
    print(f"   Interval range: {MIN_INTERVAL_SEC}-{MAX_INTERVAL_SEC}s")
    print(f"   Min delta contracts: ±{OI_MIN_DELTA_CONTRACTS:.0f}")
    print(f"   Alert timeframes:")
    for tf in OI_ALERT_TIMEFRAMES:
        print(f"     - {tf['label']}: ±{tf['threshold_pct']*100:.0f}% over {tf['lookback_sec']//60} min, cooldown {tf['cooldown_sec']//60} min")
    
    # Load liquid universe from backend
    symbols = load_liquid_universe()
    if not symbols:
        print("❌ No symbols in liquid universe, exiting")
        sys.exit(1)
    
    print(f"✅ Loaded {len(symbols)} symbols from backend")
    
    # Compute polling interval
    interval_sec = compute_polling_interval(len(symbols))
    print(f"📊 Computed polling interval: {interval_sec}s")
    
    # Initialize OI history
    initialize_oi_history(symbols)
    print(f"✅ Initialized OI history buffers")

    # Load persistent cooldown state from disk (survives script restarts)
    global last_oi_alert_at
    last_oi_alert_at = load_cooldown_state()
    print(f"✅ Loaded cooldown state: {len(last_oi_alert_at)} active cooldowns")

    # Main loop with concurrent fetching
    loop_count = 0
    max_workers = 20  # Concurrent threads for fetching

    print(f"🔄 Starting polling loop with {max_workers} concurrent workers...")
    print(f"   Will poll {len(symbols)} symbols every {interval_sec}s")
    print(f"   Will POST OI data immediately after each loop (every {interval_sec}s)")
    print(f"   Will reload liquid universe every 20 loops (~{interval_sec * 20}s)")

    try:
        while True:
            loop_start = time.time()
            loop_count += 1
            batch_samples = []

            # Load ALL mark prices from state file (ONE file read instead of 341 HTTP calls!)
            mark_prices = load_mark_prices_from_state()

            # Fetch OI for all symbols concurrently using ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all fetch tasks with mark prices from state file
                future_to_symbol = {
                    executor.submit(fetch_oi_for_symbol, sym, mark_prices.get(sym, 0.0)): sym
                    for sym in symbols
                }

                # Process results as they complete
                for future in as_completed(future_to_symbol):
                    symbol = future_to_symbol[future]
                    try:
                        result = future.result()
                        if result is None:
                            continue

                        oi, mark_price = result
                        if oi <= 0:
                            continue

                        timestamp = time.time()

                        # Store in history with mark price (for price change calculation)
                        oi_history[symbol].append((timestamp, oi, mark_price))

                        # Check for alerts (now includes price change and funding rate)
                        maybe_emit_oi_alert(symbol, oi, mark_price, timestamp)

                        # Collect for batch
                        sample = {
                            "symbol": symbol,
                            "openInterest": oi,
                        }

                        # Always add mark price and USD value
                        if mark_price is not None and mark_price > 0:
                            sample["openInterestUsd"] = oi * mark_price
                            sample["markPrice"] = mark_price
                        else:
                            # Mark price is 0 - symbol not in state file
                            sample["openInterestUsd"] = 0.0
                            sample["markPrice"] = 0.0

                        batch_samples.append(sample)

                    except Exception as e:
                        print(f"⚠️  Error processing {symbol}: {e}")
                        continue

            # POST immediately after each loop (every 30 seconds)
            if batch_samples:
                # DEBUG: Print first 3 samples to verify mark prices
                if loop_count <= 2:  # Only first 2 loops
                    print(f"🔍 DEBUG - First 3 samples being posted:")
                    for sample in batch_samples[:3]:
                        print(f"   {sample['symbol']}: OI={sample['openInterest']:.0f}, Mark=${sample.get('markPrice', 0):.2f}, USD=${sample.get('openInterestUsd', 0):.2f}")

                post_oi_batch(batch_samples)
                print(f"✅ Posted {len(batch_samples)} OI samples in {time.time() - loop_start:.1f}s")

            # Reload liquid universe every 20 loops (~10 minutes at 30-sec intervals)
            if loop_count % 20 == 0:
                new_symbols = load_liquid_universe()
                if new_symbols and new_symbols != symbols:
                    # Update symbol list and reinitialize history for new symbols
                    old_count = len(symbols)
                    symbols = new_symbols
                    initialize_oi_history(symbols)
                    # Recompute interval
                    interval_sec = compute_polling_interval(len(symbols))
                    print(f"🔄 Reloaded liquid universe: {old_count} → {len(symbols)} symbols, interval: {interval_sec}s")

            # Print status every 10 loops
            if loop_count % 10 == 0:
                elapsed = time.time() - loop_start
                print(f"⏱️  Loop {loop_count} | {len(symbols)} symbols | Fetched in {elapsed:.1f}s | Next in {max(0, interval_sec - elapsed):.1f}s")

            # Sleep until next interval
            elapsed = time.time() - loop_start
            sleep_time = max(0, interval_sec - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    except KeyboardInterrupt:
        print("\n🛑 Stopping poller...")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main_loop()

