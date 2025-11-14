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
import openInterestRouter from './routes/open-interest'
import { paymentRoutes } from './routes/payments'
import { adminRoutes } from './routes/admin'
import renewalRoutes from './routes/renewal'
import { setupSocketHandlers } from './websocket/handlers'
import { setSocketIO } from './services/alert-broadcaster'
import { checkAndSendRenewalReminders, checkAndDowngradeExpiredSubscriptions } from './services/renewal-reminder'
import type { AppBindings, AppVariables } from './types/hono'

// Initialize Prisma
export const prisma = new PrismaClient()

// Initialize logger
const logger = createLogger()

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
// SCHEDULED TASKS - Renewal Reminders & Expiration Checks
// ============================================

// Only run scheduled tasks in production (not in development to avoid conflicts)
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SCHEDULED_TASKS !== 'false') {
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

    // Run initial checks after 2 minutes (to allow server and database to fully start)
    setTimeout(async () => {
        try {
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

    logger.info('✅ Scheduled tasks initialized (renewal reminders every 6h, expiration checks daily)')
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