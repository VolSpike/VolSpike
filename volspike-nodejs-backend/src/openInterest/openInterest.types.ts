/**
 * Open Interest Types
 * 
 * TypeScript interfaces and types for Open Interest realtime feature.
 * These types define the contracts for API requests/responses and internal data structures.
 */

/**
 * Single Open Interest sample input
 */
export interface OpenInterestSampleInput {
  symbol: string
  openInterest: number // Contracts
  openInterestUsd?: number // USD notional (optional, can be computed)
  markPrice?: number // Mark price (optional)
  source?: 'snapshot' | 'realtime' | 'snapshot_legacy'
}

/**
 * Bulk Open Interest ingestion request
 */
export interface OpenInterestIngestRequest {
  data: OpenInterestSampleInput[]
  timestamp?: string // ISO 8601 timestamp
  totalSymbols?: number // Optional count
  source?: 'snapshot' | 'realtime' | 'snapshot_legacy'
}

/**
 * Open Interest alert input
 */
export interface OpenInterestAlertInput {
  symbol: string
  direction: 'UP' | 'DOWN'
  baseline: number // Baseline OI (contracts)
  current: number // Current OI (contracts)
  pctChange: number // Percentage change (e.g., 0.1 for 10%)
  absChange: number // Absolute change in contracts
  timestamp: string // ISO 8601 timestamp
  source: string // e.g., 'oi_realtime_poller'
}

/**
 * Liquid universe symbol metadata
 */
export interface LiquidSymbolMeta {
  symbol: string
  quoteVolume24h: number
  enteredAt: string // ISO 8601 timestamp
  lastSeenAt: string // ISO 8601 timestamp
  estimatedPollIntervalSec?: number
}

/**
 * Liquid universe response
 */
export interface LiquidUniverseResponse {
  updatedAt: string // ISO 8601 timestamp
  enterThreshold: number
  exitThreshold: number
  symbols: LiquidSymbolMeta[]
  totalSymbols: number
}

/**
 * Open Interest sample query parameters
 */
export interface OISampleQueryParams {
  symbol?: string
  limit?: number
  source?: 'snapshot' | 'realtime' | 'all'
}

/**
 * Open Interest alert query parameters
 */
export interface OIAlertQueryParams {
  symbol?: string
  limit?: number
  direction?: 'UP' | 'DOWN'
}

