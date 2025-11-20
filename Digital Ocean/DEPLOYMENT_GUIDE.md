# DigitalOcean Script Deployment Guide

## Overview
This guide helps you deploy the updated `hourly_volume_alert_dual_env.py` script that includes both:
- **Volume Spike Alerts** (dual-env: PROD + DEV)
- **Open Interest Data** (dual-env: PROD + DEV)

## What Changed

### Before (Old Script)
- ✅ Volume alerts to PROD and DEV
- ❌ **NO Open Interest data**

### After (New Script)
- ✅ Volume alerts to PROD and DEV
- ✅ **Open Interest data to PROD and DEV**
- ✅ All in one script

---

## Step 1: Verify Environment Variables

Your DigitalOcean script needs these environment variables:

### Required (Production)
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=48a1a55a8af5cdc6d6e8b31108e3063570dc9564f6fa844e89c7ee5f943ced09
TELEGRAM_TOKEN=your_telegram_bot_token
CHAT_ID=your_telegram_chat_id
```

### Optional (Development)
```bash
VOLSPIKE_API_URL_DEV=https://your-dev-backend.railway.app
VOLSPIKE_API_KEY_DEV=your_dev_api_key
```

If DEV variables are not set, the script will only send to PROD (which is fine).

---

## Step 2: Test Locally (Optional but Recommended)

Before deploying to DigitalOcean, test the script on your local machine:

```bash
# Set environment variables
export VOLSPIKE_API_URL=https://volspike-production.up.railway.app
export VOLSPIKE_API_KEY=48a1a55a8af5cdc6d6e8b31108e3063570dc9564f6fa844e89c7ee5f943ced09

# Optional: Set dev environment
export VOLSPIKE_API_URL_DEV=https://your-dev-backend.railway.app
export VOLSPIKE_API_KEY_DEV=your_dev_api_key

# Install dependencies (if needed)
pip3 install requests

# Run the script
cd "Digital Ocean"
python3 hourly_volume_alert_dual_env.py
```

**Expected output:**
```
Hourly-volume alert (dual-env) running…  (Ctrl-C to stop)
📊 Open Interest tracking enabled (dual-env)
🔧 DEV environment configured - sending to both PROD and DEV
Starting volume scan…
[List of all symbols with volume ratios]
📊 Fetching Open Interest data from Binance...
✅ Posted Open Interest to PROD: 250 symbols
✅ Posted Open Interest to DEV: 250 symbols
📊 Open Interest fetch complete: 250 success, 0 errors
… next check in 300s
```

Press `Ctrl+C` after you see the Open Interest post successfully.

---

## Step 3: Backup Current Script on DigitalOcean

SSH into your DigitalOcean server and backup the current script:

```bash
# SSH into DigitalOcean
ssh root@your-digitalocean-ip

# Navigate to script directory
cd /home/trader/volume-spike-bot  # (adjust path if different)

# Backup current script
cp hourly_volume_alert.py hourly_volume_alert.py.backup.$(date +%Y%m%d_%H%M%S)

# List backups to verify
ls -lah *.backup.*
```

---

## Step 4: Upload New Script to DigitalOcean

### Option A: Copy/Paste via nano
```bash
# On DigitalOcean server
nano hourly_volume_alert.py

# Delete all content (Ctrl+K repeatedly)
# Paste new script content
# Save (Ctrl+O, Enter, Ctrl+X)
```

### Option B: SCP from local machine
```bash
# On your local machine
cd "Digital Ocean"
scp hourly_volume_alert_dual_env.py root@your-digitalocean-ip:/home/trader/volume-spike-bot/hourly_volume_alert.py
```

---

## Step 5: Update Environment Variables (If Needed)

Check if env vars are set in your systemd service file:

```bash
# On DigitalOcean server
sudo nano /etc/systemd/system/volume-alert.service
```

Make sure it includes:
```ini
[Service]
Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
Environment="VOLSPIKE_API_KEY=48a1a55a8af5cdc6d6e8b31108e3063570dc9564f6fa844e89c7ee5f943ced09"
Environment="VOLSPIKE_API_URL_DEV=https://your-dev-backend.railway.app"
Environment="VOLSPIKE_API_KEY_DEV=your_dev_api_key"
Environment="TELEGRAM_TOKEN=your_token"
Environment="CHAT_ID=your_chat_id"
```

If you made changes, reload systemd:
```bash
sudo systemctl daemon-reload
```

---

## Step 6: Restart the Service

```bash
# Stop the service
sudo systemctl stop volume-alert

# Start the service with new script
sudo systemctl start volume-alert

