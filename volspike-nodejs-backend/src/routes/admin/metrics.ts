import { Hono } from 'hono'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
})

const adminMetricsRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// Validation schemas
const metricsQuerySchema = z.object({
    period: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional(),
})

// GET /api/admin/metrics - Get system metrics
adminMetricsRoutes.get('/', async (c) => {
    try {
        const query = c.req.query()
        const params = metricsQuerySchema.parse(query)
        const period = params.period || '30d'

        // Calculate date range
        const now = new Date()
        const startDate = new Date()

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7)
                break
            case '30d':
                startDate.setDate(now.getDate() - 30)
                break
            case '90d':
                startDate.setDate(now.getDate() - 90)
                break
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1)
                break
        }

        // Get metrics
        const [
            totalUsers,
            activeUsers,
            usersByTier,
            recentSignups,
            adminSessions,
            totalRevenue,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastLoginAt: {
                        gte: startDate,
                    },
                },
            }),
            prisma.user.groupBy({
                by: ['tier'],
                _count: true,
            }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
            }),
            prisma.adminSession.count({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
            }),
            calculateTotalRevenue(),
        ])

        return c.json({
            totalUsers,
            activeUsers,
            usersByTier: usersByTier.map(item => ({
                tier: item.tier,
                count: item._count,
            })),
            totalRevenue,
            recentSignups,
            failedLogins: 0, // Placeholder - implement with audit logs
            adminSessions,
        })
    } catch (error) {
        logger.error('Get system metrics error:', error)
        return c.json({ error: 'Failed to fetch system metrics' }, 500)
    }
})

// GET /api/admin/metrics/users - Get user metrics
adminMetricsRoutes.get('/users', async (c) => {
    try {
        const [
            totalUsers,
            usersByTier,
            usersByStatus,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.groupBy({
                by: ['tier'],
                _count: true,
            }),
            prisma.user.groupBy({
                by: ['status'],
                _count: true,
            }),
        ])

        return c.json({
            totalUsers,
            usersByTier: usersByTier.map(item => ({
                tier: item.tier,
                count: item._count,
            })),
            usersByStatus: usersByStatus.map(item => ({
                status: item.status,
                count: item._count,
            })),
        })
    } catch (error) {
        logger.error('Get user metrics error:', error)
        return c.json({ error: 'Failed to fetch user metrics' }, 500)
    }
})

// Helper function to get crypto currency breakdown
async function getCryptoCurrencyBreakdown(): Promise<Array<{ currency: string; amount: number; usdValue: number; count: number }>> {
    try {
        const payments = await prisma.cryptoPayment.findMany({
            where: {
                paymentStatus: 'finished',
                actuallyPaidCurrency: { not: null },
                payAmount: { not: null },
            },
            select: {
                actuallyPaidCurrency: true,
                actuallyPaid: true,
                payAmount: true,
            },
        })

        // Group by currency
        const currencyMap = new Map<string, { amount: number; usdValue: number; count: number }>()

        for (const payment of payments) {
            const currency = payment.actuallyPaidCurrency || 'unknown'
            const amount = payment.actuallyPaid || 0
            const usdValue = payment.payAmount || 0

            if (!currencyMap.has(currency)) {
                currencyMap.set(currency, { amount: 0, usdValue: 0, count: 0 })
            }

            const existing = currencyMap.get(currency)!
            existing.amount += amount
            existing.usdValue += usdValue
            existing.count += 1
        }

        // Convert to array and sort by USD value
        return Array.from(currencyMap.entries())
            .map(([currency, data]) => ({
                currency: currency.toUpperCase(),
                amount: Math.round(data.amount * 1000000) / 1000000, // Round to 6 decimals for crypto
                usdValue: Math.round(data.usdValue * 100) / 100,
                count: data.count,
            }))
            .sort((a, b) => b.usdValue - a.usdValue)
    } catch (error) {
        logger.error('Get crypto currency breakdown error:', error)
        return []
    }
}

