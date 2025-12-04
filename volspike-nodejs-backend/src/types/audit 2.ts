import { Role, UserStatus } from '@prisma/client'
import { AuditAction, AuditTargetType } from './audit-consts'

// Re-export the constants as types for backward compatibility
export type { AuditAction, AuditTargetType }

// Audit log entry interface
export interface AuditLogEntry {
    id: string
    actorUserId: string
    actor: {
        id: string
        email: string
        role: Role
    }
    action: AuditAction
    targetType: AuditTargetType
    targetId?: string | null
    oldValues?: Record<string, any> | null
    newValues?: Record<string, any> | null
    metadata?: AuditMetadata
    createdAt: Date
}

// Audit metadata interface
export interface AuditMetadata {
    ip?: string
    userAgent?: string
    method?: string
    path?: string
    query?: Record<string, any>
    duration?: number
    sessionId?: string
    requestId?: string
    errorMessage?: string
    additionalContext?: Record<string, any>
}

// Audit log query interface
export interface AuditLogQuery {
    actorUserId?: string
    action?: AuditAction | AuditAction[]
    targetType?: AuditTargetType | AuditTargetType[]
    targetId?: string
    startDate?: Date
    endDate?: Date
    search?: string
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'action' | 'targetType'
    sortOrder?: 'asc' | 'desc'
}

// Audit log response interface
export interface AuditLogResponse {
    logs: AuditLogEntry[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
    filters: {
        applied: Partial<AuditLogQuery>
        available: {
            actions: AuditAction[]
            targetTypes: AuditTargetType[]
            actors: Array<{ id: string; email: string }>
        }
    }
}

// Audit log creation interface
export interface CreateAuditLogData {
    actorUserId: string
    action: AuditAction
    targetType: AuditTargetType
    targetId?: string
    oldValues?: Record<string, any>
    newValues?: Record<string, any>
    metadata?: AuditMetadata
}

// Audit log statistics
export interface AuditLogStats {
    totalLogs: number
    logsByAction: Record<AuditAction, number>
    logsByTargetType: Record<AuditTargetType, number>
    logsByActor: Array<{
        actorId: string
        actorEmail: string
        count: number
    }>
    recentActivity: AuditLogEntry[]
    securityEvents: number
    failedActions: number
}

// Audit log export interface
export interface AuditLogExport {
    format: 'csv' | 'json' | 'xlsx'
    query: AuditLogQuery
    filename?: string
    includeMetadata?: boolean
}

// Audit log retention policy
export interface AuditRetentionPolicy {
    enabled: boolean
    retentionDays: number
    archiveAfterDays: number
    deleteAfterDays: number
    compressArchives: boolean
}

// Security event types
export interface SecurityEvent {
    type: 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | '2FA_FAILURE' | 'RATE_LIMIT'
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    userId?: string
    email?: string
    ipAddress?: string
    userAgent?: string
    details: Record<string, any>
    timestamp: Date
    resolved: boolean
    resolvedAt?: Date
    resolvedBy?: string
}

// Audit log middleware context
export interface AuditContext {
    actorUserId: string
    action: AuditAction
    targetType: AuditTargetType
    targetId?: string
    oldValues?: Record<string, any>
    newValues?: Record<string, any>
    metadata?: AuditMetadata
}

// Audit log validation
export interface AuditLogValidation {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export function validateAuditLogData(data: CreateAuditLogData): AuditLogValidation {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.actorUserId) {
        errors.push('Actor user ID is required')
    }

    if (!data.action) {
        errors.push('Action is required')
    }

    if (!data.targetType) {
        errors.push('Target type is required')
    }

    if (data.oldValues && typeof data.oldValues !== 'object') {
        errors.push('Old values must be an object')
    }

    if (data.newValues && typeof data.newValues !== 'object') {
        errors.push('New values must be an object')
    }

    if (data.metadata && typeof data.metadata !== 'object') {
        errors.push('Metadata must be an object')
    }

    // Check for sensitive data in values
    const sensitiveFields = ['password', 'secret', 'token', 'key', 'hash']
    const checkForSensitiveData = (obj: any, path: string = '') => {
        if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    warnings.push(`Potentially sensitive data detected in ${currentPath}`)
                }
                if (typeof value === 'object') {
                    checkForSensitiveData(value, currentPath)
                }
            }
        }
    }

    if (data.oldValues) checkForSensitiveData(data.oldValues, 'oldValues')
    if (data.newValues) checkForSensitiveData(data.newValues, 'newValues')

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    }
}

// Audit log filtering utilities
export function buildAuditLogWhereClause(query: AuditLogQuery) {
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

    return where
}

// Audit log sorting utilities
export function buildAuditLogOrderBy(query: AuditLogQuery) {
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'

    return { [sortBy]: sortOrder }
}
