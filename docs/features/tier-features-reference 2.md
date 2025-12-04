# VolSpike Tier Features - Comprehensive Documentation

**Last Updated:** December 2025  
**Status:** Production Ready (Free & Pro), Elite Tier Coming Soon

---

## Table of Contents

1. [Overview](#overview)
2. [Free Tier](#free-tier)
3. [Pro Tier](#pro-tier)
4. [Elite Tier](#elite-tier)
5. [Feature Comparison Matrix](#feature-comparison-matrix)
6. [Implementation Details](#implementation-details)
7. [Missing Features & Roadmap](#missing-features--roadmap)
8. [Technical Architecture](#technical-architecture)

---

## Overview

VolSpike offers three subscription tiers designed to serve traders at different levels of engagement:

- **Free Tier** ($0/month): Entry-level access for casual traders
- **Pro Tier** ($9/month): Enhanced features for active traders
- **Elite Tier** ($49/month): Professional-grade tools for serious traders (Coming Soon)

All tiers use **client-side Binance WebSocket connections** directly from the browser, eliminating server-side data ingestion costs and IP blocking issues. Tier differences are enforced through:

- **Frontend throttling** (refresh intervals)
- **Symbol limits** (number of trading pairs visible)
- **Alert limits** (number of volume spike alerts)
- **Feature gates** (Open Interest, exports, notifications)
- **Backend rate limiting** (API request limits)

---

## Free Tier

### ✅ Implemented Features

#### 1. **Market Data Updates (15-minute cadence)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Direct Binance WebSocket connection from browser (`wss://fstream.binance.com/stream`)
  - Frontend throttling: Updates emitted every 15 minutes (900,000ms interval)
  - Client-side data processing using `useClientOnlyMarketData` hook
  - Automatic reconnection with exponential backoff
  - localStorage fallback for region-blocked users
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-binance-websocket.ts`
  - Throttling: `MIN_INTERVAL = 900_000` (15 minutes)
  - WebSocket streams: `!ticker@arr` and `!markPrice@arr`
- **User Experience:**
  - "Connected" badge shows connection status
  - Data updates automatically every 15 minutes
  - No manual refresh needed

#### 2. **Top 50 Symbols by Volume**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Market data filtered to top 50 USDT pairs by 24h volume
  - Sorting by volume (highest to lowest) happens client-side
  - Filter applied in `useClientOnlyMarketData` hook
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts`
  - Code: `tierLimits.free = 50`
  - Backend also enforces: `volspike-nodejs-backend/src/routes/market.ts` (lines 97-101)
- **User Experience:**
  - Table shows "Top 50 symbols (Free tier)" badge
  - Only top 50 rows visible in Market Data table

#### 3. **Volume Spike Alerts (10 alerts, 15-minute batches)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Digital Ocean Python script detects volume spikes
  - Posts alerts to `/api/volume-alerts/ingest` endpoint
  - Alerts stored in `VolumeAlert` database table
  - Socket.IO broadcasts to `tier-free` room at wall-clock intervals (:00, :15, :30, :45)
  - Frontend limits display to last 10 alerts
- **Implementation:**
  - Backend: `volspike-nodejs-backend/src/services/alert-broadcaster.ts`
  - Frontend: `volspike-nextjs-frontend/src/hooks/use-volume-alerts.ts`
  - Wall-clock batching: Checks every second for :00, :15, :30, :45 marks
  - Limit: `getTierLimit('free')` returns 10
- **User Experience:**
  - Volume Alerts panel shows countdown to next batch
  - Color-coded alerts (green for bullish, red for bearish)
  - "Exact Time (Relative Time ago)" timestamp format
  - Two-line volume display: "This hour: $X" / "Last hour: $Y"

#### 4. **TradingView Watchlist Export**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Export button in Market Data table header
  - Generates `.txt` file with TradingView-compatible format
  - Limited to top 50 symbols for Free tier
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/components/watchlist-export-button.tsx`
  - Function: `generateTradingViewWatchlist(data, limit)` with `limit = 50` for Free
  - Format: One symbol per line (e.g., `BINANCE:BTCUSDT.P`)
- **User Experience:**
  - Export dropdown shows "TradingView (.txt)" option
  - Tooltip: "Top 50 symbols"
  - File downloads automatically

#### 5. **Live Binance WebSocket Connection**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Direct WebSocket connection from browser to Binance
  - No server-side proxy or Redis dependency
  - Real-time ticker and funding rate updates
  - Automatic reconnection on disconnect
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-binance-websocket.ts`
  - URL: `wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr`
  - Reconnection: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **User Experience:**
  - "Connected" badge with pulsing indicator
  - Real-time price updates (with flash animations if enabled)
  - Funding rate updates in real-time

#### 6. **Basic Volume Analytics**
- **Status:** ✅ Implemented (Basic)
- **How it works:**
  - Volume displayed in Market Data table
  - 24h change percentage shown
  - Volume formatted as $X.XXM, $X.XXB, etc.
- **Implementation:**
  - Displayed in Market Data table columns
  - Formatting: `formatVolume()` function
- **User Experience:**
  - Volume column shows 24h volume
  - Change column shows percentage change
  - Color-coded (green for positive, red for negative)

### ⚠️ Teaser Features (Upgrade Prompts)

#### 1. **Open Interest Column (Teaser)**
- **Status:** ✅ Teaser Implemented
- **Reason:** Premium feature reserved for Pro/Elite tiers, shown as teaser to encourage upgrades
- **Implementation:**
  - Open Interest column always visible for all tiers
  - Free tier sees blurred/faded placeholder values with lock icon overlay
  - Beautiful tooltip explains the feature and prompts upgrade to Pro
  - Component: `volspike-nextjs-frontend/src/components/oi-teaser-cell.tsx`
  - CSS: `globals.css` (OI Teaser Effect section)
  - Code in `market-table.tsx` uses `OITeaserCell` and `OITeaserHeader` for free tier
- **Design:**
  - Placeholder values generated from volume (30-60% of 24h volume)
  - 4px blur with 50% opacity on placeholder values
  - Hover reveals "Pro" badge with lock icon
  - Tooltip with Pro-cyan gradient accent bar
  - Tooltip explains OI benefits and links to pricing page
- **User Experience:**
  - Free users see the OI column structure with blurred values
  - Hovering shows lock overlay with "Pro" badge
  - Clicking/hovering shows elegant tooltip with upgrade prompt
  - Detail drawer also shows OI teaser for free tier
  - Pro/Elite users see real OI data without any restrictions

#### 2. **Email/SMS Notifications**
- **Status:** ❌ Not Available (By Design)
- **Reason:** Premium feature reserved for Pro/Elite tiers
- **Implementation:**
  - No email/SMS sending infrastructure for Free tier
  - Alert subscriptions API returns 403 for Free tier users
- **User Experience:**
  - No notification settings available
  - Alerts only visible in-app

#### 3. **CSV/JSON Exports**
- **Status:** ❌ Not Available (By Design)
- **Reason:** Premium feature reserved for Pro/Elite tiers
- **Implementation:**
  - Export dropdown shows CSV/JSON options but they're disabled
  - Code: `userTier === 'free'` check in `watchlist-export-button.tsx` (lines 64, 84)
- **User Experience:**
  - CSV/JSON options show lock icon
  - Tooltip: "CSV export is available for signed-in Pro/Elite tiers"
  - Clicking shows error toast

---

## Pro Tier

### ✅ Implemented Features

#### 1. **Market Data Updates (5-minute cadence)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same Binance WebSocket connection as Free tier
  - Frontend throttling: Updates emitted every 5 minutes (300,000ms interval)
  - Faster refresh rate than Free tier
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-binance-websocket.ts`
  - Throttling: `MIN_INTERVAL = 300_000` (5 minutes)
- **User Experience:**
  - Data updates every 5 minutes instead of 15
  - Faster access to market changes

#### 2. **Top 100 Symbols by Volume**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Market data filtered to top 100 USDT pairs by volume
  - Double the symbol limit of Free tier
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts`
  - Code: `tierLimits.pro = 100`
  - Backend also enforces: `volspike-nodejs-backend/src/routes/market.ts` (lines 102-106)
- **User Experience:**
  - Table shows "100 symbols" badge
  - More trading pairs available for analysis

#### 3. **Volume Spike Alerts (50 alerts, 5-minute batches)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same alert ingestion system as Free tier
  - Socket.IO broadcasts to `tier-pro` room at 5-minute intervals (:00, :05, :10, :15, etc.)
  - Frontend limits display to last 50 alerts
- **Implementation:**
  - Backend: `volspike-nodejs-backend/src/services/alert-broadcaster.ts`
  - Wall-clock batching: Checks every second for 5-minute marks
  - Limit: `getTierLimit('pro')` returns 50
- **User Experience:**
  - Countdown timer shows time until next 5-minute batch
  - More alerts visible than Free tier
  - Faster alert delivery than Free tier

#### 4. **Open Interest Column Visible**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Open Interest data fetched from backend `/api/market/open-interest` endpoint
  - Data cached and matched with WebSocket ticker data
  - Column displayed in Market Data table
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/components/market-table.tsx`
  - Code: `userTier !== 'free'` check (line 607)
  - Backend: `volspike-nodejs-backend/src/routes/market.ts` (Open Interest endpoint)
  - Data matching: Symbol normalization to uppercase for consistent matching
- **User Experience:**
  - Open Interest column visible in table
  - Sortable by Open Interest
  - Shows in symbol detail drawer
  - "OI updated Xs ago" timestamp in status bar

#### 5. **Email Notifications**
- **Status:** ⚠️ Partially Implemented
- **How it works:**
  - Infrastructure exists: SendGrid integration configured
  - Email service: `volspike-nodejs-backend/src/services/email.ts`
  - Tier upgrade emails sent automatically on subscription change
  - **Missing:** Volume alert email notifications not yet connected
- **Implementation:**
  - SendGrid API key configured in environment variables
  - Email templates exist for tier upgrades
  - Alert subscription system exists (`AlertSubscription` model)
  - **TODO:** Connect volume alert broadcaster to email service for Pro users
- **User Experience:**
  - Tier upgrade emails work
  - Volume alert emails not yet sent (infrastructure ready)

#### 6. **Subscribe to Specific Symbols**
- **Status:** ✅ Backend Implemented, ⚠️ UI May Be Missing
- **How it works:**
  - Users can subscribe to specific symbols (e.g., "BTCUSDT") or all symbols ("*")
  - Subscriptions stored in `AlertSubscription` database table
  - Backend API endpoints exist for CRUD operations
- **Implementation:**
  - Backend: `volspike-nodejs-backend/src/routes/volume-alerts.ts`
  - Endpoints:
    - `POST /api/volume-alerts/subscriptions` - Create subscription
    - `GET /api/volume-alerts/subscriptions` - List subscriptions
    - `DELETE /api/volume-alerts/subscriptions/:symbol` - Remove subscription
  - Database: `AlertSubscription` model in Prisma schema
  - **TODO:** Verify UI exists for managing subscriptions
- **User Experience:**
  - Backend ready for symbol subscriptions
  - UI may need to be built/verified

#### 7. **CSV & JSON Data Export**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Export dropdown includes CSV and JSON options
  - CSV: Comma-separated values with all market data columns
  - JSON: Full data structure with all fields
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/components/watchlist-export-button.tsx`
  - Functions: `generateCSV()` and `generateJSON()`
  - Code: `userTier === 'free'` check prevents Free tier access (lines 64, 84)
- **User Experience:**
  - Export dropdown shows CSV and JSON options
  - No lock icons (unlocked for Pro)
  - Files download automatically with formatted data

#### 8. **Ad-Free Experience**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Advertisement banners hidden for Pro/Elite users
  - Header banner component checks tier before rendering
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/components/header-with-banner.tsx`
  - Code: `showAdBanner = !isPricingPage && userTier === 'free'`
- **User Experience:**
  - No promotional banners shown
  - Cleaner interface

#### 9. **Manual Refresh Control**
- **Status:** ✅ Implemented (Via WebSocket)
- **How it works:**
  - WebSocket connection provides automatic updates
  - Users can refresh page for immediate data reload
  - No explicit "Refresh" button needed (data updates automatically)
- **Implementation:**
  - Automatic via WebSocket connection
  - Page refresh triggers new data fetch
- **User Experience:**
  - Data updates automatically every 5 minutes
  - Page refresh provides immediate update

### ⚠️ Partially Implemented Features

#### 1. **Email Notifications for Volume Alerts**
- **Status:** ⚠️ Infrastructure Ready, Not Connected
- **What's Missing:**
  - Volume alert broadcaster doesn't send emails to Pro users
  - Need to integrate `EmailService` into `alert-broadcaster.ts`
  - Need to check user's `AlertSubscription` preferences
- **How to Implement:**
  1. In `volspike-nodejs-backend/src/services/alert-broadcaster.ts`:
     - When broadcasting to Pro tier, check for users with email alerts enabled
     - Query `AlertSubscription` table for users subscribed to the alert's symbol
     - Call `EmailService.sendVolumeAlertEmail()` for each subscribed user
  2. Create email template in `EmailService`:
     - Subject: "Volume Spike Alert: {SYMBOL}"
     - Body: Include symbol, volume ratio, price, funding rate, timestamp
  3. Add user preference check:
     - Query `Preference` table for `emailAlerts` flag
     - Only send if user has email alerts enabled

---

## Elite Tier

### ✅ Implemented Features

#### 1. **Real-Time Streaming Updates (0ms delay)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same Binance WebSocket connection
  - Frontend throttling: `MIN_INTERVAL = 0` (no throttling)
  - Updates emitted immediately when WebSocket receives data
  - Sub-second latency (<150ms typical)
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-binance-websocket.ts`
  - Throttling: `MIN_INTERVAL = 0` for Elite tier
  - Code: `tier === 'elite' ? 0 : ...`
- **User Experience:**
  - Instant price updates
  - Real-time funding rate changes
  - No delay between Binance data and UI display

#### 2. **Unlimited Symbols (All Active Pairs)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - No symbol limit applied
  - All USDT pairs with >$100M volume shown
  - No filtering by count
- **Implementation:**
  - File: `volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts`
  - Code: `tierLimits.elite = out.length` (no slice)
  - Backend: No filtering for Elite tier (line 108 in `market.ts`)
- **User Experience:**
  - All available symbols visible
  - No "Top X symbols" badge
  - Full market coverage

#### 3. **Volume Spike Alerts (100 alerts, instant delivery)**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same alert ingestion system
  - Socket.IO broadcasts to `tier-elite` room immediately (no batching)
  - Frontend limits display to last 100 alerts
  - Zero-delay alert delivery
- **Implementation:**
  - Backend: `volspike-nodejs-backend/src/services/alert-broadcaster.ts`
  - Code: `ioInstance.to('tier-elite').emit('volume-alert', alert)` (line 64)
  - No queuing for Elite tier (immediate broadcast)
  - Limit: `getTierLimit('elite')` returns 100
- **User Experience:**
  - Alerts appear instantly when volume spike detected
  - No countdown timer (instant delivery)
  - More alerts visible than Pro tier

#### 4. **Open Interest Column Visible**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same as Pro tier
  - Open Interest data fetched and displayed
- **Implementation:**
  - Same as Pro tier
- **User Experience:**
  - Open Interest visible
  - Real-time updates

#### 5. **Email Notifications**
- **Status:** ⚠️ Same as Pro Tier (Infrastructure Ready, Not Connected)
- **How it works:**
  - Same email infrastructure as Pro tier
  - **Missing:** Volume alert email notifications not connected
- **Implementation:**
  - Same as Pro tier
  - **TODO:** Same implementation needed as Pro tier

#### 6. **CSV & JSON Data Export**
- **Status:** ✅ Fully Implemented
- **How it works:**
  - Same as Pro tier
  - All symbols exportable
- **Implementation:**
  - Same as Pro tier
- **User Experience:**
  - Full data export available

#### 7. **Subscribe to Specific Symbols**
- **Status:** ✅ Backend Implemented, ⚠️ UI May Be Missing
- **How it works:**
  - Same as Pro tier
- **Implementation:**
  - Same as Pro tier

### ❌ Missing Features (Coming Soon)

#### 1. **SMS Notifications**
- **Status:** ❌ Not Implemented
- **Infrastructure:** ⚠️ Partially Ready
  - Twilio credentials configured in environment variables
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` exist
  - No SMS service implementation found
- **How to Implement:**
  1. Create SMS service:
     - File: `volspike-nodejs-backend/src/services/sms.ts`
     - Use Twilio SDK: `import twilio from 'twilio'`
     - Function: `sendSMSAlert(userPhone, alert)` 
  2. Integrate with alert broadcaster:
     - In `alert-broadcaster.ts`, check user tier and SMS preferences
     - Query `Preference` table for `smsAlerts` flag
     - Call SMS service for Elite users with SMS enabled
  3. Add phone number collection:
     - Add `phoneNumber` field to `User` model (or `Preference` model)
     - Create UI in Settings for phone number entry
     - Validate phone numbers (E.164 format)
  4. Rate limiting:
     - Implement SMS rate limiting (e.g., max 10 SMS per hour per user)
     - Prevent spam/abuse
- **Estimated Effort:** 2-3 days
- **Dependencies:**
  - Twilio account setup
  - Phone number validation
  - User preference UI

#### 2. **Full API Access**
- **Status:** ❌ Not Implemented
- **What's Missing:**
  - No API key generation system
  - No API authentication middleware
  - No API documentation
  - No rate limiting for API keys
- **How to Implement:**
  1. Create API key system:
     - Add `apiKey` field to `User` model (hashed)
     - Add `apiKeyCreatedAt`, `apiKeyLastUsedAt` fields
     - Generate API keys on demand (UUID or similar)
  2. Create API authentication middleware:
     - File: `volspike-nodejs-backend/src/middleware/api-auth.ts`
     - Check `Authorization: Bearer {apiKey}` header
     - Validate API key and load user
     - Set user context for request
  3. Create API routes:
     - File: `volspike-nodejs-backend/src/routes/api/v1/`
     - Endpoints:
       - `GET /api/v1/market/data` - Market data
       - `GET /api/v1/market/symbol/:symbol` - Specific symbol
       - `GET /api/v1/alerts` - Volume alerts
       - `GET /api/v1/alerts/subscriptions` - User subscriptions
       - `POST /api/v1/alerts/subscriptions` - Create subscription
  4. API documentation:
     - Create OpenAPI/Swagger spec
     - Document all endpoints, parameters, responses
     - Add to `/docs` route
  5. Rate limiting:
     - Higher limits for Elite tier API keys
     - Track usage per API key
     - Implement per-key rate limits
- **Estimated Effort:** 1-2 weeks
- **Dependencies:**
  - API key management UI
  - API documentation tooling
  - Rate limiting infrastructure

#### 3. **Priority Support**
- **Status:** ❌ Not Implemented
- **What's Missing:**
  - No support ticket system
  - No priority queue
  - No support channel integration
- **How to Implement:**
  1. Create support ticket system:
     - Add `SupportTicket` model to Prisma schema
     - Fields: `userId`, `subject`, `message`, `priority`, `status`, `assignedTo`
     - Priority levels: `LOW`, `NORMAL`, `HIGH`, `URGENT`
  2. Create support UI:
     - File: `volspike-nextjs-frontend/src/app/support/`
     - Ticket creation form
     - Ticket list view
     - Ticket detail view
  3. Implement priority logic:
     - Elite tier tickets automatically set to `HIGH` priority
     - Pro tier tickets set to `NORMAL`
     - Free tier tickets set to `LOW`
  4. Admin support dashboard:
     - File: `volspike-nextjs-frontend/src/app/(admin)/support/`
     - Ticket queue sorted by priority
     - Assignment interface
     - Response interface
  5. Email notifications:
     - Send email to user when ticket created
     - Send email when ticket updated
     - Send email when ticket resolved
- **Estimated Effort:** 1-2 weeks
- **Dependencies:**
  - Support ticket UI
  - Admin support dashboard
  - Email templates

#### 4. **Custom Alert Conditions**
- **Status:** ❌ Not Implemented
- **What's Missing:**
  - No custom alert builder UI
  - No alert condition engine
  - No alert storage system
- **How to Implement:**
  1. Create alert condition model:
     - Add `CustomAlert` model to Prisma schema
     - Fields: `userId`, `name`, `conditions` (JSON), `isActive`
     - Conditions: Volume ratio, price change, funding rate thresholds
  2. Create alert builder UI:
     - File: `volspike-nextjs-frontend/src/components/alert-builder.tsx` (exists but may need enhancement)
     - Visual condition builder
     - Condition preview
     - Test conditions
  3. Create alert evaluation engine:
     - File: `volspike-nodejs-backend/src/services/alert-evaluator.ts`
     - Evaluate conditions against market data
     - Trigger alerts when conditions met
  4. Integrate with alert broadcaster:
     - Check custom alerts when volume alerts broadcast
     - Evaluate custom conditions
     - Send alerts if conditions met
  5. Alert management UI:
     - List custom alerts
     - Enable/disable alerts
     - Edit/delete alerts
- **Estimated Effort:** 2-3 weeks
- **Dependencies:**
  - Alert builder UI enhancement
  - Alert evaluation engine
  - Alert storage system

#### 5. **Advanced Analytics**
- **Status:** ❌ Not Implemented
- **What's Missing:**
  - No charts/graphs
  - No historical data analysis
  - No trend indicators
  - No volume analysis tools
- **How to Implement:**
  1. Create analytics data model:
     - Use existing `MarketSnapshot` TimescaleDB hypertable
     - Store historical data points
     - Aggregate data for charts
  2. Create chart components:
     - Use Recharts or Chart.js
     - Volume charts (24h, 7d, 30d)
     - Price charts with funding rate overlay
     - Volume ratio trends
  3. Create analytics page:
     - File: `volspike-nextjs-frontend/src/app/analytics/`
     - Symbol selector
     - Time range selector
     - Chart display
  4. Add analytics endpoints:
     - `GET /api/analytics/volume/:symbol` - Volume history
     - `GET /api/analytics/price/:symbol` - Price history
     - `GET /api/analytics/funding/:symbol` - Funding rate history
  5. Advanced features:
     - Volume spike detection visualization
     - Correlation analysis
     - Trend indicators
     - Custom time ranges
- **Estimated Effort:** 2-3 weeks
- **Dependencies:**
  - Chart library integration
  - Historical data aggregation
  - Analytics UI components

#### 6. **Elite Tier Purchase Flow**
- **Status:** ⚠️ UI Shows "Coming Soon", Purchase Disabled
- **Current State:**
  - Pricing page shows Elite tier with "Coming Soon" badge
  - Purchase button disabled
  - All UI references updated to show "Coming Soon"
- **What's Needed:**
  - Enable purchase button when Elite tier ready
  - Add Stripe product/price for Elite tier ($49/month)
  - Add NowPayments support for Elite tier
  - Test upgrade flow from Pro to Elite
- **Estimated Effort:** 1 day
- **Dependencies:**
  - Stripe product creation
  - NowPayments tier support
  - Testing

---

## Feature Comparison Matrix

| Feature | Free Tier | Pro Tier | Elite Tier |
|--------|-----------|----------|-----------|
| **Price** | $0/month | $9/month | $49/month |
| **Market Data Refresh** | 15 minutes | 5 minutes | Real-time (0ms) |
| **Symbol Limit** | Top 50 | Top 100 | Unlimited |
| **Volume Alerts** | 10 alerts | 50 alerts | 100 alerts |
| **Alert Delivery** | 15-min batches | 5-min batches | Instant (0 delay) |
| **Open Interest** | ⚠️ Teaser | ✅ Yes | ✅ Yes |
| **Email Notifications** | ❌ No | ⚠️ Partial | ⚠️ Partial |
| **SMS Notifications** | ❌ No | ❌ No | ❌ Not Yet |
| **Symbol Subscriptions** | ❌ No | ✅ Yes | ✅ Yes |
| **CSV Export** | ❌ No | ✅ Yes | ✅ Yes |
| **JSON Export** | ❌ No | ✅ Yes | ✅ Yes |
| **TradingView Export** | ✅ Top 50 | ✅ All | ✅ All |
| **API Access** | ❌ No | ❌ No | ❌ Not Yet |
| **Priority Support** | ❌ No | ❌ No | ❌ Not Yet |
| **Custom Alerts** | ❌ No | ❌ No | ❌ Not Yet |
| **Advanced Analytics** | ❌ No | ❌ No | ❌ Not Yet |
| **Ad-Free** | ❌ No | ✅ Yes | ✅ Yes |

**Legend:**
- ✅ = Fully Implemented
- ⚠️ = Partially Implemented / Teaser (prompts upgrade)
- ❌ = Not Implemented

---

## Implementation Details

### Tier Detection

Tier is determined from the user's session:

```typescript
// Frontend
const tier = (session?.user as any)?.tier || 'free'

// Backend
const user = requireUser(c)
const tier = user?.tier || 'free'
```

### Throttling Implementation

**Frontend Throttling (Client-Side):**
```typescript
// volspike-nextjs-frontend/src/hooks/use-binance-websocket.ts
const MIN_INTERVAL = tier === 'elite' ? 0 : (tier === 'pro' ? 300_000 : 900_000)
// Elite: 0ms (no throttling)
// Pro: 300,000ms (5 minutes)
// Free: 900,000ms (15 minutes)
```

**Backend Rate Limiting:**
```typescript
// volspike-nodejs-backend/src/middleware/rate-limit.ts
const rateLimits = {
  free: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
  pro: { windowMs: 5 * 60 * 1000, maxRequests: 500 },
  elite: { windowMs: 1 * 60 * 1000, maxRequests: 1000 }
}
```

### Alert Broadcasting

**Wall-Clock Batching:**
- Free: Broadcasts at :00, :15, :30, :45 (every 15 minutes)
- Pro: Broadcasts at :00, :05, :10, :15, :20, etc. (every 5 minutes)
- Elite: Broadcasts immediately (no batching)

**Implementation:**
```typescript
// volspike-nodejs-backend/src/services/alert-broadcaster.ts
// Elite: Immediate broadcast
ioInstance.to('tier-elite').emit('volume-alert', alert)

// Pro/Free: Queue for batch
alertQueues.pro.push(alert)
alertQueues.free.push(alert)

// Wall-clock batching checks every second
setInterval(() => {
  if (isAtInterval(5)) { /* Broadcast Pro alerts */ }
  if (isAtInterval(15)) { /* Broadcast Free alerts */ }
}, 1000)
```

### Symbol Limits

**Frontend:**
```typescript
// volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts
const tierLimits = {
  free: 50,
  pro: 100,
  elite: out.length // No limit
}
return out.slice(0, limit)
```

**Backend:**
```typescript
// volspike-nodejs-backend/src/routes/market.ts
if (tier === 'free') {
  filteredData = marketData.sort(...).slice(0, 50)
} else if (tier === 'pro') {
  filteredData = marketData.sort(...).slice(0, 100)
}
// Elite: No filtering
```

### Export Features

**TradingView Export:**
- Free: Top 50 symbols
- Pro/Elite: All symbols

**CSV/JSON Export:**
- Free: Disabled (locked)
- Pro/Elite: Enabled (all data)

**Implementation:**
```typescript
// volspike-nextjs-frontend/src/components/watchlist-export-button.tsx
const limit = userTier === 'free' ? 50 : undefined // TradingView
if (guestMode || userTier === 'free') {
  toast.error('CSV export is available for signed-in Pro/Elite tiers')
  return
}
```

---

## Missing Features & Roadmap

### High Priority (Elite Tier Launch)

1. **SMS Notifications** (2-3 days)
   - Create SMS service
   - Integrate with alert broadcaster
   - Add phone number collection UI
   - Test SMS delivery

2. **Email Notifications for Volume Alerts** (1-2 days)
   - Connect email service to alert broadcaster
   - Create volume alert email template
   - Test email delivery for Pro/Elite

3. **Elite Tier Purchase Flow** (1 day)
   - Enable purchase button
   - Add Stripe product
   - Test upgrade flow

### Medium Priority (Post-Launch)

4. **Full API Access** (1-2 weeks)
   - API key generation
   - API authentication
   - API endpoints
   - API documentation

5. **Priority Support** (1-2 weeks)
   - Support ticket system
   - Priority queue
   - Admin dashboard

### Low Priority (Future Enhancements)

6. **Custom Alert Conditions** (2-3 weeks)
   - Alert builder UI
   - Condition engine
   - Alert management

7. **Advanced Analytics** (2-3 weeks)
   - Charts/graphs
   - Historical analysis
   - Trend indicators

---

## Technical Architecture

### Client-Side WebSocket Architecture

```
Browser → Binance WebSocket → useBinanceWebSocket Hook → Market Data
         (Direct Connection)    (Tier-Based Throttling)    (Tier-Based Limits)
```

**Benefits:**
- No server-side data ingestion costs
- No Redis dependency
- No IP blocking issues
- Scales with users (no server bottleneck)

### Alert Broadcasting Architecture

```
Digital Ocean Script → /api/volume-alerts/ingest → Database → Alert Broadcaster
                                                              ↓
                                                         Socket.IO Rooms
                                                              ↓
                    tier-free (15-min batches)    tier-pro (5-min batches)    tier-elite (instant)
```

### Tier Enforcement Points

1. **Frontend:**
   - `useClientOnlyMarketData` - Symbol limits
   - `useBinanceWebSocket` - Throttling intervals
   - `useVolumeAlerts` - Alert limits
   - `watchlist-export-button` - Export features
   - `market-table` - Open Interest column (real data for Pro/Elite, teaser for Free)
   - `oi-teaser-cell` - OI teaser component with blurred placeholder and upgrade tooltip

2. **Backend:**
   - `rate-limit.ts` - API rate limiting
   - `market.ts` - Symbol filtering
   - `volume-alerts.ts` - Alert limits
   - `alert-broadcaster.ts` - Alert delivery timing
   - `websocket/handlers.ts` - Socket room assignment

3. **Database:**
   - `User.tier` - Tier storage
   - `AlertSubscription` - Symbol subscriptions (Pro/Elite)
   - `Preference` - Notification preferences

---

## Testing Checklist

### Free Tier
- [ ] Market data updates every 15 minutes
- [ ] Only top 50 symbols visible
- [ ] Only 10 alerts visible
- [ ] Alerts delivered in 15-minute batches
- [ ] TradingView export works (top 50)
- [ ] CSV/JSON exports disabled
- [ ] Open Interest column shows teaser (blurred placeholder with lock)
- [ ] OI teaser tooltip shows upgrade prompt on hover
- [ ] Detail drawer OI section shows teaser for free tier
- [ ] Ad banners visible

### Pro Tier
- [ ] Market data updates every 5 minutes
- [ ] Top 100 symbols visible
- [ ] 50 alerts visible
- [ ] Alerts delivered in 5-minute batches
- [ ] Open Interest column visible
- [ ] CSV/JSON exports work
- [ ] TradingView export works (all symbols)
- [ ] Ad banners hidden
- [ ] Symbol subscriptions work (backend)
- [ ] Email notifications work (when implemented)

### Elite Tier
- [ ] Market data updates in real-time (<150ms)
- [ ] All symbols visible (unlimited)
- [ ] 100 alerts visible
- [ ] Alerts delivered instantly (0 delay)
- [ ] Open Interest column visible
- [ ] CSV/JSON exports work
- [ ] TradingView export works (all symbols)
- [ ] Ad banners hidden
- [ ] Symbol subscriptions work (backend)
- [ ] SMS notifications work (when implemented)
- [ ] API access works (when implemented)

---

## Conclusion

VolSpike's tier system is well-architected with clear separation between Free, Pro, and Elite tiers. The client-side WebSocket approach eliminates server costs while providing real-time data. Most core features are implemented, with Elite tier missing a few premium features (SMS, API access, priority support, custom alerts, advanced analytics) that are planned for future releases.

The system is production-ready for Free and Pro tiers, with Elite tier marked as "Coming Soon" until the remaining features are implemented.

---

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Maintained By:** VolSpike Development Team

