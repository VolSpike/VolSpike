import { PrismaClient } from '@prisma/client'
import { createLogger } from '../lib/logger'

const logger = createLogger()

// Type definitions for Telegram models (mirrors Prisma schema)
export interface TelegramChannel {
  id: string
  channelId: bigint
  username: string
  title: string
  category: string
  enabled: boolean
  lastFetchAt: Date | null
  errorCount: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TelegramMessage {
  id: string
  channelId: string
  messageId: bigint
  text: string | null
  date: Date
  senderName: string | null
  views: number | null
  forwards: number | null
  hasMedia: boolean
  mediaType: string | null
  createdAt: Date
}

export interface IngestChannelData {
  id: number | bigint
  username: string
  title: string
  category?: string
}

export interface IngestMessageData {
  id: number | bigint
  text: string | null
  date: string | Date
  sender_name: string | null
  views: number | null
  forwards: number | null
  has_media: boolean
  media_type: string | null
}

export interface IngestResult {
  success: boolean
  inserted: number
  duplicates: number
  errors: number
}

export interface GetMessagesOptions {
  channelId?: string
  channelUsername?: string
  limit?: number
  page?: number
  before?: Date
}

export interface ChannelWithStats extends TelegramChannel {
  _count?: {
    messages: number
  }
}

export class TelegramService {
  private prisma: PrismaClient
  private get db(): any {
    return this.prisma as any
  }

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Ingest messages from Telegram poller
   */
  async ingestMessages(
    channelData: IngestChannelData,
    messages: IngestMessageData[]
  ): Promise<IngestResult> {
    let inserted = 0
    let duplicates = 0
    let errors = 0

    try {
      // Upsert channel first
      const channel = await this.db.telegramChannel.upsert({
        where: { channelId: BigInt(channelData.id) },
        update: {
          username: channelData.username,
          title: channelData.title,
          category: channelData.category || 'general',
          lastFetchAt: new Date(),
          errorCount: 0,
          lastError: null,
        },
        create: {
          channelId: BigInt(channelData.id),
          username: channelData.username,
          title: channelData.title,
          category: channelData.category || 'general',
          enabled: true,
          lastFetchAt: new Date(),
        },
      })

      // Insert messages
      for (const msg of messages) {
        try {
          const messageDate = typeof msg.date === 'string' ? new Date(msg.date) : msg.date

          await this.db.telegramMessage.upsert({
            where: {
              channelId_messageId: {
                channelId: channel.id,
                messageId: BigInt(msg.id),
              },
            },
            update: {
              text: msg.text,
              views: msg.views,
              forwards: msg.forwards,
            },
            create: {
              channelId: channel.id,
              messageId: BigInt(msg.id),
              text: msg.text,
              date: messageDate,
              senderName: msg.sender_name,
              views: msg.views,
              forwards: msg.forwards,
              hasMedia: msg.has_media || false,
              mediaType: msg.media_type,
            },
          })
          inserted++
        } catch (err: any) {
          if (err.code === 'P2002') {
            duplicates++
          } else {
            errors++
            logger.warn(`[TelegramService] Error storing message ${msg.id}:`, err)
          }
        }
      }

      logger.info(
        `[TelegramService] Ingested ${inserted} messages for @${channelData.username} (${duplicates} duplicates, ${errors} errors)`
      )

      // Auto-cleanup: keep only last 1000 messages per channel
      await this.cleanupOldMessages(1000)

      return { success: true, inserted, duplicates, errors }
    } catch (error) {
      logger.error('[TelegramService] Ingest failed:', error)
      return { success: false, inserted, duplicates, errors: errors + 1 }
    }
  }

