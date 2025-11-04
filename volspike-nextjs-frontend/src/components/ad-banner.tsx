'use client'

import { ArrowRight, Zap, Mail, Clock, TrendingUp, Download, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface AdBannerProps {
    userTier?: string
    className?: string
}

export function AdBanner({ userTier = 'free', className }: AdBannerProps) {
    const router = useRouter()

    // Only show for free tier users
    if (userTier !== 'free') {
        return null
    }

    const handleUpgrade = () => {
        router.push('/pricing')
    }

    return (
        <Card
            className={cn(
                'relative overflow-hidden border-l-4 border-l-brand-500 dark:border-l-brand-400 shadow-md',
                'bg-card hover:shadow-brand-lg transition-all duration-300',
                'before:absolute before:inset-0 before:bg-gradient-to-r before:from-brand-500/8 before:via-brand-500/4 before:to-transparent before:pointer-events-none dark:before:from-brand-400/12 dark:before:via-brand-400/6',
                'after:absolute after:inset-0 after:bg-gradient-to-br after:from-transparent after:via-transparent after:to-sec-500/5 after:pointer-events-none',
                'group',
                className
            )}
        >
            {/* Animated shimmer effect on border */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-brand-400 to-transparent opacity-50 animate-pulse-glow" />

            <CardContent className="p-5 md:p-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    <div className="flex items-start gap-4 flex-1">
                        {/* Icon - Lightning Bolt (Brand Icon) with pulse */}
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
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '100ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <Clock className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">5-min updates</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '150ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <Zap className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">100 symbols</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '200ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">50 alerts</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '250ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <Mail className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">Email alerts</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '300ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <Download className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">CSV/JSON export</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground animate-fade-in" style={{ animationDelay: '350ms' }}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-400/20 transition-colors group-hover:bg-brand-500/20 flex-shrink-0">
                                        <RefreshCw className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="font-medium text-xs sm:text-sm">Manual refresh</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button with hover effects */}
                    <div className="flex-shrink-0 w-full lg:w-auto">
                        <Button
                            onClick={handleUpgrade}
                            size="default"
                            className="w-full lg:w-auto min-w-[160px] font-semibold shadow-brand hover:shadow-brand-lg transition-all duration-300 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 dark:from-brand-500 dark:to-brand-400 dark:hover:from-brand-600 dark:hover:to-brand-500 text-white group relative overflow-hidden"
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <span className="relative z-10 flex items-center">
                                Upgrade to Pro
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
