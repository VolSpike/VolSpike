# CLAUDE.md - AI Assistant Guide for VolSpike

## Quick Reference

This document provides guidance for AI assistants (like Claude) working on the VolSpike project. For comprehensive project documentation, see [AGENTS.md](AGENTS.md).

## Digital Ocean Server Access

**SSH Configuration**: Claude has access to the Digital Ocean droplet via SSH.

**Connection Details**:
- **Host alias**: `volspike-do` (configured in `~/.ssh/config`)
- **IP Address**: `167.71.196.5`
- **User**: `root`
- **SSH Key**: `~/.ssh/volspike-temp`
- **Connection command**: `ssh volspike-do`

**Quick Commands**:
```bash
# Connect to server
ssh volspike-do

# Run command remotely
ssh volspike-do "command here"

# Check running services
ssh volspike-do "systemctl list-units --type=service --state=running | grep -E '(volume|funding|oi)'"

# View logs
ssh volspike-do "sudo journalctl -u service-name -f"
```

**Important Notes**:
- Scripts are located in `/home/trader/volume-spike-bot/`
- Environment variables are in `/home/trader/.volspike.env`
- Services run as `trader` user (not root)
- Funding API server runs on `localhost:8888`

## Essential Reading

Before working on any task, please read:
- [AGENTS.md](AGENTS.md) - Complete project overview, architecture, and guidelines (37KB)
- [OVERVIEW.md](OVERVIEW.md) - High-level project overview (7KB)
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Current state and roadmap (6KB)

## Project Context

VolSpike is a **production-ready** Binance Perpetual Futures trading dashboard with:
- **Frontend**: Next.js 15.0.0 with TypeScript 5.3.2, Tailwind CSS 3.3.6, shadcn/ui
- **Backend**: Node.js with Hono 4.10.3 framework (auth/payments only)
- **Database**: PostgreSQL with TimescaleDB via Prisma 6.18.0 (user data only)
- **Real-time Data**: Client-side Binance WebSocket (no Redis/server dependency)
- **Authentication**: NextAuth.js v5 with email, Web3 wallets (EVM + Solana), OAuth
- **Payments**: Stripe 14.0.0 + NowPayments (crypto)
- **Deployment**: Vercel (frontend) + Railway (backend) + Neon (database)
- **Live Site**: https://volspike.com

## Key Architecture Principles

### 🔴 CRITICAL: Client-Only Data Architecture

**THE MOST IMPORTANT RULE**: VolSpike uses a client-only market data architecture.

#### Data Source Rules:

1. **VolSpike Frontend (Browser)**:
   - ✅ **ONLY uses Binance WebSocket** (`wss://fstream.binance.com/stream`)
   - ✅ Direct connection from user's browser to Binance
   - ✅ Real-time data via `useClientOnlyMarketData` hook
   - ✅ Tier-based throttling in frontend (Elite: live, Pro: 5min, Free: 15min)
   - ✅ localStorage fallback for region-blocked users
   - ❌ **NEVER** call Binance REST API from frontend
   - ❌ **NEVER** fetch market data from backend REST endpoints

2. **VolSpike Backend (Railway)**:
   - ✅ **ONLY handles**: Authentication, Payments, User Data, Watchlists, Alerts
   - ✅ Watchlists store **symbols only** (e.g., `1000PEPEUSDT`)
   - ❌ **NEVER** fetch market data from Binance REST API
   - ❌ **NEVER** create endpoints that fetch from Binance REST API
   - ❌ **NEVER** provide market data endpoints (except watchlist symbols)

3. **Digital Ocean Scripts** (Python):
   - ✅ **ONLY place** that uses Binance REST API
   - ✅ Detects volume spikes and posts alerts to backend
   - ✅ Polls Open Interest data and posts to backend
   - ✅ Funding rate WebSocket daemon
   - ✅ Runs independently on Digital Ocean droplet

### Common Mistakes to Avoid:

❌ **WRONG**: Creating `/api/market/watchlist/:id` endpoint that calls Binance REST API
❌ **WRONG**: Using `getMarketData()` function in backend for watchlist data
❌ **WRONG**: Fetching market data from backend REST endpoints in frontend
❌ **WRONG**: Assuming backend has market data - it doesn't!

