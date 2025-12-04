/**
 * Script to manually fix a payment that was successful on NOWPayments
 * but wasn't recorded in our database or didn't upgrade the user
 * 
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/manual-payment-fix.ts \
 *     --orderId "volspike-..." \
 *     --paymentId "5804360523" \
 *     --email "user@example.com"
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set!')
  process.exit(1)
}

const prisma = new PrismaClient()

async function manualPaymentFix() {
  try {
    const args = process.argv.slice(2)
    const orderIdArg = args.find(arg => arg.startsWith('--orderId='))?.split('=')[1]
    const paymentIdArg = args.find(arg => arg.startsWith('--paymentId='))?.split('=')[1]
    const emailArg = args.find(arg => arg.startsWith('--email='))?.split('=')[1]

    if (!orderIdArg && !paymentIdArg && !emailArg) {
      console.error('❌ ERROR: Must provide at least one of: --orderId, --paymentId, or --email')
      console.log('\nUsage:')
      console.log('  npx tsx scripts/manual-payment-fix.ts --orderId "volspike-..." --paymentId "5804360523" --email "user@example.com"')
      process.exit(1)
    }

    console.log('\n=== MANUAL PAYMENT FIX ===\n')

    // Find user
    let user = null
    if (emailArg) {
      user = await prisma.user.findFirst({
        where: {
          email: {
            equals: emailArg,
            mode: 'insensitive'
          }
        }
      })
      if (!user) {
        console.error(`❌ User not found: ${emailArg}`)
        process.exit(1)
      }
      console.log(`✅ User found: ${user.email} (ID: ${user.id})`)
      console.log(`   Current tier: ${user.tier}\n`)
    }

    // Find payment by orderId or paymentId
    let payment = null
    if (orderIdArg) {
      payment = await prisma.cryptoPayment.findFirst({
        where: { orderId: orderIdArg },
        include: { user: true }
      })
      if (payment) {
        console.log(`✅ Payment found by Order ID: ${orderIdArg}`)
        user = payment.user
      }
    }

    if (!payment && paymentIdArg) {
      payment = await prisma.cryptoPayment.findUnique({
        where: { paymentId: paymentIdArg },
        include: { user: true }
      })
      if (payment) {
        console.log(`✅ Payment found by Payment ID: ${paymentIdArg}`)
        user = payment.user
      }
    }

    if (!payment && user) {
      // Try to find any payment for this user
      payment = await prisma.cryptoPayment.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { user: true }
      })
    }

    if (!user) {
      console.error('❌ Cannot find user. Please provide --email')
      process.exit(1)
    }

    console.log(`\n📊 Payment Status:`)
    if (payment) {
      console.log(`   Payment ID: ${payment.paymentId || 'NOT SET'}`)
      console.log(`   Order ID: ${payment.orderId}`)
      console.log(`   Invoice ID: ${payment.invoiceId}`)
      console.log(`   Status: ${payment.paymentStatus || 'UNKNOWN'}`)
      console.log(`   Tier: ${payment.tier}`)
      console.log(`   Amount: $${payment.payAmount || 'N/A'}`)
      console.log(`   Created: ${payment.createdAt.toLocaleString()}`)
      
      if (payment.paymentStatus === 'finished' && payment.user.tier !== payment.tier) {
        console.log(`\n⚠️  ISSUE DETECTED: Payment is finished but user tier is ${payment.user.tier}, not ${payment.tier}!`)
        console.log(`\n🔧 Fixing tier mismatch...`)
        
        await prisma.user.update({
          where: { id: payment.userId },
          data: { tier: payment.tier }
        })

        console.log(`✅ User tier updated: ${payment.user.tier} → ${payment.tier}`)
      } else if (payment.paymentStatus !== 'finished') {
        console.log(`\n⚠️  Payment status is "${payment.paymentStatus}", not "finished"`)
        console.log(`   Updating payment status to "finished"...`)
        
        await prisma.cryptoPayment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: 'finished',
            paymentId: paymentIdArg || payment.paymentId,
            paidAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          }
        })

        await prisma.user.update({
          where: { id: payment.userId },
          data: { tier: payment.tier }
        })

        console.log(`✅ Payment status updated and user upgraded to ${payment.tier}`)
      } else {
        console.log(`\n✅ Payment and user tier are correct!`)
      }
    } else {
      console.log(`\n⚠️  Payment not found in database`)
      console.log(`   Order ID from NOWPayments: ${orderIdArg || 'NOT PROVIDED'}`)
      console.log(`   Payment ID from NOWPayments: ${paymentIdArg || 'NOT PROVIDED'}`)
      console.log(`\n💡 This payment was successful on NOWPayments but never recorded in our database.`)
      console.log(`   The webhook likely failed or was never received.`)
      console.log(`\n🔧 Creating payment record and upgrading user...`)
      
      // Extract user ID from order ID if possible
      // Format: volspike-{userId}-{timestamp}
      let userId = user.id
      if (orderIdArg && orderIdArg.startsWith('volspike-')) {
        const parts = orderIdArg.split('-')
        if (parts.length >= 2) {
          const potentialUserId = parts.slice(1, -1).join('-') // Everything between 'volspike' and timestamp
          const foundUser = await prisma.user.findUnique({
            where: { id: potentialUserId }
          })
          if (foundUser) {
            userId = foundUser.id
            user = foundUser
            console.log(`   Found user from Order ID: ${foundUser.email}`)
          }
        }
      }

      // Determine tier from amount (9 USD = Pro, 49 USD = Elite)
      const tier = 'pro' // Based on $9 payment

      // Create payment record
      const newPayment = await prisma.cryptoPayment.create({
        data: {
          userId: userId,
          paymentId: paymentIdArg || null,
          paymentStatus: 'finished',
          payAmount: 9.0,
          payCurrency: 'usd',
          actuallyPaid: 8.948479, // From NOWPayments dashboard
          actuallyPaidCurrency: 'USDC',
          tier: tier,
          invoiceId: `manual-${Date.now()}`, // Generate a unique invoice ID
          orderId: orderIdArg || `manual-${Date.now()}`,
          paymentUrl: `https://nowpayments.io/payment/?iid=${paymentIdArg || 'manual'}`,
          paidAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        include: { user: true }
      })

      console.log(`✅ Payment record created:`)
      console.log(`   Payment ID: ${newPayment.id}`)
      console.log(`   Order ID: ${newPayment.orderId}`)
      console.log(`   Status: ${newPayment.paymentStatus}`)
      console.log(`   Tier: ${newPayment.tier}`)

      // Upgrade user
      const previousTier = user.tier
      await prisma.user.update({
        where: { id: userId },
        data: { tier: tier }
      })

      console.log(`\n✅ User upgraded:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Tier: ${previousTier} → ${tier}`)
      console.log(`   Expires: ${newPayment.expiresAt?.toLocaleString()}`)
    }

    console.log(`\n✅ Manual payment fix completed!\n`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

manualPaymentFix()

