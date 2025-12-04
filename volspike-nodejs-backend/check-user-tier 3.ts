import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

// Use production DATABASE_URL if provided, otherwise use .env
const databaseUrl = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL

if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set. Please provide production DATABASE_URL')
    console.log('\nUsage:')
    console.log('  DATABASE_URL="postgresql://..." npx tsx check-user-tier.ts')
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

async function checkUserTier() {
    try {
        const email = 'nsitnikov1@gmail.com'
        const user = await prisma.user.findUnique({
            where: { email },
            select: { 
                id: true, 
                email: true, 
                tier: true,
                stripeCustomerId: true,
            },
        })
        
        if (!user) {
            console.error(`❌ User not found: ${email}`)
            process.exit(1)
        }
        
        console.log(`✅ User found:`)
        console.log(`   Email: ${user.email}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Tier: ${user.tier}`)
        console.log(`   Stripe Customer ID: ${user.stripeCustomerId || 'None'}`)
        
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

checkUserTier()

