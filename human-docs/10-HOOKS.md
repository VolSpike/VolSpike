# Hooks Reference

## Overview

VolSpike has 24+ custom React hooks that handle data fetching, authentication, real-time connections, and UI state.

---

## Market Data Hooks

### useClientOnlyMarketData

**File:** `src/hooks/use-client-only-market-data.ts`

The most important hook - handles direct Binance WebSocket connection.

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
  nextUpdate: number
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
| `watchlistSymbols` | `string[]` | Symbols to always include |

**Usage:**
```typescript
const { data, status, isLive } = useClientOnlyMarketData({
  tier: user.tier,
  watchlistSymbols: watchlist?.symbols || [],
})
```

**Key Implementation Details:**
- Connects to `wss://fstream.binance.com/stream`
- Streams: `!ticker@arr` and `!markPrice@arr`
- Debounces updates (200ms)
- Exponential backoff reconnection
- localStorage fallback for blocked regions
- Fetches OI from backend separately

---

### useMarketData

**File:** `src/hooks/use-market-data.ts`

Legacy hook, delegates to `useClientOnlyMarketData`.

**Note:** Kept for backwards compatibility.

---

### useBinanceWebSocket

**File:** `src/hooks/use-binance-websocket.ts`

Low-level WebSocket management (used internally).

---

## Alert Hooks

### useVolumeAlerts

**File:** `src/hooks/use-volume-alerts.ts`

Manages volume spike alert subscription and display.

**Signature:**
```typescript
function useVolumeAlerts(tier: string): {
  alerts: VolumeAlert[]
  isConnected: boolean
  countdown: number  // Seconds until next batch
  initialLoading: boolean
}
```

**Features:**
- Subscribes to Socket.IO `volume-alert` events
- Handles `volume-alerts-batch` for batched delivery
- Fetches initial alerts on mount
- Manages countdown timer

**Usage:**
```typescript
const { alerts, isConnected, countdown } = useVolumeAlerts(tier)
```

---

### useOIAlerts

**File:** `src/hooks/use-oi-alerts.ts`

Manages Open Interest alert subscription.

**Signature:**
```typescript
function useOIAlerts(tier: string): {
  alerts: OIAlert[]
  isConnected: boolean
}
```

**Usage:**
```typescript
const { alerts, isConnected } = useOIAlerts(tier)
```

---

### useAlertSounds

**File:** `src/hooks/use-alert-sounds.ts`

Manages alert sound playback.

**Signature:**
```typescript
function useAlertSounds(): {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  volume: number
  setVolume: (volume: number) => void
  playSound: (type: 'spike' | 'update' | 'hourly') => void
}
```

**Features:**
- Three-tier fallback (Howler > HTML5 Audio > Web Audio)
- Persists preference to localStorage
- Volume control

**Usage:**
```typescript
const { enabled, setEnabled, playSound } = useAlertSounds()

// On new alert
if (enabled) {
  playSound('spike')
}
```

---

### useUserAlertListener

**File:** `src/hooks/use-user-alert-listener.ts`

Listens for user-specific custom alerts.

**Signature:**
```typescript
function useUserAlertListener(userId: string): {
  alerts: UserAlert[]
  hasNew: boolean
  clearNew: () => void
}
```

---

### useBrowserNotifications

**File:** `src/hooks/use-browser-notifications.ts`

Manages browser push notifications.

**Signature:**
```typescript
function useBrowserNotifications(): {
  permission: NotificationPermission
  requestPermission: () => Promise<void>
  showNotification: (title: string, body: string) => void
}
```

---

## Authentication Hooks

### useWalletAuth

**File:** `src/hooks/use-wallet-auth.ts`

Handles EVM wallet authentication flow.

**Signature:**
```typescript
function useWalletAuth(): {
  isConnecting: boolean
  isAuthenticated: boolean
  address: string | undefined
  signIn: () => Promise<void>
  signOut: () => void
}
```

**Features:**
- Integrates with RainbowKit
- SIWE message signing
- JWT token handling

---

### useSolanaAuth

**File:** `src/hooks/use-solana-auth.ts`

Handles Solana wallet authentication.

**Signature:**
```typescript
function useSolanaAuth(): {
  isConnecting: boolean
  isAuthenticated: boolean
  publicKey: string | undefined
  signIn: () => Promise<void>
  signOut: () => void
}
```

---

### usePhantomConnect

**File:** `src/hooks/use-phantom-connect.ts`

Phantom wallet connection with mobile deep-link support.

**Signature:**
```typescript
function usePhantomConnect(): {
  connect: () => Promise<void>
  disconnect: () => void
  isConnected: boolean
  isMobile: boolean
  publicKey: string | undefined
}
```

**Features:**
- Detects mobile vs desktop
- Deep-link generation for mobile
- Universal links for iOS

---

### useUserIdentity

**File:** `src/hooks/use-user-identity.ts`

Gets current user identity from session.

**Signature:**
```typescript
function useUserIdentity(): {
  user: UserIdentity | null
  isLoading: boolean
  isAuthenticated: boolean
  tier: string
  role: string
}
```

---

### useEnforceSingleIdentity

**File:** `src/hooks/use-enforce-single-identity.ts`

Prevents multiple auth methods conflicting.

---

## Real-Time Hooks

### useSocket

**File:** `src/hooks/use-socket.ts`

Manages Socket.IO connection.

**Signature:**
```typescript
function useSocket(): {
  socket: Socket | null
  isConnected: boolean
  emit: (event: string, data: any) => void
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
}
```

