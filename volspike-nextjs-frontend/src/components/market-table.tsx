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
    Info
} from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { WatchlistExportButton } from '@/components/watchlist-export-button'

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
}: MarketTableProps) {
    const [sortBy, setSortBy] = useState<'symbol' | 'volume' | 'change' | 'price' | 'funding' | 'openInterest'>('volume')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [hoveredRow, setHoveredRow] = useState<string | null>(null)
    const [selectedSymbol, setSelectedSymbol] = useState<MarketData | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const prevPriceRef = useRef<Map<string, number>>(new Map())
    const flashRef = useRef<Map<string, { dir: 'up' | 'down', wholeUntil: number, suffixUntil: number, suffixIndex: number }>>(new Map())
    const lastFlashTsRef = useRef<Map<string, number>>(new Map())
    const lastDirRef = useRef<Map<string, 'up' | 'down'>>(new Map())
    const persistentRef = useRef<Map<string, { dir: 'up' | 'down', suffixIndex: number }>>(new Map())
    const FLASH_ENABLED = (process.env.NEXT_PUBLIC_PRICE_FLASH ?? '').toString().toLowerCase() === 'true' || process.env.NEXT_PUBLIC_PRICE_FLASH === '1'
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
        return [...data].sort((a, b) => {
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
    }, [data, sortBy, sortOrder])

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

    const handleAddToWatchlist = (e: React.MouseEvent, item: MarketData) => {
        e.stopPropagation()
        // TODO: Implement watchlist functionality
        console.log('Add to watchlist:', formatSymbol(item.symbol))
    }

    const handleCreateAlert = (e: React.MouseEvent, item: MarketData) => {
        e.stopPropagation()
        if (onCreateAlert) {
            onCreateAlert(item.symbol)
        }
    }

    const tableContent = (
        <div className="relative">
            {/* Status Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-2">
                    <Badge 
                        variant="outline" 
                        className={`text-xs font-mono-tabular ${
                            isConnected 
                                ? 'border-brand-500/30 text-brand-600 dark:text-brand-400' 
                                : 'border-danger-500/30 text-danger-600 dark:text-danger-400'
                        }`}
                    >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            isConnected ? 'bg-brand-500 animate-pulse-glow' : 'bg-danger-500'
                        }`} />
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                    {/* Free tier: omit "Updated ..." text (data is live). Pro/Elite: show OI as-of */}
                    {userTier !== 'free' && typeof openInterestAsOf === 'number' && openInterestAsOf > 0 && (
                        <span className="text-xs text-muted-foreground font-mono-tabular">
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
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {sortedData.length} symbols
                    </span>
                    <WatchlistExportButton 
                        data={sortedData}
                        userTier={userTier}
                    />
                </div>
            </div>

            {/* Table with sticky header */}
            <div 
                ref={scrollContainerRef}
                className={`relative max-h-[600px] ${guestMode ? 'overflow-y-hidden' : 'overflow-y-auto'} overflow-x-auto`} 
                style={{ 
                    WebkitOverflowScrolling: 'touch',
                    // Prevent horizontal rubber-band overscroll; allow normal vertical behavior
                    overscrollBehaviorX: 'none',
                    // Allow scroll chaining to the page at top/bottom so the page can scroll
                    overscrollBehaviorY: guestMode ? 'contain' as any : 'auto',
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
                                        <div className="pointer-events-none opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 flex items-center justify-end gap-1">
                                            <Button
                                                className="pointer-events-auto h-7 w-7 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400"
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleAddToWatchlist(e, item)}
                                                title="Add to watchlist"
                                            >
                                                <Star className="h-3.5 w-3.5" />
                                            </Button>
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
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {guestMode && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />
                )}

                {guestMode && (
                    <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                        <div className="pointer-events-auto inline-flex gap-2 bg-background/90 backdrop-blur-md border border-border/60 rounded-lg p-2 shadow-md">
                            <a href="/auth?tab=signup" className="px-3 py-2 text-xs rounded-md bg-brand-600 text-white hover:bg-brand-700">Start Free</a>
                            <a href="/pricing" className="px-3 py-2 text-xs rounded-md bg-sec-600 text-white hover:bg-sec-700">Get Pro</a>
                        </div>
                    </div>
                )}
            </div>

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
                                        {formatPrice(selectedSymbol.price)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className={`h-4 w-4 ${
                                            (selectedSymbol.change24h ?? 0) > 0 ? 'text-brand-500' : 'text-danger-500'
                                        }`} />
                                        <span className={`font-mono-tabular text-sm font-semibold ${
                                            (selectedSymbol.change24h ?? 0) > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-danger-600 dark:text-danger-400'
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
                                        <div className={`font-mono-tabular font-semibold ${
                                            selectedSymbol.fundingRate > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-danger-600 dark:text-danger-400'
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

                                {/* Actions */}
                                <div className="space-y-2">
                                    <Button 
                                        className="w-full bg-brand-600 hover:bg-brand-700 text-white"
                                        onClick={(e) => handleAddToWatchlist(e, selectedSymbol)}
                                    >
                                        <Star className="h-4 w-4 mr-2" />
                                        Add to Watchlist
                                    </Button>
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
