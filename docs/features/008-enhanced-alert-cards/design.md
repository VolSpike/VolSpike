# Enhanced Volume Alert Cards - Design

## Architecture

### Data Flow

```
[Digital Ocean Python Script]
    |
    | 1. Detects volume spike
    | 2. Calculates priceChange % (current price vs hour open)
    | 3. Queries Binance OI API for current OI
    | 4. Queries backend for hour-start OI snapshot
    | 5. Calculates oiChange %
    | 6. Sends enhanced payload to backend
    |
    v
[Node.js Backend]
    |
    | 1. Validates and stores new fields
    | 2. Broadcasts via WebSocket
    |
    v
[Next.js Frontend]
    |
    | 1. Receives alert via WebSocket
    | 2. Checks user tier
    | 3. Renders enhanced card for Elite, standard for Free/Pro
```

## Data Models

### VolumeAlert Updates

Add two new optional fields to the VolumeAlert model:

```prisma
model VolumeAlert {
  // ... existing fields ...
  priceChange     Float?    // Percentage change from hour open to alert time
  oiChange        Float?    // Percentage change in OI from hour start to alert time
}
```

### Python Script Payload

```python
payload = {
    # ... existing fields ...
    "priceChange": price_change_pct,    # e.g., 0.0523 for +5.23%
    "oiChange": oi_change_pct,          # e.g., -0.0214 for -2.14%
}
```

## API Contracts

### Volume Alert Ingest (Updated)

**Endpoint**: `POST /api/volume-alerts/ingest`

**Request Body** (additions highlighted):
```typescript
{
  symbol: string
  asset: string
  currentVolume: number
  previousVolume: number
  volumeRatio: number
  price: number              // Current price at alert time
  priceChange?: number       // NEW: % change from hour open (e.g., 0.05 for 5%)
  oiChange?: number          // NEW: % change in OI from hour start (e.g., -0.02 for -2%)
  fundingRate?: number
  candleDirection: 'bullish' | 'bearish'
  message: string
  timestamp: string
  detectionTime?: string
  hourTimestamp: string
  isUpdate: boolean
  alertType: 'SPIKE' | 'HALF_UPDATE' | 'FULL_UPDATE'
}
```

### Volume Alert Response (Updated)

**Endpoint**: `GET /api/volume-alerts`

**Response** (additions to each alert):
```typescript
{
  id: string
  // ... existing fields ...
  priceChange?: number       // NEW: % change (e.g., 0.05)
  oiChange?: number          // NEW: % change (e.g., -0.02)
}
```

## UI/UX

### Alert Card Layout - Pro Tier (Enhanced)

```
+------------------------------------------+
| [Icon] BTCUSDT                    3:15 PM |
|                               (2 min ago) |
+------------------------------------------+
| [3.33x] [30m Update]                      |
+------------------------------------------+
| This hour: $50.00M                        |
| Last hour: $15.00M                        |
+------------------------------------------+
| Price: +5.23%  Funding: 0.010%  OI: +3.45%|
|                            [BN] [TV]      |
+------------------------------------------+
```

### Color Coding

- **Price Change**:
  - Positive: Green (`text-brand-600 dark:text-brand-400`)
  - Negative: Red (`text-danger-600 dark:text-danger-400`)
  - Zero/null: Default muted

- **OI Change**:
  - Positive (positions opened): Green
  - Negative (positions closed): Red
  - Zero/null: Default muted

### Free/Elite Tier (Unchanged)

```
+------------------------------------------+
| Price: $45,123.45  Funding: 0.010%       |
+------------------------------------------+
```

## Security Considerations

- No authentication changes needed
- New fields are optional - backward compatible
- OI query to backend is authenticated with API key
- No sensitive data exposed

## Performance Considerations

- OI snapshot query adds ~50-100ms to alert generation
- Uses indexed query: `WHERE symbol = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`
- Falls back to null if OI data unavailable
- No additional frontend API calls needed
