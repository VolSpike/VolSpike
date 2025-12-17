# Digital Ocean Python Scripts

## Overview

VolSpike runs Python scripts on a Digital Ocean droplet to:
1. **Detect volume spikes** using Binance REST API
2. **Poll Open Interest data** with multi-timeframe alerts
3. **Monitor funding rates** via WebSocket
4. **Check user-defined alerts** (price, funding, OI threshold crosses)
5. **Poll Telegram channels** for market news
6. **Monitor service health** and auto-restart failed services

**CRITICAL**: This is the ONLY place that calls Binance REST API. Frontend and backend NEVER call Binance REST API.

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

## SSH Quick Reference

### Essential Commands

```bash
# ===== CONNECTION =====
ssh volspike-do                    # Connect to droplet

# ===== SERVICE STATUS =====
ssh volspike-do "sudo systemctl list-units --type=service | grep -E 'volspike|binance|oi-|telegram|user-alert'"
ssh volspike-do "sudo systemctl status volspike.service"
ssh volspike-do "sudo systemctl status binance-funding-ws.service"

# ===== LOGS (recent) =====
ssh volspike-do "sudo journalctl -u volspike.service -n 50 --no-pager"
ssh volspike-do "sudo journalctl -u binance-funding-ws.service -n 50 --no-pager"
ssh volspike-do "sudo journalctl -u oi-realtime-poller.service -n 50 --no-pager"

# ===== LOGS (follow) =====
ssh volspike-do "sudo journalctl -u volspike.service -f"

# ===== RESTART =====
ssh volspike-do "sudo systemctl restart volspike.service"
ssh volspike-do "sudo systemctl restart binance-funding-ws.service && sudo systemctl restart binance-funding-api.service"

# ===== HEALTH CHECK =====
ssh volspike-do "curl -s http://localhost:8888/funding/health | python3 -m json.tool"

# ===== DIRECTORY LISTING =====
ssh volspike-do "ls -la /home/trader/volume-spike-bot/"

# ===== STATE FILES =====
ssh volspike-do "cat /home/trader/volume-spike-bot/.funding_state.json | python3 -m json.tool | head -50"
ssh volspike-do "cat /home/trader/volume-spike-bot/.oi_alert_cooldowns.json | python3 -m json.tool"

# ===== ENVIRONMENT VARIABLES =====
ssh volspike-do "cat /home/trader/.volspike.env"

# ===== TIMERS =====
ssh volspike-do "sudo systemctl list-timers --all | grep -E 'funding|oi-liquid'"

# ===== SYSTEM RESOURCES =====
ssh volspike-do "free -h"
ssh volspike-do "df -h"
ssh volspike-do "ps aux | grep python"
```

### Deploy Script to Production

```bash
# 1. Copy script via SCP (NOT git pull!)
scp "Digital Ocean/hourly_volume_alert_dual_env.py" \
    volspike-do:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py

# 2. Restart service
ssh volspike-do "sudo systemctl restart volspike.service"

# 3. Verify
ssh volspike-do "sudo systemctl status volspike.service"
ssh volspike-do "sudo journalctl -u volspike.service -n 20 --no-pager"
```

---

## Directory Structure

### Production Directory (`/home/trader/volume-spike-bot/`)

**Last verified:** December 2025 via SSH

```
/home/trader/
├── .volspike.env                     # Environment variables (loaded by services)
└── volume-spike-bot/
    │
    │── # ===== PRODUCTION SCRIPTS =====
    ├── hourly_volume_alert_dual_env.py   # Volume spike detection (585 lines)
    ├── oi_realtime_poller.py             # OI polling + multi-timeframe alerts (773 lines)
    ├── oi_liquid_universe_job.py         # Liquid symbol classification (272 lines)
    ├── binance_funding_ws_daemon.py      # Funding rate WebSocket (234 lines)
    ├── funding_api_server.py             # Funding rate HTTP API (355 lines)
    ├── user_alert_checker.py             # User alert checker (370 lines)
    ├── telegram_channel_poller.py        # Telegram monitoring (420 lines)
    ├── funding_health_monitor.py         # Health monitoring (306 lines)
    │
    │── # ===== STATE FILES (IPC) =====
    ├── .funding_state.json               # WebSocket daemon state (funding rates, mark prices)
    ├── .oi_alert_cooldowns.json          # OI alert cooldown persistence
    ├── .telegram_poller_state.json       # Telegram poller last message IDs
    │
    │── # ===== TELEGRAM SESSION =====
    ├── volspike_telegram.session         # Pyrogram session file (auth)
    ├── volspike_telegram.session-journal # Session journal
    │
    │── # ===== LOGS =====
    ├── logs/
    │   ├── user-alert-checker.log        # User alert checker output (14MB+)
    │   └── user-alert-checker.error.log  # Error log
    │
    │── # ===== PYTHON ENVIRONMENT =====
    ├── .venv/                            # Python virtual environment
    │
    │── # ===== BACKUP/DUPLICATE FILES (can be cleaned up) =====
    ├── check_oi.py                       # Old OI checker
    ├── check_api.py                      # API test script
    ├── funding_api_backup.py             # Backup copy
    ├── funding_monitor.py                # Older version
    ├── funding_monitor_v2.py             # Older version
    ├── hourly_volume_alert.py            # Older single-env version
    ├── oi_poller.py                      # Older OI poller
    ├── oi_poller_liquid.py               # Older liquid poller
    ├── oi_fetcher.py                     # Older OI fetcher
    ├── oi_liquid_universe.py             # Older universe script
    ├── query_alerts.py                   # Debug/query script
    ├── test_funding.py                   # Test script
    ├── test_websocket.py                 # Test script
    └── test_post.py                      # Test script
```

