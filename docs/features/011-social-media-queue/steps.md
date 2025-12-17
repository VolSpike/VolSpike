# Implementation Steps: Social Media Queue for Twitter/X Posting

## Overview

This document outlines the step-by-step implementation plan for the Social Media Queue feature, following Test-Driven Development (TDD) principles.

## Phase 1: Database Schema & Migration

### Step 1.1: Update Prisma Schema

**File**: `volspike-nodejs-backend/prisma/schema.prisma`

**Actions**:
- [ ] Add `SocialMediaPost` model with all fields
- [ ] Add `SocialMediaStatus` enum (QUEUED, POSTING, POSTED, FAILED, REJECTED)
- [ ] Add `AlertTypeEnum` enum (VOLUME, OPEN_INTEREST)
- [ ] Add appropriate indexes

**Testing**:
- [ ] Run `npx prisma validate` to check schema validity
- [ ] Verify no syntax errors

**Dependencies**: None

---

### Step 1.2: Run Database Migration

**Commands**:
```bash
cd volspike-nodejs-backend
npx prisma migrate dev --name add-social-media-posts
npx prisma generate
```

**Actions**:
- [ ] Create migration file
- [ ] Apply migration to local database
- [ ] Regenerate Prisma client

**Testing**:
- [ ] Verify migration creates `social_media_posts` table
- [ ] Check indexes are created: `psql -d volspike -c "\d social_media_posts"`

**Dependencies**: Step 1.1

---

## Phase 2: Backend Implementation

### Step 2.1: Create TypeScript Types

**File**: `volspike-nodejs-backend/src/types/social-media.ts`

**Actions**:
- [ ] Define `SocialMediaPost` interface
- [ ] Define `QueuedPostWithAlert` interface
- [ ] Define `CreateSocialMediaPostRequest` interface
- [ ] Define `UpdateSocialMediaPostRequest` interface
- [ ] Define `PostToTwitterResponse` interface
- [ ] Export all types

**Testing**:
- [ ] Run `npm run type-check` (TypeScript compile)
- [ ] Verify no type errors

**Dependencies**: Step 1.2 (Prisma types available)

---

### Step 2.2: Create Caption Generator Utility

**File**: `volspike-nodejs-backend/src/lib/caption-generator.ts`

**TDD Approach**:

1. **Write Tests First** (Red)
   - File: `volspike-nodejs-backend/src/lib/caption-generator.test.ts`
   - [ ] Test: `generateVolumeAlertCaption` with positive price change
   - [ ] Test: `generateVolumeAlertCaption` with negative price change
   - [ ] Test: `generateVolumeAlertCaption` with null price change
   - [ ] Test: `generateOIAlertCaption` with increase
   - [ ] Test: `generateOIAlertCaption` with decrease
   - [ ] Test: Caption length is ≤ 280 characters
   - [ ] Run tests (should fail): `npm test caption-generator`

2. **Implement** (Green)
   - [ ] Create `generateVolumeAlertCaption` function
   - [ ] Create `generateOIAlertCaption` function
   - [ ] Create `formatVolume` helper
   - [ ] Create `formatPercent` helper
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Extract common logic
   - [ ] Add JSDoc comments
   - [ ] Ensure tests still pass

**Dependencies**: Step 2.1

---

### Step 2.3: Create Twitter Service

**File**: `volspike-nodejs-backend/src/services/twitter.service.ts`

**Setup**:
- [ ] Install dependency: `npm install twitter-api-v2`
- [ ] Add Twitter API credentials to `.env` (with placeholders)
  ```
  TWITTER_API_KEY=your_api_key_here
  TWITTER_API_SECRET=your_api_secret_here
  TWITTER_ACCESS_TOKEN=your_access_token_here
  TWITTER_ACCESS_SECRET=your_access_secret_here
  ```

**TDD Approach**:

1. **Write Tests First** (Red)
   - File: `volspike-nodejs-backend/src/services/twitter.service.test.ts`
   - [ ] Test: `postTweetWithImage` success case (mock Twitter API)
   - [ ] Test: `postTweetWithImage` rate limit error (429)
   - [ ] Test: `postTweetWithImage` auth error (401)
   - [ ] Test: `postTweetWithImage` general error (500)
   - [ ] Run tests (should fail): `npm test twitter.service`

