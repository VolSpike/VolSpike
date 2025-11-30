# Watchlist Feature - Design Specification

**Feature:** User Watchlists with Tier-Based Limits  
**Last Updated:** December 2025  
**Status:** Design Phase

---

## Architecture Overview

### System Components

```
┌─────────────────┐
│   Frontend UI   │
│  (React/Next.js)│
└────────┬────────┘
         │
         │ HTTP/REST API
         │
┌────────▼────────┐
│  Backend API    │
│   (Hono/Node)   │
└────────┬────────┘
         │
         │ Prisma ORM
         │
┌────────▼────────┐
│   PostgreSQL    │
│   (TimescaleDB) │
└─────────────────┘
```

---

## Database Schema

### Existing Models (No Changes Needed)

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())
  items     WatchlistItem[]
  user      User     @relation(fields: [userId], references: [id])
  
  @@map("watchlists")
  @@index([userId])
}

model WatchlistItem {
  id          String @id @default(cuid())
  watchlistId String
  contractId  String
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id])
  contract    Contract  @relation(fields: [contractId], references: [id])
  
  @@unique([watchlistId, contractId])
  @@map("watchlist_items")
  @@index([watchlistId])
  @@index([contractId])
}
```

### Schema Enhancements (Optional)

Consider adding `updatedAt` for better tracking:

```prisma
model Watchlist {
  // ... existing fields
  updatedAt DateTime @updatedAt  // Add this
}
```

---

## API Design

### Endpoints

#### 1. Watchlist Management

**GET `/api/watchlist`**
- Get all user's watchlists
- Response includes watchlist count and symbol count
- **Response:**
```typescript
{
  watchlists: Watchlist[],
  limits: {
    watchlistLimit: number,
    symbolLimit: number,
    watchlistCount: number,
    symbolCount: number
  }
}
```

**POST `/api/watchlist`**
- Create new watchlist
- **Request:**
```typescript
{
  name: string  // 1-100 chars
}
```
- **Validation:**
  - Check watchlist count limit
  - Check name uniqueness per user
- **Response:** Created watchlist with limits info

**GET `/api/watchlist/:id`**
- Get specific watchlist with symbols
- **Response:** Watchlist with items

**PATCH `/api/watchlist/:id`**
- Rename watchlist
- **Request:**
```typescript
{
  name: string
}
```

**DELETE `/api/watchlist/:id`**
- Delete watchlist
- Cascades to WatchlistItem records
- **Response:** Success confirmation

#### 2. Symbol Management

**POST `/api/watchlist/:id/symbols`**
- Add symbol to watchlist
- **Request:**
```typescript
{
  symbol: string  // e.g., "BTCUSDT"
}
```
- **Validation:**
  - Check symbol limit (count unique symbols across all watchlists)
  - Check if symbol already in watchlist
  - Validate symbol format
- **Response:** Created WatchlistItem

**DELETE `/api/watchlist/:id/symbols/:symbol`**
- Remove symbol from watchlist
- **Response:** Success confirmation

**GET `/api/watchlist/:id/symbols`**
- Get all symbols in watchlist
- **Response:** Array of symbols with market data

#### 3. Limit Queries

**GET `/api/watchlist/limits`**
- Get user's current limits and usage
- **Response:**
```typescript
{
  tier: 'free' | 'pro' | 'elite',
  limits: {
    watchlistLimit: number,
    symbolLimit: number
  },
  usage: {
    watchlistCount: number,
    symbolCount: number  // Unique symbols across all watchlists
  },
  canCreateWatchlist: boolean,
  canAddSymbol: boolean,
  remainingWatchlists: number,
  remainingSymbols: number
}
```

#### 4. Market Data for Watchlist

**GET `/api/market/watchlist/:id`**
- Get market data for all symbols in watchlist
- Fetches individual symbol data (not volume-ranked)
- **Response:**
```typescript
{
  watchlistId: string,
  watchlistName: string,
  symbols: MarketData[],
  fetchedAt: number
}
```

**GET `/api/market/symbol/:symbol`**
- Get market data for individual symbol
- Used for watchlist filtering
- **Response:** MarketData object

---

## Backend Implementation

### Service Layer

**File:** `volspike-nodejs-backend/src/services/watchlist-service.ts`

```typescript
export class WatchlistService {
  /**
   * Get user's watchlist limits based on tier
   */
  static getLimits(tier: string): {
    watchlistLimit: number
    symbolLimit: number
  }

  /**
   * Count user's unique symbols across all watchlists
   */
  static async countUniqueSymbols(userId: string): Promise<number>

  /**
   * Count user's watchlists
   */
  static async countWatchlists(userId: string): Promise<number>

  /**
   * Check if user can create watchlist
   */
  static async canCreateWatchlist(userId: string, tier: string): Promise<{
    allowed: boolean
    reason?: string
    currentCount: number
    limit: number
  }>

