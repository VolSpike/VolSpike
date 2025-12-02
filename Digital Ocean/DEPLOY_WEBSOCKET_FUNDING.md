# Step-by-Step Deployment: Binance WebSocket Funding Service

## Prerequisites
- SSH access to Digital Ocean server
- Python 3.8+ installed
- Existing volume alert and OI poller scripts running

---

## Step 1: SSH into Digital Ocean Server

```bash
ssh trader@your-digital-ocean-ip
# or
ssh root@your-digital-ocean-ip
```

---

## Step 2: Navigate to Scripts Directory

```bash
cd /home/trader/volspike/Digital\ Ocean
# or wherever your scripts are located
pwd  # Verify you're in the right directory
ls -la  # Check existing files
```

---

## Step 3: Install Python Dependencies

```bash
# Check Python version
python3 --version  # Should be 3.8+

# Install required packages
pip3 install websocket-client fastapi uvicorn

# Verify installation
python3 -c "import websocket; import fastapi; import uvicorn; print('✅ All packages installed')"
```

---

## Step 4: Verify Files Are Present

```bash
# Check that all new files exist
ls -la binance_funding_ws_daemon.py
ls -la funding_api_server.py
ls -la binance-funding-ws.service
ls -la binance-funding-api.service

# Check that updated scripts exist
ls -la hourly_volume_alert_dual_env.py
ls -la oi_realtime_poller.py
```

---

## Step 5: Test WebSocket Daemon Manually (First Test)

**Open a new terminal window/tab** (keep SSH session open) or use `screen`/`tmux`:

```bash
# Option A: Use screen (recommended)
screen -S ws-daemon
cd /home/trader/volspike/Digital\ Ocean
python3 binance_funding_ws_daemon.py
```

**Expected output:**
```
======================================================================
Binance Funding Rate WebSocket Daemon
======================================================================
WebSocket URL: wss://fstream.binance.com/stream?streams=!markPrice@arr
...
✅ WebSocket connected to Binance
```

**Wait 10-30 seconds** - you should see messages being received (no errors).

**Check if state file is being created:**
```bash
# In another terminal or exit screen (Ctrl+A, D)
ls -la .funding_state.json
cat .funding_state.json | head -50  # Should show funding data
```

**If working:** Press `Ctrl+C` to stop, then `exit` to leave screen.

**If errors:** Check network connectivity:
```bash
curl -I https://fapi.binance.com
ping fstream.binance.com
```

---

## Step 6: Test HTTP API Server Manually (Second Test)

**Start WebSocket daemon in background:**
```bash
screen -S ws-daemon
cd /home/trader/volspike/Digital\ Ocean
python3 binance_funding_ws_daemon.py
# Press Ctrl+A, then D to detach (keeps running)
```

**Start HTTP API server:**
```bash
screen -S api-server
cd /home/trader/volspike/Digital\ Ocean
python3 funding_api_server.py
```

**Expected output:**
```
======================================================================
Binance Funding Rate HTTP API Server
======================================================================
Host: 127.0.0.1
Port: 8888
...
Starting server on http://127.0.0.1:8888
```

**Test endpoints (in another terminal or new SSH session):**
```bash
# Test health endpoint
curl http://localhost:8888/funding/health

# Test single symbol
curl http://localhost:8888/funding/BTCUSDT

# Test batch
curl "http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT"
```

**Expected responses:**
- Health: `{"status": "healthy", "websocketConnected": true, ...}`
- Single symbol: `{"symbol": "BTCUSDT", "markPrice": ..., "fundingRate": ...}`
- Batch: `{"data": [...], "found": 2, "missing": 0}`

**If working:** Both services are ready. Detach from screens:
```bash
# Detach from api-server screen: Ctrl+A, then D
# Stop ws-daemon screen: screen -r ws-daemon, then Ctrl+C
```

---

## Step 7: Install Systemd Services

```bash
# Copy service files
sudo cp binance-funding-ws.service /etc/systemd/system/
sudo cp binance-funding-api.service /etc/systemd/system/

# Verify files copied correctly
sudo cat /etc/systemd/system/binance-funding-ws.service
sudo cat /etc/systemd/system/binance-funding-api.service

# Reload systemd
sudo systemctl daemon-reload
```

---

## Step 8: Configure Service File Paths (If Needed)

**Check the paths in service files match your setup:**
```bash
# Edit if needed
sudo nano /etc/systemd/system/binance-funding-ws.service
sudo nano /etc/systemd/system/binance-funding-api.service
```

