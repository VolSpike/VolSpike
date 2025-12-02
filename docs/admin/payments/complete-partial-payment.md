# Admin: Complete Partially Paid Payment

## Problem
User paid the amount, but NowPayments shows "partially_paid" status (usually due to network fees reducing the received amount). The user has already sent the money, but isn't upgraded yet.

## Solution
Use the admin endpoint to manually complete the payment and upgrade the user.

## Quick Fix

### Option 1: Use Admin API Endpoint (Recommended)

**Endpoint:** `POST /api/admin/payments/complete-partial-payment`

**Request:**
```json
{
  "paymentId": "YOUR_PAYMENT_DB_ID",
  "reason": "User paid full amount but network fees caused partially_paid status"
}
```

**Example using curl:**
```bash
curl -X POST https://your-backend-url/api/admin/payments/complete-partial-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "paymentId": "clx1234567890",
    "reason": "User paid full amount but network fees caused partially_paid status"
  }'
```

**What it does:**
1. ✅ Marks payment as "finished"
2. ✅ Upgrades user tier
3. ✅ Sets expiration date (30 days)
4. ✅ Sends email notification to user
5. ✅ Creates audit log entry
6. ✅ Notifies admin

### Option 2: Use Admin Dashboard (If UI exists)

1. Go to `/admin/payments`
2. Find the payment with "partially_paid" status
3. Click "Complete Payment" button (if implemented)
4. Confirm the action

### Option 3: Use Manual Upgrade Endpoint

If you just want to upgrade the user without updating payment status:

**Endpoint:** `POST /api/admin/payments/manual-upgrade`

**Request:**
```json
{
  "userId": "USER_ID",
  "tier": "pro",
  "reason": "Payment received but status stuck on partially_paid",
  "expiresAt": "2025-12-17T00:00:00Z"
}
```

## Finding Payment ID

### From Database:
```sql
SELECT id, "paymentId", "orderId", "paymentStatus", "userId", tier 
FROM "CryptoPayment" 
WHERE "paymentStatus" = 'partially_paid';
```

### From Admin Payments Page:
- Look for payment with "Partially_paid" status
- Copy the payment `id` (database ID, not NowPayments payment_id)

### From NowPayments Dashboard:
- Find payment ID: `5749736975`
- Use it to find payment in database:
```sql
SELECT id FROM "CryptoPayment" WHERE "paymentId" = '5749736975';
```

## Verification

After completing the payment, verify:

1. **Payment Status:**
   ```sql
   SELECT "paymentStatus", "paidAt", "expiresAt" 
   FROM "CryptoPayment" 
   WHERE id = 'PAYMENT_ID';
   ```
   Should show: `paymentStatus = 'finished'`

2. **User Tier:**
   ```sql
   SELECT email, tier 
   FROM "User" 
   WHERE id = 'USER_ID';
   ```
   Should show: `tier = 'pro'` (or 'elite')

3. **Audit Log:**
   ```sql
   SELECT action, "oldValues", "newValues" 
   FROM "AuditLog" 
   WHERE "targetId" = 'PAYMENT_ID' 
   ORDER BY "createdAt" DESC 
   LIMIT 1;
   ```
   Should show: `action = 'MANUAL_PAYMENT_COMPLETE'`

## Why This Happens

"Partially_paid" status occurs when:
- Network fees reduce the received amount
- Payment amount calculation doesn't account for fees
- NowPayments is strict about exact amounts
- Blockchain confirmations are pending

**Solution:** Since the user already paid, manually complete the payment to upgrade them.

## Prevention

To prevent this in the future:
1. Increase payment amount buffer (currently 10%)
2. Account for network fees in amount calculation
3. Use NowPayments minimum amount API more accurately
4. Monitor partially_paid payments and auto-complete if amount is close

## Example Response

```json
{
  "success": true,
  "message": "Payment completed and user upgraded",
  "payment": {
    "id": "clx1234567890",
    "paymentId": "5749736975",
    "orderId": "volspike-test-cmi254d0z0004mm0cjxnts748-1763406058166",
    "status": "finished",
    "tier": "pro"
  },
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "previousTier": "free",
    "newTier": "pro"
  }
}
```

## Quick Reference

**Payment ID:** Database ID (UUID format: `clx...`)
**NowPayments Payment ID:** Numeric ID from NowPayments dashboard
**Order ID:** Format: `volspike-{userId}-{timestamp}`

**Status Flow:**
- `waiting` → `partially_paid` → `finished` ✅
- `partially_paid` → (manual complete) → `finished` ✅

