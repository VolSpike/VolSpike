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
}

export function useVolumeAlerts(options: UseVolumeAlertsOptions = {}) {
  const { pollInterval = 15000, autoFetch = true } = options // Default: 15 seconds polling as fallback
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<VolumeAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)
  
  // Get tier from session, default to free
  const tier = (session?.user as any)?.tier || 'free'
  
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
      
      // Only update if we have new data
      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts)
      }
      
      setIsLoading(false)
    } catch (err) {
      console.error('Failed to fetch volume alerts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
      setIsLoading(false)
    }
  }, [tier])
  
  // Fetch alerts on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch) {
      fetchAlerts()
    }
  }, [autoFetch, fetchAlerts])
  
  // Set up WebSocket connection for real-time alerts
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return // Skip on server-side or when not logged in
    
    const apiUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const userEmail = session.user?.email
    
    if (!userEmail) return
    
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
    })
    
    // Cleanup on unmount
    return () => {
      socket.disconnect()
    }
  }, [tier, session])
  
  // Set up polling as fallback (only when disconnected)
  useEffect(() => {
    if (!autoFetch || pollInterval <= 0) return
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Only poll if WebSocket is disconnected
    if (!isConnected) {
      intervalRef.current = setInterval(() => {
        fetchAlerts()
      }, pollInterval)
    }
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoFetch, pollInterval, fetchAlerts, isConnected])
  
  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
    tier,
    isConnected, // Expose connection status
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

