/**
 * Chain configuration for wallet authentication
 * 
 * CAIP-10 format: chain_id:namespace:reference
 * Examples:
 * - EVM: eip155:1 (Ethereum Mainnet), eip155:8453 (Base)
 * - Solana: solana:101 (Mainnet), solana:102 (Devnet)
 */

/**
 * Allowed EVM chains for SIWE authentication
 * Only allow chains that are actively supported
 */
export const ALLOWED_EVM_CHAINS = [
  'eip155:1',      // Ethereum Mainnet
  'eip155:8453',   // Base
  'eip155:137',    // Polygon
  'eip155:10',     // Optimism
  'eip155:42161',  // Arbitrum One
]

/**
 * Allowed Solana networks for SIWS authentication
 */
export const ALLOWED_SOLANA_NETWORKS = [
  'solana:101',    // Solana Mainnet
  // 'solana:102',  // Devnet (enable for testing)
]

/**
 * Chain name mapping for user-friendly display
 */
export const CHAIN_NAMES: Record<string, string> = {
  'eip155:1': 'Ethereum Mainnet',
  'eip155:8453': 'Base',
  'eip155:137': 'Polygon',
  'eip155:10': 'Optimism',
  'eip155:42161': 'Arbitrum One',
  'solana:101': 'Solana Mainnet',
  'solana:102': 'Solana Devnet',
}

/**
 * Validate if a chain ID is allowed
 */
export function isAllowedChain(chainId: string, provider: 'evm' | 'solana'): boolean {
  if (provider === 'evm') {
    return ALLOWED_EVM_CHAINS.includes(chainId)
  } else if (provider === 'solana') {
    return ALLOWED_SOLANA_NETWORKS.includes(chainId)
  }
  return false
}

/**
 * Get human-readable chain name
 */
export function getChainName(chainId: string): string {
  return CHAIN_NAMES[chainId] || chainId
}

