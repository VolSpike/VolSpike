import { Context, Next } from 'hono'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { AuditAction, AuditTargetType, CreateAuditLogData, AuditMetadata } from '../types/audit'

const logger = createLogger()

export async function auditLog(c: Context, next: Next) {
    const startTime = Date.now()
    const user = c.get('adminUser')

    if (!user) {
        await next()
        return
    }

    const method = c.req.method
    const path = c.req.path

    // Store original body for logging
    let requestBody: any = null
    if (method !== 'GET' && method !== 'HEAD') {
        try {
            requestBody = await c.req.json()
            // Re-set the body for downstream handlers
            c.req.raw = new Request(c.req.raw, {
                body: JSON.stringify(requestBody),
            })
        } catch {
            // Not JSON body, ignore
        }
    }

    // Store original response
    let responseData: any = null
    let oldValues: any = null

    // For updates/deletes, capture original state
    if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
        const targetId = extractTargetId(path)
        const targetType = extractTargetType(path)

        if (targetId && targetType) {
            oldValues = await captureOriginalState(targetType, targetId)
        }
    }

    await next()

    // Capture response
    const duration = Date.now() - startTime

    try {
        // Log the audit entry
        const metadata: AuditMetadata = {
            ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            userAgent: c.req.header('user-agent'),
            method,
            path,
            query: Object.fromEntries(new URL(c.req.url).searchParams),
            duration,
        }

        const action = determineAction(method, path)
        const targetType = extractTargetType(path)
        const targetId = extractTargetId(path)

        await prisma.auditLog.create({
            data: {
                actorUserId: user.id,
                action,
                targetType,
                targetId,
                oldValues: oldValues ? oldValues : undefined,
                newValues: requestBody ? requestBody : undefined,
                metadata: metadata as any,
            },
        })

        logger.info(`Audit logged: ${user.email} performed ${action} on ${targetType}/${targetId}`)
    } catch (error) {
        logger.error('Failed to create audit log:', error)
        // Don't fail the request if audit logging fails
    }
}

export async function auditAction(
    actorUserId: string,
    action: AuditAction,
    targetType: AuditTargetType,
    targetId?: string,
    oldValues?: any,
    newValues?: any,
    metadata?: AuditMetadata
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

        await prisma.auditLog.create({
            data: {
                ...auditData,
                metadata: auditData.metadata as any,
            },
        })

        logger.info(`Audit action logged: ${action} on ${targetType}/${targetId}`)
    } catch (error) {
        logger.error('Failed to log audit action:', error)
    }
}

export async function auditBulkAction(
    actorUserId: string,
    action: AuditAction,
    targetType: AuditTargetType,
    targetIds: string[],
    metadata?: AuditMetadata
) {
    try {
        const auditData: CreateAuditLogData = {
            actorUserId,
            action,
            targetType,
            targetId: targetIds.join(','),
            metadata: {
                ...metadata,
                additionalContext: { bulkAction: true, targetCount: targetIds.length, targetIds },
            },
        }

        await prisma.auditLog.create({
            data: {
                ...auditData,
                metadata: auditData.metadata as any,
            },
        })

        logger.info(`Bulk audit action logged: ${action} on ${targetIds.length} ${targetType} items`)
    } catch (error) {
        logger.error('Failed to log bulk audit action:', error)
    }
}

export async function auditSecurityEvent(
    actorUserId: string,
    event: string,
    details: any,
    metadata?: AuditMetadata
) {
    try {
        const auditData: CreateAuditLogData = {
            actorUserId,
            action: AuditAction.SECURITY_EVENT,
            targetType: 'SECURITY',
            metadata: {
                ...metadata,
                additionalContext: { securityEvent: event, details },
            },
        }

        await prisma.auditLog.create({
            data: {
                ...auditData,
                metadata: auditData.metadata as any,
            },
        })

        logger.warn(`Security event logged: ${event} for user ${actorUserId}`)
    } catch (error) {
        logger.error('Failed to log security event:', error)
    }
}

// Helper functions
function determineAction(method: string, path: string): AuditAction {
    const resource = extractTargetType(path)

    switch (method) {
        case 'GET':
            return `${resource}_VIEWED` as AuditAction
        case 'POST':
            return `${resource}_CREATED` as AuditAction
        case 'PATCH':
        case 'PUT':
            return `${resource}_UPDATED` as AuditAction
        case 'DELETE':
            return `${resource}_DELETED` as AuditAction
        default:
            return `${resource}_${method}` as AuditAction
    }
}

function extractTargetType(path: string): string {
    const segments = path.split('/').filter(Boolean)
    if (segments.includes('users')) return 'USER'
    if (segments.includes('subscriptions')) return 'SUBSCRIPTION'
    if (segments.includes('settings')) return 'SETTINGS'
    if (segments.includes('audit')) return 'AUDIT'
    if (segments.includes('admin')) return 'ADMIN'
    return 'SYSTEM'
}

function extractTargetId(path: string): string | null {
    const match = path.match(/\/([a-zA-Z0-9-]+)(?:\/|$)/)
    return match ? match[1] : null
}

async function captureOriginalState(type: string, id: string): Promise<any> {
    try {
        switch (type) {
            case 'USER':
                return await prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        tier: true,
                        status: true,
                        notes: true,
                        twoFactorEnabled: true,
                    }
                })
            case 'SUBSCRIPTION':
                // Implement subscription lookup when subscription model is available
                return null
            case 'SETTINGS':
                // Implement settings lookup when settings model is available
                return null
            default:
                return null
        }
    } catch (error) {
        logger.error(`Failed to capture original state for ${type}/${id}:`, error)
        return null
    }
}

// Audit log query utilities
export async function getAuditLogs(query: {
    actorUserId?: string
    action?: AuditAction | AuditAction[]
    targetType?: AuditTargetType | AuditTargetType[]
    targetId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
}) {
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
}

// Audit log statistics
export async function getAuditLogStats(days: number = 30) {
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
}
