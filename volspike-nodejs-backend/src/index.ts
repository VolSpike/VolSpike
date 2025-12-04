import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { Server as SocketIOServer } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createLogger } from './lib/logger'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { authRoutes } from './routes/auth'
import { marketRoutes } from './routes/market'
import { watchlistRoutes } from './routes/watchlist'
import { alertRoutes } from './routes/alerts'
import volumeAlertsRouter from './routes/volume-alerts'
import { assetsRoutes } from './routes/assets'
import openInterestRouter from './routes/open-interest'
import { paymentRoutes } from './routes/payments'
import { adminRoutes } from './routes/admin'
import renewalRoutes from './routes/renewal'
import { runAssetRefreshCycle, retryRateLimitedAssets } from './services/asset-metadata'
import { setupSocketHandlers } from './websocket/handlers'
import { setSocketIO } from './services/alert-broadcaster'
import { checkAndSendRenewalReminders, checkAndDowngradeExpiredSubscriptions } from './services/renewal-reminder'
import { syncPendingPayments } from './services/payment-sync'
import { NewsService } from './services/news'
import type { AppBindings, AppVariables } from './types/hono'

// Initialize Prisma
export const prisma = new PrismaClient()

// Initialize logger
const logger = createLogger()

// ============================================
// DATABASE HEALTH CHECK & MIGRATION VERIFICATION
// ============================================

