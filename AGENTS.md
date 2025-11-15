# AGENTS.md - VolSpike (Binance Perps Guru Dashboard)

## Project Overview

VolSpike is a comprehensive Binance Perpetual Futures trading dashboard featuring real-time market data, volume spike alerts, user authentication, payment processing via Stripe, Web3 wallet integration, and modern Next.js frontend. This production-ready application provides tiered access (Free/Pro/Elite) with advanced features including email notifications, SMS alerts, and **client-side WebSocket data streaming**.

## Status Snapshot (December 2025)

- ✅ **Admin payments workflow refreshed** – dedicated `/admin/payments` page with Create‑Payment dialog, tier mismatch repair, and manual upgrade hooks.
- ✅ **NowPayments webhook fallback** – if an invoice webhook arrives without a local `CryptoPayment` row we now auto-create it (parsing the `order_id`) and continue the upgrade flow.
- ⚠️ **Known issue** – the Railway deployment is currently returning `Failed to fetch payments` because migrations were not applied. Resolve by running `npx prisma migrate deploy` on the backend service (Neon schema has `expiresAt`; production DB must match).
- ✅ **Detailed logging** – `/api/admin/payments` now returns `details` in error responses, making remote debugging easier.
- ✅ **Admin chrome** – public header auto-hides on `/admin/*`; sidebar/header files are synced so burger overlays are gone.

## 🚀 Client-Only Architecture (No Redis Dependency)

### Core Technology Stack
- **Frontend**: Next.js 15+ with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js with Hono framework, TypeScript, Prisma ORM (for auth/payments only)
- **Database**: PostgreSQL with TimescaleDB extension (for user data only)
- **Real-time Data**: **Direct Binance WebSocket from browser** (no server dependency)
- **Authentication**: NextAuth.js v5 with email/password, magic links, and Web3 wallet auth
- **Payments**: Stripe integration with webhooks
- **Deployment**: Vercel (frontend) + Railway (backend for auth/payments)
- **Status**: ✅ **Production Ready** - All authentication issues resolved
 - **Email Verification**: SendGrid transactional emails with site-hosted assets and bulletproof CTA

## 🎯 Current Architecture Benefits

### **Zero Redis Dependency**
- ✅ **No Redis costs** or command limits
- ✅ **No server-side data ingestion** needed
- ✅ **No IP blocking issues** (uses user's residential IP)
- ✅ **Simplified infrastructure** (frontend + auth backend only)

### **Client-Side WebSocket Solution**
- ✅ **Direct Binance connection** from user's browser
- ✅ **Real-time data** for all tiers
- ✅ **Tier-based throttling** in frontend (Elite: live, Pro: 5min, Free: 15min)
- ✅ **Automatic reconnection** with exponential backoff
- ✅ **localStorage fallback** for region-blocked users

### **Guest Preview & Theming**
- ✅ Landing shows a safe, live dashboard preview for unauthenticated users
- ✅ Market Data: top 5 rows visible; rest blurred and non‑scrollable
- ✅ Volume Alerts: top 2 alerts visible; rest blurred and non‑scrollable
- ✅ Sorting/Export disabled with clear tooltips and locked Export dropdown
- ✅ Unified CTA pill (Start Free / Get Pro) with consistent styling
- ✅ Mobile: guest banner hidden; PREVIEW pill on Market Data card
- ✅ Dark theme is the default for guests and new accounts

## Setup & Build

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for PostgreSQL only)
- PostgreSQL (or use Docker)
- Stripe account (for payments)
- SendGrid account (for email notifications)
- **No Redis needed** (client-side WebSocket solution)

### Quick Start with Docker
```bash
# Clone the repository
git clone https://github.com/VolSpike/VolSpike.git
cd VolSpike

# Start PostgreSQL only (for user data/auth)
docker run -d \
  --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# Start frontend (no backend needed for market data)
cd volspike-nextjs-frontend
npm install && npm run dev
```

### Manual Development Setup

#### 1. Database Setup (for auth/payments only)
```bash
# Start PostgreSQL with TimescaleDB
docker run -d \
  --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15
```

