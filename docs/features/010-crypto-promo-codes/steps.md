# Implementation Steps: Crypto Payment Promo Codes

## Overview

This document outlines the step-by-step implementation plan for the crypto promo codes feature. Each step follows Test Driven Development (TDD) principles: write test first, implement minimum code, refactor.

## Phase 1: Database Schema & Migration

### Step 1.1: Update Prisma Schema
- [ ] Add `PromoPaymentMethod` enum to schema
- [ ] Add `PromoCode` model with all fields
- [ ] Add `PromoCodeUsage` model with all fields
- [ ] Add relations to `User` model (createdPromoCodes, promoCodeUsages)
- [ ] Add `promoCodeId` field to `CryptoPayment` model
- [ ] Add indexes for performance

**Files**:
- `volspike-nodejs-backend/prisma/schema.prisma`

**Testing**: Schema validation via Prisma CLI

### Step 1.2: Create Database Migration
- [ ] Run `npx prisma migrate dev --name add_promo_codes`
- [ ] Verify migration file generated correctly
- [ ] Test migration on local database
- [ ] Test rollback (if needed)

**Files**:
- `volspike-nodejs-backend/prisma/migrations/[timestamp]_add_promo_codes/migration.sql`

**Testing**: Manual verification in Prisma Studio

### Step 1.3: Generate Prisma Client
- [ ] Run `npx prisma generate`
- [ ] Verify TypeScript types generated
- [ ] Test type completion in IDE

**Testing**: Import types in test file, verify no TypeScript errors

---

## Phase 2: Backend - Promo Code Validation

### Step 2.1: Create Validation Schemas (Zod)
- [ ] **Test**: Write test for promo code validation schema
- [ ] **Implement**: Create `promoCodeValidationSchema` in `lib/validation/promo-codes.ts`
- [ ] **Refactor**: Extract common patterns

**Files**:
- `volspike-nodejs-backend/src/lib/validation/promo-codes.ts` (create)
- `volspike-nodejs-backend/src/lib/validation/promo-codes.test.ts` (create)

**Test Cases**:
- Valid code passes validation
- Invalid code format rejected
- Missing tier rejected
- Invalid payment method rejected

### Step 2.2: Create Promo Code Service
- [ ] **Test**: Write unit tests for validation logic
- [ ] **Implement**: Create `PromoCodeService` class
  - `validateCode(code, tier, paymentMethod)`
  - `calculateDiscount(code, originalPrice)`
  - `incrementUsage(codeId, userId, paymentId, amounts)`
- [ ] **Refactor**: Extract helper functions

**Files**:
- `volspike-nodejs-backend/src/services/promo-code.ts` (create)
- `volspike-nodejs-backend/src/services/promo-code.test.ts` (create)

**Test Cases**:
- Valid code returns discount
- Expired code returns error
- Max uses reached returns error
- Inactive code returns error
- Wrong payment method returns error
- Case-insensitive code matching works
- Race condition handling (concurrent increments)

### Step 2.3: Create Validation Endpoint
- [ ] **Test**: Write integration tests for `/api/payments/validate-promo-code`
- [ ] **Implement**: Add POST route in `routes/payments.ts`
  - Require authentication
  - Validate input with Zod
  - Call service to validate code
  - Return discount calculation
- [ ] **Refactor**: Extract middleware for rate limiting

**Files**:
- `volspike-nodejs-backend/src/routes/payments.ts` (modify)
- `volspike-nodejs-backend/src/routes/payments.test.ts` (modify)

**Test Cases**:
- Authenticated user can validate code
- Unauthenticated user gets 401
- Invalid input returns 400
- Valid code returns correct discount
- Rate limiting works (11th request fails)

---

## Phase 3: Backend - NowPayments Integration

### Step 3.1: Update NowPayments Checkout Endpoint
- [ ] **Test**: Write tests for checkout with promo code
- [ ] **Implement**: Modify `/api/payments/nowpayments/checkout`
  - Accept optional `promoCode` parameter
  - Validate promo code if provided
  - Calculate discounted price
  - Create invoice with discounted amount
  - Store promo code ID in `CryptoPayment` record
- [ ] **Refactor**: Extract price calculation logic

**Files**:
- `volspike-nodejs-backend/src/routes/payments.ts` (modify)

**Test Cases**:
- Checkout without promo code works (existing behavior)
- Checkout with valid promo code applies discount
- Checkout with invalid promo code returns error
- Discounted amount passed to NowPayments
- Promo code ID stored in database

