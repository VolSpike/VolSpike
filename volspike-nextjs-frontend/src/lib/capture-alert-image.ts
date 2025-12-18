import html2canvas from 'html2canvas'

// Fixed dimensions for Twitter (16:9 aspect ratio)
export const TWITTER_CARD_WIDTH = 480
export const TWITTER_CARD_HEIGHT = 270

async function waitForFontsAndLayout(): Promise<void> {
  if (typeof document === 'undefined') return

  try {
    // Ensure fonts are ready before capture (prevents baseline/metrics drift during render).
    const fonts = (document as any).fonts as FontFaceSet | undefined
    if (fonts?.ready) {
      await fonts.ready
    }
  } catch {
    // Ignore font readiness errors and proceed with capture.
  }

  // Give the browser at least two frames to flush layout + paint (helps html2canvas snapshot accuracy).
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
}

function isDebugCaptureEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('debugTwitterCapture') === '1'
  } catch {
    return false
  }
}

function debugCaptureLayout(container: HTMLElement) {
  if (!isDebugCaptureEnabled()) return

  const symbol = container.querySelector('[data-capture="symbol"]') as HTMLElement | null
  const badgePrimary = container.querySelector('[data-capture="badge-primary"]') as HTMLElement | null
  const badgeTimeframe = container.querySelector('[data-capture="badge-timeframe"]') as HTMLElement | null

  const items = [
    ['symbol', symbol],
    ['badge-primary', badgePrimary],
    ['badge-timeframe', badgeTimeframe],
  ] as const

  // eslint-disable-next-line no-console
  console.groupCollapsed('[CaptureImage] Twitter card layout debug')
  for (const [label, el] of items) {
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    // eslint-disable-next-line no-console
    console.log(label, {
      text: (el.textContent || '').trim(),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      display: style.display,
    })
  }
  // eslint-disable-next-line no-console
  console.groupEnd()
}

function debugCaptureRenderer(label: string, info: Record<string, unknown>) {
  if (!isDebugCaptureEnabled()) return
  // eslint-disable-next-line no-console
  console.log(`[CaptureImage] ${label}`, info)
}

function normalizeCaptureElementInClone(clonedDocument: Document, elementId: string) {
  const el = clonedDocument.getElementById(elementId) as HTMLElement | null
  if (!el) return

  // When the real element is positioned far off-screen (e.g. left/top:-9999px),
  // `foreignObjectRendering` can render it outside the SVG viewport, producing a blank image.
  // Normalize positioning only in the cloned DOM used for capture.
  el.style.position = 'fixed'
  el.style.left = '0px'
  el.style.top = '0px'
  el.style.transform = 'none'
  el.style.opacity = '1'
  el.style.zIndex = '0'
}

/**
 * Capture an alert card element as a PNG image
 * @param element The DOM element to capture (or element ID)
 * @returns Base64-encoded PNG image data URL
 */
