import axios from 'axios'
import crypto from 'crypto'
import { createLogger } from '../lib/logger'

const logger = createLogger()

const API_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1'
const API_KEY = process.env.NOWPAYMENTS_API_KEY || ''
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ''

export interface CreatePaymentParams {
  price_amount: number
  price_currency: string
  pay_currency?: string  // Optional - if omitted, user can choose from all available currencies
  payout_currency?: string  // Optional - merchant payout currency (defaults to account setting)
  order_id?: string
  order_description?: string
  ipn_callback_url?: string
  success_url?: string
  cancel_url?: string
}

export interface CreateInvoiceParams {
  price_amount: number
  price_currency: string
  pay_currency?: string  // Optional - if omitted, user can choose on checkout page
  payout_currency?: string  // Optional - merchant payout currency
  order_id?: string
  order_description?: string
  ipn_callback_url?: string
  success_url?: string
  cancel_url?: string
}

export interface PaymentResponse {
  payment_id: string
  payment_status: string
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  actually_paid?: number
  pay_currency: string
  order_id?: string
  order_description?: string
  purchase_id?: string
  outcome_amount?: number
  outcome_currency?: string
  pay_url?: string
  invoice_id?: string
}

export interface InvoiceResponse {
  // Raw fields from NowPayments API
  id?: string | number  // NowPayments returns 'id', not 'invoice_id'
  invoice_url?: string
  order_id?: string
  price_amount?: number | string  // Sometimes returned as string
  price_currency?: string
  pay_currency?: string
  is_fixed_rate?: boolean
  is_fee_paid_by_user?: boolean
  created_at?: string

  // Normalized aliases that the rest of your code expects
  invoice_id?: string | number  // Normalized from 'id'

  // Keep it open-ended so we don't fight their schema
  [key: string]: any
}

export class NowPaymentsService {
  private static instance: NowPaymentsService

