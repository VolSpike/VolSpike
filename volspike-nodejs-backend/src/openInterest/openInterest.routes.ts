/**
 * Open Interest Routes
 * 
 * API routes for Open Interest ingestion, alerts, and liquid universe management.
 * This module extends the existing open-interest.ts route with new realtime features.
 * 
 * Routes:
 * - POST /api/market/open-interest/ingest - Ingest OI data (snapshot or realtime)
 * - POST /api/open-interest-alerts/ingest - Ingest OI spike/dump alerts
 * - GET /api/market/open-interest/liquid-universe - Get current liquid universe
 * - GET /api/market/open-interest/samples - Get recent OI samples (debug)
 * - GET /api/open-interest-alerts - Get recent OI alerts (debug)
 */

import { Hono } from 'hono'
import { ingestOpenInterest, ingestOpenInterestAlert, getOpenInterestSamples, getOpenInterestAlerts } from './openInterest.service'
import type { OpenInterestIngestRequest, OpenInterestAlertInput, OISampleQueryParams, OIAlertQueryParams } from './openInterest.types'
import { createLogger } from '../lib/logger'

const logger = createLogger()
const app = new Hono()

/**
 * POST /api/market/open-interest/ingest
 * 
 * Ingest Open Interest data (supports both legacy snapshots and realtime batches)
 */
app.post('/ingest', async (c) => {
  try {
    // Validate API key (same as existing open-interest.ts)
    const ALERT_INGEST_API_KEY = process.env.ALERT_INGEST_API_KEY
    if (!ALERT_INGEST_API_KEY) {
      logger.error('Open Interest ingest error: ALERT_INGEST_API_KEY not configured')
      return c.json({ error: 'Server configuration error' }, 500)
    }

    const providedKey = c.req.header('X-API-Key')
    if (!providedKey || providedKey !== ALERT_INGEST_API_KEY) {
      logger.warn('Open Interest ingest: Invalid API key')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Parse request body
    const body = await c.req.json() as OpenInterestIngestRequest

    if (!body.data || !Array.isArray(body.data)) {
      return c.json({ error: 'Invalid payload: data array required' }, 400)
    }

    // Ingest OI data
    const result = await ingestOpenInterest(body)

    return c.json({
      success: result.success,
      inserted: result.inserted,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    logger.error('Open Interest ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/open-interest-alerts/ingest
 * 
 * Ingest Open Interest spike/dump alerts
 */
app.post('/alerts/ingest', async (c) => {
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

    return c.json({
      success: result.success,
      id: result.id,
    })
  } catch (error) {
    logger.error('Open Interest alert ingest error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/market/open-interest/liquid-universe
 * 
 * Get current liquid universe (debug endpoint)
 * TODO: Implement in Step 5
 */
app.get('/liquid-universe', async (c) => {
  // Placeholder - will be implemented in Step 5
  return c.json({
    updatedAt: new Date().toISOString(),
    enterThreshold: 4000000, // 4M USDT
    exitThreshold: 2000000, // 2M USDT
    symbols: [],
    totalSymbols: 0,
  })
})

/**
 * GET /api/market/open-interest/samples
 * 
 * Get recent Open Interest samples (debug endpoint)
 */
app.get('/samples', async (c) => {
  try {
    const symbol = c.req.query('symbol')
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50
    const source = c.req.query('source') as 'snapshot' | 'realtime' | 'all' | undefined

    const params: OISampleQueryParams = {
      symbol,
      limit,
      source: source || 'all',
    }

    const samples = await getOpenInterestSamples(params)

    return c.json({
      samples,
      count: samples.length,
    })
  } catch (error) {
    logger.error('Open Interest samples fetch error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/open-interest-alerts
 * 
 * Get recent Open Interest alerts (debug endpoint)
 */
app.get('/alerts', async (c) => {
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
})

export default app