  /**
   * Get all channels with message counts
   */
  async getChannels(): Promise<ChannelWithStats[]> {
    const channels = await this.db.telegramChannel.findMany({
      orderBy: { lastFetchAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    // Convert BigInt to string for JSON serialization
    return channels.map((ch: any) => ({
      ...ch,
      channelId: ch.channelId.toString(),
    }))
  }

  /**
   * Get messages with pagination
   */
  async getMessages(
    options: GetMessagesOptions = {}
  ): Promise<{ messages: (TelegramMessage & { channel: TelegramChannel })[]; total: number }> {
    const { channelId, channelUsername, limit = 50, page = 1, before } = options

    const where: any = {}

    if (channelId) {
      where.channelId = channelId
    }

    if (channelUsername) {
      where.channel = {
        username: channelUsername,
      }
    }

    if (before) {
      where.date = { lt: before }
    }

    const [messages, total] = await Promise.all([
      this.db.telegramMessage.findMany({
        where,
        include: {
          channel: true,
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.telegramMessage.count({ where }),
    ])

    // Convert BigInt to string for JSON serialization
    const serializedMessages = messages.map((msg: any) => ({
      ...msg,
      messageId: msg.messageId.toString(),
      channel: {
        ...msg.channel,
        channelId: msg.channel.channelId.toString(),
      },
    }))

    return { messages: serializedMessages, total }
  }

  /**
   * Clean up old messages, keeping only the most recent N per channel
   */
  async cleanupOldMessages(maxMessagesPerChannel: number = 1000): Promise<number> {
    const channels = await this.db.telegramChannel.findMany()
    let totalDeleted = 0

    for (const channel of channels) {
      const count = await this.db.telegramMessage.count({
        where: { channelId: channel.id },
      })

      if (count <= maxMessagesPerChannel) {
        continue
      }

      // Get the date cutoff
      const cutoffMessage = await this.db.telegramMessage.findMany({
        where: { channelId: channel.id },
        orderBy: { date: 'desc' },
        skip: maxMessagesPerChannel - 1,
        take: 1,
        select: { date: true },
      })

      if (cutoffMessage.length === 0) continue

      const result = await this.db.telegramMessage.deleteMany({
        where: {
          channelId: channel.id,
          date: { lt: cutoffMessage[0].date },
        },
      })

      totalDeleted += result.count
    }

    if (totalDeleted > 0) {
      logger.info(
        `[TelegramService] Cleaned up ${totalDeleted} messages (keeping last ${maxMessagesPerChannel} per channel)`
      )
    }

    return totalDeleted
  }

  /**
   * Get statistics for admin dashboard
   */
  async getStats(): Promise<{
    totalChannels: number
    enabledChannels: number
    totalMessages: number
    messagesLast24h: number
    lastUpdate: Date | null
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [channelCount, enabledCount, messageCount, recentCount, lastChannel] = await Promise.all([
      this.db.telegramChannel.count(),
      this.db.telegramChannel.count({ where: { enabled: true } }),
      this.db.telegramMessage.count(),
      this.db.telegramMessage.count({ where: { date: { gte: oneDayAgo } } }),
      this.db.telegramChannel.findFirst({
        orderBy: { lastFetchAt: 'desc' },
        select: { lastFetchAt: true },
      }),
    ])

    return {
      totalChannels: channelCount,
      enabledChannels: enabledCount,
      totalMessages: messageCount,
      messagesLast24h: recentCount,
      lastUpdate: lastChannel?.lastFetchAt || null,
    }
  }

  /**
   * Update channel error state
   */
  async setChannelError(channelId: bigint, error: string): Promise<void> {
    await this.db.telegramChannel.update({
      where: { channelId },
      data: {
        errorCount: { increment: 1 },
        lastError: error,
      },
    })
  }

  /**
   * Toggle channel enabled status
   */
  async toggleChannel(id: string, enabled: boolean): Promise<TelegramChannel> {
    const channel = await this.db.telegramChannel.update({
      where: { id },
      data: { enabled },
    })

    return {
      ...channel,
      channelId: channel.channelId.toString(),
    }
  }

  /**
   * Delete a channel and all its messages
   */
  async deleteChannel(id: string): Promise<{ username: string; messagesDeleted: number }> {
    const channel = await this.db.telegramChannel.findUnique({
      where: { id },
    })

    if (!channel) {
      throw new Error('Channel not found')
    }

    const deleteResult = await this.db.telegramMessage.deleteMany({
      where: { channelId: id },
    })

    await this.db.telegramChannel.delete({
      where: { id },
    })

    logger.info(
      `[TelegramService] Deleted channel @${channel.username} and ${deleteResult.count} messages`
    )

    return {
      username: channel.username,
      messagesDeleted: deleteResult.count,
    }
  }
}