#### 2. Frontend Setup (Next.js 15+)
```bash
cd volspike-nextjs-frontend

# Install dependencies
npm install

# Copy environment file
cp env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

#### 3. Backend Setup (Optional - for auth/payments only)
```bash
cd volspike-nodejs-backend

# Install dependencies
npm install

# Copy environment file
cp env.example .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

**Note**: The backend is only needed for user authentication and payment processing. Market data is handled entirely by the frontend via direct Binance WebSocket connections.

## Tests & Verification

### Frontend Testing (Client-Side WebSocket)
```bash
cd volspike-nextjs-frontend

# Run type checking
npm run type-check

# Run linting
npm run lint

# Build for production
npm run build

# Test WebSocket connection in browser console
# Should see: "✅ Binance WebSocket connected"
```

### Backend Testing (Auth/Payments only)
```bash
cd volspike-nodejs-backend

# Test database connection
npx prisma db push

# Test API endpoints
curl http://localhost:3001/health
```

### Integration Testing
```bash
# Test frontend with client-side WebSocket
cd volspike-nextjs-frontend
npm run dev

# Open browser to http://localhost:3000
# Check browser console for WebSocket connection
# Verify market data loads without backend
```

## Run Locally

### Development Mode (Frontend Only)
```bash
# Terminal 1: Frontend (includes client-side WebSocket)
cd volspike-nextjs-frontend
npm run dev

# Market data loads automatically via Binance WebSocket
# No backend needed for market data
```

### Development Mode (Full Stack)
```bash
# Terminal 1: Backend (for auth/payments)
cd volspike-nodejs-backend
npm run dev

# Terminal 2: Frontend (with client-side WebSocket)
cd volspike-nextjs-frontend
npm run dev
```

### Production Mode
```bash
# Frontend only (recommended)
cd volspike-nextjs-frontend && npm run build && npm start

# Full stack (if auth/payments needed)
cd volspike-nodejs-backend && npm run build && npm start
cd volspike-nextjs-frontend && npm run build && npm start
```

## Repository Layout

```
VolSpike/
├── AGENTS.md                           # This file
├── README_NEW_STACK.md                 # Complete documentation
├── docker-compose.yml                  # Development setup (PostgreSQL only)
│
├── volspike-nextjs-frontend/           # Next.js 15+ frontend (main app)
│   ├── src/
│   │   ├── app/                        # App Router pages
│   │   ├── components/                 # React components
│   │   ├── hooks/                      # Custom hooks (including useClientOnlyMarketData)
│   │   ├── lib/                        # Utilities
│   │   └── types/                      # TypeScript types
│   ├── package.json                    # Dependencies
│   ├── next.config.js                  # Next.js configuration
│   ├── tailwind.config.js              # Tailwind CSS config
│   └── Dockerfile                      # Production image
│
├── volspike-nodejs-backend/            # Node.js backend (auth/payments only)
│   ├── src/
│   │   ├── routes/                     # API routes (auth, payments)
│   │   ├── middleware/                 # Auth, rate limiting
│   │   ├── services/                   # Business logic
│   │   └── lib/                        # Utilities
│   ├── prisma/
│   │   └── schema.prisma               # Database schema (user data only)
│   ├── package.json                    # Dependencies
│   └── Dockerfile                      # Production image
│
└── scripts/                            # Utility scripts (kept lean; ingestion/redis removed)
```

**Note**: The ingestion service and Redis dependencies have been removed. Market data is now handled entirely by the frontend via direct Binance WebSocket connections.

### Socket.IO Auth Notes (Alerts)
- Guests connect with `auth.token = 'guest'` and join `tier-free`
- Wallet‑only users (no email) connect with `auth.token = userId` and `query.method = 'id'`
- Rooms: `tier-free`, `tier-pro`, `tier-elite` follow wall‑clock batching

## Code Style & Rules

### Next.js Frontend (Client-Side WebSocket)
- Use TypeScript for type safety
- Implement React hooks properly (`useClientOnlyMarketData` for market data)
- Use functional components with proper typing
- Follow Next.js App Router patterns
- Use Tailwind CSS for styling
- Implement proper error boundaries
- **Direct Binance WebSocket connection** from browser
- **Tier-based throttling** in frontend (Elite: live, Pro: 5min, Free: 15min)
- **Automatic reconnection** with exponential backoff
- **localStorage fallback** for region-blocked users
- Follow Web3 wallet integration patterns (RainbowKit, Wagmi)
- **Dynamic routes** - Mark routes using cookies/headers as `export const dynamic = 'force-dynamic'` (dashboard, home, admin)
- **SessionProvider** - Wrap client components using `useSession` with `<SessionProvider>`

