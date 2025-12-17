# Environment Variables

## Overview

VolSpike uses environment variables for configuration across all environments. This document lists every variable and its purpose.

---

## Frontend Variables

Located in `volspike-nextjs-frontend/.env.local`

### NextAuth.js

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_URL` | Yes | Base URL for NextAuth (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Secret for JWT signing (32+ chars) |

### Backend API

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (e.g., `http://localhost:3001`) |
| `NEXT_PUBLIC_SOCKET_IO_URL` | Yes | Socket.IO server URL |

### Binance WebSocket

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WS_URL` | No | Binance WebSocket URL (has default) |

**Default:** `wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr`

### Stripe

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...` or `pk_live_...`) |

### WalletConnect

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |

### Solana

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SOLANA_CLUSTER` | No | Solana cluster (`mainnet-beta` or `devnet`) |
| `NEXT_PUBLIC_ENABLE_SOLANA` | No | Enable Solana wallet auth (`1`/`0`) |
| `NEXT_PUBLIC_PUBLIC_URL` | No | Public URL for Phantom deeplinks |

### NowPayments (Frontend)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_NOWPAYMENTS_ENABLED` | No | Show crypto payment option (`true`/`false`) |

### Debug Flags

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PRICE_FLASH` | No | Enable price flash animations (`true`/`1`) |
| `NEXT_PUBLIC_DEBUG_SCROLL` | No | Enable scroll debugging (`true`/`1`) |
| `NEXT_PUBLIC_AVATAR_FILTER_GOOGLE_TILES` | No | Filter Google avatar tiles (`true`/`false`) |

### Google OAuth

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |

### Google Analytics

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 Measurement ID (e.g., `G-XXXXXXXXXX`) |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | No | Enable analytics in dev (`true`/`false`) |

**Note:** Analytics is only active when:
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set AND
- Either `NODE_ENV === 'production'` OR `NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'`

See [23-ANALYTICS.md](23-ANALYTICS.md) for full documentation.

### Build

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BUILD_ID` | No | Build version for cache busting |

---

### Frontend Example

```bash
# .env.local

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-very-long-secret-key-at-least-32-chars

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:3001

# Binance WebSocket (optional - has default)
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Google Analytics (optional - only needed if tracking)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
# NEXT_PUBLIC_ENABLE_ANALYTICS=true  # Uncomment to enable in dev
```

---

## Backend Variables

Located in `volspike-nodejs-backend/.env`

### Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

**Format:** `postgresql://user:password@host:port/database`

### JWT

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for JWT tokens (32+ chars) |

### Stripe

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |

### SendGrid

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes | SendGrid API key (`SG....`) |
| `SENDGRID_FROM_EMAIL` | Yes | Sender email address |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `FRONTEND_URL` | Yes | Frontend URL for redirects and emails |

### NowPayments

| Variable | Required | Description |
|----------|----------|-------------|
| `NOWPAYMENTS_API_KEY` | Yes | NowPayments API key |
| `NOWPAYMENTS_IPN_SECRET` | Yes | NowPayments IPN webhook secret |
| `NOWPAYMENTS_SANDBOX_MODE` | No | Use sandbox API (`true`/`false`) |

### Digital Ocean Scripts

| Variable | Required | Description |
|----------|----------|-------------|
| `ALERT_INGEST_API_KEY` | Yes | API key for alert ingestion |

### Feature Flags

| Variable | Required | Description |
|----------|----------|-------------|
| `DISABLE_SERVER_MARKET_POLL` | No | Disable market polling (`true` in prod) |
| `ENABLE_SCHEDULED_TASKS` | No | Enable background jobs |
| `ENABLE_ASSET_ENRICHMENT` | No | Enable asset metadata refresh |

### Server

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | Environment (`development`, `production`) |
| `PORT` | No | Server port (default: 3001) |
| `LOG_LEVEL` | No | Logging level (`debug`, `info`, `warn`, `error`) |

---

### Backend Example

```bash
# .env

# Database
DATABASE_URL=postgresql://volspike:password@localhost:5432/volspike

# JWT
JWT_SECRET=your-jwt-secret-at-least-32-characters-long

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@volspike.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# NowPayments
NOWPAYMENTS_API_KEY=xxxxxxxxxxxxx
NOWPAYMENTS_IPN_SECRET=xxxxxxxxxxxxx
NOWPAYMENTS_SANDBOX_MODE=true

# Digital Ocean Script Authentication
ALERT_INGEST_API_KEY=your-alert-ingest-api-key

# Feature Flags
DISABLE_SERVER_MARKET_POLL=true
ENABLE_SCHEDULED_TASKS=true
ENABLE_ASSET_ENRICHMENT=true

# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

---

## Digital Ocean Variables

Located at `/home/trader/.volspike.env` on the droplet.

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_URL` | Yes | Production backend URL |
| `ALERT_INGEST_API_KEY` | Yes | API key for alert ingestion |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_CHANNEL_IDS` | No | Comma-separated channel IDs |

### Example

```bash
# .volspike.env

BACKEND_URL=https://volspike-production.up.railway.app
ALERT_INGEST_API_KEY=your-alert-ingest-api-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHANNEL_IDS=channel1,channel2
```

---

## Production Environment (Vercel)

### Required Variables

Set these in Vercel dashboard under Settings → Environment Variables:

```
NEXTAUTH_URL=https://volspike.com
NEXTAUTH_SECRET=<production-secret>
NEXT_PUBLIC_API_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_SOCKET_IO_URL=https://volspike-production.up.railway.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project-id>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
```

---

## Production Environment (Railway)

### Required Variables

Set these in Railway dashboard under Variables:

```
DATABASE_URL=<neon-connection-string>
JWT_SECRET=<production-jwt-secret>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@volspike.com
FRONTEND_URL=https://volspike.com
NOWPAYMENTS_API_KEY=<nowpayments-key>
NOWPAYMENTS_IPN_SECRET=<ipn-secret>
NOWPAYMENTS_SANDBOX_MODE=false
ALERT_INGEST_API_KEY=<api-key>
DISABLE_SERVER_MARKET_POLL=true
ENABLE_SCHEDULED_TASKS=true
NODE_ENV=production
PORT=3001
```

---

## Secret Generation

### Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

### Generate JWT_SECRET

```bash
openssl rand -hex 32
```

### Generate API Keys

```bash
openssl rand -hex 24
```

---

## Environment File Security

### .gitignore

Ensure environment files are never committed:

```gitignore
# Environment files
.env
.env.local
.env.production
.env.development
*.env
```

### Checking Before Commit

```bash
git status | grep -E "\.env"
# Should return nothing
```

### If Accidentally Committed

```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## Variable Validation

### Frontend

Variables starting with `NEXT_PUBLIC_` are exposed to the browser. All others are server-side only.

### Backend

Validate required variables on startup:

```typescript
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'SENDGRID_API_KEY',
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}
```

---

## Common Issues

### "NEXTAUTH_URL mismatch"

Ensure `NEXTAUTH_URL` matches your actual URL:
- Dev: `http://localhost:3000`
- Prod: `https://volspike.com`

### "Database connection failed"

Check `DATABASE_URL` format:
- Has correct password (URL-encoded special chars)
- Has correct port
- Database exists

### "Stripe webhook failing"

Ensure `STRIPE_WEBHOOK_SECRET` matches webhook:
- Different for test vs live
- Different per webhook endpoint

### "Emails not sending"

Check SendGrid:
- API key has "Mail Send" permission
- Sender email is verified
- Not hitting rate limits

---

## Next: [Troubleshooting](21-TROUBLESHOOTING.md)
