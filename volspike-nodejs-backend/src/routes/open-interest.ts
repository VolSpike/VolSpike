/**
 * Open Interest API Routes
 * 
 * POST /api/market/open-interest/ingest - Receive OI data from Digital Ocean script or realtime poller
 * POST /api/market/open-interest         - Backward-compatible alias for ingest
 * GET /api/market/open-interest - Serve cached OI data to frontend (stale-while-revalidate)
 */

import { Hono } from 'hono'
import { ingestOpenInterest, ingestOpenInterestAlert, getOpenInterestAlerts } from '../openInterest/openInterest.service'
import type { OpenInterestIngestRequest, OpenInterestAlertInput, OIAlertQueryParams } from '../openInterest/openInterest.types'
import { createLogger } from '../lib/logger'
import { broadcastOpenInterestAlert, broadcastOpenInterestUpdate } from '../services/alert-broadcaster'
import { getLiquidUniverseForAPI } from '../services/oi-liquidity-job'
import { prisma } from '../index'

const logger = createLogger()
const app = new Hono()

// Constants
const FIVE_MIN_MS = 5 * 60 * 1000
const STALE_GRACE_MS = 90 * 1000 // Small buffer so UI doesn't flicker

// Normalize symbol: remove dashes/underscores and convert to uppercase
const normalizeSym = (s: string): string => {
  return s.replace(/[-_]/g, '').toUpperCase()
}

// In-memory cache for Open Interest data (stale-while-revalidate pattern)
// This cache is maintained for backward compatibility with the GET endpoint
interface OISnapshot {
  data: Record<string, number> // normalized symbol -> openInterestUsd
  updatedAt: number // epoch milliseconds
}

let oiCache: OISnapshot | null = null

