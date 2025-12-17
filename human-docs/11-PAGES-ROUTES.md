# Pages & Routes

## Overview

VolSpike uses Next.js 15 App Router. All pages are located in `src/app/`.

---

## Route Structure

```
/                        # Homepage
/auth                    # Sign in / Sign up
/auth/forgot             # Password reset request
/auth/verify             # Email verification
/auth/reset-password     # Set new password
/dashboard               # Main trading dashboard
/settings                # User settings
/settings/alerts         # Alert preferences
/settings/billing        # Subscription management
/pricing                 # Pricing page
/checkout/crypto         # Crypto payment selection
/checkout/crypto/pay     # Pending payment
/checkout/success        # Payment success
/checkout/cancel         # Payment cancelled
/legal/privacy           # Privacy policy
/legal/terms             # Terms of service
/legal/refunds           # Refund policy
/support                 # Support page
/academy                 # Trading academy
/docs                    # Documentation
/donate                  # Donation page
/suggestions             # User feedback/suggestions
/status                  # System status
/debug/open-interest     # OI debugging (dev only)
/test                    # Testing page (dev only)
/test-payment            # Stripe test (dev only)
/test-crypto-payment     # Crypto test (test accounts)
/admin                   # Admin dashboard
/admin/users             # User management
/admin/users/[id]        # User details
/admin/users/new         # Create user
/admin/subscriptions     # Subscription management
/admin/subscriptions/[id]# Subscription details
/admin/payments          # Payment history
/admin/revenue           # Revenue analytics
/admin/promo-codes       # Promo code management
/admin/audit             # Audit logs
/admin/metrics           # System metrics
/admin/settings          # Admin settings
/admin/assets            # Asset management
/admin/alerts            # Alert management
/admin/oi-alerts         # OI alert management
/admin/notifications     # Notifications
/admin/news              # News management
/admin/telegram          # Telegram settings
/admin/alert-preview     # Alert testing
```

---

## Public Pages

### Homepage (`/`)

**File:** `src/app/page.tsx`

Marketing landing page with:
- Hero section
- Feature highlights
- Pricing preview
- Call-to-action

---

### Pricing (`/pricing`)

**File:** `src/app/pricing/page.tsx`

Full pricing comparison:
- Tier cards (Free, Pro, Elite)
- Feature checklist
- FAQ section

---

### Legal Pages (`/legal/*`)

**Files:**
- `src/app/legal/privacy/page.tsx`
- `src/app/legal/terms/page.tsx`
- `src/app/legal/refunds/page.tsx`

Static legal content.

---

### Support (`/support`)

**File:** `src/app/support/page.tsx`

Contact information and FAQ.

---

### Donate (`/donate`)

**File:** `src/app/donate/page.tsx`

Donation page with multiple cryptocurrency options:
- Bitcoin, Ethereum, Solana addresses
- QR codes for each
- Copy-to-clipboard functionality

---

### Suggestions (`/suggestions`)

**File:** `src/app/suggestions/page.tsx`

User feedback and suggestion submission form accessible from footer "Suggestions" link.

**Features:**
- Beautiful form with custom human verification (math challenge)
- Optional fields: Name, Suggestion Type (💡⚡🐛💬), Title
- Required fields: Email, Description (min 10 characters)
- Auto-verify when correct answer entered
- Instant submission response (~50-100ms)
- Success message with auto-dismiss after 5 seconds
- Manual dismiss button (X) on success/error messages
- Human verification resets after successful submission

**Email Notifications:**
- Sends notification to support@volspike.com with suggestion details
- Sends confirmation email to user with submission recap
- Emails sent asynchronously in background (non-blocking)
- Beautiful HTML email templates with VolSpike branding

**Components Used:**
- `HumanVerification` - Custom math challenge component with forwardRef
- Emoji-enhanced suggestion type selector
- Character counter for description field
- Form state management with React hooks

---

### Academy (`/academy`)

**File:** `src/app/academy/page.tsx`

Trading education content:
- Volume spike trading strategies
- Open interest analysis
- Funding rate interpretation
- Risk management guides

---

## Debug/Test Pages

### OI Debug (`/debug/open-interest`)

**File:** `src/app/debug/open-interest/page.tsx`