2. **Implement** (Green)
   - [ ] Create `TwitterService` class
   - [ ] Implement constructor (initialize TwitterApi client)
   - [ ] Implement `postTweetWithImage` method
     - Upload image to Twitter
     - Post tweet with media ID
     - Return tweet ID and URL
   - [ ] Handle rate limit errors (429)
   - [ ] Handle auth errors (401)
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Add error logging
   - [ ] Add retry logic (optional for V1)
   - [ ] Ensure tests still pass

**Dependencies**: Step 2.1

---

### Step 2.4: Create Social Media API Routes

**File**: `volspike-nodejs-backend/src/routes/admin/social-media.routes.ts`

**TDD Approach**:

1. **Write Integration Tests First** (Red)
   - File: `volspike-nodejs-backend/src/routes/admin/social-media.routes.test.ts`
   - [ ] Test: POST /queue creates queue item (200)
   - [ ] Test: POST /queue rejects duplicate alert (409)
   - [ ] Test: POST /queue requires admin auth (403)
   - [ ] Test: GET /queue returns queued posts (200)
   - [ ] Test: GET /queue pagination works
   - [ ] Test: PATCH /queue/:id updates caption (200)
   - [ ] Test: POST /post/:id posts to Twitter (200, mock Twitter API)
   - [ ] Test: POST /post/:id handles Twitter error (500)
   - [ ] Test: GET /history returns posted tweets (200)
   - [ ] Run tests (should fail): `npm test social-media.routes`

2. **Implement** (Green)
   - [ ] Create Hono router instance
   - [ ] Add admin auth middleware
   - [ ] Implement POST `/api/admin/social-media/queue`
     - Validate request body with Zod
     - Check for duplicate (existing queued/posted post for alertId)
     - Generate caption if not provided
     - Create database record
     - Return response
   - [ ] Implement GET `/api/admin/social-media/queue`
     - Parse query params (status, limit, offset)
     - Fetch posts with Prisma (include alert relation)
     - Return paginated response
   - [ ] Implement PATCH `/api/admin/social-media/queue/:id`
     - Validate caption length (≤ 280 chars)
     - Update database record
     - Return response
   - [ ] Implement POST `/api/admin/social-media/post/:id`
     - Fetch post from database
     - Check status (must be QUEUED)
     - Set status to POSTING
     - Call TwitterService.postTweetWithImage
     - Update status to POSTED, save tweet ID/URL
     - Return response
   - [ ] Implement GET `/api/admin/social-media/history`
     - Parse query params
     - Fetch posted posts with filters
     - Return paginated response
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Extract validation schemas to separate file
   - [ ] Add error logging
   - [ ] Ensure tests still pass

**Dependencies**: Steps 2.2, 2.3

---

### Step 2.5: Register Routes in Main App

**File**: `volspike-nodejs-backend/src/index.ts` (or wherever routes are registered)

**Actions**:
- [ ] Import social media routes
- [ ] Register routes: `app.route('/api/admin/social-media', socialMediaRoutes)`
- [ ] Verify routes are accessible

**Testing**:
- [ ] Start backend: `npm run dev`
- [ ] Test endpoint with curl:
  ```bash
  curl -H "Authorization: Bearer <admin-token>" \
       http://localhost:8787/api/admin/social-media/queue
  ```
- [ ] Should return 200 with empty array (no posts yet)

**Dependencies**: Step 2.4

---

### Step 2.6: Deploy Backend to Railway

**Actions**:
- [ ] Commit backend changes
- [ ] Push to main branch (triggers Railway deploy)
- [ ] Run migration on Railway:
  ```bash
  railway run npx prisma migrate deploy
  ```
- [ ] Add Twitter API credentials to Railway environment variables
  - Go to Railway dashboard → volspike-backend → Variables
  - Add `TWITTER_API_KEY`, `TWITTER_API_SECRET`, etc.
- [ ] Restart Railway service

