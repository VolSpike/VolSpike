import { PrismaClient, PromoPaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreatePromoCodeData {
    code: string
    discountPercent: number
    maxUses: number
    validUntil: Date
    paymentMethod: PromoPaymentMethod
    active: boolean
    createdById: string
}

export interface UpdatePromoCodeData {
    discountPercent?: number
    maxUses?: number
    validUntil?: Date
    active?: boolean
}

export interface PromoCodeListFilters {
    status?: 'active' | 'inactive' | 'expired' | 'all'
    sortBy?: 'createdAt' | 'code' | 'currentUses' | 'validUntil'
    sortOrder?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export class PromoCodeAdminService {
    /**
     * Create a new promo code
     */
    async createPromoCode(data: CreatePromoCodeData) {
        // Normalize code to uppercase
        const normalizedCode = data.code.toUpperCase().trim()

        // Check if code already exists
        const existing = await prisma.promoCode.findUnique({
            where: { code: normalizedCode },
        })

        if (existing) {
            throw new Error('Promo code already exists')
        }

        // Create promo code
        const promoCode = await prisma.promoCode.create({
            data: {
                code: normalizedCode,
                discountPercent: data.discountPercent,
                maxUses: data.maxUses,
                validUntil: data.validUntil,
                paymentMethod: data.paymentMethod,
                active: data.active,
                createdById: data.createdById,
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        })

        return promoCode
    }

    /**
     * List promo codes with pagination and filters
     */
    async listPromoCodes(filters: PromoCodeListFilters) {
        const {
            status = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 20,
        } = filters

        // Build where clause
        const where: any = {}

        if (status === 'active') {
            where.active = true
            where.validUntil = { gte: new Date() }
        } else if (status === 'inactive') {
            where.active = false
        } else if (status === 'expired') {
            where.validUntil = { lt: new Date() }
        }

        // Count total
        const total = await prisma.promoCode.count({ where })

        // Fetch promo codes
        const promoCodes = await prisma.promoCode.findMany({
            where,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
                usages: {
                    select: {
                        id: true,
                        discountAmount: true,
                    },
                },
            },
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: (page - 1) * limit,
            take: limit,
        })

        // Calculate stats for each promo code
        const promoCodesWithStats = promoCodes.map((promo) => {
            const totalDiscountGiven = promo.usages.reduce(
                (sum, usage) => sum + usage.discountAmount,
                0
            )
            const isExpired = new Date() > promo.validUntil
            const remainingUses = promo.maxUses - promo.currentUses

            return {
                id: promo.id,
                code: promo.code,
                discountPercent: promo.discountPercent,
                maxUses: promo.maxUses,
                currentUses: promo.currentUses,
                remainingUses,
                validUntil: promo.validUntil.toISOString(),
                active: promo.active,
                paymentMethod: promo.paymentMethod,
                createdAt: promo.createdAt.toISOString(),
                createdBy: promo.createdBy,
                totalDiscountGiven,
                isExpired,
            }
        })

        return {
            promoCodes: promoCodesWithStats,
            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }
    }

    /**
     * Get single promo code with detailed stats
     */
    async getPromoCodeById(id: string) {
        const promoCode = await prisma.promoCode.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
                usages: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        })

        if (!promoCode) {
            throw new Error('Promo code not found')
        }

        const totalDiscountGiven = promoCode.usages.reduce(
            (sum, usage) => sum + usage.discountAmount,
            0
        )
        const isExpired = new Date() > promoCode.validUntil
        const remainingUses = promoCode.maxUses - promoCode.currentUses

        return {
            id: promoCode.id,
            code: promoCode.code,
            discountPercent: promoCode.discountPercent,
            maxUses: promoCode.maxUses,
            currentUses: promoCode.currentUses,
            remainingUses,
            validUntil: promoCode.validUntil.toISOString(),
            active: promoCode.active,
            paymentMethod: promoCode.paymentMethod,
            createdAt: promoCode.createdAt.toISOString(),
            updatedAt: promoCode.updatedAt.toISOString(),
            createdBy: promoCode.createdBy,
            totalDiscountGiven,
            isExpired,
            usages: promoCode.usages.map((usage) => ({
                id: usage.id,
                userId: usage.userId,
                userEmail: usage.user.email,
                paymentId: usage.paymentId,
                discountAmount: usage.discountAmount,
                originalAmount: usage.originalAmount,
                finalAmount: usage.finalAmount,
                createdAt: usage.createdAt.toISOString(),
            })),
        }
    }

    /**
     * Update promo code
     */
    async updatePromoCode(id: string, data: UpdatePromoCodeData) {
        const promoCode = await prisma.promoCode.findUnique({
            where: { id },
        })

        if (!promoCode) {
            throw new Error('Promo code not found')
        }

        // Validate maxUses if updating
        if (data.maxUses !== undefined && data.maxUses < promoCode.currentUses) {
            throw new Error(
                `Cannot decrease max uses below current uses (${promoCode.currentUses})`
            )
        }

        // Validate validUntil if updating and already used
        if (
            data.validUntil &&
            promoCode.currentUses > 0 &&
            data.validUntil < promoCode.validUntil
        ) {
            throw new Error('Cannot shorten expiry date for codes with usage history')
        }

        const updated = await prisma.promoCode.update({
            where: { id },
            data,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        })

        return updated
    }

    /**
     * Delete promo code (soft delete if used, hard delete if unused)
     */
    async deletePromoCode(id: string) {
        const promoCode = await prisma.promoCode.findUnique({
            where: { id },
        })

        if (!promoCode) {
            throw new Error('Promo code not found')
        }

        // If code has been used, soft delete (deactivate)
        if (promoCode.currentUses > 0) {
            await prisma.promoCode.update({
                where: { id },
                data: { active: false },
            })
            return { type: 'soft' as const, message: 'Promo code deactivated (has usage history)' }
        }

        // If code has never been used, hard delete
        await prisma.promoCode.delete({
            where: { id },
        })

        return { type: 'hard' as const, message: 'Promo code deleted' }
    }
}

export const promoCodeAdminService = new PromoCodeAdminService()
