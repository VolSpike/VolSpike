import { useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useBrowserNotifications } from './use-browser-notifications'
import { useSocket } from './use-socket'

export interface UserAlertEvent {
    id: string
    symbol: string
    alertType: string
    alertTypeName: string
    threshold: number
    thresholdFormatted: string
    currentValue: number
    currentValueFormatted: string
    previousValue: number
    previousValueFormatted: string
    crossedUp: boolean
    direction: string
    timestamp: string
}

export function useUserAlertListener() {
    const { socket } = useSocket()
    const { showNotification, requestPermission, permission } = useBrowserNotifications()

    useEffect(() => {
        if (!socket) return

        const handleUserAlert = (data: UserAlertEvent) => {
            console.log('User alert received:', data)

            // Format the alert message
            const message = `${data.symbol} ${data.alertTypeName.toLowerCase()} crossed ${data.direction} ${data.thresholdFormatted}`

            // Show toast notification
            toast.success(message, {
                duration: 8000,
                icon: '🔔',
                position: 'top-right',
            })

            // Show browser notification if permission granted
            if (permission === 'granted') {
                showNotification({
                    title: `VolSpike Alert: ${data.symbol}`,
                    body: `${data.alertTypeName} crossed ${data.direction} ${data.thresholdFormatted}\nCurrent: ${data.currentValueFormatted}`,
                    icon: '/favicon.ico',
                    tag: data.id,
                    requireInteraction: false,
                })
            } else if (permission === 'default') {
                // Request permission on first alert
                requestPermission().then((result) => {
                    if (result === 'granted') {
                        showNotification({
                            title: `VolSpike Alert: ${data.symbol}`,
                            body: `${data.alertTypeName} crossed ${data.direction} ${data.thresholdFormatted}\nCurrent: ${data.currentValueFormatted}`,
                            icon: '/favicon.ico',
                            tag: data.id,
                            requireInteraction: false,
                        })
                    }
                })
            }
        }

        // Listen for user alert events
        socket.on('user-alert-triggered', handleUserAlert)

        // Cleanup
        return () => {
            socket.off('user-alert-triggered', handleUserAlert)
        }
    }, [socket, showNotification, requestPermission, permission])
}
