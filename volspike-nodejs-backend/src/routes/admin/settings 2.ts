import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'

const logger = createLogger()
const adminSettingsRoutes = new Hono()

// Validation schemas
const updateSettingsSchema = z.object({
    adminEmailWhitelist: z.array(z.string().email()).optional(),
    adminIPWhitelist: z.array(z.string()).optional(),
    adminSessionDuration: z.number().min(300).max(86400).optional(),
    auditLogRetentionDays: z.number().min(30).max(365).optional(),
})

const passwordChangeSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(12),
    confirmPassword: z.string().min(12),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
})

// GET /api/admin/settings - Get admin settings
adminSettingsRoutes.get('/', async (c) => {
    try {
        const user = c.get('adminUser')

        // Get current settings from environment or defaults
        const settings = {
            adminEmailWhitelist: process.env.ADMIN_EMAIL_WHITELIST?.split(',') || [],
            adminIPWhitelist: process.env.ADMIN_IP_WHITELIST?.split(',') || [],
            adminSessionDuration: parseInt(process.env.ADMIN_SESSION_DURATION || '1800'),
            auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90'),
            rateLimitConfig: {
                login: { windowMs: 900000, maxRequests: 5 },
                api: { windowMs: 60000, maxRequests: 100 },
                mutation: { windowMs: 60000, maxRequests: 20 },
            },
        }

        return c.json({
            settings,
            user: user ? {
                id: user.id,
                email: user.email,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
                lastLoginAt: user.lastLoginAt,
            } : null,
        })
    } catch (error) {
        logger.error('Get admin settings error:', error)
        return c.json({ error: 'Failed to fetch admin settings' }, 500)
    }
})

// PATCH /api/admin/settings - Update admin settings
adminSettingsRoutes.patch('/', async (c) => {
    try {
        const body = await c.req.json()
        const data = updateSettingsSchema.parse(body)
        
        const adminUser = c.get('adminUser')
        logger.info(`Admin settings would be updated by ${adminUser?.email || 'unknown'}`)
        
        // For now, just return the updated settings
        // In production, save to database or config file
        return c.json({ 
            settings: data,
            message: 'Settings update would be saved (not implemented yet)' 
        })
    } catch (error) {
        logger.error('Update admin settings error:', error)
        return c.json({ error: 'Failed to update admin settings' }, 500)
    }
})

// GET /api/admin/settings/security - Get security settings
adminSettingsRoutes.get('/security', async (c) => {
    try {
        const user = c.get('adminUser')

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const activeSessions = await prisma.adminSession.count({
            where: { userId: user.id },
        })

        return c.json({
            twoFactorEnabled: user.twoFactorEnabled,
            lastPasswordChange: null, // Placeholder
            activeSessions,
            ipWhitelist: process.env.ADMIN_IP_WHITELIST?.split(',') || [],
            failedLoginAttempts: 0, // Placeholder
        })
    } catch (error) {
        logger.error('Get security settings error:', error)
        return c.json({ error: 'Failed to fetch security settings' }, 500)
    }
})

// POST /api/admin/settings/2fa/setup - Setup 2FA
adminSettingsRoutes.post('/2fa/setup', async (c) => {
    try {
        const user = c.get('adminUser')
        
        // For now, return mock data
        // Implement actual 2FA setup with speakeasy/otplib later
        return c.json({
            secret: 'MOCK-SECRET-KEY',
            qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            backupCodes: ['BACKUP-1', 'BACKUP-2', 'BACKUP-3'],
            message: '2FA setup would be implemented (not ready yet)',
        })
    } catch (error) {
        logger.error('Setup 2FA error:', error)
        return c.json({ error: 'Failed to setup 2FA' }, 500)
    }
})

// POST /api/admin/settings/2fa/verify - Verify 2FA
adminSettingsRoutes.post('/2fa/verify', async (c) => {
    try {
        const body = await c.req.json()
        
        // For now, just return success
        // Implement actual verification later
        const adminUser = c.get('adminUser')
        logger.info(`2FA verification attempted by ${adminUser?.email || 'unknown'}`)
        
        return c.json({ 
            success: true, 
            message: '2FA verification would be performed (not implemented yet)' 
        })
    } catch (error) {
        logger.error('Verify 2FA error:', error)
        return c.json({ error: 'Failed to verify 2FA' }, 500)
    }
})

// DELETE /api/admin/settings/2fa - Disable 2FA
adminSettingsRoutes.delete('/2fa', async (c) => {
    try {
        const user = c.get('adminUser')
        
        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        })

        logger.info(`2FA disabled for admin ${user.email}`)

        return c.json({ success: true, message: '2FA disabled successfully' })
    } catch (error) {
        logger.error('Disable 2FA error:', error)
        return c.json({ error: 'Failed to disable 2FA' }, 500)
    }
})

// POST /api/admin/settings/password - Change password
adminSettingsRoutes.post('/password', async (c) => {
    try {
        const body = await c.req.json()
        const data = passwordChangeSchema.parse(body)
        
        // For now, just return success
        // Implement actual password change later
        const adminUser = c.get('adminUser')
        logger.info(`Password change requested by ${adminUser?.email || 'unknown'}`)

        return c.json({ 
            success: true, 
            message: 'Password change would be performed (not implemented yet)' 
        })
    } catch (error) {
        logger.error('Change password error:', error)
        return c.json({ error: 'Failed to change password' }, 500)
    }
})

// GET /api/admin/settings/sessions - Get active sessions
adminSettingsRoutes.get('/sessions', async (c) => {
    try {
        const user = c.get('adminUser')
        
        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const sessions = await prisma.adminSession.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        })

        return c.json({ sessions })
    } catch (error) {
        logger.error('Get active sessions error:', error)
        return c.json({ error: 'Failed to fetch active sessions' }, 500)
    }
})

// DELETE /api/admin/settings/sessions/:sessionId - Revoke session
adminSettingsRoutes.delete('/sessions/:sessionId', async (c) => {
    try {
        const sessionId = c.req.param('sessionId')
        const user = c.get('adminUser')
        
        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        await prisma.adminSession.deleteMany({
            where: {
                id: sessionId,
                userId: user.id,
            },
        })

        logger.info(`Session ${sessionId} revoked by admin ${user.email}`)

        return c.json({ success: true, message: 'Session revoked successfully' })
    } catch (error) {
        logger.error('Revoke session error:', error)
        return c.json({ error: 'Failed to revoke session' }, 500)
    }
})

export { adminSettingsRoutes }
