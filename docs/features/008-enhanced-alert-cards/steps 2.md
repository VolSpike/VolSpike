# Enhanced Volume Alert Cards - Implementation Steps

## Phase 1: Backend Changes

### Step 1: Update Prisma Schema
- [x] Add `priceChange Float?` field to VolumeAlert model
- [x] Add `oiChange Float?` field to VolumeAlert model
- [x] Add `detectionTime DateTime?` field (was missing)
- [ ] Run `npx prisma db push` to apply changes (deployment step)

### Step 2: Update Backend Ingest Schema
- [x] Add `priceChange` to Zod schema (optional number)
- [x] Add `oiChange` to Zod schema (optional number)
- [x] Update database insert to include new fields

### Step 3: Create OI Snapshot Query Endpoint
- [x] Add `GET /api/market/open-interest/snapshot` endpoint
- [x] Query: Get OI for symbol at specific timestamp (nearest before)
- [x] Secure with API key authentication
- [x] Return: `{ found, symbol, openInterest, ts, source }`

## Phase 2: Python Script Changes

### Step 4: Calculate Price Change
- [x] Store hour open price from candle data (already available)
- [x] Calculate: `(current_price - open_price) / open_price`
- [x] Add `priceChange` to payload

### Step 5: Calculate OI Change
- [x] Add `fetch_oi_snapshot()` function to query backend
- [x] Add `fetch_current_oi()` function to query Binance
- [x] Calculate: `(current_oi - baseline_oi) / baseline_oi`
- [x] Add `oiChange` to payload
- [x] Handle errors gracefully (null if unavailable)

### Step 6: Update Payload Structure
- [x] Add `priceChange` and `oiChange` to `volspike_send()` function
- [x] Add `priceChange` and `oiChange` to `volspike_send_to_env()` function
- [x] Log enhanced metrics in console output

## Phase 3: Frontend Changes

### Step 7: Update VolumeAlert Type
- [x] Add `priceChange?: number` to VolumeAlert interface
- [x] Add `oiChange?: number` to VolumeAlert interface

### Step 8: Create Enhanced Alert Card Component
- [x] Add `formatPercentChange()` helper function
- [x] Add `getPercentChangeColor()` helper function
- [x] Conditional rendering based on tier (Elite vs Free/Pro)
- [x] Format price change: `+5.23%` / `-2.14%`
- [x] Format OI change: `OI: +3.45%` / `OI: -1.23%`
- [x] Apply color coding (green for positive, red for negative)
- [x] Fallback to absolute price if priceChange is null

### Step 9: Create Admin Preview Page
- [x] Create `/admin/alert-preview/page.tsx`
- [x] Display sample alerts with mock enhanced data
- [x] Show side-by-side comparison (Free, Pro, Elite)
- [x] Include legacy alert without enhanced data
- [x] Feature overview documentation

## Phase 4: Testing & Deployment

### Step 10: Local Testing
- [x] Backend type check passes
- [ ] Test Python script with dry run
- [ ] Test frontend displays correctly
- [ ] Test tier-based display logic

### Step 11: Deploy Backend
- [ ] Run Prisma migration on Railway: `npx prisma db push`
- [ ] Deploy backend changes

### Step 12: Deploy Python Script
- [ ] SCP script to Digital Ocean
- [ ] Restart volspike.service
- [ ] Monitor logs for enhanced metrics

### Step 13: Deploy Frontend
- [ ] Deploy to Vercel
- [ ] Verify admin preview page works
- [ ] Verify production Elite users see enhanced metrics

## Rollback Plan

1. **Backend**: New fields are optional, no rollback needed
2. **Python Script**: Revert to previous version via SCP
3. **Frontend**: Revert Vercel deployment

## Dependencies

- Step 3 must complete before Step 5 (Python needs OI endpoint)
- Steps 1-2 must complete before Step 6 (backend must accept new fields)
- Steps 4-6 must complete before Step 8 (frontend needs data)

## Files Modified

### Backend
- `volspike-nodejs-backend/prisma/schema.prisma` - Added priceChange, oiChange, detectionTime fields
- `volspike-nodejs-backend/src/routes/volume-alerts.ts` - Updated ingest schema and database insert
- `volspike-nodejs-backend/src/routes/open-interest.ts` - Added `/snapshot` endpoint

### Python Script
- `Digital Ocean/hourly_volume_alert_dual_env.py` - Added OI/price calculation and payload

### Frontend
- `volspike-nextjs-frontend/src/hooks/use-volume-alerts.ts` - Updated VolumeAlert type
- `volspike-nextjs-frontend/src/components/volume-alerts-panel.tsx` - Enhanced display logic
- `volspike-nextjs-frontend/src/app/(admin)/admin/alert-preview/page.tsx` - New admin preview page

### Documentation
- `docs/features/008-enhanced-alert-cards/requirements.md`
- `docs/features/008-enhanced-alert-cards/design.md`
- `docs/features/008-enhanced-alert-cards/steps.md` (this file)
