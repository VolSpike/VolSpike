/**
 * CoinGecko API Rate Limiter
 * 
 * CoinGecko free tier limits:
 * - 10-50 calls/minute (varies)
 * - We'll be conservative and use 10 calls/minute = 1 call per 6 seconds
 * 
 * This module provides:
 * - Request queue with rate limiting
 * - Exponential backoff for 429 errors
 * - Request deduplication
 * - Comprehensive error handling
 */

interface QueuedRequest {
  id: string
  fn: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: Error) => void
  retries: number
  priority: 'high' | 'normal' | 'low'
}

const MAX_RETRIES = 3
const BASE_DELAY_MS = 6000 // 6 seconds between requests (10 calls/minute)
const MAX_DELAY_MS = 60000 // Max 1 minute delay
const RATE_LIMIT_DELAY_MS = 60000 // Wait 1 minute on 429 error

// Debug logging (can be enabled via localStorage)
const DEBUG = typeof window !== 'undefined' && 
  (localStorage.getItem('volspike:debug:coingecko') === 'true' || 
   process.env.NODE_ENV === 'development')

const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[CoinGeckoRateLimiter]', ...args)
  }
}

class CoinGeckoRateLimiter {
  private queue: QueuedRequest[] = []
  private processing = false
  private lastRequestTime = 0
  private rateLimitUntil = 0
  private inflightRequests = new Map<string, Promise<any>>()
  private requestCounts = new Map<string, number>() // Track requests per minute
  private listeners = new Set<() => void>() // Listeners for rate limit changes

  /**
   * Add a request to the queue
   */
  async request<T>(
    id: string,
    fn: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    // Check if request is already in flight
    const existing = this.inflightRequests.get(id)
    if (existing) {
      debugLog(`Request ${id} already in flight, reusing promise`)
      return existing as Promise<T>
    }

    debugLog(`Queueing request ${id} (priority: ${priority}), queue length: ${this.queue.length}`)

    // Create promise for this request
    const promise = new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id,
        fn,
        resolve,
        reject,
        retries: 0,
        priority,
      }

      // Insert based on priority
      if (priority === 'high') {
        this.queue.unshift(queuedRequest)
      } else {
        this.queue.push(queuedRequest)
      }
    })

    this.inflightRequests.set(id, promise)

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }

    return promise
  }

  /**
   * Process the queue with rate limiting
   */
  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      // Check if we're rate limited
      const now = Date.now()
      if (now < this.rateLimitUntil) {
        const waitTime = this.rateLimitUntil - now
        debugLog(`Rate limited, waiting ${Math.ceil(waitTime / 1000)}s`)
        await this.sleep(waitTime)
        continue
      }

      // Ensure minimum delay between requests
      const timeSinceLastRequest = now - this.lastRequestTime
      if (timeSinceLastRequest < BASE_DELAY_MS) {
        const waitTime = BASE_DELAY_MS - timeSinceLastRequest
        debugLog(`Rate limiting: waiting ${Math.ceil(waitTime / 1000)}s before next request`)
        await this.sleep(waitTime)
      }

      const request = this.queue.shift()
      if (!request) break

      try {
        debugLog(`Processing request ${request.id} (attempt ${request.retries + 1}/${MAX_RETRIES + 1})`)
        const result = await this.executeRequest(request)
        debugLog(`Request ${request.id} completed successfully`)
        request.resolve(result)
        this.inflightRequests.delete(request.id)
      } catch (error: any) {
        // Handle rate limit errors
        if (error.status === 429 || error.message?.includes('429')) {
          console.warn(`[CoinGeckoRateLimiter] Rate limited for request ${request.id}, retrying...`)
          debugLog(`Rate limit detected for ${request.id}, setting cooldown`)
          
          // Set rate limit cooldown
          const previousRateLimit = this.rateLimitUntil
          this.rateLimitUntil = Date.now() + RATE_LIMIT_DELAY_MS
          
          // Notify listeners if rate limit state changed
          if (previousRateLimit === 0) {
            this.notifyListeners()
          }
          
          // Retry with exponential backoff
          if (request.retries < MAX_RETRIES) {
            request.retries++
            const delay = Math.min(
              BASE_DELAY_MS * Math.pow(2, request.retries),
              MAX_DELAY_MS
            )
            debugLog(`Retrying ${request.id} after ${Math.ceil(delay / 1000)}s (attempt ${request.retries}/${MAX_RETRIES})`)
            
            // Re-queue with lower priority
            setTimeout(() => {
              this.queue.push({ ...request, priority: 'low' })
              if (!this.processing) {
                this.processQueue()
              }
            }, delay)
          } else {
            console.error(`[CoinGeckoRateLimiter] Max retries exceeded for ${request.id}`)
            debugLog(`Max retries exceeded for ${request.id}, rejecting`)
            request.reject(new Error('CoinGecko API rate limit exceeded. Asset profiles will load automatically once the limit clears.'))
            this.inflightRequests.delete(request.id)
          }
        } else {
          // Other errors - reject immediately
          request.reject(error)
          this.inflightRequests.delete(request.id)
        }
      }

      this.lastRequestTime = Date.now()
      
      // Check if rate limit cleared
      if (this.rateLimitUntil > 0 && Date.now() >= this.rateLimitUntil) {
        const wasRateLimited = this.rateLimitUntil > 0
        this.rateLimitUntil = 0
        if (wasRateLimited) {
          this.notifyListeners()
        }
      }
    }

    this.processing = false
  }

  /**
   * Notify all listeners of rate limit state changes
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }

  /**
   * Subscribe to rate limit state changes
   */
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Execute a request with error handling
   */
  private async executeRequest(request: QueuedRequest): Promise<any> {
    try {
      const result = await request.fn()
      return result
    } catch (error: any) {
      // Check if it's a fetch error with status code
      if (error instanceof Response || (error.response && error.response.status)) {
        const status = error.status || error.response?.status
        if (status === 429) {
          throw { ...error, status: 429 }
        }
      }
      
      // Check error message for 429
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        throw { ...error, status: 429 }
      }

      throw error
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clear() {
    this.queue.forEach(req => {
      req.reject(new Error('Request queue cleared'))
    })
    this.queue = []
    this.inflightRequests.clear()
  }

  /**
   * Get queue status (for debugging)
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      rateLimitedUntil: this.rateLimitUntil,
      inflightCount: this.inflightRequests.size,
      isRateLimited: this.rateLimitUntil > Date.now(),
    }
  }
}

// Singleton instance
export const coingeckoRateLimiter = new CoinGeckoRateLimiter()

/**
 * Rate-limited fetch wrapper for CoinGecko API
 */
export async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<Response> {
  const requestId = `${url}-${JSON.stringify(options || {})}`
  
  return coingeckoRateLimiter.request(
    requestId,
    async () => {
      const response = await fetch(url, options)
      
      // Check for rate limit
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000
          console.warn(`[CoinGeckoRateLimiter] Rate limited, Retry-After: ${retryAfter}s`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        throw { status: 429, response }
      }
      
      if (!response.ok) {
        throw { status: response.status, response }
      }
      
      return response
    },
    priority
  )
}