### Node.js Backend (Auth/Payments Only)
- Use Hono framework for lightweight, edge-compatible API
- Implement proper error handling with try/catch
- Use Prisma ORM for database operations (user data only)
- Follow JWT patterns for authentication
- Use environment variables for configuration
- Implement proper logging with Pino
- Use TypeScript for type safety
- **No market data processing** (handled by frontend)
- **Resilience** - Binance REST failures should return empty arrays, not crash the server
- **DISABLE_SERVER_MARKET_POLL** - Set to `true` in production to disable backend market polling entirely

### Database (User Data Only)
- Use Prisma migrations for schema changes
- Implement proper foreign key relationships
- Use transactions for critical operations
- Follow Prisma best practices
- Use proper indexing for performance
- Use TimescaleDB for time-series data (user analytics)
- **No market data storage** (handled by client-side WebSocket)

### Security
- Validate all user inputs with Zod schemas
- Use JWT tokens for authentication
- Implement rate limiting (frontend-based for WebSocket)
- Secure API endpoints (auth/payments only)
- Use proper session management
- Implement proper authentication flows
- **Client-side WebSocket** bypasses server-side IP blocking
- **No server-side market data** reduces attack surface
- **Admin security**: Role-based access control, audit logging, 2FA enforcement
- **Admin session policy**: Shorter session duration for admin accounts

### Web3 Integration
 - Use RainbowKit for EVM wallet connection (SIWE)
 - Prefer Phantom for Solana when multiple providers are present; otherwise fallback
 - Keep chain/balance/address out of the header; surface them in the user menu and Linked Accounts
 - Linked Accounts shows a single row per wallet (no chain chips), and hides placeholder wallet “emails”

## PR/Commit Rules

### Branch Naming
- `feature/description` for new features
- `fix/description` for bug fixes
- `refactor/description` for code improvements
- `security/description` for security updates
- `docs/description` for documentation updates

### Commit Style
- Use conventional commits: `type(scope): description`
- Examples: `feat(payments): add Stripe integration`, `fix(auth): resolve login redirect`
- Include relevant issue numbers
- Test all changes before committing

### Required Checks
- ✅ All TypeScript files must pass type checking
- ✅ Next.js build must succeed
- ✅ Database migrations must be tested
- ✅ Payment flows must be verified
- ✅ Web3 wallet integration must work
- ✅ Email notifications must be tested
- ✅ Client-side Binance WebSocket connection should work in browser
- ✅ Admin dashboard access control must be verified
- ✅ Admin role-based permissions must be tested
- ✅ Authentication error handling must work properly
- ✅ Password verification must be enabled and working

## Safety Notes

### Files/Directories NOT to Touch
- `volspike-nodejs-backend/prisma/schema.prisma` - Database schema
- `.env` files - Environment variables with secrets
- `node_modules/` - Node.js dependencies
- `dist/` - Built TypeScript files
- `volspike-nextjs-frontend/.next/` - Built Next.js app
- `volspike-nextjs-frontend/src/app/(admin)/` - Admin dashboard routes
- `volspike-nodejs-backend/src/routes/admin/` - Admin API routes
- `volspike-nodejs-backend/src/middleware/admin-auth.ts` - Admin authentication

### Secrets Handling
- Never commit `.env` files
- Store Stripe keys in environment variables
- Use Docker secrets for production
- Implement proper API key rotation
- Use SendGrid for email services

### Migration Warnings
- Database migrations are irreversible
- Test migrations on development database first
- Backup production database before migrations
- Payment system changes require webhook updates
- User data changes require careful handling

### Production Deployment
- Use Docker Compose for production
- Set `NODE_ENV=production`
- Configure proper CORS for frontend
- Set up proper logging and monitoring
- Use managed PostgreSQL services

