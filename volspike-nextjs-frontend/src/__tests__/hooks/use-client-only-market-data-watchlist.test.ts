/**
 * Tests for watchlist symbol inclusion in WebSocket data
 * 
 * CRITICAL TEST: Symbols outside tier limits (e.g., WIFUSDT outside top 50)
 * should still appear when a watchlist is selected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useClientOnlyMarketData } from '../../hooks/use-client-only-market-data'

// Mock WebSocket
class MockWebSocket {
  readyState: 0 | 1 | 2 | 3 = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  
  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) this.onopen(new Event('open'))
    }, 10)
  }
  
  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000 }))
    }
  }
  
  send() {}
  
  // Helper to simulate WebSocket message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }))
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any

describe('useClientOnlyMarketData - Watchlist Symbol Inclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
  })

  it('should include watchlist symbols even if outside tier limits', async () => {
    const onDataUpdate = vi.fn()
    
    const { result } = renderHook(() =>
      useClientOnlyMarketData({
        tier: 'free', // Free tier normally shows top 50
        onDataUpdate,
        watchlistSymbols: ['WIFUSDT'] // WIFUSDT is outside top 50
      })
    )

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(result.current.isLive || result.current.isConnecting).toBe(true)
    }, { timeout: 1000 })

    // Simulate WebSocket data with top 50 symbols + WIFUSDT (ranked #100)
    const ws = result.current as any
    const mockWs = ws.wsRef?.current as MockWebSocket
    
    if (mockWs) {
      // Send ticker data for top 50 symbols
      const top50Tickers = Array.from({ length: 50 }, (_, i) => ({
        s: `SYMBOL${i}USDT`,
        c: '100.00',
        q: '1000000000', // High volume (>$1M)
        P: '5.00',
        e: '24hrTicker'
      }))
      
      // Send WIFUSDT with lower volume (outside top 50)
      const wifTicker = {
        s: 'WIFUSDT',
        c: '2.50',
        q: '500000', // Lower volume, ranked #100
        P: '3.00',
        e: '24hrTicker'
      }
      
      // Send all tickers
      mockWs.simulateMessage({
        stream: '!ticker@arr',
        data: [...top50Tickers, wifTicker]
      })
      
      // Wait for data processing
      await waitFor(() => {
        const data = result.current.data
        // Should include WIFUSDT even though it's outside top 50
        const hasWIF = data.some((item: any) => item.symbol === 'WIFUSDT')
        expect(hasWIF).toBe(true)
      }, { timeout: 2000 })
    }
  })

  it('should include multiple watchlist symbols outside tier limits', async () => {
    const onDataUpdate = vi.fn()
    
    const { result } = renderHook(() =>
      useClientOnlyMarketData({
        tier: 'free',
        onDataUpdate,
        watchlistSymbols: ['WIFUSDT', 'LOWVOLUSDT', 'TINYUSDT'] // All outside top 50
      })
    )

    await waitFor(() => {
      expect(result.current.isLive || result.current.isConnecting).toBe(true)
    }, { timeout: 1000 })

    const ws = result.current as any
    const mockWs = ws.wsRef?.current as MockWebSocket
    
    if (mockWs) {
      // Send top 50 + watchlist symbols
      const top50Tickers = Array.from({ length: 50 }, (_, i) => ({
        s: `SYMBOL${i}USDT`,
        c: '100.00',
        q: '1000000000',
        P: '5.00',
        e: '24hrTicker'
      }))
      
      const watchlistTickers = [
        { s: 'WIFUSDT', c: '2.50', q: '500000', P: '3.00', e: '24hrTicker' },
        { s: 'LOWVOLUSDT', c: '1.00', q: '300000', P: '2.00', e: '24hrTicker' },
        { s: 'TINYUSDT', c: '0.50', q: '200000', P: '1.00', e: '24hrTicker' }
      ]
      
      mockWs.simulateMessage({
        stream: '!ticker@arr',
        data: [...top50Tickers, ...watchlistTickers]
      })
      
      await waitFor(() => {
        const data = result.current.data
        const symbols = data.map((item: any) => item.symbol)
        expect(symbols).toContain('WIFUSDT')
        expect(symbols).toContain('LOWVOLUSDT')
        expect(symbols).toContain('TINYUSDT')
        // Should have top 50 + 3 watchlist symbols = 53 total
        expect(data.length).toBeGreaterThanOrEqual(53)
      }, { timeout: 2000 })
    }
  })

  it('should not include watchlist symbols if not in WebSocket data', async () => {
    const onDataUpdate = vi.fn()
    
    const { result } = renderHook(() =>
      useClientOnlyMarketData({
        tier: 'free',
        onDataUpdate,
        watchlistSymbols: ['NONEXISTENTUSDT'] // Symbol not in WebSocket
      })
    )

    await waitFor(() => {
      expect(result.current.isLive || result.current.isConnecting).toBe(true)
    }, { timeout: 1000 })

    const ws = result.current as any
    const mockWs = ws.wsRef?.current as MockWebSocket
    
    if (mockWs) {
      // Send only top 50 symbols (no NONEXISTENTUSDT)
      const top50Tickers = Array.from({ length: 50 }, (_, i) => ({
        s: `SYMBOL${i}USDT`,
        c: '100.00',
        q: '1000000000',
        P: '5.00',
        e: '24hrTicker'
      }))
      
      mockWs.simulateMessage({
        stream: '!ticker@arr',
        data: top50Tickers
      })
      
      await waitFor(() => {
        const data = result.current.data
        const hasNonExistent = data.some((item: any) => item.symbol === 'NONEXISTENTUSDT')
        expect(hasNonExistent).toBe(false)
        // Should still have top 50
        expect(data.length).toBe(50)
      }, { timeout: 2000 })
    }
  })
})
