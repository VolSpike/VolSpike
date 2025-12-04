/**
 * Open Interest Types Tests
 * 
 * Tests for TypeScript type validation and DTO serialization/parsing.
 */

import { describe, it, expect } from 'vitest'
import type {
  OpenInterestSampleInput,
  OpenInterestIngestRequest,
  OpenInterestAlertInput,
} from '../../openInterest/openInterest.types'

describe('OpenInterestSampleInput', () => {
  it('should accept valid sample input', () => {
    const sample: OpenInterestSampleInput = {
      symbol: 'BTCUSDT',
      openInterest: 123456.789,
      openInterestUsd: 7890000.0,
      markPrice: 64000.0,
      source: 'realtime',
    }

    expect(sample.symbol).toBe('BTCUSDT')
    expect(sample.openInterest).toBe(123456.789)
    expect(sample.openInterestUsd).toBe(7890000.0)
    expect(sample.markPrice).toBe(64000.0)
    expect(sample.source).toBe('realtime')
  })

  it('should accept minimal sample input', () => {
    const sample: OpenInterestSampleInput = {
      symbol: 'ETHUSDT',
      openInterest: 50000.0,
    }

    expect(sample.symbol).toBe('ETHUSDT')
    expect(sample.openInterest).toBe(50000.0)
    expect(sample.openInterestUsd).toBeUndefined()
    expect(sample.markPrice).toBeUndefined()
    expect(sample.source).toBeUndefined()
  })
})

describe('OpenInterestIngestRequest', () => {
  it('should accept valid ingest request', () => {
    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.0,
          openInterestUsd: 7890000.0,
        },
        {
          symbol: 'ETHUSDT',
          openInterest: 50000.0,
        },
      ],
      timestamp: '2025-12-01T12:34:56Z',
      totalSymbols: 2,
      source: 'realtime',
    }

    expect(request.data).toHaveLength(2)
    expect(request.timestamp).toBe('2025-12-01T12:34:56Z')
    expect(request.totalSymbols).toBe(2)
    expect(request.source).toBe('realtime')
  })

  it('should accept legacy snapshot format (no source)', () => {
    const request: OpenInterestIngestRequest = {
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.0,
          openInterestUsd: 7890000.0,
        },
      ],
    }

    expect(request.data).toHaveLength(1)
    expect(request.source).toBeUndefined()
  })
})

describe('OpenInterestAlertInput', () => {
  it('should accept valid UP alert', () => {
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

    expect(alert.symbol).toBe('BTCUSDT')
    expect(alert.direction).toBe('UP')
    expect(alert.baseline).toBe(150000.0)
    expect(alert.current).toBe(165000.0)
    expect(alert.pctChange).toBe(0.1)
    expect(alert.absChange).toBe(15000.0)
    expect(alert.source).toBe('oi_realtime_poller')
  })

  it('should accept valid DOWN alert', () => {
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

    expect(alert.direction).toBe('DOWN')
    expect(alert.pctChange).toBe(-0.1)
    expect(alert.absChange).toBe(-20000.0)
  })
})

describe('Type serialization/parsing', () => {
  it('should serialize and parse OpenInterestIngestRequest from JSON', () => {
    const json = JSON.stringify({
      data: [
        {
          symbol: 'BTCUSDT',
          openInterest: 123456.0,
          openInterestUsd: 7890000.0,
        },
      ],
      timestamp: '2025-12-01T12:34:56Z',
      source: 'realtime',
    })

    const parsed = JSON.parse(json) as OpenInterestIngestRequest

    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0].symbol).toBe('BTCUSDT')
    expect(parsed.data[0].openInterest).toBe(123456.0)
    expect(parsed.timestamp).toBe('2025-12-01T12:34:56Z')
    expect(parsed.source).toBe('realtime')
  })

  it('should serialize and parse OpenInterestAlertInput from JSON', () => {
    const json = JSON.stringify({
      symbol: 'BTCUSDT',
      direction: 'UP',
      baseline: 150000.0,
      current: 165000.0,
      pctChange: 0.1,
      absChange: 15000.0,
      timestamp: '2025-12-01T12:34:56Z',
      source: 'oi_realtime_poller',
    })

    const parsed = JSON.parse(json) as OpenInterestAlertInput

    expect(parsed.symbol).toBe('BTCUSDT')
    expect(parsed.direction).toBe('UP')
    expect(parsed.baseline).toBe(150000.0)
    expect(parsed.current).toBe(165000.0)
    expect(parsed.pctChange).toBe(0.1)
    expect(parsed.absChange).toBe(15000.0)
  })
})