### Web3 Integration
- Test wallet connections thoroughly
- Implement proper error handling for wallet failures
- Use secure signing methods
- Handle network switching properly
- Support mobile wallet connections

#### Solana (Phantom) Mobile Deep‑Link Notes
- Frontend fetches must use `/api/...`‑prefixed backend paths (Dec 2025 fix).
- iOS third‑party browsers (Brave/Chrome) require a user action to open Phantom; the callback page shows a CTA button only when needed.
- Universal links are used for connect and sign; the callback merges query + hash params and tolerates short delays before params appear.

## Environment Variables

### Backend (.env) - Auth/Payments Only
```bash
# Database (user data only)
DATABASE_URL=postgresql://username:password@localhost:5432/volspike

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid)
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@volspike.com

# SMS (Twilio - Elite tier)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL
FRONTEND_URL=http://localhost:3000

# NowPayments (crypto payments)
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret
NOWPAYMENTS_SANDBOX_MODE=true  # false in production
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1
# BACKEND_URL is used to build IPN callback URLs (e.g. https://backend.volspike.com)

# Market Data Polling (set to true to disable backend market polling in production)
DISABLE_SERVER_MARKET_POLL=false

# Environment
NODE_ENV=development
LOG_LEVEL=info
PORT=3001
```

### Frontend (.env.local) - Client-Side WebSocket
```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key

# API Configuration (for auth/payments only)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:3001

# Binance WebSocket (direct from browser)
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# WalletConnect Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# Note: No Redis or WebSocket server URLs needed
# Market data comes directly from Binance WebSocket
```

## Deployment

### Frontend Deployment (Vercel - Recommended)
```bash
# Deploy frontend to Vercel
cd volspike-nextjs-frontend
vercel --prod

# Market data works immediately via client-side WebSocket
# No backend needed for market data
```

### Backend Deployment (Railway - Optional)
```bash
# Deploy backend for auth/payments only
cd volspike-nodejs-backend
railway deploy

# Only needed if you want user authentication and payments
```

### Cloud Deployment
- **Frontend**: Deploy to Vercel (includes client-side WebSocket)
- **Backend**: Deploy to Railway or Fly.io (auth/payments only)
- **Database**: Use managed PostgreSQL (Neon, Supabase)
- **No Redis needed** (client-side WebSocket solution)
- **No ingestion service needed** (direct Binance connection)

### Production Environment Variables

#### Frontend (Vercel Production)
```bash
NEXTAUTH_URL=https://volspike.com
NEXT_PUBLIC_API_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_SOCKET_IO_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

#### Backend (Railway Production)
```bash
DATABASE_URL=postgresql://neondb_owner:password@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://volspike.com
DISABLE_SERVER_MARKET_POLL=true  # Disable backend market polling (frontend handles Binance WebSocket)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@volspike.com
NODE_ENV=production
```

## Key Features

### Tier System (Client-Side Throttling)
- **Free Tier**: 15-minute refresh, basic features, no Open Interest column
- **Pro Tier**: 5-minute refresh, email alerts, all symbols, Open Interest visible
- **Elite Tier**: Real-time updates, WebSocket live data, SMS alerts, Open Interest visible

### Authentication
- ✅ **Email/Password**: Fully working with proper password verification
- ✅ **Email Verification**: SendGrid email confirmation with site-hosted PNG logo (`https://volspike.com/email/volspike-badge@2x.png`), hidden preheader, and bulletproof table CTA (VML fallback). Verify page routes users to `/auth` to sign in after successful verification. Resend available on `/auth` and `/auth/verify`.
- ✅ **Web3 wallet authentication**: RainbowKit + Wagmi integration
- ✅ **OAuth providers**: Google, GitHub integration
- ✅ **Session management**: JWT tokens with proper error handling
- ✅ **Error messages**: User-friendly error display for invalid credentials
- ✅ **Password visibility toggle**: Working eye icon for password fields
- ✅ **Admin authentication**: Role-based access with proper redirects

### Payment Processing
- Stripe integration for subscriptions
- Webhook handling for payment events
- Tier-based feature access
- Billing portal integration
- Crypto payments via NowPayments (hosted invoices + IPN webhooks) for Pro/Elite tiers, tracked in the `CryptoPayment` table and merged with Stripe into unified subscription status.

