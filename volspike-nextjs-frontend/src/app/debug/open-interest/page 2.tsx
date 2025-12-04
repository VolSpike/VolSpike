'use client'

/**
 * Debug Page: Open Interest Realtime
 * 
 * Simple debug UI to visualize:
 * - Current liquid universe
 * - Latest OI values per symbol
 * - Recent OI alerts
 * - WebSocket connection status
 */

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://localhost:3001'

interface LiquidUniverse {
  updatedAt: string
  enterThreshold: number
  exitThreshold: number
  symbols: Array<{
    symbol: string
    quoteVolume24h: number
    enteredAt: string
    lastSeenAt: string
    estimatedPollIntervalSec?: number
  }>
  totalSymbols: number
}

interface OISample {
  id: string
  symbol: string
  ts: string
  openInterest: number
  openInterestUsd: number | null
  markPrice: number | null
  source: string
}

interface OIAlert {
  id: string
  symbol: string
  direction: 'UP' | 'DOWN'
  baseline: number
  current: number
  pctChange: number
  absChange: number
  source: string
  ts: string
}

export default function DebugOpenInterestPage() {
  const [liquidUniverse, setLiquidUniverse] = useState<LiquidUniverse | null>(null)
  const [oiSamples, setOISamples] = useState<OISample[]>([])
  const [oiAlerts, setOIAlerts] = useState<OIAlert[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [latestOI, setLatestOI] = useState<Record<string, { oi: number; oiUsd: number | null; timestamp: string }>>({})

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load liquid universe
        const universeRes = await fetch(`${API_URL}/api/market/open-interest/liquid-universe`)
        if (universeRes.ok) {
          const universe = await universeRes.json()
          setLiquidUniverse(universe)
        }

        // Load recent OI samples
        const samplesRes = await fetch(`${API_URL}/api/market/open-interest/samples?limit=50`)
        if (samplesRes.ok) {
          const data = await samplesRes.json()
          setOISamples(data.samples || [])
        }

        // Load recent OI alerts
        const alertsRes = await fetch(`${API_URL}/api/open-interest-alerts?limit=20`)
        if (alertsRes.ok) {
          const data = await alertsRes.json()
          setOIAlerts(data.alerts || [])
        }
      } catch (error) {
        console.error('Failed to load debug data:', error)
      }
    }

    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Setup WebSocket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: 'guest', // Use guest token for debug page
      },
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected')
      setSocketConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected')
      setSocketConnected(false)
    })

    // Listen for OI updates
    newSocket.on('open-interest-update', (data: {
      symbol: string
      openInterest: number
      openInterestUsd: number | null
      source: string
      timestamp: string
    }) => {
      setLatestOI((prev) => ({
        ...prev,
        [data.symbol]: {
          oi: data.openInterest,
          oiUsd: data.openInterestUsd,
          timestamp: data.timestamp,
        },
      }))
    })

    // Listen for OI alerts
    newSocket.on('open-interest-alert', (alert: OIAlert) => {
      setOIAlerts((prev) => [alert, ...prev].slice(0, 20)) // Keep last 20
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
    return num.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Open Interest Debug Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time monitoring of OI data, liquid universe, and alerts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              WebSocket: {socketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Liquid Universe */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Liquid Universe</h2>
          {liquidUniverse ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Symbols:</span>
                  <span className="ml-2 font-semibold">{liquidUniverse.totalSymbols}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Enter Threshold:</span>
                  <span className="ml-2 font-semibold">${formatNumber(liquidUniverse.enterThreshold)}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Exit Threshold:</span>
                  <span className="ml-2 font-semibold">${formatNumber(liquidUniverse.exitThreshold)}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                  <span className="ml-2 font-semibold">
                    {new Date(liquidUniverse.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Symbols ({liquidUniverse.symbols.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {liquidUniverse.symbols.slice(0, 50).map((s) => (
                    <span
                      key={s.symbol}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-xs"
                    >
                      {s.symbol}
                    </span>
                  ))}
                  {liquidUniverse.symbols.length > 50 && (
                    <span className="px-2 py-1 text-xs text-gray-500">
                      +{liquidUniverse.symbols.length - 50} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
        </div>

        {/* Latest OI Values */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Latest OI Values (WebSocket)</h2>
          {Object.keys(latestOI).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-right p-2">OI (Contracts)</th>
                    <th className="text-right p-2">OI (USD)</th>
                    <th className="text-left p-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(latestOI)
                    .slice(0, 20)
                    .map(([symbol, data]) => (
                      <tr key={symbol} className="border-b">
                        <td className="p-2 font-mono">{symbol}</td>
                        <td className="text-right p-2">{formatNumber(data.oi)}</td>
                        <td className="text-right p-2">
                          {data.oiUsd ? `$${formatNumber(data.oiUsd)}` : 'N/A'}
                        </td>
                        <td className="text-left p-2 text-xs text-gray-500">
                          {new Date(data.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No OI updates received yet via WebSocket</p>
          )}
        </div>

        {/* Recent OI Samples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent OI Samples (Database)</h2>
          {oiSamples.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-right p-2">OI (Contracts)</th>
                    <th className="text-right p-2">OI (USD)</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-left p-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {oiSamples.slice(0, 20).map((sample) => (
                    <tr key={sample.id} className="border-b">
                      <td className="p-2 font-mono">{sample.symbol}</td>
                      <td className="text-right p-2">{formatNumber(Number(sample.openInterest))}</td>
                      <td className="text-right p-2">
                        {sample.openInterestUsd ? `$${formatNumber(Number(sample.openInterestUsd))}` : 'N/A'}
                      </td>
                      <td className="text-left p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          sample.source === 'realtime' 
                            ? 'bg-green-100 dark:bg-green-900' 
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {sample.source}
                        </span>
                      </td>
                      <td className="text-left p-2 text-xs text-gray-500">
                        {new Date(sample.ts).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No OI samples found</p>
          )}
        </div>

        {/* Recent OI Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent OI Alerts</h2>
          {oiAlerts.length > 0 ? (
            <div className="space-y-2">
              {oiAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded border-l-4 ${
                    alert.direction === 'UP'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold">{alert.symbol}</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        alert.direction === 'UP'
                          ? 'bg-green-200 dark:bg-green-800'
                          : 'bg-red-200 dark:bg-red-800'
                      }`}>
                        {alert.direction}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(alert.ts).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Baseline:</span>
                      <span className="ml-2 font-semibold">{formatNumber(Number(alert.baseline))}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Current:</span>
                      <span className="ml-2 font-semibold">{formatNumber(Number(alert.current))}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Change:</span>
                      <span className={`ml-2 font-semibold ${
                        alert.pctChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(Number(alert.pctChange) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Delta:</span>
                      <span className={`ml-2 font-semibold ${
                        alert.absChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {alert.absChange >= 0 ? '+' : ''}{formatNumber(Number(alert.absChange))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No OI alerts found</p>
          )}
        </div>
      </div>
    </div>
  )
}

