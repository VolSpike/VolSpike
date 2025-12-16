# System Architecture

## Overview

VolSpike uses a client-centric architecture where market data flows directly to users' browsers, while the backend focuses solely on authentication, payments, and user data.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     Next.js Frontend (Vercel)                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │ Market Table │  │ Alert Panel  │  │ Watchlists   │               │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │  │
│  │         │                 │                 │                        │  │
│  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐               │  │
│  │  │ useClient    │  │ useVolume    │  │ useWatch     │               │  │
│  │  │ OnlyMarket   │  │ Alerts       │  │ lists        │               │  │
│  │  │ Data (Hook)  │  │ (Hook)       │  │ (Hook)       │               │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │  │
│  └─────────┼─────────────────┼─────────────────┼───────────────────────┘  │
│            │                 │                 │                           │
│            ▼                 ▼                 ▼                           │
└────────────┼─────────────────┼─────────────────┼───────────────────────────┘
             │                 │                 │
    ┌────────┼─────────────────┼─────────────────┼────────┐
    │        │                 │                 │        │
    ▼        │                 ▼                 ▼        │
┌────────────┴──┐    ┌─────────────────┐    ┌──────────────┴─────────────┐
│   Binance     │    │   Backend API   │    │      Database (Neon)       │
│   WebSocket   │    │   (Railway)     │    │                            │
│               │    │                 │    │  ┌──────────────────────┐  │
│ fstream.      │    │ ┌─────────────┐ │    │  │ Users, Subscriptions │  │
│ binance.com   │    │ │ Socket.IO   │ │    │  │ Watchlists, Alerts   │  │
│               │    │ └──────┬──────┘ │    │  │ Payments, Sessions   │  │
└───────────────┘    │        │        │    │  └──────────────────────┘  │
                     │ ┌──────▼──────┐ │    │                            │
                     │ │ Auth/Payments│◄├────┤                            │
                     │ │ Routes      │ │    │                            │
                     │ └─────────────┘ │    └────────────────────────────┘
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │ Digital Ocean   │
                     │ Python Scripts  │
                     │                 │
                     │ Volume Detection│
                     │ OI Polling      │
                     │ Funding WS      │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │ Binance REST    │
                     │ API             │
                     └─────────────────┘
```

---

## Critical Architecture Rule

### **NEVER call Binance REST API from Frontend or Backend**

This is the most important architectural decision in VolSpike:

| Component | Binance WebSocket | Binance REST API |
|-----------|------------------|------------------|
| Frontend (Browser) | YES | NO |
| Backend (Railway) | NO | NO |
| Digital Ocean Scripts | NO | YES |

**Why?**
- Binance rate limits REST API calls
- Server IPs get blocked quickly
- User's residential IP is never blocked
- Direct WebSocket = lower latency

---

## Technology Stack

### Frontend (Vercel)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.7 | React framework |
| React | 18.2.0 | UI library |
| TypeScript | 5.3.2 | Type safety |
| Tailwind CSS | 3.3.6 | Styling |
| shadcn/ui | - | UI components |
| Framer Motion | 10.16.16 | Animations |
| Recharts | 2.8.0 | Charts |
| Socket.IO Client | 4.7.4 | Real-time alerts |
| RainbowKit | 2.1.0 | EVM wallets |
| Solana Wallet Adapter | 0.15.35 | Solana wallets |
| TanStack Query | 5.8.4 | Data fetching |
| Zustand | 4.4.7 | State management |
| NextAuth.js | 5.0.0-beta.25 | Authentication |

### Backend (Railway)

| Technology | Version | Purpose |
|------------|---------|---------|
| Hono | 4.10.3 | Web framework |
| Node.js | 18+ | Runtime |
| TypeScript | 5.3.2 | Type safety |
| Prisma | 6.18.0 | ORM |
| Socket.IO | 4.7.4 | Real-time |
| Stripe | 14.0.0 | Payments |
| SendGrid | 8.1.6 | Emails |
| Pino | 8.16.0 | Logging |
| Winston | 3.11.0 | Logging |
| bcryptjs | 2.4.3 | Password hashing |

### Database (Neon)

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database |
| TimescaleDB | Time-series extension |
| Prisma | Schema management |

### Digital Ocean

| Technology | Purpose |
|------------|---------|
| Python 3.x | Script runtime |
| systemd | Service management |
| Binance REST API | Data fetching |

---

## Data Flow Patterns

### Pattern 1: Market Data (Real-time)

```
User opens dashboard
       │
       ▼
Browser connects to wss://fstream.binance.com/stream
       │
       ▼
useClientOnlyMarketData hook processes messages
       │
       ▼
Market table renders live data
```

**Key Points:**
- Direct browser-to-Binance connection
- No server involvement
- Tier-based throttling in frontend
- localStorage fallback if blocked

### Pattern 2: Volume Alerts

```
Every 5 minutes:
       │
       ▼
Digital Ocean script calls Binance REST API
       │
       ▼
Detects volume spikes (>3x normal)
       │
       ▼
POSTs alerts to /api/volume-alerts/ingest
       │
       ▼
Backend stores in database
       │
       ▼