### Systemd Service Files (`/etc/systemd/system/`)

```
/etc/systemd/system/
│
│── # ===== ACTIVE SERVICES (always running) =====
├── volspike.service                  # Main volume alert service
├── binance-funding-ws.service        # Funding WebSocket daemon
├── binance-funding-api.service       # Funding HTTP API server
├── oi-realtime-poller.service        # OI realtime poller
├── telegram-channel-poller.service   # Telegram channel poller
├── user-alert-checker.service        # User alert checker
├── volspike-dashboard.service        # Streamlit dashboard (port 8501)
│
│── # ===== ONESHOT SERVICES (triggered by timers) =====
├── funding-health-check.service      # Health monitoring
├── oi-liquid-universe.service        # Liquid universe classification
│
│── # ===== TIMERS =====
├── funding-health-check.timer        # Every minute
└── oi-liquid-universe.timer          # Every 5 minutes
```

---

## Production Status (Live from SSH)

**Last verified:** December 2025

### Running Services

```bash
# Command to list all VolSpike services:
ssh volspike-do "sudo systemctl list-units --type=service | grep -E 'volspike|binance|oi-|telegram|user-alert'"
```

| Service | Status | Description |
|---------|--------|-------------|
| `binance-funding-api.service` | active (running) | Binance Funding Rate HTTP API Server |
| `binance-funding-ws.service` | active (running) | Binance Funding Rate WebSocket Daemon |
| `oi-realtime-poller.service` | active (running) | VolSpike Realtime Open Interest Poller |
| `telegram-channel-poller.service` | active (running) | VolSpike Telegram Channel Poller |
| `user-alert-checker.service` | active (running) | VolSpike User Alert Checker |
| `volspike-dashboard.service` | active (running) | Binance volume dashboard (Streamlit) |
| `volspike.service` | active (running) | Binance hourly-volume spike bot |

### Active Timers

```bash
# Command to list active timers:
ssh volspike-do "sudo systemctl list-timers --all | grep -E 'funding|oi-liquid'"
```

| Timer | Schedule | Service |
|-------|----------|---------|
| `funding-health-check.timer` | Every minute | `funding-health-check.service` |
| `oi-liquid-universe.timer` | Every 5 minutes | `oi-liquid-universe.service` |

### Funding API Health

```bash
# Command to check funding API health:
ssh volspike-do "curl -s http://localhost:8888/funding/health | python3 -m json.tool"
```

**Sample output (verified December 2025):**
```json
{
    "status": "healthy",
    "websocketConnected": true,
    "symbolCount": 654,
    "uptimeSeconds": 42.1,
    "messagesReceived": 36624,
    "reconnectAttempts": 0,
    "oldestDataAgeSeconds": 2.51,
    "newestDataAgeSeconds": 2.51
}
```

### Environment Variables (from `/home/trader/.volspike.env`)

```bash
# List variable names (not values for security):
ssh volspike-do "grep -v '^#' /home/trader/.volspike.env | cut -d'=' -f1 | sort"
```

| Variable | Purpose |
|----------|---------|
| `CHAT_ID` | Telegram chat ID for alerts |
| `DISCORD_TOKEN` | Discord bot token (optional) |
| `OI_MAX_INTERVAL_SEC` | Max OI poll interval |
| `OI_MAX_REQ_PER_MIN` | Rate limit for OI requests |
| `OI_MIN_INTERVAL_SEC` | Min OI poll interval |
| `TELEGRAM_API_HASH` | Telegram API hash (for Pyrogram) |
| `TELEGRAM_API_ID` | Telegram API ID (for Pyrogram) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHANNEL_ID` | Channel ID for posting |
| `TELEGRAM_CHANNELS` | Channels to monitor (comma-separated) |
| `TELEGRAM_TOKEN` | Telegram bot token (legacy) |
| `VOLSPIKE_API_KEY` | Production API key |
| `VOLSPIKE_API_KEY_DEV` | Development API key |
| `VOLSPIKE_API_URL` | Production backend URL |
| `VOLSPIKE_API_URL_DEV` | Development backend URL |
| `WS_FUNDING_API_URL` | WebSocket funding API URL |
| `WS_FUNDING_ENABLED` | Enable WebSocket funding |

---

## Core Scripts

### 1. Volume Alert Script

**File:** `hourly_volume_alert_dual_env.py` (585 lines)

**Purpose:** Detects volume spikes by comparing current hour volume to previous hour.

**Features:**
- Scans every 5 minutes on the clock (:00, :05, :10, ...)
- At hh:00: Uses last two closed hourly candles
- Other times: Compares current open candle vs previous closed
- Fires when `current >= 3x previous` AND `>= $3M notional`
- Sends alerts to Telegram AND VolSpike backend
- Dual-environment support (PROD + DEV)
- Half-updates at hh:30, full updates at hh:00
- Includes enhanced metrics (price change, OI change)
- Fetches funding rates from WebSocket service (no REST fallback)

**Environment Variables:**
```bash
# Required
TELEGRAM_TOKEN=your-telegram-bot-token
CHAT_ID=your-telegram-chat-id
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key

