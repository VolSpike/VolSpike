import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { BarChart3, ExternalLink, Globe } from 'lucide-react'
import { useAssetProfile } from '@/hooks/use-asset-profile'

interface AssetProjectOverviewProps {
    baseSymbol: string
}

export function AssetProjectOverview({ baseSymbol }: AssetProjectOverviewProps) {
    const { profile, loading } = useAssetProfile(baseSymbol)
    const [logoFailed, setLogoFailed] = useState(false)
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        // Reset logo error state when switching to a different asset
        setLogoFailed(false)
        setExpanded(false)
    }, [baseSymbol])

    const tradingViewUrl = useMemo(() => {
        const upper = baseSymbol.toUpperCase()
        return `https://www.tradingview.com/chart/?symbol=BINANCE:${upper}USDT.P`
    }, [baseSymbol])

    const tradingViewMobileUrl = useMemo(() => {
        const upper = baseSymbol.toUpperCase()
        const symbol = `BINANCE:${upper}USDT.P`
        // Universal Link format for mobile apps - this ensures the symbol is passed correctly
        return `https://www.tradingview.com/chart/${encodeURIComponent(symbol)}/`
    }, [baseSymbol])

    const tradingViewDesktopUrl = useMemo(() => {
        const upper = baseSymbol.toUpperCase()
        // TradingView desktop app URL scheme (Windows only - macOS doesn't support symbol deep links)
        return `tradingview://chart?symbol=BINANCE:${upper}USDT.P`
    }, [baseSymbol])

    const handleTradingViewClick = (e: React.MouseEvent) => {
        e.preventDefault()

        // Detect platform
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
        const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua)
        const isWindows = /Windows|Win32|Win64/.test(ua)
        const isIOS = /iPhone|iPad|iPod/.test(ua)
        const isAndroid = /Android/.test(ua)
        const isMobile = isIOS || isAndroid

        if (isMobile) {
            // Mobile: Use Universal Link which will open in app if installed
            // Universal Links work better than custom URL schemes on mobile
            window.location.href = tradingViewMobileUrl
        } else if (isMac) {
            // macOS: TradingView Desktop doesn't support symbol deep links
            // Just open in browser - user can manually use "Open link from clipboard" if they want Desktop
            window.open(tradingViewUrl, '_blank', 'noopener,noreferrer')
        } else if (isWindows) {
            // Windows: Try desktop app first, fallback to browser
            const wasFocused = document.hasFocus()

            // Try to open desktop app using window.location
            try {
                window.location.href = tradingViewDesktopUrl
            } catch (err) {
                // Fallback to anchor method if window.location fails
                const desktopLink = document.createElement('a')
                desktopLink.href = tradingViewDesktopUrl
                desktopLink.style.display = 'none'
                document.body.appendChild(desktopLink)
                desktopLink.click()
                document.body.removeChild(desktopLink)
            }

            // Check if desktop app opened (page loses focus) or fallback to browser
            setTimeout(() => {
                // If page is still focused, desktop app likely didn't open, so open browser
                if (document.hasFocus() && wasFocused) {
                    window.open(tradingViewUrl, '_blank', 'noopener,noreferrer')
                }
            }, 500)
        } else {
            // Other platforms (Linux, etc.): Just open in browser
            window.open(tradingViewUrl, '_blank', 'noopener,noreferrer')
        }
    }

    const displayName = profile?.name || baseSymbol.toUpperCase()
    const description = profile?.description ?? ''

    return (
        <section className="rounded-xl border border-border/50 bg-gradient-to-br from-background/80 via-background/60 to-background/30 shadow-sm">
            <div className="flex items-start gap-3 p-4 pb-3">
                <div className="relative h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center overflow-hidden ring-1 ring-brand-500/30 shadow-md shadow-brand-500/10">
                    {profile?.logoUrl && !logoFailed ? (
                        <Image
                            src={profile.logoUrl}
                            alt={`${displayName} logo`}
                            fill
                            sizes="40px"
                            className="object-contain p-1"
                            onError={() => setLogoFailed(true)}
                        />
                    ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                            {baseSymbol.slice(0, 3).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                            Project Overview
                        </h3>
                    </div>
                    <p className="mt-1 text-base font-semibold text-foreground truncate">
                        {displayName}
                    </p>
                </div>
            </div>

            <div className="px-4 pb-3">
                {loading && !profile && (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-2.5 w-3/4 rounded-full bg-muted/50" />
                        <div className="h-2.5 w-11/12 rounded-full bg-muted/40" />
                        <div className="h-2.5 w-2/3 rounded-full bg-muted/30" />
                    </div>
                )}
                {!loading && description && (
                    <>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {expanded || description.length <= 320
                                ? description
                                : `${description.slice(0, 320).replace(/\s+\S*$/, '')}…`}
                        </p>
                        {description.length > 320 && (
                            <button
                                type="button"
                                onClick={() => setExpanded((v) => !v)}
                                className="mt-1 text-[11px] font-medium text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline"
                            >
                                {expanded ? 'Show less' : 'Read full overview'}
                            </button>
                        )}
                    </>
                )}
                {!loading && !description && (
                    <p className="text-xs leading-relaxed text-muted-foreground/80 italic">
                        No description available on CoinGecko for this asset.
                    </p>
                )}
            </div>

            <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2">
                {profile?.websiteUrl && (
                    <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-border/60 bg-background/60 hover:bg-brand-500/10"
                    >
                        <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                            <span className="inline-flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Website</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                            </span>
                        </a>
                    </Button>
                )}

                {profile?.twitterUrl && (
                    <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-border/60 bg-background/60 hover:bg-sec-500/10"
                    >
                        <a href={profile.twitterUrl} target="_blank" rel="noreferrer">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-3.5 w-3.5 flex items-center justify-center text-xs font-bold">𝕏</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                            </span>
                        </a>
                    </Button>
                )}

                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full border-border/60 bg-background/60 hover:bg-elite-500/10"
                    onClick={handleTradingViewClick}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">TradingView Perp</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                    </span>
                </Button>

                <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <span className="inline-flex h-4 items-center rounded-full bg-muted/40 px-2">
                        Powered by CoinGecko
                    </span>
                </div>
            </div>
        </section>
    )
}
