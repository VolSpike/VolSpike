# RSS News Feed Feature - Requirements

**Feature**: RSS News Feed Integration
**Version**: 1.0
**Date**: December 2, 2025
**Status**: Planning

---

## Executive Summary

Integrate multiple crypto and macro news RSS feeds into the VolSpike dashboard to provide users with real-time news updates that may impact market volatility and trading decisions. The feature will be modular, configurable, and designed with Test-Driven Development principles.

---

## Business Requirements

### BR-1: Value Proposition
- Provide users with curated crypto/macro news from trusted sources
- Help users correlate news events with market movements
- Increase user engagement and time-on-site
- Differentiate VolSpike from competitors with comprehensive news coverage

### BR-2: Target Users
- **Free Tier**: Limited news feed (3-5 articles visible)
- **Pro Tier**: Full news feed with all sources
- **Elite Tier**: Full news feed with priority/featured articles highlighted
- **Admin**: Full control over which feeds are active

### BR-3: Success Metrics
- User engagement: Time spent on news section
- Click-through rate: News article clicks
- Retention: Correlation with news feature usage
- Performance: Page load time remains < 2s

---

## Functional Requirements

### FR-1: RSS Feed Sources
**Priority**: CRITICAL
**Description**: Support multiple RSS feed sources with on/off toggle capability

**Acceptance Criteria**:
- System supports at least 13 RSS feed sources (listed below)
- Each feed can be individually enabled/disabled
- Feed configuration is stored in database
- Admin can toggle feeds via admin panel
- Failed feeds do not crash the system

**RSS Feed Sources**:

| Source | RSS URL | Category | Default Status |
|--------|---------|----------|----------------|
| CoinDesk | https://www.coindesk.com/arc/outboundfeeds/rss/ | Regulatory/Macro | Enabled |
| Cointelegraph | https://cointelegraph.com/rss | Global Coverage | Enabled |
| CryptoSlate | https://cryptoslate.com/feed/ | On-chain/Whale | Enabled |
| The Block | https://www.theblock.co/rss.xml | Investigative | Enabled |
| Decrypt | https://decrypt.co/feed | DeFi/NFT | Enabled |
| NewsBTC | https://www.newsbtc.com/feed/ | Price Action | Enabled |
| U.Today | https://u.today/rss/news | ETH/Ripple | Enabled |
| Bitcoin Magazine | https://bitcoinmagazine.com/.rss/full/ | BTC Macro | Enabled |
| ChainGPT AI News | https://chaingpt.org/rss | AI-Curated | Disabled |
| CryptoPanic (Aggregator) | https://cryptopanic.com/news/rss/ | Aggregated | Disabled |
| Yahoo Finance Crypto | https://feeds.finance.yahoo.com/rss/2.0/headline?r=1&category=crypto | Macro Crossover | Disabled |
| Blockchain.News | https://blockchain.news/rss | General | Disabled |
| CoinMarketCap News | TBD | Market Data | Disabled |

### FR-2: News Display Component
**Priority**: CRITICAL
**Description**: Display news articles in a visually appealing, responsive component

**Acceptance Criteria**:
- Displays article title, source, publish date, and excerpt
- Shows source logo/icon for visual identification
- Responsive design (mobile, tablet, desktop)
- Click on article opens in new tab
- Loading states and error handling
- Skeleton loaders during fetch
- Empty state when no articles available

### FR-3: News Filtering & Sorting
**Priority**: HIGH
**Description**: Allow users to filter and sort news articles

**Acceptance Criteria**:
- Filter by source (multi-select dropdown)
- Filter by date range (today, 7 days, 30 days, all)
- Sort by: Date (newest/oldest), Source (A-Z)
- Filter state persists in URL query params
- Filters update instantly without page refresh

### FR-4: Tier-Based Access Control
**Priority**: HIGH
**Description**: Implement tier-based restrictions on news access

**Acceptance Criteria**:
- **Guest**: See 3 articles max with blur effect and upgrade CTA
- **Free**: See 5 articles max, no filtering
- **Pro**: See all articles, full filtering, no sorting
- **Elite**: Full access, all features, priority articles highlighted

### FR-5: Admin Feed Management
**Priority**: MEDIUM
**Description**: Admin panel to manage RSS feed sources

**Acceptance Criteria**:
- Admin can enable/disable individual feeds
- Admin can preview feed articles before enabling
- Admin can set feed priority/order
- Admin can test individual feed connection
- Admin can view feed health metrics (last fetch, error count)

