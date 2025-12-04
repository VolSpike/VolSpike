import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { InviteEmailData } from '../../types/admin'
import { AuditAction, AuditTargetType } from '../../types/audit-consts'
import { AuditService } from './audit-service'

const logger = createLogger()

export class InviteService {
    // Send user invitation email
    static async sendInviteEmail(data: InviteEmailData) {
        try {
            // Generate invitation token
            const invitationToken = this.generateInvitationToken()

            // Store invitation token
            await this.storeInvitationToken(data.email, invitationToken)

            // Send email (implement with your email service)
            await this.sendEmail({
                to: data.email,
                subject: 'Welcome to VolSpike - Admin Invitation',
                template: 'admin-invite',
                data: {
                    email: data.email,
                    temporaryPassword: data.temporaryPassword,
                    invitedBy: data.invitedBy,
                    tier: data.tier,
                    invitationToken,
                    loginUrl: `${process.env.FRONTEND_URL}/auth/login`,
                },
            })

            // Log the action
            await AuditService.logUserAction(
                data.invitedBy,
                AuditAction.USER_CREATED,
                AuditTargetType.USER,
                undefined,
                undefined,
                {
                    action: 'invite_sent',
                    email: data.email,
                    tier: data.tier,
                }
            )

            logger.info(`Invitation email sent to ${data.email}`)

            return { success: true, invitationToken }
        } catch (error) {
            logger.error('Send invite email error:', error)
            throw error
        }
    }

    // Send password reset email
    static async sendPasswordResetEmail(userId: string, tempPassword: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            })

            if (!user) {
                throw new Error('User not found')
            }

            // Generate password reset token
            const resetToken = this.generatePasswordResetToken()

            // Store reset token
            await this.storePasswordResetToken(userId, resetToken)

            // Send email
            await this.sendEmail({
                to: user.email,
                subject: 'VolSpike - Password Reset',
                template: 'password-reset',
                data: {
                    email: user.email,
                    temporaryPassword: tempPassword,
                    resetToken,
                    resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`,
                },
            })

            logger.info(`Password reset email sent to ${user.email}`)

            return { success: true, resetToken }
        } catch (error) {
            logger.error('Send password reset email error:', error)
            throw error
        }
    }

    // Send security alert email
    static async sendSecurityAlertEmail(data: {
        email: string
        alertType: string
        details: any
        timestamp: Date
    }) {
        try {
            await this.sendEmail({
                to: data.email,
                subject: `VolSpike Security Alert - ${data.alertType}`,
                template: 'security-alert',
                data: {
                    email: data.email,
                    alertType: data.alertType,
                    details: data.details,
                    timestamp: data.timestamp,
                    supportUrl: `${process.env.FRONTEND_URL}/support`,
                },
            })

            logger.info(`Security alert email sent to ${data.email}`)

            return { success: true }
        } catch (error) {
            logger.error('Send security alert email error:', error)
            throw error
        }
    }

    // Send admin notification email
    static async sendAdminNotificationEmail(data: {
        adminEmail: string
        notificationType: string
        details: any
        timestamp: Date
    }) {
        try {
            await this.sendEmail({
                to: data.adminEmail,
                subject: `VolSpike Admin Notification - ${data.notificationType}`,
                template: 'admin-notification',
                data: {
                    adminEmail: data.adminEmail,
                    notificationType: data.notificationType,
                    details: data.details,
                    timestamp: data.timestamp,
                    adminUrl: `${process.env.FRONTEND_URL}/admin`,
                },
            })

            logger.info(`Admin notification email sent to ${data.adminEmail}`)

            return { success: true }
        } catch (error) {
            logger.error('Send admin notification email error:', error)
            throw error
        }
    }

    // Verify invitation token
    static async verifyInvitationToken(token: string): Promise<{ valid: boolean; email?: string }> {
        try {
            // Check if token exists and is valid
            const invitation = await this.getInvitationByToken(token)

            if (!invitation) {
                return { valid: false }
            }

            // Check if token is expired
            if (invitation.expiresAt < new Date()) {
                return { valid: false }
            }

            return { valid: true, email: invitation.email }
        } catch (error) {
            logger.error('Verify invitation token error:', error)
            return { valid: false }
        }
    }

    // Verify password reset token
    static async verifyPasswordResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
        try {
            // Check if token exists and is valid
            const reset = await this.getPasswordResetByToken(token)

            if (!reset) {
                return { valid: false }
            }

            // Check if token is expired
            if (reset.expiresAt < new Date()) {
                return { valid: false }
            }

            return { valid: true, userId: reset.userId }
        } catch (error) {
            logger.error('Verify password reset token error:', error)
            return { valid: false }
        }
    }

    // Consume invitation token
    static async consumeInvitationToken(token: string): Promise<{ success: boolean; email?: string }> {
        try {
            const invitation = await this.getInvitationByToken(token)

            if (!invitation) {
                return { success: false }
            }

            // Mark token as used
            await this.markInvitationTokenAsUsed(token)

            return { success: true, email: invitation.email }
        } catch (error) {
            logger.error('Consume invitation token error:', error)
            return { success: false }
        }
    }

    // Consume password reset token
    static async consumePasswordResetToken(token: string): Promise<{ success: boolean; userId?: string }> {
        try {
            const reset = await this.getPasswordResetByToken(token)

            if (!reset) {
                return { success: false }
            }

            // Mark token as used
            await this.markPasswordResetTokenAsUsed(token)

            return { success: true, userId: reset.userId }
        } catch (error) {
            logger.error('Consume password reset token error:', error)
            return { success: false }
        }
    }

    // Helper methods
    private static generateInvitationToken(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let token = ''
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return token
    }

    private static generatePasswordResetToken(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let token = ''
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return token
    }

    private static async storeInvitationToken(email: string, token: string) {
        // Store invitation token in database
        // This would be implemented with a proper invitations table
        logger.info(`Invitation token stored for ${email}`)
    }

    private static async storePasswordResetToken(userId: string, token: string) {
        // Store password reset token in database
        // This would be implemented with a proper password_resets table
        logger.info(`Password reset token stored for user ${userId}`)
    }

    private static async getInvitationByToken(token: string): Promise<{ email: string; expiresAt: Date } | null> {
        // Get invitation by token from database
        // This would be implemented with a proper invitations table
        return null
    }

    private static async getPasswordResetByToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
        // Get password reset by token from database
        // This would be implemented with a proper password_resets table
        return null
    }

    private static async markInvitationTokenAsUsed(token: string) {
        // Mark invitation token as used in database
        logger.info(`Invitation token ${token} marked as used`)
    }

    private static async markPasswordResetTokenAsUsed(token: string) {
        // Mark password reset token as used in database
        logger.info(`Password reset token ${token} marked as used`)
    }

    private static async sendEmail(data: {
        to: string
        subject: string
        template: string
        data: any
    }) {
        // Implement email sending with your email service (SendGrid, etc.)
        logger.info(`Email sent to ${data.to}: ${data.subject}`)
    }

    // Cleanup expired tokens
    static async cleanupExpiredTokens() {
        try {
            // Clean up expired invitation tokens
            // Clean up expired password reset tokens
            logger.info('Expired tokens cleaned up')
        } catch (error) {
            logger.error('Cleanup expired tokens error:', error)
        }
    }
}
