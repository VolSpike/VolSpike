import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

// Mock logger
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('NowPayments Service', () => {
  const originalEnv = process.env

  beforeEach(async () => {
    // Reset module registry to get fresh instance
    vi.resetModules()

    // Set environment variables BEFORE importing
    process.env = {
      ...originalEnv,
      NOWPAYMENTS_API_KEY: 'test-nowpayments-key',
      NOWPAYMENTS_API_URL: 'https://api.nowpayments.io/v1',
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const instance1 = NowPaymentsService.getInstance()
      const instance2 = NowPaymentsService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const mockResponse = {
        data: {
          payment_id: 'test-payment-123',
          payment_status: 'waiting',
          pay_address: '0xABCDEF123456',
          price_amount: 9,
          price_currency: 'USD',
          pay_amount: 0.0005,
          pay_currency: 'BTC',
          order_id: 'order-123',
          order_description: 'Pro subscription',
          pay_url: 'https://nowpayments.io/payment/test-payment-123',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const params = {
        price_amount: 9,
        price_currency: 'USD',
        pay_currency: 'BTC',
        order_id: 'order-123',
        order_description: 'Pro subscription',
      }

      const result = await service.createPayment(params)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.nowpayments.io/v1/payment',
        params,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )

      expect(result).toEqual(mockResponse.data)
      expect(result.payment_id).toBe('test-payment-123')
      expect(result.payment_status).toBe('waiting')
    })

    it('should throw error when API key is not configured', async () => {
      vi.resetModules()
      process.env.NOWPAYMENTS_API_KEY = ''

      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const params = {
        price_amount: 9,
        price_currency: 'USD',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'NowPayments API key is not configured'
      )
    })

    it('should handle 401 authentication error', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid API key' },
        },
      })

      const params = {
        price_amount: 9,
        price_currency: 'USD',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'NowPayments API authentication failed'
      )
    })

    it('should handle 400 bad request error', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Invalid price_amount' },
        },
      })

      const params = {
        price_amount: -1,
        price_currency: 'USD',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'Invalid payment request: Invalid price_amount'
      )
    })

    it('should handle network errors', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.post.mockRejectedValue(new Error('Network error'))

      const params = {
        price_amount: 9,
        price_currency: 'USD',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'Cannot connect to NowPayments API'
      )
    })

    it('should create payment with all optional parameters', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const mockResponse = {
        data: {
          payment_id: 'test-payment-456',
          payment_status: 'waiting',
          pay_address: '0xDEF456',
          price_amount: 49,
          price_currency: 'USD',
          pay_amount: 0.002,
          pay_currency: 'ETH',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const params = {
        price_amount: 49,
        price_currency: 'USD',
        pay_currency: 'ETH',
        order_id: 'order-456',
        order_description: 'Elite subscription',
        ipn_callback_url: 'https://example.com/ipn',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      }

      const result = await service.createPayment(params)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          price_amount: 49,
          price_currency: 'USD',
          pay_currency: 'ETH',
          order_id: 'order-456',
          ipn_callback_url: 'https://example.com/ipn',
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
        }),
        expect.any(Object)
      )

      expect(result.payment_id).toBe('test-payment-456')
    })
  })

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const mockResponse = {
        data: {
          payment_id: 'test-payment-123',
          payment_status: 'finished',
          pay_address: '0xABCDEF123456',
          price_amount: 9,
          price_currency: 'USD',
          pay_amount: 0.0005,
          actually_paid: 0.0005,
          pay_currency: 'BTC',
        },
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await service.getPaymentStatus('test-payment-123')

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.nowpayments.io/v1/payment/test-payment-123',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      )

      expect(result).toEqual(mockResponse.data)
      expect(result.payment_status).toBe('finished')
      expect(result.actually_paid).toBe(0.0005)
    })

    it('should handle errors when getting payment status', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.get.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Payment not found' },
        },
        message: 'Request failed',
      })

      await expect(service.getPaymentStatus('nonexistent')).rejects.toThrow(
        'Failed to get payment status'
      )
    })
  })

  describe('getInvoiceStatus', () => {
    it('should get invoice status successfully', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const mockResponse = {
        data: {
          id: 'invoice-123',
          invoice_url: 'https://nowpayments.io/invoice/invoice-123',
          order_id: 'order-123',
          price_amount: 9,
          price_currency: 'USD',
          pay_currency: 'USDT',
          pay_address: '0xINVOICEADDRESS',
          pay_amount: 9.05,
          created_at: '2024-01-01T00:00:00Z',
        },
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await service.getInvoiceStatus('invoice-123')

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.nowpayments.io/v1/invoice/invoice-123',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      )

      expect(result.id).toBe('invoice-123')
      expect(result.pay_address).toBe('0xINVOICEADDRESS')
    })

    it('should throw error when API key is not configured for invoice', async () => {
      vi.resetModules()
      process.env.NOWPAYMENTS_API_KEY = ''

      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      await expect(service.getInvoiceStatus('invoice-123')).rejects.toThrow(
        'NowPayments API key is not configured'
      )
    })
  })

  describe('Payment Status Values', () => {
    it('should handle all possible payment statuses', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const statuses = [
        'waiting',
        'confirming',
        'confirmed',
        'sending',
        'partially_paid',
        'finished',
        'failed',
        'refunded',
        'expired',
      ]

      for (const status of statuses) {
        const mockResponse = {
          data: {
            payment_id: 'test-payment',
            payment_status: status,
            pay_address: '0xABCDEF',
            price_amount: 9,
            price_currency: 'USD',
            pay_amount: 0.0005,
            pay_currency: 'BTC',
          },
        }

        mockedAxios.get.mockResolvedValue(mockResponse)

        const result = await service.getPaymentStatus('test-payment')
        expect(result.payment_status).toBe(status)
      }
    })
  })

  describe('Currency Support', () => {
    it('should support various cryptocurrencies', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      const currencies = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL']

      for (const currency of currencies) {
        const mockResponse = {
          data: {
            payment_id: `test-${currency}`,
            payment_status: 'waiting',
            pay_address: '0xABCDEF',
            price_amount: 9,
            price_currency: 'USD',
            pay_amount: 0.001,
            pay_currency: currency,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
        }

        mockedAxios.post.mockResolvedValue(mockResponse)

        const params = {
          price_amount: 9,
          price_currency: 'USD',
          pay_currency: currency,
        }

        const result = await service.createPayment(params)
        expect(result.pay_currency).toBe(currency)
      }
    })
  })

  describe('Error Response Formats', () => {
    it('should handle error with error_code', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 422,
          data: {
            error_code: 'INVALID_CURRENCY',
            message: 'Unsupported currency',
          },
        },
      })

      const params = {
        price_amount: 9,
        price_currency: 'INVALID',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'Failed to create payment: Unsupported currency'
      )
    })

    it('should handle generic error without specific message', async () => {
      const { NowPaymentsService } = await import('../../services/nowpayments')
      const service = NowPaymentsService.getInstance()

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 500,
          data: {},
        },
        message: 'Internal server error',
      })

      const params = {
        price_amount: 9,
        price_currency: 'USD',
      }

      await expect(service.createPayment(params)).rejects.toThrow(
        'Failed to create payment'
      )
    })
  })
})
