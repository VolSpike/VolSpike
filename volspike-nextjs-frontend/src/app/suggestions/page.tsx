'use client'

import { useState } from 'react'
import { HeaderWithBanner } from '@/components/header-with-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HumanVerification } from '@/components/human-verification'
import { Lightbulb, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SuggestionType = 'feature' | 'improvement' | 'bug' | 'other'

export default function SuggestionsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<SuggestionType | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const suggestionTypes: { value: SuggestionType; label: string; description: string }[] = [
    { value: 'feature', label: 'New Feature', description: 'Suggest a new feature or capability' },
    { value: 'improvement', label: 'Improvement', description: 'Enhance an existing feature' },
    { value: 'bug', label: 'Bug Report', description: 'Report an issue or bug' },
    { value: 'other', label: 'Other', description: 'General feedback or ideas' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isVerified) {
      setErrorMessage('Please complete the human verification')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          type,
          title,
          description,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit suggestion')
      }

      setSubmitStatus('success')
      // Reset form
      setName('')
      setEmail('')
      setType('')
      setTitle('')
      setDescription('')
      setIsVerified(false)
    } catch (error) {
      console.error('Error submitting suggestion:', error)
      setSubmitStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit suggestion')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <HeaderWithBanner />
      <main className="container mx-auto px-4 pt-10 pb-16 md:pt-12 md:pb-20">
        <div className="max-w-3xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-10 space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                <Lightbulb className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Share Your Ideas
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Help us shape the future of VolSpike. We value your feedback and suggestions to make our platform even better.
            </p>
          </div>

          {/* Success Message */}
          {submitStatus === 'success' && (
            <div className="mb-8 p-6 rounded-lg border border-green-500/50 bg-gradient-to-br from-green-950/30 to-green-900/20 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-green-500">Thank you for your suggestion!</h3>
                  <p className="text-sm text-green-500/80">
                    We&apos;ve received your feedback and will review it carefully. You&apos;ll hear from us if we need more details.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submitStatus === 'error' && errorMessage && (
            <div className="mb-8 p-6 rounded-lg border border-red-500/50 bg-gradient-to-br from-red-950/30 to-red-900/20 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-red-500">Submission Failed</h3>
                  <p className="text-sm text-red-500/80">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div className="space-y-6 p-6 rounded-lg border bg-card">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Your Information</h2>
                <p className="text-sm text-muted-foreground">
                  Help us get back to you if we have questions
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Suggestion Type */}
            <div className="space-y-6 p-6 rounded-lg border bg-card">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">
                  Suggestion Type <span className="text-muted-foreground text-sm font-normal">(optional)</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  What kind of feedback are you sharing?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {suggestionTypes.map((suggestionType) => (
                  <button
                    key={suggestionType.value}
                    type="button"
                    onClick={() => setType(type === suggestionType.value ? '' : suggestionType.value)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all duration-200',
                      'hover:border-primary/50 hover:bg-primary/5',
                      type === suggestionType.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    )}
                  >
                    <div className="font-medium mb-1">{suggestionType.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestionType.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggestion Details */}
            <div className="space-y-6 p-6 rounded-lg border bg-card">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Details</h2>
                <p className="text-sm text-muted-foreground">
                  Tell us about your idea or feedback
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Title <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of your suggestion"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide as much detail as you'd like..."
                    className="min-h-[150px]"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Human Verification */}
            <HumanVerification onVerified={setIsVerified} />

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button
                type="submit"
                size="lg"
                disabled={!isVerified || isSubmitting}
                className="w-full sm:w-auto min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Suggestion
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
