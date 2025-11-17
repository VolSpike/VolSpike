'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

/**
 * Component that validates user session in real-time
 * Checks if user still exists and is active
 * Logs out automatically if user was deleted or banned
 */
export function SessionValidator() {
    const { data: session, status, update } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return
        }

        const checkUserStatus = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                const authToken = (session as any)?.accessToken || session.user.id

                const response = await fetch(`${apiUrl}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                    },
                })

                if (response.status === 404) {
                    // User not found - account was deleted
                    console.log('[SessionValidator] ⚠️ User account was deleted - logging out')
                    toast.error('Your account has been deleted. You have been logged out.', {
                        duration: 5000,
                    })
                    await signOut({ redirect: true, callbackUrl: '/auth' })
                    return
                }

                if (!response.ok) {
                    // Other errors - might be temporary, don't log out
                    return
                }

                const { user } = await response.json()

                // Check if user is banned
                if (user.status === 'BANNED') {
                    console.log('[SessionValidator] ⚠️ User account is banned - logging out')
                    toast.error('Your account has been banned. You have been logged out.', {
                        duration: 5000,
                    })
                    await signOut({ redirect: true, callbackUrl: '/auth' })
                    return
                }

                // Check if user is suspended
                if (user.status === 'SUSPENDED') {
                    console.log('[SessionValidator] ⚠️ User account is suspended - logging out')
                    toast.error('Your account has been suspended. You have been logged out.', {
                        duration: 5000,
                    })
                    await signOut({ redirect: true, callbackUrl: '/auth' })
                    return
                }

                // Update session if tier or status changed
                if (
                    user.tier !== session.user.tier ||
                    user.status !== session.user.status ||
                    user.role !== session.user.role
                ) {
                    console.log('[SessionValidator] User data changed, updating session')
                    await update()
                }
            } catch (error) {
                // Silently fail - don't spam errors
                console.debug('[SessionValidator] Error checking user status:', error)
            }
        }

        // Check immediately
        checkUserStatus()

        // Check every 30 seconds
        const interval = setInterval(checkUserStatus, 30000)

        return () => {
            clearInterval(interval)
        }
    }, [session, status, update, router])

    // This component doesn't render anything
    return null
}

