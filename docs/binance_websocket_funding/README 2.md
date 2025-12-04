# Binance WebSocket Funding Rate Service

## Overview

This feature replaces REST API calls to Binance `premiumIndex` endpoint with WebSocket-based data streaming to reduce API weight and improve efficiency on Digital Ocean server.

## Problem Solved

**Before:** ~80 REST API calls per minute (~115K calls/day) for funding rate and mark price data  
**After:** Zero REST API calls - all data comes from a single WebSocket stream

## Architecture

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
│  │  • Writes to .funding_state.json (shared file)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          │ Updates JSON file                  │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     Local HTTP API Server                             │   │
│  │     (funding_api_server.py)                           │   │
│  │                                                        │   │
│  │  • Reads from .funding_state.json                     │   │
│  │  • GET /funding/:symbol                               │   │
│  │  • GET /funding/batch?symbols=...                     │   │
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
│  │  • Fetches funding from REST (validation)             │   │
│  │  • Fetches funding from WS API (production)           │   │
│  │  • Compares and logs differences                      │   │
│  │  • Uses WS data for alerts                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     OI Realtime Poller                                │   │
│  │     (oi_realtime_poller.py)                            │   │
│  │                                                        │   │
│  │  • Fetches mark price from REST (validation)          │   │
│  │  • Fetches mark price from WS API (production)        │   │
│  │  • Compares and logs differences                      │   │
│  │  • Uses WS data for USD notional                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Files

### Core Services
- `binance_funding_ws_daemon.py` - WebSocket daemon that connects to Binance
- `funding_api_server.py` - HTTP API server that exposes funding data
- `binance-funding-ws.service` - Systemd service file for WebSocket daemon
- `binance-funding-api.service` - Systemd service file for HTTP API server

### Integration
- `hourly_volume_alert_dual_env.py` - Updated to use WebSocket funding (parallel validation)
- `oi_realtime_poller.py` - Updated to use WebSocket mark price (parallel validation)

### Utilities
- `validate_funding_comparison.py` - Validation report generator

### Documentation
- `requirements.md` - Feature requirements and goals
- `design.md` - Architecture and design details
- `implementation_steps.md` - Step-by-step implementation guide
- `DEPLOYMENT.md` - Deployment and troubleshooting guide

## Quick Start

### 1. Install Dependencies
```bash
pip install websocket-client fastapi uvicorn
```

### 2. Test Manually
```bash
# Terminal 1: Start WebSocket daemon
python3 binance_funding_ws_daemon.py

# Terminal 2: Start HTTP API server
python3 funding_api_server.py

# Terminal 3: Test endpoints
curl http://localhost:8888/funding/BTCUSDT
curl http://localhost:8888/funding/health
```

### 3. Deploy as Services
```bash
# Install systemd services
sudo cp binance-funding-ws.service /etc/systemd/system/
sudo cp binance-funding-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable binance-funding-ws.service binance-funding-api.service
sudo systemctl start binance-funding-ws.service binance-funding-api.service
```

### 4. Enable in Scripts
```bash
# Add to .volspike.env
export WS_FUNDING_ENABLED=true
export WS_FUNDING_API_URL=http://localhost:8888/funding
```

## Validation Mode

The scripts run in **parallel validation mode** by default:
- Fetch from both REST API and WebSocket
- Compare values and log differences
- Use WebSocket data for production
- Fallback to REST if WebSocket unavailable

After 24+ hours of validation, you can switch to WebSocket-only mode by removing REST API calls.

## Monitoring

### Health Check
```bash
curl http://localhost:8888/funding/health | jq
```

### View Logs
```bash
sudo journalctl -u binance-funding-ws.service -f
sudo journalctl -u binance-funding-api.service -f
```

### Generate Validation Report
```bash
# Collect logs
sudo journalctl -u volspike-volume-alert.service > volume_alert.log

# Generate report
python3 validate_funding_comparison.py volume_alert.log
```

## Benefits

1. **API Weight Reduction**: ~80 calls/min eliminated (~115K calls/day)
2. **Better Data Freshness**: Updates every 1-3 seconds vs REST polling
3. **Improved Resilience**: Auto-reconnection with exponential backoff
4. **Cost Savings**: More headroom for other API operations
5. **Reusable Service**: Other scripts can use the same funding data

## Status

- ✅ WebSocket daemon implemented
- ✅ HTTP API server implemented
- ✅ Volume alert script integrated (parallel validation)
- ✅ OI poller script integrated (parallel validation)
- ✅ Validation utilities created
- ✅ Documentation complete
- 🚧 **Next**: Deploy and validate for 24+ hours
- 🚧 **Then**: Switch to WebSocket-only mode

## See Also

- [Requirements](requirements.md) - Detailed requirements
- [Design](design.md) - Architecture and design
- [Implementation Steps](implementation_steps.md) - Step-by-step guide
- [Deployment Guide](DEPLOYMENT.md) - Deployment and troubleshooting

