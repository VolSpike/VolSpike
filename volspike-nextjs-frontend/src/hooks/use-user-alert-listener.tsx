'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { useBrowserNotifications } from './use-browser-notifications'
import { useSocket } from './use-socket'
import { useTriggeredAlerts } from './use-triggered-alerts'

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
    const addAlert = useTriggeredAlerts((state) => state.addAlert)
    const activeToastRef = useRef<string | null>(null)

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

            // Add to triggered alerts store (for header bell)
            addAlert({
                id: data.id,
                symbol,
                alertType: data.alertType,
                alertTypeName: data.alertTypeName,
                thresholdFormatted: data.thresholdFormatted,
                currentValueFormatted: data.currentValueFormatted,
                direction: data.direction,
                timestamp: data.timestamp,
            })

            // Remove existing toast if any (instant removal)
            if (activeToastRef.current) {
                toast.remove(activeToastRef.current)
                activeToastRef.current = null
            }

            // Show persistent toast in bottom-right
            const toastId = toast.custom(
                (t) => {
                    // Create dismiss handler that removes immediately
                    const handleDismiss = () => {
                        toast.remove(t.id) // Use remove instead of dismiss for instant removal
                        activeToastRef.current = null
                    }

                    return (
                        <div className="max-w-sm w-full bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl pointer-events-auto border border-brand-500/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Accent bar */}
                            <div className="h-1 bg-gradient-to-r from-brand-500 to-sec-500" />

                            <div className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center">
                                        <Bell className="h-5 w-5 text-brand-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                                Alert Triggered
                                            </p>
                                            <button
                                                onClick={handleDismiss}
                                                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 rounded"
                                                aria-label="Close"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <p className="mt-0.5 text-base font-semibold text-foreground">
                                            {symbol} {data.alertTypeName}
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Crossed {data.direction}{' '}
                                            <span className="font-mono text-foreground">{data.thresholdFormatted}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Current: <span className="font-mono text-foreground">{data.currentValueFormatted}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={handleDismiss}
                                        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    duration: Infinity,
                    position: 'bottom-right',
                    id: `alert-${data.id}`,
                }
            )
            activeToastRef.current = toastId

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
    }, [socket, showNotification, requestPermission, permission, queryClient, addAlert])
}
