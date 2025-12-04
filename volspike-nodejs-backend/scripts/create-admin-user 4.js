import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function createAdminUser() {
    try {
        // Generate a unique ID
        const adminId = randomBytes(16).toString('hex')

        // You can change this email to your preferred admin email
        const adminEmail = 'admin@volspike.com'

        // Generate a temporary password (you'll change this after first login)
        const tempPassword = 'Admin123!@#'
        const hashedPassword = await bcrypt.hash(tempPassword, 12)

        // Create the admin user
        const adminUser = await prisma.user.create({
            data: {
                id: adminId,
                email: adminEmail,
                emailVerified: new Date(),
                role: 'ADMIN',
                status: 'ACTIVE',
                tier: 'elite',
                twoFactorEnabled: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        })

        console.log('✅ Admin user created successfully!')
        console.log('📧 Email:', adminEmail)
        console.log('🔑 Temporary Password:', tempPassword)
        console.log('🆔 User ID:', adminId)
        console.log('')
        console.log('⚠️  IMPORTANT: Change the password after first login!')
        console.log('⚠️  IMPORTANT: Enable 2FA for security!')

    } catch (error) {
        console.error('❌ Error creating admin user:', error)
    } finally {
        await prisma.$disconnect()
    }
}

createAdminUser()