**Features:**
- Auto-connects when session available
- Handles reconnection
- Manages room joining

**Usage:**
```typescript
const { socket, isConnected } = useSocket()

useEffect(() => {
  if (!socket) return

  socket.on('volume-alert', handleAlert)
  return () => socket.off('volume-alert', handleAlert)
}, [socket])
```

---

### useTierChangeListener

**File:** `src/hooks/use-tier-change-listener.ts`

Listens for tier upgrade/downgrade events.

**Signature:**
```typescript
function useTierChangeListener(userId: string): {
  newTier: string | null
  acknowledge: () => void
}
```

**Features:**
- Subscribes to Socket.IO `tier-change` event
- Shows upgrade celebration
- Refreshes session

---

### useUserDeletionListener

**File:** `src/hooks/use-user-deletion-listener.ts`

Detects when user account is deleted.

**Signature:**
```typescript
function useUserDeletionListener(): {
  isDeleted: boolean
}
```

---

## Feature Hooks

### useWatchlists

**File:** `src/hooks/use-watchlists.ts`

Manages user watchlists.

**Signature:**
```typescript
function useWatchlists(): {
  watchlists: Watchlist[]
  activeWatchlist: Watchlist | null
  setActiveWatchlist: (id: string | null) => void
  createWatchlist: (name: string) => Promise<void>
  addSymbol: (watchlistId: string, symbol: string) => Promise<void>
  removeSymbol: (watchlistId: string, symbol: string) => Promise<void>
  deleteWatchlist: (id: string) => Promise<void>
  isLoading: boolean
}
```

**Usage:**
```typescript
const { watchlists, activeWatchlist, addSymbol } = useWatchlists()

// Add symbol to watchlist
await addSymbol(activeWatchlist.id, 'BTCUSDT')
```

---

### usePromoCode

**File:** `src/hooks/use-promo-code.ts`

Validates promo codes.

**Signature:**
```typescript
function usePromoCode(): {
  code: string
  setCode: (code: string) => void
  validate: () => Promise<PromoValidation | null>
  isValidating: boolean
  result: PromoValidation | null
  error: string | null
  clear: () => void
}
```

---

### useAssetDetection

**File:** `src/hooks/use-asset-detection.ts`

Detects asset info from symbol.

**Signature:**
```typescript
function useAssetDetection(symbol: string): {
  asset: AssetInfo | null
  isLoading: boolean
}
```

---

### useAssetProfile

**File:** `src/hooks/use-asset-profile.ts`

Fetches detailed asset profile (description, links, etc.).

**Signature:**
```typescript
function useAssetProfile(symbol: string): {
  profile: AssetProfile | null
  isLoading: boolean
}
```

---

## Utility Hooks

### useDebounce

**File:** `src/hooks/use-debounce.ts`

Debounces a value.

**Signature:**
```typescript
function useDebounce<T>(value: T, delay: number): T
```

**Usage:**
```typescript
const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)

// API call uses debouncedSearch
useEffect(() => {
  fetchResults(debouncedSearch)
}, [debouncedSearch])
```

---

### useBuildVersionGuard

**File:** `src/hooks/use-build-version-guard.ts`

Checks for version mismatches and prompts refresh.

**Signature:**
```typescript
function useBuildVersionGuard(): {
  isOutdated: boolean
  refresh: () => void
}
```

---

### useAutoSyncPayments

**File:** `src/hooks/use-auto-sync-payments.ts`

Auto-syncs payment status for pending crypto payments.

**Signature:**
```typescript
function useAutoSyncPayments(): {
  isPending: boolean
  lastSync: Date | null
}
```

---

## Admin Hooks

### useAdminNotifications

**File:** `src/hooks/use-admin-notifications.ts`

Manages admin notification bell.

**Signature:**
```typescript
function useAdminNotifications(): {
  notifications: AdminNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllRead: () => void
}
```

---

### useTelegramMessages

**File:** `src/hooks/use-telegram-messages.ts`

Manages Telegram message feed for admin.

**Signature:**
```typescript
function useTelegramMessages(): {
  messages: TelegramMessage[]
  isLoading: boolean
  refresh: () => void
}
```

---

## Hook Composition Pattern

Many features compose multiple hooks:

```typescript
// Dashboard component
function Dashboard() {
  // Market data
  const { data, status } = useClientOnlyMarketData({ tier })

  // Alerts
  const { alerts } = useVolumeAlerts(tier)
  const { playSound } = useAlertSounds()

  // Watchlists
  const { watchlists, activeWatchlist } = useWatchlists()

  // Real-time
  const { socket } = useSocket()

  // User
  const { user, tier } = useUserIdentity()

  // Compose into UI...
}
```

---

## Common Patterns

### Handling Loading States

```typescript
const { data, isLoading, error } = useSomeHook()

if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage error={error} />
return <DisplayData data={data} />
```

### Cleanup on Unmount

```typescript
useEffect(() => {
  const subscription = subscribe()

  return () => {
    subscription.unsubscribe()
  }
}, [])
```

### Ref for Callbacks

```typescript
// Keep callback stable to avoid effect re-runs
const callbackRef = useRef(callback)
useEffect(() => {
  callbackRef.current = callback
}, [callback])

useEffect(() => {
  socket.on('event', callbackRef.current)
}, [socket])
```

---

## Next: [Pages & Routes](11-PAGES-ROUTES.md)