### Step 3.2: Update IPN Webhook Handler
- [ ] **Test**: Write tests for webhook with promo code
- [ ] **Implement**: Modify IPN webhook handler
  - On payment success, increment promo code usage
  - Create `PromoCodeUsage` record
  - Handle case where promo code is null (backward compatible)
- [ ] **Refactor**: Use transaction for atomicity

**Files**:
- `volspike-nodejs-backend/src/routes/payments.ts` (modify)

**Test Cases**:
- Successful payment increments promo code usage
- Successful payment creates usage record
- Failed payment does NOT increment usage
- Payment without promo code still works (backward compatible)
- Transaction rolls back on error

---

## Phase 4: Backend - Admin CRUD Endpoints

### Step 4.1: Create Admin Promo Code Service
- [ ] **Test**: Write unit tests for admin operations
- [ ] **Implement**: Create admin service methods
  - `createPromoCode(data, adminUserId)`
  - `listPromoCodes(filters, pagination)`
  - `getPromoCodeById(id)`
  - `updatePromoCode(id, data)`
  - `deletePromoCode(id)`
- [ ] **Refactor**: Extract stats calculation

**Files**:
- `volspike-nodejs-backend/src/services/admin/promo-code-admin.ts` (create)
- `volspike-nodejs-backend/src/services/admin/promo-code-admin.test.ts` (create)

**Test Cases**:
- Create promo code with valid data
- Duplicate code rejected
- List promo codes with pagination
- Filter by status (active/inactive/expired)
- Get promo code with usage stats
- Update promo code fields
- Cannot decrease max uses below current uses
- Delete unused promo code (hard delete)
- Delete used promo code (soft delete)

### Step 4.2: Create Admin API Routes
- [ ] **Test**: Write integration tests for admin endpoints
- [ ] **Implement**: Create `/api/admin/promo-codes` routes
  - POST / (create)
  - GET / (list)
  - GET /:id (get one)
  - PATCH /:id (update)
  - DELETE /:id (delete)
- [ ] **Refactor**: Extract admin middleware

**Files**:
- `volspike-nodejs-backend/src/routes/admin/promo-codes.ts` (create)
- `volspike-nodejs-backend/src/routes/admin/promo-codes.test.ts` (create)
- `volspike-nodejs-backend/src/routes/admin/index.ts` (modify to include new routes)

**Test Cases**:
- ADMIN role can access all endpoints
- USER role gets 403 on all endpoints
- Create with valid data returns 201
- Create with duplicate code returns 409
- List returns paginated results
- Update returns updated record
- Delete returns 204

### Step 4.3: Add Audit Logging
- [ ] **Test**: Write tests for audit log creation
- [ ] **Implement**: Add audit logging to all admin operations
  - Log create, update, delete actions
  - Include old/new values
  - Include admin user ID
- [ ] **Refactor**: Use existing audit service

**Files**:
- `volspike-nodejs-backend/src/services/admin/promo-code-admin.ts` (modify)

**Test Cases**:
- Audit log created on promo code creation
- Audit log created on promo code update
- Audit log created on promo code deletion
- Audit log includes correct metadata

---

## Phase 5: Frontend - Crypto Checkout Enhancement

### Step 5.1: Create Promo Code Hook
- [ ] **Test**: Write tests for `usePromoCode` hook
- [ ] **Implement**: Create custom hook
  - `validatePromoCode(code, tier)`
  - `applyPromoCode(code)`
  - `clearPromoCode()`
  - State: `promoCode, discountPercent, finalPrice, error, loading`
- [ ] **Refactor**: Use TanStack Query for caching

**Files**:
- `volspike-nextjs-frontend/src/hooks/use-promo-code.ts` (create)
- `volspike-nextjs-frontend/src/hooks/use-promo-code.test.ts` (create)

**Test Cases**:
- Hook fetches validation on code change
- Hook debounces validation requests
- Hook calculates final price correctly
- Hook handles errors gracefully
- Hook clears state on clear call

### Step 5.2: Create Promo Code Input Component
- [ ] **Test**: Write component tests
- [ ] **Implement**: Create `PromoCodeInput` component
  - Collapsible input field
  - Real-time validation (debounced)
  - Error/success messages
  - Discount display
- [ ] **Refactor**: Extract to separate component

