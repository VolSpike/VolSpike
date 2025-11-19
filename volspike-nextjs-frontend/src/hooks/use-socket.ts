'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

export function useSocket() {
    const { data: session } = useSession()
    const [socket, setSocket] = useState<Socket | null>(null)

    useEffect(() => {
        const userIdValue = (session?.user as any)?.id
        const userEmail = session?.user?.email

        // Require at least a user id or email before connecting
        if (!userIdValue && !userEmail) {
            if (socket) {
                socket.disconnect()
                setSocket(null)
            }
            return
        }

        // Prefer stable userId for room names; fall back to email only if needed
        const userId = userIdValue ? String(userIdValue) : null

        const token =
            process.env.NODE_ENV === 'development'
                ? `mock-token-${userEmail || 'test-free@example.com'}-${Date.now()}`
                : userId || userEmail!

        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://localhost:3001'

        const socketInstance = io(SOCKET_URL, {
            auth: {
                token,
            },
            query: userId ? { method: 'id' } : {},
            transports: ['websocket', 'polling'],
        })

        socketInstance.on('connect', () => {
            console.log('[Socket] Connected as', { userId, userEmail })
        })

        socketInstance.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected', { reason })
        })

        socketInstance.on('connect_error', (error) => {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[Socket] Connection warning (non-fatal):', error?.message || error)
            }
        })

        setSocket(socketInstance)

        return () => {
            socketInstance.close()
            setSocket(null)
        }
        // We intentionally depend only on the stable identifiers so we reconnect
        // when identity changes, not on every session object mutation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [(session?.user as any)?.id, session?.user?.email])

    return { socket }
}
