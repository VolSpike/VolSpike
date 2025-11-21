import { AdminUser, UserListQuery, UserListResponse, CreateUserRequest, UpdateUserRequest, BulkActionRequest, AuditLogResponse, AuditLogQuery, SystemMetrics, SubscriptionSummary, AdminSettings, TwoFactorSetup, TwoFactorVerification, UserGrowthMetrics } from '@/types/admin'
import type { AssetRecord } from '@/lib/asset-manifest'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class AdminAPIError extends Error {
    constructor(
        message: string,
        public status: number,
        public response?: any
    ) {
        super(message)
        this.name = 'AdminAPIError'
    }
}

class AdminAPIClient {
    private baseURL: string
    private accessToken: string | null = null

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL
    }

    // Set access token
    setAccessToken(token: string | null) {
        this.accessToken = token
    }

    // Get headers for requests
    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        }

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`
        }

        return headers
    }

    // Make API request
    private async request<T>(
        endpoint: string,
        options: RequestInit & { timeout?: number } = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`
        const { timeout, ...fetchOptions } = options

        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
                headers: {
                    ...this.getHeaders(),
                    ...fetchOptions.headers,
                },
            })

            if (timeoutId) clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new AdminAPIError(
                    errorData.error || `HTTP ${response.status}`,
                    response.status,
                    errorData
                )
            }

            return response.json()
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId)
            if (error instanceof Error && error.name === 'AbortError') {
                throw new AdminAPIError('Request timeout', 408, { error: 'Request timeout' })
            }
            throw error
        }
    }

    // User Management API
    async getUsers(query: Partial<UserListQuery> = {}): Promise<UserListResponse> {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value))
            }
        })

        return this.request<UserListResponse>(`/api/admin/users?${params.toString()}`)
    }

    async getUserById(userId: string): Promise<{ user: AdminUser; subscription?: any }> {
        return this.request<{ user: AdminUser; subscription?: any }>(`/api/admin/users/${userId}`)
    }

    // FIX: Change from optional to explicit null union - ensures field is always present in JSON
    // JSON.stringify omits undefined but preserves null, so we need explicit null type
    async createUser(data: CreateUserRequest): Promise<{ user: AdminUser; temporaryPassword: string | null }> {
        return this.request<{ user: AdminUser; temporaryPassword: string | null }>('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateUser(userId: string, data: UpdateUserRequest): Promise<{ user: AdminUser }> {
        return this.request<{ user: AdminUser }>(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    async deleteUser(userId: string, softDelete: boolean = false): Promise<{ success: boolean; deleted: boolean; softDelete: boolean }> {
        // Default is hard delete (permanent removal)
        // Pass softDelete=true to mark as BANNED instead
        const params = softDelete ? '?soft=true' : ''
        return this.request<{ success: boolean; deleted: boolean; softDelete: boolean }>(`/api/admin/users/${userId}${params}`, {
            method: 'DELETE',
        })
    }

    async suspendUser(userId: string): Promise<{ user: AdminUser }> {
        return this.request<{ user: AdminUser }>(`/api/admin/users/${userId}/suspend`, {
            method: 'POST',
        })
    }

    async resetUserPassword(userId: string): Promise<{ success: boolean; message: string; email?: string; oauthOnly?: boolean }> {
        try {
            return await this.request<{ success: boolean; message: string; email?: string; oauthOnly?: boolean }>(`/api/admin/users/${userId}/reset-password`, {
                method: 'POST',
            })
        } catch (error: any) {
            // Handle OAuth-only user error
            if (error.response?.oauthOnly) {
                return { success: false, message: error.message, oauthOnly: true }
            }
            throw error
        }
    }

    async executeBulkAction(data: BulkActionRequest): Promise<{ results: any[] }> {
        return this.request<{ results: any[] }>('/api/admin/users/bulk', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    // Audit Logs API
    async getAuditLogs(query: Partial<AuditLogQuery> = {}): Promise<AuditLogResponse> {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (value instanceof Date) {
                    params.append(key, value.toISOString())
                } else {
                    params.append(key, String(value))
                }
            }
        })

        return this.request<AuditLogResponse>(`/api/admin/audit?${params.toString()}`)
    }

    async getAuditLogById(logId: string): Promise<any> {
        return this.request<any>(`/api/admin/audit/${logId}`)
    }

    async searchAuditLogs(searchTerm: string, query: Partial<AuditLogQuery> = {}): Promise<any> {
        const params = new URLSearchParams()
        params.append('q', searchTerm)
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (value instanceof Date) {
                    params.append(key, value.toISOString())
                } else {
                    params.append(key, String(value))
                }
            }
        })

        return this.request<any>(`/api/admin/audit/search?${params.toString()}`)
    }

    async exportAuditLogs(query: Partial<AuditLogQuery>, format: 'csv' | 'json' | 'xlsx' = 'json'): Promise<string> {
        const params = new URLSearchParams()
        params.append('format', format)
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (value instanceof Date) {
                    params.append(key, value.toISOString())
                } else {
                    params.append(key, String(value))
                }
            }
        })

        const response = await fetch(`${this.baseURL}/api/admin/audit/export?${params.toString()}`, {
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            throw new AdminAPIError(`Export failed: ${response.status}`, response.status)
        }

        return response.text()
    }

    // Subscriptions API
    async getSubscriptions(query: any = {}): Promise<{ subscriptions: SubscriptionSummary[]; pagination: any }> {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value))
            }
        })

        return this.request<{ subscriptions: SubscriptionSummary[]; pagination: any }>(`/api/admin/subscriptions?${params.toString()}`)
    }

    async getSubscriptionById(subscriptionId: string): Promise<any> {
        return this.request<any>(`/api/admin/subscriptions/${subscriptionId}`)
    }

    async syncStripeSubscription(userId: string, forceSync: boolean = false): Promise<any> {
        return this.request<any>(`/api/admin/subscriptions/${userId}/sync`, {
            method: 'POST',
            body: JSON.stringify({ forceSync }),
        })
    }

    async cancelSubscription(userId: string): Promise<any> {
        return this.request<any>(`/api/admin/subscriptions/${userId}/subscription`, {
            method: 'DELETE',
        })
    }

    async processRefund(userId: string, data: any): Promise<any> {
        return this.request<any>(`/api/admin/subscriptions/${userId}/refund`, {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    // Metrics API
    async getSystemMetrics(period: string = '30d'): Promise<SystemMetrics> {
        return this.request<SystemMetrics>(`/api/admin/metrics?period=${period}`)
    }

    async getUserMetrics(period: string = '30d'): Promise<any> {
        return this.request<any>(`/api/admin/metrics/users?period=${period}`)
    }

    async getRevenueMetrics(period: string = '30d'): Promise<any> {
        return this.request<any>(`/api/admin/metrics/revenue?period=${period}`)
    }

    async getRevenueAnalytics(period: string = '1y'): Promise<any> {
        return this.request<any>(`/api/admin/metrics/revenue-analytics?period=${period}`)
    }

    async getUserGrowth(period: string = '30d'): Promise<UserGrowthMetrics> {
        return this.request<UserGrowthMetrics>(`/api/admin/metrics/user-growth?period=${period}`)
    }

    async getActivityMetrics(period: string = '30d'): Promise<any> {
        return this.request<any>(`/api/admin/metrics/activity?period=${period}`)
    }

    async getHealthMetrics(): Promise<any> {
        return this.request<any>('/api/admin/metrics/health')
    }

    // Settings API
    async getAdminSettings(): Promise<{ settings: AdminSettings; user: any }> {
        return this.request<{ settings: AdminSettings; user: any }>('/api/admin/settings')
    }

    async updateAdminSettings(data: Partial<AdminSettings>): Promise<{ settings: AdminSettings }> {
        return this.request<{ settings: AdminSettings }>('/api/admin/settings', {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    async getSecuritySettings(): Promise<any> {
        return this.request<any>('/api/admin/settings/security')
    }

    async setup2FA(password: string): Promise<TwoFactorSetup> {
        return this.request<TwoFactorSetup>('/api/admin/settings/2fa/setup', {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
    }

    async verify2FA(data: TwoFactorVerification): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>('/api/admin/settings/2fa/verify', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async disable2FA(): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>('/api/admin/settings/2fa', {
            method: 'DELETE',
        })
    }

    async changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>('/api/admin/settings/password', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async getActiveSessions(): Promise<{ sessions: any[] }> {
        return this.request<{ sessions: any[] }>('/api/admin/settings/sessions')
    }

    async revokeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>(`/api/admin/settings/sessions/${sessionId}`, {
            method: 'DELETE',
        })
    }

    // Payments API
    async getPayments(query: any = {}): Promise<any> {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value))
            }
        })
        return this.request<any>(`/api/admin/payments?${params.toString()}`)
    }

    async getPaymentById(paymentId: string): Promise<any> {
        return this.request<any>(`/api/admin/payments/${paymentId}`)
    }

    async manualUpgrade(data: { userId: string; tier: 'pro' | 'elite'; reason?: string; expiresAt?: string }): Promise<any> {
        return this.request<any>('/api/admin/payments/manual-upgrade', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async retryWebhook(paymentId: string): Promise<any> {
        return this.request<any>(`/api/admin/payments/${paymentId}/retry-webhook`, {
            method: 'POST',
        })
    }

    async syncFromNowPayments(paymentId: string, reason?: string): Promise<any> {
        return this.request<any>('/api/admin/payments/sync-from-nowpayments', {
            method: 'POST',
            body: JSON.stringify({ paymentId, reason }),
        })
    }

    async createPaymentFromNowPayments(data: {
        userId: string
        paymentId?: string
        orderId: string
        invoiceId?: string
        amount: number
        currency?: string
        tier: 'pro' | 'elite'
        actuallyPaid?: number
        actuallyPaidCurrency?: string
    }): Promise<any> {
        return this.request<any>('/api/admin/payments/create-from-nowpayments', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    // Assets API
    async getAssets(query: { q?: string; status?: string; page?: number; limit?: number } = {}): Promise<{ assets: AssetRecord[]; pagination: any }> {
        const params = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value))
            }
        })

        console.log('[AdminAPIClient] Fetching assets with params:', query, 'URL:', `/api/admin/assets?${params.toString()}`)

        try {
            const result = await this.request<{ assets: AssetRecord[]; pagination: any }>(`/api/admin/assets?${params.toString()}`)
            console.log('[AdminAPIClient] Successfully fetched assets:', {
                count: result.assets?.length || 0,
                pagination: result.pagination
            })
            return result
        } catch (error) {
            console.error('[AdminAPIClient] Failed to fetch assets:', {
                error,
                query,
                url: `/api/admin/assets?${params.toString()}`
            })
            throw error
        }
    }

    async saveAsset(data: AssetRecord & { id?: string }): Promise<{ asset: AssetRecord }> {
        return this.request<{ asset: AssetRecord }>('/api/admin/assets', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async deleteAsset(id: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(`/api/admin/assets/${id}`, {
            method: 'DELETE',
        })
    }

    async refreshAsset(id: string): Promise<{ success: boolean; asset: AssetRecord; message: string }> {
        return this.request<{ success: boolean; asset: AssetRecord; message: string }>(`/api/admin/assets/${id}/refresh`, {
            method: 'POST',
        })
    }

    async bulkRefreshAssets(options?: { ids?: string[]; symbols?: string[]; limit?: number }): Promise<{
        success: boolean
        refreshed: number
        total: number
        results: Array<{ symbol: string; success: boolean; reason?: string; error?: string }>
        message: string
    }> {
        return this.request<{
            success: boolean
            refreshed: number
            total: number
            results: Array<{ symbol: string; success: boolean; reason?: string; error?: string }>
            message: string
        }>('/api/admin/assets/refresh/bulk', {
            method: 'POST',
            body: JSON.stringify(options || {}),
            timeout: 120000, // 120 seconds for bulk operations (10 assets × 7s delay = ~70s)
        })
    }

    async runRefreshCycle(): Promise<{
        success: boolean
        refreshed: number
        candidates: string[]
        total: number
        results?: Array<{ symbol: string; success: boolean; error?: string }>
        message: string
    }> {
        return this.request<{
            success: boolean
            refreshed: number
            candidates: string[]
            total: number
            results?: Array<{ symbol: string; success: boolean; error?: string }>
            message: string
        }>('/api/admin/assets/refresh/cycle', {
            method: 'POST',
            timeout: 180000, // 180 seconds (3 minutes) for cycle (30 assets × 3s delay = ~90s + API time)
        })
    }

    async syncFromBinance(): Promise<{
        success: boolean
        synced: number
        created: number
        updated: number
        skipped?: number
        errors?: number
        total: number
        processed: number
        duration?: string
        message: string
        results?: Array<{ symbol: string; action: string; error?: string }>
    }> {
        return this.request<{
            success: boolean
            synced: number
            created: number
            updated: number
            skipped?: number
            errors?: number
            total: number
            processed: number
            duration?: string
            message: string
            results?: Array<{ symbol: string; action: string; error?: string }>
        }>('/api/admin/assets/sync-binance', {
            method: 'POST',
        })
    }

    // Health check
    async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
        return this.request<{ status: string; timestamp: string; version: string }>('/api/admin/health')
    }
}

// Create singleton instance
export const adminAPI = new AdminAPIClient()

// Export class for creating instances with different tokens
export { AdminAPIClient }

// Export error class
export { AdminAPIError }
