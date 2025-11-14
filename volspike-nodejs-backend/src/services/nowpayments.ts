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

  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/currencies`, {
        headers: {
          'x-api-key': API_KEY,
        },
      })
      
      const currencies = response.data.currencies || []
      
      logger.info('NowPayments currencies fetched', {
        count: currencies.length,
        currencies: currencies.slice(0, 50), // Log first 50 for debugging
        hasUSDTSOL: currencies.some((c: string) => c.toUpperCase().includes('USDTSOL') || c.toUpperCase().includes('USDT_SOL')),
        hasUSDTERC20: currencies.some((c: string) => c.toUpperCase().includes('USDTERC20') || c.toUpperCase().includes('USDT_ETH')),
        hasUSDCERC20: currencies.some((c: string) => c.toUpperCase().includes('USDCERC20') || c.toUpperCase().includes('USDC_ETH')),
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
}

