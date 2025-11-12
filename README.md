# VolSpike — Binance Perps Guru Dashboard

Production-ready trading dashboard with client-side Binance WebSocket, tiered access, wallet + email auth, Stripe subscriptions, and real-time volume alerts.

## Quick links
- Production: https://volspike.com
- Backend API: https://volspike-production.up.railway.app
- Repo: https://github.com/NikolaySitnikov/VolSpike

## Architecture (current)
- Frontend: Next.js 15 (TypeScript, Tailwind, shadcn/ui)
- Realtime data: Direct Binance WebSocket in the browser (no server ingestion, no Redis)
- Backend (optional): Hono + Prisma on Railway for auth, payments, alerts
- DB: PostgreSQL (Neon) for user/subscription/alerts only
- Auth: NextAuth v5 (email/password, Google/GitHub OAuth, web3 via RainbowKit, SIWE)
- Payments: Stripe (subscriptions + webhook)
- Alerts: DO Python detects volume spikes → posts to backend → Socket.IO broadcast to tiers

## Current status (December 2025)
- ✅ Authentication stable, passwords verified, friendly error handling
- ✅ Web3 sign‑in (EVM) via RainbowKit; Solana Phantom mobile deep‑link flow fixed
- ✅ Client-only WebSocket market data with tier throttling (Free 15m, Pro 5m, Elite live)
- ✅ Volume Alerts end‑to‑end (ingest → DB → Socket.IO → UI)
- ✅ Open Interest display fixed and reliable for Pro/Elite
- ✅ Mobile UX fixes: horizontal table scrolling and touch handling
- ✅ Pricing, Terms, Privacy pages complete
- 🚧 Sounds/animations: placeholder sounds, awaiting professional MP3s

## Run locally
```bash
git clone https://github.com/NikolaySitnikov/VolSpike.git
cd VolSpike

# Start DB (for auth/payments only)
docker run -d --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 timescale/timescaledb:latest-pg15

# Frontend (market data works without backend)
cd volspike-nextjs-frontend
npm install
cp env.example .env.local
npm run dev
```

Optional backend (auth/payments/alerts):
```bash
cd volspike-nodejs-backend
npm install
cp env.example .env
npx prisma generate && npx prisma db push
npm run dev
```

## Environment variables (production)
Frontend (Vercel):
```
NEXTAUTH_URL=https://volspike.com
NEXT_PUBLIC_API_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_SOCKET_IO_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

Backend (Railway):
```
DATABASE_URL=postgresql://... (Neon)
JWT_SECRET=...
FRONTEND_URL=https://volspike.com
DISABLE_SERVER_MARKET_POLL=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@volspike.com
NODE_ENV=production
```

## Key endpoints (actual, current)
- Health: `GET /health`
- Auth (EVM SIWE): `POST /api/auth/siwe/prepare`, `POST /api/auth/siwe/verify`
- Auth (Solana Phantom deep‑link):
  - `POST /api/auth/phantom/dl/start`
  - `POST /api/auth/phantom/dl/sign-url`
  - `POST /api/auth/phantom/dl/decrypt`
  - `POST /api/auth/solana/nonce`
  - `GET  /api/auth/solana/prepare`
  - `POST /api/auth/solana/verify`
- Volume Alerts: `POST /api/volume-alerts/ingest`, `GET /api/volume-alerts`
- Open Interest: `GET /api/market/open-interest`
- Payments: `POST /api/payments/checkout`, `POST /api/payments/webhook`, etc.
- Admin: ` /api/admin/*` (role-protected)

Note: Market data is client-side only; no server ingestion or Redis.

## Deployment
- Frontend: Vercel (recommended). Client-only WebSocket works immediately.
- Backend: Railway (auth/payments/alerts only). Ensure `/health` returns 200.

## Solana Phantom (mobile) notes
- iOS third‑party browsers require user interaction to open Phantom; we show a CTA button on `/auth/phantom-callback`.
- Deep‑link start and server‑built sign URL use universal links; callback merges query + hash params.
- Frontend fetches use `/api/...`-prefixed paths (fixed in Dec 2025).

## Where to read more
- `OVERVIEW.md` — deep product and architecture overview (kept current)
- `AGENTS.md` — contributor rules, envs, deployment, recent updates
- `IMPLEMENTATION_ROADMAP.md` — detailed plan, status, and next steps

Last updated: December 2025
# Test direct push by owner
test
test via PR
