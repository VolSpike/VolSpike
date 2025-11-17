# Phantom Opening to Home Screen - Solution Guide

## Problem
After uninstalling Trust Wallet, scanning the QR code now successfully opens Phantom, but it **opens to the home screen instead of prepopulating the payment fields**.

## Root Cause
This is a very common issue with Solana Pay URIs (`solana:`) when opened via external links (system camera → Safari → Phantom). The wallet receives the URI but doesn't properly parse it as a payment request, treating it instead as a generic app launch.

---

## Immediate Solutions to Test

### Solution 1: Switch to Phantom Universal Links (RECOMMENDED)

**Problem**: `solana:` URIs don't reliably trigger the send screen when opened externally on iOS
**Fix**: Use Phantom's universal link format instead

**Change your QR code from**:
```
solana:<recipient>?amount=2.00525955&spl-token=<USDT_MINT>&label=VolSpike+Payment&message=Upgrade+to+PRO+tier&reference=<orderId>
```

**To**:
```
https://phantom.app/ul/v1/transfer?recipient=<address>&amount=<decimal>&token=<mint>
```

**Example Implementation**:
```typescript
// In your src/app/checkout/crypto/pay/page.tsx

// For USDT/USDC payments
const phantomUniversalLink = `https://phantom.app/ul/v1/transfer?` +
  `recipient=${recipientAddress}` +
  `&amount=${amount}` + // Decimal format: 2.00525955
  `&token=${tokenMint}`; // USDT or USDC mint address

// For SOL payments (omit token parameter)
const phantomUniversalLinkSOL = `https://phantom.app/ul/v1/transfer?` +
  `recipient=${recipientAddress}` +
  `&amount=${amount}`;

// Use this for your QR code
const qrCodeUri = phantomUniversalLink;
```

**Why this works**:
- Universal links (`https://phantom.app/ul/`) are specifically designed to open the send screen
- They bypass the `solana:` scheme handler that can be ambiguous
- iOS handles HTTPS links more reliably than custom URL schemes

---

### Solution 2: Use Phantom's In-App Browser

Instead of having users scan from their system camera, direct them to use Phantom's built-in scanner:

**Add clear instructions before the QR code**:

```
📱 For best results:
1. Open your Phantom app
2. Tap the Scan button (top right)
3. Scan this QR code

⚠️ Scanning with your phone's camera may not work correctly
```

**Why this works**:
- Phantom's built-in scanner properly parses Solana Pay URIs
- It has the full context to open the send screen directly
- This is the "official" way Phantom recommends for Solana Pay

---

### Solution 3: Implement Wallet Selection

Before showing the QR code, ask users which wallet they're using:

```typescript
// Example UI flow
const [selectedWallet, setSelectedWallet] = useState<'phantom' | 'other'>(null);

// If Phantom selected
if (selectedWallet === 'phantom') {
  // Show Phantom universal link QR
  qrCodeValue = phantomUniversalLink;
  instructions = "Scan with your phone camera or Phantom app";
} else {
  // Show standard Solana Pay URI
  qrCodeValue = solanaPayUri;
  instructions = "Scan with your wallet's built-in scanner";
}
```

---

## Technical Details: Why Solana Pay URIs Don't Work

### The Problem with `solana:` URIs on iOS

1. **External Link Handling**: When iOS opens an app from a `solana:` URI via Safari, the URI may not be properly passed to the app's deep link handler

2. **No Payment Context**: The app receives a generic "open app" command instead of a "process payment request" command

3. **Scheme Handler Limitations**: Custom URL schemes like `solana:` are older technology with less reliable behavior than universal links

### What Happens:
```
System Camera → Safari → solana:... → iOS → Phantom
                                     ↓
                                 App opens
                                 URI lost ❌
                                 Shows home screen
```

### What Should Happen with Universal Links:
```
System Camera → Safari → https://phantom.app/ul/... → iOS → Phantom
                                                      ↓
                                            Deep link handler
                                            URI preserved ✅
                                            Opens send screen
```

---

## Diagnostic Checklist

Before implementing the fix, verify these common issues:

### ✅ Check Your Current URI Format

**Current code in `page.tsx`**:
```typescript
// Verify you're using decimal amounts, not lamports
const amount = "2.00525955"; // ✅ Correct for SPL tokens (6 decimals for USDC/USDT)

// Verify you're using the token mint, not associated token account
const splToken = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // ✅ USDT mint
```

### ✅ Check Parameter Encoding

Make sure all parameters are properly URL-encoded:
```typescript
const label = encodeURIComponent("VolSpike Payment");
const message = encodeURIComponent("Upgrade to PRO tier");
```

### ✅ Verify Token Mint Addresses

