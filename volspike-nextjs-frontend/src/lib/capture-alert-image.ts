import html2canvas from 'html2canvas'

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
    // Use html2canvas to capture the element
    const canvas = await html2canvas(targetElement, {
      backgroundColor: '#0f172a', // Dark background (matches alert cards)
      scale: 2, // High DPI for better quality
      logging: false, // Disable console logs
      useCORS: true, // Allow cross-origin images
      allowTaint: false, // Prevent tainting canvas
      width: targetElement.offsetWidth,
      height: targetElement.offsetHeight,
    })

    // Convert canvas to base64 PNG data URL
    const dataURL = canvas.toDataURL('image/png')

    return dataURL
  } catch (error) {
    console.error('[CaptureImage] Error capturing alert card:', error)
    throw new Error(`Failed to capture image: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
