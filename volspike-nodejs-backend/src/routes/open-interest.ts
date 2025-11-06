/**
 * Open Interest API Routes
 * 
 * POST /api/market/open-interest - Receive OI data from Digital Ocean script
 * GET /api/market/open-interest - Serve cached OI data to frontend
 */

import { Hono } from 'hono'
import { env } from 'hono/adapter'

const app = new Hono()

// In-memory cache for Open Interest data
interface OpenInterestCache {
  data: Record<string, number> // symbol -> openInterestUsd
  timestamp: string
  expiresAt: number // Unix timestamp in milliseconds
}

let oiCache: OpenInterestCache | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// POST endpoint - receives OI data from Digital Ocean script
app.post('/ingest', async (c) => {
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

    // Transform array to object map (symbol -> openInterestUsd)
    const oiMap: Record<string, number> = {}
    for (const item of body.data) {
      if (item.symbol && typeof item.openInterestUsd === 'number') {
        oiMap[item.symbol] = item.openInterestUsd
      }
    }

    // Update cache
    oiCache = {
      data: oiMap,
      timestamp: body.timestamp || new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL_MS
    }

    console.log(`✅ Open Interest cached: ${Object.keys(oiMap).length} symbols`)

    return c.json({
      success: true,
      cached: Object.keys(oiMap).length,
      expiresIn: CACHE_TTL_MS / 1000 // seconds
    })

  } catch (error) {
    console.error('❌ Open Interest ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET endpoint - serves cached OI data to frontend
app.get('/', async (c) => {
  try {
    // Check if cache exists and is not expired
    if (!oiCache || Date.now() > oiCache.expiresAt) {
      console.log('ℹ️  Open Interest cache expired or empty')
      return c.json({
        data: {},
        timestamp: null,
        cacheExpired: true
      })
    }

    // Return cached data
    return c.json({
      data: oiCache.data,
      timestamp: oiCache.timestamp,
      cacheExpiry: new Date(oiCache.expiresAt).toISOString(),
      totalSymbols: Object.keys(oiCache.data).length
    })

  } catch (error) {
    console.error('❌ Open Interest GET error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app

