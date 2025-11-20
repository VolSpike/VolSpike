# Open Interest Feature Deployment Guide

## Overview
This guide covers the deployment of the Open Interest feature, which fetches OI data from Binance via the Digital Ocean script and displays it in the VolSpike dashboard.

## Architecture
```
Digital Ocean Script (every 5min)
    ↓ Fetch OI from Binance API
    ↓ POST to backend
Backend (Railway)
    ↓ Cache in memory (5min TTL)
    ↓ Serve via GET endpoint
Frontend (Vercel)
    ↓ Fetch from backend
    ↓ Merge with market data
    ↓ Display in table (Pro/Elite only)
```

## Changes Made

### 1. Digital Ocean Script (`hourly_volume_alert_enhanced.py`)

**New Function: `fetch_and_post_open_interest()`**
- Fetches Open Interest for all USDT perpetuals
- Gets mark price to calculate USD notional
- Posts to `/api/market/open-interest` endpoint
- Runs every 5 minutes (same schedule as volume scan)
- Graceful error handling per symbol

**Key Features:**
- ✅ Batch processing (all symbols at once)
- ✅ USD notional calculation (contracts * mark price)
- ✅ Retry logic via existing `requests.Session`
- ✅ Silent per-symbol failures (no spam)
- ✅ Summary logging (success/error counts)

### 2. Backend API Endpoint (To Be Created)
**Route:** `POST /api/market/open-interest`
- Receives OI data from DO script
- Caches in memory (Map with 5min expiration)
- Validates API key authentication

**Route:** `GET /api/market/open-interest`
- Serves cached OI data to frontend
- Returns empty object if cache expired
- No authentication required (public data)

### 3. Frontend Hook (To Be Updated)
**File:** `use-client-only-market-data.ts`
- Fetches OI data from backend every 5min
- Merges with existing market data
- Only shows for Pro/Elite tiers

### 4. Market Table (To Be Updated)
**File:** `market-table.tsx`
- New "Open Interest" column
- Formatted as USD notional (e.g., "$1.23B")
- Visible only for Pro/Elite tiers
- Sortable (click header)

## Deployment Steps

### Step 1: Deploy Backend Endpoint
```bash
cd volspike-nodejs-backend
# (Backend code will be added in next step)
git add .
git commit -m "feat(api): add Open Interest endpoint"
git push
```

### Step 2: Deploy Frontend Updates
```bash
cd volspike-nextjs-frontend
# (Frontend code will be added in next step)
git add .
git commit -m "feat(ui): add Open Interest column (Pro/Elite)"
git push
```

### Step 3: Update Digital Ocean Script
```bash
# SSH into Digital Ocean server
ssh root@167.71.196.5

# Navigate to script directory
cd /home/trader/volume-spike-bot

# Stop the service
sudo systemctl stop volume-alert

# Backup current script (already done)
# Replace with enhanced version
nano hourly_volume_alert.py
# (Paste enhanced script contents)

# Test the script
python3 hourly_volume_alert.py
# (Ctrl+C after 1-2 cycles to verify it works)

# Restart the service
sudo systemctl restart volume-alert

# Check status
sudo systemctl status volume-alert

# Monitor logs
sudo journalctl -u volume-alert -f
```

## Data Flow Example

### Digital Ocean → Backend
```json
POST /api/market/open-interest
{
  "data": [
    {
      "symbol": "BTCUSDT",
      "openInterest": 123456.789,
      "openInterestUsd": 12700000000.50,
      "markPrice": 102999.90
    },
    ...
  ],
  "timestamp": "2025-11-06T12:05:00Z",
  "totalSymbols": 250
}
```

### Backend → Frontend
```json
GET /api/market/open-interest
{
  "data": {
    "BTCUSDT": 12700000000.50,
    "ETHUSDT": 8500000000.00,
    ...
  },
  "timestamp": "2025-11-06T12:05:00Z",
  "cacheExpiry": "2025-11-06T12:10:00Z"
}
```

### Frontend Display
| Ticker | Price | 24h Change | Funding Rate | **Open Interest** | 24h Volume |
|--------|-------|------------|--------------|-------------------|------------|
| BTC    | $102,999.90 | +1.42% | +0.0072% | **$12.70B** | $12.03B |
| ETH    | $3,394.18 | +3.29% | +0.0052% | **$8.50B** | $15.52B |

## Testing Checklist

### Backend Testing
- [ ] POST endpoint accepts OI data with valid API key
- [ ] POST endpoint rejects invalid API key
- [ ] GET endpoint returns cached data
- [ ] GET endpoint returns empty object when cache expired
- [ ] Cache TTL works correctly (5min)

### Frontend Testing
- [ ] **Free Tier**: OI column NOT visible
- [ ] **Pro Tier**: OI column visible with data
- [ ] **Elite Tier**: OI column visible with data
- [ ] Data formats correctly ($12.70B, $1.23M)
- [ ] Column sorting works
- [ ] Data updates every 5 minutes
- [ ] Graceful handling if backend returns no data

### Digital Ocean Testing
- [ ] Script starts without errors
- [ ] OI data fetches successfully
- [ ] POST to backend succeeds (check logs)
- [ ] Runs every 5 minutes on schedule
- [ ] Service auto-restarts on failure

## Monitoring

### Backend Logs (Railway)
```bash
# Check for OI POST requests
railway logs | grep "open-interest"
```

### Digital Ocean Logs
```bash
# Check script output
sudo journalctl -u volume-alert -f | grep "Open Interest"

# Expected output every 5 minutes:
# 📊 Fetching Open Interest data from Binance...
# ✅ Posted Open Interest: 250 symbols (errors: 0)
```

### Frontend Console
```javascript
// Enable debug mode
localStorage.setItem('debug', 'true')

// Check console for:
// "📊 Fetched Open Interest: 250 symbols"
// "🔄 Merged OI data with market data"
```

## Rollback Plan

### If Digital Ocean Script Fails
```bash
# Stop the new script
sudo systemctl stop volume-alert

# Restore backup
cp hourly_volume_alert.py.backup.20251106_001105 hourly_volume_alert.py

# Restart
sudo systemctl start volume-alert
```

### If Backend Fails
- Frontend will continue to work (OI column shows "$0.00")
- No alerts or errors for end users
- Redeploy previous backend version via Railway dashboard

### If Frontend Fails
- Redeploy previous version via Vercel dashboard
- Users see table without OI column

## Production Checklist
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Digital Ocean script updated
- [ ] Environment variables set (`VOLSPIKE_API_URL`, `VOLSPIKE_API_KEY`)
- [ ] All tests passing
- [ ] Monitoring in place
- [ ] Rollback plan tested

## Notes
- Open Interest data is **public** (no authentication needed for GET)
- Data updates every **5 minutes** (aligned with volume scan)
- Cache TTL is **5 minutes** (prevents stale data)
- Tier restriction is **frontend-only** (backend serves to all)
- Data source is **Binance Futures API** (`/fapi/v1/openInterest`)
- USD notional is **calculated** (OI contracts * mark price)

