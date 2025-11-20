import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Next.js API route that proxies a lightweight heartbeat to the backend.
 * - Confirms that the current session is still valid.
 * - Updates last active time via backend /api/auth/ping.
 * - Forwards status codes unchanged so the client can log out on 401/403/404.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            console.warn('[API Auth Ping] No authenticated user in session')
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const apiUrl =
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.BACKEND_API_URL ||
            'https://volspike-production.up.railway.app'

        const userId = String((session.user as any).id)

        console.log('[API Auth Ping] Proxying to backend /api/auth/ping', {
            apiUrl,
            userId,
        })

        const backendResponse = await fetch(`${apiUrl}/api/auth/ping`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${userId}`,
                'X-Auth-Source': 'next-api-auth-ping',
            },
            cache: 'no-store',
        })

        const text = await backendResponse.text()

        console.log('[API Auth Ping] Backend /api/auth/ping response', {
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
        console.error('[API Auth Ping] Internal error:', error?.message || String(error))
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        )
    }
}

