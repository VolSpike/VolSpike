/**
 * Open Interest Alerts Tests
 * 
 * Tests for the Open Interest alert ingestion endpoint.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { OpenInterestAlertInput } from '../../openInterest/openInterest.types'

// Mock Prisma before importing the service
vi.mock('../../index', () => {
  const mockCreate = vi.fn()
  return {
    prisma: {
      openInterestAlert: {
        create: mockCreate,
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
import { ingestOpenInterestAlert } from '../../openInterest/openInterest.service'
import { prisma } from '../../index'

const mockPrisma = prisma as any

describe('ingestOpenInterestAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.openInterestAlert.create.mockResolvedValue({ id: 'test-alert-id' })
  })

  it('should ingest UP alert', async () => {
    const alert: OpenInterestAlertInput = {
      symbol: 'BTCUSDT',
      direction: 'UP',
      baseline: 150000.0,
      current: 165000.0,
      pctChange: 0.1,
      absChange: 15000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    }

    const result = await ingestOpenInterestAlert(alert)

    expect(result.success).toBe(true)
    expect(result.id).toBe('test-alert-id')
    expect(mockPrisma.openInterestAlert.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.openInterestAlert.create).toHaveBeenCalledWith({
      data: {
        symbol: 'BTCUSDT',
        direction: 'UP',
        baseline: 150000.0,
        current: 165000.0,
        pctChange: 0.1,
        absChange: 15000.0,
        source: 'oi_realtime_poller',
        ts: new Date('2025-12-01T12:34:56Z'),
      },
    })
  })

  it('should ingest DOWN alert', async () => {
    const alert: OpenInterestAlertInput = {
      symbol: 'ETHUSDT',
      direction: 'DOWN',
      baseline: 200000.0,
      current: 180000.0,
      pctChange: -0.1,
      absChange: -20000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    }

    const result = await ingestOpenInterestAlert(alert)

    expect(result.success).toBe(true)
    expect(mockPrisma.openInterestAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: 'DOWN',
        pctChange: -0.1,
        absChange: -20000.0,
      }),
    })
  })

  it('should normalize symbol', async () => {
    const alert: OpenInterestAlertInput = {
      symbol: 'btc-usdt',
      direction: 'UP',
      baseline: 150000.0,
      current: 165000.0,
      pctChange: 0.1,
      absChange: 15000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    }

    await ingestOpenInterestAlert(alert)

    expect(mockPrisma.openInterestAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symbol: 'BTCUSDT', // Normalized
      }),
    })
  })

  it('should reject invalid direction', async () => {
    const alert = {
      symbol: 'BTCUSDT',
      direction: 'INVALID',
      baseline: 150000.0,
      current: 165000.0,
      pctChange: 0.1,
      absChange: 15000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    } as any

    await expect(ingestOpenInterestAlert(alert)).rejects.toThrow('Invalid direction')
  })

  it('should handle database errors', async () => {
    mockPrisma.openInterestAlert.create.mockRejectedValueOnce(new Error('Database error'))

    const alert: OpenInterestAlertInput = {
      symbol: 'BTCUSDT',
      direction: 'UP',
      baseline: 150000.0,
      current: 165000.0,
      pctChange: 0.1,
      absChange: 15000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    }

    await expect(ingestOpenInterestAlert(alert)).rejects.toThrow('Database error')
  })
})

