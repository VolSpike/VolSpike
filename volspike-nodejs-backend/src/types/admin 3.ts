import { Role, UserStatus } from '@prisma/client'

// Admin user interface
export interface AdminUser {
    id: string
    email: string
    role: Role
    tier: string
    status: UserStatus
    twoFactorEnabled: boolean
    lastLoginAt?: Date | null
    ipAddress?: string | null
    userAgent?: string | null
}

// User management types
export interface UserListQuery {
    search?: string
    role?: Role
    tier?: 'free' | 'pro' | 'elite'
    status?: UserStatus
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'email' | 'lastLoginAt'
    sortOrder?: 'asc' | 'desc'
}

export interface UserListResponse {
    users: UserSummary[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
}

export interface UserSummary {
    id: string
    email: string
    walletAddress?: string | null
    tier: string
    role: Role
    status: UserStatus
    emailVerified?: Date | null
    createdAt: Date
    lastLoginAt?: Date | null
    stripeCustomerId?: string | null
}

export interface UserDetail extends UserSummary {
    notes?: string | null
    loginAttempts: number
    lockedUntil?: Date | null
    twoFactorEnabled: boolean
    preferences?: {
        emailAlerts: boolean
        smsAlerts: boolean
        telegramAlerts: boolean
        discordAlerts: boolean
        volumeThreshold: number
        minQuoteVolume: number
    }
    watchlists?: Array<{
        id: string
        name: string
        items: Array<{
            contract: {
                symbol: string
            }
        }>
    }>
    alerts?: Array<{
        id: string
        reason: string
        threshold: number
        triggeredValue: number
        isDelivered: boolean
        createdAt: Date
    }>
    auditLogs?: Array<{
        id: string
        action: string
        targetType: string
        createdAt: Date
    }>
}

export interface CreateUserRequest {
    email: string
    tier: 'free' | 'pro' | 'elite'
    role: Role
    sendInvite: boolean
    temporaryPassword?: string
}

export interface UpdateUserRequest {
    tier?: 'free' | 'pro' | 'elite'
    role?: Role
    status?: UserStatus
    notes?: string
    emailVerified?: boolean | Date | null
}

// Audit log types
export interface AuditLogQuery {
    actorUserId?: string
    action?: string
    targetType?: string
    targetId?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
}

export interface AuditLogResponse {
    logs: AuditLogEntry[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
}

export interface AuditLogEntry {
    id: string
    actorUserId: string
    actor: {
        email: string
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

// Subscription management types
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

export interface StripeSyncRequest {
    userId: string
    forceSync?: boolean
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
export interface AdminSessionData {
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
    tier: 'free' | 'pro' | 'elite'
    role: Role
    status: UserStatus
    notes?: string
}

export interface BulkActionRequest {
    action: 'suspend' | 'activate' | 'delete' | 'export' | 'changeTier'
    userIds: string[]
    params?: {
        tier?: 'free' | 'pro' | 'elite'
        status?: UserStatus
    }
}

// Email template types
export interface InviteEmailData {
    email: string
    temporaryPassword?: string
    invitedBy: string
    tier: string
}

export interface SecurityAlertData {
    type: string
    details: any
    timestamp: Date
    ipAddress?: string
}

// Rate limiting types
export interface RateLimitConfig {
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests?: boolean
    skipFailedRequests?: boolean
}

export interface RateLimitInfo {
    limit: number
    remaining: number
    reset: Date
    retryAfter?: number
}

// CSRF protection types
export interface CSRFConfig {
    secret: string
    tokenLength: number
    cookieName: string
    headerName: string
}

export interface CSRFToken {
    token: string
    expiresAt: Date
}

// Crypto payment types
export interface CryptoPaymentSummary {
    id: string
    userId: string
    user: {
        id: string
        email: string
        tier: string
        createdAt: Date
    }
    paymentId: string | null
    paymentStatus: string | null
    payAmount: number | null
    payCurrency: string | null
    actuallyPaid: number | null
    actuallyPaidCurrency: string | null
    tier: string
    invoiceId: string
    orderId: string
    paymentUrl: string
    payAddress: string | null
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
    paidAt: Date | null
}

export interface PaymentListQuery {
    userId?: string
    email?: string
    paymentStatus?: string
    tier?: 'free' | 'pro' | 'elite'
    paymentId?: string
    invoiceId?: string
    orderId?: string
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'updatedAt' | 'paidAt'
    sortOrder?: 'asc' | 'desc'
}

export interface PaymentListResponse {
    payments: CryptoPaymentSummary[]
    pagination: {
        total: number
        page: number
        limit: number
        pages: number
    }
}

export interface ManualUpgradeRequest {
    userId: string
    tier: 'pro' | 'elite'
    reason?: string
    expiresAt?: string
}
