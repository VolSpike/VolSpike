import { PrismaClient } from '@prisma/client'
import { parseRssFeed, articleQueryCache } from '../lib/rss'
import { createLogger } from '../lib/logger'

const logger = createLogger()

// Type definitions for RSS models (mirrors Prisma schema)
// These are defined here to allow compilation before Prisma migration
export interface RssFeed {
  id: string
  name: string
  url: string
  category: string
  enabled: boolean
  priority: number
  lastFetchAt: Date | null
  errorCount: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface RssArticle {
  id: string
  feedId: string
  title: string
  link: string
  pubDate: Date
  description: string | null
  author: string | null
  categories: string[]
  enclosure: string | null
  guid: string | null
  createdAt: Date
}

// RSS Feed sources configuration
export const RSS_FEED_SOURCES = [
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

export interface GetArticlesOptions {
  feedIds?: string[]
  feedNames?: string[]
  limit?: number
  page?: number
  enabledOnly?: boolean
}

export interface RefreshFeedResult {
  success: boolean
  feedName: string
  articlesAdded: number
  articlesUpdated: number
  error?: string
  fetchTimeMs?: number
}

export interface FeedWithStats extends RssFeed {
  _count?: {
    articles: number
  }
}

export class NewsService {
  private prisma: PrismaClient
  // Type assertion helper for Prisma models that may not exist yet (before migration)
  private get db(): any {
    return this.prisma as any
  }

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Seed RSS feed sources into database
   */
  async seedFeeds(): Promise<number> {
    let created = 0

    logger.info(`[NewsService] Starting to seed ${RSS_FEED_SOURCES.length} RSS feeds...`)

    for (const feed of RSS_FEED_SOURCES) {
      try {
        logger.info(`[NewsService] Seeding feed: ${feed.name} (${feed.url})`)
        const result = await this.db.rssFeed.upsert({
          where: { url: feed.url },
          update: {
            name: feed.name,
            category: feed.category,
            priority: feed.priority,
            // Don't update enabled status on seed - preserve user changes
          },
          create: feed,
        })
        logger.info(`[NewsService] Successfully seeded feed: ${feed.name}, id: ${result.id}`)
        created++
      } catch (error) {
        logger.error(`[NewsService] Failed to seed feed ${feed.name}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    logger.info(`[NewsService] Seeded ${created}/${RSS_FEED_SOURCES.length} RSS feeds`)
    return created
  }

  /**
   * Get all feeds with article counts
   */
  async getFeeds(includeDisabled: boolean = false): Promise<FeedWithStats[]> {
    const feeds = await this.db.rssFeed.findMany({
      where: includeDisabled ? {} : { enabled: true },
      orderBy: { priority: 'asc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })

    return feeds
  }

  /**
   * Get a single feed by ID
   */
  async getFeed(id: string): Promise<RssFeed | null> {
    return this.db.rssFeed.findUnique({
      where: { id },
    })
  }

  /**
   * Update feed settings
   */
  async updateFeed(
    id: string,
    data: Partial<Pick<RssFeed, 'name' | 'url' | 'category' | 'enabled' | 'priority'>>
  ): Promise<RssFeed> {
    return this.db.rssFeed.update({
      where: { id },
      data,
    })
  }

  /**
   * Get articles with pagination and filtering
   */
  async getArticles(options: GetArticlesOptions = {}): Promise<(RssArticle & { feed: RssFeed })[]> {
    const { feedIds, feedNames, limit = 50, page = 1, enabledOnly = true } = options

    // Build cache key
    const cacheKey = `articles:${JSON.stringify(options)}`
    const cached = articleQueryCache.get<(RssArticle & { feed: RssFeed })[]>(cacheKey)
    if (cached) {
      return cached
    }

    const where: any = {}

    // Filter by specific feed IDs
    if (feedIds && feedIds.length > 0) {
      where.feedId = { in: feedIds }
    }

    // Filter by feed names (case-insensitive)
    if (feedNames && feedNames.length > 0) {
      where.feed = {
        name: { in: feedNames, mode: 'insensitive' },
      }
    }

    // Only enabled feeds
    if (enabledOnly) {
      where.feed = {
        ...where.feed,
        enabled: true,
      }
    }

    const articles = await this.db.rssArticle.findMany({
      where,
      include: {
        feed: true,
      },
      orderBy: {
        pubDate: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Cache results for 5 minutes
    articleQueryCache.set(cacheKey, articles)

    return articles
  }

  /**
   * Refresh a single feed - fetch and store new articles
   */
  async refreshFeed(feedId: string): Promise<RefreshFeedResult> {
    const startTime = Date.now()

    const feed = await this.db.rssFeed.findUnique({
      where: { id: feedId },
    })

    if (!feed) {
      return {
        success: false,
        feedName: 'Unknown',
        articlesAdded: 0,
        articlesUpdated: 0,
        error: 'Feed not found',
      }
    }

    try {
      const result = await parseRssFeed(feed.url)

      if (!result.success) {
        // Update error count
        await this.db.rssFeed.update({
          where: { id: feedId },
          data: {
            errorCount: { increment: 1 },
            lastError: result.error,
          },
        })

        return {
          success: false,
          feedName: feed.name,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: result.error,
          fetchTimeMs: Date.now() - startTime,
        }
      }

      let articlesAdded = 0
      let articlesUpdated = 0

      // Store articles (upsert to handle duplicates)
      for (const article of result.articles) {
        try {
          const existing = await this.db.rssArticle.findUnique({
            where: { link: article.link },
          })

          if (existing) {
            // Update existing article
            await this.db.rssArticle.update({
              where: { link: article.link },
              data: {
                title: article.title,
                description: article.description,
                author: article.author,
                categories: article.categories || [],
                enclosure: article.enclosure,
              },
            })
            articlesUpdated++
          } else {
            // Create new article
            await this.db.rssArticle.create({
              data: {
                feedId: feed.id,
                title: article.title,
                link: article.link,
                pubDate: article.pubDate,
                description: article.description,
                author: article.author,
                categories: article.categories || [],
                enclosure: article.enclosure,
                guid: article.guid,
              },
            })
            articlesAdded++
          }
        } catch (err) {
          // Log but don't fail on individual article errors
          logger.warn(`[NewsService] Error storing article "${article.title}":`, err)
        }
      }

      // Update feed metadata
      await this.db.rssFeed.update({
        where: { id: feedId },
        data: {
          lastFetchAt: new Date(),
          errorCount: 0,
          lastError: null,
        },
      })

      // Clear article cache since we have new data
      articleQueryCache.flush()

      logger.info(
        `[NewsService] Refreshed ${feed.name}: +${articlesAdded} new, ~${articlesUpdated} updated`
      )

      return {
        success: true,
        feedName: feed.name,
        articlesAdded,
        articlesUpdated,
        fetchTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.db.rssFeed.update({
        where: { id: feedId },
        data: {
          errorCount: { increment: 1 },
          lastError: errorMessage,
        },
      })

      return {
        success: false,
        feedName: feed.name,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: errorMessage,
        fetchTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Refresh all enabled feeds
   */
  async refreshAllFeeds(enabledOnly: boolean = true): Promise<Map<string, RefreshFeedResult>> {
    const feeds = await this.db.rssFeed.findMany({
      where: enabledOnly ? { enabled: true } : {},
    })

    const results = new Map<string, RefreshFeedResult>()

    // Process feeds in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < feeds.length; i += batchSize) {
      const batch = feeds.slice(i, i + batchSize) as RssFeed[]
      const batchResults = await Promise.all(batch.map((feed: RssFeed) => this.refreshFeed(feed.id)))

      batch.forEach((feed: RssFeed, index: number) => {
        results.set(feed.id, batchResults[index])
      })
    }

    return results
  }

  /**
   * Delete articles older than specified hours (default: 6 hours)
   * This keeps the database lean and focused on recent news
   */
  async cleanupOldArticles(hoursToKeep: number = 6): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - hoursToKeep)

    const result = await this.db.rssArticle.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    if (result.count > 0) {
      logger.info(`[NewsService] Cleaned up ${result.count} articles older than ${hoursToKeep} hours`)
    }

    return result.count
  }

  /**
   * Get feed statistics for admin dashboard
   */
  async getStats(): Promise<{
    totalFeeds: number
    enabledFeeds: number
    totalArticles: number
    oldestArticle?: Date
    newestArticle?: Date
    feedsWithErrors: number
  }> {
    const [feedStats, articleStats, feedsWithErrors] = await Promise.all([
      this.db.rssFeed.aggregate({
        _count: { _all: true },
      }),
      this.db.rssArticle.aggregate({
        _count: { _all: true },
        _min: { pubDate: true },
        _max: { pubDate: true },
      }),
      this.db.rssFeed.count({
        where: {
          errorCount: { gt: 0 },
        },
      }),
    ])

    const enabledCount = await this.db.rssFeed.count({
      where: { enabled: true },
    })

    return {
      totalFeeds: feedStats._count._all,
      enabledFeeds: enabledCount,
      totalArticles: articleStats._count._all,
      oldestArticle: articleStats._min.pubDate || undefined,
      newestArticle: articleStats._max.pubDate || undefined,
      feedsWithErrors,
    }
  }
}
