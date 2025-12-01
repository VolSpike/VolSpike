# Quick Test Guide - Verify Everything Works

This is a condensed version for quick verification after deployment.

## 1. Verify Poller is Running

```bash
# SSH into Digital Ocean
ssh root@YOUR_IP

# Check service status
sudo systemctl status oi-realtime-poller.service

# Should show: Active: active (running)
```

## 2. Check Poller Logs

```bash
# Watch logs in real-time
sudo journalctl -u oi-realtime-poller.service -f

# Look for:
# ✅ "Loaded X symbols from liquid universe" (X > 0)
# ✅ "Posted OI batch: X symbols" (every 1-2 minutes)
# ❌ No errors
```

## 3. Test Backend Endpoints

```bash
# Test liquid universe (should return symbols)
curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe | jq '.totalSymbols'

# Test OI samples (should return data)
curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=5 | jq '.count'

# Test OI alerts (may be empty initially)
curl https://volspike-production.up.railway.app/api/open-interest-alerts?limit=5 | jq '.count'
```

## 4. Test Debug UI

1. Open: `https://your-frontend-domain.com/debug/open-interest`
2. Check:
   - ✅ Liquid Universe shows symbols (> 0)
   - ✅ Recent OI Samples shows data
   - ✅ WebSocket shows "Connected" (green dot)
   - ✅ Latest OI Values updates automatically

## 5. Verify Data Flow

**Timeline Test (wait 2 minutes):**

1. **T+0:00** - Check poller logs: Should see "Posted OI batch"
2. **T+0:30** - Check backend logs (Railway): Should see "Open Interest ingestion"
3. **T+1:00** - Refresh debug UI: Should see new samples
4. **T+2:00** - Check WebSocket: Should see real-time updates

## Quick Fixes

**If poller not running:**
```bash
sudo systemctl restart oi-realtime-poller.service
sudo journalctl -u oi-realtime-poller.service -n 50
```

**If "Unauthorized" errors:**
```bash
# Check API key matches backend
sudo systemctl show oi-realtime-poller --property=Environment | grep API_KEY
```

**If no data in UI:**
```bash
# Check backend is receiving data
curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=1
```

