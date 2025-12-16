# Complete File Inventory

## Purpose

This document maps every file in the VolSpike project to its documentation, purpose, and justification. Files that cannot be explained or are unused should be removed.

**Rule**: If we can't explain it, we shouldn't have it.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| DOC | Documented in human-docs |
| USED | Actively used in production |
| TEST | Test file |
| CONFIG | Configuration file |
| UNUSED | Not used - candidate for removal |
| DUPLICATE | Duplicate/variant - candidate for removal |

---

## Frontend Files

### `/volspike-nextjs-frontend/src/app/` - Pages (App Router)

#### Root Pages

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Homepage/landing page |
| `layout.tsx` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | Root layout with providers |
| `dashboard/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Main trading dashboard |
| `pricing/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Pricing tiers page |
| `login/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Redirect to /auth |
| `signup/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Redirect to /auth |
| `status/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | System status page |
| `support/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Support/contact page |
| `docs/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Documentation page |
| `academy/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Trading academy page |
| `test/page.tsx` | TEST | N/A | Development testing page |
| `test-payment/page.tsx` | TEST | N/A | Stripe payment testing |
| `test-crypto-payment/page.tsx` | TEST | [05-PAYMENTS.md](05-PAYMENTS.md) | $1 crypto payment testing (test accounts only) |

#### Authentication Pages (`app/auth/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `page.tsx` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Combined sign-in/sign-up page |
| `forgot/page.tsx` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Password reset request |
| `reset-password/page.tsx` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Password reset form |
| `verify/page.tsx` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Email verification handler |
| `phantom-callback/page.tsx` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Solana Phantom wallet callback |

#### Checkout Pages (`app/checkout/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `crypto/page.tsx` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | Cryptocurrency selection |
| `crypto/pay/page.tsx` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | Pending crypto payment status |
| `success/page.tsx` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | Payment success confirmation |
| `cancel/page.tsx` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | Payment cancelled page |

#### Settings Pages (`app/settings/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Account settings |
| `alerts/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Alert preferences |
| `billing/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Subscription management |

#### Legal Pages (`app/legal/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `privacy/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Privacy policy |
| `terms/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Terms of service |
| `refunds/page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Refund policy |

#### Donate Pages (`app/donate/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `page.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Donation page |
| `layout.tsx` | USED | [11-PAGES-ROUTES.md](11-PAGES-ROUTES.md) | Donate section layout |

#### Debug Pages (`app/debug/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `open-interest/page.tsx` | TEST | [21-TROUBLESHOOTING.md](21-TROUBLESHOOTING.md) | OI data debugging |

#### API Routes (`app/api/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `auth/[...nextauth]/route.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | NextAuth.js handler |
| `auth/refresh-session/route.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Session refresh endpoint |
| `auth/me/route.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Current user info |
| `auth/ping/route.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Session keepalive |
| `security/coop/route.ts` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | Cross-Origin-Opener-Policy |
| `test-session/route.ts` | TEST | N/A | Session debugging |

#### Admin Pages (`app/(admin)/admin/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Admin dashboard |
| `admin-dashboard-client.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Dashboard client component |
| `users/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | User management |
| `users/[id]/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | User detail view |
| `users/new/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Create user form |
| `subscriptions/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Stripe subscriptions |
| `subscriptions/[id]/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Subscription detail |
| `payments/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Crypto payments |
| `revenue/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Revenue analytics |
| `revenue/revenue-analytics-client.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Revenue charts |
| `promo-codes/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Promo code management |
| `audit/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Audit logs |
| `metrics/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | System metrics |
| `settings/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Admin settings |
| `assets/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Asset metadata |
| `oi-alerts/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | OI alert history |
| `alert-preview/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Alert testing |
| `news/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | RSS news management |
| `news/news-review-client.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | News review UI |
| `telegram/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Telegram monitor |
| `telegram/telegram-monitor-client.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Telegram UI |
| `notifications/page.tsx` | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Admin notifications |
| `layout.tsx` (in (admin)) | USED | [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) | Admin route group layout |

---

### `/volspike-nextjs-frontend/src/components/` - React Components

