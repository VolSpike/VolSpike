import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UhnuFE0swD7A@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        },
    },
})

async function investigatePayment() {
    try {
        const orderId = 'volspike-cmhf8l7j000000h0dygr0aen8-1763209926814'
        const paymentId = '4766670175'
        const userEmail = 'melnikovkk@gmail.com'

        console.log('\n🔍 Investigating payment issue...\n')
        console.log(`Order ID: ${orderId}`)
        console.log(`Payment ID: ${paymentId}`)
        console.log(`User Email: ${userEmail}\n`)

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
                cryptoPayments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        })

        if (!user) {
            console.log('❌ User not found!')
            return
        }

        console.log(`✅ User found: ${user.email}`)
        console.log(`   User ID: ${user.id}`)
        console.log(`   Current Tier: ${user.tier}`)
        console.log(`   Created: ${user.createdAt}`)
        console.log(`\n📊 Crypto Payments (${user.cryptoPayments.length} total):\n`)

        // Check for payment by order ID
        const paymentByOrderId = await prisma.cryptoPayment.findFirst({
            where: { orderId },
        })

        // Check for payment by payment ID
        const paymentByPaymentId = await prisma.cryptoPayment.findUnique({
            where: { paymentId },
        })

        if (paymentByOrderId) {
            console.log('✅ Payment found by Order ID:')
            console.log(JSON.stringify(paymentByOrderId, null, 2))
        } else {
            console.log('❌ Payment NOT found by Order ID')
        }

        if (paymentByPaymentId) {
            console.log('\n✅ Payment found by Payment ID:')
            console.log(JSON.stringify(paymentByPaymentId, null, 2))
        } else {
            console.log('\n❌ Payment NOT found by Payment ID')
        }

        // List all payments for this user
        console.log(`\n📋 All payments for ${user.email}:`)
        user.cryptoPayments.forEach((payment, index) => {
            console.log(`\n${index + 1}. Payment ID: ${payment.paymentId || 'N/A'}`)
            console.log(`   Order ID: ${payment.orderId || 'N/A'}`)
            console.log(`   Status: ${payment.paymentStatus || 'N/A'}`)
            console.log(`   Tier: ${payment.tier}`)
            console.log(`   Amount: ${payment.payAmount} ${payment.payCurrency || 'USD'}`)
            console.log(`   Created: ${payment.createdAt}`)
            console.log(`   Updated: ${payment.updatedAt}`)
            console.log(`   Expires: ${payment.expiresAt || 'N/A'}`)
        })

        // Check if there are any finished payments that didn't upgrade the user
        const finishedPayments = user.cryptoPayments.filter(
            (p) => p.paymentStatus === 'finished' && p.user.tier !== p.tier
        )

        if (finishedPayments.length > 0) {
            console.log(`\n⚠️  ISSUE DETECTED: ${finishedPayments.length} finished payment(s) where user tier doesn't match:`)
            finishedPayments.forEach((p) => {
                console.log(`   - Payment ${p.id}: Status=${p.paymentStatus}, Payment Tier=${p.tier}, User Tier=${user.tier}`)
            })
        }

    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

investigatePayment()