# Optional (DEV environment)
VOLSPIKE_API_URL_DEV=http://localhost:3001
VOLSPIKE_API_KEY_DEV=your-dev-api-key

# WebSocket funding service
WS_FUNDING_ENABLED=true  # Default: true
WS_FUNDING_API_URL=http://localhost:8888/funding  # Default
```

**Constants:**
```python
API = "https://fapi.binance.com"
INTERVAL = "1h"
VOLUME_MULTIPLE = 3        # 3x threshold
MIN_QUOTE_VOL = 3_000_000  # $3M minimum
```

**Binance API Calls:**
| Endpoint | Purpose | Rate Weight |
|----------|---------|-------------|
| `GET /fapi/v1/exchangeInfo` | Get active USDT perpetuals | 1 |
| `GET /fapi/v1/klines` | Candlestick data | 1 per symbol |
| `GET /fapi/v1/openInterest` | Current OI (for enhanced metrics) | 1 per symbol |

**Backend API Calls:**
| Endpoint | Purpose |
|----------|---------|
| `POST /api/volume-alerts/ingest` | Post detected volume spikes |
| `GET /api/market/open-interest/snapshot` | Get hour-start OI for OI change calculation |

**State Management:**
- `last_alert: Dict[str, datetime]` - Tracks last alert time per symbol
- `initial_alert_minute: Dict[str, int]` - Tracks when initial alert was sent

**Update Logic:**
1. **Initial Alert**: When spike first detected (current >= 3x previous)
2. **Half-Update (hh:30)**: If initial alert was at or before :20
3. **Full-Update (hh:00)**: If initial alert was NOT at :55

**Alert Payload:**
```json
{
  "symbol": "BTCUSDT",
  "asset": "BTC",
  "currentVolume": 150000000,
  "previousVolume": 45000000,
  "volumeRatio": 3.33,
  "price": 65000.50,
  "fundingRate": 0.0001,
  "candleDirection": "bullish",
  "message": "BTC hourly volume $150M (3.33x prev) - VOLUME SPIKE!",
  "timestamp": "2024-12-15T14:05:00Z",
  "detectionTime": "2024-12-15T14:05:00Z",
  "hourTimestamp": "2024-12-15T14:00:00Z",
  "isUpdate": false,
  "alertType": "SPIKE",
  "priceChange": 0.025,
  "oiChange": 0.015
}
```

**Scheduling:** Wall-clock aligned, every 5 minutes

---

### 2. OI Realtime Poller

**File:** `oi_realtime_poller.py` (773 lines)

**Purpose:** Polls Open Interest data and detects significant OI changes with multi-timeframe alerts.

**Features:**
- Reads liquid universe from VolSpike backend
- Polls OI for liquid symbols at computed intervals (5-20 seconds)
- Maintains OI history in ring buffers (3 hours of data)
- Multi-timeframe alert detection (5min, 15min, 1hour)
- De-duplication: Only alerts on INSIDE -> OUTSIDE threshold transition
- Persistent cooldown state (survives script restarts)
- Concurrent fetching with ThreadPoolExecutor (20 workers)
- Mark prices loaded from WebSocket state file (ONE file read vs 341 HTTP calls!)

**Multi-Timeframe Alert Configuration:**
| Timeframe | Threshold | Lookback | Cooldown |
|-----------|-----------|----------|----------|
| 5 min | >= 3% | 5 min | 10 min |
| 15 min | >= 7% | 15 min | 15 min |
| 1 hour | >= 12% | 60 min | 60 min |

**Additional Requirements:**
- Minimum absolute OI change: 5,000 contracts
- Poll interval computed based on universe size and rate limits

**Environment Variables:**
```bash
# Required
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key

# Optional - Override defaults
OI_MAX_REQ_PER_MIN=2000          # Rate limit
OI_MIN_INTERVAL_SEC=5            # Min poll interval
OI_MAX_INTERVAL_SEC=20           # Max poll interval
OI_MIN_DELTA_CONTRACTS=5000      # Min absolute change

# Per-timeframe overrides
OI_SPIKE_THRESHOLD_PCT_5MIN=0.03   # 3%
OI_LOOKBACK_WINDOW_5MIN=300        # 5 minutes
OI_ALERT_COOLDOWN_5MIN=600         # 10 minutes

OI_SPIKE_THRESHOLD_PCT_15MIN=0.07  # 7%
OI_LOOKBACK_WINDOW_15MIN=900       # 15 minutes
OI_ALERT_COOLDOWN_15MIN=900        # 15 minutes

OI_SPIKE_THRESHOLD_PCT_60MIN=0.12  # 12%
OI_LOOKBACK_WINDOW_60MIN=3600      # 60 minutes
OI_ALERT_COOLDOWN_60MIN=3600       # 60 minutes