  /**
   * Check if user can add symbol
   */
  static async canAddSymbol(
    userId: string,
    tier: string,
    symbol: string,
    watchlistId: string
  ): Promise<{
    allowed: boolean
    reason?: string
    currentCount: number
    limit: number
    isDuplicate: boolean
  }>

  /**
   * Get user's limit status
   */
  static async getLimitStatus(userId: string, tier: string): Promise<LimitStatus>
}
```

### Route Handlers

**File:** `volspike-nodejs-backend/src/routes/watchlist.ts`

- Add limit checking middleware
- Add validation for tier limits
- Return clear error messages
- Include limit info in responses

### Validation Schemas

```typescript
const createWatchlistSchema = z.object({
  name: z.string().min(1).max(100),
})

const addSymbolSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]+USDT$/, 'Invalid symbol format'),
})
```

---

## Frontend Implementation

### Components

#### 1. WatchlistSelector Component

**File:** `volspike-nextjs-frontend/src/components/watchlist-selector.tsx`

**Features:**
- Select existing watchlist or create new
- Show limit status ("8/10 symbols used")
- Show which watchlists already contain symbol
- Handle limit errors gracefully

**Props:**
```typescript
interface WatchlistSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  onSuccess?: () => void
}
```

#### 2. WatchlistFilter Component

**File:** `volspike-nextjs-frontend/src/components/watchlist-filter.tsx`

**Features:**
- Dropdown to select watchlist
- "All Symbols" option
- Shows current filter state
- Fetches watchlist symbols when selected

**Props:**
```typescript
interface WatchlistFilterProps {
  watchlists: Watchlist[]
  selectedWatchlistId: string | null
  onSelect: (watchlistId: string | null) => void
}
```

#### 3. WatchlistManagement Component

**File:** `volspike-nextjs-frontend/src/app/watchlists/page.tsx`

**Features:**
- List all watchlists
- View symbols in each watchlist
- Create/rename/delete watchlists
- Show limit status
- Remove symbols from watchlists

#### 4. Market Table Enhancements

**File:** `volspike-nextjs-frontend/src/components/market-table.tsx`

**Changes:**
- Add watchlist filter dropdown
- Add star icon indicators
- Handle watchlist-filtered data fetching
- Show different data source when filtered

### Hooks

#### useWatchlists Hook

**File:** `volspike-nextjs-frontend/src/hooks/use-watchlists.ts`

```typescript
export function useWatchlists() {
  const { data: watchlists, isLoading, error } = useQuery(...)
  const { mutate: createWatchlist } = useMutation(...)
  const { mutate: addSymbol } = useMutation(...)
  const { mutate: removeSymbol } = useMutation(...)
  
  return {
    watchlists,
    limits,
    isLoading,
    error,
    createWatchlist,
    addSymbol,
    removeSymbol,
    canCreateWatchlist,
    canAddSymbol,
  }
}
```

#### useWatchlistLimits Hook

**File:** `volspike-nextjs-frontend/src/hooks/use-watchlist-limits.ts`

```typescript
export function useWatchlistLimits() {
  // Fetch and cache limit status
  // Update on watchlist changes
  // Provide helper functions
}
```

---

## Data Flow

### Adding Symbol to Watchlist

```
User clicks "Add to Watchlist"
    ↓
WatchlistSelector opens
    ↓
User selects watchlist (or creates new)
    ↓
Frontend checks limits (optimistic)
    ↓
POST /api/watchlist/:id/symbols
    ↓
Backend validates:
  - Symbol limit check
  - Duplicate check
  - Watchlist ownership
    ↓
Create WatchlistItem
    ↓
Return success + updated limits
    ↓
Frontend updates cache
    ↓
Show success toast
    ↓
Update star icon in table
```

### Filtering by Watchlist

```
User selects watchlist from filter dropdown
    ↓
Frontend checks if watchlist data cached
    ↓
If not cached:
  GET /api/market/watchlist/:id
    ↓
Backend fetches individual symbol data
    ↓
Return array of MarketData
    ↓
Frontend displays filtered table
    ↓
