import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UhnuFE0swD7A@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        },
    },
})

async function fixMelnikovkkPayment() {
    try {
        const userEmail = 'melnikovkk@gmail.com'
        const paymentId = '4766670175'
        const orderId = 'volspike-cmhf8l7j000000h0dygr0aen8-1763209926814'
        
        console.log('\n🔧 Fixing melnikovkk payment...\n')
        console.log(`Payment ID: ${paymentId}`)
        console.log(`Order ID: ${orderId}`)
        console.log(`User Email: ${userEmail}\n`)

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
        })

        if (!user) {
            console.log('❌ User not found!')
            return
        }

        console.log(`✅ User found: ${user.email}`)
        console.log(`   User ID: ${user.id}`)
        console.log(`   Current Tier: ${user.tier}`)

        // Check if payment exists
        let payment = await prisma.cryptoPayment.findUnique({
            where: { paymentId },
        })

        if (!payment) {
            // Try to find by order ID (might have slight variation)
            const paymentsByOrder = await prisma.cryptoPayment.findMany({
                where: {
                    userId: user.id,
                    orderId: { contains: '1763209926814' }, // Match by timestamp
                },
                orderBy: { createdAt: 'desc' },
            })

            if (paymentsByOrder.length > 0) {
                payment = paymentsByOrder[0]
                console.log(`\n⚠️  Found payment by order ID timestamp: ${payment.orderId}`)
            }
        }

        // Calculate expiration date (30 days from payment completion)
        // Payment was completed on Nov 15, 2025 at 07:35 AM
        const paidAt = new Date('2025-11-15T07:35:00Z')
        const expiresAt = new Date(paidAt)
        expiresAt.setDate(expiresAt.getDate() + 30)

        if (payment) {
            console.log(`\n✅ Payment found in database`)
            console.log(`   Payment ID: ${payment.id}`)
            console.log(`   Status: ${payment.paymentStatus}`)
            console.log(`   Tier: ${payment.tier}`)
            
            // Update payment
            const updated = await prisma.cryptoPayment.update({
                where: { id: payment.id },
                data: {
                    paymentId,
                    paymentStatus: 'finished',
                    payAmount: 9.0,
                    payCurrency: 'usd',
                    actuallyPaid: 8.980783,
                    actuallyPaidCurrency: 'usdt',
                    tier: 'pro',
                    expiresAt,
                    paidAt,
                },
            })

            console.log(`\n✅ Payment updated:`)
            console.log(`   Status: ${updated.paymentStatus}`)
            console.log(`   Expires: ${updated.expiresAt}`)
        } else {
            console.log(`\n⚠️  Payment not found, creating new record...`)
            
            // Create payment record
            payment = await prisma.cryptoPayment.create({
                data: {
                    userId: user.id,
                    paymentId,
                    paymentStatus: 'finished',
                    payAmount: 9.0,
                    payCurrency: 'usd',
                    actuallyPaid: 8.980783,
                    actuallyPaidCurrency: 'usdt',
                    tier: 'pro',
                    invoiceId: `manual-fix-${Date.now()}`,
                    orderId,
                    paymentUrl: `https://nowpayments.io/payment/?iid=${paymentId}`,
                    expiresAt,
                    paidAt,
                },
            })

            console.log(`✅ Payment record created`)
        }

        // Ensure user is on Pro tier
        if (user.tier !== 'pro') {
            console.log(`\n⚠️  User tier is ${user.tier}, upgrading to pro...`)
            await prisma.user.update({
                where: { id: user.id },
                data: { tier: 'pro' },
            })
            console.log(`✅ User upgraded to pro`)
        } else {
            console.log(`\n✅ User already on pro tier`)
        }

        // Verify final state
        const finalUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                cryptoPayments: {
                    where: { paymentId },
                },
            },
        })

        console.log(`\n📊 Final State:`)
        console.log(`   User Tier: ${finalUser?.tier}`)
        if (finalUser?.cryptoPayments[0]) {
            const finalPayment = finalUser.cryptoPayments[0]
            console.log(`   Payment Status: ${finalPayment.paymentStatus}`)
            console.log(`   Payment Expires: ${finalPayment.expiresAt}`)
            console.log(`   Payment Amount: $${finalPayment.payAmount} ${finalPayment.payCurrency}`)
        }

        console.log(`\n✅ Fix complete!`)

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

fixMelnikovkkPayment()

