'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { trackRegistration, trackFormSubmission } from '@/lib/analytics'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend'

const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string()
        .min(12, 'Must be at least 12 characters')
        .regex(/[A-Z]/, 'Must contain an uppercase letter')
        .regex(/[0-9]/, 'Must contain a number')
        .regex(/[^A-Za-z0-9]/, 'Must contain a symbol'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
})

type SignupFormValues = z.infer<typeof signupSchema>

function passwordStrength(pw: string): number {
    let score = 0
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
}

function getPasswordStrengthLabel(score: number): { text: string; color: string } {
    switch (score) {
        case 0:
        case 1:
            return { text: 'Weak', color: 'text-red-400' }
        case 2:
            return { text: 'Fair', color: 'text-yellow-400' }
        case 3:
            return { text: 'Good', color: 'text-blue-400' }
        case 4:
            return { text: 'Strong', color: 'text-green-400' }
        default:
            return { text: '', color: '' }
    }
}

interface SignupFormProps {
    onSuccess: (email: string) => void
    setVerificationMessage: (message: string) => void
    setShowVerificationAlert: (show: boolean) => void
}

export function SignupForm({
    onSuccess,
    setVerificationMessage,
    setShowVerificationAlert
}: SignupFormProps) {
    const router = useRouter()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [authError, setAuthError] = useState('')

    const { handleSubmit, control, formState, watch, reset } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: { email: '', password: '', confirmPassword: '' },
    })

    const { isSubmitting, errors } = formState

    // Safe to call watch after useForm - always same order
    const passwordValue = watch('password')
    const confirmPasswordValue = watch('confirmPassword')
    const pwStrength = passwordStrength(passwordValue || '')
    const pwStrengthLabel = getPasswordStrengthLabel(pwStrength)
    const passwordsMatch = passwordValue && confirmPasswordValue && passwordValue === confirmPasswordValue
    const passwordsMismatch = passwordValue && confirmPasswordValue && passwordValue !== confirmPasswordValue

    const onSubmit = async (data: SignupFormValues) => {
        setAuthError('')
        setVerificationMessage('')
        setShowVerificationAlert(false)

        try {
            console.log('[SignupForm] Calling backend:', `${API_URL}/api/auth/signup`)
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    tier: 'free'
                }),
            })

            const payload = await response.json().catch(() => ({}))

            if (!response.ok) {
                const message = payload?.error || 'Could not create account. Please try again.'
                setAuthError(message)
                
                // Track failed registration
                trackFormSubmission('signup', false)
                
                return
            }

            if (payload?.requiresVerification) {
                const message = payload.message || 'Please check your email to verify your account.'
                setVerificationMessage(message)
                setShowVerificationAlert(true)
                reset()
                
                // Track successful registration
                trackRegistration('email', 'free')
                trackFormSubmission('signup', true)
                
                onSuccess(data.email)
                return
            }

            // Auto-signin after successful signup if no verification needed
            const signinResult = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false,
            })

            if (signinResult?.ok) {
                // Track successful registration and auto-login
                trackRegistration('email', 'free')
                trackFormSubmission('signup', true)
                router.push('/dashboard')
            } else {
                const message = 'Account created. Please verify your email, then sign in.'
                setVerificationMessage(message)
                setShowVerificationAlert(true)
                reset()
                
                // Track successful registration (even if auto-login failed)
                trackRegistration('email', 'free')
                trackFormSubmission('signup', true)
                
                onSuccess(data.email)
            }
        } catch (error) {
            console.error('[SignupForm] Signup error:', error)
            setAuthError('Network error. Please check your connection and try again.')
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-gray-300">Email Address</Label>
                <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                        <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                            autoComplete="email"
                            {...field}
                        />
                    )}
                />
                {errors.email && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.email.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-gray-300">Password</Label>
                <div className="relative">
                    <Controller
                        name="password"
                        control={control}
                        render={({ field }) => (
                            <Input
                                id="signup-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Create a secure password"
                                className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 pr-10"
                                autoComplete="new-password"
                                {...field}
                            />
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>

                {/* Password strength indicator */}
                <div className="space-y-1">
                    <div className="flex gap-1" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${pwStrength > i
                                        ? i === 0 ? 'bg-red-400'
                                            : i === 1 ? 'bg-yellow-400'
                                                : i === 2 ? 'bg-blue-400'
                                                    : 'bg-green-400'
                                        : 'bg-gray-600'
                                    }`}
                            />
                        ))}
                    </div>
                    {passwordValue && (
                        <p className={`text-xs font-medium ${pwStrengthLabel.color}`}>
                            Password strength: {pwStrengthLabel.text}
                        </p>
                    )}
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                    <p className="font-medium">Password must contain:</p>
                    <ul className="space-y-0.5 ml-4">
                        <li className={passwordValue?.length >= 12 ? 'text-green-400' : ''}>
                            ✓ At least 12 characters
                        </li>
                        <li className={/[A-Z]/.test(passwordValue || '') ? 'text-green-400' : ''}>
                            ✓ One uppercase letter
                        </li>
                        <li className={/[0-9]/.test(passwordValue || '') ? 'text-green-400' : ''}>
                            ✓ One number
                        </li>
                        <li className={/[^A-Za-z0-9]/.test(passwordValue || '') ? 'text-green-400' : ''}>
                            ✓ One special character
                        </li>
                    </ul>
                </div>

                {errors.password && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.password.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-gray-300">Confirm Password</Label>
                <div className="relative">
                    <Controller
                        name="confirmPassword"
                        control={control}
                        render={({ field }) => (
                            <Input
                                id="signup-confirm-password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirm your password"
                                className={`bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 pr-10 transition-all ${
                                    passwordsMismatch
                                        ? 'border-red-500 focus-visible:ring-red-500'
                                        : passwordsMatch && passwordValue && passwordValue.length >= 12
                                            ? 'border-green-500 focus-visible:ring-green-500'
                                            : ''
                                }`}
                                autoComplete="new-password"
                                {...field}
                            />
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                        {showConfirmPassword ? (
                            <EyeOff className="w-5 h-5" />
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>
                {passwordsMismatch && (
                    <p className="text-xs text-red-400 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        Passwords don&apos;t match
                    </p>
                )}
                {passwordsMatch && passwordValue && passwordValue.length >= 12 && (
                    <p className="text-xs text-green-400 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        Passwords match
                    </p>
                )}
                {errors.confirmPassword && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.confirmPassword.message}
                    </p>
                )}
            </div>

            {authError && (
                <div className="rounded-md bg-red-500/10 border border-red-500/50 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{authError}</span>
                </div>
            )}

            <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 text-white shadow-[0_20px_60px_rgba(16,185,129,0.35)] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || !formState.isValid}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                    </>
                ) : (
                    'Create account'
                )}
            </Button>
        </form>
    )
}