Table shows only watchlist symbols
```

---

## Limit Enforcement Strategy

### Backend Validation (Primary)

**Always validate on backend:**
- Check limits before allowing operations
- Return clear error messages
- Include current usage in error response

**Example Error Response:**
```json
{
  "error": "Symbol limit reached",
  "message": "Pro tier limit: Maximum 30 symbols. You have 30/30 symbols.",
  "limit": 30,
  "current": 30,
  "tier": "pro"
}
```

### Frontend Validation (Secondary)

**Optimistic validation:**
- Check limits before API call
- Show immediate feedback
- Still rely on backend validation

**Limit Display:**
- Show limit status in UI
- "8/10 symbols used" badge
- Disable buttons when at limit

---

## Error Handling

### Error Types

1. **Limit Reached**
   - Watchlist limit reached
   - Symbol limit reached
   - Clear message with upgrade CTA

2. **Validation Errors**
   - Invalid symbol format
   - Duplicate symbol
   - Invalid watchlist name

3. **Not Found**
   - Watchlist doesn't exist
   - Symbol doesn't exist
   - User doesn't own watchlist

4. **Server Errors**
   - Database errors
   - Network errors
   - Generic error handling

### Error Messages

**User-Friendly Messages:**
- "Free tier limit: Maximum 1 watchlist. Upgrade to Pro for 3 watchlists."
- "You've reached your symbol limit (10/10). Remove symbols or upgrade to Pro for 30 symbols."
- "This symbol is already in 'My Favorites' watchlist."

---

## Performance Considerations

### Caching Strategy

1. **Watchlist List:** Cache user's watchlists
2. **Limit Status:** Cache limit calculations
3. **Watchlist Data:** Cache watchlist-filtered market data
4. **Symbol Data:** Cache individual symbol data

### Optimization

1. **Batch Symbol Fetching:** Fetch multiple symbols in parallel
2. **Lazy Loading:** Load watchlist symbols on demand
3. **Debouncing:** Debounce filter changes
4. **Indexing:** Ensure database indexes on userId, watchlistId, contractId

### Database Queries

**Optimize unique symbol count:**
```sql
SELECT COUNT(DISTINCT contractId) 
FROM watchlist_items wi
JOIN watchlists w ON wi.watchlistId = w.id
WHERE w.userId = ?
```

**Use proper indexes:**
- `watchlists.userId`
- `watchlist_items.watchlistId`
- `watchlist_items.contractId`

---

## Security Considerations

### Authentication & Authorization

1. **All endpoints require authentication**
2. **Users can only access their own watchlists**
3. **Validate watchlist ownership on all operations**
4. **Prevent limit bypassing via direct API calls**

### Input Validation

1. **Validate symbol format** (prevent injection)
2. **Sanitize watchlist names** (prevent XSS)
3. **Rate limit watchlist operations**
4. **Validate tier from session** (don't trust client)

---

## UI/UX Design

### Visual Indicators

1. **Star Icons:**
   - Outline star = not in watchlist
   - Filled star = in at least one watchlist
   - Hover shows which watchlists

2. **Limit Badges:**
   - "8/10 symbols" badge
   - Color coding (green/yellow/red)
   - Warning when near limit

3. **Filter Dropdown:**
   - "All Symbols" option
   - List of watchlists
   - Current selection highlighted

### User Flows

**Flow 1: Add Symbol to Watchlist**
1. Click star icon in table
2. WatchlistSelector opens
3. Select watchlist or create new
4. Success toast + icon updates

**Flow 2: Filter by Watchlist**
1. Click filter dropdown
2. Select watchlist
3. Table updates to show only watchlist symbols
4. Can switch back to "All Symbols"

**Flow 3: Manage Watchlists**
1. Navigate to /watchlists page
2. View all watchlists
3. Create/rename/delete watchlists
4. Add/remove symbols

---

## Testing Strategy

### Unit Tests

1. **WatchlistService Tests:**
   - Limit calculations
   - Symbol counting logic
   - Validation logic

2. **Component Tests:**
   - WatchlistSelector rendering
   - Limit display
   - Error handling

### Integration Tests

1. **API Endpoint Tests:**
   - Limit enforcement
   - Error responses
   - Data consistency

2. **Database Tests:**
   - Unique symbol counting
   - Cascade deletions
   - Index performance

### E2E Tests

1. **User Flows:**
   - Create watchlist → Add symbols → Filter table
   - Reach limit → Try to add → See error
   - Upgrade tier → Gain more limits

---

## Migration Strategy

### Existing Data

1. **Check for existing watchlists**
2. **Enforce limits on existing users**
3. **Handle users exceeding limits:**
   - Option A: Grandfather (allow to keep, prevent new additions)
   - Option B: Force compliance (require deletion)
   - **Recommendation:** Option A (grandfather) for better UX

### Database Migrations

1. **No schema changes needed** (existing schema sufficient)
2. **Add indexes if missing**
3. **Add `updatedAt` field** (optional)

---

## Future Enhancements

1. **Bulk Operations:** Add multiple symbols at once
2. **Watchlist Sharing:** Share watchlists with other users
3. **Watchlist Templates:** Pre-made watchlists (e.g., "Top 10 by Volume")
4. **Watchlist Analytics:** Track watchlist performance
5. **Watchlist Alerts:** Alert when symbols in watchlist hit thresholds

---

**Document Version:** 1.0  
**Next Steps:** Review design, confirm approach, proceed to implementation

