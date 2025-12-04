# RSS News Feed Feature - Implementation Steps

**Feature**: RSS News Feed Integration
**Version**: 1.0
**Date**: December 2, 2025
**Approach**: Test-Driven Development (TDD) + Spec-Driven Development (SDD)

---

## Table of Contents
1. [Development Philosophy](#development-philosophy)
2. [Phase 1: Database & Backend Foundation](#phase-1-database--backend-foundation)
3. [Phase 2: RSS Parsing & Caching](#phase-2-rss-parsing--caching)
4. [Phase 3: API Endpoints](#phase-3-api-endpoints)
5. [Phase 4: Frontend Components](#phase-4-frontend-components)
6. [Phase 5: Test Dashboard Route](#phase-5-test-dashboard-route)
7. [Phase 6: Integration & Testing](#phase-6-integration--testing)
8. [Phase 7: Deployment](#phase-7-deployment)

---

## Development Philosophy

### Test-Driven Development (TDD)
**Red-Green-Refactor Cycle**:
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass test
3. **Refactor**: Improve code while keeping tests green

### Spec-Driven Development (SDD)
- Define interfaces/types before implementation
- Create fixtures and mock data early
- Use TypeScript strict mode for compile-time validation

### Safety Principles
- Never touch working functionality
- Feature flags for gradual rollout
- Isolated feature folder structure
- Comprehensive error handling

---

## Phase 1: Database & Backend Foundation

### Step 1.1: Prisma Schema Migration
**Goal**: Add RSS feed tables to database

**Test First (Schema Validation)**:
```typescript
// __tests__/lib/rss/schema.test.ts
describe('RSS Schema', () => {
  it('should have RssFeed model with required fields', () => {
    // Validates Prisma generates correct types
    const feed: RssFeed = {
      id: 'test',
      name: 'CoinDesk',
      url: 'https://coindesk.com/rss',
      category: 'Regulatory',
      enabled: true,
      priority: 0,
      errorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(feed).toBeDefined()
  })
})
```

**Implementation**:
```prisma
// volspike-nodejs-backend/prisma/schema.prisma
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

  articles    RssArticle[]

  @@index([enabled])
  @@index([priority])
}

model RssArticle {
  id          String   @id @default(cuid())
  feedId      String
  title       String
  link        String   @unique
  pubDate     DateTime
  description String?  @db.Text
  content     String?  @db.Text
  author      String?
  categories  String[]
  enclosure   String?
  createdAt   DateTime @default(now())

  feed        RssFeed  @relation(fields: [feedId], references: [id], onDelete: Cascade)

  @@index([pubDate(sort: Desc)])
  @@index([feedId])
  @@index([createdAt(sort: Desc)])
}
```

**Commands**:
```bash
cd volspike-nodejs-backend
npx prisma migrate dev --name add_rss_feed_tables
npx prisma generate
```

**Validation**:
- ✅ Migration runs without errors
- ✅ Prisma types generated correctly
- ✅ Database tables created with correct indexes

---

### Step 1.2: Seed RSS Feed Sources
**Goal**: Populate initial RSS feed sources

**Test First**:
```typescript
// __tests__/lib/rss/seed.test.ts
describe('RSS Feed Seed', () => {
  it('should seed 13 RSS feed sources', async () => {
    const feeds = await prisma.rssFeed.findMany()
    expect(feeds.length).toBeGreaterThanOrEqual(13)
  })

  it('should have CoinDesk feed enabled by default', async () => {
    const coindesk = await prisma.rssFeed.findFirst({
      where: { name: 'CoinDesk' }
    })
    expect(coindesk?.enabled).toBe(true)
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/prisma/seed-rss.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RSS_FEEDS = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'Regulatory/Macro',
    enabled: true,
    priority: 1,
  },
  {
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'Global Coverage',
    enabled: true,
    priority: 2,
  },
  {
    name: 'CryptoSlate',
    url: 'https://cryptoslate.com/feed/',
    category: 'On-chain/Whale',
    enabled: true,
    priority: 3,
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    category: 'Investigative',
    enabled: true,
    priority: 4,
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    category: 'DeFi/NFT',
    enabled: true,
    priority: 5,
  },
  {
    name: 'NewsBTC',
    url: 'https://www.newsbtc.com/feed/',
    category: 'Price Action',
    enabled: true,
    priority: 6,
  },
  {
    name: 'U.Today',
    url: 'https://u.today/rss/news',
    category: 'ETH/Ripple',
    enabled: true,
    priority: 7,
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/.rss/full/',
    category: 'BTC Macro',
    enabled: true,
    priority: 8,
  },
  {
    name: 'ChainGPT AI News',
    url: 'https://chaingpt.org/rss',
    category: 'AI-Curated',
    enabled: false,
    priority: 9,
  },
  {
    name: 'CryptoPanic',
    url: 'https://cryptopanic.com/news/rss/',
    category: 'Aggregated',
    enabled: false,
    priority: 10,
  },
  {
    name: 'Yahoo Finance Crypto',
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?r=1&category=crypto',
    category: 'Macro Crossover',
    enabled: false,
    priority: 11,
  },
  {
    name: 'Blockchain.News',
    url: 'https://blockchain.news/rss',
    category: 'General',
    enabled: false,
    priority: 12,
  },
]

async function seedRssFeeds() {
  console.log('🌱 Seeding RSS feeds...')

  for (const feed of RSS_FEEDS) {
    await prisma.rssFeed.upsert({
      where: { url: feed.url },
      update: feed,
      create: feed,
    })
  }

  console.log('✅ RSS feeds seeded successfully')
}

seedRssFeeds()
  .catch((e) => {
    console.error('❌ Error seeding RSS feeds:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Commands**:
```bash
npx tsx prisma/seed-rss.ts
```

**Validation**:
- ✅ 13 RSS feeds in database
- ✅ 8 enabled, 5 disabled
- ✅ Priority order correct

---

## Phase 2: RSS Parsing & Caching

### Step 2.1: RSS Parser Service
**Goal**: Create reusable RSS parser utility

**Test First**:
```typescript
// __tests__/lib/rss/parser.test.ts
import { parseRssFeed } from '@/lib/rss/parser'

describe('RSS Parser', () => {
  it('should parse valid RSS feed', async () => {
    const mockRssXml = `
      <?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item>
            <title>Test Article</title>
            <link>https://example.com/article</link>
            <pubDate>Mon, 02 Dec 2025 10:00:00 GMT</pubDate>
            <description>Test description</description>
          </item>
        </channel>
      </rss>
    `

    const result = await parseRssFeed(mockRssXml)
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0].title).toBe('Test Article')
  })

  it('should handle invalid XML gracefully', async () => {
    const invalidXml = '<invalid>xml</invalid>'
    const result = await parseRssFeed(invalidXml)
    expect(result.error).toBeDefined()
    expect(result.articles).toHaveLength(0)
  })

  it('should sanitize HTML in descriptions', async () => {
    const maliciousRss = `
      <?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Test</title>
            <description>&lt;script&gt;alert('XSS')&lt;/script&gt;Safe text</description>
          </item>
        </channel>
      </rss>
    `

    const result = await parseRssFeed(maliciousRss)
    expect(result.articles[0].description).not.toContain('<script>')
    expect(result.articles[0].description).toContain('Safe text')
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/src/lib/rss/parser.ts
import Parser from 'rss-parser'
import { sanitizeHtml } from './sanitizer'

export interface RssArticle {
  title: string
  link: string
  pubDate: Date
  description?: string
  content?: string
  author?: string
  categories?: string[]
  enclosure?: string
}

export interface ParseResult {
  articles: RssArticle[]
  error?: string
}

const parser = new Parser({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'VolSpike/1.0 (RSS Reader)',
  },
})

export async function parseRssFeed(url: string): Promise<ParseResult> {
  try {
    const feed = await parser.parseURL(url)

    const articles: RssArticle[] = feed.items.map((item) => ({
      title: sanitizeHtml(item.title || 'Untitled'),
      link: item.link || '',
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      description: item.contentSnippet
        ? sanitizeHtml(item.contentSnippet.slice(0, 300))
        : undefined,
      content: item.content ? sanitizeHtml(item.content) : undefined,
      author: item.creator || item.author || undefined,
      categories: item.categories || [],
      enclosure: item.enclosure?.url || undefined,
    }))

    return { articles }
  } catch (error) {
    console.error('RSS Parse Error:', error)
    return {
      articles: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Dependencies**:
```bash
cd volspike-nodejs-backend
npm install rss-parser sanitize-html
npm install -D @types/sanitize-html
```

---

### Step 2.2: HTML Sanitizer
**Goal**: Prevent XSS attacks from RSS content

**Test First**:
```typescript
// __tests__/lib/rss/sanitizer.test.ts
import { sanitizeHtml } from '@/lib/rss/sanitizer'

describe('HTML Sanitizer', () => {
  it('should remove script tags', () => {
    const dirty = '<p>Safe</p><script>alert("XSS")</script>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('<script>')
    expect(clean).toContain('Safe')
  })

  it('should allow basic formatting tags', () => {
    const html = '<p><strong>Bold</strong> and <em>italic</em></p>'
    const clean = sanitizeHtml(html)
    expect(clean).toContain('<strong>')
    expect(clean).toContain('<em>')
  })

  it('should remove onclick handlers', () => {
    const dirty = '<a href="#" onclick="alert()">Link</a>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('onclick')
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/src/lib/rss/sanitizer.ts
import sanitizeHtmlLib from 'sanitize-html'

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'blockquote'],
    allowedAttributes: {
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https'],
  })
}
```

---

### Step 2.3: Cache Service
**Goal**: Implement efficient caching to reduce RSS fetches

**Test First**:
```typescript
// __tests__/lib/rss/cache.test.ts
import { RssCache } from '@/lib/rss/cache'

describe('RSS Cache', () => {
  let cache: RssCache

  beforeEach(() => {
    cache = new RssCache()
  })

  it('should store and retrieve cached articles', () => {
    const articles = [{ title: 'Test', link: 'https://test.com' }]
    cache.set('coindesk', articles)

    const cached = cache.get('coindesk')
    expect(cached).toEqual(articles)
  })

  it('should return null for expired cache', async () => {
    const articles = [{ title: 'Test', link: 'https://test.com' }]
    cache.set('coindesk', articles, 100) // 100ms TTL

    await new Promise(resolve => setTimeout(resolve, 150))

    const cached = cache.get('coindesk')
    expect(cached).toBeNull()
  })

  it('should clear specific cache key', () => {
    cache.set('coindesk', [])
    cache.set('cointelegraph', [])

    cache.delete('coindesk')

    expect(cache.get('coindesk')).toBeNull()
    expect(cache.get('cointelegraph')).not.toBeNull()
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/src/lib/rss/cache.ts
import NodeCache from 'node-cache'

export class RssCache {
  private cache: NodeCache

  constructor(ttlSeconds: number = 900) { // 15 min default
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: 120, // Check for expired keys every 2 minutes
    })
  }

  get<T>(key: string): T | null {
    const value = this.cache.get<T>(key)
    return value !== undefined ? value : null
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 0)
  }

  delete(key: string): number {
    return this.cache.del(key)
  }

  flush(): void {
    this.cache.flushAll()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  keys(): string[] {
    return this.cache.keys()
  }
}

export const rssCache = new RssCache(900) // 15 minutes
```

**Dependencies**:
```bash
npm install node-cache
npm install -D @types/node-cache
```

---

## Phase 3: API Endpoints

### Step 3.1: News Service (Business Logic)
**Goal**: Core service for fetching and managing RSS articles

**Test First**:
```typescript
// __tests__/services/news.test.ts
import { NewsService } from '@/services/news'

describe('NewsService', () => {
  let service: NewsService

  beforeEach(() => {
    service = new NewsService()
  })

  it('should fetch articles from enabled feeds only', async () => {
    const articles = await service.getArticles({ enabledOnly: true })
    // All articles should be from enabled feeds
    expect(articles.every(a => a.feed.enabled)).toBe(true)
  })

  it('should filter articles by date range', async () => {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const articles = await service.getArticles({
      dateRange: '1d'
    })

    expect(articles.every(a => a.pubDate >= oneDayAgo)).toBe(true)
  })

  it('should paginate results', async () => {
    const page1 = await service.getArticles({ page: 1, limit: 10 })
    const page2 = await service.getArticles({ page: 2, limit: 10 })

    expect(page1.length).toBeLessThanOrEqual(10)
    expect(page2.length).toBeLessThanOrEqual(10)
    expect(page1[0].id).not.toBe(page2[0]?.id)
  })

  it('should refresh feed and store articles', async () => {
    const result = await service.refreshFeed('coindesk')

    expect(result.success).toBe(true)
    expect(result.articlesAdded).toBeGreaterThan(0)
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/src/services/news.ts
import { PrismaClient, RssFeed, RssArticle } from '@prisma/client'
import { parseRssFeed } from '../lib/rss/parser'
import { rssCache } from '../lib/rss/cache'

export interface GetArticlesOptions {
  sources?: string[] // feed IDs
  dateRange?: '1d' | '7d' | '30d' | 'all'
  page?: number
  limit?: number
  enabledOnly?: boolean
}

export interface RefreshFeedResult {
  success: boolean
  articlesAdded: number
  error?: string
}

export class NewsService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async getArticles(options: GetArticlesOptions = {}) {
    const {
      sources,
      dateRange = '7d',
      page = 1,
      limit = 20,
      enabledOnly = true,
    } = options

    // Check cache first
    const cacheKey = `articles:${JSON.stringify(options)}`
    const cached = rssCache.get<(RssArticle & { feed: RssFeed })[]>(cacheKey)
    if (cached) {
      return cached
    }

    // Build date filter
    const dateFilter = this.buildDateFilter(dateRange)

    // Query database
    const articles = await this.prisma.rssArticle.findMany({
      where: {
        ...(sources && { feedId: { in: sources } }),
        ...(dateFilter && { pubDate: { gte: dateFilter } }),
        ...(enabledOnly && { feed: { enabled: true } }),
      },
      include: {
        feed: true,
      },
      orderBy: {
        pubDate: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Cache results
    rssCache.set(cacheKey, articles, 300) // 5 min cache

    return articles
  }

  async refreshFeed(feedId: string): Promise<RefreshFeedResult> {
    try {
      const feed = await this.prisma.rssFeed.findUnique({
        where: { id: feedId },
      })

      if (!feed) {
        return { success: false, articlesAdded: 0, error: 'Feed not found' }
      }

      // Parse RSS feed
      const { articles, error } = await parseRssFeed(feed.url)

      if (error) {
        // Increment error count
        await this.prisma.rssFeed.update({
          where: { id: feedId },
          data: { errorCount: { increment: 1 } },
        })
        return { success: false, articlesAdded: 0, error }
      }

      // Store articles in database (upsert to avoid duplicates)
      let articlesAdded = 0
      for (const article of articles) {
        try {
          await this.prisma.rssArticle.upsert({
            where: { link: article.link },
            update: {
              title: article.title,
              description: article.description,
              content: article.content,
              author: article.author,
              categories: article.categories || [],
              enclosure: article.enclosure,
            },
            create: {
              feedId: feed.id,
              title: article.title,
              link: article.link,
              pubDate: article.pubDate,
              description: article.description,
              content: article.content,
              author: article.author,
              categories: article.categories || [],
              enclosure: article.enclosure,
            },
          })
          articlesAdded++
        } catch (err) {
          console.error('Error storing article:', err)
        }
      }

      // Update feed metadata
      await this.prisma.rssFeed.update({
        where: { id: feedId },
        data: {
          lastFetchAt: new Date(),
          errorCount: 0, // Reset on success
        },
      })

      // Clear cache
      rssCache.flush()

      return { success: true, articlesAdded }
    } catch (error) {
      return {
        success: false,
        articlesAdded: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async refreshAllFeeds(): Promise<Record<string, RefreshFeedResult>> {
    const feeds = await this.prisma.rssFeed.findMany({
      where: { enabled: true },
    })

    const results: Record<string, RefreshFeedResult> = {}

    // Refresh in parallel (with concurrency limit)
    const concurrency = 5
    for (let i = 0; i < feeds.length; i += concurrency) {
      const batch = feeds.slice(i, i + concurrency)
      const promises = batch.map(feed => this.refreshFeed(feed.id))
      const batchResults = await Promise.all(promises)

      batch.forEach((feed, index) => {
        results[feed.name] = batchResults[index]
      })
    }

    return results
  }

  private buildDateFilter(dateRange: string): Date | null {
    const now = new Date()
    switch (dateRange) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case 'all':
      default:
        return null
    }
  }
}
```

---

### Step 3.2: API Routes (Hono)
**Goal**: Expose REST API endpoints for frontend

**Test First**:
```typescript
// __tests__/routes/news.test.ts
import { testClient } from 'hono/testing'
import { app } from '@/index' // Hono app

describe('News API Routes', () => {
  it('GET /api/news/articles - should return articles', async () => {
    const res = await testClient(app).api.news.articles.$get()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.articles).toBeDefined()
    expect(Array.isArray(data.articles)).toBe(true)
  })

  it('GET /api/news/articles - should filter by source', async () => {
    const res = await testClient(app).api.news.articles.$get({
      query: { sources: 'coindesk,cointelegraph' }
    })

    const data = await res.json()
    expect(data.articles.every((a: any) =>
      ['coindesk', 'cointelegraph'].includes(a.feed.name.toLowerCase())
    )).toBe(true)
  })

  it('GET /api/news/feeds - should return enabled feeds', async () => {
    const res = await testClient(app).api.news.feeds.$get()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.feeds.every((f: any) => f.enabled)).toBe(true)
  })

  it('POST /api/admin/feeds - should require admin auth', async () => {
    const res = await testClient(app).api.admin.feeds.$post({
      json: {
        name: 'Test Feed',
        url: 'https://example.com/rss',
        category: 'Test',
      }
    })

    expect(res.status).toBe(401) // Unauthorized
  })
})
```

**Implementation**:
```typescript
// volspike-nodejs-backend/src/routes/news.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { NewsService } from '../services/news'
import { requireAuth, requireAdmin } from '../middleware/auth'

const news = new Hono()
const newsService = new NewsService()

// GET /api/news/articles - Public, tier-based filtering done in frontend
news.get(
  '/articles',
  zValidator('query', z.object({
    sources: z.string().optional(),
    dateRange: z.enum(['1d', '7d', '30d', 'all']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  })),
  async (c) => {
    const { sources, dateRange, page, limit } = c.req.valid('query')

    const articles = await newsService.getArticles({
      sources: sources?.split(','),
      dateRange: dateRange as any,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      enabledOnly: true,
    })

    return c.json({ articles })
  }
)

// GET /api/news/feeds - Get all enabled feeds
news.get('/feeds', async (c) => {
  const prisma = c.get('prisma')
  const feeds = await prisma.rssFeed.findMany({
    where: { enabled: true },
    orderBy: { priority: 'asc' },
  })

  return c.json({ feeds })
})

// POST /api/news/refresh - Force refresh (rate-limited)
news.post('/refresh', requireAuth, async (c) => {
  // Rate limit: 1 request per 5 minutes per user
  const results = await newsService.refreshAllFeeds()
  return c.json({ results })
})

// Admin routes
const admin = new Hono()

admin.use('*', requireAdmin)

// GET /api/admin/feeds - Get all feeds (including disabled)
admin.get('/feeds', async (c) => {
  const prisma = c.get('prisma')
  const feeds = await prisma.rssFeed.findMany({
    orderBy: { priority: 'asc' },
  })

  return c.json({ feeds })
})

// POST /api/admin/feeds - Create new feed
admin.post(
  '/feeds',
  zValidator('json', z.object({
    name: z.string().min(1),
    url: z.string().url(),
    category: z.string(),
    enabled: z.boolean().optional(),
    priority: z.number().optional(),
  })),
  async (c) => {
    const data = c.req.valid('json')
    const prisma = c.get('prisma')

    const feed = await prisma.rssFeed.create({ data })
    return c.json({ feed }, 201)
  }
)

// PATCH /api/admin/feeds/:id - Update feed
admin.patch(
  '/feeds/:id',
  zValidator('json', z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    category: z.string().optional(),
    enabled: z.boolean().optional(),
    priority: z.number().optional(),
  })),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    const prisma = c.get('prisma')

    const feed = await prisma.rssFeed.update({
      where: { id },
      data,
    })

    return c.json({ feed })
  }
)

// DELETE /api/admin/feeds/:id - Delete feed
admin.delete('/feeds/:id', async (c) => {
  const id = c.req.param('id')
  const prisma = c.get('prisma')

  await prisma.rssFeed.delete({ where: { id } })
  return c.json({ success: true })
})

// GET /api/admin/feeds/:id/test - Test individual feed
admin.get('/feeds/:id/test', async (c) => {
  const id = c.req.param('id')
  const result = await newsService.refreshFeed(id)
  return c.json(result)
})

news.route('/admin', admin)

export default news
```

**Mount in main app**:
```typescript
// volspike-nodejs-backend/src/index.ts
import news from './routes/news'

app.route('/api/news', news)
```

---

## Phase 4: Frontend Components

### Step 4.1: Create Feature Folder Structure
**Goal**: Organize all news-related components in isolated folder

**Commands**:
```bash
cd volspike-nextjs-frontend
mkdir -p src/components/news
mkdir -p src/hooks/news
mkdir -p src/lib/news
```

**Structure**:
```
src/
├── components/news/
│   ├── news-feed-panel.tsx
│   ├── news-article-card.tsx
│   ├── news-article-list.tsx
│   ├── news-filters.tsx
│   ├── news-source-badge.tsx
│   ├── news-skeleton.tsx
│   ├── news-empty-state.tsx
│   ├── tier-upgrade-cta.tsx
│   └── index.ts (barrel export)
├── hooks/news/
│   ├── use-news-feed.ts
│   └── use-news-filters.ts
└── lib/news/
    ├── types.ts
    └── utils.ts
```

---

### Step 4.2: Type Definitions
**Test First**:
```typescript
// __tests__/lib/news/types.test.ts
import type { NewsArticle, NewsFeed } from '@/lib/news/types'

describe('News Types', () => {
  it('should validate NewsArticle type', () => {
    const article: NewsArticle = {
      id: '1',
      title: 'Test',
      link: 'https://test.com',
      pubDate: new Date(),
      description: 'Test',
      source: {
        id: '1',
        name: 'CoinDesk',
        url: 'https://coindesk.com/rss',
        category: 'Regulatory',
        enabled: true,
      },
    }
    expect(article).toBeDefined()
  })
})
```

**Implementation**:
```typescript
// volspike-nextjs-frontend/src/lib/news/types.ts
export interface NewsFeed {
  id: string
  name: string
  url: string
  category: string
  enabled: boolean
  priority?: number
  lastFetchAt?: Date
  errorCount?: number
}

export interface NewsArticle {
  id: string
  title: string
  link: string
  pubDate: Date
  description?: string
  content?: string
  author?: string
  categories?: string[]
  enclosure?: string // thumbnail URL
  source: NewsFeed
}

export interface NewsFilters {
  sources: string[]
  dateRange: '1d' | '7d' | '30d' | 'all'
  page: number
}

export type UserTier = 'guest' | 'free' | 'pro' | 'elite'
```

---

### Step 4.3: Data Fetching Hook (use-news-feed.ts)
**Test First**:
```typescript
// __tests__/hooks/use-news-feed.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useNewsFeed } from '@/hooks/news/use-news-feed'

describe('useNewsFeed', () => {
  it('should fetch articles on mount', async () => {
    const { result } = renderHook(() => useNewsFeed())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.articles).toBeDefined()
  })

  it('should filter by sources', async () => {
    const { result } = renderHook(() =>
      useNewsFeed({ sources: ['coindesk'] })
    )

    await waitFor(() => {
      expect(result.current.articles.every(a =>
        a.source.name === 'CoinDesk'
      )).toBe(true)
    })
  })
})
```

**Implementation**:
```typescript
// volspike-nextjs-frontend/src/hooks/news/use-news-feed.ts
'use client'

import useSWR from 'swr'
import type { NewsArticle } from '@/lib/news/types'

interface UseNewsFeedOptions {
  sources?: string[]
  dateRange?: '1d' | '7d' | '30d' | 'all'
  page?: number
  limit?: number
  enabled?: boolean
}

interface UseNewsFeedReturn {
  articles: NewsArticle[]
  isLoading: boolean
  isError: boolean
  mutate: () => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useNewsFeed(options: UseNewsFeedOptions = {}): UseNewsFeedReturn {
  const {
    sources,
    dateRange = '7d',
    page = 1,
    limit = 20,
    enabled = true,
  } = options

  // Build query string
  const params = new URLSearchParams()
  if (sources?.length) params.set('sources', sources.join(','))
  if (dateRange) params.set('dateRange', dateRange)
  if (page) params.set('page', page.toString())
  if (limit) params.set('limit', limit.toString())

  const url = `/api/news/articles?${params.toString()}`

  const { data, error, mutate } = useSWR(
    enabled ? url : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
    }
  )

  return {
    articles: data?.articles || [],
    isLoading: !data && !error,
    isError: !!error,
    mutate,
  }
}
```

**Dependencies**:
```bash
cd volspike-nextjs-frontend
npm install swr
```

---

### Step 4.4: News Article Card Component
**Test First**:
```typescript
// __tests__/components/news/news-article-card.test.tsx
import { render, screen } from '@testing-library/react'
import { NewsArticleCard } from '@/components/news/news-article-card'

describe('NewsArticleCard', () => {
  const mockArticle = {
    id: '1',
    title: 'Bitcoin Hits $45K',
    link: 'https://example.com/article',
    pubDate: new Date('2025-12-02T10:00:00Z'),
    description: 'Bitcoin reaches new milestone',
    source: {
      id: '1',
      name: 'CoinDesk',
      url: 'https://coindesk.com/rss',
      category: 'Regulatory',
      enabled: true,
    },
  }

  it('should render article title', () => {
    render(<NewsArticleCard article={mockArticle} />)
    expect(screen.getByText('Bitcoin Hits $45K')).toBeInTheDocument()
  })

  it('should render source badge', () => {
    render(<NewsArticleCard article={mockArticle} />)
    expect(screen.getByText('CoinDesk')).toBeInTheDocument()
  })

  it('should open link in new tab on click', () => {
    render(<NewsArticleCard article={mockArticle} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('href', mockArticle.link)
  })
})
```

**Implementation**:
```typescript
// volspike-nextjs-frontend/src/components/news/news-article-card.tsx
'use client'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { NewsArticle } from '@/lib/news/types'

interface NewsArticleCardProps {
  article: NewsArticle
  priority?: boolean
  onClick?: () => void
}

export function NewsArticleCard({ article, priority }: NewsArticleCardProps) {
  const timeAgo = formatDistanceToNow(new Date(article.pubDate), {
    addSuffix: true,
  })

  return (
    <Card
      className={`
        group transition-all duration-200
        hover:shadow-md hover:border-brand-500/40
        ${priority ? 'ring-2 ring-elite-500/50' : ''}
      `}
    >
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <CardContent className="p-4">
          {/* Header: Source + Time */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-500/20"
              >
                {article.source.name}
              </Badge>
              {priority && (
                <Badge className="bg-elite-500/20 text-elite-700 dark:text-elite-400">
                  Priority
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {article.title}
          </h3>

          {/* Description */}
          {article.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              {article.description}
            </p>
          )}

          {/* Thumbnail (if available) */}
          {article.enclosure && (
            <img
              src={article.enclosure}
              alt={article.title}
              className="w-full h-40 object-cover rounded-md mb-3"
              loading="lazy"
            />
          )}

          {/* Footer: Categories + Link Icon */}
          <div className="flex items-center justify-between">
            {article.categories && article.categories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {article.categories.slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded"
                  >
                    #{cat}
                  </span>
                ))}
              </div>
            )}
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand-600 transition-colors" />
          </div>
        </CardContent>
      </a>
    </Card>
  )
}
```

**Dependencies**:
```bash
npm install date-fns lucide-react
```

---

### Step 4.5: News Feed Panel (Main Component)
**Implementation** (tests omitted for brevity, follow same TDD pattern):

```typescript
// volspike-nextjs-frontend/src/components/news/news-feed-panel.tsx
'use client'

import { useState } from 'react'
import { useNewsFeed } from '@/hooks/news/use-news-feed'
import { NewsArticleCard } from './news-article-card'
import { NewsFilters } from './news-filters'
import { NewsSkeleton } from './news-skeleton'
import { NewsEmptyState } from './news-empty-state'
import { TierUpgradeCTA } from './tier-upgrade-cta'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserTier } from '@/lib/news/types'

interface NewsFeedPanelProps {
  userTier: UserTier
  guestMode?: boolean
}

export function NewsFeedPanel({ userTier, guestMode = false }: NewsFeedPanelProps) {
  const [filters, setFilters] = useState({
    sources: [] as string[],
    dateRange: '7d' as '1d' | '7d' | '30d' | 'all',
  })

  const { articles, isLoading, isError, mutate } = useNewsFeed({
    sources: filters.sources,
    dateRange: filters.dateRange,
  })

  // Tier-based limits
  const limits = {
    guest: 3,
    free: 5,
    pro: 999,
    elite: 999,
  }
  const visibleArticles = articles.slice(0, limits[userTier])
  const hasMore = articles.length > visibleArticles.length

  return (
    <Card className="h-full flex flex-col border border-border/60 shadow-md">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <span>Crypto News</span>
          <span
            className={`
              text-sm font-normal px-2 py-0.5 rounded-md border
              ${userTier === 'guest' || userTier === 'free'
                ? 'bg-muted/70 text-muted-foreground border-border'
                : userTier === 'pro'
                ? 'bg-sec-500/20 text-sec-700 dark:text-sec-400 border-sec-500/40'
                : 'bg-elite-500/20 text-elite-700 dark:text-elite-400 border-elite-500/40'
              }
            `}
          >
            {guestMode ? 'PREVIEW' : `${userTier.toUpperCase()} Tier`}
          </span>
        </CardTitle>
        <CardDescription>
          Latest crypto and macro news from trusted sources
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col">
        {/* Filters */}
        {!guestMode && userTier !== 'free' && (
          <NewsFilters
            filters={filters}
            onFiltersChange={setFilters}
            userTier={userTier}
          />
        )}

        {/* Article List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {isLoading ? (
            <NewsSkeleton count={5} />
          ) : isError ? (
            <NewsEmptyState reason="error" onReset={mutate} />
          ) : visibleArticles.length === 0 ? (
            <NewsEmptyState reason="no-articles" />
          ) : (
            <>
              {visibleArticles.map((article) => (
                <NewsArticleCard
                  key={article.id}
                  article={article}
                  priority={userTier === 'elite' && article.source.priority === 1}
                />
              ))}

              {/* Upgrade CTA for guest/free */}
              {hasMore && (guestMode || userTier === 'free') && (
                <TierUpgradeCTA
                  currentTier={guestMode ? 'guest' : userTier}
                  visibleCount={visibleArticles.length}
                  totalCount={articles.length}
                />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 5: Test Dashboard Route

### Step 5.1: Create Test Route
**Goal**: Admin-only route to test all RSS feeds

**Commands**:
```bash
mkdir -p volspike-nextjs-frontend/src/app/dashboard/test-feeds
```

**Implementation**:
```typescript
// volspike-nextjs-frontend/src/app/dashboard/test-feeds/page.tsx
export const dynamic = 'force-dynamic'

import { getNextAuthSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import { TestFeedsDashboard } from './test-feeds-dashboard'

export default async function TestFeedsPage() {
  const session = await getNextAuthSession()
  const role = (session?.user as any)?.role

  // Admin-only access
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  return <TestFeedsDashboard />
}
```

**Client Component**:
```typescript
// volspike-nextjs-frontend/src/app/dashboard/test-feeds/test-feeds-dashboard.tsx
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface RssFeed {
  id: string
  name: string
  url: string
  category: string
  enabled: boolean
  priority: number
  lastFetchAt?: string
  errorCount: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function TestFeedsDashboard() {
  const { data, mutate } = useSWR('/api/admin/feeds', fetcher)
  const feeds: RssFeed[] = data?.feeds || []
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, any>>({})

  const testFeed = async (feedId: string) => {
    setTesting({ ...testing, [feedId]: true })
    try {
      const res = await fetch(`/api/admin/feeds/${feedId}/test`)
      const result = await res.json()
      setResults({ ...results, [feedId]: result })
    } catch (error) {
      setResults({
        ...results,
        [feedId]: { success: false, error: 'Request failed' },
      })
    } finally {
      setTesting({ ...testing, [feedId]: false })
    }
  }

  const toggleFeed = async (feedId: string, enabled: boolean) => {
    await fetch(`/api/admin/feeds/${feedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    mutate()
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">RSS Feed Testing Dashboard</h1>
        <Badge variant="outline" className="bg-warning-500/20 text-warning-700">
          Admin Only
        </Badge>
      </div>

      <div className="space-y-4">
        {feeds.map((feed) => {
          const result = results[feed.id]
          const isLoading = testing[feed.id]

          return (
            <Card key={feed.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {feed.enabled ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <CardTitle>{feed.name}</CardTitle>
                    <Badge variant="outline">{feed.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testFeed(feed.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={feed.enabled ? 'destructive' : 'default'}
                      onClick={() => toggleFeed(feed.id, !feed.enabled)}
                    >
                      {feed.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>URL:</strong> {feed.url}
                  </p>
                  <p>
                    <strong>Last Fetch:</strong>{' '}
                    {feed.lastFetchAt
                      ? new Date(feed.lastFetchAt).toLocaleString()
                      : 'Never'}
                  </p>
                  <p>
                    <strong>Errors:</strong> {feed.errorCount}
                  </p>
                </div>

                {result && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-md">
                    {result.success ? (
                      <div className="text-green-600">
                        <CheckCircle className="inline w-4 h-4 mr-2" />
                        Success! Added {result.articlesAdded} articles
                      </div>
                    ) : (
                      <div className="text-red-600">
                        <AlertCircle className="inline w-4 h-4 mr-2" />
                        Error: {result.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

---

## Phase 6: Integration & Testing

### Step 6.1: Add News Tab to Dashboard
**Goal**: Integrate news panel into main dashboard

**Implementation**:
```typescript
// volspike-nextjs-frontend/src/components/dashboard.tsx
// Add import
import { NewsFeedPanel } from '@/components/news/news-feed-panel'

// Inside Dashboard component, add News tab to existing tabs
const newsPanel = (
  <NewsFeedPanel
    userTier={userTier as 'free' | 'pro' | 'elite'}
    guestMode={isGuest}
  />
)

// Add to TabsList
<TabsTrigger value="news">News</TabsTrigger>

// Add TabsContent
<TabsContent value="news" className="mt-4 animate-fade-in">
  {newsPanel}
</TabsContent>
```

---

### Step 6.2: Backend Cron Job (RSS Refresh)
**Goal**: Auto-refresh RSS feeds every 15 minutes

**Implementation**:
```typescript
// volspike-nodejs-backend/src/jobs/refresh-rss-feeds.ts
import cron from 'node-cron'
import { NewsService } from '../services/news'

const newsService = new NewsService()

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('🔄 Starting RSS feed refresh...')
  try {
    const results = await newsService.refreshAllFeeds()
    console.log('✅ RSS feeds refreshed:', results)
  } catch (error) {
    console.error('❌ Error refreshing RSS feeds:', error)
  }
})
```

**Mount in main app**:
```typescript
// volspike-nodejs-backend/src/index.ts
import './jobs/refresh-rss-feeds'
```

**Dependencies**:
```bash
npm install node-cron
npm install -D @types/node-cron
```

---

### Step 6.3: Run All Tests
**Commands**:
```bash
# Backend tests
cd volspike-nodejs-backend
npm run test

# Frontend tests
cd volspike-nextjs-frontend
npm run test

# Type checking
npm run type-check
```

---

## Phase 7: Deployment

### Step 7.1: Environment Variables
**Backend (.env)**:
```env
# RSS Feed Configuration
RSS_CACHE_TTL=900 # 15 minutes
RSS_FETCH_TIMEOUT=10000 # 10 seconds
RSS_CONCURRENT_FETCHES=5
```

**Frontend (.env.local)**:
```env
# No additional env vars needed (uses existing backend URL)
```

---

### Step 7.2: Database Migration (Production)
**Commands**:
```bash
# Run on Railway
railway run npx prisma migrate deploy
railway run npx tsx prisma/seed-rss.ts
```

---

### Step 7.3: Deploy to Production
**Automatic Deploy via GitHub**:
1. Merge feature branch to `main`
2. GitHub Actions triggers
3. Vercel deploys frontend
4. Railway deploys backend

**Manual Rollout**:
1. Deploy backend first (with migrations)
2. Deploy frontend second
3. Test `/dashboard/test-feeds` on production
4. Enable feeds gradually via admin panel

---

### Step 7.4: Post-Deployment Validation
**Checklist**:
- ✅ Database migrations applied
- ✅ RSS feeds seeded
- ✅ Cron job running (check logs)
- ✅ Test dashboard accessible at `/dashboard/test-feeds`
- ✅ News tab visible on main dashboard
- ✅ Articles loading correctly
- ✅ Tier-based filtering working
- ✅ No console errors
- ✅ Performance metrics within SLA

---

## Rollback Plan

**If deployment fails**:
1. **Immediate**: Disable News tab via feature flag (set `DISABLE_NEWS_FEATURE=true`)
2. **Database**: Rollback migration: `npx prisma migrate resolve --rolled-back <migration>`
3. **Code**: Revert Git commit: `git revert <commit-hash>`
4. **Frontend**: Redeploy previous version on Vercel

---

## Success Criteria

### Functional
- ✅ All 13 RSS feeds parseable
- ✅ Articles display correctly with source, title, excerpt, time
- ✅ Filters work (source, date range)
- ✅ Tier-based access control enforced
- ✅ Test dashboard functional for admin
- ✅ No breaking changes to existing features

### Performance
- ✅ Page load time < 2s
- ✅ RSS fetch time < 3s per feed
- ✅ Bundle size increase < 50KB
- ✅ No memory leaks

### Quality
- ✅ 80%+ test coverage
- ✅ TypeScript strict mode passes
- ✅ No console warnings/errors
- ✅ Accessible (WCAG AA)
- ✅ Responsive (mobile/tablet/desktop)

---

## Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Phase 1: Database | 0.5 days | Backend Dev |
| Phase 2: RSS Parsing | 1 day | Backend Dev |
| Phase 3: API Endpoints | 1 day | Backend Dev |
| Phase 4: Frontend Components | 2 days | Frontend Dev |
| Phase 5: Test Dashboard | 0.5 days | Frontend Dev |
| Phase 6: Integration | 1 day | Full Stack |
| Phase 7: Deployment | 0.5 days | DevOps |
| **Total** | **7 days** | |

---

## Next Steps

1. ✅ Review this implementation plan
2. ⏸ Get stakeholder approval
3. ⏸ Create GitHub issues for each phase
4. ⏸ Assign developers
5. ⏸ Start Phase 1

---

**Document Owner**: Development Team
**Last Updated**: December 2, 2025
**Status**: Ready for Implementation
