import { TwitterApi } from 'twitter-api-v2'

export class TwitterService {
  private client: TwitterApi | null = null
  private isConfigured: boolean = false

  constructor() {
    // Check if all required environment variables are present
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (apiKey && apiSecret && accessToken && accessSecret) {
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      })
      this.isConfigured = true
      console.log('[TwitterService] Initialized with credentials')
    } else {
      console.warn('[TwitterService] Twitter API credentials not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET environment variables.')
      this.isConfigured = false
    }
  }

  /**
   * Check if Twitter API is configured
   */
  public isReady(): boolean {
    return this.isConfigured && this.client !== null
  }

  /**
   * Post a tweet with an image
   * @param caption Tweet text (max 280 characters)
   * @param imageBase64 Base64-encoded image data (with or without data URL prefix)
   * @returns Object containing tweet ID and URL
   */
  async postTweetWithImage(
    caption: string,
    imageBase64: string
  ): Promise<{ tweetId: string; tweetUrl: string }> {
    if (!this.isReady()) {
      throw new Error('Twitter API is not configured. Please set environment variables.')
    }

    if (!this.client) {
      throw new Error('Twitter client is not initialized')
    }

    try {
      // Validate caption length
      if (caption.length > 280) {
        throw new Error(`Caption exceeds Twitter's 280 character limit (current: ${caption.length})`)
      }

      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      let base64Data = imageBase64
      if (imageBase64.includes(',')) {
        base64Data = imageBase64.split(',')[1]
      }

      // Convert base64 to Buffer
      const imageBuffer = Buffer.from(base64Data, 'base64')

      console.log(`[TwitterService] Uploading image (${imageBuffer.length} bytes)`)

      // Upload media to Twitter
      const mediaId = await this.client.v1.uploadMedia(imageBuffer, {
        mimeType: 'image/png',
      })

      console.log(`[TwitterService] Media uploaded successfully: ${mediaId}`)

      // Post tweet with media
      const tweet = await this.client.v2.tweet({
        text: caption,
        media: { media_ids: [mediaId] },
      })

      const tweetId = tweet.data.id
      const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`

      console.log(`[TwitterService] Tweet posted successfully: ${tweetUrl}`)

      return { tweetId, tweetUrl }
    } catch (error: any) {
      console.error('[TwitterService] Error posting tweet:', error)

      // Handle specific Twitter API errors
      if (error.code === 429 || error.statusCode === 429) {
        throw new Error('Twitter rate limit exceeded. Please try again later.')
      }

      if (error.code === 401 || error.statusCode === 401) {
        throw new Error('Twitter API authentication failed. Please check your credentials.')
      }

      if (error.code === 403 || error.statusCode === 403) {
        // Could be duplicate content
        if (error.message?.includes('duplicate')) {
          throw new Error('This tweet appears to be a duplicate. Please modify the caption or try a different alert.')
        }
        throw new Error('Twitter API access forbidden. Please check your app permissions.')
      }

      if (error.code === 400 || error.statusCode === 400) {
        throw new Error(`Twitter API error: ${error.message || 'Invalid request'}`)
      }

      // Generic error
      throw new Error(`Failed to post tweet: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Test the Twitter connection (posts a test tweet and deletes it)
   * Note: Only use for testing purposes
   */
  async testConnection(): Promise<boolean> {
    if (!this.isReady()) {
      return false
    }

    try {
      // Try to get authenticated user info
      const user = await this.client!.v2.me()
      console.log(`[TwitterService] Connected as @${user.data.username}`)
      return true
    } catch (error) {
      console.error('[TwitterService] Connection test failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const twitterService = new TwitterService()
