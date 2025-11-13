# Account Linking Testing Guide

## Overview

This guide provides comprehensive step-by-step instructions for testing the complete account linking system. Users can link any authentication method to any other:

- **Email/Password** ↔ **Google OAuth** ↔ **ETH Wallet** ↔ **SOL Wallet**

All combinations are supported, and users can link/unlink methods as needed (with safety checks to prevent account lockout).

---

## Prerequisites

1. **Development Environment Setup**
   - Frontend running on `http://localhost:3000`
   - Backend running on `http://localhost:3001`
   - Database connected and migrations applied
   - Google OAuth credentials configured in `.env.local`

2. **Test Accounts**
   - Create test email accounts (or use disposable emails)
   - Have MetaMask wallet ready with test ETH
   - Have Phantom wallet ready (or use Solana testnet)

3. **Browser Setup**
   - Clear browser cache and cookies
   - Use incognito/private mode for clean testing
   - Have browser console open (F12) to monitor logs

---

## Test Scenarios

### Scenario 1: Email/Password → Link Google OAuth

**Objective**: User signs up with email/password, then links Google OAuth

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Sign Up" tab
3. Enter email: `test-email@example.com`
4. Enter password: `Test123456!`
5. Click "Sign Up"
6. Verify email (check inbox or use test email service)
7. Sign in with email/password
8. Navigate to Settings → Wallets tab
9. In "Social Accounts" section, click "Link Google"
10. Complete Google OAuth flow
11. **Expected Result**: 
    - Google account appears in "Social Accounts" section
    - User can sign in with either email/password OR Google
    - Both methods show as "Active"

**Verification**:
- Sign out
- Sign in with Google → Should work
- Sign out
- Sign in with email/password → Should work

---

### Scenario 2: Email/Password → Link ETH Wallet

**Objective**: User signs up with email/password, then links MetaMask wallet

**Steps**:
1. Sign in with email/password account from Scenario 1
2. Navigate to Settings → Wallets tab
3. In "Crypto Wallets" section, click "Connect Wallet"
4. Select MetaMask from wallet options
5. Approve connection in MetaMask
6. Click "Link Wallet to Account" button
7. Sign the SIWE message in MetaMask
8. **Expected Result**:
    - Wallet appears in "Linked Wallets" list
    - Shows wallet address, chain name, and "Connected" badge
    - User can sign in with email/password OR wallet

**Verification**:
- Sign out
- Click "Sign in with Wallet" → Connect MetaMask → Should authenticate successfully
- Sign out
- Sign in with email/password → Should work

---

### Scenario 3: Google OAuth → Link Email/Password

**Objective**: User signs up with Google, then adds email/password

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Continue with Google"
3. Complete Google OAuth flow
4. Navigate to Settings → Wallets tab
5. In "Email & Password" section, click "Link Email"
6. Enter email: `test-google@example.com`
7. Enter password: `Test123456!`
8. Confirm password: `Test123456!`
9. Click "Link Email & Password"
10. **Expected Result**:
    - Email shows as "Active" with green badge
    - User can sign in with Google OR email/password

**Verification**:
- Sign out
- Sign in with email/password → Should work
- Sign out
- Sign in with Google → Should work

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
- Test sign-in with each method
- All should work independently

---

### Scenario 5: ETH Wallet → Link Email/Password

**Objective**: User signs up with wallet, then adds email/password

**Steps**:
1. Navigate to `http://localhost:3000/auth`
2. Click "Sign in with Wallet"
3. Connect MetaMask
4. Sign SIWE message
5. Navigate to Settings → Wallets tab
6. In "Email & Password" section, click "Link Email"
7. Enter email: `test-wallet@example.com`
8. Enter password: `Test123456!`
9. Confirm password
10. Click "Link Email & Password"
11. **Expected Result**:
    - Email/password linked successfully
    - User can sign in with wallet OR email/password

**Verification**:
- Sign out
- Sign in with email/password → Should work
- Sign out
- Sign in with wallet → Should work

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
    - User can sign in with wallet OR Google

**Verification**:
- Test both sign-in methods

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
- Test both sign-in methods

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

### Scenario 9: Unlinking Safety Checks

**Objective**: Verify users cannot unlink their only authentication method

**Steps**:
1. Sign in with email/password ONLY (no other methods linked)
2. Navigate to Settings → Wallets tab
3. Try to unlink email/password
4. **Expected Result**:
    - Error message: "Cannot unlink. This is your only authentication method. Please link another method first."
    - Email/password remains linked

**Repeat for**:
- Google OAuth only account
- Wallet only account

---

### Scenario 10: Unlinking Multiple Methods

**Objective**: Verify unlinking works when multiple methods exist

**Steps**:
1. Sign in with account that has:
   - Email/password ✓
   - Google OAuth ✓
   - ETH Wallet ✓
2. Navigate to Settings → Wallets tab
3. Unlink Google OAuth
4. **Expected Result**:
    - Google OAuth removed from list
    - Email/password and wallet still work
5. Unlink ETH Wallet
6. **Expected Result**:
    - Wallet removed from list
    - Email/password still works
7. Try to unlink email/password
8. **Expected Result**:
    - Error: Cannot unlink last method

