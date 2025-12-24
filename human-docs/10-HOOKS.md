# Hooks Reference

## Overview

VolSpike has 26 custom React hooks that handle data fetching, authentication, real-time connections, and UI state. This document provides comprehensive documentation based on actual code review.

**Total Hooks**: 26 files in `/volspike-nextjs-frontend/src/hooks/`

---

## Market Data Hooks

### useClientOnlyMarketData (CRITICAL - CORE HOOK)

**File:** `src/hooks/use-client-only-market-data.ts`

The most important hook - handles direct Binance WebSocket connection with tier-based throttling and Open Interest integration.

**Signature:**
```typescript
function useClientOnlyMarketData({
  tier,
  onDataUpdate,
  watchlistSymbols
}: UseClientOnlyMarketDataProps): {
  data: MarketData[]
  status: 'connecting' | 'live' | 'reconnecting' | 'error'
  lastUpdate: number
  nextUpdate: number  // Always 0 for real-time
  isLive: boolean
  isConnecting: boolean
  isReconnecting: boolean
  hasError: boolean
  openInterestAsOf: number
}
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `tier` | `'free' \| 'pro' \| 'elite'` | User's subscription tier |
| `onDataUpdate` | `(data: MarketData[]) => void` | Callback when data updates |
| `watchlistSymbols` | `string[]` | Symbols to always include (bypass tier limits) |

**Key Implementation Details:**
- WebSocket URL: `wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr`
- Bootstrap window: 900ms to collect data, minimum 30 symbols
- Debounced rendering: 200ms between renders
- Exponential backoff reconnection: 1s, 2s, 4s... up to 30s
- Geofence fallback: Uses localStorage if WebSocket fails after 3s

**State Management (Internal):**
- `tickersRef` - Map of ticker data
- `fundingRef` - Map of funding rates
- `openInterestRef` - Map of OI data
- `allowedSymbolsRef` - Binance whitelist from exchangeInfo
- `symbolPrecisionRef` - Decimal precision per symbol

**Side Effects & Subscriptions:**
- WebSocket connection on mount
- OI polling every 5 minutes (wall-clock aligned)
- Socket.IO listener for `open-interest-update` events
- Watchdog timer for stale OI data (6-minute threshold)

**API Calls:**
- `GET https://fapi.binance.com/fapi/v1/ticker/24hr` - Warm start seed
- `GET https://fapi.binance.com/fapi/v1/premiumIndex` - Seed funding rates
- `GET https://fapi.binance.com/fapi/v1/exchangeInfo` - Fetch active symbols
- `GET /api/market/open-interest` - Fetch OI from backend

**localStorage Keys:**
- `volspike:lastSnapshot` - Last market data snapshot
- `volspike:exchangeInfo:perpUsdt` - Cached symbol whitelist (1-hour TTL)
- `volspike:exchangeInfo:precision` - Cached price precision
- `vs:openInterest` - Cached OI data

