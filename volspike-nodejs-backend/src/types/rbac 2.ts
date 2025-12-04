import { Role, UserStatus } from '@prisma/client'

// Permission system
export type Permission =
    | 'users.read'
    | 'users.create'
    | 'users.update'
    | 'users.delete'
    | 'subscriptions.read'
    | 'subscriptions.update'
    | 'subscriptions.delete'
    | 'audit.read'
    | 'audit.export'
    | 'settings.read'
    | 'settings.update'
    | 'metrics.read'
    | 'admin.create'
    | 'admin.delete'

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.USER]: [],
    [Role.ADMIN]: [
        'users.read',
        'users.create',
        'users.update',
        'users.delete',
        'subscriptions.read',
        'subscriptions.update',
        'subscriptions.delete',
        'audit.read',
        'audit.export',
        'settings.read',
        'settings.update',
        'metrics.read',
        'admin.create',
        'admin.delete',
    ],
}

// Permission checking utilities
export function hasPermission(userRole: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false
}

export function hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
    return permissions.some(permission => hasPermission(userRole, permission))
}

export function hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
    return permissions.every(permission => hasPermission(userRole, permission))
}

// Admin-specific permission checks
export function canManageUsers(userRole: Role): boolean {
    return hasAnyPermission(userRole, ['users.read', 'users.create', 'users.update', 'users.delete'])
}

export function canManageSubscriptions(userRole: Role): boolean {
    return hasAnyPermission(userRole, ['subscriptions.read', 'subscriptions.update', 'subscriptions.delete'])
}

export function canViewAuditLogs(userRole: Role): boolean {
    return hasPermission(userRole, 'audit.read')
}

export function canExportAuditLogs(userRole: Role): boolean {
    return hasPermission(userRole, 'audit.export')
}

export function canManageSettings(userRole: Role): boolean {
    return hasAnyPermission(userRole, ['settings.read', 'settings.update'])
}

export function canViewMetrics(userRole: Role): boolean {
    return hasPermission(userRole, 'metrics.read')
}

export function canCreateAdmins(userRole: Role): boolean {
    return hasPermission(userRole, 'admin.create')
}

export function canDeleteAdmins(userRole: Role): boolean {
    return hasPermission(userRole, 'admin.delete')
}

// Resource access control
export interface ResourceAccess {
    resource: string
    action: string
    requiredPermissions: Permission[]
}

export const RESOURCE_ACCESS: Record<string, ResourceAccess[]> = {
    'admin.users': [
        { resource: 'users', action: 'list', requiredPermissions: ['users.read'] },
        { resource: 'users', action: 'view', requiredPermissions: ['users.read'] },
        { resource: 'users', action: 'create', requiredPermissions: ['users.create'] },
        { resource: 'users', action: 'update', requiredPermissions: ['users.update'] },
        { resource: 'users', action: 'delete', requiredPermissions: ['users.delete'] },
    ],
    'admin.subscriptions': [
        { resource: 'subscriptions', action: 'list', requiredPermissions: ['subscriptions.read'] },
        { resource: 'subscriptions', action: 'view', requiredPermissions: ['subscriptions.read'] },
        { resource: 'subscriptions', action: 'update', requiredPermissions: ['subscriptions.update'] },
        { resource: 'subscriptions', action: 'delete', requiredPermissions: ['subscriptions.delete'] },
    ],
    'admin.audit': [
        { resource: 'audit', action: 'list', requiredPermissions: ['audit.read'] },
        { resource: 'audit', action: 'export', requiredPermissions: ['audit.export'] },
    ],
    'admin.settings': [
        { resource: 'settings', action: 'view', requiredPermissions: ['settings.read'] },
        { resource: 'settings', action: 'update', requiredPermissions: ['settings.update'] },
    ],
    'admin.metrics': [
        { resource: 'metrics', action: 'view', requiredPermissions: ['metrics.read'] },
    ],
}

export function canAccessResource(
    userRole: Role,
    resource: string,
    action: string
): boolean {
    const accessRules = RESOURCE_ACCESS[resource]
    if (!accessRules) return false

    const rule = accessRules.find(r => r.action === action)
    if (!rule) return false

    return hasAllPermissions(userRole, rule.requiredPermissions)
}

// Middleware permission checking
export interface PermissionCheck {
    resource: string
    action: string
    userId?: string
    targetUserId?: string
}

export function checkPermission(
    userRole: Role,
    userStatus: UserStatus,
    check: PermissionCheck
): { allowed: boolean; reason?: string } {
    // Check if user is active
    if (userStatus !== UserStatus.ACTIVE) {
        return { allowed: false, reason: 'Account is not active' }
    }

    // Check resource access
    if (!canAccessResource(userRole, check.resource, check.action)) {
        return { allowed: false, reason: 'Insufficient permissions' }
    }

    // Additional checks for admin-specific actions
    if (check.resource === 'admin' && check.action === 'delete') {
        // Prevent self-deletion
        if (check.userId === check.targetUserId) {
            return { allowed: false, reason: 'Cannot delete your own admin account' }
        }
    }

    return { allowed: true }
}

// Admin session validation
export interface SessionValidation {
    isValid: boolean
    user?: {
        id: string
        email: string
        role: Role
        status: UserStatus
    }
    reason?: string
}

export function validateAdminSession(
    userRole: Role,
    userStatus: UserStatus,
    sessionExpiry?: Date
): SessionValidation {
    if (userRole !== Role.ADMIN) {
        return { isValid: false, reason: 'Not an admin user' }
    }

    if (userStatus !== UserStatus.ACTIVE) {
        return { isValid: false, reason: 'Account is not active' }
    }

    if (sessionExpiry && sessionExpiry < new Date()) {
        return { isValid: false, reason: 'Session expired' }
    }

    return { isValid: true }
}
