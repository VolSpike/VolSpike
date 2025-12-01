# OI Realtime Feature - Deployment Checklist

Use this checklist to ensure everything is deployed and working correctly.

## Pre-Deployment

- [ ] Backend code deployed to Railway
- [ ] Database migrations applied (3 new tables exist)
- [ ] Environment variables set in Railway:
  - [ ] `ALERT_INGEST_API_KEY` (same as used by volume alerts)
  - [ ] `ENABLE_LIQUID_UNIVERSE_JOB=true` (optional, defaults to enabled)
  - [ ] `BINANCE_PROXY_URL` (if using proxy, otherwise defaults to localhost)
- [ ] Backend builds successfully (`npm run build`)
- [ ] All backend tests pass (`npm test`)

## Digital Ocean Setup

- [ ] SSH access to droplet verified
- [ ] Python 3 installed (`python3 --version`)
- [ ] `requests` library installed (`pip3 install requests`)
- [ ] Script uploaded: `oi_realtime_poller.py`
- [ ] Script syntax verified (`python3 -m py_compile oi_realtime_poller.py`)

## Service Configuration

- [ ] Service file created: `/etc/systemd/system/oi-realtime-poller.service`
- [ ] Environment variables set in service file:
  - [ ] `VOLSPIKE_API_URL` (correct backend URL)
  - [ ] `VOLSPIKE_API_KEY` (matches backend `ALERT_INGEST_API_KEY`)
- [ ] Service enabled (`sudo systemctl enable oi-realtime-poller.service`)
- [ ] Service started (`sudo systemctl start oi-realtime-poller.service`)
- [ ] Service status shows "active (running)"

## Verification Tests

### Backend Tests

- [ ] Health endpoint works: `curl $API_URL/health`
- [ ] Liquid universe endpoint returns data: `curl $API_URL/api/market/open-interest/liquid-universe`
- [ ] OI samples endpoint works: `curl $API_URL/api/market/open-interest/samples?limit=5`
- [ ] OI alerts endpoint works: `curl $API_URL/api/open-interest-alerts?limit=5`
- [ ] API key authentication works (test with POST request)

### Poller Tests

- [ ] Service logs show "Loaded X symbols" (X > 0)
- [ ] Service logs show "Computed polling interval: Xs" (5-20s)
- [ ] Service logs show "Posted OI batch" messages regularly (every 1-2 minutes)
- [ ] No errors in poller logs
- [ ] Service auto-restarts if it crashes

### Data Flow Tests

- [ ] Backend logs show "Open Interest ingestion: X inserted" (every 1-2 minutes)
- [ ] Database has rows with `source='realtime'` in `open_interest_snapshots` table
- [ ] Liquid universe table (`open_interest_liquid_symbols`) has symbols
- [ ] Liquid universe updates every 5 minutes (check `lastSeenAt` timestamps)

### Debug UI Tests

- [ ] Debug page loads: `https://your-frontend.com/debug/open-interest`
- [ ] Liquid Universe section shows symbols (> 0)
- [ ] Recent OI Samples section shows data
- [ ] WebSocket shows "Connected" (green dot)
- [ ] Latest OI Values updates automatically (wait 1-2 minutes)
- [ ] No errors in browser console (F12)

## Performance Verification

- [ ] Polling interval is reasonable (5-20 seconds based on universe size)
- [ ] No Binance rate limit errors
- [ ] Backend handles load without errors
- [ ] Database queries are fast (< 100ms)
- [ ] WebSocket connections are stable

## Monitoring (24 Hours)

- [ ] Service runs continuously for 24 hours
- [ ] No unexpected restarts
- [ ] Data accumulates in database
- [ ] Liquid universe updates regularly
- [ ] OI alerts fire when thresholds are met (if any)

## Troubleshooting Reference

**If something fails, check:**

1. **Poller not running:**
   ```bash
   sudo systemctl status oi-realtime-poller.service
   sudo journalctl -u oi-realtime-poller.service -n 50
   ```

2. **No data in backend:**
   ```bash
   # Check backend logs (Railway)
   # Check poller logs for "Posted OI batch"
   curl $API_URL/api/market/open-interest/samples?limit=1
   ```

3. **WebSocket not connecting:**
   ```bash
   # Check frontend env var: NEXT_PUBLIC_SOCKET_IO_URL
   # Check browser console for errors
   curl $API_URL/health
   ```

4. **API authentication errors:**
   ```bash
   # Verify API key matches
   sudo systemctl show oi-realtime-poller --property=Environment | grep API_KEY
   ```

---

## Quick Verification Commands

```bash
# 1. Check service status
sudo systemctl status oi-realtime-poller.service

# 2. Watch logs
sudo journalctl -u oi-realtime-poller.service -f

# 3. Test endpoints
curl $API_URL/api/market/open-interest/liquid-universe | jq '.totalSymbols'
curl $API_URL/api/market/open-interest/samples?limit=5 | jq '.count'

# 4. Run verification script
cd /home/trader/volume-spike-bot
export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
export VOLSPIKE_API_KEY="your-key"
bash verify_oi_setup.sh
```

---

## Success Criteria

✅ **Everything is working if:**
- Poller service is running
- Logs show regular "Posted OI batch" messages
- Backend logs show data ingestion
- Debug UI shows liquid universe and OI samples
- WebSocket connects and shows real-time updates
- No errors in any logs

Once all checkboxes are ✅, you're ready to proceed to Steps 11-13!

