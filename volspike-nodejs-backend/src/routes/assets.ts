import { Hono } from 'hono'
import { z } from 'zod'
import { createLogger } from '../lib/logger'
import { getAssetManifest, detectNewAssetsFromMarketData, refreshSingleAsset } from '../services/asset-metadata'
import { prisma } from '../index'

const logger = createLogger()
const assetsRoutes = new Hono()

// Public manifest – used by frontend to render project cards instantly without hitting CoinGecko
assetsRoutes.get('/manifest', async (c) => {
    try {
        const manifest = await getAssetManifest()
        
        return c.json({
            ...manifest,
            staleAfterMs: 7 * 24 * 60 * 60 * 1000,
        })
    } catch (error) {
        logger.error('[Assets] Manifest error', error)
        return c.json({ assets: [], error: 'Failed to load asset manifest' }, 500)
    }
})

// POST /api/assets/detect-new - Public endpoint for new asset detection (no admin auth required)
// This is called automatically by the frontend when Market Data contains new symbols
const detectNewSchema = z.object({
    symbols: z.array(z.string()).min(1),
})

assetsRoutes.post('/detect-new', async (c) => {
    try {
        const body = await c.req.json()
        const data = detectNewSchema.parse(body)

        const result = await detectNewAssetsFromMarketData(data.symbols)

        if (result.created > 0) {
            // Trigger automatic enrichment for newly created assets (non-blocking)
            process.nextTick(async () => {
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
                } catch (enrichError) {
                    logger.warn('[Assets] Background enrichment failed (non-critical):', enrichError)
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
        logger.error('[Assets] New asset detection error:', {
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

export { assetsRoutes }

