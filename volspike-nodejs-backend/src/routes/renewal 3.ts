import { Hono } from 'hono'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { checkAndSendRenewalReminders, checkAndDowngradeExpiredSubscriptions } from '../services/renewal-reminder'

const logger = createLogger()
const renewal = new Hono()

/**
 * Manual endpoint to trigger renewal reminder check
 * Can be called via cron job (e.g., Railway cron, external cron service)
 * Recommended: Run every 6 hours
 */
renewal.post('/check-reminders', async (c) => {
    try {
        // Optional: Add API key authentication for security
        const apiKey = c.req.header('X-API-Key')
        const expectedKey = process.env.RENEWAL_API_KEY || process.env.ALERT_INGEST_API_KEY
        
        if (expectedKey && apiKey !== expectedKey) {
            logger.warn('Unauthorized renewal reminder check attempt', {
                hasApiKey: !!apiKey,
                hasExpectedKey: !!expectedKey,
            })
            return c.json({ error: 'Unauthorized' }, 401)
        }

        logger.info('Starting renewal reminder check')
        const result = await checkAndSendRenewalReminders()
        
        return c.json({
            success: true,
            checked: result.checked,
            remindersSent: result.sent,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        logger.error('Renewal reminder check error:', error)
        return c.json({ 
            error: 'Failed to check renewal reminders',
            message: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

/**
 * Manual endpoint to trigger expired subscription check
 * Can be called via cron job
 * Recommended: Run daily
 */
renewal.post('/check-expired', async (c) => {
    try {
        // Optional: Add API key authentication for security
        const apiKey = c.req.header('X-API-Key')
        const expectedKey = process.env.RENEWAL_API_KEY || process.env.ALERT_INGEST_API_KEY
        
        if (expectedKey && apiKey !== expectedKey) {
            logger.warn('Unauthorized expired subscription check attempt', {
                hasApiKey: !!apiKey,
                hasExpectedKey: !!expectedKey,
            })
            return c.json({ error: 'Unauthorized' }, 401)
        }

        logger.info('Starting expired subscription check')
        const result = await checkAndDowngradeExpiredSubscriptions()
        
        return c.json({
            success: true,
            checked: result.checked,
            downgraded: result.downgraded,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        logger.error('Expired subscription check error:', error)
        return c.json({ 
            error: 'Failed to check expired subscriptions',
            message: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

export default renewal

