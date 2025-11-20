'use client'

import { useState, useEffect, useMemo } from 'react'
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
    const [stats, setStats] = useState<{ totalPayments: number; withAddress: number }>({
        totalPayments: 0,
        withAddress: 0,
    })

    useEffect(() => {
        if (session?.accessToken) {
            fetchWalletAddresses()
        }
    }, [session])

    const fetchWalletAddresses = async () => {
        if (!session?.accessToken) {
            console.log('[WalletBalances] No session token available')
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            // Fetch all payments (paginate) and include any with usable addresses.
            const allPayments: any[] = []
            let page = 1
            const limit = 100
            let pages = 1

            while (page <= pages) {
                const resp = await adminAPI.getPayments({
                    limit,
                    page,
                    paymentStatus: 'finished', // primary filter
                })
                const payments = resp.payments || []
                allPayments.push(...payments)
                pages = resp.pagination?.pages || 1
                page += 1
            }

            // Group by payAddress and currency
            const walletMap = new Map<string, WalletAddress>()

            allPayments.forEach((payment: any) => {
                // Normalize fields (handle pay_address if the API ever returns snake_case)
                const payAddress = payment.payAddress || payment.pay_address
                const currency = (payment.actuallyPaidCurrency || payment.actually_paid_currency || payment.payCurrency || payment.pay_currency || 'unknown').toString().toUpperCase()

                if (payAddress && (payment.paymentStatus === 'finished' || payment.paymentStatus === 'confirmed' || payment.paymentStatus === 'sending')) {
                    const key = `${payAddress}-${currency}`

                    if (!walletMap.has(key)) {
                        walletMap.set(key, {
                            address: payAddress,
                            currency,
                            totalReceived: 0,
                            paymentCount: 0,
                            lastPayment: null,
                        })
                    }

                    const wallet = walletMap.get(key)!
                    // Sum USD-equivalent if present; otherwise use crypto amount.
                    const fiat = payment.payAmount ?? payment.pay_amount
                    const crypto = payment.actuallyPaid ?? payment.actually_paid
                    wallet.totalReceived += (fiat ?? crypto ?? 0)
                    wallet.paymentCount += 1

                    if (payment.paidAt && (!wallet.lastPayment || payment.paidAt > wallet.lastPayment)) {
                        wallet.lastPayment = payment.paidAt
                    }
                }
            })

            const walletsArray = Array.from(walletMap.values()).sort((a, b) => b.totalReceived - a.totalReceived)
            setStats({
                totalPayments: allPayments.length,
                withAddress: walletsArray.length,
            })
            setWallets(walletsArray)
        } catch (error: any) {
            console.error('[WalletBalances] Failed to fetch wallet addresses:', error)
            const errorMessage = error?.message || 'Failed to load wallet addresses'
            console.error('[WalletBalances] Error details:', {
                message: errorMessage,
                stack: error?.stack,
            })
            toast.error(errorMessage)
            setWallets([]) // Set empty array on error to show empty state
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
                        <CardTitle className="text-lg font-semibold">Payment Receiving Wallets</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Crypto addresses that receive customer payments (auto-detected)
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
                            {stats.totalPayments > 0
                                ? `Scanned ${stats.totalPayments} finished payments. None had a pay address on record.`
                                : 'Wallet addresses will appear here once crypto payments are received.'}
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
