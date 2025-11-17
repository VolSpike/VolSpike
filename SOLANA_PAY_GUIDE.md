# Solana Pay QR Code Implementation Guide

Complete guide for generating Solana Pay QR codes that work with Phantom, Solflare, and other Solana wallets.

## Table of Contents
1. [URL Format](#url-format)
2. [Parameters](#parameters)
3. [Examples](#examples)
4. [Implementation](#implementation)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## URL Format

The Solana Pay URL specification follows this format:

```
solana:<recipient>?amount=<amount>&spl-token=<mint>&label=<label>&message=<message>&reference=<reference>
```

### Base Format
```
solana:<recipient_address>
```

### With Query Parameters
```
solana:<recipient_address>?param1=value1&param2=value2
```

## Parameters

### Required Parameters

#### `recipient` (Required)
- **Format**: Base58 encoded Solana public key
- **Length**: 32-44 characters
- **Example**: `7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q`
- **Description**: The wallet address that will receive the payment

### Optional Parameters

#### `amount` (Optional)
- **Type**: Decimal number
- **Unit**: 
  - For SOL: in SOL (e.g., `0.1` = 0.1 SOL)
  - For SPL tokens: in token base units (e.g., `10.5` = 10.5 USDC)
- **Example**: `0.1` or `10.50`
- **Description**: Pre-filled payment amount

#### `spl-token` (Optional)
- **Format**: Base58 encoded token mint address
- **Length**: 32-44 characters
- **Common Tokens**:
  - USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
  - USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **Description**: Specify SPL token for non-SOL payments
- **Note**: Omit this parameter for native SOL payments

#### `label` (Optional)
- **Type**: UTF-8 string (URL encoded)
- **Example**: `Coffee%20Shop` (displayed as "Coffee Shop")
- **Description**: Short description shown in wallet UI
- **Recommended Length**: < 50 characters

#### `message` (Optional)
- **Type**: UTF-8 string (URL encoded)
- **Example**: `Order%20%2312345` (displayed as "Order #12345")
- **Description**: Memo/message attached to transaction
- **Recommended Length**: < 100 characters
- **Use Case**: Order IDs, invoice numbers, notes

#### `reference` (Optional)
- **Format**: Base58 encoded public key(s)
- **Type**: Single key or comma-separated array
- **Example**: `8rqoXFKMpCFYeZVvZVVVVVVVVVVVVVVVVVVVVVVVVVVV`
- **Description**: Unique identifier for transaction tracking
- **Use Case**: Used to find and verify transactions on-chain

## Examples

### Example 1: Simple SOL Payment
```
solana:7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q?amount=0.1
```
- Sends 0.1 SOL to recipient

### Example 2: USDC Payment with Label
```
solana:7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q?amount=10.50&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=Coffee%20Shop
```
- Sends 10.50 USDC to recipient
- Shows "Coffee Shop" label

### Example 3: Complete Payment with All Parameters
```
solana:7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q?amount=5.0&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=Store%20Purchase&message=Invoice%20%2398765&reference=8rqoXFKMpCFYeZVvZVVVVVVVVVVVVVVVVVVVVVVVVVVV
```
- Sends 5.0 USDC
- Label: "Store Purchase"
- Message: "Invoice #98765"
- Reference for tracking

### Example 4: Request-Only (No Amount)
```
solana:7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q?label=Donation
```
- User enters amount manually
- Shows "Donation" label

## Implementation

### JavaScript/TypeScript

```javascript
import { PublicKey } from '@solana/web3.js';

function createSolanaPayURL(params) {
  const { recipient, amount, splToken, label, message, reference } = params;
  
  // Validate recipient
  new PublicKey(recipient); // Throws if invalid
  
  let url = `solana:${recipient}`;
  const query = new URLSearchParams();
  
  if (amount) query.append('amount', amount.toString());
  if (splToken) query.append('spl-token', splToken);
  if (label) query.append('label', label);
  if (message) query.append('message', message);
  if (reference) query.append('reference', reference);
  
  const queryString = query.toString();
  return queryString ? `${url}?${queryString}` : url;
}

// Usage
const url = createSolanaPayURL({
  recipient: '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
  amount: 0.1,
  label: 'Coffee Purchase',
  message: 'Order #12345'
});
```

### Python

```python
from solders.pubkey import Pubkey
from urllib.parse import urlencode

def create_solana_pay_url(recipient: str, amount: float = None, 
                          spl_token: str = None, label: str = None,
                          message: str = None, reference: str = None) -> str:
    # Validate recipient
    Pubkey.from_string(recipient)
    
    url = f"solana:{recipient}"
    params = {}
    
    if amount: params['amount'] = str(amount)
    if spl_token: params['spl-token'] = spl_token
    if label: params['label'] = label
    if message: params['message'] = message
    if reference: params['reference'] = reference
    
    if params:
        url += '?' + urlencode(params)
    
    return url

# Usage
url = create_solana_pay_url(
    recipient='7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
    amount=0.1,
    label='Coffee Purchase',
    message='Order #12345'
)
```

### PHP

```php
function createSolanaPayURL($recipient, $amount = null, $splToken = null, 
                           $label = null, $message = null, $reference = null) {
    $url = "solana:" . $recipient;
    $params = [];
    
    if ($amount !== null) $params['amount'] = $amount;
    if ($splToken) $params['spl-token'] = $splToken;
    if ($label) $params['label'] = $label;
    if ($message) $params['message'] = $message;
    if ($reference) $params['reference'] = $reference;
    
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    return $url;
}

// Usage
$url = createSolanaPayURL(
    '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
    0.1,
    null,
    'Coffee Purchase',
    'Order #12345'
);
```

## Best Practices

### 1. Address Validation
Always validate Solana addresses before generating URLs:

```javascript
function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
```

### 2. URL Encoding
Properly encode special characters in labels and messages:

```javascript
const label = encodeURIComponent('Coffee & Tea Shop');
const message = encodeURIComponent('Order #12345');
```

### 3. QR Code Settings
For optimal scanning:
- **Size**: 256x256 pixels minimum
- **Error Correction**: Level H (30% redundancy)
- **Margin**: At least 4 modules
- **Format**: PNG or SVG

```javascript
const qrOptions = {
  width: 512,
  height: 512,
  errorCorrectionLevel: 'H',
  margin: 4
};
```

### 4. Reference Generation
Generate unique references for tracking:

```javascript
import { Keypair } from '@solana/web3.js';

// Generate a unique reference
const reference = Keypair.generate().publicKey.toString();
```

### 5. Amount Precision
Handle decimal precision correctly:

```javascript
// For SOL: up to 9 decimals
const solAmount = parseFloat(amount).toFixed(9);

// For USDC/USDT: up to 6 decimals
const usdcAmount = parseFloat(amount).toFixed(6);
```

### 6. User Experience
- Show a preview of the payment details
- Include a "Copy URL" button
- Display the recipient address (truncated)
- Show estimated network fees

## Troubleshooting

### Common Issues

#### 1. Wallet Not Opening
**Problem**: QR code scans but wallet doesn't open

**Solutions**:
- Ensure URL starts with `solana:` (lowercase)
- Check for URL encoding issues
- Verify recipient address is valid
- Test with `solana:` prefix only first

#### 2. Invalid Token Address
**Problem**: "Token not found" error

**Solutions**:
- Verify SPL token mint address is correct
- Ensure token exists on the network (mainnet/devnet)
- Check if wallet supports the token
- Confirm token is not a wrapped or bridged version

#### 3. Amount Not Pre-filled
**Problem**: User still needs to enter amount

**Solutions**:
- Check `amount` parameter is included in URL
- Verify amount is a valid decimal number
- Ensure no extra spaces in amount value
- Use proper decimal separator (period, not comma)

#### 4. Message Not Appearing
**Problem**: Message/memo not shown in wallet

**Solutions**:
- Ensure message is URL encoded
- Keep message under 100 characters
- Some wallets may not display messages
- Check wallet version supports messages

#### 5. QR Code Not Scanning
**Problem**: QR code won't scan

**Solutions**:
- Increase QR code size (min 256x256px)
- Use higher error correction level (H)
- Add white border/margin
- Test different QR generators
- Ensure good contrast (black on white)

### Testing URLs

Test your URLs manually in browser:

```javascript
// Copy to clipboard and test
console.log(solanaPayURL);

// Or open directly (desktop wallets)
window.location.href = solanaPayURL;
```

### Network Considerations

#### Mainnet vs Devnet
- Mainnet: Production payments with real SOL/tokens
- Devnet: Testing with devnet SOL (free from faucet)
- URL format is identical for both networks
- Wallet must be connected to correct network

#### Transaction Verification

Verify transactions using reference:

```javascript
import { Connection, PublicKey } from '@solana/web3.js';

async function findTransaction(reference) {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const referenceKey = new PublicKey(reference);
  
  const signatures = await connection.getSignaturesForAddress(referenceKey);
  return signatures;
}
```

## Supported Wallets

### Mobile Wallets
- ✅ Phantom
- ✅ Solflare
- ✅ Backpack
- ✅ Glow
- ✅ Ultimate
- ✅ Trust Wallet

### Desktop Wallets
- ✅ Phantom (Extension)
- ✅ Solflare (Extension)
- ✅ Backpack (Extension)

### Browser Support
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Brave
- ✅ Edge

## Resources

### Official Documentation
- [Solana Pay Specification](https://docs.solanapay.com/spec)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Phantom Wallet Docs](https://docs.phantom.app/)

### Tools & Libraries
- `@solana/web3.js` - Solana JavaScript SDK
- `qrcode` - QR code generation (Node.js)
- `qrcode.react` - QR code component (React)

### Example Implementations
- [Solana Pay Demo](https://solanapay.com)
- [Solana Cookbook](https://solanacookbook.com)

## Security Considerations

### Important Security Notes

1. **Never hardcode private keys** in QR generation code
2. **Validate all addresses** before generating QR codes
3. **Use HTTPS** for web-based implementations
4. **Sanitize user inputs** to prevent injection attacks
5. **Verify transactions** on-chain after completion
6. **Rate limit** QR generation to prevent abuse
7. **Log reference keys** for dispute resolution

### Privacy Considerations

- QR codes may be cached/logged
- References can link transactions to users
- Consider generating new reference per transaction
- Don't embed sensitive info in messages

## License

This guide is provided as-is for educational purposes.

## Contributing

Found an issue or have suggestions? Contributions welcome!

---

**Last Updated**: November 2025  
**Solana Pay Spec Version**: 1.0