**Common SPL Token Mints**:
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

### ✅ Check Decimal Precision

Different tokens have different decimal places:
- **SOL**: 9 decimals (1 SOL = 1,000,000,000 lamports)
- **USDC/USDT**: 6 decimals

**For amounts in your URI, use human-readable decimals**:
```typescript
// ✅ Correct
amount=2.005259  // For USDC/USDT
amount=0.5       // For SOL

// ❌ Wrong
amount=2005259   // This is raw token amount, not user units
```

---

## Code Implementation Examples

### Option A: Pure Phantom Universal Link (Simplest)

```typescript
// src/app/checkout/crypto/pay/page.tsx

interface PaymentDetails {
  recipientAddress: string;
  amount: string; // Decimal format
  tokenMint?: string; // Optional, omit for SOL
}

function generatePhantomPaymentLink(payment: PaymentDetails): string {
  const params = new URLSearchParams({
    recipient: payment.recipientAddress,
    amount: payment.amount,
  });
  
  // Add token parameter only for SPL tokens (not SOL)
  if (payment.tokenMint) {
    params.append('token', payment.tokenMint);
  }
  
  return `https://phantom.app/ul/v1/transfer?${params.toString()}`;
}

// Usage
const paymentLink = generatePhantomPaymentLink({
  recipientAddress: "YourWalletAddressHere",
  amount: "2.00525955",
  tokenMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" // USDT
});

// Use paymentLink for QR code
<QRCode value={paymentLink} />
```

### Option B: Wallet Selection with Fallback

```typescript
function generatePaymentURIs(payment: PaymentDetails) {
  // Phantom-specific universal link
  const phantomLink = generatePhantomPaymentLink(payment);
  
  // Standard Solana Pay URI for other wallets
  const solanaPayUri = encodeURL({
    recipient: new PublicKey(payment.recipientAddress),
    amount: new BigNumber(payment.amount),
    splToken: payment.tokenMint ? new PublicKey(payment.tokenMint) : undefined,
    label: "VolSpike Payment",
    message: "Upgrade to PRO tier",
    reference: new PublicKey(payment.reference),
  });
  
  return {
    phantom: phantomLink,
    generic: solanaPayUri,
  };
}

// In your component
const [walletType, setWalletType] = useState<'phantom' | 'other' | null>(null);
const uris = generatePaymentURIs(paymentDetails);

return (
  <div>
    {!walletType && (
      <div>
        <h2>Select your wallet:</h2>
        <button onClick={() => setWalletType('phantom')}>Phantom</button>
        <button onClick={() => setWalletType('other')}>Other Wallet</button>
      </div>
    )}
    
    {walletType === 'phantom' && (
      <div>
        <QRCode value={uris.phantom} />
        <p>Scan with your phone camera or Phantom app</p>
      </div>
    )}
    
    {walletType === 'other' && (
      <div>
        <QRCode value={uris.generic.toString()} />
        <p>⚠️ Use your wallet's built-in scanner</p>
      </div>
    )}
  </div>
);
```

### Option C: Add "Open in Phantom" Button

```typescript
// Provide both QR code and direct button
<div className="payment-options">
  {/* QR Code */}
  <div className="qr-section">
    <QRCode value={phantomUniversalLink} />
    <p>Scan with your phone camera</p>
  </div>
  
  {/* Direct Button */}
  <div className="button-section">
    <p>Or on mobile:</p>
    <a 
      href={phantomUniversalLink}
      className="btn btn-primary"
      target="_blank"
      rel="noopener noreferrer"
    >
      Open in Phantom Wallet
    </a>
  </div>
</div>
```

---

## Testing Protocol

### Phase 1: Test Phantom Universal Link
1. **Generate QR code** with Phantom universal link format
2. **Scan with system camera** (iPhone camera app)
3. **Expected**: Phantom opens directly to send screen with fields prefilled
4. **Document**: Take screenshot of result

### Phase 2: Test Different Token Types
Test separately for each payment token:
- [ ] SOL payment (no token parameter)
- [ ] USDC payment (with USDC mint)
- [ ] USDT payment (with USDT mint)

### Phase 3: Test Different Scan Methods
For each QR code:
- [ ] System camera → Safari → Phantom
- [ ] Phantom app → Scan button → QR code
- [ ] Direct button tap from mobile Safari

### Phase 4: Edge Cases
- [ ] Very small amounts (0.01)
- [ ] Large amounts (1000+)
- [ ] Maximum decimals (6 places for USDC/USDT)
- [ ] Zero balance wallet (ensure sufficient SOL for fees)

---

## Common Pitfalls to Avoid

### ❌ Using Associated Token Accounts in Recipient
```typescript
// Wrong - this is an associated token account
recipient: "TokenAccountAddressHere"

