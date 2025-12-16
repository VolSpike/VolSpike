import { PrismaClient, PromoPaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

// Tier pricing (monthly)
const TIER_PRICING = {
    pro: 19.0,
    elite: 100.0,
} as const

export interface ValidatePromoCodeRequest {
    code: string
    tier: 'pro' | 'elite'
    paymentMethod: 'crypto' | 'stripe'
}

export interface ValidatePromoCodeResponse {
    valid: boolean
    discountPercent?: number
    originalPrice?: number
    finalPrice?: number
    error?: string
    reason?: 'expired' | 'max_uses_reached' | 'inactive' | 'invalid_code' | 'wrong_payment_method'
    promoCodeId?: string
}

export class PromoCodeService {
    /**
     * Validate a promo code and calculate discount
     */
    async validateCode(request: ValidatePromoCodeRequest): Promise<ValidatePromoCodeResponse> {
        const { code, tier, paymentMethod } = request

        // Normalize code to uppercase
        const normalizedCode = code.toUpperCase().trim()

        // Find promo code
        const promoCode = await prisma.promoCode.findUnique({
            where: { code: normalizedCode },
        })

        if (!promoCode) {
            return {
                valid: false,
                error: 'Promo code not found',
                reason: 'invalid_code',
            }
        }

        // Check if active
        if (!promoCode.active) {
            return {
                valid: false,
                error: 'Promo code is no longer active',
                reason: 'inactive',
            }
        }

        // Check if expired
        if (new Date() > promoCode.validUntil) {
            return {
                valid: false,
                error: 'Promo code has expired',
                reason: 'expired',
            }
        }

        // Check usage limit
        if (promoCode.currentUses >= promoCode.maxUses) {
            return {
                valid: false,
                error: 'Promo code usage limit reached',
                reason: 'max_uses_reached',
            }
        }

        // Check payment method compatibility
        const paymentMethodMatch = this.checkPaymentMethodMatch(
            promoCode.paymentMethod,
            paymentMethod
        )

        if (!paymentMethodMatch) {
            return {
                valid: false,
                error: `Promo code not valid for ${paymentMethod} payments`,
                reason: 'wrong_payment_method',
            }
        }

        // Calculate discount
        const originalPrice = TIER_PRICING[tier]
        const discountAmount = (originalPrice * promoCode.discountPercent) / 100
        const finalPrice = Math.max(0, originalPrice - discountAmount)

        return {
            valid: true,
            discountPercent: promoCode.discountPercent,
            originalPrice,
            finalPrice,
            promoCodeId: promoCode.id,
        }
    }

    /**
     * Calculate discount for a promo code
     */
    async calculateDiscount(
        code: string,
        originalPrice: number
    ): Promise<{ discountAmount: number; finalPrice: number; discountPercent: number }> {
        const normalizedCode = code.toUpperCase().trim()

        const promoCode = await prisma.promoCode.findUnique({
            where: { code: normalizedCode },
        })

        if (!promoCode || !promoCode.active || new Date() > promoCode.validUntil) {
            throw new Error('Invalid promo code')
        }

        const discountAmount = (originalPrice * promoCode.discountPercent) / 100
        const finalPrice = Math.max(0, originalPrice - discountAmount)

        return {
            discountAmount,
            finalPrice,
            discountPercent: promoCode.discountPercent,
        }
    }

    /**
     * Increment promo code usage and create usage record
     * IMPORTANT: This should be called within a transaction
     */
    async incrementUsage(
        codeId: string,
        userId: string,
        paymentId: string,
        amounts: { discountAmount: number; originalAmount: number; finalAmount: number }
    ): Promise<void> {
        await prisma.$transaction(async (tx) => {
            // Get promo code with lock
            const promoCode = await tx.promoCode.findUnique({
                where: { id: codeId },
            })

            if (!promoCode) {
                throw new Error('Promo code not found')
            }

            // Double-check usage limit
            if (promoCode.currentUses >= promoCode.maxUses) {
                throw new Error('Promo code usage limit reached')
            }

            // Increment usage
            await tx.promoCode.update({
                where: { id: codeId },
                data: {
                    currentUses: {
                        increment: 1,
                    },
                },
            })

            // Create usage record
            await tx.promoCodeUsage.create({
                data: {
                    promoCodeId: codeId,
                    userId,
                    paymentId,
                    discountAmount: amounts.discountAmount,
                    originalAmount: amounts.originalAmount,
                    finalAmount: amounts.finalAmount,
                },
            })
        })
    }

    /**
     * Check if promo code payment method matches requested payment method
     */
    private checkPaymentMethodMatch(
        promoMethod: PromoPaymentMethod,
        requestedMethod: 'crypto' | 'stripe'
    ): boolean {
        if (promoMethod === 'ALL') {
            return true
        }

        if (promoMethod === 'CRYPTO' && requestedMethod === 'crypto') {
            return true
        }

        if (promoMethod === 'STRIPE' && requestedMethod === 'stripe') {
            return true
        }

        return false
    }
}

export const promoCodeService = new PromoCodeService()