# WebSocket state file
WS_FUNDING_API_URL=http://localhost:8888/funding
WS_FUNDING_ENABLED=true
```

**Binance API Calls:**
| Endpoint | Purpose | Rate Weight |
|----------|---------|-------------|
| `GET /fapi/v1/openInterest` | OI for each symbol | 1 per symbol |

**Backend API Calls:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/market/open-interest/liquid-universe` | Fetch liquid universe |
| `POST /api/market/open-interest/ingest` | Post OI batch data |
| `POST /api/open-interest-alerts/ingest` | Post OI spike/dump alerts |

**State Files:**
- `.oi_alert_cooldowns.json` - Persistent cooldown state (survives restarts)
- `.funding_state.json` - Read mark prices from WebSocket daemon

**Data Structures:**
```python
# Ring buffer for OI history (3 hours at 10s interval)
oi_history: Dict[str, deque[(timestamp, oi_contracts, mark_price)]]

# Alert cooldowns (persisted to disk)
last_oi_alert_at: Dict[Tuple[str, str, str], float]  # (symbol, direction, timeframe) -> timestamp

# De-duplication state
oi_alert_state: Dict[Tuple[str, str], str]  # (symbol, timeframe) -> "INSIDE" or "OUTSIDE"
```

**Alert Payload:**
```json
{
  "symbol": "BTCUSDT",
  "direction": "UP",
  "baseline": 100000,
  "current": 105000,
  "pctChange": 0.05,
  "absChange": 5000,
  "timestamp": "2024-12-15T14:05:00Z",
  "source": "oi_realtime_poller",
  "timeframe": "5 min",
  "priceChange": 0.02,
  "fundingRate": 0.0001
}
```

---

### 3. Liquid Universe Job

**File:** `oi_liquid_universe_job.py` (272 lines)

**Purpose:** Classifies symbols as "liquid" based on 24h volume with hysteresis.

**Features:**
- Fetches exchangeInfo and ticker/24hr from Binance
- Applies hysteresis thresholds (enter vs exit)
- Posts results to VolSpike backend
- Runs every 5 minutes alongside main alert service

**Threshold Logic (Hysteresis):**
```python
ENTER_THRESHOLD = 4_000_000   # $4M - symbol enters liquid universe
EXIT_THRESHOLD = 2_000_000    # $2M - symbol exits liquid universe
```

This prevents symbols from flapping in/out when near the threshold.

**Environment Variables:**
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key
BINANCE_PROXY_URL=http://localhost:3002  # Optional proxy

# Override thresholds
OI_LIQUID_ENTER_QUOTE_24H=4000000  # $4M default
OI_LIQUID_EXIT_QUOTE_24H=2000000   # $2M default
```

**Binance API Calls:**
| Endpoint | Purpose | Rate Weight |
|----------|---------|-------------|
| `GET /fapi/v1/exchangeInfo` | Symbol info | 1 |
| `GET /fapi/v1/ticker/24hr` | 24h volume | 1 |

**Backend API Calls:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/market/open-interest/liquid-universe` | Get current universe |
| `POST /api/market/open-interest/liquid-universe/update` | Update liquid universe |

**Payload:**
```json
{
  "symbols": [
    {
      "symbol": "BTCUSDT",
      "quoteVolume24h": 5000000000,
      "enteredAt": "2024-12-15T00:00:00Z",
      "lastSeenAt": "2024-12-15T14:00:00Z"
    }
  ],
  "updatedAt": "2024-12-15T14:00:00Z"
}
```

---

### 4. Funding Rate WebSocket Daemon

**File:** `binance_funding_ws_daemon.py` (234 lines)

**Purpose:** Maintains WebSocket connection to Binance for real-time funding rates and mark prices.

**Features:**
- Connects to Binance combined stream: `!ticker@arr/!markPrice@arr`
- Maintains in-memory state dictionary with funding rates and mark prices
- Auto-reconnects with exponential backoff (1s -> 60s max)
- Thread-safe state updates
- Persists state to JSON file for IPC with other scripts
- Matches frontend `parseFundingRate` logic for field names

**WebSocket URL:**
```
wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
```

**Configuration:**
```python
RECONNECT_INITIAL_DELAY = 1    # seconds
RECONNECT_MAX_DELAY = 60       # seconds
RECONNECT_MULTIPLIER = 2       # exponential backoff
STALE_THRESHOLD = 180          # 3 minutes
```

**State File:** `.funding_state.json`
```json
{
  "funding_state": {
    "BTCUSDT": {
      "fundingRate": 0.0001,
      "markPrice": 65000.50,
      "nextFundingTime": 1702656000000,
      "indexPrice": 65000.25,
      "updatedAt": 1702652400.123
    }
  },
  "connection_status": {
    "connected": true,
    "last_connected_time": 1702652400.0,
    "reconnect_attempts": 0,
    "messages_received": 125000,
    "last_message_time": 1702652400.123
  },
  "updated_at": 1702652400.123
}
```

**Field Parsing (matches frontend):**
- Funding rate: `r`, `R`, `fr`, `lastFundingRate`, `fundingRate`, `estimatedSettlePriceRate`
- Mark price: `p`, `markPrice`, `c`, `lastPrice`

---

### 5. Funding API Server

**File:** `funding_api_server.py` (355 lines)

**Purpose:** HTTP API server that serves funding rate data from WebSocket daemon.

