# Comprehensive Account Linking Testing Guide

## Overview

This guide provides **exhaustive** step-by-step instructions for testing the complete account linking system. Users can link any authentication method to any other:

- **Email/Password** ↔ **Google OAuth** ↔ **ETH Wallet** ↔ **SOL Wallet**

All combinations are supported, and users can link/unlink methods as needed (with safety checks to prevent account lockout).

---

## Prerequisites

### 1. Development Environment Setup
- ✅ Frontend running on `http://localhost:3000`
- ✅ Backend running on `http://localhost:3001`
- ✅ Database connected and migrations applied
- ✅ Google OAuth credentials configured in `.env.local`
- ✅ MetaMask extension installed and configured
- ✅ Phantom wallet installed (or Solana testnet wallet)

### 2. Test Accounts Preparation
- **Email Accounts**: 
  - `test-email-1@example.com`
  - `test-email-2@example.com`
  - `test-google@example.com` (for Google OAuth)
- **Wallets**:
  - MetaMask with test ETH on Sepolia/Goerli
  - Phantom wallet with test SOL (or use testnet)

### 3. Browser Setup
- Clear browser cache and cookies
- Use incognito/private mode for clean testing
- Open browser DevTools (F12) with:
  - **Console** tab (for logs)
  - **Network** tab (for API calls)
  - **Application** tab (for localStorage/sessionStorage)
- Enable **Responsive Design Mode** (Ctrl+Shift+M / Cmd+Shift+M)

### 4. Testing Devices/Viewports
Prepare to test on:
- **Desktop Wide**: 1920x1080 or larger
- **Desktop Narrow**: 1280x720
- **Tablet**: 768x1024 (iPad)
- **Mobile**: 375x667 (iPhone SE), 390x844 (iPhone 12), 428x926 (iPhone 14 Pro Max)

---

## Part 1: Core Functionality Testing

### Scenario 1: Email/Password → Link Google OAuth

**Objective**: User signs up with email/password, then links Google OAuth

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Sign Up" tab
3. Enter email: `test-email-1@example.com`
4. Enter password: `Test123456!`
5. Click "Sign Up"
6. **Verify**: Success message appears
7. Check email inbox for verification email
8. Click verification link (or use `/auth/verify?token=...`)
9. **Verify**: Email verified successfully
10. Sign in with email/password
11. Navigate to **Settings → Wallets** tab
12. **Verify**: URL shows `/settings?tab=wallets`
13. In "Social Accounts" section, verify "Link Google" button is visible
14. Click "Link Google"
15. Complete Google OAuth flow
16. **Expected Result**: 
    - Google account appears in "Social Accounts" section
    - Shows provider badge (red shield icon)
    - Shows provider account ID (truncated)
    - "Unlink" button appears
    - User can sign in with either email/password OR Google

**Verification**:
- ✅ Sign out
- ✅ Sign in with Google → Should work
- ✅ Sign out
- ✅ Sign in with email/password → Should work
- ✅ Both methods show as "Active" in settings

**UI Checks**:
- ✅ Google OAuth section card has proper spacing
- ✅ Icons are visible and properly colored
- ✅ Buttons have proper hover states
- ✅ Loading states show during linking
- ✅ Success toast notification appears

---

### Scenario 2: Email/Password → Link ETH Wallet

**Objective**: User signs up with email/password, then links MetaMask wallet

**Steps**:
1. Sign in with email/password account from Scenario 1
2. Navigate to Settings → Wallets tab
3. **Verify**: URL persists as `/settings?tab=wallets`
4. In "Crypto Wallets" section, verify "Connect Wallet" button is visible
5. **UI Check**: Button should be clearly visible in light theme:
   - Green border (`border-green-500/60`)
   - Light green background (`bg-green-500/10`)
   - Dark green text (`text-green-600`)
   - Proper contrast ratio
6. Click "Connect Wallet"
7. Select MetaMask from wallet options
8. Approve connection in MetaMask popup
9. **Verify**: Wallet connection UI updates:
   - Shows "Wallet Connected" card
   - Displays wallet address (formatted: `0x1234...5678`)
   - Shows chain name (e.g., "Ethereum", "Sepolia")
   - "Link" button appears
