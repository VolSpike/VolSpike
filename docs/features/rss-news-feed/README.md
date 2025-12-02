# RSS News Feed Feature - Overview

**Status**: Planning Phase
**Created**: December 2, 2025
**Test Route**: `/dashboard/test-feeds` (Admin Only)

---

## Quick Summary

This feature adds a comprehensive crypto and macro news feed to VolSpike, integrating 13 RSS sources with tier-based access control, admin management, and a dedicated test dashboard for validating feeds before production deployment.

---

## Key Features

### User Features
- **13 RSS News Sources**: CoinDesk, Cointelegraph, CryptoSlate, The Block, Decrypt, and more
- **Tier-Based Access**:
  - Guest: 3 articles (preview)
  - Free: 5 articles (no filtering)
  - Pro: Unlimited articles + filtering
  - Elite: Unlimited + priority articles highlighted
- **Smart Filtering**: Filter by source and date range (Pro/Elite)
- **Real-time Updates**: Auto-refresh every 15 minutes
- **Responsive Design**: Optimized for mobile, tablet, and desktop

### Admin Features
- **Test Dashboard**: `/dashboard/test-feeds` for validating feeds before enabling
- **Feed Management**: Enable/disable individual feeds, test connections
- **Health Metrics**: Last fetch time, error counts, article counts per feed
- **Priority Control**: Set feed importance for Elite tier highlighting

---

## Architecture Highlights

### Frontend (Next.js)
- **New Tab on Dashboard**: Dedicated "News" tab alongside Market Data and Volume Alerts
- **Component Library**: Modular components in `src/components/news/`
- **Data Fetching**: SWR for efficient caching and revalidation
- **Styling**: Matches existing VolSpike design system (Tailwind + shadcn/ui)

### Backend (Node.js + Hono)
- **RSS Parser**: Robust XML parsing with error handling
- **Caching Layer**: 15-minute cache to minimize external requests
- **Database**: PostgreSQL tables for feeds and articles
- **Cron Job**: Auto-refresh feeds every 15 minutes
- **API Endpoints**: RESTful APIs for articles, feeds, and admin management

---

## Implementation Approach

### Test-Driven Development (TDD)
Every feature is developed with tests first:
1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green

### Modular Architecture
All news-related code is isolated in dedicated folders:
```
docs/features/rss-news-feed/     # Documentation
src/components/news/              # Frontend components
src/hooks/news/                   # Data fetching hooks
volspike-nodejs-backend/
  src/routes/news.ts              # API routes
  src/services/news.ts            # Business logic
  src/lib/rss/                    # RSS parsing utilities
```

### Safety First
- No modifications to existing features
- Isolated feature folders
- Comprehensive error handling
- Graceful degradation when feeds fail
- Admin-only test route for validation

---

## Documents

### 1. [requirements.md](./requirements.md)
**What it covers**:
- Business requirements and value proposition
- Functional requirements (13 RSS feeds, filtering, tier-based access)
- Non-functional requirements (performance, security, scalability)
- Technical requirements (database schema, API endpoints, component structure)
- User stories and acceptance criteria
- Risk assessment and mitigation

**Key sections**:
- RSS Feed Sources table (13 feeds with URLs and categories)
- Database schema (RssFeed and RssArticle models)
- API endpoint specifications
- Success criteria and metrics

---

### 2. [design.md](./design.md)
**What it covers**:
- Visual design and UI/UX specifications
- Component architecture and hierarchy
- Layout options (dedicated tab, sidebar, banner)
- Color palette and typography
- Responsive design breakpoints
- Animations and transitions
- Accessibility (a11y) guidelines
- Test dashboard design

**Key sections**:
- Component mockups with ASCII diagrams
- Detailed component specifications (props, styling, interactions)
- Error state designs
- Mobile/tablet/desktop layouts
- Color and typography tokens

**Recommended approach**: Option A - Dedicated "News" tab on dashboard

---

### 3. [implementation_steps.md](./implementation_steps.md)
**What it covers**:
- Step-by-step implementation guide with TDD
- 7 phases: Database → RSS Parsing → APIs → Frontend → Test Dashboard → Integration → Deployment
- Code examples for every component and service
- Test cases with expected behavior
- Commands for migrations, deployments, and validation
- Timeline estimates (7 days total)

**Key sections**:
- Phase 1: Prisma schema migration + seed data
- Phase 2: RSS parser with sanitization
- Phase 3: Hono API routes with auth
- Phase 4: React components with SWR
- Phase 5: Admin test dashboard
- Phase 6: Integration and cron jobs
- Phase 7: Deployment and rollback plan

