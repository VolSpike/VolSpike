# VolSpike Human Documentation

## Welcome to VolSpike

VolSpike is a production-ready Binance Perpetual Futures trading dashboard. This documentation provides a comprehensive, human-readable guide to every aspect of the system.

**Live Site**: https://volspike.com
**Last Updated**: December 2025

---

## Table of Contents

### Getting Started
1. [Project Overview](01-PROJECT-OVERVIEW.md) - What is VolSpike and how does it work?
2. [Architecture](02-ARCHITECTURE.md) - System design and technology stack
3. [Quick Start Guide](03-QUICK-START.md) - How to run locally

### Core Systems
4. [Authentication](04-AUTHENTICATION.md) - User login, wallets, OAuth, and sessions
5. [Payment System](05-PAYMENTS.md) - Stripe, crypto payments, and subscriptions
6. [Real-Time Data](06-REALTIME-DATA.md) - WebSocket connections and market data
7. [Alert System](07-ALERTS.md) - Volume alerts, OI alerts, and notifications

### Frontend (Next.js)
8. [Frontend Overview](08-FRONTEND-OVERVIEW.md) - Next.js application structure
9. [Components Reference](09-COMPONENTS.md) - All React components documented
10. [Hooks Reference](10-HOOKS.md) - Custom React hooks explained
11. [Pages & Routes](11-PAGES-ROUTES.md) - Every page in the application

### Backend (Node.js/Hono)
12. [Backend Overview](12-BACKEND-OVERVIEW.md) - Server architecture
13. [API Reference](13-API-REFERENCE.md) - All API endpoints documented
14. [Services](14-SERVICES.md) - Business logic and integrations
15. [Database Schema](15-DATABASE.md) - All tables and relationships

### Admin Panel
16. [Admin Overview](16-ADMIN-OVERVIEW.md) - Admin dashboard features
17. [Admin Pages](17-ADMIN-PAGES.md) - Every admin page documented

### Digital Ocean Scripts
18. [Python Scripts](18-DIGITAL-OCEAN.md) - Alert detection and data polling

### Operations
19. [Deployment Guide](19-DEPLOYMENT.md) - How to deploy to production
20. [Environment Variables](20-ENVIRONMENT.md) - All configuration options
21. [Troubleshooting](21-TROUBLESHOOTING.md) - Common issues and solutions

### File Inventory
22. [Complete File Inventory](22-FILES.md) - Every file mapped to its documentation

### Analytics & Tracking
23. [Analytics & Tracking](23-ANALYTICS.md) - Google Analytics 4 integration and event tracking

---

## Quick Reference

### Key Technologies
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| Backend | Hono, Node.js, TypeScript, Prisma |
| Database | PostgreSQL with TimescaleDB |
| Real-time | Socket.IO, Binance WebSocket |
| Auth | NextAuth.js v5, SIWE, Phantom |
| Payments | Stripe, NowPayments |

### Tier System
| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 50 symbols, 15-min alerts |
| Pro | $19/mo | 100 symbols, 5-min alerts, OI column |
| Elite | $49/mo | Unlimited symbols, real-time alerts |

### Critical Architecture Rule

**The frontend NEVER calls Binance REST API.**

- Frontend: Uses Binance WebSocket directly from browser
- Backend: Only handles auth, payments, user data
- Digital Ocean: ONLY place that calls Binance REST API

---

## Document Structure

Each document in this folder follows a consistent format:

1. **Overview** - What the section covers
2. **How It Works** - Technical explanation
3. **Code Locations** - Where to find relevant files
4. **Key Concepts** - Important things to understand
5. **Examples** - Real code snippets when helpful
6. **Common Issues** - Known problems and solutions

---

## For Developers

If you're a developer working on VolSpike:

1. **Start with**: [Architecture](02-ARCHITECTURE.md) to understand the system design
2. **For frontend work**: Read [Frontend Overview](08-FRONTEND-OVERVIEW.md)
3. **For backend work**: Read [Backend Overview](12-BACKEND-OVERVIEW.md)
4. **For debugging**: Check [Troubleshooting](21-TROUBLESHOOTING.md)

## For Non-Technical Readers

If you want to understand how VolSpike works without diving into code:

1. **Start with**: [Project Overview](01-PROJECT-OVERVIEW.md)
2. **Learn about features**: [Real-Time Data](06-REALTIME-DATA.md) and [Alert System](07-ALERTS.md)
3. **Understand payments**: [Payment System](05-PAYMENTS.md)