10. Click "Link Wallet to Account" button
11. Sign the SIWE message in MetaMask
12. **Expected Result**:
    - Wallet appears in "Linked Wallets" list
    - Shows wallet icon (blue for EVM)
    - Shows chain name and provider badge
    - Shows formatted address
    - Shows "Connected" badge if currently connected
    - Shows "Unlink" button
    - User can sign in with email/password OR wallet

**Verification**:
- ✅ Sign out
- ✅ Click "Sign in with Wallet" → Connect MetaMask → Should authenticate successfully
- ✅ Sign out
- ✅ Sign in with email/password → Should work
- ✅ Both methods work independently

**UI Checks**:
- ✅ "Connect Wallet" button visible in both light and dark themes
- ✅ Connected wallet card has green gradient background
- ✅ Wallet address is properly formatted and copyable
- ✅ Chain badge is visible
- ✅ Loading spinner shows during linking
- ✅ Success toast appears

---

### Scenario 3: Google OAuth → Link Email/Password

**Objective**: User signs up with Google, then adds email/password

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Continue with Google"
3. Complete Google OAuth flow
4. Navigate to Settings → Wallets tab
5. In "Email & Password" section, verify current status:
   - Shows email address from Google account
   - Shows "Link Email" button (if no password set)
6. Click "Link Email"
7. **Verify**: Dialog opens with:
   - Title: "Link Email & Password"
   - Email input field
   - Password input field (with show/hide toggle)
   - Confirm password field
   - "Link Email & Password" button
8. Enter email: `test-google@example.com` (or use existing Google email)
9. Enter password: `Test123456!`
10. Confirm password: `Test123456!`
11. **UI Check**: Password fields show/hide toggle works
12. Click "Link Email & Password"
13. **Expected Result**:
    - Dialog closes
    - Success toast appears
    - Email & Password section shows "Active" badge
    - User can sign in with Google OR email/password

**Verification**:
- ✅ Sign out
- ✅ Sign in with email/password → Should work
- ✅ Sign out
- ✅ Sign in with Google → Should work

**UI Checks**:
- ✅ Dialog is properly centered and responsive
- ✅ Form fields have proper labels
- ✅ Password strength indicator (if enabled)
- ✅ Error messages show for invalid inputs
- ✅ Loading state during submission

---

### Scenario 4: Google OAuth → Link ETH Wallet

**Objective**: User signs up with Google, then links MetaMask wallet

**Steps**:
1. Sign in with Google account from Scenario 3
2. Navigate to Settings → Wallets tab
3. Connect MetaMask wallet
4. Click "Link" button
5. Sign SIWE message
6. **Expected Result**:
    - Wallet linked successfully
    - All three methods available: Google, Email/Password, Wallet

**Verification**:
- ✅ Test sign-in with each method independently
- ✅ All should work

---

### Scenario 5: ETH Wallet → Link Email/Password

**Objective**: User signs up with wallet, then adds email/password

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Sign in with Wallet"
3. Connect MetaMask
4. Sign SIWE message
5. Navigate to Settings → Wallets tab
6. **Verify**: Email shows as wallet-only account (e.g., `0x1234...@volspike.wallet`)
7. Click "Link Email" in Email & Password section
8. Enter email: `test-wallet@example.com`
9. Enter password: `Test123456!`
10. Confirm password
11. Click "Link Email & Password"
12. **Expected Result**:
    - Email/password linked successfully
    - Email address updates from wallet-only to real email
    - User can sign in with wallet OR email/password

**Verification**:
- ✅ Sign out
- ✅ Sign in with email/password → Should work
- ✅ Sign out
- ✅ Sign in with wallet → Should work

---

### Scenario 6: ETH Wallet → Link Google OAuth

**Objective**: User signs up with wallet, then links Google

