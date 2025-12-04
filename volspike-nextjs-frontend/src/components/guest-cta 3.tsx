'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface GuestCTAProps {
  className?: string
  size?: 'sm' | 'md'
}

// A compact, theme-consistent CTA cluster used in guest preview overlays.
// Primary: Start Free (brand→secondary gradient). Secondary: Get Pro (secondary solid).
export function GuestCTA({ className = '', size = 'sm' }: GuestCTAProps) {
  const padding = size === 'sm' ? 'p-2' : 'p-3'
  const gap = size === 'sm' ? 'gap-2' : 'gap-3'
  const btnSize = size === 'sm' ? 'default' : 'lg'

  return (
    <div
      className={`pointer-events-auto inline-flex ${gap} rounded-2xl border border-border/60 bg-background/90 backdrop-blur-md shadow-md ring-1 ring-border/30 ${padding} ${className}`}
    >
      <Link href="/auth?tab=signup" className="inline-flex">
        <Button
          size={btnSize as any}
          className="bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-brand/20"
        >
          Start Free
        </Button>
      </Link>
      <Link href="/pricing" className="inline-flex">
        <Button
          size={btnSize as any}
          className="bg-sec-600 hover:bg-sec-700 text-white"
        >
          Get Pro
        </Button>
      </Link>
    </div>
  )
}

