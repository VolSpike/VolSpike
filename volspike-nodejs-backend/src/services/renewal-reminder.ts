import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { EmailService } from './email'

const logger = createLogger()

/**
 * Check for expiring crypto subscriptions and send renewal reminders
 * Should be called periodically (e.g., via cron job or scheduled task)
 */
export async function checkAndSendRenewalReminders() {
    try {
        const now = new Date()
        const sevenDaysFromNow = new Date(now)
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
        
        const threeDaysFromNow = new Date(now)
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
        
        const oneDayFromNow = new Date(now)
        oneDayFromNow.setDate(oneDayFromNow.getDate() + 1)

        // Find all active crypto payments that are expiring soon
        // Only check payments that are finished and have expiration dates
        const expiringPayments = await prisma.cryptoPayment.findMany({
            where: {
                paymentStatus: 'finished',
                expiresAt: {
                    not: null,
                    gte: now, // Not expired yet
                    lte: sevenDaysFromNow, // Expiring within 7 days
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                    },
                },
            },
        })

        logger.info(`Found ${expiringPayments.length} crypto subscriptions expiring soon`)

        const emailService = EmailService.getInstance()
        let remindersSent = 0

        for (const payment of expiringPayments) {
            if (!payment.expiresAt || !payment.user.email) {
                continue
            }

            const daysUntilExpiration = Math.ceil(
                (payment.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )

            // Determine which reminder to send based on days until expiration
            let reminderType: '7days' | '3days' | '1day' | null = null
            let shouldSend = false

            if (daysUntilExpiration <= 1 && daysUntilExpiration > 0) {
                reminderType = '1day'
                // Send 1-day reminder if not sent in last 12 hours
                const lastReminder = payment.renewalReminderSent
                if (!lastReminder || (now.getTime() - lastReminder.getTime()) > 12 * 60 * 60 * 1000) {
                    shouldSend = true
                }
            } else if (daysUntilExpiration <= 3 && daysUntilExpiration > 1) {
                reminderType = '3days'
                // Send 3-day reminder if not sent in last 24 hours
                const lastReminder = payment.renewalReminderSent
                if (!lastReminder || (now.getTime() - lastReminder.getTime()) > 24 * 60 * 60 * 1000) {
                    shouldSend = true
                }
            } else if (daysUntilExpiration <= 7 && daysUntilExpiration > 3) {
                reminderType = '7days'
                // Send 7-day reminder if not sent yet
                if (!payment.renewalReminderSent) {
                    shouldSend = true
                }
            }

            if (shouldSend && reminderType) {
                try {
                    await emailService.sendCryptoRenewalReminder({
                        email: payment.user.email,
                        tier: payment.tier,
                        daysUntilExpiration,
                        expiresAt: payment.expiresAt,
                    })

                    // Update reminder sent timestamp
                    await prisma.cryptoPayment.update({
                        where: { id: payment.id },
                        data: { renewalReminderSent: now },
                    })

                    remindersSent++
                    logger.info(`Sent ${reminderType} renewal reminder to ${payment.user.email}`, {
                        userId: payment.userId,
                        tier: payment.tier,
                        daysUntilExpiration,
                        expiresAt: payment.expiresAt,
                    })
                } catch (error) {
                    logger.error(`Failed to send renewal reminder to ${payment.user.email}`, {
                        error: error instanceof Error ? error.message : String(error),
                        userId: payment.userId,
                    })
                }
            }
        }

        logger.info(`Renewal reminder check completed: ${remindersSent} reminders sent`)

        return {
            checked: expiringPayments.length,
            sent: remindersSent,
        }
    } catch (error) {
        logger.error('Error checking renewal reminders:', error)
        throw error
    }
}

/**
 * Check for expired crypto subscriptions and downgrade users
 * Should be called periodically (e.g., via cron job or scheduled task)
 */
export async function checkAndDowngradeExpiredSubscriptions() {
    try {
        const now = new Date()

        // Find all expired crypto payments that are still active
        const expiredPayments = await prisma.cryptoPayment.findMany({
            where: {
                paymentStatus: 'finished',
                expiresAt: {
                    not: null,
                    lt: now, // Expired
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                    },
                },
            },
        })

        logger.info(`Found ${expiredPayments.length} expired crypto subscriptions`)

        let downgraded = 0

        for (const payment of expiredPayments) {
            // Only downgrade if user's current tier matches the payment tier
            // (they might have upgraded via Stripe in the meantime)
            if (payment.user.tier === payment.tier) {
                try {
                    await prisma.user.update({
                        where: { id: payment.userId },
                        data: { tier: 'free' },
                    })

                    downgraded++
                    logger.info(`Downgraded user ${payment.userId} from ${payment.tier} to free (crypto subscription expired)`, {
                        userId: payment.userId,
                        previousTier: payment.tier,
                        expiresAt: payment.expiresAt,
                    })

                    // Optionally send expiration email
                    if (payment.user.email) {
                        const emailService = EmailService.getInstance()
                        await emailService.sendCryptoSubscriptionExpired({
                            email: payment.user.email,
                            tier: payment.tier,
                            expiresAt: payment.expiresAt!,
                        }).catch((error) => {
                            logger.error(`Failed to send expiration email to ${payment.user.email}`, {
                                error: error instanceof Error ? error.message : String(error),
                            })
                        })
                    }
                } catch (error) {
                    logger.error(`Failed to downgrade user ${payment.userId}`, {
                        error: error instanceof Error ? error.message : String(error),
                        userId: payment.userId,
                    })
                }
            }
        }

        logger.info(`Expired subscription check completed: ${downgraded} users downgraded`)

        return {
            checked: expiredPayments.length,
            downgraded,
        }
    } catch (error) {
        logger.error('Error checking expired subscriptions:', error)
        throw error
    }
}

