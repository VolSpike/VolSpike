import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma, io } from '../../index'
import { createLogger } from '../../lib/logger'
import { AuditService } from '../../services/admin/audit-service'
import { AuditAction, AuditTargetType } from '../../types/audit-consts'
import { EmailService } from '../../services/email'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
})

const adminSubscriptionRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const subscriptionListSchema = z.object({
    userId: z.string().optional(), // Search by user ID or email
    status: z.string().optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'updatedAt', 'email']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// GET /api/admin/subscriptions - List subscriptions
adminSubscriptionRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = subscriptionListSchema.parse(query)

        // Build where clause
        const where: any = {}

        // Search by user ID or email (partial match for email)
        if (params.userId) {
            const trimmedSearch = params.userId.trim()
            // Check if it looks like a user ID (cuid format) or email search
            if (trimmedSearch.includes('@') || trimmedSearch.length < 20) {
                // Treat as email search - use partial match
                where.email = { contains: trimmedSearch, mode: 'insensitive' }
            } else {
                // Treat as user ID - exact match
                where.id = trimmedSearch
            }
        }

        if (params.tier) {
            where.tier = params.tier
        }

        // Get users with Stripe customer IDs
        if (params.status) {
            where.stripeCustomerId = { not: null }
        }

        // Optimize: Run count and findMany in parallel for better performance
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    tier: true,
                    status: true,
                    stripeCustomerId: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { [params.sortBy]: params.sortOrder },
                skip: (params.page - 1) * params.limit,
                take: params.limit,
            })
        ])

        // Return subscription data with tier from user
        const subscriptions = users.map(user => {
            const billingStatus = user.stripeCustomerId ? 'active' : 'none'

            return {
                id: user.id,
                userId: user.id,
                userEmail: user.email || '',
                stripeCustomerId: user.stripeCustomerId || '',
                stripeSubscriptionId: null,
                stripePriceId: null,
                status: billingStatus,
                billingStatus,
                accountStatus: user.status || 'ACTIVE',
                tier: user.tier || 'free',
                currentPeriodStart: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            }
        })

        return c.json({
            subscriptions,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
        })
    } catch (error) {
        logger.error('List subscriptions error:', error)
        return c.json({ error: 'Failed to fetch subscriptions' }, 500)
    }
})

// GET /api/admin/subscriptions/:id - Get subscription details
adminSubscriptionRoutes.get('/:id', async (c) => {
    try {
        const subscriptionId = c.req.param('id')

        // For now, return mock data
        const user = await prisma.user.findFirst({
            where: { id: subscriptionId },
            select: {
                id: true,
                email: true,
                tier: true,
                stripeCustomerId: true,
            },
        })

        if (!user) {
            return c.json({ error: 'Subscription not found' }, 404)
        }

        return c.json({
            subscription: {
                id: user.id,
                userId: user.id,
                userEmail: user.email,
                stripeCustomerId: user.stripeCustomerId,
                status: 'active',
                tier: user.tier,
            },
            user,
        })
    } catch (error) {
        logger.error('Get subscription error:', error)
        return c.json({ error: 'Failed to fetch subscription' }, 500)
    }
})

