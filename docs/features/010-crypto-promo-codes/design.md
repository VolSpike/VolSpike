# Design: Crypto Payment Promo Codes

## Architecture Overview

This feature adds a promo code system for cryptocurrency payments through NowPayments. The architecture follows VolSpike's existing patterns:

- **Database**: Prisma schema with new `PromoCode` table
- **Backend**: Hono routes for validation and admin management
- **Frontend**: React components with TanStack Query for data fetching
- **Admin Panel**: New page at `/admin/promo-codes` for CRUD operations

## Data Models

### Database Schema (Prisma)

```prisma
model PromoCode {
  id              String            @id @default(cuid())
  code            String            @unique
  discountPercent Int               // 1-100
  maxUses         Int
  currentUses     Int               @default(0)
  validUntil      DateTime
  active          Boolean           @default(true)
  paymentMethod   PromoPaymentMethod @default(CRYPTO)
  createdById     String
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  createdBy       User              @relation("PromoCodeCreator", fields: [createdById], references: [id])
  usages          PromoCodeUsage[]

  @@index([code])
  @@index([active, validUntil])
  @@index([paymentMethod])
  @@map("promo_codes")
}

model PromoCodeUsage {
  id            String    @id @default(cuid())
  promoCodeId   String
  userId        String
  paymentId     String    // References CryptoPayment.id or Stripe payment ID
  discountAmount Float
  originalAmount Float
  finalAmount    Float
  createdAt     DateTime  @default(now())

  promoCode     PromoCode @relation(fields: [promoCodeId], references: [id])
  user          User      @relation("PromoCodeUsages", fields: [userId], references: [id])

  @@index([promoCodeId])
  @@index([userId])
  @@index([paymentId])
  @@map("promo_code_usages")
}

enum PromoPaymentMethod {
  CRYPTO
  STRIPE
  ALL
}
```

**User Model Updates**:
```prisma
// Add to User model
createdPromoCodes PromoCode[]        @relation("PromoCodeCreator")
promoCodeUsages   PromoCodeUsage[]   @relation("PromoCodeUsages")
```

### TypeScript Types

```typescript
// Backend types
interface PromoCodeValidationRequest {
  code: string
  tier: 'pro' | 'elite'
  paymentMethod: 'crypto'
}

interface PromoCodeValidationResponse {
  valid: boolean
  discountPercent?: number
  finalPrice?: number
  originalPrice?: number
  error?: string
  reason?: 'expired' | 'max_uses_reached' | 'inactive' | 'invalid_code' | 'wrong_payment_method'
}

interface CreatePromoCodeRequest {
  code: string
  discountPercent: number
  maxUses: number
  validUntil: string // ISO date
  paymentMethod: 'crypto' | 'stripe' | 'all'
  active: boolean
}

interface UpdatePromoCodeRequest {
  discountPercent?: number
  maxUses?: number
  validUntil?: string
  active?: boolean
}

interface PromoCodeStats {
  id: string
  code: string
  discountPercent: number
  maxUses: number
  currentUses: number
  remainingUses: number
  validUntil: string
  active: boolean
  paymentMethod: string
  createdAt: string
  createdBy: {
    id: string
    email: string
  }
  totalDiscountGiven: number // Sum of all discount amounts
  isExpired: boolean
}
```

## API Contracts

### Public Endpoints (Authenticated Users)

#### POST /api/payments/validate-promo-code
**Purpose**: Validate promo code and calculate discount

**Request**:
```json
{
  "code": "VOLSPIKE26",
  "tier": "pro",
  "paymentMethod": "crypto"
}
```

**Response (Success)**:
```json
{
  "valid": true,
  "discountPercent": 50,
  "originalPrice": 30.00,
  "finalPrice": 15.00
}
```

**Response (Invalid)**:
```json
{
  "valid": false,
  "error": "Promo code has expired",
  "reason": "expired"
}
```

**Rate Limiting**: 10 requests per minute per user

#### POST /api/payments/nowpayments/checkout (Enhanced)
**Changes**: Accept optional `promoCode` parameter

**Request**:
```json
{
  "tier": "pro",
  "successUrl": "https://volspike.com/checkout/success",
  "cancelUrl": "https://volspike.com/checkout/cancel",
  "payCurrency": "usdttrc20",
  "promoCode": "VOLSPIKE26"  // NEW
}
```

**Logic**:
1. Validate promo code if provided
2. Calculate discounted price
3. Create NowPayments invoice with discounted amount
4. Store promo code ID in CryptoPayment record
5. On successful payment webhook, increment promo code usage

### Admin Endpoints (ADMIN Role Required)

