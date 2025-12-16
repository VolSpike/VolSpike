# Admin Pages Detail

## Overview

The admin panel consists of 17+ pages for platform management. All pages require `role === 'ADMIN'` and use server-side authentication.

---

## Page Architecture

### Security Pattern

Every admin page follows this pattern:

```typescript
export default async function AdminPage() {
    const session = await auth()

    // SECURITY: Strict admin check
    if (!session?.user) {
        redirect('/auth?next=/admin&mode=admin')
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin&mode=admin&error=access_denied')
    }

    // Page content...
}
```

### Component Structure

```
page.tsx (Server Component)
    │
    ├── auth() - Server-side session check
    ├── adminAPI.setAccessToken() - Set JWT
    ├── adminAPI.getData() - Fetch data
    │
    └── <AdminLayout>
            └── <PageClient /> or direct components
```

---

## Dashboard Page

**Route:** `/admin`
**File:** `app/(admin)/admin/page.tsx`

### Purpose

Main admin dashboard with overview metrics and quick actions.

### Components Used

| Component | Purpose |
|-----------|---------|
| `AdminDashboardClient` | Main dashboard client component |
| `StatsCards` | Key metrics cards |
| `RevenueChart` | Revenue trend chart |
| `UserGrowthChart` | User growth chart |
| `RecentActivity` | Recent admin actions |
| `QuickActions` | Common action buttons |
| `SystemHealth` | System status indicators |
| `WalletBalances` | Crypto wallet balances |

### Features

- Total users count
- Revenue metrics (today, week, month)
- Active subscriptions breakdown
- Payment method distribution
- Quick action buttons
- System health indicators

---

## Users Page

**Route:** `/admin/users`
**File:** `app/(admin)/admin/users/page.tsx`

### Purpose

User management with filtering, pagination, and CRUD operations.

### Search Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Search by email/name |
| `role` | enum | - | Filter by role |
| `tier` | enum | - | Filter by tier |
| `status` | enum | - | Filter by status |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort direction |

### Components Used

| Component | Purpose |
|-----------|---------|
| `UsersTable` | Paginated user table |
| `UserFilters` | Filter controls |
| `UserActions` | Bulk actions, create button |

### Available Actions

- View user details
- Edit user profile
- Change user tier
- Change user status (active/suspended/banned)
- Delete user
- Create new user

---

## User Detail Page

**Route:** `/admin/users/[id]`
**File:** `app/(admin)/admin/users/[id]/page.tsx`

### Purpose

Detailed view and management of individual user.

### Components Used

| Component | Purpose |
|-----------|---------|
| `UserDetailClient` | Main user detail view |

### Sections

1. **Profile Information**
   - Email, name, profile picture
   - Creation date, last login
   - Role and tier

2. **Account Status**
   - Status badge (active/suspended/banned)
   - Change status controls

3. **Subscription Details**
   - Current tier
   - Subscription dates
   - Payment history link

4. **Linked Accounts**
   - OAuth providers
   - EVM wallets
   - Solana wallets

5. **Actions**
   - Edit profile
   - Change tier
   - Change status
   - Delete account

---

## Create User Page

**Route:** `/admin/users/new`
**File:** `app/(admin)/admin/users/new/page.tsx`

### Purpose

Create new user account (for support/testing).

### Components Used

| Component | Purpose |
|-----------|---------|
| `CreateUserForm` | User creation form |

### Form Fields

| Field | Required | Description |
|-------|----------|-------------|
| Email | Yes | User email address |
| Name | No | Display name |
| Password | Yes | Initial password |
| Role | Yes | USER or ADMIN |
| Tier | Yes | free, pro, or elite |
| Email Verified | No | Skip email verification |

---

## Subscriptions Page

**Route:** `/admin/subscriptions`
**File:** `app/(admin)/admin/subscriptions/page.tsx`

### Purpose

Manage Stripe subscriptions and sync status.

### Search Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `userId` | string | - | Filter by user |
| `status` | enum | - | active, canceled, past_due |
| `tier` | enum | - | pro, elite |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort direction |

### Components Used

| Component | Purpose |
|-----------|---------|
| `SubscriptionsTable` | Paginated subscription list |
| `SubscriptionFilters` | Filter controls |
| `BulkSyncButton` | Sync with Stripe |

### Features

- Subscription status indicators
- Stripe sync status
- Bulk sync with Stripe
- View in Stripe dashboard link
- Cancel subscription

---

## Subscription Detail Page

**Route:** `/admin/subscriptions/[id]`
**File:** `app/(admin)/admin/subscriptions/[id]/page.tsx`

### Purpose

Detailed view of individual Stripe subscription.

### Components Used

| Component | Purpose |
|-----------|---------|
| `SubscriptionDetailClient` | Main detail view |

