import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { generateVolumeAlertCaption, generateOIAlertCaption } from '../../lib/caption-generator'
import { twitterService } from '../../services/twitter.service'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const socialMediaRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const createPostSchema = z.object({
  alertId: z.string().min(1),
  alertType: z.enum(['VOLUME', 'OPEN_INTEREST']),
  imageUrl: z.string().min(1),
  caption: z.string().max(280).optional(),
})

const updatePostSchema = z.object({
  caption: z.string().max(280).optional(),
  status: z.enum(['QUEUED', 'REJECTED']).optional(),
})

const getQueueSchema = z.object({
  status: z.enum(['QUEUED', 'POSTING', 'POSTED', 'FAILED', 'REJECTED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const getHistorySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(100),
  offset: z.coerce.number().min(0).default(0),
  symbol: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

/**
 * POST /api/admin/social-media/queue
 * Add an alert to the social media queue
 */
socialMediaRoutes.post('/queue', async (c) => {
  try {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const data = createPostSchema.parse(body)

    // Check if alert is currently in queue (QUEUED or POSTING)
    // Allow re-queueing alerts that were already POSTED or REJECTED
    const existing = await prisma.socialMediaPost.findFirst({
      where: {
        alertId: data.alertId,
        alertType: data.alertType,
        status: {
          in: ['QUEUED', 'POSTING'],
        },
      },
    })

    if (existing) {
      return c.json(
        {
          error: 'Alert is already in the queue',
          existingPost: existing,
        },
        409
      )
    }

    // Fetch the alert to generate caption if not provided
    let caption = data.caption
    if (!caption) {
      if (data.alertType === 'VOLUME') {
        const alert = await prisma.volumeAlert.findUnique({
          where: { id: data.alertId },
        })
        if (!alert) {
          return c.json({ error: 'Volume alert not found' }, 404)
        }
        caption = generateVolumeAlertCaption(alert)
      } else {
        const alert = await prisma.openInterestAlert.findUnique({
          where: { id: data.alertId },
        })
        if (!alert) {
          return c.json({ error: 'Open Interest alert not found' }, 404)
        }
        caption = generateOIAlertCaption(alert)
      }
    }

    // Create social media post
    const post = await prisma.socialMediaPost.create({
      data: {
        alertId: data.alertId,
        alertType: data.alertType,
        imageUrl: data.imageUrl,
        caption: caption,
        suggestedCaption: caption,
        status: 'QUEUED',
        createdById: user.id,
      },
    })

    logger.info('[SocialMedia] Post added to queue', {
      postId: post.id,
      alertId: data.alertId,
      alertType: data.alertType,
      userId: user.id,
    })

    return c.json({
      success: true,
      data: post,
    }, 201)
  } catch (error) {
    logger.error('[SocialMedia] Error adding to queue:', {
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        400
      )
    }

    return c.json(
      {
        error: 'Failed to add post to queue',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

/**
 * GET /api/admin/social-media/queue
 * Get queued social media posts
 */
socialMediaRoutes.get('/queue', async (c) => {
  try {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const query = c.req.query()
    const params = getQueueSchema.parse(query)

    const where: any = {}
    if (params.status) {
      where.status = params.status
    } else {
      // Default: only show QUEUED and FAILED statuses
      where.status = {
        in: ['QUEUED', 'FAILED'],
      }
    }

    // Get total count
    const total = await prisma.socialMediaPost.count({ where })

    // Get posts with alert data
    const posts = await prisma.socialMediaPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    })

    // Fetch related alerts
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        let alert: any = null
        if (post.alertType === 'VOLUME') {
          alert = await prisma.volumeAlert.findUnique({
            where: { id: post.alertId },
          })
        } else if (post.alertType === 'OPEN_INTEREST') {
          alert = await prisma.openInterestAlert.findUnique({
            where: { id: post.alertId },
          })
        }
        return {
          ...post,
          alert,
        }
      })
    )

    return c.json({
      success: true,
      data: enrichedPosts,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    })
  } catch (error) {
    logger.error('[SocialMedia] Error fetching queue:', {
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        error: 'Failed to fetch queue',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

/**
 * PATCH /api/admin/social-media/queue/:id
 * Update a queued post (caption or status)
 */
socialMediaRoutes.patch('/queue/:id', async (c) => {
  try {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const postId = c.req.param('id')
    const body = await c.req.json()
    const data = updatePostSchema.parse(body)

    // Check if post exists
    const existingPost = await prisma.socialMediaPost.findUnique({
      where: { id: postId },
    })

    if (!existingPost) {
      return c.json({ error: 'Post not found' }, 404)
    }

    // Update post
    const updatedPost = await prisma.socialMediaPost.update({
      where: { id: postId },
      data: {
        ...(data.caption && { caption: data.caption }),
        ...(data.status && { status: data.status }),
      },
    })

    logger.info('[SocialMedia] Post updated', {
      postId,
      userId: user.id,
      changes: data,
    })

    return c.json({
      success: true,
      data: updatedPost,
    })
  } catch (error) {
    logger.error('[SocialMedia] Error updating post:', {
      error: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        400
      )
    }

    return c.json(
      {
        error: 'Failed to update post',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

/**
 * POST /api/admin/social-media/post/:id
 * Post a queued item to Twitter
 */
socialMediaRoutes.post('/post/:id', async (c) => {
  try {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const postId = c.req.param('id')

    // Fetch post
    const post = await prisma.socialMediaPost.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return c.json({ error: 'Post not found' }, 404)
    }

    // Check status
    if (post.status === 'POSTED') {
      return c.json(
        {
          error: 'Post already published',
          twitterUrl: post.twitterUrl,
        },
        400
      )
    }

    if (post.status !== 'QUEUED' && post.status !== 'FAILED') {
      return c.json(
        {
          error: 'Post cannot be published in current status',
          status: post.status,
        },
        400
      )
    }

    // Check if Twitter service is configured
    if (!twitterService.isReady()) {
      return c.json(
        {
          error: 'Twitter API is not configured. Please contact administrator.',
        },
        503
      )
    }

    // Set status to POSTING
    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: { status: 'POSTING' },
    })

    try {
      // Post to Twitter
      const { tweetId, tweetUrl } = await twitterService.postTweetWithImage(
        post.caption,
        post.imageUrl || ''
      )

      // Update post with Twitter data
      const updatedPost = await prisma.socialMediaPost.update({
        where: { id: postId },
        data: {
          status: 'POSTED',
          twitterPostId: tweetId,
          twitterUrl: tweetUrl,
          postedById: user.id,
          postedAt: new Date(),
          errorMessage: null,
        },
      })

      logger.info('[SocialMedia] Post published to Twitter', {
        postId,
        tweetId,
        tweetUrl,
        userId: user.id,
      })

      return c.json({
        success: true,
        data: updatedPost,
      })
    } catch (twitterError: any) {
      // Update post with error
      const errorMessage = twitterError.message || 'Unknown Twitter API error'

      await prisma.socialMediaPost.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          errorMessage: errorMessage,
          retryCount: post.retryCount + 1,
        },
      })

      logger.error('[SocialMedia] Twitter API error:', {
        postId,
        error: errorMessage,
      })

      return c.json(
        {
          error: 'Failed to post to Twitter',
          details: errorMessage,
        },
        500
      )
    }
  } catch (error) {
    logger.error('[SocialMedia] Error posting to Twitter:', {
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        error: 'Failed to post to Twitter',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

/**
 * GET /api/admin/social-media/history
 * Get posting history (successfully posted tweets)
 */
socialMediaRoutes.get('/history', async (c) => {
  try {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const query = c.req.query()
    const params = getHistorySchema.parse(query)

    const where: any = {
      status: 'POSTED',
    }

    // Filter by date range if provided
    if (params.startDate || params.endDate) {
      where.postedAt = {}
      if (params.startDate) {
        where.postedAt.gte = new Date(params.startDate)
      }
      if (params.endDate) {
        where.postedAt.lte = new Date(params.endDate)
      }
    }

    // Get total count
    const total = await prisma.socialMediaPost.count({ where })

    // Get posts
    const posts = await prisma.socialMediaPost.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    })

    // Fetch related alerts and filter by symbol if requested
    let enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        let alert: any = null
        if (post.alertType === 'VOLUME') {
          alert = await prisma.volumeAlert.findUnique({
            where: { id: post.alertId },
          })
        } else if (post.alertType === 'OPEN_INTEREST') {
          alert = await prisma.openInterestAlert.findUnique({
            where: { id: post.alertId },
          })
        }
        return {
          ...post,
          alert,
        }
      })
    )

    // Filter by symbol if provided
    if (params.symbol) {
      enrichedPosts = enrichedPosts.filter(
        (post) => post.alert?.symbol?.toUpperCase() === params.symbol?.toUpperCase()
      )
    }

    return c.json({
      success: true,
      data: enrichedPosts,
      pagination: {
        total: params.symbol ? enrichedPosts.length : total,
        limit: params.limit,
        offset: params.offset,
      },
    })
  } catch (error) {
    logger.error('[SocialMedia] Error fetching history:', {
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        error: 'Failed to fetch history',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

export default socialMediaRoutes
