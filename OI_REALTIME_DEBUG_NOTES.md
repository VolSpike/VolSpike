# OI Realtime Poller Debug Notes

**Date**: December 2, 2025
**Issue**: Dashboard shows $0.00 for Open Interest values
**Goal**: Deliver working OI data to Pro users every 30 seconds

---

## Problem Summary

The OI poller fetches data from 341 liquid symbols every 30 seconds, but the dashboard displays $0.00 for all symbols including major ones (BTC, ETH, SOL).

**Root Cause**: The OI poller makes 341 concurrent HTTP requests to `localhost:8888/funding/{symbol}` to fetch mark prices. The HTTP API server gets overwhelmed and most requests timeout. When mark prices are 0, the backend filters them out (line 74 in open-interest.ts: `&& item.markPrice > 0`).

---

## System Architecture

### WebSocket Daemon (Working Perfectly)
- **File**: `/home/trader/volume-spike-bot/binance_funding_ws_daemon.py`
- **Service**: `binance-funding-ws.service`
- **Status**: Active, tracking 648 symbols successfully
- **State File**: `/home/trader/volume-spike-bot/.funding_state.json` (122KB)
- **Contents**: All 648 symbols with correct mark prices
  - BTCUSDT: 93041.35202399
  - ETHUSDT: 3055.51
  - SOLUSDT: 142.2

### HTTP API Server (Bottleneck)
- **File**: `/home/trader/volume-spike-bot/funding_api_server.py`
- **Port**: 8888
- **Endpoints**:
  - `/funding/{symbol}` - Single symbol lookup
  - `/funding/batch?symbols=SYM1,SYM2` - Batch lookup (HAS ROUTING ISSUE)
- **Problem**: Can't handle 341 concurrent requests (most timeout)

### OI Realtime Poller (Needs Fix)
- **File**: `/home/trader/volume-spike-bot/oi_realtime_poller.py`
- **Service**: `oi-realtime-poller.service`
- **Current Behavior**:
  - Fetches OI from Binance for 341 symbols (works)
  - Makes 341 HTTP calls to `localhost:8888/funding/{symbol}` for mark prices (FAILS for 300 symbols)
  - Posts to backend with `markPrice: 0` for failed fetches
  - Backend filters out items where `markPrice === 0`
  - Result: Only 41 symbols in cache, dashboard shows $0.00

---

## Solutions Attempted

### ✅ Attempt 1: Disable 5-minute OI posting
- **File**: `hourly_volume_alert_dual_env.py` (lines 551-556)
- **Action**: Commented out OI posting (was overwriting realtime cache)
- **Result**: SUCCESS - 5-minute script no longer interferes
- **Status**: DEPLOYED

### ❌ Attempt 2: Increase WebSocket fetch timeout
- **Change**: Timeout from 1s to 5s in `fetch_mark_price_from_ws()`
- **Result**: FAILED - Still overwhelming API server
- **Reason**: Problem is concurrent volume, not timeout

### ❌ Attempt 3: Reduce concurrent workers
- **Change**: ThreadPoolExecutor from 20 workers to 10
- **Result**: FAILED - Still too many concurrent requests
- **Reason**: Even 10 concurrent requests overwhelm the API

### ❌ Attempt 4: Use batch endpoint
- **Endpoint**: `http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT`
- **Result**: FAILED - Returns `{"error": "Symbol not found", "symbol": "batch"}`
- **Reason**: FastAPI routing issue - `/funding/{symbol}` matches before `/funding/batch`
- **Status**: Batch endpoint exists in code but can't be reached

### 🔄 Attempt 5: Read state file directly (IN PROGRESS)
- **Approach**: Read `.funding_state.json` file directly instead of HTTP calls
- **Advantage**: ONE file read instead of 341 HTTP requests
- **Status**: Code written but not deployed yet

---

## Current Implementation Plan

### Solution: Direct State File Reading

Replace the concurrent HTTP fetching with a single file read:

```python
import json

STATE_FILE = "/home/trader/volume-spike-bot/.funding_state.json"

# In main_loop(), before ThreadPoolExecutor:
# Load ALL mark prices from WebSocket daemon state file (ONE file read!)
mark_prices = {}
try:
    with open(STATE_FILE, 'r') as f:
        state_data = json.load(f)
        funding_state = state_data.get('funding_state', {})
        for symbol, data in funding_state.items():
            if 'markPrice' in data and data['markPrice'] is not None:
                mark_prices[symbol] = data['markPrice']
        print(f"📊 Loaded {len(mark_prices)} mark prices from WebSocket state file")
except Exception as e:
    print(f"⚠️  Failed to load WebSocket state file: {e}")
    mark_prices = {}  # Fallback to empty dict

# Then in ThreadPoolExecutor loop, use mark_prices[symbol] instead of HTTP call
```