### Information Displayed

- Subscription ID
- User details
- Current plan/tier
- Status (active, canceled, etc.)
- Current period dates
- Next billing date
- Payment method
- Invoice history

---

## Payments Page

**Route:** `/admin/payments`
**File:** `app/(admin)/admin/payments/page.tsx`

### Purpose

View and manage crypto payments from NowPayments.

### Search Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `userId` | string | - | Filter by user |
| `email` | string | - | Search by email |
| `paymentStatus` | enum | - | waiting, confirming, finished, failed |
| `tier` | enum | - | pro, elite |
| `paymentId` | string | - | NowPayments payment ID |
| `invoiceId` | string | - | NowPayments invoice ID |
| `orderId` | string | - | Order ID |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

### Components Used

| Component | Purpose |
|-----------|---------|
| `PaymentsPageClient` | Main payments view |
| `PaymentsTable` | Paginated payment list |
| `PaymentFilters` | Filter controls |
| `CreatePaymentDialog` | Create payment from NowPayments |

### Features

- Payment status tracking
- Currency display with formatting
- NowPayments ID links
- Create payment from webhook data
- Tier mismatch detection
- Manual payment creation

---

## Revenue Page

**Route:** `/admin/revenue`
**File:** `app/(admin)/admin/revenue/page.tsx`

### Purpose

Revenue analytics with charts and breakdowns.

### Components Used

| Component | Purpose |
|-----------|---------|
| `RevenueAnalyticsClient` | Main analytics view |

### Features

1. **Summary Cards**
   - Total revenue
   - This month revenue
   - Average payment
   - Growth rate

2. **Time-Series Charts**
   - Daily revenue
   - Monthly revenue
   - Payment method breakdown

3. **Period Selectors**
   - 1 day
   - 7 days
   - 30 days
   - 90 days
   - 1 year

4. **Breakdown Tables**
   - Revenue by tier
   - Revenue by payment method
   - Top paying users

---

## Promo Codes Page

**Route:** `/admin/promo-codes`
**File:** `app/(admin)/admin/promo-codes/page.tsx`

### Purpose

Create and manage promotional discount codes.

### Search Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | enum | all | active, inactive, expired, all |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort direction |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

### Components Used

| Component | Purpose |
|-----------|---------|
| `PromoCodesPageClient` | Main promo codes view |
| `PromoCodesTable` | Code list with actions |
| `CreatePromoCodeDialog` | Create new code |
| `EditPromoCodeDialog` | Edit existing code |
| `ViewPromoCodeDialog` | View code details |
| `DeletePromoCodeDialog` | Delete confirmation |

### Promo Code Fields

| Field | Description |
|-------|-------------|
| Code | Unique code string (auto-uppercase) |
| Discount % | Percentage discount (1-100) |
| Max Uses | Maximum number of uses |
| Current Uses | How many times used |
| Valid Until | Expiration date |
| Payment Method | STRIPE, CRYPTO, or ALL |
| Active | Enable/disable toggle |

---

## Audit Page

**Route:** `/admin/audit`
**File:** `app/(admin)/admin/audit/page.tsx`

### Purpose

View audit logs of all admin actions.

### Search Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `actorUserId` | string | - | Filter by admin user |
| `action` | string | - | Filter by action type |
| `targetType` | string | - | Filter by target type |
| `targetId` | string | - | Filter by target ID |
| `startDate` | date | - | Start date filter |
| `endDate` | date | - | End date filter |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

### Components Used

| Component | Purpose |
|-----------|---------|
| `AuditLogTable` | Paginated log list |
| `AuditFilters` | Filter controls |
| `AuditLogDetailsDialog` | View log details |

### Logged Actions

- User creation
- User update
- User deletion
- Tier changes
- Status changes
- Subscription modifications
- Payment actions
- Settings changes
- Login events

### Log Entry Fields

| Field | Description |
|-------|-------------|
| Timestamp | When action occurred |
| Actor | Admin who performed action |
| Action | Type of action |
| Target Type | User, Subscription, etc. |
| Target ID | ID of affected entity |
| Details | JSON with action details |
| IP Address | Actor's IP address |

---

## Metrics Page

**Route:** `/admin/metrics`
**File:** `app/(admin)/admin/metrics/page.tsx`

### Purpose

System health metrics and performance data.

### Components Used

| Component | Purpose |
|-----------|---------|
| `MetricsCards` | Key metric cards |
| `SystemHealth` | Health indicators |
| `RevenueChart` | Revenue trend |
| `UserGrowthChart` | User growth trend |

### Metrics Displayed

1. **User Metrics**
   - Total users
   - Active users (24h)
   - New signups (7d)
   - Tier distribution

2. **System Health**
   - Database status
   - API response time
   - WebSocket connections
   - Error rate

