import { Hono } from 'hono'
import { createLogger } from '../lib/logger'
import { getAssetManifest } from '../services/asset-metadata'

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

export { assetsRoutes }

