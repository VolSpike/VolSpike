import sanitizeHtmlLib from 'sanitize-html'

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows only safe formatting tags
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  return sanitizeHtmlLib(dirty, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'blockquote', 'ul', 'ol', 'li'],
    allowedAttributes: {
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https'],
    // Remove all style attributes
    disallowedTagsMode: 'discard',
  })
}

/**
 * Strip all HTML and return plain text
 */
export function stripHtml(dirty: string): string {
  if (!dirty) return ''

  return sanitizeHtmlLib(dirty, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim()
}

/**
 * Truncate text to a maximum length while preserving word boundaries
 */
export function truncateText(text: string, maxLength: number = 300): string {
  if (!text || text.length <= maxLength) return text

  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'
}
