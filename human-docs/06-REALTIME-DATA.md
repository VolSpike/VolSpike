# Real-Time Data System

## Overview

VolSpike delivers real-time data through two channels:
1. **Market Data**: Direct Binance WebSocket connection from the browser
2. **Alerts**: Socket.IO connection to the VolSpike backend

---

## Market Data (Binance WebSocket)

### How It Works

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│    Binance      │ ───────────────> │  User's Browser │
│  fstream.       │  !ticker@arr     │                 │
│  binance.com    │  !markPrice@arr  │  Market Table   │
└─────────────────┘                  └─────────────────┘
```

The frontend connects **directly** to Binance's Futures WebSocket stream. There is NO server involved in market data delivery.

### WebSocket URL

```
wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
```

### Data Streams

| Stream | Data |
|--------|------|
| `!ticker@arr` | 24h price/volume for all pairs |
| `!markPrice@arr` | Mark price and funding rates |

### The Core Hook

Located in `volspike-nextjs-frontend/src/hooks/use-client-only-market-data.ts`:

```typescript
export function useClientOnlyMarketData({
  tier,
  onDataUpdate,
  watchlistSymbols
}: UseClientOnlyMarketDataProps) {
  const [data, setData] = useState<MarketData[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting')

  // WebSocket connection
  const connect = useCallback(() => {
    const ws = new WebSocket(BINANCE_WS_URL)

    ws.onopen = () => {
      setStatus('live')
      // Prime with REST data for faster first paint
      primeFundingSnapshot()
      primeActiveSymbols()
      primeTickersSnapshot()
    }

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      // Update tickers and funding refs
      // Build and render snapshot
    }

    ws.onclose = () => {
      setStatus('reconnecting')
      // Exponential backoff reconnection
    }
  }, [tier])

  return { data, status, lastUpdate, isLive, ... }
}
```

### Data Structure

```typescript
interface MarketData {
  symbol: string        // e.g., 'BTCUSDT'
  price: number         // Current price
  volume24h: number     // 24h volume in USDT
  change24h: number     // 24h price change %
  fundingRate: number   // Current funding rate
  openInterest: number  // OI in USDT (from backend)
  timestamp: number     // Last update time
  precision: number     // Decimal places for display
}
```

### Tier-Based Limits

| Tier | Symbol Limit |
|------|-------------|
| Free | 50 symbols |
| Pro | 100 symbols |
| Elite | Unlimited |

Symbols are sorted by 24h volume, and the limit is applied client-side.

### Watchlist Bypass

Symbols in the user's watchlist are ALWAYS included, even if they fall outside the tier limit. This ensures watchlist views always show complete data.

### Reconnection Strategy

```typescript
// Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
const delay = Math.min(30_000, (2 ** reconnectAttempts) * 1000)
setTimeout(connect, delay)
```

### Geofence Fallback

If the WebSocket fails to connect (blocked regions), the hook:
1. Waits 3 seconds
2. Falls back to localStorage cached data
3. Sets status to 'error'

### Open Interest Data

OI data comes from the backend (NOT from Binance WebSocket):

```typescript
const fetchOpenInterest = async () => {
  const response = await fetch(`${API_URL}/api/market/open-interest`)
  const { data } = await response.json()
  // Store in openInterestRef
  // Merge with ticker data on render
}
```

OI is fetched:
- On mount
- Every 5 minutes (aligned to clock boundaries)
- When Socket.IO emits 'open-interest-update'

---

## Alert System (Socket.IO)

### Architecture

```
┌─────────────────┐     POST      ┌─────────────────┐
│ Digital Ocean   │ ────────────> │  Backend        │
│ Python Scripts  │  /api/ingest  │  (Railway)      │
└─────────────────┘               └────────┬────────┘
                                           │
                                  Socket.IO Broadcast
                                           │
               ┌──────────────────────┬────┴────┬──────────────────────┐
               ▼                      ▼         ▼                      ▼
        ┌──────────────┐     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ tier-free    │     │ tier-pro     │  │ tier-elite   │  │ user:{id}    │
        │ room         │     │ room         │  │ room         │  │ room         │
        └──────────────┘     └──────────────┘  └──────────────┘  └──────────────┘
