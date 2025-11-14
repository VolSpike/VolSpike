import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma, io } from '../index'
import { createLogger } from '../lib/logger'
import { User } from '../types'
import { getUser, requireUser } from '../lib/hono-extensions'
import { EmailService } from '../services/email'
import { NowPaymentsService } from '../services/nowpayments'

const logger = createLogger()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
})

const payments = new Hono()

// Validation schemas
const createCheckoutSchema = z.object({
    priceId: z.string(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    mode: z.enum(['subscription', 'payment']).optional().default('subscription'),
})

// Create Stripe checkout session
payments.post('/checkout', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()
        const { priceId, successUrl, cancelUrl, mode } = createCheckoutSchema.parse(body)

        // Create or get Stripe customer
        let customerId = user.stripeCustomerId

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            })

            customerId = customer.id

            // Update user with customer ID
            await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId: customerId },
            })
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode, // 'subscription' or 'payment'
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId: user.id,
                paymentMode: mode,
            },
        })

        logger.info(`Checkout session created for ${user?.email}`, { mode, priceId })

        return c.json({ sessionId: session.id, url: session.url })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Create checkout error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to create checkout session' }, 500)
    }
})

// Get user's subscription status
payments.get('/subscription', async (c) => {
    try {
        const user = requireUser(c)

        // Check Stripe subscription first
        let stripeSubscription = null
        if (user.stripeCustomerId) {
            try {
                const subscriptions = await stripe.subscriptions.list({
                    customer: user.stripeCustomerId,
                    status: 'active',
                    limit: 1,
                })

                if (subscriptions.data.length > 0) {
                    const subscription = subscriptions.data[0]
                    const price = await stripe.prices.retrieve(subscription.items.data[0].price.id)

                    stripeSubscription = {
                        id: subscription.id,
                        status: subscription.status,
                        currentPeriodStart: subscription.current_period_start,
                        currentPeriodEnd: subscription.current_period_end,
                        price: {
                            id: price.id,
                            amount: price.unit_amount,
                            currency: price.currency,
                            interval: price.recurring?.interval,
                        },
                        paymentMethod: 'stripe' as const,
                    }
                }
            } catch (error) {
                logger.warn('Error fetching Stripe subscription:', error)
            }
        }

        // Check crypto subscription
        let cryptoSubscription = null
        const activeCryptoPayment = await prisma.cryptoPayment.findFirst({
            where: {
                userId: user.id,
                paymentStatus: 'finished',
                expiresAt: {
                    not: null,
                    gte: new Date(), // Not expired yet
                },
            },
            orderBy: {
                expiresAt: 'desc', // Get most recent
            },
        })

        if (activeCryptoPayment && activeCryptoPayment.expiresAt) {
            const now = new Date()
            const daysUntilExpiration = Math.ceil(
                (activeCryptoPayment.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )

            cryptoSubscription = {
                id: activeCryptoPayment.id,
                status: daysUntilExpiration > 0 ? 'active' : 'expired',
                tier: activeCryptoPayment.tier,
                expiresAt: activeCryptoPayment.expiresAt.toISOString(),
                daysUntilExpiration,
                paymentMethod: 'crypto' as const,
                payCurrency: activeCryptoPayment.actuallyPaidCurrency || activeCryptoPayment.payCurrency,
            }
        }

        logger.info(`Subscription status requested by ${user?.email}`, {
            hasStripe: !!stripeSubscription,
            hasCrypto: !!cryptoSubscription,
        })

        return c.json({
            stripe: stripeSubscription,
            crypto: cryptoSubscription,
            // For backward compatibility, return primary subscription
            subscription: stripeSubscription || cryptoSubscription,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Get subscription error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to fetch subscription' }, 500)
    }
})

// Create billing portal session
payments.post('/portal', async (c) => {
    try {
        const user = requireUser(c)

        if (!user.stripeCustomerId) {
            return c.json({ error: 'No customer found' }, 404)
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        })

        logger.info(`Billing portal session created for ${user?.email}`)

        return c.json({ url: session.url })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Create portal error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to create billing portal session' }, 500)
    }
})

// List recent invoices for the authenticated user's Stripe customer
payments.get('/invoices', async (c) => {
    try {
        const user = requireUser(c)

        if (!user.stripeCustomerId) {
            return c.json({ invoices: [] })
        }

        const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            limit: 10,
        })

        const mapped = invoices.data.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            currency: inv.currency,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            invoicePdf: inv.invoice_pdf,
            created: inv.created,
            periodStart: inv.lines?.data?.[0]?.period?.start || null,
            periodEnd: inv.lines?.data?.[0]?.period?.end || null,
        }))

        logger.info(`Invoices requested by ${user?.email}`, { count: mapped.length })

        return c.json({ invoices: mapped })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Get invoices error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to fetch invoices' }, 500)
    }
})

