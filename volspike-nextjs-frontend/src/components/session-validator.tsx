'use client'

import { useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'

/**
 * Component that validates user session in real-time
 * Checks if user still exists and is active
 * Logs out automatically if user was deleted or banned
 */
export function SessionValidator() {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const isCheckingRef = useRef(false)
    const lastCheckRef = useRef<number>(0)

    const checkUserStatus = async (source: string = 'unknown') => {
        // Prevent concurrent checks
        if (isCheckingRef.current) {
            console.log(`[SessionValidator] Check already in progress, skipping (source: ${source})`)
            return
        }

        if (status !== 'authenticated' || !session?.user?.id) {
            console.log(`[SessionValidator] Not authenticated, skipping check (source: ${source})`)
            return
        }

        // Throttle checks - don't check more than once per 5 seconds
        const now = Date.now()
        if (now - lastCheckRef.current < 5000) {
            console.log(`[SessionValidator] Throttled check (source: ${source}, last check: ${now - lastCheckRef.current}ms ago)`)
            return
        }

        isCheckingRef.current = true
        lastCheckRef.current = now

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const authToken = (session as any)?.accessToken || session.user.id

            console.log(`[SessionValidator] 🔍 Checking user status (source: ${source}, userId: ${session.user.id})`)

            const response = await fetch(`${apiUrl}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
                cache: 'no-store', // Ensure we don't get cached responses
            })

            console.log(`[SessionValidator] Response status: ${response.status} (source: ${source})`)

            // Check for 404 (user deleted) or 401 (user not found - backwards compatibility)
            if (response.status === 404 || response.status === 401) {
                const errorData = await response.json().catch(() => ({ error: 'User not found' }))
                
                // Double-check it's actually a "user not found" error, not an auth error
                if (response.status === 404 || errorData.error?.toLowerCase().includes('not found')) {
                    console.error(`[SessionValidator] ⚠️ User account was deleted (404/401) - logging out immediately`)
                    toast.error('Your account has been deleted. You have been logged out.', {
                        duration: 5000,
                    })
                    isCheckingRef.current = false
                    await signOut({ redirect: true, callbackUrl: '/auth' })
                    return
                }
            }

            if (!response.ok) {
                console.warn(`[SessionValidator] Non-OK response: ${response.status} (source: ${source})`)
                // Other errors - might be temporary, don't log out
                isCheckingRef.current = false
                return
            }

            const { user } = await response.json()

            if (!user) {
                console.error(`[SessionValidator] ⚠️ No user data returned - logging out`)
                toast.error('Your account has been deleted. You have been logged out.', {
                    duration: 5000,
                })
                isCheckingRef.current = false
                await signOut({ redirect: true, callbackUrl: '/auth' })
                return
            }

            console.log(`[SessionValidator] ✅ User exists: ${user.email}, status: ${user.status}, tier: ${user.tier}`)

            // Check if user is banned
            if (user.status === 'BANNED') {
                console.error(`[SessionValidator] ⚠️ User account is banned - logging out`)
                toast.error('Your account has been banned. You have been logged out.', {
                    duration: 5000,
                })
                isCheckingRef.current = false
                await signOut({ redirect: true, callbackUrl: '/auth' })
                return
            }

            // Check if user is suspended
            if (user.status === 'SUSPENDED') {
                console.error(`[SessionValidator] ⚠️ User account is suspended - logging out`)
                toast.error('Your account has been suspended. You have been logged out.', {
                    duration: 5000,
                })
                isCheckingRef.current = false
                await signOut({ redirect: true, callbackUrl: '/auth' })
                return
            }

            // Update session if tier or status changed
            if (
                user.tier !== session.user.tier ||
                user.status !== session.user.status ||
                user.role !== session.user.role
            ) {
                console.log(`[SessionValidator] User data changed, updating session (tier: ${session.user.tier} → ${user.tier})`)
                await update()
            }
        } catch (error) {
            console.error(`[SessionValidator] Error checking user status (source: ${source}):`, error)
        } finally {
            isCheckingRef.current = false
        }
    }

    // Check immediately on mount and when session changes
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            console.log('[SessionValidator] Initial check on mount')
            checkUserStatus('mount')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session?.user?.id])

    // Check on every page navigation
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id && pathname) {
            console.log(`[SessionValidator] Page navigation detected: ${pathname}`)
            checkUserStatus(`navigation:${pathname}`)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, status, session?.user?.id])

    // Check periodically (every 10 seconds - more aggressive)
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return
        }

        console.log('[SessionValidator] Setting up periodic check (every 10 seconds)')
        const interval = setInterval(() => {
            checkUserStatus('periodic')
        }, 10000) // Check every 10 seconds instead of 30

        return () => {
            clearInterval(interval)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session?.user?.id])

    // Check when tab becomes visible (user switches back to tab)
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return
        }

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('[SessionValidator] Tab became visible - checking user status')
                checkUserStatus('visibility')
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session?.user?.id])

    // This component doesn't render anything
    return null
}

