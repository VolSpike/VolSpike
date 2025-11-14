# How to Verify Renewal System is Working

## ✅ Quick Checks

### 1. Check Deploy Logs for Scheduled Tasks Message

In Railway, scroll up in the **Deploy Logs** and look for one of these messages:

**If enabled:**
```
✅ Scheduled tasks initialized (renewal reminders every 6h, expiration checks daily)
```

**If disabled:**
```
ℹ️ Scheduled tasks disabled (set ENABLE_SCHEDULED_TASKS=true in production to enable)
```

**If you don't see either message**, the scheduled tasks code might not have been deployed yet.

### 2. Check Database Migration

Look for Prisma migration messages in the **Build Logs**:
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database...
```

Or check if the migration ran by looking for:
- `expiresAt` field in CryptoPayment table
- `renewalReminderSent` field in CryptoPayment table

### 3. Test API Endpoints Manually

Test the renewal endpoints to verify they're working:

```bash
# Replace with your actual backend URL and API key
BACKEND_URL="https://volspike-production.up.railway.app"
API_KEY="your-api-key-here"

# Test renewal reminder check
curl -X POST "$BACKEND_URL/api/renewal/check-reminders" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json"

# Test expiration check
curl -X POST "$BACKEND_URL/api/renewal/check-expired" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "checked": 0,
  "remindersSent": 0,
  "timestamp": "2024-11-14T21:34:00.000Z"
}
```

### 4. Check Environment Variables in Railway

Go to Railway → Your Backend Service → Variables tab, verify:

- ✅ `NODE_ENV=production` (required for scheduled tasks)
- ✅ `ENABLE_SCHEDULED_TASKS=true` (or not set, defaults to enabled in production)
- ✅ `DATABASE_URL` is set (for database migration)
- ✅ `SENDGRID_API_KEY` is set (for email reminders)

### 5. Check Subscription Status API

Test if the subscription endpoint returns crypto subscription data:

```bash
# This requires authentication (session cookie)
curl "$BACKEND_URL/api/payments/subscription" \
  -H "Cookie: your-session-cookie"
```

**Expected Response (if user has crypto subscription):**
```json
{
  "stripe": null,
  "crypto": {
    "id": "...",
    "status": "active",
    "tier": "pro",
    "expiresAt": "2024-12-14T00:00:00.000Z",
    "daysUntilExpiration": 30,
    "paymentMethod": "crypto"
  }
}
```

## 🔍 Troubleshooting

### Scheduled Tasks Not Running?

1. **Check NODE_ENV:**
   ```bash
   # In Railway logs, look for:
   📊 Environment: production
   ```

2. **Check ENABLE_SCHEDULED_TASKS:**
   - If set to `false`, scheduled tasks are disabled
   - If not set, defaults to enabled in production

3. **Redeploy:**
   - Go to Railway → Deployments → Redeploy
   - This ensures latest code is running

### Database Migration Not Applied?

1. **Check Build Logs:**
   - Look for Prisma migration output
   - Should see: `Prisma schema loaded` and `Datasource "db"`

2. **Manual Migration:**
   ```bash
   # SSH into Railway or use Railway CLI
   railway run npx prisma db push
   ```

### Emails Not Sending?

1. **Check SendGrid:**
   - Verify `SENDGRID_API_KEY` is set
   - Check SendGrid dashboard for email activity

2. **Check Logs:**
   - Look for email sending errors in Railway logs
   - Should see: `Crypto renewal reminder sent to...`

## 📊 What Should Be Working

✅ **Backend Running** - Server is active (confirmed from your logs)
✅ **API Endpoints** - `/api/renewal/check-reminders` and `/api/renewal/check-expired` exist
✅ **Database Schema** - `expiresAt` and `renewalReminderSent` fields added
✅ **Scheduled Tasks** - Should run automatically every 6h (reminders) and daily (expiration)
✅ **Email Service** - Renewal reminder emails ready to send
✅ **Frontend Components** - Subscription status card ready to display

## 🎯 Next Steps

1. **Scroll up in Deploy Logs** to find the scheduled tasks initialization message
2. **Wait 1 minute** after deployment - initial checks run after 1 minute delay
3. **Check Build Logs** to verify database migration completed
4. **Test API endpoints** manually to confirm they're working
5. **Check Railway Variables** to ensure environment is configured correctly

---

**Status Check:** Based on your logs, the backend is running but I need to verify:
- ✅ Server started successfully
- ❓ Scheduled tasks initialized (need to check logs)
- ❓ Database migration completed (need to check build logs)
- ❓ API endpoints accessible (can test manually)

