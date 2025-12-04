import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'

const logger = createLogger()
const adminSubscriptionRoutes = new Hono()

// Validation schemas
const subscriptionListSchema = z.object({
    status: z.string().optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'updatedAt', 'email']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// GET /api/admin/subscriptions - List subscriptions
adminSubscriptionRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = subscriptionListSchema.parse(query)

        // Build where clause
        const where: any = {}

        if (params.tier) {
            where.tier = params.tier
        }

        // Get users with Stripe customer IDs
        if (params.status) {
            where.stripeCustomerId = { not: null }
        }

        // Get total count
        const total = await prisma.user.count({ where })

        // Get paginated results
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                tier: true,
                stripeCustomerId: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { [params.sortBy]: params.sortOrder },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
        })

        // For now, return basic subscription data
        const subscriptions = users.map(user => ({
            id: user.id,
            userId: user.id,
            userEmail: user.email,
            stripeCustomerId: user.stripeCustomerId || '',
            status: user.stripeCustomerId ? 'active' : 'none',
            tier: user.tier,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }))

        return c.json({
            subscriptions,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
        })
    } catch (error) {
        logger.error('List subscriptions error:', error)
        return c.json({ error: 'Failed to fetch subscriptions' }, 500)
    }
})

// GET /api/admin/subscriptions/:id - Get subscription details
adminSubscriptionRoutes.get('/:id', async (c) => {
    try {
        const subscriptionId = c.req.param('id')

        // For now, return mock data
        const user = await prisma.user.findFirst({
            where: { id: subscriptionId },
            select: {
                id: true,
                email: true,
                tier: true,
                stripeCustomerId: true,
            },
        })

        if (!user) {
            return c.json({ error: 'Subscription not found' }, 404)
        }

        return c.json({
            subscription: {
                id: user.id,
                userId: user.id,
                userEmail: user.email,
                stripeCustomerId: user.stripeCustomerId,
                status: 'active',
                tier: user.tier,
            },
            user,
        })
    } catch (error) {
        logger.error('Get subscription error:', error)
        return c.json({ error: 'Failed to fetch subscription' }, 500)
    }
})

// POST /api/admin/subscriptions/:userId/sync - Sync Stripe data
adminSubscriptionRoutes.post('/:userId/sync', async (c) => {
    try {
        const userId = c.req.param('userId')

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // For now, just return success
        // Implement actual Stripe sync later
        const adminUser = c.get('adminUser')
        logger.info(`Stripe sync requested for user ${userId} by admin ${adminUser?.email || 'unknown'}`)

        return c.json({
            success: true,
            message: 'Stripe sync would be performed (not implemented yet)',
            user,
        })
    } catch (error) {
        logger.error('Sync subscription error:', error)
        return c.json({ error: 'Failed to sync subscription' }, 500)
    }
})

// DELETE /api/admin/subscriptions/:userId/subscription - Cancel subscription
adminSubscriptionRoutes.delete('/:userId/subscription', async (c) => {
    try {
        const userId = c.req.param('userId')

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Update user to free tier
        await prisma.user.update({
            where: { id: userId },
            data: { tier: 'free' },
        })

        const adminUser = c.get('adminUser')
        logger.info(`Subscription cancelled for user ${userId} by admin ${adminUser?.email || 'unknown'}`)

        return c.json({
            success: true,
            message: 'Subscription cancelled successfully',
        })
    } catch (error) {
        logger.error('Cancel subscription error:', error)
        return c.json({ error: 'Failed to cancel subscription' }, 500)
    }
})

export { adminSubscriptionRoutes }
