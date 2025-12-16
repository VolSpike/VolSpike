# Frontend Overview

## Technology Stack

The frontend is a Next.js 15 application using the App Router pattern.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.7 | React framework |
| React | 18.2.0 | UI library |
| TypeScript | 5.3.2 | Type safety |
| Tailwind CSS | 3.3.6 | Styling |
| shadcn/ui | - | Component library |
| Framer Motion | 10.16.16 | Animations |
| Recharts | 2.8.0 | Charts |
| TanStack Query | 5.8.4 | Data fetching |
| Zustand | 4.4.7 | State management |

---

## Project Structure

```
volspike-nextjs-frontend/
├── src/
│   ├── app/                 # Pages (App Router)
│   │   ├── (admin)/        # Admin section (grouped route)
│   │   │   └── admin/      # Admin pages
│   │   ├── api/            # API routes
│   │   ├── auth/           # Authentication pages
│   │   ├── checkout/       # Payment pages
│   │   ├── dashboard/      # Main dashboard
│   │   ├── legal/          # Legal pages
│   │   ├── settings/       # User settings
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Homepage
│   │
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── admin/          # Admin components
│   │   └── *.tsx           # Feature components
│   │
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and config
│   ├── types/              # TypeScript definitions
│   └── styles/             # Global CSS
│
├── public/                  # Static assets
│   ├── sounds/             # Alert sounds
│   └── images/             # Images and logos
│
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

---

## Key Files

### Root Layout (`src/app/layout.tsx`)

Wraps the entire application with providers:

```typescript
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### Providers (`src/components/providers.tsx`)

Sets up all context providers:

```typescript
export function Providers({ children }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <Web3Providers>
            <SolanaProviders>
              {children}
            </SolanaProviders>
          </Web3Providers>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
```

### Auth Configuration (`src/lib/auth.ts`)

NextAuth.js configuration with multiple providers:

```typescript
export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({ ... }),
    CredentialsProvider({ ... }),  // Email/password
    CredentialsProvider({ id: 'siwe', ... }),  // EVM wallets
  ],
  callbacks: {
    jwt({ token, user }) { ... },
    session({ session, token }) { ... },
  },
}
```

---

## Page Structure

### Homepage (`src/app/page.tsx`)

- Marketing landing page
- Feature highlights
- Pricing tiers
- Call-to-action for sign-up

### Dashboard (`src/app/dashboard/page.tsx`)

The main trading dashboard:

```typescript
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
```

### Dashboard Component (`src/components/dashboard.tsx`)

Three-column layout:

```
┌─────────────────────────────────────────────────────────────┐
│                        Header                                │
├────────────┬──────────────────────────┬─────────────────────┤
│   Alerts   │      Market Table        │    Watchlist/       │
│   Panel    │                          │    News Panel       │
│            │                          │                     │
│            │                          │                     │
└────────────┴──────────────────────────┴─────────────────────┘
```

### Auth Pages

| Page | Path | Description |
|------|------|-------------|
| Sign In/Up | `/auth` | Combined auth page |
| Forgot Password | `/auth/forgot` | Password reset request |
| Verify Email | `/auth/verify` | Email verification |
| Reset Password | `/auth/reset-password` | Password reset form |

### Settings Pages

| Page | Path | Description |
|------|------|-------------|
| Account | `/settings` | Profile and security |
| Alerts | `/settings/alerts` | Alert preferences |
| Billing | `/settings/billing` | Subscription management |

### Checkout Pages

| Page | Path | Description |
|------|------|-------------|
| Crypto | `/checkout/crypto` | Select crypto currency |
| Crypto Pay | `/checkout/crypto/pay` | Pending payment page |
| Success | `/checkout/success` | Payment confirmation |
| Cancel | `/checkout/cancel` | Payment cancelled |

---

## Component Categories

### Core Components (59+)

**Market Data:**
- `market-table.tsx` - Main data grid
- `watchlist-selector.tsx` - Watchlist dropdown
- `watchlist-filter.tsx` - Filter controls

**Alerts:**
- `alerts-panel.tsx` - Alert container with tabs
- `volume-alerts-content.tsx` - Volume alert list
- `oi-alerts-content.tsx` - OI alert list
- `alert-builder.tsx` - Custom alert creation

**Authentication:**
- `signin-form.tsx` - Email sign-in
- `signup-form.tsx` - Email sign-up
- `phantom-signin-section.tsx` - Solana wallet
- `wallet-connect-button.tsx` - EVM wallets

**Payments:**
- `pricing-tiers.tsx` - Tier comparison
- `payment-method-selector.tsx` - Choose payment
- `crypto-currency-selector.tsx` - Crypto selection

**Layout:**
- `header.tsx` - Navigation bar
- `footer.tsx` - Page footer
- `user-menu.tsx` - Profile dropdown

### UI Components (shadcn/ui)

Located in `src/components/ui/`:

