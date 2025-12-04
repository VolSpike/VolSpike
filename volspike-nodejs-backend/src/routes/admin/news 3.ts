import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { NewsService } from '../../services/news'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const adminNewsRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Lazy initialization to avoid circular import issues
let newsService: NewsService | null = null
function getNewsService(): NewsService {
  if (!newsService) {
    newsService = new NewsService(prisma)
  }
  return newsService
}

// GET /api/admin/news/feeds - Get all feeds with stats
adminNewsRoutes.get('/feeds', async (c) => {
  try {
    const feeds = await getNewsService().getFeeds(true) // Include disabled feeds
    return c.json({ feeds })
  } catch (error) {
    logger.error('[AdminNews] Failed to get feeds:', error)
    return c.json(
      {
        error: 'Failed to get feeds',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// GET /api/admin/news/stats - Get overall stats
adminNewsRoutes.get('/stats', async (c) => {
  try {
    const stats = await getNewsService().getStats()
    return c.json({ stats })
  } catch (error) {
    logger.error('[AdminNews] Failed to get stats:', error)
    return c.json(
      {
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// GET /api/admin/news/articles - Get all articles (for admin review)
const articlesSchema = z.object({
  feedId: z.string().optional(),
  feedName: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(1).default(1),
})

adminNewsRoutes.get('/articles', async (c) => {
  try {
    const query = c.req.query()
    const params = articlesSchema.parse(query)

    const articles = await getNewsService().getArticles({
      feedIds: params.feedId ? [params.feedId] : undefined,
      feedNames: params.feedName ? [params.feedName] : undefined,
      limit: params.limit,
      page: params.page,
      enabledOnly: false, // Admin sees all articles
    })

    return c.json({ articles })
  } catch (error) {
    logger.error('[AdminNews] Failed to get articles:', error)
    return c.json(
      {
        error: 'Failed to get articles',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// PATCH /api/admin/news/feeds/:id - Update feed settings
const updateFeedSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  category: z.string().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().optional(),
})

adminNewsRoutes.patch('/feeds/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const data = updateFeedSchema.parse(body)

    const feed = await getNewsService().updateFeed(id, data)

    logger.info(`[AdminNews] Updated feed ${feed.name}:`, data)

    return c.json({ feed })
  } catch (error) {
    logger.error('[AdminNews] Failed to update feed:', error)
    return c.json(
      {
        error: 'Failed to update feed',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/news/feeds/:id/test - Test a single feed
adminNewsRoutes.post('/feeds/:id/test', async (c) => {
  try {
    const id = c.req.param('id')
    const result = await getNewsService().refreshFeed(id)

    return c.json({ result })
  } catch (error) {
    logger.error('[AdminNews] Failed to test feed:', error)
    return c.json(
      {
        error: 'Failed to test feed',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/news/feeds/:id/refresh - Force refresh a single feed
adminNewsRoutes.post('/feeds/:id/refresh', async (c) => {
  try {
    const id = c.req.param('id')
    const result = await getNewsService().refreshFeed(id)

    return c.json({ result })
  } catch (error) {
    logger.error('[AdminNews] Failed to refresh feed:', error)
    return c.json(
      {
        error: 'Failed to refresh feed',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/news/refresh-all - Refresh all enabled feeds
adminNewsRoutes.post('/refresh-all', async (c) => {
  try {
    logger.info('[AdminNews] Refreshing all enabled feeds...')

    const results = await getNewsService().refreshAllFeeds(true)

    const summary = {
      total: results.size,
      successful: 0,
      failed: 0,
      totalArticlesAdded: 0,
    }

    const feedResults: Record<string, any> = {}

    results.forEach((result, feedId) => {
      if (result.success) {
        summary.successful++
        summary.totalArticlesAdded += result.articlesAdded
      } else {
        summary.failed++
      }
      feedResults[result.feedName] = result
    })

    logger.info(`[AdminNews] Refresh complete: ${summary.successful}/${summary.total} feeds, +${summary.totalArticlesAdded} articles`)

    return c.json({
      summary,
      feedResults,
    })
  } catch (error) {
    logger.error('[AdminNews] Failed to refresh all feeds:', error)
    return c.json(
      {
        error: 'Failed to refresh all feeds',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/news/seed - Seed RSS feed sources
adminNewsRoutes.post('/seed', async (c) => {
  try {
    logger.info('[AdminNews] Seeding RSS feeds...')
    const count = await getNewsService().seedFeeds()

    return c.json({
      success: true,
      message: `Seeded ${count} RSS feeds`,
      count,
    })
  } catch (error) {
    logger.error('[AdminNews] Failed to seed feeds:', error)
    return c.json(
      {
        error: 'Failed to seed feeds',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/news/cleanup - Delete old articles
const cleanupSchema = z.object({
  hoursToKeep: z.coerce.number().min(1).max(168).default(6), // Default 6 hours, max 7 days
})

adminNewsRoutes.post('/cleanup', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { hoursToKeep } = cleanupSchema.parse(body)

    logger.info(`[AdminNews] Cleaning up articles older than ${hoursToKeep} hours...`)
    const deleted = await getNewsService().cleanupOldArticles(hoursToKeep)

    return c.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} articles older than ${hoursToKeep} hours`,
    })
  } catch (error) {
    logger.error('[AdminNews] Failed to cleanup old articles:', error)
    return c.json(
      {
        error: 'Failed to cleanup old articles',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

export { adminNewsRoutes }
