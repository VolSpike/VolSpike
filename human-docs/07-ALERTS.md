# Alert System

## Overview

VolSpike provides two types of automated alerts:
1. **Volume Alerts** - Detect unusual trading volume spikes
2. **Open Interest Alerts** - Detect significant OI changes

Both are detected by Python scripts on Digital Ocean and broadcast to users via Socket.IO.

---

## Volume Alerts

### What They Detect

Volume alerts fire when a trading pair shows significantly higher volume than the previous hour:

- **Spike**: Volume > 3x previous hour
- **Half Update**: 30-minute checkpoint showing continued high volume
- **Full Update**: 60-minute final summary

### Detection Logic

Located in `Digital Ocean/hourly_volume_alert_dual_env.py`:

```python
def detect_volume_spike(symbol_data):
    current_volume = get_current_hour_volume(symbol_data)
    previous_volume = get_previous_hour_volume(symbol_data)

    ratio = current_volume / previous_volume if previous_volume > 0 else 0

    if ratio >= 3.0:  # 3x or more
        return {
            'symbol': symbol_data['symbol'],
            'currentVolume': current_volume,
            'previousVolume': previous_volume,
            'volumeRatio': ratio,
            'candleDirection': 'bullish' if price_change > 0 else 'bearish'
        }

    return None
```

### Alert Data Structure

```typescript
interface VolumeAlert {
  id: string
  symbol: string            // e.g., 'BTCUSDT'
  asset: string             // e.g., 'BTC'
  currentVolume: number     // Volume this hour (USDT)
  previousVolume: number    // Volume last hour (USDT)
  volumeRatio: number       // currentVolume / previousVolume
  price: number             // Current price
  fundingRate: number       // Current funding rate
  alertType: AlertType      // 'SPIKE' | 'HALF_UPDATE' | 'FULL_UPDATE'
  message: string           // Human-readable description
  timestamp: Date           // Detection time
  hourTimestamp: Date       // Start of the hour
  candleDirection: string   // 'bullish' | 'bearish'
  detectionTime?: Date      // When first detected
  oiChange?: number         // OI change % (if available)
  priceChange?: number      // Price change %
}

enum AlertType {
  SPIKE = 'SPIKE',              // Initial detection
  HALF_UPDATE = 'HALF_UPDATE',  // 30-minute update
  FULL_UPDATE = 'FULL_UPDATE'   // Hourly summary
}
```

### Database Model

```prisma
model VolumeAlert {
  id              String    @id @default(cuid())
  symbol          String
  asset           String
  currentVolume   Float
  previousVolume  Float
  volumeRatio     Float
  price           Float?
  fundingRate     Float?
  alertType       AlertType @default(SPIKE)
  message         String
  timestamp       DateTime  @default(now())
  hourTimestamp   DateTime
  isUpdate        Boolean   @default(false)
  candleDirection String?
  detectionTime   DateTime?
  oiChange        Float?
  priceChange     Float?

  @@index([symbol, timestamp])
  @@index([timestamp])
}
```

### Ingestion Endpoint

```typescript
// POST /api/volume-alerts/ingest
// Requires API key authentication

const body = {
  symbol: 'BTCUSDT',
  asset: 'BTC',
  currentVolume: 1500000000,
  previousVolume: 400000000,
  volumeRatio: 3.75,
  price: 43250.50,
  fundingRate: 0.0001,
  alertType: 'SPIKE',
  message: 'BTC volume spike: $1.5B (3.75x previous hour)',
  candleDirection: 'bullish'
}

// Backend stores alert and broadcasts
await prisma.volumeAlert.create({ data: body })
io.to(`tier-${tier}`).emit('volume-alert', alert)
```

---

## Open Interest Alerts

### What They Detect

OI alerts fire when open interest changes significantly:

- **5-minute change**: >=3% change (10 min cooldown)
- **15-minute change**: >=7% change (15 min cooldown)
- **1-hour change**: >=12% change (60 min cooldown)

Additional requirement: Minimum absolute OI change of 5,000 contracts

### Detection Logic

Located in `Digital Ocean/oi_realtime_poller.py`:

