'use client'

import { useState } from 'react'
import { Bell, X, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAdminNotifications, type AdminNotification } from '@/hooks/use-admin-notifications'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * AdminNotificationBell Component
 * Displays a bell icon with a red badge showing unread notification count
 * Opens a dropdown menu when clicked showing recent notifications
 */
export function AdminNotificationBell() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useAdminNotifications(10)

    // Filter out dismissed notifications from display
    const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id))
    const visibleUnreadCount = visibleNotifications.filter((n) => !n.isRead).length

    // Format notification time as relative (e.g., "2 minutes ago")
    const formatTime = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true })
        } catch {
            return 'Recently'
        }
    }

    // Handle clicking on a notification (navigate to relevant page)
    const handleNotificationClick = async (notification: AdminNotification) => {
        // Mark as read if unread
        if (!notification.isRead) {
            await markAsRead([notification.id])
        }

        // Navigate based on notification type
        if (notification.type === 'NEW_ASSET_DETECTED' && notification.metadata?.assetSymbol) {
            // Navigate to assets page filtered by the asset symbol
            setOpen(false)
            router.push(`/admin/assets?q=${notification.metadata.assetSymbol}`)
        } else {
            // For other notification types, navigate to notifications history page
            setOpen(false)
            router.push('/admin/notifications')
        }
    }

    // Handle marking notification as read without navigating
    const handleMarkAsReadOnly = async (e: React.MouseEvent, notification: AdminNotification) => {
        e.stopPropagation() // Prevent navigation
        if (!notification.isRead) {
            await markAsRead([notification.id])
        }
    }

    // Handle dismissing a notification (removes from popup but keeps in history)
    const handleDismiss = (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation() // Prevent navigation
        setDismissedIds((prev) => new Set([...prev, notificationId]))
    }

    // Reset dismissed IDs when dropdown closes (so they reappear next time if still unread)
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            // Reset dismissed IDs when closing - they'll reappear if still unread
            setDismissedIds(new Set())
        }
    }

    // Handle marking all as read
    const handleMarkAllAsRead = async () => {
        await markAllAsRead()
    }

    return (
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full relative hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all duration-150"
                    aria-label="Notifications"
                >
                    <Bell className="h-[1.2rem] w-[1.2rem]" />
                    {/* Red badge showing unread count */}
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[380px] p-0 backdrop-blur-lg bg-popover/95 border-border/50 shadow-lg-dark dark:shadow-lg-dark animate-scale-in rounded-xl"
                usePortal={true}
            >
                {/* Header */}
                <div className="p-4 border-b border-border/50 bg-gradient-to-br from-brand-500/5 to-sec-500/5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        {visibleUnreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Mark all as read
                            </Button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : visibleNotifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">No new notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {visibleNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`group relative w-full ${
                                        !notification.isRead ? 'bg-blue-500/5' : ''
                                    }`}
                                >
                                    {/* Main clickable area - navigates to relevant page */}
                                    <button
                                        onClick={() => handleNotificationClick(notification)}
                                        className="w-full text-left p-4 hover:bg-muted/50 transition-colors pr-12"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Unread indicator */}
                                            {!notification.isRead && (
                                                <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p
                                                        className={`text-sm font-medium ${
                                                            !notification.isRead
                                                                ? 'text-foreground'
                                                                : 'text-muted-foreground'
                                                        }`}
                                                    >
                                                        {notification.title}
                                                    </p>
                                                    {/* Arrow icon to indicate clickability */}
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground/70 mt-2">
                                                    {formatTime(notification.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Dismiss button (X icon) - appears on hover for all notifications */}
                                    <button
                                        onClick={(e) => handleDismiss(e, notification.id)}
                                        className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 z-10"
                                        aria-label="Dismiss notification"
                                        title="Dismiss (removes from popup, keeps in history)"
                                    >
                                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                    </button>

                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with View History button */}
                {visibleNotifications.length > 0 && (
                    <div className="p-3 border-t border-border/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setOpen(false)
                                router.push('/admin/notifications')
                            }}
                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                        >
                            View History
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

