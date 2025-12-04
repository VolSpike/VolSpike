# OI Alerts - Implementation Steps

## Phase 1: Database & Backend API

### Step 1.1: Database Schema
- [ ] Add `OIAlert` model to Prisma schema
- [ ] Create migration file
- [ ] Test migration locally
- [ ] Review migration SQL

### Step 1.2: Backend Ingest Endpoint
- [ ] Create `/api/oi-alerts/ingest` endpoint in Hono
- [ ] Implement API key validation
- [ ] Implement Zod schema validation
- [ ] Store alerts in database
- [ ] Broadcast to Socket.IO "admin" room
- [ ] Add error handling and logging
- [ ] Write unit tests for validation
- [ ] Write integration tests for endpoint

### Step 1.3: Backend Admin Endpoint
- [ ] Create `/api/oi-alerts` GET endpoint
- [ ] Implement admin role check middleware
- [ ] Implement pagination logic
- [ ] Implement symbol filtering
- [ ] Add error handling and logging
- [ ] Write unit tests
- [ ] Write integration tests

## Phase 2: Digital Ocean Script

### Step 2.1: OI Alert Detection Script
- [ ] Create `oi_alert_detector.py`
- [ ] Implement OI history tracking (10 minutes)
- [ ] Implement 5-minute lookback logic
- [ ] Implement % change calculation
- [ ] Implement threshold crossing detection (de-duplication)
- [ ] Implement API POST to backend
- [ ] Add error handling and retries
- [ ] Add logging

### Step 2.2: Integration with Existing OI Poller
- [ ] Review `oi_realtime_poller.py` structure
- [ ] Decide: extend existing script or create new service?
- [ ] If new service: create systemd service file
- [ ] Configure environment variables
- [ ] Test locally with backend

### Step 2.3: Deployment
- [ ] Copy script to Digital Ocean via SCP
- [ ] Set up systemd service (if new)
- [ ] Start service
- [ ] Verify logs
- [ ] Test end-to-end alert flow

## Phase 3: Frontend Admin Page

### Step 3.1: Custom Hook
- [ ] Create `useOIAlerts` hook
- [ ] Implement Socket.IO connection to "admin" room
- [ ] Implement REST API fetching (initial load + pagination)
- [ ] Implement alert state management (merge Socket + REST)
- [ ] Add TypeScript types
- [ ] Write unit tests

### Step 3.2: UI Components
- [ ] Create `OIAlertCard` component
- [ ] Implement green/red styling based on direction
- [ ] Add symbol, OI change, timestamp display
- [ ] Add Framer Motion animations (slide + pulse)
- [ ] Write component tests

### Step 3.3: Admin Page
- [ ] Create `/admin/oi-alerts/page.tsx`
- [ ] Implement admin role check (server-side)
- [ ] Add `OIAlertsPanel` container component
- [ ] Integrate `useOIAlerts` hook
- [ ] Add sound toggle control (reuse from Volume Alerts)
- [ ] Add pagination (Load More button)
- [ ] Add loading states
- [ ] Add error states
- [ ] Test on localhost

### Step 3.4: Navigation
- [ ] Add "OI Alerts" link to admin sidebar
- [ ] Update admin navigation component
- [ ] Test navigation flow

## Phase 4: Testing

### Step 4.1: Unit Tests
- [ ] Backend: Ingest endpoint validation
- [ ] Backend: Admin endpoint authorization
- [ ] Frontend: `useOIAlerts` hook
- [ ] Frontend: `OIAlertCard` component
- [ ] Digital Ocean: Alert detection logic

### Step 4.2: Integration Tests
- [ ] Backend: Full ingest flow (API → DB → Socket.IO)
- [ ] Backend: Admin endpoint pagination
- [ ] Frontend: Socket.IO + REST integration

### Step 4.3: End-to-End Tests
- [ ] Digital Ocean → Backend → Frontend flow
- [ ] Verify alert appears in admin UI
- [ ] Verify sound plays
- [ ] Verify animation plays
- [ ] Verify de-duplication works (no spam)

### Step 4.4: Manual Testing
- [ ] Test with admin account
- [ ] Test access denial for non-admin users
- [ ] Test across different browsers
- [ ] Test responsive design
- [ ] Test real OI data from Digital Ocean

## Phase 5: Deployment

### Step 5.1: Backend Deployment
- [ ] Run migration on production database (Railway)
- [ ] Deploy backend code to Railway
- [ ] Verify `/health` endpoint
- [ ] Verify ingest endpoint accessible
- [ ] Check logs for errors

