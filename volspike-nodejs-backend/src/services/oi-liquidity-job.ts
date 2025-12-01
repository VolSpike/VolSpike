/**
 * Open Interest Liquidity Job Service
 * 
 * Periodically computes and maintains the liquid OI universe by:
 * 1. Fetching exchangeInfo from Binance proxy
 * 2. Fetching ticker/24hr stats from Binance
 * 3. Computing liquid universe using thresholds
 * 4. Storing results in database
 */

import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import {
  filterUsdtPerps,
  computeLiquidUniverse,
  estimatePollingInterval,
  type TickerStats,
} from '../openInterest/openInterest.liquidUniverse.service'

const logger = createLogger()

// Configuration
const ENTER_THRESHOLD = parseFloat(process.env.OI_LIQUID_ENTER_QUOTE_24H || '4000000') // 4M USDT default
const EXIT_THRESHOLD = parseFloat(process.env.OI_LIQUID_EXIT_QUOTE_24H || '2000000') // 2M USDT default
const BINANCE_PROXY_URL = process.env.BINANCE_PROXY_URL || 'http://localhost:3002'
const BINANCE_API_URL = 'https://fapi.binance.com'

/**
 * Fetch exchangeInfo from Binance proxy
 */
async function fetchExchangeInfo(): Promise<any> {
  try {
    const response = await fetch(`${BINANCE_PROXY_URL}/api/binance/futures/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Binance proxy returned ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    logger.error('Failed to fetch exchangeInfo from Binance proxy:', error)
    throw error
  }
}

/**
 * Fetch 24h ticker stats from Binance
 */
async function fetchTicker24hr(): Promise<any[]> {
  try {
    const response = await fetch(`${BINANCE_API_URL}/fapi/v1/ticker/24hr`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    logger.error('Failed to fetch ticker/24hr from Binance:', error)
    throw error
  }
}

/**
 * Get current liquid universe from database
 */
async function getCurrentUniverse(): Promise<Set<string>> {
  const liquidSymbols = await prisma.openInterestLiquidSymbol.findMany({
    select: {
      symbol: true,
    },
  })

  return new Set(liquidSymbols.map((s) => s.symbol))
}

/**
 * Store liquid universe to database
 */
async function storeLiquidUniverse(
  universe: Set<string>,
  meta: Map<string, { quoteVolume24h: number; lastUpdated: Date }>
): Promise<void> {
  const now = new Date()

  // Upsert each symbol
  for (const symbol of universe) {
    const symbolMeta = meta.get(symbol)
    if (!symbolMeta) {
      continue
    }

    // Check if symbol already exists
    const existing = await prisma.openInterestLiquidSymbol.findUnique({
      where: { symbol },
    })

    if (existing) {
      // Update existing
      await prisma.openInterestLiquidSymbol.update({
        where: { symbol },
        data: {
          quoteVolume24h: symbolMeta.quoteVolume24h,
          lastSeenAt: now,
        },
      })
    } else {
      // Create new
      await prisma.openInterestLiquidSymbol.create({
        data: {
          symbol,
          quoteVolume24h: symbolMeta.quoteVolume24h,
          enteredAt: now,
          lastSeenAt: now,
        },
      })
    }
  }

  // Remove symbols that are no longer in universe
  const symbolsToRemove = await prisma.openInterestLiquidSymbol.findMany({
    where: {
      symbol: {
        notIn: Array.from(universe),
      },
    },
  })

  if (symbolsToRemove.length > 0) {
    await prisma.openInterestLiquidSymbol.deleteMany({
      where: {
        symbol: {
          in: symbolsToRemove.map((s) => s.symbol),
        },
      },
    })

    logger.info(`Removed ${symbolsToRemove.length} symbols from liquid universe`)
  }
}

/**
 * Run liquid universe classification job
 */
export async function runLiquidUniverseJob(): Promise<{
  success: boolean
  symbolsAdded: number
  symbolsRemoved: number
  totalSymbols: number
  errors: string[]
}> {
  const errors: string[] = []
  let symbolsAdded = 0
  let symbolsRemoved = 0

  try {
    logger.info('🔄 Starting liquid universe classification job')

    // 1. Fetch exchangeInfo from proxy
    const exchangeInfo = await fetchExchangeInfo()
    const perps = filterUsdtPerps(exchangeInfo)
    logger.info(`Found ${perps.length} USDT perpetual contracts`)

    // 2. Fetch ticker stats
    const tickerData = await fetchTicker24hr()
    const tickerStats: Record<string, TickerStats> = {}

    for (const ticker of tickerData) {
      if (perps.includes(ticker.symbol)) {
        tickerStats[ticker.symbol] = {
          quoteVolume: parseFloat(ticker.quoteVolume) || 0,
        }
      }
    }

    logger.info(`Fetched ticker stats for ${Object.keys(tickerStats).length} symbols`)

    // 3. Get current universe
    const currentUniverse = await getCurrentUniverse()
    logger.info(`Current liquid universe: ${currentUniverse.size} symbols`)

    // 4. Compute new universe
    const result = computeLiquidUniverse(
      perps,
      tickerStats,
      ENTER_THRESHOLD,
      EXIT_THRESHOLD,
      currentUniverse
    )

    // Calculate symbols added (in newSet but not in currentUniverse)
    for (const symbol of result.newSet) {
      if (!currentUniverse.has(symbol)) {
        symbolsAdded++
      }
    }

    // Calculate symbols removed (in currentUniverse but not in newSet)
    for (const symbol of currentUniverse) {
      if (!result.newSet.has(symbol)) {
        symbolsRemoved++
      }
    }

    // 5. Store to database
    await storeLiquidUniverse(result.newSet, result.meta)

    logger.info(`✅ Liquid universe job completed: ${result.newSet.size} symbols (${symbolsAdded > 0 ? `+${symbolsAdded}` : symbolsAdded} added, ${symbolsRemoved > 0 ? `-${symbolsRemoved}` : symbolsRemoved} removed)`)

    return {
      success: true,
      symbolsAdded: Math.max(0, symbolsAdded),
      symbolsRemoved: Math.max(0, symbolsRemoved),
      totalSymbols: result.newSet.size,
      errors,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(errorMsg)
    logger.error('❌ Liquid universe job failed:', error)
    return {
      success: false,
      symbolsAdded: 0,
      symbolsRemoved: 0,
      totalSymbols: 0,
      errors,
    }
  }
}

/**
 * Get current liquid universe for API endpoint
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

  return {
    updatedAt: new Date().toISOString(),
    enterThreshold: ENTER_THRESHOLD,
    exitThreshold: EXIT_THRESHOLD,
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

