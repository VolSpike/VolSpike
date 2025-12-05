'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface SessionInvalidatedEvent {
    sessionId: string
    reason: string
    message: string
}

interface ForceLogoutEvent {
    reason: string
    message: string
}

/**
 * Validates the current session against the backend.
 * If the user has been deleted, banned, or the token is no longer valid,
 * it aggressively signs the user out within a few seconds.
 *
 * Also listens for WebSocket events to detect when the session has been
 * invalidated due to login from another device (single-session enforcement).
 */
export function SessionValidator() {
    const { data: session, status } = useSession()
    const socketRef = useRef<Socket | null>(null)

    // Handle session invalidation from WebSocket (login from another device)
    const handleSessionInvalidated = useCallback(async (data: SessionInvalidatedEvent) => {
        const currentSessionId = (session as any)?.sessionId

        // Only handle if this is our session being invalidated
        if (currentSessionId && data.sessionId !== currentSessionId) {
            console.log('[SessionValidator] Received invalidation for different session, ignoring', {
                receivedSessionId: data.sessionId,
                currentSessionId,
            })
            return
        }

        console.error('[SessionValidator] Session invalidated via WebSocket', {
            reason: data.reason,
            message: data.message,
            sessionId: data.sessionId,
        })

        const toastMessage = data.reason === 'new_login'
            ? 'You have been signed out because your account was accessed from another device.'
            : data.reason === 'user_revoked'
                ? 'This session has been ended from another device.'
                : data.message || 'Your session has ended. Please sign in again.'

        toast.error(toastMessage, {
            duration: 6000,
            icon: '🔐',
        })

        await signOut({
            redirect: true,
            callbackUrl: '/auth?reason=session_invalidated',
        })
    }, [session])

    // Handle direct force logout event
    const handleForceLogout = useCallback(async (data: ForceLogoutEvent) => {
        console.error('[SessionValidator] Force logout received', {
            reason: data.reason,
            message: data.message,
        })

        toast.error(data.message || 'Your session has ended. Please sign in again.', {
            duration: 6000,
            icon: '🔐',
        })

        await signOut({
            redirect: true,
            callbackUrl: '/auth?reason=session_invalidated',
        })
    }, [])

    // WebSocket connection for real-time session invalidation
    useEffect(() => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return
        }

        const userId = session.user.id
        const sessionId = (session as any)?.sessionId

        // Only connect if we have a sessionId (new session system)
        if (!sessionId) {
            console.log('[SessionValidator] No sessionId in session, skipping WebSocket for session invalidation')
            return
        }

        const socket = io(SOCKET_URL, {
            auth: {
                token: userId,
                sessionId: sessionId,
            },
            query: {
                method: 'id',
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        })

        socket.on('connect', () => {
            console.log('[SessionValidator] WebSocket connected for session events')
        })

        socket.on('disconnect', (reason) => {
            console.log('[SessionValidator] WebSocket disconnected:', reason)
        })

        // Listen for session invalidation events
        socket.on('session:invalidated', handleSessionInvalidated)
        socket.on('session:force-logout', handleForceLogout)

        socket.on('connect_error', (error) => {
            console.warn('[SessionValidator] WebSocket connection error:', error.message)
        })

        socketRef.current = socket

        return () => {
            socket.off('session:invalidated', handleSessionInvalidated)
            socket.off('session:force-logout', handleForceLogout)
            socket.disconnect()
            socketRef.current = null
        }
    }, [status, session, handleSessionInvalidated, handleForceLogout])

    // Existing heartbeat logic for user deletion/ban detection
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

            // Check if this is a session invalidation error
            const isSessionError = reason === 'SESSION_INVALID' || reason === 'session_invalid'

            const toastMessage = isSessionError
                ? 'Your session is no longer valid. You may have signed in on another device.'
                : 'Your session is no longer valid. You have been logged out.'

            toast.error(toastMessage, {
                duration: 5000,
                icon: isSessionError ? '🔐' : '⚠️',
            })

            await signOut({
                redirect: true,
                callbackUrl: isSessionError ? '/auth/sign-in?reason=session_invalidated' : '/auth?reason=deleted',
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

                // Check for session invalidation error (401 with SESSION_INVALID code)
                if (res.status === 401) {
                    const data = await res.json().catch(() => ({}))
                    if (data?.code === 'SESSION_INVALID') {
                        // Handle legacy token (token without sessionId) - force re-login
                        const isLegacyToken = data?.reason === 'legacy_token'
                        const toastMessage = isLegacyToken
                            ? 'Your session has expired. Please sign in again to continue.'
                            : 'Your session is no longer valid. You may have signed in on another device.'

                        toast.error(toastMessage, {
                            duration: 5000,
                            icon: '🔐',
                        })

                        await signOut({
                            redirect: true,
                            callbackUrl: '/auth?reason=session_invalidated',
                        })
                        return
                    }
                }

                // Treat all non-OK statuses as soft failures (do not auto-logout).
                // NextAuth will still handle true auth loss. This prevents flapping
                // if the backend briefly returns 404/401/403 during redeploys.
                if (!res.ok) {
                    console.warn('[SessionValidator] Non-OK response from /api/auth/ping (soft)', {
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
        // IMPORTANT: Delay initial check to avoid race with login
        setTimeout(() => {
            check('initial').catch(() => {})
        }, 2000) // Wait 2 seconds after mount before first check

        // Check every 30 seconds instead of 5 seconds to reduce server load and race conditions
        const interval = setInterval(() => {
            check('interval').catch(() => {})
        }, 30000) // 30 seconds

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
