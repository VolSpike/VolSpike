'use client'

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

interface HumanVerificationProps {
  onVerified: (verified: boolean) => void
  className?: string
}

export interface HumanVerificationHandle {
  reset: () => void
}

export const HumanVerification = forwardRef<HumanVerificationHandle, HumanVerificationProps>(
  ({ onVerified, className }, ref) => {
  const [challenge, setChallenge] = useState<{ num1: number; num2: number; answer: number }>({
    num1: 0,
    num2: 0,
    answer: 0,
  })
  const [userAnswer, setUserAnswer] = useState('')
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [showFeedback, setShowFeedback] = useState(false)

  // Generate a simple math challenge
  useEffect(() => {
    generateChallenge()
  }, [])

  // Auto-verify when correct answer is typed
  useEffect(() => {
    if (userAnswer && parseInt(userAnswer) === challenge.answer && status !== 'success') {
      setStatus('success')
      setShowFeedback(true)
      onVerified(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAnswer, challenge.answer, status])

  const generateChallenge = () => {
    const num1 = Math.floor(Math.random() * 10) + 1
    const num2 = Math.floor(Math.random() * 10) + 1
    setChallenge({ num1, num2, answer: num1 + num2 })
    setUserAnswer('')
    setStatus('pending')
    setShowFeedback(false)
  }

  // Expose reset method to parent
  useImperativeHandle(ref, () => ({
    reset: () => {
      generateChallenge()
      onVerified(false)
    }
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const isCorrect = parseInt(userAnswer) === challenge.answer

    if (isCorrect) {
      setStatus('success')
      setShowFeedback(true)
      onVerified(true)
    } else {
      setStatus('error')
      setShowFeedback(true)
      setTimeout(() => {
        generateChallenge()
      }, 1500)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'rounded-lg border-2 bg-gradient-to-br p-6 transition-all duration-300',
          status === 'success'
            ? 'border-green-500/50 from-green-950/30 to-green-900/20'
            : status === 'error'
              ? 'border-red-500/50 from-red-950/30 to-red-900/20'
              : 'border-primary/20 from-primary/5 to-primary/10'
        )}
      >
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Human Verification</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-lg">
            <span className="font-mono font-bold bg-primary/10 px-4 py-2 rounded-md">
              {challenge.num1}
            </span>
            <span className="text-muted-foreground">+</span>
            <span className="font-mono font-bold bg-primary/10 px-4 py-2 rounded-md">
              {challenge.num2}
            </span>
            <span className="text-muted-foreground">=</span>
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className={cn(
                'w-20 text-center font-mono font-bold rounded-md border-2 bg-background px-3 py-2 text-lg transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                status === 'success'
                  ? 'border-green-500'
                  : status === 'error'
                    ? 'border-red-500'
                    : 'border-input'
              )}
              placeholder="?"
              disabled={status === 'success'}
              required
              autoComplete="off"
            />
          </div>

          {showFeedback && (
            <div
              className={cn(
                'flex items-center justify-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300',
                status === 'success' ? 'text-green-500' : 'text-red-500'
              )}
            >
              {status === 'success' ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Verified! You&apos;re human.</span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  <span>Incorrect. Try again...</span>
                </>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
})

HumanVerification.displayName = 'HumanVerification'
