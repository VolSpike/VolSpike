'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { adminAPI } from '@/lib/admin/api-client'
import { toast } from 'react-hot-toast'

interface Payment {
    id: string
    paymentId: string | null
    paymentStatus: string | null
    tier: string
    user: {
        tier: string
    }
}

interface UseAutoSyncPaymentsOptions {
    payments: Payment[]
    enabled?: boolean
    interval?: number // milliseconds
    onPaymentUpdated?: (paymentId: string) => void
    accessToken?: string | null
}

/**
 * Hook for automatically syncing payment statuses from NowPayments API
 * Only syncs payments that aren't finished/failed and have a paymentId
 */
type SyncSource = 'auto' | 'manual' | 'visibility' | 'initial'

export function useAutoSyncPayments({
    payments,
    enabled = true,
    interval = 30000, // 30 seconds default
    onPaymentUpdated,
    accessToken,
}: UseAutoSyncPaymentsOptions) {
    const [syncingPayments, setSyncingPayments] = useState<Set<string>>(new Set())
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
    const [syncCount, setSyncCount] = useState(0)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const isVisibleRef = useRef(true)
    const isSyncingRef = useRef(false)
    const syncingPaymentsRef = useRef<Set<string>>(new Set())

    const isDevEnv = process.env.NODE_ENV !== 'production'
    const logDebug = useCallback(
        (message: string, payload?: Record<string, unknown>) => {
            if (!isDevEnv) return
            console.debug(`[AutoSyncPayments] ${message}`, payload || {})
        },
        [isDevEnv]
    )

    // Filter payments that need syncing (not finished/failed, have paymentId)
    const paymentsToSync = useMemo(
        () =>
            payments.filter(
                (payment) =>
                    payment.paymentId &&
                    payment.paymentStatus !== 'finished' &&
                    payment.paymentStatus !== 'failed' &&
                    payment.paymentStatus !== 'refunded' &&
                    payment.paymentStatus !== 'expired'
            ),
        [payments]
    )

    const syncPayment = useCallback(
        async (payment: Payment) => {
            if (!payment.paymentId || !accessToken) return

            // Skip if already syncing this payment
            if (syncingPaymentsRef.current.has(payment.id)) {
                logDebug('Skipping payment (already syncing)', { paymentId: payment.paymentId })
                return
            }

            try {
                setSyncingPayments((prev) => {
                    const next = new Set(prev)
                    next.add(payment.id)
                    syncingPaymentsRef.current = next
                    return next
                })

                adminAPI.setAccessToken(accessToken)

                const result = await adminAPI.syncFromNowPayments(payment.id)

                // Check if status changed or user was upgraded
                if (result.payment?.status !== payment.paymentStatus) {
                    setSyncCount((prev) => prev + 1)
                    onPaymentUpdated?.(payment.id)

                    // Show subtle notification if user was upgraded
                    if (result.user?.previousTier !== result.user?.newTier) {
                        toast.success(
                            `Payment ${payment.paymentId.slice(-6)}: User upgraded to ${result.user.newTier.toUpperCase()}`,
                            { duration: 3000, icon: '✅' }
                        )
                    }
                }
            } catch (error: any) {
                // Silently fail - don't spam errors for auto-sync
                console.debug('[AutoSync] Failed to sync payment:', payment.paymentId, error.message)
            } finally {
                setSyncingPayments((prev) => {
                    const next = new Set(prev)
                    next.delete(payment.id)
                    return next
                })
                syncingPaymentsRef.current.delete(payment.id)
            }
        },
        [accessToken, onPaymentUpdated, logDebug]
    )

    const syncAllPayments = useCallback(
        async (source: SyncSource = 'auto') => {
            if (!enabled) {
                logDebug('Sync aborted - auto-sync disabled', { source })
                return
            }
            if (isSyncingRef.current) {
                logDebug('Sync skipped - already running', { source })
                return
            }
            if (paymentsToSync.length === 0) {
                logDebug('Sync skipped - no payments pending', { source })
                return
            }
            if (!isVisibleRef.current) {
                logDebug('Sync skipped - tab hidden', { source })
                return // Don't sync when tab is hidden
            }

            isSyncingRef.current = true
            logDebug('Sync started', {
                source,
                pendingPayments: paymentsToSync.length,
                paymentIds: paymentsToSync.map((payment) => payment.paymentId?.slice(-6)),
            })

            try {
                // Sync payments sequentially to avoid rate limits
                for (const payment of paymentsToSync) {
                    await syncPayment(payment)
                    // Small delay between syncs
                    await new Promise((resolve) => setTimeout(resolve, 500))
                }

                setLastSyncTime(Date.now())
                logDebug('Sync finished', { source })
            } finally {
                isSyncingRef.current = false
            }
        },
        [enabled, paymentsToSync, syncPayment, logDebug]
    )

    // Set up auto-sync interval
    useEffect(() => {
        if (!enabled || paymentsToSync.length === 0) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            return
        }

        // Initial sync after a short delay
        const initialTimeout = setTimeout(() => {
            syncAllPayments('initial')
        }, 2000)

        // Set up periodic sync
        intervalRef.current = setInterval(() => {
            syncAllPayments('auto')
        }, interval)

        return () => {
            clearTimeout(initialTimeout)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [enabled, interval, paymentsToSync.length, syncAllPayments])

    // Page Visibility API - pause sync when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            isVisibleRef.current = !document.hidden
            // Sync immediately when tab becomes visible
            if (!document.hidden && enabled && paymentsToSync.length > 0) {
                syncAllPayments('visibility')
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [enabled, paymentsToSync.length, syncAllPayments])

    return {
        syncingPayments,
        lastSyncTime,
        syncCount,
        paymentsToSyncCount: paymentsToSync.length,
        syncAllPayments,
    }
}

