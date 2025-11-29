'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { adminAPI } from '@/lib/admin/api-client'
import type { AssetRecord } from '@/lib/asset-manifest'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Save, Trash2, RefreshCw, RefreshCcw, AlertCircle, CheckCircle2, Clock, Database, LayoutGrid, LayoutList, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import toast from 'react-hot-toast'
import { AssetCardView } from './asset-card-view'

interface AdminAssetsTableProps {
    accessToken?: string | null
}

export function AdminAssetsTable({ accessToken }: AdminAssetsTableProps) {
    const [assets, setAssets] = useState<AssetRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [refreshingId, setRefreshingId] = useState<string | null>(null)
    const [bulkRefreshing, setBulkRefreshing] = useState(false)
    const [syncingBinance, setSyncingBinance] = useState(false)
    const [query, setQuery] = useState('')
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards') // Default to cards for better UX
    const [recentlyRefreshed, setRecentlyRefreshed] = useState<Set<string>>(new Set())
    const [filterStatus, setFilterStatus] = useState<'all' | 'needs-refresh' | 'missing-data' | 'incomplete' | 'complete' | 'errors'>('all')
    const [missingDataFilter, setMissingDataFilter] = useState<'all' | 'website' | 'description' | 'coingecko-id' | 'image' | 'twitter' | null>(null)
    const [refreshProgress, setRefreshProgress] = useState<{
        isRunning: boolean
        current: number
        total: number
        currentSymbol?: string
        refreshed: number
        failed: number
        skipped?: number
        noUpdate?: number
        errors?: Array<{ symbol: string; reason: string; error?: string }>
        successes?: string[]
    } | null>(null)
    const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null)
    const [currentPage, setCurrentPage] = useState(1)

    const fetchAssets = useCallback(async (page: number = 1, append: boolean = false, searchQuery?: string) => {
        if (!accessToken) {
            console.warn('[AdminAssetsTable] No access token, skipping fetch')
            setLoading(false)
            return
        }
        try {
            if (append) {
                setLoadingMore(true)
            } else {
                setLoading(true)
            }
            // Use searchQuery parameter if provided, otherwise use empty string (client-side filtering)
            const apiQuery = searchQuery !== undefined ? searchQuery : ''
            console.debug('[AdminAssetsTable] Fetching assets...', { apiQuery, page, accessToken: accessToken.substring(0, 10) + '...' })
            const res = await adminAPI.getAssets({ q: apiQuery, limit: 1000, page })
            console.debug('[AdminAssetsTable] Assets fetched:', { count: res.assets?.length || 0, pagination: res.pagination })

            if (append) {
                setAssets((prev) => [...prev, ...(res.assets || [])])
            } else {
                setAssets(res.assets || [])
            }
            setPagination(res.pagination)
            setCurrentPage(page)
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to load assets', {
                error: err,
                message: err?.message,
                response: err?.response,
                status: err?.status,
            })
            const errorMsg = err?.response?.error || err?.message || 'Failed to load assets'
            toast.error(errorMsg)
            if (!append) {
                setAssets([]) // Clear assets on error (but not when loading more)
            }
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [accessToken]) // Remove query from dependencies - we'll filter client-side

    const handleLoadMore = () => {
        if (pagination && currentPage < pagination.pages) {
            fetchAssets(currentPage + 1, true)
        }
    }

    // Initial fetch - only when accessToken changes
    useEffect(() => {
        if (!accessToken) return
        adminAPI.setAccessToken(accessToken)
        setCurrentPage(1)
        fetchAssets(1, false) // Fetch all assets, filter client-side
    }, [accessToken, fetchAssets])

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
            const updatedAsset = res.asset
            
            setAssets((prev) =>
                prev.map((a) =>
                    (a.id && updatedAsset.id && a.id === updatedAsset.id) || (!a.id && a.baseSymbol === updatedAsset.baseSymbol)
                        ? updatedAsset
                        : a
                )
            )
            
            // Save is fast - always show success immediately
            toast.success(`Saved ${asset.baseSymbol}`, { duration: 2000 })
            
            // If CoinGecko ID was just added or changed, automatically trigger refresh in background
            const hadCoingeckoId = asset.coingeckoId
            const hasCoingeckoId = updatedAsset.coingeckoId
            const coingeckoIdChanged = hadCoingeckoId !== hasCoingeckoId
            
            if (hasCoingeckoId && (coingeckoIdChanged || !updatedAsset.logoUrl || !updatedAsset.displayName || !updatedAsset.description)) {
                // Trigger refresh asynchronously - don't block the save
                if (updatedAsset.id) {
                    // Small delay to let save complete, then refresh
                    setTimeout(async () => {
                        await handleRefresh(updatedAsset)
                    }, 300)
                }
            }
        } catch (err: any) {
            console.error('[AdminAssetsTable] Failed to save asset', {
                error: err,
                message: err.message,
                response: err.response,
                status: err.status,
            })
            
            // AdminAPIError stores response in err.response directly (not nested under data)
            const errorResponse = err.response || {}
            const errorMessage = errorResponse.details || errorResponse.error || err.message || 'Failed to save asset'
            
            // If we have detailed validation errors, show them
            if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
                const detailMessages = errorResponse.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
                toast.error(`${errorMessage}: ${detailMessages}`, { duration: 6000 })
            } else if (errorResponse.details) {
                // Show details if available
                toast.error(`${errorMessage}`, { duration: 6000 })
            } else {
                toast.error(errorMessage, { duration: 5000 })
            }
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

    // Poll refresh progress when cycle is running
    useEffect(() => {
        if (!refreshProgress?.isRunning) return

        const pollProgress = async () => {
            try {
                const status = await adminAPI.getRefreshStatus()
                if (status.success && status.progress) {
                    setRefreshProgress(status.progress)

                    // If cycle completed, refresh assets list
                    if (!status.progress.isRunning && refreshProgress.isRunning) {
                        await fetchAssets()
                        const refreshed = status.progress.refreshed || 0
                        const failed = status.progress.failed || 0
                        const skipped = status.progress.skipped || 0
                        const noUpdate = status.progress.noUpdate || 0
                        
                        // Build detailed success message
                        const parts: string[] = []
                        if (refreshed > 0) parts.push(`${refreshed} refreshed`)
                        if (skipped > 0) parts.push(`${skipped} skipped (no CoinGecko ID)`)
                        if (noUpdate > 0) parts.push(`${noUpdate} no update needed`)
                        if (failed > 0) parts.push(`${failed} failed`)
                        
                        const message = parts.length > 0 
                            ? `✅ Refresh cycle completed: ${parts.join(', ')}`
                            : '✅ Refresh cycle completed'
                        
                        toast.success(message, { duration: 6000 })
                    }
                }
            } catch (error) {
                console.debug('[AdminAssetsTable] Failed to poll refresh status:', error)
            }
        }

        const interval = setInterval(pollProgress, 2000) // Poll every 2 seconds
        return () => clearInterval(interval)
    }, [refreshProgress?.isRunning, accessToken])

    // Check refresh status on mount and periodically
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await adminAPI.getRefreshStatus()
                if (status.success && status.progress?.isRunning) {
                    setRefreshProgress(status.progress)
                }
            } catch (error) {
                // Silently fail - status check is optional
            }
        }

        checkStatus()
        const interval = setInterval(checkStatus, 10000) // Check every 10 seconds
        return () => clearInterval(interval)
    }, [accessToken])

    const handleRunCycle = async () => {
        if (!accessToken) return
        setBulkRefreshing(true)

        try {
            console.log('[AdminAssetsTable] 🔄 Starting refresh cycle...')
            const res = await adminAPI.runRefreshCycle()

            console.log('[AdminAssetsTable] ✅ Refresh cycle started:', res)

            if (res.progress) {
                setRefreshProgress(res.progress)
            }

            if (res.success) {
                toast.success(res.message || 'Refresh cycle started in background', {
                    duration: 3000,
                })
            } else {
                toast.error(res.message || 'Failed to start refresh cycle')
            }
        } catch (err: any) {
            console.error('[AdminAssetsTable] ❌ Failed to start refresh cycle', err)
            toast.error(err.response?.error || err.response?.details || 'Failed to start refresh cycle')
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
                debug: err?.response?.debug, // NEW: Show debug info
            })

            // Build detailed error message
            let errorMsg = 'Failed to sync from Binance'
            const details = err?.response?.details || err?.message
            const debug = err?.response?.debug

            if (details) {
                errorMsg = `${errorMsg}: ${details}`
            }

            // Show debug info if available
            if (debug) {
                console.log('[AdminAssetsTable] 🔍 Debug info from server:', debug)
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
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        
        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
        return `${Math.floor(diffDays / 30)} months ago`
    }

    // Calculate stats (must be before early returns for useMemo)
    // Match backend logic: shouldRefresh checks logoUrl, displayName, description, coingeckoId, and update age
    const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 1 week (matches backend)
    const now = Date.now()
    
    // Needs Refresh: Assets with all critical fields but stale (>1 week old)
    // Excludes assets with missing data - those are counted separately
    const assetsNeedingRefresh = assets.filter(a => {
        if (a.status === 'HIDDEN') return false
        // Must have all critical fields (exclude missing data)
        if (!a.logoUrl || !a.displayName || !a.description || !a.coingeckoId) return false
        // Must have updatedAt timestamp
        if (!a.updatedAt) return false
        // Check if older than 1 week
        const updatedAt = new Date(a.updatedAt).getTime()
        return now - updatedAt > REFRESH_INTERVAL_MS
    }).length

    const fullyEnriched = assets.filter(a => a.logoUrl && a.displayName && a.coingeckoId && a.description).length
    const enrichmentPercentage = assets.length > 0 ? Math.round((fullyEnriched / assets.length) * 100) : 0

    // Calculate missing data counts
    const missingDataCount = assets.filter(a => !a.logoUrl || !a.displayName || !a.coingeckoId || !a.description || !a.websiteUrl || !a.twitterUrl).length
    const missingWebsiteCount = assets.filter(a => !a.websiteUrl).length
    const missingDescriptionCount = assets.filter(a => !a.description).length
    const missingCoingeckoIdCount = assets.filter(a => !a.coingeckoId).length
    const missingImageCount = assets.filter(a => !a.logoUrl).length
    const missingTwitterCount = assets.filter(a => !a.twitterUrl).length
    const incompleteCount = assets.filter(a => !a.isComplete).length
    const completeCount = assets.filter(a => a.isComplete).length

    // Filter assets based on selected filter (must be before early returns)
    const filteredAssets = useMemo(() => {
        let filtered = assets

        // Apply search query
        if (query.trim()) {
            const q = query.toLowerCase()
            filtered = filtered.filter(
                (a) =>
                    a.baseSymbol?.toLowerCase().includes(q) ||
                    a.displayName?.toLowerCase().includes(q) ||
                    a.coingeckoId?.toLowerCase().includes(q) ||
                    a.binanceSymbol?.toLowerCase().includes(q)
            )
        }

        // Apply status filter
        if (filterStatus === 'needs-refresh') {
            // Needs Refresh: Complete assets with all critical fields but stale (>1 week old)
            const refreshInterval = 7 * 24 * 60 * 60 * 1000 // 1 week
            const now = Date.now()
            filtered = filtered.filter((a) => {
                if (a.status === 'HIDDEN' || !a.isComplete) return false
                // Must have all critical fields
                if (!a.logoUrl || !a.displayName || !a.description || !a.coingeckoId) return false
                // Must have updatedAt timestamp
                if (!a.updatedAt) return false
                // Check if older than 1 week
                const updatedAt = new Date(a.updatedAt).getTime()
                return now - updatedAt > refreshInterval
            })
        } else if (filterStatus === 'missing-data') {
            // Missing Data: Assets missing any field (with sub-filters)
            filtered = filtered.filter((a) => {
                if (missingDataFilter === 'website') return !a.websiteUrl
                if (missingDataFilter === 'description') return !a.description
                if (missingDataFilter === 'coingecko-id') return !a.coingeckoId
                if (missingDataFilter === 'image') return !a.logoUrl
                if (missingDataFilter === 'twitter') return !a.twitterUrl
                // Show all missing data (any field missing)
                return !a.logoUrl || !a.displayName || !a.coingeckoId || !a.description || !a.websiteUrl || !a.twitterUrl
            })
        } else if (filterStatus === 'incomplete') {
            // Incomplete: Assets not marked as Complete by admin
            filtered = filtered.filter((a) => !a.isComplete)
        } else if (filterStatus === 'complete') {
            // Complete: Assets marked as Complete by admin
            filtered = filtered.filter((a) => a.isComplete)
        } else if (filterStatus === 'errors') {
            // Show assets that failed in the last refresh cycle
            const errorSymbols = new Set(refreshProgress?.errors?.map((e) => e.symbol) || [])
            filtered = filtered.filter((a) => errorSymbols.has(a.baseSymbol))
        }

        return filtered
    }, [assets, query, filterStatus, missingDataFilter, refreshProgress?.errors])

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
            {/* Enrichment Status Banner - Shows overall enrichment progress (not current cycle) */}
            {assets.length > 0 && assetsNeedingRefresh > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-amber-500/20 p-2">
                                <Clock className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">
                                    Overall Enrichment Status
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {fullyEnriched} of {assets.length} total assets enriched ({enrichmentPercentage}%) • {assetsNeedingRefresh} need refresh
                                </p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    Note: Refresh cycles process assets that need updates, not all {assets.length} assets
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRunCycle}
                                disabled={bulkRefreshing}
                                className="bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                            >
                                {bulkRefreshing ? (
                                    <>
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-3 w-3 mr-1.5" />
                                        Run Cycle
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-3 h-2 rounded-full bg-amber-500/20 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${enrichmentPercentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Refresh Progress Display */}
            {refreshProgress && refreshProgress.isRunning && (
                <div className="mb-4 p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-sm font-medium text-foreground">
                                Refreshing assets from CoinGecko...
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {refreshProgress.current} / {refreshProgress.total}
                        </span>
                    </div>
                    {refreshProgress.currentSymbol && (
                        <div className="text-xs text-muted-foreground mb-2">
                            Current: <span className="font-mono font-medium">{refreshProgress.currentSymbol}</span>
                        </div>
                    )}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                            style={{
                                width: `${refreshProgress.total > 0 ? (refreshProgress.current / refreshProgress.total) * 100 : 0}%`,
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground flex-wrap gap-2">
                        <span>✅ {refreshProgress.refreshed || 0} refreshed</span>
                        {(refreshProgress.skipped ?? 0) > 0 && <span>⚠️ {refreshProgress.skipped} skipped (no CoinGecko ID)</span>}
                        {(refreshProgress.noUpdate ?? 0) > 0 && <span>ℹ️ {refreshProgress.noUpdate} no update needed</span>}
                        {refreshProgress.failed > 0 && <span className="text-red-400">❌ {refreshProgress.failed} failed</span>}
                    </div>
                    {refreshProgress.errors && refreshProgress.errors.length > 0 && (
                        <details className="mt-3 text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View error details ({refreshProgress.errors.length} errors)
                            </summary>
                            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                                {refreshProgress.errors.slice(0, 20).map((err, idx) => (
                                    <div key={idx} className="font-mono text-[10px] text-red-400/80">
                                        {err.symbol}: {err.reason} - {err.error}
                                    </div>
                                ))}
                                {refreshProgress.errors.length > 20 && (
                                    <div className="text-muted-foreground italic">
                                        ... and {refreshProgress.errors.length - 20} more errors
                                    </div>
                                )}
                            </div>
                        </details>
                    )}
                </div>
            )}

            {/* Optimized Action Bar - Single line on larger screens */}
            <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                {/* Search with clear button */}
                <div className="relative flex-1 min-w-[200px] lg:min-w-[250px]">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search assets..."
                        className="pr-8"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                    )}
                </div>
                
                {/* Compact Filter Pills */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <button
                        onClick={() => {
                            setFilterStatus('all')
                            setMissingDataFilter(null)
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === 'all'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        All ({assets.length})
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('incomplete')
                            setMissingDataFilter(null)
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === 'incomplete'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Incomplete ({incompleteCount})
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('complete')
                            setMissingDataFilter(null)
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === 'complete'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Complete ({completeCount})
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('missing-data')
                            setMissingDataFilter('all')
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === 'missing-data'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Missing Data ({missingDataCount})
                    </button>
                    <button
                        onClick={() => {
                            setFilterStatus('needs-refresh')
                            setMissingDataFilter(null)
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === 'needs-refresh'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Needs Refresh ({assetsNeedingRefresh})
                    </button>
                    {refreshProgress?.errors && refreshProgress.errors.length > 0 && (
                        <button
                            onClick={() => {
                                setFilterStatus('errors')
                                setMissingDataFilter(null)
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                                filterStatus === 'errors'
                                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            Errors ({refreshProgress.errors.length})
                        </button>
                    )}
                </div>
                
                {/* Missing Data Sub-filters */}
                {filterStatus === 'missing-data' && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2 pl-2 border-l-2 border-primary/30">
                        <button
                            onClick={() => setMissingDataFilter('all')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'all'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All ({missingDataCount})
                        </button>
                        <button
                            onClick={() => setMissingDataFilter('website')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'website'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Website ({missingWebsiteCount})
                        </button>
                        <button
                            onClick={() => setMissingDataFilter('description')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'description'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Description ({missingDescriptionCount})
                        </button>
                        <button
                            onClick={() => setMissingDataFilter('coingecko-id')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'coingecko-id'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            CoinGecko ID ({missingCoingeckoIdCount})
                        </button>
                        <button
                            onClick={() => setMissingDataFilter('image')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'image'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Image ({missingImageCount})
                        </button>
                        <button
                            onClick={() => setMissingDataFilter('twitter')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                missingDataFilter === 'twitter'
                                    ? 'bg-primary/20 text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Twitter ({missingTwitterCount})
                        </button>
                    </div>
                )}

                {/* Divider (hidden on mobile) */}
                <div className="hidden md:block w-px h-6 bg-border/50 flex-shrink-0" />

                {/* Primary Action: Run Cycle */}
                <Button
                    size="default"
                    variant="default"
                    onClick={handleRunCycle}
                    disabled={bulkRefreshing || syncingBinance || (refreshProgress?.isRunning ?? false)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md flex-shrink-0 whitespace-nowrap"
                >
                    {bulkRefreshing || refreshProgress?.isRunning ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run Refresh Cycle
                        </>
                    )}
                </Button>

                {/* Secondary Actions: View Toggle + Sync */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View Mode Toggle */}
                    <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
                        <Button
                            size="sm"
                            variant={viewMode === 'cards' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('cards')}
                            className="h-7 px-2"
                            title="Card view"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('table')}
                            className="h-7 px-2"
                            title="Table view"
                        >
                            <LayoutList className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Sync from Binance (Icon Only) */}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncBinance}
                        disabled={syncingBinance || bulkRefreshing}
                        title="Sync all Binance perpetual symbols"
                        className="hidden sm:flex"
                    >
                        {syncingBinance ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Database className="h-3.5 w-3.5" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Show filter results count */}
            {filteredAssets.length !== assets.length && (
                <div className="text-xs text-muted-foreground">
                    Showing {filteredAssets.length} of {assets.length} assets
                </div>
            )}

            {/* Conditional rendering based on view mode */}
            {viewMode === 'cards' ? (
                <AssetCardView
                    assets={filteredAssets}
                    onRefresh={handleRefresh}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    refreshingId={refreshingId}
                    savingId={savingId}
                    recentlyRefreshed={recentlyRefreshed}
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
                            <th className="px-3 py-2 text-left font-medium">Complete</th>
                            <th className="px-3 py-2 text-left font-medium">Next Refresh</th>
                            <th className="px-3 py-2 text-left font-medium">Updated</th>
                            <th className="px-3 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAssets.map((asset) => {
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

            {/* Load More Button - Show when there are more pages */}
            {pagination && currentPage < pagination.pages && assets.length > 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="text-sm text-muted-foreground">
                        Showing {assets.length} of {pagination.total} assets
                    </div>
                    <Button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        variant="outline"
                        className="min-w-[200px] bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Loading more...
                            </>
                        ) : (
                            <>
                                Load More ({pagination.total - assets.length} remaining)
                            </>
                        )}
                    </Button>
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
