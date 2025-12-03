'use client'

import { Lock } from 'lucide-react'
import Link from 'next/link'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface OITeaserCellProps {
    /** Approximate OI value for visual teaser (not real data) */
    volume24h: number
    className?: string
}

/**
 * OI Teaser Cell - Shows a blurred/faded placeholder for Free tier users
 * with a beautiful tooltip prompting upgrade to Pro.
 *
 * Design principles:
 * - Shows "data" structure without real values (teaser effect)
 * - Elegant blur/fade with lock icon overlay
 * - Tooltip with gradient accent and clear upgrade CTA
 * - Matches VolSpike's Pro tier cyan color theme
 */
export function OITeaserCell({ volume24h, className = '' }: OITeaserCellProps) {
    // Generate a plausible-looking fake OI value based on volume
    // This creates visual interest without revealing real data
    const fakeOI = generatePlaceholderOI(volume24h)

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`relative cursor-help group ${className}`}>
                        {/* Blurred placeholder value */}
                        <span className="oi-teaser-value font-mono-tabular text-sm select-none">
                            {fakeOI}
                        </span>

                        {/* Lock overlay that appears on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="bg-background/80 backdrop-blur-[2px] rounded px-1.5 py-0.5 flex items-center gap-1 border border-sec-500/30 shadow-sm">
                                <Lock className="h-3 w-3 text-sec-500" />
                                <span className="text-[10px] font-medium text-sec-500">Pro</span>
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="oi-teaser-tooltip max-w-[220px] p-0 overflow-hidden"
                    sideOffset={8}
                >
                    <div className="oi-teaser-tooltip-gradient h-1 w-full" />
                    <div className="px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sec-500/15">
                                <Lock className="h-3 w-3 text-sec-500" />
                            </div>
                            <span className="font-semibold text-sm">Open Interest</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Track real-time Open Interest data to spot institutional positioning and market sentiment shifts.
                        </p>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-sec-500 hover:text-sec-400 transition-colors"
                        >
                            Upgrade to Pro
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/**
 * Generates a placeholder OI value that looks realistic
 * Based on volume to maintain visual consistency
 */
function generatePlaceholderOI(volume24h: number): string {
    // OI is typically 20-60% of 24h volume for liquid pairs
    const multiplier = 0.3 + (Math.random() * 0.3) // 30-60%
    const fakeValue = volume24h * multiplier

    const abs = Math.abs(fakeValue)
    if (abs >= 1_000_000_000) {
        return `$${(fakeValue / 1_000_000_000).toFixed(2)}B`
    }
    if (abs >= 1_000_000) {
        return `$${(fakeValue / 1_000_000).toFixed(2)}M`
    }
    if (abs >= 1_000) {
        return `$${(fakeValue / 1_000).toFixed(2)}K`
    }
    return `$${fakeValue.toFixed(2)}`
}

/**
 * OI Teaser Header - Shows a locked header for Free tier users
 */
export function OITeaserHeader() {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help opacity-60">
                        <span>Open Interest</span>
                        <Lock className="h-3 w-3 text-sec-500" />
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="bottom"
                    className="oi-teaser-tooltip max-w-[220px] p-0 overflow-hidden"
                    sideOffset={8}
                >
                    <div className="oi-teaser-tooltip-gradient h-1 w-full" />
                    <div className="px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sec-500/15">
                                <Lock className="h-3 w-3 text-sec-500" />
                            </div>
                            <span className="font-semibold text-sm">Pro Feature</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Open Interest data shows total outstanding contracts, helping identify accumulation and distribution phases.
                        </p>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-sec-500 hover:text-sec-400 transition-colors"
                        >
                            Unlock with Pro
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
