'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronUp, ExternalLink, Network } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface ChainBalance {
    chain: string
    chainId: number
    name: string
    balance: number
    error?: string
    explorerUrl: string
    color: string
}

interface MultiChainETHBalanceProps {
    walletId: string
    address: string
    mainBalance: number | null
    currency: string
    network?: string | null
    onBalanceUpdate?: (balance: number) => void
    autoExpand?: boolean
}

const CHAIN_INFO: Record<string, { icon: string; color: string; bgColor: string }> = {
    ethereum: { 
        icon: '⟠', 
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-500/10 border-blue-500/20',
    },
    polygon: { 
        icon: '⬟', 
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-500/10 border-purple-500/20',
    },
    optimism: { 
        icon: '🔴', 
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-red-500/10 border-red-500/20',
    },
    arbitrum: { 
        icon: '🔵', 
        color: 'from-blue-400 to-blue-500',
        bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    },
    base: { 
        icon: '🔷', 
        color: 'from-blue-300 to-blue-400',
        bgColor: 'bg-sky-500/10 border-sky-500/20',
    },
}

export function MultiChainETHBalance({ walletId, address, mainBalance, currency, network, onBalanceUpdate, autoExpand = false }: MultiChainETHBalanceProps) {
    const { data: session } = useSession()
    const [chainBalances, setChainBalances] = useState<ChainBalance[]>([])
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(autoExpand)
    const [error, setError] = useState<string | null>(null)

    const fetchMultiChainBalances = useCallback(async () => {
        if (!session?.accessToken) return

        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/admin/wallets/${walletId}/multi-chain-balances`, {
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) throw new Error('Failed to fetch multi-chain balances')
            const data = await response.json()
            setChainBalances(data.chains || [])
            
            // Update main balance if Ethereum balance is available (for USDC/USDT)
            if (data.ethereumBalance !== undefined && onBalanceUpdate) {
                onBalanceUpdate(data.ethereumBalance)
            }
        } catch (error: any) {
            console.error('Failed to fetch multi-chain balances:', error)
            setError(error?.message || 'Failed to load chain balances')
        } finally {
            setLoading(false)
        }
    }, [walletId, session?.accessToken, onBalanceUpdate])

    // Auto-fetch Ethereum balance on mount for USDC/USDT wallets to update main card (only if not auto-expanded)
    useEffect(() => {
        if (autoExpand) return // Skip if auto-expanded (will fetch when parent expands)
        
        const currencyUpper = currency.toUpperCase()
        const isUSDC = currencyUpper === 'USDC'
        const isUSDT = currencyUpper === 'USDT' && network?.toLowerCase().includes('eth')
        
        // For USDC/USDT on Ethereum, fetch Ethereum balance immediately to update main card
        if ((isUSDC || isUSDT) && chainBalances.length === 0 && !loading && session?.accessToken) {
            fetchMultiChainBalances()
        }
    }, [currency, network, chainBalances.length, loading, session?.accessToken, fetchMultiChainBalances, autoExpand])
    
    // Fetch all chains when expanded (or auto-expanded)
    useEffect(() => {
        if ((expanded || autoExpand) && chainBalances.length === 0 && !loading && session?.accessToken) {
            fetchMultiChainBalances()
        }
    }, [expanded, autoExpand, chainBalances.length, loading, session?.accessToken, fetchMultiChainBalances])

    const currencyUpper = currency.toUpperCase()
    const isETH = currencyUpper === 'ETH'
    const isToken = currencyUpper === 'USDC' || currencyUpper === 'USDT'
    const displayName = isETH ? 'ETH' : currencyUpper

    const totalBalance = chainBalances.reduce((sum, chain) => sum + chain.balance, 0)
    const chainsWithBalance = chainBalances.filter(chain => chain.balance > 0)
    const hasBalances = chainsWithBalance.length > 0

    const formatBalance = (balance: number) => {
        if (balance === 0) {
            // USDC/USDT use 2 decimals, ETH uses 6
            return isETH ? '0.000000' : '0.00'
        }
        if (isETH) {
            if (balance < 0.000001) return balance.toExponential(2)
            return balance.toFixed(6).replace(/\.?0+$/, '')
        } else {
            // USDC/USDT - 2 decimal places
            return balance.toFixed(2).replace(/\.?0+$/, '')
        }
    }

    // If autoExpand is true, always show expanded content (no toggle button)
    // This is used when the parent row is clicked
    if (!expanded && !autoExpand) {
        return null // Don't render anything if not expanded and not auto-expanded
    }

    return (
        <div className="space-y-3 border-t border-border/40 pt-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Multi-Chain {displayName} Balances</span>
                    {hasBalances && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs">
                            {chainsWithBalance.length} chain{chainsWithBalance.length !== 1 ? 's' : ''} with balance
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {totalBalance > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Total Across All Chains</span>
                        <span className="text-lg font-bold text-foreground">
                            {formatBalance(totalBalance)} {displayName}
                        </span>
                    </div>
                </div>
            )}

            {chainsWithBalance.length > 0 ? (
                <div className="space-y-2">
                    {chainsWithBalance.map((chain) => {
                        const chainInfo = CHAIN_INFO[chain.chain] || { 
                            icon: '●', 
                            color: 'from-gray-500 to-gray-600',
                            bgColor: 'bg-gray-500/10 border-gray-500/20',
                        }

                        return (
                            <div
                                key={chain.chain}
                                className={`group flex items-center justify-between rounded-lg border p-3 transition-all duration-200 ${chainInfo.bgColor} hover:shadow-md hover:scale-[1.01]`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${chainInfo.color} flex-shrink-0 text-white text-sm font-bold shadow-sm`}>
                                        {chainInfo.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-semibold text-foreground">
                                                {chain.name}
                                            </span>
                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs px-1.5 py-0">
                                                Active
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Chain ID: {chain.chainId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-foreground">
                                            {formatBalance(chain.balance)} {displayName}
                                        </p>
                                    </div>
                                    {chain.explorerUrl && (
                                        <a
                                            href={chain.explorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
                                            onClick={(e) => e.stopPropagation()}
                                            title={`View on ${chain.name} explorer`}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                !loading && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            No {displayName} balances found across any EVM chains
                        </p>
                    </div>
                )
            )}
        </div>
    )
}
