/**
 * Open Interest Liquid Universe Service Tests
 * 
 * Unit tests for pure functions in the liquid universe classification logic.
 */

import { describe, it, expect } from 'vitest'
import {
  filterUsdtPerps,
  computeLiquidUniverse,
  estimatePollingInterval,
  type TickerStats,
} from '../../openInterest/openInterest.liquidUniverse.service'

describe('filterUsdtPerps', () => {
  it('should filter USDT perpetual contracts', () => {
    const exchangeInfo = {
      symbols: [
        {
          symbol: 'BTCUSDT',
          contractType: 'PERPETUAL',
          quoteAsset: 'USDT',
          status: 'TRADING',
        },
        {
          symbol: 'ETHUSDT',
          contractType: 'PERPETUAL',
          quoteAsset: 'USDT',
          status: 'TRADING',
        },
        {
          symbol: 'BTCUSD',
          contractType: 'PERPETUAL',
          quoteAsset: 'USD',
          status: 'TRADING',
        },
        {
          symbol: 'BTCUSDT',
          contractType: 'CURRENT_QUARTER',
          quoteAsset: 'USDT',
          status: 'TRADING',
        },
        {
          symbol: 'SOLUSDT',
          contractType: 'PERPETUAL',
          quoteAsset: 'USDT',
          status: 'BREAK',
        },
      ],
    }

    const result = filterUsdtPerps(exchangeInfo)

    expect(result).toEqual(['BTCUSDT', 'ETHUSDT'])
  })

  it('should return empty array for invalid input', () => {
    expect(filterUsdtPerps(null as any)).toEqual([])
    expect(filterUsdtPerps({} as any)).toEqual([])
    expect(filterUsdtPerps({ symbols: [] } as any)).toEqual([])
  })
})

describe('computeLiquidUniverse', () => {
  const enterThreshold = 4000000 // 4M USDT
  const exitThreshold = 2000000 // 2M USDT

  it('should add symbols above enter threshold', () => {
    const perps = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
    const tickerStats: Record<string, TickerStats> = {
      BTCUSDT: { quoteVolume: 5000000 }, // Above enter
      ETHUSDT: { quoteVolume: 4500000 }, // Above enter
      SOLUSDT: { quoteVolume: 1000000 }, // Below exit
    }
    const currentSet = new Set<string>()

    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      enterThreshold,
      exitThreshold,
      currentSet
    )

    expect(result.newSet.has('BTCUSDT')).toBe(true)
    expect(result.newSet.has('ETHUSDT')).toBe(true)
    expect(result.newSet.has('SOLUSDT')).toBe(false)
    expect(result.meta.get('BTCUSDT')?.quoteVolume24h).toBe(5000000)
    expect(result.meta.get('ETHUSDT')?.quoteVolume24h).toBe(4500000)
  })

  it('should remove symbols below exit threshold (hysteresis)', () => {
    const perps = ['BTCUSDT', 'ETHUSDT']
    const tickerStats: Record<string, TickerStats> = {
      BTCUSDT: { quoteVolume: 5000000 }, // Above enter
      ETHUSDT: { quoteVolume: 1500000 }, // Below exit
    }
    const currentSet = new Set<string>(['BTCUSDT', 'ETHUSDT'])

    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      enterThreshold,
      exitThreshold,
      currentSet
    )

    expect(result.newSet.has('BTCUSDT')).toBe(true) // Keep (above exit)
    expect(result.newSet.has('ETHUSDT')).toBe(false) // Remove (below exit)
  })

  it('should keep symbols between exit and enter thresholds (hysteresis)', () => {
    const perps = ['BTCUSDT', 'ETHUSDT']
    const tickerStats: Record<string, TickerStats> = {
      BTCUSDT: { quoteVolume: 5000000 }, // Above enter
      ETHUSDT: { quoteVolume: 3000000 }, // Between exit and enter
    }
    const currentSet = new Set<string>(['BTCUSDT', 'ETHUSDT'])

    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      enterThreshold,
      exitThreshold,
      currentSet
    )

    expect(result.newSet.has('BTCUSDT')).toBe(true) // Keep (above enter)
    expect(result.newSet.has('ETHUSDT')).toBe(true) // Keep (hysteresis - between thresholds)
  })

  it('should not add symbols between exit and enter thresholds if not already in set', () => {
    const perps = ['BTCUSDT', 'ETHUSDT']
    const tickerStats: Record<string, TickerStats> = {
      BTCUSDT: { quoteVolume: 5000000 }, // Above enter
      ETHUSDT: { quoteVolume: 3000000 }, // Between exit and enter
    }
    const currentSet = new Set<string>(['BTCUSDT'])

    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      enterThreshold,
      exitThreshold,
      currentSet
    )

    expect(result.newSet.has('BTCUSDT')).toBe(true) // Keep
    expect(result.newSet.has('ETHUSDT')).toBe(false) // Don't add (below enter threshold)
  })

  it('should skip symbols without ticker stats', () => {
    const perps = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
    const tickerStats: Record<string, TickerStats> = {
      BTCUSDT: { quoteVolume: 5000000 },
      // ETHUSDT missing
      SOLUSDT: { quoteVolume: 4500000 },
    }
    const currentSet = new Set<string>()

    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      enterThreshold,
      exitThreshold,
      currentSet
    )

    expect(result.newSet.has('BTCUSDT')).toBe(true)
    expect(result.newSet.has('ETHUSDT')).toBe(false)
    expect(result.newSet.has('SOLUSDT')).toBe(true)
  })
})

describe('estimatePollingInterval', () => {
  it('should compute interval for small universe', () => {
    const interval = estimatePollingInterval(100, 2000, 5, 20)
    // 2000 / 100 = 20 polls/min per symbol
    // 60 / 20 = 3s, clamped to min 5s
    expect(interval).toBe(5)
  })

  it('should compute interval for medium universe', () => {
    const interval = estimatePollingInterval(300, 2000, 5, 20)
    // 2000 / 300 ≈ 6.67 polls/min per symbol
    // 60 / 6.67 ≈ 9s
    expect(interval).toBe(9)
  })

  it('should compute interval for large universe', () => {
    const interval = estimatePollingInterval(400, 2000, 5, 20)
    // 2000 / 400 = 5 polls/min per symbol
    // 60 / 5 = 12s
    expect(interval).toBe(12)
  })

  it('should clamp to max interval', () => {
    const interval = estimatePollingInterval(1000, 2000, 5, 20)
    // 2000 / 1000 = 2 polls/min per symbol
    // 60 / 2 = 30s, clamped to max 20s
    expect(interval).toBe(20)
  })

  it('should handle zero or negative universe size', () => {
    expect(estimatePollingInterval(0, 2000, 5, 20)).toBe(20)
    expect(estimatePollingInterval(-1, 2000, 5, 20)).toBe(20)
  })

  it('should respect custom parameters', () => {
    const interval = estimatePollingInterval(100, 1000, 10, 30)
    // 1000 / 100 = 10 polls/min per symbol
    // 60 / 10 = 6s, clamped to min 10s
    expect(interval).toBe(10)
  })
})

