# VolSpike — Implementation Plan (Current State and MVP Launch Path)

Last updated: December 2025

## Current state (production)
- Auth: Email/password with verification (SendGrid), OAuth (Google/GitHub), EVM wallets (RainbowKit, SIWE), Solana Phantom (mobile deep‑link flow fixed).
- Data: Client‑side Binance WebSocket; tier throttling (Free 15m, Pro 5m, Elite live).
- Alerts: DigitalOcean script → `/api/volume-alerts/ingest` → DB → Socket.IO → UI; initial 10 alerts on login; wall‑clock batching.
- Payments: Stripe subscriptions; webhook wired; customer portal.
- UI/UX: Responsive dashboard, pricing, terms, privacy; mobile scrolling/touch fixed; Pro banner; Open Interest fixed (Pro/Elite).
- Infra: Vercel frontend; Railway backend; Neon Postgres.

## What’s in code (key endpoints)
- Health: `GET /health`
- Auth (EVM SIWE): `/api/auth/siwe/prepare`, `/api/auth/siwe/verify`
- Auth (Solana Phantom): `/api/auth/phantom/dl/start`, `/sign-url`, `/decrypt`, `/api/auth/solana/nonce|prepare|verify`
- Alerts: `/api/volume-alerts/ingest`, `/api/volume-alerts`
- Open Interest: `GET /api/market/open-interest`
- Payments: `/api/payments/*` (checkout, webhook, portal)
- Admin: `/api/admin/*` (role‑protected)

## MVP scope (ready vs minimal to finish)
Ready now:
- Sign up/in (email/password + OAuth + EVM wallets + Solana Phantom mobile)
- Real‑time market table with tier throttling
- Volume Alerts streaming + initial history
- Stripe checkout + basic subscription gating
- Open Interest column (Pro/Elite)
- Basic admin and health checks

Minimal to finish before launch:
1) Email alerts for Pro (single template, 15 min cadence)
2) “Elite Coming Soon” gating with waitlist capture (no purchase)
3) Harden payments: confirm proration + cancel flows in UI
4) Remove public debug UI; keep `?debug=true` only

Nice‑to‑have (post‑launch):
- Sound assets for alerts (replace placeholders)
- Telegram/Discord integrations for Elite
- Basic charts for funding/volume (last 24h)

## Test accounts
- free-test@volspike.com / Test123456!
- pro-test@volspike.com / Test123456!

## Deployment notes
- Frontend deploy = Vercel; backend deploy optional (auth/payments/alerts only).
- Ensure backend envs present; `/health` must return 200.

## Owner checklist (go/no‑go)
- [ ] New user signup (email) + verification + login
- [ ] Pro checkout success + tier reflected within 1 min
- [ ] Market data loads instantly (client WS) on Free/Pro
- [ ] Volume Alerts stream in; last 10 visible
- [ ] Open Interest shows non‑zero for Pro/Elite symbols
- [ ] Solana Phantom mobile sign‑in completes to dashboard
- [ ] Admin access restricted; health endpoint OK


