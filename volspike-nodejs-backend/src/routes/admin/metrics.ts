import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
})

const adminMetricsRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const metricsQuerySchema = z.object({
    period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional(),
})

// GET /api/admin/metrics - Get system metrics
adminMetricsRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = metricsQuerySchema.parse(query)
        const period = params.period || '30d'

        // Calculate date range
        const now = new Date()
        const startDate = new Date()

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7)
                break
            case '30d':
                startDate.setDate(now.getDate() - 30)
                break
            case '90d':
                startDate.setDate(now.getDate() - 90)
                break
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1)
                break
        }

        // Get metrics
        const [
            totalUsers,
            activeUsers,
            usersByTier,
            recentSignups,
            adminSessions,
            totalRevenue,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastLoginAt: {
                        gte: startDate,
                    },
                },
            }),
            prisma.user.groupBy({
                by: ['tier'],
                _count: true,
            }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
            }),
            prisma.adminSession.count({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
            }),
            calculateTotalRevenue(),
        ])

        return c.json({
            totalUsers,
            activeUsers,
            usersByTier: usersByTier.map(item => ({
                tier: item.tier,
                count: item._count,
            })),
            totalRevenue,
            recentSignups,
            failedLogins: 0, // Placeholder - implement with audit logs
            adminSessions,
        })
    } catch (error) {
        logger.error('Get system metrics error:', error)
        return c.json({ error: 'Failed to fetch system metrics' }, 500)
    }
})

// GET /api/admin/metrics/users - Get user metrics
adminMetricsRoutes.get('/users', async (c) => {
    try {
        const [
            totalUsers,
            usersByTier,
            usersByStatus,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.groupBy({
                by: ['tier'],
                _count: true,
            }),
            prisma.user.groupBy({
                by: ['status'],
                _count: true,
            }),
        ])

        return c.json({
            totalUsers,
            usersByTier: usersByTier.map(item => ({
                tier: item.tier,
                count: item._count,
            })),
            usersByStatus: usersByStatus.map(item => ({
                status: item.status,
                count: item._count,
            })),
        })
    } catch (error) {
        logger.error('Get user metrics error:', error)
        return c.json({ error: 'Failed to fetch user metrics' }, 500)
    }
})

// Helper function to calculate total revenue from all sources
async function calculateTotalRevenue(): Promise<number> {
    try {
        // Calculate revenue from crypto payments (finished payments only)
        const cryptoRevenueResult = await prisma.cryptoPayment.aggregate({
            where: {
                paymentStatus: 'finished',
                payAmount: { not: null },
            },
            _sum: {
                payAmount: true,
            },
        })

        const cryptoRevenue = cryptoRevenueResult._sum.payAmount || 0

        // Calculate revenue from Stripe (paid invoices)
        let stripeRevenue = 0
        try {
            // Get all paid invoices from Stripe
            const invoices = await stripe.invoices.list({
                status: 'paid',
                limit: 100, // Stripe pagination - adjust if needed
            })

            // Sum up all paid invoice amounts
            stripeRevenue = invoices.data.reduce((sum, invoice) => {
                // Convert from cents to dollars
                return sum + (invoice.amount_paid || 0) / 100
            }, 0)

            // Handle pagination if there are more than 100 invoices
            let hasMore = invoices.has_more
            let startingAfter = invoices.data[invoices.data.length - 1]?.id

            while (hasMore && startingAfter) {
                const moreInvoices = await stripe.invoices.list({
                    status: 'paid',
                    limit: 100,
                    starting_after: startingAfter,
                })

                stripeRevenue += moreInvoices.data.reduce((sum, invoice) => {
                    return sum + (invoice.amount_paid || 0) / 100
                }, 0)

                hasMore = moreInvoices.has_more
                startingAfter = moreInvoices.data[moreInvoices.data.length - 1]?.id
            }
        } catch (stripeError: any) {
            // If Stripe API fails, log but don't fail the entire request
            logger.warn('Failed to fetch Stripe revenue:', stripeError.message)
            stripeRevenue = 0
        }

        const totalRevenue = cryptoRevenue + stripeRevenue

        logger.info('Revenue calculated', {
            cryptoRevenue,
            stripeRevenue,
            totalRevenue,
        })

        return Math.round(totalRevenue * 100) / 100 // Round to 2 decimal places
    } catch (error) {
        logger.error('Calculate total revenue error:', error)
        return 0
    }
}