// Stripe webhook handler
// IMPORTANT: This endpoint must be publicly accessible (no auth middleware)
// Stripe sends webhooks from their servers, not from user browsers
payments.post('/webhook', async (c) => {
    try {
        logger.info('Webhook received', {
            method: c.req.method,
            path: c.req.path,
            url: c.req.url,
            hasSignature: !!c.req.header('stripe-signature'),
        })

        const body = await c.req.text()
        const signature = c.req.header('stripe-signature')

        if (!signature) {
            logger.warn('Webhook missing signature header')
            return c.json({ error: 'Missing signature' }, 400)
        }

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
        let event: Stripe.Event

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
        } catch (err) {
            logger.error('Webhook signature verification failed:', err)
            return c.json({ error: 'Invalid signature' }, 400)
        }

        logger.info(`Processing webhook event: ${event.type}`, {
            eventId: event.id,
            eventType: event.type,
        })

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionChange(event.data.object as Stripe.Subscription)
                break
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
                break
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
                break
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice)
                break
            default:
                logger.info(`Unhandled event type: ${event.type}`)
        }

        logger.info(`Webhook event ${event.type} processed successfully`)

        return c.json({ received: true })
    } catch (error) {
        logger.error('Webhook error:', error)
        return c.json({ error: 'Webhook processing failed' }, 500)
    }
})

// Test endpoint to verify webhook route is accessible
payments.get('/webhook', async (c) => {
    return c.json({
        message: 'Webhook endpoint is accessible',
        method: 'Use POST to receive webhooks from Stripe',
        path: '/api/payments/webhook'
    })
})

