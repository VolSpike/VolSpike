# VolSpike — Implementation Plan (Current State and MVP Launch Path)

**Repository**: [https://github.com/VolSpike/VolSpike](https://github.com/VolSpike/VolSpike)  
**Live Demo**: [https://volspike.com](https://volspike.com)  
**Founder & Lead Engineer**: Nik Sitnikov

Last updated: December 2025

## Current state (production)
- Auth: Email/password with verification (SendGrid), OAuth (Google), EVM wallets (RainbowKit + SIWE), Solana (prefers Phantom; mobile deep‑link).
- Data: Client‑side Binance WebSocket; tier throttling (Free 15m, Pro 5m, Elite live).
- Alerts: DO script → `/api/volume-alerts/ingest` → DB → Socket.IO → UI; initial 10 alerts on login; wall‑clock batching.
- Guests: Live dashboard preview at `/` (top 5 Market Data, top 2 Alerts; sorting/export locked). Dark is default theme.
- Sockets: Guest token `guest` joins `tier-free`; wallet‑only users connect with `method=id` and token=user id.
- Payments: Stripe subscriptions; webhook wired; customer portal.
- UI/UX: Unified guest CTA pill, PREVIEW pill, export lock state, compact mobile Export, header decluttered, Linked Accounts tab (no chain chips), doc/support/status spacing fixed.
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
- Guest landing preview + sockets for guests/wallet‑only users

Minimal to finish before launch:
1) Email alerts for Pro (single template, 15 min cadence)
2) “Elite Coming Soon” gating with waitlist capture (no purchase)
3) Harden payments: confirm proration + cancel flows in UI
4) Remove public debug UI; keep `?debug=true` only
5) Optional: wallet chooser modal for Solana with remembered preference

Nice‑to‑have (post‑launch):
- Sound assets for alerts (replace placeholders)
- Telegram/Discord integrations for Elite
- Basic charts for funding/volume (last 24h)

## Test accounts
- free-test@volspike.com / Test123456!
- pro-test@volspike.com / Test123456!

## Deployment notes
- **Frontend**: Vercel (automatic deployments from `main` branch)
- **Backend**: Railway (automatic deployments from `main` branch)
- **Database**: Neon PostgreSQL (managed)
- Ensure backend envs present; `/health` must return 200.
- Both platforms connected to `VolSpike/VolSpike` organization repository

## Owner checklist (go/no‑go)
- [ ] New user signup (email) + verification + login
- [ ] Pro checkout success + tier reflected within 1 min
- [ ] Market data loads instantly (client WS) on Free/Pro
- [ ] Volume Alerts stream in; last 10 visible
- [ ] Open Interest shows non‑zero for Pro/Elite symbols
- [ ] Solana Phantom mobile sign‑in completes to dashboard
- [ ] Admin access restricted; health endpoint OK
- [ ] Guest landing preview behaves correctly (top 5 / top 2, export & sorting locked)

