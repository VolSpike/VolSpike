# Binance WebSocket Funding Rate Service - Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Digital Ocean Server                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     Binance WebSocket Daemon                          │   │
│  │     (binance_funding_ws_daemon.py)                     │   │
│  │                                                        │   │
│  │  • Connects to wss://fstream.binance.com/stream      │   │
│  │  • Subscribes to !markPrice@arr stream               │   │
│  │  • Maintains in-memory funding_state dict             │   │
│  │  • Auto-reconnects on disconnect                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          │ Updates                            │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     Local HTTP API Server                             │   │
│  │     (funding_api_server.py)                           │   │
│  │                                                        │   │
│  │  • FastAPI/Flask HTTP server                          │   │
│  │  • GET /funding/:symbol                               │   │
│  │  • GET /funding/batch?symbols=...                    │   │
│  │  • GET /funding/health                                │   │
│  │  • Runs on localhost:8888                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          │ HTTP requests                      │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     Volume Alert Script                               │   │
│  │     (hourly_volume_alert_dual_env.py)                  │   │
│  │                                                        │   │
│  │  • Fetches funding from REST (existing)               │   │
│  │  • Fetches funding from WS API (new)                  │   │
│  │  • Compares and logs differences                      │   │
│  │  • Uses WS data for alerts                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     OI Realtime Poller                                │   │
│  │     (oi_realtime_poller.py)                           │   │
│  │                                                        │   │
│  │  • Fetches mark price from REST (existing)            │   │
│  │  • Fetches mark price from WS API (new)               │   │
│  │  • Compares and logs differences                      │   │
│  │  • Uses WS data for USD notional                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ WebSocket
                          ▼
        ┌─────────────────────────────────────┐
        │     Binance WebSocket API            │
        │     wss://fstream.binance.com/stream│
        │     Stream: !markPrice@arr          │
        └─────────────────────────────────────┘
```

## Component Design

### 1. WebSocket Daemon (`binance_funding_ws_daemon.py`)

#### Responsibilities
- Establish and maintain WebSocket connection to Binance
- Parse incoming mark price stream messages
- Maintain in-memory state dictionary
- Handle reconnections and errors
- Provide thread-safe access to funding state

#### Data Structures

```python
# In-memory state dictionary
funding_state: Dict[str, Dict[str, Any]] = {
    "BTCUSDT": {
        "markPrice": float,      # Mark price
        "fundingRate": float,    # Funding rate (e.g., 0.0003 = 0.03%)
        "nextFundingTime": int,  # Unix timestamp (ms)
        "indexPrice": float,     # Index price
        "updatedAt": float,      # Unix timestamp (seconds)
    },
    ...
}

# Thread-safe access via threading.Lock
state_lock = threading.Lock()
```

#### Key Functions

```python
def connect_websocket() -> websocket.WebSocketApp:
    """Create and configure WebSocket connection"""
    
def on_message(ws, message: str):
    """Handle incoming WebSocket messages"""
    # Parse JSON
    # Extract symbol, markPrice, fundingRate, etc.
    # Update funding_state with lock
    
def on_error(ws, error):
    """Handle WebSocket errors"""
    # Log error
    # Schedule reconnection
    
def on_close(ws, close_status_code, close_msg):
    """Handle WebSocket close"""
    # Log close reason
    # Schedule reconnection
    
def reconnect_with_backoff():
    """Reconnect with exponential backoff"""
    # Wait 1s, 2s, 4s, 8s, max 60s
    # Retry connection
    
def get_funding_data(symbol: str) -> Optional[Dict]:
    """Thread-safe getter for funding data"""
    # Acquire lock
    # Return copy of data
    # Release lock
