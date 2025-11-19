import { MiddlewareHandler } from 'hono'
import { UserStatus } from '@prisma/client'
import { jwtVerify } from 'jose'
import { prisma } from '../index'
import type { AppBindings, AppVariables } from '../types/hono'

export const authMiddleware: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> = async (c, next) => {
    try {
        const authHeader = c.req.header('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Missing or invalid authorization header' }, 401)
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix

        let userId: string | null = null

        console.log('[Auth] Incoming authenticated request', {
            path: c.req.path,
            method: c.req.method,
            tokenPreview: token.substring(0, 16) + '...',
        })

        // ✅ Check if it's a simple user ID (from NextAuth session)
        if (!token.includes('.') && !token.startsWith('mock-token-')) {
            // Simple user ID token (e.g., "1")
            userId = token
            console.log(`[Auth] Using simple user ID token: ${userId}`)
        }
        // ✅ Handle mock tokens (development or test accounts)
        else if (token.startsWith('mock-token-')) {
            const match = token.match(/^mock-token-(.+?)-\d+$/)
            if (match) {
                userId = match[1]
                console.log(`[Auth] Mock token accepted for user ID: ${userId}`)
            } else {
                return c.json({ error: 'Invalid mock token format' }, 401)
            }
        }
        // ✅ Verify real JWT tokens
        else {
            try {
                const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
                const secretBytes = new TextEncoder().encode(secret)
                const { payload } = await jwtVerify(token, secretBytes)

                if (!payload.sub) {
                    console.error('[Auth] JWT has no sub claim')
                    return c.json({ error: 'Invalid token payload' }, 401)
                }

                userId = payload.sub as string
                console.log(`[Auth] JWT verified for user ID: ${userId}`)
            } catch (jwtError) {
                console.error('[Auth] JWT verification failed:', jwtError instanceof Error ? jwtError.message : jwtError)
                return c.json({ error: 'Invalid token' }, 401)
            }
        }

        if (!userId) {
            console.error('[Auth] No user ID extracted from token')
            return c.json({ error: 'Invalid token' }, 401)
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                tier: true,
                refreshInterval: true,
                theme: true,
                status: true,
            },
        })

        if (!user) {
            console.error('[Auth] User not found for authenticated request', {
                userId,
                path: c.req.path,
                method: c.req.method,
            })
            // Treat missing users as "not found" to support hard-delete invariants
            return c.json({ error: 'User not found' }, 404)
        }

        // Block access for suspended or banned accounts even if a token still exists
        if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
            const reason = user.status === UserStatus.BANNED ? 'banned' : 'suspended'
            console.warn('[Auth] Blocked request from non-active user', {
                userId: user.id,
                email: user.email,
                status: user.status,
                path: c.req.path,
                method: c.req.method,
            })
            return c.json({ error: `Account ${reason}` }, 403)
        }

        console.log(`[Auth] ✅ Authenticated user: ${user.email} (${user.tier} tier)`)

        // Add user to context with proper typing
        c.set('user', user)

        await next()
    } catch (error) {
        console.error('[Auth] Unexpected error:', error instanceof Error ? error.message : error)
        return c.json({ error: 'Authentication error' }, 401)
    }
}
