import { prisma } from '../index'
import { createLogger } from '../lib/logger'

const logger = createLogger()

/**
 * Service for managing watchlist limits and validation
 * Handles tier-based limits for watchlist creation and symbol addition
 */
export class WatchlistService {
  /**
   * Get watchlist and symbol limits based on user tier
   * @param tier - User tier: 'free', 'pro', or 'elite'
   * @returns Object with watchlistLimit and symbolLimit
   */
  static getLimits(tier: string): { watchlistLimit: number; symbolLimit: number } {
    switch (tier) {
      case 'free':
        return {
          watchlistLimit: 1,
          symbolLimit: 10,
        }
      case 'pro':
        return {
          watchlistLimit: 3,
          symbolLimit: 30,
        }
      case 'elite':
        return {
          watchlistLimit: 50,
          symbolLimit: Number.MAX_SAFE_INTEGER, // Unlimited for Elite
        }
      default:
        // Default to Free tier limits for unknown tiers
        logger.warn(`Unknown tier "${tier}", defaulting to Free tier limits`)
        return {
          watchlistLimit: 1,
          symbolLimit: 10,
        }
    }
  }

  /**
   * Count the number of watchlists a user has
   * @param userId - User ID
   * @returns Number of watchlists
   */
  static async countWatchlists(userId: string): Promise<number> {
    try {
      const count = await prisma.watchlist.count({
        where: { userId },
      })
      return count
    } catch (error) {
      logger.error(`Failed to count watchlists for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Count unique symbols across all user's watchlists
   * Symbols are counted once even if they appear in multiple watchlists
   * @param userId - User ID
   * @returns Number of unique symbols
   */
  static async countUniqueSymbols(userId: string): Promise<number> {
    try {
      // Use groupBy to get unique contractIds across all watchlists
      const result = await prisma.watchlistItem.groupBy({
        by: ['contractId'],
        where: {
          watchlist: {
            userId,
          },
        },
      })
      return result.length
    } catch (error) {
      logger.error(`Failed to count unique symbols for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Check if user can create a new watchlist
   * @param userId - User ID
   * @param tier - User tier
   * @returns Object with allowed status, reason, current count, and limit
   */
  static async canCreateWatchlist(
    userId: string,
    tier: string
  ): Promise<{
    allowed: boolean
    reason?: string
    currentCount: number
    limit: number
  }> {
    const limits = this.getLimits(tier)
    const currentCount = await this.countWatchlists(userId)

    if (currentCount >= limits.watchlistLimit) {
      const tierName = tier.toUpperCase()
      return {
        allowed: false,
        reason: `${tierName} tier limit: Maximum ${limits.watchlistLimit} watchlist${limits.watchlistLimit !== 1 ? 's' : ''}. You have ${currentCount}/${limits.watchlistLimit} watchlists.`,
        currentCount,
        limit: limits.watchlistLimit,
      }
    }

    return {
      allowed: true,
      currentCount,
      limit: limits.watchlistLimit,
    }
  }

  /**
   * Check if user can add a symbol to a watchlist
   * Validates symbol limit and duplicate checks
   * @param userId - User ID
   * @param tier - User tier
   * @param symbol - Symbol to add (e.g., "BTCUSDT")
   * @param watchlistId - Target watchlist ID
   * @returns Object with allowed status, reason, current count, limit, and duplicate status
   */
  static async canAddSymbol(
    userId: string,
    tier: string,
    symbol: string,
    watchlistId: string
  ): Promise<{
    allowed: boolean
    reason?: string
    currentCount: number
    limit: number
    isDuplicate: boolean
  }> {
    const limits = this.getLimits(tier)

    // Get or find contract for this symbol
    let contract = await prisma.contract.findUnique({
      where: { symbol },
    })

    // Check if symbol already exists in THIS watchlist (duplicate check)
    if (contract) {
      const existingItem = await prisma.watchlistItem.findFirst({
        where: {
          watchlistId,
          contractId: contract.id,
        },
      })

      if (existingItem) {
        return {
          allowed: false,
          reason: `This symbol is already in this watchlist.`,
          currentCount: 0, // Not relevant for duplicate
          limit: limits.symbolLimit,
          isDuplicate: true,
        }
      }
    }

    // Count unique symbols across all user's watchlists
    const currentCount = await this.countUniqueSymbols(userId)

    // Check if this symbol already exists in ANY of user's watchlists
    // If it does, adding it to another watchlist doesn't count as a new symbol
    let symbolExistsInOtherWatchlist = false
    if (contract) {
      const existingInOtherWatchlist = await prisma.watchlistItem.findFirst({
        where: {
          contractId: contract.id,
          watchlist: {
            userId,
          },
        },
      })
      symbolExistsInOtherWatchlist = !!existingInOtherWatchlist
    }

    // If this is a NEW unique symbol (not in any watchlist), check limit
    // If symbol already exists in another watchlist, it's already counted, so we can add it
    if (!symbolExistsInOtherWatchlist && currentCount >= limits.symbolLimit) {
      const tierName = tier.toUpperCase()
      return {
        allowed: false,
        reason: `${tierName} tier limit: Maximum ${limits.symbolLimit} symbol${limits.symbolLimit !== 1 ? 's' : ''}. You have ${currentCount}/${limits.symbolLimit} symbols.`,
        currentCount,
        limit: limits.symbolLimit,
        isDuplicate: false,
      }
    }

    return {
      allowed: true,
      currentCount,
      limit: limits.symbolLimit,
      isDuplicate: false,
    }
  }

  /**
   * Get complete limit status for a user
   * Includes limits, usage, and helper flags
   * @param userId - User ID
   * @param tier - User tier
   * @returns Complete limit status object
   */
  static async getLimitStatus(
    userId: string,
    tier: string
  ): Promise<{
    tier: string
    limits: { watchlistLimit: number; symbolLimit: number }
    usage: { watchlistCount: number; symbolCount: number }
    canCreateWatchlist: boolean
    canAddSymbol: boolean
    remainingWatchlists: number
    remainingSymbols: number
  }> {
    const limits = this.getLimits(tier)
    const watchlistCount = await this.countWatchlists(userId)
    const symbolCount = await this.countUniqueSymbols(userId)

    return {
      tier,
      limits,
      usage: {
        watchlistCount,
        symbolCount,
      },
      canCreateWatchlist: watchlistCount < limits.watchlistLimit,
      canAddSymbol: symbolCount < limits.symbolLimit,
      remainingWatchlists: Math.max(0, limits.watchlistLimit - watchlistCount),
      remainingSymbols: Math.max(0, limits.symbolLimit - symbolCount),
    }
  }

  /**
   * Delete all watchlists for a user
   * Used when user downgrades tier
   * @param userId - User ID
   * @returns Number of watchlists deleted
   */
  static async deleteAllWatchlists(userId: string): Promise<number> {
    try {
      // Prisma will cascade delete WatchlistItems due to onDelete: Cascade
      const result = await prisma.watchlist.deleteMany({
        where: { userId },
      })
      logger.info(`Deleted ${result.count} watchlists for user ${userId}`)
      return result.count
    } catch (error) {
      logger.error(`Failed to delete watchlists for user ${userId}:`, error)
      throw error
    }
  }
}

