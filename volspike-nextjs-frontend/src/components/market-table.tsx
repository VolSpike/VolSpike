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
}

interface MarketTableProps {
    data: MarketData[]
    userTier?: 'free' | 'pro' | 'elite'
    withContainer?: boolean
    lastUpdate?: number
    isConnected?: boolean
    onCreateAlert?: (symbol: string) => void
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
    onCreateAlert 
}: MarketTableProps) {
    const [sortBy, setSortBy] = useState<'symbol' | 'volume' | 'change' | 'price' | 'funding' | 'openInterest'>('volume')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [hoveredRow, setHoveredRow] = useState<string | null>(null)
    const [selectedSymbol, setSelectedSymbol] = useState<MarketData | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Improved scroll handling: prevent horizontal overscroll while allowing vertical scroll chaining
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        let touchStartX = 0
        let touchStartY = 0
        let touchStartScrollLeft = 0
        let isHorizontalScroll: boolean | null = null

        // Use requestAnimationFrame for smooth scroll clamping
        let rafId: number | null = null

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX
            touchStartY = e.touches[0].clientY
            touchStartScrollLeft = container.scrollLeft
            isHorizontalScroll = null // Reset direction detection
        }

        const handleTouchMove = (e: TouchEvent) => {
            const touchX = e.touches[0].clientX
            const touchY = e.touches[0].clientY
            const deltaX = touchStartX - touchX
            const deltaY = touchStartY - touchY

            // Determine scroll direction on first significant move
            if (isHorizontalScroll === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY)
            }

            // Only handle horizontal scrolling - prevent overscroll at boundaries only
            if (isHorizontalScroll === true) {
                const newScrollLeft = touchStartScrollLeft + deltaX
                const maxScrollLeft = container.scrollWidth - container.clientWidth

                // Only prevent default when trying to scroll beyond boundaries
                // This allows normal horizontal scrolling within bounds
                if (newScrollLeft < 0 || newScrollLeft > maxScrollLeft) {
                    e.preventDefault()
                    // Clamp the scroll position smoothly
                    container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft))
                }
                // If within bounds, let native scrolling handle it (don't prevent default)
            }
            // For vertical scrolling or undetermined direction, let it bubble up naturally for scroll chaining
        }

        const handleTouchEnd = () => {
            isHorizontalScroll = null
        }

        // Clamp horizontal scroll using requestAnimationFrame for smooth performance
        const preventHorizontalBounce = () => {
            if (rafId) cancelAnimationFrame(rafId)
            
            rafId = requestAnimationFrame(() => {
                const maxScrollLeft = container.scrollWidth - container.clientWidth
                
                // Only intervene if we detect bounce behavior
                if (container.scrollLeft < 0) {
                    container.scrollLeft = 0
                } else if (container.scrollLeft > maxScrollLeft) {
                    container.scrollLeft = maxScrollLeft
                }
            })
        }

        // Use passive listeners except for touchmove (needs preventDefault for horizontal boundaries)
        container.addEventListener('touchstart', handleTouchStart, { passive: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: false })
        container.addEventListener('touchend', handleTouchEnd, { passive: true })
        container.addEventListener('scroll', preventHorizontalBounce, { passive: true })
        
        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
            container.removeEventListener('scroll', preventHorizontalBounce)
            if (rafId) cancelAnimationFrame(rafId)
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
                    {lastUpdate && (
                        <span className="text-xs text-muted-foreground font-mono-tabular">
                            Updated {getLastUpdateText()}
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
                className="relative max-h-[600px] overflow-y-auto overflow-x-auto touch-pan-y" 
                style={{ 
                    overscrollBehaviorX: 'none',
                    overscrollBehaviorY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x pan-y pinch-zoom',
                    scrollBehavior: 'smooth',
                }}
            >
                <table className="w-full min-w-[800px]">
                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm shadow-sm">
                        <tr className="border-b border-border/50">
                            <th className="text-left p-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('symbol')}
                                    className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                                    className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                                    className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                                    className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                                    className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                                        className="h-auto p-0 font-semibold hover:text-brand-500 transition-colors"
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
                        {sortedData.map((item) => {
                            const fundingRate = item.fundingRate ?? 0
                            const exceedsThreshold = Math.abs(fundingRate) >= FUNDING_ALERT_THRESHOLD
                            const changeValue = item.change24h ?? item.volumeChange ?? 0
                            const isHovered = hoveredRow === item.symbol

            const rowClasses = [
                'border-b border-border/40 transition-all duration-200 cursor-pointer group relative',
                'hover:brightness-105 dark:hover:brightness-110' // Subtle glow instead of scale
            ]
            if (fundingRate >= FUNDING_ALERT_THRESHOLD) {
                // Make positive funding highlights more prominent with depth
                rowClasses.push(
                    'bg-gradient-to-r from-brand-500/12 via-brand-500/8 to-transparent',
                    'hover:from-brand-500/20 hover:via-brand-500/15 hover:to-brand-500/5',
                    'border-l-4 border-l-brand-500/70',
                    'shadow-sm shadow-brand-500/10',
                    'hover:shadow-md hover:shadow-brand-500/20'
                )
            } else if (fundingRate <= -FUNDING_ALERT_THRESHOLD) {
                // Make negative funding highlights more prominent with depth
                rowClasses.push(
                    'bg-gradient-to-r from-danger-500/12 via-danger-500/8 to-transparent',
                    'hover:from-danger-500/20 hover:via-danger-500/15 hover:to-danger-500/5',
                    'border-l-4 border-l-danger-500/70',
                    'shadow-sm shadow-danger-500/10',
                    'hover:shadow-md hover:shadow-danger-500/20'
                )
            } else {
                rowClasses.push(
                    'hover:bg-gradient-to-r hover:from-muted/60 hover:via-muted/40 hover:to-transparent',
                    'hover:shadow-sm'
                )
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
                                    className={rowClasses.join(' ')}
                                    onMouseEnter={() => setHoveredRow(item.symbol)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    onClick={() => setSelectedSymbol(item)}
                                >
                                    <td className="p-3 font-semibold text-sm">
                                        {formatSymbol(item.symbol)}
                                    </td>
                                    <td className="p-3 text-right font-mono-tabular text-sm">
                                        {formatPrice(item.price)}
                                    </td>
                                    <td className="p-3 text-right font-mono-tabular text-sm">
                                        <span className={changeClass}>
                                            {changeValue > 0 ? '+' : ''}{changeValue.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono-tabular text-sm">
                                        <span className={fundingClass}>
                                            {fundingRate > 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono-tabular text-sm font-medium">
                                        {formatVolume(item.volume24h)}
                                    </td>
                                    {userTier !== 'free' && (
                                        <td className="p-3 text-right font-mono-tabular text-sm text-muted-foreground">
                                            {formatVolume(item.openInterest ?? 0)}
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <div className={`flex items-center justify-end gap-1 transition-opacity duration-150 ${
                                            isHovered ? 'opacity-100' : 'opacity-0'
                                        }`}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400"
                                                onClick={(e) => handleAddToWatchlist(e, item)}
                                                title="Add to watchlist"
                                            >
                                                <Star className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-sec-500/10 hover:text-sec-600 dark:hover:text-sec-400"
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