---

## Test Dashboard (`/dashboard/test-feeds`)

### Purpose
Allow you to validate each RSS feed before enabling it in production. This ensures:
- Feeds are reachable and returning valid data
- Article parsing works correctly
- No broken or malicious feeds go live

### Features
- **Test Individual Feeds**: Click "Test" to fetch and parse articles
- **Enable/Disable Toggles**: Control production visibility
- **Health Metrics**: See last fetch time, error count, article count
- **Article Preview**: View 3 latest articles from each feed
- **Status Indicators**: ✅ Working, ❌ Disabled, ⚠️ Errors

### Usage Flow
1. Deploy code to production (Railway + Vercel)
2. Visit `/dashboard/test-feeds` (admin login required)
3. Test each feed individually:
   - Click "Test" button
   - Review fetched articles
   - Check for errors
4. Enable feeds that work correctly
5. Disable or fix feeds with errors
6. Visit main dashboard `/dashboard` to see news tab

---

## Database Schema

### RssFeed Table
| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| name | String | Feed name (e.g., "CoinDesk") |
| url | String (unique) | RSS feed URL |
| category | String | Category (e.g., "Regulatory/Macro") |
| enabled | Boolean | Production visibility flag |
| priority | Int | Sort order (1 = highest) |
| lastFetchAt | DateTime? | Last successful fetch time |
| errorCount | Int | Consecutive error count |

### RssArticle Table
| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| feedId | String | Foreign key to RssFeed |
| title | String | Article headline |
| link | String (unique) | Article URL |
| pubDate | DateTime | Publication date |
| description | String? | Short excerpt |
| content | String? | Full content (optional) |
| author | String? | Author name |
| categories | String[] | Tags/categories |
| enclosure | String? | Thumbnail URL |

---

## API Endpoints

### Public Endpoints
- `GET /api/news/articles` - Get paginated articles with filters
  - Query params: `sources`, `dateRange`, `page`, `limit`
  - Returns: `{ articles: NewsArticle[] }`

- `GET /api/news/feeds` - Get all enabled feeds
  - Returns: `{ feeds: RssFeed[] }`

- `POST /api/news/refresh` - Force refresh all feeds (rate-limited, auth required)
  - Returns: `{ results: Record<string, RefreshFeedResult> }`

### Admin Endpoints
- `GET /api/admin/feeds` - Get all feeds (including disabled)
- `POST /api/admin/feeds` - Create new feed
- `PATCH /api/admin/feeds/:id` - Update feed config
- `DELETE /api/admin/feeds/:id` - Delete feed
- `GET /api/admin/feeds/:id/test` - Test individual feed

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Page Load Time | < 2s | Lazy loading, SWR caching |
| RSS Fetch Time | < 3s per feed | Parallel fetching (5 concurrent) |
| Cache TTL | 15 min | In-memory cache (node-cache) |
| Bundle Size | +50KB max | Code splitting, tree shaking |
| API Response Time | < 500ms (cached) | Multi-level caching |

---

## Security Measures

1. **XSS Prevention**: All RSS content sanitized with `sanitize-html`
2. **Server-Side Fetching**: No CORS issues, no exposed feed URLs
3. **Rate Limiting**: Refresh endpoint limited to 1 req/5min per user
4. **Admin-Only**: Feed management requires admin role
5. **Input Validation**: Zod schemas for all API inputs
6. **Content Security Policy**: Strict CSP headers for external content

---

## Tier-Based Access Control

| Feature | Guest | Free | Pro | Elite |
|---------|-------|------|-----|-------|
| Articles Visible | 3 | 5 | Unlimited | Unlimited |
| Source Filtering | ❌ | ❌ | ✅ | ✅ |
| Date Range Filtering | ❌ | ❌ | ✅ | ✅ |
| Sorting | ❌ | ❌ | ❌ | ✅ |
| Priority Articles | ❌ | ❌ | ❌ | ✅ (highlighted) |

---

## Deployment Checklist

### Pre-Deployment
- ✅ Review all 3 documents (requirements, design, implementation)
- ✅ Approve feature scope and design approach
- ✅ Ensure no impact on existing features

### Backend Deployment (Railway)
1. Merge feature branch to `main`
2. Run Prisma migration: `npx prisma migrate deploy`
3. Seed RSS feeds: `npx tsx prisma/seed-rss.ts`
4. Verify cron job is running: Check logs for "🔄 Starting RSS feed refresh..."

