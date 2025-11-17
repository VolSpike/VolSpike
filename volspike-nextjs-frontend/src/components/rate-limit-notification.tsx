'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, X, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { coingeckoRateLimiter } from '@/lib/coingecko-rate-limiter'
import { cn } from '@/lib/utils'

/**
 * Rate Limit Notification Component
 * 
 * Displays a beautiful, non-intrusive notification when CoinGecko API
 * rate limits are detected. Auto-dismisses when rate limit clears.
 */
export function RateLimitNotification() {
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // In production we keep this notification disabled by default because
    // CoinGecko rate limits are transient and showing them globally is
    // distracting for users. Developers can opt‑in via query param or
    // localStorage flag when debugging.
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search)
      const debugOptIn =
        search.get('debugCoingecko') === 'true' ||
        window.localStorage.getItem('volspike:debug:coingecko') === 'true'

      if (process.env.NODE_ENV !== 'production' || debugOptIn) {
        setEnabled(true)
      }
    }

    const updateStatus = () => {
      const status = coingeckoRateLimiter.getStatus()
      const now = Date.now()
      
      if (status.rateLimitedUntil > now) {
        setIsRateLimited(true)
        const secondsRemaining = Math.ceil((status.rateLimitedUntil - now) / 1000)
        setRetryAfter(secondsRemaining)
      } else {
        setIsRateLimited(false)
        setRetryAfter(null)
      }
    }

    // Subscribe to rate limit changes
    const unsubscribe = coingeckoRateLimiter.subscribe(updateStatus)

    // Initial check
    updateStatus()

    // Also check periodically for countdown updates
    const interval = setInterval(updateStatus, 1000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  if (!enabled || !isRateLimited) return null

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  return (
    <Alert 
      className={cn(
        'fixed top-20 right-4 z-50 max-w-md shadow-lg border-2',
        'border-yellow-500/50 bg-yellow-500/10 backdrop-blur-sm',
        'animate-in slide-in-from-top-2 duration-300'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-1 rounded bg-yellow-500/20 flex-shrink-0 mt-0.5">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-yellow-700 dark:text-yellow-300 font-semibold text-sm mb-1">
            API Rate Limit
          </AlertTitle>
          <AlertDescription className="text-yellow-600 dark:text-yellow-400 text-xs leading-relaxed">
            CoinGecko API requests are temporarily rate-limited to prevent overuse.
            {retryAfter !== null && (
              <span className="block mt-1 font-medium">
                Retry in: {formatTime(retryAfter)}
              </span>
            )}
            <span className="block mt-1 opacity-80">
              Asset profiles will load automatically once the limit clears.
            </span>
          </AlertDescription>
        </div>
        <button
          onClick={() => setIsRateLimited(false)}
          className="flex-shrink-0 p-1 rounded hover:bg-yellow-500/20 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </button>
      </div>
    </Alert>
  )
}