---

### Scenario 11: UI/UX Testing

**Objective**: Verify beautiful UI and proper visibility

**Steps**:
1. Test in **Light Theme**:
   - Navigate to Settings → Wallets tab
   - Verify "Connect Wallet" button is clearly visible (green border, readable text)
   - Verify all cards have proper contrast
   - Verify icons are visible
   - Verify badges and status indicators are clear

2. Test in **Dark Theme**:
   - Switch to dark mode
   - Verify all elements remain visible
   - Verify proper color contrast

3. Test **Responsive Design**:
   - Resize browser window
   - Test on mobile viewport (DevTools → Toggle device toolbar)
   - Verify cards stack properly
   - Verify buttons are tappable

4. Test **Loading States**:
   - Click "Link Email" → Verify loading spinner
   - Click "Link Google" → Verify loading state
   - Click "Link Wallet" → Verify loading state

5. Test **Error Handling**:
   - Try linking duplicate email → Verify error message
   - Try linking duplicate wallet → Verify error message
   - Try linking duplicate Google → Verify error message

---

### Scenario 12: Cross-Account Linking Prevention

**Objective**: Verify accounts cannot be linked if already linked to another account

**Steps**:
1. Create Account A with email: `account-a@example.com`
2. Link Google OAuth to Account A
3. Sign out
4. Create Account B with email: `account-b@example.com`
5. Try to link the same Google account to Account B
6. **Expected Result**:
    - Error: "This Google account is already linked to another account"
    - Account B cannot link that Google account

**Repeat for**:
- Email addresses
- Wallet addresses

---

## Edge Cases to Test

1. **Network Failures**:
   - Disconnect internet → Try linking → Verify graceful error
   - Reconnect → Verify retry works

2. **Session Expiry**:
   - Wait for session to expire → Try linking → Verify re-authentication prompt

3. **Concurrent Linking**:
   - Open two tabs → Try linking same method in both → Verify only one succeeds

4. **Special Characters**:
   - Test email with special characters: `test+special@example.com`
   - Verify normalization works

5. **Case Sensitivity**:
   - Link email: `Test@Example.com`
   - Verify stored as lowercase: `test@example.com`

---

## API Endpoints to Verify

### Backend Endpoints

1. `GET /api/auth/accounts/list` - Get all linked accounts
   - Requires: Authorization header
   - Returns: `{ email, oauth, wallets }`

2. `POST /api/auth/email/link` - Link email/password
   - Requires: Authorization header, `{ email, password }`
   - Returns: `{ success, message }`

3. `POST /api/auth/oauth/link` - Link Google OAuth
   - Requires: Authorization header, `{ email, name, image, provider, providerId }`
   - Returns: `{ success, message }`

4. `POST /api/auth/oauth/unlink` - Unlink OAuth
   - Requires: Authorization header, `{ provider }`
   - Returns: `{ success, message }`

5. `POST /api/auth/wallet/link` - Link wallet
   - Requires: Authorization header, `{ message, signature, address, chainId, provider }`
   - Returns: `{ success, message }`

6. `POST /api/auth/wallet/unlink` - Unlink wallet
   - Requires: Authorization header, `{ address, chainId, provider }`
   - Returns: `{ success, message }`

---

## Database Verification

After each linking operation, verify in database:

```sql
-- Check user accounts
SELECT id, email, "passwordHash" IS NOT NULL as has_password 
FROM users 
WHERE email = 'test@example.com';

-- Check OAuth accounts
SELECT * FROM accounts 
WHERE "userId" = '<user-id>';

-- Check wallet accounts
SELECT * FROM "walletAccounts" 
WHERE "userId" = '<user-id>';
```

---

## Common Issues & Solutions

### Issue: "Connect Wallet" button not visible in light theme
**Solution**: Fixed with improved contrast: `border-green-500/60 bg-green-500/10 text-green-600`

### Issue: Google OAuth linking creates new account instead of linking
**Solution**: Check NextAuth callback includes Authorization header when user is logged in

### Issue: Cannot unlink last authentication method
**Solution**: This is intentional - prevents account lockout. Link another method first.

### Issue: Wallet linking fails with "Signature verification failed"
**Solution**: 
- Verify wallet is connected
- Check SIWE message format
- Verify nonce is valid
- Check chain ID matches

---

## Success Criteria

✅ All 12 scenarios pass  
✅ UI is beautiful and visible in both themes  
✅ All linking combinations work  
✅ Unlinking safety checks prevent lockout  
✅ Cross-account linking is prevented  
✅ Error messages are clear and helpful  
✅ Loading states show properly  
✅ Responsive design works on mobile  

---

## Reporting Issues

When reporting issues, include:
1. Scenario number
2. Step where issue occurred
3. Expected vs actual result
4. Browser console errors
5. Network tab request/response
6. Screenshots if UI-related

---

## Notes

- All email addresses are normalized to lowercase
- Wallet addresses are case-insensitive (EVM) or base58 (Solana)
- OAuth provider IDs are unique per provider
- Password hashing uses bcrypt with 12 rounds
- SIWE messages expire after 5 minutes
- Nonces are single-use and expire after 10 minutes

