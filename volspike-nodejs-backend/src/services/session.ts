import { PrismaClient } from '@prisma/client'
import { createLogger } from '../lib/logger'

const logger = createLogger()

// Session limits per tier
const SESSION_LIMITS: Record<string, number> = {
    free: 1,
    pro: 1,
    elite: parseInt(process.env.ELITE_SESSION_LIMIT || '4', 10),
}

// Session expiration (30 days, matching JWT)
const SESSION_EXPIRY_DAYS = 30

export interface CreateSessionParams {
    userId: string
    deviceId: string
    tier: string
    role?: string // User role - ADMIN users have unlimited sessions
    ipAddress?: string
    userAgent?: string
}

export interface SessionInfo {
    id: string
    deviceId: string
    deviceName: string | null
    ipAddress: string | null
    lastActivityAt: Date
    createdAt: Date
    isCurrent: boolean
}

export interface InvalidatedSession {
    id: string
    deviceId: string
    userId: string
}

/**
 * Parse user agent string to get a friendly device name
 */
function parseDeviceName(userAgent?: string): string | null {
    if (!userAgent) return null

    // Mobile detection
    if (/iPhone/i.test(userAgent)) return 'iPhone'
    if (/iPad/i.test(userAgent)) return 'iPad'
    if (/Android.*Mobile/i.test(userAgent)) return 'Android Phone'
    if (/Android/i.test(userAgent)) return 'Android Tablet'

    // Browser detection
    if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
        if (/Windows/i.test(userAgent)) return 'Chrome on Windows'
        if (/Mac/i.test(userAgent)) return 'Chrome on Mac'
        if (/Linux/i.test(userAgent)) return 'Chrome on Linux'
        return 'Chrome'
    }
    if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
        if (/Mac/i.test(userAgent)) return 'Safari on Mac'
        return 'Safari'
    }
    if (/Firefox/i.test(userAgent)) {
        if (/Windows/i.test(userAgent)) return 'Firefox on Windows'
        if (/Mac/i.test(userAgent)) return 'Firefox on Mac'
        if (/Linux/i.test(userAgent)) return 'Firefox on Linux'
        return 'Firefox'
    }
    if (/Edge/i.test(userAgent)) return 'Edge'

    // OS detection fallback
    if (/Windows/i.test(userAgent)) return 'Windows'
    if (/Mac/i.test(userAgent)) return 'Mac'
    if (/Linux/i.test(userAgent)) return 'Linux'

    return 'Unknown Device'
}

/**
 * Create a new session for a user.
 * For Free/Pro tiers: Invalidates ALL other sessions (single session enforcement)
 * For Elite tier: Allows up to SESSION_LIMITS.elite sessions, invalidates oldest if at limit
 *
 * Returns the new session ID and list of invalidated sessions (for WebSocket disconnection)
 */
export async function createSession(
    prisma: PrismaClient,
    params: CreateSessionParams
): Promise<{ sessionId: string; invalidatedSessions: InvalidatedSession[] }> {
    const { userId, deviceId, tier, role, ipAddress, userAgent } = params

    // ADMIN users have unlimited sessions (no enforcement)
    const isAdmin = role?.toUpperCase() === 'ADMIN'
    const sessionLimit = isAdmin ? Infinity : (SESSION_LIMITS[tier.toLowerCase()] || 1)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

    const deviceName = parseDeviceName(userAgent)

    let invalidatedSessions: InvalidatedSession[] = []

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
        // Get all active sessions for this user
        const existingSessions = await tx.userSession.findMany({
            where: {
                userId,
                isActive: true,
            },
            orderBy: {
                createdAt: 'asc', // Oldest first
            },
            select: {
                id: true,
                deviceId: true,
                userId: true,
            },
        })

        // Determine which sessions to invalidate
        let sessionsToInvalidate: { id: string; deviceId: string; userId: string }[] = []

        // ADMIN users (sessionLimit === Infinity) never have sessions invalidated
        if (sessionLimit === Infinity) {
            // No session invalidation for admins - unlimited sessions allowed
            logger.info(`Admin user ${userId} - skipping session limit enforcement`)
        } else if (sessionLimit === 1) {
            // Free/Pro: Invalidate ALL other sessions
            sessionsToInvalidate = existingSessions.filter(s => s.deviceId !== deviceId)
        } else {
            // Elite: Check if at limit (excluding current device if it exists)
            const otherSessions = existingSessions.filter(s => s.deviceId !== deviceId)
            if (otherSessions.length >= sessionLimit) {
                // Invalidate oldest sessions to make room (keep sessionLimit - 1)
                const sessionsToKeep = sessionLimit - 1
                sessionsToInvalidate = otherSessions.slice(0, otherSessions.length - sessionsToKeep)
            }
        }

        // Invalidate old sessions
        if (sessionsToInvalidate.length > 0) {
            await tx.userSession.updateMany({
                where: {
                    id: { in: sessionsToInvalidate.map(s => s.id) },
                },
                data: {
                    isActive: false,
                    invalidatedAt: new Date(),
                    invalidatedBy: sessionLimit === 1 ? 'new_login' : 'session_limit',
                },
            })

            invalidatedSessions = sessionsToInvalidate
            logger.info(`Invalidated ${sessionsToInvalidate.length} session(s) for user ${userId}`, {
                reason: sessionLimit === 1 ? 'new_login' : 'session_limit',
                tier,
            })
        }

        // Create or update session for this device
        const session = await tx.userSession.upsert({
            where: {
                userId_deviceId: { userId, deviceId },
            },
            create: {
                userId,
                deviceId,
                deviceName,
                ipAddress,
                userAgent,
                tier: tier.toLowerCase(),
                expiresAt,
                isActive: true,
                lastActivityAt: new Date(),
            },
            update: {
                deviceName,
                ipAddress,
                userAgent,
                tier: tier.toLowerCase(),
                expiresAt,
                isActive: true,
                invalidatedAt: null,
                invalidatedBy: null,
                lastActivityAt: new Date(),
            },
        })

        return session
    })

    logger.info(`Session created for user ${userId}`, {
        sessionId: result.id,
        deviceId,
        tier,
        invalidatedCount: invalidatedSessions.length,
    })

    return {
        sessionId: result.id,
        invalidatedSessions,
    }
}

