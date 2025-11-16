import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { Role, UserStatus } from '@prisma/client'
import type { AppBindings, AppVariables } from '../../types/hono'
import { UserManagementService } from '../../services/admin/user-management'

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
    status: z.union([
        z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
        z.literal('all'),
        z.literal(''),
    ]).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'email', 'lastLoginAt', 'tier', 'role', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const createUserSchema = z.object({
    email: z.string().email(),
    tier: z.enum(['free', 'pro', 'elite']).default('free'),
    role: z.enum(['USER', 'ADMIN']).default('USER'),
    sendInvite: z.boolean().default(true),
    temporaryPassword: z.string().min(12).optional(),
})

const updateUserSchema = z.object({
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    notes: z.string().optional(),
    emailVerified: z.union([z.boolean(), z.string().datetime()]).optional(),
})

// POST /api/admin/users - Create new user
adminUserRoutes.post('/', async (c) => {
    try {
        const adminUser = c.get('adminUser')
        if (!adminUser) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = await c.req.json()
        logger.info('Create user request received (RAW)', {
            email: body.email,
            tier: body.tier,
            role: body.role,
            sendInvite: body.sendInvite,
            sendInviteType: typeof body.sendInvite,
            adminEmail: adminUser.email,
            fullBody: body,
        })

        const data = createUserSchema.parse(body)
        
        logger.info('Create user request parsed', {
            email: data.email,
            tier: data.tier,
            role: data.role,
            sendInvite: data.sendInvite,
            sendInviteType: typeof data.sendInvite,
            hasTemporaryPassword: !!data.temporaryPassword,
        })

        // Normalize email to lowercase
        const normalizedEmail = data.email.toLowerCase().trim()

        const result = await UserManagementService.createUser(
            {
                ...data,
                email: normalizedEmail,
            },
            adminUser.id
        )

        logger.info(`User created successfully: ${normalizedEmail}`, {
            userId: result.user.id,
            tier: result.user.tier,
            sendInvite: data.sendInvite,
            hasPassword: !!result.temporaryPassword,
            passwordLength: result.temporaryPassword?.length,
        })

        // Log password for debugging (only in development)
        if (result.temporaryPassword && process.env.NODE_ENV === 'development') {
            logger.debug('Temporary password generated', {
                password: result.temporaryPassword,
                email: normalizedEmail,
            })
        }

        return c.json({
            user: {
                id: result.user.id,
                email: result.user.email,
                tier: result.user.tier,
                role: result.user.role,
                status: result.user.status,
                emailVerified: result.user.emailVerified,
                createdAt: result.user.createdAt,
            },
            temporaryPassword: result.temporaryPassword,
        })
    } catch (error: any) {
        logger.error('Create user error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            issues: error?.issues,
        })

        // Handle validation errors
        if (error?.issues && Array.isArray(error.issues)) {
            const validationErrors = error.issues.map((issue: any) => ({
                path: issue.path?.join('.'),
                message: issue.message,
            }))
            return c.json({
                error: 'Validation failed',
                details: validationErrors,
            }, 400)
        }

        // Handle specific errors
        if (error?.message === 'User already exists') {
            return c.json({ error: 'User with this email already exists' }, 409)
        }

        return c.json({
            error: 'Failed to create user',
            message: error?.message || 'Unknown error occurred',
        }, 500)
    }
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
        
        // Handle status filter with comprehensive debugging
        // Get raw query param before Zod parsing to check for 'all' or ''
        const rawStatusParam = query.status as string | undefined
        const statusParam = params.status
        logger.info('User list request - status filter processing', {
            rawStatusParam,
            statusParam,
            statusParamType: typeof statusParam,
            hasStatusParam: statusParam !== undefined,
            queryParams: query,
        })
        
        // Check raw param first (before Zod parsing) to handle 'all' and ''
        if (rawStatusParam === 'all' || rawStatusParam === '') {
            // Explicit "All Status" request - show all users including BANNED
            // Don't filter by status
            logger.info('Status filter: Showing ALL users (including BANNED)')
        } else if (statusParam && (statusParam === 'ACTIVE' || statusParam === 'SUSPENDED' || statusParam === 'BANNED')) {
            // Specific status filter - show only that status
            where.status = statusParam as UserStatus
            logger.info('Status filter: Showing only', { status: statusParam })
        } else {
            // No status param at all - default behavior: exclude BANNED
            // This prevents deleted users from showing up in the list by default
            where.status = { not: UserStatus.BANNED }
            logger.info('Status filter: Default - excluding BANNED users')
        }
        
        logger.info('Final where clause for user query', {
            where,
            statusFilter: where.status,
        })

        // Optimize: Run count and findMany in parallel for better performance
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
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
        ])

        logger.info('User query results', {
            total,
            usersCount: users.length,
            statusFilter: where.status,
            hasUsers: users.length > 0,
            sampleUserStatuses: users.slice(0, 5).map(u => ({ id: u.id, email: u.email, status: u.status })),
        })

        // Transform users to include payment method and subscription expiration
        // Optimize: Batch Stripe API calls instead of individual calls per user
        const stripeCustomerIds = users
            .filter(u => u.stripeCustomerId)
            .map(u => u.stripeCustomerId!)
        
        // Batch fetch all Stripe subscriptions at once
        const stripeSubscriptionsMap = new Map<string, any>()
        if (stripeCustomerIds.length > 0) {
            try {
                // Fetch all subscriptions for all customers in parallel
                const subscriptionPromises = stripeCustomerIds.map(async (customerId) => {
                    try {
                        const subscriptions = await stripe.subscriptions.list({
                            customer: customerId,
                            status: 'active',
                            limit: 1,
                        })
                        return { customerId, subscription: subscriptions.data[0] || null }
                    } catch (error) {
                        logger.warn(`Error fetching Stripe subscription for customer ${customerId}:`, error)
                        return { customerId, subscription: null }
                    }
                })
                
                const subscriptionResults = await Promise.all(subscriptionPromises)
                subscriptionResults.forEach(({ customerId, subscription }) => {
                    if (subscription) {
                        stripeSubscriptionsMap.set(customerId, subscription)
                    }
                })
            } catch (error) {
                logger.warn('Error batch fetching Stripe subscriptions:', error)
            }
        }

        // Batch fetch crypto payment expirations for all users
        const userIds = users.map(u => u.id)
        const cryptoPaymentsMap = new Map<string, Date>()
        if (userIds.length > 0) {
            const activeCryptoPayments = await prisma.cryptoPayment.findMany({
                where: {
                    userId: { in: userIds },
                    paymentStatus: 'finished',
                    expiresAt: {
                        not: null,
                        gte: new Date(),
                    },
                } as any,
                select: {
                    userId: true,
                    expiresAt: true,
                },
                orderBy: {
                    expiresAt: 'desc',
                } as any,
            })
            
            // Group by userId, keeping only the most recent expiration
            activeCryptoPayments.forEach(payment => {
                if (payment.expiresAt) {
                    const existing = cryptoPaymentsMap.get(payment.userId)
                    if (!existing || payment.expiresAt > existing) {
                        cryptoPaymentsMap.set(payment.userId, payment.expiresAt)
                    }
                }
            })
        }

        // Batch fetch Stripe checkout sessions for users with Stripe customer IDs
        const stripeCheckoutSessionsMap = new Map<string, any>()
        if (stripeCustomerIds.length > 0) {
            try {
                const checkoutPromises = stripeCustomerIds.map(async (customerId) => {
                    try {
                        const sessions = await stripe.checkout.sessions.list({
                            customer: customerId,
                            limit: 10,
                        })
                        return { customerId, sessions: sessions.data }
                    } catch (error) {
                        logger.warn(`Error fetching checkout sessions for customer ${customerId}:`, error)
                        return { customerId, sessions: [] }
                    }
                })
                
                const checkoutResults = await Promise.all(checkoutPromises)
                checkoutResults.forEach(({ customerId, sessions }) => {
                    if (sessions.length > 0) {
                        stripeCheckoutSessionsMap.set(customerId, sessions)
                    }
                })
            } catch (error) {
                logger.warn('Error batch fetching checkout sessions:', error)
            }
        }

        const usersWithPaymentMethod = users.map((user) => {
            const hasCryptoPayment = user.cryptoPayments && user.cryptoPayments.length > 0
            const hasStripe = !!user.stripeCustomerId
            let paymentMethod: 'stripe' | 'crypto' | null = null
            let subscriptionExpiresAt: Date | null = null
            let subscriptionMethod: 'stripe' | 'crypto' | null = null
            
            // Get crypto subscription expiration (from batched fetch)
            const cryptoExpiration = cryptoPaymentsMap.get(user.id)
            if (cryptoExpiration) {
                subscriptionExpiresAt = cryptoExpiration
                subscriptionMethod = 'crypto'
            }
            
            // Get Stripe subscription expiration (from batched fetch)
            let hasActiveStripeSubscription = false
            if (hasStripe && user.stripeCustomerId) {
                const subscription = stripeSubscriptionsMap.get(user.stripeCustomerId)
                if (subscription) {
                    hasActiveStripeSubscription = true
                    const stripeExpiresAt = new Date(subscription.current_period_end * 1000)
                    
                    // Use Stripe expiration if it's later than crypto, or if no crypto expiration
                    if (!subscriptionExpiresAt || stripeExpiresAt > subscriptionExpiresAt) {
                        subscriptionExpiresAt = stripeExpiresAt
                        subscriptionMethod = 'stripe'
                    }
                } else {
                    // Check for completed checkout sessions (one-time payments)
                    const checkoutSessions = stripeCheckoutSessionsMap.get(user.stripeCustomerId)
                    if (checkoutSessions) {
                        const completedSession = checkoutSessions.find(
                            (session: any) => session.payment_status === 'paid' && session.status === 'complete'
                        )
                        
                        if (completedSession) {
                            hasActiveStripeSubscription = true
                        }
                    }
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
        })

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
        const softDelete = c.req.query('soft') === 'true' // Changed: now soft delete is opt-in
        const adminUser = c.get('adminUser')

        logger.info('Delete user request received', {
            userId,
            softDelete,
            adminEmail: adminUser?.email,
        })

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, status: true },
        })

        if (!user) {
            logger.warn('User not found for deletion', { userId })
            return c.json({ error: 'User not found' }, 404)
        }

        if (softDelete) {
            // Soft delete - mark as BANNED (opt-in)
            logger.info('Performing soft delete (marking as BANNED)', {
                userId,
                email: user.email,
            })
            await prisma.user.update({
                where: { id: userId },
                data: { status: UserStatus.BANNED },
            })
            logger.info(`User ${userId} soft deleted (BANNED) by admin ${adminUser?.email || 'unknown'}`)
        } else {
            // Hard delete - actually delete the user (default behavior)
            logger.info('Performing hard delete (permanent removal)', {
                userId,
                email: user.email,
            })
            
            // Delete related records first (if any)
            // Note: Prisma will handle cascading deletes if foreign keys are set up correctly
            await prisma.user.delete({
                where: { id: userId },
            })
            logger.info(`User ${userId} permanently deleted by admin ${adminUser?.email || 'unknown'}`)
        }

        return c.json({ 
            success: true,
            deleted: true,
            softDelete,
        })
    } catch (error: any) {
        logger.error('Delete user error:', {
            error,
            message: error?.message,
            stack: error?.stack,
            code: error?.code,
        })
        return c.json({ 
            error: 'Failed to delete user',
            message: error?.message || 'Unknown error occurred',
        }, 500)
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
