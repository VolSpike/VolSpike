'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { adminAPI } from '@/lib/admin/api-client'

// Global cache for queued alert IDs (shared across all button instances)
let queuedAlertIds: Set<string> = new Set()
let lastFetchTime = 0
const CACHE_TTL = 30000 // 30 seconds cache

// Callbacks to notify all instances when cache updates
const listeners: Set<() => void> = new Set()

function notifyListeners() {
  listeners.forEach(cb => cb())
}

/**
 * Hook to check if alerts are already queued for Twitter
 * Fetches once and caches, shared across all button instances
 */
export function useQueuedAlerts() {
  const { data: session } = useSession()
  const [isLoaded, setIsLoaded] = useState(lastFetchTime > 0)
  const [, forceUpdate] = useState({})

  // Subscribe to cache updates
  useEffect(() => {
    const listener = () => forceUpdate({})
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // Fetch queued alerts on mount (if admin and cache is stale)
  useEffect(() => {
    const fetchQueuedAlerts = async () => {
      const accessToken = (session as any)?.accessToken as string | undefined
      const isAdmin = session?.user?.role === 'ADMIN'

      if (!accessToken || !isAdmin) return

      // Check if cache is still valid
      if (Date.now() - lastFetchTime < CACHE_TTL && queuedAlertIds.size > 0) {
        setIsLoaded(true)
        return
      }

      try {
        adminAPI.setAccessToken(accessToken)
        const response = await adminAPI.getSocialMediaQueue()

        // Extract alert IDs from queue
        const ids = new Set<string>()
        for (const post of response.data || []) {
          if (post.alertId) {
            ids.add(post.alertId)
          }
        }

        // Also fetch history (posted alerts should also show as "done")
        const historyResponse = await adminAPI.getSocialMediaHistory({ limit: 200 })
        for (const post of historyResponse.data || []) {
          if (post.alertId) {
            ids.add(post.alertId)
          }
        }

        queuedAlertIds = ids
        lastFetchTime = Date.now()
        setIsLoaded(true)
        notifyListeners()
      } catch (error) {
        console.error('[useQueuedAlerts] Error fetching queued alerts:', error)
        // Don't block UI if fetch fails
        setIsLoaded(true)
      }
    }

    fetchQueuedAlerts()
  }, [session])

  // Check if a specific alert is queued
  const isAlertQueued = useCallback((alertId: string): boolean => {
    return queuedAlertIds.has(alertId)
  }, [])

  // Add an alert to the cache (called after successful queue addition)
  const markAsQueued = useCallback((alertId: string) => {
    queuedAlertIds.add(alertId)
    notifyListeners()
  }, [])

  return {
    isLoaded,
    isAlertQueued,
    markAsQueued,
    queuedCount: queuedAlertIds.size,
  }
}
