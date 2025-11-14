# VolSpike — Overview (December 2025)

VolSpike is a production‑ready Binance Perpetual Futures dashboard featuring real‑time market data, volume spike alerts, authentication with email/OAuth/Web3 wallets, and Stripe‑based subscriptions. The app is designed for a fast, low‑ops footprint: the frontend connects directly to Binance from the browser, while the backend focuses on auth, subscriptions, and alert broadcasting.

## Key Characteristics
- Client‑only market data: Direct Binance WebSocket in the browser (no Redis, no ingestion workers)
- Tiered UX: Free / Pro / Elite with clear, friendly gating
- Guest Preview: Landing on `/` shows a live preview without signing in
- Real‑time Volume Alerts: DO script → API ingest → DB → Socket.IO → UI (with wall‑clock batching)
- Simple infrastructure: Vercel (frontend) + Railway (backend) + Neon (Postgres)

## Guest Preview (Landing Experience)
- Market Data: Top 5 rows are visible; additional rows are blurred and non‑scrollable
- Volume Alerts: Top 2 alerts are visible; the rest are blurred and non‑scrollable
- Sorting & Export: Disabled for guests with clear tooltips and “Export” lock state
- CTAs: Unobtrusive, theme‑consistent pill (Start Free / Get Pro)
- Mobile UX: Banner is hidden on small screens to reduce clutter; a PREVIEW badge appears on the Market Data card
- Theme: Dark is the default for guests and new accounts

## Tiers & Rates
- Free: 15‑minute cadence (Live label for sockets; wall‑clock batched alerts)
- Pro: 5‑minute cadence + Open Interest column, exports
- Elite: Real‑time

## Real‑Time Data
- Market Data: Direct Binance WebSocket from the browser
- Volume Alerts: Socket.IO, tier‑room broadcast
  - Guests connect with auth token `guest` and join `tier-free` room
  - Wallet‑only users (no email) connect using `method=id` and token=user id

## Authentication
- Email + Password (verification via SendGrid)
- OAuth (Google)
- Web3 Wallets: EVM (SIWE via RainbowKit) and Solana
  - Solana provider preference: Phantom when available; otherwise default injected provider

## Linked Accounts
- Settings tab is “Linked Accounts” (formerly “Wallets”)
- Single row per wallet (EVM or SOL) with address only; no chain chips
- Email & Password shows a real address only (placeholder `@volspike.wallet` is suppressed)

## UI/UX System
- Default dark theme; users can switch explicitly
- Mobile: horizontal scrolling fixes in tables; overflow‑safe Export button
- Header: no wallet connect clutter for signed‑in users; wallet actions live in Linked Accounts and the user menu
- Docs/Support/Status pages: consistent spacing; no extra gap before ad/footer

## Code Map (High Level)
- `volspike-nextjs-frontend/` — Next.js (App Router, TS, Tailwind, shadcn/ui)
  - `src/components/market-table.tsx` — Market table, guest gating, export
  - `src/components/volume-alerts-panel.tsx` — Alerts panel + guest blur
  - `src/hooks/use-volume-alerts.ts` — Alerts fetch/socket logic (guest + wallet‑only)
  - `src/components/account-management.tsx` — Linked Accounts (email/oauth/wallets)
  - `src/components/header.tsx` — Clean header, no wallet clutter for signed‑in
  - `src/components/guest-cta.tsx` — Unified gradient CTA pill
  - `src/components/providers.tsx` — Providers + Theme (default: dark)
- `volspike-nodejs-backend/` — Hono API (auth/payments/alerts), Prisma
  - `src/routes/volume-alerts.ts` — Ingest + query endpoints
  - `src/websocket/handlers.ts` — Socket auth (guest token, id method) + tier rooms
  - `src/services/alert-broadcaster.ts` — Wall‑clock batching to tier rooms

## Deployment
- Frontend: Vercel (main branch)
- Backend: Railway (main branch)
- Database: Neon Postgres (managed)

## Quick Start (Dev)
```bash
# DB (optional for local auth)
docker run -d --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# Frontend
cd volspike-nextjs-frontend
npm i && npm run dev

# Backend (only for auth/payments/alerts)
cd ../volspike-nodejs-backend
npm i && npm run dev
```

## Status
Production Ready ✅  
Last updated: December 2025

