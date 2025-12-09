import type { Server as SocketIOServer } from 'socket.io'
import { createLogger } from '../lib/logger'
import { sendAlertEmail } from '../services/email'

const logger = createLogger()

let ioInstance: SocketIOServer | null = null

export function setUserAlertSocketIO(io: SocketIOServer) {
    ioInstance = io
}

export interface UserAlertPayload {
    userId: string
    alertId: string
    symbol: string
    alertType: 'PRICE_CROSS' | 'FUNDING_CROSS' | 'OI_CROSS'
    threshold: number
    currentValue: number
    previousValue: number
    crossedUp: boolean
    deliveryMethod: 'DASHBOARD' | 'EMAIL' | 'BOTH'
    userEmail?: string
}

export async function broadcastUserAlert(payload: UserAlertPayload) {
    try {
        if (!ioInstance) {
            logger.warn('Socket.IO not initialized, cannot broadcast user alert')
            return
        }

        // Format alert type for display
        const alertTypeNames: Record<string, string> = {
            PRICE_CROSS: 'Price',
            FUNDING_CROSS: 'Funding Rate',
            OI_CROSS: 'Open Interest',
        }
        const alertTypeName = alertTypeNames[payload.alertType] || payload.alertType

        // Format value based on alert type
        const formatValue = (value: number): string => {
            if (payload.alertType === 'PRICE_CROSS' || payload.alertType === 'OI_CROSS') {
                return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            } else if (payload.alertType === 'FUNDING_CROSS') {
                return `${(value * 100).toFixed(4)}%`
            }
            return value.toString()
        }

        const message = {
            id: payload.alertId,
            symbol: payload.symbol,
            alertType: payload.alertType,
            alertTypeName,
            threshold: payload.threshold,
            thresholdFormatted: formatValue(payload.threshold),
            currentValue: payload.currentValue,
            currentValueFormatted: formatValue(payload.currentValue),
            previousValue: payload.previousValue,
            previousValueFormatted: formatValue(payload.previousValue),
            crossedUp: payload.crossedUp,
            direction: payload.crossedUp ? 'above' : 'below',
            timestamp: new Date().toISOString(),
        }

        // Broadcast to user's personal room
        const userRoom = `user:${payload.userId}`
        ioInstance.to(userRoom).emit('user-alert-triggered', message)

        logger.info('User alert broadcasted via Socket.IO', {
            userId: payload.userId,
            alertId: payload.alertId,
            symbol: payload.symbol,
            alertType: payload.alertType,
            room: userRoom,
        })

        // Send email if configured
        if ((payload.deliveryMethod === 'EMAIL' || payload.deliveryMethod === 'BOTH') && payload.userEmail) {
            try {
                await sendAlertEmail({
                    to: payload.userEmail,
                    symbol: payload.symbol,
                    alertType: alertTypeName,
                    threshold: formatValue(payload.threshold),
                    currentValue: formatValue(payload.currentValue),
                    direction: payload.crossedUp ? 'above' : 'below',
                })
                logger.info('Alert email sent', {
                    userId: payload.userId,
                    email: payload.userEmail,
                    alertId: payload.alertId,
                })
            } catch (emailError) {
                logger.error('Failed to send alert email', {
                    error: emailError,
                    userId: payload.userId,
                    alertId: payload.alertId,
                })
            }
        }
    } catch (error) {
        logger.error('Error broadcasting user alert:', error)
    }
}
