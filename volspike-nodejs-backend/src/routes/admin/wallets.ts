import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()
const adminWalletRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const createWalletSchema = z.object({
    address: z.string().min(1),
    currency: z.string().min(1),
    network: z.string().optional(),
    label: z.string().optional(),
})

const updateWalletSchema = z.object({
    label: z.string().optional(),
})

// EVM Chain configurations
const EVM_CHAINS = {
    ethereum: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
        explorerUrl: 'https://etherscan.io',
        color: 'from-blue-500 to-blue-600',
    },
    polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon.llamarpc.com',
        explorerUrl: 'https://polygonscan.com',
        color: 'from-purple-500 to-purple-600',
    },
    optimism: {
        chainId: 10,
        name: 'Optimism',
        rpcUrl: 'https://optimism.llamarpc.com',
        explorerUrl: 'https://optimistic.etherscan.io',
        color: 'from-red-500 to-red-600',
    },
    arbitrum: {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: 'https://arbitrum.llamarpc.com',
        explorerUrl: 'https://arbiscan.io',
        color: 'from-blue-400 to-blue-500',
    },
    base: {
        chainId: 8453,
        name: 'Base',
        rpcUrl: 'https://base.llamarpc.com',
        explorerUrl: 'https://basescan.org',
        color: 'from-blue-300 to-blue-400',
    },
} as const

// Fallback RPC endpoints if primary fails
const FALLBACK_RPCS: Record<string, string[]> = {
    ethereum: ['https://rpc.ankr.com/eth', 'https://eth-mainnet.public.blastapi.io'],
    polygon: ['https://rpc.ankr.com/polygon', 'https://polygon-rpc.com'],
    optimism: ['https://rpc.ankr.com/optimism', 'https://mainnet.optimism.io'],
    arbitrum: ['https://rpc.ankr.com/arbitrum', 'https://arb1.arbitrum.io/rpc'],
    base: ['https://rpc.ankr.com/base', 'https://mainnet.base.org'],
}

// GET /api/admin/wallets - List admin wallets
adminWalletRoutes.get('/', async (c) => {
    try {
        const wallets = await prisma.adminWallet.findMany({
            orderBy: { createdAt: 'desc' },
        })

        return c.json({ wallets })
    } catch (error) {
        logger.error('List admin wallets error:', error)
        return c.json({ error: 'Failed to fetch wallets' }, 500)
    }
})

// POST /api/admin/wallets - Create new admin wallet
adminWalletRoutes.post('/', async (c) => {
    try {
        const body = await c.req.json()
        const data = createWalletSchema.parse(body)

        // Normalize address and currency
        const address = data.address.trim()
        const currency = data.currency.toUpperCase().trim()
        const network = data.network?.trim() || null

        // Check if wallet already exists
        const existing = await prisma.adminWallet.findUnique({
            where: {
                address_currency: {
                    address,
                    currency,
                },
            },
        })

        if (existing) {
            return c.json({ error: 'Wallet already exists' }, 400)
        }

        const wallet = await prisma.adminWallet.create({
            data: {
                address,
                currency,
                network,
                label: data.label?.trim() || null,
            },
        })

        logger.info('Admin wallet created', { walletId: wallet.id, address, currency })

        return c.json({ wallet })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return c.json({ error: 'Wallet already exists' }, 400)
        }
        logger.error('Create admin wallet error:', error)
        return c.json({ error: 'Failed to create wallet' }, 500)
    }
})

// PATCH /api/admin/wallets/:id - Update admin wallet
adminWalletRoutes.patch('/:id', async (c) => {
    try {
        const walletId = c.req.param('id')
        const body = await c.req.json()
        const data = updateWalletSchema.parse(body)

        const wallet = await prisma.adminWallet.update({
            where: { id: walletId },
            data: {
                label: data.label?.trim() || null,
            },
        })

        return c.json({ wallet })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return c.json({ error: 'Wallet not found' }, 404)
        }
        logger.error('Update admin wallet error:', error)
        return c.json({ error: 'Failed to update wallet' }, 500)
    }
})

