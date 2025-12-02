"""
Liquid Universe Classification Job
────────────────────────────────────────────────────────────────────────────
• Runs on Digital Ocean (where Binance REST API calls are allowed)
• Fetches exchangeInfo and ticker/24hr from Binance
• Computes liquid universe based on volume thresholds
• Posts results to VolSpike backend

This job MUST run on Digital Ocean, NOT on Railway backend, per AGENTS.md:
"Digital Ocean Script: ✅ ONLY place that uses Binance REST API"
"""

import os
import time
import datetime
import requests
import sys
import warnings
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

warnings.filterwarnings("ignore", category=DeprecationWarning)

# Load environment variables from .volspike.env file
ENV_FILE = Path.home() / ".volspike.env"
env_loaded = False
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    # Remove quotes if present
                    value = value.strip('"').strip("'").strip()
                    os.environ[key.strip()] = value
                    env_loaded = True
    except Exception as e:
        print(f"⚠️  Warning: Failed to load {ENV_FILE}: {e}")
else:
    print(f"⚠️  Warning: {ENV_FILE} not found - using system environment variables")

# Configuration
VOLSPIKE_API_URL = os.getenv("VOLSPIKE_API_URL", "http://localhost:3001")
VOLSPIKE_API_KEY = os.getenv("VOLSPIKE_API_KEY", "")
BINANCE_API_URL = "https://fapi.binance.com"
BINANCE_PROXY_URL = os.getenv("BINANCE_PROXY_URL", "http://localhost:3002")

# Thresholds
ENTER_THRESHOLD = float(os.getenv("OI_LIQUID_ENTER_QUOTE_24H", "4000000"))  # 4M USDT
EXIT_THRESHOLD = float(os.getenv("OI_LIQUID_EXIT_QUOTE_24H", "2000000"))  # 2M USDT

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


