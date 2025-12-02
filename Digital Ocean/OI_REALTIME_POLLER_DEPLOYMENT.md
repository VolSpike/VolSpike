# Realtime Open Interest Poller - Deployment Guide

## Overview

This guide walks you through deploying the new **Realtime Open Interest Poller** (`oi_realtime_poller.py`) to your Digital Ocean droplet. This is a **separate script** that runs alongside your existing volume alert script.

**Important:** This poller runs independently and does NOT replace your existing `hourly_volume_alert_dual_env.py` script.

---

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] SSH access to your Digital Ocean droplet
- [ ] Your backend API URL (Railway production URL)
- [ ] Your backend API key (`ALERT_INGEST_API_KEY` from backend)
- [ ] Python 3 installed on the droplet
- [ ] `requests` library installed (`pip3 install requests`)

---

## Step 1: Verify Environment File

The scripts automatically load environment variables from `/home/trader/.volspike.env` (same as your volume alert script).

### 1.1 Check Your Environment File

```bash
# SSH into Digital Ocean
ssh root@YOUR_IP

# Check if .volspike.env exists and has required variables
cat /home/trader/.volspike.env
```

**Required variables:**
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key-here
```

**Optional variables (for liquid universe job):**
```bash
BINANCE_PROXY_URL=http://localhost:3002
OI_LIQUID_ENTER_QUOTE_24H=4000000
OI_LIQUID_EXIT_QUOTE_24H=2000000
```

### 1.2 Add Missing Variables (If Needed)

If `.volspike.env` doesn't have `VOLSPIKE_API_URL` or `VOLSPIKE_API_KEY`, add them:

```bash
# Edit the file
nano /home/trader/.volspike.env

# Add or update:
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key-here

# Save and exit (Ctrl+O, Enter, Ctrl+X)
```

**Note:** The scripts will automatically load from this file - no need to set environment variables manually or in systemd service files.

---

## Step 2: Test the Script Locally (Recommended)

Before deploying to Digital Ocean, test the script on your local machine to ensure it works:

### 2.1 Set Environment Variables Locally (For Testing)

```bash
# On your local machine (for testing only)
export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
export VOLSPIKE_API_KEY="your-api-key-here"
```

**Note:** On Digital Ocean, the scripts automatically load from `/home/trader/.volspike.env`, so you don't need to set these manually.

### 2.2 Install Dependencies

```bash
# Make sure you have Python 3 and requests library
python3 --version  # Should be 3.6+

# Install requests if needed
pip3 install requests
```

### 2.3 Run the Script Locally

```bash
# Navigate to the Digital Ocean directory
cd "Digital Ocean"

# Run the script
python3 oi_realtime_poller.py
```

**Expected output:**
```
🚀 Starting Realtime OI Poller (Step 9: Full Implementation)
   Backend URL: https://volspike-production.up.railway.app
   Max req/min: 2000
   Interval range: 5-20s
   Alert thresholds: ±5% / ±5000 contracts
✅ Loaded 150 symbols from liquid universe
📊 Computed polling interval: 8s
✅ Initialized OI history buffers
⏱️  Loop 1 | Interval: 8s | Samples in buffer: 5
⏱️  Loop 20 | Interval: 8s | Samples in buffer: 100
✅ Posted OI batch: 150 symbols (150 inserted)
```

**Let it run for 1-2 minutes, then press `Ctrl+C` to stop.**

**What to verify:**
- ✅ Script connects to backend successfully
- ✅ Loads liquid universe (should show number of symbols > 0)
- ✅ Computes polling interval (should be 5-20 seconds)
- ✅ Fetches OI from Binance (no errors)
- ✅ Posts OI batches to backend (should see "Posted OI batch" messages)

**If you see errors:**
- ❌ "Failed to fetch liquid universe" → Check API URL and key
- ❌ "Unauthorized" → API key is wrong
- ❌ "Network error" → Backend URL is wrong or backend is down

---

## Step 3: Prepare Digital Ocean Droplet

### 3.1 SSH into Your Droplet

```bash
# Replace with your actual IP or hostname
ssh root@YOUR_DIGITAL_OCEAN_IP

# Or if you use a different user:
ssh trader@YOUR_DIGITAL_OCEAN_IP
```

### 3.2 Navigate to Script Directory

```bash
# Check where your existing scripts are
cd /home/trader/volume-spike-bot