**Environment Variables:**
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (default: Binance direct)
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_SOCKET_IO_URL` - Socket.IO URL

**Usage:**
```typescript
const { data, status, isLive, openInterestAsOf } = useClientOnlyMarketData({
  tier: user.tier,
  watchlistSymbols: watchlist?.symbols || [],
})
```

---

### useMarketData (LEGACY)

**File:** `src/hooks/use-market-data.ts`

**Status:** DEPRECATED - Replaced by `useClientOnlyMarketData`

Legacy hook using backend REST API for market data. Kept for backwards compatibility.

**Note:** This hook uses TanStack Query to fetch from `/api/market/data`. The new architecture uses client-side WebSocket instead.

---

### useBinanceWebSocket (LEGACY)

**File:** `src/hooks/use-binance-websocket.ts`

**Status:** DEPRECATED - Replaced by `useClientOnlyMarketData`

Low-level WebSocket management. Kept for backwards compatibility.

---

## Alert Hooks

### useVolumeAlerts

**File:** `src/hooks/use-volume-alerts.ts`

Manages volume spike alert subscription with tier-based batching and guest preview.

**Signature:**
```typescript
function useVolumeAlerts(options?: {
  pollInterval?: number      // Default: 15000ms
  autoFetch?: boolean        // Default: true
  onNewAlert?: (alert) => void
  guestLive?: boolean        // Default: false
  guestVisibleCount?: number // Default: 2
}): {
  alerts: VolumeAlert[]
  isLoading: boolean
  error: string | null
  tier: string
  isConnected: boolean
  nextUpdate: number  // ms until next batch (0 for Elite)
  refetch: () => void
}
```

**Wall-Clock Batching:**
- **Elite**: Real-time (nextUpdate = 0)
- **Pro**: :00, :05, :10, :15 (5-minute marks)
- **Free**: :00, :15, :30, :45 (15-minute marks)
- **Guest**: 3-second polling (guest-live mode)

**Tier-based Alert Limits:**
- Free: 10 alerts (2 visible in guest preview)
- Pro: 50 alerts
- Elite: 100 alerts
- Admin: 100 alerts

**Socket.IO Auth Methods:**
- Guest: `token: 'guest'`, `query: { tier: 'free' }`
- Wallet-only: `token: userId`, `query: { method: 'id' }`
- Email users: `token: email`

**API Calls:**
- `GET /api/volume-alerts?tier={tier}` - Fetch alerts
- Socket.IO `volume-alert` event subscription

**Usage:**
```typescript
const { alerts, isConnected, nextUpdate, refetch } = useVolumeAlerts({
  onNewAlert: (alert) => playSound('spike')
})
```

---

### useOIAlerts

**File:** `src/hooks/use-oi-alerts.ts`

Manages Open Interest alerts with tier-based access control (Pro/Elite only).

**Signature:**
```typescript
function useOIAlerts(options?: {
  autoFetch?: boolean
  onNewAlert?: (alert) => void
}): {
  alerts: OIAlert[]
  isLoading: boolean
  error: string | null
  isConnected: boolean
  canAccessOI: boolean  // Pro/Elite/Admin only
  userTier: string
  isAdmin: boolean
  maxAlerts: number     // 50 or 100 based on tier
  refetch: () => void
}
```

**Access Control:**
- Free: Denied (403)
- Pro: 50 alerts max
- Elite: 100 alerts max
- Admin: 100 alerts max

**API Calls:**
- `GET /api/open-interest-alerts?limit={maxAlerts}` with Bearer token
- Socket.IO `open-interest-alert` event subscription

---

### useAlertSounds

**File:** `src/hooks/use-alert-sounds.ts`

Manages alert notification sounds with Howler.js and Web Audio API fallbacks.

**Signature:**
```typescript
function useAlertSounds(options?: {
  enabled?: boolean  // Defaults from localStorage
  volume?: number    // 0-1, defaults from localStorage
}): {
  playSound: (type: 'spike' | 'half_update' | 'full_update') => void
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  volume: number
  setVolume: (volume: number) => void
  loading: boolean
  ensureUnlocked: () => void  // Resume audio context (mobile)
}
```

**Sound Types:**
- `spike` - New volume spike alert
- `half_update` - 30-minute update
- `full_update` - Hourly update

**Fallback System:**
1. Howler.js (MP3/WebM)
2. HTML5 Audio
3. Web Audio API (procedural synthesis)

**localStorage Keys:**
- `alertSoundsEnabled` - Boolean state
- `alertSoundsVolume` - Volume number (0-1)

**Usage:**
```typescript
const { enabled, setEnabled, playSound, ensureUnlocked } = useAlertSounds()

// Unlock audio on user interaction
onClick={() => ensureUnlocked()}

