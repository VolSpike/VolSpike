'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Loader2, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { captureAlertCard } from '@/lib/capture-alert-image'
import type { AlertSourceType } from '@/types/social-media'

interface AddToTwitterButtonProps {
  alertId: string
  alertType: AlertSourceType
  alertCardId: string // DOM element ID of the alert card to capture
  disabled?: boolean
  isQueued?: boolean
  onSuccess?: () => void
}

export function AddToTwitterButton({
  alertId,
  alertType,
  alertCardId,
  disabled = false,
  isQueued = false,
  onSuccess,
}: AddToTwitterButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isAdded, setIsAdded] = useState(isQueued)

  const handleAddToTwitter = async () => {
    if (isAdded || disabled) return

    setIsLoading(true)

    try {
      // Step 1: Capture the alert card as an image
      console.log(`[AddToTwitter] Capturing image from element: ${alertCardId}`)
      const imageDataURL = await captureAlertCard(alertCardId)

      // Step 2: Send to API to add to queue
      console.log(`[AddToTwitter] Adding to queue: ${alertType} alert ${alertId}`)
      const response = await adminAPI.addToSocialMediaQueue({
        alertId,
        alertType,
        imageUrl: imageDataURL,
      })

      console.log('[AddToTwitter] Successfully added to queue:', response)

      // Success!
      setIsAdded(true)
      toast.success('Added to Twitter queue. Review and post from the Social Media page.')

      onSuccess?.()
    } catch (error: any) {
      console.error('[AddToTwitter] Error:', error)

      let errorMessage = 'Failed to add to Twitter queue'
      if (error?.status === 409) {
        errorMessage = 'This alert is already queued or posted'
        setIsAdded(true) // Mark as added since it already exists
      } else if (error?.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (isAdded) {
    return (
      <button
        disabled
        className="p-1.5 rounded-md text-green-500 cursor-not-allowed"
        title="Already queued for Twitter"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <button
      onClick={handleAddToTwitter}
      disabled={disabled || isLoading}
      className="group/x p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Add to Twitter queue"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground/70 group-hover/x:text-foreground transition-colors" />
      )}
    </button>
  )
}
