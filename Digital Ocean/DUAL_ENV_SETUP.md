# Dual Environment Setup Guide - Digital Ocean Script

This guide shows you how to configure the Digital Ocean script to send alerts to both **PRODUCTION** and **DEV** environments **without stopping or restarting** the running script.

## Overview

The script reads environment variables on each execution cycle (every 5 minutes). By updating the systemd service file and reloading systemd, the new environment variables will be picked up automatically on the next cycle without interrupting the current run.

## Prerequisites

- SSH access to your Digital Ocean server
- Sudo/root privileges
- Your DEV environment API URL and API key ready
- Current production script is running (`volume-alert` service)

## Step-by-Step Instructions

### Step 1: SSH into Digital Ocean Server

```bash
ssh root@YOUR_DIGITAL_OCEAN_IP
# or
ssh trader@YOUR_DIGITAL_OCEAN_IP
```

### Step 2: Navigate to Script Directory

```bash
cd /home/trader/volume-spike-bot
# or wherever your script is located
```

### Step 3: Backup Current Script (Safety First)

```bash
# Create a timestamped backup
cp hourly_volume_alert.py hourly_volume_alert.py.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup was created
ls -la hourly_volume_alert.py.backup.*
```

### Step 4: Check Current Systemd Service Configuration

```bash
# View the current service file
sudo systemctl cat volume-alert

# Or check the service file location
sudo systemctl status volume-alert | grep "Loaded:"
```

**Expected output will show something like:**
```
Loaded: loaded (/etc/systemd/system/volume-alert.service; enabled; vendor preset: enabled)
```

### Step 5: View Current Environment Variables

```bash
# Check what environment variables are currently set
sudo systemctl show volume-alert --property=Environment

# Or view the full service file
sudo cat /etc/systemd/system/volume-alert.service
```

**You should see something like:**
```ini
[Service]
Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
Environment="VOLSPIKE_API_KEY=your-production-api-key"
Environment="TELEGRAM_TOKEN=your-telegram-token"
Environment="CHAT_ID=your-chat-id"
```

### Step 6: Copy New Dual-Environment Script

**Option A: If you have the new script file locally, upload it:**

From your local machine:
```bash
# From your local VolSpike directory
scp Digital\ Ocean/hourly_volume_alert_dual_env.py root@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py
```

**Option B: Create it directly on the server:**

```bash
# On the Digital Ocean server
cd /home/trader/volume-spike-bot
nano hourly_volume_alert_dual_env.py
```

Then paste the contents of `hourly_volume_alert_dual_env.py` (from the repository).

### Step 7: Verify Script Permissions

```bash
# Make sure the script is executable
chmod +x hourly_volume_alert_dual_env.py

# Verify it's readable
ls -la hourly_volume_alert_dual_env.py
```

### Step 8: Test the Script Manually (Optional but Recommended)

```bash
# Set environment variables temporarily for testing
export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
export VOLSPIKE_API_KEY="your-production-key"
export VOLSPIKE_API_URL_DEV="https://volspike-dev.up.railway.app"
export VOLSPIKE_API_KEY_DEV="your-dev-key"
export TELEGRAM_TOKEN="your-telegram-token"
export CHAT_ID="your-chat-id"

# Run the script manually (will run one cycle)
python3 hourly_volume_alert_dual_env.py

# Press Ctrl+C after you see it working (after 1-2 cycles)
```

**Look for output like:**
```
✅ Posted to VolSpike PROD: BTC 🟢
✅ Posted to VolSpike DEV: BTC 🟢
```

### Step 9: Update Systemd Service File

```bash
# Edit the service file
sudo nano /etc/systemd/system/volume-alert.service
```

**Add the DEV environment variables to the `[Service]` section:**

```ini
[Unit]
Description=VolSpike Volume Alert Monitor
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 hourly_volume_alert_dual_env.py
Restart=always
RestartSec=10

# Production Environment
Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
Environment="VOLSPIKE_API_KEY=your-production-api-key"

# Development Environment (NEW)
Environment="VOLSPIKE_API_URL_DEV=https://volspike-dev.up.railway.app"
Environment="VOLSPIKE_API_KEY_DEV=your-dev-api-key"

# Telegram (if you use it)
Environment="TELEGRAM_TOKEN=your-telegram-token"
Environment="CHAT_ID=your-chat-id"

[Install]
WantedBy=multi-user.target
```

**Important changes:**
1. Update `ExecStart` to point to `hourly_volume_alert_dual_env.py`
2. Add `VOLSPIKE_API_URL_DEV` and `VOLSPIKE_API_KEY_DEV` environment variables
3. Keep all existing production variables

### Step 10: Reload Systemd Configuration (NOT Restart)

