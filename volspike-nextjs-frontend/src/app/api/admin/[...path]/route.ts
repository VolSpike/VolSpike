import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BACKEND_API_URL =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://volspike-production.up.railway.app'

function buildBackendUrl(request: NextRequest, pathParts: string[]): URL {
    const joinedPath = pathParts.map(encodeURIComponent).join('/')
    const url = new URL(`${BACKEND_API_URL.replace(/\/$/, '')}/api/admin/${joinedPath}`)
    url.search = request.nextUrl.search
    return url
}

async function proxyAdminRequest(
    request: NextRequest,
    pathParts: string[]
): Promise<NextResponse> {
    const targetUrl = buildBackendUrl(request, pathParts)

    // Prefer explicit Authorization header from the client (some admin pages pass accessToken),
    // but fall back to the current NextAuth session if it's missing.
    let authorization = request.headers.get('authorization')
    if (!authorization) {
        const session = await auth()
        const accessToken = (session as any)?.accessToken as string | undefined
        if (accessToken) authorization = `Bearer ${accessToken}`
    }

    const headers = new Headers()
    const contentType = request.headers.get('content-type')
    const accept = request.headers.get('accept')

    if (authorization) headers.set('authorization', authorization)
    if (contentType) headers.set('content-type', contentType)
    if (accept) headers.set('accept', accept)
    headers.set('x-forwarded-host', request.headers.get('host') || 'volspike.com')
    headers.set('x-auth-source', 'nextjs-admin-proxy')

    const method = request.method.toUpperCase()
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody ? await request.arrayBuffer() : undefined

    const backendResponse = await fetch(targetUrl, {
        method,
        headers,
        body: body ? body : undefined,
        cache: 'no-store',
    })

    const responseBody = await backendResponse.arrayBuffer()
    const responseHeaders = new Headers()

    const passthroughHeaders = [
        'content-type',
        'cache-control',
        'x-total-count',
        'x-page-count',
    ]
    for (const headerName of passthroughHeaders) {
        const value = backendResponse.headers.get(headerName)
        if (value) responseHeaders.set(headerName, value)
    }

    return new NextResponse(responseBody, {
        status: backendResponse.status,
        headers: responseHeaders,
    })
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params
    return proxyAdminRequest(request, path)
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params
    return proxyAdminRequest(request, path)
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params
    return proxyAdminRequest(request, path)
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params
    return proxyAdminRequest(request, path)
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params
    return proxyAdminRequest(request, path)
}
