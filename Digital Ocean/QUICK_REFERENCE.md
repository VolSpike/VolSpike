# Quick Reference - Funding Rate WebSocket Verification

## 🚀 Quick Start (Run on Digital Ocean)

```bash
# SSH into Digital Ocean
ssh trader@your-droplet-ip

cd /path/to/scripts

# Run automated verification
./quick_verify.sh
```

## 📊 Verification Scripts

### 1. Simple Real-time Comparison
**Best for**: Quick visual check of funding rate accuracy

```bash
python3 verify_funding_data.py
```

**Shows:**
- 10 high-volume symbols
- REST vs WebSocket funding rates side-by-side
- Percentage differences (color-coded)
- WebSocket data age
- Auto-refresh every 10 seconds

**Stop with**: `Ctrl+C`

---

### 2. Dual Alert Simulation
**Best for**: Verifying volume alerts would be identical

```bash
python3 simulate_dual_alerts.py
```

**Shows:**
- Simulated volume spike detection
- Funding rates from both sources
- Alert messages side-by-side (REST vs WS)
- Alert payload comparison
- Impact assessment

**Stop with**: `Ctrl+C`

---

### 3. Static Comparison (Existing)
**Best for**: Batch comparison of many symbols

```bash
# Compare 50 symbols
python3 compare_funding_ws_vs_rest.py --max-symbols 50

# Compare specific symbols
python3 compare_funding_ws_vs_rest.py --symbols BTCUSDT,ETHUSDT,SOLUSDT

# Sort by difference
python3 compare_funding_ws_vs_rest.py --sort-by diff_pct
```

---

## 🔍 Manual Checks

### Check WebSocket Health
```bash
curl http://localhost:8888/funding/health | jq
```

**Expected:**
```json
{
  "status": "healthy",
  "websocketConnected": true,
  "symbolCount": 300+,
  "oldestDataAgeSeconds": < 10
}
```

### Compare Single Symbol
```bash
# WebSocket
curl http://localhost:8888/funding/BTCUSDT | jq

# REST API
curl 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT' | jq
```

### Check Service Status
```bash
# WebSocket daemon
sudo systemctl status binance-funding-ws

# API server
sudo systemctl status binance-funding-api

# View logs
sudo journalctl -u binance-funding-ws -f
```

---

## 📈 Monitor Live Comparison

Your volume alert script is already logging comparisons:

```bash
# View live comparison logs
sudo journalctl -u your-volume-alert-service -f | grep -E "(Funding mismatch|Funding Comparison Summary)"
```

**Look for:**
- Summary logs every 100 comparisons
- Mismatch logs only when difference > 0.1%

---

## ✅ Validation Checklist

Before switching to WebSocket-only:

- [ ] WebSocket health status = `healthy`
- [ ] WebSocket connected = `true`
- [ ] Symbol count > 300
- [ ] Data age < 10 seconds
- [ ] Average difference < 0.1%
- [ ] Maximum difference < 1.0%
- [ ] Match rate > 95%
- [ ] Simulated alerts are identical
- [ ] No frequent disconnections (< 1 per hour)
- [ ] Monitoring period: 24-48 hours

---

## 🎯 What Good Results Look Like

### verify_funding_data.py
```
Symbol       REST Funding    WS Funding      Diff %     Status
═══════════════════════════════════════════════════════════════
BTCUSDT         +0.000100      +0.000100      0.000%    ✓ MATCH
ETHUSDT         +0.000050      +0.000050      0.000%    ✓ MATCH
SOLUSDT         +0.000075      +0.000075      0.000%    ✓ MATCH

Summary:
  Successful comparisons: 10/10
  Average funding diff: 0.0000%
  Maximum funding diff: 0.0000%
  ✅ Status: EXCELLENT - Differences < 0.1%
```

### simulate_dual_alerts.py
```
Funding Rate Comparison:
  REST API:    +0.000100 (+0.0100%)
  WebSocket:   +0.000100 (+0.0100%)
  Difference:  0.000000 (0.000%)
  Status:      ✅ IDENTICAL

Simulated Alert Messages:
  [REST] BTC hourly volume 3.80B (3.04× prev) - Funding: +0.0100% 🟢
  [WS]   BTC hourly volume 3.80B (3.04× prev) - Funding: +0.0100% 🟢

Alert Payload Comparison:
  Impact on dashboard: NONE - Users would see same data
```

### Live Logs
```
📊 Funding Comparison Summary:
   Total comparisons: 1000
   Matches: 998 (99.8%)
   Mismatches: 2
   Avg difference: 0.002%
   Max difference: 0.085% (ETHUSDT)
```

---

## ⚠️ Warning Signs

### 🔴 High Differences
If you see differences > 1%:
1. Check both services are running
2. Verify network connectivity
3. Check for stale WebSocket data (age > 30s)
4. Restart WebSocket daemon if needed

### 🔴 Low Symbol Count
If symbol count < 200:
1. Restart WebSocket daemon
2. Wait 60 seconds for data to populate
3. Check health endpoint again

### 🔴 Service Disconnections
If WebSocket disconnects frequently (> 1/hour):
1. Check network stability
2. Review WebSocket daemon logs
3. Verify Binance WebSocket endpoint is accessible

---

## 📝 Quick Commands Reference

```bash
# Start services
sudo systemctl start binance-funding-ws
sudo systemctl start binance-funding-api

# Stop services
sudo systemctl stop binance-funding-ws
sudo systemctl stop binance-funding-api

# Restart services
sudo systemctl restart binance-funding-ws
sudo systemctl restart binance-funding-api

# View logs
sudo journalctl -u binance-funding-ws -n 100
sudo journalctl -u binance-funding-api -n 100

# Check WebSocket state file
cat .funding_state.json | jq '.connection_status'

# Test single symbol
curl http://localhost:8888/funding/BTCUSDT | jq
```

---

## 🎬 Workflow

1. **Initial Setup** (5 min)
   ```bash
   ./quick_verify.sh
   ```

2. **Real-time Verification** (10 min)
   ```bash
   python3 verify_funding_data.py
   # Watch for 2-3 refresh cycles
   # Ctrl+C to stop
   ```

3. **Alert Simulation** (5 min)
   ```bash
   python3 simulate_dual_alerts.py
   # Watch for 1-2 iterations
   # Ctrl+C to stop
   ```

4. **Monitor Production** (24-48 hours)
   ```bash
   sudo journalctl -u your-volume-alert-service -f | grep "Funding Comparison"
   ```

5. **Review & Decide**
   - Check all validation criteria
   - Review comparison summary
   - Make decision to switch

---

## 📚 Full Documentation

For complete details, see:
- [VERIFY_FUNDING_WEBSOCKET.md](VERIFY_FUNDING_WEBSOCKET.md) - Complete verification guide
- [DEPLOY_WEBSOCKET_FUNDING.md](DEPLOY_WEBSOCKET_FUNDING.md) - Deployment documentation

---

## 💡 Tips

- Run `verify_funding_data.py` during high volatility for best testing
- Check during funding rate update times (every 8 hours)
- Monitor during different times of day (low/high volume periods)
- Keep services running for at least 24 hours before deciding
- Small differences (< 0.1%) are normal and acceptable
