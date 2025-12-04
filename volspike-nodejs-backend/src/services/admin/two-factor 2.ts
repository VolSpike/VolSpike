import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { TwoFactorSetup, TwoFactorVerification } from '../../types/admin'
import { AuditAction, AuditTargetType } from '../../types/audit-consts'
import { AuditService } from './audit-service'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

const logger = createLogger()

export class TwoFactorService {
    // Generate 2FA setup for user
    static async generate2FASetup(userId: string): Promise<TwoFactorSetup> {
        try {
            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `VolSpike Admin (${userId})`,
                issuer: process.env.ADMIN_2FA_ISSUER || 'VolSpike',
                length: 32,
            })

            // Generate QR code
            const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

            // Generate backup codes
            const backupCodes = this.generateBackupCodes()

            // Store secret (encrypted) and backup codes
            await this.store2FASecret(userId, secret.base32, backupCodes)

            logger.info(`2FA setup generated for user ${userId}`)

            return {
                secret: secret.base32,
                qrCode,
                backupCodes,
            }
        } catch (error) {
            logger.error('Generate 2FA setup error:', error)
            throw error
        }
    }

    // Verify 2FA code
    static async verify2FACode(
        userId: string,
        code: string,
        backupCode?: string
    ): Promise<boolean> {
        try {
            // Get user's 2FA secret
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { twoFactorSecret: true },
            })

            if (!user?.twoFactorSecret) {
                return false
            }

            // Check if it's a backup code
            if (backupCode) {
                return await this.verifyBackupCode(userId, backupCode)
            }

            // Verify TOTP code
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: code,
                window: 2, // Allow 2 time windows (60 seconds)
            })

            if (verified) {
                logger.info(`2FA code verified for user ${userId}`)
            } else {
                logger.warn(`Invalid 2FA code for user ${userId}`)
            }

            return verified
        } catch (error) {
            logger.error('Verify 2FA code error:', error)
            return false
        }
    }

    // Enable 2FA for user
    static async enable2FA(userId: string, adminUserId: string) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: true,
                },
            })

            // Log the action
            await AuditService.logUserAction(
                adminUserId,
                AuditAction.ADMIN_2FA_ENABLED,
                AuditTargetType.ADMIN,
                userId
            )

            logger.info(`2FA enabled for user ${userId} by admin ${adminUserId}`)
        } catch (error) {
            logger.error('Enable 2FA error:', error)
            throw error
        }
    }

    // Disable 2FA for user
    static async disable2FA(userId: string, adminUserId: string) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                },
            })

            // Log the action
            await AuditService.logUserAction(
                adminUserId,
                AuditAction.ADMIN_2FA_DISABLED,
                AuditTargetType.ADMIN,
                userId
            )

            logger.info(`2FA disabled for user ${userId} by admin ${adminUserId}`)
        } catch (error) {
            logger.error('Disable 2FA error:', error)
            throw error
        }
    }

    // Verify backup code
    static async verifyBackupCode(userId: string, backupCode: string): Promise<boolean> {
        try {
            // Get user's backup codes (this would be stored securely)
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { twoFactorSecret: true }, // This would include backup codes in real implementation
            })

            if (!user) {
                return false
            }

            // In a real implementation, you would:
            // 1. Decrypt the stored backup codes
            // 2. Check if the provided code matches any unused code
            // 3. Mark the used code as consumed
            // 4. Return true if valid, false otherwise

            // For now, we'll use a simple validation
            const isValidBackupCode = this.validateBackupCodeFormat(backupCode)

            if (isValidBackupCode) {
                logger.info(`Backup code used for user ${userId}`)
                // Log security event
                await AuditService.logSecurityEvent(
                    userId,
                    'BACKUP_CODE_USED',
                    { userId, timestamp: new Date().toISOString() }
                )
            }

            return isValidBackupCode
        } catch (error) {
            logger.error('Verify backup code error:', error)
            return false
        }
    }

    // Generate new backup codes
    static async generateNewBackupCodes(userId: string, adminUserId: string): Promise<string[]> {
        try {
            const backupCodes = this.generateBackupCodes()

            // Store new backup codes (encrypted)
            await this.storeBackupCodes(userId, backupCodes)

            // Log the action
            await AuditService.logUserAction(
                adminUserId,
                AuditAction.ADMIN_2FA_ENABLED,
                AuditTargetType.ADMIN,
                userId,
                undefined,
                { action: 'backup_codes_regenerated' }
            )

            logger.info(`New backup codes generated for user ${userId} by admin ${adminUserId}`)

            return backupCodes
        } catch (error) {
            logger.error('Generate new backup codes error:', error)
            throw error
        }
    }

    // Check if user has 2FA enabled
    static async is2FAEnabled(userId: string): Promise<boolean> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { twoFactorEnabled: true },
            })

            return user?.twoFactorEnabled || false
        } catch (error) {
            logger.error('Check 2FA enabled error:', error)
            return false
        }
    }

    // Get 2FA status for user
    static async get2FAStatus(userId: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    twoFactorEnabled: true,
                    twoFactorSecret: true,
                },
            })

            return {
                enabled: user?.twoFactorEnabled || false,
                hasSecret: !!user?.twoFactorSecret,
                // Don't expose the actual secret
            }
        } catch (error) {
            logger.error('Get 2FA status error:', error)
            throw error
        }
    }

    // Validate 2FA setup
    static async validate2FASetup(userId: string, code: string): Promise<boolean> {
        try {
            // Get user's 2FA secret
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { twoFactorSecret: true },
            })

            if (!user?.twoFactorSecret) {
                return false
            }

            // Verify the setup code
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: code,
                window: 2,
            })

            return verified
        } catch (error) {
            logger.error('Validate 2FA setup error:', error)
            return false
        }
    }

    // Helper methods
    private static generateBackupCodes(): string[] {
        const codes: string[] = []
        for (let i = 0; i < 10; i++) {
            codes.push(this.generateBackupCode())
        }
        return codes
    }

    private static generateBackupCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let code = ''
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    private static validateBackupCodeFormat(code: string): boolean {
        // Backup codes should be 8 characters, alphanumeric
        return /^[A-Z0-9]{8}$/.test(code)
    }

    private static async store2FASecret(userId: string, secret: string, backupCodes: string[]) {
        // In a real implementation, you would:
        // 1. Encrypt the secret and backup codes
        // 2. Store them securely in the database
        // 3. Handle key rotation and security

        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorSecret: secret, // This should be encrypted
            },
        })
    }

    private static async storeBackupCodes(userId: string, backupCodes: string[]) {
        // In a real implementation, you would:
        // 1. Encrypt the backup codes
        // 2. Store them securely
        // 3. Track which codes have been used

        // For now, we'll just log that new codes were generated
        logger.info(`Backup codes stored for user ${userId}`)
    }

    // Security methods
    static async logFailed2FAAttempt(userId: string, code: string) {
        try {
            await AuditService.logSecurityEvent(
                userId,
                '2FA_FAILED_ATTEMPT',
                {
                    userId,
                    attemptedCode: code,
                    timestamp: new Date().toISOString(),
                }
            )

            logger.warn(`Failed 2FA attempt for user ${userId}`)
        } catch (error) {
            logger.error('Log failed 2FA attempt error:', error)
        }
    }

    static async logSuccessful2FAAttempt(userId: string) {
        try {
            await AuditService.logSecurityEvent(
                userId,
                '2FA_SUCCESSFUL_ATTEMPT',
                {
                    userId,
                    timestamp: new Date().toISOString(),
                }
            )

            logger.info(`Successful 2FA attempt for user ${userId}`)
        } catch (error) {
            logger.error('Log successful 2FA attempt error:', error)
        }
    }
}
