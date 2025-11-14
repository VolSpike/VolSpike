# 📊 Analytics Setup Guide - VolSpike

## Complete Step-by-Step Instructions for Tracking User Growth, Visits, and Registrations

This guide will help you set up comprehensive analytics tracking for VolSpike using:
1. **Vercel Analytics** - Built-in page view tracking (zero config)
2. **Google Analytics 4 (GA4)** - Comprehensive user analytics
3. **Custom Event Tracking** - Registration, conversions, and user actions

---

## 🎯 What You'll Track

### Automatic Tracking (No Code Changes Needed)
- ✅ **Page Views** - Every page visit automatically tracked
- ✅ **Page Load Performance** - Speed Insights via Vercel
- ✅ **Route Changes** - Automatic tracking on navigation

### Custom Events (Already Implemented)
- ✅ **User Registrations** - Email, OAuth, Wallet signups
- ✅ **User Logins** - All authentication methods
- ✅ **Email Verifications** - When users verify their email
- ✅ **Subscription Upgrades** - Tier changes and purchases
- ✅ **Form Submissions** - Success/failure tracking
- ✅ **Button Clicks** - Key user actions
- ✅ **Feature Usage** - Tier-based feature tracking

---

## 📋 Step 1: Set Up Google Analytics 4

### 1.1 Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **"Start measuring"** or **"Admin"** → **"Create Account"**
3. Fill in:
   - **Account Name**: `VolSpike` (or your company name)
   - **Property Name**: `VolSpike Production` (or `VolSpike Development`)
   - **Reporting Time Zone**: Your timezone
   - **Currency**: USD (or your preference)

### 1.2 Create a Data Stream

1. In your GA4 property, go to **Admin** → **Data Streams**
2. Click **"Add stream"** → **"Web"**
3. Fill in:
   - **Website URL**: `https://volspike.com` (production) or `http://localhost:3000` (dev)
   - **Stream Name**: `VolSpike Web`
4. Click **"Create stream"**

### 1.3 Get Your Measurement ID

1. After creating the stream, you'll see a **Measurement ID**
2. It looks like: `G-XXXXXXXXXX`
3. **Copy this ID** - you'll need it in the next step

---

## 📋 Step 2: Configure Environment Variables

### 2.1 Add to `.env.local` (Development)

Open `volspike-nextjs-frontend/.env.local` and add:

```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Enable analytics in development (optional - set to 'true' to test)
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

**Replace `G-XXXXXXXXXX` with your actual Measurement ID from Step 1.3**

### 2.2 Add to Vercel (Production)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **VolSpike** project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Key**: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   - **Value**: `G-XXXXXXXXXX` (your production Measurement ID)
   - **Environment**: Production, Preview, Development (select all)
5. Click **"Save"**

### 2.3 Optional: Enable Analytics in Development

If you want to test analytics locally, set:
```bash
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

**Note**: Analytics are automatically enabled in production (when `NODE_ENV=production`)

---

## 📋 Step 3: Verify Installation

### 3.1 Check Code Integration

The following files have been created/updated:

✅ **`src/lib/analytics.ts`** - Analytics utility functions
✅ **`src/components/analytics-provider.tsx`** - GA4 initialization component
✅ **`src/app/layout.tsx`** - Analytics providers added
✅ **`src/components/signup-form.tsx`** - Registration tracking added
✅ **`src/components/signin-form.tsx`** - Login tracking added

### 3.2 Test Locally (Optional)

1. Start your development server:
   ```bash
   cd volspike-nextjs-frontend
   npm run dev
   ```

2. Open browser DevTools → **Network** tab
3. Filter by `gtag` or `google-analytics`
4. Navigate to different pages
5. You should see requests to `www.google-analytics.com`

### 3.3 Verify in Google Analytics

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Go to **Reports** → **Realtime**
4. Visit your website
5. You should see yourself as an active user within 30 seconds

---

## 📋 Step 4: Set Up Vercel Analytics (Already Enabled)

Vercel Analytics is **automatically enabled** when you deploy to Vercel. No configuration needed!