**Files**:
- `volspike-nextjs-frontend/src/components/promo-code-input.tsx` (create)
- `volspike-nextjs-frontend/src/components/promo-code-input.test.tsx` (create)

**Test Cases**:
- Component renders collapsed by default
- Clicking toggle shows input field
- Entering code triggers validation
- Valid code shows success message
- Invalid code shows error message
- Uppercase conversion works

### Step 5.3: Update Crypto Checkout Page
- [ ] **Test**: Write E2E tests for checkout flow
- [ ] **Implement**: Integrate promo code into crypto checkout
  - Add `PromoCodeInput` component
  - Add price summary section
  - Pass promo code to checkout API
  - Show original vs discounted price
- [ ] **Refactor**: Extract price display logic

**Files**:
- `volspike-nextjs-frontend/src/app/checkout/crypto/page.tsx` (modify or create)
- Or: `volspike-nextjs-frontend/src/components/crypto-payment-modal.tsx` (modify)

**Test Cases**:
- User can enter promo code
- Valid code updates price display
- Invalid code shows error
- Checkout sends promo code to backend
- Payment succeeds with promo code

---

## Phase 6: Frontend - Admin Panel

### Step 6.1: Create Admin Promo Code Hooks
- [ ] **Test**: Write tests for admin hooks
- [ ] **Implement**: Create hooks using TanStack Query
  - `usePromoCodes()` - list with pagination
  - `usePromoCode(id)` - get single
  - `useCreatePromoCode()` - mutation
  - `useUpdatePromoCode()` - mutation
  - `useDeletePromoCode()` - mutation
- [ ] **Refactor**: Extract common query patterns

**Files**:
- `volspike-nextjs-frontend/src/hooks/use-admin-promo-codes.ts` (create)
- `volspike-nextjs-frontend/src/hooks/use-admin-promo-codes.test.ts` (create)

**Test Cases**:
- List hook fetches paginated data
- Create mutation calls API and invalidates cache
- Update mutation optimistically updates UI
- Delete mutation removes from list

### Step 6.2: Create Promo Codes List Component
- [ ] **Test**: Write component tests
- [ ] **Implement**: Create table component
  - Columns: Code, Discount, Uses, Valid Until, Status, Actions
  - Status badges (Active/Inactive/Expired)
  - Progress bar for usage
  - Pagination controls
  - Filters (status, sort)
- [ ] **Refactor**: Use existing table patterns from admin panel

**Files**:
- `volspike-nextjs-frontend/src/components/admin/promo-codes-table.tsx` (create)

**Test Cases**:
- Table renders promo codes correctly
- Status badge shows correct color
- Pagination works
- Filters apply correctly
- Sorting works

### Step 6.3: Create Promo Code Form Component
- [ ] **Test**: Write component tests
- [ ] **Implement**: Create form for create/edit
  - Code input (uppercase, alphanumeric only)
  - Discount percentage slider/input
  - Max uses input
  - Valid until date picker
  - Payment method select
  - Active toggle
  - Form validation with Zod
- [ ] **Refactor**: Use React Hook Form + Zod

**Files**:
- `volspike-nextjs-frontend/src/components/admin/promo-code-form.tsx` (create)

**Test Cases**:
- Form validates code format
- Form validates discount range (1-100)
- Form validates max uses (1-10000)
- Form validates future date
- Form submits correct data

### Step 6.4: Create Admin Page
- [ ] **Test**: Write E2E tests
- [ ] **Implement**: Create `/admin/promo-codes` page
  - Import table component
  - Add "Create" button with dialog
  - Add edit/delete actions
  - Show usage stats
- [ ] **Refactor**: Follow existing admin page patterns

**Files**:
- `volspike-nextjs-frontend/src/app/(admin)/admin/promo-codes/page.tsx` (create)

**Test Cases**:
- Page requires ADMIN role
- Table loads and displays data
- Create button opens dialog
- Create form submits and refreshes table
- Edit updates promo code
- Delete removes promo code

### Step 6.5: Add Navigation Link
- [ ] **Test**: Manual testing
- [ ] **Implement**: Add link to admin sidebar
- [ ] **Refactor**: Follow existing nav pattern

**Files**:
- `volspike-nextjs-frontend/src/components/admin/admin-sidebar.tsx` (modify)
- Or: `volspike-nextjs-frontend/src/app/(admin)/admin/layout.tsx` (modify)

---

## Phase 7: Initial Data & Testing

