'use client'

import { useState, useEffect } from 'react'
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

export function MultiChainETHBalance({ walletId, address, mainBalance, currency, network }: MultiChainETHBalanceProps) {
    const { data: session } = useSession()
    const [chainBalances, setChainBalances] = useState<ChainBalance[]>([])
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchMultiChainBalances = async () => {
        if (!session?.accessToken) return

        setLoading(true)
        setError(null)
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/${walletId}/multi-chain-balances`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            if (!response.ok) throw new Error('Failed to fetch multi-chain balances')
            const data = await response.json()
            setChainBalances(data.chains || [])
        } catch (error: any) {
            console.error('Failed to fetch multi-chain balances:', error)
            setError(error?.message || 'Failed to load chain balances')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (expanded && chainBalances.length === 0 && !loading && session?.accessToken) {
            fetchMultiChainBalances()
        }
    }, [expanded, session?.accessToken])

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

    const currencyUpper = currency.toUpperCase()
    const isETH = currencyUpper === 'ETH'
    const isToken = currencyUpper === 'USDC' || currencyUpper === 'USDT'
    const displayName = isETH ? 'ETH' : currencyUpper

    if (!expanded) {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground mt-2"
            >
                <div className="flex items-center gap-2">
                    <Network className="h-3.5 w-3.5" />
                    <span>View {displayName} balances across all EVM chains</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5" />
            </Button>
        )
    }

    return (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(false)}
                        className="h-6 w-6 p-0"
                    >
                        <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {totalBalance > 0 && (
                <div className="rounded-lg border border-border/60 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Total Across All Chains</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {formatBalance(totalBalance)} {displayName}
                        </span>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {chainBalances.map((chain) => {
                    const chainInfo = CHAIN_INFO[chain.chain] || { 
                        icon: '●', 
                        color: 'from-gray-500 to-gray-600',
                        bgColor: 'bg-gray-500/10 border-gray-500/20',
                    }
                    const hasBalance = chain.balance > 0

                    return (
                        <div
                            key={chain.chain}
                            className={`group flex items-center justify-between rounded-lg border p-3 transition-all duration-200 ${
                                hasBalance
                                    ? `${chainInfo.bgColor} hover:shadow-md hover:scale-[1.01]`
                                    : 'border-border/60 bg-background/30 opacity-60'
                            }`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${chainInfo.color} flex-shrink-0 text-white text-sm font-bold shadow-sm`}>
                                    {chainInfo.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`text-sm font-semibold ${hasBalance ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {chain.name}
                                        </span>
                                        {hasBalance && (
                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs px-1.5 py-0">
                                                Active
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Chain ID: {chain.chainId}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                <div className="text-right">
                                    <p
                                        className={`text-sm font-bold ${
                                            hasBalance 
                                                ? 'bg-gradient-to-r ' + chainInfo.color + ' bg-clip-text text-transparent' 
                                                : 'text-muted-foreground'
                                        }`}
                                    >
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

            {chainBalances.length === 0 && !loading && !error && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                    Click to load chain balances
                </div>
            )}
        </div>
    )
}