**Steps**:
1. Sign in with wallet account from Scenario 5
2. Navigate to Settings → Wallets tab
3. Click "Link Google" in Social Accounts section
4. Complete Google OAuth flow
5. **Expected Result**:
    - Google account linked
    - Email may update to Google email (if wallet-only account)
    - User can sign in with wallet OR Google

**Verification**:
- ✅ Test both sign-in methods

---

### Scenario 7: SOL Wallet → Link Email/Password

**Objective**: User signs up with Phantom wallet, then adds email/password

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Sign in with Phantom" (or Solana wallet option)
3. Connect Phantom wallet
4. Sign authentication message
5. Navigate to Settings → Wallets tab
6. Link email/password (same as Scenario 5)
7. **Expected Result**:
    - Email/password linked to Solana wallet account
    - Both methods work for sign-in

**Verification**:
- ✅ Test both sign-in methods

---

### Scenario 8: SOL Wallet → Link Google OAuth

**Objective**: User signs up with Phantom, then links Google

**Steps**:
1. Sign in with Solana wallet account
2. Navigate to Settings → Wallets tab
3. Link Google OAuth
4. **Expected Result**:
    - Google linked successfully
    - All methods work

---

### Scenario 9: SOL Wallet → Link ETH Wallet

**Objective**: User signs up with Phantom, then links MetaMask

**Steps**:
1. Sign in with Solana wallet account
2. Navigate to Settings → Wallets tab
3. Connect MetaMask wallet
4. Link ETH wallet
5. **Expected Result**:
    - Both wallets linked
    - Can sign in with either wallet

---

### Scenario 10: ETH Wallet → Link SOL Wallet

**Objective**: User signs up with MetaMask, then links Phantom

**Steps**:
1. Sign in with ETH wallet account
2. Navigate to Settings → Wallets tab
3. Connect Phantom wallet
4. Link SOL wallet
5. **Expected Result**:
    - Both wallets linked
    - Can sign in with either wallet

---

## Part 2: Unlinking Safety Checks

### Scenario 11: Prevent Unlinking Last Method

**Objective**: Verify users cannot unlink their only authentication method

**Test Cases**:

#### 11a: Email/Password Only
1. Create account with email/password ONLY
2. Navigate to Settings → Wallets tab
3. Try to unlink email/password
4. **Expected Result**:
    - Error message: "Cannot unlink. This is your only authentication method. Please link another method first."
    - Email/password remains linked

#### 11b: Google OAuth Only
1. Create account with Google OAuth ONLY
2. Navigate to Settings → Wallets tab
3. Try to unlink Google OAuth
4. **Expected Result**:
    - Same error message
    - Google OAuth remains linked

#### 11c: Wallet Only
1. Create account with wallet ONLY
2. Navigate to Settings → Wallets tab
3. Try to unlink wallet
4. **Expected Result**:
    - Same error message
    - Wallet remains linked

---

### Scenario 12: Unlinking Multiple Methods

**Objective**: Verify unlinking works when multiple methods exist

**Steps**:
1. Sign in with account that has:
   - Email/password ✓
   - Google OAuth ✓
   - ETH Wallet ✓
   - SOL Wallet ✓ (if applicable)
2. Navigate to Settings → Wallets tab
3. **Verify**: All methods show as "Active" or "Linked"
4. Click "Unlink" on Google OAuth
5. **Verify**: Confirmation dialog appears
6. Confirm unlink
7. **Expected Result**:
    - Google OAuth removed from list
    - Success toast appears
    - Email/password and wallets still work
8. Click "Unlink" on ETH Wallet
9. Confirm unlink
10. **Expected Result**:
    - Wallet removed from list
    - Remaining methods still work
11. Try to unlink email/password (last method)
12. **Expected Result**:
    - Error: Cannot unlink last method

---

## Part 3: Cross-Account Linking Prevention

### Scenario 13: Prevent Duplicate Email Linking

**Objective**: Verify accounts cannot link email already associated with another account

**Steps**:
1. Create Account A with email: `account-a@example.com`
2. Sign out
3. Create Account B with email: `account-b@example.com`
4. Sign in to Account B
5. Navigate to Settings → Wallets tab
6. Try to link email `account-a@example.com` to Account B
7. **Expected Result**:
    - Error: "Email is already associated with another account"
    - Linking fails

