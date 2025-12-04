import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { TelegramService } from '../../services/telegram'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const adminTelegramRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Lazy initialization to avoid circular import issues
let telegramService: TelegramService | null = null
function getTelegramService(): TelegramService {
  if (!telegramService) {
    telegramService = new TelegramService(prisma)
  }
  return telegramService
}

// GET /api/admin/telegram/channels - Get all channels with stats
adminTelegramRoutes.get('/channels', async (c) => {
  try {
    const channels = await getTelegramService().getChannels()
    return c.json({ channels })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to get channels:', error)
    return c.json(
      {
        error: 'Failed to get channels',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// GET /api/admin/telegram/stats - Get overall stats
adminTelegramRoutes.get('/stats', async (c) => {
  try {
    const stats = await getTelegramService().getStats()
    return c.json({ stats })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to get stats:', error)
    return c.json(
      {
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// GET /api/admin/telegram/messages - Get messages with pagination
const messagesSchema = z.object({
  channelId: z.string().optional(),
  channelUsername: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  page: z.coerce.number().min(1).default(1),
})

adminTelegramRoutes.get('/messages', async (c) => {
  try {
    const query = c.req.query()
    const params = messagesSchema.parse(query)

    const { messages, total } = await getTelegramService().getMessages({
      channelId: params.channelId,
      channelUsername: params.channelUsername,
      limit: params.limit,
      page: params.page,
    })

    return c.json({
      messages,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to get messages:', error)
    return c.json(
      {
        error: 'Failed to get messages',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// PATCH /api/admin/telegram/channels/:id - Toggle channel enabled status
const toggleChannelSchema = z.object({
  enabled: z.boolean(),
})

adminTelegramRoutes.patch('/channels/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { enabled } = toggleChannelSchema.parse(body)

    const channel = await getTelegramService().toggleChannel(id, enabled)

    logger.info(`[AdminTelegram] Toggled channel @${channel.username} enabled=${enabled}`)

    return c.json({ channel })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to toggle channel:', error)
    return c.json(
      {
        error: 'Failed to toggle channel',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// DELETE /api/admin/telegram/channels/:id - Delete a channel and all its messages
adminTelegramRoutes.delete('/channels/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const result = await getTelegramService().deleteChannel(id)

    logger.info(
      `[AdminTelegram] Deleted channel @${result.username} and ${result.messagesDeleted} messages`
    )

    return c.json({
      success: true,
      message: `Deleted channel @${result.username} and ${result.messagesDeleted} messages`,
      ...result,
    })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to delete channel:', error)
    return c.json(
      {
        error: 'Failed to delete channel',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// POST /api/admin/telegram/cleanup - Delete old messages
const cleanupSchema = z.object({
  maxMessages: z.coerce.number().min(100).max(5000).default(1000),
})

adminTelegramRoutes.post('/cleanup', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { maxMessages } = cleanupSchema.parse(body)

    logger.info(`[AdminTelegram] Cleaning up messages (keeping last ${maxMessages} per channel)...`)
    const deleted = await getTelegramService().cleanupOldMessages(maxMessages)

    return c.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} messages (keeping last ${maxMessages} per channel)`,
    })
  } catch (error) {
    logger.error('[AdminTelegram] Failed to cleanup messages:', error)
    return c.json(
      {
        error: 'Failed to cleanup messages',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

export { adminTelegramRoutes }
