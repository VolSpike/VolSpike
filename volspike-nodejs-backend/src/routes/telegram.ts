import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { TelegramService } from '../services/telegram'

const logger = createLogger()

const telegramRouter = new Hono()

// Lazy initialization
let telegramService: TelegramService | null = null
function getTelegramService(): TelegramService {
  if (!telegramService) {
    telegramService = new TelegramService(prisma)
  }
  return telegramService
}

// Schema for incoming messages from Digital Ocean Pyrogram poller
const ingestSchema = z.object({
  channel: z.object({
    id: z.number().or(z.bigint()),
    username: z.string(),
    title: z.string(),
  }),
  messages: z.array(
    z.object({
      id: z.number().or(z.bigint()),
      text: z.string().nullable(),
      date: z.string().datetime(),
      sender_name: z.string().nullable(),
      views: z.number().nullable(),
      forwards: z.number().nullable(),
      has_media: z.boolean().default(false),
      media_type: z.string().nullable(),
    })
  ),
})

// Middleware: Verify API key from Digital Ocean
const verifyIngestAuth = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key')
  const expectedKey = process.env.ALERT_INGEST_API_KEY // Reuse existing key

  if (!expectedKey) {
    logger.error('ALERT_INGEST_API_KEY not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('Unauthorized telegram ingest attempt')
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}

// POST /api/telegram/ingest - Receive messages from Digital Ocean Pyrogram poller
telegramRouter.post('/ingest', verifyIngestAuth, async (c) => {
  try {
    const body = await c.req.json()
    const data = ingestSchema.parse(body)

    const result = await getTelegramService().ingestMessages(data.channel, data.messages)

    if (result.success) {
      return c.json({
        success: true,
        inserted: result.inserted,
        duplicates: result.duplicates,
        errors: result.errors,
      })
    } else {
      return c.json(
        {
          success: false,
          error: 'Failed to ingest messages',
          inserted: result.inserted,
          errors: result.errors,
        },
        500
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Invalid telegram message data:', error.errors)
      return c.json({ error: 'Invalid message data', details: error.errors }, 400)
    }

    logger.error('Failed to ingest telegram messages:', error)
    return c.json({ error: 'Failed to process messages' }, 500)
  }
})

// Health check endpoint for Digital Ocean poller
telegramRouter.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

export { telegramRouter }