---

### Scenario 14: Prevent Duplicate Google Linking

**Objective**: Verify Google account cannot be linked to multiple accounts

**Steps**:
1. Create Account A
2. Link Google OAuth to Account A
3. Sign out
4. Create Account B
5. Sign in to Account B
6. Navigate to Settings → Wallets tab
7. Try to link the same Google account to Account B
8. **Expected Result**:
    - Error: "This Google account is already linked to another account"
    - Account B cannot link that Google account

---

### Scenario 15: Prevent Duplicate Wallet Linking

**Objective**: Verify wallet cannot be linked to multiple accounts

**Steps**:
1. Create Account A
2. Link MetaMask wallet to Account A
3. Sign out
4. Create Account B
5. Sign in to Account B
6. Navigate to Settings → Wallets tab
7. Connect the same MetaMask wallet
8. Try to link it to Account B
9. **Expected Result**:
    - Error: "This wallet is already linked to another account"
    - Account B cannot link that wallet

---

## Part 4: UI/UX Testing - Responsive Design

### Scenario 16: Desktop Wide (1920x1080+)

**Steps**:
1. Set viewport to 1920x1080 or larger
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Cards are properly spaced (not too wide)
    - ✅ Content is centered with max-width constraint
    - ✅ Tabs are evenly distributed
    - ✅ All text is readable
    - ✅ Icons are properly sized
    - ✅ Buttons are appropriately sized
    - ✅ Forms are not stretched too wide

---

### Scenario 17: Desktop Narrow (1280x720)

**Steps**:
1. Set viewport to 1280x720
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Layout adapts properly
    - ✅ Cards stack vertically if needed
    - ✅ Tabs remain visible and usable
    - ✅ No horizontal scrolling
    - ✅ All content is accessible

---

### Scenario 18: Tablet (768x1024)

**Steps**:
1. Set viewport to 768x1024 (iPad)
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Tabs are touch-friendly (adequate tap targets)
    - ✅ Cards stack vertically
    - ✅ Buttons are large enough for touch
    - ✅ Forms are full-width or appropriately sized
    - ✅ No horizontal scrolling
    - ✅ Wallet address displays properly (may wrap)

---

### Scenario 19: Mobile Small (375x667 - iPhone SE)

**Steps**:
1. Set viewport to 375x667
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Tabs scroll horizontally if needed (or stack)
    - ✅ Cards are full-width
    - ✅ Text is readable (not too small)
    - ✅ Buttons are touch-friendly (min 44x44px)
    - ✅ Wallet addresses wrap properly
    - ✅ Copy buttons are accessible
    - ✅ Dialogs are full-screen or properly sized
    - ✅ No horizontal scrolling
    - ✅ Keyboard doesn't cover inputs

**Test Actions**:
- ✅ Tap each tab
- ✅ Tap "Connect Wallet" button
- ✅ Tap "Link Email" button
- ✅ Tap "Link Google" button
- ✅ Tap wallet address to copy
- ✅ Tap unlink buttons
- ✅ Fill out email/password form
- ✅ Toggle password visibility

---

### Scenario 20: Mobile Large (428x926 - iPhone 14 Pro Max)

**Steps**:
1. Set viewport to 428x926
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Same as Scenario 19
    - ✅ Additional space utilized properly
    - ✅ No awkward empty spaces

---

## Part 5: Theme Testing

### Scenario 21: Light Theme

**Steps**:
1. Ensure light theme is active (click sun icon)
2. Navigate to Settings → Wallets tab
3. **Verify All Elements**:
    - ✅ Background is light/white
    - ✅ Text is dark and readable
    - ✅ "Connect Wallet" button is clearly visible:
      - Green border visible
      - Light green background visible
      - Dark green text readable
    - ✅ Cards have proper borders and shadows
    - ✅ Icons are visible (not too light)
    - ✅ Badges have proper contrast
    - ✅ Links are visible
    - ✅ Form inputs have proper borders
    - ✅ Buttons have proper hover states
    - ✅ Success/error messages are visible

