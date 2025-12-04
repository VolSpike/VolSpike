import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { User } from '../types'
import { getUser, requireUser } from '../lib/hono-extensions'

const logger = createLogger()

const alerts = new Hono()

// Validation schemas
const createAlertSchema = z.object({
    symbol: z.string().min(1),
    threshold: z.number().positive(),
    reason: z.string().min(1),
})

const updatePreferencesSchema = z.object({
    emailAlerts: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    telegramAlerts: z.boolean().optional(),
    discordAlerts: z.boolean().optional(),
    volumeThreshold: z.number().positive().optional(),
    minQuoteVolume: z.number().positive().optional(),
    refreshInterval: z.number().positive().optional(),
})

// Get user's alerts
alerts.get('/', async (c) => {
    try {
        const user = requireUser(c)
        const limit = parseInt(c.req.query('limit') || '50')
        const offset = parseInt(c.req.query('offset') || '0')

        const alerts = await prisma.alert.findMany({
            where: { userId: user.id },
            include: {
                contract: {
                    select: { symbol: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        })

        const total = await prisma.alert.count({
            where: { userId: user.id },
        })

        logger.info(`Alerts requested by ${user?.email}`)

        return c.json({
            alerts,
            total,
            limit,
            offset,
        })
    } catch (error) {
        logger.error('Get alerts error:', error)
        return c.json({ error: 'Failed to fetch alerts' }, 500)
    }
})

// Create new alert
alerts.post('/', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()
        const { symbol, threshold, reason } = createAlertSchema.parse(body)

        // Get or create contract
        let contract = await prisma.contract.findUnique({
            where: { symbol },
        })

        if (!contract) {
            contract = await prisma.contract.create({
                data: {
                    symbol,
                    precision: 2,
                },
            })
        }

        // Create alert
        const alert = await prisma.alert.create({
            data: {
                userId: user.id,
                contractId: contract.id,
                threshold,
                reason,
                triggeredValue: 0, // Will be updated when triggered
            },
            include: {
                contract: {
                    select: { symbol: true },
                },
            },
        })

        logger.info(`Alert created for ${symbol} by ${user?.email}`)

        return c.json(alert)
    } catch (error) {
        logger.error('Create alert error:', error)
        return c.json({ error: 'Failed to create alert' }, 500)
    }
})

// Get user's alert preferences
alerts.get('/preferences', async (c) => {
    try {
        const user = requireUser(c)

        let preferences = await prisma.preference.findUnique({
            where: { userId: user.id },
        })

        if (!preferences) {
            // Create default preferences
            preferences = await prisma.preference.create({
                data: {
                    userId: user.id,
                },
            })
        }

        logger.info(`Alert preferences requested by ${user?.email}`)

        return c.json(preferences)
    } catch (error) {
        logger.error('Get preferences error:', error)
        return c.json({ error: 'Failed to fetch preferences' }, 500)
    }
})

// Update alert preferences
alerts.put('/preferences', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()
        const data = updatePreferencesSchema.parse(body)

        const preferences = await prisma.preference.upsert({
            where: { userId: user.id },
            update: data,
            create: {
                userId: user.id,
                ...data,
            },
        })

        logger.info(`Alert preferences updated by ${user?.email}`)

        return c.json(preferences)
    } catch (error) {
        logger.error('Update preferences error:', error)
        return c.json({ error: 'Failed to update preferences' }, 500)
    }
})

// Delete alert
alerts.delete('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const alertId = c.req.param('id')

        const deleted = await prisma.alert.deleteMany({
            where: {
                id: alertId,
                userId: user.id,
            },
        })

        if (deleted.count === 0) {
            return c.json({ error: 'Alert not found' }, 404)
        }

        logger.info(`Alert ${alertId} deleted by ${user?.email}`)

        return c.json({ success: true })
    } catch (error) {
        logger.error('Delete alert error:', error)
        return c.json({ error: 'Failed to delete alert' }, 500)
    }
})

// Mark alert as delivered
alerts.put('/:id/delivered', async (c) => {
    try {
        const user = requireUser(c)
        const alertId = c.req.param('id')

        const updated = await prisma.alert.updateMany({
            where: {
                id: alertId,
                userId: user.id,
            },
            data: {
                isDelivered: true,
            },
        })

        if (updated.count === 0) {
            return c.json({ error: 'Alert not found' }, 404)
        }

        logger.info(`Alert ${alertId} marked as delivered by ${user?.email}`)

        return c.json({ success: true })
    } catch (error) {
        logger.error('Mark delivered error:', error)
        return c.json({ error: 'Failed to mark alert as delivered' }, 500)
    }
})

export { alerts as alertRoutes }
