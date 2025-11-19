'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const { data: session } = useSession()

    useEffect(() => {
        if (!session) return

        // Prefer userId for Socket.io authentication (for user-specific room matching)
        // Fallback to email if userId not available
        const userId = (session.user as any)?.id
        const userEmail = session.user?.email || 'test-free@example.com'
        
        // Use userId with method=id query param for proper room matching
        // This ensures user-deleted events are broadcast to the correct room
        const token = process.env.NODE_ENV === 'development'
            ? `mock-token-${userEmail}-${Date.now()}`
            : userId || userEmail

        // Use dedicated Socket.IO URL; never point to Binance WS URL
        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://localhost:3001'
        const socketInstance = io(SOCKET_URL, {
            auth: {
                token: token,
            },
            query: userId ? { method: 'id' } : {}, // Tell backend to use ID lookup
            transports: ['websocket', 'polling'],
        })

        socketInstance.on('connect', () => {
            setIsConnected(true)
            console.log('Socket connected')
        })

        socketInstance.on('disconnect', () => {
            setIsConnected(false)
            console.log('Socket disconnected')
        })

        socketInstance.on('connect_error', (error) => {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Socket connection warning (non-fatal):', error?.message || error)
            }
        })

        setSocket(socketInstance)

        return () => {
            socketInstance.close()
        }
    }, [session])

    return { socket, isConnected }
}
