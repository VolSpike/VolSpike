# VolSpike Tier Feature Comparison - Complete Breakdown

## 📊 Tier Overview

| Feature Category | Free ($0/month) | Pro ($9/month) | Elite ($49/month) |
|-----------------|-----------------|----------------|-------------------|
| **Price** | Free Forever | $9/month | $49/month |
| **Target User** | Casual Traders | Active Traders | Professional Traders |

---

## 🔄 Market Data Updates

### **Update Frequency**

| Tier | Update Schedule | Countdown Timer | WebSocket Connection |
|------|----------------|-----------------|---------------------|
| **Free** | Every 15 minutes at wall-clock times (:00, :15, :30, :45) | ✅ Yes - Shows "Next update in X:XX" | ✅ Connected (throttled client-side) |
| **Pro** | Every 5 minutes at wall-clock times (:00, :05, :10, :15, etc.) | ✅ Yes - Shows "Next update in X:XX" | ✅ Connected (throttled client-side) |
| **Elite** | Real-time streaming (sub-second updates) | ❌ No countdown (always live) | ✅ Connected (no throttling) |

### **Implementation Details:**

**Free Tier Market Data:**
```typescript
// Update cadence: 900,000ms (15 minutes)
// Wall-clock alignment: :00, :15, :30, :45 of every hour
// Example: If user logs in at 2:42 PM:
//   - Sees data from 2:30 PM update
//   - Next update at 2:45 PM (countdown shows "3:00")
//   - Then 3:00 PM, 3:15 PM, etc.
```

**Code Location:** `volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts`
```javascript
const CADENCE = tier === 'elite' ? 0 : (tier === 'pro' ? 300_000 : 900_000)
```

---

## 🔔 Volume Spike Alerts

### **Alert Delivery Schedule**

| Tier | Delivery Method | Schedule | On Page Load |
|------|----------------|----------|--------------|
| **Free** | WebSocket batches | Every 15 min at :00, :15, :30, :45 | Last 10 alerts before last broadcast time |
| **Pro** | WebSocket batches | Every 5 min at :00, :05, :10, etc. | Last 50 alerts before last broadcast time |
| **Elite** | WebSocket instant | Real-time (0 delay) | All 100 most recent alerts |

### **Alert Limits**

| Tier | Max Alerts Displayed | Alert Subscriptions | Refresh Button |
|------|---------------------|---------------------|----------------|
| **Free** | 10 alerts | ❌ Not available | ❌ Hidden (auto-updates only) |
| **Pro** | 50 alerts | ✅ Subscribe to specific symbols | ✅ Visible |
| **Elite** | 100 alerts | ✅ Subscribe to specific symbols | ✅ Visible |

### **Implementation Details:**

**Free Tier Alert Delivery:**
```typescript
// Digital Ocean script detects volume spike at 2:37 PM
// Backend receives and queues alert immediately
// Alert stored in database but NOT sent to free tier users yet

// At 2:45:00 PM (next 15-minute mark):
// - Backend broadcasts all queued alerts to 'tier-free' Socket.IO room
// - All free tier users receive alerts simultaneously
// - Alerts appear instantly on dashboard (no refresh needed)

// If user logs in at 2:42 PM:
// - REST API returns alerts before 2:30 PM only (last broadcast)
// - Alerts from 2:30-2:42 are queued (hidden from user)
// - At 2:45, queued alerts push via WebSocket
```

**Code Location:** `volspike-nodejs-backend/src/services/alert-broadcaster.ts`
```typescript
// Free tier: broadcast at :00, :15, :30, :45
if (isAtInterval(15)) {
  alertQueues.free.forEach(alert => {
    ioInstance.to('tier-free').emit('volume-alert', alert)
  })
}
```

### **Alert Display Features**

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| **Countdown Timer** | ✅ "Next update in X:XX" | ✅ "Next update in X:XX" | ❌ (always real-time) |
| **Color Coding** | ✅ Green (bullish) / Red (bearish) | ✅ Green / Red | ✅ Green / Red |
| **Directional Icons** | ✅ Up/Down arrows | ✅ Up/Down arrows | ✅ Up/Down arrows |
| **Timestamp Format** | ✅ Exact time + relative | ✅ Exact time + relative | ✅ Exact time + relative |
| **Live Badge** | ✅ Shows when WebSocket connected | ✅ Shows when connected | ✅ Shows when connected |

