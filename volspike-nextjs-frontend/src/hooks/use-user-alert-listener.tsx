import { useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
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

// Play alert sound using Web Audio API
function playAlertSound() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContext) return

        const audioContext = new AudioContext()

        const playTone = (frequency: number, startTime: number, duration: number) => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = frequency
            oscillator.type = 'sine'

            gainNode.gain.setValueAtTime(0.3, startTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

            oscillator.start(startTime)
            oscillator.stop(startTime + duration)
        }

        const now = audioContext.currentTime
        // Ascending three-tone alert
        playTone(880, now, 0.12)
        playTone(1100, now + 0.12, 0.12)
        playTone(1320, now + 0.24, 0.18)
    } catch (error) {
        console.warn('Could not play alert sound:', error)
    }
}

export function useUserAlertListener() {
    const { socket } = useSocket()
    const { showNotification, requestPermission, permission } = useBrowserNotifications()
    const queryClient = useQueryClient()

    const dismissToast = useCallback((toastId: string) => {
        toast.dismiss(toastId)
    }, [])

    useEffect(() => {
        if (!socket) return

        const handleUserAlert = (data: UserAlertEvent) => {
            console.log('User alert received:', data)

            // Play alert sound
            playAlertSound()

            // Invalidate alerts query to update bell icon immediately
            queryClient.invalidateQueries({ queryKey: ['user-cross-alerts'] })

            // Format symbol for display
            const symbol = data.symbol.replace(/USDT$/i, '')

            // Show persistent toast that requires user dismissal
            toast.custom(
                (t) => (
                    <div
                        className={`${
                            t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
                        } max-w-md w-full bg-background shadow-2xl rounded-xl pointer-events-auto border-2 border-brand-500 ring-4 ring-brand-500/20`}
                    >
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center">
                                    <span className="text-2xl">🔔</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-brand-600 dark:text-brand-400">
                                        Alert Triggered!
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-foreground">
                                        {symbol} {data.alertTypeName}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Crossed {data.direction} <span className="font-mono font-semibold text-foreground">{data.thresholdFormatted}</span>
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Current: <span className="font-mono font-semibold text-foreground">{data.currentValueFormatted}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => dismissToast(t.id)}
                                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                ),
                {
                    duration: Infinity,
                    position: 'top-center',
                }
            )

            // Show browser notification if permission granted
            if (permission === 'granted') {
                showNotification({
                    title: `VolSpike Alert: ${symbol}`,
                    body: `${data.alertTypeName} crossed ${data.direction} ${data.thresholdFormatted}\nCurrent: ${data.currentValueFormatted}`,
                    icon: '/favicon.ico',
                    tag: data.id,
                    requireInteraction: true,
                })
            } else if (permission === 'default') {
                requestPermission().then((result) => {
                    if (result === 'granted') {
                        showNotification({
                            title: `VolSpike Alert: ${symbol}`,
                            body: `${data.alertTypeName} crossed ${data.direction} ${data.thresholdFormatted}\nCurrent: ${data.currentValueFormatted}`,
                            icon: '/favicon.ico',
                            tag: data.id,
                            requireInteraction: true,
                        })
                    }
                })
            }
        }

        socket.on('user-alert-triggered', handleUserAlert)

        return () => {
            socket.off('user-alert-triggered', handleUserAlert)
        }
    }, [socket, showNotification, requestPermission, permission, queryClient, dismissToast])
}
