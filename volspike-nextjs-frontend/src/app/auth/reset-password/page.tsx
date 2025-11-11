'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/password-input'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ResetPasswordPage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params?.get('token') || ''
  const email = params?.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Basic self-check
    if (!token) setError('Invalid or missing token.')
  }, [token])

  function validatePassword(pw: string): string | null {
    if (pw.length < 12) {
      return 'Password must be at least 12 characters.'
    }
    if (!/[A-Z]/.test(pw)) {
      return 'Password must contain an uppercase letter.'
    }
    if (!/[0-9]/.test(pw)) {
      return 'Password must contain a number.'
    }
    if (!/[^A-Za-z0-9]/.test(pw)) {
      return 'Password must contain a special character.'
    }
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Reset failed')
      }
      setDone(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background">
      <Header hideWalletConnect />
      <main className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4">
                <div className="rounded-lg p-4 text-sm border bg-green-50 text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30 transition-colors duration-200">
                  Your password has been set successfully. You can now sign in with your email and password, or continue using Google sign-in if your account is linked.
                </div>
                <Link href="/auth">
                  <Button className="w-full bg-brand-600 hover:bg-brand-700 text-white">Return to Sign In</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <PasswordInput
                  id="password"
                  label="New Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Create a secure password"
                  autoComplete="new-password"
                  showStrength={true}
                  showRules={true}
                  required={true}
                />
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className={`bg-background pr-10 transition-all ${
                        confirm && password && confirm !== password
                          ? 'border-red-500 focus-visible:ring-red-500'
                          : confirm && password && confirm === password
                            ? 'border-green-500 focus-visible:ring-green-500'
                            : ''
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirm && password && confirm !== password && (
                    <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
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
                  {confirm && password && confirm === password && password.length >= 12 && (
                    <p className="text-xs text-green-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
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
                </div>
                {error && (
                  <div className="rounded-md bg-red-500/10 border border-red-500/50 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white" disabled={loading || !token}>
                  {loading ? 'Resetting…' : 'Reset Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

