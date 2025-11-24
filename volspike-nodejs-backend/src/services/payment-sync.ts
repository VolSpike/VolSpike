import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { NowPaymentsService } from './nowpayments'
import { EmailService } from './email'

const logger = createLogger()

const PARTIAL_PAYMENT_MIN_PERCENT_DELTA = 0.01 // 1% of requested crypto amount
const PARTIAL_PAYMENT_MIN_ABSOLUTE_DELTA = 0.000001 // fallback when we don't know the crypto target
const STABLECOIN_CODES = new Set(['usd', 'usdt', 'usdc', 'busd'])

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

                // Handle partially_paid status - send emails only when something meaningful changed
                if (paymentStatus.payment_status === 'partially_paid') {
                    const payAmountUsd = updatedPayment.payAmount || 0
                    const previousStatus = payment.paymentStatus
                    const previousActualPaid = payment.actuallyPaid ? Number(payment.actuallyPaid) : 0
                    const requestedCryptoAmount = paymentStatus.pay_amount ? Number(paymentStatus.pay_amount) : null
                    const actualCryptoPaid = paymentStatus.actually_paid ? Number(paymentStatus.actually_paid) : 0
                    const payCurrencyCode = (paymentStatus.pay_currency || updatedPayment.actuallyPaidCurrency || updatedPayment.payCurrency || 'usd').toLowerCase()
                    const isStablecoinCurrency = STABLECOIN_CODES.has(payCurrencyCode)

                    const cryptoDelta = Math.abs(actualCryptoPaid - previousActualPaid)
                    const cryptoDeltaPercent =
                        requestedCryptoAmount && requestedCryptoAmount > 0 ? cryptoDelta / requestedCryptoAmount : null

                    const statusJustChanged = previousStatus !== 'partially_paid'
                    const significantPaymentChange = cryptoDeltaPercent !== null
                        ? cryptoDeltaPercent >= PARTIAL_PAYMENT_MIN_PERCENT_DELTA
                        : cryptoDelta >= PARTIAL_PAYMENT_MIN_ABSOLUTE_DELTA

                    const shouldSendPartialEmail = statusJustChanged || significantPaymentChange

                    if (!shouldSendPartialEmail) {
                        logger.debug('Skipping partial payment email - no status/amount change detected', {
                            paymentId: payment.paymentId,
                            statusJustChanged,
                            cryptoDelta,
                            cryptoDeltaPercent,
                            requestedCryptoAmount,
                            previousActualPaid,
                        })
                        continue
                    }

                    const rawExchangeRate =
                        requestedCryptoAmount && requestedCryptoAmount > 0 && payAmountUsd > 0
                            ? payAmountUsd / requestedCryptoAmount
                            : null
                    const exchangeRateUsdPerUnit = rawExchangeRate ? Number(rawExchangeRate.toFixed(6)) : null

                    const actualUsdValue = rawExchangeRate
                        ? Number((actualCryptoPaid * rawExchangeRate).toFixed(2))
                        : isStablecoinCurrency
                            ? Number(actualCryptoPaid.toFixed(2))
                            : null

                    const shortfallCrypto =
                        requestedCryptoAmount !== null
                            ? Number(Math.max(requestedCryptoAmount - actualCryptoPaid, 0).toFixed(8))
                            : null

                    const shortfallUsdValue = rawExchangeRate
                        ? Number(Math.max(payAmountUsd - (actualUsdValue ?? 0), 0).toFixed(2))
                        : isStablecoinCurrency && payAmountUsd > 0
                            ? Number(Math.max(payAmountUsd - actualCryptoPaid, 0).toFixed(2))
                            : null

                    const shortfallPercent =
                        shortfallUsdValue !== null && payAmountUsd > 0
                            ? `${Math.min(100, (shortfallUsdValue / payAmountUsd) * 100).toFixed(2)}%`
                            : requestedCryptoAmount && requestedCryptoAmount > 0 && shortfallCrypto !== null
                                ? `${Math.min(100, (shortfallCrypto / requestedCryptoAmount) * 100).toFixed(2)}%`
                                : '0.00%'

                    logger.info('Partial payment detected during sync', {
                        paymentId: payment.paymentId,
                        trigger: statusJustChanged ? 'status-change' : 'amount-change',
                        requestedUsd: payAmountUsd,
                        requestedCryptoAmount,
                        actualCryptoPaid,
                        actualUsdValue,
                        shortfallCrypto,
                        shortfallUsdValue,
                        shortfallPercent,
                    })

                    // Notify admin about partially_paid status with normalized currency data
                    try {
                        await EmailService.getInstance().sendPaymentIssueAlertEmail({
                            type: 'CRYPTO_PAYMENT_PARTIALLY_PAID_SYNC',
                            details: {
                                paymentId: payment.paymentId,
                                orderId: updatedPayment.orderId,
                                userId: updatedPayment.userId,
                                userEmail: updatedPayment.user.email,
                                tier: updatedPayment.tier,
                                status: paymentStatus.payment_status,
                                trigger: statusJustChanged ? 'status-change' : 'amount-change',
                                amounts: {
                                    requestedUsd: payAmountUsd || null,
                                    requestedCrypto: requestedCryptoAmount,
                                    requestedCurrency: paymentStatus.pay_currency || updatedPayment.payCurrency,
                                    actuallyPaidCrypto: Number(actualCryptoPaid.toFixed(8)),
                                    actuallyPaidUsd: actualUsdValue,
                                    shortfallUsd: shortfallUsdValue,
                                    shortfallCrypto,
                                    shortfallPercent,
                                    exchangeRateUsdPerUnit,
                                },
                                payCurrency: paymentStatus.pay_currency || updatedPayment.payCurrency,
                                note: 'Payment synced from NowPayments API - status is partially_paid',
                                actionRequired:
                                    'Review payment. If user paid full amount, manually complete payment via /api/admin/payments/complete-partial-payment',
                                debug: {
                                    previousStatus,
                                    previousActuallyPaid: previousActualPaid,
                                    cryptoDelta,
                                    cryptoDeltaPercent,
                                },
                            },
                        })
                    } catch (emailError) {
                        logger.error('Failed to notify admin about partially_paid status:', emailError)
                    }

                    // Send partial payment email to user with consistent currency display
                    if (updatedPayment.user.email) {
                        const emailService = EmailService.getInstance()
                        const partialEmailCurrency = (paymentStatus.pay_currency || updatedPayment.payCurrency || 'usd').toUpperCase()
                        const requestedAmountForUser =
                            requestedCryptoAmount !== null
                                ? Number(requestedCryptoAmount.toFixed(8))
                                : Number(payAmountUsd.toFixed(2))
                        const actualAmountForUser =
                            requestedCryptoAmount !== null
                                ? Number(actualCryptoPaid.toFixed(8))
                                : actualUsdValue ?? Number(actualCryptoPaid.toFixed(2))
                        const shortfallForUser =
                            requestedCryptoAmount !== null ? shortfallCrypto ?? 0 : shortfallUsdValue ?? 0

                        emailService
                            .sendPartialPaymentEmail({
                                email: updatedPayment.user.email,
                                name: undefined,
                                tier: updatedPayment.tier,
                                requestedAmount: requestedAmountForUser,
                                actuallyPaid: actualAmountForUser,
                                payCurrency: partialEmailCurrency,
                                shortfall: Number(shortfallForUser),
                                shortfallPercent: shortfallPercent,
                                paymentId: payment.paymentId || '',
                                orderId: updatedPayment.orderId || '',
                            })
                            .catch((error) => {
                                logger.error('Failed to send partial payment email to user:', error)
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
                    const expiresAt = new Date()
                    expiresAt.setDate(expiresAt.getDate() + 30)

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

