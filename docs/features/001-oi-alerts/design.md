# OI Alerts - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Digital Ocean Droplet                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  New: oi_alert_detector.py                                 │ │
│  │  - Runs every 30s                                          │ │
│  │  - Compares OI(now) vs OI(5min ago)                       │ │
│  │  - Calculates % change                                     │ │
│  │  - De-duplication logic (threshold crossing detection)    │ │
│  │  - POST to backend /api/oi-alerts/ingest                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS POST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Railway)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  POST /api/oi-alerts/ingest                                │ │
│  │  - Validate API key                                        │ │
│  │  - Store in oi_alerts table                                │ │
│  │  - Broadcast via Socket.IO to "admin" room                │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  GET /api/oi-alerts                                        │ │
│  │  - Admin auth required                                     │ │
│  │  - Return paginated OI alerts                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO (room: "admin")
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /admin/oi-alerts                                          │ │
│  │  - Admin role required                                     │ │
│  │  - useOIAlerts hook (Socket.IO + REST)                    │ │
│  │  - OIAlertCard component (green/red)                      │ │
│  │  - Sound + Animation system                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Database Schema (Prisma)

```prisma
model OIAlert {
  id              String   @id @default(uuid())
  symbol          String
  timestamp       DateTime @default(now())

  // OI values
  currentOI       Float
  previousOI      Float    // OI from 5 minutes ago

  // Calculated metrics
  changePercent   Float    // ((currentOI - previousOI) / previousOI) * 100
  direction       String   // "LONG_SPIKE" or "SHORT_DUMP"

  // Metadata
  createdAt       DateTime @default(now())

  @@index([timestamp])
  @@index([symbol])
}
```

### Alert Direction Logic

- **LONG_SPIKE**: `changePercent >= 3.0` (OI increased ≥3%)
- **SHORT_DUMP**: `changePercent <= -3.0` (OI decreased ≥3%)

## API Contracts

### POST /api/oi-alerts/ingest

**Purpose**: Receive OI alerts from Digital Ocean script

**Authentication**: API Key (same as volume alerts: `ALERT_INGEST_API_KEY`)

**Request Body**:
```typescript
{
  symbol: string;          // e.g., "BTCUSDT"
  currentOI: number;       // Current Open Interest value
  previousOI: number;      // OI from 5 minutes ago
  changePercent: number;   // Calculated % change
  direction: "LONG_SPIKE" | "SHORT_DUMP";
  timestamp: string;       // ISO 8601 timestamp
}
```

**Response**:
```typescript
{
  success: true,
  alertId: string
}
```

**Error Responses**:
- 401: Invalid API key
- 400: Validation error
- 500: Server error

### GET /api/oi-alerts

**Purpose**: Fetch OI alerts for admin UI

**Authentication**: JWT token, Admin role required

**Query Parameters**:
```typescript
{
  limit?: number;    // Default: 50, Max: 100
  offset?: number;   // Default: 0
  symbol?: string;   // Filter by symbol
}
```

**Response**:
```typescript
{
  alerts: Array<{
    id: string;
    symbol: string;
    timestamp: string;
    currentOI: number;
    previousOI: number;
    changePercent: number;
    direction: "LONG_SPIKE" | "SHORT_DUMP";
    createdAt: string;
  }>;
  total: number;
  hasMore: boolean;
}
```

## Digital Ocean Script Design

### New Script: `oi_alert_detector.py`

**Location**: `/home/trader/volume-spike-bot/oi_alert_detector.py`

**Algorithm**:

```python
# Pseudocode
class OIAlertDetector:
    def __init__(self):
        self.oi_history = {}  # symbol -> list of (timestamp, oi_value)
        self.alert_state = {}  # symbol -> "INSIDE" or "OUTSIDE"

    def process_oi_data(self, symbol, current_oi, timestamp):
        # Store OI value with timestamp
        self.oi_history[symbol].append((timestamp, current_oi))

        # Get OI from 5 minutes ago
        five_min_ago = timestamp - timedelta(minutes=5)
        previous_oi = self.get_oi_at_time(symbol, five_min_ago)

        if previous_oi is None:
            return  # Not enough data yet

        # Calculate % change
        change_percent = ((current_oi - previous_oi) / previous_oi) * 100

        # Check threshold crossing
        is_outside = abs(change_percent) >= 3.0
        previous_state = self.alert_state.get(symbol, "INSIDE")

        # Only alert on INSIDE -> OUTSIDE transition (de-duplication)
        if is_outside and previous_state == "INSIDE":
            direction = "LONG_SPIKE" if change_percent >= 3.0 else "SHORT_DUMP"
            self.send_alert(symbol, current_oi, previous_oi, change_percent, direction, timestamp)
            self.alert_state[symbol] = "OUTSIDE"
        elif not is_outside:
            self.alert_state[symbol] = "INSIDE"

    def get_oi_at_time(self, symbol, target_time):
        # Find closest OI value to target_time (within ±30s tolerance)
        # Return None if no data available
        pass

    def send_alert(self, symbol, current_oi, previous_oi, change_percent, direction, timestamp):
        # POST to backend /api/oi-alerts/ingest
        pass
```

