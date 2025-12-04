# Enhanced Volume Alert Cards - Requirements

## Purpose

Enhance Volume Alert cards for Pro tier users with additional trading-relevant metrics:
1. **Price Change %** - Show percentage change from hour open to alert trigger time
2. **OI Change %** - Show Open Interest change from hour start to alert trigger time

## Scope

### Included
- New fields on Volume Alert: `priceChange` (%) and `oiChange` (%)
- Python script modifications to calculate and send these values
- Backend schema updates to store new fields
- Pro-only enhanced alert card display
- Admin preview page to test the new card format

### Excluded
- Changes to Free/Elite tier alert card display (they continue seeing current format)
- Historical backfill of existing alerts

## User Stories

1. **As a Pro user**, I want to see price change % on alert cards, so I can quickly assess price momentum since the hour started.

2. **As a Pro user**, I want to see OI change % on alert cards, so I can understand whether positions are being opened or closed during the volume spike.

3. **As an admin**, I want a preview page to test the enhanced alert cards before rolling out to Pro users.

## Acceptance Criteria

### Price Change %
- [x] Shows percentage change between hour open price and price at alert trigger time
- [x] Format: `Price: +5.23%` or `Price: -2.14%`
- [x] Green color for positive, red for negative
- [x] Replaces current `Price: $x.xx` display for Pro users only

### OI Change %
- [x] Shows percentage change in Open Interest (contracts) from hour start to alert trigger
- [x] Format: `OI: +3.45%` or `OI: -1.23%`
- [x] Green color for positive (more positions opened), red for negative (positions closed)
- [x] Appears after Funding rate on the alert card

### Admin Preview
- [x] New page at `/admin/alert-preview` to view enhanced cards
- [x] Uses mock data or recent real alerts
- [x] Shows both current (Free/Elite) and enhanced (Pro) card formats side-by-side

## Constraints

### Technical
- OI snapshots are stored every 30 seconds in `OpenInterestSnapshot` table
- Hour open price is available from the candle data in Python script
- Must not impact Free/Elite tier experience
- Must be backward compatible with existing alerts (null values allowed)

### Business
- Pro tier exclusive feature
- Does not affect alert detection logic, only display