def fetch_exchange_info():
    """Fetch exchangeInfo from Binance proxy or directly"""
    # Try proxy first
    if BINANCE_PROXY_URL and not BINANCE_PROXY_URL.startswith("http://localhost"):
        try:
            response = session.get(f"{BINANCE_PROXY_URL}/api/binance/futures/info", timeout=10)
            if response.ok:
                return response.json()
        except Exception as e:
            print(f"⚠️  Proxy unavailable, using direct Binance: {e}")
    
    # Fallback to direct Binance
    response = session.get(f"{BINANCE_API_URL}/fapi/v1/exchangeInfo", timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_ticker_24hr():
    """Fetch 24h ticker stats from Binance"""
    response = session.get(f"{BINANCE_API_URL}/fapi/v1/ticker/24hr", timeout=30)
    response.raise_for_status()
    return response.json()


def filter_usdt_perps(exchange_info):
    """Filter to USDT perpetual contracts"""
    perps = []
    for symbol_info in exchange_info.get("symbols", []):
        if (symbol_info.get("contractType") == "PERPETUAL" and 
            symbol_info.get("quoteAsset") == "USDT" and
            symbol_info.get("status") == "TRADING"):
            perps.append(symbol_info["symbol"])
    return perps


def compute_liquid_universe(perps, ticker_stats, current_universe_set):
    """Compute liquid universe with hysteresis"""
    new_universe = set()
    meta = {}
    
    ticker_map = {t["symbol"]: t for t in ticker_stats}
    
    for symbol in perps:
        ticker = ticker_map.get(symbol)
        if not ticker:
            continue
        
        quote_volume = float(ticker.get("quoteVolume", 0))
        is_currently_in = symbol in current_universe_set
        
        # Hysteresis logic
        if not is_currently_in:
            # Enter if above threshold
            if quote_volume >= ENTER_THRESHOLD:
                new_universe.add(symbol)
                meta[symbol] = {
                    "quoteVolume24h": quote_volume,
                    "enteredAt": datetime.datetime.utcnow().isoformat() + "Z",
                    "lastSeenAt": datetime.datetime.utcnow().isoformat() + "Z",
                }
        else:
            # Exit if below exit threshold, otherwise keep
            if quote_volume >= EXIT_THRESHOLD:
                new_universe.add(symbol)
                meta[symbol] = {
                    "quoteVolume24h": quote_volume,
                    "lastSeenAt": datetime.datetime.utcnow().isoformat() + "Z",
                }
    
    return new_universe, meta


def post_liquid_universe(universe, meta):
    """Post liquid universe to VolSpike backend"""
    url = f"{VOLSPIKE_API_URL}/api/market/open-interest/liquid-universe/update"
    
    payload = {
        "symbols": [
            {
                "symbol": symbol,
                "quoteVolume24h": meta[symbol]["quoteVolume24h"],
                "enteredAt": meta[symbol].get("enteredAt"),
                "lastSeenAt": meta[symbol]["lastSeenAt"],
            }
            for symbol in universe
        ],
        "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    }
    
    response = session.post(
        url,
        json=payload,
        headers={
            "X-API-Key": VOLSPIKE_API_KEY,
            "Content-Type": "application/json",
        },
        timeout=10
    )
    
    if not response.ok:
        raise Exception(f"Backend returned {response.status_code}: {response.text}")
    
    return response.json()


def main():
    """Main job execution"""
    print(f"🔄 Starting liquid universe classification job")
    print(f"   Environment file: {ENV_FILE} ({'found' if ENV_FILE.exists() else 'NOT FOUND'})")
    if ENV_FILE.exists():
        print(f"   Environment loaded: {env_loaded}")
        # Debug: Show what was loaded
        if env_loaded:
            print(f"   Loaded VOLSPIKE_API_URL: {os.getenv('VOLSPIKE_API_URL', 'NOT SET')}")
            print(f"   Loaded VOLSPIKE_API_KEY: {'SET' if os.getenv('VOLSPIKE_API_KEY') else 'NOT SET'}")
    
    # Check configuration
    if not VOLSPIKE_API_URL or VOLSPIKE_API_URL == "http://localhost:3001":
        print(f"\n❌ ERROR: VOLSPIKE_API_URL not set correctly!")
        print(f"   Current value: '{VOLSPIKE_API_URL}'")
        print(f"   Expected: 'https://volspike-production.up.railway.app'")
        print(f"\n   To fix:")
        print(f"   1. Check if /home/trader/.volspike.env exists:")
        print(f"      cat /home/trader/.volspike.env")
        print(f"   2. Make sure it contains:")
        print(f"      VOLSPIKE_API_URL=https://volspike-production.up.railway.app")
        print(f"      VOLSPIKE_API_KEY=your-api-key")
        print(f"   3. If file doesn't exist or is missing variables, add them:")
        print(f"      nano /home/trader/.volspike.env")
        return 1
    
    if not VOLSPIKE_API_KEY:
        print("\n❌ ERROR: VOLSPIKE_API_KEY not set!")
        print("   Please check /home/trader/.volspike.env file")
        print("   Make sure it contains: VOLSPIKE_API_KEY=your-api-key")
        return 1
    
    print(f"   ✅ Backend: {VOLSPIKE_API_URL}")
    print(f"   ✅ API Key: {'*' * min(20, len(VOLSPIKE_API_KEY))}... (set)")
    print(f"   Thresholds: Enter >= ${ENTER_THRESHOLD/1e6:.2f}M, Exit < ${EXIT_THRESHOLD/1e6:.2f}M")
    
    try:
        # 1. Fetch exchangeInfo
        print("📊 Fetching exchangeInfo...")
        exchange_info = fetch_exchange_info()
        perps = filter_usdt_perps(exchange_info)
        print(f"✅ Found {len(perps)} USDT perpetual contracts")
        
        # 2. Fetch ticker stats
        print("📊 Fetching ticker/24hr...")
        ticker_stats = fetch_ticker_24hr()
        print(f"✅ Fetched {len(ticker_stats)} ticker records")
        
        # 3. Get current universe from backend (if endpoint exists)
        current_universe_set = set()
        try:
            response = session.get(f"{VOLSPIKE_API_URL}/api/market/open-interest/liquid-universe", timeout=5)
            if response.ok:
                data = response.json()
                current_universe_set = {s["symbol"] for s in data.get("symbols", [])}
                print(f"✅ Current universe: {len(current_universe_set)} symbols")
        except Exception as e:
            print(f"⚠️  Could not fetch current universe (will start fresh): {e}")
        
        # 4. Compute new universe
        new_universe, meta = compute_liquid_universe(perps, ticker_stats, current_universe_set)
        
        symbols_added = len(new_universe - current_universe_set)
        symbols_removed = len(current_universe_set - new_universe)
        
        print(f"📊 Computed universe: {len(new_universe)} symbols (+{symbols_added}, -{symbols_removed})")
        
        # 5. Post to backend
        print("📤 Posting to backend...")
        result = post_liquid_universe(new_universe, meta)
        print(f"✅ Posted liquid universe: {len(new_universe)} symbols")
        
        return 0
        
    except Exception as e:
        print(f"❌ Job failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

