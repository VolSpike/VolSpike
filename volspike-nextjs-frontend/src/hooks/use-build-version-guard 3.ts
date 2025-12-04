'use client'

import { useEffect } from 'react'

/**
 * Ensures long-lived tabs always reload onto the latest bundle.
 * This prevents “zombie” sessions that never pick up new deletion/session logic.
 */
export function useBuildVersionGuard() {
    useEffect(() => {
        const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID
        if (!currentBuildId) {
            return
        }

        const storageKey = 'volspike-build-id'

        try {
            const previousBuildId = window.localStorage.getItem(storageKey)

            if (previousBuildId && previousBuildId !== currentBuildId) {
                // Persist new build id before forcing a reload to avoid loops
                window.localStorage.setItem(storageKey, currentBuildId)
                console.log('[BuildVersionGuard] Build changed, reloading tab', {
                    previousBuildId,
                    currentBuildId,
                })
                window.location.reload()
                return
            }

            if (!previousBuildId) {
                console.log('[BuildVersionGuard] Storing initial build id', { currentBuildId })
            }

            window.localStorage.setItem(storageKey, currentBuildId)
        } catch (error) {
            // Never break the app if localStorage is unavailable (e.g. in private mode)
            console.warn('[BuildVersionGuard] Unable to persist build id', error)
        }
    }, [])
}

