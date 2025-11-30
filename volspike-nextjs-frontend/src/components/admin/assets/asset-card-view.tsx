'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, RefreshCw, Save, Trash2, CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'

interface AssetCardViewProps {
    assets: AssetRecord[]
    onRefresh: (asset: AssetRecord) => Promise<void>
    onSave: (asset: AssetRecord) => Promise<void>
    onDelete: (asset: AssetRecord) => Promise<void>
    refreshingId: string | null
    savingId: string | null
    recentlyRefreshed?: Set<string>
}

export function AssetCardView({
    assets,
    onRefresh,
    onSave,
    onDelete,
    refreshingId,
    savingId,
    recentlyRefreshed
}: AssetCardViewProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<AssetRecord>>({})
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())

    // Extract base symbol from trading pair (e.g., "1000000BOB" -> "BOB", "1000PEPE" -> "PEPE", "1MBABYDOGE" -> "BABYDOGE")
    // Handles both pure numeric prefixes (1000, 1000000) and numeric+letter prefixes (1M, 1K, 1B)
    // Excludes single "0" prefix (like "0G")
    const extractBaseSymbol = (baseSymbol: string): string | null => {
        // Match patterns like:
        // - Pure numeric: 10, 100, 1000, 1000000 (2+ digits)
        // - Numeric + letter: 1M, 1K, 1B (1+ digits followed by K/M/B, case insensitive)
        // Exclude single "0" (like "0G")
        const match = baseSymbol.match(/^(\d{2,}|[1-9]\d*[KMkmBb])(.+)$/)
        if (match) {
            return match[2] // Return the symbol part after the prefix
        }
        return null // No meaningful prefix found
    }

    // Normalize string for comparison (lowercase, alphanumeric only)
    const normalizeForComparison = (str: string): string => {
        return str.toLowerCase().replace(/[^a-z0-9]/g, '')
    }

    // Check if we should show the symbol line (when baseSymbol doesn't match displayName/coingeckoId)
    const shouldShowSymbol = (asset: AssetRecord): boolean => {
        if (!asset.displayName) return false
        
        const extractedSymbol = extractBaseSymbol(asset.baseSymbol)
        
        // Only show symbol line if there's a meaningful numeric prefix (like 1000000BOB, 1000BONK)
        // Don't show for assets without prefix (0G, OG, BTC, ETH, etc.)
        if (!extractedSymbol) return false
        
        // Normalize both for comparison
        const symbolNormalized = normalizeForComparison(extractedSymbol)
        const displayNameNormalized = normalizeForComparison(asset.displayName)
        
        // Show symbol line only if they're different
        // Examples:
        // - "MOG" vs "Mog Coin" → different (show "MOG - Mog Coin")
        // - "BONK" vs "Bonk" → same (don't show, just "BONK")
        // - "BOB" vs "Build On BNB" → different (show "BOB - Build On BNB")
        // - "0G" → no prefix (extractedSymbol is null), so won't show symbol line
        return symbolNormalized !== displayNameNormalized
    }

    // Format next refresh time (e.g., "3 days 7 hours")
    const formatNextRefresh = (updatedAt?: string | null): string | null => {
        if (!updatedAt) return null
        const updated = new Date(updatedAt).getTime()
        const nextRefresh = updated + (7 * 24 * 60 * 60 * 1000) // +7 days
        const now = Date.now()
        const diffMs = nextRefresh - now
        
        if (diffMs <= 0) return 'Due now'
        
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
        const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000))
        
        const parts: string[] = []
        if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
        if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
        if (days === 0 && hours === 0 && minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
        
        return parts.length > 0 ? parts.join(' ') : 'Soon'
    }

    const getAssetStatus = (asset: AssetRecord) => {
        // Complete status is manually set by admin, not auto-detected
        if (asset.isComplete) {
            return { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Complete' }
        }
        
        // Incomplete assets show what's missing
        if (!asset.coingeckoId) {
            return { icon: AlertCircle, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'No CoinGecko ID' }
        }
        if (!asset.logoUrl) {
            return { icon: AlertCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Missing Logo' }
        }
        return { icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Incomplete' }
    }

    const formatUpdatedAt = (updatedAt?: string | null) => {
        if (!updatedAt) return 'Never'
        const date = new Date(updatedAt)
        const now = new Date()
        
        // Use local timezone for date comparison (not UTC)
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const localNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const diffDays = Math.floor((localNow.getTime() - localDate.getTime()) / (1000 * 60 * 60 * 24))

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
        // Ensure baseSymbol and id are always included (required fields)
        // Only include editForm fields that are actually set (not undefined)
        const cleanedEditForm = Object.fromEntries(
            Object.entries(editForm).filter(([_, value]) => value !== undefined)
        )
        
        // Ensure baseSymbol is a string (not array) and always present
        const baseSymbol = typeof cleanedEditForm.baseSymbol === 'string' 
            ? cleanedEditForm.baseSymbol 
            : (typeof asset.baseSymbol === 'string' ? asset.baseSymbol : String(asset.baseSymbol || ''))
        
        const dataToSave: AssetRecord = {
            ...asset,
            ...cleanedEditForm,
            baseSymbol, // Ensure it's always a string
            id: asset.id, // Preserve ID
        }
        
        console.log('[AssetCardView] Saving asset:', {
            originalAsset: { baseSymbol: asset.baseSymbol, id: asset.id },
            editForm: cleanedEditForm,
            finalData: { baseSymbol: dataToSave.baseSymbol, id: dataToSave.id, coingeckoId: dataToSave.coingeckoId },
        })
        
        await onSave(dataToSave)
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
                const wasRecentlyRefreshed = recentlyRefreshed?.has(asset.baseSymbol)

                return (
                    <div
                        key={asset.id ?? asset.baseSymbol}
                        className={`group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-500 ${
                            wasRecentlyRefreshed
                                ? 'border-green-500/60 bg-gradient-to-br from-green-500/20 to-card/80 shadow-lg shadow-green-500/20 animate-pulse'
                                : 'border-border/60 bg-gradient-to-br from-card/80 to-card/60 hover:border-border/80 hover:shadow-xl hover:scale-[1.02]'
                        }`}
                    >
                        {/* Card content */}
                        <div className="p-5 space-y-4">
                            {/* Header with status badges */}
                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/40">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {editing ? (
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wide">
                                                Status
                                            </label>
                                            <Select
                                                value={editForm.status || asset.status || 'AUTO'}
                                                onValueChange={(value: 'AUTO' | 'VERIFIED' | 'HIDDEN') => {
                                                    setEditForm({ ...editForm, status: value })
                                                }}
                                            >
                                                <SelectTrigger className="h-7 w-[120px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AUTO">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">AUTO</span>
                                                            <span className="text-[10px] text-muted-foreground">Auto-managed</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="VERIFIED">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">VERIFIED</span>
                                                            <span className="text-[10px] text-muted-foreground">Locked from updates</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="HIDDEN">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">HIDDEN</span>
                                                            <span className="text-[10px] text-muted-foreground">Hidden from public</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <Badge 
                                            variant="secondary" 
                                            className="text-[10px] uppercase font-semibold px-2 py-0.5"
                                            title={
                                                asset.status === 'VERIFIED' 
                                                    ? 'Manually verified - locked from automatic updates' 
                                                    : asset.status === 'HIDDEN'
                                                    ? 'Hidden from public asset manifest'
                                                    : 'Automatically managed - can be updated by refresh cycles'
                                            }
                                        >
                                            {asset.status || 'AUTO'}
                                        </Badge>
                                    )}
                                    {wasRecentlyRefreshed && (
                                        <Badge className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-green-500 text-white animate-bounce">
                                            ✨ Just Updated!
                                        </Badge>
                                    )}
                                </div>
                                <div
                                    title={status.label}
                                    className={`p-1.5 rounded-lg ${status.bgColor} cursor-help transition-transform hover:scale-110`}
                                >
                                    <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                                </div>
                            </div>

                            {/* Logo and Symbol */}
                            <div className="flex items-start gap-4">
                                <div className="relative h-20 w-20 rounded-xl bg-gradient-to-br from-primary/10 via-muted/40 to-muted/20 flex items-center justify-center overflow-hidden ring-2 ring-border/50 flex-shrink-0 shadow-sm">
                                    {currentAsset.logoUrl ? (
                                        <Image
                                            src={currentAsset.logoUrl}
                                            alt={`${currentAsset.displayName || currentAsset.baseSymbol} logo`}
                                            fill
                                            sizes="80px"
                                            className="object-contain p-3"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <span className="text-base font-bold text-muted-foreground/60">
                                            {currentAsset.baseSymbol?.slice(0, 3).toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="text-xl font-bold text-foreground truncate tracking-tight">
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
                                        <div className="text-sm text-muted-foreground truncate mt-1 font-medium">
                                            {(() => {
                                                if (!currentAsset.displayName) {
                                                    return <span className="italic text-muted-foreground/50">No name</span>
                                                }
                                                
                                                // If displayName matches the extracted symbol (case-insensitive), show uppercase symbol instead
                                                const extractedSymbol = extractBaseSymbol(currentAsset.baseSymbol)
                                                if (extractedSymbol) {
                                                    const symbolNormalized = normalizeForComparison(extractedSymbol)
                                                    const displayNameNormalized = normalizeForComparison(currentAsset.displayName)
                                                    if (symbolNormalized === displayNameNormalized) {
                                                        return extractedSymbol.toUpperCase() // Show uppercase symbol if name matches
                                                    }
                                                }
                                                
                                                // Otherwise, just show the display name
                                                return currentAsset.displayName
                                            })()}
                                        </div>
                                    )}
                                    <div className="text-[11px] text-muted-foreground/60 mt-1 font-mono truncate">
                                        {currentAsset.binanceSymbol || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* CoinGecko ID */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wide">
                                    CoinGecko ID
                                    {editing && (
                                        <span className="ml-1 text-[9px] text-muted-foreground/60 font-normal">
                                            (e.g., bitcoin, ethereum, solana)
                                        </span>
                                    )}
                                </label>
                                {editing ? (
                                    <div>
                                        <Input
                                            value={editForm.coingeckoId ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, coingeckoId: e.target.value.toLowerCase().trim() })}
                                            placeholder="ethereum"
                                            className="h-7 text-xs font-mono"
                                        />
                                        {editForm.coingeckoId && (
                                            <p className="mt-1 text-[10px] text-muted-foreground/70">
                                                💡 Asset will auto-refresh from CoinGecko after saving
                                            </p>
                                        )}
                                    </div>
                                ) : currentAsset.coingeckoId ? (
                                    <div className="px-3 py-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg text-xs font-mono text-foreground truncate">
                                        {currentAsset.coingeckoId}
                                    </div>
                                ) : (
                                    <div className="px-3 py-2 bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg text-xs text-muted-foreground/50 italic flex items-center gap-2">
                                        <AlertCircle className="h-3 w-3" />
                                        Pending enrichment
                                    </div>
                                )}
                            </div>

                            {/* Project Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wide">Project Description</label>
                                {editing ? (
                                    <Textarea
                                        value={editForm.description ?? ''}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        placeholder="Project description from CoinGecko..."
                                        className="min-h-[80px] text-xs resize-none"
                                        rows={4}
                                    />
                                ) : currentAsset.description ? (
                                    <div className="px-3 py-2 bg-muted/30 border border-border/40 rounded-lg">
                                        <p 
                                            className={`text-xs text-muted-foreground leading-relaxed ${
                                                expandedDescriptions.has(currentAsset.id || currentAsset.baseSymbol) 
                                                    ? '' 
                                                    : 'line-clamp-4'
                                            }`}
                                        >
                                            {currentAsset.description}
                                        </p>
                                        {currentAsset.description.length > 200 && (
                                            <button
                                                onClick={() => {
                                                    const key = currentAsset.id || currentAsset.baseSymbol
                                                    setExpandedDescriptions(prev => {
                                                        const next = new Set(prev)
                                                        if (next.has(key)) {
                                                            next.delete(key)
                                                        } else {
                                                            next.add(key)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                className="mt-2 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                                            >
                                                {expandedDescriptions.has(currentAsset.id || currentAsset.baseSymbol) 
                                                    ? 'Read less' 
                                                    : 'Read full overview'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-3 py-2 bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg text-xs text-muted-foreground/50 flex items-center gap-2 min-h-[80px]">
                                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                        <span>No description available</span>
                                    </div>
                                )}
                            </div>

                            {/* Links */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wide">Links</label>
                                {editing ? (
                                    <div className="space-y-2">
                                        <Input
                                            value={editForm.websiteUrl ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                                            placeholder="Website URL"
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            value={editForm.twitterUrl ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, twitterUrl: e.target.value })}
                                            placeholder="X URL"
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {currentAsset.websiteUrl && (
                                            <a
                                                href={currentAsset.websiteUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all"
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
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all"
                                            >
                                                <span className="h-3 w-3 flex items-center justify-center text-[10px] font-bold">𝕏</span>
                                                X
                                            </a>
                                        )}
                                        {!currentAsset.websiteUrl && !currentAsset.twitterUrl && (
                                            <div className="px-3 py-1.5 bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg text-xs text-muted-foreground/50 italic">
                                                No links available
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Complete toggle and Next refresh */}
                            <div className="space-y-2 pt-2 border-t border-border/40">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-2">
                                        <span>Complete</span>
                                        <span className="text-[10px] text-muted-foreground font-normal">
                                            (Ready for weekly refresh)
                                        </span>
                                    </label>
                                    <Switch
                                        checked={currentAsset.isComplete ?? false}
                                        onCheckedChange={async (checked) => {
                                            try {
                                                const updatedAsset = { ...currentAsset, isComplete: checked }
                                                await onSave(updatedAsset)
                                                toast.success(checked ? 'Asset marked as Complete' : 'Asset marked as Incomplete', { duration: 2000 })
                                            } catch (error: any) {
                                                toast.error(`Failed to update: ${error.message || 'Unknown error'}`, { duration: 3000 })
                                            }
                                        }}
                                        disabled={editing || savingId === (asset.id ?? asset.baseSymbol)}
                                    />
                                </div>
                                {currentAsset.isComplete && currentAsset.updatedAt && (
                                    <div className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" />
                                        <span>Next refresh: {formatNextRefresh(currentAsset.updatedAt) || 'Soon'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Updated timestamp */}
                            <div className="text-xs text-muted-foreground/60">
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