// DELETE /api/admin/wallets/:id - Delete admin wallet
adminWalletRoutes.delete('/:id', async (c) => {
    try {
        const walletId = c.req.param('id')

        await prisma.adminWallet.delete({
            where: { id: walletId },
        })

        logger.info('Admin wallet deleted', { walletId })

        return c.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return c.json({ error: 'Wallet not found' }, 404)
        }
        logger.error('Delete admin wallet error:', error)
        return c.json({ error: 'Failed to delete wallet' }, 500)
    }
})

// POST /api/admin/wallets/:id/refresh-balance - Refresh wallet balance
adminWalletRoutes.post('/:id/refresh-balance', async (c) => {
    try {
        const walletId = c.req.param('id')
        const wallet = await prisma.adminWallet.findUnique({
            where: { id: walletId },
        })

        if (!wallet) {
            return c.json({ error: 'Wallet not found' }, 404)
        }

        // Fetch balance from blockchain API
        let balance: number | null = null
        try {
            balance = await fetchWalletBalance(wallet.address, wallet.currency, wallet.network || undefined)
            // Ensure we store 0 instead of null for zero balances
            if (balance === null || isNaN(balance)) {
                balance = 0
            }
        } catch (error: any) {
            logger.warn(`Failed to fetch wallet balance for ${wallet.currency} (${wallet.address}):`, error?.message || error)
            // Set to 0 instead of null so UI shows $0 instead of "-"
            balance = 0
        }

        // Update wallet with new balance
        const updated = await prisma.adminWallet.update({
            where: { id: walletId },
            data: {
                balance,
                balanceUpdatedAt: new Date(),
            },
        })

        return c.json({ wallet: updated })
    } catch (error) {
        logger.error('Refresh wallet balance error:', error)
        return c.json({ error: 'Failed to refresh balance' }, 500)
    }
})

// GET /api/admin/wallets/:id/multi-chain-balances - Get balances across all EVM chains (ETH, USDC, USDT)
adminWalletRoutes.get('/:id/multi-chain-balances', async (c) => {
    try {
        const walletId = c.req.param('id')
        const wallet = await prisma.adminWallet.findUnique({
            where: { id: walletId },
        })

        if (!wallet) {
            return c.json({ error: 'Wallet not found' }, 404)
        }

        const currencyUpper = wallet.currency.toUpperCase()
        const isETH = currencyUpper === 'ETH'
        const isUSDC = currencyUpper === 'USDC'
        const isUSDT = currencyUpper === 'USDT' && wallet.network?.toLowerCase().includes('eth')

        if (!isETH && !isUSDC && !isUSDT) {
            return c.json({ error: 'Multi-chain balances only supported for ETH, USDC, and USDT' }, 400)
        }

        // Fetch balances from all EVM chains
        const chainBalances = await Promise.allSettled(
            Object.entries(EVM_CHAINS).map(async ([key, chain]) => {
                try {
                    let balance = 0
                    
                    if (isETH) {
                        balance = await fetchETHBalanceFromChain(wallet.address, chain)
                    } else if (isUSDC || isUSDT) {
                        const tokenType = isUSDC ? 'USDC' : 'USDT'
                        const contractAddress = TOKEN_CONTRACTS[tokenType]?.[key]
                        if (contractAddress) {
                            balance = await fetchERC20BalanceFromChain(wallet.address, contractAddress, chain)
                        } else {
                            logger.warn(`No contract address found for ${tokenType} on ${chain.name}`)
                            return {
                                chain: key,
                                chainId: chain.chainId,
                                name: chain.name,
                                balance: 0,
                                error: 'Token not available on this chain',
                                explorerUrl: `${chain.explorerUrl}/address/${wallet.address}`,
                                color: chain.color,
                            }
                        }
                    }
                    
                    return {
                        chain: key,
                        chainId: chain.chainId,
                        name: chain.name,
                        balance,
                        explorerUrl: `${chain.explorerUrl}/address/${wallet.address}`,
                        color: chain.color,
                    }
                } catch (error: any) {
                    logger.warn(`Failed to fetch ${chain.name} balance:`, error?.message || error)
                    return {
                        chain: key,
                        chainId: chain.chainId,
                        name: chain.name,
                        balance: 0,
                        error: error?.message || 'Failed to fetch',
                        explorerUrl: `${chain.explorerUrl}/address/${wallet.address}`,
                        color: chain.color,
                    }
                }
            })
        )

        const balances = chainBalances.map((result) => 
            result.status === 'fulfilled' ? result.value : {
                chain: 'unknown',
                chainId: 0,
                name: 'Unknown',
                balance: 0,
                error: 'Failed to fetch',
                explorerUrl: '',
                color: 'from-gray-500 to-gray-600',
            }
        )

        const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0)
        
        // For USDC/USDT on Ethereum, update the main wallet balance with Ethereum chain balance
        // This ensures the main card shows the correct balance immediately
        if ((isUSDC || isUSDT) && wallet.network?.toLowerCase().includes('eth')) {
            const ethereumBalance = balances.find(b => b.chain === 'ethereum')
            if (ethereumBalance && ethereumBalance.balance > 0) {
                // Update the wallet balance in the database to reflect Ethereum chain balance
                await prisma.adminWallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: ethereumBalance.balance,
                        balanceUpdatedAt: new Date(),
                    },
                }).catch((error) => {
                    // Log but don't fail the request if update fails
                    logger.warn('Failed to update wallet balance from multi-chain fetch:', error)
                })
            }
        }

        return c.json({
            walletId: wallet.id,
            address: wallet.address,
            currency: currencyUpper,
            totalBalance,
            chains: balances,
            // Include Ethereum balance for main card display
            ethereumBalance: balances.find(b => b.chain === 'ethereum')?.balance || 0,
        })
    } catch (error) {
        logger.error('Get multi-chain balances error:', error)
        return c.json({ error: 'Failed to fetch multi-chain balances' }, 500)
    }
})

