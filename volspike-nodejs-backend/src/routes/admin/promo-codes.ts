import { Hono } from 'hono'
import { z } from 'zod'
import { requireUser } from '../../lib/hono-extensions'
import { createLogger } from '../../lib/logger'
import { promoCodeAdminService } from '../../services/admin/promo-code-admin'
import { createPromoCodeSchema, updatePromoCodeSchema } from '../../lib/validation/promo-codes'
import { PromoPaymentMethod } from '@prisma/client'

const logger = createLogger()
const promoCodes = new Hono()

// Middleware to require ADMIN role
const requireAdmin = async (c: any, next: any) => {
    const user = requireUser(c)
    if (user.role !== 'ADMIN') {
        logger.warn('Non-admin user attempted to access admin promo codes endpoint', {
            userId: user.id,
            email: user.email,
            role: user.role,
        })
        return c.json({ error: 'Forbidden: Admin access required' }, 403)
    }
    await next()
}

// Apply admin middleware to all routes
promoCodes.use('*', requireAdmin)

// Create promo code
promoCodes.post('/', async (c) => {
    try {
        const user = requireUser(c)
        const body = await c.req.json()

        const validatedData = createPromoCodeSchema.parse(body)

        const promoCode = await promoCodeAdminService.createPromoCode({
            code: validatedData.code,
            discountPercent: validatedData.discountPercent,
            maxUses: validatedData.maxUses,
            validUntil: new Date(validatedData.validUntil),
            paymentMethod: validatedData.paymentMethod as PromoPaymentMethod,
            active: validatedData.active,
            createdById: user.id,
        })

        logger.info('Promo code created by admin', {
            promoCodeId: promoCode.id,
            code: promoCode.code,
            createdBy: user.email,
        })

        return c.json(promoCode, 201)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Create promo code error:', message)

        if (message.includes('already exists')) {
            return c.json({ error: 'Promo code already exists' }, 409)
        }

        return c.json({ error: 'Failed to create promo code' }, 500)
    }
})

// List promo codes
promoCodes.get('/', async (c) => {
    try {
        const { status, sortBy, sortOrder, page, limit } = c.req.query()

        const filters = {
            status: status as 'active' | 'inactive' | 'expired' | 'all' | undefined,
            sortBy: sortBy as 'createdAt' | 'code' | 'currentUses' | 'validUntil' | undefined,
            sortOrder: sortOrder as 'asc' | 'desc' | undefined,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        }

        const result = await promoCodeAdminService.listPromoCodes(filters)

        return c.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('List promo codes error:', message)
        return c.json({ error: 'Failed to list promo codes' }, 500)
    }
})

// Get single promo code
promoCodes.get('/:id', async (c) => {
    try {
        const id = c.req.param('id')
        const promoCode = await promoCodeAdminService.getPromoCodeById(id)
        return c.json(promoCode)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Get promo code error:', message)

        if (message.includes('not found')) {
            return c.json({ error: 'Promo code not found' }, 404)
        }

        return c.json({ error: 'Failed to get promo code' }, 500)
    }
})

// Update promo code
promoCodes.patch('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const id = c.req.param('id')
        const body = await c.req.json()

        const validatedData = updatePromoCodeSchema.parse(body)

        const updateData: any = {}
        if (validatedData.discountPercent !== undefined) {
            updateData.discountPercent = validatedData.discountPercent
        }
        if (validatedData.maxUses !== undefined) {
            updateData.maxUses = validatedData.maxUses
        }
        if (validatedData.validUntil !== undefined) {
            updateData.validUntil = new Date(validatedData.validUntil)
        }
        if (validatedData.active !== undefined) {
            updateData.active = validatedData.active
        }

        const promoCode = await promoCodeAdminService.updatePromoCode(id, updateData)

        logger.info('Promo code updated by admin', {
            promoCodeId: promoCode.id,
            code: promoCode.code,
            updatedBy: user.email,
        })

        return c.json(promoCode)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Update promo code error:', message)

        if (message.includes('not found')) {
            return c.json({ error: 'Promo code not found' }, 404)
        }
        if (message.includes('below current uses')) {
            return c.json({ error: message }, 400)
        }
        if (message.includes('shorten expiry')) {
            return c.json({ error: message }, 400)
        }

        return c.json({ error: 'Failed to update promo code' }, 500)
    }
})

// Delete promo code
promoCodes.delete('/:id', async (c) => {
    try {
        const user = requireUser(c)
        const id = c.req.param('id')

        const result = await promoCodeAdminService.deletePromoCode(id)

        logger.info('Promo code deleted by admin', {
            promoCodeId: id,
            deleteType: result.type,
            deletedBy: user.email,
        })

        return c.json(result, 204)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Delete promo code error:', message)

        if (message.includes('not found')) {
            return c.json({ error: 'Promo code not found' }, 404)
        }

        return c.json({ error: 'Failed to delete promo code' }, 500)
    }
})

export default promoCodes