### Step 7.1: Create VOLSPIKE26 Promo Code
- [ ] Deploy backend to Railway
- [ ] Run database migration on production
- [ ] Create initial promo code via admin panel:
  - Code: VOLSPIKE26
  - Discount: 50%
  - Max Uses: 100
  - Valid Until: 3 months from now
  - Payment Method: CRYPTO
  - Active: true

**Testing**: Manual creation via admin panel

### Step 7.2: End-to-End Testing
- [ ] Test user flow: Sign in → Upgrade → Enter promo code → Pay with crypto
- [ ] Test admin flow: Create code → View usage → Edit code → Deactivate code
- [ ] Test edge cases:
  - Expired code
  - Max uses reached
  - Invalid code
  - Concurrent usage (race condition)
- [ ] Test backward compatibility (crypto payments without promo codes)

**Files**:
- `volspike-nextjs-frontend/e2e/promo-codes.spec.ts` (create, if using Playwright/Cypress)

---

## Phase 8: Documentation & Deployment

### Step 8.1: Update Documentation
- [ ] Update AGENTS.md with promo code feature
- [ ] Update OVERVIEW.md with promo code architecture
- [ ] Update IMPLEMENTATION_PLAN.md with completed feature
- [ ] Add comments to complex code sections

**Files**:
- `AGENTS.md`
- `OVERVIEW.md`
- `IMPLEMENTATION_PLAN.md`

### Step 8.2: Deploy Backend
- [ ] Commit backend changes
- [ ] Push to GitHub
- [ ] Verify Railway auto-deploys
- [ ] Run `npx prisma migrate deploy` on Railway (if needed)
- [ ] Test `/health` endpoint
- [ ] Smoke test promo code endpoints

**Deployment**:
- Railway auto-deploys from GitHub push

### Step 8.3: Deploy Frontend
- [ ] Commit frontend changes
- [ ] Push to GitHub
- [ ] Verify Vercel auto-deploys
- [ ] Test production build locally first
- [ ] Clear cache if needed

**Deployment**:
- Vercel auto-deploys from GitHub push

### Step 8.4: Post-Deployment Verification
- [ ] Test crypto checkout with promo code on production
- [ ] Verify discount calculation
- [ ] Check admin panel loads
- [ ] Monitor error logs (Railway, Vercel)
- [ ] Check Sentry for any errors (if configured)

---

## Dependencies

### Step Dependencies
- **Phase 2 depends on Phase 1**: Schema must exist before service layer
- **Phase 3 depends on Phase 2**: Validation service needed for checkout
- **Phase 4 can run parallel to Phase 3**: Admin endpoints independent
- **Phase 5 depends on Phase 2**: Validation endpoint needed for frontend
- **Phase 6 depends on Phase 4**: Admin API needed for admin panel
- **Phase 7 depends on all previous phases**: Full feature needed for E2E testing

### Technology Dependencies
- Prisma 6.18.0 (already installed)
- Zod 3.22.0 (already installed)
- TanStack Query 5.8.4 (already installed)
- React Hook Form 7.65.0 (already installed)
- shadcn/ui components (already installed)

---

## Testing Strategy

### Unit Tests (70% coverage target)
- Promo code validation logic
- Discount calculation
- Date comparison (expiry checks)
- Input sanitization
- Service layer methods

**Run**: `npm run test` in backend

### Integration Tests
- API endpoint responses
- Database operations
- Race condition handling
- Webhook processing

**Run**: `npm run test` in backend

### Component Tests (60% coverage target)
- Promo code input component
- Admin table component
- Admin form component

**Run**: `npm run test` in frontend

### E2E Tests
- Full user checkout flow with promo code
- Full admin CRUD flow
- Edge cases (expired, max uses, invalid)

**Run**: `npm run test:e2e` (if configured)

---

## Rollout Plan

### Phase 1: Database Migration (Railway)
1. Deploy backend with migration
2. Verify schema changes via Prisma Studio
3. DO NOT create VOLSPIKE26 yet (wait for admin panel)

### Phase 2: Backend API (Railway)
1. Deploy backend with endpoints
2. Test validation endpoint with Postman
3. Test admin endpoints with Postman

### Phase 3: Frontend - Admin Panel (Vercel)
1. Deploy admin panel page
2. Admin creates VOLSPIKE26 promo code
3. Verify in database

### Phase 4: Frontend - Crypto Checkout (Vercel)
1. Deploy crypto checkout changes
2. Test full user flow on production
3. Monitor usage

