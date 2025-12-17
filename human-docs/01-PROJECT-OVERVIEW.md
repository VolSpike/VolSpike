# Project Overview

## What is VolSpike?

VolSpike is a professional-grade trading dashboard for Binance Perpetual Futures. It provides real-time market data, volume spike alerts, and advanced trading tools to help traders identify opportunities in the cryptocurrency derivatives market.

---

## Core Features

### 1. Real-Time Market Data

- Live price feeds for all Binance USDT perpetual pairs
- 24-hour volume and price change tracking
- Funding rates for each trading pair
- Open Interest data (Pro/Elite tiers)

### 2. Volume Spike Alerts

- Automatic detection of unusual volume increases
- Bullish/bearish classification based on price action
- Real-time notifications via dashboard
- Email alerts for Pro users
- Configurable thresholds

### 3. Open Interest Alerts

- Monitors changes in open interest across all pairs
- Detects significant OI increases/decreases
- Helps identify potential market movements

### 4. User Features

- Personal watchlists
- TradingView format export
- Custom alert settings
- Dark/light theme

---

## How It Works

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Binance      │────>│  User's Browser  │────>│    Dashboard    │
│   WebSocket     │     │   (WebSocket)    │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Digital Ocean   │────>│  VolSpike        │────>│    Dashboard    │
│ Python Scripts  │     │  Backend         │     │   (Socket.IO)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **Market Data**: Flows directly from Binance to your browser via WebSocket
2. **Alerts**: Detected by Python scripts on Digital Ocean, sent to backend, broadcast to users

### Why This Architecture?

- **No IP blocking**: Uses your residential IP for Binance connection
- **Low latency**: Direct connection means faster updates
- **Cost effective**: No expensive server-side data processing
- **Scalable**: Each user has their own connection

---

## Tier System

### Free Tier ($0)

- 50 trading pairs visible
- 15-minute alert batching
- Basic market data
- Watchlist (limited)

### Pro Tier ($19/month)

- 100 trading pairs visible
- 5-minute alert batching
- Open Interest column
- TradingView export
- Email alerts

### Elite Tier ($49/month)

- Unlimited trading pairs
- Real-time alerts (instant)
- All Pro features
- Priority support
- Coming: SMS alerts

---

## User Experience

### Guest Preview

When you visit VolSpike without logging in:

- See top 5 market rows (rest blurred)
- See top 2 alerts (rest blurred)
- Sorting and export disabled
- Full functionality preview

### Authenticated User

After signing up/in:

- Full access based on tier
- Personalized watchlists
- Alert history
- Account settings

---

## Technical Stack Summary

| Component       | Technology               | Purpose                |
| --------------- | ------------------------ | ---------------------- |
| Frontend        | Next.js 15               | Web application        |
| UI              | Tailwind CSS, shadcn/ui  | Styling and components |
| Backend         | Hono (Node.js)           | API server             |
| Database        | PostgreSQL + TimescaleDB | Data storage           |
| Real-time       | Socket.IO                | Alert delivery         |
| Market Data     | Binance WebSocket        | Live prices            |
| Alert Detection | Python (Digital Ocean)   | Volume spike detection |
| Auth            | NextAuth.js              | User authentication    |
| Payments        | Stripe + NowPayments     | Subscriptions          |

---

## Key URLs

| Environment   | URL                                        |
| ------------- | ------------------------------------------ |
| Production    | https://volspike.com                       |
| Backend API   | https://volspike-production.up.railway.app |
| Documentation | This folder                                |

---

## Project Structure

```
VolSpike/
├── volspike-nextjs-frontend/    # Next.js web app
├── volspike-nodejs-backend/     # Hono API server
├── Digital Ocean/               # Python alert scripts
├── docs/                        # Feature documentation
└── human-docs/                  # This documentation
```

---

## Who Built This?

**Founder & Lead Engineer**: Nik Sitnikov

VolSpike started as a tool to help traders spot volume anomalies in the cryptocurrency futures market. It has grown into a full-featured trading dashboard used by traders worldwide.

---

## Next Steps

- [Architecture](02-ARCHITECTURE.md) - Deep dive into system design
- [Quick Start](03-QUICK-START.md) - Run locally in 5 minutes
- [Authentication](04-AUTHENTICATION.md) - How users log in
