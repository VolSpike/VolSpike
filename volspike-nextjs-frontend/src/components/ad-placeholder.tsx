'use client'

import { ExternalLink, Sparkles, X } from 'lucide-react'
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
        <div className="absolute inset-0 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30" />
        
        <div className="relative p-6 flex items-center justify-between gap-6">
          {/* Left: Ad content */}
          <div className="flex-1 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/20">
                Advertisement
              </Badge>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm text-foreground">
                  Your Ad Could Be Here
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Support VolSpike by viewing ads or upgrade to Pro for an ad-free experience
              </p>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/pricing">
              <Button 
                size="sm" 
                className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Upgrade to Pro
              </Button>
            </Link>
            
            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-muted/50 transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Subtle animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </Card>
    )
  }

  // Vertical variant (for sidebar placement if needed)
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/20 to-muted/30" />
      
      <div className="relative p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs bg-muted/50 border-muted-foreground/20">
            Advertisement
          </Badge>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
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
              className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Go Pro
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