// POST /api/admin/subscriptions/:userId/sync - Sync Stripe data
adminSubscriptionRoutes.post('/:userId/sync', async (c) => {
    try {
        const userId = c.req.param('userId')
        const body = await c.req.json().catch(() => ({}))
        const forceSync = body.forceSync === true

        const adminUser = c.get('adminUser')
        if (!adminUser) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                tier: true,
                stripeCustomerId: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const syncResult: any = {
            success: true,
            userId: user.id,
            userEmail: user.email,
            changes: [],
            errors: [],
            warnings: [],
        }

        // If user doesn't have a Stripe customer ID, there's nothing to sync
        if (!user.stripeCustomerId) {
            syncResult.warnings.push('User has no Stripe customer ID - nothing to sync')
            await AuditService.logUserAction(
                adminUser.id,
                AuditAction.SUBSCRIPTION_UPDATED,
                AuditTargetType.SUBSCRIPTION,
                userId,
                { tier: user.tier, stripeCustomerId: null },
                { tier: user.tier, stripeCustomerId: null },
                {
                    action: 'sync_stripe',
                    result: 'skipped',
                    reason: 'no_stripe_customer_id',
                }
            )
            return c.json(syncResult)
        }

        try {
            // Fetch customer from Stripe
            const customer = await stripe.customers.retrieve(user.stripeCustomerId)
            if (customer.deleted) {
                syncResult.errors.push('Stripe customer has been deleted')
                return c.json(syncResult, 400)
            }

            // Fetch active subscriptions for this customer
            const subscriptions = await stripe.subscriptions.list({
                customer: user.stripeCustomerId,
                status: 'all',
                limit: 100,
            })

            const oldValues = {
                tier: user.tier,
                stripeCustomerId: user.stripeCustomerId,
            }

            // Find the most recent active subscription
            const activeSubscription = subscriptions.data.find(
                sub => sub.status === 'active' || sub.status === 'trialing'
            ) || subscriptions.data[0] // Fallback to most recent

            let newTier = user.tier
            let subscriptionStatus = 'none'
            let nextBillingDate: Date | null = null
            let amount: number | null = null

            if (activeSubscription) {
                subscriptionStatus = activeSubscription.status
                const priceId = activeSubscription.items.data[0]?.price?.id

                if (priceId) {
                    try {
                        const price = await stripe.prices.retrieve(priceId)
                        newTier = price.metadata?.tier || 'pro'
                        amount = price.unit_amount ? price.unit_amount / 100 : null
                    } catch (error) {
                        logger.error(`Failed to retrieve price ${priceId}:`, error)
                        syncResult.warnings.push(`Could not retrieve price details for ${priceId}`)
                    }
                }

                // Calculate next billing date
                if (activeSubscription.current_period_end) {
                    nextBillingDate = new Date(activeSubscription.current_period_end * 1000)
                }
            } else {
                // No active subscription - user should be on free tier
                if (user.tier !== 'free') {
                    newTier = 'free'
                    syncResult.changes.push({
                        field: 'tier',
                        oldValue: user.tier,
                        newValue: 'free',
                        reason: 'No active Stripe subscription found',
                    })
                }
            }

            const newValues = {
                tier: newTier,
                stripeCustomerId: user.stripeCustomerId,
            }

            // Update user if tier changed or if force sync
            if (newTier !== user.tier || forceSync) {
                // If downgrading to free tier, delete all watchlists (no grandfathering)
                if (newTier === 'free' && user.tier !== 'free') {
                    const { WatchlistService } = await import('../../services/watchlist-service')
                    try {
                        const deletedCount = await WatchlistService.deleteAllWatchlists(userId)
                        if (deletedCount > 0) {
                            logger.info(`Deleted ${deletedCount} watchlists for user ${userId} due to admin tier change to free`)
                        }
                    } catch (watchlistError) {
                        logger.error(`Failed to delete watchlists for user ${userId}:`, watchlistError)
                        // Continue with tier update even if watchlist deletion fails
                    }
                }

                await prisma.user.update({
                    where: { id: userId },
                    data: { tier: newTier },
                })

                if (newTier !== user.tier) {
                    syncResult.changes.push({
                        field: 'tier',
                        oldValue: user.tier,
                        newValue: newTier,
                        reason: 'Synced from Stripe subscription',
                    })

                    // Broadcast tier change via WebSocket
                    if (io) {
                        io.to(`user-${userId}`).emit('tier-changed', { tier: newTier })
                    }

                    // Send email notification if tier changed
                    if (user.email) {
                        const emailService = EmailService.getInstance()
                        emailService.sendTierUpgradeEmail({
                            email: user.email,
                            name: undefined,
                            newTier: newTier,
                            previousTier: user.tier,
                        }).catch((error) => {
                            logger.error(`Failed to send tier upgrade email:`, error)
                        })
                    }
                }

                // Log audit entry
                await AuditService.logUserAction(
                    adminUser.id,
                    AuditAction.SUBSCRIPTION_UPDATED,
                    AuditTargetType.SUBSCRIPTION,
                    userId,
                    oldValues,
                    newValues,
                    {
                        action: 'sync_stripe',
                        subscriptionId: activeSubscription?.id,
                        subscriptionStatus,
                        nextBillingDate: nextBillingDate?.toISOString(),
                        amount,
                        changes: syncResult.changes,
                    }
                )
            } else {
                syncResult.changes.push({
                    field: 'tier',
                    oldValue: user.tier,
                    newValue: newTier,
                    reason: 'No changes needed - already in sync',
                })

                // Log sync action even if no changes
                await AuditService.logUserAction(
                    adminUser.id,
                    AuditAction.SUBSCRIPTION_UPDATED,
                    AuditTargetType.SUBSCRIPTION,
                    userId,
                    oldValues,
                    newValues,
                    {
                        action: 'sync_stripe',
                        subscriptionId: activeSubscription?.id,
                        subscriptionStatus,
                        nextBillingDate: nextBillingDate?.toISOString(),
                        amount,
                        result: 'no_changes',
                    }
                )
            }

            syncResult.subscription = {
                id: activeSubscription?.id,
                status: subscriptionStatus,
                tier: newTier,
                nextBillingDate: nextBillingDate?.toISOString(),
                amount,
            }

            logger.info(`Stripe sync completed for user ${userId}`, {
                userId,
                adminEmail: adminUser.email,
                changes: syncResult.changes.length,
                newTier,
            })

            return c.json(syncResult)
        } catch (stripeError: any) {
            logger.error('Stripe API error during sync:', stripeError)
            syncResult.errors.push(
                stripeError.message || 'Failed to fetch data from Stripe'
            )
            syncResult.success = false

            // Log failed sync attempt
            await AuditService.logUserAction(
                adminUser.id,
                AuditAction.SUBSCRIPTION_UPDATED,
                AuditTargetType.SUBSCRIPTION,
                userId,
                { tier: user.tier },
                { tier: user.tier },
                {
                    action: 'sync_stripe',
                    result: 'failed',
                    error: stripeError.message,
                }
            )

            return c.json(syncResult, 500)
        }
    } catch (error: any) {
        logger.error('Sync subscription error:', error)
        return c.json({ 
            success: false,
            error: error.message || 'Failed to sync subscription' 
        }, 500)
    }
})

// DELETE /api/admin/subscriptions/:userId/subscription - Cancel subscription
adminSubscriptionRoutes.delete('/:userId/subscription', async (c) => {
    try {
        const userId = c.req.param('userId')

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Update user to free tier
        await prisma.user.update({
            where: { id: userId },
            data: { tier: 'free' },
        })

        const adminUser = c.get('adminUser')
        logger.info(`Subscription cancelled for user ${userId} by admin ${adminUser?.email || 'unknown'}`)

        return c.json({
            success: true,
            message: 'Subscription cancelled successfully',
        })
    } catch (error) {
        logger.error('Cancel subscription error:', error)
        return c.json({ error: 'Failed to cancel subscription' }, 500)
    }
})

export { adminSubscriptionRoutes }