**Verify these paths are correct:**
- `WorkingDirectory=` should point to your scripts directory
- `ExecStart=` should point to correct Python and script paths
- `User=` should be `trader` (or `root` if that's what you use)

**Common paths:**
- WorkingDirectory: `/home/trader/volspike/Digital Ocean` or `/root/volspike/Digital Ocean`
- Python: `/usr/bin/python3` or `/usr/local/bin/python3` (check with `which python3`)

---

## Step 9: Start Services

```bash
# Enable services (start on boot)
sudo systemctl enable binance-funding-ws.service
sudo systemctl enable binance-funding-api.service

# Start services
sudo systemctl start binance-funding-ws.service
sudo systemctl start binance-funding-api.service

# Check status
sudo systemctl status binance-funding-ws.service
sudo systemctl status binance-funding-api.service
```

**Expected status:** `active (running)` in green

---

## Step 10: Verify Services Are Running

```bash
# Check WebSocket daemon logs
sudo journalctl -u binance-funding-ws.service -n 50 --no-pager

# Check HTTP API server logs
sudo journalctl -u binance-funding-api.service -n 50 --no-pager

# Test health endpoint
curl http://localhost:8888/funding/health | python3 -m json.tool

# Test single symbol
curl http://localhost:8888/funding/BTCUSDT | python3 -m json.tool
```

**Expected:**
- WebSocket logs show: `✅ WebSocket connected to Binance`
- HTTP API logs show: `Starting server on http://127.0.0.1:8888`
- Health endpoint returns: `"status": "healthy", "websocketConnected": true`
- Single symbol returns funding data

**If errors:** Check logs:
```bash
sudo journalctl -u binance-funding-ws.service -f  # Follow logs
sudo journalctl -u binance-funding-api.service -f  # Follow logs
```

---

## Step 11: Configure Scripts to Use WebSocket Funding

**Edit your environment file:**
```bash
# Check where your env file is
ls -la ~/.volspike.env
# or
ls -la /home/trader/.volspike.env

# Edit it
nano ~/.volspike.env
# or
nano /home/trader/.volspike.env
```

**Add these lines:**
```bash
# WebSocket Funding Service Configuration
WS_FUNDING_ENABLED=true
WS_FUNDING_API_URL=http://localhost:8888/funding
```

**Save and verify:**
```bash
cat ~/.volspike.env | grep WS_FUNDING
```

---

## Step 12: Test Volume Alert Script Integration

**Check if volume alert script is running:**
```bash
# Check if it's a systemd service
sudo systemctl status volspike-volume-alert.service
# or check processes
ps aux | grep hourly_volume_alert
```

**If running as systemd service:**
```bash
# Restart it to pick up new environment variables
sudo systemctl restart volspike-volume-alert.service

# Check logs
sudo journalctl -u volspike-volume-alert.service -f
```

**If running manually or via cron:**
```bash
# Stop existing process (if any)
pkill -f hourly_volume_alert_dual_env.py

# Start it manually to test
cd /home/trader/volspike/Digital\ Ocean
python3 hourly_volume_alert_dual_env.py
```

**Look for these messages:**
```
🔌 WebSocket funding service: ENABLED (parallel validation mode)
   API URL: http://localhost:8888/funding
```

**Wait for a scan cycle (5 minutes)** and check for:
- Funding data being fetched from both REST and WebSocket
- Comparison logs (matches/mismatches)
- No errors related to WebSocket API

**Expected log output:**
```
Starting volume scan…
✅ Funding match for BTCUSDT: 0.000300
✅ Funding match for ETHUSDT: 0.000100
...
📊 Funding Comparison Summary:
   Total comparisons: 200
   Matches: 198 (99.0%)
   Mismatches: 2
   Avg difference: 0.012%
```

---

## Step 13: Test OI Realtime Poller Integration

**Check if OI poller is running:**
```bash
# Check if it's a systemd service
sudo systemctl status volspike-oi-poller.service
# or check processes
ps aux | grep oi_realtime_poller
```

**If running as systemd service:**
```bash
# Restart it to pick up new environment variables
sudo systemctl restart volspike-oi-poller.service

# Check logs
sudo journalctl -u volspike-oi-poller.service -f
```

**If running manually:**
```bash
# Stop existing process (if any)
pkill -f oi_realtime_poller.py

# Start it manually to test
cd /home/trader/volspike/Digital\ Ocean
python3 oi_realtime_poller.py
```

**Look for these messages:**
```
🔌 WebSocket funding service: ENABLED (parallel validation mode)
   API URL: http://localhost:8888/funding
```

**Wait for a few polling cycles** and check for:
- Mark price data being fetched from both REST and WebSocket
- Comparison logs
- No errors

---

## Step 14: Monitor Parallel Validation

**Monitor all services:**
```bash
# Watch WebSocket daemon
sudo journalctl -u binance-funding-ws.service -f

# Watch HTTP API server
sudo journalctl -u binance-funding-api.service -f

# Watch volume alert script
sudo journalctl -u volspike-volume-alert.service -f
# or if running manually, check its output

# Watch OI poller
sudo journalctl -u volspike-oi-poller.service -f
# or if running manually, check its output
```

**What to look for:**

1. **WebSocket daemon:**
   - ✅ `WebSocket connected to Binance`
   - ✅ Messages being received (no constant reconnections)
   - ❌ Errors or constant reconnections

2. **HTTP API server:**
   - ✅ `Starting server on http://127.0.0.1:8888`
   - ✅ Health endpoint returns `"status": "healthy"`
   - ❌ 503 errors or connection refused

3. **Volume alert script:**
   - ✅ `WebSocket funding service: ENABLED`
   - ✅ Comparison logs showing matches
   - ✅ Funding data in alerts
   - ❌ Errors fetching from WebSocket API

4. **OI poller:**
   - ✅ `WebSocket funding service: ENABLED`
   - ✅ Comparison logs showing matches
   - ✅ Mark price data in OI calculations
   - ❌ Errors fetching from WebSocket API

---

## Step 15: Verify Data Accuracy

**After 1-2 hours of running, check comparison statistics:**

**For volume alert script:**
```bash
# Check logs for comparison summary
sudo journalctl -u volspike-volume-alert.service | grep "Funding Comparison Summary" | tail -5
```

**For OI poller:**
```bash
# Check logs for comparison summary
sudo journalctl -u volspike-oi-poller.service | grep "Mark Price Comparison" | tail -5
```

**Expected:**
- Match rate >99%
- Average difference <0.1%
- Maximum difference <1.0%

---

## Step 16: Generate Validation Report (After 24 Hours)

**Collect logs:**
```bash
# Volume alert logs
sudo journalctl -u volspike-volume-alert.service > /tmp/volume_alert.log

# OI poller logs
sudo journalctl -u volspike-oi-poller.service > /tmp/oi_poller.log
```

**Generate reports:**
```bash
cd /home/trader/volspike/Digital\ Ocean
python3 validate_funding_comparison.py /tmp/volume_alert.log
python3 validate_funding_comparison.py /tmp/oi_poller.log
```

**Review results:**
- If all differences <1.0%: ✅ Safe to switch to WebSocket-only
- If any differences >1.0%: ⚠️ Review and investigate

---

## Troubleshooting

### WebSocket Not Connecting

```bash
# Check network connectivity
curl -I https://fapi.binance.com

# Check firewall
sudo ufw status

# Check WebSocket daemon logs
sudo journalctl -u binance-funding-ws.service -n 100

# Test manually
python3 binance_funding_ws_daemon.py
```

### HTTP API Not Responding

```bash
# Check if service is running
sudo systemctl status binance-funding-api.service

# Check if port is in use
sudo netstat -tlnp | grep 8888

# Check logs
sudo journalctl -u binance-funding-api.service -n 100

# Test manually
python3 funding_api_server.py
```

### Scripts Can't Connect to HTTP API

```bash
# Verify API is accessible
curl http://localhost:8888/funding/health

# Check environment variables
cat ~/.volspike.env | grep WS_FUNDING

# Test from script directory
cd /home/trader/volspike/Digital\ Ocean
python3 -c "import requests; print(requests.get('http://localhost:8888/funding/health').json())"
```

### Data Stale Errors

```bash
# Check WebSocket connection
curl http://localhost:8888/funding/health | python3 -m json.tool

# Check data freshness
curl http://localhost:8888/funding/BTCUSDT | python3 -m json.tool

# Restart WebSocket daemon
sudo systemctl restart binance-funding-ws.service
```

---

## Quick Status Check Commands

```bash
# Check all services status
sudo systemctl status binance-funding-ws.service binance-funding-api.service

# Check health
curl http://localhost:8888/funding/health | python3 -m json.tool

# Check recent logs
sudo journalctl -u binance-funding-ws.service -n 20 --no-pager
sudo journalctl -u binance-funding-api.service -n 20 --no-pager

# Check if state file exists and has data
ls -lh .funding_state.json
head -20 .funding_state.json
```

---

## Next Steps After Validation

Once validation period (24+ hours) passes successfully:

1. **Review validation reports** - Ensure all differences <1.0%
2. **Remove REST API calls** - Edit scripts to remove `premiumIndex` REST calls
3. **Monitor for 7 days** - Ensure no increase in errors
4. **Verify API weight reduction** - Check Binance API usage metrics

See `implementation_steps.md` Phase 6 for details on removing REST calls.