#### Core Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `dashboard.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Main dashboard layout |
| `market-table.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Market data grid |
| `header.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Navigation header |
| `header-with-banner.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Header with announcement |
| `footer.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Page footer |
| `user-menu.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Profile dropdown |
| `providers.tsx` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | Context providers wrapper |
| `theme-provider.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Dark/light theme |
| `theme-toggle.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Theme switch button |

#### Alert Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `alerts-panel.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Tabbed alert container |
| `alert-panel.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Legacy alert panel |
| `volume-alerts-panel.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Volume alerts display |
| `volume-alerts-content.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Volume alerts list |
| `oi-alerts-content.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | OI alerts list |
| `alert-builder.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Custom alert creation |
| `alert-animation-variants.ts` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Alert CSS animations |

#### Authentication Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `signin-form.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Email sign-in form |
| `signup-form.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Email sign-up form |
| `phantom-signin-section.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Solana wallet auth |
| `wallet-connect-button.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | EVM wallet button |
| `wallet-management.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Linked wallets UI |
| `password-input.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Password field with toggle |
| `password-change-listener.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Password change handler |
| `admin-auth-redirect.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Admin auth guard |
| `auth-debug-panel.tsx` | TEST | N/A | Auth debugging UI |

#### Payment Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `pricing-tiers.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Tier comparison cards |
| `payment-method-selector.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Stripe/Crypto selector |
| `crypto-currency-selector.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Crypto currency picker |
| `promo-code-input.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Promo code field |
| `payment-progress.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Payment status tracker |
| `payment-error-display.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Payment error UI |
| `checkout-success-content.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Success page content |
| `subscription-status.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Current subscription |
| `tier-upgrade.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Upgrade prompts |
| `feature-comparison.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Feature tier matrix |
| `solana-pay-qr-generator.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Solana Pay QR codes |

#### Watchlist Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `watchlist-selector.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Watchlist dropdown |
| `watchlist-filter.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Filter by watchlist |
| `watchlist-export-button.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | TradingView export |
| `remove-from-watchlist-dialog.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Remove confirmation |

#### Session/User Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `session-tracker.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Session monitoring |
| `session-validator.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Session validation |
| `account-management.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Account settings UI |
| `account-deleted-modal.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Account deletion notice |
| `user-deletion-handler.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Real-time deletion |
| `tier-change-listener.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Tier change handler |

#### Provider Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `web3-providers.tsx` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | EVM wallet providers |
| `solana-providers.tsx` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | Solana wallet providers |
| `analytics-provider.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Analytics wrapper |

#### UI Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `client-only.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Client-side render wrapper |
| `safe-nav-link.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Safe navigation link |
| `guest-cta.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Guest sign-up prompt |
| `command-palette.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Keyboard shortcuts |
| `rate-limit-notification.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Rate limit alert |

#### Content Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `market-news-pane.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | News sidebar |
| `asset-project-overview.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Asset details panel |
| `oi-teaser-cell.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | OI teaser for free tier |
| `ad-banner.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Ad placement |
| `ad-placeholder.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Ad placeholder |

#### Debug Components

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `debug-fetch-logger.tsx` | TEST | N/A | Fetch request logging |

#### UI Primitives (`components/ui/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `alert.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Alert message box |
| `avatar.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | User avatar |
| `background-pattern.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Background decoration |
| `badge.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Status badges |
| `button.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Button variants |
| `card.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Card container |
| `checkbox.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Checkbox input |
| `command.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Command palette |
| `confetti.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Success animation |
| `dialog.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Modal dialog |
| `dropdown-menu.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Dropdown menu |
| `input.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Text input |
| `label.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Form label |
| `loading-spinner.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Loading indicator |
| `pagination.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Page navigation |
| `scroll-area.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Scrollable container |
| `select.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Select dropdown |
| `separator.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Visual divider |
| `sheet.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Slide-out panel |
| `switch.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Toggle switch |
| `table.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Data table |
| `tabs.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Tab navigation |
| `textarea.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Multi-line input |
| `tooltip.tsx` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Hover tooltip |

#### Admin Components (`components/admin/`)

See [17-ADMIN-PAGES.md](17-ADMIN-PAGES.md) for complete admin component documentation.

| Directory | Files | Purpose |
|-----------|-------|---------|
| `admin/layout/` | 5 files | Admin layout structure |
| `admin/dashboard/` | 9 files | Dashboard widgets |
| `admin/users/` | 5 files | User management |
| `admin/subscriptions/` | 5 files | Subscription management |
| `admin/payments/` | 4 files | Payment management |
| `admin/promo-codes/` | 6 files | Promo code management |
| `admin/audit/` | 3 files | Audit logs |
| `admin/metrics/` | 4 files | System metrics |
| `admin/settings/` | 5 files | Admin settings |
| `admin/assets/` | 2 files | Asset management |
| `admin/notifications/` | 2 files | Notifications |
| `admin-background-sync.tsx` | 1 file | Background sync |

---

