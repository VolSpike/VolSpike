'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { trackEmailVerification } from '@/lib/analytics'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function EmailVerificationContent() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
    const [message, setMessage] = useState('')
    const [isResending, setIsResending] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()

    const token = searchParams.get('token')
    const email = searchParams.get('email')

    useEffect(() => {
        if (token && email) {
            verifyEmail()
        } else {
            setStatus('error')
            setMessage('Invalid verification link')
        }
    }, [token, email])

    const verifyEmail = async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, email }),
            })

            const data = await response.json()

            if (response.ok) {
                setStatus('success')
                setMessage(data.message || 'Email verified successfully!')
                
                // Track successful email verification
                trackEmailVerification()
            } else {
                if (response.status === 400) {
                    setStatus('expired')
                    setMessage('This verification link has expired or is invalid.')
                } else {
                    setStatus('error')
                    setMessage(data.error || 'Failed to verify email')
                }
            }
        } catch (error) {
            setStatus('error')
            setMessage('Network error. Please try again.')
        }
    }

    const resendVerification = async () => {
        if (!email) return

        setIsResending(true)
        try {
            const response = await fetch(`${API_URL}/api/auth/request-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (response.ok) {
                setMessage('A new verification email has been sent to your inbox.')
            } else {
                setMessage(data.error || 'Failed to resend verification email')
            }
        } catch (error) {
            setMessage('Network error. Please try again.')
        } finally {
            setIsResending(false)
        }
    }

    const getStatusIcon = () => {
        switch (status) {
            case 'loading':
                return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            case 'success':
                return <CheckCircle className="h-8 w-8 text-green-500" />
            case 'error':
            case 'expired':
                return <XCircle className="h-8 w-8 text-red-500" />
            default:
                return <Mail className="h-8 w-8 text-gray-500" />
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case 'success':
                return 'border-green-500 bg-green-50 dark:bg-green-950'
            case 'error':
            case 'expired':
                return 'border-red-500 bg-red-50 dark:bg-red-950'
            default:
                return 'border-blue-500 bg-blue-50 dark:bg-blue-950'
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        {getStatusIcon()}
                    </div>
                    <CardTitle className="text-xl font-semibold">
                        {status === 'loading' && 'Verifying Email...'}
                        {status === 'success' && 'Email Verified!'}
                        {(status === 'error' || status === 'expired') && 'Verification Failed'}
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <Alert className={getStatusColor()}>
                        <AlertDescription className="text-center">
                            {message}
                        </AlertDescription>
                    </Alert>

                    {status === 'success' && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                Your email has been successfully verified. You can now access all features of VolSpike.
                            </p>
                            <Button
                                onClick={() => router.push('/auth')}
                                className="w-full"
                            >
                                Continue to Sign In
                            </Button>
                        </div>
                    )}

                    {(status === 'error' || status === 'expired') && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                {status === 'expired'
                                    ? 'This verification link has expired. Please request a new one.'
                                    : 'There was an error verifying your email. Please try again.'
                                }
                            </p>

                            {email && (
                                <Button
                                    onClick={resendVerification}
                                    disabled={isResending}
                                    variant="outline"
                                    className="w-full"
                                >
                                    {isResending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Resend Verification Email'
                                    )}
                                </Button>
                            )}

                            <Button
                                onClick={() => router.push('/auth')}
                                variant="ghost"
                                className="w-full"
                            >
                                Back to Sign In
                            </Button>
                        </div>
                    )}

                    {status === 'loading' && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                            Please wait while we verify your email address...
                        </p>
                    )}
                </CardContent>
            </Card>
        </main>
    )
}

export default function EmailVerificationPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                        <CardTitle className="text-xl font-semibold">Loading...</CardTitle>
                    </CardHeader>
                </Card>
            </main>
        }>
            <EmailVerificationContent />
        </Suspense>
    )
}
