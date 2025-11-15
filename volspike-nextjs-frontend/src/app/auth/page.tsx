'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Mail } from 'lucide-react'
import { SigninForm } from '@/components/signin-form'
import { SignupForm } from '@/components/signup-form'
import { AdminAuthRedirect } from '@/components/admin-auth-redirect'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useWalletAuth } from '@/hooks/use-wallet-auth'
import { useAccount } from 'wagmi'
import { SolanaProvider } from '@/components/solana-providers'
import { PhantomSignInSection } from '@/components/phantom-signin-section'
import { WalletConnectButton } from '@/components/wallet-connect-button'
import { useSession } from 'next-auth/react'

// Dynamically import ConnectButton to handle hydration safely
const DynamicConnectButton = dynamic(
    () => import('@rainbow-me/rainbowkit').then(mod => ({ default: mod.ConnectButton })),
    {
        ssr: false,
        loading: () => (
            <Button
                disabled
                className="w-full border border-green-400/60 bg-transparent text-green-300"
            >
                Loading wallet...
            </Button>
        )
    }
)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function AuthPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const { data: session, status } = useSession()

    // Simple state management - no form hooks in parent
    const [tab, setTab] = useState<'signin' | 'signup'>(
        searchParams?.get('tab') === 'signup' ? 'signup' : 'signin'
    )
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [verificationMessage, setVerificationMessage] = useState('')
    const [showVerificationAlert, setShowVerificationAlert] = useState(false)
    const [resendEmail, setResendEmail] = useState('')
    const [initialAuthError, setInitialAuthError] = useState('')

    // Check if this is admin mode
    const isAdminMode = searchParams?.get('mode') === 'admin'
    const nextUrl = searchParams?.get('next') || (isAdminMode ? '/admin' : '/dashboard')

    // Check if user is already logged in and is admin - redirect immediately
    useEffect(() => {
        if (isAdminMode && status === 'authenticated') {
            // Give session a moment to fully establish after OAuth callback
            const checkAndRedirect = async () => {
                // Refresh session to get latest role data
                await new Promise(resolve => setTimeout(resolve, 300))
                
                // Check session again after refresh
                const response = await fetch('/api/auth/session')
                const latestSession = await response.json().catch(() => null)
                const userRole = latestSession?.user?.role || session?.user?.role
                
                if (userRole === 'ADMIN') {
                    console.log('[AuthPage] Admin session confirmed, redirecting to', nextUrl)
                    router.push(nextUrl)
                    router.refresh()
                } else if (latestSession?.user || session?.user) {
                    // User is logged in but not admin
                    console.log('[AuthPage] User logged in but not admin. Role:', userRole)
                    setInitialAuthError('Your account does not have administrator privileges.')
                }
            }
            
            checkAndRedirect()
        }
    }, [isAdminMode, status, session, router, nextUrl])

    // Wallet authentication hooks
    const { isSigning, isAuthenticating, error: walletError, signInWithWallet } = useWalletAuth()
    const { isConnected } = useAccount()
    const enableSolana = process.env.NEXT_PUBLIC_ENABLE_SOLANA === '1'

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam === 'signin' || tabParam === 'signup') {
            setTab(tabParam)
        }
        // Force signin tab for admin mode
        if (isAdminMode) {
            setTab('signin')
        }
    }, [searchParams, isAdminMode])

    useEffect(() => {
        if (!searchParams) {
            return
        }

        const errorParam = searchParams.get('error')

        if (errorParam) {
            setTab('signin')
            setInitialAuthError(errorParam)

            if (pathname) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('error')
                const nextQuery = params.toString()
                router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
            }
        } else {
            setInitialAuthError('')
        }
    }, [searchParams, router, pathname])

    async function handleGoogleSignIn() {
        setIsGoogleLoading(true)

        try {
            const callbackUrl = isAdminMode ? '/admin' : '/'
            // Force account selection by adding prompt parameter
            await signIn('google', {
                callbackUrl,
                // NextAuth will use the authorization params from provider config
            })
        } catch (error) {
            setIsGoogleLoading(false)
        }
    }

    async function resendVerification() {
        if (!resendEmail) {
            setVerificationMessage('Please enter your email address first.')
            setShowVerificationAlert(true)
            return
        }

        setIsResending(true)
        try {
            const response = await fetch(`${API_URL}/api/auth/request-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resendEmail }),
            })

            const data = await response.json().catch(() => ({}))
            setVerificationMessage(data?.message || 'Verification email sent successfully.')
            setShowVerificationAlert(true)
        } catch (error) {
            setVerificationMessage('Failed to resend verification email. Please try again.')
            setShowVerificationAlert(true)
        } finally {
            setIsResending(false)
        }
    }

    const isBusy = isGoogleLoading

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">VolSpike</h1>
                    <p className="text-gray-400">Professional cryptocurrency market analysis and volume alerts</p>
                </div>

                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
                    <CardHeader className="space-y-4">
                        {!isAdminMode && (
                            <div className="flex justify-center space-x-2 text-sm" role="tablist" aria-label="Authentication mode">
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full border px-4 py-2 transition-all ${tab === 'signin'
                                        ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                        : 'border-gray-700 bg-gray-800/80 text-gray-300 hover:border-gray-600'}`}
                                    onClick={() => setTab('signin')}
                                >
                                    Email Login
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full border px-4 py-2 transition-all ${tab === 'signup'
                                        ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                        : 'border-gray-700 bg-gray-800/80 text-gray-300 hover:border-gray-600'}`}
                                    onClick={() => setTab('signup')}
                                >
                                    Create Account
                                </button>
                            </div>
                        )}
                        <div className="space-y-1 text-center">
                            <CardTitle className="text-2xl text-white">
                                {isAdminMode ? 'Admin Sign In' : (tab === 'signin' ? 'Welcome back' : 'Create your account')}
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                                {isAdminMode
                                    ? 'Administrator access to VolSpike platform'
                                    : (tab === 'signin'
                                        ? 'Sign in to access real-time volume spike alerts'
                                        : 'Start tracking Binance perp markets in seconds')
                                }
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {showVerificationAlert && (
                            <div className="flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-3 text-sm text-green-200">
                                <Mail className="mt-0.5 h-4 w-4" />
                                <div>
                                    <p>{verificationMessage}</p>
                                    <button
                                        type="button"
                                        onClick={resendVerification}
                                        className="mt-2 inline-flex items-center text-xs font-semibold text-green-200 underline underline-offset-4 hover:text-green-100 disabled:opacity-70"
                                        disabled={isResending}
                                    >
                                        {isResending ? 'Resending...' : 'Resend email'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Render the appropriate form component */}
                        {tab === 'signin' ? (
                            <SigninForm
                                onSuccess={async (email) => {
                                    console.log('[AuthPage] onSuccess called with email:', email)
                                    console.log('[AuthPage] nextUrl:', nextUrl)
                                    setResendEmail(email)

                                    // Small delay to ensure session is properly set
                                    await new Promise(resolve => setTimeout(resolve, 100))

                                    console.log('[AuthPage] Calling router.refresh()')
                                    router.refresh()

                                    console.log('[AuthPage] Calling router.push with nextUrl:', nextUrl)
                                    router.push(nextUrl)
                                    console.log('[AuthPage] Router.push completed')
                                }}
                                isAdminMode={isAdminMode}
                                nextUrl={nextUrl}
                                initialError={initialAuthError}
                            />
                        ) : (
                            <SignupForm
                                onSuccess={(email) => {
                                    setResendEmail(email)
                                    setTab('signin')
                                }}
                                setVerificationMessage={setVerificationMessage}
                                setShowVerificationAlert={setShowVerificationAlert}
                            />
                        )}

                        {/* Google OAuth - Show for both regular and admin mode */}
                        <div className="flex items-center space-x-4">
                            <div className="flex-1 h-px bg-gray-700" />
                            <span className="bg-gray-800 px-2 text-gray-400">or</span>
                            <div className="flex-1 h-px bg-gray-700" />
                        </div>

                        <Button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isBusy}
                            className={`w-full transition-all duration-200 ${isAdminMode
                                    ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] border-0'
                                    : 'border border-green-400/60 bg-transparent text-green-300 hover:bg-green-500/15'
                                }`}
                            variant={isAdminMode ? 'default' : 'outline'}
                        >
                            {isGoogleLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isAdminMode ? 'Connecting to Admin Panel...' : 'Connecting...'}
                                </>
                            ) : (
                                <>
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    {isAdminMode ? 'Sign in with Google (Admin)' : 'Continue with Google'}
                                </>
                            )}
                        </Button>

                        {!isAdminMode && (
                            <>

                                <div className="space-y-3">
                                    <WalletConnectButton />

                                    {/* Show authenticate button after wallet connects */}
                                    {isConnected && (
                                        <Button
                                            onClick={signInWithWallet}
                                            disabled={isSigning || isAuthenticating}
                                            className="w-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 text-white hover:from-green-600 hover:via-emerald-500 hover:to-green-600"
                                        >
                                            {isAuthenticating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Authenticating...
                                                </>
                                            ) : isSigning ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Sign message in wallet...
                                                </>
                                            ) : (
                                                'Sign In with Wallet'
                                            )}
                                        </Button>
                                    )}

                                    {/* Show wallet error if any */}
                                    {walletError && (
                                        <p className="text-xs text-red-400 text-center">{walletError}</p>
                                    )}
                                </div>

                                {enableSolana && (
                                    <SolanaProvider>
                                        <PhantomSignInSection />
                                    </SolanaProvider>
                                )}
                            </>
                        )}

                        <div className="text-center">
                            {!isAdminMode && (
                                <p className="text-gray-400 text-sm">
                                    {tab === 'signin' ? 'Need an account?' : 'Already registered?'}{' '}
                                    <button
                                        type="button"
                                        className="text-green-400 hover:text-green-300 font-semibold"
                                        onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
                                    >
                                        {tab === 'signin' ? 'Create one for free' : 'Sign in instead'}
                                    </button>
                                </p>
                            )}
                        </div>

                        {/* Subtle donation link (unobtrusive) */}
                        {!isAdminMode && (
                            <div className="mt-2 text-center">
                                <Link
                                    href="/donate"
                                    className="text-xs text-purple-300 hover:text-purple-200 underline underline-offset-4"
                                    aria-label="Support VolSpike with a donation"
                                >
                                    Support VolSpike — Donate
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">VolSpike</h1>
                        <p className="text-gray-400">Professional cryptocurrency market analysis and volume alerts</p>
                    </div>
                    <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl text-white">Loading...</CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        }>
            <AuthPageContent />
        </Suspense>
    )
}