Open Interest debugging page (development only):
- Raw OI data visualization
- API response inspection
- WebSocket connection status

---

### Test Payment (`/test-payment`)

**File:** `src/app/test-payment/page.tsx`

Stripe payment testing (development only):
- Test subscription flows
- Webhook testing

---

### Test Crypto Payment (`/test-crypto-payment`)

**File:** `src/app/test-crypto-payment/page.tsx`

Crypto payment testing (test accounts only):
- $1 test payments
- Restricted to emails ending with `-test@volspike.com`
- Full NowPayments flow testing

---

## Authentication Pages

### Sign In/Up (`/auth`)

**File:** `src/app/auth/page.tsx`

Combined authentication page:
- Email/password forms
- OAuth buttons (Google)
- Wallet connections (EVM, Solana)
- Tab switching between sign in/up

**Components:**
- `SigninForm`
- `SignupForm`
- `PhantomSigninSection`
- `WalletConnectButton`

---

### Forgot Password (`/auth/forgot`)

**File:** `src/app/auth/forgot/page.tsx`

Password reset request form.

---

### Verify Email (`/auth/verify`)

**File:** `src/app/auth/verify/page.tsx`

Email verification handler:
- Extracts token from URL
- Calls verification endpoint
- Shows success/error

---

### Reset Password (`/auth/reset-password`)

**File:** `src/app/auth/reset-password/page.tsx`

New password form:
- Token validation
- Password requirements
- Confirmation

---

## Dashboard

### Main Dashboard (`/dashboard`)

**File:** `src/app/dashboard/page.tsx`

The core trading dashboard:

```typescript
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                        Header                                │
├────────────┬──────────────────────────┬─────────────────────┤
│   Alerts   │      Market Table        │    News/            │
│   Panel    │                          │    Watchlist        │
│            │                          │                     │
└────────────┴──────────────────────────┴─────────────────────┘
```

**Features:**
- Real-time market data (WebSocket)
- Volume alerts (Socket.IO)
- OI alerts
- Watchlist management
- Sound controls

---

## Settings Pages

### Account Settings (`/settings`)

**File:** `src/app/settings/page.tsx`

User profile and security:
- Email display
- Password change
- Linked wallets
- Delete account

---

### Alert Settings (`/settings/alerts`)

**File:** `src/app/settings/alerts/page.tsx`

Alert preferences:
- Sound enable/disable
- Volume control
- Browser notifications
- Email notifications (Pro+)

---

### Billing (`/settings/billing`)

**File:** `src/app/settings/billing/page.tsx`

Subscription management:
- Current tier display
- Subscription status
- Stripe portal link
- Upgrade options
- Crypto payment history

---

## Checkout Pages

### Crypto Selection (`/checkout/crypto`)

**File:** `src/app/checkout/crypto/page.tsx`

Cryptocurrency selection:
- Tier confirmation
- Currency grid (USDT, SOL, ETH, BTC)
- Promo code input
- Continue button

---

### Pending Payment (`/checkout/crypto/pay`)

**File:** `src/app/checkout/crypto/pay/page.tsx`

Payment waiting page:
- Invoice details
- Payment address
- QR code
- Status polling
- Redirect on completion

---

### Success (`/checkout/success`)

**File:** `src/app/checkout/success/page.tsx`

Payment confirmation:
- Success animation
- New tier display
- Confetti effect
- "Go to Dashboard" button

---

### Cancel (`/checkout/cancel`)

**File:** `src/app/checkout/cancel/page.tsx`

Payment cancelled:
- Return message
- Retry option
- Support link

---

## Admin Pages

### Admin Dashboard (`/admin`)

**File:** `src/app/(admin)/admin/page.tsx`

Overview dashboard:
- Stats cards
- Revenue chart
- Recent activity
- Quick actions

---

### Users (`/admin/users`)

**File:** `src/app/(admin)/admin/users/page.tsx`

User management table:
- Search/filter
- Pagination
- User actions

**User Detail (`/admin/users/[id]`):**
- Full profile
- Payment history
- Watchlists
- Activity log

**Create User (`/admin/users/new`):**
- Email input
- Tier selection
- Password setting

---

### Subscriptions (`/admin/subscriptions`)

**File:** `src/app/(admin)/admin/subscriptions/page.tsx`

