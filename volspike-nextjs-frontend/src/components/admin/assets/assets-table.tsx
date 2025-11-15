'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/admin/api-client'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

interface AdminAssetsTableProps {
    accessToken?: string | null
}

export function AdminAssetsTable({ accessToken }: AdminAssetsTableProps) {
    const [assets, setAssets] = useState<AssetRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
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
        } catch (err) {
            console.error('[AdminAssetsTable] Failed to save asset', err)
        } finally {
            setSavingId(null)
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
        try {
            await adminAPI.deleteAsset(asset.id)
            setAssets((prev) => prev.filter((a) => a.id !== asset.id))
        } catch (err) {
            console.error('[AdminAssetsTable] Failed to delete asset', err)
        }
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by symbol, name, or CoinGecko id..."
                        className="w-72"
                    />
                </div>
                <Button size="sm" onClick={handleAdd}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Asset
                </Button>
            </div>

            <div className="overflow-x-auto rounded-md border border-border/60 bg-card/60">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted/60">
                        <tr className="text-xs text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">Base</th>
                            <th className="px-3 py-2 text-left font-medium">Binance Perp</th>
                            <th className="px-3 py-2 text-left font-medium">CoinGecko Id</th>
                            <th className="px-3 py-2 text-left font-medium">Name</th>
                            <th className="px-3 py-2 text-left font-medium">Website</th>
                            <th className="px-3 py-2 text-left font-medium">Twitter / X</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                            <th className="px-3 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset) => (
                            <tr key={asset.id ?? asset.baseSymbol} className="border-t border-border/40">
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
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                        {asset.status || 'AUTO'}
                                    </Badge>
                                </td>
                                <td className="px-3 py-2 align-top text-right space-x-2">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() => handleSave(asset)}
                                        disabled={!asset.baseSymbol || savingId === (asset.id ?? asset.baseSymbol)}
                                        title="Save"
                                    >
                                        {savingId === (asset.id ?? asset.baseSymbol) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-danger-500 hover:text-danger-600"
                                        onClick={() => handleDelete(asset)}
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

