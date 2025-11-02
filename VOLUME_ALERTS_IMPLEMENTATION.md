# Volume Alerts Integration - Implementation Guide

## Overview

This implementation integrates your existing Digital Ocean Streamlit script with VolSpike to display real-time volume spike alerts to users. The system uses a centralized monitoring approach where your Digital Ocean server detects volume spikes and pushes them to the VolSpike backend API.

## Architecture

```
Digital Ocean (Streamlit) → VolSpike Backend API → VolSpike Frontend
```

- **Digital Ocean**: Monitors all Binance USDT perpetuals, detects volume spikes
- **Backend API**: Receives alerts via authenticated endpoint, stores in PostgreSQL
- **Frontend**: Displays alerts with tier-based limits (Free: 10, Pro: 50, Elite: 100)

---

## Manual Steps Required

### 1. Database Migration (Backend)

**Action**: Run Prisma migration to add new tables

```bash
cd volspike-nodejs-backend

# Generate Prisma client with new schema
npx prisma generate

# Push schema changes to database
npx prisma db push
```

**Expected Output**:
- New tables: `volume_alerts`, `alert_subscriptions`
- New enum: `AlertType` (SPIKE, HALF_UPDATE, FULL_UPDATE)

---

### 2. Generate and Configure API Key

**Action**: Generate a secure API key for Digital Ocean → Backend communication

```bash
# Generate a secure random key (run this in terminal)
openssl rand -hex 32
```

**Backend Configuration** (`volspike-nodejs-backend/.env`):
```bash
# Add this new variable
ALERT_INGEST_API_KEY=<paste-the-generated-key-here>
```

**Digital Ocean Configuration** (add to your Streamlit app environment):
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=<same-key-as-above>
```

---

### 3. Update Digital Ocean Streamlit Script

**File**: `binance_dashboard_with_alerts.py`

**Action**: Add the following code to post alerts to VolSpike

#### Step 3.1: Add imports at the top
```python
import os
from typing import Dict, Any
```

#### Step 3.2: Add configuration (after API constants)
```python
# VolSpike Integration
VOLSPIKE_API_URL = os.getenv("VOLSPIKE_API_URL", "https://volspike-production.up.railway.app")
VOLSPIKE_API_KEY = os.getenv("VOLSPIKE_API_KEY", "")
```

#### Step 3.3: Add alert posting function
```python
def post_alert_to_volspike(alert_data: Dict[str, Any]) -> bool:
    """Send alert to VolSpike backend."""
    if not VOLSPIKE_API_KEY:
        print("Warning: VOLSPIKE_API_KEY not set, skipping alert post")
        return False
    
    try:
        response = session.post(
            f"{VOLSPIKE_API_URL}/api/volume-alerts/ingest",
            json=alert_data,
            headers={
                "X-API-Key": VOLSPIKE_API_KEY,
                "Content-Type": "application/json"
            },
            timeout=5
        )
        if response.status_code == 200:
            print(f"✅ Alert posted to VolSpike: {alert_data['asset']}")
            return True
        else:
            print(f"❌ Failed to post alert: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error posting alert to VolSpike: {e}")
        return False
