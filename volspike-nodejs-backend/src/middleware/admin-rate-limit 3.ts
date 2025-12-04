import { Context, Next } from 'hono'
import { createLogger } from '../lib/logger'
import { RateLimitConfig, RateLimitInfo } from '../types/admin'
import { AuditAction, AuditTargetType } from '../types/audit-consts'
import { CreateAuditLogData } from '../types/audit'

const logger = createLogger()

// Rate limit storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Admin-specific rate limits
const ADMIN_RATE_LIMITS: Record<string, RateLimitConfig> = {
    login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
    api: { windowMs: 1 * 60 * 1000, maxRequests: 100 }, // 100 requests per minute
    mutation: { windowMs: 1 * 60 * 1000, maxRequests: 20 }, // 20 mutations per minute
    bulk: { windowMs: 5 * 60 * 1000, maxRequests: 5 }, // 5 bulk actions per 5 minutes
    export: { windowMs: 10 * 60 * 1000, maxRequests: 3 }, // 3 exports per 10 minutes
}

export async function adminRateLimit(c: Context, next: Next) {
    const user = c.get('adminUser')

    if (!user) {
        await next()
        return
    }

    const path = c.req.path
    const method = c.req.method
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    // Determine rate limit type based on path and method
    const rateLimitType = determineRateLimitType(path, method)
    const config = ADMIN_RATE_LIMITS[rateLimitType]

    if (!config) {
        await next()
        return
    }

    // Create rate limit key
    const key = `${user.id}:${rateLimitType}:${clientIP}`

    try {
        const rateLimitInfo = await checkRateLimit(key, config)

        if (!rateLimitInfo.allowed) {
            logger.warn(`Rate limit exceeded for admin ${user.email}: ${rateLimitType}`)
            await logRateLimitViolation(user.id, rateLimitType, clientIP)

            return c.json({
                error: 'Rate limit exceeded',
                retryAfter: rateLimitInfo.retryAfter,
                limit: rateLimitInfo.limit,
                remaining: rateLimitInfo.remaining,
                reset: rateLimitInfo.reset,
            }, 429)
        }

        // Set rate limit headers
        c.header('X-RateLimit-Limit', rateLimitInfo.limit.toString())
        c.header('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
        c.header('X-RateLimit-Reset', rateLimitInfo.reset.getTime().toString())

        if (rateLimitInfo.retryAfter) {
            c.header('Retry-After', rateLimitInfo.retryAfter.toString())
        }

        await next()
    } catch (error) {
        logger.error('Rate limiting error:', error)
        await next() // Don't block on rate limit errors
    }
}

export async function checkRateLimit(
    key: string,
    config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfter?: number; limit: number; remaining: number; reset: Date }> {
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Clean up expired entries
    cleanupExpiredEntries(windowStart)

    const entry = rateLimitStore.get(key)

    if (!entry || entry.resetTime <= now) {
        // Create new entry
        const resetTime = now + config.windowMs
        rateLimitStore.set(key, {
            count: 1,
            resetTime,
        })

        return {
            allowed: true,
            limit: config.maxRequests,
            remaining: config.maxRequests - 1,
            reset: new Date(resetTime),
        }
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

        return {
            allowed: false,
            retryAfter,
            limit: config.maxRequests,
            remaining: 0,
            reset: new Date(entry.resetTime),
        }
    }

    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)

    return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - entry.count,
        reset: new Date(entry.resetTime),
    }
}

export async function resetRateLimit(key: string) {
    rateLimitStore.delete(key)
}

export async function resetUserRateLimits(userId: string) {
    const keysToDelete = Array.from(rateLimitStore.keys()).filter(key =>
        key.startsWith(`${userId}:`)
    )

    keysToDelete.forEach(key => rateLimitStore.delete(key))

    logger.info(`Reset rate limits for user ${userId}: ${keysToDelete.length} keys`)
}

// Helper functions
function determineRateLimitType(path: string, method: string): string {
    // Login attempts
    if (path.includes('/auth/login') && method === 'POST') {
        return 'login'
    }

    // Bulk actions
    if (path.includes('/bulk') && method === 'POST') {
        return 'bulk'
    }

    // Export operations
    if (path.includes('/export') && method === 'GET') {
        return 'export'
    }

    // Mutations (POST, PUT, PATCH, DELETE)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return 'mutation'
    }

    // General API calls
    return 'api'
}

function cleanupExpiredEntries(windowStart: number) {
    const expiredKeys: string[] = []

    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime <= windowStart) {
            expiredKeys.push(key)
        }
    }

    expiredKeys.forEach(key => rateLimitStore.delete(key))

    if (expiredKeys.length > 0) {
        logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`)
    }
}

async function logRateLimitViolation(
    userId: string,
    rateLimitType: string,
    clientIP: string
) {
    try {
        const auditData: CreateAuditLogData = {
            actorUserId: userId,
            action: AuditAction.RATE_LIMIT_EXCEEDED,
            targetType: AuditTargetType.SECURITY,
            metadata: {
                additionalContext: { rateLimitType, clientIP },
            },
        }

        // Note: This would need to be imported from a service
        // await auditService.createAuditLog(auditData)
    } catch (error) {
        logger.error('Failed to log rate limit violation:', error)
    }
}

// Rate limit statistics
export function getRateLimitStats(): {
    totalKeys: number
    activeKeys: number
    expiredKeys: number
} {
    const now = Date.now()
    let activeKeys = 0
    let expiredKeys = 0

    for (const [, entry] of rateLimitStore.entries()) {
        if (entry.resetTime > now) {
            activeKeys++
        } else {
            expiredKeys++
        }
    }

    return {
        totalKeys: rateLimitStore.size,
        activeKeys,
        expiredKeys,
    }
}

// Rate limit configuration validation
export function validateRateLimitConfig(): boolean {
    for (const [type, config] of Object.entries(ADMIN_RATE_LIMITS)) {
        if (config.windowMs <= 0) {
            logger.error(`Invalid windowMs for rate limit type ${type}`)
            return false
        }

        if (config.maxRequests <= 0) {
            logger.error(`Invalid maxRequests for rate limit type ${type}`)
            return false
        }
    }

    return true
}

// Initialize rate limiting
export function initializeRateLimiting() {
    if (!validateRateLimitConfig()) {
        logger.error('Rate limiting initialization failed')
        return false
    }

    // Start cleanup interval
    setInterval(() => {
        const windowStart = Date.now() - Math.max(...Object.values(ADMIN_RATE_LIMITS).map(c => c.windowMs))
        cleanupExpiredEntries(windowStart)
    }, 60 * 1000) // Every minute

    logger.info('Admin rate limiting initialized')
    return true
}

// Custom rate limit for specific operations
export function createCustomRateLimit(config: RateLimitConfig) {
    return async (c: Context, next: Next) => {
        const user = c.get('adminUser')

        if (!user) {
            await next()
            return
        }

        const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
        const key = `custom:${user.id}:${clientIP}`

        const rateLimitInfo = await checkRateLimit(key, config)

        if (!rateLimitInfo.allowed) {
            return c.json({
                error: 'Custom rate limit exceeded',
                retryAfter: rateLimitInfo.retryAfter,
            }, 429)
        }

        await next()
    }
}
