'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initGA, trackPageView } from '@/lib/analytics'

/**
 * Analytics Provider Component
 * 
 * Handles:
 * - Google Analytics 4 initialization
 * - Automatic page view tracking
 * - Route change tracking
 */
export function AnalyticsProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize GA4 on mount
  useEffect(() => {
    initGA()
  }, [])

  // Track page views on route changes
  useEffect(() => {
    if (!pathname) return

    // Build full URL with search params
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname

    // Small delay to ensure page title is updated
    setTimeout(() => {
      trackPageView(url, document.title)
    }, 100)
  }, [pathname, searchParams])

  return null
}

