import { useState, useEffect, useCallback } from 'react'

export interface BrowserNotificationOptions {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    requireInteraction?: boolean
}

export function useBrowserNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isSupported, setIsSupported] = useState(false)

    useEffect(() => {
        // Check if browser supports notifications
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setIsSupported(true)
            setPermission(Notification.permission)
        }
    }, [])

    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isSupported) {
            console.warn('Browser notifications are not supported')
            return 'denied'
        }

        try {
            const result = await Notification.requestPermission()
            setPermission(result)
            return result
        } catch (error) {
            console.error('Failed to request notification permission:', error)
            return 'denied'
        }
    }, [isSupported])

    const showNotification = useCallback(
        async (options: BrowserNotificationOptions): Promise<boolean> => {
            // Request permission if not granted
            if (permission === 'default') {
                const newPermission = await requestPermission()
                if (newPermission !== 'granted') {
                    return false
                }
            }

            // Check if permission is granted
            if (permission !== 'granted' && Notification.permission !== 'granted') {
                console.warn('Notification permission not granted')
                return false
            }

            try {
                const notification = new Notification(options.title, {
                    body: options.body,
                    icon: options.icon || '/favicon.ico',
                    badge: options.badge || '/favicon.ico',
                    tag: options.tag,
                    requireInteraction: options.requireInteraction ?? false,
                })

                // Auto-close after 10 seconds if not requireInteraction
                if (!options.requireInteraction) {
                    setTimeout(() => notification.close(), 10000)
                }

                return true
            } catch (error) {
                console.error('Failed to show notification:', error)
                return false
            }
        },
        [permission, requestPermission]
    )

    return {
        permission,
        isSupported,
        requestPermission,
        showNotification,
    }
}
