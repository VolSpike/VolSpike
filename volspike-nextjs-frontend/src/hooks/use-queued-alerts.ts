'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { adminAPI } from '@/lib/admin/api-client'

// Global cache for queued alert IDs and their post IDs (shared across all button instances)
// Map: alertId -> { postId, status }
let queuedAlerts: Map<string, { postId: string; status: string }> = new Map()
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
      if (Date.now() - lastFetchTime < CACHE_TTL && queuedAlerts.size > 0) {
        setIsLoaded(true)
        return
      }

      try {
        adminAPI.setAccessToken(accessToken)
        const response = await adminAPI.getSocialMediaQueue()

        // Extract alert IDs and post IDs from queue
        const newCache = new Map<string, { postId: string; status: string }>()
        for (const post of response.data || []) {
          if (post.alertId) {
            newCache.set(post.alertId, { postId: post.id, status: post.status })
          }
        }

        // Also fetch history (posted alerts should also show as "done")
        const historyResponse = await adminAPI.getSocialMediaHistory({ limit: 200 })
        for (const post of historyResponse.data || []) {
          if (post.alertId && !newCache.has(post.alertId)) {
            newCache.set(post.alertId, { postId: post.id, status: post.status })
          }
        }

        queuedAlerts = newCache
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
    return queuedAlerts.has(alertId)
  }, [])

  // Get the post ID for a queued alert (needed for unqueue)
  const getPostId = useCallback((alertId: string): string | null => {
    return queuedAlerts.get(alertId)?.postId || null
  }, [])

  // Check if an alert can be unqueued (only QUEUED or FAILED status, not POSTED)
  const canUnqueue = useCallback((alertId: string): boolean => {
    const entry = queuedAlerts.get(alertId)
    return entry ? (entry.status === 'QUEUED' || entry.status === 'FAILED') : false
  }, [])

  // Add an alert to the cache (called after successful queue addition)
  const markAsQueued = useCallback((alertId: string, postId?: string) => {
    queuedAlerts.set(alertId, { postId: postId || '', status: 'QUEUED' })
    notifyListeners()
  }, [])

  // Remove an alert from the cache (called after successful unqueue)
  const unmarkAsQueued = useCallback((alertId: string) => {
    queuedAlerts.delete(alertId)
    notifyListeners()
  }, [])

  // Invalidate the cache to force a refetch
  const invalidateCache = useCallback(() => {
    lastFetchTime = 0
    notifyListeners()
  }, [])

  return {
    isLoaded,
    isAlertQueued,
    getPostId,
    canUnqueue,
    markAsQueued,
    unmarkAsQueued,
    invalidateCache,
    queuedCount: queuedAlerts.size,
  }
}
