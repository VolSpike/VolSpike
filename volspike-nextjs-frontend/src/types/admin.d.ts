// Admin types for frontend
export type AdminRole = 'USER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'
export type UserTier = 'free' | 'pro' | 'elite'

// User management types
export interface AdminUser {
    id: string
    email: string
    walletAddress?: string | null
    tier: UserTier
    role: AdminRole
    status: UserStatus
    emailVerified?: Date | null
    createdAt: Date
    lastLoginAt?: Date | null
    stripeCustomerId?: string | null
    paymentMethod?: 'stripe' | 'crypto' | null
    subscriptionExpiresAt?: Date | null
    subscriptionMethod?: 'stripe' | 'crypto' | null
    notes?: string | null
    twoFactorEnabled: boolean
}

export interface UserListQuery {
    search?: string
    role?: AdminRole
    tier?: UserTier
    status?: UserStatus
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'email' | 'lastLoginAt'
    sortOrder?: 'asc' | 'desc'
}

export interface UserListResponse {
    users: AdminUser[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
}

export interface CreateUserRequest {
    email: string
    tier: UserTier
    role: AdminRole
    sendInvite: boolean
    temporaryPassword?: string
}

export interface UpdateUserRequest {
    tier?: UserTier
    role?: AdminRole
    status?: UserStatus
    notes?: string
    emailVerified?: boolean
}

export interface BulkActionRequest {
    action: 'suspend' | 'activate' | 'delete' | 'changeTier'
    userIds: string[]
    params?: {
        tier?: UserTier
        status?: UserStatus
    }
}

// Audit log types
export interface AuditLogEntry {
    id: string
    actorUserId: string
    actor: {
        id: string
        email: string
        role: AdminRole
    }
    action: string
    targetType: string
    targetId?: string | null
    oldValues?: any
    newValues?: any
    metadata?: {
        ip?: string
        userAgent?: string
        method?: string
        path?: string
        duration?: number
    }
    createdAt: Date
}

export interface AuditLogQuery {
    actorUserId?: string
    action?: string
    targetType?: string
    targetId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'action' | 'targetType'
    sortOrder?: 'asc' | 'desc'
}

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
            actions: string[]
            targetTypes: string[]
            actors: Array<{ id: string; email: string }>
        }
    }
}

// Subscription types
export interface SubscriptionSummary {
    id: string
    userId: string
    userEmail: string
    stripeCustomerId: string
    stripeSubscriptionId?: string
    stripePriceId?: string
    status: string
    currentPeriodStart?: Date
    currentPeriodEnd?: Date
    cancelAtPeriodEnd: boolean
    createdAt: Date
    updatedAt: Date
}

// System metrics types
export interface SystemMetrics {
    totalUsers: number
    activeUsers: number
    usersByTier: {
        tier: string
        count: number
    }[]
    totalRevenue: number
    recentSignups: number
    failedLogins: number
    adminSessions: number
}

// 2FA types
export interface TwoFactorSetup {
    secret: string
    qrCode: string
    backupCodes: string[]
}

export interface TwoFactorVerification {
    code: string
    backupCode?: string
}

// Admin session types
export interface AdminSession {
    id: string
    userId: string
    token: string
    ipAddress: string
    userAgent: string
    expiresAt: Date
    lastActivity: Date
    createdAt: Date
}

// API response types
export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface PaginatedResponse<T> {
    items: T[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
}

// Form validation types
export interface UserFormData {
    email: string
    tier: UserTier
    role: AdminRole
    status: UserStatus
    notes?: string
}

// Security types
export interface SecurityEvent {
    type: 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | '2FA_FAILURE'
    userId?: string
    email?: string
    ipAddress?: string
    userAgent?: string
    details?: any
    timestamp: Date
}

// Admin settings types
export interface AdminSettings {
    adminEmailWhitelist: string[]
    adminIPWhitelist: string[]
    adminSessionDuration: number
    auditLogRetentionDays: number
    rateLimitConfig: {
        login: { windowMs: number; maxRequests: number }
        api: { windowMs: number; maxRequests: number }
        mutation: { windowMs: number; maxRequests: number }
    }
}

// Permission types
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

// Navigation types
export interface AdminNavItem {
    title: string
    href: string
    icon: string
    permission?: Permission
    children?: AdminNavItem[]
}

// Table types
export interface TableColumn<T> {
    key: keyof T
    title: string
    sortable?: boolean
    render?: (value: any, row: T) => React.ReactNode
}

export interface TableProps<T> {
    data: T[]
    columns: TableColumn<T>[]
    loading?: boolean
    pagination?: {
        page: number
        limit: number
        total: number
        onPageChange: (page: number) => void
    }
    sorting?: {
        sortBy: string
        sortOrder: 'asc' | 'desc'
        onSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
    }
    selection?: {
        selectedRows: string[]
        onSelectionChange: (selectedRows: string[]) => void
    }
}

// Chart types
export interface ChartData {
    labels: string[]
    datasets: {
        label: string
        data: number[]
        backgroundColor?: string | string[]
        borderColor?: string | string[]
        borderWidth?: number
    }[]
}

export interface ChartProps {
    data: ChartData
    type: 'line' | 'bar' | 'pie' | 'doughnut'
    title?: string
    height?: number
    options?: any
}