**Testing**:
- [ ] Test production API endpoint with Postman
- [ ] Verify authentication works
- [ ] Check Railway logs for errors

**Dependencies**: Step 2.5

---

## Phase 3: Frontend Implementation

### Step 3.1: Install Frontend Dependencies

**Commands**:
```bash
cd volspike-nextjs-frontend
npm install html2canvas
```

**Actions**:
- [ ] Install html2canvas library
- [ ] Verify package.json updated

**Testing**:
- [ ] Run `npm run build` to verify no dependency conflicts

**Dependencies**: None

---

### Step 3.2: Create Frontend Types

**File**: `volspike-nextjs-frontend/src/types/social-media.ts`

**Actions**:
- [ ] Copy type definitions from backend (or share via shared package)
- [ ] Export all types

**Testing**:
- [ ] Run `npm run type-check`
- [ ] Verify no type errors

**Dependencies**: None

---

### Step 3.3: Create Admin API Client Methods

**File**: `volspike-nextjs-frontend/src/lib/admin/api-client.ts` (extend existing)

**Actions**:
- [ ] Add `addToSocialMediaQueue` method
- [ ] Add `getSocialMediaQueue` method
- [ ] Add `updateSocialMediaPost` method
- [ ] Add `postToTwitter` method
- [ ] Add `getSocialMediaHistory` method

**Example**:
```typescript
async addToSocialMediaQueue(data: CreateSocialMediaPostRequest) {
  return this.request('/api/admin/social-media/queue', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
```

**Testing**:
- [ ] TypeScript compilation passes
- [ ] Test with mock server (optional)

**Dependencies**: Step 3.2

---

### Step 3.4: Create Image Capture Utility

**File**: `volspike-nextjs-frontend/src/lib/capture-alert-image.ts`

**TDD Approach** (Optional for utility functions, but recommended):

1. **Write Tests First** (Red)
   - File: `volspike-nextjs-frontend/src/lib/capture-alert-image.test.ts`
   - [ ] Test: Throws error if element not found
   - [ ] Test: Returns base64 string with PNG data URL prefix
   - [ ] Test: Canvas dimensions match element size
   - [ ] Run tests (should fail): `npm test capture-alert-image`

2. **Implement** (Green)
   - [ ] Create `captureAlertCard` function
     - Accept element ID or ref
     - Call html2canvas with options (scale: 2, backgroundColor)
     - Convert canvas to base64
     - Return data URL string
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Add error handling
   - [ ] Add JSDoc comments
   - [ ] Ensure tests still pass

**Dependencies**: Step 3.1 (html2canvas installed)

---

### Step 3.5: Create AddToTwitterButton Component

**File**: `volspike-nextjs-frontend/src/components/admin/add-to-twitter-button.tsx`

**TDD Approach**:

1. **Write Component Tests First** (Red)
   - File: `volspike-nextjs-frontend/src/components/admin/add-to-twitter-button.test.tsx`
   - [ ] Test: Renders button with Twitter icon
   - [ ] Test: Shows "Already Queued" when isQueued=true
   - [ ] Test: Calls onClick handler when clicked
   - [ ] Test: Shows loading state during capture
   - [ ] Test: Shows success toast on success
   - [ ] Test: Shows error toast on failure
   - [ ] Run tests (should fail): `npm test add-to-twitter-button`

2. **Implement** (Green)
   - [ ] Create component with props
   - [ ] Add button UI (Twitter icon + text)
   - [ ] Implement onClick handler:
     - Find parent alert card element
     - Call captureAlertCard utility
     - Call adminAPI.addToSocialMediaQueue
     - Show success/error toast
   - [ ] Handle loading state
   - [ ] Handle isQueued state (disabled button)
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Extract toast messages to constants
   - [ ] Improve error messaging
   - [ ] Ensure tests still pass

**Dependencies**: Steps 3.3, 3.4

---

### Step 3.6: Add Button to Alert Cards

**Files**:
- `volspike-nextjs-frontend/src/components/volume-alerts-content.tsx`
- `volspike-nextjs-frontend/src/components/oi-alerts-content.tsx`

