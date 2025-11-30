/**
 * Script to create a test notification for admin users
 * Usage: DATABASE_URL="..." npx tsx scripts/create-test-notification.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestNotification() {
    try {
        // Find all admin users
        const adminUsers = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
            },
            select: {
                id: true,
                email: true,
            },
        })

        if (adminUsers.length === 0) {
            console.log('❌ No admin users found')
            return
        }

        console.log(`Found ${adminUsers.length} admin user(s):`)
        adminUsers.forEach((user) => {
            console.log(`  - ${user.email} (${user.id})`)
        })

        // Create test notification for all admins
        const notifications = adminUsers.map((user) => ({
            userId: user.id,
            type: 'NEW_ASSET_DETECTED',
            title: 'Test Notification - New Asset Detected',
            message: 'This is a test notification. A new trading pair "TESTUSDT" has been detected and needs admin review.',
            metadata: {
                assetSymbol: 'TEST',
                assetId: 'test-asset-id-123',
            },
            isRead: false,
        }))

        const result = await prisma.adminNotification.createMany({
            data: notifications,
        })

        console.log(`\n✅ Created ${result.count} test notification(s) for admin users`)
        console.log('\nYou can now check the notification bell in the admin panel!')
    } catch (error) {
        console.error('❌ Error creating test notification:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

createTestNotification()

