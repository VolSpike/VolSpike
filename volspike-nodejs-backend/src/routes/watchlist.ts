import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { User } from '../types'
import { getUser, requireUser } from '../lib/hono-extensions'
import { WatchlistService } from '../services/watchlist-service'

const logger = createLogger()

const watchlist = new Hono()

// Validation schemas
const createWatchlistSchema = z.object({
    name: z.string().min(1).max(100),
})

const addToWatchlistSchema = z.object({
    symbol: z.string().regex(/^[A-Z0-9]+USDT$/, 'Invalid symbol format. Must be uppercase and end with USDT (e.g., BTCUSDT)'),
})

const updateWatchlistSchema = z.object({
    name: z.string().min(1).max(100),
})

// Get user's watchlists with limit status
watchlist.get('/', async (c) => {
    try {
        const user = requireUser(c)

        const watchlists = await prisma.watchlist.findMany({
            where: { userId: user.id },
            include: {
                items: {
                    include: {
                        contract: {
                            select: { symbol: true, isActive: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        // Get limit status for the user
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)

        logger.info(`Watchlists requested by ${user?.email}`)

        return c.json({
            watchlists,
            limits: limitStatus,
        })
    } catch (error) {
        logger.error('Get watchlists error:', error)
        return c.json({ error: 'Failed to fetch watchlists' }, 500)
    }
})

// Get user's limit status
watchlist.get('/limits', async (c) => {
    try {
        const user = requireUser(c)
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)
        return c.json(limitStatus)
    } catch (error) {
        logger.error('Get limit status error:', error)
        return c.json({ error: 'Failed to fetch limit status' }, 500)
    }
})

// Create new watchlist
watchlist.post('/', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()
        const { name } = createWatchlistSchema.parse(body)

        // Check if user can create watchlist (limit check)
        const canCreate = await WatchlistService.canCreateWatchlist(user.id, user.tier)
        if (!canCreate.allowed) {
            return c.json(
                {
                    error: 'Watchlist limit reached',
                    message: canCreate.reason,
                    limit: canCreate.limit,
                    current: canCreate.currentCount,
                },
                403
            )
        }

        // Check for duplicate watchlist name
        const existingWatchlist = await prisma.watchlist.findFirst({
            where: {
                userId: user.id,
                name: name.trim(),
            },
        })

        if (existingWatchlist) {
            return c.json(
                {
                    error: 'Watchlist name already exists',
                    message: 'You already have a watchlist with this name.',
                },
                409
            )
        }

        const watchlist = await prisma.watchlist.create({
            data: {
                name: name.trim(),
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

        // Get updated limit status
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)

        logger.info(`Watchlist "${name}" created by ${user?.email}`)

        return c.json({
            watchlist,
            limits: limitStatus,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation error', details: error.errors }, 400)
        }
        logger.error('Create watchlist error:', error)
        return c.json({ error: 'Failed to create watchlist' }, 500)
    }
})

// Get specific watchlist
watchlist.get('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')

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

        logger.info(`Watchlist ${watchlistId} requested by ${user?.email}`)

        return c.json(watchlist)
    } catch (error) {
        logger.error('Get watchlist error:', error)
        return c.json({ error: 'Failed to fetch watchlist' }, 500)
    }
})

// Add symbol to watchlist
watchlist.post('/:id/symbols', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')
        const body = await c.req.json()
        const { symbol } = addToWatchlistSchema.parse(body)

        // Normalize symbol to uppercase
        const normalizedSymbol = symbol.toUpperCase()

        // Verify watchlist ownership
        const watchlist = await prisma.watchlist.findFirst({
            where: {
                id: watchlistId,
                userId: user.id,
            },
        })

        if (!watchlist) {
            return c.json({ error: 'Watchlist not found' }, 404)
        }

        // Check if user can add symbol (limit check)
        const canAdd = await WatchlistService.canAddSymbol(
            user.id,
            user.tier,
            normalizedSymbol,
            watchlistId
        )

        if (!canAdd.allowed) {
            return c.json(
                {
                    error: canAdd.isDuplicate ? 'Duplicate symbol' : 'Symbol limit reached',
                    message: canAdd.reason,
                    limit: canAdd.limit,
                    current: canAdd.currentCount,
                    isDuplicate: canAdd.isDuplicate,
                },
                canAdd.isDuplicate ? 409 : 403
            )
        }

        // Get or create contract
        let contract = await prisma.contract.findUnique({
            where: { symbol: normalizedSymbol },
        })

        if (!contract) {
            contract = await prisma.contract.create({
                data: {
                    symbol: normalizedSymbol,
                    precision: 2, // Default precision
                },
            })
        }

        // Add to watchlist
        const watchlistItem = await prisma.watchlistItem.create({
            data: {
                watchlistId,
                contractId: contract.id,
            },
            include: {
                contract: {
                    select: { symbol: true, isActive: true },
                },
            },
        })

        // Get updated limit status
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)

        logger.info(`Symbol ${normalizedSymbol} added to watchlist ${watchlistId} by ${user?.email}`)

        return c.json({
            watchlistItem,
            limits: limitStatus,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation error', details: error.errors }, 400)
        }
        logger.error('Add symbol error:', error)
        return c.json({ error: 'Failed to add symbol to watchlist' }, 500)
    }
})

// Remove symbol from watchlist
watchlist.delete('/:id/symbols/:symbol', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')
        const symbol = c.req.param('symbol').toUpperCase()

        // Get contract
        const contract = await prisma.contract.findUnique({
            where: { symbol },
        })

        if (!contract) {
            return c.json({ error: 'Symbol not found' }, 404)
        }

        // Verify watchlist ownership and remove item
        const deleted = await prisma.watchlistItem.deleteMany({
            where: {
                watchlistId,
                contractId: contract.id,
                watchlist: {
                    userId: user.id,
                },
            },
        })

        if (deleted.count === 0) {
            return c.json({ error: 'Symbol not found in watchlist' }, 404)
        }

        // Get updated limit status
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)

        logger.info(`Symbol ${symbol} removed from watchlist ${watchlistId} by ${user?.email}`)

        return c.json({
            success: true,
            limits: limitStatus,
        })
    } catch (error) {
        logger.error('Remove symbol error:', error)
        return c.json({ error: 'Failed to remove symbol from watchlist' }, 500)
    }
})