// Helper function to calculate total revenue from all sources
async function calculateTotalRevenue(): Promise<number> {
    try {
        // Calculate revenue from crypto payments (finished payments only)
        const cryptoRevenueResult = await prisma.cryptoPayment.aggregate({
            where: {
                paymentStatus: 'finished',
                payAmount: { not: null },
            },
            _sum: {
                payAmount: true,
            },
        })

        const cryptoRevenue = cryptoRevenueResult._sum.payAmount || 0

        // Calculate revenue from Stripe (paid invoices)
        let stripeRevenue = 0
        try {
            // Get all paid invoices from Stripe
            const invoices = await stripe.invoices.list({
                status: 'paid',
                limit: 100, // Stripe pagination - adjust if needed
            })

            // Sum up all paid invoice amounts
            stripeRevenue = invoices.data.reduce((sum, invoice) => {
                // Convert from cents to dollars
                return sum + (invoice.amount_paid || 0) / 100
            }, 0)

            // Handle pagination if there are more than 100 invoices
            let hasMore = invoices.has_more
            let startingAfter = invoices.data[invoices.data.length - 1]?.id

            while (hasMore && startingAfter) {
                const moreInvoices = await stripe.invoices.list({
                    status: 'paid',
                    limit: 100,
                    starting_after: startingAfter,
                })

                stripeRevenue += moreInvoices.data.reduce((sum, invoice) => {
                    return sum + (invoice.amount_paid || 0) / 100
                }, 0)

                hasMore = moreInvoices.has_more
                startingAfter = moreInvoices.data[moreInvoices.data.length - 1]?.id
            }
        } catch (stripeError: any) {
            // If Stripe API fails, log but don't fail the entire request
            logger.warn('Failed to fetch Stripe revenue:', stripeError.message)
            stripeRevenue = 0
        }

        const totalRevenue = cryptoRevenue + stripeRevenue

        logger.info('Revenue calculated', {
            cryptoRevenue,
            stripeRevenue,
            totalRevenue,
        })

        return Math.round(totalRevenue * 100) / 100 // Round to 2 decimal places
    } catch (error) {
        logger.error('Calculate total revenue error:', error)
        return 0
    }
}

