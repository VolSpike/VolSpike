# Stripe Subscription Recurring Billing - Complete Guide

## ✅ How It Works: Automatic Monthly Charges

### **Yes, Stripe charges customers automatically every month!**

Here's the complete flow:

---

## 🔄 Subscription Lifecycle

### **1. Initial Purchase (First Payment)**
When a user clicks "Upgrade to Pro":
1. **Frontend** → Creates checkout session via `/api/payments/checkout`
2. **Stripe Checkout** → User enters payment details
3. **Stripe** → Processes first payment
4. **Webhook: `checkout.session.completed`** → Updates user tier to `pro`
5. **Stripe** → Creates subscription with `status: 'active'`

### **2. Automatic Recurring Billing (Every Month)**
Stripe automatically handles monthly renewals:

1. **At billing period end** (e.g., 30 days after signup):
   - Stripe automatically creates an invoice
   - Stripe attempts to charge the customer's saved payment method
   
2. **If payment succeeds:**
   - **Webhook: `invoice.payment_succeeded`** → Logs successful payment
   - Subscription continues (`status: 'active'`)
   - User keeps Pro tier access
   
3. **If payment fails:**
   - **Webhook: `invoice.payment_failed`** → Logs failed payment
   - Stripe retries payment (up to 3 times over several days)
   - If all retries fail, subscription becomes `past_due` or `unpaid`
   - User may lose Pro tier access (depending on your grace period logic)

### **3. Subscription Updates**
- **Webhook: `customer.subscription.updated`** → Handles tier changes, plan upgrades/downgrades
- **Webhook: `customer.subscription.created`** → Handles new subscriptions

### **4. Cancellation**
- **Webhook: `customer.subscription.deleted`** → Downgrades user to `free` tier
- User retains Pro access until end of billing period

---

## 📋 Current Implementation Status

### ✅ **What's Working:**
- ✅ Checkout session creation
- ✅ Initial payment processing
- ✅ Tier upgrade on successful checkout
- ✅ Webhook handlers for all events
- ✅ Subscription status checking
- ✅ Billing portal (cancel/manage subscription)

### ⚠️ **What Could Be Enhanced:**
- ⚠️ **Payment failure handling** - Currently only logs, doesn't downgrade user
- ⚠️ **Grace period** - No automatic downgrade on payment failure
- ⚠️ **Email notifications** - No emails sent on payment success/failure

---

## 🧪 How to Test Recurring Billing

### **Method 1: Stripe Test Mode (Recommended)**

Stripe provides test cards and tools to simulate recurring billing:

