'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

interface MarketData {
    symbol: string
    price: number
    volume24h: number
    volumeChange: number
    fundingRate: number
    openInterest: number
    timestamp: number
}

export function useMarketData() {
    const { data: session } = useSession()

    return useQuery({
        queryKey: ['market-data'],
        queryFn: async (): Promise<MarketData[]> => {
            // Debug: log what we're sending
            console.log('[useMarketData] Session:', session)
            console.log('[useMarketData] AccessToken:', session?.accessToken)
            console.log('[useMarketData] User ID:', session?.user?.id)

            // Use accessToken if available, fallback to user ID
            const token = session?.accessToken || session?.user?.id || 'unknown'
            console.log('[useMarketData] Sending token:', token)

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/market/data`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })

            console.log('[useMarketData] Response status:', response.status)

            if (!response.ok) {
                const errorText = await response.text()
                console.error('[useMarketData] Error response:', errorText)
                throw new Error('Failed to fetch market data')
            }

            const result = await response.json()

            // Handle new response format with stale indicator
            if (result.stale) {
                console.warn('[useMarketData] Received stale data:', result.message)
            }

            return result.data || result // Backward compatibility
        },
        enabled: !!session,
        refetchInterval: session?.user?.tier === 'elite' ? 30000 : 300000, // 30s for elite, 5min for others
        staleTime: session?.user?.tier === 'elite' ? 15000 : 60000, // 15s for elite, 1min for others
    })
}
