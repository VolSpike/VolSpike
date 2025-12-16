# Components Reference

## Overview

VolSpike has 150+ React components organized into categories. This document provides a reference for each major component.

---

## Core Components

### Market Table (`market-table.tsx`)

The main data grid showing all trading pairs.

**Props:**
```typescript
interface MarketTableProps {
  data: MarketData[]
  tier: 'free' | 'pro' | 'elite'
  onSymbolClick?: (symbol: string) => void
  watchlistFilter?: string[]
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}
```

**Features:**
- Sortable columns (price, volume, change, funding, OI)
- Tier-based row limits
- Watchlist filtering
- Click to add to watchlist
- TradingView export button

**Usage:**
```typescript
<MarketTable
  data={marketData}
  tier={user.tier}
  watchlistFilter={activeWatchlist?.symbols}
/>
```

---

### Alerts Panel (`alerts-panel.tsx`)

Container component for volume and OI alerts with tabbed interface.

**Props:**
```typescript
interface AlertsPanelProps {
  tier: 'free' | 'pro' | 'elite'
  isGuest?: boolean
}
```

**Features:**
- Tabs for Volume/OI alerts
- Sound controls (shared between tabs)
- Countdown timer for batched tiers
- Guest blur overlay

---

### Volume Alerts Content (`volume-alerts-content.tsx`)

Displays volume spike alerts.

**Props:**
```typescript
interface VolumeAlertsContentProps {
  tier: 'free' | 'pro' | 'elite'
  hideControls?: boolean
  externalPlaySound?: (type: string) => void
  externalSoundsEnabled?: boolean
  externalSetSoundsEnabled?: (enabled: boolean) => void
}
```

**Features:**
- Real-time alert cards
- Bullish/bearish color coding
- Animation on new alerts
- Sound playback

---

### OI Alerts Content (`oi-alerts-content.tsx`)

Displays Open Interest alerts.

**Props:**
```typescript
interface OIAlertsContentProps {
  tier: 'free' | 'pro' | 'elite'
  hideControls?: boolean
  externalPlaySound?: (type: string) => void
}
```

**Features:**
- UP/DOWN direction indicators
- Percentage change display
- Timeframe badges

---

### Header (`header.tsx`)

Main navigation bar.

**Features:**
- Logo and brand
- Navigation links
- User menu (authenticated)
- Sign in/up buttons (guest)
- Mobile hamburger menu

---

### User Menu (`user-menu.tsx`)

Profile dropdown for authenticated users.

**Features:**
- User avatar/initials
- Tier badge
- Settings link
- Billing link (Stripe portal)
- Sign out

---

### Dashboard (`dashboard.tsx`)

Main dashboard layout component.

**Features:**
- Three-column responsive layout
- Market table (center)
- Alerts panel (left)
- News/watchlist panel (right)
- Mobile stack layout

---

## Authentication Components

### Signin Form (`signin-form.tsx`)

Email/password login form.

**Features:**
- Email input with validation
- Password input with visibility toggle
- "Forgot password" link
- Error message display
- Loading state

---

### Signup Form (`signup-form.tsx`)

New account registration form.

**Features:**
- Email input
- Password with requirements indicator
- Password confirmation
- Terms acceptance checkbox
- Email already exists check

---

### Phantom Signin Section (`phantom-signin-section.tsx`)

Solana wallet authentication.

**Features:**
- Connect Phantom button
- Mobile deep-link support
- Wallet address display
- Disconnect option

---

### Wallet Connect Button (`wallet-connect-button.tsx`)

EVM wallet authentication via RainbowKit.

**Features:**
- RainbowKit modal trigger
- Connected wallet display
- Multi-chain support

---

### Wallet Management (`wallet-management.tsx`)

Manage linked wallets in settings.

**Features:**
- List all linked wallets
- Add new wallet
- Unlink wallet (with confirmation)
- Primary wallet indicator

---

## Payment Components

### Pricing Tiers (`pricing-tiers.tsx`)

Tier comparison cards for pricing page.

**Features:**
- Free/Pro/Elite cards
- Feature checklist
- Price display
- Upgrade buttons

---

### Payment Method Selector (`payment-method-selector.tsx`)

Choose between Stripe and crypto.

**Features:**
- Card payment option
- Crypto payment option
- Selected state styling

---

### Crypto Currency Selector (`crypto-currency-selector.tsx`)

Select cryptocurrency for payment.

**Features:**
- Currency grid (USDT, USDC, SOL, ETH, BTC)
- Network display
- Selected state

---

### Promo Code Input (`promo-code-input.tsx`)

Apply promo code to payment.

**Features:**
- Code input field
- Apply button
- Validation feedback
- Discount display

---

### Checkout Success Content (`checkout-success-content.tsx`)

Payment success page content.

**Features:**
- Success animation
- New tier display
- "Go to Dashboard" button
- Confetti effect

---

## Watchlist Components

### Watchlist Selector (`watchlist-selector.tsx`)

Dropdown to select active watchlist.

**Features:**
- List user's watchlists
- Create new watchlist
- "All Symbols" option
- Symbol count badge

---

### Watchlist Filter (`watchlist-filter.tsx`)

Filter controls for watchlist view.

**Features:**
- Search input
- Sort options
- Export button

---

