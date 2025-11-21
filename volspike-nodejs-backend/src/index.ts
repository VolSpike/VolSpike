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
import { runAssetRefreshCycle } from './services/asset-metadata'
import { setupSocketHandlers } from './websocket/handlers'
import { setSocketIO } from './services/alert-broadcaster'
import { checkAndSendRenewalReminders, checkAndDowngradeExpiredSubscriptions } from './services/renewal-reminder'
import { syncPendingPayments } from './services/payment-sync'
import type { AppBindings, AppVariables } from './types/hono'

// Initialize logger first for immediate debugging
const logger = createLogger()

logger.info('🚀 VolSpike Backend starting...')
logger.info(`📅 Started at: ${new Date().toISOString()}`)
logger.info(`🌍 Node version: ${process.version}`)
logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`)

// Initialize Prisma
export const prisma = new PrismaClient()

logger.info('✅ Prisma client initialized')

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

app.route('/api/watchlist', watchlistRoutes)
app.route('/api/alerts', alertRoutes)
app.route('/api/volume-alerts', volumeAlertsRouter)

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

logger.info('🔧 Starting HTTP server...')
logger.info(`📌 Port: ${port}, Host: ${host}`)
logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)

let httpServer: ReturnType<typeof serve>

try {
    httpServer = serve({
        fetch: app.fetch,
        port,
        hostname: host,
    }, (info) => {
        logger.info(`🚀 VolSpike Backend running on ${host}:${port}`)
        logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
        logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
        logger.info(`🌐 Allowed CORS origins: ${getAllowedOrigins().join(', ')}`)
        logger.info(`✅ Server ready to accept requests`)
        logger.info(`🔍 Server info:`, JSON.stringify(info, null, 2))
    })

    logger.info('✅ HTTP server instance created successfully')
} catch (error) {
    logger.error('❌ Failed to start HTTP server:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    })
    process.exit(1)
}

// ============================================
// SOCKET.IO SETUP
// ============================================

logger.info('🔧 Initializing Socket.IO server...')

// Declare io at module level to ensure it's available throughout
let io: SocketIOServer

try {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: getAllowedOrigins(),
            credentials: true,
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
    })

    logger.info('✅ Socket.IO attached to HTTP server')

    // Initialize alert broadcaster with Socket.IO instance
    try {
        setSocketIO(io)
        logger.info('✅ Alert broadcaster initialized')
    } catch (error) {
        logger.error('❌ Failed to initialize alert broadcaster:', {
            error: error instanceof Error ? error.message : String(error),
        })
    }

    // Setup Socket.IO handlers first
    try {
        setupSocketHandlers(io, prisma, logger)
        logger.info('✅ Socket.IO handlers setup complete')
    } catch (error) {
        logger.error('❌ Failed to setup Socket.IO handlers:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
    }

    // Connection logging
    try {
        io.on('connection', (socket) => {
            logger.info(`Socket.IO connected: ${socket.id}`)
            socket.on('disconnect', () => {
                logger.info(`Socket.IO disconnected: ${socket.id}`)
            })
        })
        logger.info('✅ Socket.IO connection handlers registered')
    } catch (error) {
        logger.error('❌ Failed to register Socket.IO connection handlers:', {
            error: error instanceof Error ? error.message : String(error),
        })
    }
} catch (error) {
    logger.error('❌ Failed to initialize Socket.IO:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    })
    // Create a dummy Socket.IO instance to prevent crashes
    // This should never happen, but we need to satisfy TypeScript
    io = {} as SocketIOServer
    logger.warn('⚠️ Socket.IO initialization failed - server will continue without Socket.IO')
}

// ============================================
// SOCKET.IO SETUP (IN-MEMORY ONLY)
// ============================================

logger.info('ℹ️  Using in-memory Socket.IO adapter')

// ============================================
// SCHEDULED TASKS - Renewal Reminders & Expiration Checks & Payment Sync
// ============================================

// Track all scheduled intervals and timeouts for graceful shutdown
const scheduledTimers: NodeJS.Timeout[] = []

logger.info('🔧 Initializing scheduled tasks...')
logger.info(`📊 ENABLE_SCHEDULED_TASKS: ${process.env.ENABLE_SCHEDULED_TASKS}`)

// Only run scheduled tasks in production (not in development to avoid conflicts)
// NOTE: Payment sync runs regardless of NODE_ENV to ensure users get upgraded immediately
if (process.env.ENABLE_SCHEDULED_TASKS !== 'false') {
    logger.info('✅ Scheduled tasks enabled - initializing timers...')
    // Payment sync: Every 30 seconds (critical for real-time user upgrades)
    // Runs in both development and production to ensure immediate upgrades
    const PAYMENT_SYNC_INTERVAL = 30 * 1000 // 30 seconds in milliseconds

    const paymentSyncTimer = setInterval(async () => {
        try {
            const result = await syncPendingPayments()
            if (result.synced > 0 || result.upgraded > 0) {
                logger.info(`✅ Payment sync completed: ${result.synced} synced, ${result.upgraded} users upgraded`)
            }
        } catch (error) {
            logger.error('❌ Scheduled payment sync failed:', error)
        }
    }, PAYMENT_SYNC_INTERVAL)

    scheduledTimers.push(paymentSyncTimer)
    logger.info(`✅ Payment sync timer registered (interval: ${PAYMENT_SYNC_INTERVAL}ms)`)

    // Renewal reminder check: Every 6 hours
    const RENEWAL_CHECK_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours in milliseconds

    const renewalCheckTimer = setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled renewal reminder check')
            const result = await checkAndSendRenewalReminders()
            logger.info(`✅ Renewal reminder check completed: ${result.sent} reminders sent, ${result.checked} subscriptions checked`)
        } catch (error) {
            logger.error('❌ Scheduled renewal reminder check failed:', error)
        }
    }, RENEWAL_CHECK_INTERVAL)

    scheduledTimers.push(renewalCheckTimer)
    logger.info(`✅ Renewal reminder timer registered (interval: ${RENEWAL_CHECK_INTERVAL}ms)`)

    // Expired subscription check: Daily (every 24 hours)
    const EXPIRATION_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    const expirationCheckTimer = setInterval(async () => {
        try {
            logger.info('🔄 Running scheduled expired subscription check')
            const result = await checkAndDowngradeExpiredSubscriptions()
            logger.info(`✅ Expired subscription check completed: ${result.downgraded} users downgraded, ${result.checked} subscriptions checked`)
        } catch (error) {
            logger.error('❌ Scheduled expired subscription check failed:', error)
        }
    }, EXPIRATION_CHECK_INTERVAL)

    scheduledTimers.push(expirationCheckTimer)
    logger.info(`✅ Expiration check timer registered (interval: ${EXPIRATION_CHECK_INTERVAL}ms)`)

    // Adaptive asset metadata refresh with smart intervals
    const ASSET_REFRESH_INTERVAL_BULK = 10 * 60 * 1000 // 10 minutes (bulk mode: >20 assets need refresh)
    const ASSET_REFRESH_INTERVAL_MAINTENANCE = 60 * 60 * 1000 // 1 hour (maintenance mode: <20 assets need refresh)
    const assetRefreshEnabled = process.env.ENABLE_ASSET_ENRICHMENT?.toLowerCase() !== 'false'

    // Automatic asset enrichment - runs periodically to enrich assets with CoinGecko data
    if (assetRefreshEnabled) {
        logger.info('✅ Automatic asset enrichment enabled')

        // Adaptive enrichment cycle that runs periodically
        const runEnrichmentCycle = async () => {
            try {
                logger.info('[AssetEnrichment] 🔄 Starting enrichment cycle...')
                const result = await runAssetRefreshCycle('scheduled')

                if (result.refreshed > 0) {
                    logger.info(`[AssetEnrichment] ✅ Enriched ${result.refreshed} assets (${result.remaining || 0} remaining)`)
                } else if (result.needsRefreshCount === 0) {
                    logger.info('[AssetEnrichment] ✅ All assets are up to date')
                } else {
                    logger.info(`[AssetEnrichment] ℹ️ No assets refreshed this cycle (${result.needsRefreshCount} still need refresh)`)
                }

                return result
            } catch (error) {
                logger.error('[AssetEnrichment] ❌ Enrichment cycle failed:', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                })
                return null
            }
        }

        // Helper function to start periodic enrichment (defined before use)
        const startPeriodicEnrichment = async () => {
            try {
                // Check how many assets need refresh
                const assets = await prisma.asset.findMany({
                    select: { logoUrl: true, displayName: true, coingeckoId: true, updatedAt: true },
                })

                const now = Date.now()
                const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
                const needsRefresh = assets.filter(asset => {
                    if (!asset.logoUrl || !asset.displayName || !asset.coingeckoId) return true
                    const updatedAt = asset.updatedAt?.getTime() ?? Date.now()
                    return now - updatedAt > REFRESH_INTERVAL_MS
                }).length

                const enriched = assets.filter(a => a.logoUrl && a.displayName && a.coingeckoId).length
                const enrichmentPercentage = assets.length > 0 ? Math.round((enriched / assets.length) * 100) : 0

                logger.info(`[AssetEnrichment] 📊 Enrichment status: ${enriched}/${assets.length} enriched (${enrichmentPercentage}%), ${needsRefresh} need refresh`)

                // Run first enrichment cycle immediately if assets need refresh (non-blocking)
                if (needsRefresh > 0) {
                    logger.info(`[AssetEnrichment] 🎨 Starting automatic enrichment for ${needsRefresh} assets...`)
                    // Don't await - let it run in background
                    runEnrichmentCycle().catch(err => {
                        logger.error('[AssetEnrichment] ❌ Initial enrichment cycle failed:', err)
                    })
                } else {
                    logger.info('[AssetEnrichment] ✅ All assets are enriched')
                }

                // Schedule periodic enrichment with adaptive intervals
                // Use bulk mode interval if many assets need refresh, otherwise maintenance mode
                const enrichmentInterval = needsRefresh > 20
                    ? ASSET_REFRESH_INTERVAL_BULK
                    : ASSET_REFRESH_INTERVAL_MAINTENANCE

                const enrichmentTimer = setInterval(async () => {
                    try {
                        const result = await runEnrichmentCycle()
                        // Log progress
                        if (result && result.needsRefreshCount > 20) {
                            logger.info(`[AssetEnrichment] ⚡ ${result.needsRefreshCount} assets need refresh - continuing bulk mode`)
                        }
                    } catch (err) {
                        logger.error('[AssetEnrichment] ❌ Periodic enrichment cycle failed:', err)
                    }
                }, enrichmentInterval)

                scheduledTimers.push(enrichmentTimer)
                logger.info(`[AssetEnrichment] ⏰ Scheduled periodic enrichment every ${enrichmentInterval / 1000 / 60} minutes`)
            } catch (error) {
                logger.error('[AssetEnrichment] ❌ Failed to start periodic enrichment:', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                })
            }
        }

        // Run initial enrichment check after 2 minutes (to allow server and database to fully start)
        // Use setTimeout with proper error handling - don't block server startup
        const initialEnrichmentTimeout = setTimeout(async () => {
            try {
                logger.info('[AssetEnrichment] 🚀 Running initial enrichment check...')
                
                // Check asset count with timeout protection
                let assetCount = 0
                try {
                    assetCount = await Promise.race([
                        prisma.asset.count(),
                        new Promise<number>((_, reject) => 
                            setTimeout(() => reject(new Error('Database query timeout')), 10000)
                        )
                    ]) as number
                } catch (dbError) {
                    logger.warn('[AssetEnrichment] ⚠️ Database query failed during initial check:', {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                    })
                    // Schedule retry later
                    const retryTimer = setTimeout(() => {
                        runEnrichmentCycle().catch(err => {
                            logger.error('[AssetEnrichment] ❌ Retry enrichment cycle failed:', err)
                        })
                    }, ASSET_REFRESH_INTERVAL_MAINTENANCE)
                    scheduledTimers.push(retryTimer)
                    return
                }

                if (assetCount === 0) {
                    logger.info('[AssetEnrichment] ℹ️ No assets in database yet - enrichment will start after assets are synced')
                    // Schedule a check every hour until assets are available
                    // Use a proper interval that can be tracked and cleared
                    let checkTimer: NodeJS.Timeout | null = null
                    const scheduleCheck = () => {
                        checkTimer = setInterval(async () => {
                            try {
                                const count = await prisma.asset.count()
                                if (count > 0 && checkTimer) {
                                    clearInterval(checkTimer)
                                    checkTimer = null
                                    logger.info(`[AssetEnrichment] 🎨 Assets detected (${count} total) - starting enrichment`)
                                    // Start enrichment cycle and schedule periodic runs
                                    await startPeriodicEnrichment()
                                }
                            } catch (err) {
                                logger.warn('[AssetEnrichment] ⚠️ Error checking for assets:', err)
                            }
                        }, ASSET_REFRESH_INTERVAL_MAINTENANCE)
                        if (checkTimer) {
                            scheduledTimers.push(checkTimer)
                        }
                    }
                    scheduleCheck()
                    return
                }

                // Start periodic enrichment
                await startPeriodicEnrichment()
            } catch (error) {
                logger.error('[AssetEnrichment] ❌ Initial enrichment check failed:', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                })
                // Schedule retry in maintenance interval
                const retryTimer = setTimeout(async () => {
                    try {
                        await runEnrichmentCycle()
                        await startPeriodicEnrichment()
                    } catch (err) {
                        logger.error('[AssetEnrichment] ❌ Retry failed:', err)
                    }
                }, ASSET_REFRESH_INTERVAL_MAINTENANCE)
                scheduledTimers.push(retryTimer)
            }
        }, 120000) // 2 minute delay to ensure database is ready
        
        scheduledTimers.push(initialEnrichmentTimeout)

        logger.info('✅ Automatic asset enrichment scheduled (adaptive intervals based on workload)')
    } else {
        logger.info('ℹ️ Asset metadata refresh disabled (set ENABLE_ASSET_ENRICHMENT=true to enable)')
        logger.info('💡 Use "Run Cycle" button in admin panel to enrich assets manually')
    }

    // Run initial checks after 2 minutes (to allow server and database to fully start)
    const initialCheckTimeout = setTimeout(async () => {
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

    scheduledTimers.push(initialCheckTimeout)
    logger.info(`✅ Initial check timeout registered (delay: 120000ms)`)

    logger.info(`✅ Scheduled tasks initialized (${scheduledTimers.length} timers total)`)
    logger.info('📋 Timer breakdown: payment sync every 30s, renewal reminders every 6h, expiration checks daily')
} else {
    logger.info('ℹ️ Scheduled tasks disabled (set ENABLE_SCHEDULED_TASKS=true in production to enable)')
}

// ============================================
// ERROR HANDLERS
// ============================================

// Add error handlers if httpServer is a proper Node.js server
if (httpServer && typeof httpServer.on === 'function') {
    httpServer.on('error', (err) => {
        logger.error('❌ HTTP server error:', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        })
        process.exit(1)
    })

    httpServer.on('listening', () => {
        logger.info('✅ HTTP server is listening and ready')
    })

    logger.info('✅ HTTP server error handlers registered')
} else {
    logger.warn('⚠️ HTTP server instance may not support event handlers')
}

// Global unhandled error handlers
process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', {
        error: error.message,
        stack: error.stack,
    })
    // Don't exit immediately - allow graceful shutdown
})

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection:', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    })
    // Don't exit immediately - allow graceful shutdown
})

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async (signal: string) => {
    logger.info(`\n🛑 ${signal} received, initiating graceful shutdown...`)

    // Clear all scheduled timers (intervals and timeouts) to allow graceful shutdown
    logger.info(`🧹 Clearing ${scheduledTimers.length} scheduled timers...`)
    let clearedCount = 0
    scheduledTimers.forEach((timer: NodeJS.Timeout) => {
        try {
            clearInterval(timer)
            clearTimeout(timer)
            clearedCount++
        } catch (error) {
            logger.warn('⚠️ Error clearing timer:', error)
        }
    })
    logger.info(`✅ Cleared ${clearedCount}/${scheduledTimers.length} timers`)

    // Close Socket.IO
    try {
        if (io && typeof io.close === 'function') {
            io.close()
            logger.info('✅ Socket.IO closed')
        } else {
            logger.info('ℹ️ Socket.IO not initialized, skipping close')
        }
    } catch (error) {
        logger.warn('⚠️ Error closing Socket.IO:', error)
    }

    // Close HTTP server
    try {
        if (httpServer && typeof httpServer.close === 'function') {
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    logger.warn('⚠️ Server close timeout, forcing exit')
                    resolve()
                }, 5000) // 5 second timeout

                httpServer.close(() => {
                    clearTimeout(timeout)
                    logger.info('✅ HTTP server closed')
                    resolve()
                })
            })
        } else {
            logger.warn('⚠️ HTTP server does not support close() method')
        }
    } catch (error) {
        logger.warn('⚠️ Error closing HTTP server:', error)
    }

    // Disconnect Prisma
    try {
        await prisma.$disconnect()
        logger.info('✅ Prisma disconnected')
    } catch (error) {
        logger.warn('⚠️ Error disconnecting Prisma:', error)
    }

    logger.info('✅ Shutdown complete')
    process.exit(0)
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ============================================
// STARTUP HEALTH CHECK VERIFICATION
// ============================================

// Verify server is ready by checking health endpoint after a short delay
// This helps Railway detect when the server is actually ready
if (typeof fetch !== 'undefined') {
    setTimeout(async () => {
        try {
            const healthUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`
            logger.info(`🔍 Verifying server health at ${healthUrl}...`)

            // Use fetch to check health endpoint (only works if server is actually listening)
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId))

            if (response.ok) {
                const data = await response.json()
                logger.info('✅ Health check passed:', data)
            } else {
                logger.warn(`⚠️ Health check returned status ${response.status}`)
            }
        } catch (error) {
            // This is expected if server isn't ready yet or fetch isn't available
            if (error instanceof Error && error.name !== 'AbortError') {
                logger.debug('ℹ️ Health check verification skipped (server may still be starting):', {
                    error: error.message,
                })
            }
        }
    }, 2000) // Check after 2 seconds
} else {
    logger.info('ℹ️ Fetch not available, skipping health check verification')
}

// Log startup completion
logger.info('🎉 Application startup sequence complete')
logger.info(`📊 Total timers tracked: ${scheduledTimers.length}`)
logger.info(`🌐 Server should be ready at http://${host}:${port}`)
logger.info(`🏥 Health check available at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`)

// Export io instance for broadcasting from routes
export { io }
export default app
