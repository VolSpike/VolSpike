import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()
const adminPaymentRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const paymentListSchema = z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    paymentStatus: z.string().optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    paymentId: z.string().optional(),
    invoiceId: z.string().optional(),
    orderId: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'updatedAt', 'paidAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const manualUpgradeSchema = z.object({
    userId: z.string(),
    tier: z.enum(['pro', 'elite']),
    reason: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
})

// GET /api/admin/payments - List crypto payments
adminPaymentRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = paymentListSchema.parse(query)

        // Build where clause
        const where: any = {}

        if (params.userId) {
            where.userId = params.userId
        }

        if (params.email) {
            const user = await prisma.user.findFirst({
                where: { email: { equals: params.email, mode: 'insensitive' } },
                select: { id: true },
            })
            if (user) {
                where.userId = user.id
            } else {
                // Return empty if user not found
                return c.json({
                    payments: [],
                    pagination: {
                        total: 0,
                        page: params.page,
                        limit: params.limit,
                        pages: 0,
                    },
                })
            }
        }

        if (params.paymentStatus) {
            where.paymentStatus = params.paymentStatus
        }

        if (params.tier) {
            where.tier = params.tier
        }

        if (params.paymentId) {
            where.paymentId = params.paymentId
        }

        if (params.invoiceId) {
            where.invoiceId = params.invoiceId
        }

        if (params.orderId) {
            where.orderId = params.orderId
        }

        // Get total count
        const total = await prisma.cryptoPayment.count({ where })

        // Get paginated results
        const payments = await prisma.cryptoPayment.findMany({
            where,
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
            orderBy: { [params.sortBy]: params.sortOrder },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
        })

        return c.json({
            payments,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
        })
    } catch (error) {
        logger.error('List payments error:', error)
        return c.json({ error: 'Failed to fetch payments' }, 500)
    }
})

// GET /api/admin/payments/:id - Get payment details
adminPaymentRoutes.get('/:id', async (c) => {
    try {
        const paymentId = c.req.param('id')

        const payment = await prisma.cryptoPayment.findUnique({
            where: { id: paymentId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                        createdAt: true,
                        lastLoginAt: true,
                    },
                },
            },
        })

        if (!payment) {
            return c.json({ error: 'Payment not found' }, 404)
        }

        return c.json({ payment })
    } catch (error) {
        logger.error('Get payment error:', error)
        return c.json({ error: 'Failed to fetch payment' }, 500)
    }
})

// POST /api/admin/payments/manual-upgrade - Manually upgrade user tier
adminPaymentRoutes.post('/manual-upgrade', async (c) => {
    try {
        const adminUser = c.get('adminUser')
        const body = await c.req.json()
        const { userId, tier, reason, expiresAt } = manualUpgradeSchema.parse(body)

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                tier: true,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const previousTier = user.tier

        // Update user tier
        await prisma.user.update({
            where: { id: userId },
            data: { tier },
        })

        // Create audit log entry
        await prisma.auditLog.create({
            data: {
                actorUserId: adminUser.id,
                action: 'MANUAL_TIER_UPGRADE',
                targetType: 'USER',
                targetId: userId,
                oldValues: { tier: previousTier },
                newValues: { tier, reason: reason || 'Manual upgrade by admin' },
                metadata: {
                    adminEmail: adminUser.email,
                    userEmail: user.email,
                    expiresAt: expiresAt || null,
                },
            },
        })

        logger.info(`Manual tier upgrade: ${user.email} ${previousTier} → ${tier} by admin ${adminUser.email}`, {
            userId,
            previousTier,
            newTier: tier,
            reason,
            expiresAt,
        })

        return c.json({
            success: true,
            message: `User upgraded from ${previousTier} to ${tier}`,
            user: {
                id: user.id,
                email: user.email,
                tier,
            },
        })
    } catch (error) {
        logger.error('Manual upgrade error:', error)
        return c.json({ error: 'Failed to upgrade user' }, 500)
    }
})