// Update watchlist name
watchlist.patch('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')
        const body = await c.req.json()
        const { name } = updateWatchlistSchema.parse(body)

        // Check for duplicate watchlist name
        const existingWatchlist = await prisma.watchlist.findFirst({
            where: {
                userId: user.id,
                name: name.trim(),
                id: { not: watchlistId }, // Exclude current watchlist
            },
        })

        if (existingWatchlist) {
            return c.json(
                {
                    error: 'Watchlist name already exists',
                    message: 'You already have a watchlist with this name.',
                },
                409
            )
        }

        const updated = await prisma.watchlist.updateMany({
            where: {
                id: watchlistId,
                userId: user.id,
            },
            data: {
                name: name.trim(),
            },
        })

        if (updated.count === 0) {
            return c.json({ error: 'Watchlist not found' }, 404)
        }

        const watchlist = await prisma.watchlist.findUnique({
            where: { id: watchlistId },
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

        logger.info(`Watchlist ${watchlistId} renamed to "${name}" by ${user?.email}`)

        return c.json({ watchlist })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation error', details: error.errors }, 400)
        }
        logger.error('Update watchlist error:', error)
        return c.json({ error: 'Failed to update watchlist' }, 500)
    }
})

// Delete watchlist
watchlist.delete('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const watchlistId = c.req.param('id')

        const deleted = await prisma.watchlist.deleteMany({
            where: {
                id: watchlistId,
                userId: user.id,
            },
        })

        if (deleted.count === 0) {
            return c.json({ error: 'Watchlist not found' }, 404)
        }

        // Get updated limit status
        const limitStatus = await WatchlistService.getLimitStatus(user.id, user.tier)

        logger.info(`Watchlist ${watchlistId} deleted by ${user?.email}`)

        return c.json({
            success: true,
            limits: limitStatus,
        })
    } catch (error) {
        logger.error('Delete watchlist error:', error)
        return c.json({ error: 'Failed to delete watchlist' }, 500)
    }
})

export { watchlist as watchlistRoutes }