#### POST /api/admin/promo-codes
**Purpose**: Create new promo code

**Request**:
```json
{
  "code": "VOLSPIKE26",
  "discountPercent": 50,
  "maxUses": 100,
  "validUntil": "2025-03-15T23:59:59Z",
  "paymentMethod": "crypto",
  "active": true
}
```

**Validation**:
- `code`: 3-20 chars, alphanumeric only, case-insensitive, unique
- `discountPercent`: 1-100
- `maxUses`: 1-10000
- `validUntil`: Must be in future
- `paymentMethod`: One of 'crypto', 'stripe', 'all'

**Response**:
```json
{
  "id": "cm1abc123",
  "code": "VOLSPIKE26",
  "discountPercent": 50,
  "maxUses": 100,
  "currentUses": 0,
  "validUntil": "2025-03-15T23:59:59Z",
  "active": true,
  "paymentMethod": "crypto",
  "createdAt": "2024-12-15T10:00:00Z"
}
```

#### GET /api/admin/promo-codes
**Purpose**: List all promo codes with stats

**Query Parameters**:
- `page`: Number (default: 1)
- `limit`: Number (default: 20, max: 100)
- `status`: 'active' | 'inactive' | 'expired' | 'all' (default: 'all')
- `sortBy`: 'createdAt' | 'code' | 'currentUses' | 'validUntil' (default: 'createdAt')
- `sortOrder`: 'asc' | 'desc' (default: 'desc')

**Response**:
```json
{
  "promoCodes": [
    {
      "id": "cm1abc123",
      "code": "VOLSPIKE26",
      "discountPercent": 50,
      "maxUses": 100,
      "currentUses": 23,
      "remainingUses": 77,
      "validUntil": "2025-03-15T23:59:59Z",
      "active": true,
      "paymentMethod": "crypto",
      "createdAt": "2024-12-15T10:00:00Z",
      "createdBy": {
        "id": "user123",
        "email": "admin@volspike.com"
      },
      "totalDiscountGiven": 345.00,
      "isExpired": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

#### GET /api/admin/promo-codes/:id
**Purpose**: Get single promo code with detailed usage stats

**Response**:
```json
{
  "id": "cm1abc123",
  "code": "VOLSPIKE26",
  "discountPercent": 50,
  "maxUses": 100,
  "currentUses": 23,
  "remainingUses": 77,
  "validUntil": "2025-03-15T23:59:59Z",
  "active": true,
  "paymentMethod": "crypto",
  "createdAt": "2024-12-15T10:00:00Z",
  "createdBy": {
    "id": "user123",
    "email": "admin@volspike.com"
  },
  "usages": [
    {
      "id": "usage1",
      "userId": "user456",
      "userEmail": "user@example.com",
      "paymentId": "payment123",
      "discountAmount": 15.00,
      "originalAmount": 30.00,
      "finalAmount": 15.00,
      "createdAt": "2024-12-15T12:00:00Z"
    }
  ]
}
```

#### PATCH /api/admin/promo-codes/:id
**Purpose**: Update promo code

**Request**:
```json
{
  "discountPercent": 75,
  "maxUses": 200,
  "active": false
}
```

**Restrictions**:
- Cannot change `code` after creation
- Cannot change `paymentMethod` after creation
- Can extend `validUntil` but not shorten it if already used
- Can increase `maxUses` but not decrease below `currentUses`

#### DELETE /api/admin/promo-codes/:id
**Purpose**: Soft delete promo code

**Logic**:
- If `currentUses === 0`: Hard delete from database
- If `currentUses > 0`: Soft delete (set `active = false`, add deleted flag)

## UI/UX Design

### Crypto Checkout Page Enhancement

**Location**: `/checkout/crypto` or modal on pricing page

**Current Flow**:
1. User clicks "Upgrade with Crypto"
2. Modal/page shows cryptocurrency selection (USDT, USDC, BTC, etc.)
3. User selects currency
4. Redirects to NowPayments

**New Flow**:
1. User clicks "Upgrade with Crypto"
2. Modal/page shows:
   - Tier selection (Pro/Elite) with prices
   - **NEW**: Promo code input field (collapsed by default)
   - Cryptocurrency selection
   - **NEW**: Price summary showing discount if applied
3. User optionally enters promo code
4. System validates code in real-time (debounced)
5. Shows updated price with discount
6. User selects currency
7. Redirects to NowPayments with discounted amount

**Promo Code Input Component**:
```tsx
<div className="space-y-2">
  <button
    onClick={() => setShowPromoInput(!showPromoInput)}
    className="text-sm text-muted-foreground hover:text-foreground"
  >
    {showPromoInput ? '− Hide' : '+ Add'} promo code
  </button>

  {showPromoInput && (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Enter promo code"
        value={promoCode}
        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
        onBlur={validatePromoCode}
        className="..."
      />
      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}
      {discountPercent > 0 && (
        <p className="text-sm text-green-600">
          ✓ {discountPercent}% discount applied!
        </p>
      )}
    </div>
  )}
