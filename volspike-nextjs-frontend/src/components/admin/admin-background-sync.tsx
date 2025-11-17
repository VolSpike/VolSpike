'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { adminAPI } from '@/lib/admin/api-client'

interface Payment {
    id: string
    paymentId: string | null
    paymentStatus: string | null
}

/**
 * Global background sync service for admin users
 * Runs continuously regardless of which page the admin is on
 * Silently syncs payment statuses from NowPayments API
 */
export function AdminBackgroundSync() {
    const { data: session } = useSession()
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const isSyncingRef = useRef(false)
    const lastSyncRef = useRef<number>(0)

    useEffect(() => {
        // Only run for admin users
        if (!session?.user || session.user.role !== 'ADMIN') {
            return
        }

        const accessToken = (session as any)?.accessToken || session.user.id
        if (!accessToken) {
            return
        }

        adminAPI.setAccessToken(accessToken)

        const syncPayments = async () => {
            // Prevent concurrent syncs
            if (isSyncingRef.current) {
                return
            }

            // Throttle: don't sync more than once per 30 seconds
            const now = Date.now()
            if (now - lastSyncRef.current < 30000) {
                return
            }

            isSyncingRef.current = true
            lastSyncRef.current = now

            try {
                // Fetch pending payments (not finished/failed)
                const data = await adminAPI.getPayments({
                    status: 'waiting,confirming,sending,partially_paid',
                    limit: 100, // Sync up to 100 payments at a time
                })

                if (!data?.payments || data.payments.length === 0) {
                    return
                }

                // Sync payments sequentially to avoid rate limits
                for (const payment of data.payments) {
                    if (!payment.paymentId) continue
                    if (
                        payment.paymentStatus === 'finished' ||
                        payment.paymentStatus === 'confirmed' ||
                        payment.paymentStatus === 'failed' ||
                        payment.paymentStatus === 'refunded' ||
                        payment.paymentStatus === 'expired'
                    ) {
                        continue
                    }

                    try {
                        await adminAPI.syncFromNowPayments(payment.id)
                        // Small delay between syncs
                        await new Promise((resolve) => setTimeout(resolve, 500))
                    } catch (error) {
                        // Silently fail - don't spam errors for background sync
                        console.debug('[AdminBackgroundSync] Failed to sync payment:', payment.paymentId, error)
                    }
                }
            } catch (error) {
                // Silently fail - background sync shouldn't disrupt user experience
                console.debug('[AdminBackgroundSync] Sync error:', error)
            } finally {
                isSyncingRef.current = false
            }
        }

        // Initial sync after a short delay
        const initialTimeout = setTimeout(() => {
            syncPayments()
        }, 5000) // Wait 5 seconds after page load

        // Set up periodic sync (every 30 seconds)
        intervalRef.current = setInterval(() => {
            syncPayments()
        }, 30000)

        return () => {
            clearTimeout(initialTimeout)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [session])

    // This component doesn't render anything
    return null
}