**Test All Sections**:
- ✅ Email & Password section
- ✅ Social Accounts section
- ✅ Crypto Wallets section
- ✅ Security notice card

---

### Scenario 22: Dark Theme

**Steps**:
1. Switch to dark theme (click moon icon)
2. Navigate to Settings → Wallets tab
3. **Verify All Elements**:
    - ✅ Background is dark
    - ✅ Text is light and readable
    - ✅ "Connect Wallet" button is clearly visible:
      - Green border visible
      - Dark green text readable
    - ✅ Cards have proper borders (lighter for contrast)
    - ✅ Icons are visible (not too dark)
    - ✅ Badges have proper contrast
    - ✅ Links are visible
    - ✅ Form inputs have proper borders
    - ✅ Buttons have proper hover states
    - ✅ Success/error messages are visible

**Test All Sections**:
- ✅ Email & Password section
- ✅ Social Accounts section
- ✅ Crypto Wallets section
- ✅ Security notice card

---

### Scenario 23: Theme Switching

**Steps**:
1. Navigate to Settings → Wallets tab
2. Switch between light and dark themes multiple times
3. **Verify**:
    - ✅ No flickering or layout shifts
    - ✅ All elements update smoothly
    - ✅ No broken styles
    - ✅ Transitions are smooth (if animated)

---

## Part 6: Visual Design & Polish

### Scenario 24: Color Coding & Icons

**Verify**:
- ✅ Email/Password section: Blue icon (`bg-blue-500/10`, `text-blue-400`)
- ✅ Social Accounts section: Red icon (`bg-red-500/10`, `text-red-400`)
- ✅ Crypto Wallets section: Purple icon (`bg-purple-500/10`, `text-purple-400`)
- ✅ EVM wallets: Blue wallet icon
- ✅ Solana wallets: Purple wallet icon
- ✅ Connected state: Green checkmark (`text-green-400`)
- ✅ Active badges: Green border and text

---

### Scenario 25: Typography & Spacing

**Verify**:
- ✅ Headings are properly sized and weighted
- ✅ Body text is readable (min 14px on mobile)
- ✅ Labels are clear and properly positioned
- ✅ Consistent spacing between elements
- ✅ Proper padding in cards and sections
- ✅ Wallet addresses use monospace font
- ✅ Proper line heights for readability

---

### Scenario 26: Interactive Elements

**Verify**:
- ✅ Buttons have proper hover states
- ✅ Buttons have proper focus states (for keyboard navigation)
- ✅ Buttons have proper active/pressed states
- ✅ Links are distinguishable from text
- ✅ Form inputs have focus states
- ✅ Copy buttons show feedback on click
- ✅ Unlink buttons show confirmation dialog
- ✅ Loading states are clear and informative

---

### Scenario 27: Animations & Transitions

**Verify**:
- ✅ Smooth transitions on theme switch
- ✅ Smooth transitions on tab change
- ✅ Loading spinners animate smoothly
- ✅ Toast notifications slide in/out smoothly
- ✅ Dialog open/close animations are smooth
- ✅ No janky animations or stuttering

---

## Part 7: Edge Cases & Error Handling

### Scenario 28: Network Failures

**Steps**:
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Try to link a method
4. **Expected Result**:
    - ✅ Error message appears
    - ✅ UI doesn't break
    - ✅ User can retry when online

---

### Scenario 29: Session Expiry

**Steps**:
1. Sign in to account
2. Wait for session to expire (or manually expire)
3. Try to link a method
4. **Expected Result**:
    - ✅ Re-authentication prompt appears
    - ✅ User is redirected to sign in
    - ✅ After sign in, returns to settings page

---

### Scenario 30: Concurrent Linking

**Steps**:
1. Open Settings → Wallets tab in two browser tabs
2. Try to link same method in both tabs simultaneously
3. **Expected Result**:
    - ✅ Only one succeeds
    - ✅ Other shows appropriate error
    - ✅ No duplicate entries created

---

### Scenario 31: Special Characters in Email