Stripe subscription management:
- Status filters
- Sync buttons
- Subscription details

---

### Payments (`/admin/payments`)

**File:** `src/app/(admin)/admin/payments/page.tsx`

Payment history:
- Stripe + Crypto combined
- Status filters
- Create manual payment

---

### Revenue (`/admin/revenue`)

**File:** `src/app/(admin)/admin/revenue/page.tsx`

Analytics dashboard:
- Time-series chart
- Period selectors
- Payment breakdown

---

### Promo Codes (`/admin/promo-codes`)

**File:** `src/app/(admin)/admin/promo-codes/page.tsx`

Promo code CRUD:
- Create new codes
- Edit existing
- View usage
- Activate/deactivate

---

### Audit (`/admin/audit`)

**File:** `src/app/(admin)/admin/audit/page.tsx`

Audit log viewer:
- Action filtering
- Actor/target info
- Timestamp sorting

---

### Assets (`/admin/assets`)

**File:** `src/app/(admin)/admin/assets/page.tsx`

Asset metadata:
- Table/card views
- Completion status
- Manual refresh

---

### Other Admin Pages

| Page | Path | Purpose |
|------|------|---------|
| Metrics | `/admin/metrics` | System health |
| Settings | `/admin/settings` | Platform config |
| Notifications | `/admin/notifications` | Notification management |
| News | `/admin/news` | RSS feed management |
| Telegram | `/admin/telegram` | Telegram integration |
| Alert Preview | `/admin/alert-preview` | Test alerts |

---

## API Routes

### NextAuth (`/api/auth/[...nextauth]`)

**File:** `src/app/api/auth/[...nextauth]/route.ts`

NextAuth.js handler:

```typescript
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers

// Force dynamic to prevent caching issues
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```

---

### Auth Me (`/api/auth/me`)

**File:** `src/app/api/auth/me/route.ts`

Get current user from session.

---

### Refresh Session (`/api/auth/refresh-session`)

**File:** `src/app/api/auth/refresh-session/route.ts`

Force session refresh.

---

## Route Groups

### Admin Group `(admin)`

The `(admin)` folder groups admin pages without affecting URL:

```
src/app/(admin)/
├── layout.tsx           # Admin layout wrapper
└── admin/
    ├── page.tsx         # /admin
    ├── users/page.tsx   # /admin/users
    └── ...
```

**Admin Layout:**
```typescript
export default function AdminLayout({ children }) {
  return (
    <AdminAuthRedirect>
      <AdminLayoutComponent>
        {children}
      </AdminLayoutComponent>
    </AdminAuthRedirect>
  )
}
```

---

## Page Protection

### ProtectedRoute

Requires authentication:

```typescript
export function ProtectedRoute({ children }) {
  const { status } = useSession()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') redirect('/auth')

  return children
}
```

### AdminAuthRedirect

Requires ADMIN role:

```typescript
export function AdminAuthRedirect({ children }) {
  const { data: session } = useSession()

  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return children
}
```

---

## Dynamic Routes

### User Detail (`/admin/users/[id]`)

```typescript
// src/app/(admin)/admin/users/[id]/page.tsx
export default function UserPage({ params }: { params: { id: string } }) {
  return <UserDetailClient userId={params.id} />
}
```

### Subscription Detail (`/admin/subscriptions/[id]`)

```typescript
export default function SubscriptionPage({ params }) {
  return <SubscriptionDetailClient subscriptionId={params.id} />
}
```

---

## Server vs Client Components

### Server Components (Default)

```typescript
// No 'use client' directive
export default async function Page() {
  const data = await fetchData() // Server-side fetch
  return <div>{data}</div>
}
```

### Client Components

```typescript
'use client'

import { useState } from 'react'

export default function Page() {
  const [state, setState] = useState()
  // Client-side interactivity
}
```

---

## Page Metadata

```typescript
export const metadata = {
  title: 'Dashboard | VolSpike',
  description: 'Real-time Binance Futures trading dashboard',
}
```

---

## Loading States

```typescript
// loading.tsx next to page.tsx
export default function Loading() {
  return <LoadingSpinner />
}
```

---

## Error Handling

```typescript
// error.tsx next to page.tsx
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```