### Rollback Plan
If critical bugs found:
1. **Frontend**: Revert Vercel deployment (instant)
2. **Backend**: Revert Railway deployment (instant)
3. **Database**: Keep schema (no harm), set all promo codes inactive

---

## Success Metrics

### Technical Metrics
- [ ] All tests passing (unit, integration, component)
- [ ] TypeScript strict mode passes
- [ ] Build succeeds without errors
- [ ] No console errors or warnings
- [ ] Code coverage meets thresholds (70% backend, 60% frontend)

### Functional Metrics
- [ ] User can apply promo code on crypto checkout
- [ ] Valid codes apply correct discount
- [ ] Invalid codes show clear error messages
- [ ] Admin can create, view, edit, deactivate promo codes
- [ ] VOLSPIKE26 created with correct parameters (50%, 100 uses, 3 months)
- [ ] Usage tracked correctly
- [ ] Audit logs capture all admin actions

### Performance Metrics
- [ ] Promo code validation < 200ms
- [ ] Admin panel loads < 1 second
- [ ] No race conditions in concurrent usage
- [ ] Database queries optimized (use indexes)

---

## Post-Launch Monitoring

### Week 1
- [ ] Monitor promo code usage (how many users using VOLSPIKE26)
- [ ] Check error rates on validation endpoint
- [ ] Verify discount calculations are correct
- [ ] Monitor for abuse (same user, multiple attempts)

### Week 2-4
- [ ] Review usage statistics
- [ ] Gather user feedback
- [ ] Identify any edge cases not covered
- [ ] Plan next iteration (if needed)

---

## Future Enhancements (Out of Scope)

These are explicitly NOT included in the current implementation:

- [ ] Bulk promo code generation
- [ ] Tier-specific codes (Pro only, Elite only)
- [ ] Combination with other discounts
- [ ] Automatic code application via URL parameters
- [ ] Email campaign integration
- [ ] A/B testing different discount levels
- [ ] Promo code analytics dashboard with charts
- [ ] Referral codes or affiliate tracking

---

## Commit Strategy

Use conventional commits for each step:

**Examples**:
- `feat(db): add promo code schema and migration`
- `feat(backend): add promo code validation service`
- `feat(backend): add promo code validation endpoint`
- `feat(backend): integrate promo codes with NowPayments`
- `feat(backend): add admin promo code CRUD endpoints`
- `feat(frontend): add promo code input to crypto checkout`
- `feat(frontend): add admin promo codes management page`
- `test(backend): add promo code service tests`
- `test(frontend): add promo code component tests`
- `docs: update AGENTS.md with promo code feature`

---

## Final Checklist

Before marking feature complete:

### Code Quality
- [ ] All TypeScript strict mode passes
- [ ] No `any` types without justification
- [ ] All tests passing
- [ ] Code coverage meets thresholds
- [ ] ESLint passes without errors
- [ ] No console.log statements (use logger)

### Security
- [ ] Input validation with Zod on all endpoints
- [ ] ADMIN role enforced on admin endpoints
- [ ] Rate limiting on validation endpoint
- [ ] SQL injection prevented (using Prisma)
- [ ] Audit logs for all admin actions
- [ ] Race conditions handled (atomic operations)

### User Experience
- [ ] Clear error messages for invalid codes
- [ ] Loading states on all async operations
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Keyboard navigation works
- [ ] Screen reader friendly (if possible)

### Documentation
- [ ] AGENTS.md updated
- [ ] OVERVIEW.md updated
- [ ] IMPLEMENTATION_PLAN.md updated
- [ ] Code comments where needed
- [ ] API endpoints documented

### Deployment
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Database migration applied
- [ ] VOLSPIKE26 code created
- [ ] No breaking changes to existing features
- [ ] Rollback plan documented

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Component tests written and passing
- [ ] E2E tests written and passing (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases tested (expired, max uses, invalid)

---

## Estimated Timeline

**Total**: ~8-12 hours of focused development

- Phase 1 (Database): 30 minutes
- Phase 2 (Backend Validation): 2 hours
- Phase 3 (NowPayments Integration): 1.5 hours
- Phase 4 (Admin Backend): 2 hours
- Phase 5 (Frontend Checkout): 2 hours
- Phase 6 (Admin Panel): 2.5 hours
- Phase 7 (Testing): 1 hour
- Phase 8 (Documentation & Deployment): 30 minutes

**Note**: Timeline assumes familiarity with the codebase and TDD workflow.
