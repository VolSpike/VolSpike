'use client'

import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OITeaserCellProps {
    /** Symbol used as seed for deterministic placeholder value */
    symbol: string
    className?: string
}

/**
 * OI Teaser Cell - Shows a blurred/faded placeholder for Free tier users.
 *
 * Design principles:
 * - Shows static "data" structure without real values (teaser effect)
 * - Placeholder value is deterministic based on symbol (no random changes)
 * - Simple blur/fade effect, no hover overlays
 * - Tooltip only on header, not individual cells
 */
export function OITeaserCell({ symbol, className = '' }: OITeaserCellProps) {
    // Generate a deterministic placeholder value based on symbol
    // This ensures the value never changes for the same symbol
    const fakeOI = useMemo(() => generatePlaceholderOI(symbol), [symbol])

    return (
        <span className={`oi-teaser-value font-mono-tabular text-sm select-none text-muted-foreground ${className}`}>
            {fakeOI}
        </span>
    )
}

/**
 * Generates a deterministic placeholder OI value based on symbol.
 * Uses a simple hash to ensure consistent output for the same symbol.
 */
function generatePlaceholderOI(symbol: string): string {
    // Create a simple deterministic hash from symbol
    let hash = 0
    for (let i = 0; i < symbol.length; i++) {
        const char = symbol.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }

    // Use hash to generate a consistent multiplier between 0.3 and 0.6
    const normalizedHash = Math.abs(hash) / 2147483647 // Normalize to 0-1
    const multiplier = 0.3 + (normalizedHash * 0.3)

    // Base value varies by symbol "size" (BTC, ETH get bigger values)
    const baseValues: Record<string, number> = {
        'BTCUSDT': 45_000_000_000,
        'ETHUSDT': 20_000_000_000,
        'SOLUSDT': 3_500_000_000,
        'BNBUSDT': 1_200_000_000,
        'XRPUSDT': 1_800_000_000,
        'DOGEUSDT': 800_000_000,
    }

    const baseValue = baseValues[symbol.toUpperCase()] || (500_000_000 + (normalizedHash * 2_000_000_000))
    const fakeValue = baseValue * multiplier

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
 * OI Teaser Header - Shows header with lock icon and tooltip for Free tier users.
 * Uses Button component to match exact styling of other column headers.
 * Desktop: Hover shows tooltip
 * Mobile: Tap opens dialog
 */
export function OITeaserHeader() {
    const [dialogOpen, setDialogOpen] = useState(false)

    const handleClick = () => {
        // Open dialog on click (both desktop and mobile)
        setDialogOpen(true)
    }

    const content = (
        <>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sec-500/15">
                    <Lock className="h-3 w-3 text-sec-500" />
                </div>
                <span className="font-semibold text-sm">Pro Feature</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Open Interest data shows total outstanding contracts, helping identify accumulation and distribution phases.
            </p>
            <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sec-500 hover:text-sec-400 transition-colors"
                onClick={() => setDialogOpen(false)}
            >
                Unlock with Pro
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </Link>
        </>
    )

    return (
        <>
            <TooltipProvider delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 font-semibold cursor-help"
                            onClick={handleClick}
                        >
                            <span className="mr-1.5">Open Interest</span>
                            <Lock className="h-3 w-3 text-sec-500" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        className="oi-teaser-tooltip max-w-[220px] p-0 overflow-hidden"
                        sideOffset={8}
                    >
                        <div className="oi-teaser-tooltip-gradient h-1 w-full" />
                        <div className="px-3 py-2.5">
                            {content}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Mobile dialog - shown on tap */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[280px] rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-sec-500" />
                            Open Interest
                        </DialogTitle>
                    </DialogHeader>
                    <div className="pt-2">
                        {content}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