```

### Socket.IO Rooms

| Room | Users | Alert Delivery |
|------|-------|----------------|
| `tier-free` | Free users, guests | 15-minute batches |
| `tier-pro` | Pro users | 5-minute batches |
| `tier-elite` | Elite users | Instant delivery |
| `user:{id}` | Individual user | Personal alerts |

### Connection Authentication

```typescript
// Frontend: use-socket.ts
const socket = io(SOCKET_URL, {
  auth: {
    token: session?.accessToken || 'guest'
  },
  query: {
    method: session?.user?.email ? undefined : 'id'  // Wallet-only users
  }
})

// Backend: websocket/handlers.ts
socket.on('connection', (socket) => {
  const token = socket.handshake.auth.token

  if (token === 'guest') {
    socket.join('tier-free')
    return
  }

  // Verify JWT and join appropriate tier room
  const user = await verifyToken(token)
  socket.join(`tier-${user.tier}`)
  socket.join(`user:${user.id}`)
})
```

### Volume Alerts

**Detection (Digital Ocean):**
- Script runs every 5 minutes
- Calls Binance REST API
- Detects volume > 3x previous hour
- Classifies as bullish/bearish

**Data Structure:**
```typescript
interface VolumeAlert {
  id: string
  symbol: string          // e.g., 'BTCUSDT'
  asset: string           // e.g., 'BTC'
  currentVolume: number   // This hour's volume
  previousVolume: number  // Last hour's volume
  volumeRatio: number     // currentVolume / previousVolume
  price: number
  fundingRate: number
  alertType: 'SPIKE' | 'HALF_UPDATE' | 'FULL_UPDATE'
  message: string
  timestamp: Date
  candleDirection: 'bullish' | 'bearish'
}
```

**Delivery Batching:**
```
Free Tier:  Alerts collected, delivered at :00, :15, :30, :45
Pro Tier:   Alerts collected, delivered at :00, :05, :10, ...
Elite Tier: Alerts delivered immediately
```

### Open Interest Alerts

**Detection (Digital Ocean):**
- Script polls OI every 30 seconds
- Detects significant changes (>3% in 5 min)
- Classifies direction (UP/DOWN)

**Data Structure:**
```typescript
interface OIAlert {
  id: string
  symbol: string
  direction: 'UP' | 'DOWN'
  baseline: number      // Starting OI
  current: number       // Current OI
  pctChange: number     // Percentage change
  absChange: number     // Absolute change
  priceChange: number   // Associated price change
  fundingRate: number
  timeframe: '5 min' | '15 min' | '1 hour'
  timestamp: Date
}
```

### Frontend Alert Hooks

**useVolumeAlerts:**
```typescript
export function useVolumeAlerts() {
  const [alerts, setAlerts] = useState<VolumeAlert[]>([])
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    // Initial fetch
    fetchInitialAlerts()

    // Real-time updates
    socket.on('volume-alert', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50))
      playSound('spike')
    })

    socket.on('volume-alerts-batch', (batch) => {
      setAlerts(prev => [...batch, ...prev].slice(0, 50))
    })

    return () => {
      socket.off('volume-alert')
      socket.off('volume-alerts-batch')
    }
  }, [socket])

  return { alerts, ... }
}
```

**useOIAlerts:**
```typescript
export function useOIAlerts() {
  const [alerts, setAlerts] = useState<OIAlert[]>([])
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    socket.on('oi-alert', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50))
    })

    return () => socket.off('oi-alert')
  }, [socket])

  return { alerts, ... }
}
```

---

## Alert Sounds

### Sound System

Located in `volspike-nextjs-frontend/src/hooks/use-alert-sounds.ts`:

```typescript
export function useAlertSounds() {
  const [enabled, setEnabled] = useState(false)
  const [volume, setVolume] = useState(0.5)

  const playSound = useCallback((type: 'spike' | 'update' | 'hourly') => {
    if (!enabled) return

    // Three-tier fallback:
    // 1. Howler.js (preferred)
    // 2. HTML5 Audio
    // 3. Web Audio API

    const audio = new Howl({
      src: ['/sounds/alert.mp3'],
      volume: volume
    })
    audio.play()
  }, [enabled, volume])

  return { playSound, enabled, setEnabled, volume, setVolume }
}
```

### Sound Controls Architecture

When alerts are displayed in a tabbed panel, sounds are managed by the parent:

```typescript
// Parent component (alerts-panel.tsx)
const { playSound, enabled, setEnabled } = useAlertSounds()

