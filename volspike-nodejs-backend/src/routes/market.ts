import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { User } from '../types'
import { getUser, requireUser } from '../lib/hono-extensions'
import { getMarketData } from '../services/binance-client'

// Define MarketData type locally to match binance-client
interface MarketData {
    symbol: string
    price: number
    volume24h: number
    volumeChange: number
    fundingRate: number
    openInterest: number
    timestamp: number
}

const logger = createLogger()

const market = new Hono()

// ============================================
// OPTIONS HANDLERS - Handle CORS preflight
// ============================================

market.options('/data', (c) => {
    logger.debug('OPTIONS /api/market/data - preflight request')
    return c.text('', 200)
})

market.options('/symbol/:symbol', (c) => {
    logger.debug('OPTIONS /api/market/symbol/:symbol - preflight request')
    return c.text('', 200)
})

market.options('/history/:symbol', (c) => {
    logger.debug('OPTIONS /api/market/history/:symbol - preflight request')
    return c.text('', 200)
})

market.options('/spikes', (c) => {
    logger.debug('OPTIONS /api/market/spikes - preflight request')
    return c.text('', 200)
})

market.options('/health', (c) => {
    logger.debug('OPTIONS /api/market/health - preflight request')
    return c.text('', 200)
})

market.options('/watchlist/:id', (c) => {
    logger.debug('OPTIONS /api/market/watchlist/:id - preflight request')
    return c.text('', 200)
})

// ============================================
// GET /data - Market data with tier-based throttling
// ============================================

market.get('/data', async (c) => {
    try {
        // For development: allow unauthenticated access
        let user, tier = 'free'
        try {
            user = requireUser(c)
            tier = user?.tier || 'free'
        } catch (error) {
            // In development, use mock user if not authenticated
            if (process.env.NODE_ENV === 'development') {
                logger.info('Using mock user for market data (development mode)')
                user = { id: '1', email: 'dev@volspike.com', tier: 'free' } as any
                tier = 'free'
            } else {
                throw error
            }
        }

        // Get market data directly from Binance API
        const marketData = await getMarketData() as MarketData[]

        if (!marketData || marketData.length === 0) {
            // Return empty data with stale indicator instead of 500
            logger.warn('No market data available from Binance API')
            return c.json({
                data: [],
                stale: true,
                message: 'Market data temporarily unavailable - Binance API may be down',
                lastUpdate: null,
                ingestionStatus: {
                    hasData: false,
                    lastHeartbeat: null,
                    lastError: null
                }
            }, 200)
        }

        // Apply tier-based filtering
        let filteredData = marketData

        if (tier === 'free') {
            // Free tier: limit to top 50 by volume
            filteredData = marketData
                .sort((a: any, b: any) => b.volume24h - a.volume24h)
                .slice(0, 50)
        } else if (tier === 'pro') {
            // Pro tier: top 100 by volume
            filteredData = marketData
                .sort((a: any, b: any) => b.volume24h - a.volume24h)
                .slice(0, 100)
        }
        // Elite tier: all data

        logger.info(`Market data requested by ${user?.email} (${tier} tier)`)

        return c.json({
            data: filteredData,
            stale: false,
            lastUpdate: marketData[0]?.timestamp || Date.now(),
            tier: tier,
            ingestionStatus: {
                hasData: true,
                lastHeartbeat: null,
                lastError: null
            }
        })
    } catch (error) {
        logger.error('Market data error:', error)
        return c.json({ error: 'Failed to fetch market data' }, 500)
    }
})

// ============================================
// GET /symbol/:symbol - Specific symbol data
// ============================================

market.get('/symbol/:symbol', async (c) => {
    try {
        const symbol = c.req.param('symbol')

        let user
        try {
            user = requireUser(c)
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                logger.info(`Symbol data for ${symbol} (unauthenticated, development mode)`)
                user = { id: 'dev-user', email: 'dev@volspike.com', tier: 'free' } as any
            } else {
                return c.json({ error: 'Unauthorized' }, 401)
            }
        }

        // Get symbol data directly from Binance API
        const symbolData = await getMarketData(symbol)

        if (!symbolData) {
            return c.json({ error: 'Symbol not found' }, 404)
        }

        logger.info(`Symbol data requested for ${symbol} by ${user?.email}`)

        return c.json(symbolData)
    } catch (error) {
        logger.error('Symbol data error:', error)
        return c.json({ error: 'Failed to fetch symbol data' }, 500)
    }
})

// ============================================
// GET /history/:symbol - Historical data
// ============================================

market.get('/history/:symbol', async (c) => {
    try {
        const symbol = c.req.param('symbol')
        const timeframe = c.req.query('timeframe') || '1h'
        const limit = parseInt(c.req.query('limit') || '100')

        let user, tier = 'free'

        try {
            user = requireUser(c)
            tier = user?.tier || 'free'
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                logger.info(`History for ${symbol} (unauthenticated, development mode)`)
                user = { id: 'dev-user', email: 'dev@volspike.com', tier: 'free' } as any
                tier = 'free'
            } else {
                return c.json({ error: 'Unauthorized' }, 401)
            }
        }

        // Tier-based access control
        if (tier === 'free' && limit > 50) {
            return c.json({ error: 'Free tier limited to 50 data points' }, 403)
        }

        if (tier === 'pro' && limit > 200) {
            return c.json({ error: 'Pro tier limited to 200 data points' }, 403)
        }

        // Get contract ID
        const contract = await prisma.contract.findUnique({
            where: { symbol },
        })

        if (!contract) {
            return c.json({ error: 'Symbol not found' }, 404)
        }

        // Get historical data from database
        const history = await prisma.marketSnapshot.findMany({
            where: { contractId: contract.id },
            orderBy: { timestamp: 'desc' },
            take: limit,
        })

        logger.info(`Historical data requested for ${symbol} by ${user?.email}`)

        return c.json(history)
    } catch (error) {
        logger.error('Historical data error:', error)
        return c.json({ error: 'Failed to fetch historical data' }, 500)
    }
})

