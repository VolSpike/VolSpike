import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { refreshSingleAsset, runAssetRefreshCycle } from '../../services/asset-metadata'
import axios from 'axios'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const adminAssetRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

const listSchema = z.object({
    q: z.string().optional(),
    status: z.enum(['AUTO', 'VERIFIED', 'HIDDEN']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(50),
})

const upsertSchema = z.object({
    id: z.string().optional(),
    baseSymbol: z.string().min(1),
    binanceSymbol: z.string().optional(),
    extraSymbols: z.array(z.string()).optional(),
    coingeckoId: z.string().optional(),
    displayName: z.string().optional(),
    websiteUrl: z.string().url().optional(),
    twitterUrl: z.string().url().optional(),
    logoUrl: z.string().url().optional(),
    status: z.enum(['AUTO', 'VERIFIED', 'HIDDEN']).optional(),
    notes: z.string().optional(),
})

// GET /api/admin/assets
adminAssetRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        logger.info('[AdminAssets] GET / - Request received', { query })

        const params = listSchema.parse(query)
        logger.debug('[AdminAssets] Parsed params:', params)

        const where: any = {}

        if (params.status) {
            where.status = params.status
        }

        const q = params.q?.trim()
        if (q) {
            where.OR = [
                { baseSymbol: { contains: q, mode: 'insensitive' } },
                { binanceSymbol: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
                { coingeckoId: { contains: q, mode: 'insensitive' } },
            ]
        }

        logger.debug('[AdminAssets] Querying database with where:', where)
        const total = await prisma.asset.count({ where })
        logger.info('[AdminAssets] Total assets found:', total)

        const assets = await prisma.asset.findMany({
            where,
            orderBy: { baseSymbol: 'asc' },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
        })

        logger.info('[AdminAssets] Assets fetched successfully', {
            count: assets.length,
            page: params.page,
            total
        })

        return c.json({
            assets,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
        })
    } catch (error) {
        logger.error('[AdminAssets] Admin asset list error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
        return c.json({
            error: 'Failed to list assets',
            details: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

// POST /api/admin/assets - create or update
adminAssetRoutes.post('/', async (c) => {
    try {
        const body = await c.req.json()
        const data = upsertSchema.parse(body)

        const extraSymbolsJson =
            data.extraSymbols && data.extraSymbols.length > 0
                ? JSON.stringify(data.extraSymbols)
                : null

        const payload: any = {
            baseSymbol: data.baseSymbol.toUpperCase(),
            binanceSymbol: data.binanceSymbol?.toUpperCase() ?? null,
            extraSymbols: extraSymbolsJson,
            coingeckoId: data.coingeckoId ?? null,
            displayName: data.displayName ?? null,
            websiteUrl: data.websiteUrl ?? null,
            twitterUrl: data.twitterUrl ?? null,
            logoUrl: data.logoUrl ?? null,
            status: data.status ?? 'AUTO',
            notes: data.notes ?? null,
        }

        let asset
        if (data.id) {
            asset = await prisma.asset.update({
                where: { id: data.id },
                data: payload,
            })
        } else {
            asset = await prisma.asset.upsert({
                where: { baseSymbol: payload.baseSymbol },
                create: payload,
                update: payload,
            })
        }

        return c.json({ asset })
    } catch (error) {
        logger.error('Admin asset upsert error:', error)
        return c.json({ error: 'Failed to save asset' }, 500)
    }
})

// DELETE /api/admin/assets/:id
adminAssetRoutes.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        await prisma.asset.delete({ where: { id } })
        return c.json({ success: true })
    } catch (error) {
        logger.error('Admin asset delete error:', error)
        return c.json({ error: 'Failed to delete asset' }, 500)
    }
})

// POST /api/admin/assets/:id/refresh - Refresh single asset from CoinGecko
adminAssetRoutes.post('/:id/refresh', async (c) => {
    try {
        const id = c.req.param('id')
        const asset = await prisma.asset.findUnique({ where: { id } })
        
        if (!asset) {
            return c.json({ error: 'Asset not found' }, 404)
        }

        logger.info(`[AdminAssets] Manual refresh requested for ${asset.baseSymbol}`)
        const updated = await refreshSingleAsset(asset)
        
        if (updated) {
            const refreshed = await prisma.asset.findUnique({ where: { id } })
            return c.json({ 
                success: true, 
                asset: refreshed,
                message: `Successfully refreshed ${asset.baseSymbol} from CoinGecko`
            })
        } else {
            return c.json({ 
                success: false, 
                asset,
                message: `No updates needed for ${asset.baseSymbol} or refresh failed`
            })
        }
    } catch (error) {
        logger.error('Admin asset refresh error:', error)
        return c.json({ 
            error: 'Failed to refresh asset',
            details: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

// POST /api/admin/assets/refresh/bulk - Refresh multiple assets
const bulkRefreshSchema = z.object({
    ids: z.array(z.string()).optional(),
    symbols: z.array(z.string()).optional(),
    limit: z.coerce.number().min(1).max(50).default(10),
})

adminAssetRoutes.post('/refresh/bulk', async (c) => {
    try {
        const body = await c.req.json()
        const params = bulkRefreshSchema.parse(body)

        let assets: any[] = []

        if (params.ids && params.ids.length > 0) {
            assets = await prisma.asset.findMany({
                where: { id: { in: params.ids } },
            })
        } else if (params.symbols && params.symbols.length > 0) {
            assets = await prisma.asset.findMany({
                where: { baseSymbol: { in: params.symbols.map(s => s.toUpperCase()) } },
            })
        } else {
            // Refresh assets that need refresh (missing logo or stale)
            const now = Date.now()
            const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week
            
            const allAssets = await prisma.asset.findMany({
                where: {
                    status: { not: 'HIDDEN' },
                },
                orderBy: { updatedAt: 'asc' },
            })

            assets = allAssets
                .filter(asset => {
                    if (!asset.logoUrl || !asset.displayName || !asset.coingeckoId) return true
                    const updatedAt = asset.updatedAt?.getTime() ?? Date.now()
                    return now - updatedAt > REFRESH_INTERVAL_MS
                })
                .slice(0, params.limit)
        }

        if (assets.length === 0) {
            return c.json({ 
                success: true, 
                refreshed: 0, 
                message: 'No assets need refresh' 
            })
        }

        logger.info(`[AdminAssets] Bulk refresh requested for ${assets.length} assets`)
        
        const results = []
        let refreshed = 0
        
        for (const asset of assets) {
            try {
                const updated = await refreshSingleAsset(asset)
                if (updated) {
                    refreshed++
                    results.push({ symbol: asset.baseSymbol, success: true })
                } else {
                    results.push({ symbol: asset.baseSymbol, success: false, reason: 'No updates needed' })
                }
                // Small delay to respect CoinGecko rate limits
                await new Promise(resolve => setTimeout(resolve, 7000)) // ~8 calls/minute
            } catch (error) {
                logger.warn(`[AdminAssets] Failed to refresh ${asset.baseSymbol}:`, error)
                results.push({ 
                    symbol: asset.baseSymbol, 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error)
                })
            }
        }

        return c.json({
            success: true,
            refreshed,
            total: assets.length,
            results,
            message: `Refreshed ${refreshed} of ${assets.length} assets`
        })
    } catch (error) {
        logger.error('Admin bulk asset refresh error:', error)
        return c.json({ 
            error: 'Failed to refresh assets',
            details: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

// POST /api/admin/assets/refresh/cycle - Run scheduled refresh cycle
adminAssetRoutes.post('/refresh/cycle', async (c) => {
    try {
        logger.info('[AdminAssets] Manual refresh cycle triggered')
        const result = await runAssetRefreshCycle('manual')
        return c.json({
            success: true,
            ...result,
            message: `Refresh cycle completed: ${result.refreshed} assets refreshed`
        })
    } catch (error) {
        logger.error('Admin refresh cycle error:', error)
        return c.json({ 
            error: 'Failed to run refresh cycle',
            details: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

// POST /api/admin/assets/sync-binance - Sync all Binance perpetual symbols with intelligent enrichment
adminAssetRoutes.post('/sync-binance', async (c) => {
    const startTime = Date.now()
    try {
        logger.info('[AdminAssets] 🔄 Manual Binance sync triggered')

        // Use proxy if BINANCE_PROXY_URL is set (to bypass Railway IP block)
        const BINANCE_FUTURES_INFO = process.env.BINANCE_PROXY_URL
            ? `${process.env.BINANCE_PROXY_URL}/api/binance/futures/info`
            : 'https://fapi.binance.com/fapi/v1/exchangeInfo'

        // Step 1: Fetch from Binance API (or proxy)
        logger.info(`[AdminAssets] 📡 Fetching Binance exchange info from: ${BINANCE_FUTURES_INFO}`)
        let data: any
        try {
            const response = await axios.get(BINANCE_FUTURES_INFO, {
                timeout: 30000, // Increased timeout for proxy
                validateStatus: (status) => status < 500 // Don't throw on 4xx
            })
            data = response.data
            logger.info(`[AdminAssets] ✅ Binance API response received (status: ${response.status})`)
        } catch (axiosError: any) {
            logger.error('[AdminAssets] ❌ Binance API request failed:', {
                message: axiosError?.message,
                code: axiosError?.code,
                response: axiosError?.response?.data,
                status: axiosError?.response?.status,
            })
            return c.json({
                success: false,
                error: 'Failed to fetch data from Binance',
                details: axiosError?.response?.data?.msg || axiosError?.message || 'Network error',
                code: axiosError?.code || 'UNKNOWN',
                status: axiosError?.response?.status || null,
            }, 500)
        }

        // Step 2: Validate response structure
        if (!data || typeof data !== 'object') {
            logger.error('[AdminAssets] ❌ Invalid Binance response structure', {
                dataType: typeof data,
                dataKeys: data ? Object.keys(data).slice(0, 10) : [],
                dataSample: data ? JSON.stringify(data).slice(0, 500) : 'null',
            })
            return c.json({
                success: false,
                error: 'Invalid response from Binance',
                details: 'Response is not a valid object',
                debug: {
                    dataType: typeof data,
                    hasData: !!data,
                    keys: data ? Object.keys(data).slice(0, 10) : [],
                }
            }, 500)
        }

        const symbols: any[] = Array.isArray(data?.symbols) ? data.symbols : []
        logger.info(`[AdminAssets] 📊 Found ${symbols.length} total symbols from Binance`, {
            hasSymbols: !!data?.symbols,
            isArray: Array.isArray(data?.symbols),
            dataKeys: Object.keys(data).slice(0, 20),
            firstSymbol: symbols[0] ? {
                symbol: symbols[0].symbol,
                baseAsset: symbols[0].baseAsset,
                contractType: symbols[0].contractType,
            } : null,
        })

        if (!symbols.length) {
            logger.warn('[AdminAssets] ⚠️ No symbols returned from Binance', {
                hasSymbolsKey: 'symbols' in data,
                symbolsType: typeof data?.symbols,
                symbolsValue: data?.symbols,
                dataKeys: Object.keys(data),
                responseStructure: JSON.stringify(data).slice(0, 1000),
            })
            return c.json({
                success: false,
                error: 'Server error: Binance API returned empty symbols array',
                synced: 0,
                details: 'Binance API returned empty symbols array - this may be a temporary issue',
                debug: {
                    hasSymbolsKey: 'symbols' in data,
                    symbolsType: typeof data?.symbols,
                    dataKeys: Object.keys(data).slice(0, 20),
                    suggestion: 'Check Railway logs for full response structure',
                }
            }, 500)
        }

        // Step 3: Filter and map candidates
        logger.info('[AdminAssets] 🔍 Filtering perpetual USDT pairs...')
        const candidates = symbols
            .filter((s) => {
                const isPerpetual = s?.contractType === 'PERPETUAL'
                const isUSDT = s?.quoteAsset === 'USDT'
                const isTrading = s?.status === 'TRADING'
                return isPerpetual && isUSDT && isTrading
            })
            .map((s) => ({
                baseSymbol: String(s.baseAsset || '').toUpperCase(),
                binanceSymbol: String(s.symbol || '').toUpperCase(),
            }))
            .filter((c) => c.baseSymbol && c.binanceSymbol) // Remove invalid entries

        logger.info(`[AdminAssets] ✅ Filtered to ${candidates.length} valid perpetual USDT pairs`)

        // Step 4: Fetch existing assets from database
        logger.info('[AdminAssets] 💾 Fetching existing assets from database...')
        let existing: Array<{ baseSymbol: string; binanceSymbol: string | null }> = []
        try {
            existing = await prisma.asset.findMany({
                select: { baseSymbol: true, binanceSymbol: true },
            })
            logger.info(`[AdminAssets] ✅ Database connected, found ${existing.length} existing assets`)
        } catch (dbError: any) {
            logger.error('[AdminAssets] ❌ Database query failed:', {
                message: dbError?.message,
                code: dbError?.code,
            })
            return c.json({
                success: false,
                error: 'Database connection failed',
                details: dbError?.message || 'Failed to query existing assets',
                code: dbError?.code || 'DB_ERROR',
            }, 500)
        }

        const existingMap = new Map(existing.map((a) => [a.baseSymbol.toUpperCase(), a.binanceSymbol]))

        // Step 5: Prepare bulk operations (separate creates and updates)
        const toCreate: Array<{ baseSymbol: string; binanceSymbol: string }> = []
        const toUpdate: Array<{ baseSymbol: string; binanceSymbol: string }> = []

        for (const candidate of candidates) {
            const existingBinanceSymbol = existingMap.get(candidate.baseSymbol)

            if (existingBinanceSymbol === undefined) {
                // New asset - create
                toCreate.push(candidate)
            } else if (existingBinanceSymbol !== candidate.binanceSymbol) {
                // Binance symbol changed - update
                toUpdate.push(candidate)
            }
            // else: Already exists with same binanceSymbol - skip
        }

        logger.info(`[AdminAssets] 📝 Prepared ${toCreate.length} creates, ${toUpdate.length} updates`)

        // Step 6: Execute bulk operations using transaction for speed
        let created = 0
        let updated = 0
        let errors = 0

        try {
            // Bulk create new assets (much faster than individual creates)
            if (toCreate.length > 0) {
                logger.info(`[AdminAssets] 🚀 Bulk creating ${toCreate.length} new assets...`)
                const createResult = await prisma.asset.createMany({
                    data: toCreate.map(c => ({
                        baseSymbol: c.baseSymbol,
                        binanceSymbol: c.binanceSymbol,
                        status: 'AUTO',
                    })),
                    skipDuplicates: true, // Gracefully handle race conditions
                })
                created = createResult.count
                logger.info(`[AdminAssets] ✅ Created ${created} new assets`)
            }

            // Bulk update assets (using transaction for speed)
            if (toUpdate.length > 0) {
                logger.info(`[AdminAssets] 🔄 Updating ${toUpdate.length} existing assets...`)
                // Update in batches to avoid transaction timeout
                const BATCH_SIZE = 100
                for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
                    const batch = toUpdate.slice(i, i + BATCH_SIZE)
                    await prisma.$transaction(
                        batch.map(candidate =>
                            prisma.asset.update({
                                where: { baseSymbol: candidate.baseSymbol },
                                data: { binanceSymbol: candidate.binanceSymbol },
                            })
                        )
                    )
                    updated += batch.length
                }
                logger.info(`[AdminAssets] ✅ Updated ${updated} assets`)
            }
        } catch (bulkError: any) {
            logger.error('[AdminAssets] ❌ Bulk operation failed:', {
                message: bulkError?.message,
                code: bulkError?.code,
            })
            errors = 1
        }

        const skipped = candidates.length - created - updated - errors
        const duration = Date.now() - startTime

        logger.info(`[AdminAssets] ✅ Binance sync completed in ${duration}ms: ${created} created, ${updated} updated, ${skipped} skipped`)

        // Step 7: Trigger background enrichment for newly created assets (non-blocking)
        if (created > 0) {
            logger.info(`[AdminAssets] 🎨 Triggering background enrichment for ${created} new assets...`)
            // Fire and forget - let the scheduled refresh cycle handle it
            setImmediate(async () => {
                try {
                    const { refreshed } = await runAssetRefreshCycle('post-sync')
                    logger.info(`[AdminAssets] ✅ Background enrichment completed: ${refreshed} assets refreshed`)
                } catch (enrichError) {
                    logger.warn('[AdminAssets] ⚠️ Background enrichment failed (non-critical):', enrichError)
                }
            })
        }

        return c.json({
            success: true,
            synced: created + updated,
            created,
            updated,
            skipped,
            errors,
            total: candidates.length,
            duration: `${duration}ms`,
            message: `Synced ${created + updated} assets from Binance (${created} new, ${updated} updated)${created > 0 ? ' - background enrichment started' : ''}`,
        })
    } catch (error: any) {
        const duration = Date.now() - startTime
        logger.error('[AdminAssets] ❌ Binance sync error:', {
            message: error?.message,
            code: error?.code,
        })
        return c.json({
            success: false,
            error: 'Failed to sync from Binance',
            details: error?.message || 'Unknown error occurred',
            code: error?.code || 'UNKNOWN',
            duration: `${duration}ms`,
        }, 500)
    }
})

export { adminAssetRoutes }

