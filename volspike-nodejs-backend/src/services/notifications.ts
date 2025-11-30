import { prisma } from '../index'
import { createLogger } from '../lib/logger'

const logger = createLogger()

/**
 * Notification types for admin notifications
 */
export enum NotificationType {
    NEW_ASSET_DETECTED = 'NEW_ASSET_DETECTED',
    ASSET_ENRICHMENT_FAILED = 'ASSET_ENRICHMENT_FAILED',
    // Future notification types can be added here
}

/**
 * Create a notification for all admin users
 * @param type Notification type
 * @param title Notification title
 * @param message Notification message
 * @param metadata Optional metadata (e.g., { assetSymbol: "BTC", assetId: "..." })
 */
export async function createAdminNotification(
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
): Promise<void> {
    try {
        // Find all admin users
        const adminUsers = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
            },
            select: {
                id: true,
            },
        })

        if (adminUsers.length === 0) {
            logger.warn('[Notifications] No admin users found to notify')
            return
        }

        // Create notifications for all admins
        const notifications = adminUsers.map((user) => ({
            userId: user.id,
            type,
            title,
            message,
            metadata: metadata || null,
            isRead: false,
        }))

        await prisma.adminNotification.createMany({
            data: notifications,
        })

        logger.info(`[Notifications] Created ${notifications.length} notifications for admins`, {
            type,
            title,
        })
    } catch (error) {
        logger.error('[Notifications] Failed to create admin notification', {
            error: error instanceof Error ? error.message : String(error),
            type,
            title,
        })
    }
}

/**
 * Create a notification for new asset detection
 * @param assetSymbol Base symbol of the detected asset (e.g., "BTC")
 * @param assetId Asset ID from database
 */
export async function notifyNewAssetDetected(assetSymbol: string, assetId: string): Promise<void> {
    await createAdminNotification(
        NotificationType.NEW_ASSET_DETECTED,
        'New Asset Detected',
        `A new trading pair "${assetSymbol}USDT" has been detected and needs admin review.`,
        {
            assetSymbol,
            assetId,
        }
    )
}

