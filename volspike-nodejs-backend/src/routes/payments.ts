import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma, io } from '../index'
import { createLogger } from '../lib/logger'
import { User } from '../types'
import { getUser, requireUser } from '../lib/hono-extensions'
import { EmailService } from '../services/email'

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

        if (!user.stripeCustomerId) {
            return c.json({ subscription: null })
        }

        // Get customer's subscriptions
        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'active',
            limit: 1,
        })

        if (subscriptions.data.length === 0) {
            return c.json({ subscription: null })
        }

        const subscription = subscriptions.data[0]
        const price = await stripe.prices.retrieve(subscription.items.data[0].price.id)

        logger.info(`Subscription status requested by ${user?.email}`)

        return c.json({
            subscription: {
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
            },
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
                    select: { tier: true, email: true, name: true },
                })
                if (existingUser) {
                    previousTier = existingUser.tier
                    userEmail = existingUser.email || undefined
                    userName = existingUser.name || undefined
                }
            } else {
                // Fallback: get from customerId
                const existingUser = await prisma.user.findFirst({
                    where: { stripeCustomerId: customerId },
                    select: { tier: true, email: true, name: true },
                })
                if (existingUser) {
                    previousTier = existingUser.tier
                    userEmail = existingUser.email || undefined
                    userName = existingUser.name || undefined
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
                            name: userResult.name || undefined,
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
                    select: { id: true, email: true, name: true },
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
            select: { id: true, tier: true, email: true, name: true },
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
                select: { id: true, email: true, name: true, tier: true },
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
                        name: user.name || undefined,
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
        select: { id: true, tier: true, email: true, name: true },
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
                    select: { id: true, tier: true, email: true, name: true },
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
                        select: { id: true, email: true, name: true },
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
                                    name: updatedUser.name || undefined,
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
            select: { id: true, email: true, name: true },
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
                    name: user.name || undefined,
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

export { payments as paymentRoutes }
