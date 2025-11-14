# Crypto Subscription Renewal System - Setup Guide

## ✅ What's Been Implemented

### 1. Database Schema Updates
- ✅ Added `expiresAt` field to `CryptoPayment` model (30-day subscription period)
- ✅ Added `renewalReminderSent` field to track reminder emails
- ✅ Added index on `expiresAt` for efficient queries

### 2. Backend Services
- ✅ **Renewal Reminder Service** (`src/services/renewal-reminder.ts`)
  - Checks for expiring subscriptions (within 7 days)
  - Sends email reminders at 7, 3, and 1 day before expiration
  - Prevents duplicate reminders (tracks last sent time)
  
- ✅ **Expiration Check Service**
  - Automatically downgrades expired subscriptions to Free tier
  - Sends expiration notification emails

### 3. Email Templates
- ✅ Beautiful HTML email templates for renewal reminders
- ✅ Color-coded urgency (green/yellow/red based on days remaining)
- ✅ Expiration notification emails

### 4. API Endpoints
- ✅ `GET /api/payments/subscription` - Returns both Stripe and Crypto subscription status
- ✅ `POST /api/renewal/check-reminders` - Manual trigger for reminder checks
- ✅ `POST /api/renewal/check-expired` - Manual trigger for expiration checks

### 5. Frontend Components
- ✅ **Subscription Status Component** - Shows expiration date, days remaining, renewal button
- ✅ **Dashboard Integration** - Displays subscription status for Pro/Elite users
- ✅ **Pricing Page Updates** - Clear messaging about crypto manual renewal

### 6. Scheduled Tasks (Two Options)

#### Option A: Internal Scheduled Tasks (Already Configured)
The backend now includes internal scheduled tasks that run automatically:
- **Renewal Reminders**: Every 6 hours
- **Expiration Checks**: Daily (every 24 hours)

**To enable:** Set `ENABLE_SCHEDULED_TASKS=true` in your Railway environment variables (default: enabled in production)

**To disable:** Set `ENABLE_SCHEDULED_TASKS=false` if you prefer external cron jobs

#### Option B: Railway Cron Jobs (Recommended for Production)
A `railway.json` file has been created with cron job configurations:
- **Renewal Reminders**: Every 6 hours (`0 */6 * * *`)
- **Expired Subscriptions**: Daily at midnight (`0 0 * * *`)

**Railway will automatically pick up these cron jobs** when you deploy.

## 🚀 Deployment Steps

### Step 1: Database Migration

**Option A: Using Railway (Recommended)**
1. Go to your Railway project
2. Open your backend service
3. Go to "Variables" tab
4. Ensure `DATABASE_URL` is set (should already be there)
5. Go to "Deployments" tab
6. Click "Redeploy" - Railway will run `npx prisma db push` automatically

**Option B: Manual Migration Script**
```bash
cd volspike-nodejs-backend
export DATABASE_URL="your-production-database-url"
./scripts/migrate-production.sh
```

### Step 2: Environment Variables

Add these to your Railway backend service:

```bash
# Enable internal scheduled tasks (recommended)
ENABLE_SCHEDULED_TASKS=true

# Optional: Set a dedicated API key for renewal endpoints
# (falls back to ALERT_INGEST_API_KEY if not set)
RENEWAL_API_KEY=your-secure-api-key-here
```

### Step 3: Deploy to Railway

1. Commit and push your changes:
```bash
git add .
git commit -m "feat: Add crypto subscription expiration tracking and renewal reminders"
git push origin main
```

2. Railway will automatically:
   - Build and deploy your backend
   - Run Prisma migrations
   - Set up cron jobs (if `railway.json` is detected)

### Step 4: Verify Scheduled Tasks

**Check Railway Logs:**
```bash
# In Railway dashboard, check logs for:
✅ Scheduled tasks initialized (renewal reminders every 6h, expiration checks daily)
```

**Or test manually:**
```bash
# Test renewal reminder check
curl -X POST https://your-backend-url/api/renewal/check-reminders \
  -H "X-API-Key: your-api-key"

# Test expiration check
curl -X POST https://your-backend-url/api/renewal/check-expired \
  -H "X-API-Key: your-api-key"
```

## 📊 How It Works

### Renewal Reminder Flow
1. **Every 6 hours**, the system checks for subscriptions expiring within 7 days
2. **7 days before expiration**: First reminder email sent
3. **3 days before expiration**: Second reminder email sent
4. **1 day before expiration**: Urgent reminder email sent
5. Each reminder includes a "Renew Now" button linking to pricing page

### Expiration Flow
1. **Daily at midnight**, the system checks for expired subscriptions
2. **On expiration**: User is automatically downgraded to Free tier
3. **Expiration email** sent to user with renewal link
4. User can renew anytime to restore access

### Subscription Status API
The `/api/payments/subscription` endpoint now returns:
```json
{
  "stripe": {
    "id": "sub_...",
    "status": "active",
    "currentPeriodEnd": 1234567890,
    "paymentMethod": "stripe"
  },
  "crypto": {
    "id": "crypto_payment_id",
    "status": "active",
    "tier": "pro",
    "expiresAt": "2024-02-15T00:00:00.000Z",
    "daysUntilExpiration": 5,
    "paymentMethod": "crypto",
    "payCurrency": "USDT"
  },
  "subscription": { ... } // Primary subscription (Stripe or Crypto)
}
```

## 🎨 Frontend Features

### Dashboard Subscription Status Card
- Shows expiration date and days remaining
- Color-coded alerts:
  - 🟢 Green: More than 7 days remaining
  - 🟡 Yellow: 3-7 days remaining
  - 🟠 Orange: 1-3 days remaining
  - 🔴 Red: Expired
- "Renew Now" button linking to pricing page

### Pricing Page Updates
- FAQ updated to explain crypto manual renewal
- Clear distinction: Stripe = auto-renewal, Crypto = manual renewal

## 🔒 Security

- API endpoints protected with API key authentication
- Uses `RENEWAL_API_KEY` or falls back to `ALERT_INGEST_API_KEY`
- Scheduled tasks only run in production environment
- Email reminders include secure renewal links

## 📝 Notes

- **30-day subscription period**: Crypto payments grant 30 days of access
- **Manual renewal required**: Users must manually renew crypto subscriptions
- **Email reminders**: Sent at 7, 3, and 1 day before expiration
- **Grace period**: None - downgrade happens immediately on expiration
- **Renewal anytime**: Users can renew before expiration to extend access

## 🐛 Troubleshooting

### Scheduled Tasks Not Running
1. Check `ENABLE_SCHEDULED_TASKS=true` is set
2. Verify you're in production environment (`NODE_ENV=production`)
3. Check Railway logs for initialization messages

### Emails Not Sending
1. Verify `SENDGRID_API_KEY` is set
2. Check SendGrid dashboard for email delivery status
3. Review backend logs for email errors

### Database Migration Fails
1. Ensure `DATABASE_URL` is correct
2. Check database connection permissions
3. Verify Prisma schema is valid: `npx prisma validate`

## ✅ Testing Checklist

- [ ] Database migration completed successfully
- [ ] Scheduled tasks initialized (check logs)
- [ ] Test renewal reminder endpoint manually
- [ ] Test expiration check endpoint manually
- [ ] Verify subscription status API returns crypto subscription
- [ ] Check dashboard shows subscription status card
- [ ] Test email delivery (check SendGrid logs)
- [ ] Verify renewal link works on pricing page

---

**Status**: ✅ Ready for Production
**Last Updated**: December 2024

