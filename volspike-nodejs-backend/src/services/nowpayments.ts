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
    try {
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

      logger.info('NowPayments payment created', {
        paymentId: response.data.payment_id,
        orderId: params.order_id,
      })

      return response.data
    } catch (error: any) {
      logger.error('NowPayments create payment error:', error.response?.data || error.message)
      throw new Error(`Failed to create payment: ${error.response?.data?.message || error.message}`)
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