```

#### Step 3.4: Modify the `scan()` function

Replace the section where you handle spikes with this:

```python
def scan(top_of_hour: bool, is_middle_hour: bool = False) -> None:
    for sym in st.session_state.active_syms:
        try:
            if top_of_hour:
                prev, curr = last_two_closed_klines(sym)
            else:
                kl = session.get(f"{API}/fapi/v1/klines",
                                 params={"symbol": sym,
                                         "interval": INTERVAL, "limit": 2},
                                 timeout=10).json()
                prev, curr = kl[-2], kl[-1]
        except Exception:
            continue

        prev_vol = float(prev[7])
        curr_vol = float(curr[7])
        ratio = curr_vol / prev_vol if prev_vol else 0

        curr_hour = datetime.fromtimestamp(
            curr[0] / 1000, timezone.utc).replace(minute=0, second=0, microsecond=0)

        already_alerted = st.session_state.last_alert.get(sym) == curr_hour
        spike = (ratio >= VOLUME_MULTIPLE) and (
            curr_vol >= MIN_QUOTE_VOL) and not already_alerted

        # Fetch current price and funding
        try:
            ticker = session.get(f"{API}/fapi/v1/ticker/24hr", 
                                params={"symbol": sym}, timeout=5).json()
            price = float(ticker.get("lastPrice", 0))
            
            funding_resp = session.get(f"{API}/fapi/v1/premiumIndex",
                                      params={"symbol": sym}, timeout=5).json()
            funding_rate = float(funding_resp.get("lastFundingRate", 0))
        except:
            price = None
            funding_rate = None

        # Check for update alerts (middle or end of hour)
        update_alert = False
        update_prefix = ""
        if already_alerted:
            initial_minute = st.session_state.initial_alert_minute.get(sym, 0)

            # Half update logic
            if is_middle_hour:
                # Send half update if initial alert was at hh:00, hh:05, hh:10, hh:15, hh:20
                if initial_minute <= 20:
                    update_prefix = "HALF-UPDATE: "
                    update_alert = True

            # Full update logic
            elif top_of_hour:
                # Send full update if initial alert was NOT at hh:55
                if initial_minute != 55:
                    update_prefix = "UPDATE: "
                    update_alert = True

        if spike:
            st.session_state.last_alert[sym] = curr_hour
            st.session_state.initial_alert_minute[sym] = utc_now.minute

        if spike or update_alert:
            asset = sym.replace("USDT", "")
            alert_msg = f"{update_prefix}{asset} hourly volume {fmt(curr_vol)} ({ratio:.2f}× prev) — VOLUME SPIKE!"
            
            # Determine alert type
            if update_prefix == "HALF-UPDATE: ":
                alert_type = "HALF_UPDATE"
            elif update_prefix == "UPDATE: ":
                alert_type = "FULL_UPDATE"
            else:
                alert_type = "SPIKE"
            
            # Post to VolSpike API
            alert_payload = {
                "symbol": sym,
                "asset": asset,
                "currentVolume": curr_vol,
                "previousVolume": prev_vol,
                "volumeRatio": ratio,
                "price": price,
                "fundingRate": funding_rate,
                "message": alert_msg,
                "timestamp": utc_now.isoformat(),
                "hourTimestamp": curr_hour.isoformat(),
                "isUpdate": bool(update_prefix),
                "alertType": alert_type,
            }
            
            post_alert_to_volspike(alert_payload)
            
            # Continue with existing local storage
            st.session_state.alerts.append((utc_now, alert_msg))
            st.session_state.alerts = st.session_state.alerts[-30:]
```

---

### 4. Deploy Backend Changes

**Action**: Deploy updated backend to Railway

```bash
cd volspike-nodejs-backend

# Build TypeScript
npm run build

# Commit changes
git add .
git commit -m "feat: add volume alerts ingestion API"
git push origin main
```

**Railway will automatically**:
- Detect the push
- Build and deploy the new version
- Run Prisma migrations

**Verify Deployment**:
```bash
# Test health endpoint
curl https://volspike-production.up.railway.app/health

# Test alerts endpoint (should return empty array initially)
curl https://volspike-production.up.railway.app/api/volume-alerts
```

---

### 5. Deploy Frontend Changes

**Action**: Deploy updated frontend to Vercel

```bash
cd volspike-nextjs-frontend

# Build locally to check for errors
npm run build

