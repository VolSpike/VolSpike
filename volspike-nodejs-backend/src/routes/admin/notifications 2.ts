import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const adminNotificationRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Schema for query parameters
const listSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(10),
    offset: z.coerce.number().min(0).default(0),
    unreadOnly: z.coerce.boolean().optional(),
})

// Schema for marking notifications as read
const markReadSchema = z.object({
    notificationIds: z.array(z.string()).optional(), // If empty, mark all as read
})

/**
 * GET /api/admin/notifications
 * Get notifications for the current admin user
 */
adminNotificationRoutes.get('/', async (c) => {
    try {
        const user = c.get('adminUser')
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const query = c.req.query()
        const params = listSchema.parse(query)

        const where: any = {
            userId: user.id,
        }

        // Filter by read status if requested
        if (params.unreadOnly) {
            where.isRead = false
        }

        // Get total count for pagination
        const total = await prisma.adminNotification.count({ where })

        // Get notifications ordered by newest first
        const notifications = await prisma.adminNotification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: params.limit,
            skip: params.offset,
        })

        return c.json({
            notifications,
            pagination: {
                total,
                limit: params.limit,
                offset: params.offset,
                hasMore: params.offset + params.limit < total,
            },
        })
    } catch (error) {
        logger.error('[AdminNotifications] List error:', {
            error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
            {
                error: 'Failed to fetch notifications',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

/**
 * GET /api/admin/notifications/unread-count
 * Get count of unread notifications
 */
adminNotificationRoutes.get('/unread-count', async (c) => {
    try {
        const user = c.get('adminUser')
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const count = await prisma.adminNotification.count({
            where: {
                userId: user.id,
                isRead: false,
            },
        })

        return c.json({ count })
    } catch (error) {
        logger.error('[AdminNotifications] Unread count error:', {
            error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
            {
                error: 'Failed to get unread count',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

/**
 * POST /api/admin/notifications/mark-read
 * Mark notifications as read
 */
adminNotificationRoutes.post('/mark-read', async (c) => {
    try {
        const user = c.get('adminUser')
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = await c.req.json()
        const data = markReadSchema.parse(body)

        const where: any = {
            userId: user.id,
            isRead: false, // Only update unread notifications
        }

        // If specific IDs provided, filter by them
        if (data.notificationIds && data.notificationIds.length > 0) {
            where.id = { in: data.notificationIds }
        }

        // Mark as read
        const result = await prisma.adminNotification.updateMany({
            where,
            data: {
                isRead: true,
                readAt: new Date(),
            },
        })

        return c.json({
            success: true,
            updated: result.count,
        })
    } catch (error) {
        logger.error('[AdminNotifications] Mark read error:', {
            error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
            {
                error: 'Failed to mark notifications as read',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

export { adminNotificationRoutes }

