'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Save, Trash2, CheckCircle2, AlertCircle, Clock, ExternalLink, Twitter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import toast from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'

interface AssetCardViewProps {
    assets: AssetRecord[]
    onRefresh: (asset: AssetRecord) => Promise<void>
    onSave: (asset: AssetRecord) => Promise<void>
    onDelete: (asset: AssetRecord) => Promise<void>
    refreshingId: string | null
    savingId: string | null
}

export function AssetCardView({
    assets,
    onRefresh,
    onSave,
    onDelete,
    refreshingId,
    savingId
}: AssetCardViewProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<AssetRecord>>({})

    const getAssetStatus = (asset: AssetRecord) => {
        const hasLogo = !!asset.logoUrl
        const hasName = !!asset.displayName
        const hasCoingeckoId = !!asset.coingeckoId
        const isComplete = hasLogo && hasName && hasCoingeckoId

        if (isComplete) {
            return { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Complete' }
        }
        if (!hasLogo) {
            return { icon: AlertCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Missing Logo' }
        }
        if (!hasCoingeckoId) {
            return { icon: AlertCircle, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'No CoinGecko ID' }
        }
        return { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Partial' }
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

    const handleEdit = (asset: AssetRecord) => {
        setEditingId(asset.id || asset.baseSymbol)
        setEditForm(asset)
    }

    const handleSaveEdit = async (asset: AssetRecord) => {
        await onSave({ ...asset, ...editForm })
        setEditingId(null)
        setEditForm({})
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const isEditing = (asset: AssetRecord) => editingId === (asset.id || asset.baseSymbol)

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((asset) => {
                const status = getAssetStatus(asset)
                const StatusIcon = status.icon
                const editing = isEditing(asset)
                const currentAsset = editing ? { ...asset, ...editForm } : asset

                return (
                    <div
                        key={asset.id ?? asset.baseSymbol}
                        className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-border transition-all duration-300 hover:shadow-lg"
                    >
                        {/* Status indicator */}
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] uppercase ${status.bgColor}`}>
                                {asset.status || 'AUTO'}
                            </Badge>
                            <div
                                title={status.label}
                                className={`p-1.5 rounded-full ${status.bgColor} cursor-help`}
                            >
                                <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                            </div>
                        </div>

                        {/* Card content */}
                        <div className="p-5 space-y-4">
                            {/* Logo and Symbol */}
                            <div className="flex items-start gap-4">
                                <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center overflow-hidden ring-2 ring-border/50 flex-shrink-0">
                                    {currentAsset.logoUrl ? (
                                        <Image
                                            src={currentAsset.logoUrl}
                                            alt={`${currentAsset.displayName || currentAsset.baseSymbol} logo`}
                                            fill
                                            sizes="64px"
                                            className="object-contain p-2"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-muted-foreground">
                                            {currentAsset.baseSymbol?.slice(0, 3).toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-lg font-bold text-foreground truncate">
                                        {currentAsset.baseSymbol}
                                    </div>
                                    {editing ? (
                                        <Input
                                            value={editForm.displayName ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                            placeholder="Display name"
                                            className="h-7 text-xs mt-1"
                                        />
                                    ) : (
                                        <div className="text-sm text-muted-foreground truncate">
                                            {currentAsset.displayName || 'No name'}
                                        </div>
                                    )}
                                    <div className="text-xs text-muted-foreground/70 mt-0.5 font-mono truncate">
                                        {currentAsset.binanceSymbol || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* CoinGecko ID */}
                            {editing ? (
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">CoinGecko ID</label>
                                    <Input
                                        value={editForm.coingeckoId ?? ''}
                                        onChange={(e) => setEditForm({ ...editForm, coingeckoId: e.target.value })}
                                        placeholder="coingecko-id"
                                        className="h-7 text-xs font-mono"
                                    />
                                </div>
                            ) : currentAsset.coingeckoId ? (
                                <div className="px-2 py-1.5 bg-muted/40 rounded text-xs font-mono text-muted-foreground truncate">
                                    {currentAsset.coingeckoId}
                                </div>
                            ) : (
                                <div className="px-2 py-1.5 bg-muted/40 rounded text-xs text-muted-foreground/50 italic">
                                    No CoinGecko ID
                                </div>
                            )}

                            {/* Links */}
                            {editing ? (
                                <div className="space-y-2">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Website</label>
                                        <Input
                                            value={editForm.websiteUrl ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                                            placeholder="https://..."
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Twitter/X</label>
                                        <Input
                                            value={editForm.twitterUrl ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, twitterUrl: e.target.value })}
                                            placeholder="https://x.com/..."
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {currentAsset.websiteUrl && (
                                        <a
                                            href={currentAsset.websiteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Website
                                        </a>
                                    )}
                                    {currentAsset.twitterUrl && (
                                        <a
                                            href={currentAsset.twitterUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            <Twitter className="h-3 w-3" />
                                            Twitter
                                        </a>
                                    )}
                                    {!currentAsset.websiteUrl && !currentAsset.twitterUrl && (
                                        <div className="text-xs text-muted-foreground/50 italic">No links</div>
                                    )}
                                </div>
                            )}

                            {/* Updated timestamp */}
                            <div className="text-xs text-muted-foreground/60 pt-2 border-t border-border/40">
                                Updated {formatUpdatedAt(currentAsset.updatedAt)}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 pt-2">
                                {editing ? (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => handleSaveEdit(asset)}
                                            disabled={savingId === (asset.id ?? asset.baseSymbol)}
                                            className="flex-1 h-8 text-xs"
                                        >
                                            {savingId === (asset.id ?? asset.baseSymbol) ? (
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            ) : (
                                                <Save className="h-3 w-3 mr-1" />
                                            )}
                                            Save
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancelEdit}
                                            className="h-8 text-xs"
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => asset.id && onRefresh(asset)}
                                            disabled={!asset.id || refreshingId === asset.id}
                                            className="flex-1 h-8 text-xs"
                                        >
                                            {refreshingId === asset.id ? (
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                            )}
                                            Refresh
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEdit(asset)}
                                            className="h-8 text-xs"
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onDelete(asset)}
                                            className="h-8 px-2 text-danger-500 hover:text-danger-600 hover:bg-danger-500/10"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