**Features:**
- FastAPI-based HTTP server
- Reads from WebSocket daemon's state file
- In-memory cache with 1-second refresh
- Stale data detection (3-minute threshold)
- Health check endpoint

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/funding/health` | GET | Service health status |
| `/funding/{symbol}` | GET | Single symbol funding data |
| `/funding/batch?symbols=SYM1,SYM2` | GET | Multiple symbols |

**Configuration:**
```python
API_PORT = 8888
API_HOST = "127.0.0.1"  # localhost only
STALE_THRESHOLD_SEC = 180  # 3 minutes
CACHE_REFRESH_INTERVAL = 1.0  # 1 second
```

**Response Examples:**

**Health Check (`/funding/health`):**
```json
{
  "status": "healthy",
  "websocketConnected": true,
  "symbolCount": 341,
  "uptimeSeconds": 3600.25,
  "lastConnectedTime": 1702652400.0,
  "messagesReceived": 125000,
  "reconnectAttempts": 0,
  "oldestDataAgeSeconds": 1.5,
  "newestDataAgeSeconds": 0.5
}
```

**Single Symbol (`/funding/BTCUSDT`):**
```json
{
  "symbol": "BTCUSDT",
  "markPrice": 65000.50,
  "fundingRate": 0.0001,
  "nextFundingTime": 1702656000000,
  "indexPrice": 65000.25,
  "updatedAt": 1702652400.123,
  "ageSeconds": 1.5
}
```

**HTTP Status Codes:**
- `200`: Success
- `404`: Symbol not found
- `503`: Data stale or WebSocket disconnected

---

### 6. User Alert Checker

**File:** `user_alert_checker.py` (370 lines)

**Purpose:** Checks user-defined custom alerts for threshold crosses.

**Features:**
- Fetches active user alerts from backend
- Polls Binance for current market data (price, funding, OI)
- Detects threshold crosses (above->below or below->above)
- Tier-based checking intervals:
  - Pro/Elite: Every 30 seconds
  - Free: Every 5 minutes (10th iteration)
- Uses WebSocket service for funding rates (with REST fallback)

**Alert Types:**
| Type | Data Source | Backend Endpoint |
|------|-------------|------------------|
| `PRICE_CROSS` | Binance ticker | `/fapi/v1/ticker/price` |
| `FUNDING_CROSS` | WebSocket + REST fallback | `/fapi/v1/premiumIndex` |
| `OI_CROSS` | Binance OI + price | `/fapi/v1/openInterest` |

**Backend API Calls:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/user-alerts-trigger/active` | Fetch all active user alerts |
| `POST /api/user-alerts-trigger/trigger` | Trigger crossed alert |
| `POST /api/user-alerts-trigger/update-checked` | Update lastCheckedValue |

**Cross Detection Logic:**
```python
def check_cross(previous_value, current_value, threshold):
    crossed_up = previous_value < threshold and current_value >= threshold
    crossed_down = previous_value > threshold and current_value <= threshold

    if crossed_up:
        return True   # Crossed UP
    elif crossed_down:
        return False  # Crossed DOWN
    else:
        return None   # No cross
```

**Environment Variables:**
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key
WS_FUNDING_ENABLED=true
```

---

### 7. Telegram Channel Poller

**File:** `telegram_channel_poller.py` (420 lines)

**Purpose:** Monitors public Telegram channels and sends messages to backend.

**Features:**
- Uses Pyrogram library for Telegram API
- Polls configured channels every 30 seconds
- Tracks last message ID per channel (state persistence)
- Extracts message data: text, sender, views, media, links
- Sends messages in batches to backend
- Graceful shutdown on SIGTERM/SIGINT

**Requirements:**
```bash
pip install pyrogram tgcrypto requests
```

**First-Time Setup:**
1. Run script manually: `python telegram_channel_poller.py`
2. Enter phone number when prompted
3. Enter verification code from Telegram
4. Session file saved for future use

**Environment Variables:**
```bash
# Required
TELEGRAM_API_ID=your_api_id          # From https://my.telegram.org
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_CHANNELS=marketfeed,watcherguru  # Comma-separated, no @
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=your-api-key
```

**Channel Categories:**
```python
CHANNEL_CATEGORIES = {
    'marketfeed': 'macro',
    'watcherguru': 'crypto',
}
```

**Backend API Calls:**
| Endpoint | Purpose |
|----------|---------|
| `POST /api/telegram/ingest` | Send Telegram messages |

**Message Payload:**
```json
{
  "channel": {
    "id": -1001234567890,
    "username": "marketfeed",
    "title": "Market Feed",
    "category": "macro"
  },
  "messages": [
    {
      "id": 12345,
      "text": "Market update...",
      "date": "2024-12-15T14:00:00Z",
      "sender_name": "Market Feed",
      "views": 5000,
      "forwards": 100,
      "has_media": true,
      "media_type": "photo",
      "links": ["https://example.com/article"]
    }
  ]
}
```

**State File:** `.telegram_poller_state.json`
```json
{
  "last_message_ids": {
    "marketfeed": 12345,
    "watcherguru": 67890
  },
  "last_fetch": "2024-12-15T14:00:00Z"
}
```

---

### 8. Funding Health Monitor

**File:** `funding_health_monitor.py` (306 lines)

**Purpose:** Monitors WebSocket daemon and API server health, auto-restarts on failure.

**Features:**
- Checks systemd service status
- Verifies WebSocket connection state
- Monitors data freshness (stale threshold: 3 minutes)
- Counts NULL funding rates and mark prices
- Auto-restarts failed services
- Compares data quality with Binance REST API
- Designed for cron (runs every minute)

**Checks Performed:**
1. **WebSocket Daemon Service**: Is `binance-funding-ws.service` running?
2. **API Server Service**: Is `binance-funding-api.service` running?
3. **WebSocket Connection**: Is connected to Binance?
4. **Data Freshness**: Any data older than 3 minutes?
5. **Symbol Count**: At least 500 symbols tracked?
6. **NULL Values**: Any NULL funding rates or mark prices?
7. **Data Quality**: BTCUSDT matches Binance REST API?

**Auto-Restart Logic:**
```python
if not check_systemd_service(service_name):
    status.error(f"Service is NOT running")
    if restart_service(service_name):
        status.add_info(f"Successfully restarted")
    else:
        status.error(f"Failed to restart")
