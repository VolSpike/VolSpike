/**
 * Open Interest API Routes
 * 
 * POST /api/market/open-interest/ingest - Receive OI data from Digital Ocean script
 * POST /api/market/open-interest         - Backward-compatible alias for ingest
 * GET /api/market/open-interest - Serve cached OI data to frontend (stale-while-revalidate)
 */

import { Hono } from 'hono'
import { env } from 'hono/adapter'

const app = new Hono()

// Constants
const FIVE_MIN_MS = 5 * 60 * 1000
const STALE_GRACE_MS = 90 * 1000 // Small buffer so UI doesn't flicker

// Normalize symbol: remove dashes/underscores and convert to uppercase
const normalizeSym = (s: string): string => {
  return s.replace(/[-_]/g, '').toUpperCase()
}

// In-memory cache for Open Interest data (stale-while-revalidate pattern)
interface OISnapshot {
  data: Record<string, number> // normalized symbol -> openInterestUsd
  updatedAt: number // epoch milliseconds
}

let oiCache: OISnapshot | null = null

// Shared handler for OI ingestion
const handleIngest = async (c: any) => {
  try {
    // Get API key from environment
    const { ALERT_INGEST_API_KEY } = env(c)

    // Validate API key
    const providedKey = c.req.header('X-API-Key')
    if (!providedKey || providedKey !== ALERT_INGEST_API_KEY) {
      console.log('⚠️  Open Interest ingest: Invalid API key')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Parse request body
    const body = await c.req.json()

    if (!body.data || !Array.isArray(body.data)) {
      console.log('⚠️  Open Interest ingest: Invalid payload')
      return c.json({ error: 'Invalid payload: data array required' }, 400)
    }

    // Transform array to object map with normalized symbols
    const oiMap: Record<string, number> = {}
    for (const item of body.data) {
      if (item.symbol && typeof item.openInterestUsd === 'number') {
        const normalizedKey = normalizeSym(item.symbol)
        oiMap[normalizedKey] = Number(item.openInterestUsd) || 0
      }
    }

    // Update cache with normalized symbols
    oiCache = {
      data: oiMap,
      updatedAt: Date.now()
    }

    const sampleEntries = Object.entries(oiMap).slice(0, 5).map(([sym, oi]) => `${sym}: $${oi.toLocaleString()}`)
    console.log(`✅ [Open Interest Debug] Cached ${Object.keys(oiMap).length} symbols`, {
      sample: sampleEntries,
      timestamp: new Date().toISOString()
    })

    return c.json({
      success: true,
      cached: Object.keys(oiMap).length
    })

  } catch (error) {
    console.error('❌ Open Interest ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// POST endpoint - receives OI data from Digital Ocean script
app.post('/ingest', handleIngest)

// Backward-compatible alias: allow POST to root as ingest
app.post('/', handleIngest)

// GET endpoint - serves cached OI data with stale-while-revalidate semantics
app.get('/', async (c) => {
  try {
    // Always return last known data if available (never return empty {} when we have data)
    if (!oiCache) {
      console.log('ℹ️  [Open Interest Debug] Cache empty - returning empty response')
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

    // Enhanced logging for debugging
    const cacheKeys = Object.keys(oiCache.data)
    const sampleData = cacheKeys.slice(0, 5).map(key => ({
      symbol: key,
      oiUsd: oiCache!.data[key]
    }))
    
    console.log('📊 [Open Interest Debug] GET request:', {
      updatedAt: new Date(oiCache.updatedAt).toISOString(),
      count: cacheKeys.length,
      sample: sampleData,
      ageSeconds: Math.floor(age / 1000),
      stale,
      dangerouslyStale,
      userAgent: c.req.header('user-agent')?.substring(0, 50)
    })

    // Always return last known data; let client decide how to render stale
    return c.json({
      data: oiCache.data,
      stale,
      asOf: oiCache.updatedAt,
      dangerouslyStale
    })

  } catch (error) {
    console.error('❌ [Open Interest Debug] GET error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