// On new alert
if (enabled) {
  playSound('spike')
}
```

---

### useUserAlertListener

**File:** `src/hooks/use-user-alert-listener.ts`

Listens for custom user alerts and displays toast + browser notifications.

**Signature:**
```typescript
function useUserAlertListener(): void
```

**Side Effects:**
- Listens for `user-alert-triggered` via Socket.IO
- Shows toast notification (react-hot-toast, 8s duration)
- Requests browser notification permission on first alert
- Shows browser notification if permitted

---

### useUserAlerts

**File:** `src/hooks/use-user-alerts.ts`

Centralized hook for managing user cross alerts (price, funding, OI). Used by market table for bell icon state and alerts page for CRUD operations.

**Signature:**
```typescript
function useUserAlerts(): {
  // Data
  alerts: UserAlert[]
  activeAlerts: UserAlert[]
  inactiveAlerts: UserAlert[]
  isLoading: boolean
  error: Error | null

  // Symbol checking
  hasActiveAlert: (symbol: string) => boolean
  getAlertsForSymbol: (symbol: string) => UserAlert[]
  getActiveAlertsForSymbol: (symbol: string) => UserAlert[]
  symbolsWithActiveAlerts: Set<string>

  // Mutations
  createAlert: (data: CreateAlertData) => void
  createAlertAsync: (data: CreateAlertData) => Promise<UserAlert>
  deleteAlert: (alertId: string) => void
  deleteAlertAsync: (alertId: string) => Promise<void>
  updateAlert: (params: { alertId: string; data: UpdateData }) => void
  updateAlertAsync: (params: { alertId: string; data: UpdateData }) => Promise<void>
  reactivateAlert: (alertId: string) => void
  reactivateAlertAsync: (alertId: string) => Promise<void>

  // Loading states
  isCreating: boolean
  isDeleting: boolean
  isUpdating: boolean
  isReactivating: boolean
}
```

**Symbol Normalization (CRITICAL):**

The hook normalizes symbols to ensure bell icon state syncs correctly:

```typescript
const normalizeSymbol = (symbol: string) => symbol.toUpperCase().replace(/USDT$/i, '')

// hasActiveAlert('BTCUSDT') matches alert stored as 'BTC' or 'BTCUSDT'
```

**Query Key:** `['user-cross-alerts']`

All mutations invalidate this key on success, causing immediate UI updates.

**API Calls:**
- `GET /api/user-alerts` - Fetch user's alerts
- `POST /api/user-alerts` - Create alert
- `PUT /api/user-alerts/:id` - Update alert
- `DELETE /api/user-alerts/:id` - Delete alert
- `POST /api/user-alerts/:id/reactivate` - Reactivate triggered alert

**Usage:**
```typescript
// In market-table.tsx - bell icon highlighting
const { hasActiveAlert } = useUserAlerts()
<Bell className={hasActiveAlert(item.symbol) ? 'fill-current' : ''} />

// In alert-builder.tsx - creating alerts
const { createAlertAsync, isCreating } = useUserAlerts()
await createAlertAsync({ symbol: 'BTCUSDT', alertType: 'PRICE_CROSS', threshold: 50000 })

