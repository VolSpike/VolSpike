import { Context, Next } from 'hono'

// In-memory rate limit storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

interface RateLimitConfig {
    windowMs: number
    maxRequests: number
    tierMultiplier: number
}

const rateLimits: Record<string, RateLimitConfig> = {
    free: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        tierMultiplier: 1,
    },
    pro: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 500,
        tierMultiplier: 3,
    },
    elite: {
        windowMs: 1 * 60 * 1000, // 1 minute
        maxRequests: 1000,
        tierMultiplier: 5,
    },
}

export async function rateLimitMiddleware(c: Context, next: Next) {
    try {
        const user = c.get('user')
        const tier = user?.tier || 'free'
        const config = rateLimits[tier] || rateLimits.free

        const key = `rate_limit:${user.id}:${Math.floor(Date.now() / config.windowMs)}`
        const now = Date.now()

        // Get or create rate limit entry
        let entry = rateLimitStore.get(key)
        if (!entry || now > entry.resetTime) {
            entry = { count: 0, resetTime: now + config.windowMs }
            rateLimitStore.set(key, entry)
        }

        // Increment count
        entry.count++

        const maxRequests = config.maxRequests * config.tierMultiplier

        if (entry.count > maxRequests) {
            return c.json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((entry.resetTime - now) / 1000)
            }, 429)
        }

        // Add rate limit headers
        c.header('X-RateLimit-Limit', maxRequests.toString())
        c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString())
        c.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())

        await next()
    } catch (error) {
        console.error('Rate limit middleware error:', error)
        // Don't block requests on error
        await next()
    }
}