**Actions**:
- [ ] Import `AddToTwitterButton` component
- [ ] Check if user is admin: `session?.user?.role === 'ADMIN'`
- [ ] If admin, render button in alert card actions area
- [ ] Pass `alertId` and `alertType` props
- [ ] Test: View alerts as admin, verify button appears
- [ ] Test: View alerts as non-admin, verify button does not appear

**Dependencies**: Step 3.5

---

### Step 3.7: Create Social Media Queue Page

**File**: `volspike-nextjs-frontend/src/app/(admin)/admin/social-media/page.tsx`

**TDD Approach**:

1. **Write Component Tests First** (Red)
   - File: `volspike-nextjs-frontend/src/app/(admin)/admin/social-media/page.test.tsx`
   - [ ] Test: Renders tabs (Queue, History)
   - [ ] Test: Fetches queued posts on mount
   - [ ] Test: Displays queued post cards
   - [ ] Test: Switches to History tab
   - [ ] Test: Handles empty queue state
   - [ ] Run tests (should fail): `npm test social-media/page`

2. **Implement** (Green)
   - [ ] Create page component (use client)
   - [ ] Add Tabs UI (Queue, History)
   - [ ] Fetch queued posts with useEffect
   - [ ] Render list of QueuedPostCard components
   - [ ] Fetch history when History tab clicked
   - [ ] Handle loading state
   - [ ] Handle error state
   - [ ] Handle empty state
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Extract data fetching to custom hook (optional)
   - [ ] Improve loading/error UI
   - [ ] Ensure tests still pass

**Dependencies**: Steps 3.3, 3.8 (QueuedPostCard component)

---

### Step 3.8: Create QueuedPostCard Component

**File**: `volspike-nextjs-frontend/src/components/admin/queued-post-card.tsx`

**TDD Approach**:

1. **Write Component Tests First** (Red)
   - File: `volspike-nextjs-frontend/src/components/admin/queued-post-card.test.tsx`
   - [ ] Test: Renders image preview
   - [ ] Test: Renders editable caption textarea
   - [ ] Test: Shows character count (280 limit)
   - [ ] Test: Character count turns red when > 280
   - [ ] Test: Renders alert metadata (symbol, ratio, time)
   - [ ] Test: Calls onPost when "Post Now" clicked
   - [ ] Test: Calls onEdit when caption edited and saved
   - [ ] Test: Calls onReject when "Reject" clicked
   - [ ] Test: Shows loading state during post
   - [ ] Test: Shows error message if status=FAILED
   - [ ] Run tests (should fail): `npm test queued-post-card`

2. **Implement** (Green)
   - [ ] Create component with props
   - [ ] Render image preview (<img src={post.imageUrl} />)
   - [ ] Render editable Textarea for caption
   - [ ] Add character counter (caption.length / 280)
   - [ ] Render alert metadata (symbol, ratio, timestamp)
   - [ ] Add "Post Now" button (calls onPost)
   - [ ] Add "Edit Caption" button (calls onEdit)
   - [ ] Add "Reject" button (calls onReject)
   - [ ] Handle loading states
   - [ ] Show error badge if status=FAILED
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Improve styling (use Tailwind classes)
   - [ ] Add confirmation dialog for reject action
   - [ ] Ensure tests still pass

**Dependencies**: Step 3.2

---

### Step 3.9: Create PostingHistory Component

**File**: `volspike-nextjs-frontend/src/components/admin/posting-history.tsx`

**TDD Approach**:

1. **Write Component Tests First** (Red)
   - File: `volspike-nextjs-frontend/src/components/admin/posting-history.test.tsx`
   - [ ] Test: Renders list of posted tweets
   - [ ] Test: Shows image thumbnail
   - [ ] Test: Shows caption (truncated if long)
   - [ ] Test: Shows "View on Twitter" link
   - [ ] Test: Shows posted timestamp (relative)
   - [ ] Test: Handles empty history state
   - [ ] Run tests (should fail): `npm test posting-history`