Socket.IO broadcasts to tier rooms
       │
       ▼
Frontend receives via useVolumeAlerts hook
```

**Key Points:**
- Wall-clock batching (Free: 15min, Pro: 5min, Elite: instant)
- Socket.IO rooms: `tier-free`, `tier-pro`, `tier-elite`
- Guest token joins `tier-free` room

### Pattern 3: Authentication

```
User enters email/password
       │
       ▼
NextAuth.js credentials provider
       │
       ▼
POST to backend /api/auth/signin
       │
       ▼
Backend verifies password, returns JWT
       │
       ▼
NextAuth stores session, creates cookie
       │
       ▼
All subsequent requests include JWT
```

### Pattern 4: Payments

```
User clicks "Upgrade to Pro"
       │
       ▼
Frontend calls backend /api/payments/checkout
       │
       ▼
Backend creates Stripe Checkout Session
       │
       ▼
User redirected to Stripe
       │
       ▼
Payment completes
       │
       ▼
Stripe webhook hits /api/payments/webhook
       │
       ▼
Backend updates user tier
       │
       ▼
Socket.IO emits tier-change event
       │
       ▼
Frontend updates UI
```

---

## Service Responsibilities

### Frontend (Next.js)

**Responsible for:**
- User interface rendering
- Direct Binance WebSocket connection
- Client-side data filtering (watchlists)
- Tier-based UI gating
- Theme management
- Form validation

**NOT responsible for:**
- Calling Binance REST API
- Storing market data
- Processing alerts
- Payment processing

### Backend (Hono)

**Responsible for:**
- User authentication
- JWT token management
- Stripe/NowPayments integration
- User data CRUD
- Watchlist storage (symbols only)
- Alert storage and broadcasting
- Admin functionality

**NOT responsible for:**
- Fetching market data
- Calling Binance APIs
- Processing market data
- Real-time price updates

### Digital Ocean Scripts

**Responsible for:**
- Calling Binance REST API
- Detecting volume spikes
- Polling Open Interest
- Funding rate WebSocket
- Posting alerts to backend

**NOT responsible for:**
- User authentication
- Payment processing
- Serving web requests

---

## File Structure

```
VolSpike/
├── volspike-nextjs-frontend/     # Frontend application
│   ├── src/
│   │   ├── app/                  # Pages (App Router)
│   │   │   ├── (admin)/admin/   # Admin panel (14 pages)
│   │   │   ├── api/             # API routes
│   │   │   ├── auth/            # Auth pages
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── checkout/        # Payment flows
│   │   │   └── settings/        # User settings
│   │   ├── components/          # React components (150+)
│   │   ├── hooks/               # Custom hooks (24)
│   │   ├── lib/                 # Utilities (18)
│   │   └── types/               # TypeScript types
│   └── package.json
│
├── volspike-nodejs-backend/      # Backend application
│   ├── src/
│   │   ├── routes/              # API endpoints (20+)
│   │   │   └── admin/           # Admin routes (14)
│   │   ├── services/            # Business logic (30+)
│   │   ├── middleware/          # Auth, rate limiting
│   │   ├── websocket/           # Socket.IO handlers
│   │   └── lib/                 # Utilities
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   └── package.json
│
└── Digital Ocean/               # Python scripts
    ├── hourly_volume_alert_dual_env.py
    ├── oi_realtime_poller.py
    ├── oi_liquid_universe_job.py
    ├── binance_funding_ws_daemon.py
    └── funding_api_server.py
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         PRODUCTION                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Vercel    │  │  Railway    │  │       Neon          │ │
│  │  Frontend   │  │  Backend    │  │     PostgreSQL      │ │
│  │             │  │             │  │                     │ │
│  │ volspike.   │  │ volspike-   │  │ Managed database    │ │
│  │ com         │  │ production. │  │ with connection     │ │
│  │             │  │ up.railway. │  │ pooling             │ │
│  │             │  │ app         │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Digital Ocean Droplet                   │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ Volume      │  │ OI Poller   │  │ Funding WS  │  │   │
│  │  │ Alert       │  │ Service     │  │ Daemon      │  │   │
│  │  │ Service     │  │             │  │             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication Layers

1. **Frontend**: NextAuth.js session management
2. **Backend**: JWT verification middleware
3. **Admin**: Role-based access control (ADMIN role required)
4. **Digital Ocean**: API key authentication

### Security Features

- Password hashing with bcrypt
- JWT tokens with expiration
- CORS configuration
- Rate limiting
- CSRF protection on sensitive endpoints
- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS prevention (sanitize-html)

---

## Performance Considerations

### Frontend
- Debounced WebSocket updates (200ms)
- Tier-based symbol limits reduce rendering
- localStorage caching for fallback
- React Query caching

### Backend
- In-memory Socket.IO adapter (no Redis)
- Connection pooling for database
- Rate limiting on public endpoints
- Efficient Prisma queries

### Scalability
- Each user has own Binance WebSocket connection
- No server bottleneck for market data
- Socket.IO scales with tier rooms
- Database connection pooling

---

## Next: [Quick Start Guide](03-QUICK-START.md)
