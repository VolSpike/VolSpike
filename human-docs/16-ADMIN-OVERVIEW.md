# Admin Panel Overview

## Overview

The admin panel provides comprehensive management tools for VolSpike administrators. It requires the `ADMIN` role and is protected by server-side authentication.

**URL:** `/admin`

---

## Access Control

### Role Check

Only users with `role === 'ADMIN'` can access admin pages.

**Frontend Protection:**
```typescript
// components/admin-auth-redirect.tsx
export function AdminAuthRedirect({ children }) {
  const { data: session } = useSession()

  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return children
}
```

**Backend Protection:**
```typescript
// middleware/admin-auth.ts
export async function adminAuthMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (user?.role !== 'ADMIN') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  return next()
}
```

---

## Admin Pages

### Dashboard (`/admin`)

Overview of key metrics and quick actions.

**Components:**
- Stats cards (users, revenue, subscriptions)
- Revenue chart (daily/monthly)
- Recent activity log
- Quick action buttons
- System health indicator

**Data:**
- Total users by tier
- Monthly recurring revenue
- Active subscriptions count
- Recent signups

---

### Users (`/admin/users`)

User management table with CRUD operations.

**Features:**
- Searchable/filterable user list
- Tier badges and status indicators
- Pagination with smart ellipsis
- User actions (edit, suspend, delete)

**Columns:**
- Email
- Tier (Free/Pro/Elite)
- Role (User/Admin)
- Status (Active/Suspended/Banned)
- Created date
- Last login
- Actions

**User Detail Page (`/admin/users/[id]`):**
- Full user profile
- Linked wallets
- Payment history
- Subscription details
- Watchlists
- Activity log
- Manual tier change
- Reset password
- Delete account

---

### Subscriptions (`/admin/subscriptions`)

Stripe subscription management.

**Features:**
- Subscription list with status
- Filter by status (active, canceled, past_due)
- Sync button for individual subscriptions
- Bulk sync functionality

**Columns:**
- User email
- Tier
- Status
- Start date
- Current period end
- Payment method
- Actions

**Sync Result Dialog:**
Shows detailed results of subscription sync operations.

---

### Payments (`/admin/payments`)

Payment history for both Stripe and crypto.

**Features:**
- Combined Stripe + NowPayments view
- Filter by payment method
- Filter by status
- Date range filter
- Create manual crypto payment

**Columns:**
- User
- Amount
- Payment method (Stripe/Crypto)
- Currency (for crypto)
- Status
- Tier
- Date
- Actions

**Create Payment Dialog:**
Manually record a NowPayments payment by invoice ID.

---

### Revenue (`/admin/revenue`)

Revenue analytics and charts.

**Components:**
- Total revenue card
- Growth percentage
- Time-series chart (Recharts)
- Period selector (1d, 7d, 30d, 90d, 1y)
- Breakdown by payment method
- Daily/monthly view toggle

---

### Promo Codes (`/admin/promo-codes`)

Promotional code management.

**Features:**
- Create new promo codes
- Edit existing codes
- View usage statistics
- Activate/deactivate codes
- Delete codes

**Code Properties:**
- Code string
- Discount percentage
- Max uses
- Current uses
- Valid until date
- Payment method restriction (Stripe/Crypto/All)
- Active status

---

### Audit (`/admin/audit`)

Audit log viewer for compliance.

**Features:**
- Filterable action log
- Actor identification
- Target entity tracking
- Timestamp sorting
- Expandable details

**Logged Actions:**
- User creation/deletion
- Tier changes
- Payment processing
- Settings changes
- Admin actions

---

### Assets (`/admin/assets`)

Cryptocurrency asset metadata management.

**Features:**
- Asset list with completion status
- Card and table views
- Manual refresh trigger
- Edit asset details
- Hide/unhide assets

**Asset Fields:**
- Symbol
- Name
- CoinGecko ID
- Logo URL
- Description
- Social links
- Completion status

---

### Metrics (`/admin/metrics`)

System health and performance metrics.

**Components:**
- Server health status
- Database connection status
- Socket.IO connections count
- Memory usage
- API response times
- Error rates

---

### Settings (`/admin/settings`)

Platform configuration.

**Sections:**
- General settings
- Wallet management
- Security settings
- 2FA configuration

**Settings Form:**
- Platform name
- Contact email
- Maintenance mode toggle
- Feature flags

---

### Notifications (`/admin/notifications`)

Admin notification management.

**Features:**
- Notification bell in header
- Unread count badge
- Mark as read
- Mark all as read
- Notification types (info, warning, error)

---

### News (`/admin/news`)

News feed management.

**Features:**
- RSS feed sources
- Enable/disable sources
- Manual refresh
- Article review
- Flag articles

---

### Telegram (`/admin/telegram`)

Telegram integration settings.