// GET /api/admin/metrics/revenue - Get revenue metrics
adminMetricsRoutes.get('/revenue', async (c) => {
    try {
        const totalRevenue = await calculateTotalRevenue()

        // Get revenue breakdown by tier from crypto payments
        const cryptoRevenueByTier = await prisma.cryptoPayment.groupBy({
            by: ['tier'],
            where: {
                paymentStatus: 'finished',
                payAmount: { not: null },
            },
            _sum: {
                payAmount: true,
            },
        })

        // Calculate MRR and Stripe revenue by tier from active Stripe subscriptions
        let monthlyRecurringRevenue = 0
        const stripeRevenueByTier: { pro: number; elite: number } = { pro: 0, elite: 0 }
        
        try {
            // Get all paid invoices to calculate total Stripe revenue by tier
            const invoices = await stripe.invoices.list({
                status: 'paid',
                limit: 100,
            })

            // Process invoices to get tier from price metadata
            for (const invoice of invoices.data) {
                if (invoice.subscription) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
                        const priceId = subscription.items.data[0]?.price?.id
                        if (priceId) {
                            const price = await stripe.prices.retrieve(priceId)
                            // Get tier from metadata, but also check price amount as fallback
                            let tier = price.metadata?.tier
                            
                            // If no tier in metadata, try to infer from price amount
                            if (!tier && price.unit_amount) {
                                const priceAmount = price.unit_amount / 100
                                // You may need to adjust these thresholds based on your pricing
                                if (priceAmount >= 50) {
                                    tier = 'elite'
                                } else if (priceAmount >= 9) {
                                    tier = 'pro'
                                } else {
                                    tier = 'free'
                                }
                                // Only log as info, not warning - this is expected behavior for prices without metadata
                                logger.info(`Tier inferred from price amount for ${priceId}: ${tier} (amount: $${priceAmount})`)
                            }
                            
                            // Default to 'pro' only if we couldn't determine tier
                            tier = tier || 'pro'
                            const amount = (invoice.amount_paid || 0) / 100
                            
                            logger.debug('Processing Stripe invoice', {
                                invoiceId: invoice.id,
                                priceId,
                                tier,
                                amount,
                                hasMetadata: !!price.metadata,
                            })
                            
                            if (tier === 'pro') {
                                stripeRevenueByTier.pro += amount
                            } else if (tier === 'elite') {
                                stripeRevenueByTier.elite += amount
                            }
                        }
                    } catch (err) {
                        logger.warn('Failed to process invoice for tier:', err)
                    }
                }
            }

            // Handle pagination for invoices
            let hasMoreInvoices = invoices.has_more
            let startingAfterInvoice = invoices.data[invoices.data.length - 1]?.id

            while (hasMoreInvoices && startingAfterInvoice) {
                const moreInvoices = await stripe.invoices.list({
                    status: 'paid',
                    limit: 100,
                    starting_after: startingAfterInvoice,
                })

                for (const invoice of moreInvoices.data) {
                    if (invoice.subscription) {
                        try {
                            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
                            const priceId = subscription.items.data[0]?.price?.id
                            if (priceId) {
                                const price = await stripe.prices.retrieve(priceId)
                                // Get tier from metadata, but also check price amount as fallback
                                let tier = price.metadata?.tier
                                
                                // If no tier in metadata, try to infer from price amount
                                if (!tier && price.unit_amount) {
                                    const priceAmount = price.unit_amount / 100
                                    if (priceAmount >= 50) {
                                        tier = 'elite'
                                    } else if (priceAmount >= 9) {
                                        tier = 'pro'
                                    } else {
                                        tier = 'free'
                                    }
                                }
                                
                                tier = tier || 'pro'
                                const amount = (invoice.amount_paid || 0) / 100
                                
                                if (tier === 'pro') {
                                    stripeRevenueByTier.pro += amount
                                } else if (tier === 'elite') {
                                    stripeRevenueByTier.elite += amount
                                }
                            }
                        } catch (err) {
                            logger.warn('Failed to process invoice for tier:', err)
                        }
                    }
                }

                hasMoreInvoices = moreInvoices.has_more
                startingAfterInvoice = moreInvoices.data[moreInvoices.data.length - 1]?.id
            }

            // Calculate MRR from active subscriptions
            const subscriptions = await stripe.subscriptions.list({
                status: 'active',
                limit: 100,
            })

            monthlyRecurringRevenue = subscriptions.data.reduce((sum, sub) => {
                const amount = sub.items.data[0]?.price?.unit_amount || 0
                return sum + amount / 100
            }, 0)

            // Handle pagination for subscriptions
            let hasMore = subscriptions.has_more
            let startingAfter = subscriptions.data[subscriptions.data.length - 1]?.id

            while (hasMore && startingAfter) {
                const moreSubs = await stripe.subscriptions.list({
                    status: 'active',
                    limit: 100,
                    starting_after: startingAfter,
                })

                monthlyRecurringRevenue += moreSubs.data.reduce((sum, sub) => {
                    const amount = sub.items.data[0]?.price?.unit_amount || 0
                    return sum + amount / 100
                }, 0)

                hasMore = moreSubs.has_more
                startingAfter = moreSubs.data[moreSubs.data.length - 1]?.id
            }
        } catch (stripeError: any) {
            logger.warn('Failed to fetch Stripe revenue:', stripeError.message)
        }

        // Combine crypto and Stripe revenue by tier
        const cryptoPro = cryptoRevenueByTier.find(r => r.tier === 'pro')?._sum.payAmount || 0
        const cryptoElite = cryptoRevenueByTier.find(r => r.tier === 'elite')?._sum.payAmount || 0

        return c.json({
            totalRevenue,
            monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
            revenueByTier: {
                free: 0,
                pro: Math.round((cryptoPro + stripeRevenueByTier.pro) * 100) / 100,
                elite: Math.round((cryptoElite + stripeRevenueByTier.elite) * 100) / 100,
            },
            revenueBySource: {
                crypto: Math.round((cryptoPro + cryptoElite) * 100) / 100,
                stripe: Math.round((stripeRevenueByTier.pro + stripeRevenueByTier.elite) * 100) / 100,
            },
            cryptoCurrencyBreakdown: await getCryptoCurrencyBreakdown(),
            revenueGrowth: [], // TODO: Implement time-series revenue data
            topCustomers: [], // TODO: Implement top customers list
        })
    } catch (error) {
        logger.error('Get revenue metrics error:', error)
        return c.json({ error: 'Failed to fetch revenue metrics' }, 500)
    }
})

// GET /api/admin/metrics/activity - Get activity metrics
adminMetricsRoutes.get('/activity', async (c) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))

        const [
            totalLogins,
            adminActions,
        ] = await Promise.all([
            prisma.auditLog.count({
                where: {
                    action: 'ADMIN_LOGIN',
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            }),
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
            }),
        ])

        return c.json({
            totalLogins,
            failedLogins: 0, // Placeholder
            adminActions,
            securityEvents: 0, // Placeholder
            activityByDay: [],
            topActions: [],
        })
    } catch (error) {
        logger.error('Get activity metrics error:', error)
        return c.json({ error: 'Failed to fetch activity metrics' }, 500)
    }
})

