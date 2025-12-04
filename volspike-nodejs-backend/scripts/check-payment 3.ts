/**
 * Script to check payment status for a user or transaction
 * 
 * Usage:
 *   Check by email: DATABASE_URL="..." npx tsx scripts/check-payment.ts --email maxonicon@gmail.com
 *   Check by transaction: DATABASE_URL="..." npx tsx scripts/check-payment.ts --transaction 5804360523
 *   Check by orderId: DATABASE_URL="..." npx tsx scripts/check-payment.ts --orderId "volspike-..."
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set!')
    process.exit(1)
}

const prisma = new PrismaClient()

async function checkPayment() {
    try {
        const args = process.argv.slice(2)
        const emailArg = args.find(arg => arg.startsWith('--email='))?.split('=')[1]
        const transactionArg = args.find(arg => arg.startsWith('--transaction='))?.split('=')[1]
        const orderIdArg = args.find(arg => arg.startsWith('--orderId='))?.split('=')[1]
        const paymentIdArg = args.find(arg => arg.startsWith('--paymentId='))?.split('=')[1]
        const invoiceIdArg = args.find(arg => arg.startsWith('--invoiceId='))?.split('=')[1]

        console.log('\n=== PAYMENT INVESTIGATION ===\n')

        let payments = []
        let user = null

        // Find by email
        if (emailArg) {
            console.log(`🔍 Searching for payments by email: ${emailArg}\n`)
            user = await prisma.user.findFirst({
                where: {
                    email: {
                        equals: emailArg,
                        mode: 'insensitive'
                    }
                },
                include: {
                    cryptoPayments: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            })

            if (user) {
                payments = user.cryptoPayments
                console.log(`✅ User found: ${user.email}`)
                console.log(`   User ID: ${user.id}`)
                console.log(`   Current Tier: ${user.tier}`)
                console.log(`   Created: ${user.createdAt.toLocaleString()}\n`)
            } else {
                console.log(`❌ User not found: ${emailArg}\n`)
            }
        }

        // Find by transaction ID (payment_id, order_id, or invoice_id)
        if (transactionArg || paymentIdArg || invoiceIdArg || orderIdArg) {
            const searchId = transactionArg || paymentIdArg || invoiceIdArg || orderIdArg
            console.log(`🔍 Searching for payment by ID: ${searchId}\n`)

            // Try payment_id first
            let payment = await prisma.cryptoPayment.findUnique({
                where: { paymentId: searchId },
                include: { user: true }
            })

            // Try invoice_id
            if (!payment) {
                payment = await prisma.cryptoPayment.findUnique({
                    where: { invoiceId: searchId },
                    include: { user: true }
                })
            }

            // Try order_id
            if (!payment) {
                payment = await prisma.cryptoPayment.findFirst({
                    where: { orderId: searchId },
                    include: { user: true }
                })
            }

            if (payment) {
                payments = [payment]
                user = payment.user
                console.log(`✅ Payment found!\n`)
            } else {
                console.log(`❌ Payment not found in database: ${searchId}\n`)
                console.log('💡 This could mean:')
                console.log('   - Webhook was never received')
                console.log('   - Payment was created but webhook failed')
                console.log('   - Transaction ID format is different\n')
            }
        }

        if (payments.length === 0) {
            console.log('❌ No payments found. Checking all recent payments...\n')
            payments = await prisma.cryptoPayment.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            })
        }

        if (payments.length === 0) {
            console.log('❌ No payments found in database at all.\n')
            return
        }

        console.log(`\n📊 Found ${payments.length} payment(s):\n`)

        payments.forEach((payment, index) => {
            console.log(`${index + 1}. Payment ID: ${payment.id}`)
            console.log(`   User: ${payment.user.email} (${payment.user.id})`)
            console.log(`   User Tier: ${payment.user.tier}`)
            console.log(`   Payment Status: ${payment.paymentStatus || 'UNKNOWN'}`)
            console.log(`   Tier Purchased: ${payment.tier}`)
            console.log(`   Amount: $${payment.payAmount || 'N/A'} ${payment.payCurrency || 'USD'}`)
            console.log(`   Actually Paid: ${payment.actuallyPaid || 'N/A'} ${payment.actuallyPaidCurrency || 'N/A'}`)
            console.log(`   Payment ID: ${payment.paymentId || 'NOT SET'}`)
            console.log(`   Invoice ID: ${payment.invoiceId || 'NOT SET'}`)
            console.log(`   Order ID: ${payment.orderId || 'NOT SET'}`)
            console.log(`   Created: ${payment.createdAt.toLocaleString()}`)
            console.log(`   Updated: ${payment.updatedAt.toLocaleString()}`)
            console.log(`   Paid At: ${payment.paidAt ? payment.paidAt.toLocaleString() : 'NOT PAID'}`)
            console.log(`   Expires At: ${payment.expiresAt ? payment.expiresAt.toLocaleString() : 'NO EXPIRATION'}`)

            // Check if tier matches
            if (payment.paymentStatus === 'finished' && payment.user.tier !== payment.tier) {
                console.log(`   ⚠️  ISSUE: Payment is finished but user tier is ${payment.user.tier}, not ${payment.tier}!`)
            }

            console.log('')
        })

        // Summary
        console.log('\n=== SUMMARY ===\n')
        const finishedPayments = payments.filter(p => p.paymentStatus === 'finished')
        const pendingPayments = payments.filter(p => p.paymentStatus && !['finished', 'failed', 'refunded'].includes(p.paymentStatus))

        console.log(`Total Payments: ${payments.length}`)
        console.log(`Finished: ${finishedPayments.length}`)
        console.log(`Pending: ${pendingPayments.length}`)
        console.log(`Failed/Refunded: ${payments.length - finishedPayments.length - pendingPayments.length}`)

        if (user) {
            console.log(`\nUser Current Tier: ${user.tier}`)
            const expectedTier = finishedPayments.find(p => p.userId === user.id)?.tier
            if (expectedTier && expectedTier !== user.tier) {
                console.log(`⚠️  MISMATCH: User should be ${expectedTier} but is ${user.tier}`)
            }
        }

    } catch (error) {
        console.error('Error checking payment:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkPayment()

