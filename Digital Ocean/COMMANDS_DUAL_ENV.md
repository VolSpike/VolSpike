# Exact Commands for Dual Environment Setup

Copy and paste these commands in order. Replace placeholders with your actual values.

## Step 1: SSH into Digital Ocean Server

```bash
ssh root@YOUR_DIGITAL_OCEAN_IP
# OR if you use a different user:
ssh trader@YOUR_DIGITAL_OCEAN_IP
```

## Step 2: Find the Script Name and Location

```bash
# Check what systemd service is running
sudo systemctl status volume-alert

# This will show you the service file location and the script it's running
# Look for lines like:
# Loaded: /etc/systemd/system/volume-alert.service
# Main PID: xxxx (python3)
```

```bash
# View the actual service file to see the script name
sudo systemctl cat volume-alert

# Look for the ExecStart line, it will show something like:
# ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/hourly_volume_alert.py
```

```bash
# Find all Python scripts in common locations
find /home -name "*volume*.py" -type f 2>/dev/null
find /root -name "*volume*.py" -type f 2>/dev/null
find /opt -name "*volume*.py" -type f 2>/dev/null

# Or check the working directory from systemd
sudo systemctl show volume-alert --property=WorkingDirectory
```

## Step 3: Navigate to Script Directory

```bash
# Based on what you found above, navigate there (example):
cd /home/trader/volume-spike-bot

# OR if it's in a different location:
cd /path/to/your/script/directory
```

## Step 4: List Current Scripts to Confirm

```bash
# See what scripts are in the current directory
ls -la *.py

# You should see something like:
# hourly_volume_alert.py
# OR
# volume_alert.py
# OR similar
```

## Step 5: Backup Current Script

```bash
# Create a timestamped backup (replace SCRIPT_NAME with actual name from Step 4)
cp hourly_volume_alert.py hourly_volume_alert.py.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup was created
ls -la hourly_volume_alert.py.backup.*

# You should see a file like: hourly_volume_alert.py.backup.20241215_143022
```

**If your script has a different name, use that name:**
```bash
# Example if script is called volume_alert.py:
cp volume_alert.py volume_alert.py.backup.$(date +%Y%m%d_%H%M%S)
```

## Step 6: Check Current Environment Variables

```bash
# See what environment variables are currently set
sudo systemctl show volume-alert --property=Environment

# This will show something like:
# Environment=VOLSPIKE_API_URL=https://volspike-production.up.railway.app VOLSPIKE_API_KEY=your-key ...
```

## Step 7: View Full Service File

```bash
# See the complete service configuration
sudo cat /etc/systemd/system/volume-alert.service

# OR
sudo systemctl cat volume-alert
```

## Step 8: Upload New Script from Your Local Machine

**From your LOCAL machine (not the server), run:**

```bash
# Navigate to your VolSpike project directory
cd /Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday\ Life/AI/VolumeFunding/VolSpike

# Upload the new script (replace IP and path with your actual values)
scp Digital\ Ocean/hourly_volume_alert_dual_env.py root@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py

# OR if you use a different user:
scp Digital\ Ocean/hourly_volume_alert_dual_env.py trader@YOUR_DIGITAL_OCEAN_IP:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py
```

**OR create it directly on the server:**

```bash
# On the Digital Ocean server, create the file
cd /home/trader/volume-spike-bot
nano hourly_volume_alert_dual_env.py

# Then paste the entire contents of the dual_env script
# Press Ctrl+O to save, Enter to confirm, Ctrl+X to exit
```

## Step 9: Set Script Permissions

```bash
# Make sure the script is executable
chmod +x hourly_volume_alert_dual_env.py

# Verify permissions
ls -la hourly_volume_alert_dual_env.py

# Should show: -rwxr-xr-x (executable)
```

## Step 10: Get Your DEV Environment URLs and Keys

**You need these values:**
- `VOLSPIKE_API_URL_DEV` - Your dev backend URL (e.g., `https://volspike-dev.up.railway.app`)
- `VOLSPIKE_API_KEY_DEV` - Your dev API key

**Get them from:**
- Railway dashboard → Your dev project → Variables tab
- Or your dev backend `.env` file → `ALERT_INGEST_API_KEY`

## Step 11: Edit Systemd Service File

```bash
# Open the service file for editing
sudo nano /etc/systemd/system/volume-alert.service
```

**In the editor, find the `[Service]` section and:**

1. **Change the ExecStart line** to point to the new script:
   ```ini
   ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py
   ```
   (Adjust path if your script is in a different location)

2. **Add DEV environment variables** after the existing VOLSPIKE variables:
   ```ini
   Environment="VOLSPIKE_API_URL_DEV=https://your-dev-backend-url.up.railway.app"
   Environment="VOLSPIKE_API_KEY_DEV=your-dev-api-key-here"
   ```