// GET /api/admin/metrics/revenue - Get revenue metrics
adminMetricsRoutes.get('/revenue', async (c) => {
    try {
        const totalRevenue = await calculateTotalRevenue()

        // Get revenue breakdown by tier from crypto payments
        const revenueByTier = await prisma.cryptoPayment.groupBy({
            by: ['tier'],
            where: {
                paymentStatus: 'finished',
                payAmount: { not: null },
            },
            _sum: {
                payAmount: true,
            },
        })

        // Calculate MRR from active Stripe subscriptions
        let monthlyRecurringRevenue = 0
        try {
            const subscriptions = await stripe.subscriptions.list({
                status: 'active',
                limit: 100,
            })

            monthlyRecurringRevenue = subscriptions.data.reduce((sum, sub) => {
                // Get the price amount (in cents) and convert to dollars
                const amount = sub.items.data[0]?.price?.unit_amount || 0
                return sum + amount / 100
            }, 0)

            // Handle pagination
            let hasMore = subscriptions.has_more
            let startingAfter = subscriptions.data[subscriptions.data.length - 1]?.id

            while (hasMore && startingAfter) {
                const moreSubs = await stripe.subscriptions.list({
                    status: 'active',
                    limit: 100,
                    starting_after: startingAfter,
                })

                monthlyRecurringRevenue += moreSubs.data.reduce((sum, sub) => {
                    const amount = sub.items.data[0]?.price?.unit_amount || 0
                    return sum + amount / 100
                }, 0)

                hasMore = moreSubs.has_more
                startingAfter = moreSubs.data[moreSubs.data.length - 1]?.id
            }
        } catch (stripeError: any) {
            logger.warn('Failed to fetch Stripe MRR:', stripeError.message)
        }

        return c.json({
            totalRevenue,
            monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
            revenueByTier: {
                free: 0,
                pro: revenueByTier.find(r => r.tier === 'pro')?._sum.payAmount || 0,
                elite: revenueByTier.find(r => r.tier === 'elite')?._sum.payAmount || 0,
            },
            revenueGrowth: [], // TODO: Implement time-series revenue data
            topCustomers: [], // TODO: Implement top customers list
        })
    } catch (error) {
        logger.error('Get revenue metrics error:', error)
        return c.json({ error: 'Failed to fetch revenue metrics' }, 500)
    }
})

// GET /api/admin/metrics/activity - Get activity metrics
adminMetricsRoutes.get('/activity', async (c) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))

        const [
            totalLogins,
            adminActions,
        ] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    action: 'ADMIN_LOGIN',
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            }),
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            }),
        ])

        return c.json({
            totalLogins,
            failedLogins: 0, // Placeholder
            adminActions,
            securityEvents: 0, // Placeholder
            activityByDay: [],
            topActions: [],
        })
    } catch (error) {
        logger.error('Get activity metrics error:', error)
        return c.json({ error: 'Failed to fetch activity metrics' }, 500)
    }
})

// GET /api/admin/metrics/health - Get system health
adminMetricsRoutes.get('/health', async (c) => {
    try {
        const start = Date.now()

        // Test database connection
        await prisma.user.count()
        const dbResponseTime = Date.now() - start

        return c.json({
            databaseStatus: {
                status: 'healthy',
                responseTime: dbResponseTime,
            },
            apiResponseTime: 0,
            errorRate: 0,
            activeConnections: 0,
            memoryUsage: {
                used: process.memoryUsage().heapUsed,
                total: process.memoryUsage().heapTotal,
                percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
            },
            diskUsage: {
                used: 0,
                total: 0,
                percentage: 0,
            },
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        logger.error('Get health metrics error:', error)
        return c.json({ error: 'Failed to fetch health metrics' }, 500)
    }
})

export { adminMetricsRoutes }
