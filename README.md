# VolSpike — Real-Time Cryptocurrency Trading Dashboard

> **Professional trading dashboard for Binance Perpetual Futures with real-time market data, volume spike alerts, and tiered access control.**

**Founder & Lead Engineer:** Nik Sitnikov  
**Live Demo:** [https://volspike.com](https://volspike.com)  
**Repository:** [https://github.com/VolSpike/VolSpike](https://github.com/VolSpike/VolSpike)

---

## 🎯 Overview

VolSpike is a production-ready cryptocurrency trading dashboard that provides real-time market data, volume spike alerts, and advanced analytics for Binance Perpetual Futures. Built with modern web technologies, it features client-side WebSocket data streaming, multiple authentication methods, subscription-based access control, and a beautiful, responsive UI.

### Key Features

- **Real-Time Market Data**: Direct Binance WebSocket integration with tier-based throttling (Free: 15min, Pro: 5min, Elite: Live)
- **Volume Spike Alerts**: Automated detection and real-time notifications via Socket.IO
- **Multiple Authentication Methods**: Email/password, Google OAuth, Web3 wallets (EVM & Solana)
- **Subscription Management**: Stripe integration with tiered access (Free/Pro/Elite)
- **Responsive Design**: Modern UI built with Next.js 15, Tailwind CSS, and shadcn/ui
- **Production Ready**: Deployed on Vercel (frontend) and Railway (backend)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Stripe account (for payments)
- SendGrid account (for email notifications)

### Local Development

```bash
# Clone the repository
git clone https://github.com/VolSpike/VolSpike.git
cd VolSpike

# Start PostgreSQL (for auth/payments only)
docker run -d \
  --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# Start frontend (market data works without backend)
cd volspike-nextjs-frontend
npm install
cp env.example .env.local
npm run dev
```

**Optional Backend** (for auth/payments/alerts):
```bash
cd volspike-nodejs-backend
npm install
cp env.example .env
npx prisma generate && npx prisma db push
npm run dev
```

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Next.js 15+ (TypeScript), Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Hono framework, Prisma ORM
- **Database**: PostgreSQL (Neon) with TimescaleDB extension
- **Real-time Data**: Direct Binance WebSocket from browser (no server dependency)
- **Authentication**: NextAuth.js v5 (email/password, OAuth, Web3 wallets)
- **Payments**: Stripe subscriptions with webhook handling
- **Deployment**: Vercel (frontend) + Railway (backend)

### Architecture Highlights

- **Zero Redis Dependency**: Client-side WebSocket eliminates server-side data ingestion
- **Tier-Based Throttling**: Frontend handles data refresh rates per subscription tier
- **Scalable Infrastructure**: Minimal backend footprint (auth/payments only)
- **Production Ready**: Fully deployed and operational

---

## 📊 Current Status (December 2025)

### ✅ Completed Features

- **Authentication**: Email/password with verification, Google/GitHub OAuth, EVM wallets (RainbowKit), Solana Phantom (mobile deep-link)
- **Market Data**: Real-time Binance WebSocket with tier-based throttling
- **Volume Alerts**: End-to-end alert system (detection → database → Socket.IO → UI)
- **Payments**: Stripe subscription integration with customer portal
- **UI/UX**: Responsive dashboard, pricing page, legal pages, mobile optimizations
- **Admin Dashboard**: Role-based access control and user management

### 🚧 In Progress

- Professional sound assets for alerts (currently using placeholders)
- Email notifications for Pro tier (template ready, integration pending)

---

## 🔑 Key Endpoints

- **Health Check**: `GET /health`
- **Authentication**: `/api/auth/*` (email, OAuth, SIWE, Solana)
- **Volume Alerts**: `/api/volume-alerts/ingest`, `/api/volume-alerts`
- **Market Data**: `GET /api/market/open-interest`
- **Payments**: `/api/payments/*` (checkout, webhook, portal)
- **Admin**: `/api/admin/*` (role-protected)

---

## 📁 Project Structure

```
VolSpike/
├── volspike-nextjs-frontend/    # Next.js frontend application
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # React components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utilities and configurations
│   └── public/                 # Static assets
│
├── volspike-nodejs-backend/    # Backend API (auth/payments/alerts)
│   ├── src/
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic
│   │   └── lib/                # Utilities
│   └── prisma/                 # Database schema
│
├── Digital Ocean/              # Production alert detection scripts
├── docker-compose.yml          # Local development setup
├── nixpacks.toml              # Railway deployment configuration
├── README.md                  # This file
├── AGENTS.md                  # Contributor guidelines and project details
└── IMPLEMENTATION_PLAN.md     # Implementation roadmap and status
```

---

## 🌐 Deployment

### Production URLs

- **Frontend**: [https://volspike.com](https://volspike.com)
- **Backend API**: [https://volspike-production.up.railway.app](https://volspike-production.up.railway.app)

### Deployment Platforms

- **Frontend**: Vercel (automatic deployments from `main` branch)
- **Backend**: Railway (automatic deployments from `main` branch)
- **Database**: Neon PostgreSQL (managed)

---

## 📚 Documentation

- **[AGENTS.md](./AGENTS.md)**: Detailed contributor guidelines, architecture, and deployment instructions
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)**: Implementation roadmap, current status, and next steps

---

## 👤 Founder & Lead Engineer

**Nik Sitnikov**  
Founder, Lead Product Manager & Engineer

- **Role**: Full-stack development, product design, infrastructure, and deployment
- **Technologies**: Next.js, TypeScript, Node.js, PostgreSQL, Stripe, Web3
- **Contact**: [GitHub](https://github.com/NikolaySitnikov) | [Live Demo](https://volspike.com)

---

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

## 🙏 Acknowledgments

Built with modern web technologies and best practices. Special thanks to the open-source community for the excellent tools and libraries that made this project possible.

---

**Last Updated**: December 2025  
**Status**: Production Ready ✅
