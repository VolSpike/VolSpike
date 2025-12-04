import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'

const logger = createLogger()
const adminAuditRoutes = new Hono()

// Validation schemas
const auditLogQuerySchema = z.object({
    actorUserId: z.string().optional(),
    action: z.string().optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'action', 'targetType']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// GET /api/admin/audit - Get audit logs
adminAuditRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = auditLogQuerySchema.parse(query)

        // Build where clause
        const where: any = {}

        if (params.actorUserId) where.actorUserId = params.actorUserId
        if (params.action) where.action = params.action
        if (params.targetType) where.targetType = params.targetType
        if (params.targetId) where.targetId = params.targetId

        if (params.startDate || params.endDate) {
            where.createdAt = {}
            if (params.startDate) {
                where.createdAt.gte = new Date(params.startDate)
            }
            if (params.endDate) {
                where.createdAt.lte = new Date(params.endDate)
            }
        }

        // Get total count
        const total = await prisma.auditLog.count({ where })

        // Get paginated results
        const logs = await prisma.auditLog.findMany({
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
            orderBy: { [params.sortBy]: params.sortOrder },
            skip: (params.page - 1) * params.limit,
            take: params.limit,
        })

        return c.json({
            logs,
            pagination: {
                total,
                page: params.page,
                limit: params.limit,
                pages: Math.ceil(total / params.limit),
            },
            filters: {
                applied: params,
                available: {
                    actions: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ADMIN_LOGIN'],
                    targetTypes: ['USER', 'SUBSCRIPTION', 'ADMIN', 'SETTINGS'],
                    actors: [],
                },
            },
        })
    } catch (error) {
        logger.error('Get audit logs error:', error)
        return c.json({ error: 'Failed to fetch audit logs' }, 500)
    }
})

// GET /api/admin/audit/stats - Get audit statistics
adminAuditRoutes.get('/stats', async (c) => {
    try {
        const days = parseInt(c.req.query('days') || '30')
        const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

        const [totalLogs, recentActivity] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
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
        ])

        return c.json({
            totalLogs,
            recentActivity,
            period: `${days} days`,
        })
    } catch (error) {
        logger.error('Get audit stats error:', error)
        return c.json({ error: 'Failed to fetch audit statistics' }, 500)
    }
})

// GET /api/admin/audit/:id - Get specific audit log
adminAuditRoutes.get('/:id', async (c) => {
    try {
        const logId = c.req.param('id')

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

        if (!log) {
            return c.json({ error: 'Audit log not found' }, 404)
        }

        return c.json(log)
    } catch (error) {
        logger.error('Get audit log error:', error)
        return c.json({ error: 'Failed to fetch audit log' }, 500)
    }
})

// GET /api/admin/audit/export - Export audit logs
adminAuditRoutes.get('/export', async (c) => {
    try {
        const format = c.req.query('format') || 'json'
        
        // Get all audit logs for export
        const logs = await prisma.auditLog.findMany({
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
            take: 1000, // Limit to 1000 for now
        })

        if (format === 'json') {
            c.header('Content-Type', 'application/json')
            c.header('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`)
            return c.text(JSON.stringify(logs, null, 2))
        } else if (format === 'csv') {
            const csv = generateCSV(logs)
            c.header('Content-Type', 'text/csv')
            c.header('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`)
            return c.text(csv)
        } else {
            return c.json({ error: 'Unsupported format' }, 400)
        }
    } catch (error) {
        logger.error('Export audit logs error:', error)
        return c.json({ error: 'Failed to export audit logs' }, 500)
    }
})

// Helper function to generate CSV
function generateCSV(logs: any[]): string {
    const headers = ['ID', 'Actor Email', 'Action', 'Target Type', 'Target ID', 'Created At']
    const rows = logs.map(log => [
        log.id,
        log.actor?.email || '',
        log.action,
        log.targetType,
        log.targetId || '',
        log.createdAt,
    ])

    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')

    return csvContent
}

export { adminAuditRoutes }
