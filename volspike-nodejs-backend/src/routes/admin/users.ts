import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { Role, UserStatus } from '@prisma/client'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
})
const adminUserRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const userListSchema = z.object({
    search: z.string().optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'email', 'lastLoginAt', 'tier', 'role', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const updateUserSchema = z.object({
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    notes: z.string().optional(),
    emailVerified: z.union([z.boolean(), z.string().datetime()]).optional(),
})

// GET /api/admin/users - List users
adminUserRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = userListSchema.parse(query)

        // Build where clause
        const where: any = {}

        if (params.search) {
            where.OR = [
                { email: { contains: params.search, mode: 'insensitive' } },
                { walletAddress: { contains: params.search, mode: 'insensitive' } },
            ]
        }

        if (params.role) where.role = params.role
        if (params.tier) where.tier = params.tier
        if (params.status) where.status = params.status

        // Get total count
        const total = await prisma.user.count({ where })

        // Get paginated results
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                walletAddress: true,
                tier: true,
                role: true,
                status: true,
                emailVerified: true,
                createdAt: true,
                lastLoginAt: true,
                stripeCustomerId: true,
                cryptoPayments: {
                    where: {
                        paymentStatus: 'finished',
                    },
                    select: {
                        id: true,
                        actuallyPaidCurrency: true,
                    },
                    take: 1,
                    orderBy: {
                        paidAt: 'desc',
                    },
                },
            },
            orderBy: { [params.sortBy]: params.sortOrder },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
        })

        // Transform users to include payment method and subscription expiration
        const usersWithPaymentMethod = await Promise.all(users.map(async (user) => {
            const hasCryptoPayment = user.cryptoPayments && user.cryptoPayments.length > 0
            const hasStripe = !!user.stripeCustomerId
            let paymentMethod: 'stripe' | 'crypto' | null = null
            let subscriptionExpiresAt: Date | null = null
            let subscriptionMethod: 'stripe' | 'crypto' | null = null
            
            // Get crypto subscription expiration (most recent active)
            if (hasCryptoPayment) {
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
                        expiresAt: 'desc',
                    } as any,
                    select: {
                        expiresAt: true,
                    },
                })
                
                if (activeCryptoPayment?.expiresAt) {
                    subscriptionExpiresAt = activeCryptoPayment.expiresAt
                    subscriptionMethod = 'crypto'
                }
            }
            
            // Get Stripe subscription expiration and check for actual payments
            let hasActiveStripeSubscription = false
            if (hasStripe && user.stripeCustomerId) {
                try {
                    const subscriptions = await stripe.subscriptions.list({
                        customer: user.stripeCustomerId,
                        status: 'all', // Check all statuses to see if they ever had a subscription
                        limit: 100,
                    })
                    
                    // Check for active or past_due subscriptions (user actually paid)
                    const activeSubscription = subscriptions.data.find(
                        sub => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
                    )
                    
                    if (activeSubscription) {
                        hasActiveStripeSubscription = true
                        const stripeExpiresAt = new Date(activeSubscription.current_period_end * 1000)
                        
                        // Use Stripe expiration if it's later than crypto, or if no crypto expiration
                        if (!subscriptionExpiresAt || stripeExpiresAt > subscriptionExpiresAt) {
                            subscriptionExpiresAt = stripeExpiresAt
                            subscriptionMethod = 'stripe'
                        }
                    } else {
                        // Check for completed checkout sessions (one-time payments)
                        const checkoutSessions = await stripe.checkout.sessions.list({
                            customer: user.stripeCustomerId,
                            limit: 10,
                        })
                        
                        const completedSession = checkoutSessions.data.find(
                            session => session.payment_status === 'paid' && session.status === 'complete'
                        )
                        
                        if (completedSession) {
                            hasActiveStripeSubscription = true
                        }
                    }
                } catch (error) {
                    logger.warn(`Error fetching Stripe subscription for user ${user.id}:`, error)
                }
            }
            
            // Only show payment method if user actually paid
            if (hasCryptoPayment && hasActiveStripeSubscription) {
                // If user has both, prioritize the most recent payment
                // For now, show crypto if they have a finished crypto payment
                paymentMethod = 'crypto'
            } else if (hasCryptoPayment) {
                paymentMethod = 'crypto'
            } else if (hasActiveStripeSubscription) {
                paymentMethod = 'stripe'
            }

            return {
                ...user,
                paymentMethod,
                subscriptionExpiresAt,
                subscriptionMethod,
                cryptoPayments: undefined, // Remove from response
            }
        }))

        return c.json({
            users: usersWithPaymentMethod,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
        })
    } catch (error: any) {
        logger.error('List users error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            issues: error?.issues, // Zod validation errors
        })
        
        // Return more detailed error information
        if (error?.issues && Array.isArray(error.issues)) {
            // Zod validation error
            const validationErrors = error.issues.map((issue: any) => ({
                path: issue.path?.join('.'),
                message: issue.message,
            }))
            logger.error('Validation errors:', validationErrors)
            return c.json({ 
                error: 'Invalid request parameters',
                details: validationErrors,
            }, 400)
        }
        
        return c.json({ 
            error: 'Failed to fetch users',
            message: error?.message || 'Unknown error',
        }, 500)
    }
})

