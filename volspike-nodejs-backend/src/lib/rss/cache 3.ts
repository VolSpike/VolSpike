import NodeCache from 'node-cache'

/**
 * Simple in-memory cache for RSS feed data
 */
export class RssCache {
  private cache: NodeCache

  constructor(ttlSeconds: number = 900) {
    // 15 minutes default TTL
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Don't clone for better performance
    })
  }

  get<T>(key: string): T | null {
    const value = this.cache.get<T>(key)
    return value !== undefined ? value : null
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) {
      return this.cache.set(key, value, ttl)
    }
    return this.cache.set(key, value)
  }

  delete(key: string): number {
    return this.cache.del(key)
  }

  flush(): void {
    this.cache.flushAll()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  keys(): string[] {
    return this.cache.keys()
  }

  stats(): { hits: number; misses: number; keys: number } {
    const stats = this.cache.getStats()
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
    }
  }
}

// Singleton instance for RSS feed cache (15 minutes TTL)
export const rssCache = new RssCache(900)

// Separate cache for article query results (5 minutes TTL)
export const articleQueryCache = new RssCache(300)