**Steps**:
1. Try to link email with special characters: `test+special@example.com`
2. **Expected Result**:
    - ✅ Email is accepted
    - ✅ Stored correctly in database
    - ✅ Normalized to lowercase

---

### Scenario 32: Case Sensitivity

**Steps**:
1. Link email: `Test@Example.com`
2. **Verify**:
    - ✅ Stored as lowercase: `test@example.com`
    - ✅ Displayed consistently
    - ✅ Sign in works with any case

---

### Scenario 33: Long Wallet Addresses

**Steps**:
1. Link wallet with very long address
2. **Verify**:
    - ✅ Address is properly truncated in display
    - ✅ Full address shown on hover (if applicable)
    - ✅ Copy button copies full address
    - ✅ No layout breaking

---

### Scenario 34: Invalid Tab Parameter

**Steps**:
1. Navigate to `/settings?tab=invalid`
2. **Expected Result**:
    - ✅ Defaults to 'account' tab
    - ✅ URL updates to remove invalid parameter
    - ✅ No errors in console

---

### Scenario 35: Tab Persistence

**Steps**:
1. Navigate to Settings → Wallets tab
2. **Verify**: URL shows `/settings?tab=wallets`
3. Navigate to Dashboard
4. Navigate back to Settings
5. **Expected Result**:
    - ✅ Still on Wallets tab
    - ✅ URL still shows `/settings?tab=wallets`
    - ✅ All linked accounts load correctly

---

## Part 8: Performance Testing

### Scenario 36: Load Time

**Steps**:
1. Open DevTools → Network tab
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ Page loads in < 2 seconds
    - ✅ Accounts list loads in < 1 second
    - ✅ No unnecessary API calls
    - ✅ Proper loading states shown

---

### Scenario 37: Large Number of Linked Accounts

**Steps**:
1. Link multiple wallets (5+)
2. Link multiple OAuth accounts (if supported)
3. Navigate to Settings → Wallets tab
4. **Verify**:
    - ✅ All accounts display correctly
    - ✅ No performance degradation
    - ✅ Smooth scrolling
    - ✅ No layout issues

---

## Part 9: Accessibility Testing

### Scenario 38: Keyboard Navigation

**Steps**:
1. Navigate to Settings → Wallets tab using keyboard only
2. **Verify**:
    - ✅ Tab key navigates through all interactive elements
    - ✅ Enter/Space activates buttons
    - ✅ Focus indicators are visible
    - ✅ Can complete all actions with keyboard

---

### Scenario 39: Screen Reader

**Steps**:
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to Settings → Wallets tab
3. **Verify**:
    - ✅ All sections are announced
    - ✅ Buttons have proper labels
    - ✅ Form fields have proper labels
    - ✅ Status messages are announced
    - ✅ Error messages are announced

---

### Scenario 40: Color Contrast

**Verify** (using browser DevTools or contrast checker):
- ✅ Text meets WCAG AA standards (4.5:1 for normal text)
- ✅ Text meets WCAG AAA standards where possible (7:1)
- ✅ Interactive elements have sufficient contrast
- ✅ Focus indicators are visible
- ✅ Error messages are distinguishable

---

## Part 10: Browser Compatibility

### Scenario 41: Chrome/Edge

**Steps**:
1. Test in Chrome or Edge (Chromium)
2. **Verify**: All functionality works

---

### Scenario 42: Firefox

**Steps**:
1. Test in Firefox
2. **Verify**: All functionality works
3. **Check**: Wallet connection (MetaMask works in Firefox)

---

### Scenario 43: Safari

**Steps**:
1. Test in Safari (if available)
2. **Verify**: All functionality works
3. **Check**: Wallet connection compatibility

---

## Part 11: Integration Testing

### Scenario 44: Complete User Journey

**Objective**: Test complete account setup journey

**Steps**:
1. **Sign Up**: Create account with email/password
2. **Verify Email**: Complete email verification
3. **Link Google**: Add Google OAuth
4. **Link Wallet**: Add MetaMask wallet
5. **Link Another Wallet**: Add Phantom wallet (if applicable)
6. **Test Sign In**: Sign out and test each method
7. **Unlink Methods**: Remove methods one by one (keeping at least one)
8. **Final Sign In**: Verify remaining method works