2. **Implement** (Green)
   - [ ] Create component with props
   - [ ] Map over history items
   - [ ] Render image thumbnail
   - [ ] Render caption (truncate to 100 chars)
   - [ ] Render "View on Twitter" link (opens in new tab)
   - [ ] Render timestamp with `formatDistanceToNow`
   - [ ] Handle empty state
   - [ ] Run tests (should pass)

3. **Refactor**
   - [ ] Improve styling
   - [ ] Add pagination controls (optional for V1)
   - [ ] Ensure tests still pass

**Dependencies**: Step 3.2

---

### Step 3.10: Add Navigation Link to Admin Sidebar

**File**: `volspike-nextjs-frontend/src/components/admin/admin-navigation.tsx` (or similar)

**Actions**:
- [ ] Add "Social Media" navigation link
- [ ] Icon: Twitter icon from lucide-react
- [ ] href: `/admin/social-media`
- [ ] Test: Click link, navigate to Social Media page

**Dependencies**: None

---

### Step 3.11: Test Full Frontend Flow

**Manual Testing Checklist**:
- [ ] Login as admin
- [ ] Navigate to Alerts page
- [ ] Click "Add to Twitter" on an alert card
- [ ] Verify success toast appears
- [ ] Navigate to Social Media page
- [ ] Verify alert appears in Queue tab
- [ ] Edit caption text
- [ ] Verify character count updates
- [ ] Click "Post to Twitter"
- [ ] Verify loading spinner appears
- [ ] Verify success toast appears
- [ ] Verify post moves to History tab
- [ ] Click "View on Twitter" link
- [ ] Verify tweet opens in new tab

**Dependencies**: Steps 3.5-3.10

---

## Phase 4: Twitter API Setup

### Step 4.1: Apply for Twitter Developer Account

**Actions**:
- [ ] Go to https://developer.twitter.com/
- [ ] Sign in with VolSpike Twitter account
- [ ] Apply for Elevated access (required for media upload)
- [ ] Fill out use case form (mention social media automation for crypto alerts)
- [ ] Wait for approval (usually 1-3 days)

**Dependencies**: None

---

### Step 4.2: Create Twitter App

**Actions**:
- [ ] Once approved, go to Twitter Developer Portal
- [ ] Create new app: "VolSpike Social Media Bot"
- [ ] Enable OAuth 1.0a (required for media upload)
- [ ] Set app permissions to "Read and Write"
- [ ] Generate API Key and Secret
- [ ] Generate Access Token and Secret
- [ ] Save credentials securely

**Dependencies**: Step 4.1

---

### Step 4.3: Add Credentials to Railway

**Actions**:
- [ ] Go to Railway dashboard → volspike-backend → Variables
- [ ] Add `TWITTER_API_KEY` = <your_api_key>
- [ ] Add `TWITTER_API_SECRET` = <your_api_secret>
- [ ] Add `TWITTER_ACCESS_TOKEN` = <your_access_token>
- [ ] Add `TWITTER_ACCESS_SECRET` = <your_access_secret>
- [ ] Restart Railway service

**Testing**:
- [ ] Check Railway logs for Twitter API initialization
- [ ] Verify no errors

**Dependencies**: Step 4.2

---

### Step 4.4: Test Twitter Posting (Production)

**Actions**:
- [ ] Use production frontend to queue a post
- [ ] Click "Post to Twitter"
- [ ] Verify tweet appears on Twitter: https://twitter.com/volspike
- [ ] Verify image is attached
- [ ] Verify caption text matches

**Rollback Plan**:
- If posting fails, check Railway logs for error
- Verify API credentials are correct
- Test with Twitter API Playground first

**Dependencies**: Step 4.3

---

## Phase 5: Testing & Quality Assurance

### Step 5.1: Unit Tests

**Actions**:
- [ ] Run backend unit tests: `cd volspike-nodejs-backend && npm test`
- [ ] Run frontend unit tests: `cd volspike-nextjs-frontend && npm test`
- [ ] Verify all tests pass
- [ ] Code coverage should be > 80% for new code

**Dependencies**: All implementation steps

---

### Step 5.2: Integration Tests

