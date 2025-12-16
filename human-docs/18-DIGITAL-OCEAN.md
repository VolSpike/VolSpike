# Digital Ocean Python Scripts

## Overview

VolSpike runs Python scripts on a Digital Ocean droplet to:
1. **Detect volume spikes** using Binance REST API
2. **Poll Open Interest data**
3. **Monitor funding rates** via WebSocket
4. **Check user alerts**

**CRITICAL**: This is the ONLY place that calls Binance REST API.

---

## Server Details

| Property | Value |
|----------|-------|
| Host | `volspike-do` (SSH alias) |
| IP | 167.71.196.5 |
| User | root |
| SSH Key | ~/.ssh/volspike-temp |

**Connect:**
```bash
ssh volspike-do
```

---

## Directory Structure

```
/home/trader/volume-spike-bot/
├── hourly_volume_alert_dual_env.py   # Volume spike detection
├── oi_realtime_poller.py             # OI polling
├── oi_liquid_universe_job.py         # Liquid symbol classification
├── binance_funding_ws_daemon.py      # Funding rate WebSocket
├── funding_api_server.py             # Funding rate API
├── user_alert_checker.py             # User alert checker
├── telegram_channel_poller.py        # Telegram monitoring
└── .venv/                            # Python virtual environment

/home/trader/.volspike.env            # Environment variables
```

---

## Core Scripts

### Volume Alert Script

**File:** `hourly_volume_alert_dual_env.py`

**Purpose:** Detects volume spikes by comparing current hour volume to previous hour.

**Detection Logic:**
```python
def detect_volume_spike(symbol_data):
    current_volume = get_current_hour_volume(symbol_data)
    previous_volume = get_previous_hour_volume(symbol_data)

    ratio = current_volume / previous_volume if previous_volume > 0 else 0

    if ratio >= 3.0:  # 3x threshold
        return {
            'symbol': symbol_data['symbol'],
            'currentVolume': current_volume,
            'previousVolume': previous_volume,
            'volumeRatio': ratio,
            'candleDirection': determine_direction(symbol_data)
        }
    return None
```

**Scheduling:** Runs every 5 minutes

**API Calls:**
- `GET /fapi/v1/ticker/24hr` - Get 24h volume
- `GET /fapi/v1/klines` - Get candlestick data

**Output:** POSTs alerts to backend `/api/volume-alerts/ingest`

---

### OI Realtime Poller

**File:** `oi_realtime_poller.py`

**Purpose:** Polls Open Interest data for all symbols every 30 seconds.

**Process:**
1. Fetch OI from Binance REST API
2. Convert to USD value
3. POST to backend `/api/market/open-interest`
4. Detect significant changes (alerts)

**API Calls:**
- `GET /fapi/v1/openInterest` - Single symbol OI
- `GET /fapi/v1/ticker/price` - Current prices

**Alert Thresholds:**
- 5 minutes: >3% change
- 15 minutes: >5% change
- 1 hour: >10% change

---

### Liquid Universe Job

**File:** `oi_liquid_universe_job.py`

**Purpose:** Classifies symbols as "liquid" based on volume criteria.

**Criteria:**
- 24h volume > $100M
- Active trading pair
- USDT perpetual

**Scheduling:** Runs every 5 minutes

**Output:** POSTs to `/api/market/open-interest/liquid-universe/update`

---

### Funding Rate WebSocket Daemon

**File:** `binance_funding_ws_daemon.py`

**Purpose:** Maintains WebSocket connection to stream funding rates.

**Features:**
- Connects to Binance WebSocket
- Streams `!markPrice@arr` for all symbols
- Caches latest funding rates in memory
- Reconnects automatically on disconnect

**WebSocket URL:**
```
wss://fstream.binance.com/stream?streams=!markPrice@arr
```

---

### Funding API Server

**File:** `funding_api_server.py`

**Purpose:** Serves cached funding rates via HTTP API.

**Endpoints:**
- `GET /funding` - All funding rates
- `GET /funding/{symbol}` - Single symbol
- `GET /health` - Health check

**Port:** 8080

---

### User Alert Checker

**File:** `user_alert_checker.py`

**Purpose:** Checks user-defined custom alerts.

**Process:**
1. Fetch active user alerts from backend
2. Check current market data against thresholds
3. Trigger alerts when conditions met
4. POST triggered alerts to backend

**Alert Types:**
- Price cross threshold
- Funding rate cross threshold
- OI cross threshold

---

### Telegram Channel Poller

**File:** `telegram_channel_poller.py`

**Purpose:** Monitors Telegram channels for market news.

**Process:**
1. Poll configured Telegram channels
2. Extract messages and media
3. POST to backend `/api/telegram/ingest`

---

## Systemd Services

### Service Files

Located in `/etc/systemd/system/`:

```
volspike.service             # Main volume alert service
volspike-dashboard.service   # Streamlit dashboard
binance-funding-ws.service   # Funding WebSocket daemon
binance-funding-api.service  # Funding API server
telegram-channel-poller.service
user-alert-checker.service
funding-health-check.service
```

### Service Template

```ini
[Unit]
Description=VolSpike Volume Alert Service
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python hourly_volume_alert_dual_env.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Managing Services

```bash
# Check status
ssh volspike-do "sudo systemctl status volspike.service"

# View logs
ssh volspike-do "sudo journalctl -u volspike.service -n 50 --no-pager"

