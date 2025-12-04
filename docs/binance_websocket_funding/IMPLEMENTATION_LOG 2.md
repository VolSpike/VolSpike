# Binance WebSocket Funding Rate Service - Implementation Log

## Date: December 2, 2025

## Issue Discovered: Funding Rate Parsing Mismatch

### Problem
- Frontend WebSocket (client-side) was showing correct funding rates (e.g., 0.00356%)
- Digital Ocean WebSocket daemon was showing different/incorrect funding rates
- Both connect to the same Binance stream (`!markPrice@arr`), so they should match

### Root Cause
**Initial Implementation Error**: The Digital Ocean daemon only checked the `r` field for funding rate:
```python
funding_rate = float(update.get("r", 0))
```

**Frontend Implementation**: The frontend checks multiple fields in order:
```typescript
const candidates = [
    raw.r,
    raw.R,              // Uppercase R
    raw.lastFundingRate,
    raw.fr,
    raw.fundingRate,
    raw.estimatedSettlePriceRate,
];
```

**Why This Happened**: 
- Initial implementation was based on Binance API documentation which shows `r` as the primary field
- Did not cross-reference with existing frontend implementation
- Binance may send funding rate in different fields (`R`, `fr`, etc.) depending on the message format

### Fix Applied
Updated `binance_funding_ws_daemon.py` to check multiple fields like the frontend:
```python
# Parse funding rate - check multiple fields like frontend does
funding_rate = 0.0
funding_field_used = None
for field in ["r", "R", "lastFundingRate", "fr", "fundingRate", "estimatedSettlePriceRate"]:
    if field in update and update[field] is not None:
        try:
            funding_rate = float(update[field])
            funding_field_used = field
            break  # Use first valid field found
        except (ValueError, TypeError):
            continue
```

### Lesson Learned
**Always cross-reference with existing implementations** - The frontend already had a working WebSocket implementation that should have been used as the reference for parsing logic.

---

## Deployment Timeline

### Step 1: File Upload
- Uploaded new files to Digital Ocean server:
  - `binance_funding_ws_daemon.py` - WebSocket daemon
  - `funding_api_server.py` - HTTP API server
  - `binance-funding-ws.service` - Systemd service file
  - `binance-funding-api.service` - Systemd service file
  - Updated `hourly_volume_alert_dual_env.py` - Volume alert script
  - Updated `oi_realtime_poller.py` - OI poller script

### Step 2: Dependencies Installation
```bash
sudo apt install python3-pip
pip3 install websocket-client fastapi uvicorn
```

### Step 3: Service Configuration
- Fixed service file paths (changed from `/home/trader/volspike/Digital Ocean` to `/home/trader/volume-spike-bot`)
- Installed systemd services
- Enabled services to start on boot

### Step 4: Bug Fixes During Deployment

#### Bug 1: STALE_THRESHOLD not defined
- **Error**: `NameError: name 'STALE_THRESHOLD' is not defined`
- **Fix**: Changed `STALE_THRESHOLD_SEC = STALE_THRESHOLD` to `STALE_THRESHOLD_SEC = 180`

#### Bug 2: Route ordering issue
- **Error**: `/funding/health` endpoint was matching `/funding/{symbol}` route
- **Fix**: Moved `/funding/health` endpoint definition BEFORE `/funding/{symbol}` route
- **Reason**: FastAPI matches routes in order, so specific routes must come before parameterized routes

#### Bug 3: Funding rate parsing mismatch
- **Error**: Different funding rates between frontend and Digital Ocean WebSocket
- **Fix**: Updated parsing to check multiple fields like frontend does

### Step 5: Services Started
- ✅ WebSocket daemon: Running and connected to Binance
- ✅ HTTP API server: Running on localhost:8888
- ✅ Volume alert script: Running with WebSocket funding enabled (parallel validation mode)

---

## Current Status: Parallel Validation Mode

### What's Running
1. **WebSocket Daemon** (`binance-funding-ws.service`)
   - Connects to `wss://fstream.binance.com/stream?streams=!markPrice@arr`
   - Maintains in-memory `funding_state` dictionary
   - Writes to `.funding_state.json` file for HTTP API access
   - Auto-reconnects on disconnect

2. **HTTP API Server** (`binance-funding-api.service`)
   - Runs on `http://localhost:8888`
   - Endpoints:
     - `GET /funding/health` - Health check
     - `GET /funding/{symbol}` - Single symbol funding data
     - `GET /funding/batch?symbols=...` - Batch funding data

3. **Volume Alert Script** (`volspike.service`)
   - Running `hourly_volume_alert_dual_env.py`
   - **Parallel validation mode**: Fetches funding from both REST API and WebSocket
   - Compares values and logs differences
   - Uses WebSocket data for alerts (falls back to REST if WebSocket unavailable)
   - Logs comparison statistics every 100 comparisons

### Comparison Statistics Being Collected
- Total comparisons made
- Matches vs mismatches
- Average difference percentage
- Maximum difference observed
- Worst symbol (highest average difference)