### Step 5.2: Frontend Deployment
- [ ] Deploy frontend to Vercel
- [ ] Verify build succeeds
- [ ] Test admin page in production
- [ ] Check console for errors

### Step 5.3: Digital Ocean Deployment
- [ ] Copy script to production droplet
- [ ] Configure systemd service
- [ ] Start service
- [ ] Verify logs
- [ ] Test end-to-end flow

### Step 5.4: Monitoring
- [ ] Set up alert count metrics
- [ ] Monitor backend logs for errors
- [ ] Monitor Digital Ocean script logs
- [ ] Verify Socket.IO connections

## Phase 6: Documentation

### Step 6.1: Code Documentation
- [ ] Add JSDoc comments to new functions
- [ ] Document API endpoints in code
- [ ] Document hook usage

### Step 6.2: Update Project Docs
- [ ] Update AGENTS.md with OI Alerts section
- [ ] Update OVERVIEW.md if needed
- [ ] Update IMPLEMENTATION_PLAN.md

## Dependencies

### External Dependencies
- None (all dependencies already in project)

### Internal Dependencies
1. Phase 1 must complete before Phase 2 (backend must exist for script to POST)
2. Phase 1 must complete before Phase 3 (frontend needs API endpoints)
3. Phase 2 can run in parallel with Phase 3
4. Phase 4 requires all phases complete
5. Phase 5 requires Phase 4 complete

## Testing Strategy

### Unit Testing
- **Backend**: Vitest for API endpoints, validation logic
- **Frontend**: Vitest + Testing Library for hooks and components
- **Digital Ocean**: pytest for Python detection logic

### Integration Testing
- **Backend**: Test full request flow (API → DB → Socket.IO)
- **Frontend**: Test Socket.IO + REST integration with mock server

### E2E Testing
- Manual testing with production-like environment
- Test with real OI data from Digital Ocean

### Coverage Goals
- Backend: 70% (existing threshold)
- Frontend: 60% (existing threshold)
- Digital Ocean: 80% (critical detection logic)

## Rollout Plan

### Gradual Rollout
1. Deploy backend and database (no alerts sent yet)
2. Deploy Digital Ocean script in "dry run" mode (log only, no POST)
3. Verify detection logic works correctly
4. Enable POST to backend
5. Deploy frontend admin page
6. Test with admin account
7. Monitor for 24 hours
8. Announce to team

### Success Criteria
- [ ] Zero duplicate alerts
- [ ] Alerts arrive within 60 seconds of threshold crossing
- [ ] No errors in backend logs
- [ ] No errors in Digital Ocean logs
- [ ] No performance degradation
- [ ] Admin UI responsive and functional

## Rollback Plan

### If Issues Occur
1. **Stop Digital Ocean script**: `ssh volspike-do "sudo systemctl stop oi-alerts.service"`
2. **Disable frontend page**: Feature flag or remove from navigation
3. **Database rollback**: If migration causes issues, rollback migration
4. **Backend rollback**: Revert to previous Railway deployment

### Data Preservation
- Keep OI alerts in database even if feature is disabled
- Can re-enable later without data loss

## Estimated Effort

- **Phase 1**: 4-6 hours (database + backend API)
- **Phase 2**: 4-6 hours (Digital Ocean script + integration)
- **Phase 3**: 6-8 hours (frontend admin page + components)
- **Phase 4**: 4-6 hours (testing)
- **Phase 5**: 2-3 hours (deployment)
- **Phase 6**: 1-2 hours (documentation)

**Total**: 21-31 hours

## Risk Mitigation

### Risk: De-duplication fails, spam alerts
- **Mitigation**: Thorough testing of threshold crossing logic
- **Fallback**: Add rate limiting on ingest endpoint

### Risk: OI data missing from 5 minutes ago
- **Mitigation**: Handle gracefully, skip alert generation
- **Monitoring**: Log when insufficient data available

### Risk: Performance impact on backend
- **Mitigation**: Use dedicated Socket.IO room, database indexes
- **Monitoring**: Track API response times

### Risk: Admin page shows alerts to non-admin
- **Mitigation**: Server-side and client-side role checks
- **Testing**: Test with non-admin accounts

## Future Enhancements (Out of Scope)

- Display OI alerts to Pro/Elite users
- Email/SMS notifications for OI alerts
- Customizable OI threshold (e.g., 2%, 5%)
- Historical OI alert charts
- Export OI alerts to CSV
- Filter OI alerts by symbol, direction, time range
