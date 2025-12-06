import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { refreshSingleAsset, runAssetRefreshCycle, detectNewAssetsFromMarketData, getRefreshProgress } from '../../services/asset-metadata'
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
    binanceSymbol: z.string().optional().nullable(),
    extraSymbols: z.array(z.string()).optional(), // If omitted, Zod treats as undefined (valid)
    coingeckoId: z.string().optional().nullable(),
    displayName: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    websiteUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().nullable(),
    twitterUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().nullable(),
    logoUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional().nullable(),
    status: z.enum(['AUTO', 'VERIFIED', 'HIDDEN']).optional(),
    isComplete: z.boolean().optional(), // Admin-reviewed and ready for weekly refresh cycles
    notes: z.string().optional().nullable(),
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
        logger.debug('[AdminAssets] Received save request:', {
            id: body.id,
            baseSymbol: body.baseSymbol,
            coingeckoId: body.coingeckoId,
            hasEditForm: !!body.baseSymbol,
        })
        
        // Normalize empty strings to null for optional fields before validation
        // Also ensure baseSymbol is present and not empty
        if (!body.baseSymbol || body.baseSymbol.trim() === '') {
            logger.warn('[AdminAssets] Missing or empty baseSymbol in request body:', {
                bodyKeys: Object.keys(body),
                body,
            })
            return c.json({ 
                error: 'Validation failed',
                details: 'baseSymbol is required and cannot be empty',
            }, 400)
        }
        
        const normalizedBody: any = {
            ...body,
            baseSymbol: body.baseSymbol.trim(), // Ensure baseSymbol is trimmed
        }
        
        // Normalize optional fields: empty strings → null, undefined → omit
        const optionalFields = ['websiteUrl', 'twitterUrl', 'logoUrl', 'coingeckoId', 'displayName', 'description', 'notes']
        for (const field of optionalFields) {
            if (body[field] === '' || body[field] === undefined) {
                normalizedBody[field] = null
            } else if (typeof body[field] === 'string') {
                normalizedBody[field] = body[field].trim() || null
            } else {
                normalizedBody[field] = body[field]
            }
        }
        
        // Handle extraSymbols specially: null → undefined (so Zod treats it as optional)
        // If it's an array, keep it; if null/undefined, omit it from the schema validation
        if (body.extraSymbols === null || body.extraSymbols === undefined) {
            // Omit from normalizedBody so Zod treats it as optional
            delete normalizedBody.extraSymbols
        } else if (Array.isArray(body.extraSymbols)) {
            normalizedBody.extraSymbols = body.extraSymbols
        } else {
            // Invalid type, set to empty array
            normalizedBody.extraSymbols = []
        }
        
        logger.debug('[AdminAssets] Normalized body:', {
            baseSymbol: normalizedBody.baseSymbol,
            coingeckoId: normalizedBody.coingeckoId,
        })
        
        const data = upsertSchema.parse(normalizedBody)

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
            description: data.description ?? null,
            websiteUrl: data.websiteUrl ?? null,
            twitterUrl: data.twitterUrl ?? null,
            logoUrl: data.logoUrl ?? null,
            status: data.status ?? 'AUTO',
            isComplete: data.isComplete ?? false, // Default to false if not provided
            notes: data.notes ?? null,
        }

        // IMPORTANT: Read old CoinGecko ID BEFORE updating, so we can detect changes
        let oldCoingeckoId: string | null = null
        if (data.id) {
            const existingAsset = await prisma.asset.findUnique({ where: { id: data.id } })
            oldCoingeckoId = existingAsset?.coingeckoId ?? null
        } else {
            const existingAsset = await prisma.asset.findUnique({ where: { baseSymbol: payload.baseSymbol } })
            oldCoingeckoId = existingAsset?.coingeckoId ?? null
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

        // Normalize null/undefined/empty string for comparison
        const normalizedOldId = (oldCoingeckoId || '').trim().toLowerCase()
        const normalizedNewId = (payload.coingeckoId || '').trim().toLowerCase()
        const coingeckoIdChanged = normalizedOldId !== normalizedNewId
        const coingeckoIdRemoved = normalizedOldId && !normalizedNewId // CoinGecko ID was removed
        // needsRefresh: CoinGecko ID exists AND (it changed OR it was just added)
        const needsRefresh = normalizedNewId && (coingeckoIdChanged || !normalizedOldId)
        
        logger.info(`[AdminAssets] Save asset ${asset.baseSymbol}`, {
            oldCoingeckoId: oldCoingeckoId,
            newCoingeckoId: payload.coingeckoId,
            normalizedOldId,
            normalizedNewId,
            coingeckoIdChanged,
            coingeckoIdRemoved,
            needsRefresh,
            wasAdded: !normalizedOldId && normalizedNewId,
            assetStatus: asset.status,
        })
        
        // If CoinGecko ID was removed, clear all CoinGecko-related data
        if (coingeckoIdRemoved) {
            logger.info(`[AdminAssets] CoinGecko ID removed for ${asset.baseSymbol} - clearing all CoinGecko data`)
            payload.displayName = null
            payload.description = null
            payload.websiteUrl = null
            payload.twitterUrl = null
            payload.logoUrl = null
            // Update asset with cleared data
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
            return c.json({ 
                asset, 
                needsRefresh: false,
                coingeckoIdRemoved: true,
            })
        }
        
        // Always refresh when CoinGecko ID is added/changed, regardless of status
        // (VERIFIED status only prevents auto-updates from refresh cycles, not manual admin edits)
        // IMPORTANT: Return immediately - refresh happens in background with retry logic
        if (needsRefresh) {
            logger.info(`[AdminAssets] ✅ Refresh will be triggered for ${asset.baseSymbol}`, {
                needsRefresh,
                oldCoingeckoId,
                newCoingeckoId: payload.coingeckoId,
            })
            
            // Trigger refresh in background with retry logic for rate limits
            // Use setImmediate instead of process.nextTick for better reliability
            setImmediate(async () => {
                const refreshStartTime = Date.now()
                try {
                    // Small delay to ensure database write is committed
                    await new Promise(resolve => setTimeout(resolve, 100))
                    
                    // Refetch asset from DB to ensure we have the latest CoinGecko ID
                    const latestAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
                    if (!latestAsset) {
                        logger.error(`[AdminAssets] ❌ Asset ${asset.baseSymbol} not found for refresh (ID: ${asset.id})`)
                        return
                    }
                    
                    logger.info(`[AdminAssets] 🔄 Starting auto-refresh for ${latestAsset.baseSymbol}`, {
                        oldCoingeckoId: oldCoingeckoId,
                        newCoingeckoId: latestAsset.coingeckoId,
                        assetId: latestAsset.id,
                    })
                    
                    // Retry logic: Keep trying until success or invalid ID confirmed
                    const MAX_RETRIES = 10 // Maximum retry attempts
                    const RETRY_DELAY_MS = 5000 // 5 seconds between retries
                    let retryCount = 0
                    let lastResult: { success: boolean; reason?: string; error?: string } | null = null
                    
                    while (retryCount < MAX_RETRIES) {
                        try {
                            // Refetch asset before each attempt to ensure we have latest CoinGecko ID
                            const currentAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
                            if (!currentAsset) {
                                logger.error(`[AdminAssets] ❌ Asset ${latestAsset.baseSymbol} disappeared during refresh`)
                                return
                            }
                            
                            // When CoinGecko ID changes, force refresh all fields (don't preserve old data from wrong ID)
                            const refreshResult = await refreshSingleAsset(currentAsset, true) // forceRefresh = true
                            
                            if (refreshResult.success) {
                                const elapsedMs = Date.now() - refreshStartTime
                                logger.info(`[AdminAssets] ✅ Auto-refreshed ${latestAsset.baseSymbol} successfully after ${retryCount} retries (${elapsedMs}ms)`)
                                return // Success - exit retry loop
                            }
                            
                            // If NOT_FOUND, CoinGecko ID is invalid - stop retrying
                            if (refreshResult.reason === 'NOT_FOUND') {
                                logger.warn(`[AdminAssets] Invalid CoinGecko ID for ${latestAsset.baseSymbol}: ${currentAsset.coingeckoId} - stopping retries`)
                                return // Invalid ID - exit retry loop (data already cleared by refreshSingleAsset)
                            }
                            
                            // If rate limit, wait and retry
                            if (refreshResult.reason === 'RATE_LIMIT') {
                                retryCount++
                                lastResult = refreshResult
                                logger.warn(`[AdminAssets] Rate limit hit for ${latestAsset.baseSymbol} (attempt ${retryCount}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`)
                                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                                continue // Retry
                            }
                            
                            // Other errors (network, timeout) - retry a few times then give up
                            retryCount++
                            lastResult = refreshResult
                            if (retryCount < MAX_RETRIES) {
                                logger.warn(`[AdminAssets] Refresh failed for ${latestAsset.baseSymbol} (attempt ${retryCount}/${MAX_RETRIES}): ${refreshResult.reason} - ${refreshResult.error}, retrying...`)
                                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                                continue
                            } else {
                                const elapsedMs = Date.now() - refreshStartTime
                                logger.error(`[AdminAssets] ❌ Failed to refresh ${latestAsset.baseSymbol} after ${MAX_RETRIES} attempts (${elapsedMs}ms): ${refreshResult.reason} - ${refreshResult.error}`)
                                return // Max retries reached
                            }
                        } catch (attemptError) {
                            retryCount++
                            logger.error(`[AdminAssets] Unexpected error during refresh attempt ${retryCount} for ${latestAsset.baseSymbol}:`, attemptError)
                            if (retryCount < MAX_RETRIES) {
                                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
                                continue
                            } else {
                                logger.error(`[AdminAssets] ❌ Failed to refresh ${latestAsset.baseSymbol} after ${MAX_RETRIES} attempts due to unexpected errors`)
                                return
                            }
                        }
                    }
                    
                    // Max retries reached
                    if (lastResult) {
                        const elapsedMs = Date.now() - refreshStartTime
                        logger.error(`[AdminAssets] ❌ Failed to refresh ${latestAsset.baseSymbol} after ${MAX_RETRIES} attempts (${elapsedMs}ms): ${lastResult.reason} - ${lastResult.error}`)
                    }
                } catch (error) {
                    const elapsedMs = Date.now() - refreshStartTime
                    logger.error(`[AdminAssets] ❌ Critical error during auto-refresh for ${asset.baseSymbol} (${elapsedMs}ms):`, {
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    })
                }
            })
        } else {
            logger.debug(`[AdminAssets] No refresh needed for ${asset.baseSymbol}`, {
                needsRefresh,
                oldCoingeckoId,
                newCoingeckoId: payload.coingeckoId,
            })
        }

        return c.json({ asset, needsRefresh })
    } catch (error) {
        logger.error('Admin asset upsert error:', error)
        
        // Provide detailed error message for validation errors
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            logger.warn(`[AdminAssets] Validation error: ${errorMessages}`)
            return c.json({ 
                error: 'Validation failed',
                details: errorMessages,
                errors: error.errors
            }, 400)
        }
        
        return c.json({ 
            error: 'Failed to save asset',
            details: error instanceof Error ? error.message : String(error)
        }, 500)
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
                const result = await refreshSingleAsset(asset)
                if (result.success) {
                    refreshed++
                    results.push({ symbol: asset.baseSymbol, success: true })
                } else {
                    results.push({ 
                        symbol: asset.baseSymbol, 
                        success: false, 
                        reason: result.reason || 'Unknown',
                        error: result.error 
                    })
                }
                // Small delay to respect CoinGecko rate limits
                await new Promise(resolve => setTimeout(resolve, 7000)) // ~8 calls/minute
            } catch (error) {
                logger.warn(`[AdminAssets] Failed to refresh ${asset.baseSymbol}:`, error)
                results.push({ 
                    symbol: asset.baseSymbol, 
                    success: false, 
                    reason: 'UNEXPECTED_ERROR',
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

// GET /api/admin/assets/refresh-status - Get current refresh cycle progress
adminAssetRoutes.get('/refresh-status', async (c) => {
    try {
        const progress = getRefreshProgress()
        return c.json({
            success: true,
            progress,
        })
    } catch (error) {
        logger.error('[AdminAssets] Failed to get refresh status:', error)
        return c.json(
            {
                error: 'Failed to get refresh status',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

// POST /api/admin/assets/refresh/cycle - Run scheduled refresh cycle (non-blocking)
adminAssetRoutes.post('/refresh/cycle', async (c) => {
    try {
        logger.info('[AdminAssets] Manual refresh cycle triggered')

        // Check if cycle is already running
        const currentProgress = getRefreshProgress()
        if (currentProgress.isRunning) {
            return c.json({
                success: false,
                message: 'Refresh cycle is already running',
                progress: currentProgress,
            })
        }

        // Start refresh cycle in background (non-blocking)
        runAssetRefreshCycle('manual').catch((error) => {
            logger.error('[AdminAssets] Background refresh cycle error:', error)
        })

        return c.json({
            success: true,
            message: 'Refresh cycle started in background',
            progress: getRefreshProgress(),
        })
    } catch (error) {
        logger.error('[AdminAssets] Failed to start refresh cycle:', error)
        return c.json(
            {
                error: 'Failed to start refresh cycle',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

// POST /api/admin/assets/populate-logo-urls - One-time script to populate logoImageUrl for all assets
adminAssetRoutes.post('/populate-logo-urls', async (c) => {
    try {
        logger.info('[AdminAssets] 🚀 Populate logoImageUrl triggered')

        // Find all assets that have coingeckoId but no logoImageUrl
        const assets = await prisma.asset.findMany({
            where: {
                coingeckoId: { not: null },
                OR: [
                    { logoImageUrl: null },
                    { logoImageUrl: '' },
                ],
            },
            select: {
                id: true,
                baseSymbol: true,
                coingeckoId: true,
                logoImageUrl: true,
            },
        })

        logger.info(`[AdminAssets] Found ${assets.length} assets that need logoImageUrl`)

        if (assets.length === 0) {
            return c.json({
                success: true,
                message: 'All assets already have logoImageUrl!',
                updated: 0,
                total: 0,
            })
        }

        // Start refresh in background (non-blocking)
        // Use refreshSingleAsset which already populates logoImageUrl
        Promise.all(
            assets.map(async (asset) => {
                try {
                    const fullAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
                    if (!fullAsset) return { symbol: asset.baseSymbol, success: false, error: 'Asset not found' }
                    
                    // Force refresh to populate logoImageUrl
                    const result = await refreshSingleAsset(fullAsset, true)
                    if (result.success) {
                        logger.info(`[AdminAssets] ✅ Populated logoImageUrl for ${asset.baseSymbol}`)
                        return { symbol: asset.baseSymbol, success: true }
                    } else {
                        logger.warn(`[AdminAssets] ⚠️  Failed to populate logoImageUrl for ${asset.baseSymbol}: ${result.reason}`)
                        return { symbol: asset.baseSymbol, success: false, reason: result.reason, error: result.error }
                    }
                } catch (error) {
                    logger.error(`[AdminAssets] ❌ Error populating logoImageUrl for ${asset.baseSymbol}:`, error)
                    return { 
                        symbol: asset.baseSymbol, 
                        success: false, 
                        error: error instanceof Error ? error.message : String(error) 
                    }
                }
            })
        ).catch((error) => {
            logger.error('[AdminAssets] Background populate logoImageUrl error:', error)
        })

        return c.json({ 
            success: true,
            message: `Started populating logoImageUrl for ${assets.length} assets in background`,
            total: assets.length,
            assets: assets.map(a => a.baseSymbol),
        })
    } catch (error) {
        logger.error('[AdminAssets] Failed to populate logoImageUrl:', error)
        return c.json(
            {
                error: 'Failed to populate logoImageUrl',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
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

        // Known Binance indices (not actual tokens) - filter these out
        const BINANCE_INDICES = new Set(['ALL', 'DEFI', 'ALT', 'BUSD', 'BTC', 'ETH', 'BNB', 'BTCDOM'])

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
            .filter((c) => {
                // Validate: baseSymbol must exist, binanceSymbol must exist and end with USDT
                if (!c.baseSymbol || !c.binanceSymbol) return false
                if (!c.binanceSymbol.endsWith('USDT')) return false
                
                // Filter out Binance indices (not actual tokens)
                if (BINANCE_INDICES.has(c.baseSymbol)) {
                    logger.debug(`[AdminAssets] Filtering out Binance index: ${c.baseSymbol}`)
                    return false
                }
                
                // Ensure binanceSymbol matches expected format (baseSymbol + USDT)
                const expectedSymbol = `${c.baseSymbol}USDT`
                if (c.binanceSymbol !== expectedSymbol) {
                    logger.warn(`[AdminAssets] Symbol mismatch: baseSymbol=${c.baseSymbol}, binanceSymbol=${c.binanceSymbol}, expected=${expectedSymbol}`)
                    return false
                }
                return true
            })

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

// POST /api/admin/assets/detect-new - Detect new assets from Market Data symbols
const detectNewSchema = z.object({
    symbols: z.array(z.string()).min(1),
})

adminAssetRoutes.post('/detect-new', async (c) => {
    try {
        const body = await c.req.json()
        const data = detectNewSchema.parse(body)

        logger.info('[AdminAssets] New asset detection requested', {
            symbolCount: data.symbols.length,
            sampleSymbols: data.symbols.slice(0, 5),
        })

        const result = await detectNewAssetsFromMarketData(data.symbols)

        if (result.created > 0) {
            // Trigger automatic enrichment for newly created assets (non-blocking)
            logger.info(`[AdminAssets] Triggering automatic enrichment for ${result.created} new assets`)
            setImmediate(async () => {
                try {
                    // Enrich new assets one by one, respecting rate limits
                    const newAssets = await prisma.asset.findMany({
                        where: {
                            baseSymbol: { in: result.newSymbols },
                        },
                    })

                    // Process enrichment with rate limiting (3s gap between requests)
                    for (let i = 0; i < newAssets.length; i++) {
                        const asset = newAssets[i]
                        await refreshSingleAsset(asset)
                        // Rate limit: wait 3 seconds between requests (except for last one)
                        if (i < newAssets.length - 1) {
                            await new Promise((resolve) => setTimeout(resolve, 3000))
                        }
                    }

                    logger.info(`[AdminAssets] ✅ Enriched ${newAssets.length} new assets`)
                } catch (enrichError) {
                    logger.warn('[AdminAssets] ⚠️ Background enrichment failed (non-critical):', enrichError)
                }
            })
        }

        return c.json({
            success: true,
            created: result.created,
            newSymbols: result.newSymbols,
            message: result.created > 0
                ? `Detected and created ${result.created} new assets. Enrichment started in background.`
                : 'No new assets detected.',
        })
    } catch (error) {
        logger.error('[AdminAssets] New asset detection error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
        return c.json(
            {
                error: 'Failed to detect new assets',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

// POST /api/admin/assets/cleanup-delisted
// Delete assets that are no longer trading on Binance (delisted)
// Associated notifications will be cascade deleted automatically
adminAssetRoutes.post('/cleanup-delisted', async (c) => {
    try {
        logger.info('[AdminAssets] POST /cleanup-delisted - Starting cleanup...')

        // Fetch Binance exchange info
        const BINANCE_FUTURES_INFO = process.env.BINANCE_PROXY_URL
            ? `${process.env.BINANCE_PROXY_URL}/fapi/v1/exchangeInfo`
            : 'https://fapi.binance.com/fapi/v1/exchangeInfo'

        logger.info(`[AdminAssets] Fetching Binance exchange info from: ${BINANCE_FUTURES_INFO}`)

        const response = await axios.get(BINANCE_FUTURES_INFO, {
            timeout: 30000,
            headers: { 'User-Agent': 'VolSpike/1.0' },
        })

        if (!response.data?.symbols || !Array.isArray(response.data.symbols)) {
            logger.error('[AdminAssets] Binance API returned unexpected format')
            return c.json({ error: 'Binance API returned unexpected format' }, 500)
        }

        // Create a Set of actively trading USDT perpetual base symbols
        const activeTradingSymbols = new Set(
            response.data.symbols
                .filter((s: any) =>
                    s?.contractType === 'PERPETUAL' &&
                    s?.quoteAsset === 'USDT' &&
                    s?.status === 'TRADING'
                )
                .map((s: any) => String(s.baseAsset || '').toUpperCase())
        )

        logger.info(`[AdminAssets] Found ${activeTradingSymbols.size} actively trading USDT perpetual symbols`)

        // Fetch all assets from database
        const allAssets = await prisma.asset.findMany({
            select: {
                id: true,
                baseSymbol: true,
            },
        })

        logger.info(`[AdminAssets] Found ${allAssets.length} assets in database`)

        // Identify delisted assets
        const delistedAssets = allAssets.filter((asset) => !activeTradingSymbols.has(asset.baseSymbol.toUpperCase()))

        if (delistedAssets.length === 0) {
            logger.info('[AdminAssets] No delisted assets found')
            return c.json({
                message: 'No delisted assets found',
                deletedAssets: 0,
                delistedSymbols: [],
            })
        }

        logger.info(`[AdminAssets] Found ${delistedAssets.length} delisted assets`, {
            delistedSymbols: delistedAssets.map((a) => a.baseSymbol).slice(0, 20),
        })

        // Delete delisted assets from database
        // This will CASCADE delete associated notifications automatically
        const delistedAssetIds = delistedAssets.map((a) => a.id)

        const deleteResult = await prisma.asset.deleteMany({
            where: {
                id: {
                    in: delistedAssetIds,
                },
            },
        })

        logger.info(`[AdminAssets] ✅ Deleted ${deleteResult.count} delisted assets from database`)

        return c.json({
            message: `Successfully deleted ${deleteResult.count} delisted assets`,
            deletedAssets: deleteResult.count,
            delistedSymbols: delistedAssets.map((a) => a.baseSymbol),
        })
    } catch (error) {
        logger.error('[AdminAssets] Failed to cleanup delisted assets', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        })
        return c.json(
            {
                error: 'Failed to cleanup delisted assets',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        )
    }
})

export { adminAssetRoutes }

