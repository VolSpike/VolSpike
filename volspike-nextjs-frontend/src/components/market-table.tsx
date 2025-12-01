'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Star,
    Bell,
    TrendingUp,
    X,
    ExternalLink,
    BarChart3,
    Info,
    Lock
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { AssetProjectOverview } from '@/components/asset-project-overview'
import { prefetchAssetProfile } from '@/hooks/use-asset-profile'
import { WatchlistExportButton } from '@/components/watchlist-export-button'
import { GuestCTA } from '@/components/guest-cta'
import { WatchlistSelector } from '@/components/watchlist-selector'
import { WatchlistFilter } from '@/components/watchlist-filter'
import { useWatchlists } from '@/hooks/use-watchlists'
import { RemoveFromWatchlistDialog } from '@/components/remove-from-watchlist-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const FUNDING_ALERT_THRESHOLD = 0.0003

interface MarketData {
    symbol: string
    price: number
    volume24h: number
    change24h?: number
    volumeChange?: number
    fundingRate: number
    openInterest: number
    timestamp: number
    precision?: number
}

interface MarketTableProps {
    data: MarketData[]
    userTier?: 'free' | 'pro' | 'elite'
    withContainer?: boolean
    lastUpdate?: number
    isConnected?: boolean
    onCreateAlert?: (symbol: string) => void
    openInterestAsOf?: number
    // Guest preview controls
    guestMode?: boolean
    guestVisibleRows?: number
    // Watchlist filtering
    watchlistFilterId?: string | null
    onWatchlistFilterChange?: (watchlistId: string | null) => void
}

// Optimized number formatters
const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
})

