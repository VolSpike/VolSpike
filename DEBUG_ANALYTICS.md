# 🔍 Debugging Google Analytics - Why You See 0 Users

## Quick Checks

### 1. Check Browser Console

Open DevTools → Console and look for:
- `[Analytics Debug]` logs
- `[Analytics] GA4 initialized` message
- `[Analytics] Tracking page view:` messages
- Any errors related to `gtag` or `google-analytics`

**What to look for:**
```javascript
[Analytics Debug] {
  hasMeasurementId: true,
  measurementId: "G-ZYNRS2JWTS",
  isProduction: true,
  enabled: true
}
[Analytics] GA4 initialized
[Analytics] Tracking page view: /dashboard Dashboard
```

### 2. Check Network Tab

Filter by `collect` (not just `gtag`):
- You should see requests to `google-analytics.com/g/collect`
- Status should be `200` or `204`
- These are the actual data collection requests

**If you DON'T see `collect` requests:**
- Ad blocker is blocking GA4
- Privacy settings are blocking tracking
- Analytics script isn't loading

### 3. Check if Ad Blocker is Active

**Common ad blockers that block GA4:**
- uBlock Origin
- AdBlock Plus
- Privacy Badger
- Brave Browser's built-in blocker

**Test:**
1. Open an **incognito/private window**
2. Visit your site
3. Check Realtime report
4. If it works in incognito → ad blocker is the issue

### 4. Check Browser Privacy Settings

**Chrome:**
- Settings → Privacy and security → Cookies and other site data
- Make sure "Block third-party cookies" isn't blocking GA4

**Firefox:**
- Settings → Privacy & Security → Enhanced Tracking Protection
- May block Google Analytics

**Safari:**
- Safari → Settings → Privacy
- "Prevent cross-site tracking" may block GA4

### 5. Verify Environment Variable

Check if the Measurement ID is actually being used:

**In browser console, run:**
```javascript
// Check if gtag is loaded
console.log('gtag available:', typeof window.gtag !== 'undefined')

// Check dataLayer
console.log('dataLayer:', window.dataLayer)

// Check Measurement ID
console.log('GA ID:', document.querySelector('script[src*="gtag"]')?.src)
```

### 6. Test with Direct gtag Call

**In browser console, run:**
```javascript
// Manually send a page view
if (window.gtag) {
  window.gtag('event', 'test_page_view', {
    page_path: window.location.pathname,
    page_title: document.title
  })
  console.log('✅ Test event sent!')
} else {
  console.error('❌ gtag not available')
}
```

Then check Realtime → Events for `test_page_view`

---

## Common Issues & Solutions

### Issue 1: Ad Blocker Blocking GA4

**Solution:**
- Disable ad blocker for your site
- Or use incognito mode to test
- Or whitelist `google-analytics.com` and `googletagmanager.com`

### Issue 2: Privacy Settings Blocking

**Solution:**
- Allow third-party cookies
- Disable "Prevent cross-site tracking"
- Use a different browser to test

### Issue 3: Script Not Loading

**Check:**
- Network tab → Filter by `gtag.js`
- Should see `js?id=G-ZYNRS2JWTS` loading
- Status should be `200`

**If not loading:**
- Check if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set correctly
- Check if site is in production mode
- Check browser console for errors

### Issue 4: Events Not Being Sent

**Check:**
- Network tab → Filter by `collect`
- Should see POST requests to `google-analytics.com/g/collect`
- Status should be `200` or `204`

**If no `collect` requests:**
- gtag function isn't working
- Check console for errors
- Verify analytics is enabled

### Issue 5: IP Filtering

**Check:**
- Google Analytics → Admin → Data Streams → Your Stream → Configure tag settings
- Check if your IP is filtered out
- Remove IP filters for testing

---

## Step-by-Step Debugging

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Look for analytics logs:**
   - Should see `[Analytics Debug]` with `enabled: true`
   - Should see `[Analytics] GA4 initialized`
   - Should see `[Analytics] Tracking page view:` messages

4. **Go to Network tab**
5. **Filter by `collect`**
6. **Navigate to different pages**
7. **You should see `collect` requests appearing**

**If you see `collect` requests but GA4 shows 0:**
- Wait 5-10 minutes (processing delay)
- Check if ad blocker is blocking
- Try incognito mode
- Check IP filtering in GA4 settings

---

## Quick Test Script

Run this in your browser console on your site:

```javascript
// Check analytics status
console.log('=== Analytics Debug ===')
console.log('gtag available:', typeof window.gtag !== 'undefined')
console.log('dataLayer:', window.dataLayer?.length || 0, 'items')
console.log('Measurement ID:', document.querySelector('script[src*="gtag"]')?.src?.match(/id=([^&]+)/)?.[1] || 'NOT FOUND')

// Try to send a test event
if (window.gtag) {
  window.gtag('event', 'manual_test', {
    test: true,
    timestamp: new Date().toISOString()
  })
  console.log('✅ Test event sent! Check GA4 Realtime → Events')
} else {
  console.error('❌ gtag not available - analytics not working')
}
```

---

## Expected Behavior

**Working Analytics:**
- ✅ Console shows `[Analytics] GA4 initialized`
- ✅ Console shows `[Analytics] Tracking page view:` on navigation
- ✅ Network tab shows `collect` requests
- ✅ GA4 Realtime shows data within 5-10 minutes

**Not Working:**
- ❌ No console logs
- ❌ No `collect` requests in Network tab
- ❌ gtag function not available
- ❌ Ad blocker blocking requests

---

**Most Common Issue:** Ad blockers! Try incognito mode first.