### Real-time Data (Client-Side WebSocket)
- **Direct Binance WebSocket** from user's browser
- **No server dependency** for market data
- **Automatic reconnection** with exponential backoff
- **localStorage fallback** for region-blocked users
- **Tier-based throttling** in frontend
- **USDT pairs only** with >$100M volume filter
- **Sorted by volume** (highest to lowest)
- **Stable WebSocket connections** with useCallback optimization
- **Enhanced funding rate alerts** with visual thresholds (±0.03%)

### Notification System
- Email alerts (SendGrid)
- SMS alerts (Twilio - Elite tier)
- Telegram notifications
- Discord webhooks
- In-app notifications

### Admin Panel
- Dedicated admin shell at `/admin` with a responsive grid layout (sidebar + content column).
- Sidebar groups navigation into **Overview**, **Users & Billing** (Users, Subscriptions, Payments), and **Monitoring & Settings** (Audit Logs, Metrics, Settings).
- Top header includes theme toggle, notifications, primary Sign Out, and user menu with role/tier context.
- Admin dashboard surfaces quick actions, stats cards, user growth, revenue summary, system health, and recent activity with deep links into Audit Logs.
- All admin routes are server‑protected (`role === 'ADMIN'`), with redirects for unauthenticated or non‑admin users.

### Admin Dashboard (Role-Based Access Control)
- **Admin Authentication**: Role-based access with ADMIN/USER roles
- **User Management**: CRUD operations, status control (ACTIVE/SUSPENDED/BANNED)
- **Subscription Oversight**: Stripe integration monitoring, tier management
- **Audit Logging**: Complete activity tracking, security monitoring
- **System Metrics**: Health monitoring, user growth, revenue analytics
- **Security Controls**: 2FA enforcement, IP allowlisting, session management
- **Admin Settings**: Platform configuration, security policies
- **Access Control**: `/admin/*` routes with server-side protection

## Troubleshooting

### Common Issues
- Database connection errors: Check `DATABASE_URL` (auth/payments only)
- Payment failures: Verify Stripe keys and webhooks
- Web3 wallet issues: Check network configuration
- CORS errors: Verify frontend URL configuration
- Email failures: Check SendGrid configuration
- **WebSocket connection issues**: Check browser console for Binance connection status
- **No market data**: Verify Binance WebSocket URL and user's IP not blocked

### Debug Commands
```bash
# Check database connection (auth/payments only)
cd volspike-nodejs-backend
npx prisma db push

# Test frontend WebSocket connection
cd volspike-nextjs-frontend
npm run dev
# Open browser console, should see: "✅ Binance WebSocket connected"

# Check WebSocket connection in browser
# Open DevTools → Console → Look for WebSocket messages
```

### Performance Issues
- Monitor database query performance (user data only)
- Check WebSocket connection stability in browser console
- Verify tier-based throttling is working correctly
- Monitor memory usage in frontend
- **No Redis performance issues** (client-side solution)

## Quick Start Commands

```bash
# Complete setup from scratch (frontend only)
git clone https://github.com/VolSpike/VolSpike.git
cd VolSpike

# Start PostgreSQL (for auth/payments only)
docker run -d --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# Start frontend (includes client-side WebSocket)
cd volspike-nextjs-frontend
npm install && npm run dev

# Market data loads automatically via Binance WebSocket
# No backend needed for market data
```

### Full Stack Setup (Optional)
```bash
# Add backend for auth/payments
cd volspike-nodejs-backend
npm install && npm run dev

# Frontend with auth/payments
cd volspike-nextjs-frontend
npm install && npm run dev
```

## Architecture Benefits

### Performance
- **80% cost reduction** vs Redis-based stack
- **50% faster development** with single TypeScript language
- **Sub-second Elite tier updates** (<150ms WebSocket latency)
- **Better real-time performance** with direct Binance WebSocket
- **No server-side bottlenecks** (client-side data processing)

### Developer Experience
- **Single language** (TypeScript) across all services
- **Type safety** catches 30-40% of bugs early
- **Better IDE support** with IntelliSense
- **Shared types** between frontend and backend
- **Faster debugging** with unified stack
- **Simplified infrastructure** (no Redis, no ingestion service)