  static getInstance(): NowPaymentsService {
    if (!NowPaymentsService.instance) {
      NowPaymentsService.instance = new NowPaymentsService()
    }
    return NowPaymentsService.instance
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    if (!API_KEY) {
      logger.error('NowPayments API key is not configured')
      throw new Error('NowPayments API key is not configured. Please set NOWPAYMENTS_API_KEY environment variable.')
    }

    try {
      logger.info('Creating NowPayments payment', {
        price_amount: params.price_amount,
        price_currency: params.price_currency,
        order_id: params.order_id,
        API_URL,
      })

      const response = await axios.post(
        `${API_URL}/payment`,
        params,
        {
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      )

      // Log EVERYTHING about the response for debugging
      const responseData = response.data
      logger.info('NowPayments payment created successfully - FULL RESPONSE ANALYSIS', {
        // Basic fields
        paymentId: responseData.payment_id,
        invoiceId: responseData.invoice_id,
        orderId: params.order_id,
        paymentStatus: responseData.payment_status,
        payUrl: responseData.pay_url,
        payAddress: responseData.pay_address,

        // All response keys
        responseKeys: Object.keys(responseData),
        responseKeysCount: Object.keys(responseData).length,

        // Check for common field variations
        hasPaymentId: !!responseData.payment_id,
        hasInvoiceId: !!responseData.invoice_id,
        hasPayUrl: !!responseData.pay_url,
        hasPayAddress: !!responseData.pay_address,
        hasPaymentUrl: !!responseData.payment_url,
        hasInvoiceUrl: !!responseData.invoice_url,
        hasUrl: !!responseData.url,

        // Check for nested objects
        hasInvoice: !!responseData.invoice,
        hasPayment: !!responseData.payment,

        // Full response (stringified for complete visibility)
        fullResponse: JSON.stringify(responseData, null, 2),

        // Response status
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })

      return responseData
    } catch (error: any) {
      const errorDetails = error.response?.data || {}
      const errorMessage = errorDetails.message || error.message || 'Unknown error'
      const errorCode = errorDetails.error_code || error.response?.status

      logger.error('NowPayments create payment error:', {
        message: errorMessage,
        code: errorCode,
        status: error.response?.status,
        data: errorDetails,
        fullError: error.message,
      })

      // Provide more helpful error messages
      if (error.response?.status === 401) {
        throw new Error('NowPayments API authentication failed. Please check your API key.')
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid payment request: ${errorMessage}`)
      } else if (!error.response) {
        throw new Error(`Cannot connect to NowPayments API. Please check your network connection and API URL.`)
      }

      throw new Error(`Failed to create payment: ${errorMessage}`)
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response = await axios.get(`${API_URL}/payment/${paymentId}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })

      return response.data
    } catch (error: any) {
      logger.error('NowPayments get payment status error:', error.response?.data || error.message)
      throw new Error(`Failed to get payment status: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Get invoice status and payment details
   * This is used to get payment address for QR code generation
   */
  async getInvoiceStatus(invoiceId: string): Promise<InvoiceResponse & { pay_address?: string; pay_amount?: number }> {
    if (!API_KEY) {
      logger.error('NowPayments API key is not configured')
      throw new Error('NowPayments API key is not configured')
    }

    try {
      logger.info('Fetching NowPayments invoice status', { invoiceId })

      const response = await axios.get(`${API_URL}/invoice/${invoiceId}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })

      const data = response.data

      logger.info('NowPayments invoice status fetched', {
        invoiceId,
        hasPayAddress: !!data.pay_address,
        payAddress: data.pay_address,
        payAmount: data.pay_amount,
        paymentStatus: data.payment_status,
        responseKeys: Object.keys(data),
        fullResponse: JSON.stringify(data, null, 2),
      })

      return data
    } catch (error: any) {
      logger.error('NowPayments get invoice status error:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        invoiceId,
        fullError: error.message,
      })
      throw new Error(`Failed to get invoice status: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Create a payment from an invoice
   * This is needed to get the pay_address for QR code generation
   */
  async createPaymentFromInvoice(invoiceId: string): Promise<PaymentResponse> {
    if (!API_KEY) {
      logger.error('NowPayments API key is not configured')
      throw new Error('NowPayments API key is not configured')
    }

    try {
      logger.info('Creating payment from invoice', { invoiceId })

      // First get invoice details to extract pay_currency
      const invoice = await this.getInvoiceStatus(invoiceId)

      if (!invoice.pay_currency) {
        throw new Error('Invoice does not have pay_currency set. User must select currency first on NowPayments page.')
      }

      // Get invoice details to get price_amount
      const priceAmount = typeof invoice.price_amount === 'string'
        ? parseFloat(invoice.price_amount)
        : invoice.price_amount || 0

      // Create payment using invoice details
      const payment = await this.createPayment({
        price_amount: priceAmount,
        price_currency: invoice.price_currency || 'usd',
        pay_currency: invoice.pay_currency,
        payout_currency: invoice.pay_currency,
        order_id: invoice.order_id,
        order_description: `Payment for invoice ${invoiceId}`,
      })

      logger.info('Payment created from invoice', {
        invoiceId,
        paymentId: payment.payment_id,
        payAddress: payment.pay_address,
        payAmount: payment.pay_amount,
      })

      return payment
    } catch (error: any) {
      logger.error('NowPayments create payment from invoice error:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        invoiceId,
        fullError: error.message,
      })
      throw error
    }
  }

  verifyIPNSignature(body: string, signature: string): boolean {
    try {
      const hmac = crypto.createHmac('sha512', IPN_SECRET)
      hmac.update(body)
      const calculatedSignature = hmac.digest('hex')
      return calculatedSignature === signature
    } catch (error) {
      logger.error('IPN signature verification error:', error)
      return false
    }
  }

  async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
    if (!API_KEY) {
      logger.error('NowPayments API key is not configured')
      throw new Error('NowPayments API key is not configured. Please set NOWPAYMENTS_API_KEY environment variable.')
    }

    try {
      logger.info('Creating NowPayments invoice', {
        price_amount: params.price_amount,
        price_currency: params.price_currency,
        order_id: params.order_id,
        pay_currency: params.pay_currency || '(omitted - user will choose)',
        API_URL,
      })

      const response = await axios.post(
        `${API_URL}/invoice`,
        params,
        {
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data as InvoiceResponse

      // Normalize NowPayments field names to match our codebase expectations
      // NowPayments returns 'id' not 'invoice_id', and 'invoice_url' (which is correct)
      const invoiceId = data.invoice_id ?? data.id ?? (data as any)?.invoice?.id
      const invoiceUrl = data.invoice_url ?? (data as any).payment_url ?? (data as any).url ?? (data as any)?.invoice?.invoice_url

      // Create normalized response with both raw and normalized fields
      const normalized: InvoiceResponse = {
        ...data,
        // Keep raw fields
        id: data.id ?? invoiceId,
        invoice_url: invoiceUrl,
        // Add normalized aliases for our codebase
        invoice_id: invoiceId,
      }

      logger.info('NowPayments invoice created successfully - FULL RESPONSE ANALYSIS', {
        // Raw fields from API
        rawId: data.id,
        rawInvoiceUrl: data.invoice_url,
        // Normalized fields (what our code uses)
        invoiceId: normalized.invoice_id,
        invoiceUrl: normalized.invoice_url,
        orderId: normalized.order_id,
        priceAmount: normalized.price_amount,
        priceCurrency: normalized.price_currency,
        payCurrency: normalized.pay_currency,
        // Response metadata
        responseKeys: Object.keys(data),
        responseKeysCount: Object.keys(data).length,
        normalizedKeys: Object.keys(normalized),
        // Full responses for debugging
        rawResponse: JSON.stringify(data, null, 2),
        normalizedResponse: JSON.stringify(normalized, null, 2),
        status: response.status,
        statusText: response.statusText,
        // Validation checks
        hasRawId: !!data.id,
        hasRawInvoiceUrl: !!data.invoice_url,
        hasNormalizedInvoiceId: !!normalized.invoice_id,
        hasNormalizedInvoiceUrl: !!normalized.invoice_url,
      })

      return normalized
    } catch (error: any) {
      const errorDetails = error.response?.data || {}
      const errorMessage = errorDetails.message || error.message || 'Unknown error'
      const errorCode = errorDetails.error_code || error.response?.status

      logger.error('NowPayments create invoice error - FULL DETAILS:', {
        message: errorMessage,
        code: errorCode,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: errorDetails,
        fullError: error.message,
        requestParams: {
          price_amount: params.price_amount,
          price_currency: params.price_currency,
          pay_currency: params.pay_currency,
          order_id: params.order_id,
        },
        responseHeaders: error.response?.headers,
        responseData: JSON.stringify(errorDetails, null, 2),
      })

      // Provide more helpful error messages with specific handling
      if (error.response?.status === 401) {
        throw new Error('NowPayments API authentication failed. Please check your API key.')
      } else if (error.response?.status === 400) {
        // Parse common 400 errors
        const lowerMessage = errorMessage.toLowerCase()
        if (lowerMessage.includes('less than minimal') || lowerMessage.includes('minimum')) {
          const amountMatch = errorMessage.match(/(\d+\.?\d*)/)
          const minAmount = amountMatch ? amountMatch[1] : 'unknown'
          throw new Error(`Payment amount is below minimum. NowPayments requires at least $${minAmount} for this currency. Please increase the test amount.`)
        } else if (lowerMessage.includes('currency') || lowerMessage.includes('pay_currency')) {
          throw new Error(`Invalid currency: ${errorMessage}. Please select a different payment currency.`)
        } else {
          throw new Error(`Invalid invoice request: ${errorMessage}`)
        }
      } else if (!error.response) {
        throw new Error(`Cannot connect to NowPayments API. Please check your network connection and API URL.`)
      }

      throw new Error(`Failed to create invoice: ${errorMessage}`)
    }
  }

  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/currencies`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })

      const currencies = response.data.currencies || []

      // Find USDC-related currencies for better debugging
      const usdcRelated = currencies.filter((c: string) =>
        c.toUpperCase().includes('USDC')
      )

      logger.info('NowPayments currencies fetched', {
        count: currencies.length,
        currencies: currencies.slice(0, 50), // Log first 50 for debugging
        hasUSDTSOL: currencies.some((c: string) => c.toUpperCase().includes('USDTSOL') || c.toUpperCase().includes('USDT_SOL')),
        hasUSDTERC20: currencies.some((c: string) => c.toUpperCase().includes('USDTERC20') || c.toUpperCase().includes('USDT_ETH')),
        hasUSDCERC20: currencies.some((c: string) => c.toUpperCase().includes('USDCERC20') || c.toUpperCase().includes('USDC_ETH')),
        usdcRelatedCurrencies: usdcRelated, // Log all USDC variants for debugging
        hasSOL: currencies.some((c: string) => c.toUpperCase() === 'SOL'),
        hasBTC: currencies.some((c: string) => c.toUpperCase() === 'BTC'),
        hasETH: currencies.some((c: string) => c.toUpperCase() === 'ETH'),
      })

      return currencies
    } catch (error: any) {
      logger.error('NowPayments get currencies error:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        fullError: error.message,
      })
      return []
    }
  }

  /**
   * Get minimum payment amount for a currency pair
   * @param currencyFrom - Source currency (e.g., 'usd')
   * @param currencyTo - Destination currency (e.g., 'usdtsol', 'btc')
   * @returns Minimum amount in USD, or null if unable to fetch
   */
  async getMinimumAmount(currencyFrom: string = 'usd', currencyTo: string): Promise<number | null> {
    if (!API_KEY) {
      logger.warn('NowPayments API key not configured, cannot fetch minimum amount')
      return null
    }

    try {
      // Map our currency codes to NowPayments format
      const currencyMapper = await import('./currency-mapper')
      const mappedCurrency = currencyMapper.mapCurrencyToNowPayments(currencyTo, [])
      const payCurrency = mappedCurrency || currencyTo.toLowerCase()

      logger.info('Fetching minimum amount from NowPayments', {
        currencyFrom,
        currencyTo,
        payCurrency,
      })

      const response = await axios.get(`${API_URL}/min-amount`, {
        params: {
          currency_from: currencyFrom.toLowerCase(),
          currency_to: payCurrency,
        },
        headers: {
          'x-api-key': API_KEY,
        },
      })

      const minAmount = response.data?.min_amount

      if (minAmount && typeof minAmount === 'number') {
        logger.info('NowPayments minimum amount fetched', {
          currencyFrom,
          currencyTo,
          payCurrency,
          minAmount,
        })
        return minAmount
      }

      logger.warn('NowPayments min-amount endpoint returned invalid data', {
        response: response.data,
        currencyFrom,
        currencyTo,
      })
      return null
    } catch (error: any) {
      logger.error('NowPayments get minimum amount error:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        currencyFrom,
        currencyTo,
        fullError: error.message,
      })
      return null
    }
  }
}
