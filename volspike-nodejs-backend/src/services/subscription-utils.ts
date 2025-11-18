import { Prisma } from '@prisma/client'
import { prisma } from '../index'

/**
 * Compute a stacked crypto subscription expiry for a user.
 *
 * Rule:
 *   base = max(now, currentExpiresAt)
 *   expiresAt = base + 30 days
 *
 * This ensures:
 * - First-time payments get 30 days from now.
 * - Renewals before expiry extend from the existing expiry (no loss of days).
 * - Renewals after expiry start from now.
 */
export async function computeStackedCryptoExpiry(
    userId: string,
    client?: Prisma.TransactionClient
): Promise<Date> {
    const db: any = client || prisma

    const now = new Date()

    const latestFinished = await db.cryptoPayment.findFirst({
        where: {
            userId,
            paymentStatus: 'finished',
            expiresAt: {
                not: null,
            },
        },
        orderBy: {
            expiresAt: 'desc',
        },
    })

    const currentExpiresAt: Date | null = latestFinished?.expiresAt ?? null

    const base =
        currentExpiresAt && currentExpiresAt.getTime() > now.getTime()
            ? currentExpiresAt
            : now

    const expiresAt = new Date(base)
    expiresAt.setDate(expiresAt.getDate() + 30)

    return expiresAt
}