| Component | Description |
|-----------|-------------|
| `button.tsx` | Styled buttons |
| `card.tsx` | Card containers |
| `dialog.tsx` | Modal dialogs |
| `dropdown-menu.tsx` | Dropdown menus |
| `input.tsx` | Form inputs |
| `select.tsx` | Select dropdowns |
| `table.tsx` | Data tables |
| `tabs.tsx` | Tab navigation |
| `tooltip.tsx` | Hover tooltips |
| ... | 20+ total |

### Admin Components (50+)

Located in `src/components/admin/`:

**Layout:**
- `admin-layout.tsx` - Admin wrapper
- `admin-header.tsx` - Admin navigation
- `admin-sidebar.tsx` - Side menu

**Dashboard:**
- `stats-cards.tsx` - Metric cards
- `revenue-chart.tsx` - Revenue graph
- `user-growth-chart.tsx` - User trends

**Tables:**
- `users-table.tsx` - User list
- `payments-table.tsx` - Payment history
- `subscriptions-table.tsx` - Subscriptions
- `audit-log-table.tsx` - Audit trail

---

## State Management

### TanStack Query (Server State)

For API data:

```typescript
// Fetch user data
const { data: user, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})

// Mutations
const updateUser = useMutation({
  mutationFn: (data) => api.patch('/api/user', data),
  onSuccess: () => queryClient.invalidateQueries(['user']),
})
```

### Zustand (Client State)

For UI state that needs to persist:

```typescript
// Example: Sound preferences
const useSoundStore = create((set) => ({
  enabled: false,
  volume: 0.5,
  setEnabled: (enabled) => set({ enabled }),
  setVolume: (volume) => set({ volume }),
}))
```

### React Context

For feature-specific context:

```typescript
// Theme context
const { theme, setTheme } = useTheme()

// Session context
const { data: session, status } = useSession()
```

---

## Data Fetching Patterns

### API Client

Located in `src/lib/api-client.ts`:

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### Server Components

Fetch data on the server:

```typescript
// src/app/dashboard/page.tsx
export default async function DashboardPage() {
  // This runs on the server
  const initialData = await fetchInitialData()

  return <Dashboard initialData={initialData} />
}
```

### Client Components

Fetch data with hooks:

```typescript
'use client'

export function MarketTable() {
  const { data, status } = useClientOnlyMarketData({ tier: 'pro' })

  if (status === 'connecting') return <LoadingSpinner />

  return <Table data={data} />
}
```

---

## Routing

### App Router Conventions

| Path | Route |
|------|-------|
| `app/page.tsx` | `/` |
| `app/dashboard/page.tsx` | `/dashboard` |
| `app/auth/page.tsx` | `/auth` |
| `app/settings/billing/page.tsx` | `/settings/billing` |
| `app/(admin)/admin/page.tsx` | `/admin` |
| `app/admin/users/[id]/page.tsx` | `/admin/users/:id` |

### Route Groups

The `(admin)` folder is a route group:
- Creates shared layout for admin pages
- Doesn't affect URL structure
- `/admin` not `/(admin)/admin`

### Dynamic Routes

```typescript
// app/admin/users/[id]/page.tsx
export default function UserPage({ params }: { params: { id: string } }) {
  return <UserDetail userId={params.id} />
}
```

---

## Styling

### Tailwind CSS

Primary styling approach:

```typescript
<div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
  <h2 className="text-lg font-semibold text-foreground">Title</h2>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### Theme System

Dark/light theme via `next-themes`:

```typescript
// Theme variables in CSS
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

### Custom Animations

Defined in `tailwind.config.js`:

```javascript
extend: {
  animation: {
    'slide-in-right': 'slideInRight 0.5s ease-out',
    'fade-in': 'fadeIn 0.3s ease-out',
    'lightning-strike-green': 'lightningStrikeGreen 0.6s ease-out',
  },
  keyframes: {
    slideInRight: {
      '0%': { transform: 'translateX(100%)', opacity: '0' },
      '100%': { transform: 'translateX(0)', opacity: '1' },
    },
  },
}
```

---

## Important Patterns

### Client Components

Mark interactive components:

```typescript
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Protected Routes

Require authentication:

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

export function ProtectedRoute({ children }) {
  const { status } = useSession()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') redirect('/auth')

  return children
}
```

### Tier-Based Access

Gate features by tier:

```typescript
export function OIColumn({ tier }) {
  if (tier === 'free') {
    return <LockedCell message="Pro feature" />
  }

  return <OIValue value={openInterest} />
}
```

---

## Testing

### Test Setup

Using Vitest + Testing Library:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
  },
})
```

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import { MarketTable } from './market-table'

describe('MarketTable', () => {
  it('renders loading state', () => {
    render(<MarketTable data={[]} status="connecting" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
```

### Running Tests

```bash
npm run test        # Run tests
npm run test:ui     # Interactive UI
npm run test:coverage  # Coverage report
```

---

## Build & Deploy

### Development

```bash
npm run dev
# Runs on localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

### Deployment (Vercel)

1. Push to main branch
2. Vercel auto-deploys
3. Preview deployments for PRs

### Environment Variables

Required on Vercel:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

---

## Next: [Components Reference](09-COMPONENTS.md)
