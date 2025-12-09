import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { broadcastUserAlert } from '../websocket/broadcast-user-alert'

const logger = createLogger()

const userCrossAlertsTrigger = new Hono()

// Validation schema for trigger endpoint
const triggerAlertSchema = z.object({
    alertId: z.string(),
    symbol: z.string(),
    currentValue: z.number(),
    previousValue: z.number(),
    crossedUp: z.boolean(),
    apiKey: z.string(),
})

// Trigger endpoint (called by Digital Ocean script)
userCrossAlertsTrigger.post('/trigger', async (c) => {
    try {
        const body = await c.req.json()
        const { alertId, symbol, currentValue, previousValue, crossedUp, apiKey } = triggerAlertSchema.parse(body)

        // Verify API key (same as volume alert ingest)
        const expectedApiKey = process.env.ALERT_INGEST_API_KEY
        if (!expectedApiKey || apiKey !== expectedApiKey) {
            logger.warn('Invalid API key for user alert trigger', { alertId, symbol })
            return c.json({ error: 'Unauthorized' }, 401)
        }

        // Fetch the alert
        const alert = await prisma.userCrossAlert.findUnique({
            where: { id: alertId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                    }
                }
            }
        })

        if (!alert) {
            logger.warn('Alert not found for trigger', { alertId, symbol })
            return c.json({ error: 'Alert not found' }, 404)
        }

        if (!alert.isActive) {
            logger.warn('Attempting to trigger inactive alert', { alertId, symbol })
            return c.json({ error: 'Alert is not active' }, 400)
        }

        // Mark alert as triggered and inactive
        const updatedAlert = await prisma.userCrossAlert.update({
            where: { id: alertId },
            data: {
                isActive: false,
                triggeredAt: new Date(),
                triggeredValue: currentValue,
                triggeredCount: { increment: 1 },
                lastCheckedValue: currentValue,
                lastCheckedAt: new Date(),
            },
        })

        // Broadcast to user via Socket.IO and optionally send email
        await broadcastUserAlert({
            userId: alert.userId,
            alertId: alert.id,
            symbol: alert.symbol,
            alertType: alert.alertType as any,
            threshold: alert.threshold,
            currentValue,
            previousValue,
            crossedUp,
            deliveryMethod: alert.deliveryMethod as any,
            userEmail: alert.user.email,
        })

        logger.info('User alert triggered successfully', {
            alertId,
            userId: alert.userId,
            symbol,
            alertType: alert.alertType,
            threshold: alert.threshold,
            currentValue,
            crossedUp,
        })

        return c.json({
            success: true,
            alert: updatedAlert,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid request data', details: error.errors }, 400)
        }
        logger.error('Trigger user alert error:', error)
        return c.json({ error: 'Failed to trigger alert' }, 500)
    }
})

// Endpoint to fetch active alerts for checking (called by Digital Ocean script)
userCrossAlertsTrigger.get('/active', async (c) => {
    try {
        const apiKey = c.req.query('apiKey')

        // Verify API key
        const expectedApiKey = process.env.ALERT_INGEST_API_KEY
        if (!expectedApiKey || apiKey !== expectedApiKey) {
            logger.warn('Invalid API key for fetching active alerts')
            return c.json({ error: 'Unauthorized' }, 401)
        }

        // Fetch all active alerts with user tier
        const alerts = await prisma.userCrossAlert.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                userId: true,
                symbol: true,
                alertType: true,
                threshold: true,
                lastCheckedValue: true,
                lastCheckedAt: true,
                deliveryMethod: true,
                user: {
                    select: {
                        tier: true,
                    }
                }
            },
            orderBy: {
                lastCheckedAt: 'asc', // Check oldest first
            },
        })

        // Flatten user tier into alert object
        const alertsWithTier = alerts.map(alert => ({
            ...alert,
            userTier: alert.user.tier,
            user: undefined, // Remove nested user object
        }))

        logger.info('Active alerts fetched for checking', {
            count: alertsWithTier.length,
        })

        return c.json({ alerts: alertsWithTier })
    } catch (error) {
        logger.error('Fetch active alerts error:', error)
        return c.json({ error: 'Failed to fetch active alerts' }, 500)
    }
})

// Update last checked value (called by Digital Ocean script after each check)
userCrossAlertsTrigger.post('/update-checked', async (c) => {
    try {
        const body = await c.req.json()
        const schema = z.object({
            alertId: z.string(),
            lastCheckedValue: z.number(),
            apiKey: z.string(),
        })
        const { alertId, lastCheckedValue, apiKey } = schema.parse(body)

        // Verify API key
        const expectedApiKey = process.env.ALERT_INGEST_API_KEY
        if (!expectedApiKey || apiKey !== expectedApiKey) {
            logger.warn('Invalid API key for updating checked value')
            return c.json({ error: 'Unauthorized' }, 401)
        }

        await prisma.userCrossAlert.update({
            where: { id: alertId },
            data: {
                lastCheckedValue,
                lastCheckedAt: new Date(),
            },
        })

        return c.json({ success: true })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid request data', details: error.errors }, 400)
        }
        logger.error('Update checked value error:', error)
        return c.json({ error: 'Failed to update checked value' }, 500)
    }
})

export { userCrossAlertsTrigger as userCrossAlertTriggerRoutes }
