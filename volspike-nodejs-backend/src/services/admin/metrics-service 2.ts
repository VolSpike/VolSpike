import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { SystemMetrics } from '../../types/admin'

const logger = createLogger()

export class MetricsService {
    // Get system metrics
    static async getSystemMetrics(period: string = '30d'): Promise<SystemMetrics> {
        try {
            const { start, end } = this.getPeriodDates(period)

            const [
                totalUsers,
                activeUsers,
                usersByTier,
                totalRevenue,
                recentSignups,
                failedLogins,
                adminSessions,
            ] = await Promise.all([
                prisma.user.count(),
                this.getActiveUsers(start),
                this.getUsersByTier(),
                this.getTotalRevenue(period),
                this.getRecentSignups(start),
                this.getFailedLogins(start),
                this.getAdminSessions(start),
            ])

            return {
                totalUsers,
                activeUsers,
                usersByTier,
                totalRevenue,
                recentSignups,
                failedLogins,
                adminSessions,
            }
        } catch (error) {
            logger.error('Get system metrics error:', error)
            throw error
        }
    }

    // Get user metrics
    static async getUserMetrics(period: string = '30d') {
        try {
            const { start, end } = this.getPeriodDates(period)

            const [
                totalUsers,
                newUsers,
                activeUsers,
                usersByTier,
                usersByStatus,
                userGrowth,
                topUsers,
            ] = await Promise.all([
                prisma.user.count(),
                this.getNewUsers(start),
                this.getActiveUsers(start),
                this.getUsersByTier(),
                this.getUsersByStatus(),
                this.getUserGrowth(period),
                this.getTopUsers(period),
            ])

            return {
                totalUsers,
                newUsers,
                activeUsers,
                usersByTier,
                usersByStatus,
                userGrowth,
                topUsers,
            }
        } catch (error) {
            logger.error('Get user metrics error:', error)
            throw error
        }
    }

    // Get revenue metrics
    static async getRevenueMetrics(period: string = '30d') {
        try {
            const [
                totalRevenue,
                monthlyRecurringRevenue,
                revenueByTier,
                revenueGrowth,
                topCustomers,
            ] = await Promise.all([
                this.getTotalRevenue(period),
                this.getMonthlyRecurringRevenue(),
                this.getRevenueByTier(),
                this.getRevenueGrowth(period),
                this.getTopCustomers(period),
            ])

            return {
                totalRevenue,
                monthlyRecurringRevenue,
                revenueByTier,
                revenueGrowth,
                topCustomers,
            }
        } catch (error) {
            logger.error('Get revenue metrics error:', error)
            throw error
        }
    }

    // Get activity metrics
    static async getActivityMetrics(period: string = '30d') {
        try {
            const { start, end } = this.getPeriodDates(period)

            const [
                totalLogins,
                failedLogins,
                adminActions,
                securityEvents,
                activityByDay,
                topActions,
            ] = await Promise.all([
                this.getTotalLogins(start),
                this.getFailedLogins(start),
                this.getAdminActions(start),
                this.getSecurityEvents(start),
                this.getActivityByDay(period),
                this.getTopActions(start),
            ])

            return {
                totalLogins,
                failedLogins,
                adminActions,
                securityEvents,
                activityByDay,
                topActions,
            }
        } catch (error) {
            logger.error('Get activity metrics error:', error)
            throw error
        }
    }

    // Get health metrics
    static async getHealthMetrics() {
        try {
            const [
                databaseStatus,
                apiResponseTime,
                errorRate,
                activeConnections,
                memoryUsage,
                diskUsage,
            ] = await Promise.all([
                this.checkDatabaseHealth(),
                this.getAPIResponseTime(),
                this.getErrorRate(),
                this.getActiveConnections(),
                this.getMemoryUsage(),
                this.getDiskUsage(),
            ])

            return {
                databaseStatus,
                apiResponseTime,
                errorRate,
                activeConnections,
                memoryUsage,
                diskUsage,
                timestamp: new Date().toISOString(),
            }
        } catch (error) {
            logger.error('Get health metrics error:', error)
            throw error
        }
    }

    // Helper methods
    private static getPeriodDates(period: string): { start: Date; end: Date } {
        const end = new Date()
        const start = new Date()

        switch (period) {
            case '7d':
                start.setDate(end.getDate() - 7)
                break
            case '30d':
                start.setDate(end.getDate() - 30)
                break
            case '90d':
                start.setDate(end.getDate() - 90)
                break
            case '1y':
                start.setFullYear(end.getFullYear() - 1)
                break
        }

        return { start, end }
    }

