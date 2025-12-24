import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { getUser, requireUser } from '../lib/hono-extensions'
import { broadcastUserAlert } from '../websocket/broadcast-user-alert'

const logger = createLogger()

const userCrossAlerts = new Hono()

// Validation schemas
const createCrossAlertSchema = z.object({
    symbol: z.string().min(1).toUpperCase(),
    alertType: z.enum(['PRICE_CROSS', 'FUNDING_CROSS', 'OI_CROSS']),
    threshold: z.number().positive(),
    deliveryMethod: z.enum(['DASHBOARD', 'EMAIL', 'BOTH']).optional().default('DASHBOARD'),
    lastCheckedValue: z.number().finite().optional(),
})

const updateCrossAlertSchema = z.object({
    threshold: z.number().positive().optional(),
    deliveryMethod: z.enum(['DASHBOARD', 'EMAIL', 'BOTH']).optional(),
    isActive: z.boolean().optional(),
})

// Get user's cross alerts
userCrossAlerts.get('/', async (c) => {
    try {
        const user = requireUser(c)
        const active = c.req.query('active')
        const symbol = c.req.query('symbol')

        const where: any = { userId: user.id }

        if (active === 'true') {
            where.isActive = true
        } else if (active === 'false') {
            where.isActive = false
        }

        if (symbol) {
            where.symbol = symbol.toUpperCase()
        }

        const alerts = await prisma.userCrossAlert.findMany({
            where,
            orderBy: [
                { isActive: 'desc' },
                { createdAt: 'desc' }
            ],
        })

        logger.info(`Cross alerts requested by ${user?.email}`, {
            userId: user.id,
            count: alerts.length,
            filters: { active, symbol }
        })

        return c.json({ alerts })
    } catch (error) {
        logger.error('Get cross alerts error:', error)
        return c.json({ error: 'Failed to fetch cross alerts' }, 500)
    }
})

// Create new cross alert
userCrossAlerts.post('/', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()
        const { symbol, alertType, threshold, deliveryMethod, lastCheckedValue } = createCrossAlertSchema.parse(body)

        // Check tier limits
        const userTier = user.tier || 'free'
        const activeAlerts = await prisma.userCrossAlert.count({
            where: {
                userId: user.id,
                isActive: true,
            }
        })

        const tierLimits: Record<string, number> = {
            free: 3,
            pro: 10,
            elite: 999999, // Unlimited
        }

        const limit = tierLimits[userTier] || tierLimits.free
        if (activeAlerts >= limit) {
            return c.json({
                error: `Maximum active alerts reached for ${userTier} tier (${limit})`,
                limit,
                current: activeAlerts,
            }, 403)
        }

        // Check if email delivery is allowed for tier
        if ((deliveryMethod === 'EMAIL' || deliveryMethod === 'BOTH') && userTier === 'free') {
            return c.json({
                error: 'Email delivery requires Pro or Elite tier',
            }, 403)
        }

        // Create alert
        const alert = await prisma.userCrossAlert.create({
            data: {
                userId: user.id,
                symbol,
                alertType,
                threshold,
                deliveryMethod: deliveryMethod || 'DASHBOARD',
                lastCheckedValue,
                lastCheckedAt: lastCheckedValue !== undefined ? new Date() : undefined,
            },
        })

        logger.info(`Cross alert created`, {
            alertId: alert.id,
            userId: user.id,
            email: user?.email,
            symbol,
            alertType,
            threshold,
        })

        return c.json(alert, 201)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid request data', details: error.errors }, 400)
        }
        logger.error('Create cross alert error:', error)
        return c.json({ error: 'Failed to create alert' }, 500)
    }
})

// Update cross alert
userCrossAlerts.put('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const alertId = c.req.param('id')
        const body = await c.req.json()
        const data = updateCrossAlertSchema.parse(body)

        // Check ownership
        const existing = await prisma.userCrossAlert.findFirst({
            where: {
                id: alertId,
                userId: user.id,
            }
        })

        if (!existing) {
            return c.json({ error: 'Alert not found' }, 404)
        }

        // Check email delivery tier restriction
        const userTier = user.tier || 'free'
        if (data.deliveryMethod && (data.deliveryMethod === 'EMAIL' || data.deliveryMethod === 'BOTH') && userTier === 'free') {
            return c.json({
                error: 'Email delivery requires Pro or Elite tier',
            }, 403)
        }

        const alert = await prisma.userCrossAlert.update({
            where: { id: alertId },
            data,
        })

        logger.info(`Cross alert updated`, {
            alertId,
            userId: user.id,
            email: user?.email,
            updates: data,
        })

        return c.json(alert)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid request data', details: error.errors }, 400)
        }
        logger.error('Update cross alert error:', error)
        return c.json({ error: 'Failed to update alert' }, 500)
    }
})

// Delete cross alert
userCrossAlerts.delete('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const alertId = c.req.param('id')

        const deleted = await prisma.userCrossAlert.deleteMany({
            where: {
                id: alertId,
                userId: user.id,
            },
        })

        if (deleted.count === 0) {
            return c.json({ error: 'Alert not found' }, 404)
        }

        logger.info(`Cross alert deleted`, {
            alertId,
            userId: user.id,
            email: user?.email,
        })

        return c.json({ success: true })
    } catch (error) {
        logger.error('Delete cross alert error:', error)
        return c.json({ error: 'Failed to delete alert' }, 500)
    }
})

// Reactivate cross alert (set isActive = true)
userCrossAlerts.post('/:id/reactivate', async (c) => {
    try {
        const user = requireUser(c)
        const alertId = c.req.param('id')

        // Check ownership
        const existing = await prisma.userCrossAlert.findFirst({
            where: {
                id: alertId,
                userId: user.id,
            }
        })

        if (!existing) {
            return c.json({ error: 'Alert not found' }, 404)
        }

        // Check tier limits for active alerts
        const userTier = user.tier || 'free'
        const activeAlerts = await prisma.userCrossAlert.count({
            where: {
                userId: user.id,
                isActive: true,
            }
        })

        const tierLimits: Record<string, number> = {
            free: 3,
            pro: 10,
            elite: 999999,
        }

        const limit = tierLimits[userTier] || tierLimits.free
        if (activeAlerts >= limit) {
            return c.json({
                error: `Maximum active alerts reached for ${userTier} tier (${limit})`,
                limit,
                current: activeAlerts,
            }, 403)
        }

        const alert = await prisma.userCrossAlert.update({
            where: { id: alertId },
            data: {
                isActive: true,
                triggeredAt: null,
                triggeredValue: null,
            },
        })

        logger.info(`Cross alert reactivated`, {
            alertId,
            userId: user.id,
            email: user?.email,
        })

        return c.json(alert)
    } catch (error) {
        logger.error('Reactivate cross alert error:', error)
        return c.json({ error: 'Failed to reactivate alert' }, 500)
    }
})

export { userCrossAlerts as userCrossAlertRoutes }