```

#### Message Format

Binance sends messages like:
```json
{
  "stream": "!markPrice@arr",
  "data": [
    {
      "e": "markPriceUpdate",
      "E": 1562306400000,
      "s": "BTCUSDT",
      "p": "11185.87786614",
      "i": "11180.5",
      "r": "0.00030000",
      "T": 1562306400000
    },
    ...
  ]
}
```

We parse:
- `s` → symbol
- `p` → markPrice (string, convert to float)
- `r` → fundingRate (string, convert to float)
- `T` → nextFundingTime (int, milliseconds)
- `i` → indexPrice (string, convert to float)
- `E` → eventTime (int, milliseconds) → use for updatedAt

### 2. HTTP API Server (`funding_api_server.py`)

#### Responsibilities
- Expose REST endpoints for funding/mark price data
- Provide health check endpoint
- Handle batch requests efficiently
- Validate data freshness

#### API Endpoints

##### GET /funding/:symbol
**Request:**
```
GET http://localhost:8888/funding/BTCUSDT
```

**Response (200 OK):**
```json
{
  "symbol": "BTCUSDT",
  "markPrice": 11185.87786614,
  "fundingRate": 0.0003,
  "nextFundingTime": 1562306400000,
  "indexPrice": 11180.5,
  "updatedAt": 1710000000.0,
  "ageSeconds": 2.5
}
```

**Response (404 Not Found):**
```json
{
  "error": "Symbol not found",
  "symbol": "INVALIDUSDT"
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "Data stale",
  "symbol": "BTCUSDT",
  "ageSeconds": 185.2,
  "maxAgeSeconds": 180
}
```

##### GET /funding/batch?symbols=BTCUSDT,ETHUSDT,...
**Request:**
```
GET http://localhost:8888/funding/batch?symbols=BTCUSDT,ETHUSDT,SOLUSDT
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "symbol": "BTCUSDT",
      "markPrice": 11185.87786614,
      "fundingRate": 0.0003,
      "nextFundingTime": 1562306400000,
      "indexPrice": 11180.5,
      "updatedAt": 1710000000.0,
      "ageSeconds": 2.5
    },
    {
      "symbol": "ETHUSDT",
      "markPrice": 3456.78,
      "fundingRate": 0.0001,
      "nextFundingTime": 1562306400000,
      "indexPrice": 3455.0,
      "updatedAt": 1710000001.0,
      "ageSeconds": 1.5
    },
    {
      "symbol": "SOLUSDT",
      "error": "Symbol not found"
    }
  ],
  "found": 2,
  "missing": 1
}
```

##### GET /funding/health
**Request:**
```
GET http://localhost:8888/funding/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "websocketConnected": true,
  "symbolCount": 245,
  "oldestDataAgeSeconds": 2.1,
  "newestDataAgeSeconds": 0.5,
  "lastUpdateTime": 1710000000.0,
  "uptimeSeconds": 86400.5
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "websocketConnected": false,
  "error": "WebSocket disconnected",
  "lastConnectedTime": 1710000000.0,
  "disconnectedForSeconds": 30.5
}
```

#### Implementation

Using FastAPI for simplicity and performance:

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import time

app = FastAPI()

@app.get("/funding/{symbol}")
async def get_funding(symbol: str):
    # Get from funding_state
    # Check freshness
    # Return JSON
    
@app.get("/funding/batch")
async def get_funding_batch(symbols: str):
    # Parse comma-separated symbols
    # Fetch each from funding_state
    # Return array
    
@app.get("/funding/health")
async def get_health():
    # Check WebSocket connection status
    # Check data freshness
    # Return health status
```

### 3. Integration with Volume Alert Script

#### Changes to `hourly_volume_alert_dual_env.py`

**New function:**
```python
def fetch_funding_from_ws(symbol: str) -> Optional[Dict[str, float]]:
    """Fetch funding rate from WebSocket service"""
    try:
        resp = session.get(
            f"http://localhost:8888/funding/{symbol}",
            timeout=1
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "fundingRate": data["fundingRate"],
                "markPrice": data["markPrice"]
            }
    except:
        pass
    return None

def compare_funding_data(rest_funding: float, ws_funding: float, symbol: str):
    """Compare REST vs WebSocket funding rates"""
    if rest_funding is None or ws_funding is None:
        return
    
    diff = abs(rest_funding - ws_funding)
    diff_pct = (diff / abs(rest_funding)) * 100 if rest_funding != 0 else 0
    
    if diff_pct > 0.1:  # >0.1% difference
        print(f"⚠️  Funding mismatch for {symbol}: REST={rest_funding:.6f}, WS={ws_funding:.6f}, diff={diff_pct:.3f}%")
    else:
        print(f"✅ Funding match for {symbol}: {rest_funding:.6f}")
```

**Modified `scan()` function:**
```python
# Existing REST call
funding_rate_rest = None
try:
    funding_resp = session.get(f"{API}/fapi/v1/premiumIndex",
                              params={"symbol": sym}, timeout=5).json()
    funding_rate_rest = float(funding_resp.get("lastFundingRate", 0))
except:
    pass

# New WebSocket call
funding_data_ws = fetch_funding_from_ws(sym)
funding_rate_ws = funding_data_ws["fundingRate"] if funding_data_ws else None

# Compare (validation mode)
if funding_rate_rest is not None and funding_rate_ws is not None:
    compare_funding_data(funding_rate_rest, funding_rate_ws, sym)

# Use WebSocket data for alert (fallback to REST if WS unavailable)
funding_rate = funding_rate_ws if funding_rate_ws is not None else funding_rate_rest
```

### 4. Integration with OI Realtime Poller

#### Changes to `oi_realtime_poller.py`

**New function:**
```python
def fetch_mark_price_from_ws(symbol: str) -> Optional[float]:
    """Fetch mark price from WebSocket service"""
    try:
        resp = session.get(
            f"http://localhost:8888/funding/{symbol}",
            timeout=1
        )
        if resp.status_code == 200:
            data = resp.json()
            return data["markPrice"]
    except:
        pass
    return None
```

