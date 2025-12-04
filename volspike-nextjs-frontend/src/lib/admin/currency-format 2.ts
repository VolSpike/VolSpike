/**
 * Formats cryptocurrency currency codes into human-readable display names.
 * 
 * CRITICAL: This function must handle all currency codes used by NowPayments and our system.
 * Currency codes are stored in the database as they come from NowPayments (e.g., 'usdce', 'usdterc20').
 * 
 * VALID VALUES (with network identifier):
 * - 'usdce' or 'USDCE' -> 'USDC on ETH'
 * - 'usdceerc20' or 'USDCERC20' -> 'USDC on ETH'
 * - 'usdcerc20' or 'USDCERC20' -> 'USDC on ETH'
 * - 'usdc_eth' or 'USDC_ETH' -> 'USDC on ETH'
 * - 'usdterc20' or 'USDTERC20' -> 'USDT on ETH'
 * - 'usdt_eth' or 'USDT_ETH' -> 'USDT on ETH'
 * - 'usdtsol' or 'USDTSOL' -> 'USDT on SOL'
 * - 'usdt_sol' or 'USDT_SOL' -> 'USDT on SOL'
 * - 'sol' or 'SOL' -> 'SOL'
 * - 'eth' or 'ETH' -> 'ETH'
 * - 'btc' or 'BTC' -> 'BTC'
 * 
 * INVALID VALUES (missing network identifier - these should NOT exist but are handled for legacy data):
 * - 'usdt' or 'USDT' -> 'USDT (Unknown Network)' - indicates data issue, should be 'usdterc20' or 'usdtsol'
 * - 'usdc' or 'USDC' -> 'USDC (Unknown Network)' - indicates data issue, should be 'usdce' or similar
 * 
 * IMPORTANT: Do not modify this logic without updating the documentation in AGENTS.md, OVERVIEW.md, and IMPLEMENTATION_PLAN.md
 * 
 * This function is used consistently across:
 * - Admin Users table (payment method display)
 * - Admin Payments table (currency display)
 * - Any other admin components that display cryptocurrency currencies
 */
export function formatCryptoCurrency(currency: string | null | undefined): string {
    if (!currency) return 'Unknown'
    
    const upper = currency.toUpperCase()
    const lower = currency.toLowerCase()
    
    // Handle USDC on Ethereum - check for all possible formats FIRST
    // This must come before generic USDC checks
    if (lower === 'usdce' || 
        lower === 'usdceerc20' || 
        lower === 'usdcerc20' ||
        upper.includes('USDC') && (upper.includes('ERC20') || upper.includes('ETH') || upper.includes('_ETH') || upper.includes('-ETH'))) {
        return 'USDC on ETH'
    }
    
    // Handle USDT on Ethereum
    if (upper.includes('USDT') && (upper.includes('ERC20') || upper.includes('ETH') || upper.includes('_ETH') || upper.includes('-ETH'))) {
        return 'USDT on ETH'
    }
    
    // Handle USDT on Solana
    if (upper.includes('USDT') && (upper.includes('SOL') || upper.includes('_SOL') || upper.includes('-SOL'))) {
        return 'USDT on SOL'
    }
    
    // Handle native tokens
    if (upper === 'SOL') return 'SOL'
    if (upper === 'ETH') return 'ETH'
    if (upper === 'BTC') return 'BTC'
    
    // Handle INVALID legacy values (missing network identifier)
    // These indicate data quality issues - the currency should always include network info
    if (upper === 'USDT') {
        // Legacy data issue: 'usdt' without network identifier
        // Default to ETH as it's more common, but mark as unknown
        return 'USDT (Unknown Network)'
    }
    if (upper === 'USDC') {
        // Legacy data issue: 'usdc' without network identifier
        // Default to ETH as it's more common, but mark as unknown
        return 'USDC (Unknown Network)'
    }
    
    // Fallback: format nicely
    return upper.replace(/_/g, ' ').replace(/-/g, ' ')
}

