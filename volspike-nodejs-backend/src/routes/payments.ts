import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import type { Prisma } from '@prisma/client'
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
            } as any,
            orderBy: {
                expiresAt: 'desc', // Get most recent
            } as any,
        }) as any

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
type CryptoPaymentWithUser = Prisma.CryptoPaymentGetPayload<{
    include: {
        user: {
            select: {
                id: true
                email: true
                tier: true
                createdAt: true
            }
        }
    }
}>

async function notifyAdminPaymentIssue(type: string, details: Record<string, any>): Promise<void> {
    try {
        const emailService = EmailService.getInstance()
        await emailService.sendPaymentIssueAlertEmail({
            type,
            details,
        })
    } catch (error) {
        // Never let alert failures break the main payment flow
        logger.error('Failed to send payment issue alert email:', error)
    }
}

async function notifyAdminPaymentSuccess(type: string, details: Record<string, any>): Promise<void> {
    try {
        const emailService = EmailService.getInstance()
        await emailService.sendPaymentIssueAlertEmail({
            type,
            details,
        })
    } catch (error) {
        logger.error('Failed to send payment success alert email:', error)
    }
}

// NowPayments Crypto Payment Routes
// ============================================

function extractUserIdFromOrderId(orderId?: string | null): string | null {
    if (!orderId || !orderId.startsWith('volspike-')) {
        logger.warn('Invalid order ID format', { orderId })
        return null
    }

    // Order ID formats:
    // - Normal: volspike-{userId}-{timestamp}
    // - Test: volspike-test-{userId}-{timestamp}
    // We need to extract userId which is everything between 'volspike-' (or 'volspike-test-') and the last '-{timestamp}'
    const parts = orderId.split('-')
    if (parts.length < 3) {
        logger.warn('Order ID has insufficient parts', { orderId, partsCount: parts.length })
        return null
    }

    // Remove 'volspike' (first part), optionally 'test' (second part if present), and timestamp (last part)
    // Everything in between is the userId
    let startIndex = 1 // Skip 'volspike'
    if (parts.length > 3 && parts[1] === 'test') {
        startIndex = 2 // Skip 'volspike' and 'test'
    }

    const userIdParts = parts.slice(startIndex, -1) // Everything except first part(s) and last (timestamp)
    const userId = userIdParts.join('-')

    if (!userId) {
        logger.warn('Failed to extract userId from order ID', { orderId, parts, startIndex })
        return null
    }

    logger.debug('Extracted userId from order ID', { orderId, userId, isTest: parts[1] === 'test' })
    return userId
}

function inferTierFromWebhook(data: any): 'pro' | 'elite' {
    const description = (data?.order_description || '').toLowerCase()
    if (description.includes('elite')) {
        return 'elite'
    }
    if (description.includes('pro')) {
        return 'pro'
    }

    // Fall back to price amount if description missing
    const amount = Number(data?.price_amount)
    if (!Number.isNaN(amount) && amount >= 49) {
        return 'elite'
    }

    return 'pro'
}

async function createCryptoPaymentFallbackFromWebhook(data: any): Promise<CryptoPaymentWithUser | null> {
    const orderId = data?.order_id
    const paymentStatus = data?.payment_status
    const userId = extractUserIdFromOrderId(orderId)

    if (!orderId || !paymentStatus || !userId) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        logger.error('Fallback payment creation failed: user not found', {
            userId,
            orderId,
            paymentId: data?.payment_id,
        })
        return null
    }

    const tier = inferTierFromWebhook(data)
    const amount = Number(data?.price_amount) || null
    const payCurrency = ((data?.price_currency as string) || 'usd').toLowerCase()
    const invoiceId = data?.invoice_id ? String(data.invoice_id) : `fallback-${orderId || user.id}-${Date.now()}`

    try {
        const created = await prisma.cryptoPayment.create({
            data: {
                userId: user.id,
                paymentId: data?.payment_id || null,
                paymentStatus,
                payAmount: amount,
                payCurrency,
                actuallyPaid: data?.actually_paid ? Number(data.actually_paid) : null,
                actuallyPaidCurrency: data?.pay_currency || data?.actually_paid_currency || null,
                tier,
                invoiceId,
                orderId,
                paymentUrl: invoiceId ? `https://nowpayments.io/payment/?iid=${invoiceId}` : '',
                payAddress: data?.pay_address || null,
                purchaseId: data?.purchase_id ? String(data.purchase_id) : null,
                paidAt: paymentStatus === 'finished' ? new Date() : null,
            },
        })

        const payment = await prisma.cryptoPayment.findUnique({
            where: { id: created.id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                        createdAt: true,
                    },
                },
            },
        })

        if (!payment) {
            return null
        }

        logger.warn('Fallback crypto payment created from webhook payload', {
            paymentId: payment.id,
            userId: user.id,
            tier,
            paymentStatus,
        })

        return payment
    } catch (error) {
        logger.error('Failed to create fallback crypto payment from webhook', {
            error,
            orderId,
            userId,
            paymentId: data?.payment_id,
        })
        return null
    }
}

