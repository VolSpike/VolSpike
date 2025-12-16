import { z } from 'zod'

export const promoCodeValidationSchema = z.object({
    code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/i, 'Code must be alphanumeric'),
    tier: z.enum(['pro', 'elite']),
    paymentMethod: z.enum(['crypto', 'stripe']),
})

export const createPromoCodeSchema = z.object({
    code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/i, 'Code must be alphanumeric'),
    discountPercent: z.number().int().min(1).max(100),
    maxUses: z.number().int().min(1).max(10000),
    validUntil: z.string().datetime(),
    paymentMethod: z.enum(['CRYPTO', 'STRIPE', 'ALL']).default('CRYPTO'),
    active: z.boolean().default(true),
})

export const updatePromoCodeSchema = z.object({
    discountPercent: z.number().int().min(1).max(100).optional(),
    maxUses: z.number().int().min(1).max(10000).optional(),
    validUntil: z.string().datetime().optional(),
    active: z.boolean().optional(),
})

export type PromoCodeValidationRequest = z.infer<typeof promoCodeValidationSchema>
export type CreatePromoCodeRequest = z.infer<typeof createPromoCodeSchema>
export type UpdatePromoCodeRequest = z.infer<typeof updatePromoCodeSchema>
