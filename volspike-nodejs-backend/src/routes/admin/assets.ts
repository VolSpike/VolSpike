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
    limit: z.coerce.number().min(1).max(100).default(20),
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
        const params = listSchema.parse(query)

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

        const total = await prisma.asset.count({ where })

        const assets = await prisma.asset.findMany({
            where,
            orderBy: { baseSymbol: 'asc' },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
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
        logger.error('Admin asset list error:', error)
        return c.json({ error: 'Failed to list assets' }, 500)
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

// POST /api/admin/assets/sync-binance - Sync all Binance perpetual symbols
adminAssetRoutes.post('/sync-binance', async (c) => {
    const startTime = Date.now()
    try {
        logger.info('[AdminAssets] 🔄 Manual Binance sync triggered')
        const BINANCE_FUTURES_INFO = 'https://fapi.binance.com/fapi/v1/exchangeInfo'
        const MAX_NEW_SYMBOLS_PER_RUN = 500 // Higher limit for manual sync
        
        // Step 1: Fetch from Binance API
        logger.info('[AdminAssets] 📡 Fetching Binance exchange info...')
        let data: any
        try {
            const response = await axios.get(BINANCE_FUTURES_INFO, { 
                timeout: 20000,
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
                stack: axiosError?.stack,
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
            logger.error('[AdminAssets] ❌ Invalid Binance response structure:', { data })
            return c.json({ 
                success: false,
                error: 'Invalid response from Binance',
                details: 'Response is not a valid object',
            }, 500)
        }
        
        const symbols: any[] = Array.isArray(data?.symbols) ? data.symbols : []
        logger.info(`[AdminAssets] 📊 Found ${symbols.length} total symbols from Binance`)
        
        if (!symbols.length) {
            logger.warn('[AdminAssets] ⚠️ No symbols returned from Binance')
            return c.json({ 
                success: false,
                error: 'No symbols returned from Binance',
                synced: 0,
                details: 'Binance API returned empty symbols array',
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

        // Step 4: Check database connection and fetch existing assets
        logger.info('[AdminAssets] 💾 Checking database connection...')
        let existing: Array<{ baseSymbol: string }> = []
        try {
            existing = await prisma.asset.findMany({
                select: { baseSymbol: true },
            })
            logger.info(`[AdminAssets] ✅ Database connected, found ${existing.length} existing assets`)
        } catch (dbError: any) {
            logger.error('[AdminAssets] ❌ Database query failed:', {
                message: dbError?.message,
                code: dbError?.code,
                meta: dbError?.meta,
                stack: dbError?.stack,
            })
            return c.json({ 
                success: false,
                error: 'Database connection failed',
                details: dbError?.message || 'Failed to query existing assets',
                code: dbError?.code || 'DB_ERROR',
            }, 500)
        }
        
        const existingSet = new Set(existing.map((a) => a.baseSymbol.toUpperCase()))

        // Step 5: Process candidates
        logger.info(`[AdminAssets] 🔄 Processing up to ${MAX_NEW_SYMBOLS_PER_RUN} candidates...`)
        let created = 0
        let updated = 0
        let skipped = 0
        let errors = 0
        const results: Array<{ symbol: string; action: 'created' | 'updated' | 'skipped' | 'error'; error?: string }> = []

        for (const candidate of candidates) {
            if (created + updated >= MAX_NEW_SYMBOLS_PER_RUN) {
                logger.info(`[AdminAssets] ⏸️ Reached limit of ${MAX_NEW_SYMBOLS_PER_RUN} operations`)
                break
            }
            
            try {
                const exists = existingSet.has(candidate.baseSymbol)
                
                if (exists) {
                    // Update binanceSymbol if it changed
                    try {
                        const asset = await prisma.asset.findUnique({
                            where: { baseSymbol: candidate.baseSymbol },
                        })
                        if (asset && asset.binanceSymbol !== candidate.binanceSymbol) {
                            await prisma.asset.update({
                                where: { baseSymbol: candidate.baseSymbol },
                                data: { binanceSymbol: candidate.binanceSymbol },
                            })
                            updated++
                            results.push({ symbol: candidate.baseSymbol, action: 'updated' })
                        } else {
                            skipped++
                            results.push({ symbol: candidate.baseSymbol, action: 'skipped' })
                        }
                    } catch (updateError: any) {
                        logger.warn(`[AdminAssets] ⚠️ Failed to update ${candidate.baseSymbol}:`, updateError?.message)
                        errors++
                        results.push({ 
                            symbol: candidate.baseSymbol, 
                            action: 'error',
                            error: updateError?.message || 'Update failed'
                        })
                    }
                } else {
                    try {
                        await prisma.asset.create({
                            data: {
                                baseSymbol: candidate.baseSymbol,
                                binanceSymbol: candidate.binanceSymbol,
                                status: 'AUTO',
                            },
                        })
                        existingSet.add(candidate.baseSymbol)
                        created++
                        results.push({ symbol: candidate.baseSymbol, action: 'created' })
                    } catch (createError: any) {
                        // Handle unique constraint violations gracefully
                        if (createError?.code === 'P2002') {
                            logger.debug(`[AdminAssets] 🔄 Asset ${candidate.baseSymbol} already exists, skipping`)
                            skipped++
                            results.push({ symbol: candidate.baseSymbol, action: 'skipped' })
                        } else {
                            logger.warn(`[AdminAssets] ⚠️ Failed to create ${candidate.baseSymbol}:`, createError?.message)
                            errors++
                            results.push({ 
                                symbol: candidate.baseSymbol, 
                                action: 'error',
                                error: createError?.message || 'Create failed'
                            })
                        }
                    }
                }
            } catch (error: any) {
                logger.warn(`[AdminAssets] ⚠️ Unexpected error processing ${candidate.baseSymbol}:`, error?.message)
                errors++
                results.push({ 
                    symbol: candidate.baseSymbol, 
                    action: 'error',
                    error: error?.message || 'Processing failed'
                })
            }
        }

        const duration = Date.now() - startTime
        logger.info(`[AdminAssets] ✅ Binance sync completed in ${duration}ms: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors, ${candidates.length} total symbols`)

        return c.json({
            success: true,
            synced: created + updated,
            created,
            updated,
            skipped,
            errors,
            total: candidates.length,
            processed: results.length,
            duration: `${duration}ms`,
            message: `Synced ${created + updated} assets from Binance (${created} new, ${updated} updated, ${skipped} skipped, ${errors} errors)`,
            results: errors > 0 ? results.filter(r => r.action === 'error').slice(0, 10) : undefined, // Show first 10 errors if any
        })
    } catch (error: any) {
        const duration = Date.now() - startTime
        logger.error('[AdminAssets] ❌ Binance sync error:', {
            message: error?.message,
            name: error?.name,
            code: error?.code,
            stack: error?.stack,
            duration: `${duration}ms`,
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