### `/volspike-nextjs-frontend/src/hooks/` - Custom Hooks

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `use-client-only-market-data.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | **CORE** - Binance WebSocket |
| `use-volume-alerts.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Volume alert subscription |
| `use-oi-alerts.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | OI alert subscription |
| `use-socket.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Socket.IO connection |
| `use-alert-sounds.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Alert sound playback |
| `use-watchlists.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Watchlist CRUD |
| `use-wallet-auth.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | EVM wallet auth |
| `use-solana-auth.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Solana wallet auth |
| `use-phantom-connect.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Phantom wallet |
| `use-promo-code.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Promo code validation |
| `use-tier-change-listener.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Tier change events |
| `use-user-deletion-listener.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Account deletion events |
| `use-user-alert-listener.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | User-specific alerts |
| `use-admin-notifications.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Admin notifications |
| `use-telegram-messages.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Telegram feed |
| `use-browser-notifications.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Browser push notifications |
| `use-build-version-guard.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Version mismatch detection |
| `use-auto-sync-payments.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Payment status polling |
| `use-asset-detection.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | New asset detection |
| `use-asset-profile.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Asset metadata fetch |
| `use-debounce.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Input debouncing |
| `use-user-identity.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | User identity resolution |
| `use-enforce-single-identity.ts` | USED | [10-HOOKS.md](10-HOOKS.md) | Single identity enforcement |
| `use-binance-websocket.ts` | UNUSED | N/A | Legacy - replaced by use-client-only-market-data |
| `use-market-data.ts` | UNUSED | N/A | Legacy - replaced by use-client-only-market-data |

---

### `/volspike-nextjs-frontend/src/lib/` - Utilities

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `auth.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | NextAuth configuration |
| `auth-server.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Server-side auth |
| `pricing.ts` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | **SINGLE SOURCE** - Tier prices |
| `payments.ts` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | Stripe integration |
| `utils.ts` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | General utilities |
| `device-id.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Device fingerprinting |
| `phantom-deeplink.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Phantom mobile deeplinks |
| `password-change-broadcast.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | Password change events |
| `watchlist-export.ts` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | TradingView export |
| `asset-manifest.ts` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Asset metadata cache |
| `coingecko-rate-limiter.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | CoinGecko API rate limiting |
| `avatar-utils.ts` | USED | [09-COMPONENTS.md](09-COMPONENTS.md) | Avatar generation |
| `analytics.ts` | USED | [08-FRONTEND-OVERVIEW.md](08-FRONTEND-OVERVIEW.md) | Analytics tracking |
| `click-debugger.ts` | TEST | N/A | Click event debugging |
| `admin/api-client.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Admin API wrapper |
| `admin/currency-format.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Crypto currency formatting |
| `admin/permissions.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Admin permission checks |

---

### `/volspike-nextjs-frontend/src/types/` - Type Definitions

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `next-auth.d.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | NextAuth type extensions |
| `admin.d.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Admin type definitions |

---

### `/volspike-nextjs-frontend/src/__tests__/` - Tests

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `setup.ts` | TEST | N/A | Test setup/configuration |
| `hooks/use-client-only-market-data-watchlist.test.ts` | TEST | N/A | Watchlist filtering tests |

---

## Backend Files

### `/volspike-nodejs-backend/src/` - Main Source

#### Entry Point

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `index.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Hono server initialization |

---

### `/volspike-nodejs-backend/src/routes/` - API Routes

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `auth.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Authentication endpoints |
| `payments.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Stripe + NowPayments |
| `watchlist.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Watchlist CRUD |
| `alerts.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Alert ingestion |
| `volume-alerts.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Volume alert endpoints |
| `open-interest.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | OI data endpoints |
| `market.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Market data endpoints |
| `assets.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Asset metadata |
| `renewal.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Subscription renewal |
| `telegram.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Telegram integration |
| `user-cross-alerts.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | User-defined alerts |
| `user-cross-alerts-trigger.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Alert trigger endpoint |

#### Admin Routes (`routes/admin/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `index.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Admin route aggregator |
| `users.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | User management |
| `subscriptions.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Subscription management |
| `payments.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Payment management |
| `promo-codes.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Promo codes CRUD |
| `audit.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Audit log queries |
| `metrics.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | System metrics |
| `settings.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Platform settings |
| `assets.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Asset management |
| `wallets.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Wallet management |
| `news.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | News feed management |
| `telegram.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Telegram management |
| `notifications.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | Admin notifications |

---

