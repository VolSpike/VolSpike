'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSocket } from './use-socket'

/**
 * Hook to automatically refresh session when tier changes via WebSocket
 * Listens for 'tier-changed' events and updates the session immediately
 */
export function useTierChangeListener() {
    const { data: session, update } = useSession()
    const { socket } = useSocket()
    const router = useRouter()

    useEffect(() => {
        if (!socket || !session?.user?.id) {
            return
        }

        // Listen for tier change events
        const handleTierChange = async (data: { tier: string }) => {
            const newTier = data.tier
            const currentTier = session.user?.tier || 'free'

            // Only update if tier actually changed
            if (newTier !== currentTier) {
                console.log(`🔄 Tier changed detected via WebSocket: ${currentTier} → ${newTier}`)
                
                try {
                    // Update session with new tier
                    const updatedSession = await update({
                        tier: newTier,
                    } as any)
                    
                    // Verify the update worked
                    const afterTier = updatedSession?.user?.tier || 'unknown'
                    
                    if (afterTier === newTier) {
                        console.log(`✅ Session updated successfully: tier is now ${newTier}`)
                        // Refresh the page to ensure all components pick up the change
                        router.refresh()
                    } else {
                        console.warn(`⚠️ Session update didn't take effect (expected ${newTier}, got ${afterTier}), reloading page`)
                        // If update didn't work, force reload
                        setTimeout(() => {
                            window.location.reload()
                        }, 500)
                    }
                } catch (error) {
                    console.error('Failed to update session after tier change:', error)
                    // Fallback: reload page to get fresh session
                    setTimeout(() => {
                        window.location.reload()
                    }, 1000)
                }
            }
        }

        socket.on('tier-changed', handleTierChange)

        return () => {
            socket.off('tier-changed', handleTierChange)
        }
    }, [socket, session, update, router])
}
