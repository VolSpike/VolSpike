# Verify Funding Rate WebSocket Implementation

This guide helps you verify that the WebSocket funding rate implementation is working correctly before switching from REST API to WebSocket-only mode on Digital Ocean.

## Current Setup

Your volume alert script ([hourly_volume_alert_dual_env.py](hourly_volume_alert_dual_env.py:58)) is already running in **parallel validation mode**:

- **REST API**: Traditional method (currently used for alerts)
- **WebSocket**: New method (being validated in parallel)
- **Comparison**: Lines 448-456 compare both sources and log differences

## Prerequisites

Make sure these services are running on Digital Ocean:

1. **WebSocket Daemon** (`binance-funding-ws.service`)
2. **Funding API Server** (`binance-funding-api.service`)
3. **Volume Alert Script** (with `WS_FUNDING_ENABLED=true`)

## Step 1: Check WebSocket Services Status

```bash
# SSH into Digital Ocean
ssh trader@your-droplet-ip

# Check WebSocket daemon status
sudo systemctl status binance-funding-ws

# Check API server status
sudo systemctl status binance-funding-api

# Check health endpoint
curl http://localhost:8888/funding/health | jq
```

Expected health response:
```json
{
  "status": "healthy",
  "websocketConnected": true,
  "symbolCount": 300+,
  "uptimeSeconds": 12345.67,
  "messagesReceived": 50000+,
  "oldestDataAgeSeconds": 5.2,
  "newestDataAgeSeconds": 0.1
}
```

## Step 2: Quick Manual Comparison

Test a few symbols manually:

```bash
# Get funding from WebSocket API
curl http://localhost:8888/funding/BTCUSDT | jq

# Get funding from REST API (for comparison)
curl 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT' | jq
```

Compare the `fundingRate` values - they should be nearly identical.

## Step 3: Run Automated Verification Scripts

### Option A: Simple Real-time Verification

```bash
cd /home/trader/VolSpike/Digital\ Ocean

# Run simple verification (checks 10 symbols every 10 seconds)
python3 verify_funding_data.py
```

This shows:
- Side-by-side REST vs WebSocket funding rates
- Percentage differences
- Data age from WebSocket
- Real-time status (✓ MATCH, ⚠ CLOSE, ✗ DIFF)

**Expected output:**
```
Symbol       REST Funding    WS Funding      Diff %     REST Mark    WS Mark      Mark Diff %  WS Age   Status
================================================================================================================================
BTCUSDT         +0.000100      +0.000100      0.000%    43250.50    43250.50        0.000%     1.2s    ✓ MATCH
ETHUSDT         +0.000050      +0.000050      0.000%     2250.75     2250.75        0.000%     0.8s    ✓ MATCH
```

### Option B: Dual Alert Simulation

```bash
# Run alert simulation (shows how alerts would differ)
python3 simulate_dual_alerts.py
```

This shows:
- Volume spike detection (same for both)
- Funding rates from REST vs WebSocket
- Simulated alert messages side-by-side
- Alert payload comparison

**Expected output:**
```
Symbol: BTCUSDT
────────────────────────────────────────────────────────────────────────────
  Volume Data:
    Previous: $1,250,000,000
    Current:  $3,800,000,000
    Ratio:    3.04×
    Candle:   BULLISH 🟢
    Spike:    YES ⚡

  Funding Rate Comparison:
    REST API:    +0.000100 (+0.0100%)
    WebSocket:   +0.000100 (+0.0100%)
    Difference:  0.000000 (0.000%)
    Status:      ✅ IDENTICAL

  Simulated Alert Messages:
    [REST] BTC hourly volume 3.80B (3.04× prev) - Funding: +0.0100% 🟢
    [WS]   BTC hourly volume 3.80B (3.04× prev) - Funding: +0.0100% 🟢
```

### Option C: Static Comparison (Existing Script)

```bash
# Compare first 50 symbols from WebSocket cache
python3 compare_funding_ws_vs_rest.py --max-symbols 50

# Compare specific symbols
python3 compare_funding_ws_vs_rest.py --symbols BTCUSDT,ETHUSDT,SOLUSDT
```

## Step 4: Monitor Live Comparison Logs

Your volume alert script is already logging comparisons. Check the logs:

```bash
# Check recent comparison logs
sudo journalctl -u your-volume-alert-service -f | grep -E "(Funding mismatch|Funding Comparison Summary)"
```

You should see:
- **Every 100 comparisons**: Summary log with match rate
- **Only mismatches**: Individual mismatch logs (if difference > 0.1%)

**Example log output:**
```
📊 Funding Comparison Summary:
   Total comparisons: 1000
   Matches: 998 (99.8%)
   Mismatches: 2
   Avg difference: 0.002%
   Max difference: 0.085% (ETHUSDT)
```

## Step 5: Check Comparison Statistics

```bash
# Parse logs and generate validation report
sudo journalctl -u your-volume-alert-service --since "1 hour ago" | python3 validate_funding_comparison.py
```

