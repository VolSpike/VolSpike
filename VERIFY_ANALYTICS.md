# ✅ Analytics Verification Checklist

## Setup Verification

✅ **Code Integration**: All analytics code is properly integrated
✅ **TypeScript**: No type errors
✅ **Environment Variable**: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-ZYNRS2JWTS` added to Vercel

## How to Verify Analytics is Working

### Step 1: Check Vercel Deployment

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your VolSpike project
3. Check the latest deployment has the environment variable:
   - Go to **Settings** → **Environment Variables**
   - Verify `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set to `G-ZYNRS2JWTS`
   - Make sure it's enabled for **Production** environment

### Step 2: Visit Your Production Site

1. Visit `https://volspike.com` (or your production URL)
2. Navigate to a few different pages
3. Open browser DevTools (F12) → **Network** tab
4. Filter by `gtag` or `google-analytics`
5. You should see requests to `www.google-analytics.com` or `www.googletagmanager.com`

### Step 3: Check Google Analytics Realtime Report

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your **VolSpike Production** property
3. Go to **Reports** → **Realtime**
4. Within 30 seconds, you should see:
   - **Active users**: At least 1 (you)
   - **Page views**: Increasing as you navigate
   - **Events**: `page_view` events appearing

### Step 4: Test Registration Tracking

1. Create a test account (or use an existing one)
2. Complete the registration process
3. In Google Analytics → **Realtime** → **Events**
4. Look for `sign_up` event with parameters:
   - `method`: `email`
   - `tier`: `free`

### Step 5: Test Login Tracking

1. Sign in to your account
2. In Google Analytics → **Realtime** → **Events**
3. Look for `login` event with parameter:
   - `method`: `email` (or `oauth`/`wallet`)

### Step 6: Check Vercel Analytics

1. Go to Vercel Dashboard → Your Project → **Analytics** tab
2. You should see:
   - Page views
   - Unique visitors
   - Top pages
   - Performance metrics

## Troubleshooting

### No Data in Google Analytics?

**Check:**
- ✅ Environment variable is set correctly in Vercel
- ✅ Variable is enabled for Production environment
- ✅ Site is deployed to production (not preview)
- ✅ Wait 24-48 hours for non-realtime reports (Realtime shows immediately)

**Debug:**
- Open browser console on your site
- Look for `[Analytics]` log messages
- Check Network tab for `gtag` requests
- Verify Measurement ID matches: `G-ZYNRS2JWTS`

### Events Not Showing?

**Check:**
- ✅ Events are being called (check console logs)
- ✅ Wait 24-48 hours for GA4 to process events (Realtime shows immediately)
- ✅ Check **Reports** → **Engagement** → **Events** (not just Realtime)

### Vercel Analytics Not Showing?

**Check:**
- ✅ Project is deployed to Vercel (not running locally)
- ✅ Analytics tab is visible in Vercel dashboard
- ✅ Wait a few minutes after deployment for data to appear

## Expected Events

Once working, you should see these events in Google Analytics:

| Event Name | When It Fires | Parameters |
|-----------|---------------|------------|
| `page_view` | Every page navigation | `page_path`, `page_title` |
| `sign_up` | User registers | `method`, `tier`, `registration_type` |
| `login` | User signs in | `method` |
| `email_verification` | Email verified | `verification_status` |
| `form_submission` | Form submitted | `form_name`, `success` |
| `conversion` | Registration completed | `conversion_type`, `method`, `tier` |

## Success Indicators

✅ **Google Analytics Realtime** shows active users
✅ **Network tab** shows `gtag` requests
✅ **Vercel Analytics** shows page views
✅ **Events** appear in GA4 Realtime report
✅ **No console errors** related to analytics

---

**Need Help?** Check `ANALYTICS_SETUP_GUIDE.md` for detailed instructions.

