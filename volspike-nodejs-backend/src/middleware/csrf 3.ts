import { Context, Next } from 'hono'
import { setCookie } from 'hono/cookie'
import { createLogger } from '../lib/logger'
import { CSRFToken, CSRFConfig } from '../types/admin'
import { AuditAction, AuditTargetType } from '../types/audit-consts'
import { CreateAuditLogData } from '../types/audit'

const logger = createLogger()

const CSRF_CONFIG: CSRFConfig = {
    secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
    tokenLength: 32,
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
}

// CSRF token storage (in production, use Redis or database)
const csrfTokens = new Map<string, CSRFToken>()

export async function csrfProtection(c: Context, next: Next) {
    const method = c.req.method

    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        await next()
        return
    }

    const user = c.get('adminUser')
    if (!user) {
        await next()
        return
    }

    try {
        const token = c.req.header(CSRF_CONFIG.headerName)
        const cookieToken = c.req.header('cookie')?.split(';').find(c => c.trim().startsWith(`${CSRF_CONFIG.cookieName}=`))?.split('=')[1]

        if (!token || !cookieToken) {
            logger.warn(`CSRF token missing for admin ${user.email}`)
            await logCSRFViolation(user.id, 'MISSING_TOKEN')
            return c.json({ error: 'CSRF token required' }, 403)
        }

        // Verify token
        const isValid = await verifyCSRFToken(token, cookieToken, user.id)

        if (!isValid) {
            logger.warn(`Invalid CSRF token for admin ${user.email}`)
            await logCSRFViolation(user.id, 'INVALID_TOKEN')
            return c.json({ error: 'Invalid CSRF token' }, 403)
        }

        // Token is valid, continue
        await next()
    } catch (error) {
        logger.error('CSRF protection error:', error)
        return c.json({ error: 'CSRF validation failed' }, 403)
    }
}

export async function generateCSRFToken(userId: string): Promise<string> {
    const token = generateSecureToken(CSRF_CONFIG.tokenLength)
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)) // 1 hour

    const csrfToken: CSRFToken = {
        token,
        expiresAt,
    }

    // Store token with user ID as key
    csrfTokens.set(`${userId}:${token}`, csrfToken)

    // Clean up expired tokens
    cleanupExpiredTokens()

    return token
}

export async function verifyCSRFToken(
    headerToken: string,
    cookieToken: string,
    userId: string
): Promise<boolean> {
    try {
        // Tokens must match
        if (headerToken !== cookieToken) {
            return false
        }

        // Check if token exists and is valid
        const storedToken = csrfTokens.get(`${userId}:${headerToken}`)

        if (!storedToken) {
            return false
        }

        // Check if token is expired
        if (storedToken.expiresAt < new Date()) {
            csrfTokens.delete(`${userId}:${headerToken}`)
            return false
        }

        return true
    } catch (error) {
        logger.error('CSRF token verification error:', error)
        return false
    }
}

export async function invalidateCSRFToken(userId: string, token: string) {
    csrfTokens.delete(`${userId}:${token}`)
}

export async function invalidateAllCSRFTokens(userId: string) {
    const keysToDelete = Array.from(csrfTokens.keys()).filter(key =>
        key.startsWith(`${userId}:`)
    )

    keysToDelete.forEach(key => csrfTokens.delete(key))
}

// Middleware to set CSRF token in response
export async function setCSRFToken(c: Context, next: Next) {
    const user = c.get('adminUser')

    if (user) {
        const token = await generateCSRFToken(user.id)

        // Set token in cookie
        setCookie(c, CSRF_CONFIG.cookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60, // 1 hour
        })

        // Set token in response header for frontend
        c.header('X-CSRF-Token', token)
    }

    await next()
}

// Helper functions
async function logCSRFViolation(userId: string, reason: string) {
    try {
        const auditData: CreateAuditLogData = {
            actorUserId: userId,
            action: AuditAction.CSRF_VIOLATION,
            targetType: AuditTargetType.SECURITY,
            metadata: {
                additionalContext: { reason },
            },
        }

        // Note: This would need to be imported from a service
        // await auditService.createAuditLog(auditData)
    } catch (error) {
        logger.error('Failed to log CSRF violation:', error)
    }
}

function generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
}

function cleanupExpiredTokens() {
    const now = new Date()
    const expiredKeys: string[] = []

    for (const [key, token] of csrfTokens.entries()) {
        if (token.expiresAt < now) {
            expiredKeys.push(key)
        }
    }

    expiredKeys.forEach(key => csrfTokens.delete(key))

    if (expiredKeys.length > 0) {
        logger.info(`Cleaned up ${expiredKeys.length} expired CSRF tokens`)
    }
}

// CSRF token rotation (run periodically)
export async function rotateCSRFTokens() {
    const now = new Date()
    const rotationThreshold = new Date(now.getTime() - (30 * 60 * 1000)) // 30 minutes ago

    const tokensToRotate: string[] = []

    for (const [key, token] of csrfTokens.entries()) {
        if (token.expiresAt < rotationThreshold) {
            tokensToRotate.push(key)
        }
    }

    tokensToRotate.forEach(key => csrfTokens.delete(key))

    if (tokensToRotate.length > 0) {
        logger.info(`Rotated ${tokensToRotate.length} CSRF tokens`)
    }
}

// CSRF configuration validation
export function validateCSRFConfig(): boolean {
    if (!CSRF_CONFIG.secret || CSRF_CONFIG.secret === 'default-csrf-secret-change-in-production') {
        logger.warn('CSRF secret is not configured properly')
        return false
    }

    if (CSRF_CONFIG.tokenLength < 16) {
        logger.warn('CSRF token length is too short')
        return false
    }

    return true
}

// Initialize CSRF protection
export function initializeCSRFProtection() {
    if (!validateCSRFConfig()) {
        logger.error('CSRF protection initialization failed')
        return false
    }

    // Start token cleanup interval
    setInterval(cleanupExpiredTokens, 5 * 60 * 1000) // Every 5 minutes
    setInterval(rotateCSRFTokens, 30 * 60 * 1000) // Every 30 minutes

    logger.info('CSRF protection initialized')
    return true
}