This generates a report with:
- Total mismatches logged
- Average difference percentage
- Maximum difference percentage
- Worst performing symbols
- **Validation recommendation** (SAFE TO SWITCH or REVIEW NEEDED)

## Validation Criteria

Before switching to WebSocket-only mode, ensure:

✅ **WebSocket Health**
- Service uptime > 1 hour without restarts
- `websocketConnected: true`
- `symbolCount` > 300
- Data age < 10 seconds

✅ **Data Accuracy**
- Average difference < 0.1%
- Maximum difference < 1.0%
- Match rate > 95%

✅ **Alert Consistency**
- Simulated alerts are identical or negligibly different
- No missing symbols in WebSocket cache

## What to Look For

### 🟢 Good Signs
- `✓ MATCH` or `✅ IDENTICAL` status
- Differences < 0.01%
- WebSocket data age < 5 seconds
- No service restarts or disconnections
- Match rate > 99%

### 🟡 Acceptable
- Differences between 0.01% - 0.1%
- WebSocket data age 5-10 seconds
- Match rate 95-99%
- Occasional brief disconnections (<30s)

### 🔴 Review Needed
- Differences > 1.0%
- WebSocket data age > 30 seconds
- Match rate < 95%
- Frequent disconnections
- Missing symbols in WebSocket cache

## Understanding the Differences

Small differences (< 0.1%) are expected because:
- **REST API**: Polled at specific intervals (every 5 minutes)
- **WebSocket**: Continuous stream (updates in real-time)
- **Timing**: REST fetches at exact moment, WS may be 0-5 seconds old

These tiny differences **do not impact** volume alerts because:
- Funding rate changes very slowly (updated every 8 hours on Binance)
- Alert thresholds are based on volume spikes (3×), not precise funding values
- Users see funding rate as context (e.g., +0.0100% vs +0.0099% is negligible)

## Switch to WebSocket-Only Mode

Once validation passes:

1. **Update environment variable** in `/home/trader/.volspike.env`:
   ```bash
   WS_FUNDING_ENABLED=true
   USE_REST_FUNDING=false  # Add this new flag
   ```

2. **Modify the alert script** to use WebSocket-only:
   - Comment out REST API funding fetch (lines 438-445)
   - Use only WebSocket funding (lines 448-456 simplified)
   - Remove comparison logging

3. **Restart volume alert service**:
   ```bash
   sudo systemctl restart your-volume-alert-service
   ```

4. **Monitor for 24 hours** to ensure stability

## Troubleshooting

### WebSocket Service Not Healthy

```bash
# Check logs
sudo journalctl -u binance-funding-ws -n 100

# Restart service
sudo systemctl restart binance-funding-ws

# Wait 30 seconds and check health again
sleep 30
curl http://localhost:8888/funding/health | jq
```

### High Differences (> 1%)

This is unusual. Check:
- Are both services fetching from same Binance API region?
- Is there a network issue causing stale WebSocket data?
- Are there any symbols consistently showing high differences?

```bash
# Check specific symbol on both sources
SYMBOL="BTCUSDT"
echo "REST:" && curl "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=$SYMBOL" | jq
echo "WS:" && curl "http://localhost:8888/funding/$SYMBOL" | jq
```

### Missing Symbols in WebSocket

```bash
# Check how many symbols are in WebSocket cache
curl http://localhost:8888/funding/health | jq '.symbolCount'

# If too low (< 200), restart WebSocket daemon
sudo systemctl restart binance-funding-ws
```

## Timeline Recommendation

1. **Day 1-2**: Run verification scripts, monitor logs
2. **Day 3**: Review all metrics, ensure validation criteria met
3. **Day 4**: Switch to WebSocket-only mode
4. **Day 5-7**: Monitor production alerts closely
5. **Day 8+**: Full WebSocket operation

## Benefits After Switch

Once switched to WebSocket-only:

✅ **Reduced REST API calls**: Save ~300 calls every 5 minutes (86,400/day)
✅ **Lower rate limit pressure**: Avoid potential Binance rate limiting
✅ **Fresher data**: WebSocket updates in real-time vs 5-minute polls
✅ **Better reliability**: WebSocket auto-reconnects, less dependent on REST API availability
✅ **Cost efficiency**: Reduce server load from constant polling

## Files Reference

- [binance_funding_ws_daemon.py](binance_funding_ws_daemon.py) - WebSocket daemon
- [funding_api_server.py](funding_api_server.py) - HTTP API server
- [hourly_volume_alert_dual_env.py](hourly_volume_alert_dual_env.py) - Volume alert script (lines 56-68, 448-456)
- [compare_funding_ws_vs_rest.py](compare_funding_ws_vs_rest.py) - Static comparison
- [validate_funding_comparison.py](validate_funding_comparison.py) - Log parser
- [verify_funding_data.py](verify_funding_data.py) - Real-time verification (NEW)
- [simulate_dual_alerts.py](simulate_dual_alerts.py) - Alert simulation (NEW)

---

**Questions or Issues?**

If you see unexpected results, capture:
1. Health endpoint output
2. Comparison script output
3. Service logs (last 100 lines)
4. Specific symbols with high differences
