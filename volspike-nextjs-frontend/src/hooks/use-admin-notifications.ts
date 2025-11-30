import { useState, useEffect, useCallback } from 'react'
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
}

/**
 * Hook to manage admin notifications
 * Fetches notifications and provides methods to mark them as read
 */
export function useAdminNotifications(limit: number = 10): UseAdminNotificationsReturn {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<AdminNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
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
            setLoading(true)
            setError(null)

            // Fetch notifications and unread count in parallel
            const [notificationsRes, countRes] = await Promise.all([
                fetch(`${apiBase}/api/admin/notifications?limit=${limit}`, {
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
        } catch (err) {
            // Silently fail - don't disrupt user experience
            console.debug('[useAdminNotifications] Error fetching notifications:', err)
            setNotifications([])
            setUnreadCount(0)
        } finally {
            setLoading(false)
        }
    }, [session, limit, apiBase])

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

                // Refresh notifications after marking as read
                await fetchNotifications()
            } catch (err) {
                console.error('[useAdminNotifications] Error marking as read:', err)
                setError(err instanceof Error ? err.message : 'Failed to mark as read')
            }
        },
        [session, apiBase, fetchNotifications]
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

        fetchNotifications()

        // Poll for new notifications every 30 seconds
        const interval = setInterval(() => {
            fetchNotifications()
        }, 30000)

        return () => clearInterval(interval)
    }, [session, fetchNotifications])

    // Also refetch when accessToken changes
    useEffect(() => {
        const accessToken = (session as any)?.accessToken
        if (accessToken && session?.user) {
            fetchNotifications()
        }
    }, [(session as any)?.accessToken, fetchNotifications])

    return {
        notifications,
        unreadCount,
        loading,
        error,
        refreshNotifications: fetchNotifications,
        markAsRead,
        markAllAsRead,
    }
}