return (
  <Tabs>
    <TabContent>
      <VolumeAlertsContent
        hideControls={true}
        externalPlaySound={playSound}
        externalSoundsEnabled={enabled}
        externalSetSoundsEnabled={setEnabled}
      />
    </TabContent>
  </Tabs>
)
```

---

## Open Interest Polling (Backend)

### Liquid Universe

The backend maintains a list of "liquid" symbols (high volume):

```typescript
// Digital Ocean: oi_liquid_universe_job.py
// Runs every 5 minutes
// Posts to /api/market/open-interest/liquid-universe/update
```

### OI Data Endpoint

```typescript
// GET /api/market/open-interest
{
  data: {
    BTCUSDT: 1500000000,   // OI in USDT
    ETHUSDT: 800000000,
    ...
  },
  asOf: 1702836000000      // Timestamp
}
```

### Broadcasting OI Updates

```typescript
// Backend emits when new OI data arrives
io.emit('open-interest-update', { timestamp: Date.now() })
```

---

## Data Freshness

### Market Data
- **Latency**: ~100-500ms (depends on user's network)
- **Update frequency**: Every ~1 second from Binance
- **Debouncing**: 200ms in frontend for smooth rendering

### Alerts
- **Volume Alerts**: Detected every 5 minutes
- **OI Alerts**: Detected every 30 seconds
- **Delivery latency**: <1 second for Elite, batched for others

### Open Interest
- **Polling frequency**: Every 30 seconds
- **Frontend fetch**: Every 5 minutes
- **Staleness watchdog**: Refetch if >6 minutes old

---

## Error Handling

### WebSocket Reconnection
- Automatic reconnection with exponential backoff
- Status indicator shows connection state
- localStorage fallback for blocked regions

### Socket.IO Reconnection
- Built-in Socket.IO reconnection
- Automatic room rejoining on reconnect

### Data Validation
- All incoming data validated before use
- Invalid symbols filtered out
- Zero/null values handled gracefully

---

## Debugging Tools

### Debug Mode

Add `?debug=true` to URL to enable:
- Test sound buttons
- Test animation buttons
- Connection status details

### Console Logging

Key log messages:
```
🔌 Connecting to WebSocket: wss://fstream.binance.com/...
✅ Binance WebSocket connected - Real-time for all tiers
📊 Processing OI data: 343 symbols
⚠️ WebSocket warning (likely handshake issue)
```

### Debug Page

Navigate to `/debug/open-interest` for OI debugging:
- Current OI data
- Symbol matching status
- Fetch timestamps

---

## Performance Optimization

### Frontend

1. **Debouncing**: 200ms between renders
2. **Refs for fast data**: tickersRef, fundingRef, openInterestRef
3. **Stable callbacks**: useCallback for WebSocket handlers
4. **Lazy rendering**: Only render visible rows

### Backend

1. **Room-based broadcasting**: Only send to relevant users
2. **Batched alerts**: Reduce message frequency for lower tiers
3. **In-memory Socket.IO**: No Redis overhead

### Data Transfer

1. **JSON compression**: Automatic by Binance
2. **Selective updates**: Only changed fields
3. **Tier-based limits**: Less data for lower tiers

---

## Next: [Alert System](07-ALERTS.md)
