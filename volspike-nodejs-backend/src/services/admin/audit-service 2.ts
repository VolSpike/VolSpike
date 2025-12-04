import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { AuditAction, AuditTargetType } from '../../types/audit-consts'
import { CreateAuditLogData, AuditLogQuery } from '../../types/audit'

const logger = createLogger()

export class AuditService {
    // Create audit log entry
    static async createAuditLog(data: CreateAuditLogData) {
        try {
            const auditLog = await prisma.auditLog.create({
                data: {
                    actorUserId: data.actorUserId,
                    action: data.action,
                    targetType: data.targetType,
                    targetId: data.targetId,
                    oldValues: data.oldValues,
                    newValues: data.newValues,
                    metadata: data.metadata as any,
                },
            })

            logger.info(`Audit log created: ${data.action} on ${data.targetType}/${data.targetId}`)
            return auditLog
        } catch (error) {
            logger.error('Create audit log error:', error)
            throw error
        }
    }

    // Get audit logs with filtering
    static async getAuditLogs(query: AuditLogQuery) {
        try {
            const where: any = {}

            if (query.actorUserId) {
                where.actorUserId = query.actorUserId
            }

            if (query.action) {
                if (Array.isArray(query.action)) {
                    where.action = { in: query.action }
                } else {
                    where.action = query.action
                }
            }

            if (query.targetType) {
                if (Array.isArray(query.targetType)) {
                    where.targetType = { in: query.targetType }
                } else {
                    where.targetType = query.targetType
                }
            }

            if (query.targetId) {
                where.targetId = query.targetId
            }

            if (query.startDate || query.endDate) {
                where.createdAt = {}
                if (query.startDate) {
                    where.createdAt.gte = query.startDate
                }
                if (query.endDate) {
                    where.createdAt.lte = query.endDate
                }
            }

            const page = query.page || 1
            const limit = query.limit || 20
            const skip = (page - 1) * limit

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where,
                    include: {
                        actor: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    skip,
                    take: limit,
                }),
                prisma.auditLog.count({ where }),
            ])

            return {
                logs,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                },
            }
        } catch (error) {
            logger.error('Get audit logs error:', error)
            throw error
        }
    }

    // Get audit log statistics
    static async getAuditLogStats(days: number = 30) {
        try {
            const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

            const [
                totalLogs,
                logsByAction,
                logsByTargetType,
                logsByActor,
                recentActivity,
                securityEvents,
            ] = await Promise.all([
                prisma.auditLog.count({
                    where: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                }),
                prisma.auditLog.groupBy({
                    by: ['action'],
                    where: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                    _count: true,
                }),
                prisma.auditLog.groupBy({
                    by: ['targetType'],
                    where: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                    _count: true,
                }),
                prisma.auditLog.groupBy({
                    by: ['actorUserId'],
                    where: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                    _count: true,
                }),
                prisma.auditLog.findMany({
                    where: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                    include: {
                        actor: {
                            select: {
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 10,
                }),
                prisma.auditLog.count({
                    where: {
                        action: AuditAction.SECURITY_EVENT,
                        createdAt: {
                            gte: startDate,
                        },
                    },
                }),
            ])

            return {
                totalLogs,
                logsByAction: logsByAction.reduce((acc, item) => {
                    acc[item.action] = item._count
                    return acc
                }, {} as Record<string, number>),
                logsByTargetType: logsByTargetType.reduce((acc, item) => {
                    acc[item.targetType] = item._count
                    return acc
                }, {} as Record<string, number>),
                logsByActor,
                recentActivity,
                securityEvents,
            }
        } catch (error) {
            logger.error('Get audit stats error:', error)
            throw error
        }
    }

    // Search audit logs
    static async searchAuditLogs(searchTerm: string, query: Partial<AuditLogQuery>) {
        try {
            const where: any = {
                OR: [
                    { action: { contains: searchTerm, mode: 'insensitive' } },
                    { targetType: { contains: searchTerm, mode: 'insensitive' } },
                    { targetId: { contains: searchTerm, mode: 'insensitive' } },
                ],
            }

            // Add date filters
            if (query.startDate || query.endDate) {
                where.createdAt = {}
                if (query.startDate) {
                    where.createdAt.gte = query.startDate
                }
                if (query.endDate) {
                    where.createdAt.lte = query.endDate
                }
            }

            const page = query.page || 1
            const limit = query.limit || 20
            const skip = (page - 1) * limit

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where,
                    include: {
                        actor: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    skip,
                    take: limit,
                }),
                prisma.auditLog.count({ where }),
            ])

            return {
                logs,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                },
                searchTerm,
            }
        } catch (error) {
            logger.error('Search audit logs error:', error)
            throw error
        }
    }

    // Get audit log by ID
    static async getAuditLogById(logId: string) {
        try {
            const log = await prisma.auditLog.findUnique({
                where: { id: logId },
                include: {
                    actor: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            })

            return log
        } catch (error) {
            logger.error('Get audit log by ID error:', error)
            throw error
        }
    }

    // Get audit logs for specific user
    static async getUserAuditLogs(userId: string, query: Partial<AuditLogQuery>) {
        try {
            const processedQuery: AuditLogQuery = {
                ...query,
                actorUserId: userId,
                startDate: query.startDate,
                endDate: query.endDate,
            }

            return await this.getAuditLogs(processedQuery)
        } catch (error) {
            logger.error('Get user audit logs error:', error)
            throw error
        }
    }

    // Export audit logs
    static async exportAuditLogs(query: AuditLogQuery, format: 'csv' | 'json' | 'xlsx') {
        try {
            // Get all logs for export (large limit)
            const exportQuery = { ...query, limit: 10000 }
            const result = await this.getAuditLogs(exportQuery)

            switch (format) {
                case 'csv':
                    return this.generateCSV(result.logs)
                case 'xlsx':
                    return this.generateXLSX(result.logs)
                case 'json':
                default:
                    return JSON.stringify(result.logs, null, 2)
            }
        } catch (error) {
            logger.error('Export audit logs error:', error)
            throw error
        }
    }

    // Log user action
    static async logUserAction(
        actorUserId: string,
        action: AuditAction,
        targetType: AuditTargetType,
        targetId?: string,
        oldValues?: any,
        newValues?: any,
        metadata?: any
    ) {
        try {
            const auditData: CreateAuditLogData = {
                actorUserId,
                action,
                targetType,
                targetId,
                oldValues,
                newValues,
                metadata,
            }

            return await this.createAuditLog(auditData)
        } catch (error) {
            logger.error('Log user action error:', error)
            throw error
        }
    }

    // Log security event
    static async logSecurityEvent(
        actorUserId: string,
        event: string,
        details: any,
        metadata?: any
    ) {
        try {
            const auditData: CreateAuditLogData = {
                actorUserId,
                action: AuditAction.SECURITY_EVENT,
                targetType: AuditTargetType.SECURITY,
                metadata: {
                    ...metadata,
                    securityEvent: event,
                    details,
                    timestamp: new Date().toISOString(),
                },
            }

            return await this.createAuditLog(auditData)
        } catch (error) {
            logger.error('Log security event error:', error)
            throw error
        }
    }

    // Log bulk action
    static async logBulkAction(
        actorUserId: string,
        action: AuditAction,
        targetType: AuditTargetType,
        targetIds: string[],
        metadata?: any
    ) {
        try {
            const auditData: CreateAuditLogData = {
                actorUserId,
                action,
                targetType,
                targetId: targetIds.join(','),
                metadata: {
                    ...metadata,
                    bulkAction: true,
                    targetCount: targetIds.length,
                    targetIds,
                },
            }

            return await this.createAuditLog(auditData)
        } catch (error) {
            logger.error('Log bulk action error:', error)
            throw error
        }
    }

    // Clean up old audit logs
    static async cleanupOldAuditLogs(retentionDays: number = 90) {
        try {
            const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000))

            const deleted = await prisma.auditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            })

            logger.info(`Cleaned up ${deleted.count} old audit logs`)
            return deleted.count
        } catch (error) {
            logger.error('Cleanup old audit logs error:', error)
            throw error
        }
    }

    // Helper methods
    private static generateCSV(logs: any[]): string {
        const headers = [
            'ID',
            'Actor Email',
            'Action',
            'Target Type',
            'Target ID',
            'Created At',
            'IP Address',
            'User Agent',
        ]

        const rows = logs.map(log => [
            log.id,
            log.actor.email,
            log.action,
            log.targetType,
            log.targetId || '',
            log.createdAt,
            log.metadata?.ip || '',
            log.metadata?.userAgent || '',
        ])

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n')

        return csvContent
    }

    private static generateXLSX(logs: any[]): string {
        // This would need to be implemented with a library like xlsx
        // For now, return CSV format
        return this.generateCSV(logs)
    }
}
