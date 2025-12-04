# Binance WebSocket Funding Rate Service - Deployment Guide

## Prerequisites

### Python Dependencies
```bash
pip install websocket-client fastapi uvicorn
```

Or create a `requirements.txt`:
```
websocket-client>=1.6.0
fastapi>=0.104.0
uvicorn>=0.24.0
```

### System Requirements
- Python 3.8+
- Systemd (for service management)
- Digital Ocean server with network access to Binance WebSocket

## Deployment Steps

### Step 1: Install Python Dependencies

```bash
cd /home/trader/volspike/Digital\ Ocean
pip3 install websocket-client fastapi uvicorn
```

### Step 2: Test WebSocket Daemon Manually

```bash
# Test WebSocket daemon
python3 binance_funding_ws_daemon.py

# In another terminal, check if it's receiving data
# Wait 10-30 seconds, then check logs
```

Expected output:
```
======================================================================
Binance Funding Rate WebSocket Daemon
======================================================================
WebSocket URL: wss://fstream.binance.com/stream?streams=!markPrice@arr
...
✅ WebSocket connected to Binance
```

### Step 3: Test HTTP API Server Manually

```bash
# In first terminal, start WebSocket daemon
python3 binance_funding_ws_daemon.py

# In second terminal, start HTTP API server
python3 funding_api_server.py

# In third terminal, test endpoints
curl http://localhost:8888/funding/BTCUSDT
curl http://localhost:8888/funding/health
curl "http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT"
```

Expected responses:
- `GET /funding/BTCUSDT`: Returns funding data
- `GET /funding/health`: Returns health status
- `GET /funding/batch`: Returns batch data

### Step 4: Install Systemd Services

```bash
# Copy service files
sudo cp binance-funding-ws.service /etc/systemd/system/
sudo cp binance-funding-api.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable binance-funding-ws.service
sudo systemctl enable binance-funding-api.service

# Start services
sudo systemctl start binance-funding-ws.service
sudo systemctl start binance-funding-api.service
```

### Step 5: Verify Services Running

```bash
# Check status
sudo systemctl status binance-funding-ws.service
sudo systemctl status binance-funding-api.service

# Check logs
sudo journalctl -u binance-funding-ws.service -f
sudo journalctl -u binance-funding-api.service -f

# Test endpoints
curl http://localhost:8888/funding/health
```

Expected status:
- Both services should show `active (running)`
- Health endpoint should return `"status": "healthy"`

### Step 6: Configure Volume Alert Script

Add environment variable to enable WebSocket funding (optional, defaults to enabled):
```bash
# In .volspike.env or systemd service
export WS_FUNDING_ENABLED=true
export WS_FUNDING_API_URL=http://localhost:8888/funding
```

### Step 7: Configure OI Realtime Poller

Add environment variables to enable WebSocket funding (optional, defaults to enabled):
```bash
# In .volspike.env
export WS_FUNDING_ENABLED=true
export WS_FUNDING_API_URL=http://localhost:8888/funding
```

### Step 8: Restart Scripts

```bash
# Restart volume alert script (if running as service)
sudo systemctl restart volspike-volume-alert.service

# Restart OI poller script (if running as service)
sudo systemctl restart volspike-oi-poller.service
```

## Monitoring

### Check Service Status

```bash
# Check WebSocket daemon
sudo systemctl status binance-funding-ws.service

# Check HTTP API server
sudo systemctl status binance-funding-api.service
```

### View Logs

```bash
# WebSocket daemon logs
sudo journalctl -u binance-funding-ws.service -f

# HTTP API server logs
sudo journalctl -u binance-funding-api.service -f

# Last 100 lines
sudo journalctl -u binance-funding-ws.service -n 100
sudo journalctl -u binance-funding-api.service -n 100
```

### Health Check

```bash
# Check health endpoint
curl http://localhost:8888/funding/health | jq

# Expected response:
# {
#   "status": "healthy",
#   "websocketConnected": true,
#   "symbolCount": 245,
#   "uptimeSeconds": 86400.5,
#   ...
# }
```

