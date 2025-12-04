import { Context, Next } from 'hono'
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

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

        const current = await redis.incr(key)

        if (current === 1) {
            await redis.expire(key, Math.ceil(config.windowMs / 1000))
        }

        const maxRequests = config.maxRequests * config.tierMultiplier

        if (current > maxRequests) {
            return c.json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil(config.windowMs / 1000)
            }, 429)
        }

        // Add rate limit headers
        c.header('X-RateLimit-Limit', maxRequests.toString())
        c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString())
        c.header('X-RateLimit-Reset', Math.ceil((Date.now() + config.windowMs) / 1000).toString())

        await next()
    } catch (error) {
        console.error('Rate limit middleware error:', error)
        // Don't block requests if Redis is down
        await next()
    }
}
