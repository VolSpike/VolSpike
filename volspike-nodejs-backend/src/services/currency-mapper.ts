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
    
    // Generate all possible format variations to try
    const baseCode = mapping.displayName.toLowerCase()
    const network = mapping.network.toLowerCase()
    
    const formatVariations = [
      // Our mapped code
      mapping.nowpaymentsCode.toLowerCase(),
      // Common formats
      `${baseCode}_${network}`,           // usdt_sol
      `${baseCode}-${network}`,           // usdt-sol
      `${baseCode}${network}`,            // usdtsol
      `${baseCode}_${network.substring(0, 3)}`, // usdt_sol (short)
      `${baseCode}-${network.substring(0, 3)}`, // usdt-sol (short)
      // With ERC20/TRC20 suffixes
      `${baseCode}-erc20`,                // usdt-erc20
      `${baseCode}_erc20`,                // usdt_erc20
      `${baseCode}erc20`,                 // usdterc20
      `${baseCode}-trc20`,                // usdt-trc20
      `${baseCode}_trc20`,                // usdt_trc20
      // Uppercase variations
      `${baseCode.toUpperCase()}_${network.toUpperCase()}`,
      `${baseCode.toUpperCase()}-${network.toUpperCase()}`,
      `${baseCode.toUpperCase()}${network.toUpperCase()}`,
      // Original code variations
      ourCode.toLowerCase(),
      ourCode.toUpperCase(),
    ]
    
    // Try exact match first
    for (const variation of formatVariations) {
      if (normalizedAvailable.includes(variation)) {
        logger.info('Currency code matched successfully', {
          ourCode,
          matchedCode: variation,
          displayName: mapping.displayName,
          network: mapping.network,
          triedVariations: formatVariations.length,
        })
        return variation
      }
    }
    
    // Try partial/fuzzy matching (contains)
    for (const variation of formatVariations) {
      const match = normalizedAvailable.find(c => c.includes(variation) || variation.includes(c))
      if (match) {
        logger.info('Currency code matched with fuzzy search', {
          ourCode,
          matchedCode: match,
          triedVariation: variation,
          displayName: mapping.displayName,
          network: mapping.network,
        })
        return match
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
      triedVariations: formatVariations,
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

