/**
 * Open Interest Liquidity Job Service
 * 
 * ⚠️ DEPRECATED: This service was moved to Digital Ocean per AGENTS.md architecture.
 * 
 * Per AGENTS.md: "Digital Ocean Script: ✅ ONLY place that uses Binance REST API"
 * The backend should NEVER call Binance REST API.
 * 
 * The liquid universe job now runs as a Python script on Digital Ocean:
 * - See: Digital Ocean/oi_liquid_universe_job.py
 * - Posts results to: POST /api/market/open-interest/liquid-universe/update
 * 
 * This file is kept for reference but should not be used.
 * The pure computation functions (filterUsdtPerps, computeLiquidUniverse) are still
 * available in openInterest.liquidUniverse.service.ts for use by the Python script.
 */

import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import {
  estimatePollingInterval,
} from '../openInterest/openInterest.liquidUniverse.service'

const logger = createLogger()

/**
 * Get current liquid universe for API endpoint
 * Reads from database (populated by Digital Ocean script)
 */
export async function getLiquidUniverseForAPI(): Promise<{
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
}> {
  const liquidSymbols = await prisma.openInterestLiquidSymbol.findMany({
    orderBy: {
      quoteVolume24h: 'desc',
    },
  })

  const totalSymbols = liquidSymbols.length
  const estimatedInterval = estimatePollingInterval(totalSymbols)

  // Get most recent update time
  const mostRecentUpdate = liquidSymbols.length > 0
    ? liquidSymbols.reduce((latest, sym) => {
        const lastSeen = new Date(sym.lastSeenAt).getTime()
        return lastSeen > latest ? lastSeen : latest
      }, 0)
    : Date.now()

  return {
    updatedAt: new Date(mostRecentUpdate).toISOString(),
    enterThreshold: parseFloat(process.env.OI_LIQUID_ENTER_QUOTE_24H || '4000000'),
    exitThreshold: parseFloat(process.env.OI_LIQUID_EXIT_QUOTE_24H || '2000000'),
    symbols: liquidSymbols.map((s) => ({
      symbol: s.symbol,
      quoteVolume24h: Number(s.quoteVolume24h),
      enteredAt: s.enteredAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      estimatedPollIntervalSec: estimatedInterval,
    })),
    totalSymbols,
  }
}
