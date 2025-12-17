# CLAUDE.md - AI Assistant Quick Reference

**Live Site**: https://volspike.com | **Stack**: Next.js 15 + Hono + PostgreSQL + Prisma

## Documentation Index

**For detailed information on any topic, see [human-docs/00-INDEX.md](human-docs/00-INDEX.md)**

### Quick Links
- **Architecture & Setup**: [Architecture](human-docs/02-ARCHITECTURE.md) | [Quick Start](human-docs/03-QUICK-START.md)
- **Core Systems**: [Auth](human-docs/04-AUTHENTICATION.md) | [Payments](human-docs/05-PAYMENTS.md) | [Real-time Data](human-docs/06-REALTIME-DATA.md) | [Alerts](human-docs/07-ALERTS.md)
- **Frontend**: [Overview](human-docs/08-FRONTEND-OVERVIEW.md) | [Components](human-docs/09-COMPONENTS.md) | [Hooks](human-docs/10-HOOKS.md) | [Pages](human-docs/11-PAGES-ROUTES.md)
- **Backend**: [Overview](human-docs/12-BACKEND-OVERVIEW.md) | [API Reference](human-docs/13-API-REFERENCE.md) | [Services](human-docs/14-SERVICES.md) | [Database](human-docs/15-DATABASE.md)
- **Admin**: [Overview](human-docs/16-ADMIN-OVERVIEW.md) | [Admin Pages](human-docs/17-ADMIN-PAGES.md)
- **Operations**: [Digital Ocean](human-docs/18-DIGITAL-OCEAN.md) | [Deployment](human-docs/19-DEPLOYMENT.md) | [Environment](human-docs/20-ENVIRONMENT.md) | [Troubleshooting](human-docs/21-TROUBLESHOOTING.md)
- **Reference**: [Complete File Inventory](human-docs/22-FILES.md) | [Analytics](human-docs/23-ANALYTICS.md)

---

## 🔴 CRITICAL: Client-Only Data Architecture

**THE MOST IMPORTANT RULE**: VolSpike uses a client-only market data architecture.

### Data Source Rules

1. **Frontend (Browser)**:
   - ✅ ONLY uses Binance WebSocket (`wss://fstream.binance.com/stream`)
   - ✅ Via `useClientOnlyMarketData` hook (see [Hooks](human-docs/10-HOOKS.md))
   - ❌ NEVER call Binance REST API
   - ❌ NEVER fetch market data from backend

2. **Backend (Railway)**:
   - ✅ ONLY handles: Auth, Payments, User Data, Watchlists (symbols only), Alerts
   - ❌ NEVER fetch market data from Binance REST API
   - ❌ NEVER create market data endpoints

3. **Digital Ocean Scripts (Python)**:
   - ✅ ONLY place that uses Binance REST API
   - ✅ Detects volume spikes, polls OI, funding rates
   - See [Digital Ocean Scripts](human-docs/18-DIGITAL-OCEAN.md) for deployment

**Why**: 80% cost reduction, no Redis, no IP blocking, <150ms updates

---

## Digital Ocean Deployment

**CRITICAL**: Deploy via **SCP** (not git). Never `git pull` on Digital Ocean.

**SSH**: `ssh volspike-do` (alias for `root@167.71.196.5`)

**Deploy Workflow**:
```bash
# 1. Copy script
scp "Digital Ocean/hourly_volume_alert_dual_env.py" volspike-do:/home/trader/volume-spike-bot/hourly_volume_alert_dual_env.py

# 2. Restart service (main service is volspike.service)
ssh volspike-do "sudo systemctl restart volspike.service && sudo systemctl status volspike.service"

# 3. Check logs
ssh volspike-do "sudo journalctl -u volspike.service -n 50 --no-pager"
```

**Details**: See [Digital Ocean Scripts Documentation](human-docs/18-DIGITAL-OCEAN.md)

---

## Tier Pricing (Single Source of Truth)

**CRITICAL**: All tier prices defined in ONE location. NEVER hardcode elsewhere.

| Tier | Price |
|------|-------|
| Free | $0 |
| Pro | $19/month |
| Elite | $49/month |

**Where prices are defined**:
- Frontend: `volspike-nextjs-frontend/src/lib/pricing.ts`
- Backend: `volspike-nodejs-backend/src/lib/pricing.ts`

**Usage**:
```typescript
import { formatPrice, TIER_PRICES } from '@/lib/pricing'
formatPrice('pro')  // "$19"
TIER_PRICES.pro     // 19
```

**Details**: See [Payment System Documentation](human-docs/05-PAYMENTS.md)

---

## Code Style & Conventions

### TypeScript
- Strict mode, no `any` types
- Use App Router (not Pages Router)
- Path aliases: `@/` → `src/`

### Next.js Patterns
- Server Components by default
- Client Components need `"use client"` directive
- Mark dynamic routes: `export const dynamic = 'force-dynamic'`

### Git Commits
Use conventional commits:
- `feat(scope): description`
- `fix(scope): description`
- `refactor(scope): description`

**Details**: See [Architecture Documentation](human-docs/02-ARCHITECTURE.md)

---

## Safety Guardrails

### Git Rules - CRITICAL
- **NEVER commit `.env` files** - Always check `git status` before committing
- **NEVER use `git add -A` blindly** - Review staged files first
- If `.env` accidentally staged: `git restore --staged <file>`