async function verifyDatabaseSchema() {
    try {
        // Check if crypto_payments table exists and has required columns
        const tableInfo = await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'crypto_payments'
        `.catch(() => [])

        if (tableInfo.length === 0) {
            logger.warn('⚠️ crypto_payments table not found - database migration may be required')
            logger.warn('💡 Run: npx prisma db push (or wait for automatic migration on next deployment)')
            return false
        }

        const requiredColumns = ['id', 'userId', 'invoiceId', 'orderId', 'paymentUrl', 'tier']
        const existingColumns = tableInfo.map(c => c.column_name)
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

        if (missingColumns.length > 0) {
            logger.warn('⚠️ crypto_payments table missing required columns:', missingColumns)
            logger.warn('💡 Database migration may be in progress or incomplete')
            return false
        }

        // Check for optional columns (expiresAt, renewalReminderSent)
        const hasExpiresAt = existingColumns.includes('expiresAt')
        const hasRenewalReminderSent = existingColumns.includes('renewalReminderSent')

        if (!hasExpiresAt || !hasRenewalReminderSent) {
            logger.info('ℹ️ crypto_payments table exists but missing optional columns (expiresAt, renewalReminderSent)')
            logger.info('ℹ️ Payment creation will use fallback mode until migration completes')
            return true // Table exists with required columns, optional columns can be added later
        }

        logger.info('✅ Database schema verified - all columns present')
        return true
    } catch (error) {
        logger.error('❌ Database schema verification failed:', {
            error: error instanceof Error ? error.message : String(error),
        })
        return false
    }
}

// Run schema verification on startup (non-blocking)
verifyDatabaseSchema().then((isHealthy) => {
    if (isHealthy) {
        logger.info('✅ Database ready')
    } else {
        logger.warn('⚠️ Database schema may need migration - payment creation will use fallback mode')
    }
}).catch((error) => {
    logger.error('❌ Database verification error:', error)
})

// Create Hono app
const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Global error handler
app.onError((err, c) => {
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: c.req.url,
    })
    return c.json({ error: 'Internal server error' }, 500)
})

// ============================================
// CORS CONFIGURATION
// ============================================

// Determine allowed origins based on environment
const getAllowedOrigins = (): string[] => {
    const origins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://volspike.com',
        'https://www.volspike.com',
        'https://vol-spike.vercel.app',
        'https://vol-spike-nikolaysitnikovs-projects.vercel.app'
    ]

    // In development, also allow localhost variants
    if (process.env.NODE_ENV === 'development') {
        origins.push(
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        )
    }

    return [...new Set(origins)] // Remove duplicates
}

// ============================================
// MIDDLEWARE - Order matters!
// ============================================

// 1. Logging (first, to log all requests)
app.use('*', honoLogger())

// 2. CORS (before routes, so preflight is handled)
app.use('*', cors({
    origin: getAllowedOrigins(),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'X-Wallet-Address',
        'X-Wallet-Nonce',  // ✅ Add custom header for SIWE nonce
        'X-API-Key',  // For volume alert ingestion from Digital Ocean
        'stripe-signature'  // ✅ Required for Stripe webhooks
    ],
    exposeHeaders: ['Content-Length', 'X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
}))

// Explicit OPTIONS handler for extra safety
// Use body(null, 204) since 204 is not a ContentfulStatusCode for c.text()
app.options('*', (c) => c.body(null, 204))

// ============================================
// ROUTES
// ============================================

// Health check - MUST be before other middleware that requires auth
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
    })
})

// API routes
app.route('/api/auth', authRoutes)

// Open Interest routes (GET is public, POST validates API key internally)
// MUST be before market auth middleware to avoid requiring auth for GET
app.route('/api/market/open-interest', openInterestRouter)
// Public asset manifest for logo + metadata (cached server-side, refreshed weekly)
app.route('/api/assets', assetsRoutes)

// Apply auth middleware to market routes
app.use('/api/market/*', authMiddleware)
app.route('/api/market', marketRoutes)

// Apply auth middleware to watchlist routes (require authentication)
app.use('/api/watchlist/*', authMiddleware)
app.route('/api/watchlist', watchlistRoutes)
app.route('/api/alerts', alertRoutes)
app.route('/api/volume-alerts', volumeAlertsRouter)

// Open Interest alerts routes
import { handleAlertIngest, handleGetAlerts } from './routes/open-interest'
const oiAlertsApp = new Hono()
oiAlertsApp.post('/ingest', handleAlertIngest) // API key protected (checked internally)
oiAlertsApp.use('/', authMiddleware) // Require auth for GET
oiAlertsApp.get('/', handleGetAlerts) // Admin only (checked internally)
app.route('/api/open-interest-alerts', oiAlertsApp)

// Apply auth middleware to payment routes (except webhook)
// Webhook must be publicly accessible for Stripe
app.use('/api/payments/*', async (c, next) => {
    // Skip auth for webhook endpoint
    if (c.req.path === '/api/payments/webhook' || c.req.path.endsWith('/webhook')) {
        return next()
    }
    // Apply auth middleware for all other payment routes
    return authMiddleware(c, next)
})
app.route('/api/payments', paymentRoutes)

// Admin routes (protected with admin middleware)
app.route('/api/admin', adminRoutes)

// Renewal routes (for cron jobs - API key protected)
app.route('/api/renewal', renewalRoutes)

// Protected routes (require authentication)
app.use('/api/protected/*', authMiddleware)
app.use('/api/protected/*', rateLimitMiddleware)

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404)
})

// Global error handler
app.onError((err, c) => {
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: c.req.path,
        method: c.req.method,
    })

    return c.json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        requestId: c.req.header('x-request-id') || 'unknown',
    }, 500)
})

// ============================================
// HTTP SERVER USING HONO'S serve()
// ============================================

const port = Number(process.env.PORT) || 3001
const host = '0.0.0.0'

const httpServer = serve({
    fetch: app.fetch,
    port,
    hostname: host,
}, (info) => {
    logger.info(`🚀 VolSpike Backend running on ${host}:${port}`)
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
    logger.info(`🌐 Allowed CORS origins: ${getAllowedOrigins().join(', ')}`)
    logger.info(`✅ Server ready to accept requests`)
})

// ============================================
// SOCKET.IO SETUP
// ============================================

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: getAllowedOrigins(),
        credentials: true,
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
})

logger.info('✅ Socket.IO attached to HTTP server')

// Initialize alert broadcaster with Socket.IO instance
setSocketIO(io)

// Setup Socket.IO handlers first
setupSocketHandlers(io, prisma, logger)

// Connection logging
io.on('connection', (socket) => {
    logger.info(`Socket.IO connected: ${socket.id}`)
    socket.on('disconnect', () => {
        logger.info(`Socket.IO disconnected: ${socket.id}`)
    })
})

// ============================================
// SOCKET.IO SETUP (IN-MEMORY ONLY)
// ============================================

logger.info('ℹ️  Using in-memory Socket.IO adapter')

// ============================================
// SCHEDULED TASKS - Renewal Reminders & Expiration Checks & Payment Sync
// ============================================

// Only run scheduled tasks in production (not in development to avoid conflicts)
// NOTE: Payment sync runs regardless of NODE_ENV to ensure users get upgraded immediately
if (process.env.ENABLE_SCHEDULED_TASKS !== 'false') {
    // Payment sync: Every 30 seconds (critical for real-time user upgrades)
    // Runs in both development and production to ensure immediate upgrades
    const PAYMENT_SYNC_INTERVAL = 30 * 1000 // 30 seconds in milliseconds

    setInterval(async () => {
        try {
            const result = await syncPendingPayments()
            if (result.synced > 0 || result.upgraded > 0) {
                logger.info(`✅ Payment sync completed: ${result.synced} synced, ${result.upgraded} users upgraded`)
            }
        } catch (error) {
            logger.error('❌ Scheduled payment sync failed:', error)
        }
    }, PAYMENT_SYNC_INTERVAL)

    // Renewal reminder check: Every 6 hours
    const RENEWAL_CHECK_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours in milliseconds

    setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled renewal reminder check')
            const result = await checkAndSendRenewalReminders()
            logger.info(`✅ Renewal reminder check completed: ${result.sent} reminders sent, ${result.checked} subscriptions checked`)
        } catch (error) {
            logger.error('❌ Scheduled renewal reminder check failed:', error)
        }
    }, RENEWAL_CHECK_INTERVAL)

    // Expired subscription check: Daily (every 24 hours)
    const EXPIRATION_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled expired subscription check')
            const result = await checkAndDowngradeExpiredSubscriptions()
            logger.info(`✅ Expired subscription check completed: ${result.downgraded} users downgraded, ${result.checked} subscriptions checked`)
        } catch (error) {
            logger.error('❌ Scheduled expired subscription check failed:', error)
        }
    }, EXPIRATION_CHECK_INTERVAL)

    // Automatic asset metadata refresh - runs continuously, processing all assets
    // Respects CoinGecko rate limits (3s gap between requests)
    const ASSET_REFRESH_INTERVAL = 60 * 60 * 1000 // Check every hour
    const assetRefreshEnabled = process.env.ENABLE_ASSET_ENRICHMENT?.toLowerCase() !== 'false'

    if (assetRefreshEnabled) {
        logger.info('✅ Automatic asset enrichment enabled (continuous processing mode)')

        // Run initial refresh cycle after 5 minutes (let server stabilize)
        setTimeout(async () => {
            try {
                logger.info('🔄 Running initial asset refresh cycle')
                await runAssetRefreshCycle('initial')
                logger.info('✅ Initial asset refresh cycle completed')
            } catch (error) {
                logger.error('❌ Initial asset refresh cycle failed:', error)
            }
        }, 5 * 60 * 1000) // 5 minutes

        // Schedule periodic refresh cycles (hourly check)
        setInterval(async () => {
            try {
                // Import getRefreshProgress dynamically to avoid circular dependencies
                const { getRefreshProgress } = await import('./services/asset-metadata')
                const progress = getRefreshProgress()

                // Only start new cycle if one isn't already running
                if (!progress.isRunning) {
                    // Check if there are Complete assets needing refresh (matches shouldRefresh logic)
                    // Complete assets only refresh if stale (>1 week), NOT if missing fields
                    // Missing fields check only applies to incomplete assets
                    const now = Date.now()
                    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

                    const assetsNeedingRefresh = await prisma.asset.findMany({
                        where: {
                            status: { not: 'HIDDEN' },
                            isComplete: true, // Only Complete assets
                            coingeckoId: { not: null }, // Must have CoinGecko ID
                            // Complete assets only refresh if stale (>1 week), not if missing fields
                            updatedAt: {
                                lt: oneWeekAgo, // Older than 1 week
                            },
                        },
                        take: 1,
                    })

                    if (assetsNeedingRefresh.length > 0) {
                        logger.info(`🔄 Running scheduled asset refresh cycle (Complete assets need refresh)`)
                        await runAssetRefreshCycle('scheduled')
                        logger.info('✅ Scheduled asset refresh cycle completed')
                    } else {
                        logger.debug('ℹ️ No Complete assets need refresh, skipping scheduled cycle')
                    }
                } else {
                    logger.info('ℹ️ Asset refresh cycle already running, skipping scheduled run')
                }
            } catch (error) {
                logger.error('❌ Scheduled asset refresh cycle failed:', error)
            }
        }, ASSET_REFRESH_INTERVAL)
    } else {
        logger.info('ℹ️ Asset metadata refresh disabled (ENABLE_ASSET_ENRICHMENT=false)')
    }

    // ============================================
    // RATE LIMIT RETRY CYCLE (for incomplete assets)
    // ============================================
    // Retry incomplete assets that failed due to rate limit errors
    // Runs every 30 minutes to give rate-limited assets another chance
    const RATE_LIMIT_RETRY_INTERVAL = 30 * 60 * 1000 // 30 minutes

    if (assetRefreshEnabled) {
        logger.info('✅ Rate limit retry cycle enabled (every 30 minutes)')

        // Run initial retry after 10 minutes (let initial enrichment attempts complete first)
        setTimeout(async () => {
            try {
                logger.info('🔄 Running initial rate limit retry cycle')
                await retryRateLimitedAssets()
                logger.info('✅ Initial rate limit retry cycle completed')
            } catch (error) {
                logger.error('❌ Initial rate limit retry cycle failed:', error)
            }
        }, 10 * 60 * 1000) // 10 minutes

        // Schedule periodic retry cycles (every 30 minutes)
        setInterval(async () => {
            try {
                // Import getRefreshProgress dynamically to avoid circular dependencies
                const { getRefreshProgress } = await import('./services/asset-metadata')
                const progress = getRefreshProgress()

                // Only retry if main refresh cycle isn't running (avoid conflicts)
                if (!progress.isRunning) {
                    logger.info('🔄 Running scheduled rate limit retry cycle')
                    await retryRateLimitedAssets()
                    logger.info('✅ Scheduled rate limit retry cycle completed')
                } else {
                    logger.debug('ℹ️ Main refresh cycle running, skipping rate limit retry')
                }
            } catch (error) {
                logger.error('❌ Scheduled rate limit retry cycle failed:', error)
            }
        }, RATE_LIMIT_RETRY_INTERVAL)
    }

    // Run initial checks after 2 minutes (to allow server and database to fully start)
    setTimeout(async () => {
        try {
            logger.info('🔄 Running initial payment sync')
            const paymentResult = await syncPendingPayments()
            logger.info(`✅ Initial payment sync completed: ${paymentResult.synced} synced, ${paymentResult.upgraded} users upgraded`)

            logger.info('🔄 Running initial renewal reminder check')
            const reminderResult = await checkAndSendRenewalReminders()
            logger.info(`✅ Initial renewal reminder check completed: ${reminderResult.sent} reminders sent, ${reminderResult.checked} subscriptions checked`)

            logger.info('🔄 Running initial expired subscription check')
            const expirationResult = await checkAndDowngradeExpiredSubscriptions()
            logger.info(`✅ Initial expired subscription check completed: ${expirationResult.downgraded} users downgraded, ${expirationResult.checked} subscriptions checked`)
        } catch (error) {
            logger.error('❌ Initial scheduled task check failed:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            })
        }
    }, 120000) // 2 minute delay to ensure database is ready

    // NOTE: Liquid universe classification job runs on Digital Ocean, NOT here
    // Per AGENTS.md: "Digital Ocean Script: ✅ ONLY place that uses Binance REST API"
    // The backend only receives updates via POST /api/market/open-interest/liquid-universe/update
    logger.info('ℹ️  Liquid universe classification runs on Digital Ocean (per AGENTS.md architecture)')

    // ============================================
    // RSS NEWS FEED - Refresh & Cleanup
    // ============================================
    // Refresh RSS feeds every 15 minutes and cleanup old articles (6 hour retention)
    const RSS_REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes
    const RSS_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
    const RSS_RETENTION_HOURS = 6 // Keep articles for 6 hours

    const newsService = new NewsService(prisma)

    // RSS feed refresh: Every 15 minutes
    setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled RSS feed refresh')
            const results = await newsService.refreshAllFeeds(true) // Only enabled feeds

            let successful = 0
            let failed = 0
            let articlesAdded = 0
            results.forEach((result) => {
                if (result.success) {
                    successful++
                    articlesAdded += result.articlesAdded
                } else {
                    failed++
                }
            })

            if (successful > 0 || articlesAdded > 0) {
                logger.info(`✅ RSS refresh completed: ${successful}/${results.size} feeds, +${articlesAdded} articles`)
            }
            if (failed > 0) {
                logger.warn(`⚠️ RSS refresh: ${failed} feeds failed`)
            }
        } catch (error) {
            logger.error('❌ Scheduled RSS feed refresh failed:', error)
        }
    }, RSS_REFRESH_INTERVAL)

    // RSS article cleanup: Every hour (delete articles older than 6 hours)
    setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled RSS article cleanup')
            const deleted = await newsService.cleanupOldArticles(RSS_RETENTION_HOURS)
            if (deleted > 0) {
                logger.info(`✅ RSS cleanup completed: deleted ${deleted} articles older than ${RSS_RETENTION_HOURS} hours`)
            }
        } catch (error) {
            logger.error('❌ Scheduled RSS article cleanup failed:', error)
        }
    }, RSS_CLEANUP_INTERVAL)

    // Run initial RSS feed refresh after 3 minutes (let server stabilize)
    setTimeout(async () => {
        try {
            // First, check if feeds exist and seed if needed
            const feeds = await newsService.getFeeds(true)
            if (feeds.length === 0) {
                logger.info('📰 No RSS feeds found, seeding default feeds...')
                const seededCount = await newsService.seedFeeds()
                logger.info(`✅ Seeded ${seededCount} RSS feeds`)
            }

            logger.info('🔄 Running initial RSS feed refresh')
            const results = await newsService.refreshAllFeeds(true)

            let successful = 0
            let articlesAdded = 0
            results.forEach((result) => {
                if (result.success) {
                    successful++
                    articlesAdded += result.articlesAdded
                }
            })

            logger.info(`✅ Initial RSS refresh completed: ${successful}/${results.size} feeds, +${articlesAdded} articles`)
        } catch (error) {
            logger.error('❌ Initial RSS feed refresh failed:', error)
        }
    }, 3 * 60 * 1000) // 3 minutes

    logger.info('✅ RSS feed scheduled tasks initialized (refresh every 15min, cleanup every hour, 6h retention)')

    logger.info('✅ Scheduled tasks initialized (payment sync every 30s, renewal reminders every 6h, expiration checks daily)')
} else {
    logger.info('ℹ️ Scheduled tasks disabled (set ENABLE_SCHEDULED_TASKS=true in production to enable)')
}

// ============================================
// ERROR HANDLERS
// ============================================

httpServer.on('error', (err) => {
    logger.error('Server error:', err)
    process.exit(1)
})

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async (signal: string) => {
    logger.info(`\n${signal} received, shutting down...`)

    io.close()

    await new Promise<void>((resolve) => {
        httpServer.close(() => {
            logger.info('HTTP server closed')
            resolve()
        })
    })

    await prisma.$disconnect()
    logger.info('Prisma disconnected')
    logger.info('Shutdown complete')
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Export io instance for broadcasting from routes
export { io }
export default app
// Trigger rebuild Wed Dec  3 22:04:47 EST 2025
