import { Hono } from 'hono'
import { prisma } from '../index'
import { z } from 'zod'
import { createLogger } from '../lib/logger'
import { requireUser } from '../lib/hono-extensions'
import { broadcastVolumeAlert } from '../services/alert-broadcaster'

const logger = createLogger()

const volumeAlertsRouter = new Hono()

// Schema for incoming alerts from Digital Ocean
const ingestAlertSchema = z.object({
  symbol: z.string(),
  asset: z.string(),
  currentVolume: z.number(),
  previousVolume: z.number(),
  volumeRatio: z.number(),
  price: z.number().optional(),
  fundingRate: z.number().optional(),
  candleDirection: z.enum(['bullish', 'bearish']).optional(),
  message: z.string(),
  timestamp: z.string().datetime(),
  hourTimestamp: z.string().datetime(),
  isUpdate: z.boolean().optional(),
  alertType: z.enum(['SPIKE', 'HALF_UPDATE', 'FULL_UPDATE']).optional(),
})

// Middleware: Verify API key from Digital Ocean
const verifyIngestAuth = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key')
  const expectedKey = process.env.ALERT_INGEST_API_KEY
  
  if (!expectedKey) {
    logger.error('ALERT_INGEST_API_KEY not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('Unauthorized alert ingest attempt')
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  await next()
}

// POST /api/volume-alerts/ingest - Receive alerts from Digital Ocean
volumeAlertsRouter.post('/ingest', verifyIngestAuth, async (c) => {
  try {
    const body = await c.req.json()
    const data = ingestAlertSchema.parse(body)
    
    // Store in database
    const alert = await prisma.volumeAlert.create({
      data: {
        symbol: data.symbol,
        asset: data.asset,
        currentVolume: data.currentVolume,
        previousVolume: data.previousVolume,
        volumeRatio: data.volumeRatio,
        price: data.price,
        fundingRate: data.fundingRate,
        candleDirection: data.candleDirection,
        message: data.message,
        timestamp: new Date(data.timestamp),
        hourTimestamp: new Date(data.hourTimestamp),
        isUpdate: data.isUpdate || false,
        alertType: data.alertType || 'SPIKE',
      }
    })
    
    logger.info(`Volume alert ingested: ${data.asset} (${data.volumeRatio.toFixed(2)}x)`)
    
    // Broadcast to all connected WebSocket clients in real-time
    broadcastVolumeAlert(alert)
    
    return c.json({ success: true, alertId: alert.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Invalid alert data:', error.errors)
      return c.json({ error: 'Invalid alert data', details: error.errors }, 400)
    }
    
    logger.error('Failed to ingest alert:', error)
    return c.json({ error: 'Failed to process alert' }, 500)
  }
})

// GET /api/volume-alerts - Fetch recent alerts (tier-based, public)
volumeAlertsRouter.get('/', async (c) => {
  try {
    // Get tier from query parameter (for unauthenticated access)
    // or from authenticated user if available
    const tierParam = c.req.query('tier') || 'free'
    const tier = ['free', 'pro', 'elite'].includes(tierParam) ? tierParam : 'free'

    // Tier-based limits
    const limits: Record<string, number> = {
      free: 10,
      pro: 50,
      elite: 100,
    }

    const limit = limits[tier] || 10
    const symbol = c.req.query('symbol') // Optional filter

    // Calculate the last broadcast time based on tier
    // This ensures users only see alerts that have been broadcasted to their tier
    const now = new Date()
    const currentMinute = now.getMinutes()
    let lastBroadcastTime: Date

    if (tier === 'elite') {
      // Elite sees everything in real-time
      lastBroadcastTime = now
    } else if (tier === 'pro') {
      // Pro tier: broadcasts at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
      // Find the last completed 5-minute interval
      const lastBroadcastMinute = Math.floor(currentMinute / 5) * 5
      lastBroadcastTime = new Date(now)
      lastBroadcastTime.setMinutes(lastBroadcastMinute, 0, 0)
    } else {
      // Free tier: broadcasts at :00, :15, :30, :45
      // Find the last completed 15-minute interval
      const lastBroadcastMinute = Math.floor(currentMinute / 15) * 15
      lastBroadcastTime = new Date(now)
      lastBroadcastTime.setMinutes(lastBroadcastMinute, 0, 0)
    }

    logger.info(`Fetching alerts for tier=${tier}, lastBroadcastTime=${lastBroadcastTime.toISOString()}`)

    const alerts = await prisma.volumeAlert.findMany({
      where: {
        ...(symbol ? { symbol } : {}),
        // Only return alerts from completed broadcast intervals
        timestamp: {
          lte: lastBroadcastTime,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    return c.json({ alerts, tier, limit, lastBroadcastTime: lastBroadcastTime.toISOString() })
  } catch (error) {
    logger.error('Failed to fetch alerts:', error)
    return c.json({ error: 'Failed to fetch alerts' }, 500)
  }
})

// GET /api/volume-alerts/recent - Get most recent alerts with filtering
volumeAlertsRouter.get('/recent', async (c) => {
  try {
    const hoursParam = c.req.query('hours')
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24
    const limit = parseInt(c.req.query('limit') || '50', 10)
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const alerts = await prisma.volumeAlert.findMany({
      where: {
        timestamp: {
          gte: since,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 100), // Cap at 100
    })
    
    return c.json({ alerts, hours, count: alerts.length })
  } catch (error) {
    logger.error('Failed to fetch recent alerts:', error)
    return c.json({ error: 'Failed to fetch recent alerts' }, 500)
  }
})

// GET /api/volume-alerts/subscriptions - Get user's alert subscriptions
volumeAlertsRouter.get('/subscriptions', async (c) => {
  try {
    const user = requireUser(c)
    
    const subscriptions = await prisma.alertSubscription.findMany({
      where: { userId: user.id },
    })
    
    return c.json({ subscriptions })
  } catch (error) {
    logger.error('Failed to fetch subscriptions:', error)
    return c.json({ error: 'Failed to fetch subscriptions' }, 500)
  }
})

// POST /api/volume-alerts/subscriptions - Subscribe to symbol alerts (Pro/Elite)
volumeAlertsRouter.post('/subscriptions', async (c) => {
  try {
    const user = requireUser(c)
    
    if (user.tier === 'free') {
      return c.json({ error: 'Pro or Elite tier required' }, 403)
    }
    
    const body = await c.req.json()
    const { symbol } = z.object({ symbol: z.string() }).parse(body)
    
    const subscription = await prisma.alertSubscription.upsert({
      where: {
        userId_symbol: {
          userId: user.id,
          symbol,
        },
      },
      create: {
        userId: user.id,
        symbol,
      },
      update: {},
    })
    
    return c.json({ subscription })
  } catch (error) {
    logger.error('Failed to create subscription:', error)
    return c.json({ error: 'Failed to create subscription' }, 500)
  }
})

// DELETE /api/volume-alerts/subscriptions/:symbol - Unsubscribe from symbol alerts
volumeAlertsRouter.delete('/subscriptions/:symbol', async (c) => {
  try {
    const user = requireUser(c)
    const symbol = c.req.param('symbol')
    
    await prisma.alertSubscription.deleteMany({
      where: {
        userId: user.id,
        symbol,
      },
    })
    
    return c.json({ success: true })
  } catch (error) {
    logger.error('Failed to delete subscription:', error)
    return c.json({ error: 'Failed to delete subscription' }, 500)
  }
})

export default volumeAlertsRouter