**Example of what the [Service] section should look like:**
```ini
[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py
Restart=always
RestartSec=10
Environment="VOLSPIKE_API_URL=https://volspike-production.up.railway.app"
Environment="VOLSPIKE_API_KEY=your-production-api-key"
Environment="VOLSPIKE_API_URL_DEV=https://volspike-dev.up.railway.app"
Environment="VOLSPIKE_API_KEY_DEV=your-dev-api-key"
Environment="TELEGRAM_TOKEN=your-telegram-token"
Environment="CHAT_ID=your-chat-id"
```

**Save and exit:**
- Press `Ctrl+O` (save)
- Press `Enter` (confirm filename)
- Press `Ctrl+X` (exit)

## Step 12: Reload Systemd (NOT Restart)

```bash
# Reload systemd to pick up the new configuration
sudo systemctl daemon-reload

# Verify the new environment variables are loaded
sudo systemctl show volume-alert --property=Environment

# You should now see both PROD and DEV variables listed
```

## Step 13: Verify Service is Still Running

```bash
# Check service status (should still be running)
sudo systemctl status volume-alert

# Look for: Active: active (running)
```

## Step 14: Monitor Logs to See Dual Posting

```bash
# Watch logs in real-time (will show next execution)
sudo journalctl -u volume-alert -f

# Wait for the next 5-minute cycle (max 5 minutes)
# Look for output like:
# ✅ Posted to VolSpike PROD: BTC 🟢
# ✅ Posted to VolSpike DEV: BTC 🟢
```

**To exit the log viewer:** Press `Ctrl+C`

## Step 15: Verify Both Environments Receive Data

**Check Production Backend Logs:**
- Go to Railway dashboard → Production project → Deployments → Logs
- Look for POST requests to `/api/volume-alerts/ingest`

**Check Development Backend Logs:**
- Go to Railway dashboard → Development project → Deployments → Logs
- Look for POST requests to `/api/volume-alerts/ingest`

## Troubleshooting Commands

### If script name is different than expected:

```bash
# Find all Python scripts
find /home -name "*.py" -type f 2>/dev/null | grep -i volume

# Check what process is actually running
ps aux | grep python | grep volume

# Check systemd service details
sudo systemctl status volume-alert -l
```

### If you need to check the current script location:

```bash
# Get the full command being executed
sudo systemctl show volume-alert --property=ExecStart

# Get the working directory
sudo systemctl show volume-alert --property=WorkingDirectory
```

### If you need to restore from backup:

```bash
# List all backups
ls -la *.backup.*

# Restore (replace with actual backup filename)
cp hourly_volume_alert.py.backup.20241215_143022 hourly_volume_alert.py

# Revert service file
sudo nano /etc/systemd/system/volume-alert.service
# Change ExecStart back to original script name
# Remove DEV environment variables

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart volume-alert
```

### Test DEV endpoint manually:

```bash
# Replace with your actual DEV values
curl -X POST https://your-dev-backend.up.railway.app/api/volume-alerts/ingest \
  -H "X-API-Key: your-dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TESTUSDT",
    "asset": "TEST",
    "currentVolume": 10000000,
    "previousVolume": 3000000,
    "volumeRatio": 3.33,
    "price": 50000,
    "fundingRate": 0.0001,
    "candleDirection": "bullish",
    "message": "Test alert",
    "timestamp": "2024-12-15T14:30:00Z",
    "hourTimestamp": "2024-12-15T14:00:00Z",
    "isUpdate": false,
    "alertType": "SPIKE"
  }'
```

## Quick Reference: All Commands in Order

```bash
# 1. SSH
ssh root@YOUR_IP

# 2. Find script
sudo systemctl cat volume-alert | grep ExecStart
sudo systemctl show volume-alert --property=WorkingDirectory

# 3. Navigate
cd /home/trader/volume-spike-bot  # or path from step 2

# 4. List scripts
ls -la *.py

# 5. Backup (replace SCRIPT_NAME with actual name)
cp SCRIPT_NAME.py SCRIPT_NAME.py.backup.$(date +%Y%m%d_%H%M%S)

# 6. Upload new script (from local machine)
scp Digital\ Ocean/hourly_volume_alert_dual_env.py root@YOUR_IP:/home/trader/volume-spike-bot/

# 7. Set permissions
chmod +x hourly_volume_alert_dual_env.py

# 8. Edit service file
sudo nano /etc/systemd/system/volume-alert.service
# Add DEV env vars, update ExecStart

# 9. Reload systemd
sudo systemctl daemon-reload

# 10. Verify
sudo systemctl show volume-alert --property=Environment
sudo systemctl status volume-alert

# 11. Monitor logs
sudo journalctl -u volume-alert -f
```

## Important Notes

- Replace `YOUR_DIGITAL_OCEAN_IP` with your actual server IP
- Replace `SCRIPT_NAME` with the actual script name you find
- Replace `your-dev-backend-url` and `your-dev-api-key` with actual values
- The script will pick up new env vars on the next 5-minute cycle automatically
- No restart needed (but you can restart if you want immediate effect)

