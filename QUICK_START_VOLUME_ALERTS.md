# Volume Alerts - Quick Start Guide

## 🎯 What Was Implemented

A complete integration between your Digital Ocean Streamlit monitoring script and VolSpike, allowing real-time volume spike alerts to be displayed to all users.

### ✅ Code Changes (Already Done)
- ✅ Backend API routes for alert ingestion
- ✅ PostgreSQL database schema (VolumeAlert, AlertSubscription tables)
- ✅ Frontend React hook for fetching alerts
- ✅ Frontend alerts panel component
- ✅ Dashboard integration (responsive design)

### 📋 Manual Steps Required (You Need to Do)

#### 1. Generate API Key (2 minutes)
```bash
openssl rand -hex 32
```
Save this key - you'll need it in steps 2 and 3.

#### 2. Backend Setup (5 minutes)
```bash
cd volspike-nodejs-backend

# Add to .env file:
echo "ALERT_INGEST_API_KEY=<your-generated-key>" >> .env

# Run migration
npx prisma generate
npx prisma db push
```

#### 3. Update Digital Ocean Script (10 minutes)

Add to your `binance_dashboard_with_alerts.py`:

**Environment variables:**
```bash
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=<your-generated-key>
```

**Code to add:** See `VOLUME_ALERTS_IMPLEMENTATION.md` Section 3 for the complete code to add.

#### 4. Deploy (5 minutes)
```bash
# Backend
cd volspike-nodejs-backend
git add . && git commit -m "feat: volume alerts integration" && git push

# Frontend  
cd volspike-nextjs-frontend
git add . && git commit -m "feat: volume alerts panel" && git push
```

#### 5. Test (5 minutes)
```bash
# Test backend endpoint
curl -X POST https://volspike-production.up.railway.app/api/volume-alerts/ingest \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","asset":"BTC","currentVolume":5000000000,"previousVolume":1500000000,"volumeRatio":3.33,"message":"Test","timestamp":"2024-01-01T12:00:00Z","hourTimestamp":"2024-01-01T12:00:00Z","isUpdate":false,"alertType":"SPIKE"}'

# Visit dashboard
open https://volspike.com/dashboard
```

---

## 🔍 What to Expect

### Frontend Display
- **Desktop**: Alerts panel on right side (1/4 width)
- **Mobile**: Swipeable tabs (Market Data | Volume Spikes)
- **Tier Limits**: Free (10), Pro (50), Elite (100)
- **Refresh**: Auto-polls every 60 seconds

### Alert Format
Each alert shows:
- Asset name (e.g., BTC)
- Volume ratio badge (e.g., 3.33x)
- Current and previous volume
- Price and funding rate (if available)
- Time ago (e.g., "2 minutes ago")

---

## 🚨 Troubleshooting

**Backend 401 Error:**
- Check `ALERT_INGEST_API_KEY` matches in both backend and Digital Ocean

**Frontend shows "No alerts":**
- Verify backend deployed successfully
- Check Railway logs: `railway logs --tail 100`
- Verify Digital Ocean script is posting alerts

**Digital Ocean not posting:**
- Check environment variables are set
- Restart Streamlit app
- Look for console errors in Streamlit logs

---

## 📚 Full Documentation

See `VOLUME_ALERTS_IMPLEMENTATION.md` for complete details.

---

## ⏱️ Total Time: ~30 minutes

**No Breaking Changes** - All existing functionality remains intact.

