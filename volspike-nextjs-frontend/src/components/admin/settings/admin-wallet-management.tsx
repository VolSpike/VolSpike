'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Wallet,
    Plus,
    RefreshCw,
    Trash2,
    Copy,
    ExternalLink,
    Loader2,
    Edit2,
} from 'lucide-react'
import { adminAPI } from '@/lib/admin/api-client'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

interface AdminWallet {
    id: string
    address: string
    currency: string
    network: string | null
    label: string | null
    balance: number | null
    balanceUpdatedAt: string | null
    createdAt: string
    updatedAt: string
}

export function AdminWalletManagement() {
    const { data: session } = useSession()
    const [wallets, setWallets] = useState<AdminWallet[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState<string | null>(null)
    const [refreshingAll, setRefreshingAll] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingWallet, setEditingWallet] = useState<AdminWallet | null>(null)
    const [formData, setFormData] = useState({
        address: '',
        currency: 'BTC',
        network: '',
        label: '',
    })

    useEffect(() => {
        if (session?.accessToken) {
            fetchWallets()
        }
    }, [session])

    const fetchWallets = async () => {
        if (!session?.accessToken) return

        setLoading(true)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets`, {
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Content-Type': 'application/json',
                },
            })

            if (!response.ok) throw new Error('Failed to fetch wallets')
            const data = await response.json()
            setWallets(data.wallets || [])
        } catch (error) {
            console.error('Failed to fetch wallets:', error)
            toast.error('Failed to load wallets')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!session?.accessToken) return

        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: formData.address.trim(),
                    currency: formData.currency.toUpperCase(),
                    network: formData.network.trim() || null,
                    label: formData.label.trim() || null,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create wallet')
            }

            toast.success('Wallet added successfully')
            setDialogOpen(false)
            setFormData({ address: '', currency: 'BTC', network: '', label: '' })
            fetchWallets()
        } catch (error: any) {
            toast.error(error.message || 'Failed to create wallet')
        }
    }

    const handleUpdate = async () => {
        if (!session?.accessToken || !editingWallet) return

        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/${editingWallet.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    label: formData.label.trim() || null,
                }),
            })

            if (!response.ok) throw new Error('Failed to update wallet')

            toast.success('Wallet updated successfully')
            setDialogOpen(false)
            setEditingWallet(null)
            setFormData({ address: '', currency: 'BTC', network: '', label: '' })
            fetchWallets()
        } catch (error) {
            toast.error('Failed to update wallet')
        }
    }

    const handleDelete = async (walletId: string) => {
        if (!session?.accessToken || !confirm('Are you sure you want to delete this wallet?')) return

        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/${walletId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                },
            })

            if (!response.ok) throw new Error('Failed to delete wallet')

            toast.success('Wallet deleted successfully')
            fetchWallets()
        } catch (error) {
            toast.error('Failed to delete wallet')
        }
    }

    const handleRefreshBalance = async (walletId: string) => {
        if (!session?.accessToken) return

        setRefreshing(walletId)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/${walletId}/refresh-balance`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                },
            })

            if (!response.ok) throw new Error('Failed to refresh balance')

            toast.success('Balance refreshed')
            fetchWallets()
        } catch (error) {
            toast.error('Failed to refresh balance')
        } finally {
            setRefreshing(null)
        }
    }

    const handleRefreshAll = async () => {
        if (!session?.accessToken) return

        setRefreshingAll(true)
        try {
            adminAPI.setAccessToken(session.accessToken as string)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/wallets/refresh-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.accessToken}`,
                },
            })

            if (!response.ok) throw new Error('Failed to refresh balances')

            const data = await response.json()
            toast.success(`Refreshed ${data.successful} of ${data.total} wallets`)
            fetchWallets()
        } catch (error) {
            toast.error('Failed to refresh balances')
        } finally {
            setRefreshingAll(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard')
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

    const formatBalance = (balance: number | null, currency: string) => {
        if (balance === null) return 'Not loaded'
        const decimals = currency === 'BTC' ? 8 : currency === 'ETH' || currency === 'SOL' ? 6 : 2
        return `${balance.toFixed(decimals)} ${currency}`
    }

    const openEditDialog = (wallet: AdminWallet) => {
        setEditingWallet(wallet)
        setFormData({
            address: wallet.address,
            currency: wallet.currency,
            network: wallet.network || '',
            label: wallet.label || '',
        })
        setDialogOpen(true)
    }

    const openCreateDialog = () => {
        setEditingWallet(null)
        setFormData({ address: '', currency: 'BTC', network: '', label: '' })
        setDialogOpen(true)
    }

    return (
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-transparent">
                            <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold">My Wallets</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Manage your crypto wallets and track balances
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshAll}
                            disabled={refreshingAll}
                        >
                            {refreshingAll ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Refresh All
                        </Button>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={openCreateDialog}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Wallet
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingWallet ? 'Edit Wallet' : 'Add New Wallet'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {editingWallet
                                            ? 'Update the wallet label'
                                            : 'Add a wallet address to track its balance'}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {!editingWallet && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="address">Wallet Address</Label>
                                                <Input
                                                    id="address"
                                                    value={formData.address}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, address: e.target.value })
                                                    }
                                                    placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="currency">Currency</Label>
                                                <select
                                                    id="currency"
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                                    value={formData.currency}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, currency: e.target.value })
                                                    }
                                                >
                                                    <option value="BTC">Bitcoin (BTC)</option>
                                                    <option value="ETH">Ethereum (ETH)</option>
                                                    <option value="SOL">Solana (SOL)</option>
                                                    <option value="USDT">Tether (USDT)</option>
                                                    <option value="USDC">USD Coin (USDC)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="network">Network (Optional)</Label>
                                                <Input
                                                    id="network"
                                                    value={formData.network}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, network: e.target.value })
                                                    }
                                                    placeholder="mainnet"
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="label">Label (Optional)</Label>
                                        <Input
                                            id="label"
                                            value={formData.label}
                                            onChange={(e) =>
                                                setFormData({ ...formData, label: e.target.value })
                                            }
                                            placeholder="My Main Wallet"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={editingWallet ? handleUpdate : handleCreate}>
                                        {editingWallet ? 'Update' : 'Add'} Wallet
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                        <p className="text-sm font-medium text-foreground mb-1">No wallets added yet</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                            Add your wallet addresses to track balances
                        </p>
                        <Button size="sm" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Wallet
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {wallets.map((wallet) => {
                            const explorerUrl = getExplorerUrl(wallet.address, wallet.currency)

                            return (
                                <div
                                    key={wallet.id}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex-shrink-0">
                                            <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {wallet.label && (
                                                    <span className="text-sm font-medium">{wallet.label}</span>
                                                )}
                                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs font-medium">
                                                    {wallet.currency}
                                                </Badge>
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
                                            {wallet.balanceUpdatedAt && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Updated {new Date(wallet.balanceUpdatedAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {formatBalance(wallet.balance, wallet.currency)}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRefreshBalance(wallet.id)}
                                                disabled={refreshing === wallet.id}
                                            >
                                                {refreshing === wallet.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditDialog(wallet)}
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(wallet.id)}
                                            >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </div>
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