#### **Step 1: Use Stripe Test Mode**
Make sure you're using **test mode** API keys:
- `STRIPE_SECRET_KEY=sk_test_...` (not `sk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (not `pk_live_...`)

#### **Step 2: Create Test Subscription**
1. Go to your app: `https://volspike.com` (or localhost)
2. Sign in as test user
3. Click "Upgrade to Pro"
4. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

#### **Step 3: Simulate Monthly Renewal**
**Option A: Use Stripe Dashboard (Easiest)**
1. Go to: https://dashboard.stripe.com/test/subscriptions
2. Find your test subscription
3. Click on the subscription
4. Click **"..." menu** → **"Update subscription"**
5. Change **"Billing period"** to **"1 day"** (for testing)
6. Click **"Update subscription"**
7. Wait 1 day (or use Stripe CLI to trigger immediately - see below)

**Option B: Use Stripe CLI (Advanced)**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Trigger invoice creation immediately
stripe trigger invoice.payment_succeeded

# Or trigger subscription renewal
stripe trigger customer.subscription.updated
```

**Option C: Manually Advance Billing Period**
1. Go to Stripe Dashboard → Subscriptions
2. Find your test subscription
3. Click **"..." menu** → **"Update subscription"**
4. Change **"Current period end"** to today's date
5. Save
6. Stripe will automatically create invoice and charge

---

### **Method 2: Test Payment Failure**

#### **Use Stripe Test Cards for Failures:**
- **Card declined:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Expired card:** `4000 0000 0000 0069`

**Steps:**
1. Create subscription with failing card
2. Check webhook logs for `invoice.payment_failed` event
3. Verify user tier handling (currently just logs, doesn't downgrade)

---

### **Method 3: Monitor Webhooks**

#### **Check Webhook Logs:**
1. **Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Click on your webhook endpoint
   - View "Events" tab to see all webhook events

2. **Railway Logs:**
   - Go to: https://railway.app/
   - Open your backend project
   - Click "Deployments" → "View Logs"
   - Filter for: `invoice.payment_succeeded` or `invoice.payment_failed`

3. **Local Testing:**
   ```bash
   # Use Stripe CLI to forward webhooks to local server
   stripe listen --forward-to localhost:3001/api/payments/webhook
   ```

---

## 🔍 Testing Checklist

### **Initial Purchase:**
- [ ] User can click "Upgrade to Pro"
- [ ] Checkout session opens
- [ ] Payment succeeds with test card
- [ ] User redirected to success page
- [ ] User tier updated to `pro` in database
- [ ] User sees Pro features immediately

### **Recurring Billing:**
- [ ] Subscription created in Stripe
- [ ] Subscription status is `active`
- [ ] Billing period is correct (monthly)
- [ ] Webhook `checkout.session.completed` received
- [ ] User tier is `pro` in database

### **Monthly Renewal:**
- [ ] Simulate billing period end (advance date or wait)
- [ ] Invoice created automatically
- [ ] Payment charged automatically
- [ ] Webhook `invoice.payment_succeeded` received
- [ ] User tier remains `pro`
- [ ] Subscription continues

### **Payment Failure:**
- [ ] Use failing test card
- [ ] Webhook `invoice.payment_failed` received
- [ ] Check logs for failure reason
- [ ] (Optional) Verify user downgrade logic

### **Cancellation:**
- [ ] User cancels via billing portal
- [ ] Webhook `customer.subscription.deleted` received
- [ ] User tier downgraded to `free`
- [ ] User retains Pro access until period end

---

## 🛠️ Current Webhook Handlers

### **`checkout.session.completed`**
- **When:** User completes initial checkout
- **Action:** Updates user tier to `pro` (or tier from price metadata)
- **Status:** ✅ Working

### **`customer.subscription.created`**
- **When:** New subscription created
- **Action:** Updates user tier
- **Status:** ✅ Working

### **`customer.subscription.updated`**
- **When:** Subscription modified (plan change, etc.)
- **Action:** Updates user tier
- **Status:** ✅ Working

### **`customer.subscription.deleted`**
- **When:** Subscription cancelled
- **Action:** Downgrades user to `free` tier
- **Status:** ✅ Working

### **`invoice.payment_succeeded`**
- **When:** Monthly payment succeeds
- **Action:** Currently just logs (could add email notification)
- **Status:** ✅ Working (logging only)

### **`invoice.payment_failed`**
- **When:** Monthly payment fails
- **Action:** Currently just logs (could add downgrade logic)
- **Status:** ⚠️ Working (logging only, no downgrade)

---

## 💡 Recommendations for Production

### **1. Add Payment Failure Handling**
Currently, payment failures only log. Consider adding:

```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string
    
    // Get subscription
    const subscriptionId = invoice.subscription as string
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    // If subscription is past_due or unpaid, downgrade user
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { tier: 'free' },
        })
        logger.info(`User downgraded to free due to payment failure`)
    }
    
    // Send email notification to user
    // await sendEmail(...)
}
```

### **2. Add Email Notifications**
- Payment succeeded → Thank you email
- Payment failed → Warning email with retry link
- Subscription cancelled → Confirmation email

### **3. Add Grace Period**
- Allow 3-7 days after payment failure before downgrading
- Send reminder emails during grace period

---

## 📊 Monitoring Subscriptions

### **Stripe Dashboard:**
- View all subscriptions: https://dashboard.stripe.com/test/subscriptions
- View payment history: https://dashboard.stripe.com/test/payments
- View webhook events: https://dashboard.stripe.com/test/webhooks

### **Your App:**
- User can view subscription status at: `/settings?tab=subscription`
- Admin can view all subscriptions at: `/admin/subscriptions`

---

## ✅ Summary

**Automatic Monthly Charges:**
- ✅ **YES** - Stripe automatically charges customers every month
- ✅ **NO ACTION REQUIRED** - Stripe handles everything automatically
- ✅ **Webhooks notify you** - You receive events for each payment

**Testing:**
- ✅ Use Stripe test mode (`sk_test_...`)
- ✅ Use test cards (`4242 4242 4242 4242`)
- ✅ Simulate renewals by advancing billing period in Stripe Dashboard
- ✅ Monitor webhooks in Stripe Dashboard or Railway logs

**Current Status:**
- ✅ Initial purchase works
- ✅ Recurring billing works (Stripe handles automatically)
- ✅ Webhooks receive all events
- ⚠️ Payment failure handling could be enhanced

---

**Ready to test? Start with Method 1 (Stripe Test Mode) - it's the easiest!**