### FR-6: Caching & Performance
**Priority**: HIGH
**Description**: Implement efficient caching to minimize RSS fetch overhead

**Acceptance Criteria**:
- Backend caches RSS feed data for 15 minutes
- Stale-while-revalidate strategy (serve cached, fetch in background)
- Individual feed failures don't block entire system
- Client-side caching with localStorage fallback
- Max response time: 500ms for cached data, 3s for fresh fetch

### FR-7: Test Dashboard Route
**Priority**: CRITICAL
**Description**: Separate test route for validating feeds before production

**Acceptance Criteria**:
- Test route at `/dashboard/test-feeds` (admin-only access)
- Shows all feeds regardless of enabled status
- Displays real-time fetch results for each feed
- Shows feed metadata (fetch time, article count, errors)
- Side-by-side comparison of article titles from each source
- "Enable for Production" button for each feed
- Does not affect production dashboard

---

## Non-Functional Requirements

### NFR-1: Performance
- RSS feed fetch: < 3s per feed
- Total page load: < 2s (cached)
- No blocking of main dashboard render
- Lazy loading for news component
- Maximum bundle size increase: 50KB

### NFR-2: Reliability
- Individual feed failures do not crash system
- Graceful degradation when feeds are down
- Automatic retry with exponential backoff
- Error logging for debugging
- 99.5% uptime for news feature

### NFR-3: Security
- RSS feeds fetched server-side only (prevent CORS issues)
- Sanitize all RSS content to prevent XSS
- Rate limiting on RSS fetch endpoints
- No user-generated RSS URLs
- Admin-only access to feed configuration

### NFR-4: Scalability
- Support up to 20 RSS feeds without performance degradation
- Handle up to 500 articles in cache
- Database-driven configuration (no code changes for new feeds)
- Horizontal scaling support

### NFR-5: Maintainability
- Modular feature architecture
- Comprehensive unit and integration tests
- TypeScript strict mode
- Clear error messages and logging
- Documentation for adding new feeds

### NFR-6: Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly
- Color contrast ratios meet standards
- Semantic HTML structure

---

## Technical Requirements

### TR-1: Frontend Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks + context (if needed)
- **Data Fetching**: SWR or React Query

### TR-2: Backend Stack
- **Framework**: Hono (Node.js)
- **RSS Parsing**: `rss-parser` or `fast-xml-parser`
- **Caching**: In-memory cache (node-cache) or Redis
- **Database**: PostgreSQL (Prisma ORM)
- **Validation**: Zod schemas

### TR-3: Database Schema
```prisma
model RssFeed {
  id          String   @id @default(cuid())
  name        String
  url         String   @unique
  category    String
  enabled     Boolean  @default(true)
  priority    Int      @default(0)
  lastFetchAt DateTime?
  errorCount  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model RssArticle {
  id          String   @id @default(cuid())
  feedId      String
  title       String
  link        String   @unique
  pubDate     DateTime
  description String?
  content     String?
  author      String?
  categories  String[]
  enclosure   String?
  createdAt   DateTime @default(now())

  feed        RssFeed  @relation(fields: [feedId], references: [id], onDelete: Cascade)

  @@index([pubDate])
  @@index([feedId])
}
```

### TR-4: API Endpoints
- `GET /api/news/feeds` - Get all enabled feeds
- `GET /api/news/articles` - Get paginated articles with filters
- `GET /api/news/refresh` - Force refresh all feeds (rate-limited)
- `POST /api/admin/feeds` - Create new feed (admin)
- `PATCH /api/admin/feeds/:id` - Update feed config (admin)
- `DELETE /api/admin/feeds/:id` - Delete feed (admin)
- `GET /api/admin/feeds/:id/test` - Test individual feed (admin)

### TR-5: Component Structure
```
src/
├── components/
│   └── news/
│       ├── news-feed-panel.tsx          # Main news panel component
│       ├── news-article-card.tsx        # Individual article card
│       ├── news-filters.tsx             # Filter/sort controls
│       ├── news-skeleton.tsx            # Loading skeleton
│       ├── news-empty-state.tsx         # Empty state
│       └── news-error-boundary.tsx      # Error boundary
├── hooks/
│   ├── use-news-feed.ts                 # SWR hook for fetching news
│   └── use-news-filters.ts              # Filter state management
└── lib/
    └── rss/
        ├── parser.ts                    # RSS parsing logic
        ├── cache.ts                     # Caching layer
        └── sanitizer.ts                 # Content sanitization
```

