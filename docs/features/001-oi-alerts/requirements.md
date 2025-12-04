# OI Alerts - Requirements

## Purpose

Provide real-time alerts for significant Open Interest (OI) changes in Binance perpetual futures markets. This helps traders identify when large positions are being opened or closed, which can indicate potential market movements.

## Problem Statement

- Traders need to know when Open Interest changes significantly (>3% in 5 minutes)
- Current system only has Volume Alerts, missing OI movement signals
- Manual monitoring of OI changes across multiple assets is time-consuming

## User Stories

### As an Admin
- I want to see OI spike alerts on a dedicated admin page
- I want to identify which assets have significant OI changes
- I want to distinguish between OI increases (long spike) and decreases (short dump)
- I want to hear sound notifications when alerts arrive
- I want to see animations that draw attention to new alerts

## Scope

### In Scope
- OI change detection logic in Digital Ocean script
- Alert generation when OI changes >3% in 5 minutes (up or down)
- De-duplication to prevent spam (only alert on threshold crossing)
- Backend API endpoint to receive OI alerts
- Database storage for OI alerts
- Admin-only UI page to view OI alerts
- Visual design matching Volume Alerts (green for spike, red for dump)
- Sound notifications matching Volume Alert system
- Animation system matching Volume Alert system

### Out of Scope (for now)
- Displaying OI alerts to Free/Pro/Elite users
- Email/SMS notifications for OI alerts
- OI alert filtering or customization
- Historical OI alert analytics
- Export functionality for OI alerts

## Acceptance Criteria

1. **Detection Logic**
   - [ ] Digital Ocean script compares current OI to OI from 5 minutes ago
   - [ ] Alert fires when change ≥ +3% (long spike) or ≤ -3% (short dump)
   - [ ] De-duplication: only alert when crossing threshold from inside → outside
   - [ ] Script runs every 30 seconds (matches OI polling interval)

2. **Backend**
   - [ ] New `oi_alerts` database table created
   - [ ] API endpoint accepts OI alert data from Digital Ocean
   - [ ] Alerts stored with symbol, timestamp, OI change %, direction
   - [ ] Socket.IO broadcasts OI alerts to admin room

3. **Frontend (Admin Only)**
   - [ ] New `/admin/oi-alerts` page created
   - [ ] Admin role required to access page
   - [ ] Alert cards match Volume Alert design
   - [ ] Green cards for OI spike (≥+3%)
   - [ ] Red cards for OI dump (≤-3%)
   - [ ] Sound plays on new alert arrival
   - [ ] Animation plays on new alert arrival
   - [ ] Alerts sorted by timestamp (newest first)

4. **Quality**
   - [ ] No alerts leak to non-admin users
   - [ ] No console errors or warnings
   - [ ] TypeScript strict mode passes
   - [ ] Tests written and passing

## Constraints

### Technical
- Must use existing Digital Ocean OI polling infrastructure
- Must reuse Volume Alert UI components where possible
- Must follow existing authentication/authorization patterns
- Admin-only access (no tier-based access yet)

### Business
- Admin-only feature (not monetized yet)
- No user-facing documentation needed
- No impact on existing Volume Alert system

## Dependencies

- Existing OI polling script on Digital Ocean (`oi_realtime_poller.py`)
- Existing backend alert infrastructure
- Existing admin authentication system
- Existing Volume Alert UI components

## Success Metrics

- OI alerts detected within 30 seconds of threshold crossing
- Zero duplicate alerts for same threshold crossing
- Admin can view and hear alerts in real-time
- No performance degradation to existing systems