**Data Retention**: Keep 10 minutes of OI history per symbol (20 data points at 30s intervals)

**systemd Service**: `oi-alerts.service`

```ini
[Unit]
Description=OI Alert Detector
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python oi_alert_detector.py
Restart=always
RestartSec=10
EnvironmentFile=/home/trader/.volspike.env

[Install]
WantedBy=multi-user.target
```

## UI/UX Design

### Admin Page: `/admin/oi-alerts`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Admin Navigation                                        │
├─────────────────────────────────────────────────────────┤
│  OI Alerts                                    [🔊 On/Off]│
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 🟢 BTCUSDT - Long Spike                            │  │
│  │ OI: 1.5B → 1.55B (+3.3%)                          │  │
│  │ 2 minutes ago                                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 🔴 ETHUSDT - Short Dump                            │  │
│  │ OI: 800M → 772M (-3.5%)                           │  │
│  │ 5 minutes ago                                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  [Load More]                                              │
└─────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
/admin/oi-alerts (Page)
├── OIAlertsPanel (Container)
│   ├── useOIAlerts (Hook)
│   │   ├── Socket.IO connection (room: "admin")
│   │   ├── REST API fetching
│   │   └── Alert state management
│   ├── SoundToggle (Component)
│   ├── OIAlertCard[] (List)
│   │   ├── Alert icon (🟢 or 🔴)
│   │   ├── Symbol
│   │   ├── Direction label
│   │   ├── OI change display
│   │   ├── Timestamp
│   │   └── Animation wrapper
│   └── LoadMore (Button)
└── useAlertSound (Hook) - Reuse from Volume Alerts
```

### Visual Design

**Colors** (matching Volume Alerts):
- Green alert: `bg-green-500/10`, `border-green-500`, `text-green-400`
- Red alert: `bg-red-500/10`, `border-red-500`, `text-red-400`

**Animation** (matching Volume Alerts):
- Slide in from right with fade
- Pulse effect on arrival
- Framer Motion animations

**Sound** (matching Volume Alerts):
- Same notification sound as Volume Alerts
- Toggle on/off control
- localStorage persistence

## Security Considerations

### Authentication
- API key validation for ingest endpoint (same key as volume alerts)
- JWT token validation for admin endpoints
- Admin role enforcement on frontend and backend

### Authorization
- Only users with `role === 'ADMIN'` can access `/admin/oi-alerts`
- Middleware checks on both frontend and backend

### Input Validation
```typescript
// Zod schema for ingest endpoint
const OIAlertIngestSchema = z.object({
  symbol: z.string().min(1).max(20),
  currentOI: z.number().positive(),
  previousOI: z.number().positive(),
  changePercent: z.number(),
  direction: z.enum(["LONG_SPIKE", "SHORT_DUMP"]),
  timestamp: z.string().datetime()
});
```

### Rate Limiting
- Ingest endpoint: 100 requests/minute (accommodates 30s polling for ~50 symbols)
- Admin GET endpoint: 60 requests/minute

## Performance Considerations

### Database
- Index on `timestamp` for efficient sorting
- Index on `symbol` for filtering
- Consider partitioning if alert volume grows large

### Socket.IO
- Use dedicated "admin" room (not broadcast to all users)
- Only admins subscribe to this room

### Frontend
- Pagination (50 alerts per page)
- Virtualized scrolling if needed (future optimization)
- Memoized components to prevent unnecessary re-renders

## Technology Choices

### Backend
- **Hono**: Existing framework, lightweight, edge-compatible
- **Prisma**: Existing ORM, type-safe database operations
- **Socket.IO**: Existing real-time system, reuse infrastructure
- **Zod**: Existing validation library, type-safe schemas

### Frontend
- **Next.js App Router**: Existing framework
- **React Hook Form + Zod**: Not needed for this feature (no forms)
- **Tailwind CSS**: Existing styling, matches Volume Alerts
- **Framer Motion**: Existing animation library, reuse from Volume Alerts
- **Socket.IO Client**: Existing real-time connection

### Digital Ocean
- **Python**: Existing language for DO scripts
- **systemd**: Existing service management
- **requests**: HTTP library for API calls

## Rollout Considerations

### Deployment Order
1. Backend database migration (add `OIAlert` table)
2. Backend API endpoints deployment
3. Digital Ocean script deployment
4. Frontend admin page deployment

### Monitoring
- Backend logs for ingest endpoint errors
- Digital Ocean script logs for detection errors
- Socket.IO connection monitoring
- Alert count metrics

### Rollback Plan
- Disable Digital Ocean script: `systemctl stop oi-alerts.service`
- Hide admin page with feature flag
- Database rollback if migration issues