### Code Changes Required

**File**: `oi_realtime_poller.py`

1. **Add import** (line ~20):
   ```python
   import json
   ```

2. **Add constant** (line ~96):
   ```python
   STATE_FILE = "/home/trader/volume-spike-bot/.funding_state.json"
   ```

3. **Remove function**: `fetch_mark_price_from_ws()` (lines 168-197) - no longer needed

4. **Modify**: `fetch_oi_for_symbol()` (lines 200-226)
   - Remove mark price HTTP fetch
   - Change signature to accept mark_price as parameter
   - Return only OI contracts

5. **Modify**: `main_loop()` (lines 462-539)
   - Add state file reading before ThreadPoolExecutor
   - Pass mark_price from dict to `fetch_oi_for_symbol()`

---

## Testing Checklist

After deploying the fix:

- [ ] Restart `oi-realtime-poller.service`
- [ ] Check logs for "📊 Loaded X mark prices from WebSocket state file"
- [ ] Verify X is ~648 (all symbols)
- [ ] Wait 30 seconds for first batch post
- [ ] Check backend cache: `curl https://volspike-production.up.railway.app/api/market/open-interest/cache`
- [ ] Verify cache has 341 symbols (not just 41)
- [ ] Verify BTCUSDT, ETHUSDT, SOLUSDT have non-zero markPrice
- [ ] Check dashboard - should show non-zero OI values for Pro users
- [ ] Monitor for 5 minutes to ensure updates continue every 30 seconds

---

## Backend Validation Logic

**File**: `volspike-nodejs-backend/src/routes/open-interest.ts`
**Line 74**: `&& item.markPrice > 0`

This line filters out any OI data where markPrice is 0. This is why only 41 symbols appear in cache (those are the ones where HTTP fetch succeeded).

**Important**: Once we fix the mark price fetching, all 341 symbols should have valid mark prices > 0, and the backend will accept all of them.

---

## Key Files

### Digital Ocean Scripts
- `/home/trader/volume-spike-bot/oi_realtime_poller.py` - OI poller (NEEDS FIX)
- `/home/trader/volume-spike-bot/binance_funding_ws_daemon.py` - WebSocket daemon (WORKING)
- `/home/trader/volume-spike-bot/funding_api_server.py` - HTTP API (BOTTLENECK)
- `/home/trader/volume-spike-bot/.funding_state.json` - State file (DATA SOURCE)
- `/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py` - Volume alerts (FIXED)

### Services
- `binance-funding-ws.service` - WebSocket daemon
- `binance-funding-api.service` - HTTP API server
- `oi-realtime-poller.service` - OI poller
- `volspike.service` - Volume alerts (OI posting disabled)

### Backend
- `volspike-nodejs-backend/src/routes/open-interest.ts` - OI ingestion endpoint

---

## Next Steps

1. ✅ Create this debug notes file
2. ✅ Implement state file reading in `oi_realtime_poller.py`
3. ⏳ Upload modified file to Digital Ocean
4. ⏳ Restart `oi-realtime-poller.service`
5. ⏳ Verify backend cache has all 341 symbols
6. ⏳ Confirm dashboard shows non-zero OI values
7. ⏳ Commit and push final solution
8. ⏳ Update WEBSOCKET_ONLY_IMPLEMENTATION.md

## Code Changes Implemented

### Added imports (line 19):
```python
import json
```

### Added constant (line 101):
```python
STATE_FILE = "/home/trader/volume-spike-bot/.funding_state.json"
```

### Added new function `load_mark_prices_from_state()` (lines 172-190):
- Reads state file once per loop
- Returns dict of {symbol: markPrice}
- Replaces 341 HTTP calls with ONE file read

### Modified `fetch_oi_for_symbol()` (lines 193-213):
- Now accepts `mark_price` as parameter
- Only fetches OI from Binance (no HTTP call for mark price)
- Returns (oi, mark_price) tuple

### Modified `main_loop()` (lines 454-455):
- Loads all mark prices before ThreadPoolExecutor
- Passes mark price to each `fetch_oi_for_symbol()` call
- No more HTTP bottleneck!

---

## Important Notes

