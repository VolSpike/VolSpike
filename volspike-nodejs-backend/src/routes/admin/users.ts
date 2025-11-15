import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { Role, UserStatus } from '@prisma/client'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()
const adminUserRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const userListSchema = z.object({
    search: z.string().optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'email', 'lastLoginAt']).default('createdAt'),
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

        // Transform users to include payment method
        const usersWithPaymentMethod = users.map(user => {
            const hasCryptoPayment = user.cryptoPayments && user.cryptoPayments.length > 0
            const hasStripe = !!user.stripeCustomerId
            let paymentMethod: 'stripe' | 'crypto' | null = null
            
            if (hasCryptoPayment && hasStripe) {
                // If user has both, prioritize the most recent payment
                // For now, show crypto if they have a finished crypto payment
                paymentMethod = 'crypto'
            } else if (hasCryptoPayment) {
                paymentMethod = 'crypto'
            } else if (hasStripe) {
                paymentMethod = 'stripe'
            }

            return {
                ...user,
                paymentMethod,
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
    } catch (error) {
        logger.error('List users error:', error)
        return c.json({ error: 'Failed to fetch users' }, 500)
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

        // For now, just return success
        // Implement actual password reset logic later
        const adminUser = c.get('adminUser')
        logger.info(`Password reset requested for user ${userId} by admin ${adminUser?.email || 'unknown'}`)

        return c.json({
            success: true,
            message: 'Password reset email would be sent (not implemented yet)'
        })
    } catch (error) {
        logger.error('Reset password error:', error)
        return c.json({ error: 'Failed to reset password' }, 500)
    }
})

export { adminUserRoutes }
