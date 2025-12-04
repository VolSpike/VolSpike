/**
 * Open Interest Ingestion Tests
 * 
 * Integration tests for the Open Interest ingestion endpoint.
 * Tests both legacy snapshot format and new realtime format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { OpenInterestIngestRequest } from '../../openInterest/openInterest.types'

// Mock Prisma before importing the service
vi.mock('../../index', () => {
  const mockCreateFn = vi.fn()
  return {
    prisma: {
      openInterestSnapshot: {
        create: mockCreateFn,
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
  }),
}))

// Import service after mocks are set up
import { ingestOpenInterest } from '../../openInterest/openInterest.service'
import { prisma } from '../../index'

const mockPrisma = prisma as any

describe('ingestOpenInterest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.openInterestSnapshot.create.mockResolvedValue({ id: 'test-id' })
  })

  it('should ingest legacy snapshot payload (no source)', async () => {

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
          markPrice: 64000.0,
        },
      ],
      timestamp: '2025-12-01T12:34:56Z',
    }

    const result = await ingestOpenInterest(request)

    expect(result.success).toBe(true)
    expect(result.inserted).toBe(1)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledWith({
      data: {
        symbol: 'BTCUSDT',
        ts: new Date('2025-12-01T12:34:56Z'),
        openInterest: 123456.789,
        openInterestUsd: 7890000.0,
        markPrice: 64000.0,
        source: 'snapshot', // Default source
      },
    })
  })

  it('should ingest realtime payload with source', async () => {

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'ETHUSDT',
          openInterest: 50000.0,
          openInterestUsd: 150000000.0,
          markPrice: 3000.0,
        },
      ],
      timestamp: '2025-12-01T12:34:56Z',
      source: 'realtime',
    }

    const result = await ingestOpenInterest(request)

    expect(result.success).toBe(true)
    expect(result.inserted).toBe(1)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledWith({
      data: {
        symbol: 'ETHUSDT',
        ts: new Date('2025-12-01T12:34:56Z'),
        openInterest: 50000.0,
        openInterestUsd: 150000000.0,
        markPrice: 3000.0,
        source: 'realtime',
      },
    })
  })

  it('should handle multiple symbols', async () => {

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
        },
        {
          symbol: 'ETHUSDT',
          openInterest: 50000.0,
          openInterestUsd: 150000000.0,
        },
        {
          symbol: 'SOLUSDT',
          openInterest: 100000.0,
          openInterestUsd: 20000000.0,
        },
      ],
    }

    const result = await ingestOpenInterest(request)

    expect(result.success).toBe(true)
    expect(result.inserted).toBe(3)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledTimes(3)
  })

  it('should skip invalid items and continue processing', async () => {

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
        },
        {
          // Missing symbol
          openInterest: 50000.0,
        } as any,
        {
          symbol: 'ETHUSDT',
          // Missing openInterest
          openInterestUsd: 150000000.0,
        } as any,
        {
          symbol: 'SOLUSDT',
          openInterest: 100000.0,
          openInterestUsd: 20000000.0,
        },
      ],
    }

    const result = await ingestOpenInterest(request)

    expect(result.inserted).toBe(2) // Only BTCUSDT and SOLUSDT
    expect(result.errors.length).toBeGreaterThan(0)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledTimes(2)
  })

  it('should normalize symbols (remove dashes/underscores, uppercase)', async () => {

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'btc-usdt', // lowercase with dash
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
        },
        {
          symbol: 'ETH_USDT', // uppercase with underscore
          openInterest: 50000.0,
          openInterestUsd: 150000000.0,
        },
      ],
    }

    await ingestOpenInterest(request)

    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        symbol: 'BTCUSDT', // Normalized
      }),
    })
    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        symbol: 'ETHUSDT', // Normalized
      }),
    })
  })

  it('should use current timestamp if not provided', async () => {

    const before = new Date()
    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
        },
      ],
    }

    await ingestOpenInterest(request)
    const after = new Date()

    expect(mockPrisma.openInterestSnapshot.create).toHaveBeenCalledTimes(1)
    const callTimestamp = (mockPrisma.openInterestSnapshot.create.mock.calls[0][0].data.ts as Date).getTime()
    expect(callTimestamp).toBeGreaterThanOrEqual(before.getTime())
    expect(callTimestamp).toBeLessThanOrEqual(after.getTime())
  })

  it('should handle database errors gracefully', async () => {
    mockPrisma.openInterestSnapshot.create
      .mockRejectedValueOnce(new Error('Database connection failed'))
      .mockResolvedValueOnce({ id: 'test-id' })

    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.789,
          openInterestUsd: 7890000.0,
        },
        {
          symbol: 'ETHUSDT',
          openInterest: 50000.0,
          openInterestUsd: 150000000.0,
        },
      ],
    }

    const result = await ingestOpenInterest(request)

    expect(result.inserted).toBe(1) // Only ETHUSDT succeeded
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.success).toBe(false) // Not all succeeded
  })
})