```

**Exit Codes:**
- `0`: All checks passed (healthy)
- `1`: One or more checks failed (unhealthy)

---

## Systemd Services

### Service Files

Located in `/etc/systemd/system/`:

#### volspike.service (Main Volume Alert)
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

#### binance-funding-ws.service (WebSocket Daemon)
```ini
[Unit]
Description=Binance Funding Rate WebSocket Daemon (Production-Grade)
Documentation=https://github.com/VolSpike/VolSpike
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=trader
Group=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/binance_funding_ws_daemon.py
Restart=always
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5
WatchdogSec=180
MemoryMax=512M
MemoryHigh=384M
StandardOutput=journal
StandardError=journal
SyslogIdentifier=binance-funding-ws
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/trader/volume-spike-bot
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
```

#### binance-funding-api.service (HTTP API Server)
```ini
[Unit]
Description=Binance Funding Rate HTTP API Server (Production-Grade)
Documentation=https://github.com/VolSpike/VolSpike
After=network-online.target binance-funding-ws.service
Wants=network-online.target
Requires=binance-funding-ws.service

[Service]
Type=simple
User=trader
Group=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/funding_api_server.py
ExecStartPost=/bin/sleep 3
Restart=always
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5
WatchdogSec=120
MemoryMax=512M
MemoryHigh=384M
StandardOutput=journal
StandardError=journal
SyslogIdentifier=binance-funding-api
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/trader/volume-spike-bot
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
```

#### telegram-channel-poller.service
```ini
[Unit]
Description=VolSpike Telegram Channel Poller
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python telegram_channel_poller.py
Restart=always
RestartSec=10
TimeoutStopSec=30
KillSignal=SIGTERM
StandardOutput=journal
StandardError=journal
SyslogIdentifier=telegram-poller

[Install]
WantedBy=multi-user.target
```

#### user-alert-checker.service
```ini
[Unit]
Description=VolSpike User Alert Checker
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python3 -u /home/trader/volume-spike-bot/user_alert_checker.py
Restart=always
RestartSec=10
StandardOutput=append:/home/trader/volume-spike-bot/logs/user-alert-checker.log
StandardError=append:/home/trader/volume-spike-bot/logs/user-alert-checker.error.log

[Install]
WantedBy=multi-user.target
```

#### funding-health-check.service (Oneshot)
```ini
[Unit]
Description=Funding Data Health Check
After=binance-funding-ws.service binance-funding-api.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 /home/trader/volume-spike-bot/funding_health_monitor.py
StandardOutput=journal
StandardError=journal
SyslogIdentifier=funding-health-check
```

#### oi-realtime-poller.service
```ini
[Unit]
Description=VolSpike Realtime Open Interest Poller
After=network.target binance-funding-api.service

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python3 oi_realtime_poller.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=oi-realtime-poller

[Install]
WantedBy=multi-user.target
```

#### volspike-dashboard.service (Streamlit)
```ini
[Unit]
Description=Binance volume dashboard (Streamlit)
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/home/trader/volume-spike-bot/.venv/bin/streamlit run dashboard.py --server.port 8501
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=volspike-dashboard

[Install]
WantedBy=multi-user.target
```

#### oi-liquid-universe.service (Oneshot, triggered by timer)
```ini
[Unit]
Description=OI Liquid Universe Classification Job
After=network.target

[Service]
Type=oneshot
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python3 oi_liquid_universe_job.py
StandardOutput=journal
StandardError=journal
SyslogIdentifier=oi-liquid-universe
```

#### oi-liquid-universe.timer
```ini
[Unit]
Description=Run OI Liquid Universe Job every 5 minutes

[Timer]
OnCalendar=*:0/5
AccuracySec=1s
Persistent=true

[Install]
WantedBy=timers.target
```

#### funding-health-check.timer
```ini
[Unit]
Description=Funding Health Check Timer

[Timer]
OnCalendar=*:*:00
AccuracySec=1s

[Install]
WantedBy=timers.target
```

### Service Dependency Graph

```
                    network-online.target
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
  binance-funding-ws    volspike     volspike-dashboard
     .service          .service        .service
            |
            v
  binance-funding-api
     .service
            |
     +------+------+------+------+
     |      |      |      |      |
     v      v      v      v      v
  oi-   user-   tele-  fund-  oi-liquid-