export async function captureAlertCard(element: HTMLElement | string): Promise<string> {
  // Get element
  const targetElement = typeof element === 'string'
    ? document.getElementById(element)
    : element

  if (!targetElement) {
    throw new Error('Element not found. Cannot capture image.')
  }

  try {
    await waitForFontsAndLayout()

    // Use html2canvas to capture the element
    const baseOptions = {
      backgroundColor: '#0f172a', // Dark background (matches alert cards)
      scale: 2, // High DPI for better quality
      logging: false, // Disable console logs
      useCORS: true, // Allow cross-origin images
      allowTaint: false, // Prevent tainting canvas
      width: targetElement.offsetWidth,
      height: targetElement.offsetHeight,
    } as const

    // Try foreignObjectRendering first for better CSS/layout fidelity; fallback to default renderer.
    let canvas: HTMLCanvasElement
    try {
      debugCaptureRenderer('renderer', { target: 'alertCard', foreignObjectRendering: true })
      canvas = await html2canvas(targetElement, {
        ...baseOptions,
        foreignObjectRendering: true,
        onclone: typeof element === 'string'
          ? (doc) => normalizeCaptureElementInClone(doc, element)
          : (doc) => {
              const id = (targetElement as HTMLElement).id
              if (id) normalizeCaptureElementInClone(doc, id)
            },
      })
    } catch {
      debugCaptureRenderer('renderer', { target: 'alertCard', foreignObjectRendering: false })
      canvas = await html2canvas(targetElement, {
        ...baseOptions,
        onclone: typeof element === 'string'
          ? (doc) => normalizeCaptureElementInClone(doc, element)
          : (doc) => {
              const id = (targetElement as HTMLElement).id
              if (id) normalizeCaptureElementInClone(doc, id)
            },
      })
    }

    // Convert canvas to base64 PNG data URL
    const dataURL = canvas.toDataURL('image/png')

    return dataURL
  } catch (error) {
    console.error('[CaptureImage] Error capturing alert card:', error)
    throw new Error(`Failed to capture image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Capture a dedicated Twitter card element (rendered off-screen)
 * This provides consistent sizing and styling regardless of screen size
 * @param containerId The ID of the container element with the TwitterAlertCard
 * @returns Base64-encoded PNG image data URL
 */
export async function captureTwitterCard(containerId: string): Promise<string> {
  const container = document.getElementById(containerId)

  if (!container) {
    throw new Error('Twitter card container not found. Cannot capture image.')
  }

  try {
    await waitForFontsAndLayout()
    debugCaptureLayout(container)

    // Capture at 2x scale for high quality
    const baseOptions = {
      backgroundColor: '#0f172a',
      scale: 2.5, // Higher DPI for crisp text on Twitter
      logging: false,
      useCORS: true,
      allowTaint: false,
      width: TWITTER_CARD_WIDTH,
      height: TWITTER_CARD_HEIGHT,
    } as const

    // foreignObjectRendering is typically more accurate for vertical alignment (flex/text metrics),
    // but can fail in some browsers; fall back automatically.
    let canvas: HTMLCanvasElement
    try {
      debugCaptureRenderer('renderer', { target: 'twitterCard', foreignObjectRendering: true, scale: baseOptions.scale })
      canvas = await html2canvas(container, {
        ...baseOptions,
        foreignObjectRendering: true,
        onclone: (doc) => normalizeCaptureElementInClone(doc, containerId),
      })
    } catch {
      debugCaptureRenderer('renderer', { target: 'twitterCard', foreignObjectRendering: false, scale: baseOptions.scale })
      canvas = await html2canvas(container, {
        ...baseOptions,
        onclone: (doc) => normalizeCaptureElementInClone(doc, containerId),
      })
    }

    // Convert canvas to base64 PNG data URL
    const dataURL = canvas.toDataURL('image/png', 1.0) // Maximum quality

    return dataURL
  } catch (error) {
    console.error('[CaptureImage] Error capturing Twitter card:', error)
    throw new Error(`Failed to capture Twitter card: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get optimal dimensions for Twitter images (16:9 aspect ratio)
 * Twitter recommends 1200x675px
 */
export function getOptimalTwitterDimensions(element: HTMLElement): { width: number; height: number } {
  const targetAspectRatio = 16 / 9
  const elementWidth = element.offsetWidth
  const elementHeight = element.offsetHeight

  // If element is already close to 16:9, use its dimensions
  const currentAspectRatio = elementWidth / elementHeight
  if (Math.abs(currentAspectRatio - targetAspectRatio) < 0.1) {
    return { width: elementWidth, height: elementHeight }
  }

  // Calculate optimal dimensions maintaining element's content
  let width = elementWidth
  let height = elementHeight

  // Scale to fit Twitter's recommended size while maintaining aspect
  const maxWidth = 1200
  const maxHeight = 675

  if (width > maxWidth) {
    height = (height / width) * maxWidth
    width = maxWidth
  }

  if (height > maxHeight) {
    width = (width / height) * maxHeight
    height = maxHeight
  }

  return { width: Math.round(width), height: Math.round(height) }
}
