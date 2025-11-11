# Stripe Dashboard: Clean Up Test Subscriptions

## 🎯 What You're Seeing

You have **10 active test subscriptions** all for the same customer (`nsitnikov1@gmail.com`). This happened because you tested the upgrade flow multiple times, and each test created a new subscription.

**This is normal for testing!** But you should clean them up to avoid confusion.

---

## 🧹 Step 1: Cancel/Delete Test Subscriptions

### **Option A: Cancel All Test Subscriptions (Recommended)**

1. **Select subscriptions to cancel:**
   - Click the checkbox at the top-left of the table (selects all)
   - Or select individual subscriptions you want to cancel

2. **Cancel them:**
   - Click the **"..." menu** (three dots) at the top-right of the table
   - Select **"Cancel subscriptions"**
   - Confirm cancellation

3. **Result:**
   - Subscriptions will be marked as "Canceled"
   - Users will be downgraded to `free` tier (via webhook)
   - You can filter by "Canceled" to see them

### **Option B: Delete Test Subscriptions (Cleaner)**

1. **Click on a subscription** to open its details
2. Scroll down to **"Danger zone"** or **"Delete"** section
3. Click **"Delete subscription"**
4. Confirm deletion
5. Repeat for other test subscriptions

**Note:** Deleting removes them completely. Canceling keeps them in history but marks them inactive.

---

## ✅ Step 2: Keep ONE Subscription for Testing

After cleaning up, you should have **ONE active subscription** for testing recurring billing:

1. **Create a fresh test subscription:**
   - Go to your app: `https://volspike.com` (or localhost)
   - Sign in as `nsitnikov1@gmail.com`
   - Click "Upgrade to Pro"
   - Use test card: `4242 4242 4242 4242`
   - Complete checkout

2. **Verify it's created:**
   - Go back to Stripe Dashboard → Subscriptions
   - You should see **ONE active subscription**

---

## 🧪 Step 3: Test Monthly Recurring Billing

Now that you have ONE subscription, test the monthly renewal:

### **Method 1: Advance Billing Period (Easiest)**

1. **Click on your test subscription** in the table
2. Scroll down to **"Billing"** section
3. Click **"Update subscription"** button
4. Find **"Current period end"** field
5. Change it to **today's date** (or tomorrow)
6. Click **"Update subscription"**
7. **Stripe will automatically:**
   - Create an invoice
   - Charge the test card
   - Send `invoice.payment_succeeded` webhook
   - Renew the subscription

### **Method 2: Use Stripe CLI (Advanced)**

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Trigger invoice payment immediately
stripe trigger invoice.payment_succeeded
```

### **Method 3: Wait for Natural Renewal**

- Set billing period to **1 day** (for quick testing)
- Wait 1 day
- Stripe will automatically renew

---

## 📊 Step 4: Monitor the Renewal

After triggering renewal, check:

1. **Stripe Dashboard:**
   - Go to: **Webhooks** → Click your webhook endpoint
   - Look for `invoice.payment_succeeded` event
   - Verify it was received and processed

2. **Railway Logs:**
   - Go to: https://railway.app/
   - Open your backend project
   - Click **"Deployments"** → **"View Logs"**
   - Filter for: `invoice.payment_succeeded`
   - Verify webhook was processed

3. **Your Database:**
   - Check user tier is still `pro`
   - Subscription should still be `active`

---

## 🎯 Quick Action Plan

**Right Now:**
1. ✅ Cancel/delete 9 of the 10 test subscriptions (keep 1)
2. ✅ Verify you have 1 active subscription
3. ✅ Click on that subscription to view details

**For Testing:**
1. ✅ Advance billing period to today/tomorrow
2. ✅ Monitor webhook events
3. ✅ Verify user tier remains `pro`

---

## 💡 Pro Tips

### **Filter Subscriptions:**
- Use the **"Status"** filter to see only "Active" subscriptions
- Use **"Created date"** filter to find recent test subscriptions

### **Bulk Actions:**
- Select multiple subscriptions using checkboxes
- Use **"..." menu** → **"Cancel subscriptions"** to cancel many at once

### **Test Data:**
- Keep test subscriptions separate from production
- Use test cards (`4242 4242 4242 4242`) in test mode
- Never use real cards in test mode

---

## ✅ Summary

**What to do:**
1. **Cancel/delete** 9 test subscriptions (keep 1)
2. **Click on** the remaining subscription
3. **Advance billing period** to test monthly renewal
4. **Monitor webhooks** to verify it works

**Goal:**
- Have 1 clean test subscription
- Test monthly renewal works
- Verify webhooks are processed correctly

---

**Start by canceling the extra subscriptions, then we'll test the monthly renewal!**

