'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { adminAPI } from '@/lib/admin/api-client'
import type { SocialMediaStatus } from '@/types/social-media'

// Global cache for queued alert IDs and their post IDs (shared across all button instances)
// Map: alertId -> { postId, status }
let queuedAlerts: Map<string, { postId: string; status: SocialMediaStatus }> = new Map()
let lastFetchTime = 0
const CACHE_TTL = 30000 // 30 seconds cache
const PAGE_SIZE = 100
const MAX_PAGES = 10 // hard cap to avoid runaway loops

// Callbacks to notify all instances when cache updates
const listeners: Set<() => void> = new Set()

function notifyListeners() {
  listeners.forEach(cb => cb())
}

/**
 * Global function to invalidate the queued alerts cache.
 * Call this after posting/rejecting from social-media admin page
 * so dashboard buttons update correctly.
 */
export function invalidateQueuedAlertsCache() {
  lastFetchTime = 0
  queuedAlerts.clear()
  notifyListeners()
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
        const newCache = new Map<string, { postId: string; status: SocialMediaStatus }>()

        // Fetch all queue pages (default endpoint returns QUEUED + FAILED)
        let offset = 0
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const response = await adminAPI.getSocialMediaQueue({ limit: PAGE_SIZE, offset })
          const items = response.data || []

          for (const post of items) {
            if (!post?.alertId) continue
            if (post.status === 'QUEUED' || post.status === 'FAILED') {
              // Keep the newest post for a given alertId (API returns newest-first).
              if (!newCache.has(post.alertId)) {
                newCache.set(post.alertId, { postId: post.id, status: post.status })
              }
            }
          }

          if (items.length < PAGE_SIZE) break
          offset += items.length
        }

        // Also fetch POSTING items (they can block re-queueing and should be visible on dashboard)
        try {
          const posting = await adminAPI.getSocialMediaQueue({ status: 'POSTING', limit: PAGE_SIZE, offset: 0 })
          for (const post of posting.data || []) {
            if (!post?.alertId) continue
            if (!newCache.has(post.alertId)) {
              newCache.set(post.alertId, { postId: post.id, status: 'POSTING' })
            }
          }
        } catch (err) {
          // Non-fatal: dashboard can still operate with QUEUED/FAILED only
          console.warn('[useQueuedAlerts] Failed to fetch POSTING items:', err)
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

  const getStatus = useCallback((alertId: string): SocialMediaStatus | null => {
    return queuedAlerts.get(alertId)?.status || null
  }, [])

  // Check if an alert can be unqueued (only QUEUED or FAILED status, not POSTED)
  const canUnqueue = useCallback((alertId: string): boolean => {
    const entry = queuedAlerts.get(alertId)
    return entry ? Boolean(entry.postId) && (entry.status === 'QUEUED' || entry.status === 'FAILED') : false
  }, [])

  // Add an alert to the cache (called after successful queue addition)
  const markAsQueued = useCallback((alertId: string, postId?: string, status: SocialMediaStatus = 'QUEUED') => {
    queuedAlerts.set(alertId, { postId: postId || '', status })
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
    getStatus,
    canUnqueue,
    markAsQueued,
    unmarkAsQueued,
    invalidateCache,
    queuedCount: queuedAlerts.size,
  }
}
