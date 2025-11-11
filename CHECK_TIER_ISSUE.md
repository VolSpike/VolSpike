# Check User Tier and Fix Session Issue

## 🔍 Step 1: Check Database Tier

Run this command to check what tier is actually in the database:

```bash
cd volspike-nodejs-backend

# Replace YOUR_NEW_PASSWORD with your actual Neon password
DATABASE_URL="postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx tsx check-user-tier.ts
```

This will show:
- Current tier in database
- Stripe Customer ID
- User ID

---

## 🔍 Step 2: Check Webhook Logs

From your Railway logs, I saw multiple `customer.subscription.deleted` events were processed. Check if the webhook for your specific customer was received:

Look for in Railway logs:
```
User downgraded to free tier for customer cus_TO1F0EPDP0LwI5
```

If you see this → Webhook worked, database should be `free`
If you DON'T see this → Webhook might not have been sent/received

---

## 🐛 Likely Issue: Session Caching

**If database shows `free` but UI shows `pro`:**

This is a **session caching issue**. The NextAuth JWT token is cached and hasn't refreshed.

**Fix:**
1. **Sign out and sign back in** - This forces a fresh session
2. **Or refresh the page** - The JWT callback should fetch fresh data (but might not always work)

---

## ✅ Quick Fix: Reset Tier Manually

If the database still shows `pro`, reset it manually:

```bash
cd volspike-nodejs-backend

# Replace YOUR_NEW_PASSWORD with your actual Neon password
DATABASE_URL="postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx tsx reset-user-tier.ts
```

---

## 🔍 Step 3: Verify Webhook Handler

The webhook handler uses `updateMany` which might not find the user if `stripeCustomerId` doesn't match. Let me check if we need to improve it.

**Current handler:**
```typescript
await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { tier: 'free' },
})
```

**Potential issue:** If `stripeCustomerId` is null or doesn't match, the update won't happen.

---

## 🎯 Action Plan

1. **Check database tier** - Run `check-user-tier.ts`
2. **If database shows `pro`** - Run `reset-user-tier.ts` to fix it
3. **If database shows `free`** - Sign out and sign back in to refresh session
4. **Check webhook logs** - Verify the webhook was received for your customer ID

**Start by checking the database tier - that will tell us if it's a database issue or session caching issue!**

