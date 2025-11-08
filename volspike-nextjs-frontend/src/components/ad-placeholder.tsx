'use client'

import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'

interface AdPlaceholderProps {
  variant?: 'horizontal' | 'vertical'
  className?: string
}

export function AdPlaceholder({ variant = 'horizontal', className = '' }: AdPlaceholderProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  if (variant === 'horizontal') {
    return (
      <Card className={`relative group overflow-hidden ${className}`}>
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 pointer-events-none" />
        
        {/* Dismiss button - Absolute positioned for consistent placement */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 z-20 p-2 rounded-md hover:bg-muted border border-muted-foreground/40 hover:border-muted-foreground/70 transition-all duration-200 hover:shadow-sm active:scale-95"
          title="Dismiss ad"
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>

        <div className="relative p-4 sm:p-6 z-10">
          {/* Mobile: Stack vertically, Desktop: Horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            
            {/* Left: Ad content */}
            <div className="flex-1 space-y-3">
              {/* Badge */}
              <div>
                <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/20">
                  Advertisement
                </Badge>
              </div>
              
              {/* Title and description */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">
                    Your Ad Could Be Here
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Support VolSpike by viewing ads or upgrade to Pro for an ad-free experience
                </p>
              </div>
            </div>

            {/* Right: CTA - Full width on mobile, auto on desktop */}
            <div className="flex sm:flex-shrink-0 sm:pr-10">
              <Link href="/pricing" className="w-full sm:w-auto">
                <Button 
                  size="default" 
                  className="w-full sm:min-w-[160px] font-semibold shadow-brand hover:shadow-brand-lg transition-all duration-300 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 dark:from-brand-500 dark:to-brand-400 dark:hover:from-brand-600 dark:hover:to-brand-500 text-white group relative overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <span className="relative z-10 flex items-center justify-center">
                    Upgrade to Pro
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Subtle animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </Card>
    )
  }

  // Vertical variant (for sidebar placement if needed)
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/20 to-muted/30 pointer-events-none" />
      
      <div className="relative p-4 space-y-3 z-10">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/20">
            Advertisement
          </Badge>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-md hover:bg-muted border border-muted-foreground/40 hover:border-muted-foreground/70 transition-all duration-200 hover:shadow-sm active:scale-95"
            title="Dismiss ad"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>

        <div className="aspect-square bg-muted/30 rounded-lg border border-border/50 flex items-center justify-center">
          <div className="text-center space-y-2 px-4">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-xs font-medium text-foreground">
              Ad Space
            </p>
            <p className="text-xs text-muted-foreground">
              300x250
            </p>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Upgrade to Pro to remove ads
          </p>
          <Link href="/pricing">
            <Button 
              size="sm" 
              className="w-full font-semibold shadow-brand hover:shadow-brand-lg transition-all duration-300 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 dark:from-brand-500 dark:to-brand-400 dark:hover:from-brand-600 dark:hover:to-brand-500 text-white group relative overflow-hidden text-xs"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="relative z-10 flex items-center justify-center">
                Go Pro
                <ArrowRight className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