// Correct - use the wallet's main public key
recipient: "WalletPublicKeyHere"
```

The wallet will automatically derive the associated token account.

### ❌ Using Raw Token Amounts
```typescript
// Wrong - raw token amount (2005259 tokens with 6 decimals)
amount: "2005259"

// Correct - human-readable amount
amount: "2.005259"
```

### ❌ Mixing Up Mint Addresses
Make sure you're using the correct mint address:
- Testnet/Devnet mints are different from Mainnet
- Double-check you have the right mint for your network

### ❌ Missing URL Encoding
```typescript
// Wrong
label: "VolSpike Payment" // Space not encoded

// Correct
label: encodeURIComponent("VolSpike Payment") // "VolSpike+Payment"
```

---

## Phantom Universal Link Specification

According to Phantom's documentation, the universal link format is:

```
https://phantom.app/ul/v1/transfer?recipient=<address>&amount=<decimal>[&token=<mint>]
```

**Parameters**:
- `recipient`: Base58 wallet address (required)
- `amount`: Decimal amount in user units (required)
- `token`: SPL token mint address (optional - omit for SOL)

**Notes**:
- Do NOT include `label`, `message`, or `reference` in universal links
- These parameters only work in Solana Pay URIs (`solana:`)
- Phantom universal links are simpler and more reliable for basic transfers

---

## Alternative: Transaction Request Method

If you need more control (custom logic, multiple transfers, etc.), consider using Solana Pay's **Transaction Request** method instead of Transfer Request:

```typescript
// Generate a unique URL that Phantom will call
const transactionUrl = `https://yourdomain.com/api/solana-pay/transaction?orderId=${orderId}`;

// Create QR code with transaction request
const qrValue = `solana:${transactionUrl}`;

// Your API endpoint at /api/solana-pay/transaction
// Should respond to GET with transaction details
// And POST with the user's public key to build the transaction
```

This is more complex but gives you:
- Custom transaction building
- Multiple instructions
- Dynamic amounts
- Better tracking
- More control over the flow

**Trade-off**: Requires a backend endpoint and is more complex to implement.

---

## Monitoring & Analytics

Add tracking to understand which approach works best:

```typescript
// Track QR scan events
function trackQRScan(method: 'camera' | 'phantom-scan', walletType: string) {
  analytics.track('payment_qr_scanned', {
    scan_method: method,
    wallet_type: walletType,
    uri_type: 'phantom_universal_link',
    timestamp: new Date().toISOString(),
  });
}

// Track successful payments
function trackPaymentSuccess(transactionSignature: string) {
  analytics.track('payment_completed', {
    transaction: transactionSignature,
    method: 'qr_code',
    wallet: 'phantom',
  });
}
```

---

## Expected Results After Fix

### ✅ Success Scenario
1. User scans QR code with phone camera
2. iOS prompts: "Open in Phantom?"
3. User taps "Open"
4. **Phantom opens directly to send screen**
5. **All fields are prefilled**:
   - Recipient address ✅
   - Amount ✅
   - Token type (USDT/USDC/SOL) ✅
6. User reviews and confirms
7. Transaction completes

### ⚠️ If Still Not Working
If universal links still don't open the send screen:

1. **Verify Phantom Version**: Ensure users have the latest Phantom app (v24.0+)
2. **Test on Different Devices**: Some iOS versions have bugs
3. **Check Network**: Ensure wallet is on the correct network (mainnet/devnet)
4. **Contact Phantom Support**: May be a bug in their universal link handler
5. **Consider Alternative**: Use transaction request method as fallback

---

## Summary: Quick Action Items

**Immediate fix to deploy**:
1. ✅ Change QR code from `solana:` URI to Phantom universal link
2. ✅ Update code to use `https://phantom.app/ul/v1/transfer?...` format
3. ✅ Test with your own phone before deploying
4. ✅ Add clear instructions: "Scan with phone camera"
5. ✅ Deploy and monitor user feedback

**Medium-term improvements**:
1. Add wallet selection (Phantom vs. Other)
2. Provide both QR code and "Open in Phantom" button
3. Add analytics to track scan success rate
4. Create fallback instructions if QR scan fails

**Long-term considerations**:
1. Implement transaction request for more control
2. Support additional wallets (Solflare, Backpack)
3. Build web3 wallet connection for desktop users
4. Add webhook/polling for automatic payment verification

---

## Resources

- **Phantom Universal Links**: https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
- **Solana Pay Spec**: https://docs.solanapay.com/spec
- **Phantom Support**: https://help.phantom.app

---

**Last Updated**: November 2025
**Status**: Ready to implement ✅
