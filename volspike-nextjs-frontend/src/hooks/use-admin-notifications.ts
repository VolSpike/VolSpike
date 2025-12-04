import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface AdminNotification {
    id: string
    type: string
    title: string
    message: string
    metadata: Record<string, any> | null
    isRead: boolean
    createdAt: string
    readAt: string | null
}

interface UseAdminNotificationsReturn {
    notifications: AdminNotification[]
    unreadCount: number
    loading: boolean
    error: string | null
    refreshNotifications: () => Promise<void>
    markAsRead: (notificationIds?: string[]) => Promise<void>
    markAllAsRead: () => Promise<void>
    pausePolling: () => void
    resumePolling: () => void
}

/**
 * Hook to manage admin notifications
 * Fetches notifications and provides methods to mark them as read
 */
export function useAdminNotifications(limit: number = 10, unreadOnly: boolean = false): UseAdminNotificationsReturn {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<AdminNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isPausedRef = useRef(false)
    const hasInitialLoadRef = useRef(false)

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    // Pause and resume polling
    const pausePolling = useCallback(() => {
        isPausedRef.current = true
    }, [])

    const resumePolling = useCallback(() => {
        isPausedRef.current = false
    }, [])

    // Fetch notifications from API
    const fetchNotifications = useCallback(async (showLoading: boolean = true) => {
        if (!session?.user) return

        // Get access token from session (required for admin API)
        const accessToken = (session as any)?.accessToken as string | undefined
        if (!accessToken) {
            console.debug('[useAdminNotifications] No access token in session')
            setNotifications([])
            setUnreadCount(0)
            setLoading(false)
            return
        }

        try {
            // Only show loading on initial load, not on background refreshes
            if (showLoading && !hasInitialLoadRef.current) {
                setLoading(true)
            }
            setError(null)

            // Fetch notifications and unread count in parallel
            const notificationsUrl = `${apiBase}/api/admin/notifications?limit=${limit}${unreadOnly ? '&unreadOnly=true' : ''}`
            const [notificationsRes, countRes] = await Promise.all([
                fetch(notificationsUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                }).catch(() => ({ ok: false } as Response)),
                fetch(`${apiBase}/api/admin/notifications/unread-count`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                }).catch(() => ({ ok: false } as Response)),
            ])

            if (!notificationsRes.ok || !countRes.ok) {
                // Silently fail - don't disrupt user experience
                setNotifications([])
                setUnreadCount(0)
                return
            }

            const notificationsData = await notificationsRes.json().catch(() => ({ notifications: [] }))
            const countData = await countRes.json().catch(() => ({ count: 0 }))

            setNotifications(notificationsData.notifications || [])
            setUnreadCount(countData.count || 0)
            hasInitialLoadRef.current = true
        } catch (err) {
            // Silently fail - don't disrupt user experience
            console.debug('[useAdminNotifications] Error fetching notifications:', err)
            setNotifications([])
            setUnreadCount(0)
        } finally {
            setLoading(false)
        }
    }, [session, limit, apiBase, unreadOnly])

    // Mark notifications as read
    const markAsRead = useCallback(
        async (notificationIds?: string[]) => {
            if (!session?.user) return

            // Get access token from session (required for admin API)
            const accessToken = (session as any)?.accessToken as string | undefined
            if (!accessToken) {
                console.debug('[useAdminNotifications] No access token for mark as read')
                return
            }

            // Optimistically update local state
            const idsToMark = notificationIds || notifications.map(n => n.id)
            const unreadIdsBeingMarked = notifications
                .filter(n => idsToMark.includes(n.id) && !n.isRead)
                .map(n => n.id)

            // Update notifications state optimistically
            setNotifications(prev => prev.map(n =>
                idsToMark.includes(n.id) ? { ...n, isRead: true } : n
            ))
            // Decrease unread count by the number of unread notifications being marked
            setUnreadCount(prev => Math.max(0, prev - unreadIdsBeingMarked.length))

            try {
                const response = await fetch(`${apiBase}/api/admin/notifications/mark-read`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        notificationIds: notificationIds || [],
                    }),
                })

                if (!response.ok) {
                    throw new Error('Failed to mark notifications as read')
                }
                // Don't refetch - we already updated optimistically
            } catch (err) {
                console.error('[useAdminNotifications] Error marking as read:', err)
                setError(err instanceof Error ? err.message : 'Failed to mark as read')
                // Revert optimistic update on error by refetching
                await fetchNotifications(false)
            }
        },
        [session, apiBase, notifications, fetchNotifications]
    )

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        await markAsRead() // Empty array means mark all
    }, [markAsRead])

    // Initial fetch and set up polling
    useEffect(() => {
        if (!session?.user) {
            setNotifications([])
            setUnreadCount(0)
            setLoading(false)
            return
        }

        fetchNotifications(true)

        // Poll for new notifications every 30 seconds (only when not paused)
        const interval = setInterval(() => {
            if (!isPausedRef.current) {
                fetchNotifications(false) // Don't show loading for background fetches
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [session, fetchNotifications])

    // Also refetch when accessToken changes
    useEffect(() => {
        const accessToken = (session as any)?.accessToken
        if (accessToken && session?.user) {
            fetchNotifications(true)
        }
    }, [(session as any)?.accessToken, fetchNotifications])

    return {
        notifications,
        unreadCount,
        loading,
        error,
        refreshNotifications: () => fetchNotifications(false),
        markAsRead,
        markAllAsRead,
        pausePolling,
        resumePolling,
    }
}

