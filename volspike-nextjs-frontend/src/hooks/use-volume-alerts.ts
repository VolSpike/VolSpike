'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'

export interface VolumeAlert {
  id: string
  symbol: string
  asset: string
  currentVolume: number
  previousVolume: number
  volumeRatio: number
  price?: number
  fundingRate?: number
  candleDirection?: 'bullish' | 'bearish' | null
  message: string
  timestamp: string
  hourTimestamp: string
  isUpdate: boolean
  alertType: 'SPIKE' | 'HALF_UPDATE' | 'FULL_UPDATE'
}

interface UseVolumeAlertsOptions {
  pollInterval?: number // milliseconds (fallback when WebSocket disconnected)
  autoFetch?: boolean
  onNewAlert?: () => void // Callback when new alert arrives
  // Enable near-live guest preview without auth (polling every few seconds)
  guestLive?: boolean
  guestVisibleCount?: number
}

export function useVolumeAlerts(options: UseVolumeAlertsOptions = {}) {
  const { pollInterval = 15000, autoFetch = true, onNewAlert, guestLive = false, guestVisibleCount = 2 } = options
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<VolumeAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [nextUpdate, setNextUpdate] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get tier from session, default to free
  const tier = (session?.user as any)?.tier || 'free'
  const isGuest = !session?.user
  
  // Calculate the last broadcast time for the current tier
  const getLastBroadcastTime = useCallback(() => {
    const now = new Date()
    const currentMinute = now.getMinutes()
    
    if (tier === 'elite') {
      return now // Elite gets everything in real-time
    } else if (tier === 'pro') {
      // Pro tier: :00, :05, :10, :15, etc. - find last 5-minute mark
      const lastBroadcastMinute = Math.floor(currentMinute / 5) * 5
      const lastBroadcast = new Date(now)
      lastBroadcast.setMinutes(lastBroadcastMinute, 0, 0)
      return lastBroadcast
    } else {
      // Free tier: :00, :15, :30, :45 - find last 15-minute mark
      const lastBroadcastMinute = Math.floor(currentMinute / 15) * 15
      const lastBroadcast = new Date(now)
      lastBroadcast.setMinutes(lastBroadcastMinute, 0, 0)
      return lastBroadcast
    }
  }, [tier])
  
  // Calculate the next broadcast time for countdown
  const getNextBroadcastTime = useCallback(() => {
    const now = new Date()
    const currentMinute = now.getMinutes()
    
    if (tier === 'elite') {
      return 0 // Elite is real-time, no countdown
    } else if (tier === 'pro') {
      // Pro tier: next 5-minute mark
      const nextBroadcastMinute = Math.ceil((currentMinute + 1) / 5) * 5
      const nextBroadcast = new Date(now)
      nextBroadcast.setMinutes(nextBroadcastMinute, 0, 0)
      return nextBroadcast.getTime()
    } else {
      // Free tier: next 15-minute mark (:00, :15, :30, :45)
      const nextBroadcastMinute = Math.ceil((currentMinute + 1) / 15) * 15
      const nextBroadcast = new Date(now)
      nextBroadcast.setMinutes(nextBroadcastMinute, 0, 0)
      return nextBroadcast.getTime()
    }
  }, [tier])
  
  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      setError(null)
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/volume-alerts?tier=${tier}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Backend already filters by tier limit (10/50/100)
      // Socket.IO handles wall-clock batching via tier-based rooms
      // Just use the alerts as-is from backend
      if (data.alerts && Array.isArray(data.alerts)) {
        const arr = Array.isArray(data.alerts) ? data.alerts : []
        // Always keep the full Free limit for guests so UI can blur below top 2
        // Backend already caps by tier; keep as-is
        setAlerts(arr)
      }
      
      setIsLoading(false)
    } catch (err) {
      console.error('Failed to fetch volume alerts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
      setIsLoading(false)
    }
  }, [tier, getLastBroadcastTime, guestLive, guestVisibleCount])
  
  // Fetch alerts on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch) {
      fetchAlerts()
    }
  }, [autoFetch, fetchAlerts])
  
  // Update countdown timer for next alert batch
  useEffect(() => {
    if (tier === 'elite') {
      setNextUpdate(0) // No countdown for elite
      return
    }
    
    const updateCountdown = () => {
      const next = getNextBroadcastTime()
      setNextUpdate(next)
    }
    
    // Update immediately
    updateCountdown()
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(interval)
  }, [tier, getNextBroadcastTime])
  
  // Set up WebSocket connection for real-time alerts
  useEffect(() => {
    // Guests: try true live via Socket.IO with a lightweight guest token; gracefully fall back to polling
    if (typeof window === 'undefined' || (!session && !guestLive)) return

    const apiUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const userEmail = session?.user?.email as string | undefined
    const userId = (session?.user as any)?.id as string | undefined

    if (!userEmail && guestLive && !session) {
      try {
        const socket = io(apiUrl, {
          auth: { token: 'guest' },
          query: { tier: 'free' },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        })

        socketRef.current = socket

        socket.on('connect', () => {
          if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
          console.log('✅ Guest connected to volume alerts WebSocket (free tier)')
          setIsConnected(true)
          setError(null)
        })

        socket.on('volume-alert', (newAlert: VolumeAlert) => {
          setAlerts(prev => {
            const filtered = prev.filter(a => a.id !== newAlert.id)
            return [newAlert, ...filtered].slice(0, getTierLimit('free'))
          })
          if (onNewAlert) onNewAlert()
        })

        socket.on('disconnect', () => {
          console.log('❌ Guest socket disconnected; continuing polling fallback')
          if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current)
          disconnectTimerRef.current = setTimeout(() => setIsConnected(false), 800)
        })

        socket.on('connect_error', (err) => {
          console.warn('Guest WebSocket connection error:', err?.message || err)
          setIsConnected(false)
        })

        return () => {
          socket.disconnect()
        }
      } catch (e) {
        console.warn('Guest socket setup failed, using polling:', e)
        setIsConnected(false)
      }
      return
    }

    // Signed-in users: prefer email if present; otherwise fall back to userId with method=id
    if (!userEmail && session && userId) {
      const socket = io(apiUrl, {
        auth: { token: userId },
        query: { method: 'id' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })
      socketRef.current = socket
      socket.on('connect', () => {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
        console.log('✅ Wallet-only user connected to alerts WebSocket (by id)')
        setIsConnected(true)
        setError(null)
      })
      socket.on('disconnect', () => {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current)
        disconnectTimerRef.current = setTimeout(() => setIsConnected(false), 800)
      })
      socket.on('connect_error', (err) => { console.warn('Socket error:', err); setIsConnected(false) })
      socket.on('volume-alert', (a: VolumeAlert) => {
        setAlerts(prev => {
          const filtered = prev.filter(x => x.id !== a.id)
          return [a, ...filtered].slice(0, getTierLimit(tier))
        })
        if (onNewAlert) onNewAlert()
      })
      return () => socket.disconnect()
    }
    
    // Connect to Socket.IO with user email as token
    const socket = io(apiUrl, {
      auth: {
        token: userEmail, // Backend uses email to look up user and tier
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    
    socketRef.current = socket
    
    socket.on('connect', () => {
      console.log(`✅ Connected to volume alerts WebSocket (${tier} tier)`)
      setIsConnected(true)
      setError(null)
    })
    
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from volume alerts WebSocket')
      setIsConnected(false)
    })
    
    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err)
      setIsConnected(false)
      // Fallback to polling when WebSocket fails
    })
    
    // Listen for new volume alerts
    socket.on('volume-alert', (newAlert: VolumeAlert) => {
      console.log('📢 Received real-time volume alert:', newAlert.asset)
      setAlerts(prev => {
        // Add new alert at the beginning, remove duplicates
        const filtered = prev.filter(a => a.id !== newAlert.id)
        return [newAlert, ...filtered].slice(0, getTierLimit(tier))
      })
      
      // Notify parent component (for unread badge on mobile)
      if (onNewAlert) {
        onNewAlert()
      }
    })
    
    // Cleanup on unmount
    return () => {
      socket.disconnect()
    }
  }, [tier, session, guestLive])
  
  // Set up polling: fast for guest-live, fallback when socket disconnected otherwise
  useEffect(() => {
    if (!autoFetch) return

    const guestInterval = 3000 // 3s near-live for guests
    const intervalMs = guestLive ? guestInterval : pollInterval
    if (intervalMs <= 0) return

    if (intervalRef.current) clearInterval(intervalRef.current)

    // Always poll in guest-live; otherwise only when disconnected
    if (guestLive || !isConnected) {
      intervalRef.current = setInterval(() => {
        fetchAlerts()
      }, intervalMs)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoFetch, pollInterval, fetchAlerts, isConnected, guestLive])
  
  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
    tier,
    isConnected, // Expose connection status
    nextUpdate, // Expose next broadcast time for countdown
  }
}

function getTierLimit(tier: string): number {
  const limits: Record<string, number> = {
    free: 10,
    pro: 50,
    elite: 100,
  }
  return limits[tier] || 10
}
