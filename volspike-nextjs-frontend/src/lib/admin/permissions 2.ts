import { AdminRole, Permission } from '@/types/admin'

// Define permissions for each role
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
    USER: [], // Regular users have no admin permissions
    ADMIN: [
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

// Navigation items with permissions
export const ADMIN_NAV_ITEMS = [
    {
        title: 'Dashboard',
        href: '/admin',
        icon: 'LayoutDashboard',
        permission: 'metrics.read' as Permission,
    },
    {
        title: 'Users',
        href: '/admin/users',
        icon: 'Users',
        permission: 'users.read' as Permission,
        children: [
            {
                title: 'All Users',
                href: '/admin/users',
                icon: 'Users',
                permission: 'users.read' as Permission,
            },
            {
                title: 'Create User',
                href: '/admin/users/new',
                icon: 'UserPlus',
                permission: 'users.create' as Permission,
            },
        ],
    },
    {
        title: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: 'CreditCard',
        permission: 'subscriptions.read' as Permission,
    },
    {
        title: 'Audit Logs',
        href: '/admin/audit',
        icon: 'FileText',
        permission: 'audit.read' as Permission,
    },
    {
        title: 'Metrics',
        href: '/admin/metrics',
        icon: 'BarChart3',
        permission: 'metrics.read' as Permission,
    },
    {
        title: 'Settings',
        href: '/admin/settings',
        icon: 'Settings',
        permission: 'settings.read' as Permission,
        children: [
            {
                title: 'General',
                href: '/admin/settings',
                icon: 'Settings',
                permission: 'settings.read' as Permission,
            },
            {
                title: 'Security',
                href: '/admin/settings/security',
                icon: 'Shield',
                permission: 'settings.read' as Permission,
            },
            {
                title: '2FA',
                href: '/admin/settings/2fa',
                icon: 'Key',
                permission: 'settings.read' as Permission,
            },
        ],
    },
]

// Check if user has specific permission
export function hasPermission(userRole: AdminRole, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || []
    return rolePermissions.includes(permission)
}

// Check if user can access admin area
export function canAccessAdmin(userRole: AdminRole, userStatus: string): boolean {
    return userRole === 'ADMIN' && userStatus === 'ACTIVE'
}

// Get filtered navigation items based on user permissions
export function getFilteredNavItems(userRole: AdminRole) {
    return ADMIN_NAV_ITEMS.filter(item => {
        // Check if user has permission for this item
        if (item.permission && !hasPermission(userRole, item.permission)) {
            return false
        }

        // Filter children if they exist
        if (item.children) {
            item.children = item.children.filter(child =>
                !child.permission || hasPermission(userRole, child.permission)
            )

            // If no children remain, don't show the parent
            if (item.children.length === 0) {
                return false
            }
        }

        return true
    })
}

// Check if user can perform action on resource
export function canPerformAction(
    userRole: AdminRole,
    action: 'create' | 'read' | 'update' | 'delete',
    resource: 'users' | 'subscriptions' | 'audit' | 'settings' | 'metrics' | 'admin'
): boolean {
    const permission = `${resource}.${action}` as Permission
    return hasPermission(userRole, permission)
}

// Get user's effective permissions
export function getUserPermissions(userRole: AdminRole): Permission[] {
    return ROLE_PERMISSIONS[userRole] || []
}

// Check if user is admin
export function isAdmin(userRole: AdminRole): boolean {
    return userRole === 'ADMIN'
}

// Check if user can manage other admins
export function canManageAdmins(userRole: AdminRole): boolean {
    return hasPermission(userRole, 'admin.create') && hasPermission(userRole, 'admin.delete')
}

// Check if user can export data
export function canExportData(userRole: AdminRole): boolean {
    return hasPermission(userRole, 'audit.export')
}

// Check if user can modify settings
export function canModifySettings(userRole: AdminRole): boolean {
    return hasPermission(userRole, 'settings.update')
}