realtime alert  gram  ing-   universe
poller checker poller health .service
                      check   (timer)
```

**Always Running (7 services):**
1. `volspike.service` - Volume spike detection
2. `binance-funding-ws.service` - WebSocket daemon (data source)
3. `binance-funding-api.service` - HTTP API (depends on WS)
4. `oi-realtime-poller.service` - OI monitoring (depends on API)
5. `user-alert-checker.service` - User alerts (depends on API)
6. `telegram-channel-poller.service` - Telegram monitoring
7. `volspike-dashboard.service` - Streamlit dashboard

**Timer-Triggered (2 timers):**
1. `funding-health-check.timer` → `funding-health-check.service` (every minute)
2. `oi-liquid-universe.timer` → `oi-liquid-universe.service` (every 5 minutes)

### Managing Services

```bash
# Check status
ssh volspike-do "sudo systemctl status volspike.service"
ssh volspike-do "sudo systemctl status binance-funding-ws.service"
ssh volspike-do "sudo systemctl status binance-funding-api.service"

# View logs
ssh volspike-do "sudo journalctl -u volspike.service -n 50 --no-pager"
ssh volspike-do "sudo journalctl -u binance-funding-ws.service -n 50 --no-pager"

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

# List all VolSpike services
ssh volspike-do "sudo systemctl list-units --type=service | grep -E 'volspike|binance|funding|telegram|user-alert'"
```

---

## Environment Variables

Located at `/home/trader/.volspike.env`:

```bash
# Backend URL
VOLSPIKE_API_URL=https://volspike-production.up.railway.app

# API Key for authentication
VOLSPIKE_API_KEY=your-secret-key

# Telegram (for volume alerts)
TELEGRAM_TOKEN=your-bot-token
CHAT_ID=your-chat-id

# Telegram API (for channel poller)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_CHANNELS=marketfeed,watcherguru

# Optional: DEV environment
VOLSPIKE_API_URL_DEV=http://localhost:3001
VOLSPIKE_API_KEY_DEV=your-dev-api-key

# WebSocket funding service
WS_FUNDING_ENABLED=true
WS_FUNDING_API_URL=http://localhost:8888/funding

# OI Poller configuration
OI_MAX_REQ_PER_MIN=2000
OI_MIN_INTERVAL_SEC=5
OI_MAX_INTERVAL_SEC=20
OI_MIN_DELTA_CONTRACTS=5000
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

# WRONG SERVICE NAME
ssh volspike-do "sudo systemctl restart hourly-volume-alert-dual-env.service"

# WRONG - using IP instead of alias
ssh root@167.71.196.5 "..."
```

**CORRECT:**
```bash
# Use SCP and correct service name
scp "Digital Ocean/script.py" volspike-do:/home/trader/volume-spike-bot/script.py
ssh volspike-do "sudo systemctl restart volspike.service && sudo systemctl status volspike.service"
```

---

## API Authentication

Scripts authenticate with backend using API key in header:

```python
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': os.environ['VOLSPIKE_API_KEY']
}

response = requests.post(
    f"{VOLSPIKE_API_URL}/api/volume-alerts/ingest",
    json=alert_data,
    headers=headers
)
```

---

## Binance API Usage

### REST API Endpoints Used

| Endpoint | Purpose | Scripts Using It |
|----------|---------|------------------|
| `GET /fapi/v1/exchangeInfo` | Active USDT perpetuals | volume_alert, liquid_universe |
| `GET /fapi/v1/klines` | Candlestick data | volume_alert |
| `GET /fapi/v1/openInterest` | Open Interest | volume_alert, oi_poller, user_alert |
| `GET /fapi/v1/ticker/price` | Current prices | user_alert, health_monitor |
| `GET /fapi/v1/ticker/24hr` | 24h volume | liquid_universe |
| `GET /fapi/v1/premiumIndex` | Funding rates (fallback) | user_alert, health_monitor |

### WebSocket Streams

| Stream | Purpose |
|--------|---------|
| `!markPrice@arr` | All mark prices + funding |
| `!ticker@arr` | All 24h tickers |

**Combined URL:** `wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr`

### Rate Limits

- REST: 2400 request weight/minute
- WebSocket: 5 messages/second
- Connection: 1 connection per IP

---

## Inter-Process Communication

### State Files

Scripts communicate via JSON state files:

| File | Writer | Readers |
|------|--------|---------|
| `.funding_state.json` | binance_funding_ws_daemon | funding_api_server, oi_realtime_poller, volume_alert |
| `.oi_alert_cooldowns.json` | oi_realtime_poller | oi_realtime_poller (persistent cooldowns) |
| `.telegram_poller_state.json` | telegram_channel_poller | telegram_channel_poller (last message IDs) |

### WebSocket -> HTTP API Flow

```
Binance WebSocket Stream
        |
        v
binance_funding_ws_daemon.py
        |
        +---> .funding_state.json ---> funding_api_server.py ---> HTTP API
        |                                   |
        |                                   v
        |                         Other scripts via HTTP
        |
        +---> Direct file read by oi_realtime_poller.py
             (avoids 341 HTTP calls per loop!)
