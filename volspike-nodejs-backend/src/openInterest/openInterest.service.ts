/**
 * Open Interest Service
 * 
 * Business logic for Open Interest data ingestion, storage, and retrieval.
 * This service handles both legacy snapshot ingestion and new realtime OI batches.
 */

import { prisma } from '../index'
import type { OpenInterestIngestRequest, OpenInterestAlertInput } from './openInterest.types'
import { createLogger } from '../lib/logger'

const logger = createLogger()

/**
 * Normalize symbol: remove dashes/underscores and convert to uppercase
 */
function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[-_]/g, '').toUpperCase()
}

/**
 * Ingest Open Interest data (snapshot or realtime)
 */
export async function ingestOpenInterest(
  request: OpenInterestIngestRequest
): Promise<{ success: boolean; inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  // Determine source (default to 'snapshot' for backward compatibility)
  const source = request.source || 'snapshot'

  // Parse timestamp (default to now if not provided)
  const timestamp = request.timestamp
    ? new Date(request.timestamp)
    : new Date()

  try {
    // Process each OI sample
    for (const item of request.data) {
      if (!item.symbol || typeof item.openInterest !== 'number') {
        errors.push(`Invalid item: missing symbol or openInterest`)
        continue
      }

      const normalizedSymbol = normalizeSymbol(item.symbol)

      try {
        await prisma.openInterestSnapshot.create({
          data: {
            symbol: normalizedSymbol,
            ts: timestamp,
            openInterest: item.openInterest,
            openInterestUsd: item.openInterestUsd ?? null,
            markPrice: item.markPrice ?? null,
            source: source,
          },
        })
        inserted++
      } catch (error) {
        const errorMsg = `Failed to insert ${normalizedSymbol}: ${
          error instanceof Error ? error.message : String(error)
        }`
        errors.push(errorMsg)
        logger.warn(errorMsg)
      }
    }

    logger.info(`Open Interest ingestion: ${inserted} inserted, ${errors.length} errors`, {
      source,
      totalItems: request.data.length,
    })

    return {
      success: errors.length === 0,
      inserted,
      errors,
    }
  } catch (error) {
    logger.error('Open Interest ingestion failed:', error)
    throw error
  }
}

/**
 * Ingest Open Interest alert
 */
export async function ingestOpenInterestAlert(
  alert: OpenInterestAlertInput
): Promise<{ success: boolean; id?: string }> {
  try {
    const normalizedSymbol = normalizeSymbol(alert.symbol)

    // Validate direction
    if (alert.direction !== 'UP' && alert.direction !== 'DOWN') {
      throw new Error(`Invalid direction: ${alert.direction}`)
    }

    const result = await prisma.openInterestAlert.create({
      data: {
        symbol: normalizedSymbol,
        direction: alert.direction,
        baseline: alert.baseline,
        current: alert.current,
        pctChange: alert.pctChange,
        absChange: alert.absChange,
        priceChange: alert.priceChange ?? null,
        fundingRate: alert.fundingRate ?? null,
        timeframe: alert.timeframe || '5 min',
        source: alert.source,
        ts: new Date(alert.timestamp),
      },
    })

    logger.info(`Open Interest alert ingested: ${normalizedSymbol} ${alert.direction} [${alert.timeframe || '5 min'}]`, {
      symbol: normalizedSymbol,
      direction: alert.direction,
      pctChange: alert.pctChange,
      timeframe: alert.timeframe || '5 min',
    })

    return {
      success: true,
      id: result.id,
    }
  } catch (error) {
    logger.error('Open Interest alert ingestion failed:', error)
    throw error
  }
}

/**
 * Get recent Open Interest samples
 */
export async function getOpenInterestSamples(params: {
  symbol?: string
  limit?: number
  source?: 'snapshot' | 'realtime' | 'all'
}) {
  const limit = Math.min(params.limit || 50, 1000) // Cap at 1000

  const where: any = {}

  if (params.symbol) {
    where.symbol = normalizeSymbol(params.symbol)
  }

  if (params.source && params.source !== 'all') {
    where.source = params.source
  }

  return await prisma.openInterestSnapshot.findMany({
    where,
    orderBy: { ts: 'desc' },
    take: limit,
  })
}

/**
 * Get recent Open Interest alerts
 */
export async function getOpenInterestAlerts(params: {
  symbol?: string
  limit?: number
  direction?: 'UP' | 'DOWN'
}) {
  const limit = Math.min(params.limit || 20, 500) // Cap at 500

  const where: any = {}

  if (params.symbol) {
    where.symbol = normalizeSymbol(params.symbol)
  }

  if (params.direction) {
    where.direction = params.direction
  }

  return await prisma.openInterestAlert.findMany({
    where,
    orderBy: { ts: 'desc' },
    take: limit,
  })
}

