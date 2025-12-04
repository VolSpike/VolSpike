import { useState, useEffect, useRef, useCallback } from 'react'

interface MarketData {
  symbol: string
  price: number
  volume24h: number
  change24h: number
  fundingRate?: number
  timestamp: number
}

interface UseBinanceWebSocketProps {
  tier: 'elite' | 'pro' | 'free'
  onDataUpdate: (data: MarketData[]) => void
  onError?: (error: string) => void
}

export const useBinanceWebSocket = ({
  tier,
  onDataUpdate,
  onError
}: UseBinanceWebSocketProps) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const wsRef = useRef<WebSocket | null>(null)
  const tickersRef = useRef<Map<string, any>>(new Map())
  const fundingRef = useRef<Map<string, any>>(new Map())
  const lastEmitRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Tier-based throttling intervals (in milliseconds)
  const MIN_INTERVAL = tier === 'elite' ? 0 : (tier === 'pro' ? 300_000 : 900_000) // 0ms, 5min, 15min

  const buildSnapshot = useCallback(() => {
    const snapshot: MarketData[] = []

    // Convert Map to Array for iteration
    const tickerEntries = Array.from(tickersRef.current.entries())

    for (const [symbol, ticker] of tickerEntries) {
      const funding = fundingRef.current.get(symbol)

      // Only include USDT pairs with sufficient volume
      if (symbol.endsWith('USDT') && ticker.v && parseFloat(ticker.v) > 1000000) {
        snapshot.push({
          symbol,
          price: parseFloat(ticker.c || ticker.lastPrice || '0'),
          volume24h: parseFloat(ticker.v || ticker.quoteVolume || '0'),
          change24h: parseFloat(ticker.P || ticker.priceChangePercent || '0'),
          fundingRate: funding ? parseFloat(funding.r || funding.fr || '0') : undefined,
          timestamp: Date.now()
        })
      }
    }

    // Sort by volume descending
    return snapshot.sort((a, b) => b.volume24h - a.volume24h)
  }, [])

  const emitData = useCallback(() => {
    const snapshot = buildSnapshot()
    const now = Date.now()

    // Check if we should emit based on tier throttling
    if (tier === 'elite' || lastEmitRef.current === 0 || now - lastEmitRef.current >= MIN_INTERVAL) {
      onDataUpdate(snapshot)
      lastEmitRef.current = now
      setLastUpdate(now)
    }
  }, [tier, MIN_INTERVAL, buildSnapshot, onDataUpdate])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus('connecting')

    try {
      // Binance combined stream for tickers and funding rates
      const url = 'wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr'
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        console.log('✅ Binance WebSocket connected (client-side)')
        setIsConnected(true)
        setConnectionStatus('connected')

        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          const payload = msg?.data ?? msg
          const arr = Array.isArray(payload) ? payload : [payload]

          for (const item of arr) {
            if (!item || !item.s) continue

            // Handle 24hr ticker data
            if (item.e === '24hrTicker' || item.c || item.v) {
              tickersRef.current.set(item.s, item)
            }

            // Handle mark price data (funding rates)
            if (item.r !== undefined || item.fr !== undefined) {
              fundingRef.current.set(item.s, item)
            }
          }

          // Emit data based on tier throttling
          emitData()

        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onerror = (error) => {
        console.warn('❌ Binance WebSocket error:', error)
        setConnectionStatus('error')
        onError?.('WebSocket connection error')
      }

      wsRef.current.onclose = (event) => {
        console.log('🔌 Binance WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus('disconnected')

        // Auto-reconnect after 5 seconds unless it was a clean close
        if (event.code !== 1000 && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect to Binance WebSocket...')
            connect()
          }, 5000)
        }
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
      onError?.('Failed to create WebSocket connection')
    }
  }, [emitData, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Force emit data when tier changes
  useEffect(() => {
    if (isConnected) {
      emitData()
    }
  }, [tier, isConnected, emitData])

  return {
    isConnected,
    connectionStatus,
    lastUpdate,
    connect,
    disconnect,
    // Manual trigger for immediate update (useful for testing)
    forceUpdate: emitData
  }
}