export function MarketTable({
    data,
    userTier = 'free',
    withContainer = true,
    lastUpdate,
    isConnected = true,
    onCreateAlert,
    openInterestAsOf,
    guestMode = false,
    guestVisibleRows = 5,
    watchlistFilterId,
    onWatchlistFilterChange,
}: MarketTableProps) {
    const { data: session } = useSession()
    const { watchlists, addSymbol, removeSymbol } = useWatchlists()
    const queryClient = useQueryClient()
    const [sortBy, setSortBy] = useState<'symbol' | 'volume' | 'change' | 'price' | 'funding' | 'openInterest'>('volume')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [hoveredRow, setHoveredRow] = useState<string | null>(null)
    const [selectedSymbol, setSelectedSymbol] = useState<MarketData | null>(null)
    const [watchlistSelectorOpen, setWatchlistSelectorOpen] = useState(false)
    const [symbolToAdd, setSymbolToAdd] = useState<string | undefined>()
    // Initialize selectedWatchlistId - ensure it's never undefined
    const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(() => {
        return watchlistFilterId ?? null
    })
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
    const [symbolToRemove, setSymbolToRemove] = useState<string | undefined>()
    const [watchlistsForRemoval, setWatchlistsForRemoval] = useState<Array<{ id: string; name: string }>>([])

    // Sync selectedWatchlistId with watchlistFilterId prop
    useEffect(() => {
        if (watchlistFilterId !== undefined) {
            setSelectedWatchlistId(watchlistFilterId ?? null)
        }
    }, [watchlistFilterId])

    // Get watchlist symbols if a watchlist is selected
    // Filter the existing WebSocket data instead of fetching from REST API
    const { data: watchlistInfo } = useQuery({
        queryKey: ['watchlist-info', selectedWatchlistId],
        queryFn: async () => {
            if (!selectedWatchlistId) return null
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            // Backend accepts simple user ID as token (not JWT)
            const token = session?.user?.id ? String(session.user.id) : ''
            if (!token) {
                throw new Error('Not authenticated')
            }
            const response = await fetch(`${API_URL}/api/watchlist/${selectedWatchlistId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch watchlist')
            }
            return response.json()
        },
        enabled: !!selectedWatchlistId && !!session?.user,
        staleTime: 60000, // 1 minute
    })

    // Filter existing WebSocket data by watchlist symbols
    const displayData = useMemo(() => {
        if (!selectedWatchlistId || !watchlistInfo) {
            return data
        }
        
        // Get symbols from watchlist (API returns watchlist directly, not wrapped)
        const watchlistSymbols = watchlistInfo.items?.map((item: any) => 
            item.contract?.symbol?.toUpperCase()
        ).filter(Boolean) || []
        
        if (watchlistSymbols.length === 0) {
            return []
        }
        
        // Filter data by watchlist symbols (case-insensitive)
        return data.filter(item => 
            watchlistSymbols.some((symbol: string) => 
                item.symbol.toUpperCase() === symbol.toUpperCase()
            )
        )
    }, [data, selectedWatchlistId, watchlistInfo])

    // Create a map of symbol -> array of watchlist info (supports multiple watchlists per symbol)
    const symbolToWatchlistsMap = useMemo(() => {
        const map = new Map<string, Array<{ watchlistId: string; watchlistName: string; itemId: string }>>()
        watchlists.forEach((watchlist) => {
            watchlist.items.forEach((item) => {
                const symbol = item.contract.symbol
                if (!map.has(symbol)) {
                    map.set(symbol, [])
                }
                map.get(symbol)!.push({
                    watchlistId: watchlist.id,
                    watchlistName: watchlist.name,
                    itemId: item.id,
                })
            })
        })
        return map
    }, [watchlists])

    // Create a set of symbols that are in watchlists for quick lookup
    const symbolsInWatchlists = useMemo(() => {
        return new Set(symbolToWatchlistsMap.keys())
    }, [symbolToWatchlistsMap])

    // Check if a symbol is in any watchlist
    const isSymbolInWatchlist = (symbol: string) => {
        return symbolsInWatchlists.has(symbol)
    }

    // Get all watchlists containing a symbol
    const getWatchlistsForSymbol = (symbol: string) => {
        return symbolToWatchlistsMap.get(symbol) || []
    }

    // Handle watchlist filter change
    const handleWatchlistFilterChange = (watchlistId: string | null) => {
        setSelectedWatchlistId(watchlistId)
        if (onWatchlistFilterChange) {
            onWatchlistFilterChange(watchlistId)
        }
    }
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const prevPriceRef = useRef<Map<string, number>>(new Map())
    const flashRef = useRef<Map<string, { dir: 'up' | 'down', wholeUntil: number, suffixUntil: number, suffixIndex: number }>>(new Map())
    const lastFlashTsRef = useRef<Map<string, number>>(new Map())
    const lastDirRef = useRef<Map<string, 'up' | 'down'>>(new Map())
    const persistentRef = useRef<Map<string, { dir: 'up' | 'down', suffixIndex: number }>>(new Map())
    const [canScroll, setCanScroll] = useState(false)
    const [atTop, setAtTop] = useState(true)
    const [atBottom, setAtBottom] = useState(false)
    const [hasScrollableContent, setHasScrollableContent] = useState(false)
    const FLASH_ENABLED = (process.env.NEXT_PUBLIC_PRICE_FLASH ?? '').toString().toLowerCase() === 'true' || process.env.NEXT_PUBLIC_PRICE_FLASH === '1'
    const SCROLL_DEBUG_ENABLED =
        (process.env.NEXT_PUBLIC_DEBUG_SCROLL ?? '').toString().toLowerCase() === 'true' ||
        process.env.NEXT_PUBLIC_DEBUG_SCROLL === '1'
    const WHOLE_MS = 900
    const SUFFIX_MS = 1400
    const MIN_INTERVAL_MS = 150

    // Chrome mobile diagonal rubber-band fix
    // - Detects gesture direction early (within a small threshold)
    // - Locks to horizontal or vertical
    // - While horizontally locked, prevents vertical rubber-band at edges and
    //   manually drives horizontal scroll for smoothness (keeps momentum)
    useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return

        let startX = 0
        let startY = 0
        let lastX = 0
        let lastTime = 0
        let vx = 0 // px/ms
        let locked: 'h' | 'v' | null = null
        const lockThreshold = 10 // px movement before deciding
        const bias = 0.8 // horizontal bias to catch diagonal swipes
        let momentumId: number | null = null

        const stopMomentum = () => {
            if (momentumId != null) {
                cancelAnimationFrame(momentumId)
                momentumId = null
            }
        }

        const onTouchStart = (e: TouchEvent) => {
            stopMomentum()
            if (e.touches && e.touches.length === 1) {
                const t = e.touches[0]
                startX = lastX = t.clientX
                startY = t.clientY
                lastTime = performance.now()
                locked = null
            }
        }

        const onTouchMove = (e: TouchEvent) => {
            if (!e.touches || e.touches.length !== 1) return
            const t = e.touches[0]
            const now = performance.now()
            const dx = t.clientX - startX
            const dy = t.clientY - startY

            // Decide lock early
            if (!locked) {
                if (Math.hypot(dx, dy) < lockThreshold) return
                locked = Math.abs(dx) > Math.abs(dy) * bias ? 'h' : 'v'
                // If we lock horizontal, prevent default immediately to avoid vertical rubber-band taking over
                if (locked === 'h') e.preventDefault()
            }

            if (locked === 'h') {
                // Aggressive prevention to stop vertical mixing/bounce
                e.preventDefault()

                // Manual horizontal scroll with simple velocity capture for momentum
                const deltaX = lastX - t.clientX
                const dt = Math.max(1, now - lastTime)
                vx = deltaX / dt // px per ms
                el.scrollLeft += deltaX
                lastX = t.clientX
                lastTime = now
            } else {
                // Vertical lock: allow default; no manual scrolling
            }
        }

        const onTouchEnd = () => {
            if (locked === 'h' && Math.abs(vx) > 0.01) {
                // Apply simple momentum with friction
                const friction = 0.95
                const frame = () => {
                    // 16ms frame approximation
                    el.scrollLeft += vx * 16
                    vx *= friction
                    if (Math.abs(vx) > 0.01) {
                        momentumId = requestAnimationFrame(frame)
                    } else {
                        momentumId = null
                    }
                }
                momentumId = requestAnimationFrame(frame)
            }
            locked = null
        }

        // Non-passive start for immediate control; move must be non-passive to call preventDefault
        el.addEventListener('touchstart', onTouchStart as any, { passive: false, capture: true })
        el.addEventListener('touchmove', onTouchMove as any, { passive: false, capture: true })
        el.addEventListener('touchend', onTouchEnd as any, { passive: true })
        el.addEventListener('touchcancel', onTouchEnd as any, { passive: true })

        return () => {
            stopMomentum()
            el.removeEventListener('touchstart', onTouchStart as any, { capture: true } as any)
            el.removeEventListener('touchmove', onTouchMove as any, { capture: true } as any)
            el.removeEventListener('touchend', onTouchEnd as any)
            el.removeEventListener('touchcancel', onTouchEnd as any)
        }
    }, [])

    // Vertical scroll state + optional debug logging for Market Data table
    useEffect(() => {
        if (guestMode) {
            // In guest preview we intentionally lock vertical scrolling,
            // so we hide scroll hints to avoid confusing users.
            setCanScroll(false)
            setHasScrollableContent(false)
            setAtTop(true)
            setAtBottom(true)
            return
        }

        if (typeof window === 'undefined') return

        const el = scrollContainerRef.current
        if (!el) return

        const update = () => {
            const node = scrollContainerRef.current
            if (!node) return

            const scrollSize = node.scrollHeight
            const clientSize = node.clientHeight
            const scrollPos = node.scrollTop

            const can = scrollSize > clientSize + 1
            // Only consider it scrollable if there's at least 20px of scrollable content
            // This prevents showing scroll indicators when content fits perfectly
            // The arrow should only show when there's actually more rows than can fit
            const hasScroll = scrollSize > clientSize + 20
            const atStart = scrollPos <= 1
            const atEnd = scrollPos + clientSize >= scrollSize - 1

            setCanScroll(can)
            setHasScrollableContent(hasScroll)
            setAtTop(atStart)
            setAtBottom(atEnd)

            if (SCROLL_DEBUG_ENABLED && can) {
                // Helps debug "is this actually scrollable?" issues in the wild
                // without spamming production logs unless explicitly enabled.
                // eslint-disable-next-line no-console
                console.debug('[MarketTable] scroll state', {
                    canScroll: can,
                    atTop: atStart,
                    atBottom: atEnd,
                    scrollHeight: scrollSize,
                    clientHeight: clientSize,
                    scrollTop: scrollPos,
                })
            }
        }

        update()
        el.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)
        const id = window.setTimeout(update, 0)

        return () => {
            window.clearTimeout(id)
            el.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [guestMode, SCROLL_DEBUG_ENABLED])

    // Sync selectedSymbol with live data updates
    useEffect(() => {
        if (selectedSymbol) {
            const updatedSymbol = data.find(item => item.symbol === selectedSymbol.symbol)
            if (updatedSymbol) {
                setSelectedSymbol(updatedSymbol)
            }
        }
    }, [data, selectedSymbol?.symbol])

    const formatVolume = useMemo(() => (value: number) => {
        const abs = Math.abs(value)
        if (abs >= 1_000_000_000) {
            return `$${(value / 1_000_000_000).toFixed(2)}B`
        }
        if (abs >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(2)}M`
        }
        if (abs >= 1_000) {
            return `$${(value / 1_000).toFixed(2)}K`
        }
        return priceFormatter.format(value)
    }, [])

    const formatSymbol = (symbol: string) => symbol.replace(/USDT$/i, '')

    const formatPrice = (price: number) => {
        if (price >= 1) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(price)
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4,
            maximumFractionDigits: 6,
        }).format(price)
    }

    // Formatters for price: diff (no grouping) and display (with grouping)
    const formatPriceForDiff = (price: number, precision: number = 2) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
            useGrouping: false,
        }).format(price)
    }
    const formatPriceForDisplay = (price: number, precision: number = 2) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
            useGrouping: true,
        }).format(price)
    }

    const digitsOnly = (s: string) => s.replace(/\D+/g, '')

    // Map a number of trailing digits to a string index from the end, skipping non-digits
    const indexFromDigitsFromEnd = (formatted: string, digitsFromEnd: number): number => {
        let need = Math.max(1, digitsFromEnd)
        for (let i = formatted.length - 1; i >= 0; i--) {
            if (/\d/.test(formatted[i])) {
                need--
                if (need === 0) {
                    // index is char after this digit
                    return i
                }
            }
        }
        return 0
    }

    const findDigitsFromEnd = (prevDigits: string, currDigits: string) => {
        const maxLen = Math.max(prevDigits.length, currDigits.length)
        const padPrev = prevDigits.padStart(maxLen, '0')
        const padCurr = currDigits.padStart(maxLen, '0')
        let firstDiffer = -1
        for (let k = 0; k < maxLen; k++) {
            if (padPrev[k] !== padCurr[k]) {
                firstDiffer = k
                break
            }
        }
        if (firstDiffer === -1) return 1
        return Math.max(1, maxLen - firstDiffer)
    }

    const sortedData = useMemo(() => {
        return [...displayData].sort((a, b) => {
            let aValue: number, bValue: number

            switch (sortBy) {
                case 'symbol':
                    return sortOrder === 'asc'
                        ? formatSymbol(a.symbol).localeCompare(formatSymbol(b.symbol))
                        : formatSymbol(b.symbol).localeCompare(formatSymbol(a.symbol))
                case 'volume':
                    aValue = a.volume24h
                    bValue = b.volume24h
                    break
                case 'change':
                    aValue = a.change24h ?? a.volumeChange ?? 0
                    bValue = b.change24h ?? b.volumeChange ?? 0
                    break
                case 'price':
                    aValue = a.price
                    bValue = b.price
                    break
                case 'funding':
                    aValue = a.fundingRate ?? 0
                    bValue = b.fundingRate ?? 0
                    break
                case 'openInterest':
                    aValue = a.openInterest ?? 0
                    bValue = b.openInterest ?? 0
                    break
                default:
                    return 0
            }

            return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
        })
    }, [displayData, sortBy, sortOrder])

    // Warm CoinGecko project profiles in the background for the
    // most likely symbols to be clicked, so the detail drawer
    // feels instant even on first open.
    // Reduced from 24 to 5 to avoid rate limiting (CoinGecko free tier: 10-50 calls/minute)
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!sortedData.length) return

        const baseSymbols = Array.from(
            new Set(
                sortedData
                    .slice(0, 5) // Reduced to top 5 to avoid rate limits
                    .map((item) => formatSymbol(item.symbol).toUpperCase())
            )
        )

        // Stagger requests more aggressively to respect rate limits
        // Rate limiter handles timing, but we still stagger initial queueing
        baseSymbols.forEach((sym, index) => {
            window.setTimeout(() => {
                prefetchAssetProfile(sym)
            }, index * 1000) // 1 second between queue additions
        })
    }, [sortedData])

    const handleSort = (column: 'symbol' | 'volume' | 'change' | 'price' | 'funding' | 'openInterest') => {
        if (guestMode) return // Sorting locked in guest preview
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            return
        }

        setSortBy(column)
        if (column === 'symbol') {
            setSortOrder('asc')
        } else {
            setSortOrder('desc')
        }
    }

    const SortIcon = ({ column }: { column: typeof sortBy }) => {
        if (sortBy !== column) {
            return <ArrowUpDown className="h-3 w-3 opacity-40" />
        }
        // For symbol/ticker column, reverse the arrow direction
        // A-Z (asc) shows down arrow, Z-A (desc) shows up arrow
        if (column === 'symbol') {
            return sortOrder === 'asc' ?
                <ArrowDown className="h-3 w-3 text-brand-500" /> :
                <ArrowUp className="h-3 w-3 text-brand-500" />
        }
        // For numeric columns, normal direction
        return sortOrder === 'desc' ?
            <ArrowDown className="h-3 w-3 text-brand-500" /> :
            <ArrowUp className="h-3 w-3 text-brand-500" />
    }

    const getLastUpdateText = () => {
        if (!lastUpdate) return ''
        const seconds = Math.floor((Date.now() - lastUpdate) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        return `${hours}h ago`
    }

    const handleAddToWatchlist = async (e: React.MouseEvent, item: MarketData) => {
        e.stopPropagation()
        if (!session?.user) {
            toast.error('Please sign in to use watchlists')
            return
        }

        // Check if symbol is already in watchlist(s)
        const watchlistsForSymbol = getWatchlistsForSymbol(item.symbol)
        
        if (watchlistsForSymbol.length > 0) {
            // Symbol is already in one or more watchlists
            if (watchlistsForSymbol.length === 1) {
                // Only in one watchlist - remove directly
                // The removeSymbol mutation will invalidate queries automatically
                removeSymbol({ watchlistId: watchlistsForSymbol[0].watchlistId, symbol: item.symbol })
            } else {
                // In multiple watchlists - show dialog to choose which ones to remove from
                setSymbolToRemove(item.symbol)
                setWatchlistsForRemoval(watchlistsForSymbol.map(w => ({ id: w.watchlistId, name: w.watchlistName })))
                setRemoveDialogOpen(true)
            }
        } else {
            // Symbol is not in any watchlist - open selector to add it
            setSymbolToAdd(item.symbol)
            setWatchlistSelectorOpen(true)
        }
    }

    const handleRemovedFromWatchlists = () => {
        // Invalidate watchlist queries for all affected watchlists
        watchlistsForRemoval.forEach(w => {
            queryClient.invalidateQueries({ queryKey: ['watchlist-info', w.id] })
        })
        queryClient.invalidateQueries({ queryKey: ['watchlists'] })
        setSymbolToRemove(undefined)
        setWatchlistsForRemoval([])
    }

    const handleWatchlistSelected = async (watchlistId: string) => {
        if (symbolToAdd) {
            try {
                await addSymbol({ watchlistId, symbol: symbolToAdd })
                setWatchlistSelectorOpen(false)
                setSymbolToAdd(undefined)
            } catch (error) {
                // Error already handled by hook
            }
        }
    }

    const handleCreateAlert = (e: React.MouseEvent, item: MarketData) => {
        e.stopPropagation()
        if (onCreateAlert) {
            onCreateAlert(item.symbol)
        }
    }

    const tableContent = (
        <div className="relative">
            {/* Status Bar - Responsive Layout */}
            <div className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
                {/* Mobile Layout: Stacked */}
                <div className="flex flex-col gap-2 md:hidden">
                    {/* Row 1: Watchlist Filter (if signed in) */}
                    {session?.user && !guestMode && (
                <div className="flex items-center gap-2">
                            <WatchlistFilter
                                selectedWatchlistId={selectedWatchlistId}
                                onWatchlistChange={handleWatchlistFilterChange}
                                className="flex-1"
                            />
                        </div>
                    )}
                    
                    {/* Row 2: Connected Status + Export */}
                    <div className="flex items-center justify-between gap-2">
                    <Badge
                        variant="outline"
                            className={`text-xs font-mono-tabular shrink-0 ${isConnected
                                ? 'border-brand-500/30 text-brand-600 dark:text-brand-400'
                                : 'border-danger-500/30 text-danger-600 dark:text-danger-400'
                            }`}
                    >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-brand-500 animate-pulse-glow' : 'bg-danger-500'
                            }`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                        <WatchlistExportButton
                            data={sortedData}
                            userTier={userTier}
                            guestMode={guestMode}
                        />
                    </div>
                    
                    {/* Row 3: Tier Info */}
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                            {guestMode
                                ? 'Top 5 preview'
                                : selectedWatchlistId && watchlistInfo
                                    ? `${watchlistInfo.name || 'Watchlist'} (${watchlistInfo.items?.length || 0} ${watchlistInfo.items?.length === 1 ? 'symbol' : 'symbols'})`
                                    : userTier === 'free'
                                        ? 'Top 50 symbols (Free tier)'
                                        : `${sortedData.length} symbols`}
                        </span>
                    {guestMode && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Sorting locked
                        </Badge>
                    )}
                        {userTier !== 'free' && typeof openInterestAsOf === 'number' && openInterestAsOf > 0 && (
                            <span className="text-[11px] text-muted-foreground font-mono-tabular">
                                OI updated {(() => {
                                    const sec = Math.max(0, Math.floor((Date.now() - openInterestAsOf) / 1000))
                                    if (sec < 60) return `${sec}s ago`
                                    const min = Math.floor(sec / 60)
                                    if (min < 60) return `${min}m ago`
                                    const hr = Math.floor(min / 60)
                                    return `${hr}h ago`
                                })()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Desktop Layout: Single Row */}
                <div className="hidden md:flex items-center justify-between gap-3">
                    {/* Left Side: Connected Status + Watchlist Filter (swapped on desktop) */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge
                            variant="outline"
                            className={`text-xs font-mono-tabular shrink-0 ${isConnected
                                    ? 'border-brand-500/30 text-brand-600 dark:text-brand-400'
                                    : 'border-danger-500/30 text-danger-600 dark:text-danger-400'
                                }`}
                        >
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-brand-500 animate-pulse-glow' : 'bg-danger-500'
                                }`} />
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </Badge>
                        
                        {/* Watchlist Filter - only show if user is signed in */}
                        {session?.user && !guestMode && (
                            <WatchlistFilter
                                selectedWatchlistId={selectedWatchlistId}
                                onWatchlistChange={handleWatchlistFilterChange}
                            />
                        )}
                        
                        {guestMode && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1 shrink-0">
                                <Lock className="h-3 w-3" /> Sorting locked
                            </Badge>
                        )}
                        
                    {/* Free tier: omit "Updated ..." text (data is live). Pro/Elite: show OI as-of */}
                    {userTier !== 'free' && typeof openInterestAsOf === 'number' && openInterestAsOf > 0 && (
                            <span className="text-xs text-muted-foreground font-mono-tabular shrink-0">
                            OI updated {(() => {
                                const sec = Math.max(0, Math.floor((Date.now() - openInterestAsOf) / 1000))
                                if (sec < 60) return `${sec}s ago`
                                const min = Math.floor(sec / 60)
                                if (min < 60) return `${min}m ago`
                                const hr = Math.floor(min / 60)
                                return `${hr}h ago`
                            })()}
                        </span>
                    )}
                </div>
                    
                    {/* Right Side: Tier Info + Export */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {guestMode
                            ? 'Top 5 preview'
                            : selectedWatchlistId && watchlistInfo
                                ? `${watchlistInfo.name || 'Watchlist'} (${watchlistInfo.items?.length || 0} ${watchlistInfo.items?.length === 1 ? 'symbol' : 'symbols'})`
                                : userTier === 'free'
                                    ? 'Top 50 symbols (Free tier)'
                                    : `${sortedData.length} symbols`}
                    </span>
                    <WatchlistExportButton
                        data={sortedData}
                        userTier={userTier}
                        guestMode={guestMode}
                        watchlistName={selectedWatchlistId && watchlistInfo ? watchlistInfo.name : undefined}
                        watchlistSymbolCount={selectedWatchlistId && watchlistInfo ? watchlistInfo.items?.length : undefined}
                    />
                    </div>
                </div>
            </div>

            {/* Table with sticky header */}
            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    className={`max-h-[600px] vs-scroll ${guestMode ? 'overflow-y-hidden' : 'overflow-y-auto'} overflow-x-auto`}
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        // Prevent horizontal rubber-band overscroll; allow normal vertical behavior
                        overscrollBehaviorX: 'none',
                        // Allow scroll chaining to the page at top/bottom so the page can scroll
                        overscrollBehaviorY: 'auto',
                        // Ensure proper gesture handling on mobile while preserving momentum scroll
                        touchAction: 'pan-x pan-y pinch-zoom',
                    }}
                >
                    <table className="vs-market-table w-full min-w-[800px]">
                        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm shadow-sm">
                            <tr className="border-b border-border/50">
                                <th className="text-left p-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort('symbol')}
                                        disabled={guestMode}
                                        title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                        className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                    >
                                        <span className="mr-1.5">Ticker</span>
                                        {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                        <SortIcon column="symbol" />
                                    </Button>
                                </th>
                                <th className="text-right p-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort('price')}
                                        disabled={guestMode}
                                        title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                        className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                    >
                                        <span className="mr-1.5">Price</span>
                                        {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                        <SortIcon column="price" />
                                    </Button>
                                </th>
                                <th className="text-right p-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort('change')}
                                        disabled={guestMode}
                                        title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                        className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                    >
                                        <span className="mr-1.5">24h Change</span>
                                        {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                        <SortIcon column="change" />
                                    </Button>
                                </th>
                                <th className="text-right p-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort('funding')}
                                        disabled={guestMode}
                                        title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                        className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                    >
                                        <span className="mr-1.5">Funding Rate</span>
                                        {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                        <SortIcon column="funding" />
                                    </Button>
                                </th>
                                <th className="text-right p-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort('volume')}
                                        disabled={guestMode}
                                        title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                        className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                    >
                                        <span className="mr-1.5">24h Volume</span>
                                        {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                        <SortIcon column="volume" />
                                    </Button>
                                </th>
                                {userTier !== 'free' && (
                                    <th className="text-right p-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('openInterest')}
                                            disabled={guestMode}
                                            title={guestMode ? 'Sign in to enable sorting (Free tier unlocks sorting)' : undefined}
                                            className={`h-auto p-0 font-semibold transition-colors ${guestMode ? 'opacity-60 cursor-not-allowed' : 'hover:text-brand-500'}`}
                                        >
                                            <span className="mr-1.5">Open Interest</span>
                                            {guestMode && <Lock className="h-3 w-3 opacity-60 ml-1" />}
                                            <SortIcon column="openInterest" />
                                        </Button>
                                    </th>
                                )}
                                <th className="w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((item, index) => {
                                const fundingRate = item.fundingRate ?? 0
                                const exceedsThreshold = Math.abs(fundingRate) >= FUNDING_ALERT_THRESHOLD
                                const changeValue = item.change24h ?? item.volumeChange ?? 0
                                const isHovered = hoveredRow === item.symbol
                                // For neutral rows, we keep a subtle grey hover per cell.
                                // For funding-highlight rows, tinting is handled via global CSS on tr.funding-pos/.funding-neg.
                                const cellHoverBg = exceedsThreshold ? '' : ' group-hover/row:bg-muted/70'

                                const rowClasses = [
                                    'group/row border-b border-border/40 cursor-pointer relative'
                                ]
                                const isBlurred = guestMode && index >= guestVisibleRows
                                if (fundingRate >= FUNDING_ALERT_THRESHOLD) {
                                    // Make positive funding highlights more prominent with depth
                                    rowClasses.push(
                                        // Keep border/shadow for positive rows; color is applied via CSS on cells
                                        'funding-pos',
                                        'border-l-4 border-l-brand-500/70',
                                        'shadow-sm shadow-brand-500/10',
                                        'hover:shadow-md hover:shadow-brand-500/20',
                                        'hover:brightness-105 dark:hover:brightness-110'
                                    )
                                } else if (fundingRate <= -FUNDING_ALERT_THRESHOLD) {
                                    // Make negative funding highlights more prominent with depth
                                    rowClasses.push(
                                        // Keep border/shadow for negative rows; color is applied via CSS on cells
                                        'funding-neg',
                                        'border-l-4 border-l-danger-500/70',
                                        'shadow-sm shadow-danger-500/10',
                                        'hover:shadow-md hover:shadow-danger-500/20',
                                        'hover:brightness-105 dark:hover:brightness-110'
                                    )
                                } else {
                                    // Neutral funding rate rows – do not color the <tr>.
                                    // Hover background is applied to each <td> via group-hover to avoid paint conflicts.
                                }

                                const fundingClass = exceedsThreshold
                                    ? fundingRate > 0
                                        ? 'text-brand-600 dark:text-brand-400 font-semibold'
                                        : 'text-danger-600 dark:text-danger-400 font-semibold'
                                    : 'text-muted-foreground'

                                const changeClass = changeValue > 0
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : changeValue < 0
                                        ? 'text-danger-600 dark:text-danger-400'
                                        : 'text-muted-foreground'

                                return (
                                    <tr
                                        key={item.symbol}
                                        className={`${rowClasses.join(' ')} ${isBlurred ? 'pointer-events-none select-none filter blur-[2px] opacity-70' : ''}`}
                                        onMouseEnter={() => setHoveredRow(item.symbol)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                        onClick={() => setSelectedSymbol(item)}
                                    >
                                        <td className={`relative p-3 pl-4 font-semibold text-sm transition-colors duration-150${cellHoverBg}`}>
                                            {exceedsThreshold && (
                                                <span
                                                    className={`
                                                    pointer-events-none absolute left-0 top-1 bottom-1 w-1 rounded-full
                                                    ${fundingRate > 0 ? 'bg-brand-500/60' : 'bg-danger-500/60'}
                                                    shadow-[0_0_0_1px_rgba(0,0,0,0.04)]
                                                `}
                                                />
                                            )}
                                            {formatSymbol(item.symbol)}
                                        </td>
                                        <td className={`p-3 text-right font-mono-tabular text-sm transition-colors duration-150${cellHoverBg}`}>
                                            {(() => {
                                                const precision = item.precision ?? 2
                                                const formattedDisplay = formatPriceForDisplay(item.price, precision)
                                                if (!FLASH_ENABLED) {
                                                    // Simply render price
                                                    prevPriceRef.current.set(item.symbol, item.price)
                                                    return formattedDisplay
                                                }
                                                const now = Date.now()
                                                const prev = prevPriceRef.current.get(item.symbol)
                                                let wholeClass = ''
                                                let prefix = formattedDisplay
                                                let suffix = ''
                                                if (typeof prev === 'number' && prev !== item.price) {
                                                    const lastFlashTs = lastFlashTsRef.current.get(item.symbol) || 0
                                                    if (now - lastFlashTs > MIN_INTERVAL_MS) {
                                                        // Determine direction
                                                        const dir: 'up' | 'down' = item.price > prev ? 'up' : 'down'
                                                        // Compute changed suffix via left-diff on digits (formatting-independent)
                                                        const prevFormattedDiff = formatPriceForDiff(prev, precision)
                                                        const currFormattedDiff = formatPriceForDiff(item.price, precision)
                                                        const prevDigits = digitsOnly(prevFormattedDiff)
                                                        const currDigits = digitsOnly(currFormattedDiff)
                                                        const dfe = findDigitsFromEnd(prevDigits, currDigits)
                                                        const splitIdx = indexFromDigitsFromEnd(formattedDisplay, dfe)
                                                        const suffixIndex = Math.min(Math.max(splitIdx, 0), formattedDisplay.length - 1)
                                                        flashRef.current.set(item.symbol, {
                                                            dir,
                                                            wholeUntil: now + WHOLE_MS,
                                                            suffixUntil: now + SUFFIX_MS,
                                                            suffixIndex,
                                                        })
                                                        lastFlashTsRef.current.set(item.symbol, now)
                                                        lastDirRef.current.set(item.symbol, dir)
                                                        // Persist the suffix split so digits that changed remain colored even after animation ends
                                                        persistentRef.current.set(item.symbol, {
                                                            dir,
                                                            suffixIndex: Math.min(Math.max(suffixIndex, 1), formattedDisplay.length)
                                                        } as any)
                                                    }
                                                }
                                                prevPriceRef.current.set(item.symbol, item.price)
                                                const flash = flashRef.current.get(item.symbol)
                                                const lastDir = lastDirRef.current.get(item.symbol)
                                                const persistent = persistentRef.current.get(item.symbol)
                                                if (flash) {
                                                    wholeClass = now < flash.wholeUntil ? (flash.dir === 'up' ? 'price-text-flash-up' : 'price-text-flash-down') : ''
                                                    const idx = Math.min(Math.max(flash.suffixIndex, 0), formattedDisplay.length)
                                                    prefix = formattedDisplay.slice(0, idx)
                                                    suffix = formattedDisplay.slice(idx)
                                                } else {
                                                    // No active flash; keep at least the last digit colored using last direction
                                                    if (persistent) {
                                                        const idx = Math.min(Math.max(persistent.suffixIndex, 1), formattedDisplay.length)
                                                        prefix = formattedDisplay.slice(0, idx)
                                                        suffix = formattedDisplay.slice(idx)
                                                    } else if (lastDir) {
                                                        const idx = Math.max(formattedDisplay.length - 1, 0)
                                                        prefix = formattedDisplay.slice(0, idx)
                                                        suffix = formattedDisplay.slice(idx)
                                                    }
                                                }
                                                let suffixClass = ''
                                                if (flash && now < flash.suffixUntil) {
                                                    suffixClass = flash.dir === 'up' ? 'price-suffix-up' : 'price-suffix-down'
                                                } else if (persistent) {
                                                    suffixClass = persistent.dir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
                                                } else if (lastDir) {
                                                    // Persistent static color after animation ends
                                                    suffixClass = lastDir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
                                                }
                                                return (
                                                    <span className={`inline-block ${wholeClass}`}>
                                                        <span>{prefix}</span>
                                                        {suffix && <span className={suffixClass}>{suffix}</span>}
                                                    </span>
                                                )
                                            })()}
                                        </td>
                                        <td className={`p-3 text-right font-mono-tabular text-sm transition-colors duration-150${cellHoverBg}`}>
                                            <span className={changeClass}>
                                                {changeValue > 0 ? '+' : ''}{changeValue.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className={`p-3 text-right font-mono-tabular text-sm transition-colors duration-150${cellHoverBg}`}>
                                            <span className={fundingClass}>
                                                {fundingRate > 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%
                                            </span>
                                        </td>
                                        <td className={`p-3 text-right font-mono-tabular text-sm font-medium transition-colors duration-150${cellHoverBg}`}>
                                            {formatVolume(item.volume24h)}
                                        </td>
                                        {userTier !== 'free' && (
                                            <td className={`p-3 text-right font-mono-tabular text-sm text-muted-foreground transition-colors duration-150${cellHoverBg}`}>
                                                {formatVolume(item.openInterest ?? 0)}
                                            </td>
                                        )}
                                        <td className={`p-3 transition-colors duration-150${cellHoverBg}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Star icon: Always visible if in watchlist, otherwise hover-only on desktop */}
                                                {session?.user && !guestMode && (
                                                    <div className={`pointer-events-none ${
                                                        isSymbolInWatchlist(item.symbol)
                                                            ? 'opacity-100' // Always visible if in watchlist
                                                            : 'opacity-100 md:opacity-0 md:group-hover/row:opacity-100' // Hover-only on desktop if not in watchlist
                                                    } transition-opacity duration-150`}>
                                                <Button
                                                            className={`pointer-events-auto h-7 w-7 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 ${
                                                                isSymbolInWatchlist(item.symbol)
                                                                    ? 'text-brand-600 dark:text-brand-400'
                                                                    : ''
                                                            }`}
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => handleAddToWatchlist(e, item)}
                                                            title={
                                                                isSymbolInWatchlist(item.symbol)
                                                                    ? 'Remove from watchlist'
                                                                    : 'Add to watchlist'
                                                            }
                                                >
                                                            <Star
                                                                className={`h-3.5 w-3.5 ${
                                                                    isSymbolInWatchlist(item.symbol) ? 'fill-current' : ''
                                                                }`}
                                                            />
                                                </Button>
                                                    </div>
                                                )}
                                                {/* Bell icon: Always hover-only on desktop, always visible on mobile */}
                                                <div className="pointer-events-none opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity duration-150">
                                                <Button
                                                    className="pointer-events-auto h-7 w-7 hover:bg-sec-500/10 hover:text-sec-600 dark:hover:text-sec-400"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => handleCreateAlert(e, item)}
                                                    title="Create alert"
                                                >
                                                    <Bell className="h-3.5 w-3.5" />
                                                </Button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {selectedWatchlistId && displayData.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-sm">This watchlist is empty.</p>
                            <p className="text-xs mt-1">Add symbols from the market table to get started.</p>
                        </div>
                    )}
                </div>

                {/* Vertical scroll affordances, mirroring Volume Alerts behavior */}
                {canScroll && !atTop && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-background/95 via-background/60 to-transparent" />
                )}
                {canScroll && !atBottom && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
                )}

                {/* Only show scroll indicator arrow when:
                    1. There's actually scrollable content (content height > container height by at least 20px)
                    2. User is not at the bottom (there's more content below)
                    3. There's data to display */}
                {hasScrollableContent && !atBottom && sortedData.length > 0 && (
                    <div className="pointer-events-none absolute bottom-2 right-3 z-10 flex items-center justify-center rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm">
                        <ArrowDown className="h-3 w-3" />
                    </div>
                )}
            </div>

            {/* Guest overlays anchored to wrapper (not affected by horizontal scroll) */}
            {guestMode && (
                <>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
                    <div className="absolute inset-x-0 bottom-3 flex items-center justify-center z-20">
                        <GuestCTA size="sm" />
                    </div>
                </>
            )}

            {/* Detail Drawer */}
            <Sheet open={!!selectedSymbol} onOpenChange={(open) => !open && setSelectedSymbol(null)}>
                <SheetContent className="w-full sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50">
                    {selectedSymbol && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-3">
                                    <span className="text-2xl font-bold">
                                        {formatSymbol(selectedSymbol.symbol)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                        USDT Perpetual
                                    </Badge>
                                </SheetTitle>
                                <SheetDescription>
                                    Binance Futures Market Details
                                </SheetDescription>
                            </SheetHeader>

                            <div className="mt-6 space-y-6">
                                {/* Price Section */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Price</h3>
                                    <div className="text-3xl font-bold font-mono-tabular">
                                        {(() => {
                                            const precision = selectedSymbol.precision ?? 2
                                            const formattedDisplay = formatPriceForDisplay(selectedSymbol.price, precision)
                                            if (!FLASH_ENABLED) {
                                                // Simply render price
                                                prevPriceRef.current.set(selectedSymbol.symbol, selectedSymbol.price)
                                                return formattedDisplay
                                            }
                                            const now = Date.now()
                                            const prev = prevPriceRef.current.get(selectedSymbol.symbol)
                                            let wholeClass = ''
                                            let prefix = formattedDisplay
                                            let suffix = ''
                                            if (typeof prev === 'number' && prev !== selectedSymbol.price) {
                                                const lastFlashTs = lastFlashTsRef.current.get(selectedSymbol.symbol) || 0
                                                if (now - lastFlashTs > MIN_INTERVAL_MS) {
                                                    // Determine direction
                                                    const dir: 'up' | 'down' = selectedSymbol.price > prev ? 'up' : 'down'
                                                    // Compute changed suffix via left-diff on digits (formatting-independent)
                                                    const prevFormattedDiff = formatPriceForDiff(prev, precision)
                                                    const currFormattedDiff = formatPriceForDiff(selectedSymbol.price, precision)
                                                    const prevDigits = digitsOnly(prevFormattedDiff)
                                                    const currDigits = digitsOnly(currFormattedDiff)
                                                    const dfe = findDigitsFromEnd(prevDigits, currDigits)
                                                    const splitIdx = indexFromDigitsFromEnd(formattedDisplay, dfe)
                                                    const suffixIndex = Math.min(Math.max(splitIdx, 0), formattedDisplay.length - 1)
                                                    flashRef.current.set(selectedSymbol.symbol, {
                                                        dir,
                                                        wholeUntil: now + WHOLE_MS,
                                                        suffixUntil: now + SUFFIX_MS,
                                                        suffixIndex,
                                                    })
                                                    lastFlashTsRef.current.set(selectedSymbol.symbol, now)
                                                    lastDirRef.current.set(selectedSymbol.symbol, dir)
                                                    // Persist the suffix split so digits that changed remain colored even after animation ends
                                                    persistentRef.current.set(selectedSymbol.symbol, {
                                                        dir,
                                                        suffixIndex: Math.min(Math.max(suffixIndex, 1), formattedDisplay.length)
                                                    } as any)
                                                }
                                            }
                                            prevPriceRef.current.set(selectedSymbol.symbol, selectedSymbol.price)
                                            const flash = flashRef.current.get(selectedSymbol.symbol)
                                            const lastDir = lastDirRef.current.get(selectedSymbol.symbol)
                                            const persistent = persistentRef.current.get(selectedSymbol.symbol)
                                            if (flash) {
                                                wholeClass = now < flash.wholeUntil ? (flash.dir === 'up' ? 'price-text-flash-up' : 'price-text-flash-down') : ''
                                                const idx = Math.min(Math.max(flash.suffixIndex, 0), formattedDisplay.length)
                                                prefix = formattedDisplay.slice(0, idx)
                                                suffix = formattedDisplay.slice(idx)
                                            } else {
                                                // No active flash; keep at least the last digit colored using last direction
                                                if (persistent) {
                                                    const idx = Math.min(Math.max(persistent.suffixIndex, 1), formattedDisplay.length)
                                                    prefix = formattedDisplay.slice(0, idx)
                                                    suffix = formattedDisplay.slice(idx)
                                                } else if (lastDir) {
                                                    const idx = Math.max(formattedDisplay.length - 1, 0)
                                                    prefix = formattedDisplay.slice(0, idx)
                                                    suffix = formattedDisplay.slice(idx)
                                                }
                                            }
                                            let suffixClass = ''
                                            if (flash && now < flash.suffixUntil) {
                                                suffixClass = flash.dir === 'up' ? 'price-suffix-up' : 'price-suffix-down'
                                            } else if (persistent) {
                                                suffixClass = persistent.dir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
                                            } else if (lastDir) {
                                                // Persistent static color after animation ends
                                                suffixClass = lastDir === 'up' ? 'price-suffix-up-static' : 'price-suffix-down-static'
                                            }
                                            return (
                                                <span className={`inline-block ${wholeClass}`}>
                                                    <span>{prefix}</span>
                                                    {suffix && <span className={suffixClass}>{suffix}</span>}
                                                </span>
                                            )
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className={`h-4 w-4 ${(selectedSymbol.change24h ?? 0) > 0 ? 'text-brand-500' : 'text-danger-500'
                                            }`} />
                                        <span className={`font-mono-tabular text-sm font-semibold ${(selectedSymbol.change24h ?? 0) > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-danger-600 dark:text-danger-400'
                                            }`}>
                                            {(selectedSymbol.change24h ?? 0) > 0 ? '+' : ''}{(selectedSymbol.change24h ?? 0).toFixed(2)}% (24h)
                                        </span>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
                                        <div className="font-mono-tabular font-semibold">{formatVolume(selectedSymbol.volume24h)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">Funding Rate</div>
                                        <div className={`font-mono-tabular font-semibold ${selectedSymbol.fundingRate > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-danger-600 dark:text-danger-400'
                                            }`}>
                                            {selectedSymbol.fundingRate > 0 ? '+' : ''}{(selectedSymbol.fundingRate * 100).toFixed(4)}%
                                        </div>
                                    </div>
                                    {userTier !== 'free' && (
                                        <div className="col-span-2">
                                            <div className="text-xs text-muted-foreground mb-1">Open Interest</div>
                                            <div className="font-mono-tabular font-semibold">{formatVolume(selectedSymbol.openInterest ?? 0)}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Project Overview */}
                                <AssetProjectOverview
                                    baseSymbol={formatSymbol(selectedSymbol.symbol)}
                                />

                                {/* Actions */}
                                <div className="space-y-2">
                                    {session?.user && !guestMode && (
                                    <Button
                                            className={`w-full ${
                                                isSymbolInWatchlist(selectedSymbol.symbol)
                                                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                                    : 'bg-brand-600 hover:bg-brand-700 text-white'
                                            }`}
                                        onClick={(e) => handleAddToWatchlist(e, selectedSymbol)}
                                    >
                                            <Star
                                                className={`h-4 w-4 mr-2 ${
                                                    isSymbolInWatchlist(selectedSymbol.symbol) ? 'fill-current' : ''
                                                }`}
                                            />
                                            {isSymbolInWatchlist(selectedSymbol.symbol)
                                                ? 'Manage in Watchlist'
                                                : 'Add to Watchlist'}
                                    </Button>
                                    )}
                                    <Button
                                        className="w-full bg-sec-600 hover:bg-sec-700 text-white"
                                        onClick={() => {
                                            if (onCreateAlert) {
                                                onCreateAlert(selectedSymbol.symbol)
                                                setSelectedSymbol(null)
                                            }
                                        }}
                                    >
                                        <Bell className="h-4 w-4 mr-2" />
                                        Create Alert
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => window.open(`https://www.binance.com/en/futures/${formatSymbol(selectedSymbol.symbol)}USDT`, '_blank')}
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View on Binance
                                    </Button>
                                </div>

                                {/* Info Note */}
                                <div className="flex items-start gap-2 p-3 bg-muted/20 rounded-lg border border-border/30 text-xs text-muted-foreground">
                                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <p>
                                        Data updates in real-time for Elite tier, every 5 minutes for Pro, and every 15 minutes for Free tier.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* Watchlist Selector Dialog */}
            {session?.user && !guestMode && (
                <>
                    <WatchlistSelector
                        open={watchlistSelectorOpen}
                        onOpenChange={setWatchlistSelectorOpen}
                        symbol={symbolToAdd}
                        onWatchlistSelected={handleWatchlistSelected}
                    />
                    <RemoveFromWatchlistDialog
                        open={removeDialogOpen}
                        onOpenChange={setRemoveDialogOpen}
                        symbol={symbolToRemove || ''}
                        watchlists={watchlistsForRemoval}
                        onRemoved={handleRemovedFromWatchlists}
                    />
                </>
            )}
        </div>
    )

    if (!withContainer) {
        return tableContent
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>Market Data</CardTitle>
            </CardHeader>
            <CardContent className="p-0">{tableContent}</CardContent>
        </Card>
    )
}