// GET /api/admin/users/:id - Get user details
adminUserRoutes.get('/:id', async (c) => {
    try {
        const userId = c.req.param('id')

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                preferences: true,
                watchlists: {
                    include: {
                        items: {
                            include: {
                                contract: true,
                            },
                        },
                    },
                },
                alerts: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        return c.json({ user })
    } catch (error) {
        logger.error('Get user error:', error)
        return c.json({ error: 'Failed to fetch user' }, 500)
    }
})

// PATCH /api/admin/users/:id - Update user
adminUserRoutes.patch('/:id', async (c) => {
    try {
        const userId = c.req.param('id')
        const body = await c.req.json()
        const data = updateUserSchema.parse(body)

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...data,
                emailVerified: data.emailVerified === true ? new Date() :
                    data.emailVerified === false ? null :
                        data.emailVerified,
                updatedAt: new Date(),
            },
        })

        const adminUser = c.get('adminUser')
        logger.info(`User ${userId} updated by admin ${adminUser?.email || 'unknown'}`)

        return c.json({ user })
    } catch (error) {
        logger.error('Update user error:', error)
        return c.json({ error: 'Failed to update user' }, 500)
    }
})

// DELETE /api/admin/users/:id - Delete user
adminUserRoutes.delete('/:id', async (c) => {
    try {
        const userId = c.req.param('id')
        const hardDelete = c.req.query('hard') === 'true'

        if (hardDelete) {
            await prisma.user.delete({
                where: { id: userId },
            })
        } else {
            // Soft delete - mark as BANNED
            await prisma.user.update({
                where: { id: userId },
                data: { status: UserStatus.BANNED },
            })
        }

        const adminUser = c.get('adminUser')
        logger.info(`User ${userId} deleted by admin ${adminUser?.email || 'unknown'}`)

        return c.json({ success: true })
    } catch (error) {
        logger.error('Delete user error:', error)
        return c.json({ error: 'Failed to delete user' }, 500)
    }
})

// POST /api/admin/users/:id/suspend - Suspend user
adminUserRoutes.post('/:id/suspend', async (c) => {
    try {
        const userId = c.req.param('id')

        const user = await prisma.user.update({
            where: { id: userId },
            data: { status: UserStatus.SUSPENDED },
        })

        const adminUser = c.get('adminUser')
        logger.info(`User ${userId} suspended by admin ${adminUser?.email || 'unknown'}`)

        return c.json({ user })
    } catch (error) {
        logger.error('Suspend user error:', error)
        return c.json({ error: 'Failed to suspend user' }, 500)
    }
})

// POST /api/admin/users/:id/reset-password - Reset password
adminUserRoutes.post('/:id/reset-password', async (c) => {
    try {
        const userId = c.req.param('id')
        const adminUser = c.get('adminUser')

        // Get user details
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, passwordHash: true },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Check if user has a password (not OAuth-only)
        if (!user.passwordHash) {
            return c.json({
                error: 'This user does not have a password. They use OAuth (Google) login only.',
                oauthOnly: true
            }, 400)
        }

        // Generate password reset token
        const EmailService = (await import('../../services/email')).default
        const emailService = EmailService.getInstance()
        const token = emailService.generateVerificationToken()
        const identifier = `${user.email}|pwreset`

        // Delete any existing reset tokens for this user
        await prisma.verificationToken.deleteMany({ where: { identifier } })

        // Create new reset token (expires in 60 minutes)
        await prisma.verificationToken.create({
            data: {
                identifier,
                token,
                expires: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
                userId: user.id,
            },
        })

        // Generate reset URL
        const base = process.env.FRONTEND_URL || 'http://localhost:3000'
        const resetUrl = `${base}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`

        // Send password reset email
        const emailSent = await emailService.sendPasswordResetEmail({
            email: user.email,
            resetUrl,
        })

        if (!emailSent) {
            logger.error(`Failed to send password reset email to ${user.email}`)
            return c.json({ error: 'Failed to send password reset email' }, 500)
        }

        logger.info(`Password reset email sent to ${user.email} by admin ${adminUser?.email || 'unknown'}`)

        // Log audit event
        const { AuditService } = await import('../../services/admin/audit-service')
        await AuditService.logUserAction(
            adminUser?.id || '',
            'RESET_PASSWORD',
            'USER',
            userId,
            undefined, // oldValues
            undefined, // newValues
            {
                userEmail: user.email,
                emailSent: true,
            }
        )

        return c.json({
            success: true,
            message: 'Password reset email sent successfully',
            email: user.email,
        })
    } catch (error) {
        logger.error('Reset password error:', error)
        return c.json({ error: 'Failed to reset password' }, 500)
    }
})

export { adminUserRoutes }