**Expected Result**:
- ✅ All steps complete successfully
- ✅ No errors or broken states
- ✅ User can always sign in with at least one method

---

## Part 12: API Endpoint Verification

### Backend Endpoints to Test

#### GET /api/auth/accounts/list
**Test**:
```bash
curl -X GET http://localhost:3001/api/auth/accounts/list \
  -H "Authorization: Bearer <user-id>" \
  -H "Content-Type: application/json"
```
**Expected**: Returns `{ email, oauth, wallets }`

#### POST /api/auth/email/link
**Test**:
```bash
curl -X POST http://localhost:3001/api/auth/email/link \
  -H "Authorization: Bearer <user-id>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456!"}'
```
**Expected**: Returns `{ success: true, message: "..." }`

#### POST /api/auth/oauth/link
**Test**:
```bash
curl -X POST http://localhost:3001/api/auth/oauth/link \
  -H "Authorization: Bearer <user-id>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","provider":"google","providerId":"123456"}'
```
**Expected**: Returns `{ success: true, message: "..." }`

#### POST /api/auth/wallet/link
**Test**: (Requires SIWE signature - test via UI)

#### POST /api/auth/wallet/unlink
**Test**: (Test via UI)

---

## Testing Checklist Summary

### Functionality ✅
- [ ] All 12 core linking scenarios work
- [ ] Unlinking safety checks prevent lockout
- [ ] Cross-account linking is prevented
- [ ] Tab persistence works correctly
- [ ] URL query parameters work

### Responsive Design ✅
- [ ] Desktop wide (1920x1080+)
- [ ] Desktop narrow (1280x720)
- [ ] Tablet (768x1024)
- [ ] Mobile small (375x667)
- [ ] Mobile large (428x926)

### Themes ✅
- [ ] Light theme - all elements visible
- [ ] Dark theme - all elements visible
- [ ] Theme switching smooth

### Visual Design ✅
- [ ] Color coding consistent
- [ ] Icons properly sized and colored
- [ ] Typography readable
- [ ] Spacing consistent
- [ ] Animations smooth

### Edge Cases ✅
- [ ] Network failures handled
- [ ] Session expiry handled
- [ ] Special characters in email
- [ ] Case sensitivity handled
- [ ] Long addresses handled
- [ ] Invalid URLs handled

### Performance ✅
- [ ] Fast load times
- [ ] Handles many linked accounts
- [ ] No memory leaks

### Accessibility ✅
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient

### Browser Compatibility ✅
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if applicable)

---

## Reporting Issues

When reporting issues, include:
1. **Scenario number** and step where issue occurred
2. **Expected vs actual result**
3. **Browser and version**
4. **Viewport size** (if UI-related)
5. **Theme** (light/dark)
6. **Browser console errors** (screenshot)
7. **Network tab** request/response (if API-related)
8. **Screenshots** (if UI-related)
9. **Steps to reproduce**

---

## Success Criteria

✅ All 44 scenarios pass  
✅ UI is beautiful and visible in both themes  
✅ Responsive design works on all screen sizes  
✅ All linking combinations work  
✅ Unlinking safety checks prevent lockout  
✅ Cross-account linking is prevented  
✅ Tab persistence works correctly  
✅ Error messages are clear and helpful  
✅ Loading states show properly  
✅ Performance is acceptable  
✅ Accessibility standards met  
✅ Browser compatibility verified  

---

## Notes

- All email addresses are normalized to lowercase
- Wallet addresses are case-insensitive (EVM) or base58 (Solana)
- OAuth provider IDs are unique per provider
- Password hashing uses bcrypt with 12 rounds
- SIWE messages expire after 5 minutes
- Nonces are single-use and expire after 10 minutes
- Tab query parameter persists across navigation
- Default 'account' tab doesn't add query parameter

---

**Last Updated**: December 2025  
**Version**: 2.0  
**Status**: Comprehensive Testing Guide