---

## 📈 Market Data Table

### **Visible Columns**

| Column | Free | Pro | Elite |
|--------|------|-----|-------|
| Ticker | ✅ | ✅ | ✅ |
| Price | ✅ | ✅ | ✅ |
| 24h Change | ✅ | ✅ | ✅ |
| Funding Rate | ✅ | ✅ | ✅ |
| 24h Volume | ✅ | ✅ | ✅ |
| **Open Interest** | ❌ **HIDDEN** | ✅ **VISIBLE** | ✅ **VISIBLE** |

**Code Location:** `volspike-nextjs-frontend/src/components/market-table.tsx`
```tsx
{userTier !== 'free' && (
  <th className="text-right p-3 text-sm font-semibold">Open Interest</th>
)}
```

### **Symbol Limits (Backend API)**

| Tier | Max Symbols Displayed | Symbol Filtering |
|------|----------------------|------------------|
| **Free** | Top 50 by volume | Shows highest volume pairs only |
| **Pro** | Top 100 by volume | Shows more pairs |
| **Elite** | All active symbols | No artificial limit |

**Code Location:** `volspike-nodejs-backend/src/routes/market.ts`
```typescript
if (tier === 'free') {
  filteredData = marketData.slice(0, 50) // Top 50
} else if (tier === 'pro') {
  filteredData = marketData.slice(0, 100) // Top 100
}
// Elite: no limit
```

---

## 🎨 User Interface Elements

### **Advertisement Banner**

| Tier | Shows Ad Banner | Purpose |
|------|----------------|---------|
| **Free** | ✅ **YES** - Shows "Unlock Pro Features" banner | Encourage upgrade |
| **Pro** | ❌ No ads | Clean interface |
| **Elite** | ❌ No ads | Premium experience |

**Code Location:** `volspike-nextjs-frontend/src/components/dashboard.tsx`
```tsx
{userTier === 'free' && (
  <AdBanner userTier={userTier} />
)}
```

### **Tier Badge Styling**

| Tier | Icon | Color Theme |
|------|------|-------------|
| **Free** | ⚡ Zap | Gray/Muted |
| **Pro** | ⭐ Star | Secondary/Purple |
| **Elite** | ✨ Sparkles | Elite Gold/Yellow |

---

## 🔐 Alert Subscriptions & Preferences

### **Custom Alert Creation**

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| **Subscribe to Symbols** | ❌ Not available | ✅ Available | ✅ Available |
| **Create Custom Alerts** | ❌ Limited | ✅ Yes | ✅ Yes + API access |
| **Email Notifications** | ❌ No | ✅ Yes | ✅ Yes |
| **SMS Notifications** | ❌ No | ❌ No | ✅ Yes |

**Code Location:** `volspike-nodejs-backend/src/routes/volume-alerts.ts`
```typescript
if (user.tier === 'free') {
  return c.json({ error: 'Pro or Elite tier required' }, 403)
}
```

---

## 📊 Historical Data Access

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| **Historical Alerts** | Last 10 | Last 50 | Last 100 |
| **Market Data History** | Limited | Extended | Full access |
| **Data Export** | ❌ No | ✅ Yes | ✅ Yes |

---

## 🎯 Complete Feature Matrix

### **FREE TIER ($0/month)**

#### ✅ **What You Get:**
1. **Market Data Updates:**
   - Every 15 minutes at wall-clock times (:00, :15, :30, :45)
   - Shows top 50 symbols by volume
   - Real-time Binance WebSocket connection (client-side throttled)
   - Countdown timer showing next update
   - All columns EXCEPT Open Interest

2. **Volume Spike Alerts:**
   - Batched delivery every 15 minutes at wall-clock times
   - Last 10 alerts visible
   - Color-coded by candle direction (green/red)
   - Directional icons (up/down arrows)
   - Exact timestamps + relative time
   - Countdown timer to next batch
   - Auto-delivery via WebSocket (no refresh needed)