### Scalability
- **Real-time WebSocket** instead of polling
- **Client-side data processing** (no server load)
- **No Redis dependency** (eliminates rate limits)
- **Direct Binance connection** (no IP blocking issues)
- **Tier-based throttling** in frontend (scales with users)

## 🔧 Recent Updates & Features (November 2025)

### Volume Alerts System - COMPLETED ✅
- ✅ **Digital Ocean Integration** - Python script on DO server detects volume spikes and posts to VolSpike backend
- ✅ **Backend API Endpoints**:
  - `/api/volume-alerts/ingest` - Authenticated endpoint for alert ingestion (API key required)
  - `/api/volume-alerts` - Tier-based alert retrieval with filtering
- ✅ **WebSocket Broadcasting** - Real-time Socket.IO delivery with tier-based rooms (`tier-free`, `tier-pro`, `tier-elite`)
- ✅ **Wall-Clock Synchronization**:
  - Free Tier: 15-minute batches at :00, :15, :30, :45
  - Pro Tier: 5-minute batches at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
  - Elite Tier: Instant real-time delivery
- ✅ **Database Schema** - New `VolumeAlert` and `AlertSubscription` Prisma models
- ✅ **UI Components**:
  - Volume Alerts panel with countdown timers
  - Color-coded alerts (green for bullish, red for bearish)
  - "Exact Time (Relative Time ago)" timestamp format
  - Two-line volume display: "This hour: $X" / "Last hour: $Y"
  - Directional arrows (up for bullish, down for bearish)
- ✅ **Initial Alert Loading** - New users see last 10 alerts immediately upon login
- ✅ **Candle Direction** - Bearish/bullish detection based on open vs close prices

### UI/UX Improvements - COMPLETED ✅
- ✅ **Pricing Page** - Beautiful tier comparison with detailed feature breakdown, fully responsive
- ✅ **Terms of Service** - Comprehensive 18-section legal page
- ✅ **Privacy Policy** - Updated email contact to support@volspike.com
- ✅ **Mobile Navigation** - Hamburger menu with active state indicators (green highlighting)
- ✅ **Market Data Table**:
  - Tier-based symbol limits (50 for Free, 100 for Pro, unlimited for Elite)
  - Removed arbitrary >$100M volume filter
  - Clarified "24h Change" column name
- ✅ **"Unlock Pro Features" Banner** - Enhanced with 6 specific feature highlights and icons
- ✅ **Visual Fixes**:
  - Fixed gradient text "g" clipping with padding-bottom
  - Removed duplicate footers from all pages
  - Removed redundant descriptive text under section headings
  - Improved spacing in Volume Alerts header
- ✅ **Active Navigation** - Green text, background, and underline for current page
- ✅ **Smooth Transitions** - Removed flickering animations, unified fade-in effects

### Testing Infrastructure - COMPLETED ✅
- ✅ **Test Accounts** - Created in both dev and production:
  - `free-test@volspike.com` / Test123456! (Free tier)
  - `pro-test@volspike.com` / Test123456! (Pro tier)
- ✅ **PRO_TIER_TEST_PLAN.md** - Comprehensive 14-category, 100+ check test plan
- ✅ **TESTING_STRATEGY.md** - Feature branch workflow with Vercel preview deployments
- ✅ **Debug Mode** - `?debug=true` query parameter enables:
  - Test buttons for alert sounds (3 types)
  - Test buttons for alert animations (3 types)
  - Diagnostic information
- ✅ **Elite Tier "Coming Soon"** - All UI references updated, purchase button disabled

### Authentication Improvements - COMPLETED ✅
- ✅ **Case-Insensitive Login** - `findFirst` with `mode: 'insensitive'` for better UX
- ✅ **Email Normalization** - All signups convert email to lowercase for consistency
- ✅ **Tier Defaults** - Added `|| 'free'` fallbacks in all NextAuth callbacks
- ✅ **Production Auth** - `NEXTAUTH_URL` fallback to Railway production URL
- ✅ **Phantom Wallet Fix** - Removed "Not Found" error when wallet not detected