```bash
# Reload systemd to pick up the new service file configuration
sudo systemctl daemon-reload

# Verify the new configuration is loaded
sudo systemctl show volume-alert --property=Environment
```

**You should now see both PROD and DEV variables:**
```
Environment=VOLSPIKE_API_URL=https://volspike-production.up.railway.app VOLSPIKE_API_KEY=prod-key VOLSPIKE_API_URL_DEV=https://volspike-dev.up.railway.app VOLSPIKE_API_KEY_DEV=dev-key ...
```

### Step 11: Verify Service Status (Still Running)

```bash
# Check that the service is still running
sudo systemctl status volume-alert

# You should see:
# Active: active (running) since ...
```

**The service should still be running** - we haven't restarted it yet!

### Step 12: Wait for Next Execution Cycle (5 minutes max)

The script runs every 5 minutes. The **next time it executes**, it will:
1. Read the new environment variables from systemd
2. Send alerts to both PROD and DEV environments
3. Continue running normally

**To monitor when it picks up the new config:**

```bash
# Watch the logs in real-time
sudo journalctl -u volume-alert -f
```

**Look for output like:**
```
✅ Posted to VolSpike PROD: BTC 🟢
✅ Posted to VolSpike DEV: BTC 🟢
```

### Step 13: Verify Both Environments Receive Data

**Check Production Backend:**
- Log into your production Railway dashboard
- Check logs for incoming POST requests to `/api/volume-alerts/ingest`
- Verify alerts appear in production database

**Check Development Backend:**
- Log into your development Railway dashboard  
- Check logs for incoming POST requests to `/api/volume-alerts/ingest`
- Verify alerts appear in development database

### Step 14: (Optional) Restart Service Only If Needed

**You should NOT need to restart**, but if you want to force immediate pickup:

```bash
# Only do this if you want immediate effect (not necessary)
sudo systemctl restart volume-alert

# Verify it restarted successfully
sudo systemctl status volume-alert
```

**However, restarting is NOT required** - the script will pick up new env vars on its next cycle automatically.

## Troubleshooting

### Issue: Script still only sends to PROD

**Check 1: Verify environment variables are set**
```bash
sudo systemctl show volume-alert --property=Environment | grep DEV
```

**Check 2: Verify script is using the new file**
```bash
sudo systemctl cat volume-alert | grep ExecStart
# Should show: hourly_volume_alert_dual_env.py
```

**Check 3: Check logs for errors**
```bash
sudo journalctl -u volume-alert -n 50 --no-pager
```

### Issue: Script crashes after update

**Restore from backup:**
```bash
# Restore the old script
cp hourly_volume_alert.py.backup.YYYYMMDD_HHMMSS hourly_volume_alert.py

# Revert systemd service file
sudo nano /etc/systemd/system/volume-alert.service
# Change ExecStart back to: hourly_volume_alert.py
# Remove DEV environment variables

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart volume-alert
```

### Issue: DEV environment not receiving data

**Check DEV API key and URL:**
```bash
# Verify env vars are correct
sudo systemctl show volume-alert --property=Environment

# Test DEV endpoint manually
curl -X POST https://volspike-dev.up.railway.app/api/volume-alerts/ingest \
  -H "X-API-Key: your-dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TEST","asset":"TEST","currentVolume":1000000,"previousVolume":300000,"volumeRatio":3.33,"message":"Test"}'
```

## Verification Checklist

- [ ] Backup created
- [ ] New script file uploaded/created
- [ ] Script permissions set (executable)
- [ ] Systemd service file updated with DEV variables
- [ ] Systemd daemon reloaded
- [ ] Service still running (not restarted)
- [ ] Logs show dual posting (PROD + DEV)
- [ ] Production backend receiving alerts
- [ ] Development backend receiving alerts

## Summary

**What we did:**
1. ✅ Created a new script that sends to both environments
2. ✅ Updated systemd service file with DEV environment variables
3. ✅ Reloaded systemd (not restarted service)
4. ✅ Script automatically picks up new config on next cycle

**What we did NOT do:**
- ❌ Did NOT stop the service
- ❌ Did NOT restart the service (optional)
- ❌ Did NOT interrupt current execution

**Result:**
- ✅ Zero downtime
- ✅ Seamless transition
- ✅ Alerts sent to both PROD and DEV
- ✅ Production continues uninterrupted

## Notes

- The script reads environment variables **on each execution cycle** (every 5 minutes)
- Systemd `daemon-reload` updates the configuration without stopping services
- The running Python process will continue with old env vars until next cycle
- This is safe because the script doesn't cache environment variables
- If DEV variables are not set, the script will only send to PROD (backward compatible)

