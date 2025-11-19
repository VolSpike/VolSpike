'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'react-hot-toast'

/**
 * Validates the current session against the backend.
 * If the user has been deleted, banned, or the token is no longer valid,
 * it aggressively signs the user out within a few seconds.
 */
export function SessionValidator() {
    const { data: session, status } = useSession()

    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const controller = new AbortController()

        const logout = async (reason: string, source: string, statusCode: number) => {
            console.error('[SessionValidator] Logging out due to backend status', {
                reason,
                source,
                statusCode,
                userId: (session.user as any).id,
            })

            toast.error('Your session is no longer valid. You have been logged out.', {
                duration: 5000,
                icon: '⚠️',
            })

            await signOut({
                redirect: true,
                callbackUrl: '/auth?reason=deleted',
            })
        }

        const check = async (source: string) => {
            try {
                // Use stable database user id for /me checks.
                // This avoids any JWT secret mismatches between environments.
                const token = String((session.user as any).id)

                const start = Date.now()
                console.log('[SessionValidator] 🔍 Checking user status', {
                    source,
                    userId: (session.user as any).id,
                })

                const res = await fetch(`${apiUrl}/api/auth/me`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Auth-Source': 'session-validator',
                    },
                    cache: 'no-store',
                    signal: controller.signal,
                })

                const elapsed = Date.now() - start
                console.log('[SessionValidator] Response from /api/auth/me', {
                    status: res.status,
                    ok: res.ok,
                    source,
                    elapsedMs: elapsed,
                })

                // Treat any 401/403/404 as fatal: user is gone or token invalid
                if (res.status === 401 || res.status === 403 || res.status === 404) {
                    await logout('unauthorized-or-deleted', source, res.status)
                    return
                }

                // Any other non-OK status is treated as a soft failure – log it but
                // don't immediately kill the session to avoid flapping on transient
                // backend issues. Deletion is always signalled via 401/403/404.
                if (!res.ok) {
                    console.warn('[SessionValidator] Non-OK response from /api/auth/me (non-fatal)', {
                        status: res.status,
                        source,
                    })
                    return
                }

                const data = await res.json().catch(() => null)
                const user = data?.user

                // Defensive: if there's no user payload, or user is banned/suspended/deleted, log out
                if (
                    !user ||
                    user.status === 'BANNED' ||
                    user.status === 'SUSPENDED' ||
                    user.deletedAt
                ) {
                    await logout('invalid-user-payload', source, res.status)
                    return
                }

                console.log('[SessionValidator] ✅ Session validated', {
                    email: user.email,
                    status: user.status,
                    tier: user.tier,
                })
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    return
                }
                console.error('[SessionValidator] Error checking user status (non-fatal)', {
                    error: error?.message || String(error),
                    source,
                })
                // Network failures are treated as transient; do not log the user out
                // automatically here to avoid aggressive flapping.
            }
        }

        // Initial check and interval
        check('initial').catch(() => {})

        const interval = setInterval(() => {
            check('interval').catch(() => {})
        }, 5000)

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                check('visibility').catch(() => {})
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            controller.abort()
            clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [status, session])

    // This component doesn't render anything
    return null
}
