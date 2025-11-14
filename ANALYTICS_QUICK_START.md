# 🚀 Analytics Quick Start - 5 Minute Setup

## Step 1: Get Google Analytics Measurement ID (2 minutes)

1. Go to [analytics.google.com](https://analytics.google.com/)
2. Create account → Create property → Add Web stream
3. Copy your **Measurement ID** (looks like `G-XXXXXXXXXX`)

## Step 2: Add to Environment Variables (1 minute)

### Local Development (`volspike-nextjs-frontend/.env.local`):
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=false  # Set to 'true' to test locally
```

### Production (Vercel Dashboard):
1. Go to **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`
3. Select all environments (Production, Preview, Development)
4. Click **Save**

## Step 3: Deploy (2 minutes)

```bash
git add .
git commit -m "Add analytics tracking"
git push
```

Vercel will automatically deploy. Analytics start working immediately!

## Step 4: Verify (30 seconds)

1. Visit your website
2. Go to [Google Analytics](https://analytics.google.com/) → **Realtime** report
3. You should see yourself as an active user within 30 seconds

---

## ✅ What's Already Tracking

- ✅ **Page Views** - Automatic on every page
- ✅ **User Registrations** - Email, OAuth, Wallet signups
- ✅ **User Logins** - All authentication methods
- ✅ **Email Verifications** - When users verify email
- ✅ **Performance** - Speed Insights via Vercel

## 📊 View Your Data

- **Google Analytics**: [analytics.google.com](https://analytics.google.com/) → Your Property
- **Vercel Analytics**: Vercel Dashboard → Your Project → Analytics tab

---

**Need detailed instructions?** See `ANALYTICS_SETUP_GUIDE.md`

