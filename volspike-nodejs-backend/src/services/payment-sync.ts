import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { NowPaymentsService } from './nowpayments'
import { EmailService } from './email'
import { computeStackedCryptoExpiry } from './subscription-utils'

const logger = createLogger()

/**
 * Sync payment statuses from NowPayments API
 * Should be called periodically (e.g., every 30 seconds)
 * This ensures users get upgraded even if webhooks are delayed or missed
 */
export async function syncPendingPayments() {
    try {
        const nowpayments = NowPaymentsService.getInstance()

        // Find all pending payments (not finished/failed/confirmed)
        const pendingPayments = await prisma.cryptoPayment.findMany({
            where: {
                paymentId: { not: null },
                paymentStatus: {
                    notIn: ['finished', 'confirmed', 'failed', 'refunded', 'expired'],
                },
            },
            include: { user: true },
            take: 100, // Sync up to 100 payments at a time
        })

        if (pendingPayments.length === 0) {
            return {
                checked: 0,
                synced: 0,
                upgraded: 0,
            }
        }

        logger.info(`🔄 Syncing ${pendingPayments.length} pending payments from NowPayments`)

        let synced = 0
        let upgraded = 0

        // Sync payments sequentially to avoid rate limits
        for (const payment of pendingPayments) {
            if (!payment.paymentId) continue

            try {
                // Fetch latest status from NowPayments
                const paymentStatus = await nowpayments.getPaymentStatus(payment.paymentId)

                // Update database with latest status
                const updatedPayment = await prisma.cryptoPayment.update({
                    where: { id: payment.id },
                    data: {
                        paymentStatus: paymentStatus.payment_status,
                        actuallyPaid: paymentStatus.actually_paid,
                        actuallyPaidCurrency: paymentStatus.pay_currency,
                        updatedAt: new Date(),
                        ...((paymentStatus.payment_status === 'finished' || paymentStatus.payment_status === 'confirmed') && {
                            paidAt: new Date(),
                        }),
                    },
                    include: { user: true },
                })

                synced++

                // Handle partially_paid status - send emails ONLY if status was recently updated (within last hour)
                // This prevents duplicate emails from being sent every 30 seconds
                if (paymentStatus.payment_status === 'partially_paid') {
                    const payAmount = updatedPayment.payAmount || 0
                    const actuallyPaid = paymentStatus.actually_paid ? Number(paymentStatus.actually_paid) : 0
                    const shortfall = payAmount - actuallyPaid
                    const shortfallPercent = payAmount > 0 ? ((shortfall / payAmount) * 100).toFixed(2) : '0.00'

                    // CRITICAL: Only send emails if payment status was recently updated (within last hour)
                    // This prevents duplicate emails from being sent every sync cycle
                    const updatedAt = updatedPayment.updatedAt
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
                    const wasRecentlyUpdated = updatedAt && updatedAt > oneHourAgo

                    // Also check if previous status was different (status just changed)
                    const previousStatus = payment.paymentStatus
                    const statusJustChanged = previousStatus !== 'partially_paid'

                    // Only send emails if status was recently updated OR status just changed
                    if (wasRecentlyUpdated || statusJustChanged) {
                        // Notify admin about partially_paid status
                        try {
                            await EmailService.getInstance().sendPaymentIssueAlertEmail({
                                type: 'CRYPTO_PAYMENT_PARTIALLY_PAID_SYNC',
                                details: {
                                    paymentId: payment.paymentId,
                                    orderId: updatedPayment.orderId,
                                    actuallyPaid: actuallyPaid,
                                    payAmount: payAmount,
                                    shortfall: shortfall,
                                    shortfallPercent: `${shortfallPercent}%`,
                                    payCurrency: paymentStatus.pay_currency || updatedPayment.payCurrency,
                                    userId: updatedPayment.userId,
                                    userEmail: updatedPayment.user.email,
                                    tier: updatedPayment.tier,
                                    note: 'Payment synced from NowPayments API - status is partially_paid',
                                    actionRequired: 'Review payment. If user paid full amount, manually complete payment via /api/admin/payments/complete-partial-payment',
                                },
                            })
                        } catch (emailError) {
                            logger.error('Failed to notify admin about partially_paid status:', emailError)
                        }

                        // Send partial payment email to user
                        if (updatedPayment.user.email) {
                            const emailService = EmailService.getInstance()
                            emailService.sendPartialPaymentEmail({
                                email: updatedPayment.user.email,
                                name: undefined,
                                tier: updatedPayment.tier,
                                requestedAmount: payAmount,
                                actuallyPaid: actuallyPaid,
                                payCurrency: paymentStatus.pay_currency || updatedPayment.payCurrency || 'USD',
                                shortfall: shortfall,
                                shortfallPercent: `${shortfallPercent}%`,
                                paymentId: payment.paymentId || '',
                                orderId: updatedPayment.orderId || '',
                            }).catch((error) => {
                                logger.error('Failed to send partial payment email to user:', error)
                            })
                        }
                    } else {
                        // Status is partially_paid but was updated more than an hour ago - skip email sending
                        logger.debug('Skipping partial payment email - status unchanged for more than 1 hour', {
                            paymentId: payment.paymentId,
                            updatedAt: updatedAt,
                            previousStatus,
                        })
                    }

                    // Continue to next payment (don't upgrade user yet)
                    continue
                }

                // If payment is finished/confirmed but user wasn't upgraded yet, trigger upgrade
                if (
                    (paymentStatus.payment_status === 'finished' || paymentStatus.payment_status === 'confirmed') &&
                    updatedPayment.user.tier !== updatedPayment.tier
                ) {
                    logger.info('🔄 Payment confirmed but user not upgraded - upgrading now', {
                        paymentId: payment.paymentId,
                        userId: updatedPayment.userId,
                        currentTier: updatedPayment.user.tier,
                        targetTier: updatedPayment.tier,
                    })

                    const previousTier = updatedPayment.user.tier
                    const expiresAt = await computeStackedCryptoExpiry(updatedPayment.userId)

                    await prisma.$transaction(async (tx) => {
                        await tx.user.update({
                            where: { id: updatedPayment.userId },
                            data: { tier: updatedPayment.tier },
                        })

                        await tx.cryptoPayment.update({
                            where: { id: updatedPayment.id },
                            data: {
                                expiresAt,
                                paidAt: new Date(),
                            },
                        })
                    })

                    upgraded++

                    // Send payment confirmation email to user (non-blocking)
                    const emailService = EmailService.getInstance()
                    if (updatedPayment.user.email) {
                        // Send beautiful payment confirmation email
                        emailService.sendPaymentConfirmationEmail({
                            email: updatedPayment.user.email,
                            name: undefined,
                            tier: updatedPayment.tier,
                            amountUsd: updatedPayment.payAmount || 0,
                            payCurrency: updatedPayment.payCurrency || 'USD',
                            actuallyPaid: paymentStatus.actually_paid ? Number(paymentStatus.actually_paid) : null,
                            actuallyPaidCurrency: paymentStatus.pay_currency || null,
                            paymentId: payment.paymentId || '',
                            orderId: updatedPayment.orderId || '',
                            expiresAt,
                        }).catch((error) => {
                            logger.error('Failed to send payment confirmation email:', error)
                        })

                        // Also send tier upgrade email if tier changed
                        if (previousTier !== updatedPayment.tier) {
                            emailService.sendTierUpgradeEmail({
                                email: updatedPayment.user.email,
                                name: undefined,
                                newTier: updatedPayment.tier,
                                previousTier: previousTier,
                            }).catch((error) => {
                                logger.error('Failed to send tier upgrade email:', error)
                            })
                        }
                    }

                    // Notify admin
                    try {
                        await EmailService.getInstance().sendPaymentIssueAlertEmail({
                            type: 'CRYPTO_PAYMENT_FINISHED_SYNC',
                            details: {
                                paymentId: payment.paymentId,
                                orderId: updatedPayment.orderId,
                                tier: updatedPayment.tier,
                                userId: updatedPayment.userId,
                                userEmail: updatedPayment.user.email,
                                amountUsd: updatedPayment.payAmount,
                                payCurrency: updatedPayment.payCurrency,
                                actuallyPaid: paymentStatus.actually_paid,
                                actuallyPaidCurrency: paymentStatus.pay_currency,
                                expiresAt,
                                note: 'Payment synced from NowPayments API and user upgraded',
                            },
                        })
                    } catch (emailError) {
                        logger.error('Failed to notify admin (non-critical):', emailError)
                    }

                    logger.info(`✅ User ${updatedPayment.userId} upgraded to ${updatedPayment.tier} via payment sync`)
                }

                // Small delay between syncs to avoid rate limits
                await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (error: any) {
                logger.error(`Failed to sync payment ${payment.paymentId}:`, {
                    error: error.message,
                    paymentId: payment.paymentId,
                })
                // Continue with next payment
            }
        }

        logger.info(`✅ Payment sync completed: ${synced} synced, ${upgraded} users upgraded`)

        return {
            checked: pendingPayments.length,
            synced,
            upgraded,
        }
    } catch (error) {
        logger.error('❌ Payment sync failed:', error)
        return {
            checked: 0,
            synced: 0,
            upgraded: 0,
        }
    }
}
