import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://volspike-production.up.railway.app'
        const authToken = (session as any)?.accessToken || session.user.id

        // Fetch fresh user data from backend
        const response = await fetch(`${apiUrl}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch user data' },
                { status: response.status }
            )
        }

        const { user } = await response.json()

        return NextResponse.json({
            success: true,
            user: {
                tier: user.tier,
                email: user.email,
                id: user.id,
            },
        })
    } catch (error) {
        console.error('[API] Refresh session error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