### Watchlist Export Button (`watchlist-export-button.tsx`)

Export watchlist to TradingView format.

**Features:**
- Export to TXT file
- TradingView compatible format
- Pro/Elite only

---

### Remove From Watchlist Dialog (`remove-from-watchlist-dialog.tsx`)

Confirmation dialog for removing symbol.

**Features:**
- Symbol name display
- Confirm/Cancel buttons
- Keyboard support

---

## UI Components (shadcn/ui)

### Button (`ui/button.tsx`)

Styled button with variants.

**Variants:**
- `default` - Primary action
- `destructive` - Dangerous action
- `outline` - Secondary action
- `ghost` - Minimal styling
- `link` - Text link style

**Sizes:**
- `default`, `sm`, `lg`, `icon`

---

### Card (`ui/card.tsx`)

Container with header/content/footer.

```typescript
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    Actions here
  </CardFooter>
</Card>
```

---

### Dialog (`ui/dialog.tsx`)

Modal dialog component.

```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <div>Content</div>
  </DialogContent>
</Dialog>
```

---

### Table (`ui/table.tsx`)

Data table component.

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### Tooltip (`ui/tooltip.tsx`)

Hover tooltip with portal rendering.

```typescript
<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent>
    Tooltip text
  </TooltipContent>
</Tooltip>
```

**Note:** Uses `TooltipPrimitive.Portal` to escape container clipping.

---

### Tabs (`ui/tabs.tsx`)

Tab navigation component.

```typescript
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## Admin Components

### Admin Layout (`admin/layout/admin-layout.tsx`)

Wrapper for admin pages.

**Features:**
- Sidebar navigation
- Admin header
- Auth protection
- System status indicator

---

### Stats Cards (`admin/dashboard/stats-cards.tsx`)

Metric cards for admin dashboard.

**Displays:**
- Total users
- Active subscriptions
- Monthly revenue
- Alert count

---

### Users Table (`admin/users/users-table.tsx`)

User management table.

**Features:**
- Pagination
- Search/filter
- Tier badges
- Status indicators
- Action buttons (edit, suspend, delete)

---

### Payments Table (`admin/payments/payments-table.tsx`)

Payment history table.

**Features:**
- Stripe and crypto payments
- Status badges
- Amount formatting
- Date/time display
- User link

---

### Revenue Chart (`admin/dashboard/revenue-chart.tsx`)

Revenue over time chart.

**Features:**
- Daily/monthly view
- Recharts line graph
- Period selector
- Growth indicator

---

### Audit Log Table (`admin/audit/audit-log-table.tsx`)

Audit trail table.

**Features:**
- Action type column
- Actor (user/admin)
- Target entity
- Timestamp
- Details expandable

---

### Promo Codes Table (`admin/promo-codes/promo-codes-table.tsx`)

Promo code management.

**Features:**
- Code column
- Discount percentage
- Usage count
- Valid until date
- Active toggle
- Edit/Delete actions

---

## Utility Components

### Theme Toggle (`theme-toggle.tsx`)

Dark/light mode switch.

```typescript
<ThemeToggle />
// Renders sun/moon icon button
```

---

### Loading Spinner (`ui/loading-spinner.tsx`)

Animated loading indicator.

```typescript
<LoadingSpinner size="sm" />  // 16px
<LoadingSpinner size="md" />  // 24px
<LoadingSpinner size="lg" />  // 32px
```

---

### Client Only (`client-only.tsx`)

Wrap client-only content.

```typescript
<ClientOnly fallback={<Loading />}>
  <BrowserOnlyComponent />
</ClientOnly>
```

---

### Guest CTA (`guest-cta.tsx`)

Call-to-action for unauthenticated users.

**Features:**
- Gradient pill design
- "Sign up free" text
- Links to /auth

---

### Account Deleted Modal (`account-deleted-modal.tsx`)

Modal shown when account is deleted.

**Features:**
- Informational message
- Redirect to homepage
- Auto-logout

---

## Component Patterns

### Defining Props Interface

```typescript
interface ComponentProps {
  // Required props
  data: DataType[]
  onAction: (id: string) => void

  // Optional props with defaults
  variant?: 'default' | 'compact'
  className?: string
}
```

### Using forwardRef

```typescript
const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('base-class', className)} {...props} />
  )
)
Component.displayName = 'Component'
```

### Compound Components

```typescript
// Parent component
export function Card({ children }) {
  return <div className="card">{children}</div>
}

// Child components
Card.Header = function CardHeader({ children }) {
  return <div className="card-header">{children}</div>
}

Card.Content = function CardContent({ children }) {
  return <div className="card-content">{children}</div>
}
```

---

## Best Practices

### Component Organization

1. **One component per file**
2. **Export at the bottom**
3. **Props interface at the top**
4. **Hooks before JSX**

### Naming Conventions

- **Files**: kebab-case (`market-table.tsx`)
- **Components**: PascalCase (`MarketTable`)
- **Props**: `ComponentNameProps`
- **Hooks**: `useFeatureName`

### Performance

1. **Memoize expensive components**
2. **Use `useMemo` for derived data**
3. **Use `useCallback` for callbacks**
4. **Avoid inline object creation in props**

---

## Next: [Hooks Reference](10-HOOKS.md)
