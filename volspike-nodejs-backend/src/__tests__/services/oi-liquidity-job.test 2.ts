/**
 * Open Interest Liquidity Job Tests
 * 
 * Tests for the liquid universe classification job service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runLiquidUniverseJob, getLiquidUniverseForAPI } from '../../services/oi-liquidity-job'

// Mock fetch globally
global.fetch = vi.fn()

// Mock Prisma
vi.mock('../../index', () => {
  const mockFindMany = vi.fn()
  const mockFindUnique = vi.fn()
  const mockCreate = vi.fn()
  const mockUpdate = vi.fn()
  const mockDeleteMany = vi.fn()

  return {
    prisma: {
      openInterestLiquidSymbol: {
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        create: mockCreate,
        update: mockUpdate,
        deleteMany: mockDeleteMany,
      },
    },
  }
})

// Mock logger
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Import after mocks
import { prisma } from '../../index'

const mockPrisma = prisma as any
const mockFetch = global.fetch as any

describe('runLiquidUniverseJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/binance/futures/info')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
                  symbol: 'SOLUSDT',
                  contractType: 'PERPETUAL',
                  quoteAsset: 'USDT',
                  status: 'TRADING',
                },
              ],
            }),
        })
      } else if (url.includes('/fapi/v1/ticker/24hr')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { symbol: 'BTCUSDT', quoteVolume: '5000000' },
              { symbol: 'ETHUSDT', quoteVolume: '3000000' },
              { symbol: 'SOLUSDT', quoteVolume: '1000000' },
            ]),
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    mockPrisma.openInterestLiquidSymbol.findMany.mockResolvedValue([])
    mockPrisma.openInterestLiquidSymbol.findUnique.mockResolvedValue(null)
    mockPrisma.openInterestLiquidSymbol.create.mockResolvedValue({ symbol: 'BTCUSDT' })
    mockPrisma.openInterestLiquidSymbol.update.mockResolvedValue({ symbol: 'BTCUSDT' })
    mockPrisma.openInterestLiquidSymbol.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('should add symbols above enter threshold', async () => {
    // BTCUSDT: 5M (above 4M threshold) -> should be added
    // ETHUSDT: 3M (between thresholds) -> should NOT be added (not in current set)
    // SOLUSDT: 1M (below threshold) -> should NOT be added

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(true)
    expect(result.totalSymbols).toBe(1) // Only BTCUSDT
    expect(mockPrisma.openInterestLiquidSymbol.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.openInterestLiquidSymbol.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symbol: 'BTCUSDT',
        quoteVolume24h: 5000000,
      }),
    })
  })

  it('should keep existing symbols between thresholds (hysteresis)', async () => {
    // Start with ETHUSDT in universe (3M volume)
    mockPrisma.openInterestLiquidSymbol.findMany.mockResolvedValue([
      { symbol: 'ETHUSDT' },
    ])
    mockPrisma.openInterestLiquidSymbol.findUnique.mockImplementation((args: any) => {
      if (args.where.symbol === 'ETHUSDT') {
        return Promise.resolve({ symbol: 'ETHUSDT' })
      }
      return Promise.resolve(null)
    })

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(true)
    expect(result.totalSymbols).toBe(2) // BTCUSDT (new) + ETHUSDT (kept)
    expect(mockPrisma.openInterestLiquidSymbol.update).toHaveBeenCalledWith({
      where: { symbol: 'ETHUSDT' },
      data: expect.objectContaining({
        quoteVolume24h: 3000000,
      }),
    })
  })

  it('should remove symbols below exit threshold', async () => {
    // Start with SOLUSDT in universe (1M volume, below 2M exit threshold)
    mockPrisma.openInterestLiquidSymbol.findMany.mockResolvedValue([
      { symbol: 'SOLUSDT' },
    ])
    mockPrisma.openInterestLiquidSymbol.findUnique.mockResolvedValue(null)

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(true)
    expect(result.symbolsRemoved).toBe(1)
    expect(mockPrisma.openInterestLiquidSymbol.deleteMany).toHaveBeenCalledWith({
      where: {
        symbol: {
          in: ['SOLUSDT'],
        },
      },
    })
  })

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.totalSymbols).toBe(0)
  })

  it('should handle Binance proxy errors', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/binance/futures/info')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should handle database errors gracefully', async () => {
    mockPrisma.openInterestLiquidSymbol.findMany.mockRejectedValueOnce(
      new Error('Database connection failed')
    )

    const result = await runLiquidUniverseJob()

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('getLiquidUniverseForAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.openInterestLiquidSymbol.findMany.mockResolvedValue([
      {
        symbol: 'BTCUSDT',
        quoteVolume24h: 5000000,
        enteredAt: new Date('2025-12-01T10:00:00Z'),
        lastSeenAt: new Date('2025-12-01T12:00:00Z'),
      },
      {
        symbol: 'ETHUSDT',
        quoteVolume24h: 3000000,
        enteredAt: new Date('2025-12-01T11:00:00Z'),
        lastSeenAt: new Date('2025-12-01T12:00:00Z'),
      },
    ])
  })

  it('should return liquid universe with metadata', async () => {
    const result = await getLiquidUniverseForAPI()

    expect(result.totalSymbols).toBe(2)
    expect(result.enterThreshold).toBe(4000000)
    expect(result.exitThreshold).toBe(2000000)
    expect(result.symbols).toHaveLength(2)
    expect(result.symbols[0].symbol).toBe('BTCUSDT')
    expect(result.symbols[0].quoteVolume24h).toBe(5000000)
    expect(result.symbols[0].estimatedPollIntervalSec).toBeDefined()
  })

  it('should calculate estimated polling interval', async () => {
    const result = await getLiquidUniverseForAPI()

    // With 2 symbols and default 2000 req/min, interval should be ~6 seconds
    // But clamped to min 5 seconds
    expect(result.symbols[0].estimatedPollIntervalSec).toBe(5)
  })
})