// Create NowPayments test checkout (for testing with custom amount)
// Only available for test users (email ends with -test@volspike.com or test@volspike.com)
payments.post('/nowpayments/test-checkout', async (c) => {
    try {
        logger.info('NowPayments TEST checkout request received', {
            method: c.req.method,
            url: c.req.url,
            hasAuth: !!c.req.header('authorization'),
        })

        const user = requireUser(c)

        // Only allow test users
        const isTestUser = user.email?.endsWith('-test@volspike.com') ||
            user.email === 'test@volspike.com' ||
            user.email?.includes('test@') ||
            process.env.NODE_ENV === 'development'

        if (!isTestUser) {
            logger.warn('Non-test user attempted to use test checkout', {
                email: user.email,
            })
            return c.json({ error: 'Test checkout is only available for test accounts' }, 403)
        }

        logger.info('Test user authenticated for NowPayments test checkout', {
            userId: user.id,
            email: user.email,
        })

        const body = await c.req.json()
        const { tier, successUrl, cancelUrl, payCurrency, testAmount } = z.object({
            tier: z.enum(['pro', 'elite']),
            successUrl: z.string().url(),
            cancelUrl: z.string().url(),
            payCurrency: z.string().optional(),
            testAmount: z.number().min(0.01).max(10).optional(), // Optional - will be calculated from minimum
        }).parse(body)

        // Fetch actual minimum amount from NowPayments API
        let priceAmount = testAmount
        const nowpayments = NowPaymentsService.getInstance()
        
        // If no test amount provided, fetch minimum for selected currency
        if (!priceAmount && payCurrency) {
            try {
                const minAmount = await nowpayments.getMinimumAmount('usd', payCurrency)
                if (minAmount) {
                    // Add 10% buffer to ensure we're above minimum
                    priceAmount = Math.ceil(minAmount * 1.1 * 100) / 100
                    logger.info('Calculated test amount from minimum', {
                        currency: payCurrency,
                        minAmount,
                        priceAmount,
                    })
                } else {
                    // Fallback to safe default if unable to fetch minimum
                    priceAmount = 2.0
                    logger.warn('Unable to fetch minimum amount, using fallback', {
                        currency: payCurrency,
                        fallbackAmount: priceAmount,
                    })
                }
            } catch (minAmountError) {
                logger.error('Error fetching minimum amount, using fallback', {
                    error: minAmountError,
                    currency: payCurrency,
                })
                priceAmount = 2.0 // Safe fallback
            }
        } else if (!priceAmount) {
            // No currency selected, use safe default
            priceAmount = 2.0
        }

        logger.info('Test checkout parameters', {
            tier,
            testAmount: priceAmount,
            payCurrency,
            userId: user.id,
        })

        // Generate unique order ID with TEST prefix
        const orderId = `volspike-test-${user.id}-${Date.now()}`

        // Check environment variables
        const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(':3000', ':3001') || 'http://localhost:3001'
        const ipnCallbackUrl = `${backendUrl}/api/payments/nowpayments/webhook`

        // Map currency code to NowPayments format and validate (same logic as regular checkout)
        let mappedPayCurrency: string | null = null

        if (payCurrency) {
            // Import currency mapper
            const { mapCurrencyToNowPayments, isSupportedCurrency } = await import('../services/currency-mapper')

            // Validate currency is supported in our system
            if (!isSupportedCurrency(payCurrency)) {
                logger.error('Unsupported currency code requested in test checkout', {
                    payCurrency,
                    supportedCurrencies: ['usdtsol', 'usdterc20', 'usdce', 'sol', 'btc', 'eth'],
                })
                throw new Error(`Unsupported currency: ${payCurrency}. Please select a supported currency.`)
            }

            // Map to NowPayments format
            // For invoice API, we need alphanumeric codes only (no underscores/dashes)
            // Use direct alphanumeric mapping (simpler and faster - no API call needed)
            try {
                // Our codes are already alphanumeric: usdtsol, usdterc20, usdce, sol, btc, eth
                // NowPayments invoice API accepts these directly
                mappedPayCurrency = payCurrency.toLowerCase()

                logger.info('Using alphanumeric currency code for invoice API', {
                    ourCode: payCurrency,
                    nowpaymentsCode: mappedPayCurrency,
                })
            } catch (currencyMappingError) {
                logger.error('Currency mapping error, using direct fallback', {
                    error: currencyMappingError instanceof Error ? currencyMappingError.message : String(currencyMappingError),
                    payCurrency,
                })
                // Fallback: use alphanumeric version of our code
                mappedPayCurrency = payCurrency.toLowerCase()
            }
        }

        // Use mapped currency or default to USDT on Solana (alphanumeric format for invoice API)
        // This ensures we only show supported currencies, not all 300+ NowPayments currencies
        const finalPayCurrency: string = mappedPayCurrency || 'usdtsol'

        logger.info('Test checkout currency determined', {
            originalPayCurrency: payCurrency,
            finalPayCurrency,
            wasMapped: !!mappedPayCurrency,
        })

        // Create invoice with NowPayments (hosted checkout flow)
        const invoice = await nowpayments.createInvoice({
            price_amount: priceAmount,
            price_currency: 'usd',
            pay_currency: finalPayCurrency, // Use validated/mapped currency code (alphanumeric only for invoice API)
            order_id: orderId,
            order_description: `VolSpike ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription (TEST - $${priceAmount})`,
            ipn_callback_url: ipnCallbackUrl,
            success_url: successUrl,
            cancel_url: cancelUrl,
        })

        const invoiceId = invoice.invoice_id || invoice.id
        const invoiceUrl = invoice.invoice_url

        if (!invoiceUrl) {
            logger.error('NowPayments test invoice created but no invoice_url returned', {
                invoiceId,
                invoiceResponse: invoice,
            })
            throw new Error('NowPayments API did not return invoice_url')
        }

        // Store invoice in database with TEST flag
        try {
            const cryptoPayment = await prisma.cryptoPayment.create({
                data: {
                    userId: user.id,
                    paymentStatus: 'waiting',
                    tier: tier,
                    invoiceId: String(invoiceId),
                    orderId: orderId,
                    paymentUrl: invoiceUrl,
                    payAmount: priceAmount, // Store test amount
                    payCurrency: 'usd',
                },
            })

            logger.info('TEST crypto payment record created in database', {
                paymentId: cryptoPayment.id,
                invoiceId,
                orderId,
                userId: user.id,
                testAmount: priceAmount,
            })
        } catch (dbError) {
            logger.error('Failed to create TEST crypto payment record', {
                error: dbError,
                invoiceId,
                orderId,
            })
            throw dbError
        }

        return c.json({
            paymentId: null, // Will be set by webhook
            invoiceId: String(invoiceId),
            paymentUrl: invoiceUrl,
            payAddress: null, // Will be set by webhook
            payAmount: null, // Will be set by webhook
            payCurrency: payCurrency || null,
            priceAmount: priceAmount,
            priceCurrency: 'usd',
            isTestPayment: true,
            testAmount: priceAmount,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Create TEST checkout error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: `Failed to create test checkout: ${message}` }, 500)
    }
})

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
        const finalPayCurrency: string = mappedPayCurrency || 'usdt_sol'

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
                errorMessage.includes('Unknown column') || (errorMessage.includes('column') && errorMessage.includes('does not exist')) ||
                errorMessage.includes('relation') && errorMessage.includes('does not exist')) {

                // Log the error but don't fail - the migration will be applied on next deployment
                logger.warn('Database schema mismatch detected - migration may be in progress', {
                    error: errorMessage,
                    invoiceId,
                    orderId,
                    fullError: dbError,
                    suggestion: 'Migration will be applied automatically on next deployment',
                })

                // Try to create payment without optional fields by using raw SQL as fallback
                // This is a temporary workaround until migration completes
                try {
                    // First, check if table exists and what columns it has
                    const tableInfo = await prisma.$queryRaw<Array<{ column_name: string, data_type: string }>>`
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = 'crypto_payments'
                        ORDER BY ordinal_position
                    `.catch(() => [])

                    logger.info('Checking crypto_payments table schema', {
                        columnsFound: tableInfo.length,
                        columns: tableInfo.map(c => c.column_name),
                    })

                    if (tableInfo.length === 0) {
                        throw new Error('Table crypto_payments does not exist - migration required')
                    }

                    // Check which columns exist
                    const hasExpiresAt = tableInfo.some(c => c.column_name === 'expiresAt')
                    const hasRenewalReminderSent = tableInfo.some(c => c.column_name === 'renewalReminderSent')
                    const hasInvoiceId = tableInfo.some(c => c.column_name === 'invoiceId')
                    const hasUserId = tableInfo.some(c => c.column_name === 'userId')
                    const hasOrderId = tableInfo.some(c => c.column_name === 'orderId')
                    const hasPaymentUrl = tableInfo.some(c => c.column_name === 'paymentUrl')
                    const hasTier = tableInfo.some(c => c.column_name === 'tier')
                    const hasPaymentStatus = tableInfo.some(c => c.column_name === 'paymentStatus')

                    if (!hasInvoiceId || !hasUserId || !hasOrderId || !hasPaymentUrl || !hasTier) {
                        throw new Error(`Required columns missing: invoiceId=${hasInvoiceId}, userId=${hasUserId}, orderId=${hasOrderId}, paymentUrl=${hasPaymentUrl}, tier=${hasTier}`)
                    }

                    // Generate a unique ID (using cuid-like format)
                    const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

                    // Check if invoiceId has unique constraint for ON CONFLICT
                    const constraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
                        SELECT constraint_name
                        FROM information_schema.table_constraints
                        WHERE table_name = 'crypto_payments' 
                        AND constraint_type = 'UNIQUE'
                    `.catch(() => [])

                    const hasInvoiceIdUnique = constraints.some(c =>
                        c.constraint_name.includes('invoiceId') || c.constraint_name.includes('invoice')
                    )

                    logger.info('Attempting raw SQL insert', {
                        paymentId,
                        invoiceId,
                        orderId,
                        hasInvoiceIdUnique,
                        constraints: constraints.map(c => c.constraint_name),
                    })

                    // Use Prisma's parameterized query for safety
                    // Insert only required fields that we know exist
                    if (hasInvoiceIdUnique) {
                        // Try insert with ON CONFLICT
                        await prisma.$executeRaw`
                            INSERT INTO crypto_payments (
                                id, "userId", "paymentStatus", tier, "invoiceId", "orderId", "paymentUrl", "createdAt", "updatedAt"
                            ) VALUES (
                                ${paymentId}, ${user.id}, 'waiting', ${tier}, ${String(invoiceId)}, ${orderId}, ${invoiceUrl}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            ON CONFLICT ("invoiceId") DO NOTHING
                        `
                    } else {
                        // Insert without ON CONFLICT (no unique constraint yet)
                        await prisma.$executeRaw`
                            INSERT INTO crypto_payments (
                                id, "userId", "paymentStatus", tier, "invoiceId", "orderId", "paymentUrl", "createdAt", "updatedAt"
                            ) VALUES (
                                ${paymentId}, ${user.id}, 'waiting', ${tier}, ${String(invoiceId)}, ${orderId}, ${invoiceUrl}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                        `
                    }

                    // Fetch the created payment
                    const createdPayment = await prisma.cryptoPayment.findUnique({
                        where: { invoiceId: String(invoiceId) },
                    })

                    if (createdPayment) {
                        logger.info('Payment created successfully using raw SQL fallback', {
                            invoiceId,
                            orderId,
                            paymentId: createdPayment.id,
                            method: 'raw_sql_fallback',
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
                    } else {
                        throw new Error('Payment record not found after insert - possible conflict or constraint issue')
                    }
                } catch (rawSqlError) {
                    const rawErrorMsg = rawSqlError instanceof Error ? rawSqlError.message : String(rawSqlError)
                    const rawErrorStack = rawSqlError instanceof Error ? rawSqlError.stack : undefined

                    logger.error('Raw SQL fallback failed - FULL DETAILS', {
                        error: rawErrorMsg,
                        stack: rawErrorStack,
                        invoiceId,
                        orderId,
                        userId: user.id,
                        tier,
                        rawError: rawSqlError,
                    })

                    // If fallback also fails, throw user-friendly error
                    throw new Error('Database migration in progress. Please try again in a few moments.')
                }
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
        let cryptoPayment: CryptoPaymentWithUser | null = null
        let lookupMethod = 'none'

        if (payment_id) {
            cryptoPayment = await prisma.cryptoPayment.findUnique({
                where: { paymentId: payment_id },
                include: { user: true },
            })
            if (cryptoPayment) {
                lookupMethod = 'payment_id'
                logger.info('Payment found by payment_id', { payment_id, paymentId: cryptoPayment.id })
            }
        }

        if (!cryptoPayment && invoice_id) {
            const found = await prisma.cryptoPayment.findUnique({
                where: { invoiceId: String(invoice_id) },
                include: { user: true },
            })
            if (found) {
                cryptoPayment = found
                lookupMethod = 'invoice_id'
                logger.info('Payment found by invoice_id', { invoice_id, paymentId: cryptoPayment.id })
            }
        }

        if (!cryptoPayment && order_id) {
            // Try exact match first
            cryptoPayment = await prisma.cryptoPayment.findFirst({
                where: { orderId: order_id },
                include: { user: true },
            })
            if (cryptoPayment) {
                lookupMethod = 'order_id_exact'
                logger.info('Payment found by order_id (exact match)', { order_id, paymentId: cryptoPayment.id })
            } else {
                // Try partial match (in case of order ID format differences)
                // Extract timestamp from order_id and search for payments with same timestamp
                const orderIdParts = order_id.split('-')
                if (orderIdParts.length >= 3) {
                    const timestamp = orderIdParts[orderIdParts.length - 1]
                    const userId = extractUserIdFromOrderId(order_id)

                    if (userId) {
                        // Search for payments with same user and similar timestamp
                        const allUserPayments = await prisma.cryptoPayment.findMany({
                            where: { userId },
                            include: { user: true },
                            orderBy: { createdAt: 'desc' },
                            take: 10, // Check recent payments
                        })

                        // Find payment with matching timestamp in order ID
                        const matchingPayment = allUserPayments.find(p => {
                            if (!p.orderId) return false
                            const paymentTimestamp = p.orderId.split('-').pop()
                            return paymentTimestamp === timestamp
                        })

                        if (matchingPayment) {
                            cryptoPayment = matchingPayment as CryptoPaymentWithUser
                            lookupMethod = 'order_id_partial'
                            logger.warn('Payment found by order_id (partial match - timestamp)', {
                                webhookOrderId: order_id,
                                dbOrderId: matchingPayment.orderId,
                                paymentId: cryptoPayment.id,
                            })
                        }
                    }
                }
            }
        }

        // If still not found, try fallback creation
        if (!cryptoPayment) {
            logger.warn('Payment not found by any method, attempting fallback creation', {
                payment_id,
                invoice_id,
                order_id,
                payment_status,
            })
            cryptoPayment = await createCryptoPaymentFallbackFromWebhook(data)
            if (cryptoPayment) {
                lookupMethod = 'fallback_created'
                logger.info('Payment created via fallback', { paymentId: cryptoPayment.id })
            }
        }

        if (!cryptoPayment) {
            logger.error(`Crypto payment not found in database - WEBHOOK FAILED`, {
                paymentId: payment_id,
                invoiceId: invoice_id,
                orderId: order_id,
                webhookData: JSON.stringify(data, null, 2),
                headers: {
                    signature: signature,
                    userAgent: c.req.header('user-agent'),
                    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                },
            })
            // Log full webhook payload for debugging
            logger.error('Full webhook payload:', {
                body: body,
                parsed: data,
            })

            await notifyAdminPaymentIssue('CRYPTO_PAYMENT_NOT_FOUND', {
                paymentId: payment_id,
                invoiceId: invoice_id,
                orderId: order_id,
                paymentStatus: payment_status,
                webhookPayload: data,
            })

            return c.json({ error: 'Payment not found' }, 404)
        }

        // Ensure we have the user relation on the payment
        const paymentWithUser = await prisma.cryptoPayment.findUnique({
            where: { id: cryptoPayment.id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                        createdAt: true,
                    },
                },
            },
        })

        if (!paymentWithUser) {
            logger.error('Failed to load payment with user after fallback', {
                paymentId: cryptoPayment.id,
            })
            return c.json({ error: 'Payment not found' }, 404)
        }

        cryptoPayment = paymentWithUser

        if (!cryptoPayment) {
            logger.error('Payment reference lost after reload', {
                paymentId: payment_id,
                invoiceId: invoice_id,
                orderId: order_id,
            })
            return c.json({ error: 'Payment not found' }, 404)
        }

        // Update payment status (unless it's finished - that will be handled in the transaction below)
        if (payment_status !== 'finished') {
            const updateWhere = cryptoPayment.paymentId
                ? { paymentId: cryptoPayment.paymentId }
                : cryptoPayment.invoiceId
                    ? { invoiceId: cryptoPayment.invoiceId }
                    : { id: cryptoPayment.id }

            await prisma.cryptoPayment.update({
                where: updateWhere,
                data: {
                    paymentId: payment_id || cryptoPayment.paymentId,
                    paymentStatus: payment_status,
                    payAmount: data.price_amount || cryptoPayment.payAmount,
                    payCurrency: data.price_currency || cryptoPayment.payCurrency,
                    actuallyPaid: data.actually_paid,
                    actuallyPaidCurrency: data.pay_currency || data.actually_paid_currency,
                    payAddress: data.pay_address || cryptoPayment.payAddress,
                    purchaseId: data.purchase_id || cryptoPayment.purchaseId,
                    updatedAt: new Date(),
                },
            })
        }

        // Handle successful payment
        if (payment_status === 'finished') {
            try {
                // Get user's previous tier before updating (for email notification)
                const previousTier = cryptoPayment.user.tier

                // Calculate expiration date (30 days from now for subscription)
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 30) // 30-day subscription period

                // Use a transaction to ensure atomicity
                await prisma.$transaction(async (tx) => {
                    // Update user tier FIRST (most important)
                    await tx.user.update({
                        where: { id: cryptoPayment.userId },
                        data: { tier: cryptoPayment.tier },
                    })

                    // Update crypto payment with expiration date and payment details
                    await tx.cryptoPayment.update({
                        where: { id: cryptoPayment.id },
                        data: {
                            expiresAt,
                            paymentId: payment_id || cryptoPayment.paymentId,
                            paymentStatus: 'finished',
                            payAmount: data.price_amount || cryptoPayment.payAmount,
                            payCurrency: data.price_currency || cryptoPayment.payCurrency,
                            actuallyPaid: data.actually_paid ? Number(data.actually_paid) : cryptoPayment.actuallyPaid,
                            actuallyPaidCurrency: data.pay_currency || data.actually_paid_currency || cryptoPayment.actuallyPaidCurrency,
                            payAddress: data.pay_address || cryptoPayment.payAddress,
                            purchaseId: data.purchase_id || cryptoPayment.purchaseId,
                            paidAt: new Date(),
                        } as any,
                    })
                })

                logger.info(`✅ User ${cryptoPayment.userId} upgraded to ${cryptoPayment.tier} via crypto payment`, {
                    paymentId: payment_id,
                    previousTier,
                    newTier: cryptoPayment.tier,
                    expiresAt,
                    lookupMethod,
                    orderId: order_id,
                })

                // Send email notification (non-blocking)
                const emailService = EmailService.getInstance()
                if (cryptoPayment.user.email && previousTier !== cryptoPayment.tier) {
                    emailService.sendTierUpgradeEmail({
                        email: cryptoPayment.user.email,
                        name: undefined,
                        newTier: cryptoPayment.tier,
                        previousTier: previousTier,
                    }).catch((error) => {
                        logger.error('Failed to send tier upgrade email (non-critical):', error)
                    })
                }

                // Broadcast tier change via WebSocket (non-blocking)
                if (io) {
                    try {
                        io.to(`user-${cryptoPayment.userId}`).emit('tier-changed', { tier: cryptoPayment.tier })
                        logger.info(`Broadcasted tier change to user ${cryptoPayment.userId}`)
                    } catch (wsError) {
                        logger.error('Failed to broadcast tier change (non-critical):', wsError)
                    }
                }

                // Notify admin (non-blocking)
                notifyAdminPaymentSuccess('CRYPTO_PAYMENT_FINISHED', {
                    paymentId: payment_id || cryptoPayment.paymentId,
                    invoiceId: invoice_id || cryptoPayment.invoiceId,
                    orderId: order_id || cryptoPayment.orderId,
                    tier: cryptoPayment.tier,
                    userId: cryptoPayment.userId,
                    userEmail: cryptoPayment.user.email,
                    amountUsd: cryptoPayment.payAmount,
                    payCurrency: cryptoPayment.payCurrency,
                    actuallyPaid: cryptoPayment.actuallyPaid,
                    actuallyPaidCurrency: cryptoPayment.actuallyPaidCurrency,
                    expiresAt,
                    lookupMethod,
                }).catch((error) => {
                    logger.error('Failed to notify admin (non-critical):', error)
                })
            } catch (upgradeError) {
                // CRITICAL: Log error but don't fail the webhook
                // The payment was received, we MUST upgrade the user
                logger.error('CRITICAL ERROR during user upgrade - attempting recovery', {
                    error: upgradeError instanceof Error ? {
                        name: upgradeError.name,
                        message: upgradeError.message,
                        stack: upgradeError.stack,
                    } : String(upgradeError),
                    userId: cryptoPayment.userId,
                    tier: cryptoPayment.tier,
                    paymentId: payment_id,
                })

                // Attempt recovery: try to upgrade user directly
                try {
                    await prisma.user.update({
                        where: { id: cryptoPayment.userId },
                        data: { tier: cryptoPayment.tier },
                    })
                    logger.info('✅ Recovery successful: User tier updated directly')
                } catch (recoveryError) {
                    logger.error('CRITICAL: Recovery failed - user upgrade may be incomplete', {
                        error: recoveryError,
                        userId: cryptoPayment.userId,
                    })
                    // Still return success to NowPayments, but notify admin
                    await notifyAdminPaymentIssue('CRYPTO_PAYMENT_UPGRADE_FAILED', {
                        userId: cryptoPayment.userId,
                        userEmail: cryptoPayment.user.email,
                        tier: cryptoPayment.tier,
                        paymentId: payment_id,
                        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
                    })
                }
            }
        }

        logger.info(`NowPayments webhook event processed successfully: ${payment_status}`)

        return c.json({ received: true })
    } catch (error) {
        logger.error('NowPayments webhook error:', error)
        await notifyAdminPaymentIssue('NOWPAYMENTS_WEBHOOK_ERROR', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : String(error),
        })
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

// List recent crypto payments for the authenticated user
payments.get('/nowpayments/history', async (c) => {
    try {
        const user = requireUser(c)

        const paymentsList = await prisma.cryptoPayment.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })

        const mapped = paymentsList.map((p) => ({
            id: p.id,
            paymentId: p.paymentId,
            invoiceId: p.invoiceId,
            orderId: p.orderId,
            status: p.paymentStatus,
            tier: p.tier,
            payAmount: p.payAmount,
            payCurrency: p.payCurrency,
            actuallyPaid: p.actuallyPaid,
            actuallyPaidCurrency: p.actuallyPaidCurrency,
            createdAt: p.createdAt?.toISOString?.() ?? null,
            paidAt: p.paidAt?.toISOString?.() ?? null,
            expiresAt: (p as any).expiresAt ? (p as any).expiresAt.toISOString?.() ?? null : null,
        }))

        logger.info(`Crypto payment history requested by ${user?.email}`, {
            count: mapped.length,
        })

        return c.json({ payments: mapped })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Get crypto payment history error:', message)
        if (message.includes('User not authenticated') || message.includes('Authorization')) {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        return c.json({ error: 'Failed to fetch payment history' }, 500)
    }
})

export { payments as paymentRoutes }
