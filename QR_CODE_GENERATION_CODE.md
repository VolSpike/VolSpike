# QR Code Generation Code Locations

This document shows where the Solana Pay QR code generation logic is located for fixing the Phantom prepopulation issue.

## Issue
When scanning QR code for USDT on SOL, Phantom opens but doesn't prepopulate the transaction details (address and amount).

## Code Locations

### 1. QR Generator Component (Test Tool)
**File:** `volspike-nextjs-frontend/src/components/solana-pay-qr-generator.tsx`

**Key Function:** `generateSolanaPayURL()` (lines 72-130)

```typescript
// Build URL
let url = `solana:${recipient.trim()}`
const params = new URLSearchParams()

// Add amount if provided
if (amount && parseFloat(amount) > 0) {
  params.append('amount', amount)
}

// Add SPL token if selected (skip if SOL native)
const tokenMint = selectedToken === 'custom' ? customToken.trim() : (selectedToken === 'sol' ? '' : selectedToken)
if (tokenMint && tokenMint !== 'sol') {
  if (!isValidSolanaAddress(tokenMint)) {
    setError('Invalid token mint address format')
    return null
  }
  params.append('spl-token', tokenMint)
}

// Add label if provided
if (label.trim()) {
  params.append('label', label.trim())
}

// Add message if provided
if (message.trim()) {
  params.append('message', message.trim())
}

// Add reference if provided
if (reference.trim()) {
  if (!isValidSolanaAddress(reference.trim())) {
    setError('Invalid reference address format')
    return null
  }
  params.append('reference', reference.trim())
}

// Construct final URL
const queryString = params.toString()
if (queryString) {
  url += '?' + queryString
}

return url
```

**USDT Token Mint:** `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

---

### 2. Payment Page (Production)
**File:** `volspike-nextjs-frontend/src/app/checkout/crypto/pay/page.tsx`

**Key Function:** `useMemo` hook generating `solanaUri` (lines 175-255)

```typescript
// SPL Token mint addresses (Solana mainnet)
const SPL_TOKEN_MINTS: Record<string, string> = {
  'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on Solana
  'usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
}

// Amount for Solana Pay URI – DECIMAL string in token units
let amountDecimal: string
let splTokenMint: string | null = null

if (isSOL) {
  // SOL: up to 9 decimals
  amountDecimal = paymentDetails.payAmount.toFixed(9)
} else if (isUSDT) {
  // USDT: 6 decimals
  amountDecimal = paymentDetails.payAmount.toFixed(6)
  splTokenMint = SPL_TOKEN_MINTS.usdt
} else if (isUSDC) {
  // USDC: 6 decimals
  amountDecimal = paymentDetails.payAmount.toFixed(6)
  splTokenMint = SPL_TOKEN_MINTS.usdc
}

// Build Solana Pay URI (standard format - supported by Phantom and other wallets)
const params = new URLSearchParams()

// Decimal amount in token units
params.set('amount', amountDecimal)

// SPL token mint address (required for tokens, not for SOL)
if (splTokenMint && !isSOL) {
  params.set('spl-token', splTokenMint)
}

// Optional metadata (helps with UX)
params.set('label', 'VolSpike Payment')
params.set('message', `Upgrade to ${paymentDetails.tier.toUpperCase()} tier`)

// Reference for tracking (optional)
if (paymentDetails.orderId && paymentDetails.orderId.length >= 32) {
  params.set('reference', paymentDetails.orderId)
}

const solanaPayUri = `solana:${paymentDetails.payAddress}?${params.toString()}`
```

---

## Expected URL Format for USDT on SOL

When selecting USDT on SOL with amount `1.99386686`, the generated URL should be:

```
solana:<recipient_address>?amount=1.993867&spl-token=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB&label=VolSpike%20Payment&message=Upgrade%20to%20PRO%20tier
```

**Parameters:**
- `amount`: Decimal amount (6 decimals for USDT)
- `spl-token`: USDT mint address `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- `label`: URL-encoded label
- `message`: URL-encoded message

---

## QR Code Generation

**File:** `volspike-nextjs-frontend/src/app/checkout/crypto/pay/page.tsx` (lines 324-391)

```typescript
useEffect(() => {
  const uriForQR = solanaUri
  
  if (!uriForQR) {
    console.warn('[CryptoPaymentPage] No Solana Pay URI available for QR code generation')
    return
  }

  QRCode.toDataURL(uriForQR, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M', // Medium error correction for better scanning
  })
    .then((url) => {
      console.log('[CryptoPaymentPage] QR code generated successfully', {
        uriType: 'solana-pay',
        encodedUri: uriForQR,
        // ... debug info
      })
      setQrCodeDataUrl(url)
    })
    .catch((err) => {
      console.error('[CryptoPaymentPage] QR code generation error:', err)
      toast.error('Failed to generate QR code')
    })
}, [phantomUniversalLink, solanaUri, paymentDetails])
```

---

## Debugging

Both locations log the generated URI to the browser console:

1. **Payment Page:** `[CryptoPaymentPage] Generated Solana Pay URI (Solana Pay transfer request):`
2. **QR Generator:** Check browser console for the generated URL

**To debug:**
1. Open browser console (F12)
2. Generate QR code
3. Check console logs for the exact URL format
4. Copy the URL and test it manually in Phantom

---

## Solana Pay Specification

According to the [Solana Pay spec](https://docs.solanapay.com/spec), the format should be:

```
solana:<recipient>?amount=<amount>&spl-token=<mint>&label=<label>&message=<message>&reference=<reference>
```

All parameters are optional except `recipient`. The `spl-token` parameter is required for SPL token transfers (like USDT/USDC).

---

## Potential Issues to Check

1. **URL Encoding:** Ensure special characters in label/message are properly encoded
2. **Amount Format:** Must be decimal string, not scientific notation
3. **Token Mint:** Must be valid base58 Solana address
4. **Parameter Order:** Shouldn't matter, but verify
5. **QR Code Encoding:** Ensure QR code accurately encodes the full URL
6. **Phantom Version:** May need latest Phantom app version
7. **iOS vs Android:** Behavior may differ between platforms

