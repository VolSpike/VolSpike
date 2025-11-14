# NowPayments Integration - Quick Start Guide

## ✅ Implementation Complete

All code has been implemented and integrated. Follow these steps to activate crypto payments:

## Step 1: Set Up NowPayments Account

1. **Sign up** at [nowpayments.io](https://nowpayments.io)
2. **Complete KYC** verification
3. **Add payout wallets** (BTC, ETH, USDT, etc.)
4. **Generate API keys**:
   - Sandbox API key (for testing)
   - Production API key (for live)
5. **Get IPN secret** from Dashboard > Settings > Payments > IPN Settings
6. **Configure IPN URL** in NowPayments dashboard:
   - Development: `http://localhost:3001/api/payments/nowpayments/webhook`
   - Production: `https://your-backend-domain.com/api/payments/nowpayments/webhook`

## Step 2: Backend Configuration

Add to `volspike-nodejs-backend/.env`:

```bash
# NowPayments Configuration
NOWPAYMENTS_API_KEY=your-api-key-here
NOWPAYMENTS_IPN_SECRET=your-ipn-secret-here
NOWPAYMENTS_SANDBOX_MODE=true  # false for production
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1  # Production
# NOWPAYMENTS_API_URL=https://api-sandbox.nowpayments.io/v1  # Sandbox
BACKEND_URL=http://localhost:3001  # Your backend URL for webhooks
```

## Step 3: Frontend Configuration

Add to `volspike-nextjs-frontend/.env.local`:

```bash
NEXT_PUBLIC_NOWPAYMENTS_ENABLED=true
```

## Step 4: Database Migration

Run the Prisma migration to add the `CryptoPayment` table:

```bash
cd volspike-nodejs-backend
npx prisma db push
```

Or if using migrations:

```bash
npx prisma migrate dev --name add_crypto_payments
```

## Step 5: Install Dependencies

Backend dependencies are already installed (`axios` and `crypto` are built-in Node.js).

## Step 6: Test the Integration

1. **Start backend**: `cd volspike-nodejs-backend && npm run dev`
2. **Start frontend**: `cd volspike-nextjs-frontend && npm run dev`
3. **Navigate to** `/pricing` page
4. **Sign in** (payment method selector only shows for authenticated users)
5. **Select "Cryptocurrency"** payment method
6. **Click "Upgrade to Pro"**
7. **Complete test payment** on NowPayments sandbox

## Step 7: Production Deployment

1. **Update environment variables** in production:
   - Set `NOWPAYMENTS_SANDBOX_MODE=false`
   - Use production API key
   - Set `BACKEND_URL` to your production backend URL
   - Configure IPN URL in NowPayments dashboard

2. **Deploy backend** with updated environment variables

3. **Deploy frontend** with `NEXT_PUBLIC_NOWPAYMENTS_ENABLED=true`

4. **Test a small real payment** to verify everything works

## Features Implemented

✅ **Payment Method Selector** - Beautiful UI component for choosing Stripe vs Crypto  
✅ **Crypto Checkout Page** - Dedicated page for crypto payments  
✅ **Backend API Routes** - `/api/payments/nowpayments/checkout` and webhook handler  
✅ **Webhook Processing** - Automatic tier upgrades on payment confirmation  
✅ **Database Schema** - `CryptoPayment` model for tracking payments  
✅ **Success Page Updates** - Shows crypto payment processing status  
✅ **Error Handling** - Comprehensive error handling throughout  

## Payment Flow

1. User selects "Cryptocurrency" on pricing page
2. Clicks "Upgrade to Pro" → Redirected to `/checkout/crypto?tier=pro`
3. Frontend calls backend `/api/payments/nowpayments/checkout`
4. Backend creates payment with NowPayments API
5. User redirected to NowPayments payment page
6. User completes payment with crypto wallet
7. NowPayments sends webhook to backend
8. Backend verifies signature and updates user tier
9. User redirected to success page with confirmation

## Troubleshooting

**Webhook not receiving events:**
- Check IPN URL is correctly configured in NowPayments dashboard
- Verify webhook endpoint is publicly accessible
- Check backend logs for incoming requests
- Ensure IPN secret matches in both places

**Payment status not updating:**
- Check webhook handler logs
- Verify payment status is 'finished' in NowPayments dashboard
- Check database for payment record

**User tier not upgrading:**
- Check webhook handler logs
- Verify payment status is 'finished'
- Check database for payment record
- Verify user ID matches payment user ID

## Support

- **NowPayments Docs**: https://nowpayments.io/docs
- **NowPayments Support**: support@nowpayments.io
- **Integration Guide**: See `NOWPAYMENTS_INTEGRATION_GUIDE.md` for detailed documentation

---

**Status**: ✅ Ready for testing and deployment

