import { Hono } from 'hono'
import { requireAdmin } from '../../middleware/admin-auth'
import { adminUserRoutes } from './users'
import { adminSubscriptionRoutes } from './subscriptions'
import { adminPaymentRoutes } from './payments'
import { adminAuditRoutes } from './audit'
import { adminMetricsRoutes } from './metrics'
import { adminSettingsRoutes } from './settings'
import { adminAssetRoutes } from './assets'
import { adminWalletRoutes } from './wallets'
import { adminNotificationRoutes } from './notifications'
import type { AppBindings, AppVariables } from '../../types/hono'

const adminRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Admin health check (before middleware so it can be tested)
adminRoutes.get('/health', async (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    })
})

// Apply global middleware to all other admin routes
adminRoutes.use('/*', requireAdmin)

// Mount sub-routes - IMPORTANT: Use basePath option
adminRoutes.route('/users', adminUserRoutes)
adminRoutes.route('/subscriptions', adminSubscriptionRoutes)
adminRoutes.route('/payments', adminPaymentRoutes)
adminRoutes.route('/audit', adminAuditRoutes)
adminRoutes.route('/metrics', adminMetricsRoutes)
adminRoutes.route('/settings', adminSettingsRoutes)
adminRoutes.route('/assets', adminAssetRoutes)
adminRoutes.route('/wallets', adminWalletRoutes)
adminRoutes.route('/notifications', adminNotificationRoutes)

// Admin dashboard overview
adminRoutes.get('/', async (c) => {
    const user = c.get('adminUser')

    return c.json({
        message: 'Admin API is running',
        user: user ? {
            id: user.id,
            email: user.email,
            role: user.role,
            tier: user.tier,
        } : null,
        timestamp: new Date().toISOString(),
    })
})

export { adminRoutes }
