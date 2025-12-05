'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface TelegramMessage {
  id: string
  text: string | null
  date: string
  category: 'macro' | 'crypto' | 'general'
  channelUsername: string
}

interface UseTelegramMessagesOptions {
  limit?: number
  pollInterval?: number
  autoFetch?: boolean
}

interface UseTelegramMessagesReturn {
  messages: TelegramMessage[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  lastUpdate: number | null
}

export function useTelegramMessages(
  options: UseTelegramMessagesOptions = {}
): UseTelegramMessagesReturn {
  const { limit = 100, pollInterval = 30000, autoFetch = true } = options

  const [messages, setMessages] = useState<TelegramMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const mountedRef = useRef(true)

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/telegram/messages?limit=${limit}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`)
      }

      const data = await response.json()

      if (mountedRef.current) {
        setMessages(data.messages || [])
        setError(null)
        setLastUpdate(Date.now())
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch messages')
        console.error('[useTelegramMessages] Error:', err)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [limit])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true

    if (autoFetch) {
      fetchMessages()
    }

    return () => {
      mountedRef.current = false
    }
  }, [autoFetch, fetchMessages])

  // Polling
  useEffect(() => {
    if (!autoFetch || pollInterval <= 0) return

    const interval = setInterval(fetchMessages, pollInterval)

    return () => clearInterval(interval)
  }, [autoFetch, pollInterval, fetchMessages])

  return {
    messages,
    isLoading,
    error,
    refetch: fetchMessages,
    lastUpdate,
  }
}
