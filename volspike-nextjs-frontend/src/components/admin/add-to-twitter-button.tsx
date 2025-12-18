'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '@/lib/admin/api-client'
import { captureTwitterCard, TWITTER_CARD_WIDTH, TWITTER_CARD_HEIGHT } from '@/lib/capture-alert-image'
import { TwitterAlertCard } from './twitter-alert-card'
import { useQueuedAlerts } from '@/hooks/use-queued-alerts'
import type { AlertSourceType } from '@/types/social-media'

interface AddToTwitterButtonProps {
  alertId: string
  alertType: AlertSourceType
  alertCardId: string // Used to find the original alert data
  alert?: any // Optional: pass alert data directly
  disabled?: boolean
  onSuccess?: () => void
}

export function AddToTwitterButton({
  alertId,
  alertType,
  alertCardId,
  alert: alertProp,
  disabled = false,
  onSuccess,
}: AddToTwitterButtonProps) {
  const { data: session } = useSession()
  const { isAlertQueued, markAsQueued, unmarkAsQueued, getPostId, canUnqueue, isLoaded } = useQueuedAlerts()
  const [isLoading, setIsLoading] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [isUnqueuing, setIsUnqueuing] = useState(false)
  const [alertData, setAlertData] = useState<any>(null)
  const [showCapture, setShowCapture] = useState(false)
  const captureContainerId = `twitter-capture-${alertId}`
  const mountedRef = useRef(true)

  // Check if already queued on mount or when cache updates
  useEffect(() => {
    if (isLoaded && isAlertQueued(alertId)) {
      setIsAdded(true)
    }
  }, [isLoaded, alertId, isAlertQueued])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleAddToTwitter = async () => {
    if (isAdded || disabled || isLoading) return

    // Get access token from session first
    const accessToken = (session as any)?.accessToken as string | undefined
    if (!accessToken) {
      toast.error('Authentication required. Please refresh the page.')
      return
    }

    // Show loading state (spinner)
    setIsLoading(true)

    // Get alert data before starting capture
    let data = alertProp
    if (!data) {
      const cardElement = document.getElementById(alertCardId)
      if (cardElement) {
        data = await getAlertDataFromCard(cardElement, alertId, alertType)
      }
    }

    if (!data) {
      setIsLoading(false)
      toast.error('Could not find alert data')
      return
    }

    // Render the capture container
    setAlertData(data)
    setShowCapture(true)

    try {
      // Set access token for admin API
      adminAPI.setAccessToken(accessToken)

      // Wait for the Twitter card to render
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture the Twitter card
      console.log(`[AddToTwitter] Capturing Twitter card: ${captureContainerId}`)
      const imageDataURL = await captureTwitterCard(captureContainerId)

      // Hide the capture container
      setShowCapture(false)

      // Show checkmark immediately after capture (optimistic for API call)
      setIsLoading(false)
      setIsAdded(true)
      markAsQueued(alertId)

      // Send to API to add to queue
      console.log(`[AddToTwitter] Adding to queue: ${alertType} alert ${alertId}`)
      const response = await adminAPI.addToSocialMediaQueue({
        alertId,
        alertType,
        imageUrl: imageDataURL,
      })

      console.log('[AddToTwitter] Successfully added to queue:', response)

      // Update cache with the actual postId for unqueue functionality
      if (response.data?.id) {
        markAsQueued(alertId, response.data.id)
      }

      onSuccess?.()
    } catch (error: any) {
      console.error('[AddToTwitter] Error:', error)
      setShowCapture(false)
      setIsLoading(false)

      // Handle 409 (already exists) - keep the checkmark
      if (error?.status === 409) {
        setIsAdded(true)
        markAsQueued(alertId)
        return
      }

      // Revert on failure
      if (mountedRef.current) {
        setIsAdded(false)
        unmarkAsQueued(alertId)
      }

      let errorMessage = 'Failed to add to Twitter queue'
      if (error?.message) {
        errorMessage = error.message
      }
      toast.error(errorMessage)
    }
  }

  // Handle unqueue
  const handleUnqueue = async () => {
    if (isUnqueuing || isLoading) return

    const postId = getPostId(alertId)
    if (!postId) {
      toast.error('Cannot unqueue: post ID not found')
      return
    }

    // Get access token from session
    const accessToken = (session as any)?.accessToken as string | undefined
    if (!accessToken) {
      toast.error('Authentication required. Please refresh the page.')
      return
    }

    setIsUnqueuing(true)

    try {
      adminAPI.setAccessToken(accessToken)
      await adminAPI.updateSocialMediaPost(postId, { status: 'REJECTED' })

      // Update cache and UI
      unmarkAsQueued(alertId)

      if (mountedRef.current) {
        setIsAdded(false)
        toast.success('Removed from Twitter queue')
      }
    } catch (error: any) {
      console.error('[AddToTwitter] Unqueue error:', error)
      toast.error(error?.message || 'Failed to remove from queue')
    } finally {
      if (mountedRef.current) {
        setIsUnqueuing(false)
      }
    }
  }

  // Render the checkmark if already added
  if (isAdded) {
    const canBeUnqueued = canUnqueue(alertId)

    return (
      <button
        onClick={canBeUnqueued ? handleUnqueue : undefined}
        disabled={isUnqueuing || !canBeUnqueued}
        className={`p-1 rounded-md transition-all duration-200 ${
          canBeUnqueued
            ? 'text-green-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer hover:scale-110 active:scale-95'
            : 'text-green-500/50 cursor-not-allowed'
        }`}
        title={canBeUnqueued ? 'Click to remove from queue' : 'Already posted to Twitter'}
      >
        {isUnqueuing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={handleAddToTwitter}
        disabled={disabled || isLoading}
        className="group/twitter p-1 rounded-md transition-all duration-200 hover:bg-blue-500/10 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Add to Twitter queue"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
        ) : (
          <span className="h-3.5 w-3.5 flex items-center justify-center text-[11px] font-bold text-muted-foreground/70 group-hover/twitter:text-blue-400 group-hover/twitter:drop-shadow-[0_0_8px_rgba(96,165,250,0.6)] transition-all duration-200">
            𝕏
          </span>
        )}
      </button>

      {/* Hidden capture container - rendered via portal to avoid layout issues */}
      {showCapture && alertData && typeof document !== 'undefined' &&
        createPortal(
          <div
            id={captureContainerId}
            style={{
              position: 'fixed',
              left: '-9999px',
              top: '-9999px',
              width: TWITTER_CARD_WIDTH,
              height: TWITTER_CARD_HEIGHT,
              zIndex: -1,
              pointerEvents: 'none',
            }}
          >
            <TwitterAlertCard alert={alertData} alertType={alertType} />
          </div>,
          document.body
        )
      }
    </>
  )
}

