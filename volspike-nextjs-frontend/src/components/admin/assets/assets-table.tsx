'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { adminAPI } from '@/lib/admin/api-client'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Save, Trash2, RefreshCw, RefreshCcw, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdminAssetsTableProps {
    accessToken?: string | null
}

export function AdminAssetsTable({ accessToken }: AdminAssetsTableProps) {
    const [assets, setAssets] = useState<AssetRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [refreshingId, setRefreshingId] = useState<string | null>(null)
    const [bulkRefreshing, setBulkRefreshing] = useState(false)
    const [query, setQuery] = useState('')

    useEffect(() => {
        if (!accessToken) return
        adminAPI.setAccessToken(accessToken)

        const fetchAssets = async () => {
            try {
                const res = await adminAPI.getAssets({ q: query, limit: 100 })
                setAssets(res.assets)
            } catch (err) {
                console.error('[AdminAssetsTable] Failed to load assets', err)
                toast.error('Failed to load assets')
            } finally {
                setLoading(false)
            }
        }

        fetchAssets()
    }, [accessToken, query])

    const handleFieldChange = (id: string | undefined, field: keyof AssetRecord, value: string) => {
        setAssets((prev) =>
            prev.map((asset) =>
                asset.id === id
                    ? { ...asset, [field]: value }
                    : asset
            )
        )
    }

    const handleSave = async (asset: AssetRecord) => {
        if (!accessToken) return
        setSavingId(asset.id ?? asset.baseSymbol)
        try {
            const res = await adminAPI.saveAsset(asset)
            setAssets((prev) =>
                prev.map((a) =>
                    (a.id && res.asset.id && a.id === res.asset.id) || (!a.id && a.baseSymbol === res.asset.baseSymbol)
                        ? res.asset
                        : a
                )
            )
            toast.success(`Saved ${asset.baseSymbol}`)
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to save asset', err)
            toast.error(err.response?.error || 'Failed to save asset')
        } finally {
            setSavingId(null)
        }
    }

    const handleRefresh = async (asset: AssetRecord) => {
        if (!accessToken || !asset.id) {
            toast.error('Cannot refresh: asset not saved yet')
            return
        }
        setRefreshingId(asset.id)
        try {
            const res = await adminAPI.refreshAsset(asset.id)
            setAssets((prev) =>
                prev.map((a) =>
                    a.id === asset.id ? res.asset : a
                )
            )
            toast.success(res.message || `Refreshed ${asset.baseSymbol} from CoinGecko`)
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to refresh asset', err)
            toast.error(err.response?.error || err.response?.details || 'Failed to refresh asset')
        } finally {
            setRefreshingId(null)
        }
    }

    const handleBulkRefresh = async () => {
        if (!accessToken) return
        setBulkRefreshing(true)
        try {
            const res = await adminAPI.bulkRefreshAssets({ limit: 10 })
            toast.success(res.message || `Refreshed ${res.refreshed} of ${res.total} assets`)
            await fetchAssets() // Reload to show updated data
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to bulk refresh', err)
            toast.error(err.response?.error || err.response?.details || 'Failed to bulk refresh')
        } finally {
            setBulkRefreshing(false)
        }
    }

    const handleRunCycle = async () => {
        if (!accessToken) return
        setBulkRefreshing(true)
        try {
            const res = await adminAPI.runRefreshCycle()
            toast.success(res.message || `Refresh cycle completed: ${res.refreshed} assets refreshed`)
            await fetchAssets() // Reload to show updated data
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to run refresh cycle', err)
            toast.error(err.response?.error || err.response?.details || 'Failed to run refresh cycle')
        } finally {
            setBulkRefreshing(false)
        }
    }

    const handleAdd = () => {
        setAssets((prev) => [
            {
                baseSymbol: '',
                binanceSymbol: '',
                coingeckoId: '',
                displayName: '',
                status: 'AUTO',
            },
            ...prev,
        ])
    }

    const handleDelete = async (asset: AssetRecord) => {
        if (!asset.id) {
            setAssets((prev) => prev.filter((a) => a !== asset))
            return
        }
        if (!confirm(`Delete asset ${asset.baseSymbol}?`)) return
        try {
            await adminAPI.deleteAsset(asset.id)
            setAssets((prev) => prev.filter((a) => a.id !== asset.id))
            toast.success(`Deleted ${asset.baseSymbol}`)
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to delete asset', err)
            toast.error(err.response?.error || 'Failed to delete asset')
        }
    }

    const getAssetStatus = (asset: AssetRecord) => {
        const hasLogo = !!asset.logoUrl
        const hasName = !!asset.displayName
        const hasCoingeckoId = !!asset.coingeckoId
        const isComplete = hasLogo && hasName && hasCoingeckoId

        if (isComplete) {
            return { icon: CheckCircle2, color: 'text-green-500', label: 'Complete' }
        }
        if (!hasLogo) {
            return { icon: AlertCircle, color: 'text-yellow-500', label: 'Missing Logo' }
        }
        if (!hasCoingeckoId) {
            return { icon: AlertCircle, color: 'text-orange-500', label: 'No CoinGecko ID' }
        }
        return { icon: Clock, color: 'text-blue-500', label: 'Partial' }
    }

    const formatUpdatedAt = (updatedAt?: string | null) => {
        if (!updatedAt) return 'Never'
        const date = new Date(updatedAt)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        
        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
        return `${Math.floor(diffDays / 30)} months ago`
    }

    if (!accessToken) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Admin access token missing – sign in as admin to manage asset mappings.
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        )
    }

    const assetsNeedingRefresh = assets.filter(a => {
        if (!a.logoUrl || !a.displayName || !a.coingeckoId) return true
        if (!a.updatedAt) return true
        const updatedAt = new Date(a.updatedAt).getTime()
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        return updatedAt < weekAgo
    }).length

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by symbol, name, or CoinGecko id..."
                        className="w-72"
                    />
                    {assetsNeedingRefresh > 0 && (
                        <Badge variant="outline" className="text-xs">
                            {assetsNeedingRefresh} need refresh
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleBulkRefresh}
                        disabled={bulkRefreshing || assetsNeedingRefresh === 0}
                        title="Refresh up to 10 assets that need refresh"
                    >
                        {bulkRefreshing ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <RefreshCcw className="h-4 w-4 mr-1" />
                        )}
                        Bulk Refresh
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleRunCycle}
                        disabled={bulkRefreshing}
                        title="Run scheduled refresh cycle (respects rate limits)"
                    >
                        {bulkRefreshing ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Run Cycle
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Asset
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border/60 bg-card/60">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted/60">
                        <tr className="text-xs text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">Logo</th>
                            <th className="px-3 py-2 text-left font-medium">Base</th>
                            <th className="px-3 py-2 text-left font-medium">Binance Perp</th>
                            <th className="px-3 py-2 text-left font-medium">CoinGecko Id</th>
                            <th className="px-3 py-2 text-left font-medium">Name</th>
                            <th className="px-3 py-2 text-left font-medium">Website</th>
                            <th className="px-3 py-2 text-left font-medium">Twitter / X</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                            <th className="px-3 py-2 text-left font-medium">Updated</th>
                            <th className="px-3 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset) => {
                            const status = getAssetStatus(asset)
                            const StatusIcon = status.icon
                            return (
                                <tr key={asset.id ?? asset.baseSymbol} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                                    <td className="px-3 py-2 align-middle">
                                        <div className="relative h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center overflow-hidden ring-1 ring-border/50">
                                            {asset.logoUrl ? (
                                                <Image
                                                    src={asset.logoUrl}
                                                    alt={`${asset.displayName || asset.baseSymbol} logo`}
                                                    fill
                                                    sizes="32px"
                                                    className="object-contain p-1"
                                                    onError={(e) => {
                                                        // Hide image on error
                                                        e.currentTarget.style.display = 'none'
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-[10px] font-semibold text-muted-foreground">
                                                    {asset.baseSymbol?.slice(0, 3).toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.baseSymbol || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'baseSymbol', e.target.value.toUpperCase())}
                                            className="h-8 w-24 font-mono text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.binanceSymbol || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'binanceSymbol', e.target.value.toUpperCase())}
                                            className="h-8 w-32 font-mono text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.coingeckoId || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'coingeckoId', e.target.value)}
                                            className="h-8 w-40 font-mono text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.displayName || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'displayName', e.target.value)}
                                            className="h-8 w-40 text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.websiteUrl || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'websiteUrl', e.target.value)}
                                            className="h-8 w-48 text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Input
                                            value={asset.twitterUrl || ''}
                                            onChange={(e) => handleFieldChange(asset.id, 'twitterUrl', e.target.value)}
                                            className="h-8 w-48 text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                {asset.status || 'AUTO'}
                                            </Badge>
                                            <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} title={status.label} />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                                        {formatUpdatedAt(asset.updatedAt)}
                                    </td>
                                    <td className="px-3 py-2 align-top text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => asset.id && handleRefresh(asset)}
                                                disabled={!asset.id || refreshingId === asset.id}
                                                title="Refresh from CoinGecko"
                                            >
                                                {refreshingId === asset.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleSave(asset)}
                                                disabled={!asset.baseSymbol || savingId === (asset.id ?? asset.baseSymbol)}
                                                title="Save"
                                            >
                                                {savingId === (asset.id ?? asset.baseSymbol) ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Save className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-danger-500 hover:text-danger-600"
                                                onClick={() => handleDelete(asset)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {assets.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No assets found. Add your first asset to get started.
                </div>
            )}
        </div>
    )
}
