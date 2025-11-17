// Solana Pay URL Generator - Node.js Example
// Install: npm install qrcode @solana/web3.js

const QRCode = require('qrcode');
const { PublicKey } = require('@solana/web3.js');

/**
 * Generate a Solana Pay URL with proper format
 * @param {Object} params - Payment parameters
 * @param {string} params.recipient - Recipient's Solana address
 * @param {number} [params.amount] - Amount in SOL or token units
 * @param {string} [params.splToken] - SPL token mint address (omit for native SOL)
 * @param {string} [params.label] - Label for the payment
 * @param {string} [params.message] - Message/memo for the transaction
 * @param {string} [params.reference] - Reference key for tracking
 * @returns {string} Solana Pay URL
 */
function createSolanaPayURL(params) {
    const { recipient, amount, splToken, label, message, reference } = params;

    // Validate recipient address
    try {
        new PublicKey(recipient);
    } catch (e) {
        throw new Error('Invalid recipient address');
    }

    // Start with base URL
    let url = `solana:${recipient}`;
    const queryParams = new URLSearchParams();

    // Add optional parameters
    if (amount !== undefined && amount > 0) {
        queryParams.append('amount', amount.toString());
    }

    if (splToken) {
        try {
            new PublicKey(splToken);
            queryParams.append('spl-token', splToken);
        } catch (e) {
            throw new Error('Invalid SPL token mint address');
        }
    }

    if (label) {
        queryParams.append('label', label);
    }

    if (message) {
        queryParams.append('message', message);
    }

    if (reference) {
        // Reference can be a public key or array of public keys
        if (Array.isArray(reference)) {
            reference.forEach(ref => {
                try {
                    new PublicKey(ref);
                    queryParams.append('reference', ref);
                } catch (e) {
                    throw new Error('Invalid reference address');
                }
            });
        } else {
            try {
                new PublicKey(reference);
                queryParams.append('reference', reference);
            } catch (e) {
                throw new Error('Invalid reference address');
            }
        }
    }

    // Construct final URL
    const queryString = queryParams.toString();
    if (queryString) {
        url += '?' + queryString;
    }

    return url;
}

/**
 * Generate QR code from Solana Pay URL
 * @param {string} url - Solana Pay URL
 * @param {string} [outputPath] - Optional path to save QR code image
 * @returns {Promise<string>} Base64 encoded QR code or file path
 */
async function generateQRCode(url, outputPath) {
    const options = {
        errorCorrectionLevel: 'H',
        type: outputPath ? 'png' : 'image/png',
        width: 512,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    };

    if (outputPath) {
        // Save to file
        await QRCode.toFile(outputPath, url, options);
        return outputPath;
    } else {
        // Return as base64
        return await QRCode.toDataURL(url, options);
    }
}

// Example Usage
async function main() {
    console.log('🔗 Solana Pay URL Generator\n');

    // Example 1: Simple SOL payment
    console.log('Example 1: Simple SOL Payment');
    const solPayment = createSolanaPayURL({
        recipient: '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
        amount: 0.1,
        label: 'Coffee Shop',
        message: 'Order #12345'
    });
    console.log('URL:', solPayment);
    console.log();

    // Example 2: USDC payment
    console.log('Example 2: USDC Payment');
    const usdcPayment = createSolanaPayURL({
        recipient: '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
        amount: 10.50,
        splToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
        label: 'Store Purchase',
        message: 'Invoice #98765'
    });
    console.log('URL:', usdcPayment);
    console.log();

    // Example 3: Payment with reference for tracking
    console.log('Example 3: Payment with Reference');
    const trackedPayment = createSolanaPayURL({
        recipient: '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q',
        amount: 5.0,
        reference: '8rqoXFKMpCFYeZVvZVVVVVVVVVVVVVVVVVVVVVVVVVVV', // Unique reference key
        label: 'Subscription',
        message: 'Monthly Plan'
    });
    console.log('URL:', trackedPayment);
    console.log();

    // Generate QR codes
    console.log('Generating QR codes...');
    
    try {
        // Save QR code to file
        await generateQRCode(solPayment, '/home/claude/solana-payment-qr.png');
        console.log('✅ QR code saved to: /home/claude/solana-payment-qr.png');

        // Get QR code as base64
        const base64QR = await generateQRCode(usdcPayment);
        console.log('✅ Base64 QR generated (length:', base64QR.length, 'chars)');
    } catch (error) {
        console.error('❌ Error generating QR code:', error.message);
    }
}

// Common SPL Token Mint Addresses
const TOKENS = {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    // Add more tokens as needed
};

// Export for use in other modules
module.exports = {
    createSolanaPayURL,
    generateQRCode,
    TOKENS
};

// Run examples if executed directly
if (require.main === module) {
    main().catch(console.error);
}
