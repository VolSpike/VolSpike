# CLAUDE.md - AI Assistant Guide for VolSpike

## Quick Reference

This document provides guidance for AI assistants (like Claude) working on the VolSpike project. For comprehensive project documentation, see [AGENTS.md](AGENTS.md).

## Essential Reading

Before working on any task, please read:
- [AGENTS.md](AGENTS.md) - Complete project overview, architecture, and guidelines
- [OVERVIEW.md](OVERVIEW.md) - High-level project overview
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Current state and roadmap

## Project Context

VolSpike is a Binance Perpetual Futures trading dashboard with:
- **Frontend**: Next.js 15+ with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js with Hono framework (auth/payments only)
- **Database**: PostgreSQL with TimescaleDB (user data only)
- **Real-time Data**: Client-side Binance WebSocket (no Redis/server dependency)
- **Authentication**: NextAuth.js v5 with email, Web3 wallets, OAuth
- **Payments**: Stripe + NowPayments (crypto)

## Key Architecture Principles

### Client-Only Data Architecture
- ✅ **No Redis dependency** - Market data streams directly from Binance to browser
- ✅ **Client-side WebSocket** - Real-time data without server bottleneck
- ✅ **Tier-based throttling** - Implemented in frontend (Elite: live, Pro: 5min, Free: 15min)
- ✅ **localStorage fallback** - For region-blocked users
- ❌ **No server-side market polling** - Set `DISABLE_SERVER_MARKET_POLL=true` in production

### Backend Purpose
The backend only handles:
- User authentication (NextAuth.js)
- Payment processing (Stripe + NowPayments)
- Volume alert ingestion and WebSocket broadcasting
- Admin dashboard functionality

### Code Style Rules

#### Next.js Frontend
- Use TypeScript with proper typing
- Follow Next.js App Router patterns
- Mark routes using cookies/headers as `export const dynamic = 'force-dynamic'`
- Wrap components using `useSession` with `<SessionProvider>`
- Use Tailwind CSS for styling
- Implement direct Binance WebSocket connections via `useClientOnlyMarketData` hook
- NO emojis unless explicitly requested

#### Node.js Backend
- Use Hono framework for API routes
- Implement proper error handling with try/catch
- Use Prisma ORM for database operations
- Binance REST failures should return empty arrays, not crash
- NO market data processing (handled by frontend)

#### Security
- Validate inputs with Zod schemas
- Use JWT for authentication
- Implement rate limiting
- Role-based access control for admin routes
- Never commit `.env` files

## Common Tasks

### Adding a New Feature
1. Read relevant sections in [AGENTS.md](AGENTS.md)
2. Check if it's frontend-only or requires backend
3. Follow TypeScript patterns and use proper typing
4. Test with tier-based access controls
5. Use conventional commits: `feat(scope): description`

### Fixing a Bug
1. Understand the architecture (client-side vs server-side)
2. Check [AGENTS.md](AGENTS.md) for troubleshooting
3. Test fix thoroughly before committing
4. Use conventional commits: `fix(scope): description`

### Working with Authentication
- NextAuth.js v5 is configured for email/password, OAuth, and Web3 wallets
- Password verification is enabled and working
- Case-insensitive email login implemented
- See [AGENTS.md](AGENTS.md) Authentication section for details

### Working with WebSocket Data
- Market data: Direct Binance WebSocket from browser
- Volume alerts: Socket.IO from backend with tier-based rooms
- See `useClientOnlyMarketData` hook for market data implementation
- See [AGENTS.md](AGENTS.md) for WebSocket auth notes

## Safety Guardrails

### DO NOT Touch
- `volspike-nodejs-backend/prisma/schema.prisma` - Database schema
- `.env` files - Environment variables with secrets
- `node_modules/` - Dependencies
- `dist/` and `.next/` - Build outputs
- Admin routes and middleware - Critical security

### Before Making Changes
- Check if database migration is needed
- Verify tier-based access controls
- Test with multiple user roles (guest, free, pro, elite, admin)
- Ensure WebSocket connections remain stable

## Testing Checklist

Before submitting changes:
- ✅ TypeScript type checking passes
- ✅ Next.js build succeeds
- ✅ Client-side Binance WebSocket works in browser
- ✅ Tier-based features are properly gated
- ✅ Authentication flows work correctly
- ✅ Admin access controls are verified
- ✅ No console errors in browser

## Quick Commands

```bash
# Frontend development
cd volspike-nextjs-frontend
npm install && npm run dev

# Backend development (optional - for auth/payments)
cd volspike-nodejs-backend
npm install && npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

## Environment Context

- **Development**: Frontend on :3000, Backend on :3001
- **Production**: Vercel (frontend) + Railway (backend)
- **Database**: Neon PostgreSQL
- **Market Data**: Direct from Binance WebSocket (no server)

## Getting Help

For detailed information on any topic, refer to [AGENTS.md](AGENTS.md) sections:
- Setup & Build
- Repository Layout
- Code Style & Rules
- Environment Variables
- Troubleshooting
- Recent Updates & Features

## Recent Critical Updates

- **December 2025**: Admin payments workflow, revenue analytics, pagination improvements
- **November 2025**: Volume alerts system completed, UI/UX improvements
- **October 2025**: Authentication fixes, password verification enabled
- **Architecture**: Client-only data with zero Redis dependency

## Remember

- This is a production-ready application
- Security is paramount (validate inputs, protect secrets)
- User experience matters (tier-based features, smooth UX)
- Performance is critical (client-side WebSocket, no server bottleneck)
- Code quality matters (TypeScript, proper error handling)
- NO emojis unless explicitly requested by the user

---

**Last Updated**: December 2025

For complete details, always refer to [AGENTS.md](AGENTS.md).
