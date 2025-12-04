'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'

export interface OIAlert {
  id: string
  symbol: string
  direction: 'UP' | 'DOWN'
  baseline: number
  current: number
  pctChange: number
  absChange: number
  source: string
  ts: string
  createdAt: string
}

interface UseOIAlertsOptions {
  autoFetch?: boolean
  onNewAlert?: () => void // Callback when new alert arrives
}

export function useOIAlerts(options: UseOIAlertsOptions = {}) {
  const { autoFetch = true, onNewAlert } = options
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<OIAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Only admin users can access OI alerts
  const userRole = (session?.user as any)?.role
  const isAdmin = userRole === 'ADMIN'

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false)
      return // Non-admin users don't fetch
    }

    try {
      setError(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/open-interest-alerts`, {
        credentials: 'include', // Send cookies for auth
      })

      if (response.status === 403) {
        setError('Admin access required')
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch OI alerts: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts)
      }

      setIsLoading(false)
    } catch (err) {
      console.error('Failed to fetch OI alerts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
      setIsLoading(false)
    }
  }, [isAdmin])

  // Fetch alerts on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch && isAdmin) {
      fetchAlerts()
    } else if (!isAdmin) {
      setIsLoading(false)
    }
  }, [autoFetch, isAdmin, fetchAlerts])

  // Set up WebSocket connection for real-time alerts (admin only)
  useEffect(() => {
    if (typeof window === 'undefined' || !session || !isAdmin) return

    const apiUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const userEmail = session?.user?.email as string | undefined
    const userId = (session?.user as any)?.id as string | undefined

    // Prefer email auth, fallback to userId
    const authToken = userEmail || userId
    const authMethod = userEmail ? undefined : 'id'

    if (!authToken) {
      console.warn('No auth token available for OI alerts WebSocket')
      return
    }

    const socket = io(apiUrl, {
      auth: { token: authToken },
      query: authMethod ? { method: authMethod } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current)
        disconnectTimerRef.current = null
      }
      console.log('✅ Connected to OI alerts WebSocket (admin)')
      setIsConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from OI alerts WebSocket')
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current)
      disconnectTimerRef.current = setTimeout(() => setIsConnected(false), 800)
    })

    socket.on('connect_error', (err) => {
      console.error('OI alerts WebSocket connection error:', err)
      setIsConnected(false)
    })

    // Listen for new OI alerts (admin room only)
    socket.on('open-interest-alert', (newAlert: OIAlert) => {
      console.log('📨 Received OI alert via socket:', newAlert.symbol, newAlert.direction)
      setAlerts(prev => {
        // Add new alert at the beginning, remove duplicates
        const filtered = prev.filter(a => a.id !== newAlert.id)
        return [newAlert, ...filtered].slice(0, 100) // Keep last 100 alerts
      })

      // Notify parent component (for sound/animation)
      if (onNewAlert) {
        console.log('📞 Calling onNewAlert callback for OI alert')
        onNewAlert()
      }
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
    }
  }, [session, isAdmin, onNewAlert])

  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
    isConnected,
    isAdmin,
  }
}