**Actions**:
- [ ] Test API endpoints with Postman/Insomnia
- [ ] Test authentication (admin-only access)
- [ ] Test error cases (invalid input, duplicates)
- [ ] Test rate limiting (make 50+ requests in quick succession)

**Dependencies**: Backend implementation

---

### Step 5.3: E2E Testing (Manual)

**Test Scenarios**:
1. **Happy Path**
   - [ ] Admin adds alert to queue → Success
   - [ ] Admin edits caption → Success
   - [ ] Admin posts to Twitter → Tweet appears

2. **Duplicate Prevention**
   - [ ] Admin adds alert to queue → Success
   - [ ] Admin clicks "Add to Twitter" again → Shows "Already Queued"

3. **Error Handling**
   - [ ] Admin tries to post with > 280 char caption → Error toast
   - [ ] Backend returns 500 error → Error toast with message

4. **Non-Admin Access**
   - [ ] Free user views alerts → No "Add to Twitter" button
   - [ ] Free user tries to access /admin/social-media → 403 error

5. **Mobile Responsiveness**
   - [ ] Test on mobile device (or browser dev tools)
   - [ ] Verify queue page is responsive
   - [ ] Verify image previews scale correctly

**Dependencies**: All implementation steps

---

### Step 5.4: Performance Testing

**Actions**:
- [ ] Measure image generation time (should be < 5 seconds)
- [ ] Measure queue page load time (should be < 2 seconds)
- [ ] Measure Twitter posting time (should be < 10 seconds)
- [ ] Check database query performance (no N+1 queries)

**Tools**:
- Chrome DevTools (Performance tab)
- Network tab (API response times)
- Lighthouse (page performance score)

**Dependencies**: All implementation steps

---

### Step 5.5: Security Audit

**Checklist**:
- [ ] Admin-only endpoints require authentication
- [ ] JWT token is validated on backend
- [ ] Twitter API credentials are never exposed to client
- [ ] Input validation on all endpoints (Zod schemas)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React escaping + Twitter API sanitization)
- [ ] Rate limiting implemented (prevent abuse)
- [ ] Audit logs created for all post actions

**Dependencies**: All implementation steps

---

## Phase 6: Documentation & Deployment

### Step 6.1: Update User Documentation

**Files**:
- [ ] Update `human-docs/17-ADMIN-PAGES.md` (add Social Media section)
- [ ] Update `human-docs/00-INDEX.md` (add link to Social Media docs)

**Actions**:
- [ ] Document how to add alerts to queue
- [ ] Document how to review and post tweets
- [ ] Document how to view posting history
- [ ] Add screenshots (optional for V1)

**Dependencies**: All implementation steps

---

### Step 6.2: Update CLAUDE.md

**File**: `CLAUDE.md`

**Actions**:
- [ ] Add section: "Social Media Queue"
- [ ] Document key concepts (admin-only, Twitter API setup)
- [ ] Add decision tree for social media features
- [ ] Document Twitter API credentials in .env

**Dependencies**: All implementation steps

---

### Step 6.3: Final Production Deployment

**Actions**:
- [ ] Merge all feature branches to main
- [ ] Verify CI/CD pipeline passes
- [ ] Railway auto-deploys backend
- [ ] Vercel auto-deploys frontend
- [ ] Run production migration: `railway run npx prisma migrate deploy`
- [ ] Verify environment variables are set on Railway
- [ ] Test production endpoints

**Rollback Plan**:
- If critical bug found:
  1. Revert git commits: `git revert HEAD~5` (or specific commits)
  2. Push to main (triggers re-deploy)
  3. Database migration rollback: `railway run npx prisma migrate rollback`

**Dependencies**: All previous steps

---

### Step 6.4: Monitor Production

**Actions**:
- [ ] Monitor Railway logs for 24 hours
- [ ] Check for errors in Sentry (if integrated)
- [ ] Monitor Twitter API usage (dashboard)
- [ ] Monitor database performance (query times)
- [ ] Ask user for feedback

**Success Criteria**:
- Zero critical errors in first 24 hours
- Admin successfully posts ≥ 3 tweets
- No user complaints

