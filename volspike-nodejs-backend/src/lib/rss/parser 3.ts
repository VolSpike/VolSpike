import Parser from 'rss-parser'
import { stripHtml, truncateText } from './sanitizer'

export interface ParsedArticle {
  title: string
  link: string
  pubDate: Date
  description?: string
  author?: string
  categories?: string[]
  enclosure?: string
  guid?: string
}

export interface ParseResult {
  success: boolean
  articles: ParsedArticle[]
  feedTitle?: string
  error?: string
}

// Create parser with timeout and user agent
const parser = new Parser({
  timeout: 15000, // 15 second timeout
  headers: {
    'User-Agent': 'VolSpike/1.0 (RSS Reader; https://volspike.com)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
    ],
  },
})

/**
 * Parse an RSS feed URL and return structured articles
 */
export async function parseRssFeed(url: string): Promise<ParseResult> {
  try {
    console.log(`[RSS Parser] Fetching: ${url}`)
    const feed = await parser.parseURL(url)

    const articles: ParsedArticle[] = feed.items.map((item) => {
      // Get publication date
      let pubDate: Date
      if (item.pubDate) {
        pubDate = new Date(item.pubDate)
      } else if (item.isoDate) {
        pubDate = new Date(item.isoDate)
      } else {
        pubDate = new Date()
      }

      // Get description - try multiple fields
      let description = item.contentSnippet || item.content || item.summary || ''
      description = stripHtml(description)
      description = truncateText(description, 500)

      // Get enclosure (thumbnail) - try multiple sources
      let enclosure: string | undefined
      if (item.enclosure?.url) {
        enclosure = item.enclosure.url
      } else if ((item as any).mediaContent?.['$']?.url) {
        enclosure = (item as any).mediaContent['$'].url
      } else if ((item as any).mediaThumbnail?.['$']?.url) {
        enclosure = (item as any).mediaThumbnail['$'].url
      }

      // Access author and id with type assertion since rss-parser types don't include all fields
      const itemAny = item as any

      return {
        title: item.title?.trim() || 'Untitled',
        link: item.link || '',
        pubDate,
        description: description || undefined,
        author: item.creator || itemAny.author || undefined,
        categories: item.categories || [],
        enclosure,
        guid: item.guid || itemAny.id || item.link,
      }
    })

    // Filter out articles with invalid data
    const validArticles = articles.filter(
      (article) => article.title && article.link && article.pubDate instanceof Date && !isNaN(article.pubDate.getTime())
    )

    console.log(`[RSS Parser] Parsed ${validArticles.length} articles from ${feed.title || url}`)

    return {
      success: true,
      articles: validArticles,
      feedTitle: feed.title,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[RSS Parser] Error parsing ${url}:`, errorMessage)

    return {
      success: false,
      articles: [],
      error: errorMessage,
    }
  }
}

/**
 * Test if a URL is a valid RSS feed
 */
export async function testRssFeed(url: string): Promise<{ valid: boolean; error?: string; articleCount?: number }> {
  const result = await parseRssFeed(url)

  if (result.success) {
    return {
      valid: true,
      articleCount: result.articles.length,
    }
  }

  return {
    valid: false,
    error: result.error,
  }
}