### DO NOT Create (Unless Explicitly Requested)
- NO .md files in root - Use `human-docs/` folder
- NO README files
- Focus on code, not documentation

### DO NOT Touch
- `prisma/schema.prisma` - Requires migration
- `.env` files - Contains secrets
- Admin routes/middleware - Critical security
- Payment display logic - Must update docs if modified

**Details**: See [Troubleshooting](human-docs/21-TROUBLESHOOTING.md)

---

## Lessons Learned (Critical Patterns)

### React Component Patterns
- **Never define components inside other components** - Causes re-renders, tooltip instability
- **Use `memo()` for stable child components** - Prevents unnecessary re-renders
- **Extract stateful UI (tooltips, dialogs) as separate components** - Isolated state

### NEVER Make Up Values
- **ALWAYS search codebase first** before defining prices, limits, quotas
- **Check**: `lib/pricing.ts` for tier prices
- **Ask user if unsure** - Don't invent values

### CSS Animations
- **One animation per element** - Multiple animations conflict
- **Use child elements for layered effects** - Parent = main animation, child = glow/shadow
- **Remove non-existent classes** - Browser ignores them (good for preventing conflicts)

### Debugging Strategy
- **Copy working code EXACTLY first** before customizing
- Don't overthink - match working implementation before experimenting

### NextAuth Session Bug
- **Credentials login** needs hard navigation: `window.location.href` (not `router.push`)
- **OAuth works differently** - Full server redirect refreshes session
- Force NextAuth route: `export const dynamic = 'force-dynamic'`

### Stripe Integration
- Auth middleware must include `stripeCustomerId: true` in Prisma select
- Test keys (`sk_test_...`) won't find live mode customers

### Tooltip Clipping
- Use `TooltipPrimitive.Portal` to escape container boundaries
- Portal renders at document body level

**More Details**: See [Troubleshooting](human-docs/21-TROUBLESHOOTING.md)

---

## Quick Decision Trees

### Market Data Feature
1. Frontend display? → Use `useClientOnlyMarketData` hook
2. Watchlist filtering? → Filter WebSocket data client-side
3. Backend endpoint? → STOP. Backend never fetches market data
4. Python script? → OK, can use Binance REST API

### Authentication Issue
1. Email/password? → Check NextAuth config, SendGrid
2. OAuth? → Check provider config in `lib/auth.ts`
3. Web3 (EVM)? → Check RainbowKit, SIWE
4. Web3 (Solana)? → Check Phantom, mobile deep-linking
5. Session? → Check JWT secret, session management

### Payment Issue
1. Stripe? → Check webhook config, subscription management
2. NowPayments? → Check IPN webhook, `formatCryptoCurrency()`
3. Admin tools? → Check `role === 'ADMIN'`

**Details**: See [Troubleshooting](human-docs/21-TROUBLESHOOTING.md)

---

## Final Checklist

Before considering any task complete:
- [ ] Code follows TypeScript strict mode (no `any` types)
- [ ] Architecture rules followed (client-only data)
- [ ] Tier-based access controls verified (Free/Pro/Elite)
- [ ] WebSocket connections stable
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Production build succeeds
- [ ] Commit message follows conventions

**See [Deployment Guide](human-docs/19-DEPLOYMENT.md) for full production checklist**

---

## Remember

- Production-ready app at https://volspike.com
- Security paramount (validate inputs, protect secrets, enforce RBAC)
- NO emojis unless explicitly requested
- Architecture is unique (client-only data, no Redis)
- Update human-docs when changing critical logic

**For everything else, see [human-docs/00-INDEX.md](human-docs/00-INDEX.md)**

---

## CRITICAL RULES - NEVER BREAK THESE

### 🚨 NEVER Upgrade Dependencies Without Explicit Approval

**What Happened (December 2025)**:
- Railway showed error about Next.js 16.0.1 having security vulnerabilities
- Claude arbitrarily upgraded Next.js from 15.5.7 to 16.0.10 without checking documentation
- Broke production deployment with Turbopack errors and compatibility issues
- Required multiple reverts and fixes, wasting significant time

**The Correct Approach**:
1. **ALWAYS check project documentation FIRST** (CLAUDE.md, human-docs/, package.json)
2. **NEVER upgrade major or minor versions without user approval**
3. **Question error messages** - Railway was scanning wrong directory
4. **Verify what version is actually being used** before making changes
5. **Ask the user** if unsure about version compatibility

**Documented Tech Stack (DO NOT CHANGE)**:
- **Frontend**: Next.js 15.5.7 (NOT 16.x)
- **Backend**: Node.js with Hono 4.10.3
- **Database**: PostgreSQL with TimescaleDB via Prisma 6.18.0
- See human-docs/00-INDEX.md and human-docs/01-PROJECT-OVERVIEW.md for full stack

**Railway Deployment Issue**:
- Backend package-lock.json had Next.js 16.0.1 from `next-auth` peer dependency
- Backend doesn't run Next.js - it's just a Hono app
- Solution: Regenerate backend package-lock.json to use patched Next.js 16.0.10
- Real fix: Railway should only scan `volspike-nodejs-backend` directory (dashboard config)

**If You See Security Warnings**:
1. Check which directory is being scanned
2. Check if the vulnerable package is actually used in that service
3. Ask user before upgrading anything
4. Document the decision in CLAUDE.md

---

**Last Updated**: December 2025 | **Founder & Lead Engineer**: Nik Sitnikov
