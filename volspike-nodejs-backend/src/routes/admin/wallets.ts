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

// POST /api/admin/wallets/refresh-all - Refresh all wallet balances
adminWalletRoutes.post('/refresh-all', async (c) => {
    try {
        const wallets = await prisma.adminWallet.findMany()

        const results = await Promise.allSettled(
            wallets.map(async (wallet) => {
                try {
                    let balance = await fetchWalletBalance(
                        wallet.address,
                        wallet.currency,
                        wallet.network || undefined
                    )
                    // Ensure we store 0 instead of null for zero balances
                    if (balance === null || isNaN(balance)) {
                        balance = 0
                    }
                    await prisma.adminWallet.update({
                        where: { id: wallet.id },
                        data: {
                            balance,
                            balanceUpdatedAt: new Date(),
                        },
                    })
                    return { walletId: wallet.id, success: true, balance }
                } catch (error: any) {
                    logger.warn(`Failed to refresh balance for wallet ${wallet.id} (${wallet.currency}):`, error?.message || error)
                    // Set balance to 0 on error so UI shows $0 instead of "-"
                    try {
                        await prisma.adminWallet.update({
                            where: { id: wallet.id },
                            data: {
                                balance: 0,
                                balanceUpdatedAt: new Date(),
                            },
                        })
                    } catch (updateError) {
                        logger.error(`Failed to update wallet ${wallet.id} with zero balance:`, updateError)
                    }
                    return { walletId: wallet.id, success: false, error: String(error?.message || error), balance: 0 }
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

// Token contract addresses
const TOKEN_CONTRACTS = {
    // Ethereum ERC-20 tokens
    USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    USDT_ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
    // Solana SPL tokens
    USDT_SOL: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana (SPL token mint)
}

// Helper function to fetch wallet balance from blockchain APIs
async function fetchWalletBalance(
    address: string,
    currency: string,
    network?: string
): Promise<number> {
    const currencyUpper = currency.toUpperCase()

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

        // Native Ethereum (ETH)
        if (currencyUpper === 'ETH') {
            const apiKey = process.env.ETHERSCAN_API_KEY || ''
            const apiUrl = apiKey
                ? `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`
                : `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`

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

            if (data.status === '1') {
                // Balance is in Wei, convert to ETH
                // result can be "0" for zero balance, which is valid
                const wei = BigInt(data.result || '0')
                const eth = Number(wei) / 1e18
                return eth
            }
            
            // Status "0" usually means error, but log it
            logger.warn(`Etherscan API returned status 0 for ETH: ${data.message || 'Unknown error'}`)
            // Return 0 instead of throwing, so we show $0 instead of "-"
            return 0
        }

        // ERC-20 tokens on Ethereum (USDC, USDT)
        if (currencyUpper === 'USDC' || (currencyUpper === 'USDT' && network?.toLowerCase().includes('eth'))) {
            // Fetch ERC-20 token balance
            const contractAddress = currencyUpper === 'USDC' 
                ? TOKEN_CONTRACTS.USDC_ETH 
                : TOKEN_CONTRACTS.USDT_ETH
            
            const apiKey = process.env.ETHERSCAN_API_KEY || ''
            const apiUrl = apiKey
                ? `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${apiKey}`
                : `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest`

            const response = await fetch(apiUrl)
            if (!response.ok) {
                logger.warn(`Etherscan API HTTP error for ${currencyUpper}: ${response.status}`)
                throw new Error(`Etherscan API error: ${response.status}`)
            }
            
            const data = await response.json() as {
                status: string
                result: string
                message?: string
            }

            if (data.status === '1') {
                // ERC-20 tokens typically have 6 decimals (USDC/USDT)
                // result can be "0" for zero balance, which is valid
                const tokenAmount = BigInt(data.result || '0')
                return Number(tokenAmount) / 1e6
            }
            
            // Status "0" usually means error, but log it
            logger.warn(`Etherscan API returned status 0 for ${currencyUpper}: ${data.message || 'Unknown error'}`)
            // Return 0 instead of throwing, so we show $0 instead of "-"
            return 0
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
            // Fetch SPL token balance using getTokenAccountsByOwner
            const response = await fetch(`https://api.mainnet-beta.solana.com`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenAccountsByOwner',
                    params: [
                        address,
                        {
                            mint: TOKEN_CONTRACTS.USDT_SOL,
                        },
                        {
                            encoding: 'jsonParsed',
                        },
                    ],
                }),
            })
            
            if (!response.ok) throw new Error('Solana API error')
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
            }

            if (data.result && data.result.value.length > 0) {
                // Get the first token account (should only be one for a specific mint)
                const tokenAccount = data.result.value[0]
                const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount
                const decimals = tokenAmount.decimals || 6 // USDT typically has 6 decimals
                return Number(tokenAmount.amount) / Math.pow(10, decimals)
            }
            // No token account found, return 0
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