</div>
```

**Price Display**:
```tsx
<div className="space-y-1">
  {discountPercent > 0 ? (
    <>
      <p className="text-sm text-muted-foreground line-through">
        ${originalPrice.toFixed(2)}/month
      </p>
      <p className="text-2xl font-bold text-green-600">
        ${finalPrice.toFixed(2)}/month
        <span className="text-sm ml-2 text-muted-foreground">
          ({discountPercent}% off)
        </span>
      </p>
    </>
  ) : (
    <p className="text-2xl font-bold">
      ${originalPrice.toFixed(2)}/month
    </p>
  )}
</div>
```

### Admin Promo Codes Page

**Location**: `/admin/promo-codes`

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ Promo Codes                            [+ Create]   │
├─────────────────────────────────────────────────────┤
│ Filters: [All ▼] [Sort by: Created ▼]              │
├─────────────────────────────────────────────────────┤
│ Code        Discount  Uses      Valid Until  Status │
│ VOLSPIKE26  50%       23/100    2025-03-15  Active  │
│ LAUNCH50    50%       100/100   2024-12-31  Expired │
│ TEST10      10%       0/50      2025-06-01  Active  │
└─────────────────────────────────────────────────────┘
            [1] 2 3 ... 10 →
```

**Table Columns**:
- Code (clickable to view details)
- Discount %
- Uses (current/max with progress bar)
- Valid Until (with expired indicator)
- Status badge (Active/Inactive/Expired)
- Actions (Edit, Deactivate, Delete)

