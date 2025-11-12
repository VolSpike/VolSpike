# VolSpike Architecture Documentation

**Last Updated:** December 2025  
**Version:** 2.0  
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Authentication & Authorization](#authentication--authorization)
6. [Real-Time Data Streaming](#real-time-data-streaming)
7. [Volume Alerts System](#volume-alerts-system)
8. [Open Interest System](#open-interest-system)
9. [Payment Processing](#payment-processing)
10. [Admin Dashboard](#admin-dashboard)
11. [Deployment Architecture](#deployment-architecture)
12. [Database Schema](#database-schema)
13. [API Endpoints](#api-endpoints)
14. [Environment Variables](#environment-variables)
15. [Security Considerations](#security-considerations)

---

## System Overview

VolSpike is a comprehensive Binance Perpetual Futures trading dashboard featuring:

- **Real-time market data** via direct Binance WebSocket connections (client-side)
- **Volume spike alerts** detected by Digital Ocean monitoring scripts
- **Open Interest data** aggregated from Binance Futures API
- **Tiered access control** (Free/Pro/Elite) with feature differentiation
- **User authentication** via email/password, OAuth (Google), and Web3 wallets (EVM/Solana)
- **Payment processing** via Stripe subscriptions
- **Admin dashboard** for user management and system oversight
- **Email notifications** via SendGrid
- **SMS alerts** via Twilio (Elite tier)

### Key Architectural Decisions

1. **Client-Side WebSocket**: Direct Binance WebSocket connections from browser eliminate Redis dependency and server-side IP blocking
2. **Tier-Based Throttling**: Frontend implements tier-based refresh intervals (Free: 15min, Pro: 5min, Elite: real-time)
3. **Wall-Clock Synchronization**: Volume alerts broadcasted at precise intervals (:00, :15, :30, :45 for Free; :00, :05, :10, etc. for Pro)
4. **Stale-While-Revalidate**: Open Interest cache serves last known data while fetching updates
5. **Zero Redis Dependency**: All real-time features use Socket.IO with in-memory adapters

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Next.js Frontend (Vercel)                         │  │
│  │  • Direct Binance WebSocket (wss://fstream.binance.com)  │  │
│  │  • Socket.IO Client (for volume alerts)                  │  │
│  │  • NextAuth.js (session management)                       │  │
│  │  • Tier-based throttling & filtering                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/WSS
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Railway)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Node.js + Hono Framework                         │  │
│  │  • REST API (auth, payments, alerts)                      │  │
│  │  • Socket.IO Server (volume alerts broadcasting)         │  │
│  │  • PostgreSQL + Prisma ORM                               │  │
│  │  • Stripe webhook handler                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (API Key Auth)
                              │
┌─────────────────────────────────────────────────────────────────┐
│              Digital Ocean Monitoring Server                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Python Scripts (systemd service)                  │  │
│  │  • Volume spike detection (every 5 min)                    │  │
│  │  • Open Interest aggregation (every 5 min)               │  │
│  │  • Binance API polling                                    │  │
│  │  • POST to backend /api/volume-alerts/ingest              │  │
│  │  • POST to backend /api/market/open-interest              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS REST API
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
│  • Binance Futures API (fapi.binance.com)                      │
│  • Stripe (payments)                                            │
│  • SendGrid (email)                                             │
│  • Twilio (SMS - Elite tier)                                    │
│  • Telegram (alerts)                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Next.js 15+)

**Location:** `volspike-nextjs-frontend/`

**Key Technologies:**
- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- NextAuth.js v5
- Socket.IO Client
- RainbowKit + Wagmi (Web3)
- React Query (data fetching)

**Core Components:**

1. **Market Data Hook** (`use-client-only-market-data.ts`)
   - Direct Binance WebSocket connection (`wss://fstream.binance.com/stream`)
   - Streams: `!ticker@arr` (24h ticker) + `!markPrice@arr` (funding rates)
   - Tier-based symbol limits (Free: 50, Pro: 100, Elite: unlimited)
   - Automatic reconnection with exponential backoff
   - localStorage fallback for region-blocked users
   - Open Interest fetching from backend (every 5 min)

2. **Volume Alerts Hook** (`use-volume-alerts.ts`)
   - Socket.IO connection to backend
   - Real-time alert delivery (Elite: instant, Pro/Free: batched)
   - Polling fallback when WebSocket disconnected
   - Tier-based alert limits (Free: 10, Pro: 50, Elite: 100)

3. **Authentication** (`lib/auth.ts`)
   - NextAuth.js configuration
   - Credentials provider (email/password)
   - Google OAuth provider
   - Web3 wallet authentication (via backend)

4. **UI Components**
   - `market-table.tsx` - Main market data table with sorting/filtering
   - `volume-alerts-panel.tsx` - Real-time volume alerts display
   - `alert-panel.tsx` - Alert notifications with sounds/animations
   - `admin/` - Admin dashboard components

**Routes:**
- `/` - Homepage
- `/dashboard` - Main trading dashboard (protected)
- `/auth` - Authentication pages
- `/pricing` - Tier comparison
- `/settings` - User settings
- `/admin/*` - Admin dashboard (role-based access)

### Backend (Node.js + Hono)

**Location:** `volspike-nodejs-backend/`

**Key Technologies:**
- Node.js 18+
- Hono framework (lightweight, edge-compatible)
- Prisma ORM
- Socket.IO
- JWT authentication
- Stripe SDK

**Core Services:**

1. **Authentication Service** (`routes/auth.ts`)
   - Email/password signup/login
   - OAuth integration (Google)
   - Web3 wallet authentication (EVM + Solana)
   - Email verification (SendGrid)
   - Password reset flow
   - JWT token generation

2. **Market Data Service** (`routes/market.ts`)
   - REST endpoints for market data (fallback)
   - Open Interest caching (`routes/open-interest.ts`)
   - Tier-based data filtering
   - Health check endpoints

3. **Volume Alerts Service** (`routes/volume-alerts.ts`)
   - `/ingest` - Receives alerts from Digital Ocean (API key auth)
   - `/` - Serves alerts to frontend (tier-based filtering)
   - `/subscriptions` - User alert subscriptions (Pro/Elite)

4. **Alert Broadcaster** (`services/alert-broadcaster.ts`)
   - Socket.IO room management (tier-based)
   - Wall-clock synchronized broadcasting
   - Queue management for batched tiers

5. **Payment Service** (`routes/payments.ts`)
   - Stripe checkout session creation
   - Webhook handler for subscription events
   - Tier upgrades/downgrades
   - Billing portal integration

6. **Admin Service** (`routes/admin/`)
   - User management (CRUD)
   - Subscription oversight
   - Audit logging
   - System metrics
   - Role-based access control

**WebSocket Handlers** (`websocket/handlers.ts`):
- Authentication middleware (email-based)
- Tier-based room joining (`tier-free`, `tier-pro`, `tier-elite`)
- Symbol/watchlist subscriptions
- Real-time alert broadcasting

### Database (PostgreSQL + TimescaleDB)

**Location:** `volspike-nodejs-backend/prisma/schema.prisma`

**Key Models:**

1. **User** - User accounts with authentication, tier, preferences
2. **VolumeAlert** - Volume spike alerts from Digital Ocean
3. **AlertSubscription** - User alert subscriptions (Pro/Elite)
4. **MarketSnapshot** - Historical market data (TimescaleDB hypertable)
5. **Watchlist** - User watchlists
6. **Session** - NextAuth sessions
7. **Account** - OAuth account links
8. **AuditLog** - Admin action audit trail
9. **AdminSession** - Admin-specific sessions

**Database Features:**
- TimescaleDB for time-series data (MarketSnapshot)
- Proper indexing for performance
- Foreign key relationships
- Cascade deletes for data integrity

### Digital Ocean Monitoring Scripts

**Location:** `Digital Ocean/`

**Scripts:**

1. **`hourly_volume_alert_current.py`**
   - Runs every 5 minutes (systemd service)
   - Scans all USDT perpetual contracts
   - Detects volume spikes (≥3x previous hour, ≥$3M volume)
   - Determines candle direction (bullish/bearish)
   - Sends alerts to Telegram
   - POSTs alerts to backend `/api/volume-alerts/ingest`
   - Handles HALF-UPDATE (XX:30) and FULL-UPDATE (XX:00)

2. **Open Interest Script** (integrated or separate)
   - Fetches Open Interest for all USDT perpetuals
   - Calculates USD notional (contracts × mark price)
   - POSTs to backend `/api/market/open-interest/ingest`
   - Runs every 5 minutes

**Authentication:**
- API key authentication (`X-API-Key` header)
- Environment variables: `VOLSPIKE_API_URL`, `VOLSPIKE_API_KEY`

---

## Data Flow Diagrams

### Market Data Flow (Client-Side WebSocket)

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ WebSocket Connection
       │ wss://fstream.binance.com/stream
       │
       ▼
┌─────────────────────┐
│   Binance WebSocket │
│  Streams:           │
│  • !ticker@arr      │
│  • !markPrice@arr   │
└─────────────────────┘
       │
       │ Real-time updates
       │
       ▼
┌─────────────────────┐
│  useClientOnlyMarket│
│  Data Hook          │
│  • Parse messages   │
│  • Merge data       │
│  • Apply filters    │
│  • Tier limits      │
└─────────────────────┘
       │
       │ State updates
       │
       ▼
┌─────────────────────┐
│   Market Table UI   │
│  • Display data     │
│  • Sort/filter      │
│  • Format numbers   │
└─────────────────────┘
```

### Volume Alerts Flow

```
┌──────────────────────┐
│ Digital Ocean Script │
│  (Every 5 minutes)  │
└──────────┬───────────┘
           │
           │ Detect volume spike
           │ (≥3x, ≥$3M)
           │
           ▼
┌──────────────────────┐
│  POST /api/volume-   │
│  alerts/ingest       │
│  Headers:            │
│  X-API-Key: <key>    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Backend API        │
│  • Validate API key  │
│  • Store in DB       │
│  • Broadcast via WS  │
└──────────┬───────────┘
           │
           ├─────────────────┐
           │                 │
           ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│  PostgreSQL DB   │  │  Socket.IO       │
│  VolumeAlert     │  │  Broadcasting     │
│  table           │  │  • tier-elite     │
└──────────────────┘  │  • tier-pro       │
                      │  • tier-free      │
                      └─────────┬─────────┘
                                │
                                │ Real-time events
                                │
                                ▼
                      ┌──────────────────┐
                      │  Frontend        │
                      │  Socket.IO Client│
                      │  • Receive alert │
                      │  • Update UI     │
                      │  • Play sound    │
                      └──────────────────┘
```

### Open Interest Flow

```
┌──────────────────────┐
│ Digital Ocean Script │
│  (Every 5 minutes)  │
└──────────┬───────────┘
           │
           │ Fetch OI from Binance
           │ Calculate USD notional
           │
           ▼
┌──────────────────────┐
│  POST /api/market/   │
│  open-interest/ingest│
│  Headers:            │
│  X-API-Key: <key>    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Backend API        │
│  • Validate API key │
│  • Cache in memory  │
│  • Normalize symbols │
└──────────┬───────────┘
           │
           │ Cache (5min TTL)
           │
           ▼
┌──────────────────────┐
│  GET /api/market/    │
│  open-interest       │
│  (Public endpoint)   │
└──────────┬───────────┘
           │
           │ Every 5 minutes
           │
           ▼
┌──────────────────────┐
│  Frontend Hook      │
│  • Fetch OI data    │
│  • Merge with market │
│  • Display in table │
│  (Pro/Elite only)   │
└──────────────────────┘
```

---

## Authentication & Authorization

### Authentication Methods

1. **Email/Password**
   - Password requirements: 12+ chars, uppercase, number, special char
   - Bcrypt hashing (10 rounds)
   - Email verification required
   - Case-insensitive email matching

2. **OAuth (Google)**
   - NextAuth.js Google provider
   - Automatic account creation
   - Email normalization

3. **Web3 Wallets**
   - **EVM Chains**: Sign-In with Ethereum (SIWE)
   - **Solana**: Phantom wallet deep-link authentication
   - Nonce-based challenge/response
   - Chain allowlist validation

### Authorization Flow

```
User Request
    │
    ▼
┌─────────────────┐
│  NextAuth.js    │
│  Session Check  │
└────────┬────────┘
         │
         ├─ Valid Session → Extract user info
         │
         └─ Invalid → Redirect to /auth
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  JWT Validation │
└────────┬────────┘
         │
         ├─ Valid JWT → Extract user/tier
         │
         └─ Invalid → 401 Unauthorized
         │
         ▼
┌─────────────────┐
│  Route Handler  │
│  • Check tier   │
│  • Check role   │
│  • Apply limits │
└─────────────────┘
```

### Role-Based Access Control

**User Roles:**
- `USER` - Standard user (default)
- `ADMIN` - Admin dashboard access

**Tier Levels:**
- `free` - Basic features, 15-min refresh, 50 symbols, 10 alerts
- `pro` - Enhanced features, 5-min refresh, 100 symbols, 50 alerts, email alerts
- `elite` - Premium features, real-time, unlimited symbols, 100 alerts, SMS alerts

**Admin Features:**
- User management (CRUD, status control)
- Subscription oversight
- Audit logging
- System metrics
- Security controls (2FA enforcement, IP allowlisting)

---

## Real-Time Data Streaming

### Client-Side Binance WebSocket

**Connection:**
```
wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
```

**Streams:**
- `!ticker@arr` - 24-hour ticker statistics for all symbols
- `!markPrice@arr` - Mark price and funding rate for all symbols

**Features:**
- Automatic reconnection with exponential backoff (1s → 30s max)
- Bootstrap window (2.5s) to gather symbols before first render
- Debounced rendering (200ms) for smooth updates
- localStorage persistence for offline fallback
- Symbol allowlist filtering (active perpetuals only)
- Precision caching (price decimals per symbol)

**Tier-Based Behavior:**
- **All tiers**: Real-time WebSocket data
- **Free**: Limited to top 50 symbols by volume
- **Pro**: Limited to top 100 symbols by volume
- **Elite**: All symbols (unlimited)

### Socket.IO for Volume Alerts

**Connection:**
```
Frontend → Backend Socket.IO Server
Auth: Email token (from NextAuth session)
```

**Rooms:**
- `tier-free` - Free tier users
- `tier-pro` - Pro tier users
- `tier-elite` - Elite tier users
- `user-{userId}` - Individual user room

**Broadcasting:**
- **Elite**: Instant delivery (no batching)
- **Pro**: Batched at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
- **Free**: Batched at :00, :15, :30, :45

**Wall-Clock Synchronization:**
- Checks every second for precise interval alignment
- Queues alerts until broadcast time
- Clears queue after broadcast

---

## Volume Alerts System

### Detection Logic (Digital Ocean)

**Scan Frequency:** Every 5 minutes (aligned to :00, :05, :10, etc.)

**Spike Criteria:**
- Current hour volume ≥ 3× previous hour volume
- Current hour volume ≥ $3M (MIN_QUOTE_VOL)
- Symbol must be active USDT perpetual

**Candle Direction:**
- **Bullish**: Current price > open price
- **Bearish**: Current price ≤ open price

**Update Alerts:**
- **HALF-UPDATE** (XX:30): Sent if initial alert was at XX:00-XX:20
- **FULL-UPDATE** (XX:00): Sent if initial alert was NOT at XX:55

### Backend Processing

**Ingestion Endpoint:** `POST /api/volume-alerts/ingest`

**Authentication:** API key (`X-API-Key` header)

**Process:**
1. Validate API key
2. Validate payload schema (Zod)
3. Store in `VolumeAlert` table
4. Broadcast via Socket.IO to appropriate tier rooms

**Retrieval Endpoint:** `GET /api/volume-alerts`

**Query Parameters:**
- `tier` - User tier (free/pro/elite)
- `symbol` - Optional symbol filter

**Response:**
- Tier-based limit (Free: 10, Pro: 50, Elite: 100)
- Sorted by timestamp (newest first)

### Frontend Display

**Components:**
- `volume-alerts-panel.tsx` - Main alerts panel
- `alert-panel.tsx` - Individual alert card

**Features:**
- Real-time Socket.IO updates
- Color-coded alerts (green: bullish, red: bearish)
- Countdown timer to next batch (Pro/Free)
- Sound notifications (configurable)
- Animation effects (slide-in, scale-in, fade-in)
- Two-line volume display ("This hour: $X" / "Last hour: $Y")

---

## Open Interest System

### Data Source

**Binance API:** `GET /fapi/v1/openInterest`

**Calculation:**
```
Open Interest (USD) = Open Interest (contracts) × Mark Price
```

### Backend Caching

**Endpoint:** `POST /api/market/open-interest/ingest`

**Cache Strategy:**
- In-memory cache (Map structure)
- 5-minute TTL (aligned with Digital Ocean updates)
- Stale-while-revalidate pattern
- Normalized symbol keys (uppercase, no dashes/underscores)

**Serving:** `GET /api/market/open-interest`

**Response:**
```json
{
  "data": {
    "BTCUSDT": 12700000000.50,
    "ETHUSDT": 8500000000.00
  },
  "stale": false,
  "asOf": 1701878400000,
  "dangerouslyStale": false
}
```

### Frontend Integration

**Hook:** `use-client-only-market-data.ts`

**Fetching:**
- Initial fetch on mount
- Polling every 5 minutes (aligned to boundaries)
- Watchdog refetch if data >6 minutes old (every 30s check)
- localStorage hydration on mount

**Display:**
- Visible only for Pro/Elite tiers
- Formatted as USD notional (e.g., "$12.70B")
- Merged with market data table
- Sortable column

---

## Payment Processing

### Stripe Integration

**Checkout Flow:**
1. User selects tier on `/pricing`
2. Frontend calls `POST /api/payments/checkout`
3. Backend creates Stripe Checkout Session
4. User redirected to Stripe hosted checkout
5. After payment, redirected to `/checkout/success`
6. Webhook updates user tier in database

**Webhook Endpoint:** `POST /api/payments/webhook`

**Events Handled:**
- `checkout.session.completed` - Upgrade tier
- `customer.subscription.updated` - Update tier
- `customer.subscription.deleted` - Downgrade to free
- `invoice.payment_failed` - Handle payment failure

**Tier Mapping:**
- Stripe Price ID → Tier (pro/elite)
- Stored in Stripe metadata

**Billing Portal:**
- Stripe Customer Portal integration
- Users can manage subscriptions
- Cancel/upgrade/downgrade handled automatically

---

## Admin Dashboard

### Access Control

**Route Protection:** `/admin/*` routes require `ADMIN` role

**Middleware:** `middleware/admin-auth.ts`

**Features:**
- Shorter session duration for admin accounts
- IP allowlisting (optional)
- 2FA enforcement (optional)
- Audit logging for all actions

### Admin Features

1. **User Management**
   - List all users (pagination, filtering)
   - View user details (tier, subscriptions, activity)
   - Update user status (ACTIVE/SUSPENDED/BANNED)
   - Reset passwords
   - Manually upgrade/downgrade tiers

2. **Subscription Oversight**
   - View all Stripe subscriptions
   - Monitor payment failures
   - Manual tier adjustments
   - Revenue analytics

3. **Audit Logging**
   - Complete activity trail
   - User actions tracked
   - Admin actions logged
   - Security event monitoring

4. **System Metrics**
   - User growth statistics
   - Tier distribution
   - Revenue metrics
   - API health monitoring

---

## Deployment Architecture

### Frontend (Vercel)

**Deployment:**
- Automatic deployments from `main` branch
- Preview deployments for PRs
- Edge runtime for optimal performance

**Environment Variables:**
- `NEXTAUTH_URL` - Frontend URL
- `NEXTAUTH_SECRET` - Session encryption key
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_SOCKET_IO_URL` - Socket.IO server URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID

**Build:**
```bash
npm run build
```

### Backend (Railway)

**Deployment:**
- Automatic deployments from `main` branch
- Docker-based deployment (optional)
- Health check endpoint: `/health`

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `FRONTEND_URL` - Frontend URL (CORS)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Email sender address
- `ALERT_INGEST_API_KEY` - Digital Ocean API key
- `DISABLE_SERVER_MARKET_POLL` - Disable backend market polling (set to `true`)

**Database:**
- Neon PostgreSQL (managed)
- TimescaleDB extension enabled
- Prisma migrations for schema changes

### Digital Ocean (Monitoring Server)

**Deployment:**
- Python script running as systemd service
- Service name: `volume-alert`
- Auto-restart on failure

**Service Configuration:**
```ini
[Unit]
Description=VolSpike Volume Alert Monitor
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/usr/bin/python3 hourly_volume_alert.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Environment Variables:**
- `VOLSPIKE_API_URL` - Backend API URL
- `VOLSPIKE_API_KEY` - API key for authentication
- `TELEGRAM_TOKEN` - Telegram bot token (optional)
- `CHAT_ID` - Telegram chat ID (optional)

**Monitoring:**
```bash
# Check service status
sudo systemctl status volume-alert

# View logs
sudo journalctl -u volume-alert -f
```

---

## Database Schema

### Core Models

**User**
- `id` (String, CUID)
- `email` (String, unique)
- `passwordHash` (String, nullable)
- `walletAddress` (String, nullable, unique)
- `tier` (String, default: "free")
- `role` (Role enum: USER/ADMIN)
- `status` (UserStatus enum: ACTIVE/SUSPENDED/BANNED)
- `stripeCustomerId` (String, nullable, unique)
- `emailVerified` (DateTime, nullable)
- Relations: watchlists, alerts, sessions, accounts

**VolumeAlert**
- `id` (String, CUID)
- `symbol` (String)
- `asset` (String)
- `currentVolume` (Float)
- `previousVolume` (Float)
- `volumeRatio` (Float)
- `price` (Float, nullable)
- `fundingRate` (Float, nullable)
- `candleDirection` (String: "bullish"/"bearish")
- `alertType` (AlertType enum: SPIKE/HALF_UPDATE/FULL_UPDATE)
- `message` (String)
- `timestamp` (DateTime)
- `hourTimestamp` (DateTime)
- `isUpdate` (Boolean, default: false)

**AlertSubscription**
- `id` (String, CUID)
- `userId` (String, FK → User)
- `symbol` (String, e.g., "BTCUSDT" or "*" for all)
- Unique constraint: `userId + symbol`

**MarketSnapshot** (TimescaleDB hypertable)
- `id` (String, CUID)
- `contractId` (String, FK → Contract)
- `price` (Float)
- `volume24h` (Float)
- `fundingRate` (Float, nullable)
- `openInterest` (Float, nullable)
- `timestamp` (DateTime, indexed)

**AuditLog**
- `id` (String, CUID)
- `actorUserId` (String, FK → User)
- `action` (String)
- `targetType` (String)
- `targetId` (String, nullable)
- `oldValues` (JSON, nullable)
- `newValues` (JSON, nullable)
- `metadata` (JSON, nullable)
- `createdAt` (DateTime, indexed)

### Indexes

- `User.email` - Unique index
- `User.walletAddress` - Unique index
- `VolumeAlert.timestamp` - Indexed for time-based queries
- `VolumeAlert.symbol + timestamp` - Composite index
- `AuditLog.actorUserId + createdAt` - Composite index
- `MarketSnapshot.contractId + timestamp` - Composite index

---

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/change-password` - Change password (authenticated)
- `POST /api/auth/siwe/nonce` - Get SIWE nonce
- `POST /api/auth/siwe/verify` - Verify SIWE signature
- `POST /api/auth/solana/nonce` - Get Solana nonce
- `POST /api/auth/solana/verify` - Verify Solana signature

### Market Data

- `GET /api/market/data` - Get market data (tier-filtered)
- `GET /api/market/symbol/:symbol` - Get specific symbol data
- `GET /api/market/history/:symbol` - Get historical data
- `GET /api/market/spikes` - Get volume spikes
- `GET /api/market/open-interest` - Get Open Interest cache (public)
- `POST /api/market/open-interest/ingest` - Ingest OI data (API key)

### Volume Alerts

- `POST /api/volume-alerts/ingest` - Ingest alert from Digital Ocean (API key)
- `GET /api/volume-alerts` - Get recent alerts (tier-filtered)
- `GET /api/volume-alerts/recent` - Get alerts from last N hours
- `GET /api/volume-alerts/subscriptions` - Get user subscriptions
- `POST /api/volume-alerts/subscriptions` - Subscribe to symbol (Pro/Elite)
- `DELETE /api/volume-alerts/subscriptions/:symbol` - Unsubscribe

### Payments

- `POST /api/payments/checkout` - Create Stripe checkout session
- `GET /api/payments/subscription` - Get user subscription status
- `POST /api/payments/webhook` - Stripe webhook handler (public)
- `GET /api/payments/billing-portal` - Get billing portal URL

### Watchlist

- `GET /api/watchlist` - Get user watchlists
- `POST /api/watchlist` - Create watchlist
- `PUT /api/watchlist/:id` - Update watchlist
- `DELETE /api/watchlist/:id` - Delete watchlist
- `POST /api/watchlist/:id/items` - Add item to watchlist
- `DELETE /api/watchlist/:id/items/:symbol` - Remove item

### Admin

- `GET /api/admin/users` - List users (admin only)
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/metrics` - Get system metrics
- `GET /api/admin/audit-logs` - Get audit logs

---

## Environment Variables

### Frontend (.env.local)

```bash
# NextAuth.js
NEXTAUTH_URL=https://volspike.com
NEXTAUTH_SECRET=<secret-key>

# API Configuration
NEXT_PUBLIC_API_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_SOCKET_IO_URL=https://volspike-production.up.railway.app

# Binance WebSocket (optional override)
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project-id>

# OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
```

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/volspike

# JWT
JWT_SECRET=<secret-key>

# Frontend URL (CORS)
FRONTEND_URL=https://volspike.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid)
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@volspike.com

# SMS (Twilio - Elite tier)
TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<auth-token>
TWILIO_PHONE_NUMBER=+1234567890

# Digital Ocean Integration
ALERT_INGEST_API_KEY=<api-key>

# Market Data Polling (set to true to disable backend polling)
DISABLE_SERVER_MARKET_POLL=true

# Environment
NODE_ENV=production
LOG_LEVEL=info
PORT=3001
```

### Digital Ocean

```bash
# VolSpike Backend
VOLSPIKE_API_URL=https://volspike-production.up.railway.app
VOLSPIKE_API_KEY=<api-key>

# Telegram (optional)
TELEGRAM_TOKEN=<bot-token>
CHAT_ID=<chat-id>
```

---

## Security Considerations

### Authentication Security

1. **Password Security**
   - Minimum 12 characters
   - Complexity requirements (uppercase, number, special char)
   - Bcrypt hashing (10 rounds)
   - Password change invalidates sessions

2. **JWT Security**
   - Short-lived tokens (configurable expiry)
   - Secure secret key (environment variable)
   - Token validation on every request

3. **Email Verification**
   - Required for email/password accounts
   - Time-limited verification tokens
   - Rate limiting on verification requests

4. **Web3 Authentication**
   - Nonce-based challenge/response
   - Chain allowlist validation
   - Signature verification (EVM: EIP-4361, Solana: Ed25519)

### API Security

1. **Rate Limiting**
   - Per-endpoint rate limits
   - IP-based tracking
   - Configurable windows

2. **CORS**
   - Whitelist-based origin validation
   - Credentials allowed
   - Preflight handling

3. **API Key Authentication**
   - Digital Ocean scripts use API key
   - Stored in environment variables
   - Validated on every request

4. **Input Validation**
   - Zod schema validation
   - SQL injection prevention (Prisma)
   - XSS prevention (input sanitization)

### Data Security

1. **Database**
   - Connection string encryption
   - Prepared statements (Prisma)
   - Role-based access control

2. **Sensitive Data**
   - Passwords never stored in plaintext
   - API keys in environment variables
   - Stripe webhook signature verification

3. **Session Security**
   - Secure session cookies (HTTPS only)
   - HttpOnly flag
   - SameSite protection

### Admin Security

1. **Role-Based Access**
   - Admin routes protected
   - Role verification middleware
   - Audit logging for all actions

2. **Session Management**
   - Shorter session duration for admins
   - IP allowlisting (optional)
   - 2FA enforcement (optional)

3. **Audit Logging**
   - All admin actions logged
   - User activity tracking
   - Security event monitoring

---

## Performance Optimizations

### Frontend

1. **WebSocket Optimization**
   - Debounced rendering (200ms)
   - Bootstrap window for symbol gathering
   - localStorage caching
   - Symbol allowlist filtering

2. **Data Fetching**
   - React Query caching
   - Stale-while-revalidate pattern
   - Polling intervals aligned to boundaries

3. **Code Splitting**
   - Next.js automatic code splitting
   - Dynamic imports for admin components
   - Lazy loading for heavy components

### Backend

1. **Database Optimization**
   - Proper indexing
   - Query optimization (Prisma)
   - Connection pooling

2. **Caching**
   - In-memory Open Interest cache
   - Alert queue management
   - Tier-based room broadcasting

3. **API Optimization**
   - Tier-based filtering
   - Pagination for large datasets
   - Response compression

---

## Monitoring & Logging

### Frontend Logging

- Development: Console logs for debugging
- Production: Error boundary logging
- WebSocket connection status tracking

### Backend Logging

- Pino logger (structured logging)
- Request/response logging
- Error tracking
- WebSocket connection logging

### Digital Ocean Monitoring

- Systemd service logs
- Script execution tracking
- API response monitoring
- Error alerting (Telegram)

---

## Future Enhancements

1. **Redis Integration** (Optional)
   - Socket.IO Redis adapter for horizontal scaling
   - Distributed alert broadcasting
   - Session store

2. **Advanced Analytics**
   - User behavior tracking
   - Market trend analysis
   - Alert effectiveness metrics

3. **Mobile App**
   - React Native app
   - Push notifications
   - Offline mode

4. **Additional Exchanges**
   - Multi-exchange support
   - Unified data aggregation
   - Cross-exchange arbitrage alerts

---

## Conclusion

VolSpike's architecture is designed for:

- **Scalability**: Client-side WebSocket reduces server load
- **Reliability**: Multiple fallback mechanisms (localStorage, polling)
- **Performance**: Tier-based throttling and caching
- **Security**: Comprehensive authentication and authorization
- **Maintainability**: Clean separation of concerns, TypeScript throughout

The system is production-ready and handles real-time market data, volume alerts, and user management efficiently.

---

**Document Version:** 2.0  
**Last Updated:** December 2025  
**Maintained By:** VolSpike Development Team

