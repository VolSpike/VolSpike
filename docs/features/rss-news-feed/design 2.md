# RSS News Feed Feature - Design Document

**Feature**: RSS News Feed Integration
**Version**: 1.0
**Date**: December 2, 2025
**Status**: Design Phase

---

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Visual Design](#visual-design)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [UI/UX Specifications](#uiux-specifications)
6. [Responsive Design](#responsive-design)
7. [Animations & Transitions](#animations--transitions)
8. [Error & Edge Cases](#error--edge-cases)

---

## Design Philosophy

### Design Goals
1. **Non-intrusive**: News should complement, not distract from market data
2. **Scannable**: Users should quickly identify relevant news
3. **Consistent**: Match existing VolSpike design system (Tailwind + shadcn/ui)
4. **Performant**: Lazy load, minimize bundle size
5. **Accessible**: WCAG 2.1 AA compliant

### Design Principles
- Use existing color palette (brand, sec, elite, danger, warning)
- Follow shadcn/ui Card/Badge patterns
- Maintain mobile-first responsive approach
- Leverage existing animations from tailwind.config.js

---

## Visual Design

### Layout Options

#### Option A: Dedicated News Tab (RECOMMENDED)
**Rationale**: Separate news from market data to prevent clutter
**Implementation**: Add "News" tab to existing Market Data / Volume Alerts tabs

```
┌─────────────────────────────────────────────┐
│  [Market Data]  [Volume Alerts]  [News]     │
├─────────────────────────────────────────────┤
│                                             │
│  News Feed Panel                            │
│  ┌──────────────────────────────────────┐  │
│  │  Filters: [All Sources ▼] [7 Days ▼] │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📰 CoinDesk · 2h ago                  │  │
│  │ FTX Creditors Get 118% Recovery       │  │
│  │ Bankruptcy proceedings conclude...     │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📰 Cointelegraph · 4h ago             │  │
│  │ SOL ETF Approved by SEC                │  │
│  │ Solana sees institutional adoption...  │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

#### Option B: Sidebar Panel (Desktop Only)
**Rationale**: Keep news visible alongside market data
**Implementation**: Right sidebar on XL+ screens (similar to Volume Alerts)

```
Desktop (XL+):
┌──────────────────────────┬──────────────┐
│  Market Data (70%)       │  News (30%)  │
│  ┌────────────────────┐  │  ┌────────┐  │
│  │ Symbol | Price ... │  │  │ Latest │  │
│  │ BTC    | $43,210  │  │  │ News   │  │
│  └────────────────────┘  │  └────────┘  │
│                          │              │
└──────────────────────────┴──────────────┘
```

#### Option C: Collapsible Banner (All Screens)
**Rationale**: Always visible, minimal space when collapsed
**Implementation**: Sticky banner below header, expands on click

```
Collapsed:
┌─────────────────────────────────────────────┐
│  📰 Latest: "FTX Creditors Get 118%..."  [▼]│
└─────────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────────┐
│  📰 Latest News                          [▲] │
├─────────────────────────────────────────────┤
│  • FTX Creditors Get 118% Recovery          │
│  • SOL ETF Approved by SEC                   │
│  • Whale Dumps 50K ETH                       │
│  [View All News →]                           │
└─────────────────────────────────────────────┘
```

### Recommendation: Option A (Dedicated Tab)
**Reasoning**:
- Most consistent with existing UI
- Doesn't clutter market data view
- Mobile-friendly
- Easy to implement with existing tab system
- Can be expanded to full-screen if needed

---

## Component Architecture

### Component Hierarchy

```
<NewsFeedPanel>                      # Main container
  ├─ <NewsFilters>                   # Filter/sort controls
  │   ├─ <SourceFilter>              # Multi-select dropdown
  │   └─ <DateRangeFilter>           # Date range selector
  │
  ├─ <NewsArticleList>               # Article container
  │   ├─ <NewsArticleCard>           # Individual article
  │   │   ├─ <SourceBadge>           # Feed source indicator
  │   │   ├─ <ArticleTitle>          # Headline
  │   │   ├─ <ArticleExcerpt>        # Short description
  │   │   └─ <ArticleMetadata>       # Time, author
  │   │
  │   ├─ <NewsSkeleton>              # Loading state
  │   ├─ <NewsEmptyState>            # No results state
  │   └─ <TierUpgradeCTA>            # Paywall for free/guest
  │
  └─ <NewsErrorBoundary>             # Error handling
```

### Component Specifications

#### 1. NewsFeedPanel
```tsx
interface NewsFeedPanelProps {
  userTier: 'guest' | 'free' | 'pro' | 'elite'
  guestMode?: boolean
  guestVisibleCount?: number
  className?: string
}
```

**Features**:
- Fetches articles via `useNewsFeed` hook
- Handles tier-based filtering
- Manages loading/error states
- Implements infinite scroll (Pro/Elite only)

**Styling**:
- Uses shadcn/ui `Card` component
- Matches existing dashboard card styling
- Border: `border-border/60`
- Shadow: `shadow-md`
- Background: `bg-card`

---

#### 2. NewsArticleCard
```tsx
interface NewsArticleCardProps {
  article: {
    id: string
    title: string
    link: string
    pubDate: Date
    description: string
    source: string
    author?: string
    enclosure?: string // thumbnail
  }
  priority?: boolean // Elite-only feature
  onClick?: () => void
}
```

**Layout**:
```
┌──────────────────────────────────────────────┐
│ [Icon] Source Name · 2h ago          [Elite] │  <- Header
├──────────────────────────────────────────────┤
│ Breaking: Bitcoin ETF Approved by SEC         │  <- Title (bold)
│                                               │
│ The U.S. Securities and Exchange Commission  │  <- Excerpt
│ has approved the first spot Bitcoin ETF...   │
│                                               │
│ [Thumbnail if available]                      │  <- Optional Image
│                                               │
│ 📊 #Bitcoin #ETF #SEC                         │  <- Tags (optional)
└──────────────────────────────────────────────┘
```

**Styling**:
- Card: `bg-card hover:bg-accent/5 transition-colors`
- Border: `border border-border/40 hover:border-brand-500/40`
- Title: `text-foreground font-semibold text-base`
- Excerpt: `text-muted-foreground text-sm line-clamp-3`
- Source Badge: `bg-brand-500/10 text-brand-700 dark:text-brand-400`
- Priority (Elite): `ring-2 ring-elite-500/50` + badge

**Interactions**:
- Hover: Slight border color change, subtle elevation
- Click: Opens article in new tab (`target="_blank" rel="noopener"`)
- Keyboard: Focusable with Enter key support

---

#### 3. NewsFilters
```tsx
interface NewsFiltersProps {
  sources: string[]
  selectedSources: string[]
  dateRange: '1d' | '7d' | '30d' | 'all'
  onSourceChange: (sources: string[]) => void
  onDateRangeChange: (range: string) => void
  userTier: 'free' | 'pro' | 'elite'
}
```

**Layout**:
```
┌─────────────────────────────────────────────┐
│  Filter by Source: [All Sources ▼]          │
│  Date Range: [○ Today  ○ 7 Days  ○ 30 Days] │
│  Sort: [Newest First ▼]  [Reset Filters]    │
└─────────────────────────────────────────────┘
```

**Tier-Based Features**:
- **Guest/Free**: Filters disabled, show upgrade tooltip
- **Pro**: Source + Date filtering enabled
- **Elite**: All filters + sorting enabled

**Styling**:
- Uses shadcn/ui `Select` and `Checkbox` components
- Disabled filters have `opacity-50 cursor-not-allowed`
- Active filters show count badge: `(3 active)`

---

#### 4. SourceBadge
```tsx
interface SourceBadgeProps {
  source: string
  icon?: string // optional logo URL
  priority?: boolean
  className?: string
}
```

**Mapping**:
| Source | Color | Icon |
|--------|-------|------|
| CoinDesk | `bg-orange-500/10 text-orange-700` | 🏛️ |
| Cointelegraph | `bg-blue-500/10 text-blue-700` | 📰 |
| CryptoSlate | `bg-purple-500/10 text-purple-700` | 🔗 |
| The Block | `bg-gray-500/10 text-gray-700` | 🧱 |
| Decrypt | `bg-green-500/10 text-green-700` | 🔓 |
| NewsBTC | `bg-yellow-500/10 text-yellow-700` | ₿ |
| U.Today | `bg-indigo-500/10 text-indigo-700` | 📡 |
| Bitcoin Magazine | `bg-orange-600/10 text-orange-800` | ₿ |
| ChainGPT | `bg-pink-500/10 text-pink-700` | 🤖 |
| CryptoPanic | `bg-red-500/10 text-red-700` | 🚨 |
| Yahoo Finance | `bg-purple-600/10 text-purple-800` | 💼 |

**Styling**:
- Base: `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium`
- Priority (Elite): `ring-1 ring-elite-500/50`

---

#### 5. NewsEmptyState
```tsx
interface NewsEmptyStateProps {
  reason: 'no-articles' | 'no-results' | 'error'
  onReset?: () => void
}
```

**Variants**:

**No Articles**:
```
┌───────────────────────────────────┐
│          📰                        │
│   No news articles available       │
│   Check back soon for updates      │
└───────────────────────────────────┘
```

**No Results (Filtered)**:
```
┌───────────────────────────────────┐
│          🔍                        │
│   No articles match your filters   │
│   [Reset Filters]                  │
└───────────────────────────────────┘
```

**Error State**:
```
┌───────────────────────────────────┐
│          ⚠️                        │
│   Failed to load news articles     │
│   [Try Again]                      │
└───────────────────────────────────┘
```

---

#### 6. NewsSkeleton (Loading State)
```tsx
interface NewsSkeletonProps {
  count?: number // default 5
}
```

**Appearance**:
```
┌──────────────────────────────────┐
│ ████████ ·  ████                 │ <- Source + time
│ ████████████████████████         │ <- Title line 1
│ ██████████████                   │ <- Title line 2
│ ████████████████████████████     │ <- Excerpt line 1
│ ██████████████████               │ <- Excerpt line 2
└──────────────────────────────────┘
```

**Styling**:
- Uses `animate-pulse` from Tailwind
- Base: `bg-muted/50 rounded-md`
- Shimmer effect: `bg-gradient-to-r from-muted/50 via-muted/80 to-muted/50`

---

#### 7. TierUpgradeCTA (Paywall)
```tsx
interface TierUpgradeCTAProps {
  currentTier: 'guest' | 'free'
  visibleCount: number
  totalCount: number
}
```

**Appearance** (shown after guest/free article limit):
```
┌──────────────────────────────────────────┐
│  🔒 Unlock Full News Feed                 │
│  You're viewing 3 of 47 articles           │
│  Upgrade to Pro for unlimited access       │
│                                            │
│  [Start Free]  [Upgrade to Pro →]          │
└──────────────────────────────────────────┘
```

**Styling**:
- Background: `bg-gradient-to-br from-brand-500/10 to-sec-500/10`
- Border: `border-2 border-dashed border-brand-500/40`
- Blur overlay on hidden articles: `backdrop-blur-md`

---

## Data Flow

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                                                             │
│  ┌─────────────────┐      ┌────────────────────┐          │
│  │ NewsFeedPanel   │─────▶│ useNewsFeed Hook   │          │
│  │ (Component)     │◀─────│ (SWR / React Query)│          │
│  └─────────────────┘      └────────────────────┘          │
│                                    │                        │
│                                    ▼                        │
│                           ┌────────────────┐               │
│                           │ /api/news/     │               │
│                           │ articles       │               │
│                           └────────────────┘               │
└─────────────────────────────────────┬───────────────────────┘
                                      │
                                      │ HTTP GET
                                      │
┌─────────────────────────────────────▼───────────────────────┐
│                         Backend (Hono)                      │
│                                                             │
│  ┌──────────────────┐      ┌─────────────────┐            │
│  │ News API Route   │─────▶│ News Service    │            │
│  │ /api/news/*      │◀─────│ (Business Logic)│            │
│  └──────────────────┘      └─────────────────┘            │
│                                    │                        │
│                            ┌───────┴───────┐               │
│                            ▼               ▼               │
│                   ┌─────────────┐  ┌─────────────┐        │
│                   │ RSS Parser  │  │ Cache Layer │        │
│                   │ (rss-parser)│  │ (node-cache)│        │
│                   └─────────────┘  └─────────────┘        │
│                            │               │               │
│                            ▼               ▼               │
│                   ┌─────────────────────────────┐         │
│                   │   PostgreSQL Database       │         │
│                   │   (RssFeed, RssArticle)     │         │
│                   └─────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  External RSS Feed Servers   │
              │  (CoinDesk, Cointelegraph...)│
              └──────────────────────────────┘
```

### Data Fetching Flow

1. **Initial Load**:
   - Component mounts → `useNewsFeed` hook triggers
   - Check cache (localStorage) for recent data
   - If cached & fresh (< 5 min), render immediately
   - If stale, fetch from API in background

2. **API Request**:
   - Frontend: `GET /api/news/articles?sources=coindesk,cointelegraph&range=7d`
   - Backend: Check in-memory cache (15 min TTL)
   - If cached: Return immediately
   - If stale: Fetch from database, return stale data, refresh in background

3. **RSS Refresh (Background Job)**:
   - Cron job runs every 15 minutes
   - Fetches all enabled RSS feeds in parallel
   - Parses XML → Sanitizes → Stores in database
   - Individual failures logged, don't block others

4. **Real-time Updates** (Optional - v2.0):
   - WebSocket connection for breaking news
   - Push notification to Elite users
   - Badge notification on "News" tab

---

## UI/UX Specifications

### Placement on Dashboard

#### Desktop (XL+ screens):
```
┌────────────────────────────────────────────────────────────┐
│  Header + Banner                                           │
├────────────────────────────────────────────────────────────┤
│  Tabs: [Market Data]  [Volume Alerts]  [News]  [Settings] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  News Feed Content (when News tab active)                  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Filters: [Sources] [Date Range] [Sort]             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Article Card 1                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Article Card 2                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  [Load More Articles...]                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Mobile/Tablet:
```
┌─────────────────────────┐
│  Header                 │
├─────────────────────────┤
│  Tabs (horizontal)      │
│  [Market] [Alerts] [📰] │
├─────────────────────────┤
│                         │
│  News Tab Content       │
│                         │
│  [Filters ▼]            │
│                         │
│  ┌───────────────────┐  │
│  │ Article Card 1    │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ Article Card 2    │  │
│  └───────────────────┘  │
│                         │
│  [Load More...]         │
│                         │
└─────────────────────────┘
```

### Color Palette

Following VolSpike's existing design system:

| Element | Color Token | Hex/HSL |
|---------|-------------|---------|
| Primary Background | `bg-background` | HSL(var(--background)) |
| Card Background | `bg-card` | HSL(var(--card)) |
| Text Primary | `text-foreground` | HSL(var(--foreground)) |
| Text Secondary | `text-muted-foreground` | HSL(var(--muted-foreground)) |
| Border | `border-border/60` | HSL(var(--border)) / 60% |
| Brand (Links) | `text-brand-600` | HSL(var(--brand-600)) |
| Success (Positive News) | `text-green-600` | #059669 |
| Warning (Breaking News) | `text-warning-600` | #D97706 |
| Danger (Negative News) | `text-danger-600` | #DC2626 |

### Typography

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Panel Title | `text-h3` (1.25rem) | `font-semibold` | 1.4 |
| Article Title | `text-base` (1rem) | `font-semibold` | 1.5 |
| Article Excerpt | `text-sm` (0.875rem) | `font-normal` | 1.6 |
| Metadata (time, source) | `text-xs` (0.75rem) | `font-medium` | 1.4 |
| Filter Labels | `text-sm` (0.875rem) | `font-medium` | 1.5 |

### Spacing

- Card Padding: `p-4` (1rem)
- Card Gap: `gap-3` (0.75rem)
- Section Spacing: `space-y-4` (1rem vertical)
- Article List Gap: `gap-3` (0.75rem)

---

## Responsive Design

### Breakpoints (Tailwind defaults)

| Breakpoint | Min Width | Layout Changes |
|------------|-----------|----------------|
| `sm` | 640px | Stack filters vertically |
| `md` | 768px | Filters inline, 2-column article grid |
| `lg` | 1024px | Full filters row |
| `xl` | 1280px | Dedicated News tab appears |
| `2xl` | 1536px | Wider article cards, 3-column grid |

### Mobile-First Approach

**Base (Mobile)**:
- Single column layout
- Collapsible filters (drawer/sheet)
- Full-width article cards
- Infinite scroll (no pagination buttons)
- Touch-friendly tap targets (min 44x44px)

**Tablet (md+)**:
- 2-column article grid
- Inline filter bar
- Sticky filter bar on scroll

**Desktop (xl+)**:
- 3-column article grid (optional)
- Sidebar filter panel (if space allows)
- Hover states enabled

---

## Animations & Transitions

### Entry Animations

**Articles Fade In** (on initial load):
```css
.article-enter {
  animation: fade-slide-up 0.4s ease-out;
}

@keyframes fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Stagger Effect** (cascade articles):
- Each article delayed by 50ms
- Max 5 articles staggered, then instant render

### Interaction Animations

**Card Hover**:
```css
.article-card {
  transition: all 0.2s ease;
}
.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: hsl(var(--brand-500) / 0.4);
}
```

**Filter Selection**:
- Smooth opacity change: `transition-opacity duration-200`
- Checkboxes use `transition-transform` for scale effect

**Loading Spinner**:
- Use existing `LoadingSpinner` component from `/components/ui/loading-spinner.tsx`
- Variant: `variant="brand"`

### Skeleton Loader

- Pulse animation: `animate-pulse` (Tailwind)
- Shimmer effect (optional): Custom gradient sweep

---

## Error & Edge Cases

### Error States

#### 1. All Feeds Failed
```
┌────────────────────────────────────┐
│           ⚠️                       │
│  Unable to load news articles      │
│  All RSS feeds are currently       │
│  unavailable. Please try again.    │
│                                    │
│  [Retry]  [Check Status Page]      │
└────────────────────────────────────┘
```

#### 2. Partial Feed Failure
```
┌────────────────────────────────────┐
│  ⚠️ Some news sources unavailable   │
│  Showing articles from 8 of 11     │
│  sources. [View Details]            │
└────────────────────────────────────┘
```

#### 3. Network Error
```
┌────────────────────────────────────┐
│           🌐                       │
│  Connection Lost                   │
│  Check your internet connection    │
│  [Retry]                           │
└────────────────────────────────────┘
```

### Edge Cases

#### No Articles Match Filters
- Show empty state with "Reset Filters" button
- Suggest removing some filters

#### Very Old Articles
- Show relative time up to 7 days, then show date
- "2 hours ago" → "Yesterday" → "3 days ago" → "Nov 28, 2025"

#### Long Titles/Excerpts
- Title: `line-clamp-2` (max 2 lines, ellipsis)
- Excerpt: `line-clamp-3` (max 3 lines, ellipsis)

#### Missing Metadata
- No author: Hide author field
- No thumbnail: Show default placeholder or icon
- No publish date: Show "Recently"

#### Slow RSS Feeds
- Show cached articles immediately
- Display "Refreshing..." indicator in corner
- Update in background without disrupting UI

#### Tier Downgrade
- User downgrades from Pro to Free mid-session
- Hide filtered results, show upgrade CTA
- Persist filter state (restore on upgrade)

---

## Accessibility (a11y)

### Keyboard Navigation
- Tab order: Filters → Article Cards → Load More
- Enter/Space: Open article link
- Escape: Close filter dropdown
- Arrow keys: Navigate filter options

### Screen Reader Support
- Semantic HTML: `<article>`, `<time>`, `<nav>`
- ARIA labels: `aria-label="Filter news by source"`
- Live regions: `aria-live="polite"` for article updates
- Skip links: "Skip to news content"

### Color Contrast
- Text on background: 4.5:1 ratio (WCAG AA)
- Interactive elements: 3:1 ratio
- Source badges: High contrast variants for dark mode

### Focus Indicators
- Visible focus ring: `ring-2 ring-brand-500 ring-offset-2`
- No focus removal (never `outline-none` without replacement)

---

## Test Dashboard Route Design

### URL: `/dashboard/test-feeds` (Admin-only)

**Purpose**: Allow admin to test all RSS feeds before enabling in production

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  🧪 RSS Feed Testing Dashboard (Admin Only)                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Refresh All Feeds]  [Enable All]  [Disable All]          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ✅ CoinDesk (Enabled)              [Test] [Disable] │  │
│  │  Last Fetch: 2 min ago  |  Articles: 25  |  Errors: 0│  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Latest Articles:                               │  │  │
│  │  │  • FTX Creditors Get 118% Recovery (2h ago)    │  │  │
│  │  │  • Bitcoin Hits $45K Milestone (4h ago)        │  │  │
│  │  │  • SEC Approves ETF (6h ago)                   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ❌ CryptoPanic (Disabled)          [Test] [Enable]  │  │
│  │  Last Fetch: Never  |  Articles: 0  |  Errors: 0     │  │
│  │  Status: Not yet tested                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⚠️ ChainGPT (Disabled)             [Test] [Enable]  │  │
│  │  Last Fetch: 15 min ago  |  Articles: 0  |  Errors: 3│  │
│  │  Status: Timeout (feed not responding)               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Features**:
1. **Test Button**: Manually trigger RSS fetch for individual feed
2. **Enable/Disable Toggle**: Control production visibility
3. **Health Metrics**: Last fetch time, article count, error count
4. **Article Preview**: Show 3 latest articles from each feed
5. **Status Indicators**:
   - ✅ Green: Working, enabled
   - ❌ Red: Disabled
   - ⚠️ Yellow: Errors detected
6. **Bulk Actions**: Enable/Disable all, Refresh all

---

## Implementation Notes

### Performance Optimizations
1. **Lazy Loading**: Use React.lazy() for News tab
2. **Virtualization**: react-window for long article lists
3. **Image Lazy Load**: Use `loading="lazy"` for thumbnails
4. **Debouncing**: Filter inputs debounced by 300ms
5. **Pagination**: Load 20 articles at a time

### SEO Considerations
- News page is client-side only (no SSR needed for auth-gated content)
- Use meta tags for social sharing
- Canonical URLs point to original article sources

### Analytics Tracking
- Track: Article clicks, filter usage, time-on-news-section
- Events: `news_article_click`, `news_filter_applied`, `news_tab_view`

---

## Future Enhancements (v2.0+)

1. **Search Functionality**: Full-text search across articles
2. **Bookmarking**: Save articles for later
3. **Push Notifications**: Breaking news alerts (Elite tier)
4. **Sentiment Analysis**: Tag articles as bullish/bearish
5. **Ticker Integration**: Link mentions to market data (e.g., $BTC)
6. **Personalization**: ML-based article recommendations
7. **Comments**: User discussions on news (community feature)

---

**Document Owner**: Design Team
**Last Updated**: December 2, 2025
**Next Review**: Post-MVP Implementation
