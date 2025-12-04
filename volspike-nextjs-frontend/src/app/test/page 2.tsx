'use client'

import { useState, useEffect, useRef } from 'react'
import { MarketTable } from '@/components/market-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MarketData {
    symbol: string
    price: number
    volume24h: number
    change24h?: number
    volumeChange?: number
    fundingRate: number
    openInterest: number
    timestamp: number
}

export default function TestPage() {
    const [currentMarketData, setCurrentMarketData] = useState<MarketData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<number>(0)
    const [dataSource, setDataSource] = useState<string>('')
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
    const [nextUpdateCountdown, setNextUpdateCountdown] = useState<number>(0)

    const wsRef = useRef<WebSocket | null>(null)
    const tickersRef = useRef<Map<string, any>>(new Map())
    const fundingRef = useRef<Map<string, any>>(new Map())
    const lastEmitRef = useRef(0)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Tier-based throttling (for demo, using 'elite' - real-time)
    const TIER = 'elite' // 'elite' | 'pro' | 'free'
    const MIN_INTERVAL = TIER === 'elite' ? 0 : (TIER === 'pro' ? 300_000 : 900_000) // 0ms, 5min, 15min

    const buildSnapshot = () => {
        const snapshot: MarketData[] = []
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
                    fundingRate: funding ? parseFloat(funding.r || funding.fr || '0') : 0,
                    openInterest: 0, // WebSocket doesn't provide open interest
                    timestamp: Date.now()
                })
            }
        }

        // Sort by volume descending
        return snapshot.sort((a, b) => b.volume24h - a.volume24h)
    }

    const emitData = () => {
        const snapshot = buildSnapshot()
        const now = Date.now()

        if (MIN_INTERVAL === 0 || now - lastEmitRef.current >= MIN_INTERVAL) {
            setCurrentMarketData(snapshot)
            setLastUpdate(now)
            lastEmitRef.current = now
            setDataSource('Binance WebSocket (Live)')
        }
    }

    const connectWebSocket = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        setConnectionStatus('connecting')
        console.log('🔄 Connecting to Binance WebSocket (client-side)...')

        const url = 'wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr'
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('✅ Binance WebSocket connected (client-side)')
            setConnectionStatus('connected')
            setError(null)
            // Clear previous data on successful reconnect
            tickersRef.current.clear()
            fundingRef.current.clear()
            lastEmitRef.current = 0
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                const payload = msg?.data ?? msg
                const arr = Array.isArray(payload) ? payload : [payload]

                for (const it of arr) {
                    // Heuristics: 24hr ticker vs mark price payloads
                    if (it?.e === '24hrTicker' || it?.c || it?.v) {
                        tickersRef.current.set(it.s, it)
                    }
                    if (it?.r !== undefined || it?.fr !== undefined) {
                        fundingRef.current.set(it.s, it)
                    }
                }
                emitData()
            } catch (parseError) {
                console.error('Error parsing WebSocket message:', parseError)
            }
        }

        ws.onerror = (event) => {
            console.error('❌ Binance WebSocket error:', event)
            setConnectionStatus('error')
            setError('WebSocket connection error')
        }

        ws.onclose = (event) => {
            console.warn('⚠️ Binance WebSocket disconnected:', event.code, event.reason)
            setConnectionStatus('disconnected')

            // Attempt to reconnect after a delay
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('Attempting to reconnect Binance WebSocket...')
                connectWebSocket()
            }, 5000) // Reconnect after 5 seconds
        }
    }

    useEffect(() => {
        setIsLoading(true)

        // Connect to Binance WebSocket
        connectWebSocket()

        // Countdown timer for non-elite tiers
        const countdownInterval = setInterval(() => {
            if (MIN_INTERVAL > 0 && lastEmitRef.current > 0) {
                const timeSinceLastUpdate = Date.now() - lastEmitRef.current
                const timeUntilNext = MIN_INTERVAL - timeSinceLastUpdate
                setNextUpdateCountdown(Math.max(0, Math.ceil(timeUntilNext / 1000)))
            }
        }, 1000)

        setIsLoading(false)

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            clearInterval(countdownInterval)
        }
    }, [])

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="container mx-auto max-w-6xl">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            🚀 VolSpike Market Data Test
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                (Plan A: Client-Side WebSocket)
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Direct Binance WebSocket connection (client-side)
                            {lastUpdate > 0 ? (
                                <span className="ml-2 text-green-500">
                                    ● Live Data (Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago)
                                </span>
                            ) : (
                                <span className="ml-2 text-yellow-500">● Connecting...</span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8">
                                <div className="text-yellow-500 mb-4">Connecting to Binance WebSocket...</div>
                            </div>
                        ) : error ? (
                            <div className="text-center py-8">
                                <div className="text-red-500 mb-4">{error}</div>
                                <button
                                    onClick={() => {
                                        setError(null)
                                        connectWebSocket()
                                    }}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    Retry Connection
                                </button>
                            </div>
                        ) : currentMarketData.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="text-yellow-500 mb-4">Waiting for market data...</div>
                                <div className="text-sm text-gray-500">Connection Status: {connectionStatus}</div>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-4 text-sm text-gray-600">
                                    Showing {currentMarketData.length} symbols from {dataSource}
                                    {TIER !== 'elite' && nextUpdateCountdown > 0 && (
                                        <span className="ml-2 text-blue-500">
                                            • Next update in {nextUpdateCountdown}s
                                        </span>
                                    )}
                                </div>
                                <MarketTable data={currentMarketData} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Connection Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div>WebSocket: <span className={connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}>
                                    {connectionStatus === 'connected' ? '✅ Connected' : '❌ ' + connectionStatus}
                                </span></div>
                                <div>Data Source: <span className="text-green-500">{dataSource || 'Unknown'}</span></div>
                                <div>Last Update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}</div>
                                <div>Data Points: {currentMarketData.length}</div>
                                <div>Tier: <span className="text-blue-500">{TIER.toUpperCase()}</span></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div>Binance WebSocket: <span className={connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}>
                                    {connectionStatus === 'connected' ? '✅ Live' : '❌ Blocked/Error'}
                                </span></div>
                                <div>Backend API: <span className="text-gray-500">⏸️ Not Needed</span></div>
                                <div>Redis: <span className="text-gray-500">⏸️ Not Needed</span></div>
                                <div className="mt-2 pt-2 border-t">
                                    <div className="text-xs text-gray-500">
                                        <strong>Client-Side Architecture:</strong> Direct WebSocket connection from browser bypasses all server-side blocking.
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}