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
        // Only run heartbeat checks when NextAuth reports an authenticated session.
        if (status !== 'authenticated') {
            console.log('[SessionValidator] Skipping heartbeat - status is not authenticated', {
                status,
            })
            return
        }

        if (!session?.user?.id) {
            console.log('[SessionValidator] Skipping heartbeat - no session user id', {
                status,
                hasSession: !!session,
            })
            return
        }

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
                const start = Date.now()
                console.log('[SessionValidator] 🔍 Checking user status via /api/auth/ping', {
                    source,
                    userId: (session.user as any).id,
                })

                // Call the Next.js heartbeat route, which proxies to the backend and
                // forwards status codes as-is while updating last active time.
                const res = await fetch('/api/auth/ping', {
                    method: 'GET',
                    headers: {
                        'X-Auth-Source': 'session-validator',
                    },
                    credentials: 'include',
                    cache: 'no-store',
                    signal: controller.signal,
                })

                const elapsed = Date.now() - start
                console.log('[SessionValidator] Response from /api/auth/ping', {
                    status: res.status,
                    ok: res.ok,
                    source,
                    elapsedMs: elapsed,
                })

                // Treat 404 as "user is gone" (deleted / hard missing)
                if (res.status === 404) {
                    await logout('user-not-found', source, res.status)
                    return
                }

                // 401/403 mean "not authenticated" or "forbidden" for this call.
                // We log them but do NOT force logout here to avoid races on
                // initial page load or transient auth glitches. NextAuth will
                // handle these states via its own callbacks.
                if (res.status === 401 || res.status === 403) {
                    console.warn('[SessionValidator] Auth heartbeat returned', res.status, '(non-fatal)', {
                        source,
                    })
                    return
                }

                // Any other non-OK status is treated as a soft failure – log it but
                // don't immediately kill the session to avoid flapping on transient
                // backend issues.
                if (!res.ok) {
                    console.warn('[SessionValidator] Non-OK response from /api/auth/ping (non-fatal)', {
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
