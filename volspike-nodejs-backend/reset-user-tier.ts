import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Use production DATABASE_URL if provided, otherwise use .env
const databaseUrl = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL

if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set. Please provide production DATABASE_URL')
    console.log('\nUsage:')
    console.log('  DATABASE_URL="postgresql://..." npx tsx reset-user-tier.ts')
    console.log('\nOr set PROD_DATABASE_URL in .env file')
    process.exit(1)
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
})

async function resetUserTier() {
    try {
        const email = 'nsitnikov1@gmail.com'
        
        console.log(`Resetting tier for user: ${email}`)
        
        // First find the user
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, tier: true },
        })
        
        if (!existingUser) {
            console.error(`❌ User not found: ${email}`)
            process.exit(1)
        }
        
        console.log(`Found user: ${existingUser.email} (ID: ${existingUser.id}, Current tier: ${existingUser.tier})`)
        
        // Update tier to free
        const user = await prisma.user.update({
            where: { email },
            data: { tier: 'free' },
        })
        
        console.log(`✅ User tier reset to 'free'`)
        console.log(`User ID: ${user.id}`)
        console.log(`Email: ${user.email}`)
        console.log(`Tier: ${user.tier} (was: ${existingUser.tier})`)
        
    } catch (error) {
        console.error('Error resetting tier:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

resetUserTier()