# Verify you're in the right place
ls -la
# You should see: hourly_volume_alert_dual_env.py (or similar)
```

### 3.3 Verify Python 3 is Installed

```bash
python3 --version
# Should show: Python 3.6.x or higher

# Check if requests library is installed
python3 -c "import requests; print('✅ requests installed')"
# If error, install it:
pip3 install requests
```

---

## Step 4: Upload the New Poller Script

### Option A: Upload via SCP (Recommended)

**From your local machine:**

```bash
# Make sure you're in the VolSpike root directory
cd /path/to/VolSpike

# Upload the script
scp "Digital Ocean/oi_realtime_poller.py" root@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/

# Also upload the test files (optional, for testing)
scp "Digital Ocean/test_oi_poller_interval.py" root@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/
scp "Digital Ocean/test_oi_alert_logic.py" root@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/
```

### Option B: Create File Directly on Server

```bash
# On Digital Ocean server
cd /home/trader/volume-spike-bot

# Create the file
nano oi_realtime_poller.py

# Paste the entire contents of oi_realtime_poller.py
# Save: Ctrl+O, Enter, Ctrl+X
```

### 4.1 Verify Script is Uploaded

```bash
# Check file exists
ls -la oi_realtime_poller.py

# Check file permissions (should be readable)
chmod +x oi_realtime_poller.py

# Verify Python syntax
python3 -m py_compile oi_realtime_poller.py
# Should return no errors
```

---

## Step 5: Test the Script on Digital Ocean (Before Service Setup)

Before setting up as a service, test it manually to ensure it works:

### 5.1 Verify Environment File

```bash
# Check that .volspike.env exists and has required variables
cat /home/trader/.volspike.env | grep -E "VOLSPIKE_API_URL|VOLSPIKE_API_KEY"

# Should show:
# VOLSPIKE_API_URL=https://volspike-production.up.railway.app
# VOLSPIKE_API_KEY=your-api-key-here
```

**Note:** The script automatically loads from `/home/trader/.volspike.env`, so no need to export variables manually.

### 5.2 Run the Script Manually

```bash
# Run the script
python3 oi_realtime_poller.py
```

**Watch for:**
- ✅ "Loaded X symbols from liquid universe" (X should be > 0)
- ✅ "Computed polling interval: Xs" (should be 5-20)
- ✅ "Posted OI batch: X symbols" (should appear every ~10 loops)
- ✅ No errors or connection failures

**Let it run for 2-3 minutes, then press `Ctrl+C`.**

**If you see errors:**
- Check the error message carefully
- Verify API URL and key are correct
- Check backend is accessible: `curl $VOLSPIKE_API_URL/health`

---

## Step 6: Create Systemd Service

Now we'll set up the script to run as a background service that auto-restarts.

### 6.1 Create Service File

```bash
# Create the service file
sudo nano /etc/systemd/system/oi-realtime-poller.service
```

### 6.2 Paste This Configuration

**Replace the values in `<>` brackets with your actual values:**

```ini
[Unit]
Description=VolSpike Realtime Open Interest Poller
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/oi_realtime_poller.py
Restart=always
RestartSec=10

# Note: Script automatically loads from /home/trader/.volspike.env
# No need to set Environment variables here unless you want to override

# Optional: Override defaults (if not in .volspike.env)
# Environment="OI_MAX_REQ_PER_MIN=2000"
# Environment="OI_MIN_INTERVAL_SEC=5"
# Environment="OI_MAX_INTERVAL_SEC=20"
# Environment="OI_SPIKE_THRESHOLD_PCT=0.05"
# Environment="OI_DUMP_THRESHOLD_PCT=0.05"
# Environment="OI_MIN_DELTA_CONTRACTS=5000"

# Standard output and error logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Important:**
- The script automatically loads `VOLSPIKE_API_URL` and `VOLSPIKE_API_KEY` from `/home/trader/.volspike.env`
- No need to set them in the service file (same pattern as your volume alert script)
- Adjust `User=` if your scripts run as a different user (check existing service: `sudo systemctl cat volume-alert`)

### 6.3 Save and Exit

- Press `Ctrl+O` to save
- Press `Enter` to confirm
- Press `Ctrl+X` to exit

---

## Step 7: Enable and Start the Service

### 7.1 Reload Systemd

```bash
# Tell systemd about the new service
sudo systemctl daemon-reload
```

### 7.2 Enable Service (Auto-start on boot)