/**
 * Extract alert data from the card DOM element
 * This parses the visible card to reconstruct the alert object
 */
async function getAlertDataFromCard(
  cardElement: HTMLElement,
  alertId: string,
  alertType: AlertSourceType
): Promise<any> {
  // Try to get data from window store if available
  const windowAlerts = (window as any).__volumeAlerts || (window as any).__oiAlerts
  if (windowAlerts) {
    const found = windowAlerts.find((a: any) => a.id === alertId)
    if (found) return found
  }

  // Parse from DOM as fallback
  const data: any = { id: alertId }

  if (alertType === 'VOLUME') {
    // Extract asset name
    const assetEl = cardElement.querySelector('.font-semibold')
    data.asset = assetEl?.textContent || 'Unknown'

    // Extract volume ratio
    const badgeEl = cardElement.querySelector('.font-mono-tabular')
    const ratioText = badgeEl?.textContent?.replace('x', '')
    data.volumeRatio = parseFloat(ratioText || '0')

    // Extract candle direction from classes
    data.candleDirection = cardElement.className.includes('brand-500') ? 'bullish' : 'bearish'

    // Try to extract more data
    const textContent = cardElement.textContent || ''
    const hourMatch = textContent.match(/This hour: \$?([\d.]+[BMK]?)/)
    const lastMatch = textContent.match(/Last hour: \$?([\d.]+[BMK]?)/)

    if (hourMatch) data.currentVolume = parseVolumeText(hourMatch[1])
    if (lastMatch) data.previousVolume = parseVolumeText(lastMatch[1])

    // Check for update badge
    data.isUpdate = textContent.includes('Update')
    data.alertType = textContent.includes('Hourly') ? 'FULL_UPDATE' : textContent.includes('30m') ? 'HALF_UPDATE' : 'SPIKE'

    // Timestamp
    data.timestamp = new Date().toISOString()
  } else {
    // OI alert
    const symbolEl = cardElement.querySelector('.font-semibold')
    data.symbol = (symbolEl?.textContent || 'Unknown') + 'USDT'

    // Direction
    data.direction = cardElement.className.includes('brand-500') ? 'UP' : 'DOWN'

    // Extract percentage
    const badgeEl = cardElement.querySelector('.font-mono-tabular')
    const pctText = badgeEl?.textContent?.replace('%', '').replace('+', '')
    data.pctChange = parseFloat(pctText || '0') / 100

    // Timeframe
    const textContent = cardElement.textContent || ''
    if (textContent.includes('1 hour')) data.timeframe = '1 hour'
    else if (textContent.includes('15 min')) data.timeframe = '15 min'
    else data.timeframe = '5 min'

    // OI values
    const currentMatch = textContent.match(/Current OI: ([\d.]+[BMK]?)/)
    const baselineMatch = textContent.match(/ago: ([\d.]+[BMK]?)/)

    if (currentMatch) data.current = parseVolumeText(currentMatch[1])
    if (baselineMatch) data.baseline = parseVolumeText(baselineMatch[1])

    data.ts = new Date().toISOString()
  }

  // Try to extract price and funding
  const textContent = cardElement.textContent || ''
  const priceMatch = textContent.match(/Price: ([+-]?[\d.]+)%/)
  const fundingMatch = textContent.match(/Funding: ([+-]?[\d.]+)%/)

  if (priceMatch) data.priceChange = parseFloat(priceMatch[1]) / 100
  if (fundingMatch) data.fundingRate = parseFloat(fundingMatch[1]) / 100

  return data
}

function parseVolumeText(text: string): number {
  const num = parseFloat(text.replace(/[^0-9.]/g, ''))
  if (text.includes('B')) return num * 1_000_000_000
  if (text.includes('M')) return num * 1_000_000
  if (text.includes('K')) return num * 1_000
  return num
}
