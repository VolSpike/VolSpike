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

  // Suppress non-critical errors (Analytics SDK, CORS image loading, etc.)
  useEffect(() => {
    const originalError = console.error
    const originalWarn = console.warn
    
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
    
    // Suppress expected CORS errors from crypto logo CDNs (handled gracefully with fallbacks)
    const warnHandler = (...args: any[]) => {
      const message = args.join(' ')
      // Suppress CORS errors from crypto logo CDNs - these are expected and handled with fallbacks
      if (message.includes('CORS policy') && 
          (message.includes('assets.coingecko.com') ||
           message.includes('cryptologos.cc') ||
           message.includes('cryptoicons.org') ||
           message.includes('spothq/cryptocurrency-icons'))) {
        // Silently ignore - CryptoLogo component handles these with fallback gradient initials
        return
      }
      // Suppress network errors for crypto logo CDNs (403, 404, etc.) - handled gracefully
      if ((message.includes('403') || message.includes('404') || message.includes('ERR_FAILED')) &&
          (message.includes('assets.coingecko.com') ||
           message.includes('cryptologos.cc') ||
           message.includes('cryptoicons.org') ||
           message.includes('spothq/cryptocurrency-icons'))) {
        // Silently ignore - CryptoLogo component handles these with fallback gradient initials
        return
      }
      originalWarn.apply(console, args)
    }
    
    console.error = errorHandler
    console.warn = warnHandler
    
    return () => {
      console.error = originalError
      console.warn = originalWarn
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