```bash
# Enable the service to start on boot
sudo systemctl enable oi-realtime-poller.service
```

### 7.3 Start the Service

```bash
# Start the service now
sudo systemctl start oi-realtime-poller.service

# Check status
sudo systemctl status oi-realtime-poller.service
```

**Expected output:**
```
● oi-realtime-poller.service - VolSpike Realtime Open Interest Poller
   Loaded: loaded (/etc/systemd/system/oi-realtime-poller.service; enabled)
   Active: active (running) since ...
```

**If status shows "failed":**
```bash
# Check what went wrong
sudo journalctl -u oi-realtime-poller.service -n 50

# Common issues:
# - Python path wrong: Check with `which python3`
# - File permissions: Run `chmod +x oi_realtime_poller.py`
# - Missing dependencies: Run `pip3 install requests`
```

---

## Step 8: Monitor the Service

### 8.1 Watch Logs in Real-Time

```bash
# Follow logs (like tail -f)
sudo journalctl -u oi-realtime-poller.service -f
```

**What you should see:**
```
🚀 Starting Realtime OI Poller (Step 9: Full Implementation)
   Backend URL: https://volspike-production.up.railway.app
   Max req/min: 2000
   Interval range: 5-20s
✅ Loaded 150 symbols from liquid universe
📊 Computed polling interval: 8s
✅ Initialized OI history buffers
⏱️  Loop 20 | Interval: 8s | Samples in buffer: 100
✅ Posted OI batch: 150 symbols (150 inserted)
```

**Good signs:**
- ✅ "Loaded X symbols" (X > 0)
- ✅ "Posted OI batch" messages every ~1-2 minutes
- ✅ No error messages
- ✅ Loop counter increasing

**Bad signs:**
- ❌ "Failed to fetch liquid universe"
- ❌ "Unauthorized" errors
- ❌ Connection errors
- ❌ Script crashes/restarts repeatedly

### 8.2 Check Recent Logs

```bash
# View last 100 lines
sudo journalctl -u oi-realtime-poller.service -n 100

# View logs from last hour
sudo journalctl -u oi-realtime-poller.service --since "1 hour ago"
```

---

## Step 9: Verify Backend is Receiving Data

### 9.1 Check Backend Logs (Railway)

