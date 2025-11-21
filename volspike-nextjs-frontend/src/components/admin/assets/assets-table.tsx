'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { adminAPI } from '@/lib/admin/api-client'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Save, Trash2, RefreshCw, RefreshCcw, AlertCircle, CheckCircle2, Clock, Database, LayoutGrid, LayoutList } from 'lucide-react'
import toast from 'react-hot-toast'
import { AssetCardView } from './asset-card-view'

interface AdminAssetsTableProps {
    accessToken?: string | null
}

export function AdminAssetsTable({ accessToken }: AdminAssetsTableProps) {
    const [assets, setAssets] = useState<AssetRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [refreshingId, setRefreshingId] = useState<string | null>(null)
    const [bulkRefreshing, setBulkRefreshing] = useState(false)
    const [syncingBinance, setSyncingBinance] = useState(false)
    const [query, setQuery] = useState('')
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards') // Default to cards for better UX

    const fetchAssets = useCallback(async () => {
        if (!accessToken) {
            console.warn('[AdminAssetsTable] No access token, skipping fetch')
            setLoading(false)
            return
        }
        try {
            console.debug('[AdminAssetsTable] Fetching assets...', { query, accessToken: accessToken.substring(0, 10) + '...' })
            const res = await adminAPI.getAssets({ q: query, limit: 100 })
            console.debug('[AdminAssetsTable] Assets fetched:', { count: res.assets?.length || 0, pagination: res.pagination })
            setAssets(res.assets || [])
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to load assets', {
                error: err,
                message: err?.message,
                response: err?.response,
                status: err?.status,
            })
            const errorMsg = err?.response?.error || err?.message || 'Failed to load assets'
            toast.error(errorMsg)
            setAssets([]) // Clear assets on error
        } finally {
            setLoading(false)
        }
    }, [accessToken, query])

    useEffect(() => {
        if (!accessToken) return
        adminAPI.setAccessToken(accessToken)
        fetchAssets()
    }, [accessToken, query, fetchAssets])

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

    const handleSyncBinance = async () => {
        if (!accessToken) {
            toast.error('Authentication required')
            return
        }
        setSyncingBinance(true)
        try {
            console.log('[AdminAssetsTable] 🔄 Starting Binance sync...')
            const res = await adminAPI.syncFromBinance()
            console.log('[AdminAssetsTable] ✅ Binance sync successful:', res)
            
            // Show detailed success message
            const successMsg = res.message || 
                `Successfully synced ${res.synced || 0} assets from Binance` +
                (res.created ? ` (${res.created} new, ${res.updated || 0} updated)` : '')
            toast.success(successMsg, {
                duration: 5000,
            })
            
            // Show warning if there were errors
            if (res.errors && res.errors > 0) {
                toast.error(`${res.errors} assets failed to sync. Check console for details.`, {
                    duration: 6000,
                })
                console.warn('[AdminAssetsTable] ⚠️ Some assets failed:', res.results)
            }
            
            await fetchAssets() // Reload to show updated data
        } catch (err: any) {
            console.error('[AdminAssetsTable] ❌ Failed to sync from Binance', {
                error: err,
                message: err?.message,
                status: err?.status,
                response: err?.response,
                details: err?.response?.details,
                code: err?.response?.code,
            })
            
            // Build detailed error message
            let errorMsg = 'Failed to sync from Binance'
            const details = err?.response?.details || err?.message
            
            if (details) {
                errorMsg = `${errorMsg}: ${details}`
            }
            
            // Add specific error context
            if (err?.response?.code === 'ECONNREFUSED' || err?.status === 0) {
                errorMsg = 'Cannot connect to server. Please check your connection.'
            } else if (err?.status === 500) {
                errorMsg = `Server error: ${details || 'Internal server error'}`
            } else if (err?.status === 401 || err?.status === 403) {
                errorMsg = 'Authentication failed. Please refresh and try again.'
            } else if (err?.response?.status) {
                errorMsg = `HTTP ${err.response.status}: ${details || 'Request failed'}`
            }
            
            toast.error(errorMsg, {
                duration: 8000,
            })
        } finally {
            setSyncingBinance(false)
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
                    {/* View mode toggle */}
                    <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-1">
                        <Button
                            size="sm"
                            variant={viewMode === 'cards' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('cards')}
                            className="h-7 px-2"
                            title="Card view"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('table')}
                            className="h-7 px-2"
                            title="Table view"
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button
                        size="sm"
                        variant="default"
                        onClick={handleSyncBinance}
                        disabled={syncingBinance || bulkRefreshing}
                        title="Sync all Binance perpetual symbols to database"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {syncingBinance ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <Database className="h-4 w-4 mr-1" />
                        )}
                        Sync from Binance
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleBulkRefresh}
                        disabled={bulkRefreshing || syncingBinance || assetsNeedingRefresh === 0}
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
                        disabled={bulkRefreshing || syncingBinance}
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

            {/* Conditional rendering based on view mode */}
            {viewMode === 'cards' ? (
                <AssetCardView
                    assets={assets}
                    onRefresh={handleRefresh}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    refreshingId={refreshingId}
                    savingId={savingId}
                />
            ) : (
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
                                            <div title={status.label} className="cursor-help">
                                                <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                                            </div>
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
            )}

            {assets.length === 0 && !loading && (
                <div className="text-center py-12 space-y-4">
                    <div className="flex flex-col items-center gap-3">
                        <div className="rounded-full bg-muted/50 p-4">
                            <Database className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground mb-1">No assets found</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Sync all Binance perpetual symbols to get started
                            </p>
                            <Button 
                                onClick={handleSyncBinance}
                                disabled={syncingBinance}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {syncingBinance ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Syncing from Binance...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4 mr-2" />
                                        Sync from Binance
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