```

---

## Monitoring & Debugging

### Check All Services

```bash
ssh volspike-do "sudo systemctl list-units --type=service | grep -E 'volspike|binance|funding|telegram|user-alert'"
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

### Check State Files

```bash
# Funding state
ssh volspike-do "cat /home/trader/volume-spike-bot/.funding_state.json | python3 -m json.tool | head -50"

# OI cooldowns
ssh volspike-do "cat /home/trader/volume-spike-bot/.oi_alert_cooldowns.json | python3 -m json.tool"

# Telegram state
ssh volspike-do "cat /home/trader/volume-spike-bot/.telegram_poller_state.json | python3 -m json.tool"
```

### Test Funding API

```bash
# Health check
ssh volspike-do "curl -s http://localhost:8888/funding/health | python3 -m json.tool"

# Single symbol
ssh volspike-do "curl -s http://localhost:8888/funding/BTCUSDT | python3 -m json.tool"

# Batch
ssh volspike-do "curl -s 'http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT,SOLUSDT' | python3 -m json.tool"
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

4. Check for import errors:
   ```bash
   ssh volspike-do "cd /home/trader/volume-spike-bot && .venv/bin/python -c 'import hourly_volume_alert_dual_env'"
   ```

### "Script not posting alerts"

1. Check environment variables:
   ```bash
   ssh volspike-do "cat /home/trader/.volspike.env | grep VOLSPIKE"
   ```

2. Test connectivity:
   ```bash
   ssh volspike-do "curl -s https://volspike-production.up.railway.app/health"
   ```

3. Check API key:
   ```bash
   ssh volspike-do "grep VOLSPIKE_API_KEY /home/trader/.volspike.env"
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

3. Check connection status in state file:
   ```bash
   ssh volspike-do "cat /home/trader/volume-spike-bot/.funding_state.json | python3 -c \"import json,sys; d=json.load(sys.stdin); print('Connected:', d['connection_status']['connected'])\""
   ```

4. Restart with fresh connection:
   ```bash
   ssh volspike-do "sudo systemctl restart binance-funding-ws.service"
   ```

### "OI alerts not firing"

1. Check cooldown state:
   ```bash
   ssh volspike-do "cat /home/trader/volume-spike-bot/.oi_alert_cooldowns.json | python3 -m json.tool"
   ```

2. Check liquid universe:
   ```bash
   curl -s https://volspike-production.up.railway.app/api/market/open-interest/liquid-universe | python3 -m json.tool | head -20
   ```

3. Check alert thresholds in logs:
   ```bash
   ssh volspike-do "sudo journalctl -u oi-realtime-poller.service | grep -i 'spike\|dump'"
   ```

### "Telegram poller not working"

1. Check if session file exists:
   ```bash
   ssh volspike-do "ls -la /home/trader/volume-spike-bot/volspike_telegram.session"
   ```

2. Check Telegram credentials:
   ```bash
   ssh volspike-do "grep TELEGRAM /home/trader/.volspike.env"
   ```

3. Run manually for debugging:
   ```bash
   ssh volspike-do "cd /home/trader/volume-spike-bot && .venv/bin/python telegram_channel_poller.py"
   ```

---

## Script Dependencies

### Python Packages

```
# Core
requests
websocket-client
python-dotenv

# Funding API Server
fastapi
uvicorn

# Telegram Poller
pyrogram
tgcrypto
```

### Installing Dependencies

```bash
ssh volspike-do "cd /home/trader/volume-spike-bot && source .venv/bin/activate && pip install requests websocket-client python-dotenv fastapi uvicorn pyrogram tgcrypto"
```

---

## Security Considerations

1. **API Keys**: Stored in environment file, not in code
2. **SSH Access**: Key-based authentication only
3. **Service User**: Scripts run as `trader` user, not root (except health monitor)
4. **Network**: Only outbound connections (Binance, backend)
5. **Localhost API**: Funding API server binds to 127.0.0.1 only
6. **Security Hardening**: Services use `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`
7. **Memory Limits**: Services have `MemoryMax=512M` to prevent runaway usage

---

## Performance Optimizations

1. **Mark Price Loading**: oi_realtime_poller reads `.funding_state.json` directly instead of making 341 HTTP calls per loop
2. **Concurrent Fetching**: ThreadPoolExecutor with 20 workers for parallel OI fetching
3. **Batch Posting**: OI data posted in chunks of 100 symbols to avoid timeouts
4. **Connection Pooling**: requests.Session with HTTPAdapter for connection reuse
5. **Ring Buffers**: deque with maxlen for bounded memory OI history
6. **Persistent Cooldowns**: Cooldown state survives script restarts

---

## Cron Jobs

### Health Monitor (every minute)

```bash
# /etc/cron.d/volspike-health
* * * * * root /usr/bin/python3 /home/trader/volume-spike-bot/funding_health_monitor.py >> /var/log/volspike-health.log 2>&1
```

Or use systemd timer:
```bash
# funding-health-check.timer
[Unit]
Description=Funding Health Check Timer

[Timer]
OnCalendar=*:*:00
AccuracySec=1s

[Install]
WantedBy=timers.target
```

---

## Next: [Deployment Guide](19-DEPLOYMENT.md)