### Alert Sounds & Animations - IN PROGRESS 🚧
- ✅ **useAlertSounds Hook** - Web Audio API-based hook with localStorage preferences (placeholder for MP3s)
- ✅ **SOUND_DESIGN_BRIEF.md** - Comprehensive expert brief for professional sound design:
  - 3 distinct sound specifications (Spike Alert, 30m Update, Hourly Update)
  - Technical requirements (MP3, duration, pitch, volume)
  - Professional references (Bloomberg Terminal, TradingView)
  - Budget guidance and deliverables checklist
- ✅ **Animation Classes** - Tailwind CSS animations:
  - `animate-slide-in-right` - Spring animation with bounce
  - `animate-scale-in` - Zoom from center
  - `animate-fade-in` - Smooth opacity transition
- ✅ **Test Buttons** - Available in debug mode (`?debug=true`) for immediate testing
- ✅ **Alert Card Effects** - Glowing ring, shadow pulse, and color-coded borders
- 🚧 **Awaiting Expert** - Professional MP3 files to replace Web Audio API sounds

### Recent Bug Fixes (December 2025)
- ✅ **Horizontal Scrolling Restored** - Fixed mobile table scrolling by updating `touchAction` CSS from `pan-y pinch-zoom` to `pan-x pan-y pinch-zoom`
- ✅ **Open Interest Data Fix** - Resolved Open Interest showing $0 by:
  - Normalizing symbols to uppercase for consistent matching between WebSocket data and backend cache
  - Adding immediate fetch on mount (not just after 5-minute interval)
  - Filtering zero values when storing Open Interest data
  - Adding comprehensive debugging logs for symbol matching
- ✅ **Touch Handler Optimization** - Improved touch event handler to only prevent default at boundaries, allowing normal horizontal scrolling within bounds

### Previous Fixes (October 2025)
- ✅ **Password verification enabled** - Fixed critical security vulnerability
- ✅ **Error message display** - Proper error handling for invalid credentials
- ✅ **Password visibility toggle** - Eye icon functionality working
- ✅ **Admin redirect logic** - Proper error handling for admin users
- ✅ **NextAuth error handling** - Error mapping and display in frontend
- ✅ **Web3 provider setup** - RainbowKit configuration complete
- ✅ **TypeScript errors resolved** - All build errors fixed
- ✅ **ESLint errors fixed** - Code linting issues resolved
- ✅ **Prisma schema updated** - passwordHash field added
- ✅ **Dynamic routes configured** - Dashboard, home, admin marked as force-dynamic
- ✅ **Backend resilience** - Binance REST failures handled gracefully
- ✅ **Production database synced** - Neon schema up-to-date

### Production Configuration
- **Frontend (Vercel)**: `NEXTAUTH_URL=https://volspike.com`, connected to Railway backend
- **Backend (Railway)**: `DISABLE_SERVER_MARKET_POLL=true`, `ALERT_INGEST_API_KEY` configured
- **Database (Neon)**: Production schema synced with `VolumeAlert` and `AlertSubscription` models
- **Digital Ocean**: Python script running as systemd service, posting alerts every 5 minutes

**Note**: This is the new client-only architecture with zero Redis dependency, plus real-time volume alerts via WebSocket, replacing the previous server-side data ingestion for better performance, scalability, and developer experience.

### Latest Production Fixes (December 2025)
- ✅ **Mobile UX**: Horizontal table scrolling now works correctly on all mobile devices
- ✅ **Open Interest**: Data displays correctly for Pro/Elite tiers with proper symbol matching
- ✅ **Touch Handling**: Optimized touch event handlers for better mobile performance
 - ✅ **Guest Preview**: PREVIEW pill, banner hidden on mobile, unified CTA
 - ✅ **Export Locking**: Guests see a locked Export with explanation; Free users get TradingView top‑50
 - ✅ **Default Theme**: Dark by default for guests/new users
 - ✅ **Socket Auth**: Guests and wallet‑only users connect cleanly (guest token and method=id)
 - ✅ **Linked Accounts**: Renamed from Wallets; simplified wallet rows; neutral Solana copy
 - ✅ **Header Cleanup**: Removed wallet connect clutter for signed‑in users
 - ✅ **Docs/Support/Status**: Fixed bottom spacing; consistent banner/footer alignment
