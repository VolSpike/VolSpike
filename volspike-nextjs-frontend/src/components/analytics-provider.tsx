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

  // Suppress non-critical analytics errors (Coinbase, browser extensions, etc.)
  useEffect(() => {
    const originalError = console.error
    
    // Suppress Analytics SDK errors from third-party services
    const errorHandler = (...args: any[]) => {
      const message = args.join(' ')
      // Suppress Coinbase Analytics SDK errors (non-critical - from browser extensions)
      if (message.includes('Analytics SDK') || 
          message.includes('cca-lite.coinbase.com') ||
          (message.includes('Failed to fetch') && message.includes('coinbase'))) {
        // Silently ignore - these are from browser extensions or third-party scripts
        return
      }
      originalError.apply(console, args)
    }
    
    console.error = errorHandler
    
    return () => {
      console.error = originalError
    }
  }, [])

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

