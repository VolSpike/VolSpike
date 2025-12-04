import 'server-only'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { auth } from './auth'

type VerifyResult = {
    ok: boolean
    role?: 'admin' | 'user'
    userId?: string
    reason?: string
}

export async function verifyAccessTokenAndRole(token?: string): Promise<VerifyResult> {
    if (!token) return { ok: false, reason: 'NO_TOKEN' }

    try {
        // Verify JWT token
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
        const { payload } = await jwtVerify(token, secret)

        if (!payload.sub) {
            return { ok: false, reason: 'NO_USER_ID' }
        }

        // Extract role and user ID
        const userRole = payload.role as string
        const userId = payload.sub as string

        if (!userRole) {
            return { ok: false, reason: 'NO_ROLE' }
        }

        // Normalize role to 'admin' or 'user'
        const normalizedRole = userRole.toLowerCase() === 'admin' ? 'admin' : 'user'

        return { ok: true, role: normalizedRole, userId }
    } catch (error) {
        console.error('[AuthServer] Token verification failed:', error)
        return { ok: false, reason: 'INVALID_TOKEN' }
    }
}

// New function to get session from NextAuth
export async function getNextAuthSession() {
    try {
        const session = await auth()
        console.log('[AuthServer] NextAuth session:', session ? 'Found' : 'Not found')
        if (session?.user) {
            console.log('[AuthServer] Session user:', {
                id: session.user.id,
                email: session.user.email,
                role: (session.user as any).role
            })
        }
        return session
    } catch (error) {
        console.error('[AuthServer] Error getting NextAuth session:', error)
        return null
    }
}

export async function getServerAuthToken(): Promise<string | undefined> {
    try {
        // Try to get token from NextAuth session cookie
        const cookies = await import('next/headers').then(m => m.cookies())
        const sessionToken = cookies.get('next-auth.session-token')?.value
        console.log('[AuthServer] NextAuth session token found:', !!sessionToken)

        if (sessionToken) {
            return sessionToken
        }

        // Fallback to custom auth token cookie
        const authToken = cookies.get('auth_token')?.value
        console.log('[AuthServer] Custom auth token found:', !!authToken)
        return authToken
    } catch (error) {
        console.error('[AuthServer] Error getting auth token:', error)
        return undefined
    }
}