---

## User Stories

### US-1: As a Pro user, I want to see recent crypto news
**Given** I am logged in as a Pro user
**When** I visit the dashboard
**Then** I should see a news panel with latest articles from enabled feeds
**And** articles should be sorted by publish date (newest first)
**And** I can filter by source and date range

### US-2: As a Free user, I want to preview news content
**Given** I am logged in as a Free user
**When** I scroll to the news section
**Then** I should see 5 articles
**And** articles beyond 5 should be blurred with an upgrade CTA
**And** I cannot use filtering or sorting

### US-3: As an Admin, I want to test new RSS feeds
**Given** I am logged in as an Admin
**When** I visit `/dashboard/test-feeds`
**Then** I should see all RSS feeds (enabled and disabled)
**And** I can test individual feeds to see their articles
**And** I can enable/disable feeds for production
**And** I can see feed health metrics (last fetch, error count)

### US-4: As a user, I want to open news articles
**Given** I see a news article card
**When** I click on the article
**Then** the article should open in a new browser tab
**And** the original article URL should be tracked for analytics

### US-5: As a developer, I want RSS feeds to fail gracefully
**Given** one or more RSS feeds are unavailable
**When** the system fetches news
**Then** only working feeds should return articles
**And** failed feeds should log errors
**And** the UI should show a warning but remain functional

---

## Open Questions & Decisions Needed

1. **Q**: Should we display news inline on main dashboard or in a separate tab?
   **Decision Needed**: User preference from stakeholder

2. **Q**: Should Elite users get push notifications for breaking news?
   **Decision**: Defer to v2.0 (out of scope for MVP)

3. **Q**: Should we parse full article content or just excerpts?
   **Decision**: Excerpts only (150-200 chars) to respect publisher traffic

4. **Q**: Should we store articles indefinitely or purge old ones?
   **Decision**: Purge articles older than 30 days (configurable)

5. **Q**: Should we implement search functionality?
   **Decision**: Defer to v1.1 (add if user feedback requests it)

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| RSS feeds change format | High | Medium | Robust parsing with fallbacks |
| Feed downtime | Medium | High | Individual feed isolation |
| Performance degradation | High | Low | Aggressive caching, lazy loading |
| XSS via RSS content | Critical | Low | Strict sanitization, CSP headers |
| Database bloat | Medium | Medium | Automatic purging of old articles |
| CORS issues | Medium | Medium | Server-side RSS fetching only |

---

## Timeline Estimate

- **Planning & Design**: 1 day (this document)
- **Backend API**: 2 days
- **Frontend Components**: 2 days
- **Admin Panel**: 1 day
- **Testing & QA**: 1 day
- **Documentation**: 0.5 days
- **Total**: ~7.5 days

---

## Dependencies

- Prisma schema migration
- New npm packages: `rss-parser`, `node-cache`, `sanitize-html`
- Admin authentication system (already exists)
- Tier-based access control (already exists)

---

## Success Criteria

- ✅ All 13 RSS feeds parseable and displayable
- ✅ Test dashboard route functional for admin testing
- ✅ No performance regression on main dashboard
- ✅ 100% TypeScript coverage
- ✅ 80%+ unit test coverage
- ✅ No console errors or warnings
- ✅ Mobile responsive design
- ✅ Tier-based access working correctly

---

## Appendix: Alternative Approaches Considered

### Approach 1: Third-party News API (e.g., CryptoCompare, CoinGecko)
- **Pros**: Curated, reliable, structured data
- **Cons**: Costly, vendor lock-in, less control
- **Decision**: Rejected due to cost and flexibility concerns

### Approach 2: Client-side RSS fetching
- **Pros**: Simpler backend
- **Cons**: CORS issues, no caching, exposes feed URLs
- **Decision**: Rejected due to security and reliability

### Approach 3: Headless CMS (e.g., Strapi, Contentful)
- **Pros**: Rich admin UI, built-in caching
- **Cons**: Overkill for RSS feeds, additional infrastructure
- **Decision**: Rejected due to complexity

---

**Document Owner**: Development Team
**Last Updated**: December 2, 2025
**Next Review**: Post-MVP Launch
