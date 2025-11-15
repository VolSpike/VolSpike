'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { adminAPI } from '@/lib/admin/api-client'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

interface WalletAddress {
    address: string
    currency: string
    totalReceived: number
    paymentCount: number
    lastPayment: string | null
}

export function WalletBalances() {
    const { data: session } = useSession()
    const [wallets, setWallets] = useState<WalletAddress[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (session?.accessToken) {
            fetchWalletAddresses()
        }
    }, [session])

    const fetchWalletAddresses = async () => {
        if (!session?.accessToken) return

        setLoading(true)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            // We'll need to add this endpoint to the backend
            // For now, we'll fetch from payments
            const response = await adminAPI.request('/api/admin/payments', {
                method: 'GET',
            })
            
            if (response.payments) {
                // Group by payAddress and currency
                const walletMap = new Map<string, WalletAddress>()
                
                response.payments.forEach((payment: any) => {
                    if (payment.payAddress && payment.paymentStatus === 'finished') {
                        const key = `${payment.payAddress}-${payment.actuallyPaidCurrency || 'unknown'}`
                        
                        if (!walletMap.has(key)) {
                            walletMap.set(key, {
                                address: payment.payAddress,
                                currency: payment.actuallyPaidCurrency?.toUpperCase() || 'UNKNOWN',
                                totalReceived: 0,
                                paymentCount: 0,
                                lastPayment: null,
                            })
                        }
                        
                        const wallet = walletMap.get(key)!
                        wallet.totalReceived += payment.payAmount || 0
                        wallet.paymentCount += 1
                        
                        if (payment.paidAt && (!wallet.lastPayment || payment.paidAt > wallet.lastPayment)) {
                            wallet.lastPayment = payment.paidAt
                        }
                    }
                })
                
                setWallets(Array.from(walletMap.values()).sort((a, b) => b.totalReceived - a.totalReceived))
            }
        } catch (error) {
            console.error('Failed to fetch wallet addresses:', error)
            toast.error('Failed to load wallet addresses')
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Address copied to clipboard')
    }

    const formatAddress = (address: string) => {
        if (address.length <= 10) return address
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    }

    const getExplorerUrl = (address: string, currency: string) => {
        const currencyLower = currency.toLowerCase()
        if (currencyLower === 'btc') {
            return `https://blockstream.info/address/${address}`
        } else if (currencyLower === 'eth' || currencyLower === 'usdt' || currencyLower === 'usdc') {
            return `https://etherscan.io/address/${address}`
        } else if (currencyLower === 'sol') {
            return `https://solscan.io/account/${address}`
        }
        return null
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-transparent">
                        <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-semibold">Payment Wallets</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Crypto addresses receiving payments
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : wallets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 bg-muted/30 rounded-lg border border-dashed border-border/60">
                        <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">No wallet addresses found</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                            Wallet addresses will appear here once crypto payments are received
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {wallets.map((wallet, index) => {
                            const explorerUrl = getExplorerUrl(wallet.address, wallet.currency)
                            
                            return (
                                <div
                                    key={`${wallet.address}-${wallet.currency}-${index}`}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex-shrink-0">
                                            <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs font-medium">
                                                    {wallet.currency}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {wallet.paymentCount} payment{wallet.paymentCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm font-mono text-foreground break-all">
                                                    {wallet.address}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(wallet.address)}
                                                    className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                                                    title="Copy address"
                                                >
                                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                </button>
                                                {explorerUrl && (
                                                    <a
                                                        href={explorerUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                                                        title="View on explorer"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {formatCurrency(wallet.totalReceived)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Total received
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

