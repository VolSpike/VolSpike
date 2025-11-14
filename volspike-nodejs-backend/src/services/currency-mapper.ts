import { createLogger } from '../lib/logger'

const logger = createLogger()

/**
 * Maps our internal currency codes to NowPayments API currency codes
 * NowPayments uses specific codes that may differ from our frontend codes
 */
export interface CurrencyMapping {
  ourCode: string
  nowpaymentsCode: string
  displayName: string
  network: string
}

/**
 * Currency code mappings from our frontend codes to NowPayments API codes
 * NowPayments uses lowercase codes, often with underscores or specific formats
 * Common formats: usdt_sol, usdt-erc20, usdtsol, etc.
 */
const CURRENCY_MAPPINGS: CurrencyMapping[] = [
  {
    ourCode: 'usdtsol',
    nowpaymentsCode: 'usdt_sol', // USDT on Solana - NowPayments uses underscore format
    displayName: 'USDT',
    network: 'Solana',
  },
  {
    ourCode: 'usdterc20',
    nowpaymentsCode: 'usdt-erc20', // USDT on Ethereum ERC-20 - NowPayments uses dash format
    displayName: 'USDT',
    network: 'Ethereum',
  },
  {
    ourCode: 'usdce',
    nowpaymentsCode: 'usdc-erc20', // USDC on Ethereum ERC-20
    displayName: 'USDC',
    network: 'Ethereum',
  },
  {
    ourCode: 'sol',
    nowpaymentsCode: 'sol',
    displayName: 'SOL',
    network: 'Solana',
  },
  {
    ourCode: 'btc',
    nowpaymentsCode: 'btc',
    displayName: 'BTC',
    network: 'Bitcoin',
  },
  {
    ourCode: 'eth',
    nowpaymentsCode: 'eth',
    displayName: 'ETH',
    network: 'Ethereum',
  },
]

/**
 * Maps our internal currency code to NowPayments API currency code
 * @param ourCode - The currency code from our frontend (e.g., 'usdtsol')
 * @param availableCurrencies - Optional list of available currencies from NowPayments API
 * @returns The NowPayments currency code, or null if not found/valid
 */