**Dependencies**: Step 6.3

---

## Testing Strategy Summary

### Unit Tests

**Backend**:
- Caption generator functions
- Twitter service (mocked API)
- Input validation (Zod schemas)

**Frontend**:
- Image capture utility
- AddToTwitterButton component
- QueuedPostCard component
- PostingHistory component

**Coverage Target**: 80% for new code

---

### Integration Tests

**Backend**:
- All API endpoints (POST /queue, GET /queue, etc.)
- Authentication middleware
- Database operations (Prisma)

**Frontend**:
- API client methods
- Page-level components (Social Media page)

---

### E2E Tests

**Manual (recommended for V1)**:
- Full user flow (add to queue → edit → post → view history)
- Error scenarios
- Mobile responsiveness

**Automated (optional for V1)**:
- Use Playwright or Cypress
- Test critical paths only

---

## Rollout Plan

### Week 1: Development

- Days 1-2: Backend implementation (Steps 2.1-2.6)
- Days 3-4: Frontend implementation (Steps 3.1-3.11)
- Day 5: Testing (Step 5.1-5.3)

### Week 2: Twitter API Setup & Launch

- Days 1-2: Twitter Developer account approval (Step 4.1)
- Day 3: Create app, generate credentials (Step 4.2-4.3)
- Day 4: Test posting to Twitter (Step 4.4)
- Day 5: Final testing, documentation, deployment (Steps 5.4-6.4)

**Total Estimated Time**: 8-10 working days

---

## Rollback Plan

If critical issues arise after deployment:

### Immediate Actions

1. **Hide Feature from UI**
   - Comment out navigation link in admin sidebar
   - Users cannot access Social Media page
   - No code rollback needed

2. **Disable API Endpoints**
   - Add feature flag to backend: `SOCIAL_MEDIA_ENABLED=false`
   - Return 503 Service Unavailable if flag is false
   - Data remains in database

3. **Full Rollback (Last Resort)**
   - Revert git commits: `git revert <commit-range>`
   - Re-deploy backend and frontend
   - Rollback database migration: `railway run npx prisma migrate rollback`
   - **Note**: This will delete all queued/posted post data

### Post-Rollback Actions

- Investigate root cause (check logs)
- Fix bug in separate branch
- Test thoroughly before re-deploying
- Document incident in postmortem

---

## Dependencies Summary

```
Phase 1: Database
  1.1 Update Prisma Schema
    └── 1.2 Run Migration

Phase 2: Backend
  2.1 Create Types
    └── 2.2 Caption Generator (depends on 2.1)
    └── 2.3 Twitter Service (depends on 2.1)
        └── 2.4 API Routes (depends on 2.2, 2.3)
            └── 2.5 Register Routes (depends on 2.4)
                └── 2.6 Deploy Backend (depends on 2.5)

Phase 3: Frontend
  3.1 Install Dependencies
    └── 3.4 Image Capture Utility (depends on 3.1)
  3.2 Create Types
  3.3 API Client (depends on 3.2)
  3.4 Image Capture (depends on 3.1)
    └── 3.5 AddToTwitterButton (depends on 3.3, 3.4)
        └── 3.6 Add Button to Alerts (depends on 3.5)
  3.8 QueuedPostCard (depends on 3.2)
  3.9 PostingHistory (depends on 3.2)
    └── 3.7 Social Media Page (depends on 3.3, 3.8, 3.9)
  3.10 Add Navigation (independent)
  3.11 Test Full Flow (depends on 3.5-3.10)

Phase 4: Twitter API
  4.1 Apply for Developer Account
    └── 4.2 Create Twitter App (depends on 4.1)
        └── 4.3 Add Credentials to Railway (depends on 4.2)
            └── 4.4 Test Posting (depends on 4.3)

Phase 5: Testing
  5.1 Unit Tests (depends on all implementation)
  5.2 Integration Tests (depends on backend)
  5.3 E2E Tests (depends on all implementation)
  5.4 Performance Testing (depends on all implementation)
  5.5 Security Audit (depends on all implementation)

Phase 6: Deployment
  6.1 Update Documentation (depends on all implementation)
  6.2 Update CLAUDE.md (depends on all implementation)
  6.3 Production Deployment (depends on all previous)
    └── 6.4 Monitor Production (depends on 6.3)
```