✅ **CORRECT**: Fetch watchlist info (symbols only) from `/api/watchlist/:id`
✅ **CORRECT**: Filter existing WebSocket `data` array by watchlist symbols
✅ **CORRECT**: All market data comes from `useClientOnlyMarketData` hook
✅ **CORRECT**: Watchlist filtering is client-side only

### Why This Architecture?

- **80% cost reduction** vs Redis-based stack
- **No Redis costs** or command limits
- **No server-side data ingestion** overhead
- **No IP blocking issues** (uses user's residential IP)
- **Simplified infrastructure** (frontend + auth backend only)
- **Better real-time performance** (sub-second Elite tier updates <150ms)
- **Scalability** without server bottlenecks

## Technology Stack

### Frontend
- **Framework**: Next.js 15.0.0 (App Router)
- **Language**: TypeScript 5.3.2 (strict mode)
- **UI Library**: React 18.2.0
- **Styling**: Tailwind CSS 3.3.6, shadcn/ui (Radix UI primitives)
- **Animation**: Framer Motion 10.16.16
- **Charts**: Recharts 2.8.0
- **Authentication**: NextAuth.js 5.0.0-beta.25
- **Web3 (EVM)**: RainbowKit 2.1.0, Wagmi 2.0.0, SIWE 3.0.0, Viem 2.0.0
- **Web3 (Solana)**: Solana Wallet Adapter 0.15.35, Web3.js 1.95.3
- **Payments**: Stripe 14.0.0 (@stripe/stripe-js 2.0.0)
- **Real-time**: Socket.IO Client 4.7.4
- **State Management**: Zustand 4.4.7
- **Forms**: React Hook Form 7.65.0 + Zod 3.22.0
- **Data Fetching**: TanStack Query 5.8.4
- **Testing**: Vitest 4.0.10 + Testing Library

### Backend
- **Framework**: Hono 4.10.3 (Edge-compatible)
- **Runtime**: @hono/node-server 1.19.5
- **Language**: TypeScript 5.3.2
- **Database**: Prisma 6.18.0 + PostgreSQL (TimescaleDB)
- **Authentication**: NextAuth.js 5.0.0-beta.25, SIWE 3.0.0, bcryptjs 2.4.3
- **Payments**: Stripe 14.0.0, NowPayments API
- **Real-time**: Socket.IO 4.7.4
- **Email**: SendGrid (@sendgrid/mail 8.1.6)
- **Logging**: Pino 8.16.0 + Winston 3.11.0
- **Security**: Helmet 7.1.0, CORS, Rate limiting
- **Testing**: Vitest 4.0.10

### Digital Ocean Scripts
- **Language**: Python 3.x
- **Services**: systemd daemons
- **Purpose**: Volume spike detection, OI polling, funding rate WebSocket

## Repository Structure

```
VolSpike/
├── volspike-nextjs-frontend/     # Next.js 15+ frontend (main app)
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── (admin)/admin/   # Admin panel (14 pages)
│   │   │   ├── api/             # NextAuth API routes
│   │   │   ├── auth/            # Auth pages (sign-in, sign-up)
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── checkout/        # Payment flows
│   │   │   ├── settings/        # User settings
│   │   │   └── ...
│   │   ├── components/          # 59+ React components
│   │   │   ├── market-table.tsx
│   │   │   ├── volume-alerts-panel.tsx
│   │   │   └── ...
│   │   ├── hooks/               # 22 custom hooks
│   │   │   ├── use-client-only-market-data.ts  # CORE WebSocket
│   │   │   ├── use-volume-alerts.ts
│   │   │   └── ...
│   │   ├── lib/                 # Utilities
│   │   │   ├── auth.ts          # NextAuth config
│   │   │   ├── payments.ts      # Stripe integration
│   │   │   └── admin/           # Admin utilities
│   │   ├── types/               # TypeScript definitions
│   │   └── styles/              # Global CSS
│   └── package.json
│
├── volspike-nodejs-backend/      # Node.js backend (auth/payments only)
│   ├── src/
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.ts          # Authentication (75KB)
│   │   │   ├── payments.ts      # Stripe + NowPayments (131KB)
│   │   │   ├── volume-alerts.ts
│   │   │   ├── watchlist.ts
│   │   │   └── admin/           # Admin API routes (11 files)
│   │   ├── services/            # Business logic (15 services)
│   │   │   ├── email.ts         # SendGrid (80KB)
│   │   │   ├── asset-metadata.ts
│   │   │   └── admin/
│   │   ├── middleware/          # Auth, rate limiting, audit
│   │   ├── websocket/           # Socket.IO handlers
│   │   ├── lib/                 # Utilities
│   │   └── prisma/              # Database schema
│   │       └── schema.prisma    # Prisma schema
│   └── package.json
│
├── Digital Ocean/               # Python scripts (ONLY place using Binance REST API)
│   ├── hourly_volume_alert_dual_env.py     # Volume spike detection (22KB)
│   ├── oi_realtime_poller.py               # Open Interest polling (23KB)
│   ├── oi_liquid_universe_job.py           # Liquid symbol classification (10KB)
│   ├── binance_funding_ws_daemon.py        # Funding rate WebSocket (13KB)
│   ├── funding_api_server.py               # Funding rate API (11KB)
│   ├── binance-funding-api.service         # systemd service
│   └── binance-funding-ws.service          # systemd service
│
├── docs/                        # Feature documentation
│   ├── binance_websocket_funding/
│   └── features/
│
├── AGENTS.md                    # Primary AI assistant guide (37KB)
├── OVERVIEW.md                  # High-level architecture (7KB)
├── IMPLEMENTATION_PLAN.md       # Current state & roadmap (6KB)
├── DEPLOYMENT_CHECKLIST.md      # Production deployment guide
├── TIER_FEATURES_DOCUMENTATION.md
└── docker-compose.yml           # Development environment
```

## Code Style Rules

### Next.js Frontend

- **TypeScript**: Use strict mode with proper typing, no `any` types
- **Next.js Patterns**:
  - Use App Router (not Pages Router)
  - Server Components by default
  - Client Components need `"use client"` directive
  - Mark routes using cookies/headers as `export const dynamic = 'force-dynamic'`
- **Components**:
  - Wrap components using `useSession` with `<SessionProvider>`
  - Use Tailwind CSS for all styling (no CSS modules or styled-components)
  - Use shadcn/ui for component primitives
  - Functional components with TypeScript interfaces
- **Data Fetching**:
  - Implement direct Binance WebSocket via `useClientOnlyMarketData` hook
  - Use TanStack Query for server data
  - Never fetch market data from backend
- **Path Aliases**: Use `@/` → `src/`
- **NO emojis** unless explicitly requested by user
- **NO .md files**: NEVER create .md documentation files unless explicitly requested by user

### Node.js Backend

- **Framework**: Use Hono (not Express)
- **Error Handling**:
  - Implement proper try/catch blocks
  - Return appropriate HTTP status codes
  - Binance REST failures should return empty arrays, not crash
- **Database**: Use Prisma ORM for all database operations
- **Logging**: Use Pino for structured logging
- **Validation**: Use Zod for input validation
- **Authentication**: JWT-based with NextAuth.js
- **NO market data processing** (handled by frontend)
- **Rate Limiting**: Implement on all public endpoints

### Security Best Practices

- **Input Validation**: Use Zod schemas for all inputs
- **Authentication**: JWT tokens with proper expiration
- **Rate Limiting**: Protect all public endpoints
- **Role-Based Access Control**: USER/ADMIN roles enforced
- **Environment Variables**: Never commit `.env` files
- **Password Security**: Use bcrypt for hashing
- **CORS**: Proper configuration for production
- **Security Headers**: Use Helmet middleware
- **CSRF Protection**: Implement on sensitive endpoints
- **SQL Injection**: Use Prisma (prevents by design)
- **XSS Protection**: Sanitize user inputs

### Git Commit Messages

Use conventional commits:
- `feat(scope): description` - New feature
- `fix(scope): description` - Bug fix
- `refactor(scope): description` - Code refactoring
- `docs(scope): description` - Documentation changes
- `test(scope): description` - Test changes
- `chore(scope): description` - Build/config changes

Examples:
- `feat(auth): add Solana wallet authentication`
- `fix(payments): handle NowPayments webhook fallback`
- `refactor(admin): improve pagination logic with smart ellipsis`

## Common Tasks

### Adding a New Feature

1. **Read Documentation**: Review relevant sections in [AGENTS.md](AGENTS.md)
2. **Determine Scope**: Check if it's frontend-only or requires backend
3. **Database Changes**: Check if database migration is needed
4. **Follow Patterns**: Use TypeScript with proper typing
5. **Test Access Controls**: Verify tier-based access (Free/Pro/Elite)
6. **Test User Roles**: Test with multiple roles (guest, free, pro, elite, admin)
7. **Verify WebSocket**: Ensure WebSocket connections remain stable
8. **Commit**: Use conventional commits: `feat(scope): description`

### Fixing a Bug

1. **Understand Architecture**: Determine if it's client-side vs server-side
2. **Check Docs**: Review [AGENTS.md](AGENTS.md) for troubleshooting
3. **Read Code**: Read relevant files before modifying
4. **Implement Fix**: Add proper error handling
5. **Test Thoroughly**: Test all affected functionality
6. **Commit**: Use conventional commits: `fix(scope): description`

### Working with Authentication

**NextAuth.js v5** is configured for multiple auth methods:

1. **Email/Password**:
   - bcrypt password hashing
   - Email verification via SendGrid
   - Case-insensitive login
   - Password change detection

2. **OAuth Providers**:
   - Google (configured)
   - GitHub (configured)
   - Profile picture integration

3. **EVM Wallets**:
   - RainbowKit integration
   - SIWE (Sign-In with Ethereum)
   - Multi-chain support
   - WalletConnect

4. **Solana Wallets**:
   - Phantom (preferred)
   - Mobile deep-linking
   - Message signing
   - Universal links

**Features**:
- Multi-account linking (1 user = multiple wallets)
- Session management with JWT
- 2FA for admin accounts
- Role-based access control (USER/ADMIN)
- Account status (ACTIVE/SUSPENDED/BANNED)

**See**: [AGENTS.md](AGENTS.md) Authentication section for implementation details

### Working with WebSocket Data

#### Market Data (Client-Side)
- **Source**: Direct Binance WebSocket (`wss://fstream.binance.com/stream`)
- **Hook**: `useClientOnlyMarketData` in [use-client-only-market-data.ts](volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts)
- **Throttling**: Tier-based (Elite: live, Pro: 5min, Free: 15min)
- **Features**:
  - Automatic reconnection with exponential backoff
  - localStorage fallback for region-blocked users
  - Client-side filtering by watchlist symbols
  - No backend dependency

#### Volume Alerts (Server-Side)
- **Source**: Socket.IO from backend
- **Rooms**: Tier-based (`tier-free`, `tier-pro`, `tier-elite`)
- **Auth**:
  - Guest token: `guest` joins `tier-free` room
  - Wallet-only users: `method=id` and token=user id
  - Email users: Standard JWT token
- **Batching**: Wall-clock based (15min/5min/instant)
- **Features**:
  - Initial 10 alerts on login
  - Real-time streaming
  - Sound and animation system

**See**: [AGENTS.md](AGENTS.md) WebSocket section for implementation details

### Working with Payments

#### Stripe Integration
- **Features**:
  - Subscription management
  - Customer portal
  - Webhook handling
  - Proration support
  - Tier upgrades/downgrades
  - Automatic renewal
- **Files**:
  - Frontend: [lib/payments.ts](volspike-nextjs-frontend/src/lib/payments.ts)
  - Backend: [routes/payments.ts](volspike-nodejs-backend/src/routes/payments.ts)

#### NowPayments (Crypto)
- **Features**:
  - Hosted invoice system
  - IPN webhooks
  - Supported currencies: USDT, USDC, SOL, BTC, ETH
  - Network identifier tracking
  - Fallback order ID parsing
  - Test payment system ($1 for testing)
- **CRITICAL**: Payment method display logic
  - Currency formatting: `formatCryptoCurrency()` in `lib/admin/currency-format.ts`
  - Network identifiers REQUIRED (e.g., `usdce` not `usdc`)
  - Check USDCE FIRST before generic USDC
  - **DO NOT** modify without updating AGENTS.md, OVERVIEW.md, IMPLEMENTATION_PLAN.md

#### Admin Payment Tools
- Create Payment from NowPayments dialog
- Tier mismatch repair
- Webhook debugging
- Payment history

**See**: [AGENTS.md](AGENTS.md) Payments section for implementation details

### Working with Admin Panel

**Location**: `/admin` with 14 pages

**Pages**:
- Dashboard: Overview, stats, quick actions
- Users: User management, CRUD operations
- Subscriptions: Stripe subscription monitoring
- Payments: Payment history, crypto payments
- Revenue: Revenue analytics with charts
- Audit: Audit logs, security monitoring
- Metrics: System health, performance
- Settings: Platform configuration

**Features**:
- Role-based access control (ADMIN role required)
- Advanced pagination with smart ellipsis
- Revenue time-series charts (Recharts)
- Audit logging for all actions
- User status management
- Payment webhook debugging
- Test account creation

**Access Control**:
- All admin routes require `role === 'ADMIN'`
- Server-side protection in middleware
- Client-side UI gating
- 2FA enforcement (optional)

**See**: [AGENTS.md](AGENTS.md) Admin section for implementation details

## Environment Variables

### Frontend (.env.local)
```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000                    # NextAuth base URL
NEXTAUTH_SECRET=your-nextauth-secret                  # NextAuth secret (32+ chars)

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001             # Backend API URL
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:3001       # Socket.IO URL

# Binance WebSocket
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream   # Binance WebSocket URL

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...        # Stripe publishable key

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id  # WalletConnect project ID

# Build
NEXT_PUBLIC_BUILD_ID=dev                              # Build version identifier
```

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/volspike  # PostgreSQL connection

# JWT
JWT_SECRET=your-jwt-secret                            # JWT signing key (32+ chars)

# Stripe
STRIPE_SECRET_KEY=sk_test_...                         # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...                       # Stripe webhook secret

# SendGrid
SENDGRID_API_KEY=SG.your-sendgrid-api-key            # SendGrid API key
SENDGRID_FROM_EMAIL=noreply@volspike.com             # Sender email address

# Frontend
FRONTEND_URL=http://localhost:3000                    # Frontend URL for redirects

# NowPayments
NOWPAYMENTS_API_KEY=your-nowpayments-api-key         # NowPayments API key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret               # IPN webhook secret

# Digital Ocean Scripts
ALERT_INGEST_API_KEY=your-alert-ingest-key           # DO script authentication

# Feature Flags
DISABLE_SERVER_MARKET_POLL=true                      # Set to true in production

# Environment
NODE_ENV=development                                  # development, production, test
```

### Digital Ocean Scripts (.volspike.env)
```bash
# Located at: /home/trader/.volspike.env
BACKEND_URL=https://volspike-production.up.railway.app
ALERT_INGEST_API_KEY=your-alert-ingest-key
```

## Testing

### Frontend Testing

**Framework**: Vitest 4.0.10 + Testing Library

```bash
cd volspike-nextjs-frontend

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Coverage Thresholds**:
- Lines: 60%
- Functions: 60%
- Branches: 50%
- Statements: 60%

**Configuration**: [vitest.config.ts](volspike-nextjs-frontend/vitest.config.ts)

### Backend Testing

**Framework**: Vitest 4.0.10

```bash
cd volspike-nodejs-backend

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Coverage Thresholds**:
- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%

**Configuration**: [vitest.config.ts](volspike-nodejs-backend/vitest.config.ts)

### Test Accounts

```
free-test@volspike.com / Test123456!
pro-test@volspike.com / Test123456!
```

**Test Payment System**:
- Test accounts (emails ending with `-test@volspike.com`) can use `/test-crypto-payment`
- $1 test payments for testing crypto upgrade flows
- Restricted to test accounts only

## Development Commands

### Frontend
```bash
cd volspike-nextjs-frontend

# Install dependencies
npm install

# Start dev server (localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# TypeScript type checking
npm run type-check

# ESLint
npm run lint
```

### Backend
```bash
cd volspike-nodejs-backend

# Install dependencies
npm install

# Start dev server (localhost:3001)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# TypeScript type checking
npm run type-check

# Database operations
npm run db:push          # Push schema to database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio

# Seed test users
npm run seed:test
```

## Deployment

### Environments

**Development**:
- Frontend: `localhost:3000` (Next.js dev server)
- Backend: `localhost:3001` (Hono dev server)
- Database: Docker PostgreSQL (`localhost:5432`)

**Production**:
- Frontend: Vercel (https://volspike.com)
- Backend: Railway (https://volspike-production.up.railway.app)
- Database: Neon PostgreSQL (managed)
- Scripts: Digital Ocean droplet

### Deployment Checklist

**Frontend (Vercel)**:
- [ ] All environment variables configured
- [ ] `NEXT_PUBLIC_API_URL` points to Railway backend
- [ ] `NEXT_PUBLIC_WS_URL` points to Binance WebSocket
- [ ] Build succeeds without errors
- [ ] No console errors in browser

**Backend (Railway)**:
- [ ] All environment variables configured
- [ ] `DISABLE_SERVER_MARKET_POLL=true` is set
- [ ] Database URL points to Neon
- [ ] `/health` endpoint returns 200
- [ ] Run `npx prisma migrate deploy` after schema changes

**Database (Neon)**:
- [ ] Connection pooling enabled
- [ ] Backups configured
- [ ] TimescaleDB extension enabled

**See**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete guide

## Safety Guardrails

### DO NOT Touch
- `volspike-nodejs-backend/prisma/schema.prisma` - Database schema (requires migration)
- `.env` files - Environment variables with secrets
- `node_modules/` - Dependencies
- `dist/` and `.next/` - Build outputs
- Admin routes and middleware - Critical security
- Payment display logic - Must update docs if modified

### DO NOT Create (Unless Explicitly Requested)
- **NO .md files** - NEVER create markdown documentation files unless user specifically asks
- **NO README files** - Don't create README.md or similar docs proactively
- **NO guide files** - Don't create GUIDE.md, INSTRUCTIONS.md, SUMMARY.md, etc. without request
- **Focus on code** - Implement functionality, not documentation
- **Exception**: Bug reports, analysis documents are OK when debugging issues

### Before Making Changes
- [ ] Check if database migration is needed
- [ ] Verify tier-based access controls (Free/Pro/Elite)
- [ ] Test with multiple user roles (guest, free, pro, elite, admin)
- [ ] Ensure WebSocket connections remain stable
- [ ] Verify payment flows still work
- [ ] Check admin access controls
- [ ] Test on mobile devices

### Architecture Verification Checklist
- [ ] Frontend NEVER calls Binance REST API
- [ ] Backend NEVER calls Binance REST API
- [ ] Only Digital Ocean scripts call Binance REST API
- [ ] Watchlists store symbols only, not market data
- [ ] Client-side WebSocket for all market data
- [ ] Tier-based throttling in frontend
- [ ] No Redis dependency

## Testing Checklist

Before submitting changes:
- ✅ TypeScript type checking passes (`npm run type-check`)
- ✅ Next.js build succeeds (`npm run build`)
- ✅ Client-side Binance WebSocket works in browser
- ✅ Tier-based features are properly gated (Free/Pro/Elite)
- ✅ Authentication flows work correctly (email, OAuth, Web3)
- ✅ Admin access controls are verified (ADMIN role required)
- ✅ No console errors in browser
- ✅ Payment flows work (Stripe + NowPayments)
- ✅ Guest preview behaves correctly (top 5 rows, top 2 alerts)
- ✅ Mobile responsive design works
- ✅ Dark theme works correctly

## Key Features Overview

### Market Data
- **Real-time WebSocket**: Direct connection from browser to Binance
- **USDT Pairs Only**: Symbols with >$100M 24h volume
- **Sorting**: By 24h volume (descending)
- **Tier-based Symbol Limits**: Free (50), Pro (100), Elite (unlimited)
- **Client-side Filtering**: By watchlist symbols
- **Open Interest Column**: Pro/Elite only
- **Export**: TradingView format (Pro/Elite)

### Volume Alerts
- **Detection**: Digital Ocean script with Binance REST API
- **Broadcasting**: Socket.IO with tier-based rooms
- **Batching**: Wall-clock (15min/5min/instant)
- **Detection**: Bullish/bearish classification
- **Notifications**: Email (Pro), SMS (Elite - coming soon)
- **UI**: Sound, animation, history panel

### Watchlists
- **User-created**: Multiple watchlists per user
- **Symbol-only Storage**: No market data stored
- **Client-side Filtering**: Filter WebSocket data by symbols
- **Export**: CSV format

### Guest Experience
- **Live Dashboard Preview**: No authentication required
- **Limited Visibility**: Top 5 market rows, top 2 alerts
- **Blurred Content**: Additional rows/alerts blurred
- **Locked Features**: Sorting/export disabled with tooltips
- **Unified CTA**: Gradient pill for sign-up/upgrade
- **Dark Theme**: Default for all users

### Admin Panel
- **14 Pages**: Dashboard, Users, Subscriptions, Payments, Revenue, Audit, Metrics, Settings
- **Role-based Access**: ADMIN role required
- **Advanced Pagination**: Clickable page numbers with smart ellipsis
- **Revenue Analytics**: Time-series charts with Recharts
- **Payment Tools**: Create payments, tier mismatch repair, webhook debugging
- **User Management**: CRUD operations, status management
- **Audit Logging**: All admin actions logged

## Troubleshooting Common Issues

### Frontend Issues

**WebSocket not connecting**:
- Check `NEXT_PUBLIC_WS_URL` in `.env.local`
- Verify Binance WebSocket is accessible from your network
- Check browser console for connection errors
- Review `useClientOnlyMarketData` hook logs

**Auth not working**:
- Verify `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in `.env.local`
- Check backend is running on `NEXT_PUBLIC_API_URL`
- Review browser console for auth errors
- Verify database connection

**Payment redirect fails**:
- Check Stripe public key in `.env.local`
- Verify `NEXT_PUBLIC_API_URL` points to backend
- Check Stripe webhook configuration
- Review network tab for payment API calls

**Dark theme not working**:
- Check `next-themes` provider in [providers.tsx](volspike-nextjs-frontend/src/components/providers.tsx)
- Verify localStorage `theme` key
- Check Tailwind `dark:` classes

### Backend Issues

**Database connection fails**:
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running
- Test connection with `npx prisma studio`
- Check Neon dashboard for connection pooling

**Stripe webhooks fail**:
- Verify `STRIPE_WEBHOOK_SECRET` in `.env`
- Check Stripe dashboard webhook logs
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3001/api/payments/webhook`
- Review backend logs for webhook errors

**500 on admin endpoints**:
- Run `npx prisma migrate deploy` on Railway
- Check Railway logs for Prisma errors
- Verify all migrations are applied
- Check database schema matches Prisma schema

**NowPayments webhooks fail**:
- Verify `NOWPAYMENTS_IPN_SECRET` in `.env`
- Check NowPayments dashboard IPN settings
- Review backend logs for IPN errors
- Test with `/test-crypto-payment` endpoint

### Architecture Issues

**No market data showing**:
- Use `useClientOnlyMarketData` hook, NOT backend API
- Check browser console for WebSocket errors
- Verify `NEXT_PUBLIC_WS_URL` is set correctly
- Check Binance WebSocket accessibility from your network

**Watchlist empty**:
- Filter WebSocket data client-side by watchlist symbols
- Do NOT fetch market data from backend
- Check watchlist symbols are stored correctly in database
- Review client-side filtering logic

**Slow updates**:
- Check tier-based throttling settings
- Verify Elite tier has live updates (<150ms)
- Review `useClientOnlyMarketData` hook throttling logic
- Check browser performance

**Digital Ocean scripts not working**:
- Check `/home/trader/.volspike.env` exists
- Verify `ALERT_INGEST_API_KEY` matches backend
- Check systemd service status: `systemctl status binance-*`
- Review script logs

## Quick Decision Tree

### User asks to add feature involving market data:

1. **Is it frontend display?**
   → Use `useClientOnlyMarketData` hook

2. **Is it watchlist filtering?**
   → Filter WebSocket data client-side by symbols

3. **Is it backend endpoint?**
   → STOP. Backend never fetches market data

4. **Is it Python script?**
   → OK, can use Binance REST API

### User asks to fix authentication:

1. **Email/password?**
   → Check NextAuth.js config, SendGrid, password hashing

2. **OAuth?**
   → Check provider configuration in [auth.ts](volspike-nextjs-frontend/src/lib/auth.ts)

3. **Web3 (EVM)?**
   → Check RainbowKit setup, SIWE configuration

4. **Web3 (Solana)?**
   → Check Phantom integration, mobile deep-linking

5. **Session issues?**
   → Check JWT secret and session management

### User asks about payments:

1. **Stripe?**
   → Check webhook configuration, subscription management

2. **NowPayments?**
   → Check IPN webhook, currency formatting (`formatCryptoCurrency()`)

3. **Admin tools?**
   → Check role-based access control (ADMIN role required)

4. **Display issues?**
   → Check `formatCryptoCurrency()` function, NEVER modify without updating docs

### User asks about admin panel:

1. **Access denied?**
   → Check `role === 'ADMIN'` in database

2. **500 error?**
   → Run `npx prisma migrate deploy` on Railway

3. **Missing data?**
   → Check Prisma queries, pagination logic

4. **UI broken?**
   → Check Tailwind classes, responsive design

## Recent Critical Updates (December 2025)

1. **Admin Payments Workflow**
   - Create Payment from NowPayments dialog
   - Tier mismatch repair
   - Enhanced webhook debugging
   - Detailed error logging

2. **Revenue Analytics**
   - Comprehensive `/admin/revenue` page
   - Daily/monthly time-series charts with Recharts
   - Period selectors (1d/7d/30d/90d/1y)
   - Growth indicators
   - Payment method breakdown (Stripe/Crypto)

3. **UI Improvements**
   - Advanced pagination with clickable page numbers and smart ellipsis
   - Removed tier badges for cleaner UI
   - Fixed horizontal scrolling on mobile
   - Unified guest CTA pill
   - PREVIEW badge for guest dashboard

4. **Payment Fixes**
   - Order ID parsing improvements (handles test payments)
   - Webhook fallback auto-creation
   - Transaction-based atomic upgrades
   - Recovery mechanisms for failed payments
   - Enhanced logging for remote debugging

5. **Test Payment System**
   - `/test-crypto-payment` page for testing
   - $1 test payments restricted to test accounts (emails ending with `-test@volspike.com`)

6. **Payment Method Display Fix**
   - Fixed admin panel to correctly display cryptocurrency payment methods
   - Currency formatting: `formatCryptoCurrency()` function
   - Network identifier precedence: USDCE checked first before USDC
   - **CRITICAL**: Must update AGENTS.md, OVERVIEW.md, IMPLEMENTATION_PLAN.md if modified

## Getting Help

For detailed information on any topic, refer to [AGENTS.md](AGENTS.md) sections:
- **Setup & Build**: Development environment setup
- **Repository Layout**: Detailed file structure
- **Code Style & Rules**: Coding standards and patterns
- **Environment Variables**: Complete list of env vars
- **Troubleshooting**: Common issues and solutions
- **Recent Updates & Features**: Latest changes and additions
- **Authentication**: Multi-method auth implementation
- **Payments**: Stripe and NowPayments integration
- **Admin Panel**: Role-based access control
- **WebSocket**: Real-time data architecture
- **Testing**: Unit and integration testing

## Remember

- This is a **production-ready application** deployed at https://volspike.com
- **Security is paramount** (validate inputs, protect secrets, enforce RBAC)
- **User experience matters** (tier-based features, smooth UX, guest preview)
- **Performance is critical** (client-side WebSocket, no server bottleneck, sub-second updates)
- **Code quality matters** (TypeScript strict mode, proper error handling, comprehensive testing)
- **NO emojis** unless explicitly requested by the user
- **Architecture is unique** (client-only data, no Redis, no server-side market polling)
- **Documentation is mandatory** (update AGENTS.md, OVERVIEW.md, IMPLEMENTATION_PLAN.md when changing critical logic)

## Final Checklist

Before considering any task complete:
- [ ] Code follows TypeScript strict mode (no `any` types)
- [ ] Architecture rules are followed (client-only data)
- [ ] All tests pass with required coverage
- [ ] Documentation is updated if needed
- [ ] Commit message follows conventional commits
- [ ] Security best practices are followed
- [ ] Tier-based access controls are verified
- [ ] WebSocket connections remain stable
- [ ] Mobile responsive design works
- [ ] No console errors or warnings
- [ ] Production build succeeds

---

**Last Updated**: December 2025

For complete details, always refer to [AGENTS.md](AGENTS.md).

**Live Site**: https://volspike.com
**Repository**: https://github.com/VolSpike/VolSpike
**Founder & Lead Engineer**: Nik Sitnikov