---

## How to Check Comparison Report in the Morning

### Option 1: Check Comparison Summary (if appeared)
```bash
# Check if summary has been logged (appears every 100 comparisons)
sudo journalctl -u volspike.service | grep -A 10 "Funding Comparison Summary" | tail -20
```

### Option 2: Extract All Mismatches
```bash
# Extract all funding mismatches
sudo journalctl -u volspike.service | grep "Funding mismatch" > /tmp/funding_mismatches.txt

# Count statistics
MATCHES=$(sudo journalctl -u volspike.service | grep -c "Funding match" 2>/dev/null || echo "0")
MISMATCHES=$(sudo journalctl -u volspike.service | grep -c "Funding mismatch" 2>/dev/null || echo "0")
TOTAL=$((MATCHES + MISMATCHES))
echo "Total comparisons: $TOTAL"
echo "Matches: $MATCHES"
echo "Mismatches: $MISMATCHES"
if [ $TOTAL -gt 0 ]; then
    echo "Match rate: $(echo "scale=2; $MATCHES * 100 / $TOTAL" | bc)%"
fi
```

### Option 3: Generate Validation Report
```bash
# Collect logs
sudo journalctl -u volspike.service > /tmp/volume_alert.log

# Generate report
python3 validate_funding_comparison.py /tmp/volume_alert.log
```

### Option 4: Quick Status Check
```bash
# Check all services are running
sudo systemctl status binance-funding-ws.service binance-funding-api.service volspike.service

# Check health
curl http://localhost:8888/funding/health | python3 -m json.tool

# Check recent comparisons
sudo journalctl -u volspike.service | grep -E "Funding match|Funding mismatch" | tail -20
```

---

## Architecture Decisions

### Why Shared JSON File Instead of Direct Import?
- **Decision**: Use `.funding_state.json` file for inter-process communication
- **Reason**: WebSocket daemon and HTTP API server run as separate processes
- **Alternative Considered**: Direct Python import (doesn't work across processes)
- **Trade-off**: File I/O overhead vs simplicity (acceptable for this use case)

### Why Parallel Validation Mode?
- **Decision**: Run both REST API and WebSocket simultaneously
- **Reason**: Validate data accuracy before switching to WebSocket-only
- **Duration**: 24+ hours of parallel validation
- **Success Criteria**: >99% match rate, <0.1% average difference

### Why Check Multiple Funding Rate Fields?
- **Decision**: Check `r`, `R`, `fr`, `lastFundingRate`, etc.
- **Reason**: Binance may send funding rate in different fields
- **Reference**: Frontend implementation already handles this
- **Lesson**: Always cross-reference with existing working code

---

## Next Steps (After Validation Period)

1. **Review Validation Report** (after 24+ hours)
   - Check match rate (>99% target)
   - Check average difference (<0.1% target)
   - Review any outliers

2. **Switch to WebSocket-Only Mode** (if validation passes)
   - Remove REST API `premiumIndex` calls from scripts
   - Keep fallback logic for rare cases
   - Monitor for 7+ days

3. **Verify API Weight Reduction**
   - Check Binance API usage metrics
   - Confirm ~80 calls/min eliminated
   - Document savings

---

## Files Modified/Created

### New Files
- `Digital Ocean/binance_funding_ws_daemon.py` - WebSocket daemon
- `Digital Ocean/funding_api_server.py` - HTTP API server
- `Digital Ocean/binance-funding-ws.service` - Systemd service
- `Digital Ocean/binance-funding-api.service` - Systemd service
- `Digital Ocean/validate_funding_comparison.py` - Validation report generator
- `docs/binance_websocket_funding/` - Documentation directory

### Modified Files
- `Digital Ocean/hourly_volume_alert_dual_env.py` - Added WebSocket funding support
- `Digital Ocean/oi_realtime_poller.py` - Added WebSocket mark price support

### Documentation Files
- `docs/binance_websocket_funding/requirements.md`
- `docs/binance_websocket_funding/design.md`
- `docs/binance_websocket_funding/implementation_steps.md`
- `docs/binance_websocket_funding/DEPLOYMENT.md`
- `docs/binance_websocket_funding/README.md`
- `docs/binance_websocket_funding/IMPLEMENTATION_LOG.md` (this file)

---

## Key Learnings

1. **Always reference existing implementations** - Frontend had working WebSocket code that should have been the reference
2. **Route ordering matters** - FastAPI matches routes in order, specific routes must come first
3. **Binance field names vary** - Funding rate can be in `r`, `R`, `fr`, `lastFundingRate`, etc.
4. **Parallel validation is essential** - Running both REST and WebSocket simultaneously validates accuracy
5. **Service file paths matter** - Must match actual directory structure on server

---

## Contact & Support

If issues arise:
1. Check service logs: `sudo journalctl -u <service-name> -f`
2. Check health endpoint: `curl http://localhost:8888/funding/health`
3. Review this log for similar issues
4. Check documentation in `docs/binance_websocket_funding/`