```python
def detect_oi_change(current_oi, baseline_oi, timeframe):
    change_pct = ((current_oi - baseline_oi) / baseline_oi) * 100

    # Threshold percentages as decimal (0.03 = 3%)
    thresholds = {
        '5 min': 0.03,   # 3%
        '15 min': 0.07,  # 7%
        '1 hour': 0.12   # 12%
    }

    if abs(change_pct) >= thresholds[timeframe]:
        return {
            'symbol': symbol,
            'direction': 'UP' if change_pct > 0 else 'DOWN',
            'pctChange': change_pct,
            'baseline': baseline_oi,
            'current': current_oi,
            'timeframe': timeframe
        }

    return None
```

### Alert Data Structure

```typescript
interface OIAlert {
  id: string
  symbol: string        // e.g., 'BTCUSDT'
  direction: 'UP' | 'DOWN'
  baseline: number      // Starting OI value
  current: number       // Current OI value
  pctChange: number     // Percentage change
  absChange: number     // Absolute change in OI
  priceChange?: number  // Associated price change
  fundingRate?: number  // Current funding rate
  timeframe: string     // '5 min', '15 min', '1 hour'
  source: string        // 'realtime' or 'snapshot'
  ts: Date              // Timestamp
}
```

### Database Model

```prisma
model OpenInterestAlert {
  id          String   @id @default(cuid())
  symbol      String
  direction   String   // 'UP' or 'DOWN'
  baseline    Decimal  @db.Decimal(30, 8)
  current     Decimal  @db.Decimal(30, 8)
  pctChange   Decimal  @db.Decimal(10, 6)
  absChange   Decimal  @db.Decimal(30, 8)
  priceChange Decimal? @db.Decimal(10, 6)
  fundingRate Decimal? @db.Decimal(10, 6)
  timeframe   String   @default("5 min")
  source      String
  ts          DateTime
  createdAt   DateTime @default(now())

  @@index([symbol, ts])
  @@index([direction, ts])
}
```

---

## Alert Delivery

### Tier-Based Batching

Alerts are delivered based on user tier:

| Tier | Delivery Method |
|------|-----------------|
| Free | Batched every 15 minutes (:00, :15, :30, :45) |
| Pro | Batched every 5 minutes (:00, :05, :10, ...) |
| Elite | Instant delivery |

### Batching Logic

Located in `volspike-nodejs-backend/src/services/alert-broadcaster.ts`:

```typescript
class AlertBroadcaster {
  private alertQueues: Map<string, VolumeAlert[]> = new Map()

  addAlert(alert: VolumeAlert) {
    // Immediately broadcast to Elite
    this.io.to('tier-elite').emit('volume-alert', alert)

    // Queue for Free and Pro
    this.queueForTier('tier-pro', alert)
    this.queueForTier('tier-free', alert)
  }

  // Called by scheduler at appropriate intervals
  flushTier(tierRoom: string) {
    const queue = this.alertQueues.get(tierRoom) || []
    if (queue.length > 0) {
      this.io.to(tierRoom).emit('volume-alerts-batch', queue)
      this.alertQueues.set(tierRoom, [])
    }
  }
}
```

### Wall-Clock Alignment

Batches are delivered at specific clock times:

```typescript
// Free tier: Every 15 minutes
const freeMinutes = [0, 15, 30, 45]

// Pro tier: Every 5 minutes
const proMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function scheduleFlushes() {
  cron.schedule('*/15 * * * *', () => broadcaster.flushTier('tier-free'))
  cron.schedule('*/5 * * * *', () => broadcaster.flushTier('tier-pro'))
}
```

---

## Frontend Alert Display

### Volume Alerts Panel

Located in `volspike-nextjs-frontend/src/components/volume-alerts-content.tsx`:

```typescript
export function VolumeAlertsContent({
  tier,
  onPlaySound,
  ...
}) {
  const { alerts, isConnected, countdown } = useVolumeAlerts(tier)

  return (
    <div className="space-y-4">
      {/* Countdown timer for batched tiers */}
      {tier !== 'elite' && (
        <div className="text-sm text-muted-foreground">
          Next batch in: {formatCountdown(countdown)}
        </div>
      )}

      {/* Alert cards */}
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          className={cn(
            'animate-slide-in-right',
            alert.candleDirection === 'bullish'
              ? 'border-green-500/50'
              : 'border-red-500/50'
          )}
        />
      ))}
    </div>
  )
}
```

### Alert Card Design

Each alert shows:
- **Symbol** with asset logo
- **Volume comparison**: "This hour: $X / Last hour: $Y"
- **Ratio badge**: "3.5x"
- **Direction indicator**: Bullish (green up) / Bearish (red down)
- **Timestamp**: "10:30 AM (5 minutes ago)"
- **Price and funding rate**