### 4.1 View Vercel Analytics

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **VolSpike** project
3. Click **"Analytics"** tab
4. You'll see:
   - Page views
   - Unique visitors
   - Top pages
   - Performance metrics

### 4.2 Speed Insights

Speed Insights are also automatically enabled. View them in:
- **Vercel Dashboard** → **Analytics** → **Speed Insights**

---

## 📋 Step 5: Understanding What's Tracked

### 5.1 Automatic Events

These events are tracked automatically:

| Event | When It Fires | Where Tracked |
|-------|--------------|---------------|
| `page_view` | Every page navigation | GA4 + Vercel Analytics |
| `login` | User signs in | GA4 |
| `sign_up` | User registers | GA4 |
| `conversion` | User completes registration | GA4 |
| `form_submission` | Form submitted (success/failure) | GA4 |
| `purchase` | Subscription upgrade | GA4 |
| `subscription_upgrade` | Tier change | GA4 |
| `email_verification` | Email verified | GA4 |

### 5.2 Event Parameters

Each event includes relevant parameters:

**Registration Events:**
```javascript
{
  method: 'email' | 'oauth' | 'wallet',
  tier: 'free' | 'pro' | 'elite',
  registration_type: 'email' | 'oauth' | 'wallet'
}
```

**Login Events:**
```javascript
{
  method: 'email' | 'oauth' | 'wallet'
}
```

**Purchase Events:**
```javascript
{
  currency: 'USD',
  value: 29.99,
  items: [{
    item_id: 'pro',
    item_name: 'Pro Subscription',
    item_category: 'subscription',
    price: 29.99,
    quantity: 1
  }]
}
```

---

## 📋 Step 6: Viewing Your Analytics Data

### 6.1 Google Analytics 4 Dashboard

1. **Realtime Reports**
   - Go to **Reports** → **Realtime**
   - See active users, page views, events happening right now

2. **User Acquisition**
   - Go to **Reports** → **Acquisition** → **User acquisition**
   - See how users find your site (organic, direct, referral, etc.)

3. **Engagement**
   - Go to **Reports** → **Engagement** → **Events**
   - See all custom events (sign_up, login, purchase, etc.)

4. **Conversions**
   - Go to **Admin** → **Events** → **Mark as conversion**
   - Mark `sign_up` and `purchase` as conversions
   - View conversion reports in **Reports** → **Engagement** → **Conversions**

### 6.2 Custom Reports

Create custom reports for:
- **Daily Registrations**: Filter by `sign_up` event
- **Registration Methods**: Group by `method` parameter
- **Tier Distribution**: Group by `tier` parameter
- **Conversion Funnel**: sign_up → email_verification → login → purchase

### 6.3 Vercel Analytics

View in **Vercel Dashboard** → **Analytics**:
- Page views over time
- Unique visitors
- Top pages
- Performance metrics
- Speed Insights

---

## 📋 Step 7: Advanced Configuration (Optional)

### 7.1 Track Additional Events

You can track custom events anywhere in your code:

```typescript
import { trackEvent } from '@/lib/analytics'

// Track button click
trackEvent('button_click', {
  button_name: 'Get Pro',
  location: '/pricing'
})

// Track feature usage
trackEvent('feature_usage', {
  feature_name: 'Export Data',
  user_tier: 'pro'
})

// Track search
trackEvent('search', {
  search_term: 'BTCUSDT',
  results_count: 5
})
```

### 7.2 Set User Properties

After login, set user properties:

```typescript
import { setUserProperties } from '@/lib/analytics'

setUserProperties(userId, {
  tier: 'pro',
  email: user.email
})
```

### 7.3 Track Page Engagement

Track time on page and scroll depth:

```typescript
import { trackPageEngagement } from '@/lib/analytics'

// Track engagement (call after user spends time on page)
trackPageEngagement(30000, 75) // 30 seconds, 75% scroll depth
```

---

## 📋 Step 8: Privacy & Compliance

### 8.1 GDPR Compliance