// POST /api/admin/wallets/refresh-all - Refresh all wallet balances
adminWalletRoutes.post('/refresh-all', async (c) => {
    try {
        const wallets = await prisma.adminWallet.findMany()

        const results = await Promise.allSettled(
            wallets.map(async (wallet) => {
                try {
                    logger.info(`Refreshing balance for wallet ${wallet.id}: ${wallet.currency} (${wallet.network || 'native'}) at ${wallet.address}`)
                    
                    let balance = await fetchWalletBalance(
                        wallet.address,
                        wallet.currency,
                        wallet.network || undefined
                    )
                    
                    // Ensure we store 0 instead of null for zero balances
                    if (balance === null || isNaN(balance)) {
                        logger.warn(`Invalid balance returned for wallet ${wallet.id}: ${balance}, setting to 0`)
                        balance = 0
                    }
                    
                    logger.info(`Successfully fetched balance for wallet ${wallet.id}: ${balance} ${wallet.currency}`)
                    
                    await prisma.adminWallet.update({
                        where: { id: wallet.id },
                        data: {
                            balance,
                            balanceUpdatedAt: new Date(),
                        },
                    })
                    return { walletId: wallet.id, success: true, balance, currency: wallet.currency }
                } catch (error: any) {
                    logger.error(`Failed to refresh balance for wallet ${wallet.id} (${wallet.currency} on ${wallet.network || 'native'}):`, {
                        error: error?.message || error,
                        stack: error?.stack,
                        address: wallet.address,
                    })
                    // Don't set balance to 0 on error - keep the last known balance
                    // This way if there's a temporary API issue, we don't lose the actual balance
                    return { 
                        walletId: wallet.id, 
                        success: false, 
                        error: String(error?.message || error), 
                        currency: wallet.currency,
                        // Don't update balance on error - keep existing value
                    }
                }
            })
        )

        const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
        const failed = results.length - successful

        return c.json({
            success: true,
            total: wallets.length,
            successful,
            failed,
            results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })),
        })
    } catch (error) {
        logger.error('Refresh all wallet balances error:', error)
        return c.json({ error: 'Failed to refresh balances' }, 500)
    }
})