// GET /api/admin/metrics/revenue-analytics - Get detailed revenue analytics with time-series data
adminMetricsRoutes.get('/revenue-analytics', async (c) => {
    try {
        const query = c.req.query()
        const period = query.period || '1y' // Default to 1 year
        
        // Calculate date range
        const now = new Date()
        const startDate = new Date()
        
        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7)
                break
            case '30d':
                startDate.setDate(now.getDate() - 30)
                break
            case '90d':
                startDate.setDate(now.getDate() - 90)
                break
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1)
                break
            case 'all':
                startDate.setFullYear(2020, 0, 1) // Start from beginning
                break
        }

        // Get crypto payments grouped by day
        const cryptoPayments = await prisma.cryptoPayment.findMany({
            where: {
                paymentStatus: 'finished',
                payAmount: { not: null },
                createdAt: { gte: startDate },
            },
            select: {
                payAmount: true,
                createdAt: true,
                tier: true,
            },
        })

        // Get Stripe invoices
        const stripeInvoices: Array<{ date: Date; amount: number; tier: string }> = []
        try {
            let hasMore = true
            let startingAfter: string | undefined = undefined
            
            while (hasMore) {
                const invoices = await stripe.invoices.list({
                    status: 'paid',
                    limit: 100,
                    starting_after: startingAfter,
                })

                for (const invoice of invoices.data) {
                    const invoiceDate = new Date(invoice.created * 1000)
                    if (invoiceDate >= startDate && invoice.subscription) {
                        try {
                            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
                            const priceId = subscription.items.data[0]?.price?.id
                            if (priceId) {
                                const price = await stripe.prices.retrieve(priceId)
                                let tier = price.metadata?.tier || 'pro'
                                
                                // Infer tier from price if not in metadata
                                if (!price.metadata?.tier && price.unit_amount) {
                                    const priceAmount = price.unit_amount / 100
                                    if (priceAmount >= 50) {
                                        tier = 'elite'
                                    } else if (priceAmount >= 9) {
                                        tier = 'pro'
                                    }
                                }
                                
                                stripeInvoices.push({
                                    date: invoiceDate,
                                    amount: (invoice.amount_paid || 0) / 100,
                                    tier,
                                })
                            }
                        } catch (err) {
                            logger.warn('Failed to process invoice for analytics:', err)
                        }
                    }
                }

                hasMore = invoices.has_more
                startingAfter = invoices.data[invoices.data.length - 1]?.id
            }
        } catch (stripeError: any) {
            logger.warn('Failed to fetch Stripe invoices for analytics:', stripeError.message)
        }

        // Helper function to format date as YYYY-MM-DD
        const formatDate = (date: Date): string => {
            return date.toISOString().split('T')[0]
        }

        // Helper function to format date as YYYY-MM (month)
        const formatMonth = (date: Date): string => {
            return date.toISOString().substring(0, 7)
        }

        // Aggregate daily revenue
        const dailyRevenueMap = new Map<string, { total: number; crypto: number; stripe: number; pro: number; elite: number }>()
        
        // Process crypto payments
        cryptoPayments.forEach((payment) => {
            const dateKey = formatDate(payment.createdAt)
            const existing = dailyRevenueMap.get(dateKey) || { total: 0, crypto: 0, stripe: 0, pro: 0, elite: 0 }
            const amount = payment.payAmount || 0
            existing.total += amount
            existing.crypto += amount
            if (payment.tier === 'pro') {
                existing.pro += amount
            } else if (payment.tier === 'elite') {
                existing.elite += amount
            }
            dailyRevenueMap.set(dateKey, existing)
        })

        // Process Stripe invoices
        stripeInvoices.forEach((invoice) => {
            const dateKey = formatDate(invoice.date)
            const existing = dailyRevenueMap.get(dateKey) || { total: 0, crypto: 0, stripe: 0, pro: 0, elite: 0 }
            existing.total += invoice.amount
            existing.stripe += invoice.amount
            if (invoice.tier === 'pro') {
                existing.pro += invoice.amount
            } else if (invoice.tier === 'elite') {
                existing.elite += invoice.amount
            }
            dailyRevenueMap.set(dateKey, existing)
        })

        // Convert to array and sort by date
        const dailyRevenue = Array.from(dailyRevenueMap.entries())
            .map(([date, data]) => ({
                date,
                total: Math.round(data.total * 100) / 100,
                crypto: Math.round(data.crypto * 100) / 100,
                stripe: Math.round(data.stripe * 100) / 100,
                pro: Math.round(data.pro * 100) / 100,
                elite: Math.round(data.elite * 100) / 100,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        // Aggregate monthly revenue
        const monthlyRevenueMap = new Map<string, { total: number; crypto: number; stripe: number; pro: number; elite: number }>()
        
        // Process crypto payments for monthly
        cryptoPayments.forEach((payment) => {
            const monthKey = formatMonth(payment.createdAt)
            const existing = monthlyRevenueMap.get(monthKey) || { total: 0, crypto: 0, stripe: 0, pro: 0, elite: 0 }
            const amount = payment.payAmount || 0
            existing.total += amount
            existing.crypto += amount
            if (payment.tier === 'pro') {
                existing.pro += amount
            } else if (payment.tier === 'elite') {
                existing.elite += amount
            }
            monthlyRevenueMap.set(monthKey, existing)
        })

        // Process Stripe invoices for monthly
        stripeInvoices.forEach((invoice) => {
            const monthKey = formatMonth(invoice.date)
            const existing = monthlyRevenueMap.get(monthKey) || { total: 0, crypto: 0, stripe: 0, pro: 0, elite: 0 }
            existing.total += invoice.amount
            existing.stripe += invoice.amount
            if (invoice.tier === 'pro') {
                existing.pro += invoice.amount
            } else if (invoice.tier === 'elite') {
                existing.elite += invoice.amount
            }
            monthlyRevenueMap.set(monthKey, existing)
        })

        // Convert to array and sort by date
        const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
            .map(([month, data]) => ({
                month,
                total: Math.round(data.total * 100) / 100,
                crypto: Math.round(data.crypto * 100) / 100,
                stripe: Math.round(data.stripe * 100) / 100,
                pro: Math.round(data.pro * 100) / 100,
                elite: Math.round(data.elite * 100) / 100,
            }))
            .sort((a, b) => a.month.localeCompare(b.month))

        // Calculate summary stats
        const today = formatDate(now)
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        
        const yearStart = new Date(now)
        yearStart.setFullYear(now.getFullYear() - 1)

        const calculatePeriodRevenue = (start: Date) => {
            let total = 0
            let crypto = 0
            let stripe = 0
            
            // Crypto payments
            cryptoPayments.forEach((payment) => {
                if (payment.createdAt >= start) {
                    total += payment.payAmount || 0
                    crypto += payment.payAmount || 0
                }
            })
            
            // Stripe invoices
            stripeInvoices.forEach((invoice) => {
                if (invoice.date >= start) {
                    total += invoice.amount
                    stripe += invoice.amount
                }
            })
            
            return {
                total: Math.round(total * 100) / 100,
                crypto: Math.round(crypto * 100) / 100,
                stripe: Math.round(stripe * 100) / 100,
            }
        }

        const summary = {
            today: calculatePeriodRevenue(todayStart),
            thisWeek: calculatePeriodRevenue(weekStart),
            thisMonth: calculatePeriodRevenue(monthStart),
            thisYear: calculatePeriodRevenue(yearStart),
            allTime: {
                total: Math.round((cryptoPayments.reduce((sum, p) => sum + (p.payAmount || 0), 0) + stripeInvoices.reduce((sum, i) => sum + i.amount, 0)) * 100) / 100,
                crypto: Math.round(cryptoPayments.reduce((sum, p) => sum + (p.payAmount || 0), 0) * 100) / 100,
                stripe: Math.round(stripeInvoices.reduce((sum, i) => sum + i.amount, 0) * 100) / 100,
            },
        }

        return c.json({
            dailyRevenue,
            monthlyRevenue,
            summary,
            period,
        })
    } catch (error) {
        logger.error('Get revenue analytics error:', error)
        return c.json({ error: 'Failed to fetch revenue analytics' }, 500)
    }
})

// GET /api/admin/metrics/health - Get system health
adminMetricsRoutes.get('/health', async (c) => {
    try {
        const start = Date.now()

        // Test database connection
        await prisma.user.count()
        const dbResponseTime = Date.now() - start

        return c.json({
            databaseStatus: {
                status: 'healthy',
                responseTime: dbResponseTime,
            },
            apiResponseTime: 0,
            errorRate: 0,
            activeConnections: 0,
            memoryUsage: {
                used: process.memoryUsage().heapUsed,
                total: process.memoryUsage().heapTotal,
                percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
            },
            diskUsage: {
                used: 0,
                total: 0,
                percentage: 0,
            },
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        logger.error('Get health metrics error:', error)
        return c.json({ error: 'Failed to fetch health metrics' }, 500)
    }
})

export { adminMetricsRoutes }
