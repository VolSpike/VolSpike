import { Server as SocketIOServer, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createLogger } from '../lib/logger'
import { getMarketData } from '../services/binance-client'

const logger = createLogger()

interface AuthenticatedSocket extends Socket {
    userId?: string
    userTier?: string
}

export function setupSocketHandlers(
    io: SocketIOServer,
    prisma: PrismaClient,
    logger: any
) {
    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const token = socket.handshake.auth.token as string
            const queryTier = (socket.handshake.query?.tier as string) || ''
            const method = (socket.handshake.query?.method as string) || ''

            if (!token) {
                return next(new Error('Authentication required'))
            }

            // Public guest access – treat as Free tier with limited visibility
            // This allows unauthenticated users to join tier-based broadcasts
            // without exposing user-specific data or write operations.
            if (token === 'guest') {
                const tier = 'free'
                const pseudoId = `guest-${socket.id}`
                logger.info(`Guest connected via WebSocket as ${pseudoId} (${tier} tier${queryTier ? `, query:${queryTier}` : ''})`)
                socket.userId = pseudoId
                socket.userTier = tier
                return next()
            }

            // For development: allow mock tokens without database lookup
            if (process.env.NODE_ENV === 'development' && token.startsWith('mock-token-')) {
                logger.info('Using mock token for Socket.io authentication')
                socket.userId = '1' // Mock user ID
                socket.userTier = 'free'
                return next()
            }

            // Production: Look up user by email (default) or id when method=id
            let user: any = null
            if (method === 'id') {
                user = await prisma.user.findUnique({
                    where: { id: token },
                    select: { id: true, email: true, tier: true, refreshInterval: true },
                })
            } else {
                // If token looks like an email, use email lookup; otherwise attempt id fallback
                const looksLikeEmail = token.includes('@')
                if (looksLikeEmail) {
                    user = await prisma.user.findUnique({
                        where: { email: token },
                        select: { id: true, email: true, tier: true, refreshInterval: true },
                    })
                } else {
                    user = await prisma.user.findUnique({
                        where: { id: token },
                        select: { id: true, email: true, tier: true, refreshInterval: true },
                    })
                }
            }

            if (!user) {
                logger.error('User not found for token:', token)
                return next(new Error('Invalid token'))
            }

            logger.info(`User ${user.id} (${user.tier} tier) authenticated for WebSocket`)
            socket.userId = user.id
            socket.userTier = user.tier
            next()
        } catch (error) {
            logger.error('Socket authentication error:', error)
            next(new Error('Authentication failed'))
        }
    })

    io.on('connection', async (socket: AuthenticatedSocket) => {
        const userId = socket.userId!
        const userTier = socket.userTier!

        logger.info(`User ${userId} (${userTier} tier) connected via WebSocket`)

        // Join user to tier-based room
        socket.join(`tier-${userTier}`)
        socket.join(`user-${userId}`)

        // Join admin users to admin room for OI alerts
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            })
            if (user?.role === 'ADMIN') {
                socket.join('role-admin')
                logger.info(`User ${userId} joined role-admin room`)
            }
        } catch (error) {
            logger.warn(`Failed to check admin role for user ${userId}:`, error)
        }

        // Handle symbol subscriptions
        socket.on('subscribe-symbol', async (symbol: string) => {
            try {
                socket.join(`symbol-${symbol}`)
                logger.info(`User ${userId} subscribed to ${symbol}`)

                // Send current data for the symbol
                const symbolData = await getMarketData(symbol)
                if (symbolData) {
                    socket.emit('symbol-data', symbolData)
                }
            } catch (error) {
                logger.error(`Error subscribing to symbol ${symbol}:`, error)
            }
        })

        socket.on('unsubscribe-symbol', (symbol: string) => {
            socket.leave(`symbol-${symbol}`)
            logger.info(`User ${userId} unsubscribed from ${symbol}`)
        })

        // Handle watchlist subscriptions
        socket.on('subscribe-watchlist', async (watchlistId: string) => {
            try {
                // Verify user owns the watchlist
                const watchlist = await prisma.watchlist.findFirst({
                    where: {
                        id: watchlistId,
                        userId: userId,
                    },
                    include: {
                        items: {
                            include: {
                                contract: true,
                            },
                        },
                    },
                })

                if (!watchlist) {
                    socket.emit('error', { message: 'Watchlist not found' })
                    return
                }

                socket.join(`watchlist-${watchlistId}`)
                logger.info(`User ${userId} subscribed to watchlist ${watchlistId}`)

                // Send current data for all symbols in watchlist
                for (const item of watchlist.items) {
                    const symbolData = await getMarketData(item.contract.symbol)
                    if (symbolData) {
                        socket.emit('symbol-data', symbolData)
                    }
                }
            } catch (error) {
                logger.error(`Error subscribing to watchlist ${watchlistId}:`, error)
            }
        })

        // Handle tier-based refresh requests
        socket.on('request-refresh', async () => {
            try {
                const tier = userTier
                let refreshInterval: number

                switch (tier) {
                    case 'free':
                        refreshInterval = 15 * 60 * 1000 // 15 minutes
                        break
                    case 'pro':
                        refreshInterval = 5 * 60 * 1000 // 5 minutes
                        break
                    case 'elite':
                        refreshInterval = 30 * 1000 // 30 seconds
                        break
                    default:
                        refreshInterval = 15 * 60 * 1000
                }

                // Send refresh interval to client
                socket.emit('refresh-interval', { interval: refreshInterval })

                // Send current market data
                const marketData = await getMarketData()
                if (marketData) {
                    socket.emit('market-update', marketData)
                }
            } catch (error) {
                logger.error(`Error handling refresh request for user ${userId}:`, error)
            }
        })

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            logger.info(`User ${userId} disconnected: ${reason}`)
        })

        // Send initial data based on tier
        socket.emit('connected', {
            tier: userTier,
            refreshInterval: getRefreshInterval(userTier),
        })

        // Optionally skip initial REST fetch in production
        if (process.env.DISABLE_SERVER_MARKET_POLL !== 'true') {
            getMarketData()
                .then(data => {
                    if (data) {
                        socket.emit('market-update', data)
                    }
                })
                .catch(err => {
                    logger.warn('Skipping initial market-update due to fetch error', err)
                })
        }
    })

    // Track last update times per tier
    const lastUpdateTimes = {
        free: 0,
        pro: 0,
        elite: 0
    }

    // Tier-aware market update broadcasting
    setInterval(async () => {
        if (process.env.DISABLE_SERVER_MARKET_POLL === 'true') {
            return
        }
        try {
            const marketData = await getMarketData()
            if (!marketData) return

            const now = Date.now()

            // Elite tier: every 30 seconds
            if (now - lastUpdateTimes.elite >= 30000) {
                io.to('tier-elite').emit('market-update', {
                    data: marketData,
                    tier: 'elite',
                    timestamp: now
                })
                lastUpdateTimes.elite = now
            }

            // Pro tier: every 5 minutes
            if (now - lastUpdateTimes.pro >= 300000) {
                io.to('tier-pro').emit('market-update', {
                    data: marketData,
                    tier: 'pro',
                    timestamp: now
                })
                lastUpdateTimes.pro = now
            }

            // Free tier: every 15 minutes
            if (now - lastUpdateTimes.free >= 900000) {
                io.to('tier-free').emit('market-update', {
                    data: marketData,
                    tier: 'free',
                    timestamp: now
                })
                lastUpdateTimes.free = now
            }
        } catch (error) {
            logger.warn('Error broadcasting market update (non-fatal):', error)
        }
    }, 10000) // Check every 10 seconds

    // Handle alert broadcasting
    io.on('alert-triggered', async (alert: any) => {
        try {
            // Broadcast to all users subscribed to the symbol
            io.to(`symbol-${alert.symbol}`).emit('alert-triggered', alert)

            // Broadcast to tier-based rooms
            if (alert.tier) {
                io.to(`tier-${alert.tier}`).emit('alert-triggered', alert)
            }

            logger.info(`Alert broadcasted for ${alert.symbol}`)
        } catch (error) {
            logger.error('Error broadcasting alert:', error)
        }
    })
}

function getRefreshInterval(tier: string): number {
    switch (tier) {
        case 'free':
            return 15 * 60 * 1000 // 15 minutes
        case 'pro':
            return 5 * 60 * 1000 // 5 minutes
        case 'elite':
            return 30 * 1000 // 30 seconds
        default:
            return 15 * 60 * 1000
    }
}