**Features:**
- Channel configuration
- Message monitoring
- Relevance tagging
- Connection status

---

### Alert Preview (`/admin/alert-preview`)

Test and preview alerts.

**Features:**
- Simulate volume alerts
- Simulate OI alerts
- Test animation effects
- Test sound playback

---

## Admin Components

### Layout Components

**AdminLayout (`components/admin/layout/admin-layout.tsx`):**
```typescript
export function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        <AdminHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
```

**AdminSidebar:**
Navigation menu with icons for each section.

**AdminHeader:**
Top bar with user menu and notification bell.

### Table Components

**Pagination:**
Smart ellipsis pagination with clickable page numbers.

```typescript
// Pagination pattern
[1] [2] [...] [5] [6] [7] [...] [10]
```

**Filters:**
Dropdowns and search inputs for filtering.

**Actions:**
Dropdown menu with edit, delete, etc.

### Dialog Components

**CreateDialog:**
Form dialog for creating new items.

**EditDialog:**
Pre-filled form for editing existing items.

**DeleteDialog:**
Confirmation dialog with warning.

**ViewDialog:**
Read-only detail view.

---

## Admin API Endpoints

### Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List users (paginated) |
| `/api/admin/users/:id` | GET | Get user details |
| `/api/admin/users/:id` | PUT | Update user |
| `/api/admin/users/:id` | DELETE | Delete user |
| `/api/admin/users/:id/tier` | PUT | Change tier |
| `/api/admin/users/:id/status` | PUT | Change status |

### Subscriptions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/subscriptions` | GET | List subscriptions |
| `/api/admin/subscriptions/:id/sync` | POST | Sync with Stripe |
| `/api/admin/subscriptions/bulk-sync` | POST | Sync all |

### Payments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/payments` | GET | List payments |
| `/api/admin/payments/create` | POST | Create manual payment |
| `/api/admin/payments/repair-tier` | POST | Fix tier mismatch |

### Promo Codes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/promo-codes` | GET | List codes |
| `/api/admin/promo-codes` | POST | Create code |
| `/api/admin/promo-codes/:id` | PUT | Update code |
| `/api/admin/promo-codes/:id` | DELETE | Delete code |

### Audit

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/audit` | GET | Get audit logs |

### Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/metrics` | GET | Get system metrics |
| `/api/admin/metrics/revenue` | GET | Get revenue data |

### Settings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/settings` | GET | Get settings |
| `/api/admin/settings` | PUT | Update settings |

---

## Audit Logging

All admin actions are logged:

```typescript
// Example: User tier change
await logAuditEvent({
  action: 'USER_TIER_CHANGE',
  actorId: admin.id,
  actorEmail: admin.email,
  targetId: user.id,
  targetType: 'user',
  targetEmail: user.email,
  details: {
    oldTier: 'free',
    newTier: 'pro',
    reason: 'Manual upgrade'
  },
  ipAddress: c.req.header('x-forwarded-for')
})
```

**Audit Actions:**
- `USER_CREATE`
- `USER_UPDATE`
- `USER_DELETE`
- `USER_TIER_CHANGE`
- `USER_STATUS_CHANGE`
- `PAYMENT_CREATE`
- `PROMO_CODE_CREATE`
- `PROMO_CODE_UPDATE`
- `PROMO_CODE_DELETE`
- `SETTINGS_UPDATE`
- `ADMIN_LOGIN`

---

## Security Features

### Two-Factor Authentication

Admin accounts can enable 2FA:

```typescript
// Enable 2FA
const secret = speakeasy.generateSecret({ name: 'VolSpike Admin' })
// Store secret, show QR code

// Verify 2FA
const verified = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: 'base32',
  token: userProvidedCode
})
```

### Session Security

- Shorter session duration for admins
- IP logging on all admin actions
- Session invalidation on password change

### Rate Limiting

```typescript
// Admin-specific rate limiting
export const adminRateLimitMiddleware = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 50,                   // 50 requests
})
```

---

## Admin Workflows

### Creating a User

1. Navigate to `/admin/users/new`
2. Fill in email
3. Select tier and role
4. Optionally set password
5. Submit form
6. User receives welcome email

### Upgrading a User

1. Go to `/admin/users`
2. Find user and click "Edit"
3. Change tier dropdown
4. Save changes
5. Action logged to audit trail
6. User receives Socket.IO tier-change event

### Processing Manual Payment

1. Go to `/admin/payments`
2. Click "Create Payment"
3. Enter NowPayments invoice ID
4. System fetches payment details
5. User is upgraded
6. Payment recorded

### Investigating Issues

1. Go to `/admin/audit`
2. Filter by user or action type
3. Review timeline of events
4. Click for expanded details

---

## Next: [Admin Pages Detail](17-ADMIN-PAGES.md)
