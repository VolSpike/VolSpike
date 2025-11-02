'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface VolumeAlert {
  id: string
  symbol: string
  asset: string
  currentVolume: number
  previousVolume: number
  volumeRatio: number
  price?: number
  fundingRate?: number
  message: string
  timestamp: string
  hourTimestamp: string
  isUpdate: boolean
  alertType: 'SPIKE' | 'HALF_UPDATE' | 'FULL_UPDATE'
}

interface UseVolumeAlertsOptions {
  pollInterval?: number // milliseconds
  autoFetch?: boolean
}

export function useVolumeAlerts(options: UseVolumeAlertsOptions = {}) {
  const { pollInterval = 60000, autoFetch = true } = options // Default: 1 minute polling
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<VolumeAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
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
  
  // Set up polling
  useEffect(() => {
    if (!autoFetch || pollInterval <= 0) return
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Set up new interval
    intervalRef.current = setInterval(() => {
      fetchAlerts()
    }, pollInterval)
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoFetch, pollInterval, fetchAlerts])
  
  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
    tier,
  }
}