### Frontend Deployment (Vercel)
1. Merge feature branch to `main` (auto-deploys)
2. Verify build succeeds
3. Test `/dashboard/test-feeds` route

### Post-Deployment Validation
1. Visit `/dashboard/test-feeds`
2. Test each RSS feed individually
3. Enable working feeds (recommend starting with 3-5)
4. Visit `/dashboard` and verify News tab appears
5. Test tier-based access (guest, free, pro, elite accounts)
6. Monitor error logs and performance metrics

---

## Rollback Plan

**If something breaks**:

1. **Immediate**: Disable News tab via environment variable
   ```env
   DISABLE_NEWS_FEATURE=true
   ```

2. **Database**: Rollback migration if needed
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

3. **Code**: Revert Git commit
   ```bash
   git revert <commit_hash>
   git push
   ```

4. **Frontend**: Redeploy previous version on Vercel dashboard

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Database & Backend | 1.5 days | Prisma schema, RSS parser, caching |
| API Endpoints | 1 day | Hono routes, NewsService, auth |
| Frontend Components | 2 days | React components, hooks, styling |
| Test Dashboard | 0.5 days | Admin route for feed validation |
| Integration & Testing | 1 day | Dashboard integration, E2E tests |
| Deployment | 0.5 days | Migrations, seed data, monitoring |
| **Total** | **6.5 days** | Ready for production |

---

## Next Steps

### 1. Review Documents
- Read [requirements.md](./requirements.md) for full specifications
- Review [design.md](./design.md) for UI/UX details
- Study [implementation_steps.md](./implementation_steps.md) for TDD workflow

### 2. Approve Feature
- Confirm RSS feed sources (13 feeds listed in requirements)
- Approve design approach (dedicated News tab)
- Confirm tier-based access levels
- Review test dashboard mockup

### 3. Implementation
- Follow implementation_steps.md phase by phase
- Use TDD (write tests first, then implementation)
- Test on `/dashboard/test-feeds` before enabling in production
- Deploy backend first, then frontend

### 4. Testing in Production
- Visit `/dashboard/test-feeds` (admin only)
- Test each RSS feed individually
- Enable 3-5 feeds initially (CoinDesk, Cointelegraph, CryptoSlate, The Block, Decrypt)
- Monitor for 24 hours before enabling more feeds

---

## Questions or Concerns?

Before starting implementation, please review:
- Are all 13 RSS feed sources acceptable?
- Is the dedicated "News" tab approach the right UX?
- Should we implement all features in MVP or phase them?
- Any specific feeds to prioritize or avoid?

---

## RSS Feed Sources (13 Total)

| # | Source | URL | Category | Default |
|---|--------|-----|----------|---------|
| 1 | CoinDesk | https://www.coindesk.com/arc/outboundfeeds/rss/ | Regulatory/Macro | ✅ Enabled |
| 2 | Cointelegraph | https://cointelegraph.com/rss | Global Coverage | ✅ Enabled |
| 3 | CryptoSlate | https://cryptoslate.com/feed/ | On-chain/Whale | ✅ Enabled |
| 4 | The Block | https://www.theblock.co/rss.xml | Investigative | ✅ Enabled |
| 5 | Decrypt | https://decrypt.co/feed | DeFi/NFT | ✅ Enabled |
| 6 | NewsBTC | https://www.newsbtc.com/feed/ | Price Action | ✅ Enabled |
| 7 | U.Today | https://u.today/rss/news | ETH/Ripple | ✅ Enabled |
| 8 | Bitcoin Magazine | https://bitcoinmagazine.com/.rss/full/ | BTC Macro | ✅ Enabled |
| 9 | ChainGPT AI News | https://chaingpt.org/rss | AI-Curated | ❌ Disabled |
| 10 | CryptoPanic | https://cryptopanic.com/news/rss/ | Aggregated | ❌ Disabled |
| 11 | Yahoo Finance Crypto | https://feeds.finance.yahoo.com/rss/2.0/headline?r=1&category=crypto | Macro Crossover | ❌ Disabled |
| 12 | Blockchain.News | https://blockchain.news/rss | General | ❌ Disabled |
| 13 | (Reserved) | TBD | TBD | ❌ Disabled |

**Recommendation**: Start with 8 enabled feeds, test disabled feeds on `/dashboard/test-feeds`, enable gradually based on quality.

---

**Status**: Ready for review and implementation
**Contact**: Development Team
**Last Updated**: December 2, 2025