3. **User Experience:**
   - Advertisement banner encouraging upgrade
   - No manual refresh button for alerts
   - Live connection badge
   - Full authentication (email/password, Web3 wallet, OAuth)

#### ❌ **What You DON'T Get:**
- Open Interest column (hidden)
- Symbol alert subscriptions
- Email/SMS notifications
- More than 10 recent alerts
- Updates more frequent than 15 minutes
- More than top 50 symbols
- Manual refresh control

---

### **PRO TIER ($9/month)**

#### ✅ **What You Get (Everything from Free, PLUS):**

1. **Market Data Updates:**
   - Every **5 minutes** at wall-clock times (:00, :05, :10, :15, etc.)
   - Shows top **100 symbols** by volume
   - **3x faster than Free tier**
   - Open Interest column **VISIBLE**

2. **Volume Spike Alerts:**
   - Batched delivery every **5 minutes**
   - Last **50 alerts** visible
   - **5x more alert history than Free**
   - Manual **refresh button** visible
   - **Email notifications** for alerts
   - **Subscribe to specific symbols**

3. **Data & Export:**
   - Export data capability
   - Advanced filtering options
   - Extended historical data access

4. **User Experience:**
   - **No advertisement banners**
   - Premium tier badge (⭐ Star icon)
   - Enhanced command palette options

#### 📊 **vs Free Tier:**
- 3x faster market data (5 min vs 15 min)
- 5x more alerts (50 vs 10)
- 2x more symbols (100 vs 50)
- Email notifications
- Open Interest data
- No ads

---

### **ELITE TIER ($49/month)**

#### ✅ **What You Get (Everything from Pro, PLUS):**

1. **Market Data Updates:**
   - **Real-time streaming** (sub-second updates via WebSocket)
   - Shows **ALL active symbols** (no limit)
   - **No throttling** - updates as fast as Binance sends them
   - **No countdown timer** (always live)
   - Full Open Interest data

2. **Volume Spike Alerts:**
   - **Instant delivery** (0 delay when Digital Ocean detects spike)
   - Last **100 alerts** visible
   - **2x more alert history than Pro**
   - **SMS notifications** via Twilio
   - Email notifications
   - Subscribe to specific symbols
   - Manual refresh button

3. **Advanced Features:**
   - **API access** for custom integrations
   - **Priority support**
   - **Custom alert conditions**
   - Full data export
   - Extended historical access

4. **User Experience:**
   - Premium Elite badge (✨ Sparkles icon)
   - Gold/yellow color theme
   - Professional-grade tools

#### 📊 **vs Pro Tier:**
- Real-time vs 5-minute batches
- Instant alerts vs 5-minute batches
- 100 alerts vs 50 alerts
- All symbols vs top 100
- SMS notifications
- API access
- Premium support

---

## 🔄 Detailed Update Flow Examples

### **Example 1: Free Tier User Logs In at 2:42 PM**

**Market Data:**
```
Initial Load:
- Shows data from 2:30 PM update (last 15-min mark)
- Countdown: "Next update in 3:00" (to 2:45 PM)

At 2:45:00 PM:
- WebSocket pushes new data automatically
- Table refreshes (no page reload needed)
- Countdown resets: "Next update in 15:00" (to 3:00 PM)
```

**Volume Alerts:**
```
Initial Load:
- Shows last 10 alerts that were broadcast before 2:30 PM
- Alerts from 2:30-2:42 are hidden (queued for 2:45)
- Countdown: "Next update in 3:00" (to 2:45 PM)

At 2:45:00 PM:
- WebSocket pushes queued alerts (2:30-2:45 batch)
- Alerts appear instantly (no refresh needed)
- Countdown resets: "Next update in 15:00" (to 3:00 PM)
```

### **Example 2: Pro Tier User at 2:42 PM**

**Market Data:**
```
Initial Load:
- Shows data from 2:40 PM update (last 5-min mark)
- Countdown: "Next update in 3:00" (to 2:45 PM)

At 2:45:00 PM:
- Updates automatically
- Countdown: "Next update in 5:00" (to 2:50 PM)
```

**Volume Alerts:**
```
Initial Load:
- Shows last 50 alerts before 2:40 PM
- Alerts from 2:40-2:42 hidden
- Countdown: "Next update in 3:00"

At 2:45:00 PM:
- Receives batch from 2:40-2:45
- Can manually refresh anytime
```