**Modified `fetch_oi_for_symbol()` function:**
```python
# Existing REST call (optional)
mark_price_rest = None
try:
    premium_url = f"https://fapi.binance.com/fapi/v1/premiumIndex"
    premium_response = session.get(premium_url, params={"symbol": symbol}, timeout=5)
    if premium_response.ok:
        premium_data = premium_response.json()
        mark_price_rest = float(premium_data.get("markPrice", 0))
except:
    pass

# New WebSocket call
mark_price_ws = fetch_mark_price_from_ws(symbol)

# Compare (validation mode)
if mark_price_rest is not None and mark_price_ws is not None:
    diff = abs(mark_price_rest - mark_price_ws)
    diff_pct = (diff / mark_price_rest) * 100 if mark_price_rest != 0 else 0
    if diff_pct > 0.1:
        print(f"⚠️  Mark price mismatch for {symbol}: REST={mark_price_rest:.2f}, WS={mark_price_ws:.2f}, diff={diff_pct:.3f}%")

# Use WebSocket data (fallback to REST if WS unavailable)
mark_price = mark_price_ws if mark_price_ws is not None else mark_price_rest
```

## Data Flow

### Normal Operation Flow

1. **WebSocket Daemon** connects to Binance and receives mark price updates
2. **WebSocket Daemon** updates in-memory `funding_state` dictionary
3. **Volume Alert Script** calls `GET /funding/BTCUSDT` via HTTP API
4. **HTTP API** reads from `funding_state` and returns JSON
5. **Volume Alert Script** uses funding rate for alert payload
6. **Volume Alert Script** also calls REST API (validation mode) and compares

### Error Handling Flow

1. **WebSocket disconnects** → Daemon detects disconnect
2. **Daemon** schedules reconnection with exponential backoff
3. **HTTP API** receives request → Checks data freshness
4. **If data stale** → Returns 503 Service Unavailable
5. **Volume Alert Script** receives 503 → Falls back to REST API
6. **Daemon reconnects** → Updates resume, HTTP API returns 200 again

## Threading Model

### WebSocket Daemon
- **Main thread**: WebSocket connection and message handling
- **State updates**: Thread-safe via `threading.Lock`
- **Reconnection**: Background thread with exponential backoff

### HTTP API Server
- **Main thread**: FastAPI/Flask server (async capable)
- **State reads**: Thread-safe via `threading.Lock` (read-only)
- **No blocking**: All operations are non-blocking

## Configuration

### Environment Variables

```bash
# WebSocket Daemon
WS_RECONNECT_INITIAL_DELAY=1      # Initial reconnect delay (seconds)
WS_RECONNECT_MAX_DELAY=60         # Max reconnect delay (seconds)
WS_RECONNECT_MULTIPLIER=2         # Exponential backoff multiplier
WS_STALE_THRESHOLD=180            # Data stale threshold (seconds)

# HTTP API Server
API_PORT=8888                      # HTTP API port
API_HOST=127.0.0.1                # HTTP API host (localhost only)
API_STALE_THRESHOLD=180           # Stale data threshold (seconds)
```

### Service Configuration

**Systemd service file** (`/etc/systemd/system/binance-funding-ws.service`):
```ini
[Unit]
Description=Binance Funding Rate WebSocket Daemon
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volspike/Digital Ocean
ExecStart=/usr/bin/python3 /home/trader/volspike/Digital Ocean/binance_funding_ws_daemon.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Systemd service file** (`/etc/systemd/system/binance-funding-api.service`):
```ini
[Unit]
Description=Binance Funding Rate HTTP API
After=network.target binance-funding-ws.service
Requires=binance-funding-ws.service

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volspike/Digital Ocean
ExecStart=/usr/bin/python3 /home/trader/volspike/Digital Ocean/funding_api_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Testing Strategy

### Unit Tests
- WebSocket message parsing
- State dictionary updates
- HTTP API endpoints
- Error handling

### Integration Tests
- WebSocket connection and reconnection
- HTTP API with WebSocket daemon
- End-to-end data flow

### Validation Tests
- Compare REST vs WebSocket data for 24+ hours
- Log all discrepancies
- Generate validation report

## Monitoring & Observability

### Logging
- WebSocket connection status
- Message parsing errors
- HTTP API requests/responses
- Data freshness metrics
- Comparison results (REST vs WS)

### Metrics
- WebSocket uptime
- Messages received per second
- HTTP API request rate
- Average response time
- Data freshness distribution
- Comparison match rate

### Alerts
- WebSocket disconnected >60 seconds
- Data stale >3 minutes
- HTTP API errors >1% of requests
- Comparison mismatches >1% difference