Google Analytics 4 is GDPR-compliant when configured properly:

1. **IP Anonymization**: Enabled by default in GA4
2. **Data Retention**: Set in **Admin** → **Data Settings** → **Data Retention**
3. **User Consent**: Consider adding a cookie consent banner

### 8.2 Cookie Consent (Optional)

If you need cookie consent, consider:
- [Cookie Consent](https://cookieconsent.insites.com/)
- [react-cookie-consent](https://www.npmjs.com/package/react-cookie-consent)

### 8.3 Disable Analytics for Specific Users

To disable analytics for admin users or in development:

```typescript
// In analytics.ts, the isAnalyticsEnabled() function
// already checks for production environment
```

---

## 📋 Step 9: Troubleshooting

### 9.1 No Data in Google Analytics

**Check:**
1. ✅ Measurement ID is correct in environment variables
2. ✅ `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set (not `NEXT_PUBLIC_GA_ID`)
3. ✅ Analytics enabled in production or `NEXT_PUBLIC_ENABLE_ANALYTICS=true` in dev
4. ✅ Browser console shows no errors
5. ✅ Network tab shows requests to `google-analytics.com`

**Debug:**
- Open browser console
- Look for `[Analytics]` log messages
- Check Network tab for `gtag` requests

### 9.2 Events Not Showing Up

**Check:**
1. ✅ Events are being called (check console logs)
2. ✅ Wait 24-48 hours for GA4 to process events (real-time shows immediately)
3. ✅ Check **Reports** → **Engagement** → **Events** (not just Realtime)

### 9.3 Vercel Analytics Not Showing

**Check:**
1. ✅ Project is deployed to Vercel (not running locally)
2. ✅ Analytics tab is visible in Vercel dashboard
3. ✅ Wait a few minutes after deployment for data to appear

---

## 📋 Step 10: Key Metrics to Monitor

### 10.1 User Growth Metrics

- **Daily Active Users (DAU)**: Users who visit each day
- **Weekly Active Users (WAU)**: Users who visit each week
- **Monthly Active Users (MAU)**: Users who visit each month
- **New Users**: First-time visitors
- **Returning Users**: Users who come back

### 10.2 Registration Metrics

- **Registration Rate**: Sign-ups / Total Visitors
- **Registration Method**: Email vs OAuth vs Wallet
- **Tier Distribution**: Free vs Pro vs Elite signups
- **Email Verification Rate**: Verified / Total Signups

### 10.3 Conversion Metrics

- **Sign-up → Verification**: % who verify email
- **Verification → Login**: % who log in after verification
- **Free → Pro Upgrade**: % who upgrade to Pro
- **Pro → Elite Upgrade**: % who upgrade to Elite

### 10.4 Engagement Metrics

- **Pages per Session**: Average pages viewed
- **Session Duration**: Average time on site
- **Bounce Rate**: Single-page sessions
- **Feature Usage**: Which features are used most

---

## ✅ Checklist

- [ ] Google Analytics 4 account created
- [ ] Measurement ID obtained
- [ ] Environment variable added to `.env.local`
- [ ] Environment variable added to Vercel
- [ ] Code deployed to production
- [ ] Analytics verified in GA4 Realtime report
- [ ] Vercel Analytics visible in dashboard
- [ ] Test registration tracked successfully
- [ ] Test login tracked successfully
- [ ] Custom events showing in GA4

---

## 🎉 You're All Set!

Your analytics are now fully configured and tracking:
- ✅ Page views (automatic)
- ✅ User registrations (all methods)
- ✅ User logins (all methods)
- ✅ Email verifications
- ✅ Subscription upgrades
- ✅ Form submissions
- ✅ Performance metrics

**Next Steps:**
1. Monitor your analytics dashboard daily
2. Set up custom reports for key metrics
3. Create conversion goals in GA4
4. Set up email alerts for important events
5. Review analytics weekly to track growth

---

## 📚 Additional Resources

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)

---

**Questions?** Check the code comments in `src/lib/analytics.ts` for implementation details.

