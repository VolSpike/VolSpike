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
import axios from 'axios'
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
 * Fetch exchangeInfo from Binance proxy (or directly from Binance if proxy unavailable)
 */
async function fetchExchangeInfo(): Promise<any> {
  // Try proxy first if configured and not localhost
  if (BINANCE_PROXY_URL && !BINANCE_PROXY_URL.includes('localhost')) {
    try {
      const response = await fetch(`${BINANCE_PROXY_URL}/api/binance/futures/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        return await response.json()
      }
      logger.warn(`Binance proxy returned ${response.status}, falling back to direct Binance API`)
    } catch (error) {
      logger.warn('Binance proxy unavailable, falling back to direct Binance API:', error instanceof Error ? error.message : String(error))
    }
  }

  // Fallback: Fetch directly from Binance
  try {
    const response = await fetch(`${BINANCE_API_URL}/fapi/v1/exchangeInfo`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    logger.error('Failed to fetch exchangeInfo from Binance:', error)
    throw error
  }
}

/**
 * Fetch 24h ticker stats from Binance
 * Uses axios as primary method (more reliable than native fetch in some environments)
 */
async function fetchTicker24hr(): Promise<any[]> {
  const url = `${BINANCE_API_URL}/fapi/v1/ticker/24hr`
  logger.info(`Fetching ticker/24hr from: ${url}`)
  
  try {
    // Use axios (already in dependencies, more reliable than fetch)
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VolSpike/1.0',
      },
      validateStatus: (status) => status < 500, // Don't throw on 4xx, we'll handle it
    })

    if (response.status >= 400) {
      logger.error(`Binance API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: typeof response.data === 'string' ? response.data.substring(0, 500) : response.data,
      })
      throw new Error(`Binance API returned ${response.status}: ${response.statusText}`)
    }

    const data = response.data
    const result = Array.isArray(data) ? data : []
    logger.info(`Successfully fetched ${result.length} ticker records from Binance`)
    
    if (result.length === 0) {
      logger.warn('⚠️  Binance returned empty ticker array - this is unusual')
    }
    
    return result
  } catch (error) {
    // Log full error details for debugging
    const errorDetails: any = {
      url,
    }
    
    if (axios.isAxiosError(error)) {
      errorDetails.name = 'AxiosError'
      errorDetails.message = error.message
      errorDetails.code = error.code
      errorDetails.response = error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 500) 
          : error.response.data,
      } : undefined
      errorDetails.request = error.request ? {
        method: error.config?.method,
        url: error.config?.url,
      } : undefined
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        logger.error('❌ Ticker/24hr fetch timed out after 30 seconds', errorDetails)
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        logger.error('❌ Network error fetching ticker/24hr - Binance API may be unreachable from Railway', errorDetails)
      } else if (error.response) {
        logger.error(`❌ Binance API returned error: ${error.response.status}`, errorDetails)
      } else {
        logger.error('❌ Failed to fetch ticker/24hr from Binance (axios error)', errorDetails)
      }
    } else if (error instanceof Error) {
      errorDetails.name = error.name
      errorDetails.message = error.message
      errorDetails.stack = error.stack
      logger.error('❌ Failed to fetch ticker/24hr from Binance (unknown error)', errorDetails)
    } else {
      errorDetails.error = String(error)
      logger.error('❌ Failed to fetch ticker/24hr from Binance (non-Error)', errorDetails)
    }
    
    // Also log as string for Railway logs
    logger.error(`Full error details: ${JSON.stringify(errorDetails, null, 2)}`)
    
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
  let upserted = 0
  let skipped = 0

  // Upsert each symbol
  for (const symbol of universe) {
    const symbolMeta = meta.get(symbol)
    if (!symbolMeta) {
      skipped++
      logger.warn(`Skipping ${symbol}: no metadata found`)
      continue
    }

    try {
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
        upserted++
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
        upserted++
      }
    } catch (error) {
      logger.error(`Failed to store symbol ${symbol}:`, error)
      throw error
    }
  }

  logger.info(`Stored ${upserted} symbols, skipped ${skipped} symbols`)

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

    // Debug: Log some sample volumes to verify data
    const sampleVolumes = Object.entries(tickerStats)
      .slice(0, 5)
      .map(([sym, stats]) => `${sym}: $${(stats.quoteVolume / 1e6).toFixed(2)}M`)
    logger.info(`Sample volumes: ${sampleVolumes.join(', ')}`)
    logger.info(`Using thresholds: Enter >= $${(ENTER_THRESHOLD / 1e6).toFixed(2)}M, Exit < $${(EXIT_THRESHOLD / 1e6).toFixed(2)}M`)

    // Count symbols above enter threshold
    const symbolsAboveThreshold = Object.entries(tickerStats).filter(
      ([_, stats]) => stats.quoteVolume >= ENTER_THRESHOLD
    ).length
    logger.info(`Symbols above enter threshold (>= $${(ENTER_THRESHOLD / 1e6).toFixed(2)}M): ${symbolsAboveThreshold}`)

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

    logger.info(`Computed new universe: ${result.newSet.size} symbols`)

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
    logger.info(`Storing ${result.newSet.size} symbols to database...`)
    await storeLiquidUniverse(result.newSet, result.meta)
    logger.info(`✅ Database storage complete`)

    // Verify data was stored
    const storedCount = await prisma.openInterestLiquidSymbol.count()
    logger.info(`✅ Verified: ${storedCount} symbols in database`)

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
    const errorStack = error instanceof Error ? error.stack : undefined
    errors.push(errorMsg)
    
    // Log full error details
    logger.error('❌ Liquid universe job failed with exception:', {
      error: errorMsg,
      stack: errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errors: errors,
    })
    
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