// In alerts page - managing alerts
const { activeAlerts, deleteAlertAsync, updateAlertAsync } = useUserAlerts()
```

---

### useBrowserNotifications

**File:** `src/hooks/use-browser-notifications.ts`

Manages browser Push Notifications API integration.

**Signature:**
```typescript
function useBrowserNotifications(): {
  permission: NotificationPermission  // 'default' | 'granted' | 'denied'
  isSupported: boolean
  requestPermission: () => Promise<void>
  showNotification: (options: {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    requireInteraction?: boolean
  }) => void
}
```

---

## Authentication Hooks

### useWalletAuth

**File:** `src/hooks/use-wallet-auth.ts`

Complete EVM wallet authentication via SIWE (Sign-In with Ethereum).

**Signature:**
```typescript
function useWalletAuth(): {
  isConnecting: boolean
  isSigning: boolean
  isAuthenticating: boolean
  error: string | null
  signInWithWallet: () => Promise<void>
}
```

**Auth Flow:**
1. Check wallet connected via Wagmi
2. Get nonce from `GET /api/auth/siwe/nonce`
3. Prepare SIWE message from `GET /api/auth/siwe/prepare`
4. Sign message with wallet (via signMessageAsync)
5. Verify signature at `POST /api/auth/siwe/verify`
6. Create NextAuth session via `signIn('siwe', ...)`
7. Redirect to dashboard

**Wallet Linking:**
- If already authenticated, sends Authorization header with user ID
- Backend links wallet to existing account

**Dependencies:**
- `useAccount` - Wagmi (address, chainId, isConnected)
- `useSignMessage` - Wagmi sign message
- `useSession` - NextAuth session

---

### useSolanaAuth

**File:** `src/hooks/use-solana-auth.ts`

Complete Solana wallet authentication with mobile deep-linking support.

**Signature:**
```typescript
function useSolanaAuth(): {
  isConnecting: boolean
  isSigning: boolean
  isAuthenticating: boolean
  error: string | null
  signInWithSolana: () => Promise<void>
}
```

**Platform-Specific Behavior:**
- **iOS**: Uses Phantom deep-link (`startIOSConnectDeepLink`)
- **Android**: Uses SolanaMobileWalletAdapterWalletName, retry after 1.2s
- **Desktop**: Phantom extension check, fallback to WalletConnect

**Auth Flow:**
1. Detect platform (iOS/Android/Desktop)
2. Get nonce from `POST /api/auth/solana/nonce`
3. Get signing message from `GET /api/auth/solana/prepare`
4. Sign message with wallet
5. Verify at `POST /api/auth/solana/verify`
6. Create NextAuth session
7. Redirect to dashboard

---

### usePhantomConnect

**File:** `src/hooks/use-phantom-connect.ts`

Phantom wallet deep-link connection for Solana mobile.

**Signature:**
```typescript
function usePhantomConnect(): {
  ready: boolean        // Connection URL ready
  error: string | null
  clickToConnect: () => void  // Trigger Phantom deep-link
}
```

**API Calls:**
- `POST /api/auth/phantom/dl/start` - Get Phantom connect URL

**Features:**
- Universal links + deep-link conversion
- iOS preference handling
- Cancellation support

---

### useUserIdentity

**File:** `src/hooks/use-user-identity.ts`

Normalizes and provides consistent user identity information.

**Signature:**
```typescript
function useUserIdentity(): {
  displayName: string     // Formatted user display name
  email: string | null    // Normalized email
  address: string | null  // Wallet address (0x... or Solana)
  walletProvider: 'evm' | 'solana' | null
  ens: string | null      // ENS name (always null, TODO)
  role: 'USER' | 'ADMIN' | null
  tier: 'free' | 'pro' | 'elite' | null
  image: string | null    // Avatar image URL
  isLoading: boolean
}
```

**Display Name Logic:**
1. If wallet connected: `0x1234...5678` (short address)
2. Else if email: normalized email
3. Else if name: session name
4. Fallback: "User"

**localStorage:**
- `vs_normalized_email` - Cached email for transient gaps after OAuth

---

### useEnforceSingleIdentity

**File:** `src/hooks/use-enforce-single-identity.ts`

Ensures only one active identity (disconnects unused wallets).

**Signature:**
```typescript
function useEnforceSingleIdentity(): void
```

**Side Effects:**
- Disconnect EVM wallet if session auth method is not 'evm'
- Disconnect Solana wallet if session auth method is not 'solana'

---

## Real-Time Hooks

### useSocket

**File:** `src/hooks/use-socket.ts`

Central Socket.IO connection management for alerts and real-time events.

**Signature:**
```typescript
function useSocket(): {
  socket: Socket | null
}
```

**Socket.IO Configuration:**
- URL: `NEXT_PUBLIC_SOCKET_IO_URL` or `http://localhost:3001`
- Auth: User ID or email token
- Query: `method: 'id'` for wallet-only users
- Transports: WebSocket + polling

**Side Effects:**
- Connect/reconnect on user ID or email change
- Disconnect on unmount or session logout

---

### useTierChangeListener

**File:** `src/hooks/use-tier-change-listener.ts`

Listens for tier upgrades via Socket.IO and refreshes session.

**Signature:**
```typescript
function useTierChangeListener(): void
```

**Side Effects:**
- Listen for `tier-changed` events
- Update session via NextAuth `update()`
- Refresh router on success
- Force page reload on failure (500ms delay)

---

### useUserDeletionListener

**File:** `src/hooks/use-user-deletion-listener.ts`

Listens for account deletion/suspension/ban and forces logout.

**Signature:**
```typescript
function useUserDeletionListener(): {
  deletionEvent: UserDeletionEvent | null
  clearDeletionEvent: () => void
}
```

**Deletion Reasons:**
- `'deleted'` - Account deleted
- `'banned'` - Account banned
- `'suspended'` - Account suspended

**Side Effects:**
- Listen for `user-deleted` via Socket.IO
- Force logout after 2-second delay
- Redirect to `/auth` with reason in query param

---

## Feature Hooks

### useWatchlists

**File:** `src/hooks/use-watchlists.ts`

Manages user watchlists with React Query caching and tier-based limits.