// POST /api/admin/payments/:paymentId/retry-webhook - Retry webhook processing
adminPaymentRoutes.post('/:paymentId/retry-webhook', async (c) => {
    try {
        const paymentId = c.req.param('paymentId')
        const adminUser = c.get('adminUser')

        const payment = await prisma.cryptoPayment.findUnique({
            where: { id: paymentId },
            include: { user: true },
        })

        if (!payment) {
            return c.json({ error: 'Payment not found' }, 404)
        }

        // If payment is finished but user tier doesn't match, fix it
        if (payment.paymentStatus === 'finished' && payment.user.tier !== payment.tier) {
            const previousTier = payment.user.tier

            await prisma.user.update({
                where: { id: payment.userId },
                data: { tier: payment.tier },
            })

            // Create audit log
            await prisma.auditLog.create({
                data: {
                    actorUserId: adminUser.id,
                    action: 'TIER_SYNC_FIX',
                    targetType: 'USER',
                    targetId: payment.userId,
                    oldValues: { tier: previousTier },
                    newValues: { tier: payment.tier },
                    metadata: {
                        paymentId: payment.id,
                        reason: 'Webhook retry - tier mismatch fixed',
                    },
                },
            })

            logger.info(`Tier sync fixed: ${payment.user.email} ${previousTier} → ${payment.tier}`, {
                paymentId: payment.id,
                userId: payment.userId,
            })

            return c.json({
                success: true,
                message: `User tier synced: ${previousTier} → ${payment.tier}`,
                payment: {
                    ...payment,
                    user: {
                        ...payment.user,
                        tier: payment.tier,
                    },
                },
            })
        }

        return c.json({
            success: true,
            message: 'Payment status is correct',
            payment,
        })
    } catch (error) {
        logger.error('Retry webhook error:', error)
        return c.json({ error: 'Failed to retry webhook' }, 500)
    }
})

// POST /api/admin/payments/create-from-nowpayments - Create payment record from NOWPayments data
adminPaymentRoutes.post('/create-from-nowpayments', async (c) => {
    try {
        const adminUser = c.get('adminUser')
        const body = await c.req.json()
        const { userId, paymentId, orderId, invoiceId, amount, currency, tier, actuallyPaid, actuallyPaidCurrency } = z.object({
            userId: z.string(),
            paymentId: z.string().optional(),
            orderId: z.string(),
            invoiceId: z.string().optional(),
            amount: z.number(),
            currency: z.string().default('usd'),
            tier: z.enum(['pro', 'elite']),
            actuallyPaid: z.number().optional(),
            actuallyPaidCurrency: z.string().optional(),
        }).parse(body)

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                tier: true,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const previousTier = user.tier

        // Create payment record
        const payment = await prisma.cryptoPayment.create({
            data: {
                userId: userId,
                paymentId: paymentId || null,
                paymentStatus: 'finished',
                payAmount: amount,
                payCurrency: currency,
                actuallyPaid: actuallyPaid,
                actuallyPaidCurrency: actuallyPaidCurrency,
                tier: tier,
                invoiceId: invoiceId || `manual-${Date.now()}`,
                orderId: orderId,
                paymentUrl: paymentId ? `https://nowpayments.io/payment/?iid=${paymentId}` : '',
                paidAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
            include: { user: true },
        })

        // Upgrade user tier
        await prisma.user.update({
            where: { id: userId },
            data: { tier },
        })

        // Create audit log
        await prisma.auditLog.create({
            data: {
                actorUserId: adminUser.id,
                action: 'MANUAL_PAYMENT_CREATE',
                targetType: 'CRYPTO_PAYMENT',
                targetId: payment.id,
                oldValues: { tier: previousTier },
                newValues: { tier, paymentId, orderId },
                metadata: {
                    adminEmail: adminUser.email,
                    userEmail: user.email,
                    reason: 'Created from NOWPayments dashboard data',
                },
            },
        })

        logger.info(`Payment record created and user upgraded: ${user.email} ${previousTier} → ${tier}`, {
            paymentId: payment.id,
            orderId,
            adminEmail: adminUser.email,
        })

        return c.json({
            success: true,
            message: `Payment record created and user upgraded to ${tier}`,
            payment,
            user: {
                ...user,
                tier,
            },
        })
    } catch (error) {
        logger.error('Create payment from NOWPayments error:', error)
        return c.json({ error: 'Failed to create payment record' }, 500)
    }
})

export { adminPaymentRoutes }

