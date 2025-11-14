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
  pay_currency?: string
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

      logger.info('NowPayments payment created successfully', {
        paymentId: response.data.payment_id,
        orderId: params.order_id,
        paymentStatus: response.data.payment_status,
      })

      return response.data
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
      return response.data.currencies || []
    } catch (error: any) {
      logger.error('NowPayments get currencies error:', error.response?.data || error.message)
      return []
    }
  }
}