# Follow logs
ssh volspike-do "sudo journalctl -u volspike.service -f"

# Restart service
ssh volspike-do "sudo systemctl restart volspike.service"

# Stop service
ssh volspike-do "sudo systemctl stop volspike.service"

# Start service
ssh volspike-do "sudo systemctl start volspike.service"

# Enable on boot
ssh volspike-do "sudo systemctl enable volspike.service"
```

---

## Environment Variables

Located at `/home/trader/.volspike.env`:

```bash
# Backend URL
BACKEND_URL=https://volspike-production.up.railway.app

# API Key for authentication
ALERT_INGEST_API_KEY=your-secret-key

# Optional: Telegram bot token
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHANNEL_IDS=channel1,channel2
```

---

## Deployment Workflow

**CRITICAL:** Digital Ocean scripts are deployed via SCP, not git.

### Step 1: Copy Script

```bash
scp "Digital Ocean/hourly_volume_alert_dual_env.py" \
    volspike-do:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py
```

### Step 2: Restart Service

```bash
ssh volspike-do "sudo systemctl restart volspike.service"
```

### Step 3: Verify

```bash
# Check service status
ssh volspike-do "sudo systemctl status volspike.service"

# Check logs
ssh volspike-do "sudo journalctl -u volspike.service -n 20 --no-pager"
```

### Common Mistakes

**WRONG:**
```bash
# DO NOT USE GIT ON DIGITAL OCEAN
ssh volspike-do "cd /home/trader/VolSpike && git pull"
```

**WRONG:**
```bash
# WRONG SERVICE NAME
ssh volspike-do "sudo systemctl restart hourly-volume-alert-dual-env.service"
```

**CORRECT:**
```bash
# Use SCP and correct service name
scp "Digital Ocean/script.py" volspike-do:/home/trader/volume-spike-bot/script.py
ssh volspike-do "sudo systemctl restart volspike.service"
```

---

## API Authentication

Scripts authenticate with backend using API key:

```python
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': os.environ['ALERT_INGEST_API_KEY']
}

response = requests.post(
    f"{BACKEND_URL}/api/volume-alerts/ingest",
    json=alert_data,
    headers=headers
)
```

---

## Binance API Usage

### REST API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /fapi/v1/ticker/24hr` | 24h volume |
| `GET /fapi/v1/klines` | Candlestick data |
| `GET /fapi/v1/openInterest` | Open Interest |
| `GET /fapi/v1/ticker/price` | Current prices |
| `GET /fapi/v1/premiumIndex` | Funding rates |
| `GET /fapi/v1/exchangeInfo` | Symbol info |

### WebSocket Streams

| Stream | Purpose |
|--------|---------|
| `!markPrice@arr` | All mark prices + funding |
| `!ticker@arr` | All 24h tickers |

### Rate Limits

- REST: 2400 request weight/minute
- WebSocket: 5 messages/second
- Connection: 1 connection per IP

---

## Monitoring & Debugging

### Check All Services

```bash
ssh volspike-do "sudo systemctl list-units --type=service | grep -E 'volspike|binance|funding'"
```

### View Combined Logs

```bash
ssh volspike-do "sudo journalctl -u volspike.service -u binance-funding-ws.service -n 50 --no-pager"
```

### Check Process

```bash
ssh volspike-do "ps aux | grep python"
```

### Check Memory Usage

```bash
ssh volspike-do "free -h"
```

### Check Disk Space

```bash
ssh volspike-do "df -h"
```

---

## Troubleshooting

### "Service won't start"

1. Check service file syntax:
   ```bash
   ssh volspike-do "sudo systemctl daemon-reload"
   ```

2. Check Python path:
   ```bash
   ssh volspike-do "ls -la /home/trader/volume-spike-bot/.venv/bin/python"
   ```

3. Check environment file:
   ```bash
   ssh volspike-do "cat /home/trader/.volspike.env"
   ```

### "Script not posting alerts"

1. Check environment variables:
   ```bash
   ssh volspike-do "cat /home/trader/.volspike.env | grep BACKEND"
   ```

2. Test connectivity:
   ```bash
   ssh volspike-do "curl -s https://volspike-production.up.railway.app/health"
   ```

3. Check API key:
   ```bash
   ssh volspike-do "grep ALERT_INGEST_API_KEY /home/trader/.volspike.env"
   ```

### "WebSocket keeps disconnecting"

1. Check network:
   ```bash
   ssh volspike-do "ping -c 5 fstream.binance.com"
   ```

2. Check for rate limiting in logs:
   ```bash
   ssh volspike-do "sudo journalctl -u binance-funding-ws.service | grep -i 'rate\|limit\|error'"
   ```

3. Restart with fresh connection:
   ```bash
   ssh volspike-do "sudo systemctl restart binance-funding-ws.service"
   ```

---

## Script Dependencies

### Python Packages

```
requests
websocket-client
python-dotenv
```

### Installing Dependencies

```bash
ssh volspike-do "cd /home/trader/volume-spike-bot && source .venv/bin/activate && pip install requests websocket-client python-dotenv"
```

---

## Security Considerations

1. **API Keys**: Stored in environment file, not in code
2. **SSH Access**: Key-based authentication only
3. **Service User**: Scripts run as `trader` user, not root
4. **Network**: Only outbound connections (Binance, backend)

---

## Next: [Deployment Guide](19-DEPLOYMENT.md)
