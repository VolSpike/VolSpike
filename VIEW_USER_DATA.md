# 📊 How to View User Data & Website Visitors

## Why Google Analytics Shows 0 (But Requests Are Being Sent)

**Good News:** Your analytics IS working! The `collect` requests in the Network tab prove data is being sent.

**Why Realtime Shows 0:**
1. **Ad Blockers** - Many browsers/extensions block Google Analytics
2. **Privacy Settings** - Browser privacy features can block tracking
3. **Processing Delay** - GA4 can take 5-10 minutes to show data in Realtime
4. **IP Filtering** - You might have filtered out your own IP (common setup)

**Solutions:**
- Wait 5-10 minutes and refresh Realtime
- Try incognito/private browsing mode
- Check if you have ad blockers enabled
- Historical reports take 24-48 hours to populate

---

## ✅ Immediate Ways to See User Data

### 1. Check Your Database (Most Accurate)

Run this script to see all users, registrations, and activity:

```bash
cd volspike-nodejs-backend
npx tsx scripts/view-users.ts
```

**This shows:**
- ✅ All registered users (email, OAuth, wallet)
- ✅ Registration dates and methods
- ✅ Last login times
- ✅ Wallet addresses
- ✅ Tier distribution
- ✅ Daily registration chart
- ✅ Email verification status

### 2. Check Vercel Analytics (Immediate)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **VolSpike** project
3. Click **Analytics** tab
4. You'll see:
   - Page views (real-time)
   - Unique visitors
   - Top pages
   - Performance metrics

**Vercel Analytics shows data immediately** (no 24-48 hour delay)

### 3. Check Admin Dashboard (If You Have Access)

If you have admin access:
1. Go to `https://volspike.com/admin`
2. Navigate to **User Management**
3. View all users, their registration dates, login history, etc.

### 4. Check Backend Logs

Your backend logs user registrations:
- Look for: `New user registered: {email}`
- Check Railway/Railway logs for registration events

---

## 📈 Google Analytics Historical Data

### When Will Historical Data Appear?

- **Realtime Reports**: 5-10 minutes delay
- **Standard Reports**: 24-48 hours delay
- **Custom Reports**: 24-48 hours delay

### How to View Historical Data (After 24-48 Hours)

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Go to **Reports** → **Life cycle** → **Acquisition** → **User acquisition**
4. You'll see:
   - Users by source (organic, direct, referral)
   - Registration events
   - Conversion funnels

### Set Up Custom Reports

1. Go to **Reports** → **Engagement** → **Events**
2. Look for:
   - `sign_up` events (registrations)
   - `login` events (logins)
   - `email_verification` events
   - `page_view` events

---

## 🔍 Detailed User Information

### View All Users from Database

```bash
cd volspike-nodejs-backend
npx tsx scripts/view-users.ts
```

**Output includes:**
- User email/ID
- Registration method (Email/OAuth/Wallet)
- Registration date
- Last login date
- Tier (Free/Pro/Elite)
- Wallet addresses
- Email verification status

### Query Specific Data

**See users registered today:**
```sql
SELECT email, "createdAt", tier, "lastLoginAt" 
FROM users 
WHERE "createdAt" >= CURRENT_DATE 
ORDER BY "createdAt" DESC;
```

**See users with wallets:**
```sql
SELECT u.email, wa.provider, wa.address, wa."lastLoginAt"
FROM users u
JOIN wallet_accounts wa ON u.id = wa."userId"
ORDER BY wa."lastLoginAt" DESC;
```

**See OAuth users:**
```sql
SELECT u.email, a.provider, u."createdAt"
FROM users u
JOIN accounts a ON u.id = a."userId"
WHERE a.type = 'oauth';
```

---

## 🎯 Quick Checklist

- [ ] Run `view-users.ts` script to see all database users
- [ ] Check Vercel Analytics for immediate page view data
- [ ] Wait 24-48 hours for Google Analytics historical reports
- [ ] Check Realtime report again in 5-10 minutes
- [ ] Disable ad blockers to test GA4 tracking
- [ ] Check admin dashboard if you have access

---

## 💡 Pro Tips

1. **Database is Most Accurate** - Your database has exact user data
2. **Vercel Analytics is Fastest** - Shows data immediately
3. **GA4 Takes Time** - But provides best long-term analytics
4. **Combine Sources** - Use database + Vercel + GA4 for complete picture

---

**Need help?** Run the `view-users.ts` script first - it shows everything immediately!

