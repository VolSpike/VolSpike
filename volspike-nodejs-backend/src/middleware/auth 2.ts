import { Context, Next } from 'hono'
import { jwtVerify } from 'jose'
import { prisma } from '../index'
import { User } from '../types'

export async function authMiddleware(c: Context, next: Next) {
    try {
        const authHeader = c.req.header('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Missing or invalid authorization header' }, 401)
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix

        let userId: string | null = null

        console.log(`[Auth] Received token: ${token.substring(0, 50)}...`)

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
            },
        })

        if (!user) {
            console.error(`[Auth] User not found for ID: ${userId}`)
            return c.json({ error: 'User not found' }, 401)
        }

        console.log(`[Auth] ✅ Authenticated user: ${user.email} (${user.tier} tier)`)

        // Add user to context with proper typing
        c.set('user', user as User)

        await next()
    } catch (error) {
        console.error('[Auth] Unexpected error:', error instanceof Error ? error.message : error)
        return c.json({ error: 'Authentication error' }, 401)
    }
}