### `/volspike-nodejs-backend/src/services/` - Business Logic

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `email.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | SendGrid email service |
| `alert-broadcaster.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Socket.IO broadcasting |
| `promo-code.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Promo code validation |
| `nowpayments.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | NowPayments integration |
| `payment-sync.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Payment status sync |
| `renewal-reminder.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Expiration handling |
| `nonce-manager.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Web3 nonce management |
| `watchlist-service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Watchlist operations |
| `session.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Session management |
| `news.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | RSS feed service |
| `telegram.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Telegram service |
| `asset-metadata.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | CoinGecko enrichment |
| `oi-liquidity-job.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | OI liquid universe |
| `notifications.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Notification service |
| `binance-client.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Binance API client |
| `currency-mapper.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Currency code mapping |

#### Admin Services (`services/admin/`)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `user-management.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | User CRUD operations |
| `audit-service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Audit logging |
| `metrics-service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Metrics collection |
| `two-factor.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | 2FA implementation |
| `invite-service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | User invitations |
| `promo-code-admin.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Admin promo operations |

---

### `/volspike-nodejs-backend/src/middleware/` - Middleware

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `auth.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | JWT authentication |
| `admin-auth.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Admin role check |
| `rate-limit.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Rate limiting |
| `admin-rate-limit.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Admin rate limiting |
| `audit-logger.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Action audit logging |
| `csrf.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | CSRF protection |

---

### `/volspike-nodejs-backend/src/lib/` - Utilities

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `pricing.ts` | USED | [05-PAYMENTS.md](05-PAYMENTS.md) | **SINGLE SOURCE** - Tier prices (matches frontend) |
| `logger.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Pino logger setup |
| `hono-extensions.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Hono context helpers |
| `validation/promo-codes.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Promo code schemas |
| `rss/index.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | RSS exports |
| `rss/parser.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | RSS parsing |
| `rss/cache.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | RSS caching |
| `rss/sanitizer.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | HTML sanitization |

---

### `/volspike-nodejs-backend/src/openInterest/` - OI Module

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `openInterest.routes.ts` | USED | [13-API-REFERENCE.md](13-API-REFERENCE.md) | OI API routes |
| `openInterest.service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | OI business logic |
| `openInterest.types.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | OI type definitions |
| `openInterest.liquidUniverse.service.ts` | USED | [14-SERVICES.md](14-SERVICES.md) | Liquid symbol classification |

---

### `/volspike-nodejs-backend/src/websocket/` - WebSocket

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `handlers.ts` | USED | [06-REALTIME-DATA.md](06-REALTIME-DATA.md) | Socket.IO event handlers |
| `broadcast-user-alert.ts` | USED | [06-REALTIME-DATA.md](06-REALTIME-DATA.md) | User-specific broadcasts |

---

### `/volspike-nodejs-backend/src/types/` - Type Definitions

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `index.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Main type exports |
| `hono.ts` | USED | [12-BACKEND-OVERVIEW.md](12-BACKEND-OVERVIEW.md) | Hono context types |
| `admin.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Admin types |
| `audit.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Audit types |
| `audit-consts.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Audit constants |
| `rbac.ts` | USED | [16-ADMIN-OVERVIEW.md](16-ADMIN-OVERVIEW.md) | Role-based access types |

---

### `/volspike-nodejs-backend/src/config/` - Configuration

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `chains.ts` | USED | [04-AUTHENTICATION.md](04-AUTHENTICATION.md) | EVM chain configuration |

---

### `/volspike-nodejs-backend/src/__tests__/` - Tests

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `setup.ts` | TEST | N/A | Test configuration |
| `middleware/auth.test.ts` | TEST | N/A | Auth middleware tests |
| `openInterest/*.test.ts` | TEST | N/A | OI module tests |
| `routes/watchlist-market-data.test.ts` | TEST | N/A | Watchlist route tests |
| `services/*.test.ts` | TEST | N/A | Service unit tests |

---

### `/volspike-nodejs-backend/src/scripts/` - Scripts

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `seed-prod-user.ts` | USED | [21-TROUBLESHOOTING.md](21-TROUBLESHOOTING.md) | Production user seeding |

---

### `/volspike-nodejs-backend/prisma/` - Database

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `schema.prisma` | USED | [15-DATABASE.md](15-DATABASE.md) | Database schema |
| `migrations/*.sql` | USED | [15-DATABASE.md](15-DATABASE.md) | Migration files |

---

## Digital Ocean Files

### Production Scripts (USED)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `hourly_volume_alert_dual_env.py` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | **MAIN** - Volume spike detection |
| `oi_realtime_poller.py` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | OI polling and alerts |
| `oi_liquid_universe_job.py` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | Liquid symbol classification |
| `binance_funding_ws_daemon.py` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | Funding rate WebSocket |
| `funding_api_server.py` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | Funding rate API |