// Shared handler for OI ingestion
const handleIngest = async (c: any) => {
  try {
    // Get API key from environment (Node.js runtime)
    const ALERT_INGEST_API_KEY = process.env.ALERT_INGEST_API_KEY
    if (!ALERT_INGEST_API_KEY) {
      logger.error('Open Interest ingest error: ALERT_INGEST_API_KEY not configured')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    // Validate API key (must match DigitalOcean script)
    const providedKey = c.req.header('X-API-Key')
    if (!providedKey || providedKey !== ALERT_INGEST_API_KEY) {
      logger.warn('Open Interest ingest: Invalid API key')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Parse request body
    const body = await c.req.json() as OpenInterestIngestRequest

    if (!body.data || !Array.isArray(body.data)) {
      logger.warn('Open Interest ingest: Invalid payload - data array required')
      return c.json({ error: 'Invalid payload: data array required' }, 400)
    }

    // Transform and validate data for database storage
    // The Python script sends: symbol, openInterest (contracts), openInterestUsd, markPrice
    // We need to ensure openInterest is present (required field)
    const validatedData = body.data
      .filter((item) => {
        // Filter out items missing required fields
        if (!item.symbol) {
          return false
        }
        // openInterest is required - if missing, try to compute from openInterestUsd and markPrice
        if (typeof item.openInterest !== 'number') {
          if (typeof item.openInterestUsd === 'number' && typeof item.markPrice === 'number' && item.markPrice > 0) {
            // Compute openInterest from openInterestUsd / markPrice
            item.openInterest = item.openInterestUsd / item.markPrice
          } else {
            // Skip if we can't compute it
            logger.warn(`Skipping ${item.symbol}: missing openInterest and cannot compute`)
            return false
          }
        }
        return true
      })
      .map((item) => ({
        symbol: item.symbol,
        openInterest: item.openInterest!,
        openInterestUsd: item.openInterestUsd,
        markPrice: item.markPrice,
      }))

    if (validatedData.length === 0) {
      logger.warn('Open Interest ingest: No valid data items after validation')
      return c.json({ error: 'No valid data items' }, 400)
    }

    // Store in database using the new service
    const ingestRequest: OpenInterestIngestRequest = {
      data: validatedData,
      timestamp: body.timestamp,
      totalSymbols: body.totalSymbols,
      source: body.source || 'snapshot', // Default to 'snapshot' for backward compatibility
    }

    const result = await ingestOpenInterest(ingestRequest)

    // Update in-memory cache for backward compatibility with GET endpoint
    // Cache uses openInterestUsd (or computes it if missing)
    const oiMap: Record<string, number> = {}
    for (const item of validatedData) {
      const normalizedKey = normalizeSym(item.symbol)
      if (typeof item.openInterestUsd === 'number') {
        oiMap[normalizedKey] = item.openInterestUsd
      } else if (typeof item.openInterest === 'number' && typeof item.markPrice === 'number') {
        // Compute USD if not provided
        oiMap[normalizedKey] = item.openInterest * item.markPrice
      }
    }

    oiCache = {
      data: oiMap,
      updatedAt: Date.now(),
    }

    logger.info(`Open Interest ingestion complete: ${result.inserted} inserted, ${result.errors.length} errors`, {
      source: ingestRequest.source,
      cached: Object.keys(oiMap).length,
    })

    // Broadcast OI updates via WebSocket (for realtime source only, to avoid spam)
    if (ingestRequest.source === 'realtime') {
      for (const item of validatedData) {
        const normalizedKey = normalizeSym(item.symbol)
        const oiUsd = item.openInterestUsd ?? (item.openInterest * (item.markPrice || 0))
        broadcastOpenInterestUpdate(
          normalizedKey,
          item.openInterest,
          oiUsd > 0 ? oiUsd : null,
          'realtime'
        )
      }
    }

    return c.json({
      success: result.success,
      inserted: result.inserted,
      cached: Object.keys(oiMap).length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    logger.error('Open Interest ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// POST endpoint - receives OI data from Digital Ocean script
app.post('/ingest', handleIngest)

// Backward-compatible alias: allow POST to root as ingest
app.post('/', handleIngest)

/**
 * POST /api/market/open-interest/liquid-universe/update
 * 
 * Update liquid universe (called from Digital Ocean script)
 * Requires API key authentication
 */
app.post('/liquid-universe/update', async (c) => {
  try {
    // Validate API key
    const ALERT_INGEST_API_KEY = process.env.ALERT_INGEST_API_KEY
    if (!ALERT_INGEST_API_KEY) {
      logger.error('Liquid universe update: ALERT_INGEST_API_KEY not configured')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    const providedKey = c.req.header('X-API-Key')
    if (!providedKey || providedKey !== ALERT_INGEST_API_KEY) {
      logger.warn('Liquid universe update: Invalid API key')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Parse request body
    const body = await c.req.json()
    const symbols = body.symbols || []
    const updatedAt = body.updatedAt ? new Date(body.updatedAt) : new Date()

    // Store/update liquid universe
    const now = new Date()
    let upserted = 0

    for (const symbolData of symbols) {
      const symbol = symbolData.symbol
      const quoteVolume24h = parseFloat(symbolData.quoteVolume24h) || 0
      const enteredAt = symbolData.enteredAt ? new Date(symbolData.enteredAt) : now
      const lastSeenAt = symbolData.lastSeenAt ? new Date(symbolData.lastSeenAt) : now

      const existing = await prisma.openInterestLiquidSymbol.findUnique({
        where: { symbol },
      })

      if (existing) {
        await prisma.openInterestLiquidSymbol.update({
          where: { symbol },
          data: {
            quoteVolume24h,
            lastSeenAt,
          },
        })
      } else {
        await prisma.openInterestLiquidSymbol.create({
          data: {
            symbol,
            quoteVolume24h,
            enteredAt,
            lastSeenAt,
          },
        })
      }
      upserted++
    }

    // Remove symbols not in the update
    const symbolsInUpdate = new Set(symbols.map((s: any) => s.symbol))
    const symbolsToRemove = await prisma.openInterestLiquidSymbol.findMany({
      where: {
        symbol: {
          notIn: Array.from(symbolsInUpdate) as string[],
        },
      },
    })

    if (symbolsToRemove.length > 0) {
      const symbolsToRemoveList = symbolsToRemove.map((s) => s.symbol)
      await prisma.openInterestLiquidSymbol.deleteMany({
        where: {
          symbol: {
            in: symbolsToRemoveList,
          },
        },
      })
      logger.info(`Removed ${symbolsToRemove.length} symbols from liquid universe`)
    }

    logger.info(`✅ Liquid universe updated: ${upserted} symbols, ${symbolsToRemove.length} removed`)

    return c.json({
      success: true,
      upserted,
      removed: symbolsToRemove.length,
      totalSymbols: upserted,
    })
  } catch (error) {
    logger.error('Failed to update liquid universe:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/market/open-interest/liquid-universe
 * 
 * Get current liquid universe (public endpoint, no auth required)
 */
app.get('/liquid-universe', async (c) => {
  try {
    const result = await getLiquidUniverseForAPI()
    return c.json(result)
  } catch (error) {
    logger.error('Failed to fetch liquid universe:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET endpoint - serves cached OI data with stale-while-revalidate semantics
app.get('/', async (c) => {
  try {
    // Always return last known data if available (never return empty {} when we have data)
    if (!oiCache) {
      return c.json({
        data: {},
        stale: true,
        asOf: null,
        dangerouslyStale: true
      })
    }

    const age = Date.now() - oiCache.updatedAt
    const stale = age > FIVE_MIN_MS
    const dangerouslyStale = age > (FIVE_MIN_MS + STALE_GRACE_MS)

    // Always return last known data; let client decide how to render stale
    return c.json({
      data: oiCache.data,
      stale,
      asOf: oiCache.updatedAt,
      dangerouslyStale
    })

  } catch (error) {
    console.error('❌ Open Interest GET error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/open-interest-alerts/ingest
 * 
 * Ingest Open Interest spike/dump alerts
 * Note: This route is mounted separately at /api/open-interest-alerts
 */
export const handleAlertIngest = async (c: any) => {
  try {
    // Validate API key
    const ALERT_INGEST_API_KEY = process.env.ALERT_INGEST_API_KEY
    if (!ALERT_INGEST_API_KEY) {
      logger.error('Open Interest alert ingest error: ALERT_INGEST_API_KEY not configured')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    const providedKey = c.req.header('X-API-Key')
    if (!providedKey || providedKey !== ALERT_INGEST_API_KEY) {
      logger.warn('Open Interest alert ingest: Invalid API key')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Parse request body
    const body = await c.req.json() as OpenInterestAlertInput

    // Validate required fields
    if (!body.symbol || !body.direction || typeof body.baseline !== 'number' || typeof body.current !== 'number') {
      return c.json({ error: 'Invalid payload: missing required fields' }, 400)
    }

    // Ingest alert
    const result = await ingestOpenInterestAlert(body)

    // Broadcast alert via WebSocket if successful
    if (result.success && result.id) {
      try {
        const alert = await prisma.openInterestAlert.findUnique({
          where: { id: result.id },
        })
        if (alert) {
          broadcastOpenInterestAlert(alert)
        }
      } catch (error) {
        logger.warn('Failed to fetch alert for broadcasting:', error)
        // Don't fail the request if broadcasting fails
      }
    }

    return c.json({
      success: result.success,
      id: result.id,
    })
  } catch (error) {
    logger.error('Open Interest alert ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

/**
 * GET /api/open-interest-alerts
 * 
 * Get recent Open Interest alerts (debug endpoint)
 */
export const handleGetAlerts = async (c: any) => {
  try {
    const symbol = c.req.query('symbol')
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 20
    const direction = c.req.query('direction') as 'UP' | 'DOWN' | undefined

    const params: OIAlertQueryParams = {
      symbol,
      limit,
      direction,
    }

    const alerts = await getOpenInterestAlerts(params)

    return c.json({
      alerts,
      count: alerts.length,
    })
  } catch (error) {
    logger.error('Open Interest alerts fetch error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

export default app