/**
 * Validate a session is still active and not expired.
 * Returns the session if valid, null if invalid.
 */
export async function validateSession(
    prisma: PrismaClient,
    sessionId: string
): Promise<{ isValid: boolean; userId?: string; reason?: string }> {
    try {
        const session = await prisma.userSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                userId: true,
                isActive: true,
                invalidatedBy: true,
                expiresAt: true,
            },
        })

        if (!session) {
            return { isValid: false, reason: 'session_not_found' }
        }

        if (!session.isActive) {
            return {
                isValid: false,
                userId: session.userId,
                reason: session.invalidatedBy || 'session_invalidated',
            }
        }

        if (session.expiresAt < new Date()) {
            // Mark as expired
            await prisma.userSession.update({
                where: { id: sessionId },
                data: {
                    isActive: false,
                    invalidatedAt: new Date(),
                    invalidatedBy: 'expired',
                },
            })
            return { isValid: false, userId: session.userId, reason: 'session_expired' }
        }

        return { isValid: true, userId: session.userId }
    } catch (error) {
        logger.error('Session validation error:', error)
        return { isValid: false, reason: 'validation_error' }
    }
}

/**
 * Update session activity timestamp (call periodically to track activity)
 */
export async function updateSessionActivity(
    prisma: PrismaClient,
    sessionId: string
): Promise<void> {
    try {
        await prisma.userSession.update({
            where: { id: sessionId },
            data: { lastActivityAt: new Date() },
        })
    } catch (error) {
        // Non-critical, just log
        logger.warn('Failed to update session activity:', { sessionId, error })
    }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
    prisma: PrismaClient,
    userId: string,
    currentSessionId?: string
): Promise<SessionInfo[]> {
    const sessions = await prisma.userSession.findMany({
        where: {
            userId,
            isActive: true,
        },
        orderBy: {
            lastActivityAt: 'desc',
        },
        select: {
            id: true,
            deviceId: true,
            deviceName: true,
            ipAddress: true,
            lastActivityAt: true,
            createdAt: true,
        },
    })

    return sessions.map(s => ({
        ...s,
        isCurrent: s.id === currentSessionId,
    }))
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
    prisma: PrismaClient,
    sessionId: string,
    userId: string,
    reason: 'user_revoked' | 'admin_revoked' = 'user_revoked'
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await prisma.userSession.findUnique({
            where: { id: sessionId },
            select: { userId: true, isActive: true },
        })

        if (!session) {
            return { success: false, error: 'Session not found' }
        }

        if (session.userId !== userId) {
            return { success: false, error: 'Unauthorized' }
        }

        if (!session.isActive) {
            return { success: false, error: 'Session already revoked' }
        }

        await prisma.userSession.update({
            where: { id: sessionId },
            data: {
                isActive: false,
                invalidatedAt: new Date(),
                invalidatedBy: reason,
            },
        })

        logger.info(`Session revoked`, { sessionId, userId, reason })

        return { success: true }
    } catch (error) {
        logger.error('Failed to revoke session:', { sessionId, userId, error })
        return { success: false, error: 'Failed to revoke session' }
    }
}

/**
 * Revoke all sessions for a user (e.g., on password change or account compromise)
 */
export async function revokeAllUserSessions(
    prisma: PrismaClient,
    userId: string,
    reason: string = 'admin_revoked'
): Promise<{ count: number }> {
    const result = await prisma.userSession.updateMany({
        where: {
            userId,
            isActive: true,
        },
        data: {
            isActive: false,
            invalidatedAt: new Date(),
            invalidatedBy: reason,
        },
    })

    logger.info(`Revoked all sessions for user`, { userId, count: result.count, reason })

    return { count: result.count }
}

/**
 * Get session limit for a tier
 */
export function getSessionLimit(tier: string): number {
    return SESSION_LIMITS[tier.toLowerCase()] || 1
}

/**
 * Cleanup expired sessions (run periodically via cron)
 */
export async function cleanupExpiredSessions(prisma: PrismaClient): Promise<number> {
    const result = await prisma.userSession.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                {
                    isActive: false,
                    invalidatedAt: {
                        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                    },
                },
            ],
        },
    })

    if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired/old sessions`)
    }

    return result.count
}
