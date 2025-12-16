# Requirements: Crypto Payment Promo Codes

## Purpose

Enable promotional discount codes for cryptocurrency payments to drive user acquisition and conversions. This allows VolSpike to run marketing campaigns with trackable, time-limited, usage-capped discount codes that apply specifically to crypto payment flows.

## Problem Statement

Currently, promo codes only work for Stripe payments (enabled via Stripe's native promo code feature). Users choosing crypto payments cannot use discount codes, creating an inconsistent experience and limiting marketing campaign effectiveness for crypto payment channels.

## Scope

### In Scope
- Promo code database schema and storage
- Promo code validation logic (usage limits, expiry dates, active status)
- UI for entering promo codes on crypto checkout page
- Discount calculation and display
- Admin panel for promo code management (CRUD operations)
- Usage tracking and statistics
- Initial promo code: VOLSPIKE26 (50% off, 100 uses, 3 months validity)

### Out of Scope
- Promo codes for Stripe payments (already handled by Stripe)
- Multiple promo codes per transaction
- Promo codes for specific tiers only (all crypto payments eligible)
- Referral codes or affiliate tracking
- Automatic promo code application (user must enter manually)

## User Stories

### User Story 1: Apply Promo Code
**As a** user upgrading to Pro or Elite via crypto payment
**I want** to enter a promo code during checkout
**So that** I can receive a discount on my subscription price

**Acceptance Criteria:**
- Promo code input field visible on crypto payment selection page
- Real-time validation on blur or submit
- Clear error messages for invalid/expired/used-up codes
- Discounted price displayed before redirecting to NowPayments
- Original price shown with strikethrough for comparison
- Discount percentage displayed clearly

### User Story 2: Admin Creates Promo Code
**As an** admin
**I want** to create new promo codes with custom parameters
**So that** I can run marketing campaigns with trackable discount codes

**Acceptance Criteria:**
- Create promo code with: code name, discount %, usage limit, expiry date
- Code validation (unique, alphanumeric, reasonable length)
- Set payment method filter (crypto only, Stripe only, or all)
- Set active/inactive status
- Immediate availability after creation

### User Story 3: Admin Views Promo Code Usage
**As an** admin
**I want** to view promo code usage statistics
**So that** I can track campaign effectiveness and manage limits

**Acceptance Criteria:**
- List all promo codes with key stats (uses, remaining, expiry)
- View detailed usage history per code
- See total revenue impact (discount amount given)
- Filter by active/inactive/expired status
- Sort by usage, creation date, expiry date

### User Story 4: Admin Manages Promo Codes
**As an** admin
**I want** to edit or deactivate promo codes
**So that** I can adjust campaigns or stop abuse

**Acceptance Criteria:**
- Edit usage limits and expiry dates
- Toggle active/inactive status
- Delete unused promo codes
- Cannot delete codes with usage history (soft delete/deactivate only)
- Audit trail of changes

## Technical Requirements

### Database
- New `PromoCodes` table with proper indexing
- Track creation date, modified date, created by admin
- Atomic usage increment to prevent race conditions

### Backend API
- `POST /api/admin/promo-codes` - Create promo code (ADMIN only)
- `GET /api/admin/promo-codes` - List all codes (ADMIN only)
- `GET /api/admin/promo-codes/:id` - Get single code details (ADMIN only)
- `PATCH /api/admin/promo-codes/:id` - Update code (ADMIN only)
- `DELETE /api/admin/promo-codes/:id` - Soft delete (ADMIN only)
- `POST /api/payments/validate-promo-code` - Validate code (authenticated users)
- Transaction-based usage increment on successful payment

### Frontend
- Promo code input on crypto checkout page
- Real-time validation with debounce
- Discount calculation display
- Admin promo code management page at `/admin/promo-codes`
- Responsive table with pagination
- Create/edit modal dialogs

### Security
- ADMIN role required for all management endpoints
- Rate limiting on validation endpoint (prevent brute force)
- SQL injection prevention via Prisma
- Input sanitization (alphanumeric codes only)
- Audit logging for all admin actions

### Performance
- Database index on `code` field for fast lookups
- Cache frequently used codes (optional future enhancement)
- Atomic operations for usage tracking

## Constraints

### Business Constraints
- Promo codes apply to subscription price, not one-time payments
- Only one promo code per transaction
- Codes are case-insensitive
- Minimum discount: 1%, Maximum discount: 100% (free)
- Usage limit minimum: 1, maximum: 10,000

### Technical Constraints
- Must integrate with existing NowPayments flow
- No breaking changes to current Stripe promo code functionality
- Database migration required
- Backend deployment required before frontend

### Time Constraints
- Initial code VOLSPIKE26 must be created manually via database or admin panel
- 3-month validity starts from code creation date

## Success Metrics

- Promo code validation response time < 200ms
- Zero failed payments due to promo code bugs
- Admin panel loads in < 1 second
- 100% accuracy in discount calculation
- Full audit trail for compliance

## Acceptance Criteria (Overall Feature)

- [ ] User can enter promo code on crypto checkout page
- [ ] Valid codes apply discount correctly
- [ ] Invalid/expired/maxed-out codes show clear error messages
- [ ] Discounted price shown before NowPayments redirect
- [ ] Admin can create, view, edit, deactivate promo codes
- [ ] Admin can see usage statistics
- [ ] VOLSPIKE26 code created with specified parameters
- [ ] All admin actions logged in audit trail
- [ ] Database migration successful
- [ ] No impact on existing Stripe promo code flow
- [ ] All tests passing (unit, integration, E2E)
- [ ] Documentation updated

## Future Enhancements (Not in Scope)

- Bulk promo code generation
- Tier-specific codes (Pro only, Elite only)
- Combination with other discounts
- Automatic code application via URL parameters
- Email campaign integration
- A/B testing different discount levels
- Promo code analytics dashboard
