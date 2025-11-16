import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import { Role, UserStatus } from '@prisma/client'
import {
    UserSummary,
    UserDetail,
    CreateUserRequest,
    UpdateUserRequest,
    BulkActionRequest,
    InviteEmailData
} from '../../types/admin'
import { AuditAction, AuditTargetType } from '../../types/audit'
import bcrypt from 'bcryptjs'

const logger = createLogger()

export class UserManagementService {
    // Get users with filtering and pagination
    static async getUsers(query: {
        search?: string
        role?: Role
        tier?: 'free' | 'pro' | 'elite'
        status?: UserStatus
        page?: number
        limit?: number
        sortBy?: 'createdAt' | 'email' | 'lastLoginAt'
        sortOrder?: 'asc' | 'desc'
    }) {
        try {
            // Build where clause
            const where: any = {}

            if (query.search) {
                where.OR = [
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { walletAddress: { contains: query.search, mode: 'insensitive' } },
                ]
            }

            if (query.role) where.role = query.role
            if (query.tier) where.tier = query.tier
            if (query.status) where.status = query.status

            // Get total count
            const total = await prisma.user.count({ where })

            // Get paginated results
            const users = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    walletAddress: true,
                    tier: true,
                    role: true,
                    status: true,
                    emailVerified: true,
                    createdAt: true,
                    lastLoginAt: true,
                    stripeCustomerId: true,
                },
                orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
                skip: ((query.page || 1) - 1) * (query.limit || 20),
                take: query.limit || 20,
            })

            return {
                users: users as UserSummary[],
                pagination: {
                    total,
                    page: query.page || 1,
                    limit: query.limit || 20,
                    pages: Math.ceil(total / (query.limit || 20)),
                },
            }
        } catch (error) {
            logger.error('Get users error:', error)
            throw new Error('Failed to fetch users')
        }
    }

    // Get user details by ID
    static async getUserById(userId: string): Promise<UserDetail | null> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    preferences: true,
                    watchlists: {
                        include: {
                            items: {
                                include: {
                                    contract: true,
                                },
                            },
                        },
                    },
                    alerts: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                    auditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                    },
                },
            })

            return user as UserDetail
        } catch (error) {
            logger.error('Get user by ID error:', error)
            throw new Error('Failed to fetch user')
        }
    }

    // Create new user
    static async createUser(data: CreateUserRequest, adminUserId: string) {
        try {
            // Check if user already exists
            const existing = await prisma.user.findUnique({
                where: { email: data.email },
            })

            if (existing) {
                throw new Error('User already exists')
            }

            // Generate temporary password if not provided
            const tempPassword = data.temporaryPassword || this.generateTempPassword()

            // Hash the password for storage
            const passwordHash = await bcrypt.hash(tempPassword, 12)

            // Create user with password hash
            const user = await prisma.user.create({
                data: {
                    email: data.email,
                    tier: data.tier,
                    role: data.role,
                    passwordHash: passwordHash,
                    emailVerified: new Date(), // Mark as verified since admin created it
                },
            })

            // Send invite email
            if (data.sendInvite) {
                await this.sendInviteEmail({
                    email: data.email,
                    temporaryPassword: tempPassword,
                    invitedBy: adminUserId,
                    tier: data.tier,
                })
            }

            logger.info(`User ${data.email} created by admin ${adminUserId}`)

            return {
                user,
                temporaryPassword: data.sendInvite ? undefined : tempPassword,
            }
        } catch (error) {
            logger.error('Create user error:', error)
            throw error
        }
    }

    // Update user
    static async updateUser(userId: string, data: UpdateUserRequest, adminUserId: string) {
        try {
            // Get current user data for audit
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    tier: true,
                    role: true,
                    status: true,
                    notes: true,
                    emailVerified: true,
                },
            })

            if (!currentUser) {
                throw new Error('User not found')
            }

            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    ...data,
                    emailVerified: data.emailVerified === true ? new Date() :
                        data.emailVerified === false ? null :
                            data.emailVerified,
                    updatedAt: new Date(),
                },
            })

            logger.info(`User ${userId} updated by admin ${adminUserId}`)

            return user
        } catch (error) {
            logger.error('Update user error:', error)
            throw error
        }
    }

    // Delete user (soft delete)
    static async deleteUser(userId: string, hardDelete: boolean, adminUserId: string) {
        try {
            if (hardDelete) {
                await prisma.user.delete({
                    where: { id: userId },
                })

                logger.warn(`User ${userId} HARD DELETED by admin ${adminUserId}`)
            } else {
                // Soft delete - just mark as BANNED
                await prisma.user.update({
                    where: { id: userId },
                    data: { status: UserStatus.BANNED },
                })

                logger.info(`User ${userId} soft deleted by admin ${adminUserId}`)
            }

            return { success: true }
        } catch (error) {
            logger.error('Delete user error:', error)
            throw error
        }
    }

    // Suspend user
    static async suspendUser(userId: string, adminUserId: string) {
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: { status: UserStatus.SUSPENDED },
            })

            logger.info(`User ${userId} suspended by admin ${adminUserId}`)

            return user
        } catch (error) {
            logger.error('Suspend user error:', error)
            throw error
        }
    }

    // Activate user
    static async activateUser(userId: string, adminUserId: string) {
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: { status: UserStatus.ACTIVE },
            })

            logger.info(`User ${userId} activated by admin ${adminUserId}`)

            return user
        } catch (error) {
            logger.error('Activate user error:', error)
            throw error
        }
    }

    // Reset user password
    static async resetUserPassword(userId: string, adminUserId: string) {
        try {
            // Generate new temporary password
            const tempPassword = this.generateTempPassword()

            // Send password reset email
            await this.sendPasswordResetEmail(userId, tempPassword)

            logger.info(`Password reset for user ${userId} by admin ${adminUserId}`)

            return { success: true, message: 'Password reset email sent' }
        } catch (error) {
            logger.error('Reset password error:', error)
            throw error
        }
    }

    // Execute bulk actions
    static async executeBulkAction(data: BulkActionRequest, adminUserId: string) {
        try {
            const results = []

            for (const userId of data.userIds) {
                try {
                    switch (data.action) {
                        case 'suspend':
                            await prisma.user.update({
                                where: { id: userId },
                                data: { status: UserStatus.SUSPENDED },
                            })
                            results.push({ userId, success: true, action: 'suspended' })
                            break

                        case 'activate':
                            await prisma.user.update({
                                where: { id: userId },
                                data: { status: UserStatus.ACTIVE },
                            })
                            results.push({ userId, success: true, action: 'activated' })
                            break

                        case 'delete':
                            await prisma.user.update({
                                where: { id: userId },
                                data: { status: UserStatus.BANNED },
                            })
                            results.push({ userId, success: true, action: 'deleted' })
                            break

                        case 'changeTier':
                            if (data.params?.tier) {
                                await prisma.user.update({
                                    where: { id: userId },
                                    data: { tier: data.params.tier },
                                })
                                results.push({ userId, success: true, action: `tier changed to ${data.params.tier}` })
                            }
                            break
                    }
                } catch (error) {
                    results.push({ userId, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
                }
            }

            logger.info(`Bulk action ${data.action} executed by admin ${adminUserId} on ${data.userIds.length} users`)

            return { results }
        } catch (error) {
            logger.error('Bulk action error:', error)
            throw error
        }
    }

    // Get user statistics
    static async getUserStats() {
        try {
            const [
                totalUsers,
                activeUsers,
                suspendedUsers,
                bannedUsers,
                usersByTier,
                recentSignups,
            ] = await Promise.all([
                prisma.user.count(),
                prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
                prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
                prisma.user.count({ where: { status: UserStatus.BANNED } }),
                prisma.user.groupBy({
                    by: ['tier'],
                    _count: true,
                }),
                prisma.user.count({
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                        },
                    },
                }),
            ])

            return {
                totalUsers,
                activeUsers,
                suspendedUsers,
                bannedUsers,
                usersByTier: usersByTier.reduce((acc, item) => {
                    acc[item.tier] = item._count
                    return acc
                }, {} as Record<string, number>),
                recentSignups,
            }
        } catch (error) {
            logger.error('Get user stats error:', error)
            throw error
        }
    }

    // Helper methods
    private static generateTempPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
        let password = ''
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return password
    }

    private static async sendInviteEmail(data: InviteEmailData) {
        // Implement email sending
        logger.info(`Invite email sent to ${data.email}`)
    }

    private static async sendPasswordResetEmail(userId: string, tempPassword: string) {
        // Implement password reset email
        logger.info(`Password reset email sent for user ${userId}`)
    }
}
