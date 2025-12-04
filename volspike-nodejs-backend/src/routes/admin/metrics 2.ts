import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'

const logger = createLogger()
const adminMetricsRoutes = new Hono()

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
        ])

        return c.json({
            totalUsers,
            activeUsers,
            usersByTier: usersByTier.map(item => ({
                tier: item.tier,
                count: item._count,
            })),
            totalRevenue: 0, // Placeholder - implement with Stripe
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

// GET /api/admin/metrics/revenue - Get revenue metrics
adminMetricsRoutes.get('/revenue', async (c) => {
    try {
        // Placeholder data - implement with actual Stripe integration
        return c.json({
            totalRevenue: 0,
            monthlyRecurringRevenue: 0,
            revenueByTier: {
                free: 0,
                pro: 0,
                elite: 0,
            },
            revenueGrowth: [],
            topCustomers: [],
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