    private static async getActiveUsers(startDate: Date): Promise<number> {
        return await prisma.user.count({
            where: {
                lastLoginAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getUsersByTier(): Promise<Array<{ tier: string; count: number }>> {
        const result = await prisma.user.groupBy({
            by: ['tier'],
            _count: true,
        })

        return result.map(item => ({
            tier: item.tier,
            count: item._count,
        }))
    }

    private static async getUsersByStatus(): Promise<Array<{ status: string; count: number }>> {
        const result = await prisma.user.groupBy({
            by: ['status'],
            _count: true,
        })

        return result.map(item => ({
            status: item.status,
            count: item._count,
        }))
    }

    private static async getNewUsers(startDate: Date): Promise<number> {
        return await prisma.user.count({
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getRecentSignups(startDate: Date): Promise<number> {
        return await prisma.user.count({
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getTotalRevenue(period: string): Promise<number> {
        // This would need to be implemented with actual Stripe data
        // For now, return 0
        return 0
    }

    private static async getMonthlyRecurringRevenue(): Promise<number> {
        // This would need to be implemented with actual Stripe data
        return 0
    }

    private static async getRevenueByTier(): Promise<Record<string, number>> {
        // This would need to be implemented with actual Stripe data
        return {
            free: 0,
            pro: 0,
            elite: 0,
        }
    }

    private static async getRevenueGrowth(period: string): Promise<Array<{ date: string; revenue: number }>> {
        // This would need to be implemented with actual Stripe data
        return []
    }

    private static async getTopCustomers(period: string): Promise<Array<{ email: string; revenue: number }>> {
        // This would need to be implemented with actual Stripe data
        return []
    }

    private static async getFailedLogins(startDate: Date): Promise<number> {
        return await prisma.auditLog.count({
            where: {
                action: 'LOGIN_FAILURE',
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getTotalLogins(startDate: Date): Promise<number> {
        return await prisma.auditLog.count({
            where: {
                action: 'ADMIN_LOGIN',
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getAdminActions(startDate: Date): Promise<number> {
        return await prisma.auditLog.count({
            where: {
                action: {
                    in: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'SUBSCRIPTION_UPDATED'],
                },
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getSecurityEvents(startDate: Date): Promise<number> {
        return await prisma.auditLog.count({
            where: {
                action: 'SECURITY_EVENT',
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getAdminSessions(startDate: Date): Promise<number> {
        return await prisma.adminSession.count({
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
        })
    }

    private static async getUserGrowth(period: string): Promise<Array<{ date: string; count: number }>> {
        // This would need to be implemented with proper date grouping
        // For now, return empty array
        return []
    }

    private static async getTopUsers(period: string): Promise<Array<{ id: string; email: string; count: number }>> {
        const startDate = this.getStartDate(period)

        const result = await prisma.auditLog.groupBy({
            by: ['actorUserId'],
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
            _count: true,
            orderBy: {
                _count: {
                    actorUserId: 'desc',
                },
            },
            take: 10,
        })

        // Get user details for each actor
        const userIds = result.map(item => item.actorUserId)
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                email: true,
            },
        })

        return result.map(item => {
            const user = users.find(u => u.id === item.actorUserId)
            return {
                id: item.actorUserId,
                email: user?.email || 'Unknown',
                count: item._count,
            }
        })
    }

    private static async getActivityByDay(period: string): Promise<Array<{ date: string; count: number }>> {
        // This would need to be implemented with proper date grouping
        return []
    }

    private static async getTopActions(startDate: Date): Promise<Array<{ action: string; count: number }>> {
        const result = await prisma.auditLog.groupBy({
            by: ['action'],
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
            _count: true,
            orderBy: {
                _count: {
                    action: 'desc',
                },
            },
            take: 10,
        })

        return result.map(item => ({
            action: item.action,
            count: item._count,
        }))
    }

    private static async checkDatabaseHealth(): Promise<{ status: string; responseTime: number }> {
        const start = Date.now()

        try {
            await prisma.user.count()
            const responseTime = Date.now() - start

            return {
                status: 'healthy',
                responseTime,
            }
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - start,
            }
        }
    }

    private static getStartDate(period: string): Date {
        const now = new Date()
        switch (period) {
            case '24h':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000)
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            case '90d':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            default:
                return new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }
    }

    private static async getAPIResponseTime(): Promise<number> {
        // This would need to be implemented with actual API monitoring
        return 0
    }

    private static async getErrorRate(): Promise<number> {
        // This would need to be implemented with actual error tracking
        return 0
    }

    private static async getActiveConnections(): Promise<number> {
        // This would need to be implemented with actual connection monitoring
        return 0
    }

    private static async getMemoryUsage(): Promise<{ used: number; total: number; percentage: number }> {
        // This would need to be implemented with actual memory monitoring
        return {
            used: 0,
            total: 0,
            percentage: 0,
        }
    }

    private static async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
        // This would need to be implemented with actual disk monitoring
        return {
            used: 0,
            total: 0,
            percentage: 0,
        }
    }
}