# Check status
sudo systemctl status volume-alert
```

**Expected status:**
```
● volume-alert.service - Hourly Volume Alert
   Active: active (running)
   ...
```

---

## Step 7: Monitor Logs

Watch the logs in real-time to verify everything is working:

```bash
# Follow logs
sudo journalctl -u volume-alert -f

# Or check recent logs
sudo journalctl -u volume-alert -n 100
```

**What to look for:**
```
✅ GOOD - You should see these every 5 minutes:
📊 Fetching Open Interest data from Binance...
✅ Posted Open Interest to PROD: 250 symbols
✅ Posted Open Interest to DEV: 250 symbols  (if dev configured)
📊 Open Interest fetch complete: 250 success, 0 errors

❌ BAD - If you see these, there's a problem:
⚠️  Open Interest: VolSpike PROD API not configured, skipping...
⚠️  Open Interest post to PROD failed 401: {"error":"Unauthorized"}
⚠️  Open Interest post to PROD failed 500: {"error":"Internal server error"}
```

---

## Step 8: Verify Data is Reaching Your Backend

### Check Production Backend Logs (Railway)

1. Go to Railway dashboard
2. Open your production backend service
3. Click "Deployments" → Latest deployment → "View Logs"
4. Search for: `Open Interest`

**You should see every 5 minutes:**
```
✅ [Open Interest Debug] Cached 250 symbols
```

### Check Your Dashboard UI

1. Open your VolSpike dashboard in browser
2. Open browser console (F12)
3. Wait for next 5-minute boundary (XX:00, XX:05, XX:10, etc.)
4. Look for these logs:
```
🔍 [Open Interest Debug] Fetching from: https://volspike-production.up.railway.app/api/market/open-interest
🔍 [Open Interest Debug] Response payload: { dataKeys: 250, ... }
✅ [Open Interest Debug] Updated cache: 250 symbols
```

5. Check the Market Data table - **Open Interest column should show values** like:
   - BTC: $12.70B
   - ETH: $8.50B
   - SOL: $950.00M

---

## Troubleshooting

### Problem: Open Interest still shows $0.00

**Solution 1:** Check if script is POSTing data
```bash
# On DigitalOcean server
sudo journalctl -u volume-alert -n 200 | grep "Open Interest"
```

Look for: `✅ Posted Open Interest to PROD: XXX symbols`

If you don't see this, check environment variables.

**Solution 2:** Check backend is receiving data
```bash
# Test backend endpoint
curl https://volspike-production.up.railway.app/api/market/open-interest
```

Should return JSON with symbol data.

**Solution 3:** Clear frontend cache
```javascript
// In browser console
localStorage.removeItem('vs:openInterest')
location.reload()
```

### Problem: Script is not running

```bash
# Check service status
sudo systemctl status volume-alert

# If failed, check errors
sudo journalctl -u volume-alert -n 50

# Restart service
sudo systemctl restart volume-alert
```

### Problem: Environment variables not set

```bash
# Check current environment
sudo systemctl show volume-alert | grep Environment

# Update service file
sudo nano /etc/systemd/system/volume-alert.service

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart volume-alert
```

---

## Rollback (If Something Goes Wrong)

If the new script causes issues, restore the backup:

```bash
# On DigitalOcean server
sudo systemctl stop volume-alert

# List backups
ls -lah *.backup.*

# Restore backup (use your actual backup filename)
cp hourly_volume_alert.py.backup.20251118_120000 hourly_volume_alert.py

# Restart
sudo systemctl start volume-alert
sudo systemctl status volume-alert
```

---

## Success Checklist

- [ ] Script deployed to DigitalOcean
- [ ] Service restarted successfully
- [ ] Logs show Open Interest being fetched every 5 minutes
- [ ] Logs show successful POST to PROD (and DEV if configured)
- [ ] Backend logs show data being cached
- [ ] Dashboard UI shows Open Interest values (not $0.00)
- [ ] No errors in DigitalOcean logs
- [ ] No errors in Railway backend logs
- [ ] No errors in browser console

---

## Next Steps

Once everything is working:

1. ✅ **Monitor for 24 hours** - Make sure it runs reliably
2. ✅ **Check Open Interest updates** - Should refresh every 5 minutes
3. ✅ **Verify dual-env** - Both PROD and DEV should receive data (if DEV configured)
4. ✅ **Test tier restrictions** - Free users should NOT see OI column

---

## Questions?

If you encounter issues not covered in this guide:
1. Check DigitalOcean logs: `sudo journalctl -u volume-alert -f`
2. Check Railway backend logs
3. Check browser console for frontend errors
4. Review the test script output from earlier

The test script I created (`test-oi-post.js`) can also help verify the backend is working correctly.
