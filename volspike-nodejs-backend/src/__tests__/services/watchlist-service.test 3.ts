import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma BEFORE imports
vi.mock('../../index', () => ({
  prisma: {
    watchlist: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    watchlistItem: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    contract: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Import after mocking
import { WatchlistService } from '../../services/watchlist-service'
import { prisma } from '../../index'

const mockPrisma = prisma as any

describe('WatchlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLimits', () => {
    it('should return correct limits for Free tier', () => {
      const limits = WatchlistService.getLimits('free')
      expect(limits.watchlistLimit).toBe(1)
      expect(limits.symbolLimit).toBe(10)
    })

    it('should return correct limits for Pro tier', () => {
      const limits = WatchlistService.getLimits('pro')
      expect(limits.watchlistLimit).toBe(3)
      expect(limits.symbolLimit).toBe(30)
    })

    it('should return correct limits for Elite tier', () => {
      const limits = WatchlistService.getLimits('elite')
      expect(limits.watchlistLimit).toBe(50)
      expect(limits.symbolLimit).toBe(Number.MAX_SAFE_INTEGER) // Unlimited
    })

    it('should default to Free tier limits for unknown tier', () => {
      const limits = WatchlistService.getLimits('unknown' as any)
      expect(limits.watchlistLimit).toBe(1)
      expect(limits.symbolLimit).toBe(10)
    })
  })

  describe('countWatchlists', () => {
    it('should return correct watchlist count', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(2)

      const count = await WatchlistService.countWatchlists('user-123')
      expect(count).toBe(2)
      expect(mockPrisma.watchlist.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
    })

    it('should return 0 for user with no watchlists', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(0)

      const count = await WatchlistService.countWatchlists('user-123')
      expect(count).toBe(0)
    })
  })

  describe('countUniqueSymbols', () => {
    it('should count unique symbols across all watchlists', async () => {
      // Mock the query result - using groupBy to get unique contractIds
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([
        { contractId: 'contract-1', _count: { contractId: 1 } },
        { contractId: 'contract-2', _count: { contractId: 1 } },
        { contractId: 'contract-3', _count: { contractId: 1 } },
      ])

      const count = await WatchlistService.countUniqueSymbols('user-123')
      expect(count).toBe(3)
      expect(mockPrisma.watchlistItem.groupBy).toHaveBeenCalledWith({
        by: ['contractId'],
        where: {
          watchlist: {
            userId: 'user-123',
          },
        },
      })
    })

    it('should return 0 for user with no symbols', async () => {
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([])

      const count = await WatchlistService.countUniqueSymbols('user-123')
      expect(count).toBe(0)
    })

    it('should count symbol only once even if in multiple watchlists', async () => {
      // BTCUSDT in Watchlist A and Watchlist B should count as 1
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([
        { contractId: 'contract-1', _count: { contractId: 2 } }, // Same symbol in 2 watchlists
      ])

      const count = await WatchlistService.countUniqueSymbols('user-123')
      expect(count).toBe(1) // Still counts as 1 unique symbol
    })
  })

  describe('canCreateWatchlist', () => {
    it('should allow creation when under limit', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(0) // Free tier user with 0 watchlists

      const result = await WatchlistService.canCreateWatchlist('user-123', 'free')
      expect(result.allowed).toBe(true)
      expect(result.currentCount).toBe(0)
      expect(result.limit).toBe(1)
    })

    it('should prevent creation when at limit', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(1) // Free tier user with 1 watchlist

      const result = await WatchlistService.canCreateWatchlist('user-123', 'free')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('FREE tier limit')
      expect(result.currentCount).toBe(1)
      expect(result.limit).toBe(1)
    })

    it('should allow Pro tier user to create 3 watchlists', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(2) // Pro tier user with 2 watchlists

      const result = await WatchlistService.canCreateWatchlist('user-123', 'pro')
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(3)
    })

    it('should prevent Pro tier user from creating 4th watchlist', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(3) // Pro tier user with 3 watchlists

      const result = await WatchlistService.canCreateWatchlist('user-123', 'pro')
      expect(result.allowed).toBe(false)
      expect(result.limit).toBe(3)
    })
  })

  describe('canAddSymbol', () => {

    it('should allow addition when under symbol limit', async () => {
      // User has 9 unique symbols, adding 10th
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([
        { contractId: 'contract-1' },
        { contractId: 'contract-2' },
        // ... 7 more
      ])
      // Contract exists
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-btc', symbol: 'BTCUSDT' })
      // Symbol not in this watchlist
      mockPrisma.watchlistItem.findFirst.mockResolvedValue(null)
      // Symbol not in any other watchlist (new unique symbol)
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      const result = await WatchlistService.canAddSymbol(
        'user-123',
        'free',
        'BTCUSDT',
        'watchlist-1'
      )
      expect(result.allowed).toBe(true)
      expect(result.isDuplicate).toBe(false)
    })

    it('should prevent addition when at symbol limit', async () => {
      // User has 10 unique symbols (at Free tier limit)
      mockPrisma.watchlistItem.groupBy.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ contractId: `contract-${i}` }))
      )
      // Contract exists
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-eth', symbol: 'ETHUSDT' })
      // Symbol not in this watchlist
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null)
      // Symbol not in any other watchlist (would be new unique symbol)
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      const result = await WatchlistService.canAddSymbol(
        'user-123',
        'free',
        'ETHUSDT',
        'watchlist-1'
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('FREE tier limit')
      expect(result.currentCount).toBe(10)
      expect(result.limit).toBe(10)
    })

    it('should detect duplicate symbol in same watchlist', async () => {
      // Reset mocks for this test
      mockPrisma.contract.findUnique.mockReset()
      mockPrisma.watchlistItem.findFirst.mockReset()
      
      // Contract exists
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-1', symbol: 'BTCUSDT' })
      // Symbol already exists in this watchlist (first check - in watchlistId)
      // This is the check at line 149 in watchlist-service.ts
      // The service checks: where: { watchlistId, contractId }
      mockPrisma.watchlistItem.findFirst.mockImplementation(async (args: any) => {
        // First call: check if symbol exists in THIS watchlist
        if (args?.where?.watchlistId === 'watchlist-1' && args?.where?.contractId === 'contract-1') {
          return {
            id: 'item-1',
            watchlistId: 'watchlist-1',
            contractId: 'contract-1',
          }
        }
        return null
      })

      const result = await WatchlistService.canAddSymbol(
        'user-123',
        'free',
        'BTCUSDT',
        'watchlist-1'
      )
      expect(result.allowed).toBe(false)
      expect(result.isDuplicate).toBe(true)
      expect(result.reason).toContain('already in this watchlist')
    })

    it('should allow same symbol in different watchlist', async () => {
      // BTCUSDT in Watchlist A, adding to Watchlist B
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([{ contractId: 'contract-1' }])
      // Contract exists
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-1', symbol: 'BTCUSDT' })
      // Symbol not in Watchlist B (the target watchlist)
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null)
      // Symbol exists in another watchlist (already counted, so allowed)
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        watchlistId: 'watchlist-1',
        contractId: 'contract-1',
      })

      const result = await WatchlistService.canAddSymbol(
        'user-123',
        'free',
        'BTCUSDT',
        'watchlist-2' // Different watchlist
      )
      expect(result.allowed).toBe(true)
      expect(result.isDuplicate).toBe(false)
      // Should still count as 1 unique symbol (already counted in groupBy)
    })

    it('should allow Pro tier user to add up to 30 symbols', async () => {
      mockPrisma.watchlistItem.groupBy.mockResolvedValue(
        Array.from({ length: 29 }, (_, i) => ({ contractId: `contract-${i}` }))
      )
      // Contract exists
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 'contract-eth', symbol: 'ETHUSDT' })
      // Symbol not in this watchlist
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null)
      // Symbol not in any other watchlist (new unique symbol)
      mockPrisma.watchlistItem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      const result = await WatchlistService.canAddSymbol(
        'user-123',
        'pro',
        'ETHUSDT',
        'watchlist-1'
      )
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(30)
    })
  })

  describe('getLimitStatus', () => {
    it('should return complete limit status for Free tier', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(1)
      mockPrisma.watchlistItem.groupBy.mockResolvedValue([
        { contractId: 'contract-1' },
        { contractId: 'contract-2' },
      ])

      const status = await WatchlistService.getLimitStatus('user-123', 'free')
      expect(status.tier).toBe('free')
      expect(status.limits.watchlistLimit).toBe(1)
      expect(status.limits.symbolLimit).toBe(10)
      expect(status.usage.watchlistCount).toBe(1)
      expect(status.usage.symbolCount).toBe(2)
      expect(status.canCreateWatchlist).toBe(false) // At limit
      expect(status.canAddSymbol).toBe(true) // Under limit
      expect(status.remainingWatchlists).toBe(0)
      expect(status.remainingSymbols).toBe(8)
    })

    it('should return correct status for Pro tier', async () => {
      mockPrisma.watchlist.count.mockResolvedValue(2)
      mockPrisma.watchlistItem.groupBy.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({ contractId: `contract-${i}` }))
      )

      const status = await WatchlistService.getLimitStatus('user-123', 'pro')
      expect(status.tier).toBe('pro')
      expect(status.limits.watchlistLimit).toBe(3)
      expect(status.limits.symbolLimit).toBe(30)
      expect(status.usage.watchlistCount).toBe(2)
      expect(status.usage.symbolCount).toBe(25)
      expect(status.canCreateWatchlist).toBe(true)
      expect(status.canAddSymbol).toBe(true)
      expect(status.remainingWatchlists).toBe(1)
      expect(status.remainingSymbols).toBe(5)
    })
  })
})