3. **Performance**
   - Request latency
   - Cache hit rate
   - Memory usage

---

## Settings Page

**Route:** `/admin/settings`
**File:** `app/(admin)/admin/settings/page.tsx`

### Purpose

Platform configuration and admin settings.

### Components Used

| Component | Purpose |
|-----------|---------|
| `SettingsForm` | General settings |
| `SecuritySettings` | Security configuration |
| `TwoFactorSettings` | 2FA setup |
| `AdminWalletManagement` | Wallet addresses |
| `WalletBalances` | View balances |

### Settings Sections

1. **General Settings**
   - Platform name
   - Support email
   - Feature flags

2. **Security Settings**
   - Session timeout
   - Password requirements
   - Login attempt limits

3. **Two-Factor Authentication**
   - Enable/disable 2FA
   - Generate QR code
   - Backup codes

4. **Wallet Management**
   - EVM receiving address
   - Solana receiving address
   - View balances

---

## Assets Page

**Route:** `/admin/assets`
**File:** `app/(admin)/admin/assets/page.tsx`

### Purpose

Manage cryptocurrency asset metadata (from CoinGecko).

### Components Used

| Component | Purpose |
|-----------|---------|
| `AssetsTable` | Asset list view |
| `AssetCardView` | Card grid view |

### Features

- View all tracked assets
- Asset enrichment status
- CoinGecko sync status
- Manual refresh trigger
- View asset details

---

## OI Alerts Page

**Route:** `/admin/oi-alerts`
**File:** `app/(admin)/admin/oi-alerts/page.tsx`

### Purpose

View Open Interest alerts history.

### Features

- OI alert history
- Alert statistics
- Filter by symbol
- Filter by direction (UP/DOWN)
- View alert details

---

## Alert Preview Page

**Route:** `/admin/alert-preview`
**File:** `app/(admin)/admin/alert-preview/page.tsx`

### Purpose

Test and preview alert styling/animations.

### Features

- Generate test volume alerts
- Generate test OI alerts
- Preview alert animations
- Test sound effects
- Debug alert rendering

---

## News Page

**Route:** `/admin/news`
**File:** `app/(admin)/admin/news/page.tsx`

### Purpose

Manage RSS news feeds and articles.

### Components Used

| Component | Purpose |
|-----------|---------|
| `NewsReviewClient` | News management |

### Features

- View news sources
- Add/remove RSS feeds
- Mark articles as relevant
- View article details
- Refresh feeds

---

## Telegram Page

**Route:** `/admin/telegram`
**File:** `app/(admin)/admin/telegram/page.tsx`

### Purpose

Monitor Telegram channel messages.

### Components Used

| Component | Purpose |
|-----------|---------|
| `TelegramMonitorClient` | Message viewer |

### Features

- View channel messages
- Mark as relevant
- Message statistics
- Channel configuration

---

## Notifications Page

**Route:** `/admin/notifications`
**File:** `app/(admin)/admin/notifications/page.tsx`

### Purpose

View and manage admin notifications.

### Components Used

| Component | Purpose |
|-----------|---------|
| `AdminNotificationsTable` | Notification list |

### Notification Types

- Payment failures
- Tier mismatches
- System alerts
- User reports

---

## Admin Components Reference

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `AdminLayout` | `layout/admin-layout.tsx` | Main layout wrapper |
| `AdminHeader` | `layout/admin-header.tsx` | Top navigation |
| `AdminSidebar` | `layout/admin-sidebar.tsx` | Side navigation |
| `AdminPageHeader` | `layout/admin-page-header.tsx` | Page title header |
| `SystemStatusIndicator` | `layout/system-status-indicator.tsx` | Health indicator |

### Dashboard Components

| Component | File | Purpose |
|-----------|------|---------|
| `StatsCards` | `dashboard/stats-cards.tsx` | Metric cards |
| `RevenueChart` | `dashboard/revenue-chart.tsx` | Revenue graph |
| `UserGrowthChart` | `dashboard/user-growth-chart.tsx` | Growth graph |
| `RecentActivity` | `dashboard/recent-activity.tsx` | Activity feed |
| `QuickActions` | `dashboard/quick-actions.tsx` | Action buttons |
| `SystemHealth` | `dashboard/system-health.tsx` | Health status |
| `WalletBalances` | `dashboard/wallet-balances.tsx` | Crypto balances |
| `RevenueBreakdown` | `dashboard/revenue-breakdown.tsx` | Revenue by type |
| `MultiChainEthBalance` | `dashboard/multi-chain-eth-balance.tsx` | ETH on all chains |

### User Components

