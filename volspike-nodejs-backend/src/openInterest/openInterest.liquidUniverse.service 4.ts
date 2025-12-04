/**
 * Open Interest Liquid Universe Service
 * 
 * Pure functions for classifying and maintaining the liquid OI universe.
 * This service contains the core logic for determining which symbols qualify as "liquid"
 * based on volume thresholds and hysteresis.
 */

import type { LiquidSymbolMeta } from './openInterest.types'

/**
 * Filter USDT perpetual contracts from exchangeInfo
 */
export function filterUsdtPerps(exchangeInfo: any): string[] {
  if (!exchangeInfo || !Array.isArray(exchangeInfo.symbols)) {
    return []
  }

  return exchangeInfo.symbols
    .filter((sym: any) => {
      return (
        sym.contractType === 'PERPETUAL' &&
        sym.quoteAsset === 'USDT' &&
        sym.status === 'TRADING'
      )
    })
    .map((sym: any) => sym.symbol)
}

/**
 * Ticker statistics for a symbol
 */
export interface TickerStats {
  quoteVolume: number // 24h quote volume in USDT
}

/**
 * Liquid universe computation result
 */
export interface LiquidUniverseResult {
  newSet: Set<string>
  meta: Map<string, { quoteVolume24h: number; lastUpdated: Date }>
}

/**
 * Compute liquid universe based on thresholds and hysteresis
 * 
 * @param perps - List of USDT perpetual symbols
 * @param tickerStats - Map of symbol -> ticker statistics
 * @param enterThreshold - Quote volume threshold to enter universe (e.g., 4M USDT)
 * @param exitThreshold - Quote volume threshold to exit universe (e.g., 2M USDT)
 * @param currentSet - Current set of symbols in universe
 * @returns New universe set and metadata
 */
export function computeLiquidUniverse(
  perps: string[],
  tickerStats: Record<string, TickerStats>,
  enterThreshold: number,
  exitThreshold: number,
  currentSet: Set<string>
): LiquidUniverseResult {
  const newSet = new Set<string>()
  const meta = new Map<string, { quoteVolume24h: number; lastUpdated: Date }>()

  const now = new Date()

  for (const symbol of perps) {
    const stats = tickerStats[symbol]
    if (!stats) {
      // Skip symbols without ticker stats
      continue
    }

    const quoteVolume = stats.quoteVolume || 0
    const isCurrentlyIn = currentSet.has(symbol)

    // Hysteresis logic:
    // - Enter: if not in universe and volume >= enterThreshold
    // - Exit: if in universe and volume < exitThreshold
    // - Keep: if in universe and volume >= exitThreshold (but may be < enterThreshold)

    if (!isCurrentlyIn) {
      // Not in universe: enter if above threshold
      if (quoteVolume >= enterThreshold) {
        newSet.add(symbol)
        meta.set(symbol, {
          quoteVolume24h: quoteVolume,
          lastUpdated: now,
        })
      }
    } else {
      // In universe: exit if below exit threshold, otherwise keep
      if (quoteVolume < exitThreshold) {
        // Remove from universe
        // (don't add to newSet)
      } else {
        // Keep in universe
        newSet.add(symbol)
        meta.set(symbol, {
          quoteVolume24h: quoteVolume,
          lastUpdated: now,
        })
      }
    }
  }

  return {
    newSet,
    meta,
  }
}

/**
 * Estimate polling interval based on universe size and rate limits
 * 
 * @param universeSize - Number of symbols in liquid universe
 * @param maxReqPerMin - Maximum requests per minute (default: 2000)
 * @param minIntervalSec - Minimum interval in seconds (default: 5)
 * @param maxIntervalSec - Maximum interval in seconds (default: 20)
 * @returns Estimated polling interval in seconds
 */
export function estimatePollingInterval(
  universeSize: number,
  maxReqPerMin: number = 2000,
  minIntervalSec: number = 5,
  maxIntervalSec: number = 20
): number {
  if (universeSize <= 0) {
    return maxIntervalSec
  }

  const pollsPerMinPerSymbol = maxReqPerMin / universeSize
  const rawInterval = 60.0 / pollsPerMinPerSymbol

  // Clamp to bounds
  return Math.min(
    maxIntervalSec,
    Math.max(minIntervalSec, Math.round(rawInterval))
  )
}