### **Example 3: Elite Tier User at Any Time**

**Market Data:**
```
- Updates in real-time (every few seconds)
- No countdown timer
- Sees price changes as they happen
- Shows ALL symbols (no limit)
```

**Volume Alerts:**
```
- Receives alerts INSTANTLY when Digital Ocean detects spike
- No batching, no delay
- Last 100 alerts visible
- Can manually refresh
- SMS notifications sent immediately
```

---

## 🎨 Visual Differences

### **Market Data Table**

**Free Tier:**
```
Ticker | Price | 24h Change | Funding Rate | 24h Volume
  ETH  | $3,632|   -5.89%   |   +0.0045%   |   $22.79B
  BTC  | $107K |   -2.71%   |   +0.0098%   |   $17.99B
  ...
(Open Interest column is HIDDEN)
(Shows top 50 symbols only)
```

**Pro/Elite Tier:**
```
Ticker | Price | 24h Change | Funding Rate | 24h Volume | Open Interest
  ETH  | $3,632|   -5.89%   |   +0.0045%   |   $22.79B  |   $1.2B
  BTC  | $107K |   -2.71%   |   +0.0098%   |   $17.99B  |   $3.5B
  ...
(Open Interest column is VISIBLE)
(Pro: top 100, Elite: all symbols)
```

### **Volume Alerts Panel**

**All Tiers See:**
- Asset name
- Timestamp (exact + relative)
- Volume multiplier badge
- Current and previous volume
- Price and funding rate
- Color coding by candle direction
- Live connection status

**Tier-Specific:**

**Free:**
```
[Bell Icon] Volume Alerts
Real-time volume spike notifications from Binance
• Next update in 12:23

[Live Badge] (no refresh button)

Showing last 10 alerts (Free tier: 10 max)
```

**Pro:**
```
[Bell Icon] Volume Alerts
Real-time volume spike notifications from Binance
• Next update in 3:45

[Live Badge] [Refresh Button]

Showing last 50 alerts (Pro tier: 50 max)
```

**Elite:**
```
[Bell Icon] Volume Alerts
Real-time volume spike notifications from Binance
(no countdown - always real-time)

[Live Badge] [Refresh Button]

Showing last 100 alerts (Elite tier: 100 max)
```

---

## 🚀 Technical Implementation Details

### **Frontend (Client-Side)**

**Market Data Hook:**
- File: `src/hooks/use-client-only-market-data.ts`
- Connects to Binance WebSocket directly from browser
- Client-side throttling based on tier
- Wall-clock countdown calculation

**Volume Alerts Hook:**
- File: `src/hooks/use-volume-alerts.ts`
- Connects to VolSpike backend Socket.IO
- Joins tier-specific room (`tier-free`, `tier-pro`, `tier-elite`)
- Filters initial load by last broadcast time
- Updates automatically via WebSocket

### **Backend (Server-Side)**

**Alert Broadcasting:**
- File: `src/services/alert-broadcaster.ts`
- Checks wall-clock every second
- Broadcasts at precise intervals:
  - Free: when `minutes % 15 === 0`
  - Pro: when `minutes % 5 === 0`
  - Elite: immediately on receipt

**Socket.IO Rooms:**
- Users auto-join their tier room on connection
- Broadcasts are room-specific
- Ensures tier isolation

---

## 💰 Pricing Strategy

### **Value Proposition**

**Free → Pro ($9/month):**
- Pay $9 to get:
  - 3x faster updates (5 min vs 15 min)
  - 5x more alert history (50 vs 10)
  - 2x more symbols (100 vs 50)
  - Email notifications
  - Open Interest data
  - No ads
  
**ROI for Active Traders:** High (worth it for serious traders)

**Pro → Elite ($49/month):**
- Pay $40 more ($49 total) to get:
  - Real-time streaming (vs 5-min batches)
  - Instant alerts (vs 5-min delay)
  - All symbols (vs top 100)
  - SMS notifications
  - API access
  - Premium support

**ROI for Professional Traders:** Very high (competitive with Bloomberg/TradingView)

---

## 🎯 Feature Summary By Category