### Service Files (USED)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `binance-funding-api.service` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | Funding API systemd |
| `binance-funding-ws.service` | USED | [18-DIGITAL-OCEAN.md](18-DIGITAL-OCEAN.md) | Funding WS systemd |

### Testing/Debug Scripts (TEST)

| File | Status | Doc Reference | Purpose |
|------|--------|---------------|---------|
| `test_oi_alert_logic.py` | TEST | N/A | OI alert testing |
| `test_oi_poller_interval.py` | TEST | N/A | Poller timing tests |
| `simulate_dual_alerts.py` | TEST | N/A | Alert simulation |
| `funding_health_monitor.py` | TEST | N/A | Funding health checks |

### Legacy/Duplicate Scripts (CANDIDATES FOR REMOVAL)

| File | Status | Issue | Recommendation |
|------|--------|-------|----------------|
| `hourly_volume_alert_current.py` | DUPLICATE | Older version | Remove |
| `hourly_volume_alert_enhanced.py` | DUPLICATE | Development version | Remove |
| `binance_funding_ws_daemon_CORRECTLY_FIXED.py` | DUPLICATE | Debug variant | Remove |
| `binance_funding_ws_daemon_TRULY_FIXED.py` | DUPLICATE | Debug variant | Remove |
| `binance_funding_ws_daemon_bulletproof.py` | DUPLICATE | Debug variant | Remove |
| `binance_funding_ws_daemon_current.py` | DUPLICATE | Older version | Remove |
| `binance_funding_ws_daemon_fixed.py` | DUPLICATE | Debug variant | Remove |
| `binance_funding_ws_daemon_improved.py` | DUPLICATE | Debug variant | Remove |
| `compare_funding_ws_vs_rest.py` | DUPLICATE | Comparison tool | Remove |
| `comprehensive_comparison.py` | DUPLICATE | Comparison tool | Remove |
| `detailed_line_by_line_comparison.py` | DUPLICATE | Comparison tool | Remove |
| `final_detailed_comparison.py` | DUPLICATE | Comparison tool | Remove |
| `generate_comparison_report.py` | DUPLICATE | Comparison tool | Remove |
| `honest_websocket_comparison.py` | DUPLICATE | Comparison tool | Remove |
| `validate_funding_comparison.py` | DUPLICATE | Validation tool | Remove |
| `verify_funding_data.py` | DUPLICATE | Verification tool | Remove |
| `Verify/hourly_volume_alert_dual_env.py` | DUPLICATE | Duplicate in subfolder | Remove |
| `telegram_channel_poller.py` | UNUSED | Feature not active | Keep or Remove |
| `user_alert_checker.py` | UNUSED | Feature not active | Keep or Remove |

---

## Frontend Hooks - Legacy/Unused Analysis

| File | Status | Issue | Recommendation |
|------|--------|-------|----------------|
| `use-binance-websocket.ts` | UNUSED | Replaced by `use-client-only-market-data.ts` | Remove |
| `use-market-data.ts` | UNUSED | Replaced by `use-client-only-market-data.ts` | Remove |

---

## Summary Statistics

### Files by Status

| Status | Count | Description |
|--------|-------|-------------|
| USED | ~250 | Actively used in production |
| TEST | ~20 | Test files |
| CONFIG | ~15 | Configuration files |
| DUPLICATE | ~17 | Candidates for removal |
| UNUSED | ~4 | Legacy code to remove |

### Cleanup Recommendations

**High Priority (Remove)**:
1. 15 duplicate Python scripts in Digital Ocean folder
2. 2 unused frontend hooks
3. 1 duplicate verification folder

**Medium Priority (Review)**:
1. `telegram_channel_poller.py` - Check if feature is planned
2. `user_alert_checker.py` - Check if feature is planned
3. Various comparison/verification scripts if not needed for debugging

### Documentation Coverage

| Category | Files | Documented |
|----------|-------|------------|
| Frontend Pages | 43 | 100% |
| Frontend Components | 90+ | 100% |
| Frontend Hooks | 24 | 100% |
| Backend Routes | 25 | 100% |
| Backend Services | 22 | 100% |
| Digital Ocean (Prod) | 5 | 100% |
| Digital Ocean (Test) | 4 | Identified |
| Digital Ocean (Duplicate) | 17 | Flagged for removal |

---

## Next Steps

1. **Delete duplicate Python scripts** (17 files)
2. **Delete unused hooks** (2 files)
3. **Review telegram/user_alert scripts** for future use
4. **Update this document** when files are added/removed