export function mapCurrencyToNowPayments(
  ourCode: string,
  availableCurrencies?: string[]
): string | null {
  // Find mapping
  const mapping = CURRENCY_MAPPINGS.find(m => m.ourCode.toLowerCase() === ourCode.toLowerCase())
  
  if (!mapping) {
    logger.warn('Currency code not found in mapping', {
      ourCode,
      availableMappings: CURRENCY_MAPPINGS.map(m => m.ourCode),
    })
    return null
  }

  // If we have available currencies from API, validate the code exists
  if (availableCurrencies && availableCurrencies.length > 0) {
    const normalizedAvailable = availableCurrencies.map(c => c.toLowerCase().trim())
    
    // Generate prioritized format variations based on network
    const baseCode = mapping.displayName.toLowerCase()
    const network = mapping.network.toLowerCase()
    const isSolana = network === 'solana'
    const isEthereum = network === 'ethereum'
    
    // Priority 1: Network-specific formats (highest priority)
    const networkSpecificFormats: string[] = []
    if (isSolana) {
      // Solana-specific formats
      networkSpecificFormats.push(
        `${baseCode}_sol`,           // usdt_sol
        `${baseCode}-sol`,           // usdt-sol
        `${baseCode}sol`,             // usdtsol
        `${baseCode}_solana`,         // usdt_solana
        `${baseCode}-solana`,         // usdt-solana
        `${baseCode}solana`,          // usdtsolana
        `${baseCode}_spl`,            // usdt_spl (SPL token)
        `${baseCode}-spl`,            // usdt-spl
        mapping.nowpaymentsCode.toLowerCase(), // Our mapped code
      )
    } else if (isEthereum) {
      // Ethereum-specific formats
      networkSpecificFormats.push(
        `${baseCode}-erc20`,          // usdt-erc20
        `${baseCode}_erc20`,          // usdt_erc20
        `${baseCode}erc20`,           // usdterc20
        `${baseCode}_eth`,            // usdt_eth
        `${baseCode}-eth`,            // usdt-eth
        `${baseCode}eth`,             // usdteth
        `${baseCode}_ethereum`,       // usdt_ethereum
        `${baseCode}-ethereum`,       // usdt-ethereum
        mapping.nowpaymentsCode.toLowerCase(), // Our mapped code
      )
    } else {
      // Other networks (Bitcoin, etc.)
      networkSpecificFormats.push(
        mapping.nowpaymentsCode.toLowerCase(),
        `${baseCode}_${network}`,
        `${baseCode}-${network}`,
        `${baseCode}${network}`,
      )
    }
    
    // Priority 2: Generic formats (lower priority - only if network-specific fails)
    const genericFormats = [
      ourCode.toLowerCase(),
      ourCode.toUpperCase(),
      `${baseCode.toUpperCase()}_${network.toUpperCase()}`,
      `${baseCode.toUpperCase()}-${network.toUpperCase()}`,
      `${baseCode.toUpperCase()}${network.toUpperCase()}`,
    ]
    
    // Try network-specific formats first (exact match)
    for (const format of networkSpecificFormats) {
      if (normalizedAvailable.includes(format)) {
        logger.info('Currency code matched with network-specific format (exact)', {
          ourCode,
          matchedCode: format,
          displayName: mapping.displayName,
          network: mapping.network,
          matchType: 'network-specific-exact',
        })
        return format
      }
    }
    
    // Try network-specific formats with fuzzy matching (must include network identifier)
    for (const format of networkSpecificFormats) {
      const networkIdentifier = isSolana ? 'sol' : isEthereum ? 'erc20' : network.substring(0, 3)
      const match = normalizedAvailable.find(c => {
        const includesFormat = c.includes(format) || format.includes(c)
        const includesNetwork = c.includes(networkIdentifier)
        // For Solana, exclude ERC20 matches
        if (isSolana && (c.includes('erc20') || c.includes('eth'))) {
          return false
        }
        // For Ethereum, exclude Solana matches
        if (isEthereum && (c.includes('sol') || c.includes('spl'))) {
          return false
        }
        return includesFormat && includesNetwork
      })
      if (match) {
        logger.info('Currency code matched with network-specific format (fuzzy)', {
          ourCode,
          matchedCode: match,
          triedFormat: format,
          displayName: mapping.displayName,
          network: mapping.network,
          matchType: 'network-specific-fuzzy',
        })
        return match
      }
    }
    
    // Last resort: Try generic formats (exact match only)
    for (const format of genericFormats) {
      if (normalizedAvailable.includes(format)) {
        logger.info('Currency code matched with generic format', {
          ourCode,
          matchedCode: format,
          displayName: mapping.displayName,
          network: mapping.network,
          matchType: 'generic-exact',
        })
        return format
      }
    }
    
    // Log all available currencies for debugging
    const usdtRelated = normalizedAvailable.filter(c => c.includes('usdt'))
    const solRelated = normalizedAvailable.filter(c => c.includes('sol'))
    
    logger.error('Currency code not found in NowPayments available currencies', {
      ourCode,
      nowpaymentsCode: mapping.nowpaymentsCode,
      displayName: mapping.displayName,
      network: mapping.network,
      availableCurrencies: availableCurrencies.slice(0, 50), // Log first 50
      availableCount: availableCurrencies.length,
      usdtRelatedCurrencies: usdtRelated,
      solRelatedCurrencies: solRelated,
      triedNetworkSpecificFormats: networkSpecificFormats,
      triedGenericFormats: genericFormats,
    })
    
    return null
  }
  
  // No validation available, return the mapped code
  logger.info('Currency code mapped (no API validation)', {
    ourCode,
    nowpaymentsCode: mapping.nowpaymentsCode,
    displayName: mapping.displayName,
  })
  
  return mapping.nowpaymentsCode
}

/**
 * Gets the display name for a currency code
 */
export function getCurrencyDisplayName(ourCode: string): string {
  const mapping = CURRENCY_MAPPINGS.find(m => m.ourCode.toLowerCase() === ourCode.toLowerCase())
  return mapping?.displayName || ourCode.toUpperCase()
}

/**
 * Gets the network for a currency code
 */
export function getCurrencyNetwork(ourCode: string): string {
  const mapping = CURRENCY_MAPPINGS.find(m => m.ourCode.toLowerCase() === ourCode.toLowerCase())
  return mapping?.network || 'Unknown'
}

/**
 * Validates that a currency code is supported
 */
export function isSupportedCurrency(ourCode: string): boolean {
  return CURRENCY_MAPPINGS.some(m => m.ourCode.toLowerCase() === ourCode.toLowerCase())
}

