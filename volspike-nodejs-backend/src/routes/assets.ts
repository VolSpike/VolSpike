import { Hono } from 'hono'
import { createLogger } from '../lib/logger'
import { getAssetManifest } from '../services/asset-metadata'

const logger = createLogger()
const assetsRoutes = new Hono()

// Public manifest – used by frontend to render project cards instantly without hitting CoinGecko
assetsRoutes.get('/manifest', async (c) => {
    try {
        const manifest = await getAssetManifest()
        
        // Debug: Check 1000PEPE in manifest response
        const pepManifest = manifest.assets.find(a => a.baseSymbol.toUpperCase() === '1000PEPE')
        if (pepManifest) {
            logger.info('[Assets] 1000PEPE in manifest response:', {
                baseSymbol: pepManifest.baseSymbol,
                hasLogoUrl: !!pepManifest.logoUrl,
                logoUrlLength: pepManifest.logoUrl?.length || 0,
                logoUrlPreview: pepManifest.logoUrl?.substring(0, 50) || 'NULL',
                hasDescription: !!pepManifest.description,
                descriptionLength: pepManifest.description?.length || 0,
                descriptionPreview: pepManifest.description?.substring(0, 50) || 'NULL',
            })
        }
        
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

