import { PrismaClient } from '@prisma/client'
import { NowPaymentsService } from '../src/services/nowpayments'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is required')
    console.error('   Please set it before running this script:')
    console.error('   export DATABASE_URL="postgresql://..."')
    process.exit(1)
}

const prisma = new PrismaClient()

/**
 * Fix all payments with invalid currency codes (missing network identifiers)
 * Invalid codes: 'usdt', 'usdc' (without network)
 * Valid codes: 'usdtsol', 'usdterc20', 'usdce', etc.
 */
async function fixAllInvalidCurrencies() {
    try {
        console.log('\n🔍 Scanning database for payments with invalid currency codes...\n')

        // Find all payments with invalid currency codes
        const invalidPayments = await prisma.cryptoPayment.findMany({
            where: {
                OR: [
                    { actuallyPaidCurrency: 'usdt' },
                    { actuallyPaidCurrency: 'USDT' },
                    { actuallyPaidCurrency: 'usdc' },
                    { actuallyPaidCurrency: 'USDC' },
                ],
                paymentStatus: {
                    in: ['finished', 'confirmed'],
                },
            },
            include: {
                user: {
                    select: {
                        email: true,
                        id: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        console.log(`📊 Found ${invalidPayments.length} payment(s) with invalid currency codes\n`)

        if (invalidPayments.length === 0) {
            console.log('✅ No invalid currency codes found - all payments are correct!')
            return
        }

        const nowpayments = process.env.NOWPAYMENTS_API_KEY 
            ? NowPaymentsService.getInstance() 
            : null

        if (!nowpayments) {
            console.log('⚠️  NOWPAYMENTS_API_KEY not set - will only infer from payment addresses\n')
        }

        let fixedCount = 0
        let skippedCount = 0
        let errorCount = 0

        for (const payment of invalidPayments) {
            try {
                const currentCurrency = payment.actuallyPaidCurrency?.toLowerCase() || ''
                const userEmail = payment.user?.email || 'Unknown'
                
                console.log(`\n📋 Processing payment:`)
                console.log(`   User: ${userEmail}`)
                console.log(`   Payment ID: ${payment.paymentId || 'N/A'}`)
                console.log(`   Order ID: ${payment.orderId}`)
                console.log(`   Current Currency: ${currentCurrency}`)
                console.log(`   Pay Address: ${payment.payAddress || 'N/A'}`)

                let inferredCurrency: string | null = null

                // Method 1: Infer from payment address
                if (payment.payAddress) {
                    const address = payment.payAddress.toLowerCase()
                    if (address.startsWith('0x')) {
                        // Ethereum address
                        if (currentCurrency === 'usdt') {
                            inferredCurrency = 'usdterc20'
                            console.log(`   🔍 Network detected: Ethereum (0x prefix) → ${inferredCurrency}`)
                        } else if (currentCurrency === 'usdc') {
                            inferredCurrency = 'usdce'
                            console.log(`   🔍 Network detected: Ethereum (0x prefix) → ${inferredCurrency}`)
                        }
                    } else if (address.length > 30 && !address.startsWith('0x')) {
                        // Likely Solana address (base58, longer than Ethereum)
                        if (currentCurrency === 'usdt') {
                            inferredCurrency = 'usdtsol'
                            console.log(`   🔍 Network detected: Solana (long base58) → ${inferredCurrency}`)
                        }
                    }
                }

                // Method 2: Query NowPayments API if paymentId exists
                let apiCurrency: string | null = null
                if (payment.paymentId && nowpayments) {
                    try {
                        console.log(`   🔌 Querying NowPayments API...`)
                        const paymentStatus = await nowpayments.getPaymentStatus(payment.paymentId)
                        apiCurrency = paymentStatus.pay_currency?.toLowerCase() || null
                        
                        if (apiCurrency) {
                            console.log(`   ✅ API returned: ${apiCurrency}`)
                            
                            // Map NowPayments formats to our internal formats
                            const currencyMap: Record<string, string> = {
                                'usdt': 'usdterc20', // Default to Ethereum
                                'usdt-erc20': 'usdterc20',
                                'usdt_erc20': 'usdterc20',
                                'usdterc20': 'usdterc20',
                                'usdt-eth': 'usdterc20',
                                'usdt_eth': 'usdterc20',
                                'usdt-sol': 'usdtsol',
                                'usdt_sol': 'usdtsol',
                                'usdtsol': 'usdtsol',
                                'usdc': 'usdce',
                                'usdc-erc20': 'usdce',
                                'usdc_erc20': 'usdce',
                                'usdcerc20': 'usdce',
                                'usdc-eth': 'usdce',
                                'usdc_eth': 'usdce',
                                'usdce': 'usdce',
                                'usdceerc20': 'usdce',
                            }
                            
                            apiCurrency = currencyMap[apiCurrency] || apiCurrency
                            
                            // Prefer API result if it's more specific than inferred
                            if (!inferredCurrency || (apiCurrency.includes('erc20') || apiCurrency.includes('sol'))) {
                                inferredCurrency = apiCurrency
                                console.log(`   ✅ Using API currency: ${inferredCurrency}`)
                            }
                        }
                    } catch (error: any) {
                        console.log(`   ⚠️  API query failed: ${error.message}`)
                        // Continue with address-based inference
                    }
                }

                // Determine final currency
                if (!inferredCurrency) {
                    console.log(`   ⚠️  Cannot determine network - skipping`)
                    console.log(`   💡 Manual fix needed: Check payment address or transaction hash`)
                    skippedCount++
                    continue
                }

                // Check if update is needed
                if (currentCurrency === inferredCurrency) {
                    console.log(`   ✅ Currency already correct - skipping`)
                    skippedCount++
                    continue
                }

                // Update payment record
                console.log(`   💾 Updating: ${currentCurrency} → ${inferredCurrency}`)
                
                await prisma.cryptoPayment.update({
                    where: { id: payment.id },
                    data: {
                        actuallyPaidCurrency: inferredCurrency,
                    },
                })

                const displayMap: Record<string, string> = {
                    'usdterc20': 'USDT on ETH',
                    'usdtsol': 'USDT on SOL',
                    'usdce': 'USDC on ETH',
                }
                const displayName = displayMap[inferredCurrency] || inferredCurrency.toUpperCase()
                
                console.log(`   ✅ Fixed! Admin panel will show: "CRYPTO (${displayName})"`)
                fixedCount++

            } catch (error: any) {
                console.error(`   ❌ Error processing payment ${payment.id}:`, error.message)
                errorCount++
            }
        }

        // Summary
        console.log(`\n\n📊 Summary:`)
        console.log(`   Total invalid payments found: ${invalidPayments.length}`)
        console.log(`   ✅ Fixed: ${fixedCount}`)
        console.log(`   ⏭️  Skipped: ${skippedCount}`)
        console.log(`   ❌ Errors: ${errorCount}`)

        if (fixedCount > 0) {
            console.log(`\n✅ Successfully fixed ${fixedCount} payment(s)!`)
        }

        if (skippedCount > 0) {
            console.log(`\n⚠️  ${skippedCount} payment(s) could not be auto-fixed (need manual review)`)
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message)
        if (error.stack) {
            console.error(error.stack)
        }
    } finally {
        await prisma.$disconnect()
    }
}

fixAllInvalidCurrencies()

