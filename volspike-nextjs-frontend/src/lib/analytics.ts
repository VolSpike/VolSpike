/**
 * Analytics Utility - Comprehensive tracking for user growth, visits, and registrations
 * 
 * This module provides:
 * - Google Analytics 4 (GA4) integration
 * - Custom event tracking
 * - User registration tracking
 * - Page view tracking
 * - Conversion tracking
 */

// Google Analytics 4 Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''

// Check if analytics should be enabled (disable in development unless explicitly enabled)
const isAnalyticsEnabled = () => {
  if (typeof window === 'undefined') return false

  const hasMeasurementId = GA_MEASUREMENT_ID !== ''
  const isProduction = process.env.NODE_ENV === 'production'
  const isExplicitlyEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('[Analytics Debug]', {
      hasMeasurementId,
      measurementId: GA_MEASUREMENT_ID || 'NOT SET',
      isProduction,
      isExplicitlyEnabled,
      nodeEnv: process.env.NODE_ENV,
      enabled: hasMeasurementId && (isProduction || isExplicitlyEnabled)
    })
  }

  return hasMeasurementId && (isProduction || isExplicitlyEnabled)
}

// Initialize Google Analytics 4
export const initGA = () => {
  if (!isAnalyticsEnabled()) {
    console.log('[Analytics] GA4 disabled (no measurement ID or not in production)')
    return
  }

  if (typeof window === 'undefined') return

  console.log('[Analytics] Initializing GA4 with ID:', GA_MEASUREMENT_ID)

  // Initialize dataLayer FIRST (required by Google Analytics)
  window.dataLayer = window.dataLayer || []

  // Define gtag function that queues commands to dataLayer
  function gtag(...args: any[]) {
    window.dataLayer.push(arguments)
  }

  // Store gtag function globally so Google's script can find it
  ; (window as any).gtag = gtag

  // Queue initial commands (will be processed when Google's script loads)
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
    send_page_view: true,
    debug_mode: true,
  })

  console.log('[Analytics] dataLayer initialized with', window.dataLayer.length, 'queued events')

  // Load Google's gtag script - it will replace our gtag function and process the queue
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  script.onload = () => {
    console.log('[Analytics] ✓ Google gtag.js loaded - tracking is now active')
    console.log('[Analytics] ✓ Check Network tab for requests to google-analytics.com/g/collect')
  }
  script.onerror = (error) => {
    console.error('[Analytics] ✗ Failed to load gtag script:', error)
  }
  document.head.appendChild(script)

  console.log('[Analytics] GA4 initialization started')
}

// Track page views
export const trackPageView = (url: string, title?: string) => {
  if (!isAnalyticsEnabled()) {
    console.log('[Analytics] Page view tracking disabled')
    return
  }

  if (typeof window === 'undefined') return

  const gtag = (window as any).gtag
  if (gtag) {
    console.log('[Analytics] Tracking page view:', url, title || document.title)
    gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title || document.title,
    })
    // Also send as event for better tracking
    gtag('event', 'page_view', {
      page_path: url,
      page_title: title || document.title,
    })
  } else {
    console.warn('[Analytics] gtag function not available')
  }
}

// Track custom events
export const trackEvent = (
  eventName: string,
  eventParams?: {
    [key: string]: string | number | boolean | undefined | any
  }
) => {
  if (!isAnalyticsEnabled()) return

  if (typeof window === 'undefined') return

  const gtag = (window as any).gtag
  if (gtag) {
    gtag('event', eventName, {
      ...eventParams,
      timestamp: new Date().toISOString(),
    })
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics Event]', eventName, eventParams)
  }
}

// Track user registration
export const trackRegistration = (method: 'email' | 'oauth' | 'wallet', tier: 'free' | 'pro' | 'elite' = 'free') => {
  trackEvent('sign_up', {
    method,
    tier,
    registration_type: method,
  })

  // Also track as conversion
  trackEvent('conversion', {
    conversion_type: 'registration',
    method,
    tier,
  })
}

// Track user login
export const trackLogin = (method: 'email' | 'oauth' | 'wallet') => {
  trackEvent('login', {
    method,
  })
}

// Track subscription upgrade
export const trackSubscriptionUpgrade = (fromTier: string, toTier: string, amount?: number) => {
  trackEvent('purchase', {
    currency: 'USD',
    value: amount || 0,
    items: [
      {
        item_id: toTier,
        item_name: `${toTier} Subscription`,
        item_category: 'subscription',
        price: amount || 0,
        quantity: 1,
      },
    ],
  })

  trackEvent('subscription_upgrade', {
    from_tier: fromTier,
    to_tier: toTier,
    amount: amount || 0,
  })
}

// Track email verification
export const trackEmailVerification = () => {
  trackEvent('email_verification', {
    verification_status: 'completed',
  })
}

// Track page engagement (time on page, scroll depth, etc.)
export const trackPageEngagement = (engagementTime: number, scrollDepth?: number) => {
  trackEvent('page_engagement', {
    engagement_time_msec: engagementTime,
    scroll_depth: scrollDepth,
  })
}

// Track button clicks
export const trackButtonClick = (buttonName: string, location?: string) => {
  trackEvent('button_click', {
    button_name: buttonName,
    location: location || window.location.pathname,
  })
}

// Track form submissions
export const trackFormSubmission = (formName: string, success: boolean) => {
  trackEvent('form_submission', {
    form_name: formName,
    success,
  })
}

// Track search queries
export const trackSearch = (searchTerm: string, resultsCount?: number) => {
  trackEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount,
  })
}

// Track feature usage
export const trackFeatureUsage = (featureName: string, tier?: string) => {
  trackEvent('feature_usage', {
    feature_name: featureName,
    user_tier: tier,
  })
}

// Set user properties (call after login)
export const setUserProperties = (userId: string, properties?: { tier?: string; email?: string }) => {
  if (!isAnalyticsEnabled()) return

  if (typeof window === 'undefined') return

  const gtag = (window as any).gtag
  if (gtag) {
    gtag('set', 'user_properties', {
      user_id: userId,
      ...properties,
    })
  }
}

// Declare global types for TypeScript
declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
  }
}