---

## Success Metrics

Feature is considered complete and successful when:

### Functional Metrics
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] E2E tests demonstrate full user flow works
- [ ] Admin can add alerts to queue
- [ ] Admin can edit captions
- [ ] Admin can post to Twitter
- [ ] Tweets appear on Twitter with correct image and caption
- [ ] Posting history tracks all posted tweets

### Performance Metrics
- [ ] Image generation: < 5 seconds average
- [ ] Queue page load: < 2 seconds
- [ ] Twitter posting: < 10 seconds average
- [ ] API response times: < 500ms (except Twitter posting)

### Security Metrics
- [ ] Only admin role can access feature
- [ ] Twitter API credentials never exposed to client
- [ ] All actions logged in audit log
- [ ] Input validation prevents injection attacks

### User Experience Metrics
- [ ] Admin can complete full flow in < 2 minutes
- [ ] No console errors or warnings
- [ ] Mobile responsive (tested on ≥ 2 devices)
- [ ] Error messages are clear and actionable

### Business Metrics (post-launch, 30 days)
- [ ] Admin posts ≥ 5 tweets per week
- [ ] Zero critical bugs reported
- [ ] Twitter followers increase ≥ 10%
- [ ] Click-through rate from tweets ≥ 2%

---

## Notes for Implementation

### Best Practices

1. **Test-Driven Development**
   - Write tests BEFORE implementation
   - Ensure tests fail first (Red phase)
   - Write minimum code to pass tests (Green phase)
   - Refactor while keeping tests green

2. **Git Commits**
   - Use conventional commit messages
   - Examples:
     - `feat(social-media): add Prisma schema for social media posts`
     - `test(social-media): add tests for caption generator`
     - `fix(social-media): handle Twitter rate limit errors`

3. **Code Reviews**
   - Self-review all code before committing
   - Check for TypeScript strict mode compliance
   - Verify no `any` types without justification
   - Ensure proper error handling

4. **Documentation**
   - Add JSDoc comments to all public functions
   - Document complex logic with inline comments
   - Update CLAUDE.md and human-docs when complete

5. **Security**
   - Never commit `.env` files
   - Always validate input with Zod
   - Use Prisma for SQL (prevents injection)
   - Log sensitive actions to audit log

### Common Pitfalls to Avoid

1. **Over-engineering**
   - Don't add features beyond requirements
   - Keep solutions simple (YAGNI principle)
   - V1 doesn't need scheduling, analytics, etc.

2. **Skipping Tests**
   - Tests save time in the long run
   - Untested code is technical debt
   - Write tests even when tempted to skip

3. **Ignoring Edge Cases**
   - Test with empty data
   - Test with maximum limits (280 char caption)
   - Test with network failures
   - Test with invalid inputs

4. **Poor Error Handling**
   - Don't throw generic errors
   - Provide actionable error messages
   - Log errors for debugging
   - Handle all async/await rejections

5. **Forgetting Mobile**
   - Test on mobile devices early
   - Use responsive Tailwind classes
   - Image previews should scale

---

## Final Checklist (Before Marking Feature Complete)

- [ ] All steps marked complete
- [ ] All tests passing (unit, integration, E2E)
- [ ] TypeScript strict mode passes (no `any` types)
- [ ] Production build succeeds (no errors)
- [ ] No console errors or warnings in browser
- [ ] Feature works for admin role
- [ ] Feature hidden from non-admin users
- [ ] Security audit checklist complete
- [ ] Performance metrics met
- [ ] Documentation updated (CLAUDE.md, human-docs)
- [ ] Twitter API credentials configured on Railway
- [ ] Production deployment successful
- [ ] Monitoring active (Railway logs, Sentry)
- [ ] User (Nik) has tested and approved

**Feature Owner**: Nik Sitnikov (Admin)
**Estimated Completion**: 2 weeks
**Last Updated**: 2025-12-17