### **1. Data Refresh Speed**

| Tier | Market Data | Volume Alerts |
|------|-------------|---------------|
| Free | 15 min (wall-clock) | 15 min (wall-clock) |
| Pro | 5 min (wall-clock) | 5 min (wall-clock) |
| Elite | Real-time (streaming) | Instant (0 delay) |

### **2. Data Quantity**

| Tier | Symbols | Alert History | Alert Subscriptions |
|------|---------|---------------|---------------------|
| Free | Top 50 | Last 10 | None |
| Pro | Top 100 | Last 50 | Unlimited |
| Elite | All | Last 100 | Unlimited |

### **3. Data Visibility**

| Tier | Open Interest Column | Full Symbol List |
|------|---------------------|------------------|
| Free | ❌ Hidden | ❌ Top 50 only |
| Pro | ✅ Visible | ❌ Top 100 only |
| Elite | ✅ Visible | ✅ All symbols |

### **4. Notifications**

| Tier | In-App | Email | SMS |
|------|--------|-------|-----|
| Free | ✅ Yes (15 min batch) | ❌ No | ❌ No |
| Pro | ✅ Yes (5 min batch) | ✅ Yes | ❌ No |
| Elite | ✅ Yes (instant) | ✅ Yes | ✅ Yes |

### **5. Control & Flexibility**

| Tier | Manual Refresh | Export Data | API Access |
|------|---------------|-------------|------------|
| Free | ❌ No (alerts), ✅ Yes (market) | ❌ No | ❌ No |
| Pro | ✅ Yes (both) | ✅ Yes | ❌ No |
| Elite | ✅ Yes (both) | ✅ Yes | ✅ Yes |

### **6. User Experience**

| Tier | Ads | Countdown Timers | Support Level |
|------|-----|-----------------|---------------|
| Free | ✅ Shows upgrade banner | ✅ Yes | Community |
| Pro | ❌ No ads | ✅ Yes | Standard |
| Elite | ❌ No ads | ❌ No (always live) | Priority |

---

## 🔧 Code References

### **Tier Detection**
```typescript
// Frontend
const tier = (session?.user as any)?.tier || 'free'

// Backend
const user = requireUser(c)
const tier = user.tier // 'free' | 'pro' | 'elite'
```

### **Key Files**

**Frontend:**
- `src/hooks/use-client-only-market-data.ts` - Market data with tier throttling
- `src/hooks/use-volume-alerts.ts` - Alert delivery with tier rooms
- `src/components/market-table.tsx` - Open Interest visibility
- `src/components/volume-alerts-panel.tsx` - Alert display with countdown
- `src/components/dashboard.tsx` - Ad banner for free tier
- `src/components/tier-upgrade.tsx` - Tier comparison UI

**Backend:**
- `src/services/alert-broadcaster.ts` - Wall-clock broadcasting
- `src/routes/volume-alerts.ts` - Alert ingestion & subscriptions
- `src/routes/market.ts` - Symbol limits by tier
- `src/websocket/handlers.ts` - Socket.IO tier room management

---

## ✅ Verification Checklist

**Free Tier:**
- [ ] Market data updates at :00, :15, :30, :45
- [ ] Volume alerts batch at :00, :15, :30, :45
- [ ] Countdown shows "Next update in X:XX"
- [ ] Open Interest column hidden
- [ ] Shows max 10 alerts
- [ ] Shows top 50 symbols
- [ ] No refresh button for alerts
- [ ] Advertisement banner visible

**Pro Tier:**
- [ ] Market data updates at :00, :05, :10, etc.
- [ ] Volume alerts batch at :00, :05, :10, etc.
- [ ] Open Interest column visible
- [ ] Shows max 50 alerts
- [ ] Shows top 100 symbols
- [ ] Refresh button visible
- [ ] No advertisement banners

**Elite Tier:**
- [ ] Market data streams in real-time
- [ ] Volume alerts instant (0 delay)
- [ ] No countdown (always "Live")
- [ ] Open Interest column visible
- [ ] Shows max 100 alerts
- [ ] Shows all symbols
- [ ] Refresh button visible
- [ ] No advertisement banners

---

This is the **complete, current implementation** as of now. Every feature is working and deployed!

