# VolSpike — Implementation Plan (Current State and MVP Launch Path)

**Repository**: [https://github.com/VolSpike/VolSpike](https://github.com/VolSpike/VolSpike)  
**Live Demo**: [https://volspike.com](https://volspike.com)  
**Founder & Lead Engineer**: Nik Sitnikov

Last updated: December 2025 (Revenue Analytics, pagination improvements, payment webhook fixes, test payment system)

## Current state (production)
- Auth: Email/password with verification (SendGrid), OAuth (Google), EVM wallets (RainbowKit + SIWE), Solana (prefers Phantom; mobile deep‑link).
- Data: Client‑side Binance WebSocket; tier throttling (Free 15m, Pro 5m, Elite live).
- Alerts: DO script → `/api/volume-alerts/ingest` → DB → Socket.IO → UI; initial 10 alerts on login; wall‑clock batching.
- Guests: Live dashboard preview at `/` (top 5 Market Data, top 2 Alerts; sorting/export locked). Dark is default theme.
- Sockets: Guest token `guest` joins `tier-free`; wallet‑only users connect with `method=id` and token=user id.
- Payments: Stripe subscriptions (checkout + customer portal) plus NowPayments crypto payments for Pro/Elite (hosted invoices + IPN webhooks) feeding a `CryptoPayment` table and unified subscription status.
- Admin Payments tooling exposes filters, tier repair actions, and a "Create Payment from NOWPayments" dialog so support can log verified invoices instantly.
- Admin Revenue Analytics: Comprehensive `/admin/revenue` page with daily/monthly time-series charts, period selectors (1d/7d/30d/90d/1y), growth indicators, and breakdown by payment method (Stripe/Crypto) and tier (Pro/Elite).
- Admin Users table: Advanced pagination with clickable page numbers and smart ellipsis; removed tier badges/tooltips for cleaner UI.
- Payment webhook improvements: Enhanced order ID parsing (handles test payments), partial matching by timestamp, transaction-based atomic upgrades, and recovery mechanisms.
- Test payment system: `/test-crypto-payment` page allows test accounts (emails ending with `-test@volspike.com`) to pay $1 for testing crypto upgrade flows.
- UI/UX: Unified guest CTA pill, PREVIEW pill, export lock state, compact mobile Export, header decluttered, Linked Accounts tab (no chain chips), doc/support/status spacing fixed.
- Admin: Role‑based admin panel at `/admin` with dashboard (quick actions, stats, user growth, revenue, system health, recent activity), Users, Subscriptions, Payments, Revenue Analytics, Audit Logs, Metrics, and Settings — all behind `role === 'ADMIN'` checks.
- Infra: Vercel frontend; Railway backend; Neon Postgres.

## What’s in code (key endpoints)
- Health: `GET /health`
- Auth (EVM SIWE): `/api/auth/siwe/prepare`, `/api/auth/siwe/verify`
- Auth (Solana Phantom): `/api/auth/phantom/dl/start`, `/sign-url`, `/decrypt`, `/api/auth/solana/nonce|prepare|verify`
- Alerts: `/api/volume-alerts/ingest`, `/api/volume-alerts`
- Open Interest: `GET /api/market/open-interest`
- Payments: `/api/payments/*` (checkout, webhook, portal)
- Admin: `/api/admin/*` (role‑protected)
  - Revenue Analytics: `/api/admin/metrics/revenue-analytics` (daily/monthly time-series data)
- Crypto Payments (NowPayments): `/api/payments/nowpayments/checkout`, `/api/payments/nowpayments/test-checkout` (test accounts only), `/api/payments/nowpayments/webhook`, and crypto subscription surfaced via `/api/payments/subscription`

## MVP scope (ready vs minimal to finish)
Ready now:
- Sign up/in (email/password + OAuth + EVM wallets + Solana Phantom mobile)
- Real‑time market table with tier throttling
- Volume Alerts streaming + initial history
- Email alerts for Pro (SendGrid template, 15‑minute cadence)
- Elite tier is “Coming Soon” in UI with purchase disabled and copy aligned to waitlist positioning
- Stripe checkout + basic subscription gating
- Open Interest column (Pro/Elite)
- Admin panel and health checks (dashboard, Users, Subscriptions, Payments, Revenue Analytics, Audit Logs, Metrics, Settings)
- Guest landing preview + sockets for guests/wallet‑only users
- Debug tools available only behind `?debug=true`

Remaining polish before launch:
1) Harden payments: confirm proration + cancel flows in UI (especially downgrade/upgrade edges)
2) Ensure Railway deployment runs `npx prisma migrate deploy` whenever schema changes (current 500 on `/api/admin/payments` is due to missing migrations); document the runbook.
3) Optional: wallet chooser modal for Solana with remembered preference

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
