# Real-Time Payment Status System

## How It Works

The payment page provides **real-time status updates** without requiring manual page refreshes. Here's exactly what users see and when:

## Real-Time Polling

**Frequency:** Every 10 seconds automatically  
**Endpoint:** `/api/payments/nowpayments/status/:paymentId`  
**What it does:**
- Checks current payment status from NowPayments API
- Updates payment status in database
- Automatically triggers user upgrade if payment is finished
- Updates UI in real-time

## Status Flow & User Experience

### 1. **Initial State: "Waiting for payment"**
- **Status:** `waiting`
- **Progress Stage:** "Scan QR" (first step)
- **Status Badge:** Green dot + "Waiting for payment"
- **What user sees:** QR code, payment amount, instructions

### 2. **Payment Sent: "Partially Paid"**
- **Status:** `partially_paid`
- **Progress Stage:** "Confirm" (second step) - shows clock icon
- **Status Badge:** Amber dot + "Payment received, confirming on blockchain"
- **Toast Notification:** "Payment received! Waiting for blockchain confirmations... ⏳"
- **What this means:** Payment received but waiting for blockchain confirmations or network fees deducted
- **User action:** None needed - just wait

### 3. **Confirming: "Confirming" / "Sending"**
- **Status:** `confirming` or `sending`
- **Progress Stage:** "Confirm" (second step)
- **Status Badge:** Amber dot + "Waiting for blockchain confirmations"
- **What this means:** Payment is being processed on the blockchain
- **User action:** None needed - just wait

### 4. **Completed: "Finished"**
- **Status:** `finished`
- **Progress Stage:** "Upgrade" (third step) - shows checkmark
- **Status Badge:** Green dot + "Payment confirmed on-chain"
- **What happens automatically:**
  1. ✅ Backend upgrades user tier
  2. ✅ Session refreshes to get new tier
  3. ✅ Toast shows: "Payment confirmed! Upgrading to PRO tier..."
  4. ✅ Auto-redirects to success page after 2 seconds

## Visual Progress Indicator

The `PaymentProgress` component shows a 3-step visual progress:

```
[Scan QR] ────→ [Confirm] ────→ [Upgrade]
   ✓              ⏳              ⏳
```

**Stages:**
- **Scan QR:** User needs to scan QR code
- **Confirm:** Payment received, waiting for blockchain confirmations (includes `partially_paid`)
- **Upgrade:** Payment confirmed, tier upgraded

**Visual States:**
- ✅ **Completed:** Green checkmark, green border
- ⏳ **Active:** Purple/blue icon, colored border
- ⚪ **Pending:** Gray icon, gray border

## Status Messages

### Status Badge (Top Right of Payment Card)

| Status | Badge Color | Message |
|--------|-------------|---------|
| `waiting` | Green | "Waiting for payment" |
| `partially_paid` | Amber | "Payment received, confirming on blockchain" |
| `confirming` | Amber | "Waiting for blockchain confirmations" |
| `sending` | Amber | "Waiting for blockchain confirmations" |
| `finished` | Green | "Payment confirmed on-chain" |
| `failed` | Red | "Payment could not be completed" |
| `expired` | Red | "Payment could not be completed" |

### Toast Notifications

- **Partially Paid:** "Payment received! Waiting for blockchain confirmations... ⏳"
- **Finished (Upgraded):** "Payment confirmed! Upgrading to PRO tier..."
- **Finished (Pending):** "Payment confirmed! Upgrading your account..."

## Automatic Actions

### When Status Becomes "Finished"

1. **Backend automatically:**
   - Upgrades user tier in database
   - Sets 30-day expiration date
   - Sends email notification to user
   - Notifies admin

2. **Frontend automatically:**
   - Refreshes user session (gets new tier)
   - Shows success toast notification
   - Redirects to `/checkout/success` page after 2 seconds

### When Status is "Partially Paid"

- **Status badge updates** to show "Payment received, confirming on blockchain"
- **Progress indicator** moves to "Confirm" stage
- **Toast notification** appears: "Payment received! Waiting for blockchain confirmations..."
- **Page continues polling** every 10 seconds until status changes to "finished"

## User Experience Timeline

### Example Flow:

```
00:00 - User scans QR code
00:05 - User confirms payment in Phantom
00:10 - Status changes to "partially_paid"
        → Toast: "Payment received! Waiting for blockchain confirmations..."
        → Progress: Moves to "Confirm" stage
        → Badge: "Payment received, confirming on blockchain"
00:30 - Status changes to "confirming"
        → Badge: "Waiting for blockchain confirmations"
02:00 - Status changes to "finished"
        → Backend upgrades user
        → Toast: "Payment confirmed! Upgrading to PRO tier..."
        → Progress: Moves to "Upgrade" stage
        → Badge: "Payment confirmed on-chain"
02:02 - Auto-redirects to success page
```

## What Users See

### ✅ Real-Time Updates
- Status badge updates every 10 seconds
- Progress indicator moves through stages
- Toast notifications for status changes
- No manual refresh needed

### ✅ Clear Status Messages
- User-friendly status labels
- Color-coded badges (green = success, amber = processing, red = error)
- Visual progress indicator

### ✅ Automatic Completion
- User upgraded automatically when payment finishes
- Session refreshed automatically
- Redirect to success page automatically
- No manual action required

## Technical Details

### Polling Logic

```typescript
// Polls every 10 seconds
setInterval(async () => {
  const status = await checkPaymentStatus(paymentId)
  
  if (status === 'finished' && upgraded) {
    // Auto-upgrade and redirect
    await updateSession()
    redirect('/checkout/success')
  } else if (status === 'partially_paid') {
    // Show informative toast
    toast('Payment received! Waiting...')
  }
  
  // Update UI
  setPaymentStatus(status)
}, 10000)
```

### Status Endpoint

The `/api/payments/nowpayments/status/:paymentId` endpoint:
1. Fetches latest status from NowPayments API
2. Updates database
3. **Automatically upgrades user** if status is "finished"
4. Returns status and upgrade status

## Summary

**Users see:**
- ✅ Real-time status updates every 10 seconds
- ✅ Clear visual progress indicator
- ✅ Toast notifications for status changes
- ✅ Automatic upgrade when payment completes
- ✅ Automatic redirect to success page

**Users don't need to:**
- ❌ Manually refresh the page
- ❌ Check email for updates
- ❌ Manually upgrade their account
- ❌ Navigate away from the page

**Everything happens automatically!** 🚀

