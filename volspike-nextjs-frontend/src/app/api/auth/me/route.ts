import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Server-side proxy for backend /api/auth/me.
 * - Uses NextAuth session to resolve the current user.
 * - Calls the Hono backend with a stable userId-based token.
 * - Forwards status codes and JSON body as-is so clients can rely on them.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            console.warn('[API Auth Me] No authenticated user in session')
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const apiUrl =
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.BACKEND_API_URL ||
            'https://volspike-production.up.railway.app'

        const userId = String((session.user as any).id)

        console.log('[API Auth Me] Proxying to backend /api/auth/me', {
            apiUrl,
            userId,
        })

        const backendResponse = await fetch(`${apiUrl}/api/auth/me`, {
            method: 'GET',
            headers: {
                // Use the database user id as a simple bearer token.
                Authorization: `Bearer ${userId}`,
                'X-Auth-Source': 'next-api-auth-me',
            },
            // Do not forward cookies – backend auth uses the bearer token only.
            cache: 'no-store',
        })

        const text = await backendResponse.text()

        console.log('[API Auth Me] Backend /api/auth/me response', {
            status: backendResponse.status,
            ok: backendResponse.ok,
        })

        return new NextResponse(text, {
            status: backendResponse.status,
            headers: {
                'Content-Type':
                    backendResponse.headers.get('content-type') || 'application/json',
            },
        })
    } catch (error: any) {
        console.error('[API Auth Me] Internal error:', error?.message || String(error))
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        )
    }
}
