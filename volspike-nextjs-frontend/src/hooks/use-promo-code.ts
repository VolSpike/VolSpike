'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ValidatePromoCodeResponse {
    valid: boolean
    discountPercent?: number
    originalPrice?: number
    finalPrice?: number
    error?: string
    reason?: string
}

export function usePromoCode(tier: 'pro' | 'elite') {
    const { data: session } = useSession()
    const [promoCode, setPromoCode] = useState('')
    const [discountPercent, setDiscountPercent] = useState(0)
    const [originalPrice, setOriginalPrice] = useState(0)
    const [finalPrice, setFinalPrice] = useState(0)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [isValid, setIsValid] = useState(false)

    const validatePromoCode = useCallback(async (code: string) => {
        if (!code.trim()) {
            setError('')
            setDiscountPercent(0)
            setOriginalPrice(0)
            setFinalPrice(0)
            setIsValid(false)
            return
        }

        setLoading(true)
        setError('')

        try {
            const authToken = (session as any)?.accessToken || (session?.user as any)?.id

            if (!authToken) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(`${API_URL}/api/payments/validate-promo-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    code: code.toUpperCase().trim(),
                    tier,
                    paymentMethod: 'crypto',
                }),
            })

            const data: ValidatePromoCodeResponse = await response.json()

            if (data.valid) {
                setDiscountPercent(data.discountPercent || 0)
                setOriginalPrice(data.originalPrice || 0)
                setFinalPrice(data.finalPrice || 0)
                setIsValid(true)
                setError('')
            } else {
                setError(data.error || 'Invalid promo code')
                setDiscountPercent(0)
                setOriginalPrice(0)
                setFinalPrice(0)
                setIsValid(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to validate promo code')
            setDiscountPercent(0)
            setOriginalPrice(0)
            setFinalPrice(0)
            setIsValid(false)
        } finally {
            setLoading(false)
        }
    }, [tier, session])

    const applyPromoCode = useCallback((code: string) => {
        setPromoCode(code.toUpperCase().trim())
        validatePromoCode(code)
    }, [validatePromoCode])

    const clearPromoCode = useCallback(() => {
        setPromoCode('')
        setDiscountPercent(0)
        setOriginalPrice(0)
        setFinalPrice(0)
        setError('')
        setIsValid(false)
    }, [])

    return {
        promoCode,
        setPromoCode,
        discountPercent,
        originalPrice,
        finalPrice,
        error,
        loading,
        isValid,
        validatePromoCode,
        applyPromoCode,
        clearPromoCode,
    }
}