// Helper functions for webhook handling
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    try {
        logger.info('Processing checkout.session.completed', {
            sessionId: session.id,
            customerId: session.customer,
            userId: session.metadata?.userId,
        })

        const customerId = session.customer as string
        let tier: string | null = null
        let priceId: string | null = null

        // Handle subscription checkouts
        if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
            )
            priceId = subscription.items.data[0].price.id
            const price = await stripe.prices.retrieve(priceId)
            tier = price.metadata?.tier || 'pro'
        }
        // Handle one-time payment checkouts
        else if (session.mode === 'payment' && session.line_items) {
            // For one-time payments, get the price from line items
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
            if (lineItems.data.length > 0) {
                priceId = lineItems.data[0].price?.id || null
                if (priceId) {
                    const price = await stripe.prices.retrieve(priceId)
                    tier = price.metadata?.tier || 'pro' // Default to 'pro' for test payment
                }
            }
        }

        // Update user tier if we determined one
        if (tier) {
            // Get user's previous tier before updating (for email notification)
            let previousTier: string | undefined
            let userEmail: string | undefined
            let userName: string | undefined

            if (session.metadata?.userId) {
                const existingUser = await prisma.user.findUnique({
                    where: { id: session.metadata.userId },
                    select: { tier: true, email: true },
                })
                if (existingUser) {
                    previousTier = existingUser.tier
                    userEmail = existingUser.email || undefined
                    userName = undefined
                }
            } else {
                // Fallback: get from customerId
                const existingUser = await prisma.user.findFirst({
                    where: { stripeCustomerId: customerId },
                    select: { tier: true, email: true },
                })
                if (existingUser) {
                    previousTier = existingUser.tier
                    userEmail = existingUser.email || undefined
                    userName = undefined
                }
            }

            // Update user tier
            const result = await prisma.user.updateMany({
                where: { stripeCustomerId: customerId },
                data: { tier },
            })

            logger.info(`Checkout completed: User tier updated to ${tier}`, {
                customerId,
                tier,
                previousTier,
                mode: session.mode,
                usersUpdated: result.count,
                priceId,
            })

            // Also update via userId if available (more reliable)
            if (session.metadata?.userId) {
                const userResult = await prisma.user.update({
                    where: { id: session.metadata.userId },
                    data: { tier },
                })
                logger.info(`Also updated user via userId: ${session.metadata.userId}`, {
                    email: userResult.email,
                    tier: userResult.tier,
                })

                // Send tier upgrade email to customer
                if (userResult.email && previousTier !== tier) {
                    try {
                        const emailService = EmailService.getInstance()
                        await emailService.sendTierUpgradeEmail({
                            email: userResult.email,
                            name: undefined,
                            newTier: tier,
                            previousTier: previousTier,
                        })
                        logger.info(`Tier upgrade email sent to ${userResult.email}`)
                    } catch (error) {
                        logger.error(`Failed to send tier upgrade email to ${userResult.email}:`, error)
                        // Don't throw - email failure shouldn't break the webhook
                    }
                }

                // Broadcast tier change via WebSocket
                if (io) {
                    io.to(`user-${session.metadata.userId}`).emit('tier-changed', { tier })
                    logger.info(`Broadcasted tier change to user ${session.metadata.userId}`)
                }
            }

            // Also broadcast to users updated by customerId
            if (result.count > 0 && io) {
                const updatedUsers = await prisma.user.findMany({
                    where: { stripeCustomerId: customerId },
                    select: { id: true, email: true },
                })

                updatedUsers.forEach(user => {
                    io.to(`user-${user.id}`).emit('tier-changed', { tier })
                })

                // Send email to users updated by customerId (if not already sent via userId)
                if (!session.metadata?.userId && userEmail && previousTier !== tier) {
                    try {
                        const emailService = EmailService.getInstance()
                        await emailService.sendTierUpgradeEmail({
                            email: userEmail,
                            name: userName,
                            newTier: tier,
                            previousTier: previousTier,
                        })
                        logger.info(`Tier upgrade email sent to ${userEmail}`)
                    } catch (error) {
                        logger.error(`Failed to send tier upgrade email to ${userEmail}:`, error)
                        // Don't throw - email failure shouldn't break the webhook
                    }
                }

                logger.info(`Broadcasted tier change to ${updatedUsers.length} user(s)`)
            }
        } else {
            logger.warn('Checkout completed but could not determine tier', {
                sessionId: session.id,
                mode: session.mode,
                customerId,
            })
        }
    } catch (error) {
        logger.error('Error handling checkout.session.completed:', error)
        throw error
    }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    try {
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0].price.id

        logger.info('Processing subscription change', {
            subscriptionId: subscription.id,
            customerId,
            priceId,
            status: subscription.status,
        })

        // Get price metadata to determine tier
        const price = await stripe.prices.retrieve(priceId)
        const tier = price.metadata?.tier || 'pro'

        logger.info('Price metadata retrieved', {
            priceId,
            tier,
            metadata: price.metadata,
        })

        // Get user's previous tier before updating (for email notification)
        const existingUsers = await prisma.user.findMany({
            where: { stripeCustomerId: customerId },
            select: { id: true, tier: true, email: true },
        })

        const previousTiers = new Map<string, string>()
        existingUsers.forEach(user => {
            previousTiers.set(user.id, user.tier)
        })

        // Update user tier
        const result = await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { tier },
        })

        logger.info(`User tier updated to ${tier} for customer ${customerId}`, {
            customerId,
            tier,
            usersUpdated: result.count,
            priceMetadata: price.metadata,
        })

        if (result.count === 0) {
            logger.warn(`No users found with stripeCustomerId: ${customerId}`)
        } else {
            // Get updated users to send emails and broadcast
            const updatedUsers = await prisma.user.findMany({
                where: { stripeCustomerId: customerId },
                select: { id: true, email: true, tier: true },
            })

            // Send tier upgrade emails and broadcast tier changes
            const emailService = EmailService.getInstance()
            updatedUsers.forEach(user => {
                const previousTier = previousTiers.get(user.id)
                
                // Broadcast tier change via WebSocket
                if (io) {
                    io.to(`user-${user.id}`).emit('tier-changed', { tier })
                }

                // Send email if tier actually changed
                if (user.email && previousTier && previousTier !== tier) {
                    emailService.sendTierUpgradeEmail({
                        email: user.email,
                        name: undefined,
                        newTier: tier,
                        previousTier: previousTier,
                    }).then(() => {
                        logger.info(`Tier upgrade email sent to ${user.email}`)
                    }).catch((error) => {
                        logger.error(`Failed to send tier upgrade email to ${user.email}:`, error)
                        // Don't throw - email failure shouldn't break the webhook
                    })
                }
            })

            logger.info(`Broadcasted tier change to ${updatedUsers.length} user(s)`)
        }
    } catch (error) {
        logger.error('Error handling subscription change:', error)
        throw error
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string

    // Get user's previous tier before downgrading (for email notification)
    const existingUsers = await prisma.user.findMany({
        where: { stripeCustomerId: customerId },
        select: { id: true, tier: true, email: true },
    })

    const previousTiers = new Map<string, string>()
    existingUsers.forEach(user => {
        previousTiers.set(user.id, user.tier)
    })

    // Downgrade to free tier
    const result = await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { tier: 'free' },
    })

    logger.info(`User downgraded to free tier for customer ${customerId}`, {
        customerId,
        usersUpdated: result.count,
    })

    // If no users were updated, log a warning and try fallback
    if (result.count === 0) {
        logger.warn(`No users found with stripeCustomerId: ${customerId} - subscription deleted but user tier not updated`)

        // Try to find user by customer ID in metadata or other means
        // This is a fallback - ideally stripeCustomerId should always match
        try {
            const customer = await stripe.customers.retrieve(customerId)
            if (!customer.deleted && customer.email) {
                const existingUser = await prisma.user.findFirst({
                    where: { email: customer.email },
                    select: { id: true, tier: true, email: true },
                })

                const previousTier = existingUser?.tier

                const emailResult = await prisma.user.updateMany({
                    where: { email: customer.email },
                    data: { tier: 'free' },
                })
                logger.info(`Fallback: Updated user by email ${customer.email}`, {
                    usersUpdated: emailResult.count,
                })

                // Broadcast tier change and send email if user was updated
                if (emailResult.count > 0) {
                    const updatedUser = await prisma.user.findFirst({
                        where: { email: customer.email },
                        select: { id: true, email: true },
                    })
                    if (updatedUser) {
                        if (io) {
                            io.to(`user-${updatedUser.id}`).emit('tier-changed', { tier: 'free' })
                            logger.info(`Broadcasted tier change to user ${updatedUser.id}`)
                        }

                        // Send downgrade email
                        if (updatedUser.email && previousTier && previousTier !== 'free') {
                            try {
                                const emailService = EmailService.getInstance()
                                await emailService.sendTierUpgradeEmail({
                                    email: updatedUser.email,
                                    name: undefined,
                                    newTier: 'free',
                                    previousTier: previousTier,
                                })
                                logger.info(`Tier downgrade email sent to ${updatedUser.email}`)
                            } catch (error) {
                                logger.error(`Failed to send tier downgrade email to ${updatedUser.email}:`, error)
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to retrieve customer ${customerId} for fallback update:`, error)
        }
    } else {
        // Get updated users to send emails and broadcast
        const updatedUsers = await prisma.user.findMany({
            where: { stripeCustomerId: customerId },
            select: { id: true, email: true },
        })

        // Broadcast tier change and send emails
        const emailService = EmailService.getInstance()
        updatedUsers.forEach(user => {
            const previousTier = previousTiers.get(user.id)

            // Broadcast tier change via WebSocket
            if (io) {
                io.to(`user-${user.id}`).emit('tier-changed', { tier: 'free' })
            }

            // Send email if tier actually changed
            if (user.email && previousTier && previousTier !== 'free') {
                emailService.sendTierUpgradeEmail({
                    email: user.email,
                    name: undefined,
                    newTier: 'free',
                    previousTier: previousTier,
                }).then(() => {
                    logger.info(`Tier downgrade email sent to ${user.email}`)
                }).catch((error) => {
                    logger.error(`Failed to send tier downgrade email to ${user.email}:`, error)
                })
            }
        })

        logger.info(`Broadcasted tier change to ${updatedUsers.length} user(s)`)
    }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string

    // Log successful payment
    logger.info(`Payment succeeded for customer ${customerId}, amount: ${invoice.amount_paid}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string

    // Log failed payment
    logger.error(`Payment failed for customer ${customerId}, amount: ${invoice.amount_due}`)
}

// ============================================
// NowPayments Crypto Payment Routes
// ============================================

// Create NowPayments checkout
payments.post('/nowpayments/checkout', async (c) => {
    try {
        logger.info('NowPayments checkout request received', {
            method: c.req.method,
            url: c.req.url,
            hasAuth: !!c.req.header('authorization'),
        })

        const user = requireUser(c)
        logger.info('User authenticated for NowPayments checkout', {
            userId: user.id,
            email: user.email,
        })

        const body = await c.req.json()
        logger.info('Request body parsed', {
            tier: body.tier,
            hasSuccessUrl: !!body.successUrl,
            hasCancelUrl: !!body.cancelUrl,
            payCurrency: body.payCurrency,
        })

        const { tier, successUrl, cancelUrl, payCurrency } = z.object({
            tier: z.enum(['pro', 'elite']),
            successUrl: z.string().url(),
            cancelUrl: z.string().url(),
            payCurrency: z.string().optional(), // Optional - user-selected currency
        }).parse(body)

        // Determine price based on tier
        const tierPrices: Record<string, number> = {
            pro: 9.0,
            elite: 49.0,
        }
        const priceAmount = tierPrices[tier] || 9.0

        // Generate unique order ID
        const orderId = `volspike-${user.id}-${Date.now()}`

        // Check environment variables
        const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(':3000', ':3001') || 'http://localhost:3001'
        const ipnCallbackUrl = `${backendUrl}/api/payments/nowpayments/webhook`

        logger.info('NowPayments configuration check', {
            hasApiKey: !!process.env.NOWPAYMENTS_API_KEY,
            hasIpnSecret: !!process.env.NOWPAYMENTS_IPN_SECRET,
            apiUrl: process.env.NOWPAYMENTS_API_URL,
            sandboxMode: process.env.NOWPAYMENTS_SANDBOX_MODE,
            backendUrl,
            ipnCallbackUrl,
            priceAmount,
            tier,
            orderId,
        })

        // Create invoice with NowPayments (hosted checkout flow)
        // This is the correct endpoint for getting invoice_id and invoice_url
        const nowpayments = NowPaymentsService.getInstance()
        
        logger.info('Creating NowPayments invoice for hosted checkout', {
            price_amount: priceAmount,
            price_currency: 'usd',
            order_id: orderId,
            tier,
            ipn_callback_url: ipnCallbackUrl,
        })

        // Map currency code to NowPayments format and validate
        let mappedPayCurrency: string | null = null
        
        if (payCurrency) {
            // Import currency mapper
            const { mapCurrencyToNowPayments, isSupportedCurrency, getCurrencyDisplayName, getCurrencyNetwork } = await import('../services/currency-mapper')
            
            // Validate currency is supported in our system
            if (!isSupportedCurrency(payCurrency)) {
                logger.error('Unsupported currency code requested', {
                    payCurrency,
                    supportedCurrencies: ['usdtsol', 'usdterc20', 'usdce', 'sol', 'btc', 'eth'],
                })
                throw new Error(`Unsupported currency: ${payCurrency}. Please select a supported currency.`)
            }
            
            // Fetch available currencies from NowPayments to validate and map
            logger.info('Fetching available currencies from NowPayments for validation', {
                requestedCurrency: payCurrency,
                displayName: getCurrencyDisplayName(payCurrency),
                network: getCurrencyNetwork(payCurrency),
            })
            
            try {
                const availableCurrencies = await nowpayments.getAvailableCurrencies()
                
                if (!availableCurrencies || availableCurrencies.length === 0) {
                    logger.warn('NowPayments returned empty currency list, using mapped code without validation', {
                        payCurrency,
                    })
                    // Fall back to mapped code without validation
                    mappedPayCurrency = mapCurrencyToNowPayments(payCurrency, [])
                } else {
                    // Map to NowPayments code with validation
                    mappedPayCurrency = mapCurrencyToNowPayments(payCurrency, availableCurrencies)
                    
                    if (!mappedPayCurrency) {
                        logger.error('Failed to map currency code to NowPayments format', {
                            payCurrency,
                            displayName: getCurrencyDisplayName(payCurrency),
                            network: getCurrencyNetwork(payCurrency),
                            availableCurrencies: availableCurrencies.slice(0, 50),
                            availableCount: availableCurrencies.length,
                        })
                        throw new Error(`Currency ${getCurrencyDisplayName(payCurrency)} on ${getCurrencyNetwork(payCurrency)} is not available. Please select a different currency.`)
                    }
                    
                    logger.info('Currency code mapped successfully', {
                        ourCode: payCurrency,
                        nowpaymentsCode: mappedPayCurrency,
                        displayName: getCurrencyDisplayName(payCurrency),
                        network: getCurrencyNetwork(payCurrency),
                    })
                }
            } catch (error) {
                logger.error('Error validating currency code', {
                    error: error instanceof Error ? error.message : String(error),
                    payCurrency,
                    displayName: getCurrencyDisplayName(payCurrency),
                    network: getCurrencyNetwork(payCurrency),
                })
                // Re-throw validation errors
                if (error instanceof Error && (error.message.includes('Unsupported') || error.message.includes('not available'))) {
                    throw error
                }
                // For API errors, try to use mapped code without validation
                logger.warn('Currency validation API call failed, using mapped code without validation', {
                    payCurrency,
                    error: error instanceof Error ? error.message : String(error),
                })
                mappedPayCurrency = mapCurrencyToNowPayments(payCurrency, [])
            }
        }
        
        // Use mapped currency or default to USDT on Solana (usdt_sol format)
        const finalPayCurrency = mappedPayCurrency || 'usdt_sol'
        
        logger.info('Final currency code determined', {
            originalPayCurrency: payCurrency,
            finalPayCurrency,
            wasMapped: !!mappedPayCurrency,
        })
        
        // Create invoice parameters
        const invoiceParams: any = {
            price_amount: priceAmount,
            price_currency: 'usd',
            order_id: orderId,
            order_description: `VolSpike ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
            ipn_callback_url: ipnCallbackUrl,
            success_url: successUrl,
            cancel_url: cancelUrl,
            pay_currency: finalPayCurrency, // Use validated/mapped currency code
        }
        
        logger.info('Invoice parameters prepared', {
            payCurrency: finalPayCurrency,
            originalPayCurrency: payCurrency,
            priceAmount: invoiceParams.price_amount,
            orderId: invoiceParams.order_id,
            priceCurrency: invoiceParams.price_currency,
        })

        const invoice = await nowpayments.createInvoice(invoiceParams)

        // Extract invoice_id and invoice_url from response
        const invoiceId = invoice.invoice_id
        const invoiceUrl = invoice.invoice_url || (invoiceId && `https://nowpayments.io/payment/?iid=${invoiceId}`)

        logger.info('NowPayments invoice created successfully', {
            invoiceId,
            invoiceUrl,
            orderId,
            hasInvoiceId: !!invoiceId,
            hasInvoiceUrl: !!invoiceUrl,
            fullResponse: JSON.stringify(invoice, null, 2),
        })

        // Validate required fields
        if (!invoiceId) {
            logger.error('CRITICAL: NowPayments invoice response missing invoice_id', {
                invoiceResponse: invoice,
                allKeys: Object.keys(invoice),
            })
            throw new Error('NowPayments API did not return invoice_id')
        }

        if (!invoiceUrl) {
            logger.error('CRITICAL: NowPayments invoice response missing invoice_url', {
                invoiceId,
                invoiceResponse: invoice,
                allKeys: Object.keys(invoice),
            })
            throw new Error('NowPayments API did not return invoice_url')
        }

        // Store invoice in database
        // paymentId will be null until IPN webhook updates it
        try {
            // Check if invoice already exists (duplicate request protection)
            const existingPayment = await prisma.cryptoPayment.findUnique({
                where: { invoiceId: String(invoiceId) },
            })

            if (existingPayment) {
                logger.warn('Invoice already exists in database, returning existing payment', {
                    invoiceId,
                    orderId,
                    userId: user.id,
                    existingPaymentId: existingPayment.id,
                })
                // Return existing payment instead of creating duplicate
                return c.json({
                    paymentId: existingPayment.paymentId,
                    invoiceId: existingPayment.invoiceId,
                    paymentUrl: existingPayment.paymentUrl,
                    payAddress: existingPayment.payAddress,
                    payAmount: existingPayment.payAmount,
                    payCurrency: existingPayment.payCurrency,
                    priceAmount: priceAmount,
                    priceCurrency: 'usd',
                })
            }

            // Create new payment record
            // Use only required fields - optional fields (expiresAt, renewalReminderSent) are nullable
            // and will be set when payment completes via webhook
            const cryptoPayment = await prisma.cryptoPayment.create({
                data: {
                    userId: user.id,
                    paymentStatus: 'waiting', // Initial status
                    tier: tier,
                    invoiceId: String(invoiceId), // Required - used for hosted checkout
                    orderId: orderId, // Required - used for tracking
                    paymentUrl: invoiceUrl, // Required - invoice_url from API
                    // Optional fields are not set here - they'll be null until payment completes
                    // expiresAt and renewalReminderSent will be set by webhook when payment_status = 'finished'
                },
            })
            
            logger.info('Crypto payment record created in database', {
                paymentId: cryptoPayment.id,
                invoiceId,
                orderId,
                userId: user.id,
            })
        } catch (dbError) {
            // Enhanced error logging with full context
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError)
            const errorStack = dbError instanceof Error ? dbError.stack : undefined
            
            logger.error('Failed to create crypto payment record in database - FULL ERROR DETAILS', {
                error: errorMessage,
                stack: errorStack,
                invoiceId,
                orderId,
                userId: user.id,
                tier,
                // Check for common Prisma errors
                isUniqueConstraintError: errorMessage.includes('Unique constraint') || errorMessage.includes('duplicate'),
                isForeignKeyError: errorMessage.includes('Foreign key constraint') || errorMessage.includes('relation'),
                isSchemaError: errorMessage.includes('Unknown column') || errorMessage.includes('column') && errorMessage.includes('does not exist'),
                suggestion: errorMessage.includes('expiresAt') || errorMessage.includes('renewalReminderSent')
                    ? 'Database migration may not be applied. Run: npx prisma db push'
                    : errorMessage.includes('Unique constraint')
                    ? 'Invoice already exists - this is normal for duplicate requests'
                    : 'Check error details above',
            })

            // If it's a unique constraint error (duplicate invoice), try to fetch existing payment
            if (errorMessage.includes('Unique constraint') || errorMessage.includes('duplicate')) {
                try {
                    const existingPayment = await prisma.cryptoPayment.findUnique({
                        where: { invoiceId: String(invoiceId) },
                    })
                    
                    if (existingPayment) {
                        logger.info('Found existing payment for duplicate invoice, returning it', {
                            invoiceId,
                            existingPaymentId: existingPayment.id,
                        })
                        return c.json({
                            paymentId: existingPayment.paymentId,
                            invoiceId: existingPayment.invoiceId,
                            paymentUrl: existingPayment.paymentUrl,
                            payAddress: existingPayment.payAddress,
                            payAmount: existingPayment.payAmount,
                            payCurrency: existingPayment.payCurrency,
                            priceAmount: priceAmount,
                            priceCurrency: 'usd',
                        })
                    }
                } catch (fetchError) {
                    logger.error('Failed to fetch existing payment after unique constraint error', {
                        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
                    })
                }
            }

            // For schema errors, try to work around missing fields
            // This handles cases where migration hasn't been applied yet
            if (errorMessage.includes('expiresAt') || errorMessage.includes('renewalReminderSent') || 
                errorMessage.includes('Unknown column') || (errorMessage.includes('column') && errorMessage.includes('does not exist'))) {
                
                // Log the error but don't fail - the migration will be applied on next deployment
                logger.warn('Database schema mismatch detected - migration may be in progress', {
                    error: errorMessage,
                    invoiceId,
                    orderId,
                    suggestion: 'Migration will be applied automatically on next deployment',
                })
                
                // Try to create payment without optional fields by using raw SQL as fallback
                // This is a temporary workaround until migration completes
                try {
                    // Generate a unique ID (using cuid-like format or UUID)
                    const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
                    
                    // Use Prisma's raw SQL to insert only required fields
                    // Table name is 'crypto_payments' (from @@map directive)
                    await prisma.$executeRaw`
                        INSERT INTO crypto_payments (
                            id, "userId", "paymentStatus", tier, "invoiceId", "orderId", "paymentUrl", "createdAt", "updatedAt"
                        ) VALUES (
                            ${paymentId}, ${user.id}, 'waiting', ${tier}, ${String(invoiceId)}, ${orderId}, ${invoiceUrl}, NOW(), NOW()
                        )
                        ON CONFLICT ("invoiceId") DO NOTHING
                    `
                    
                    // Fetch the created payment
                    const createdPayment = await prisma.cryptoPayment.findUnique({
                        where: { invoiceId: String(invoiceId) },
                    })
                    
                    if (createdPayment) {
                        logger.info('Payment created successfully using raw SQL fallback', {
                            invoiceId,
                            orderId,
                            paymentId: createdPayment.id,
                        })
                        
                        return c.json({
                            paymentId: createdPayment.paymentId,
                            invoiceId: createdPayment.invoiceId,
                            paymentUrl: createdPayment.paymentUrl,
                            payAddress: createdPayment.payAddress,
                            payAmount: createdPayment.payAmount,
                            payCurrency: createdPayment.payCurrency,
                            priceAmount: priceAmount,
                            priceCurrency: 'usd',
                        })
                    }
                } catch (rawSqlError) {
                    logger.error('Raw SQL fallback also failed', {
                        error: rawSqlError instanceof Error ? rawSqlError.message : String(rawSqlError),
                        invoiceId,
                    })
                }
                
                // If fallback also fails, throw user-friendly error
                throw new Error('Database migration in progress. Please try again in a few moments.')
            }

            // For other errors, throw generic message
            throw new Error('Failed to save payment record. Please try again.')
        }

        logger.info(`NowPayments checkout completed successfully for ${user.email}`, {
            invoiceId,
            invoiceUrl,
            tier,
        })

        return c.json({
            paymentId: null, // Not available until IPN webhook
            invoiceId: invoiceId,
            paymentUrl: invoiceUrl,
            payAddress: null, // Not available until payment is created
            payAmount: null,
            payCurrency: null,
            priceAmount: priceAmount,
            priceCurrency: 'usd',
        })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        
        logger.error('NowPayments checkout error - FULL DETAILS:', {
            message: errorMessage,
            stack: errorStack,
            errorType: error?.constructor?.name,
            errorDetails: error instanceof Error ? {
                name: error.name,
                message: error.message,
            } : String(error),
        })

        // Check for specific error types
        if (errorMessage.includes('User not authenticated') || errorMessage.includes('Authorization')) {
            return c.json({ 
                error: 'Unauthorized',
                details: 'Authentication failed. Please sign in again.',
            }, 401)
        }

        if (errorMessage.includes('API key')) {
            return c.json({ 
                error: 'Configuration Error',
                details: 'NowPayments API key is not configured correctly. Please check your environment variables.',
                message: errorMessage,
            }, 500)
        }

        if (errorMessage.includes('Cannot connect')) {
            return c.json({ 
                error: 'Connection Error',
                details: 'Cannot connect to NowPayments API. Please check your network connection and API URL.',
                message: errorMessage,
            }, 500)
        }

        // Return detailed error for debugging
        return c.json({ 
            error: 'Failed to create checkout session',
            details: errorMessage,
            message: errorMessage,
        }, 500)
    }
})

// NowPayments webhook handler
// IMPORTANT: This endpoint must be publicly accessible (no auth middleware)
// NowPayments sends webhooks from their servers, not from user browsers
payments.post('/nowpayments/webhook', async (c) => {
    try {
        logger.info('NowPayments webhook received', {
            method: c.req.method,
            path: c.req.path,
            url: c.req.url,
            hasSignature: !!c.req.header('x-nowpayments-sig'),
        })

        const body = await c.req.text()
        const signature = c.req.header('x-nowpayments-sig')

        if (!signature) {
            logger.warn('NowPayments webhook missing signature')
            return c.json({ error: 'Missing signature' }, 400)
        }

        // Verify signature
        const nowpayments = NowPaymentsService.getInstance()
        if (!nowpayments.verifyIPNSignature(body, signature)) {
            logger.error('NowPayments webhook signature verification failed')
            return c.json({ error: 'Invalid signature' }, 400)
        }

        const data = JSON.parse(body)
        const { payment_id, payment_status, invoice_id, order_id } = data

        logger.info('NowPayments webhook processing', {
            paymentId: payment_id,
            invoiceId: invoice_id,
            orderId: order_id,
            paymentStatus: payment_status,
            webhookData: JSON.stringify(data, null, 2),
        })

        // Find payment in database by payment_id, invoice_id, or order_id
        // Try payment_id first (if it exists), then invoice_id, then order_id
        let cryptoPayment = null
        
        if (payment_id) {
            cryptoPayment = await prisma.cryptoPayment.findUnique({
                where: { paymentId: payment_id },
                include: { user: true },
            })
        }
        
        if (!cryptoPayment && invoice_id) {
            const found = await prisma.cryptoPayment.findUnique({
                where: { invoiceId: String(invoice_id) },
                include: { user: true },
            })
            if (found) {
                cryptoPayment = found
            }
        }
        
        if (!cryptoPayment && order_id) {
            cryptoPayment = await prisma.cryptoPayment.findFirst({
                where: { orderId: order_id },
                include: { user: true },
            })
        }

        if (!cryptoPayment) {
            logger.warn(`Crypto payment not found in database`, {
                paymentId: payment_id,
                invoiceId: invoice_id,
                orderId: order_id,
            })
            return c.json({ error: 'Payment not found' }, 404)
        }

        // Update payment status
        // Use the ID we found (could be paymentId, invoiceId, or orderId)
        // Must use id field for update if paymentId/invoiceId might be null
        const updateWhere = cryptoPayment.paymentId 
            ? { paymentId: cryptoPayment.paymentId }
            : cryptoPayment.invoiceId
            ? { invoiceId: cryptoPayment.invoiceId }
            : { id: cryptoPayment.id }
        
        await prisma.cryptoPayment.update({
            where: updateWhere,
            data: {
                paymentId: payment_id || cryptoPayment.paymentId, // Set paymentId if it was null
                paymentStatus: payment_status,
                payAmount: data.price_amount || cryptoPayment.payAmount,
                payCurrency: data.price_currency || cryptoPayment.payCurrency,
                actuallyPaid: data.actually_paid,
                actuallyPaidCurrency: data.pay_currency || data.actually_paid_currency,
                payAddress: data.pay_address || cryptoPayment.payAddress,
                purchaseId: data.purchase_id || cryptoPayment.purchaseId,
                updatedAt: new Date(),
                ...(payment_status === 'finished' && { paidAt: new Date() }),
            },
        })

        // Handle successful payment
        if (payment_status === 'finished') {
            // Get user's previous tier before updating (for email notification)
            const previousTier = cryptoPayment.user.tier

            // Calculate expiration date (30 days from now for subscription)
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 30) // 30-day subscription period

            // Update user tier
            await prisma.user.update({
                where: { id: cryptoPayment.userId },
                data: { tier: cryptoPayment.tier },
            })

            // Update crypto payment with expiration date
            await prisma.cryptoPayment.update({
                where: { id: cryptoPayment.id },
                data: { expiresAt },
            })

            logger.info(`User ${cryptoPayment.userId} upgraded to ${cryptoPayment.tier} via crypto payment`, {
                paymentId: payment_id,
                previousTier,
                newTier: cryptoPayment.tier,
                expiresAt,
            })

            // Send email notification
            const emailService = EmailService.getInstance()
            if (cryptoPayment.user.email && previousTier !== cryptoPayment.tier) {
                await emailService.sendTierUpgradeEmail({
                    email: cryptoPayment.user.email,
                    name: undefined,
                    newTier: cryptoPayment.tier,
                    previousTier: previousTier,
                }).catch((error) => {
                    logger.error('Failed to send tier upgrade email:', error)
                })
            }

            // Broadcast tier change via WebSocket
            if (io) {
                io.to(`user-${cryptoPayment.userId}`).emit('tier-changed', { tier: cryptoPayment.tier })
                logger.info(`Broadcasted tier change to user ${cryptoPayment.userId}`)
            }
        }

        logger.info(`NowPayments webhook event processed successfully: ${payment_status}`)

        return c.json({ received: true })
    } catch (error) {
        logger.error('NowPayments webhook error:', error)
        return c.json({ error: 'Webhook processing failed' }, 500)
    }
})

// Get payment status
payments.get('/nowpayments/status/:paymentId', async (c) => {
    try {
        const user = requireUser(c)
        const paymentId = c.req.param('paymentId')

        const cryptoPayment = await prisma.cryptoPayment.findFirst({
            where: {
                paymentId,
                userId: user.id,
            },
        })

        if (!cryptoPayment) {
            return c.json({ error: 'Payment not found' }, 404)
        }

        // Optionally refresh from NowPayments API
        const nowpayments = NowPaymentsService.getInstance()
        const paymentStatus = await nowpayments.getPaymentStatus(paymentId)

        // Update database
        await prisma.cryptoPayment.update({
            where: { id: cryptoPayment.id },
            data: {
                paymentStatus: paymentStatus.payment_status,
                actuallyPaid: paymentStatus.actually_paid,
                actuallyPaidCurrency: paymentStatus.pay_currency,
                updatedAt: new Date(),
                ...(paymentStatus.payment_status === 'finished' && { paidAt: new Date() }),
            },
        })

        return c.json({
            paymentId: cryptoPayment.paymentId,
            status: paymentStatus.payment_status,
            payAmount: cryptoPayment.payAmount,
            payCurrency: cryptoPayment.payCurrency,
            actuallyPaid: paymentStatus.actually_paid,
            actuallyPaidCurrency: paymentStatus.pay_currency,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Get payment status error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to get payment status' }, 500)
    }
})

export { payments as paymentRoutes }
