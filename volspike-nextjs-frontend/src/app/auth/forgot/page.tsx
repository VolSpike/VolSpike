'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Info } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOAuthOnly, setIsOAuthOnly] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setIsOAuthOnly(false)
    try {
      const res = await fetch(`${API_URL}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setIsOAuthOnly(data.isOAuthOnly === true)
      setSent(true)
    } catch (err) {
      setSent(true) // still show generic success (no enumeration)
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
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>Enter your email to receive a reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="rounded-lg p-4 text-sm border bg-green-50 text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30 transition-colors duration-200">
                  If an account exists with that email, a reset link has been sent. Please check your inbox.
                </div>
                {isOAuthOnly && (
                  <div className="flex items-start gap-3 rounded-lg p-4 text-sm border bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold">This account uses Google sign-in</p>
                      <p className="text-sm">
                        You can continue using{' '}
                        <Link href="/auth" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                          Google sign-in
                        </Link>
                        {' '}to access your account, or set a password using the link in your email to enable email/password login.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm text-muted-foreground mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