// ============================================
// GET /spikes - Volume spike alerts
// ============================================

market.get('/spikes', async (c) => {
    try {
        let user, tier = 'free'

        try {
            user = requireUser(c)
            tier = user?.tier || 'free'
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                logger.info('Volume spikes requested (unauthenticated, development mode)')
                user = { id: 'dev-user', email: 'dev@volspike.com', tier: 'free' } as any
                tier = 'free'
            } else {
                return c.json({ error: 'Unauthorized' }, 401)
            }
        }

        // Get recent alerts
        const alerts = await prisma.alert.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: tier === 'free' ? 10 : tier === 'pro' ? 50 : 100,
            include: {
                contract: {
                    select: { symbol: true },
                },
            },
        })

        logger.info(`Volume spikes requested by ${user?.email} (${tier} tier)`)

        return c.json(alerts)
    } catch (error) {
        logger.error('Volume spikes error:', error)
        return c.json({ error: 'Failed to fetch volume spikes' }, 500)
    }
})

// ============================================
// GET /health - System health and ingestion status
// ============================================

market.get('/health', async (c) => {
    try {
        // Check if we can get market data from Binance API
        const marketData = await getMarketData() as MarketData[]
        const hasData = marketData && marketData.length > 0

        const health = {
            status: 'ok',
            timestamp: Date.now(),
            redis: {
                status: 'not_used',
                connected: false
            },
            ingestion: {
                hasData,
                lastHeartbeat: null,
                lastError: null,
                dataAge: hasData && marketData[0]?.timestamp
                    ? Date.now() - marketData[0].timestamp
                    : null
            },
            market: {
                symbolsCount: hasData ? marketData.length : 0,
                lastUpdate: hasData ? marketData[0]?.timestamp : null
            }
        }

        return c.json(health)
    } catch (error) {
        logger.error('Health check error:', error)
        return c.json({
            status: 'error',
            error: 'Health check failed',
            timestamp: Date.now()
        }, 500)
    }
})

// ============================================
// GET /watchlist/:id - Market data for watchlist symbols
// Fetches individual symbol data for all symbols in a watchlist
// Used when filtering Market Data table by watchlist
// ============================================

market.get('/watchlist/:id', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')

        // Verify watchlist ownership
        const watchlist = await prisma.watchlist.findFirst({
            where: {
                id: watchlistId,
                userId: user.id,
            },
            include: {
                items: {
                    include: {
                        contract: {
                            select: { symbol: true, isActive: true },
                        },
                    },
                },
            },
        })

        if (!watchlist) {
            return c.json({ error: 'Watchlist not found' }, 404)
        }

        // Extract symbols from watchlist items and normalize to uppercase
        const symbols = watchlist.items
            .map(item => item.contract.symbol?.toUpperCase())
            .filter(symbol => symbol) // Filter out any null/undefined

        logger.info(`Watchlist ${watchlistId} contains ${symbols.length} symbols: ${symbols.join(', ')}`)

        if (symbols.length === 0) {
            return c.json({
                watchlistId: watchlist.id,
                watchlistName: watchlist.name,
                symbols: [],
                fetchedAt: Date.now(),
            })
        }

        // Fetch market data for each symbol individually
        // This allows symbols outside tier's normal visibility to be displayed
        // Pass skipVolumeFilter=true to ensure watchlist symbols are shown even with low volume
        const symbolDataPromises = symbols.map(async (symbol) => {
            try {
                logger.debug(`[Watchlist Market Data] Fetching data for symbol: ${symbol}`)
                const data = await getMarketData(symbol, true) // Skip volume filter for watchlist symbols
                // getMarketData returns MarketData | MarketData[] | null
                // When called with a symbol, it returns MarketData | null
                if (data && typeof data === 'object' && 'symbol' in data && !Array.isArray(data)) {
                    logger.debug(`[Watchlist Market Data] Successfully fetched data for ${symbol}`)
                    return data as MarketData
                }
                logger.warn(`[Watchlist Market Data] Invalid data format returned for symbol ${symbol}:`, {
                    dataType: typeof data,
                    isArray: Array.isArray(data),
                    hasSymbol: data && typeof data === 'object' && 'symbol' in data,
                })
                return null
            } catch (error: any) {
                logger.warn(`[Watchlist Market Data] Failed to fetch data for symbol ${symbol}:`, {
                    error: error.message,
                    stack: error.stack,
                })
                return null // Return null for failed fetches
            }
        })

        const symbolDataResults = await Promise.all(symbolDataPromises)
        
        // Filter out null results and ensure we have MarketData objects
        const marketData = symbolDataResults
            .filter((data): data is MarketData => data !== null && typeof data === 'object' && 'symbol' in data)

        logger.info(`Fetched market data for ${marketData.length}/${symbols.length} symbols in watchlist ${watchlistId} by ${user.email}`)

        return c.json({
            watchlistId: watchlist.id,
            watchlistName: watchlist.name,
            symbols: marketData,
            fetchedAt: Date.now(),
        })
    } catch (error) {
        logger.error('Watchlist market data error:', error)
        return c.json({ error: 'Failed to fetch watchlist market data' }, 500)
    }
})

export { market as marketRoutes }