- **DO NOT** modify the WebSocket daemon - it's working perfectly
- **DO NOT** try to fix the batch endpoint routing - not worth the time
- **DO NOT** increase concurrent workers - will still overwhelm API
- **DO** read state file directly - simplest and most reliable solution
- **DO** verify all 648 symbols load from state file (not just 341)
- **DO** monitor logs for any file read errors

---

## Dashboard Verification

Once deployed, verify on https://volspike.com:

1. Login as Pro user
2. Navigate to dashboard
3. Check Open Interest column (should be visible for Pro)
4. Verify values are non-zero for major symbols (BTC, ETH, SOL)
5. Wait 30 seconds and verify values update
6. Check timestamp shows "30s ago" or similar

---

## Testing Results

### ✅ State File Loading - SUCCESS
```bash
📊 Loaded 648 mark prices from WebSocket state file
```
All 648 symbols loaded successfully with correct prices:
- BTCUSDT: $93,244.90
- ETHUSDT: $3,055.50
- SOLUSDT: $142.20 (etc.)

### ✅ OI Batch Posting - SUCCESS
```bash
✅ Posted OI batch chunk 1/4: 100 symbols (100 inserted)
✅ Posted OI batch chunk 2/4: 100 symbols (100 inserted)
✅ Posted OI batch chunk 3/4: 100 symbols (100 inserted)
✅ Posted OI batch chunk 4/4: 42 symbols (42 inserted)
✅ Posted all 4 chunks: 342 total symbols
✅ Posted 342 OI samples in 4.8s
```

**Key Improvements**:
- ✅ 100% success rate (342/342 symbols accepted)
- ✅ All symbols have valid mark prices from state file
- ✅ Backend accepting all symbols (backend validation passing)
- ✅ Updates happening every 30 seconds as expected
- ✅ No HTTP bottleneck (ONE file read instead of 341 HTTP calls)

### Next: Dashboard Verification
Backend cache endpoint requires authentication. User should verify on dashboard at https://volspike.com:
1. Login as Pro user
2. Check Open Interest column values (should be non-zero)
3. Verify major symbols (BTC, ETH, SOL) show correct values
4. Wait 30 seconds and confirm values update

---

**Last Updated**: 2025-12-03 05:10 UTC
**Status**: ⚠️ POSTING TO BACKEND BUT DASHBOARD STILL SHOWS $0.00 - Need to investigate backend/frontend

## CRITICAL ISSUE - Dashboard Still Shows $0.00

User confirmed as Pro user, dashboard STILL shows $0.00 for all Open Interest values despite:
- ✅ Service posting 342/342 symbols successfully
- ✅ Backend accepting all symbols (342 inserted)
- ✅ All symbols have valid mark prices from state file

**This means the problem is NOT in the poller - it's in:**
1. Backend cache/storage logic
2. Frontend data fetching
3. WebSocket broadcasting

**VERIFIED SO FAR**:
- ✅ Poller loads 648 mark prices from state file correctly (BTC: $93,163, ETH: $3,052, SOL: $142.45)
- ✅ Backend receives and accepts all 342 symbols (342 inserted per batch)
- ✅ Frontend fetches from GET `/api/market/open-interest` endpoint
- ✅ Backend GET endpoint returns `oiCache.data` (populated during POST ingestion)

**ROOT CAUSE HYPOTHESIS**:
Backend cache computation (open-interest.ts:109-118) stores **openInterestUsd** values.
If `openInterestUsd` is 0 (which happens when `markPrice: 0`), the cache stores 0.

## ⚠️ CRITICAL FINDING - Backend Cache Only Has 43 Symbols!

**Poller is sending**:
- 343 symbols total
- With CORRECT mark prices (SUIUSDT: $1.75, XRPUSDT: $2.21, etc.)
- With CORRECT openInterestUsd values (hundreds of millions)
- Backend logs show "342 inserted" (actually 343 now)

**Backend cache contains**:
- Only 43 symbols total
- NO major symbols (BTC, ETH, SOL, BNB, SUI, XRP all MISSING)
- Only obscure symbols: ZILUSDT, HANAUSDT, XAIUSDT, XPINUSDT, ONTUSDT

**This means**:
The backend is accepting and inserting to database (342 inserted), but something is WRONG with the cache update logic (lines 107-123 in open-interest.ts).

**Most likely cause**:
The cache update loop (lines 110-118) might be skipping symbols where openInterestUsd is falsy or where computation fails.

**URGENT ACTION NEEDED**:
Need to add logging to backend cache update logic to see why only 43 symbols make it to cache
