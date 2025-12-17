# Analytics & Tracking

## Overview

VolSpike uses Google Analytics 4 (GA4) for user behavior tracking, conversion measurement, and business intelligence.

---

## Google Analytics 4 Integration

**Files:**
- `volspike-nextjs-frontend/src/lib/analytics.ts` - Core analytics functions
- `volspike-nextjs-frontend/src/components/analytics-provider.tsx` - Page view tracking

### Environment Variable

```bash
# In .env.local (frontend)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Enabling Analytics

Analytics is **only enabled** when:
1. `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set
2. AND either:
   - `NODE_ENV === 'production'`
   - OR `NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'`

In development, analytics is disabled by default to avoid polluting production data.

---

## Implementation

### Initialization

The `AnalyticsProvider` component initializes GA4 on app mount:

```typescript
// components/analytics-provider.tsx
export function AnalyticsProvider() {
    useEffect(() => {
        initGA()  // Loads gtag.js and configures GA4
    }, [])

    // Track page views on route changes
    useEffect(() => {
        trackPageView(url, document.title)
    }, [pathname, searchParams])

    return null
}
```

This component is included in the root layout (`app/layout.tsx`).

### Core Functions

```typescript
// lib/analytics.ts

// Initialize Google Analytics
initGA(): void

// Track page views (automatic via AnalyticsProvider)
trackPageView(url: string, title?: string): void

// Track custom events
trackEvent(eventName: string, eventParams?: object): void

// Track user registration
trackRegistration(method: 'email' | 'oauth' | 'wallet', tier?: string): void

// Track user login
trackLogin(method: 'email' | 'oauth' | 'wallet'): void

// Track subscription purchases
trackSubscriptionUpgrade(fromTier: string, toTier: string, amount?: number): void

// Track email verification
trackEmailVerification(): void

// Track page engagement (time on page, scroll depth)
trackPageEngagement(engagementTime: number, scrollDepth?: number): void

// Track button clicks
trackButtonClick(buttonName: string, location?: string): void

// Track form submissions
trackFormSubmission(formName: string, success: boolean): void

// Track search queries
trackSearch(searchTerm: string, resultsCount?: number): void

// Track feature usage
trackFeatureUsage(featureName: string, tier?: string): void

// Set user properties (after login)
setUserProperties(userId: string, properties?: { tier?: string; email?: string }): void
```

---

## Events Tracked

### Automatic Events

| Event | Trigger | Data |
|-------|---------|------|
| `page_view` | Route change | `page_path`, `page_title` |

### User Events

| Event | Trigger | Data |
|-------|---------|------|
| `sign_up` | User registration | `method`, `tier`, `registration_type` |
| `login` | User login | `method` |
| `email_verification` | Email verified | `verification_status` |

### Conversion Events

| Event | Trigger | Data |
|-------|---------|------|
| `conversion` | Registration | `conversion_type`, `method`, `tier` |
| `purchase` | Subscription upgrade | `currency`, `value`, `items[]` |
| `subscription_upgrade` | Tier change | `from_tier`, `to_tier`, `amount` |

### Engagement Events

| Event | Trigger | Data |
|-------|---------|------|
| `button_click` | Button clicked | `button_name`, `location` |
| `form_submission` | Form submitted | `form_name`, `success` |
| `search` | Search performed | `search_term`, `results_count` |
| `feature_usage` | Feature used | `feature_name`, `user_tier` |
| `page_engagement` | Time on page | `engagement_time_msec`, `scroll_depth` |

---

## Usage Examples

### Track Registration

```typescript
// In signup-form.tsx
import { trackRegistration } from '@/lib/analytics'

const handleSignup = async () => {
    // ... signup logic
    trackRegistration('email', 'free')
}
```

### Track Login

```typescript
// In signin-form.tsx
import { trackLogin } from '@/lib/analytics'

const handleLogin = async () => {
    // ... login logic
    trackLogin('email')
}
```

### Track Subscription Upgrade

```typescript
// In checkout success
import { trackSubscriptionUpgrade } from '@/lib/analytics'

trackSubscriptionUpgrade('free', 'pro', 19)
```

### Track Feature Usage

```typescript
// In market-table.tsx
import { trackFeatureUsage } from '@/lib/analytics'

const handleExport = () => {
    trackFeatureUsage('watchlist_export', user.tier)
}
```

### Set User Properties

```typescript
// After successful login
import { setUserProperties } from '@/lib/analytics'

setUserProperties(user.id, {
    tier: user.tier,
    email: user.email
})
```

---

## Files Using Analytics

| File | Events Tracked |
|------|----------------|
| `signin-form.tsx` | `login` |
| `signup-form.tsx` | `sign_up`, `conversion` |
| `auth/verify/page.tsx` | `email_verification` |
| `pricing-tiers.tsx` | `button_click` |
| `pricing/page.tsx` | `page_view` |
| `footer.tsx` | Link clicks |
| `safe-nav-link.tsx` | Navigation tracking |
| `session-tracker.tsx` | Session events |

---

## Console Suppression

The `AnalyticsProvider` also suppresses non-critical console errors:

1. **Coinbase Analytics SDK** - Errors from browser extensions
2. **CORS errors** - From crypto logo CDNs (handled with fallbacks)
3. **Network errors (403/404)** - For external resources with fallbacks

This keeps the console clean while still logging important errors.

---

## GA4 Dashboard Reports

### Key Reports to Create

1. **User Acquisition**
   - Registration by method (email vs OAuth vs wallet)
   - Registration by tier

2. **Conversion Funnel**
   - Visit → Registration → Email Verification → Subscription

3. **Revenue Tracking**
   - Subscription upgrades by tier
   - Revenue by acquisition source

4. **Feature Engagement**
   - Most used features by tier
   - Feature usage over time

5. **User Retention**
   - Login frequency
   - Session duration
   - Return visits

---

## Privacy Considerations

### Data Collected

- Page views and navigation
- User tier and registration method
- Conversion events (no payment details)
- Feature usage patterns

### Data NOT Collected

- Email addresses (unless explicitly set)
- Payment information
- Wallet addresses
- Trading activity

### Compliance

- Analytics is disabled by default in development
- User ID is hashed/anonymized
- No PII in event parameters
- Respects browser Do Not Track (optional)

---

## Debugging Analytics

### Enable in Development

```bash
# .env.local
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Console Logging

In development, all analytics events are logged:

```
[Analytics Event] sign_up { method: 'email', tier: 'free' }
[Analytics] Tracking page view: /dashboard Dashboard - VolSpike
```

### GA4 DebugView

1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/) Chrome extension
2. Enable debug mode in GA4 settings
3. View real-time events in GA4 DebugView

---

## Future Enhancements

Potential additions not yet implemented:

- **Error tracking** (Sentry integration)
- **Session recording** (Hotjar/LogRocket)
- **A/B testing** (Google Optimize)
- **Product analytics** (Mixpanel/Amplitude)
- **Heatmaps** (Hotjar)

---

## Related Documentation

- [Environment Variables](20-ENVIRONMENT.md) - GA4 configuration
- [Frontend Overview](08-FRONTEND-OVERVIEW.md) - Provider setup
- [Components Reference](09-COMPONENTS.md) - AnalyticsProvider component