| Component | File | Purpose |
|-----------|------|---------|
| `UsersTable` | `users/users-table.tsx` | User list |
| `UserFilters` | `users/user-filters.tsx` | Filter controls |
| `UserActions` | `users/user-actions.tsx` | Bulk actions |
| `UserDetailClient` | `users/user-detail-client.tsx` | User detail view |
| `CreateUserForm` | `users/create-user-form.tsx` | New user form |

### Subscription Components

| Component | File | Purpose |
|-----------|------|---------|
| `SubscriptionsTable` | `subscriptions/subscriptions-table.tsx` | Sub list |
| `SubscriptionFilters` | `subscriptions/subscription-filters.tsx` | Filters |
| `BulkSyncButton` | `subscriptions/bulk-sync-button.tsx` | Stripe sync |
| `SubscriptionDetailClient` | `subscriptions/subscription-detail-client.tsx` | Detail view |
| `SyncResultDialog` | `subscriptions/sync-result-dialog.tsx` | Sync results |

### Payment Components

| Component | File | Purpose |
|-----------|------|---------|
| `PaymentsPageClient` | `payments/payments-page-client.tsx` | Main view |
| `PaymentsTable` | `payments/payments-table.tsx` | Payment list |
| `PaymentFilters` | `payments/payment-filters.tsx` | Filter controls |
| `CreatePaymentDialog` | `payments/create-payment-dialog.tsx` | Create from NP |

### Promo Code Components

| Component | File | Purpose |
|-----------|------|---------|
| `PromoCodesPageClient` | `promo-codes/promo-codes-page-client.tsx` | Main view |
| `PromoCodesTable` | `promo-codes/promo-codes-table.tsx` | Code list |
| `CreatePromoCodeDialog` | `promo-codes/create-promo-code-dialog.tsx` | Create code |
| `EditPromoCodeDialog` | `promo-codes/edit-promo-code-dialog.tsx` | Edit code |
| `ViewPromoCodeDialog` | `promo-codes/view-promo-code-dialog.tsx` | View details |
| `DeletePromoCodeDialog` | `promo-codes/delete-promo-code-dialog.tsx` | Delete confirm |

### Audit Components

| Component | File | Purpose |
|-----------|------|---------|
| `AuditLogTable` | `audit/audit-log-table.tsx` | Log list |
| `AuditFilters` | `audit/audit-filters.tsx` | Filter controls |
| `AuditLogDetailsDialog` | `audit/audit-log-details-dialog.tsx` | Log details |

### Settings Components

| Component | File | Purpose |
|-----------|------|---------|
| `SettingsForm` | `settings/settings-form.tsx` | General settings |
| `SecuritySettings` | `settings/security-settings.tsx` | Security config |
| `TwoFactorSettings` | `settings/two-factor-settings.tsx` | 2FA setup |
| `AdminWalletManagement` | `settings/admin-wallet-management.tsx` | Wallet config |
| `WalletBalances` | `settings/wallet-balances.tsx` | View balances |

### Metrics Components

| Component | File | Purpose |
|-----------|------|---------|
| `MetricsCards` | `metrics/metrics-cards.tsx` | Metric display |
| `SystemHealth` | `metrics/system-health.tsx` | Health status |
| `RevenueChart` | `metrics/revenue-chart.tsx` | Revenue graph |
| `UserGrowthChart` | `metrics/user-growth-chart.tsx` | Growth graph |

### Asset Components

| Component | File | Purpose |
|-----------|------|---------|
| `AssetsTable` | `assets/assets-table.tsx` | Asset list |
| `AssetCardView` | `assets/asset-card-view.tsx` | Card grid |

### Notification Components

| Component | File | Purpose |
|-----------|------|---------|
| `AdminNotificationBell` | `notifications/admin-notification-bell.tsx` | Bell icon |
| `AdminNotificationsTable` | `notifications/admin-notifications-table.tsx` | Notification list |

### Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `AdminBackgroundSync` | `admin-background-sync.tsx` | Background data sync |

---

## Pagination Pattern

All admin tables use smart pagination:

```typescript
// Smart ellipsis pagination
// Shows: 1 ... 4 5 6 ... 10
// Centers current page with neighbors
// Max 7 page buttons

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 3) {
    pages.push('ellipsis')
  }

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }

  if (current < total - 2) {
    pages.push('ellipsis')
  }

  pages.push(total)

  return pages
}
```

---

## Error Handling

All pages include error boundaries:

```typescript
try {
    const data = await adminAPI.getData(query)
    return <SuccessView data={data} />
} catch (error) {
    console.error('Error:', error)
    return (
        <AdminLayout>
            <ErrorView message="Failed to load data" />
        </AdminLayout>
    )
}
```

Error views include:
- Error icon
- User-friendly message
- Debug info (development only)
- Refresh suggestion

---

## Next: [Digital Ocean Scripts](18-DIGITAL-OCEAN.md)
