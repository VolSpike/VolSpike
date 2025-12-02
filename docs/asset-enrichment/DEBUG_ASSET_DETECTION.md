# Debugging Asset Detection - RLS Not Detected

## Issue
RLS (RLSUSDT) was added to Binance perps but wasn't automatically detected and added to the database.

## Debugging Steps

### 1. Check Browser Console
After deployment, open browser DevTools (F12) → Console tab and look for:
- `[AssetDetection] 🔍 Checking for new assets...` - Should appear every 5 minutes
- `[AssetDetection] 📡 Calling detection endpoint` - Shows API call
- `[AssetDetection] 📥 Detection response` - Shows backend response
- `[AssetDetection] ✅ Detected X new assets` - Success message
- `[AssetDetection] ❌ Failed to detect` - Error message

### 2. Check if RLS is in Market Data
In browser console, run:
```javascript
// Check if RLS is in market data
const marketData = window.marketData || [];
const rlsSymbols = marketData.filter(item => item.symbol && item.symbol.includes('RLS'));
console.log('RLS symbols in market data:', rlsSymbols);
```

### 3. Manually Test Detection Endpoint
Open browser console and run:
```javascript
// Get current market data symbols
const symbols = Array.from(document.querySelectorAll('[data-symbol]')).map(el => el.getAttribute('data-symbol'))
  .filter(Boolean)
  .filter(s => s.endsWith('USDT'));

// Or manually test with RLS
const testSymbols = ['RLSUSDT'];

fetch('https://volspike-production.up.railway.app/api/assets/detect-new', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbols: testSymbols })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### 4. Check Backend Logs (Railway)
Look for:
- `[Assets] New asset detection requested (public endpoint)`
- `[AssetMetadata] Detected X new assets from Market Data`
- `hasRLS: true/false` in logs

### 5. Verify RLS Exists in Database
Check if RLS was already created (maybe detection worked but enrichment failed):
```sql
SELECT * FROM assets WHERE "baseSymbol" = 'RLS';
```

### 6. Common Issues

#### Issue: Hook not running
**Symptoms**: No console logs at all
**Fix**: Check if `useAssetDetection` is being called in dashboard.tsx

#### Issue: Market Data empty
**Symptoms**: `marketDataLength: 0` in logs
**Fix**: Check WebSocket connection, verify Market Data is loading

#### Issue: RLS not in Market Data
**Symptoms**: `hasRLS: false` in logs
**Fix**: RLS might not be in WebSocket stream (check Binance WebSocket directly)

#### Issue: Endpoint returns 404/500
**Symptoms**: `Failed to detect new assets: 404` or `500`
**Fix**: Check backend deployment, verify route is registered

#### Issue: Detection succeeds but no enrichment
**Symptoms**: `created: 1` but asset has no data
**Fix**: Check backend logs for enrichment errors, verify CoinGecko API is working

## Expected Behavior

1. **10 seconds after dashboard load**: First detection check
2. **Every 5 minutes**: Periodic detection check
3. **When RLS detected**: 
   - Asset created in database (`baseSymbol: 'RLS'`, `status: 'AUTO'`)
   - Enrichment starts automatically (background)
   - Notification created (if notification system is enabled)
   - Asset appears in admin panel within 1-2 minutes

## Manual Fix for RLS

If automatic detection isn't working, manually add RLS:

1. Go to `/admin/assets`
2. Click "Sync from Binance" button
3. RLS should be detected and added
4. Wait for enrichment to complete (or manually refresh RLS asset)

## Next Steps After Fix

Once detection is working:
1. Verify RLS appears in admin panel
2. Check that enrichment completed (has logo, description, etc.)
3. Verify user-facing slide-out card shows data instantly
4. Monitor logs for future new assets

