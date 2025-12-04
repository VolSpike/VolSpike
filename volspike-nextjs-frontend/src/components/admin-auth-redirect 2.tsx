'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Shield, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Client component to handle admin authentication redirect after OAuth
 * Checks session and redirects appropriately
 */
export function AdminAuthRedirect() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)
    const [checking, setChecking] = useState(true)

    const nextUrl = searchParams?.get('next') || '/admin'
    const isAdminMode = searchParams?.get('mode') === 'admin'

    useEffect(() => {
        // Wait for session to load
        if (status === 'loading') {
            return
        }

        // Check session after a brief delay to ensure it's fully established
        const checkSession = async () => {
            setChecking(true)

            // Give NextAuth time to establish session after OAuth callback
            await new Promise(resolve => setTimeout(resolve, 500))

            // Refresh session to get latest data
            const response = await fetch('/api/auth/session')
            const latestSession = await response.json().catch(() => null)

            const userRole = latestSession?.user?.role || session?.user?.role

            if (latestSession?.user || session?.user) {
                if (userRole === 'ADMIN') {
                    // User is admin, redirect to admin dashboard
                    console.log('[AdminAuthRedirect] Admin session confirmed, redirecting to', nextUrl)
                    router.push(nextUrl)
                    router.refresh()
                } else {
                    // User is not admin
                    setError('Access denied. Administrator privileges required.')
                    setChecking(false)
                }
            } else {
                // No session found
                if (isAdminMode) {
                    // Stay on auth page in admin mode
                    setChecking(false)
                } else {
                    // Redirect to regular auth
                    router.push('/auth')
                }
            }
        }

        checkSession()
    }, [status, session, router, nextUrl, isAdminMode])

    // Show loading state while checking
    if (checking || status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm max-w-md w-full">
                    <CardHeader className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-blue-500/10 p-3">
                                <Shield className="h-8 w-8 text-blue-400 animate-pulse" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl text-white">Verifying Admin Access</CardTitle>
                        <CardDescription className="text-gray-400">
                            Please wait while we verify your administrator privileges...
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-6">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm max-w-md w-full">
                    <CardHeader className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-red-500/10 p-3">
                                <AlertCircle className="h-8 w-8 text-red-400" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl text-white">Access Denied</CardTitle>
                        <CardDescription className="text-gray-400">
                            {error}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-500 text-center">
                            Your account ({session?.user?.email || 'Unknown'}) does not have administrator privileges.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                            >
                                Go to Dashboard
                            </button>
                            <button
                                onClick={() => router.push('/auth?next=/admin&mode=admin')}
                                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return null
}