# Commit changes
git add .
git commit -m "feat: add volume alerts panel to dashboard"
git push origin main
```

**Vercel will automatically**:
- Detect the push
- Build and deploy the new version

**Verify Deployment**:
- Visit https://volspike.com/dashboard
- Check that the Volume Spikes panel appears on the right side (desktop) or in tabs (mobile)

---

### 6. Configure Digital Ocean Environment

**Action**: Set environment variables in your Digital Ocean Streamlit app

**Option A: Using Streamlit Cloud**:
1. Go to your app settings
2. Add secrets:
```toml
VOLSPIKE_API_URL = "https://volspike-production.up.railway.app"
VOLSPIKE_API_KEY = "your-generated-api-key-here"
```

**Option B: Using Docker/Manual Deployment**:
```bash
# Add to your .env file or export in shell
export VOLSPIKE_API_URL="https://volspike-production.up.railway.app"
export VOLSPIKE_API_KEY="your-generated-api-key-here"
```

**Restart your Streamlit app** after setting environment variables

---

### 7. Test End-to-End Flow

#### Test 1: Backend Ingest Endpoint
```bash
# Test with curl (replace YOUR_API_KEY)
curl -X POST https://volspike-production.up.railway.app/api/volume-alerts/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "symbol": "BTCUSDT",
    "asset": "BTC",
    "currentVolume": 5000000000,
    "previousVolume": 1500000000,
    "volumeRatio": 3.33,
    "price": 45000,
    "fundingRate": 0.0001,
    "message": "BTC hourly volume $5.00B (3.33× prev) — VOLUME SPIKE!",
    "timestamp": "2024-01-01T12:00:00Z",
    "hourTimestamp": "2024-01-01T12:00:00Z",
    "isUpdate": false,
    "alertType": "SPIKE"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "alertId": "clx..."
}
```

#### Test 2: Frontend Display
1. Visit https://volspike.com/dashboard
2. Sign in to your account
3. Check the "Volume Spikes" panel on the right
4. You should see the test alert appear

#### Test 3: Digital Ocean Integration
1. Wait for your Streamlit script to detect a real volume spike
2. Check Streamlit logs for: `✅ Alert posted to VolSpike: {ASSET}`
3. Verify alert appears in VolSpike dashboard within 60 seconds

---

## Testing Checklist

- [ ] Backend deployed successfully to Railway
- [ ] Frontend deployed successfully to Vercel
- [ ] Database migration completed (new tables exist)
- [ ] API key generated and configured in both places
- [ ] Digital Ocean script updated with new code
- [ ] Environment variables set in Digital Ocean
- [ ] Backend ingest endpoint tested with curl (returns 200)
- [ ] Frontend displays alerts panel
- [ ] Test alert visible in dashboard
- [ ] Real alert from Digital Ocean appears in VolSpike

---

## Troubleshooting

### Backend Issues

**Issue**: Migration fails
```bash
# Solution: Reset database (DEV ONLY)
cd volspike-nodejs-backend
npx prisma migrate reset
npx prisma db push
```

**Issue**: API returns 401 Unauthorized
- Verify `ALERT_INGEST_API_KEY` is set in backend `.env`
- Verify `X-API-Key` header matches in Digital Ocean script
- Check Railway logs: `railway logs --tail 100`

**Issue**: API returns 500 Internal Server Error
- Check Railway logs for detailed error
- Verify Prisma client is generated: `npx prisma generate`

### Frontend Issues

**Issue**: Alerts panel not showing
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

**Issue**: "Failed to fetch alerts" error
- Check that backend is running
- Verify CORS is configured correctly
- Check Network tab in browser DevTools

### Digital Ocean Issues

**Issue**: "VOLSPIKE_API_KEY not set" warning
- Verify environment variables are configured
- Restart Streamlit app after setting variables

**Issue**: Alerts not posting
- Check Streamlit logs for error messages
- Verify network connectivity to Railway
- Test backend endpoint manually with curl

---

## Tier-Based Alert Limits

| Tier | Max Alerts | Refresh Rate |
|------|-----------|--------------|
| Free | 10 | 60 seconds |
| Pro | 50 | 60 seconds |
| Elite | 100 | 60 seconds |

---

## Next Steps (Optional Enhancements)

1. **WebSocket Real-Time Updates**: Replace polling with Socket.IO for instant alerts
2. **Email Notifications**: Send alerts via SendGrid (already configured)
3. **SMS Alerts**: Send alerts via Twilio for Elite tier
4. **Alert Filtering**: Allow users to filter by specific symbols
5. **Alert History**: Add date range filtering and search
6. **Desktop Notifications**: Add browser push notifications

---

## Support

If you encounter any issues:

1. Check Railway logs: `railway logs --tail 100`
2. Check Vercel logs: Visit Vercel dashboard → Deployments → Function logs
3. Check browser console for frontend errors
4. Check Digital Ocean Streamlit logs

---

## Summary

✅ **What We Built**:
- Backend API endpoint for receiving alerts from Digital Ocean
- PostgreSQL storage for volume alerts
- Frontend React hook for fetching alerts
- Frontend component displaying alerts with tier-based limits
- Integration into dashboard with responsive design

✅ **What You Need to Do**:
1. Run database migration
2. Generate and configure API key
3. Update Digital Ocean script
4. Deploy backend to Railway
5. Deploy frontend to Vercel
6. Configure Digital Ocean environment
7. Test end-to-end flow

**Estimated Time**: 30-45 minutes

**No Breaking Changes**: All existing functionality remains intact. The new alerts panel is additive only.

