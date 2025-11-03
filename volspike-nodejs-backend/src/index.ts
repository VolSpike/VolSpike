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
import { paymentRoutes } from './routes/payments'
import { adminRoutes } from './routes/admin'
import { setupSocketHandlers } from './websocket/handlers'
import { setSocketIO } from './services/alert-broadcaster'
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
        'X-API-Key'  // For volume alert ingestion from Digital Ocean
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

// Apply auth middleware to market routes
app.use('/api/market/*', authMiddleware)
app.route('/api/market', marketRoutes)

app.route('/api/watchlist', watchlistRoutes)
app.route('/api/alerts', alertRoutes)
app.route('/api/volume-alerts', volumeAlertsRouter)
app.route('/api/payments', paymentRoutes)

// Admin routes (protected with admin middleware)
app.route('/api/admin', adminRoutes)

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