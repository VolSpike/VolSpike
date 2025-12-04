# Manual Test for RLS Detection

## Quick Test (Run in Browser Console)

After the deployment completes, open your browser console (F12) and run this:

```javascript
// Test if RLS detection endpoint works
fetch('https://volspike-production.up.railway.app/api/assets/detect-new', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbols: ['RLSUSDT'] })
})
.then(r => r.json())
.then(result => {
  console.log('✅ Detection Result:', result);
  if (result.created > 0) {
    console.log('✅ RLS was detected and created!');
  } else {
    console.log('ℹ️ RLS already exists or detection failed');
  }
})
.catch(err => {
  console.error('❌ Error:', err);
});
```

## Check Current Status

Run this to see if RLS already exists:

```javascript
// Check if RLS is in admin assets (requires auth)
// Or check browser console logs for detection activity
```

## What to Look For

1. **In Browser Console** (after deployment):
   - `[AssetDetection] 🔍 Checking for new assets...` - Should appear
   - `hasRLS: true` - Confirms RLS is in market data
   - `[AssetDetection] ✅ Detected X new assets` - Success

2. **In Backend Logs** (Railway):
   - `[Assets] New asset detection requested`
   - `hasRLS: true`
   - `[AssetMetadata] Detected X new assets`
   - `created: 1` (if RLS was created)

3. **In Admin Panel**:
   - Search for "RLS" in `/admin/assets`
   - Should appear with "Incomplete" status
   - Should have CoinGecko data after enrichment (1-2 minutes)

