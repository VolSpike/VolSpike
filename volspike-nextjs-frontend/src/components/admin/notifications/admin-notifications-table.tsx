'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Bell, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAdminNotifications, type AdminNotification } from '@/hooks/use-admin-notifications'

interface AdminNotificationsTableProps {
    accessToken: string | null
}

/**
 * AdminNotificationsTable Component
 * Displays a table of all notifications with pagination and filtering
 */
export function AdminNotificationsTable({ accessToken }: AdminNotificationsTableProps) {
    const router = useRouter()
    const [page, setPage] = useState(1)
    const [allNotifications, setAllNotifications] = useState<AdminNotification[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [markingRead, setMarkingRead] = useState<string | null>(null)

    const limit = 50
    // Use same-origin admin API proxy to avoid CORS preflights and cross-origin contention.
    const apiBase = ''

    // Fetch notifications with pagination
    const fetchNotifications = useCallback(async () => {
        if (!accessToken) return

        try {
            setLoading(true)
            const offset = (page - 1) * limit

            const response = await fetch(
                `${apiBase}/api/admin/notifications?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                }
            )

            if (!response.ok) {
                throw new Error('Failed to fetch notifications')
            }

            const data = await response.json()
            setAllNotifications(data.notifications || [])
            setTotal(data.pagination?.total || 0)
        } catch (error) {
            console.error('[AdminNotificationsTable] Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }, [accessToken, page, limit, apiBase])

    // Mark notification as read
    const markAsRead = useCallback(
        async (notificationId: string) => {
            if (!accessToken) return

            try {
                setMarkingRead(notificationId)
                const response = await fetch(`${apiBase}/api/admin/notifications/mark-read`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        notificationIds: [notificationId],
                    }),
                })

                if (!response.ok) {
                    throw new Error('Failed to mark as read')
                }

                // Update local state
                setAllNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notificationId
                            ? { ...n, isRead: true, readAt: new Date().toISOString() }
                            : n
                    )
                )
            } catch (error) {
                console.error('[AdminNotificationsTable] Error marking as read:', error)
            } finally {
                setMarkingRead(null)
            }
        },
        [accessToken, apiBase]
    )

    // Handle notification click
    const handleNotificationClick = async (notification: AdminNotification) => {
        // Mark as read if unread
        if (!notification.isRead) {
            await markAsRead(notification.id)
        }

        // Navigate based on notification type
        if (notification.type === 'NEW_ASSET_DETECTED' && notification.metadata?.assetSymbol) {
            router.push(`/admin/assets?q=${notification.metadata.assetSymbol}`)
        }
    }

    // Format time
    const formatTime = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true })
        } catch {
            return 'Recently'
        }
    }

    // Format full date/time
    const formatFullTime = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString()
        } catch {
            return 'Unknown'
        }
    }

    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    if (loading && allNotifications.length === 0) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        )
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="space-y-4">
            {/* Notifications List */}
            <div className="border rounded-lg bg-card">
                {allNotifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">No notifications found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {allNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                                    !notification.isRead ? 'bg-blue-500/5' : ''
                                }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Unread indicator */}
                                    <div className="mt-1 flex-shrink-0">
                                        {!notification.isRead ? (
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 text-muted-foreground opacity-50" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p
                                                        className={`text-sm font-medium ${
                                                            !notification.isRead
                                                                ? 'text-foreground'
                                                                : 'text-muted-foreground'
                                                        }`}
                                                    >
                                                        {notification.title}
                                                    </p>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {notification.type.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
                                                    <span>{formatTime(notification.createdAt)}</span>
                                                    <span>•</span>
                                                    <span>{formatFullTime(notification.createdAt)}</span>
                                                </div>
                                            </div>

                                            {/* Mark as read button (only for unread) */}
                                            {!notification.isRead && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        markAsRead(notification.id)
                                                    }}
                                                    disabled={markingRead === notification.id}
                                                    className="flex-shrink-0"
                                                >
                                                    {markingRead === notification.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        'Mark as read'
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of{' '}
                        {total} notifications
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