**Signature:**
```typescript
function useWatchlists(): {
  watchlists: Watchlist[]
  limits: WatchlistLimits
  isLoading: boolean
  error: Error | null
  createWatchlist: (name: string) => void
  updateWatchlist: (params: { watchlistId: string, name: string }) => void
  deleteWatchlist: (watchlistId: string) => void
  addSymbol: (params: { watchlistId: string, symbol: string }) => void
  removeSymbol: (params: { watchlistId: string, symbol: string }) => void
  // Async variants
  createWatchlistAsync: (name: string) => Promise<Watchlist>
  deleteWatchlistAsync: (watchlistId: string) => Promise<void>
  addSymbolAsync: (params) => Promise<void>
  removeSymbolAsync: (params) => Promise<void>
  // Loading states
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  isAddingSymbol: boolean
  isRemovingSymbol: boolean
}

function useWatchlistLimits(): {
  limits: WatchlistLimits
  isLoading: boolean
  error: Error | null
}
```

**Tier-based Limits:**
- Free: 1 watchlist, 10 symbols per watchlist
- Pro: 5 watchlists, 50 symbols total
- Elite: Unlimited
- Admin: Unlimited

**API Calls:**
- `GET /api/watchlist` - Fetch watchlists
- `POST /api/watchlist` - Create watchlist
- `PATCH /api/watchlist/{id}` - Update watchlist
- `DELETE /api/watchlist/{id}` - Delete watchlist
- `POST /api/watchlist/{id}/symbols` - Add symbol
- `DELETE /api/watchlist/{id}/symbols/{symbol}` - Remove symbol
- `GET /api/watchlist/limits` - Get limit status

---

### usePromoCode

**File:** `src/hooks/use-promo-code.ts`

Validates and applies promo codes for tier upgrades.

**Signature:**
```typescript
function usePromoCode(tier: 'pro' | 'elite'): {
  promoCode: string
  setPromoCode: (code: string) => void
  discountPercent: number | null
  originalPrice: number | null
  finalPrice: number | null
  error: string | null
  loading: boolean
  isValid: boolean
  validatePromoCode: (code: string) => Promise<void>
  applyPromoCode: (code: string) => Promise<void>
  clearPromoCode: () => void
}
```

**API Calls:**
- `POST /api/payments/validate-promo-code`
  - Body: `{ code, tier, paymentMethod: 'crypto' }`
  - Requires Bearer token

---

### useAssetDetection

**File:** `src/hooks/use-asset-detection.ts`

Periodically detects new assets from market data.

**Signature:**
```typescript
function useAssetDetection(marketData: Array<{ symbol: string }> | undefined): void
```

**Side Effects:**
- 5-minute detection interval
- 10-second initial delay
- Automatic manifest cache invalidation on new assets

**API Calls:**
- `POST /api/assets/detect-new` - Send symbols for detection

---

### useAssetProfile

**File:** `src/hooks/use-asset-profile.ts`

Fetches and caches asset profiles from CoinGecko API with manifest fallback.

**Signature:**
```typescript
function useAssetProfile(symbol?: string | null): {
  profile: AssetProfile | null
  loading: boolean
  error: string | null
}
```

**Cache Strategy:**
1. Synchronous manifest lookup (fastest)
2. Load manifest if needed
3. CoinGecko search + coin fetch
4. Symbol overrides (hand-tuned mappings)

**localStorage:**
- `volspike-asset-profile-cache-v1` - Profile cache (7-day TTL)
- `volspike:debug:assets` - Debug flag

---

## Utility Hooks

### useDebounce

**File:** `src/hooks/use-debounce.ts`

Simple debounce utility for values.

**Signature:**
```typescript
function useDebounce<T>(value: T, delay: number): T
```

**Usage:**
```typescript
const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)

useEffect(() => {
  fetchResults(debouncedSearch)
}, [debouncedSearch])
```

---

### useBuildVersionGuard

**File:** `src/hooks/use-build-version-guard.ts`

Forces page reload on bundle version changes to prevent stale sessions.

**Signature:**
```typescript
function useBuildVersionGuard(): void
```

**Side Effects:**
- Compares `NEXT_PUBLIC_BUILD_ID` with stored build ID
- Forces page reload if mismatch
- Persists new build ID before reload

**localStorage:**
- `volspike-build-id` - Current build ID

---

### useAutoSyncPayments

**File:** `src/hooks/use-auto-sync-payments.ts`