### Alert Animations

CSS animations in `tailwind.config.js`:

```javascript
animation: {
  'slide-in-right': 'slideInRight 0.5s ease-out',
  'scale-in': 'scaleIn 0.3s ease-out',
  'fade-in': 'fadeIn 0.3s ease-out',
  'lightning-strike-green': 'lightningStrikeGreen 0.6s ease-out',
  'lightning-strike-red': 'lightningStrikeRed 0.6s ease-out',
}
```

### Alert Sounds

When a new alert arrives:

```typescript
// In useVolumeAlerts hook
socket.on('volume-alert', (alert) => {
  setAlerts(prev => [alert, ...prev])

  // Play sound for new spikes
  if (alert.alertType === 'SPIKE') {
    playSound('spike')
  }
})
```

---

## User Cross Alerts

Users can set custom alerts for specific conditions.

### Alert Types

```typescript
enum CrossAlertType {
  PRICE_CROSS    // Price crosses threshold
  FUNDING_CROSS  // Funding rate crosses threshold
  OI_CROSS       // OI crosses threshold
}
```

### Data Model

```prisma
model UserCrossAlert {
  id               String             @id @default(cuid())
  userId           String
  symbol           String
  alertType        CrossAlertType
  threshold        Float
  lastCheckedValue Float?
  lastCheckedAt    DateTime?
  deliveryMethod   AlertDeliveryMethod @default(DASHBOARD)
  isActive         Boolean            @default(true)
  triggeredCount   Int                @default(0)
  triggeredAt      DateTime?
  triggeredValue   Float?
  createdAt        DateTime           @default(now())
  user             User               @relation(...)
}

enum AlertDeliveryMethod {
  DASHBOARD  // In-app only
  EMAIL      // Email notification
  BOTH       // Dashboard + Email
}
```

### Alert Checking

Located in `Digital Ocean/user_alert_checker.py`:

```python
def check_user_alerts():
    # Get all active user alerts
    alerts = api.get('/api/user-alerts')

    for alert in alerts:
        current_value = get_current_value(alert['symbol'], alert['alertType'])

        if should_trigger(alert, current_value):
            trigger_alert(alert, current_value)
```

---

## Guest Alert Access

Guests can preview alerts with limitations:

- **View**: Top 2 alerts only
- **Rest**: Blurred with "Sign up to see more"
- **Sounds**: Disabled
- **Socket room**: `tier-free`
- **Token**: `'guest'`

---

## Admin Alert Management

### Alert Preview (`/admin/alert-preview`)

Admin can:
- View all alerts
- Test alert delivery
- Simulate alerts

### Alert Monitoring

Backend logs all alerts:

```typescript
logger.info('Volume alert detected', {
  symbol: alert.symbol,
  volumeRatio: alert.volumeRatio,
  alertType: alert.alertType,
  timestamp: new Date().toISOString()
})
```

---

## Troubleshooting

### "Not receiving alerts"

1. Check Socket.IO connection status
2. Verify user is in correct tier room
3. Check Digital Ocean script is running
4. Verify API key is correct

### "Alerts delayed"

1. For Free/Pro: This is expected (batching)
2. For Elite: Check Socket.IO connection
3. Check Digital Ocean script timing

### "Wrong alert count"

1. Initial load fetches last 10 alerts
2. Check database for actual alert count
3. Verify frontend is not filtering incorrectly

### "Sounds not playing"

1. Check browser autoplay policy
2. Verify sound is enabled in settings
3. Check volume level
4. Try manual interaction first

---

## API Reference

### Volume Alerts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/volume-alerts` | GET | Get recent alerts |
| `/api/volume-alerts/ingest` | POST | Ingest new alert (API key required) |

### OI Alerts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/open-interest-alerts` | GET | Get recent OI alerts |
| `/api/open-interest-alerts/ingest` | POST | Ingest new OI alert |

### User Alerts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user-alerts` | GET | Get user's custom alerts |
| `/api/user-alerts` | POST | Create custom alert |
| `/api/user-alerts/:id` | PUT | Update alert |
| `/api/user-alerts/:id` | DELETE | Delete alert |

---

## Next: [Frontend Overview](08-FRONTEND-OVERVIEW.md)