**Create/Edit Modal**:
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Promo Code</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label>Code</Label>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="VOLSPIKE26"
            maxLength={20}
          />
        </div>

        <div>
          <Label>Discount Percentage</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={discountPercent}
            onChange={e => setDiscountPercent(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>Maximum Uses</Label>
          <Input
            type="number"
            min={1}
            max={10000}
            value={maxUses}
            onChange={e => setMaxUses(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>Valid Until</Label>
          <Input
            type="datetime-local"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
          />
        </div>

        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectItem value="crypto">Crypto Only</SelectItem>
            <SelectItem value="stripe">Stripe Only</SelectItem>
            <SelectItem value="all">All Methods</SelectItem>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Active</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Detail View**:
- Show all fields
- Usage history table (user email, payment ID, discount amount, date)
- Total discount given
- Chart showing usage over time (optional)

## Security Considerations

### Input Validation
- **Code**: Alphanumeric only, 3-20 chars, uppercase normalization
- **Discount**: Must be 1-100
- **Max Uses**: Must be 1-10000
- **Valid Until**: Must be future date, max 1 year from creation

### Race Condition Prevention
- Use Prisma transaction when validating and incrementing usage
- Lock promo code record during payment processing

```typescript
const applyPromoCode = await prisma.$transaction(async (tx) => {
  const promo = await tx.promoCode.findUnique({
    where: { code: code.toUpperCase() }
  })

  if (!promo || !promo.active) {
    throw new Error('Invalid promo code')
  }

  if (promo.currentUses >= promo.maxUses) {
    throw new Error('Promo code usage limit reached')
  }

  if (new Date() > promo.validUntil) {
    throw new Error('Promo code expired')
  }

  // Increment usage atomically
  const updated = await tx.promoCode.update({
    where: { id: promo.id },
    data: { currentUses: { increment: 1 } }
  })

  return updated
})
```

### Authorization
- All admin endpoints require `role === 'ADMIN'`
- Validation endpoint requires authentication (prevents abuse)
- Rate limiting on validation endpoint (10/min per user)

### Audit Logging
Log all promo code operations:
- Creation (who, when, parameters)
- Updates (who, when, what changed)
- Deletion (who, when)
- Usage (who, when, discount amount)

## Performance Considerations

### Database Indexes
```prisma
@@index([code])                    // Fast code lookups
@@index([active, validUntil])      // Fast filtering in admin panel
@@index([paymentMethod])           // Filter by payment method
```

### Caching Strategy (Optional)
- Cache active promo codes in memory (refresh every 5 minutes)
- Invalidate cache on create/update/delete
- Reduces database load for validation requests

### Query Optimization
- Use `select` to fetch only needed fields
- Paginate admin list queries
- Use `include` judiciously (avoid N+1 queries)

## Technology Choices

### Backend
- **Prisma**: Database ORM (already in use)
- **Zod**: Input validation schemas
- **Hono**: API framework (already in use)

### Frontend
- **TanStack Query**: Data fetching and caching
- **React Hook Form**: Form management
- **Zod**: Client-side validation (reuse backend schemas)
- **shadcn/ui**: UI components (Dialog, Input, Select, etc.)

## Database Migration Strategy

### Migration File
```prisma
-- CreateEnum
CREATE TYPE "PromoPaymentMethod" AS ENUM ('CRYPTO', 'STRIPE', 'ALL');

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethod" "PromoPaymentMethod" NOT NULL DEFAULT 'CRYPTO',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_usages" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promo_code_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_code_idx" ON "promo_codes"("code");
CREATE INDEX "promo_codes_active_validUntil_idx" ON "promo_codes"("active", "validUntil");
CREATE INDEX "promo_codes_paymentMethod_idx" ON "promo_codes"("paymentMethod");

CREATE INDEX "promo_code_usages_promoCodeId_idx" ON "promo_code_usages"("promoCodeId");
CREATE INDEX "promo_code_usages_userId_idx" ON "promo_code_usages"("userId");
CREATE INDEX "promo_code_usages_paymentId_idx" ON "promo_code_usages"("paymentId");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Rollback Plan
```sql
DROP TABLE IF EXISTS "promo_code_usages";
DROP TABLE IF EXISTS "promo_codes";
DROP TYPE IF EXISTS "PromoPaymentMethod";
```

## Integration Points

### NowPayments Flow
1. User enters promo code on crypto checkout page
2. Frontend validates code via API
3. Frontend calculates discounted price
4. Frontend passes `promoCode` to `/api/payments/nowpayments/checkout`
5. Backend validates code again (never trust client)
6. Backend creates invoice with discounted `priceAmount`
7. Backend stores `promoCodeId` in `CryptoPayment` record (need to add field)
8. On IPN webhook success, backend creates `PromoCodeUsage` record

### CryptoPayment Schema Update
```prisma
model CryptoPayment {
  // ... existing fields ...
  promoCodeId    String?
  promoCode      PromoCode? @relation(fields: [promoCodeId], references: [id])
}
```

## Error Handling

### Validation Errors
- Invalid code: "Promo code not found"
- Expired: "Promo code has expired"
- Max uses reached: "Promo code usage limit reached"
- Inactive: "Promo code is no longer active"
- Wrong payment method: "Promo code not valid for crypto payments"

### Payment Errors
- If payment fails, DO NOT increment promo code usage
- Only increment on successful IPN webhook
- If webhook arrives after expiry, still honor the code (user initiated before expiry)

## Testing Strategy

### Unit Tests
- Promo code validation logic
- Discount calculation
- Usage increment (with mocked Prisma)
- Date comparison (expiry checks)
- Input sanitization

### Integration Tests
- Full validation endpoint flow
- Admin CRUD endpoints
- Payment flow with promo code
- Race condition handling (concurrent usage)

### E2E Tests
- User applies promo code on crypto checkout
- Admin creates promo code
- Admin views usage stats
- Promo code expires after validity period
- Promo code reaches max uses

## Rollout Plan

### Phase 1: Backend (Railway)
1. Run database migration
2. Deploy backend with new endpoints
3. Smoke test validation endpoint
4. Create initial VOLSPIKE26 code via admin panel

### Phase 2: Frontend (Vercel)
1. Deploy crypto checkout page changes
2. Deploy admin panel page
3. Test user flow end-to-end
4. Monitor error rates

### Phase 3: Monitoring
1. Track promo code usage in admin panel
2. Monitor validation endpoint performance
3. Check for abuse (same user, multiple codes)
4. Verify discount calculations are correct

## Analytics & Monitoring

### Metrics to Track
- Promo code validation requests (success/failure ratio)
- Promo code usage per day
- Total discount given
- Conversion rate (promo code users vs non-promo users)
- Average discount per payment

### Alerts
- Promo code validation error rate > 10%
- Unusual spike in promo code usage (potential abuse)
- Promo code creation failures

## Open Questions

1. Should we allow admins to create promo codes retroactively (valid from past date)? **Decision: No, too complex**
2. Should we notify users when a promo code is about to expire? **Decision: Out of scope for v1**
3. Should we allow multiple promo codes per user (not per transaction)? **Decision: No restriction for v1**
4. Should we track which marketing channel the promo code came from? **Decision: Future enhancement**