Auto-syncs NowPayments payment statuses with visibility-aware polling.

**Signature:**
```typescript
function useAutoSyncPayments(options: {
  payments: Payment[]
  enabled?: boolean      // Default: true
  interval?: number      // Default: 30000ms
  onPaymentUpdated?: (payment: Payment) => void
  accessToken: string
}): {
  syncingPayments: Set<string>  // Currently syncing IDs
  lastSyncTime: number | null
  syncCount: number
  paymentsToSyncCount: number
  syncAllPayments: (source: string) => void
}
```

**Features:**
- Polling every 30 seconds (configurable)
- Respects page visibility (pauses when hidden)
- Sequential syncing (500ms delay between)
- Toast notifications on tier upgrades

---

## Admin Hooks

### useAdminNotifications

**File:** `src/hooks/use-admin-notifications.ts`

Manages admin notifications with polling and mark-as-read functionality.

**Signature:**
```typescript
function useAdminNotifications(
  limit?: number,        // Default: 10
  unreadOnly?: boolean   // Default: false
): {
  notifications: AdminNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  refreshNotifications: () => Promise<void>
  markAsRead: (notificationIds?: string[]) => void
  markAllAsRead: () => void
  pausePolling: () => void
  resumePolling: () => void
}
```

**Polling:** 30 seconds background refresh

**API Calls:**
- `GET /api/admin/notifications?limit={limit}`
- `GET /api/admin/notifications/unread-count`
- `POST /api/admin/notifications/mark-read`

---

### useTelegramMessages

**File:** `src/hooks/use-telegram-messages.ts`

Fetches Telegram messages from backend with polling.

**Signature:**
```typescript
function useTelegramMessages(options?: {
  limit?: number        // Default: 100
  pollInterval?: number // Default: 30000ms
  autoFetch?: boolean   // Default: true
}): {
  messages: TelegramMessage[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  lastUpdate: number | null
}
```

**API Calls:**
- `GET /api/telegram/messages?limit={limit}` - Public endpoint

---

## Hook Categories Summary

| Category | Count | Hooks |
|----------|-------|-------|
| **Market Data** | 3 | useClientOnlyMarketData, useMarketData (legacy), useBinanceWebSocket (legacy) |
| **Alerts** | 6 | useVolumeAlerts, useOIAlerts, useAlertSounds, useUserAlertListener, useUserAlerts, useBrowserNotifications |
| **Authentication** | 5 | useWalletAuth, useSolanaAuth, usePhantomConnect, useUserIdentity, useEnforceSingleIdentity |
| **Real-Time** | 3 | useSocket, useTierChangeListener, useUserDeletionListener |
| **Features** | 5 | useWatchlists, usePromoCode, useAssetDetection, useAssetProfile |
| **Utilities** | 3 | useDebounce, useBuildVersionGuard, useAutoSyncPayments |
| **Admin** | 2 | useAdminNotifications, useTelegramMessages |

---

## Deprecated/Unused Hooks

| Hook | Status | Replacement |
|------|--------|-------------|
| `use-binance-websocket.ts` | UNUSED | `use-client-only-market-data.ts` |
| `use-market-data.ts` | UNUSED | `use-client-only-market-data.ts` |

**Recommendation:** Delete these files to reduce codebase complexity.

---

## Common Patterns

### Hook Composition
```typescript
function Dashboard() {
  const { data, status } = useClientOnlyMarketData({ tier })
  const { alerts } = useVolumeAlerts({ onNewAlert: playSound })
  const { playSound } = useAlertSounds()
  const { watchlists } = useWatchlists()
  const { socket } = useSocket()
  const { tier, role } = useUserIdentity()
  // ...
}
```

### Ref-Based State for Performance
```typescript
const prevAlertsRef = useRef<string[]>([])

useEffect(() => {
  const newAlerts = alerts.filter(a => !prevAlertsRef.current.includes(a.id))
  if (newAlerts.length > 0) {
    onNewAlert?.(newAlerts)
  }
  prevAlertsRef.current = alerts.map(a => a.id)
}, [alerts])
```

### Cleanup Pattern
```typescript
useEffect(() => {
  const subscription = subscribe()
  return () => subscription.unsubscribe()
}, [])
```

---

## Next: [Pages & Routes](11-PAGES-ROUTES.md)