// Token contract addresses across all EVM chains
const TOKEN_CONTRACTS: Record<string, Record<string, string>> = {
    USDC: {
        ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
        optimism: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC on Optimism
        arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum
        base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    },
    USDT: {
        ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
        polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT on Polygon
        optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT on Optimism
        arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT on Arbitrum
        base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT on Base (bridged)
    },
}

// Solana SPL tokens
const SOLANA_TOKENS = {
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
}

// Helper function to fetch ERC-20 token balance from a specific EVM chain
async function fetchERC20BalanceFromChain(
    address: string,
    contractAddress: string,
    chain: typeof EVM_CHAINS[keyof typeof EVM_CHAINS]
): Promise<number> {
    const chainKey = Object.keys(EVM_CHAINS).find(k => EVM_CHAINS[k as keyof typeof EVM_CHAINS] === chain) || 'ethereum'
    const rpcUrls = [chain.rpcUrl, ...(FALLBACK_RPCS[chainKey] || [])]
    
    let lastError: Error | null = null
    
    // Try primary RPC, then fallbacks
    for (const rpcUrl of rpcUrls) {
        try {
            logger.info(`Fetching ERC-20 balance from ${chain.name} (chainId: ${chain.chainId}) via ${rpcUrl} for ${address}, contract: ${contractAddress}`)
            
            // ERC-20 balanceOf(address) - function selector: 0x70a08231
            // Address needs to be padded to 64 hex characters (32 bytes) without 0x prefix
            const addressWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address
            const paddedAddress = addressWithoutPrefix.toLowerCase().padStart(64, '0')
            const data = '0x70a08231' + paddedAddress
            
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [
                        {
                            to: contractAddress,
                            data: data,
                        },
                        'latest',
                    ],
                }),
            })

            if (!response.ok) {
                throw new Error(`RPC error: ${response.status}`)
            }

            const result = await response.json() as {
                result?: string
                error?: {
                    code: number
                    message: string
                }
            }

            if (result.error) {
                throw new Error(`RPC error: ${result.error.message}`)
            }

            if (result.result && result.result !== '0x') {
                // Balance is in token's smallest unit (usually 6 decimals for USDC/USDT)
                const balance = BigInt(result.result)
                // Most stablecoins use 6 decimals, but we'll detect from the contract if needed
                // For now, assume 6 decimals for USDC/USDT
                const tokenAmount = Number(balance) / 1e6
                logger.info(`Fetched ERC-20 balance from ${chain.name}: ${tokenAmount}`)
                return tokenAmount
            }

            // Zero balance
            return 0
        } catch (error: any) {
            lastError = error
            logger.warn(`Failed to fetch from ${rpcUrl}:`, error?.message || error)
            // Continue to next RPC
            continue
        }
    }
    
    // All RPCs failed
    logger.error(`All RPC endpoints failed for ${chain.name}:`, lastError)
    throw lastError || new Error(`Failed to fetch ERC-20 balance from ${chain.name}`)
}