### Test Data Fetching

```bash
# Test single symbol
curl http://localhost:8888/funding/BTCUSDT | jq

# Test batch
curl "http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT,SOLUSDT" | jq
```

## Troubleshooting

### WebSocket Not Connecting

**Symptoms:**
- Service shows "disconnected"
- Health endpoint returns `"websocketConnected": false`

**Solutions:**
1. Check network connectivity:
   ```bash
   curl -I https://fapi.binance.com
   ```

2. Check firewall rules:
   ```bash
   sudo ufw status
   ```

3. Check logs:
   ```bash
   sudo journalctl -u binance-funding-ws.service -n 50
   ```

4. Test WebSocket manually:
   ```bash
   python3 binance_funding_ws_daemon.py
   ```

### HTTP API Not Responding

**Symptoms:**
- `curl http://localhost:8888/funding/health` fails
- Service shows errors in logs

**Solutions:**
1. Check if service is running:
   ```bash
   sudo systemctl status binance-funding-api.service
   ```

2. Check if port is in use:
   ```bash
   sudo netstat -tlnp | grep 8888
   ```

3. Check logs:
   ```bash
   sudo journalctl -u binance-funding-api.service -n 50
   ```

4. Test manually:
   ```bash
   python3 funding_api_server.py
   ```

### Data Stale Errors

**Symptoms:**
- Health endpoint shows `"status": "unhealthy"`
- API returns 503 for symbol requests

**Solutions:**
1. Check WebSocket connection:
   ```bash
   curl http://localhost:8888/funding/health | jq .websocketConnected
   ```

2. Check data freshness:
   ```bash
   curl http://localhost:8888/funding/health | jq .oldestDataAgeSeconds
   ```

3. Restart WebSocket daemon:
   ```bash
   sudo systemctl restart binance-funding-ws.service
   ```

### High Memory Usage

**Symptoms:**
- Service using >100MB memory
- System running slow

**Solutions:**
1. Check memory usage:
   ```bash
   ps aux | grep binance_funding_ws_daemon
   ```

2. Check symbol count:
   ```bash
   curl http://localhost:8888/funding/health | jq .symbolCount
   ```

3. Restart service daily (add to crontab):
   ```bash
   # Add to crontab: 0 2 * * * systemctl restart binance-funding-ws.service
   ```

## Rollback

If issues arise, you can disable WebSocket funding:

### Option 1: Disable via Environment Variable

```bash
# In .volspike.env
export WS_FUNDING_ENABLED=false
```

Then restart scripts:
```bash
sudo systemctl restart volspike-volume-alert.service
sudo systemctl restart volspike-oi-poller.service
```

### Option 2: Stop Services

```bash
# Stop WebSocket services
sudo systemctl stop binance-funding-ws.service
sudo systemctl stop binance-funding-api.service

# Disable auto-start
sudo systemctl disable binance-funding-ws.service
sudo systemctl disable binance-funding-api.service
```

Scripts will automatically fall back to REST API when WebSocket service is unavailable.

## Validation Period

After deployment, run scripts in parallel validation mode for 24+ hours:

1. **Monitor logs** for comparison statistics
2. **Check for mismatches** (>0.1% difference)
3. **Generate validation report**:
   ```bash
   # Collect logs
   sudo journalctl -u volspike-volume-alert.service > volume_alert.log
   sudo journalctl -u volspike-oi-poller.service > oi_poller.log
   
   # Generate report
   python3 validate_funding_comparison.py volume_alert.log
   python3 validate_funding_comparison.py oi_poller.log
   ```

4. **Review results** and decide when to switch to WebSocket-only mode

## Production Migration

Once validation period passes successfully:

1. **Remove REST API calls** from scripts (see implementation_steps.md Phase 6)
2. **Monitor for 7+ days** to ensure stability
3. **Verify API weight reduction** (~80 calls/min eliminated)
4. **Mark feature as complete**

