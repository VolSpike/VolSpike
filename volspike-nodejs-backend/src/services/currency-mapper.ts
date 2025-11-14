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
    // NowPayments might also use: usdc_erc20, usdc-eth, usdc_eth, usdce, usdcerc20
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
      // Ethereum-specific formats - try multiple variations
      networkSpecificFormats.push(
        // ERC20 formats (most common)
        `${baseCode}-erc20`,          // usdc-erc20
        `${baseCode}_erc20`,          // usdc_erc20
        `${baseCode}erc20`,           // usdcerc20
        // ETH formats
        `${baseCode}_eth`,            // usdc_eth
        `${baseCode}-eth`,            // usdc-eth
        `${baseCode}eth`,             // usdceth
        // Ethereum full name formats
        `${baseCode}_ethereum`,       // usdc_ethereum
        `${baseCode}-ethereum`,       // usdc-ethereum
        // Our mapped code
        mapping.nowpaymentsCode.toLowerCase(), // usdc-erc20
        // Original code (in case NowPayments uses it directly)
        ourCode.toLowerCase(),        // usdce
        ourCode.toUpperCase(),        // USDCE
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
      // For Ethereum, try multiple network identifiers
      const networkIdentifiers = isSolana 
        ? ['sol', 'spl', 'solana']
        : isEthereum 
        ? ['erc20', 'eth', 'ethereum', 'erc-20'] // Multiple identifiers for Ethereum
        : [network.substring(0, 3)]
      
      for (const networkIdentifier of networkIdentifiers) {
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
          
          // For Ethereum, be more flexible - accept if it includes format OR network identifier
          if (isEthereum) {
            return includesFormat || (includesNetwork && c.includes(baseCode))
          }
          
          return includesFormat && includesNetwork
        })
        
        if (match) {
          logger.info('Currency code matched with network-specific format (fuzzy)', {
            ourCode,
            matchedCode: match,
            triedFormat: format,
            networkIdentifier,
            displayName: mapping.displayName,
            network: mapping.network,
            matchType: 'network-specific-fuzzy',
          })
          return match
        }
      }
    }
    
    // Additional fallback: Try to find any currency that contains baseCode and network identifier
    if (isEthereum || isSolana) {
      const networkIdentifiers = isSolana 
        ? ['sol', 'spl']
        : ['erc20', 'eth']
      
      for (const networkIdentifier of networkIdentifiers) {
        const fallbackMatch = normalizedAvailable.find(c => {
          // Must contain both base code and network identifier
          const hasBaseCode = c.includes(baseCode)
          const hasNetwork = c.includes(networkIdentifier)
          
          // Exclude wrong networks
          if (isSolana && (c.includes('erc20') || c.includes('eth'))) {
            return false
          }
          if (isEthereum && (c.includes('sol') || c.includes('spl'))) {
            return false
          }
          
          return hasBaseCode && hasNetwork
        })
        
        if (fallbackMatch) {
          logger.info('Currency code matched with fallback search', {
            ourCode,
            matchedCode: fallbackMatch,
            networkIdentifier,
            displayName: mapping.displayName,
            network: mapping.network,
            matchType: 'fallback',
          })
          return fallbackMatch
        }
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