// Helper function to fetch ETH balance from a specific EVM chain
async function fetchETHBalanceFromChain(
    address: string,
    chain: typeof EVM_CHAINS[keyof typeof EVM_CHAINS]
): Promise<number> {
    const chainKey = Object.keys(EVM_CHAINS).find(k => EVM_CHAINS[k as keyof typeof EVM_CHAINS] === chain) || 'ethereum'
    const rpcUrls = [chain.rpcUrl, ...(FALLBACK_RPCS[chainKey] || [])]
    
    let lastError: Error | null = null
    
    // Try primary RPC, then fallbacks
    for (const rpcUrl of rpcUrls) {
        try {
            logger.info(`Fetching ETH balance from ${chain.name} (chainId: ${chain.chainId}) via ${rpcUrl} for ${address}`)
            
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getBalance',
                    params: [address, 'latest'],
                }),
            })

            if (!response.ok) {
                throw new Error(`RPC error: ${response.status}`)
            }

            const data = await response.json() as {
                result?: string
                error?: {
                    code: number
                    message: string
                }
            }

            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`)
            }

            if (data.result) {
                // Balance is in Wei, convert to ETH
                const wei = BigInt(data.result)
                const eth = Number(wei) / 1e18
                logger.info(`Fetched ${chain.name} balance: ${eth} ETH`)
                return eth
            }

            throw new Error('Invalid RPC response')
        } catch (error: any) {
            lastError = error
            logger.warn(`Failed to fetch from ${rpcUrl}:`, error?.message || error)
            // Continue to next RPC
            continue
        }
    }
    
    // All RPCs failed
    logger.error(`All RPC endpoints failed for ${chain.name}:`, lastError)
    throw lastError || new Error(`Failed to fetch balance from ${chain.name}`)
}

// Helper function to fetch wallet balance from blockchain APIs
async function fetchWalletBalance(
    address: string,
    currency: string,
    network?: string
): Promise<number> {
    const currencyUpper = currency.toUpperCase()
    
    logger.info(`[fetchWalletBalance] Starting: currency=${currencyUpper}, network=${network || 'none'}, address=${address.substring(0, 10)}...`)

    try {
        // Bitcoin
        if (currencyUpper === 'BTC') {
            const response = await fetch(`https://blockstream.info/api/address/${address}`)
            if (!response.ok) throw new Error('Blockstream API error')
            const data = await response.json() as {
                chain_stats: {
                    funded_txo_sum: number
                    spent_txo_sum: number
                }
            }
            // Balance is in satoshis, convert to BTC
            return (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 100000000
        }

        // Native Ethereum (ETH) - fetch from Ethereum mainnet only
        if (currencyUpper === 'ETH') {
            const apiKey = process.env.ETHERSCAN_API_KEY
            if (!apiKey) {
                logger.warn('ETHERSCAN_API_KEY not set - Etherscan V2 requires API key')
                throw new Error('ETHERSCAN_API_KEY is required for Etherscan API V2')
            }
            
            // Use Etherscan API V2 endpoint with chainid=1 for Ethereum mainnet
            const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`

            logger.info(`Fetching ETH balance for ${address} using Etherscan V2 API`)

            const response = await fetch(apiUrl)
            if (!response.ok) {
                logger.warn(`Etherscan API HTTP error for ETH: ${response.status}`)
                throw new Error(`Etherscan API error: ${response.status}`)
            }
            
            const data = await response.json() as {
                status: string
                result: string
                message?: string
            }

            logger.info(`Etherscan V2 response for ETH: status=${data.status}, result=${data.result?.substring(0, 20)}...`)

            if (data.status === '1') {
                // Balance is in Wei, convert to ETH
                // result can be "0" for zero balance, which is valid
                const wei = BigInt(data.result || '0')
                const eth = Number(wei) / 1e18
                logger.info(`Parsed ETH balance: ${eth}`)
                return eth
            }
            
            // Status "0" usually means error, but log it
            logger.warn(`Etherscan API returned status 0 for ETH: ${data.message || 'Unknown error'}, result=${data.result}`)
            // Return 0 instead of throwing, so we show $0 instead of "-"
            return 0
        }

        // ERC-20 tokens on Ethereum (USDC, USDT)
        if (currencyUpper === 'USDC' || (currencyUpper === 'USDT' && network?.toLowerCase().includes('eth'))) {
            // Use RPC method (same as multi-chain) for more reliable balance fetching
            const contractAddress = currencyUpper === 'USDC' 
                ? TOKEN_CONTRACTS.USDC.ethereum
                : TOKEN_CONTRACTS.USDT.ethereum
            
            if (!contractAddress) {
                logger.warn(`No contract address found for ${currencyUpper} on Ethereum`)
                return 0
            }
            
            try {
                // Use the same RPC method as multi-chain for consistency
                const balance = await fetchERC20BalanceFromChain(address, contractAddress, EVM_CHAINS.ethereum)
                logger.info(`Fetched ${currencyUpper} balance via RPC: ${balance}`)
                return balance
            } catch (error: any) {
                logger.warn(`RPC fetch failed for ${currencyUpper}, falling back to Etherscan:`, error?.message || error)
                
                // Fallback to Etherscan if RPC fails
                const apiKey = process.env.ETHERSCAN_API_KEY
                if (!apiKey) {
                    logger.warn('ETHERSCAN_API_KEY not set - cannot use fallback')
                    return 0
                }
                
                const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${apiKey}`
                
                const response = await fetch(apiUrl)
                if (!response.ok) {
                    logger.warn(`Etherscan API HTTP error for ${currencyUpper}: ${response.status}`)
                    return 0
                }
                
                const data = await response.json() as {
                    status: string
                    result: string
                    message?: string
                }

                if (data.status === '1') {
                    const tokenAmount = BigInt(data.result || '0')
                    const balance = Number(tokenAmount) / 1e6
                    logger.info(`Parsed ${currencyUpper} balance via Etherscan: ${balance}`)
                    return balance
                }
                
                logger.warn(`Etherscan API returned status 0 for ${currencyUpper}: ${data.message || 'Unknown error'}`)
                return 0
            }
        }

        // Native Solana (SOL)
        if (currencyUpper === 'SOL') {
            const response = await fetch(`https://api.mainnet-beta.solana.com`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address],
                }),
            })
            if (!response.ok) throw new Error('Solana API error')
            const data = await response.json() as {
                result: {
                    value: number
                } | null
            }

            if (data.result) {
                // Balance is in lamports, convert to SOL
                return data.result.value / 1e9
            }
            throw new Error('Invalid Solana response')
        }

        // SPL tokens on Solana (USDT on Solana)
        if (currencyUpper === 'USDT' && (network?.toLowerCase().includes('sol') || network?.toLowerCase().includes('solana'))) {
            logger.info(`Fetching USDT (Solana) balance for ${address} using mint ${SOLANA_TOKENS.USDT}`)
            
            // Try multiple Solana RPC endpoints for reliability
            const solanaRpcUrls = [
                'https://api.mainnet-beta.solana.com',
                'https://solana-api.projectserum.com',
                'https://rpc.ankr.com/solana',
            ]
            
            let lastError: Error | null = null
            
            for (const rpcUrl of solanaRpcUrls) {
                try {
                    logger.info(`Trying Solana RPC: ${rpcUrl}`)
                    
                    // Fetch SPL token balance using getTokenAccountsByOwner
                    const response = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTokenAccountsByOwner',
                            params: [
                                address,
                                {
                                    mint: SOLANA_TOKENS.USDT,
                                },
                                {
                                    encoding: 'jsonParsed',
                                },
                            ],
                        }),
                    })
            
                    if (!response.ok) {
                        logger.warn(`Solana API HTTP error for USDT from ${rpcUrl}: ${response.status}`)
                        throw new Error(`Solana API error: ${response.status}`)
                    }
                    
                    const data = await response.json() as {
                        result: {
                            value: Array<{
                                account: {
                                    data: {
                                        parsed: {
                                            info: {
                                                tokenAmount: {
                                                    amount: string
                                                    decimals: number
                                                }
                                            }
                                        }
                                    }
                                }
                            }>
                        } | null
                        error?: {
                            code: number
                            message: string
                        }
                    }

                    if (data.error) {
                        logger.warn(`Solana API error for USDT from ${rpcUrl}: ${data.error.message} (code: ${data.error.code})`)
                        throw new Error(`Solana API error: ${data.error.message}`)
                    }

                    logger.info(`Solana response for USDT from ${rpcUrl}: found ${data.result?.value?.length || 0} token accounts`)

            if (data.result && data.result.value.length > 0) {
                // Get the first token account (should only be one for a specific mint)
                const tokenAccount = data.result.value[0]
                const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount
                const decimals = tokenAmount.decimals || 6 // USDT typically has 6 decimals
                const balance = Number(tokenAmount.amount) / Math.pow(10, decimals)
                logger.info(`Parsed USDT (Solana) balance: ${balance} (raw: ${tokenAmount.amount}, decimals: ${decimals})`)
                return balance
            }
            
            // No token account found, return 0
            logger.info(`No USDT token account found for ${address}`)
            return 0
        }

        // Default: return 0 if currency not supported
        logger.warn(`Unsupported currency for balance fetch: ${currencyUpper}`)
        return 0
    } catch (error) {
        logger.error(`Error fetching balance for ${currencyUpper} address ${address}:`, error)
        throw error
    }
}

export { adminWalletRoutes }
