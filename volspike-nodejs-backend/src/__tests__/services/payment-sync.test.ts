import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('../../index', () => ({
  prisma: {
    cryptoPayment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}))

vi.mock('../../services/nowpayments')
vi.mock('../../services/email')
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Import after mocking
import { syncPendingPayments } from '../../services/payment-sync'
import { prisma } from '../../index'
import { NowPaymentsService } from '../../services/nowpayments'
import { EmailService } from '../../services/email'

const mockPrisma = prisma as any

describe('Payment Sync Service', () => {
  let mockNowPayments: any
  let mockEmailService: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockNowPayments = {
      getPaymentStatus: vi.fn(),
    }

    mockEmailService = {
      sendPaymentIssueAlertEmail: vi.fn(),
      sendPartialPaymentEmail: vi.fn(),
      sendPaymentConfirmedEmail: vi.fn(),
    }

    vi.mocked(NowPaymentsService.getInstance).mockReturnValue(mockNowPayments)
    vi.mocked(EmailService.getInstance).mockReturnValue(mockEmailService)

    mockPrisma.$transaction = vi.fn(async (callback: any) =>
      callback({
        user: mockPrisma.user,
        cryptoPayment: mockPrisma.cryptoPayment,
      }),
    )
  })

  describe('syncPendingPayments', () => {
    it('should return zeros when there are no pending payments', async () => {
      mockPrisma.cryptoPayment.findMany.mockResolvedValue([])

      const result = await syncPendingPayments()

      expect(result).toEqual({
        checked: 0,
        synced: 0,
        upgraded: 0,
      })
    })

    it('should sync payment status from NowPayments API', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'waiting',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        payCurrency: 'USDT',
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tier: 'FREE',
        },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'confirmed',
        actually_paid: 9,
        pay_currency: 'USDT',
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'confirmed',
        actuallyPaid: 9,
        paidAt: new Date(),
      })

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        tier: 'PRO',
      })

      const result = await syncPendingPayments()

      expect(mockPrisma.cryptoPayment.findMany).toHaveBeenCalledWith({
        where: {
          paymentId: { not: null },
          paymentStatus: {
            notIn: ['finished', 'confirmed', 'failed', 'refunded', 'expired'],
          },
        },
        include: { user: true },
        take: 100,
      })

      expect(mockNowPayments.getPaymentStatus).toHaveBeenCalledWith('np-payment-123')

      expect(result.synced).toBe(1)
      expect(result.upgraded).toBe(1)
    })

    it('should upgrade user when payment is confirmed', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'confirming',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tier: 'FREE',
        },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'finished',
        actually_paid: 9,
        pay_currency: 'USDT',
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'finished',
        actuallyPaid: 9,
        paidAt: new Date(),
        user: mockPayment.user,
      })

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        tier: 'PRO',
      })

      const result = await syncPendingPayments()

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          tier: 'PRO',
        },
      })

      expect(result.upgraded).toBe(1)
    })

    it('should handle partially_paid status with currency normalization', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'waiting',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        payCurrency: 'USD',
        updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago (recent)
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tier: 'FREE',
        },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'partially_paid',
        pay_currency: 'SOL',
        pay_amount: 0.5,
        actually_paid: 0.25,
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'partially_paid',
        actuallyPaid: 0.25,
        updatedAt: new Date(),
        user: mockPayment.user,
      })

      const result = await syncPendingPayments()

      // Should update payment but not upgrade user
      expect(mockPrisma.cryptoPayment.update).toHaveBeenCalled()
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(result.upgraded).toBe(0)

      // Should send alert emails
      expect(mockEmailService.sendPaymentIssueAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CRYPTO_PAYMENT_PARTIALLY_PAID_SYNC',
          details: expect.objectContaining({
            paymentId: 'np-payment-123',
            amounts: expect.objectContaining({
              requestedUsd: 9,
              requestedCrypto: 0.5,
              actuallyPaidCrypto: 0.25,
              shortfallCrypto: 0.25,
              shortfallPercent: '50.00%',
            }),
          }),
        }),
      )
      expect(mockEmailService.sendPartialPaymentEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: undefined,
        tier: 'PRO',
        requestedAmount: 0.5,
        actuallyPaid: 0.25,
        payCurrency: 'SOL',
        shortfall: 0.25,
        shortfallPercent: '50.00%',
        paymentId: 'np-payment-123',
        orderId: 'order-123',
      })
    })

    it('should not send duplicate emails for unchanged partially_paid status', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'partially_paid',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        payCurrency: 'SOL',
        actuallyPaid: 0.25,
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tier: 'FREE',
        },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'partially_paid',
        pay_currency: 'SOL',
        pay_amount: 0.5,
        actually_paid: 0.25,
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'partially_paid',
        actuallyPaid: 0.25,
        updatedAt: new Date(),
        user: mockPayment.user,
      })

      const result = await syncPendingPayments()

      // Should NOT send emails for unchanged status/amount
      expect(mockEmailService.sendPaymentIssueAlertEmail).not.toHaveBeenCalled()
      expect(mockEmailService.sendPartialPaymentEmail).not.toHaveBeenCalled()
    })

    it('should resend partial email when additional funds arrive', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'partially_paid',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        payCurrency: 'SOL',
        actuallyPaid: 0.2,
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          tier: 'FREE',
        },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'partially_paid',
        pay_currency: 'SOL',
        pay_amount: 0.5,
        actually_paid: 0.26,
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'partially_paid',
        actuallyPaid: 0.26,
        updatedAt: new Date(),
        user: mockPayment.user,
      })

      await syncPendingPayments()

      expect(mockEmailService.sendPaymentIssueAlertEmail).toHaveBeenCalled()
      expect(mockEmailService.sendPartialPaymentEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedAmount: 0.5,
          actuallyPaid: 0.26,
          payCurrency: 'SOL',
        }),
      )
    })

    it('should process multiple payments in batch', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          paymentId: 'np-payment-1',
          paymentStatus: 'waiting',
          userId: 'user-1',
          tier: 'PRO',
          orderId: 'order-1',
          payAmount: 9,
          updatedAt: new Date(),
          user: { id: 'user-1', email: 'user1@example.com', tier: 'FREE' },
        },
        {
          id: 'payment-2',
          paymentId: 'np-payment-2',
          paymentStatus: 'confirming',
          userId: 'user-2',
          tier: 'ELITE',
          orderId: 'order-2',
          payAmount: 49,
          updatedAt: new Date(),
          user: { id: 'user-2', email: 'user2@example.com', tier: 'FREE' },
        },
      ]

      mockPrisma.cryptoPayment.findMany.mockResolvedValue(mockPayments)

      mockNowPayments.getPaymentStatus
        .mockResolvedValueOnce({
          payment_id: 'np-payment-1',
          payment_status: 'finished',
          actually_paid: 9,
          pay_currency: 'USDT',
        })
        .mockResolvedValueOnce({
          payment_id: 'np-payment-2',
          payment_status: 'finished',
          actually_paid: 49,
          pay_currency: 'USDT',
        })

      mockPrisma.cryptoPayment.update
        .mockResolvedValueOnce({
          ...mockPayments[0],
          paymentStatus: 'finished',
          paidAt: new Date(),
          user: mockPayments[0].user,
        })
        .mockResolvedValueOnce({
          ...mockPayments[1],
          paymentStatus: 'finished',
          paidAt: new Date(),
          user: mockPayments[1].user,
        })

      mockPrisma.user.update.mockResolvedValue({})

      const result = await syncPendingPayments()

      expect(result.checked).toBe(2)
      expect(result.synced).toBe(2)
      expect(result.upgraded).toBe(2)
    })

    it('should skip payment without paymentId', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: null,
        paymentStatus: 'waiting',
        userId: 'user-1',
        tier: 'PRO',
        updatedAt: new Date(),
        user: { id: 'user-1', email: 'test@example.com', tier: 'FREE' },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      const result = await syncPendingPayments()

      expect(mockNowPayments.getPaymentStatus).not.toHaveBeenCalled()
      expect(result.synced).toBe(0)
    })

    it('should handle errors gracefully for individual payments', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          paymentId: 'np-payment-1',
          paymentStatus: 'waiting',
          userId: 'user-1',
          tier: 'PRO',
          orderId: 'order-1',
          payAmount: 9,
          updatedAt: new Date(),
          user: { id: 'user-1', email: 'user1@example.com', tier: 'FREE' },
        },
        {
          id: 'payment-2',
          paymentId: 'np-payment-2',
          paymentStatus: 'waiting',
          userId: 'user-2',
          tier: 'PRO',
          orderId: 'order-2',
          payAmount: 9,
          updatedAt: new Date(),
          user: { id: 'user-2', email: 'user2@example.com', tier: 'FREE' },
        },
      ]

      mockPrisma.cryptoPayment.findMany.mockResolvedValue(mockPayments)

      // First payment fails, second succeeds
      mockNowPayments.getPaymentStatus
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          payment_id: 'np-payment-2',
          payment_status: 'finished',
          actually_paid: 9,
          pay_currency: 'USDT',
        })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayments[1],
        paymentStatus: 'finished',
        paidAt: new Date(),
        user: mockPayments[1].user,
      })

      mockPrisma.user.update.mockResolvedValue({})

      const result = await syncPendingPayments()

      // Second payment should still be processed despite first failing
      expect(result.synced).toBe(1)
    })

    it('should respect batch limit of 100 payments', async () => {
      mockPrisma.cryptoPayment.findMany.mockResolvedValue([])

      await syncPendingPayments()

      expect(mockPrisma.cryptoPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      )
    })

    it('should set paidAt timestamp when payment is finished', async () => {
      const mockPayment = {
        id: 'payment-1',
        paymentId: 'np-payment-123',
        paymentStatus: 'waiting',
        userId: 'user-1',
        tier: 'PRO',
        orderId: 'order-123',
        payAmount: 9,
        updatedAt: new Date(),
        user: { id: 'user-1', email: 'test@example.com', tier: 'FREE' },
      }

      mockPrisma.cryptoPayment.findMany.mockResolvedValue([mockPayment])

      mockNowPayments.getPaymentStatus.mockResolvedValue({
        payment_id: 'np-payment-123',
        payment_status: 'finished',
        actually_paid: 9,
        pay_currency: 'USDT',
      })

      mockPrisma.cryptoPayment.update.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'finished',
        paidAt: new Date(),
        user: mockPayment.user,
      })

      mockPrisma.user.update.mockResolvedValue({})

      await syncPendingPayments()

      expect(mockPrisma.cryptoPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          paymentStatus: 'finished',
          paidAt: expect.any(Date),
        }),
        include: { user: true },
      })
    })
  })
})