1. Go to [Railway Dashboard](https://railway.app)
2. Open your backend service
3. Click "Deployments" → Latest deployment → "View Logs"
4. Search for: `Open Interest`

**You should see every 1-2 minutes:**
```
Open Interest ingestion: 150 inserted, 0 errors
Open Interest ingestion complete: 150 inserted, 0 errors
```

### 9.2 Test Backend Endpoints Directly

**From your local machine or Digital Ocean server:**

```bash
# Test liquid universe endpoint
curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe

# Should return JSON with symbols array

# Test recent OI samples
curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=10

# Should return recent OI samples with source="realtime"

# Test recent OI alerts (may be empty initially)
curl https://volspike-production.up.railway.app/api/open-interest-alerts?limit=10
```

**Expected responses:**
- Liquid universe: `{"symbols": [...], "totalSymbols": 150, ...}`
- OI samples: `{"samples": [...], "count": 10}`
- OI alerts: `{"alerts": [...], "count": 0}` (or more if alerts have fired)

---

## Step 10: Test the Debug UI

### 10.1 Access the Debug Page

1. Open your browser
2. Navigate to: `https://your-frontend-domain.com/debug/open-interest`
   - Replace with your actual frontend URL (e.g., `https://volspike.com/debug/open-interest`)

### 10.2 What You Should See

**Page loads with 4 sections:**

1. **Liquid Universe Card:**
   - Shows total symbols (e.g., "150")
   - Shows enter/exit thresholds
   - Lists symbols (first 50 visible)

2. **Latest OI Values (WebSocket) Card:**
   - Shows real-time OI updates as they come in
   - Updates automatically via WebSocket
   - May be empty initially (wait 1-2 minutes)

3. **Recent OI Samples (Database) Card:**
   - Shows OI data stored in database
   - Should show rows with `source="realtime"`
   - Updates every 30 seconds (auto-refresh)

4. **Recent OI Alerts Card:**
   - Shows OI spike/dump alerts
   - May be empty initially (alerts only fire when thresholds are met)
   - Updates automatically via WebSocket

### 10.3 Verify WebSocket Connection

**Look at the top-right corner:**
- Green dot + "WebSocket: Connected" = ✅ Good
- Red dot + "WebSocket: Disconnected" = ❌ Problem

**If disconnected:**
- Check browser console (F12) for errors
- Verify `NEXT_PUBLIC_SOCKET_IO_URL` is set correctly in frontend
- Check backend WebSocket is running

### 10.4 Check Browser Console

**Open browser console (F12) and look for:**

**Good signs:**
```
✅ WebSocket connected
```

**Bad signs:**
```
❌ WebSocket connection failed
❌ Failed to fetch liquid universe
```

---

## Step 11: Verify Data Flow End-to-End

### 11.1 Complete Data Flow Test

**Timeline:**
1. **T+0:00** - Poller starts, loads liquid universe
2. **T+0:08** - First OI batch posted (every ~10 loops)
3. **T+0:30** - Backend receives data, stores in DB
4. **T+0:30** - WebSocket broadcasts update
5. **T+0:30** - Debug UI shows new data

**How to verify:**

1. **Check Poller Logs:**
   ```bash
   sudo journalctl -u oi-realtime-poller.service -f
   ```
   - Should see "Posted OI batch" every 1-2 minutes

2. **Check Backend Logs (Railway):**
   - Should see "Open Interest ingestion: X inserted"

3. **Check Debug UI:**
   - Refresh page
   - "Recent OI Samples" should show new rows
   - "Latest OI Values" should update via WebSocket

4. **Check Database (Optional):**
   ```sql
   -- Connect to your database
   SELECT COUNT(*) FROM open_interest_snapshots WHERE source = 'realtime';
   -- Should increase over time
   
   SELECT symbol, open_interest, ts 
   FROM open_interest_snapshots 
   WHERE source = 'realtime' 
   ORDER BY ts DESC 
   LIMIT 10;
   -- Should show recent realtime OI data
   ```

---

## Step 12: Troubleshooting Common Issues

### Issue 1: Script Fails to Start

**Symptoms:**
```bash
sudo systemctl status oi-realtime-poller.service
# Shows: failed (code=exited, status=1)
```

**Solutions:**

```bash
# Check logs for error
sudo journalctl -u oi-realtime-poller.service -n 50

# Common fixes:

# 1. Python path wrong
which python3
# Update ExecStart in service file to use correct path

# 2. File permissions
chmod +x /home/trader/volume-spike-bot/oi_realtime_poller.py

# 3. Missing dependencies
pip3 install requests

# 4. Syntax error in script
python3 -m py_compile /home/trader/volume-spike-bot/oi_realtime_poller.py
```

### Issue 2: "Failed to fetch liquid universe"

**Symptoms:**
```
⚠️  Error loading liquid universe: ...
```

**Solutions:**

```bash
# 1. Verify API URL is correct
curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe

# Should return JSON, not error

# 2. Check API key is set
sudo systemctl show oi-realtime-poller --property=Environment | grep VOLSPIKE_API_KEY

# 3. Test manually with correct env vars
export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
export VOLSPIKE_API_KEY="your-key"
python3 oi_realtime_poller.py
```

### Issue 3: "Unauthorized" Errors

**Symptoms:**
```
⚠️  OI batch post failed: 401 - {"error":"Unauthorized"}
```

**Solutions:**

```bash
# 1. Verify API key matches backend
# Check backend env var: ALERT_INGEST_API_KEY
# Must match VOLSPIKE_API_KEY in service file

# 2. Update service file with correct key
sudo nano /etc/systemd/system/oi-realtime-poller.service
# Update Environment="VOLSPIKE_API_KEY=..."

# 3. Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart oi-realtime-poller.service
```

### Issue 4: No OI Data in Debug UI

**Symptoms:**
- Debug UI shows "No OI samples found"
- "Latest OI Values" section is empty

**Solutions:**

```bash
# 1. Check poller is posting data
sudo journalctl -u oi-realtime-poller.service -n 100 | grep "Posted OI batch"

# Should see messages every 1-2 minutes

# 2. Check backend is receiving data
# Railway logs should show "Open Interest ingestion: X inserted"

# 3. Test backend endpoint directly
curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=10

# Should return samples with source="realtime"

# 4. Check database (if you have access)
SELECT COUNT(*) FROM open_interest_snapshots WHERE source = 'realtime';
```

### Issue 5: WebSocket Not Connecting

**Symptoms:**
- Debug UI shows "WebSocket: Disconnected"
- No real-time updates

**Solutions:**

```bash
# 1. Verify backend WebSocket is running
curl https://volspike-production.up.railway.app/health

# Should return: {"status":"ok",...}

# 2. Check frontend environment variable
# NEXT_PUBLIC_SOCKET_IO_URL should match backend URL

# 3. Check browser console for errors
# Open F12 → Console tab
# Look for WebSocket connection errors

# 4. Verify backend Socket.IO is enabled
# Check Railway logs for Socket.IO initialization
```

---

## Step 13: Final Verification Checklist

Run through this checklist to ensure everything is working:

### Backend Verification

- [ ] Backend is deployed and running
- [ ] Database migrations applied (3 new tables exist)
- [ ] Liquid universe job is running (check logs for "Liquid universe job completed")
- [ ] `/api/market/open-interest/liquid-universe` returns symbols
- [ ] `/api/market/open-interest/samples` returns data
- [ ] `/api/open-interest-alerts` endpoint works

### Poller Verification

- [ ] Script uploaded to Digital Ocean
- [ ] Service file created (`/etc/systemd/system/oi-realtime-poller.service`)
- [ ] Environment variables set correctly
- [ ] Service is running (`sudo systemctl status oi-realtime-poller`)
- [ ] Logs show "Loaded X symbols" (X > 0)
- [ ] Logs show "Posted OI batch" messages regularly
- [ ] No errors in logs

### Data Flow Verification

- [ ] Backend logs show "Open Interest ingestion: X inserted"
- [ ] Database has rows with `source='realtime'`
- [ ] Debug UI shows liquid universe
- [ ] Debug UI shows recent OI samples
- [ ] WebSocket connects successfully
- [ ] Real-time OI updates appear in debug UI

### Performance Verification

- [ ] Polling interval is reasonable (5-20 seconds)
- [ ] No rate limit errors from Binance
- [ ] Backend handles load without errors
- [ ] Service restarts automatically if it crashes

---

## Step 14: Monitor for 24 Hours

After deployment, monitor for 24 hours to ensure stability:

### Daily Checks

```bash
# Check service is still running
sudo systemctl status oi-realtime-poller.service

# Check for errors in last 24 hours
sudo journalctl -u oi-realtime-poller.service --since "24 hours ago" | grep -i error

# Check data is being posted
sudo journalctl -u oi-realtime-poller.service --since "24 hours ago" | grep "Posted OI batch" | wc -l
# Should show many successful posts
```

### Backend Monitoring

- Check Railway logs for errors
- Verify database is growing (OI samples accumulating)
- Check liquid universe is updating (symbols changing over time)

---

## Quick Reference Commands

**Service Management:**
```bash
# Start service
sudo systemctl start oi-realtime-poller.service

# Stop service
sudo systemctl stop oi-realtime-poller.service

# Restart service
sudo systemctl restart oi-realtime-poller.service

# Check status
sudo systemctl status oi-realtime-poller.service

# View logs
sudo journalctl -u oi-realtime-poller.service -f
```

**Testing:**
```bash
# Test liquid universe endpoint
curl https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe

# Test OI samples endpoint
curl https://volspike-production.up.railway.app/api/market/open-interest/samples?limit=10

# Test OI alerts endpoint
curl https://volspike-production.up.railway.app/api/open-interest-alerts?limit=10
```

**Debugging:**
```bash
# Check environment variables
sudo systemctl show oi-realtime-poller --property=Environment

# Test script manually
export VOLSPIKE_API_URL="..."
export VOLSPIKE_API_KEY="..."
python3 oi_realtime_poller.py

# Check Python syntax
python3 -m py_compile oi_realtime_poller.py
```

---

## Next Steps

Once everything is verified and working:

1. ✅ **Monitor for 24-48 hours** - Ensure stability
2. ✅ **Check OI alerts** - Verify alerts fire when thresholds are met
3. ✅ **Review performance** - Ensure polling interval is optimal
4. ✅ **Proceed to Steps 11-13** - Production rollout and optimization

---

## Support

If you encounter issues not covered in this guide:

1. Check poller logs: `sudo journalctl -u oi-realtime-poller.service -n 100`
2. Check backend logs: Railway dashboard → Logs
3. Check browser console: F12 → Console tab
4. Verify environment variables are set correctly
5. Test endpoints manually with `curl`

