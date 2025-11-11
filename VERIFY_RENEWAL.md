# How to Verify Monthly Renewal Worked

## 🔍 Quick Verification Steps

### **Step 1: Check Stripe Webhooks**

1. **Go to Stripe Dashboard:**
   - Visit: https://dashboard.stripe.com/test/webhooks
   - Click on your webhook endpoint (should be something like `https://volspike-production.up.railway.app/api/payments/webhook`)

2. **Look for Recent Events:**
   - Should see `invoice.payment_succeeded` event
   - Check the timestamp - should be within the last few minutes
   - Click on the event to see details

3. **What to Look For:**
   - ✅ Event type: `invoice.payment_succeeded`
   - ✅ Status: "Succeeded" (green checkmark)
   - ✅ Amount: $9.00
   - ✅ Customer: `nsitnikov1@gmail.com`

---

### **Step 2: Check Railway Logs**

1. **Go to Railway:**
   - Visit: https://railway.app/
   - Open your backend project
   - Click "Deployments" tab
   - Click "View Logs"

2. **Look for:**
   - `Payment succeeded for customer...`
   - `invoice.payment_succeeded` webhook processing
   - Should show within last few minutes

3. **Filter Logs:**
   - Search for: `invoice` or `payment_succeeded`
   - Should see webhook received and processed

---

### **Step 3: Check Subscription Details**

1. **Go back to Subscriptions:**
   - https://dashboard.stripe.com/test/subscriptions
   - Click on your subscription

2. **Check:**
   - **Status:** Should still be "Active"
   - **Current period end:** Should be advanced (e.g., Dec 8 → Jan 8)
   - **Next invoice:** Should show new date (1 month later)

3. **Check Invoices:**
   - Click "Invoices" tab in subscription details
   - Should see a new invoice created
   - Status should be "Paid"

---

### **Step 4: Check Your Database**

Verify user tier is still `pro`:

```bash
# If you have access to database
# Check user tier hasn't changed
SELECT email, tier FROM users WHERE email = 'nsitnikov1@gmail.com';
# Should show: tier = 'pro'
```

---

## ✅ Success Indicators

**If renewal worked, you should see:**
- ✅ `invoice.payment_succeeded` webhook in Stripe Dashboard
- ✅ "Payment succeeded" log in Railway
- ✅ New invoice created in Stripe
- ✅ Subscription still "Active" with new billing period
- ✅ User tier still `pro` in database

---

## ❌ If It Didn't Work

**Check:**
1. **Webhook endpoint is correct** - Should be your Railway backend URL
2. **Webhook secret is correct** - Check `STRIPE_WEBHOOK_SECRET` in Railway
3. **Backend is running** - Check Railway deployment status
4. **Webhook events are enabled** - Check Stripe webhook settings

---

## 🎯 Quick Check Right Now

**Fastest way to verify:**

1. **Stripe Dashboard → Webhooks:**
   - Look for `invoice.payment_succeeded` event
   - If you see it → ✅ **It worked!**
   - If you don't see it → ❌ Check why

2. **Railway Logs:**
   - Look for webhook processing logs
   - If you see "Payment succeeded" → ✅ **It worked!**

**Start by checking Stripe Webhooks - that's the fastest way to know!**

