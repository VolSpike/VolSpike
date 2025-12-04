import { generateNonce } from 'siwe'
import { createLogger } from '../lib/logger'

const logger = createLogger()

interface NonceData {
  timestamp: number
  address: string
  provider: 'evm' | 'solana'
  nonce: string
}

/**
 * Manages nonce lifecycle for SIWE/SIWS authentication
 * - Nonces expire after 5 minutes
 * - One-time use only
 * - Stored in-memory (use Redis in production for scalability)
 */
class NonceManager {
  private store = new Map<string, NonceData>()
  private readonly ttl = 5 * 60 * 1000 // 5 minutes in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start cleanup interval
    this.startCleanup()
  }

  /**
   * Generate a new nonce for the given address and provider
   * Uses siwe's generateNonce() for EIP-4361 compliant alphanumeric nonce
   */
  generate(address: string, provider: 'evm' | 'solana'): string {
    const nonce = generateNonce() // ✅ EIP-4361 compliant alphanumeric
    this.store.set(nonce, {
      timestamp: Date.now(),
      address: address.toLowerCase(),
      provider,
      nonce,
    })
    
    logger.info(`Nonce issued: ${nonce.substring(0, 8)}... for ${provider} address ${address.substring(0, 6)}...`)
    
    return nonce
  }

  /**
   * Validate nonce (check if it exists and hasn't expired)
   */
  validate(nonce: string): NonceData | null {
    const data = this.store.get(nonce)
    
    if (!data) {
      logger.warn(`Nonce validation failed: not found: ${nonce.substring(0, 8)}...`)
      return null
    }

    const now = Date.now()
    const age = now - data.timestamp

    if (age > this.ttl) {
      logger.warn(`Nonce validation failed: expired: ${nonce.substring(0, 8)}... (age: ${Math.round(age / 1000)}s)`)
      this.store.delete(nonce)
      return null
    }

    logger.info(`Nonce validated successfully: ${nonce.substring(0, 8)}...`)
    return data
  }

  /**
   * Consume nonce (one-time use only)
   */
  consume(nonce: string): boolean {
    if (!this.store.has(nonce)) {
      logger.warn(`Nonce consumption failed: not found: ${nonce.substring(0, 8)}...`)
      return false
    }
    
    this.store.delete(nonce)
    logger.info(`Nonce consumed: ${nonce.substring(0, 8)}...`)
    return true
  }

  /**
   * Start periodic cleanup of expired nonces
   */
  private startCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 30000) // Run every 30 seconds

    // Also run cleanup on process exit
    process.on('SIGTERM', () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
      }
    })
  }

  /**
   * Remove expired nonces from store
   */
  private cleanup() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [nonce, data] of this.store.entries()) {
      if (now - data.timestamp > this.ttl) {
        this.store.delete(nonce)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired nonces`)
    }
  }

  /**
   * Get current store size (for monitoring)
   */
  getSize(): number {
    return this.store.size
  }

  /**
   * Clear all nonces (useful for testing)
   */
  clear() {
    this.store.clear()
    logger.info('All nonces cleared')
  }
}

export const nonceManager = new NonceManager()

