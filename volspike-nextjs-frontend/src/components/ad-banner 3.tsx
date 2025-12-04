'use client'

import { ArrowRight, Zap, Mail, Clock, TrendingUp, Download, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

interface AdBannerProps {
    userTier?: string
    className?: string
}

const proFeatures = [
    { icon: Clock, label: '5-min updates', tooltip: '5-minute refresh rate' },
    { icon: Zap, label: '100 symbols', tooltip: '100 symbols by volume' },
    { icon: TrendingUp, label: '50 alerts', tooltip: '50 volume spike alerts' },
    { icon: Mail, label: 'Email alerts', tooltip: 'Email notifications' },
    { icon: Download, label: 'CSV/JSON export', tooltip: 'Data export' },
    { icon: RefreshCw, label: 'Manual refresh', tooltip: 'Manual refresh control' },
]

export function AdBanner({ userTier = 'free', className }: AdBannerProps) {
    const router = useRouter()
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [scrollState, setScrollState] = useState({ atStart: true, atEnd: false })
    const [showScrollHint, setShowScrollHint] = useState(true)

    const handleUpgrade = () => {
        router.push('/pricing')
    }

    // Track scroll position for fade gradients
    useEffect(() => {
        // Only set up scroll tracking for free tier users
        if (userTier !== 'free') return

        const container = scrollContainerRef.current
        if (!container) return

        const checkScrollPosition = () => {
            const { scrollLeft, scrollWidth, clientWidth } = container
            const atStart = scrollLeft < 5
            const atEnd = scrollLeft + clientWidth >= scrollWidth - 5
            
            setScrollState({ atStart, atEnd })
            
            // Hide scroll hint after first scroll
            if (scrollLeft > 0) {
                setShowScrollHint(false)
            }
        }

        // Check on mount and after resize
        checkScrollPosition()
        container.addEventListener('scroll', checkScrollPosition, { passive: true })
        
        // Check on resize
        const resizeObserver = new ResizeObserver(checkScrollPosition)
        resizeObserver.observe(container)

        // Hide scroll hint after 3 seconds
        const hintTimer = setTimeout(() => setShowScrollHint(false), 3000)

        return () => {
            container.removeEventListener('scroll', checkScrollPosition)
            resizeObserver.disconnect()
            clearTimeout(hintTimer)
        }
    }, [userTier])

    // Only show for free tier users
    if (userTier !== 'free') {
        return null
    }

    return (
        <Card
            className={cn(
                'relative overflow-hidden border-l-4 border-l-brand-500 dark:border-l-brand-400 shadow-md w-full',
                'bg-card hover:shadow-brand-lg transition-all duration-300',
                'before:absolute before:inset-0 before:bg-gradient-to-r before:from-brand-500/8 before:via-brand-500/4 before:to-transparent before:pointer-events-none dark:before:from-brand-400/12 dark:before:via-brand-400/6',
                'after:absolute after:inset-0 after:bg-gradient-to-br after:from-transparent after:via-transparent after:to-sec-500/5 after:pointer-events-none',
                'animate-fade-in',
                'group',
                className
            )}
        >
            {/* Animated shimmer effect on border */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-brand-400 to-transparent opacity-50 animate-pulse-glow" />

            {/* Desktop Wide (lg+): Full Banner */}
            <CardContent className="hidden lg:block p-5 md:p-6 relative z-10">
                <div className="flex flex-row items-center justify-between gap-5">
                    <div className="flex items-start gap-4 flex-1">
                        {/* Icon - Lightning Bolt */}
                        <div className="flex-shrink-0">
                            <div className="relative w-12 h-12 rounded-lg bg-brand-500/10 dark:bg-brand-400/20 flex items-center justify-center border border-brand-500/20 dark:border-brand-400/30 group-hover:border-brand-500/40 transition-colors">
                                <div className="absolute inset-0 bg-brand-500/10 rounded-lg animate-pulse-glow" />
                                <Zap className="h-6 w-6 text-brand-600 dark:text-brand-400 fill-brand-600 dark:fill-brand-400 relative z-10 transition-transform group-hover:scale-110" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="text-lg font-semibold text-foreground">
                                    Unlock Pro Features
                                </h3>
                                <Badge
                                    variant="outline"
                                    className="bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 border-brand-600/30 dark:border-brand-400/30 font-semibold animate-pulse-glow"
                                >
                                    $9/month
                                </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Upgrade to Pro and unlock 3x faster updates, 2x more symbols, 5x more alerts, email notifications, data export capabilities, and more.
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                                {proFeatures.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                            <feature.icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                        </div>
                                        <span className="font-medium text-xs sm:text-sm">{feature.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <div className="flex-shrink-0">
                        <Button
                            onClick={handleUpgrade}
                            size="default"
                            className="min-w-[160px] font-semibold shadow-brand hover:shadow-brand-lg transition-all duration-300 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 dark:from-brand-500 dark:to-brand-400 dark:hover:from-brand-600 dark:hover:to-brand-500 text-white group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <span className="relative z-10 flex items-center">
                                Upgrade to Pro
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        </Button>
                    </div>
                </div>
            </CardContent>

            {/* Mobile & Desktop Narrow: Compact Icon-Only Banner */}
            <CardContent className="lg:hidden p-2.5 md:p-3 relative z-10">
                <div className="flex items-center justify-between gap-2 md:gap-3">
                    {/* Left: Title + Price */}
                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-shrink-0">
                        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-brand-500/10 dark:bg-brand-400/20 flex items-center justify-center border border-brand-500/20 dark:border-brand-400/30">
                            <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-brand-600 dark:text-brand-400 fill-brand-600 dark:fill-brand-400" />
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">
                                    Pro Features
                                </h3>
                                <Badge
                                    variant="outline"
                                    className="bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 border-brand-600/30 dark:border-brand-400/30 text-[10px] md:text-xs font-semibold px-1 md:px-1.5 py-0"
                                >
                                    $9/mo
                                </Badge>
                            </div>
                        </div>
                        <div className="sm:hidden">
                            <Badge
                                variant="outline"
                                className="bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 border-brand-600/30 dark:border-brand-400/30 text-[10px] font-semibold px-1 py-0"
                            >
                                $9/mo
                            </Badge>
                        </div>
                    </div>

                    {/* Center: Feature Icons Row with Scroll Indicators */}
                    <div className="flex items-center flex-1 justify-center min-w-0 relative">
                        {/* Left Fade Gradient - Shows when not at start */}
                        {!scrollState.atStart && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 w-10 md:w-14 z-20 pointer-events-none transition-opacity duration-300"
                                style={{
                                    background: 'linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card)) 50%, transparent 100%)',
                                }}
                            />
                        )}
                        
                        {/* Right Fade Gradient - Shows when not at end */}
                        {!scrollState.atEnd && (
                            <div 
                                className="absolute right-0 top-0 bottom-0 w-10 md:w-14 z-20 pointer-events-none transition-opacity duration-300"
                                style={{
                                    background: 'linear-gradient(to left, hsl(var(--card)) 0%, hsl(var(--card)) 50%, transparent 100%)',
                                }}
                            />
                        )}

                        {/* Scroll Hint Arrow - Shows briefly on mount */}
                        {showScrollHint && scrollState.atEnd === false && (
                            <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-bounce-subtle">
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-brand-500/25 dark:bg-brand-400/35 backdrop-blur-sm flex items-center justify-center border border-brand-500/50 dark:border-brand-400/60 shadow-lg shadow-brand-500/20 dark:shadow-brand-400/20">
                                    <ArrowRight className="h-3 w-3 md:h-3.5 md:w-3.5 text-brand-600 dark:text-brand-400" />
                                </div>
                            </div>
                        )}

                        {/* Scrollable Icons Container */}
                        <div 
                            ref={scrollContainerRef}
                            className="flex items-center gap-1.5 md:gap-2 flex-1 justify-center overflow-x-auto scrollbar-hide px-2 min-w-0 scroll-smooth"
                        >
                            {proFeatures.map((feature, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "flex-shrink-0 flex flex-col items-center group/icon transition-transform duration-300",
                                        showScrollHint && idx === proFeatures.length - 1 && "animate-pulse-subtle"
                                    )}
                                    title={feature.tooltip}
                                >
                                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-brand-500/10 dark:bg-brand-400/20 flex items-center justify-center border border-brand-500/20 dark:border-brand-400/30 transition-all group-hover/icon:bg-brand-500/20 group-hover/icon:border-brand-500/40 group-hover/icon:scale-110">
                                        <feature.icon className="h-4 w-4 md:h-5 md:w-5 text-brand-600 dark:text-brand-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Compact CTA Button */}
                    <div className="flex-shrink-0">
                        <Button
                            onClick={handleUpgrade}
                            size="sm"
                            className="h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm font-semibold shadow-brand hover:shadow-brand-lg transition-all duration-300 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 dark:from-brand-500 dark:to-brand-400 dark:hover:from-brand-600 dark:hover:to-brand-500 text-white whitespace-nowrap"
                        >
                            Upgrade
                            <ArrowRight className="ml-1.5 h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
