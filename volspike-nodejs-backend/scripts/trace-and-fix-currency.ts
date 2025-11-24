import { PrismaClient } from '@prisma/client'
import { NowPaymentsService } from '../src/services/nowpayments'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is required')
    console.error('   Please set it before running this script:')
    console.error('   export DATABASE_URL="postgresql://..."')
    console.error('   Or create a .env file with DATABASE_URL')
    process.exit(1)
}

const prisma = new PrismaClient()

/**
 * Trace a payment transaction and fix the currency identifier
 * This script:
 * 1. Finds the payment record for a user
 * 2. Queries NowPayments API to get the actual pay_currency
 * 3. Updates the database with the correct currency code (including network identifier)
 */
async function traceAndFixCurrency() {
    try {
        const userEmail = 'melnikovkk@gmail.com'
        
        console.log('\n🔍 Tracing payment transaction and fixing currency identifier...\n')
        console.log(`User Email: ${userEmail}\n`)

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
                cryptoPayments: {
                    where: {
                        paymentStatus: {
                            in: ['finished', 'confirmed'],
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 5, // Get recent payments
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
        console.log(`   Found ${user.cryptoPayments.length} completed payment(s)\n`)

        if (user.cryptoPayments.length === 0) {
            console.log('❌ No completed payments found for this user')
            return
        }

        // Get the most recent active payment (the one with expiresAt)
        const activePayment = user.cryptoPayments.find(p => p.expiresAt !== null) || user.cryptoPayments[0]
        
            console.log(`📋 Analyzing payment:`)
            console.log(`   Payment ID: ${activePayment.paymentId || 'N/A'}`)
            console.log(`   Order ID: ${activePayment.orderId}`)
            console.log(`   Current Currency: ${activePayment.actuallyPaidCurrency || 'N/A'}`)
            console.log(`   Pay Address: ${activePayment.payAddress || 'N/A'}`)
            console.log(`   Status: ${activePayment.paymentStatus}`)
            console.log(`   Expires: ${activePayment.expiresAt || 'N/A'}\n`)

            // Try to determine network from payment address
            let inferredCurrency: string | null = null
            if (activePayment.payAddress) {
                const address = activePayment.payAddress.toLowerCase()
                if (address.startsWith('0x')) {
                    // Ethereum address
                    if (activePayment.actuallyPaidCurrency?.toLowerCase() === 'usdt') {
                        inferredCurrency = 'usdterc20'
                        console.log('🔍 Network detected from address: Ethereum (0x prefix)')
                        console.log(`   Inferred currency: ${inferredCurrency} (USDT on ETH)\n`)
                    } else if (activePayment.actuallyPaidCurrency?.toLowerCase() === 'usdc') {
                        inferredCurrency = 'usdce'
                        console.log('🔍 Network detected from address: Ethereum (0x prefix)')
                        console.log(`   Inferred currency: ${inferredCurrency} (USDC on ETH)\n`)
                    }
                } else if (address.length > 30 && !address.startsWith('0x')) {
                    // Likely Solana address (base58, longer than Ethereum addresses)
                    if (activePayment.actuallyPaidCurrency?.toLowerCase() === 'usdt') {
                        inferredCurrency = 'usdtsol'
                        console.log('🔍 Network detected from address: Solana (long base58 address)')
                        console.log(`   Inferred currency: ${inferredCurrency} (USDT on SOL)\n`)
                    }
                }
            }

        // If we inferred currency from address and payment ID is missing, use inferred value
        if (!activePayment.paymentId && inferredCurrency) {
            console.log('⚠️  Payment ID is missing - cannot query NowPayments API')
            console.log('   Using network inferred from payment address\n')
            
            const currentCurrency = activePayment.actuallyPaidCurrency?.toLowerCase()
            if (currentCurrency !== inferredCurrency) {
                console.log('💾 Updating payment record with inferred currency...\n')
                
                const updated = await prisma.cryptoPayment.update({
                    where: { id: activePayment.id },
                    data: {
                        actuallyPaidCurrency: inferredCurrency,
                    },
                })

                console.log('✅ Payment updated successfully!')
                console.log(`   Old Currency: ${currentCurrency || 'N/A'}`)
                console.log(`   New Currency: ${inferredCurrency}`)
                
                const displayMap: Record<string, string> = {
                    'usdterc20': 'USDT on ETH',
                    'usdtsol': 'USDT on SOL',
                    'usdce': 'USDC on ETH',
                }
                const displayName = displayMap[inferredCurrency] || inferredCurrency.toUpperCase()
                console.log(`📊 Admin Panel will now show: "CRYPTO (${displayName})"\n`)
            } else {
                console.log('✅ Currency is already correct - no update needed\n')
            }
            return
        }

        if (!activePayment.paymentId) {
            console.log('⚠️  Payment ID is missing - cannot query NowPayments API')
            console.log('   This payment may have been created manually or via invoice flow')
            console.log(`   Current currency: ${activePayment.actuallyPaidCurrency}`)
            if (!inferredCurrency) {
                console.log('\n💡 Recommendation:')
                if (activePayment.actuallyPaidCurrency === 'usdt' || activePayment.actuallyPaidCurrency === 'USDT') {
                    console.log('   Currency is "usdt" without network identifier.')
                    console.log('   You need to determine which network was used:')
                    console.log('   - If Ethereum: should be "usdterc20"')
                    console.log('   - If Solana: should be "usdtsol"')
                    console.log('   Check the payment address or transaction hash to determine network.')
                }
            }
            return
        }

        // Query NowPayments API to get actual payment details
        console.log('🔌 Querying NowPayments API...\n')
        
        try {
            const nowpayments = NowPaymentsService.getInstance()
            const paymentStatus = await nowpayments.getPaymentStatus(activePayment.paymentId)

            console.log('✅ Payment details from NowPayments API:')
            console.log(`   Payment ID: ${paymentStatus.payment_id}`)
            console.log(`   Status: ${paymentStatus.payment_status}`)
            console.log(`   Pay Currency: ${paymentStatus.pay_currency}`)
            console.log(`   Pay Amount: ${paymentStatus.pay_amount}`)
            console.log(`   Actually Paid: ${paymentStatus.actually_paid || 'N/A'}`)
            console.log(`   Pay Address: ${paymentStatus.pay_address || 'N/A'}\n`)

            const actualCurrency = paymentStatus.pay_currency?.toLowerCase() || null

            if (!actualCurrency) {
                console.log('⚠️  NowPayments API did not return pay_currency')
                return
            }

            // Normalize the currency code to our format
            let normalizedCurrency = actualCurrency

            // Map NowPayments formats to our internal formats
            const currencyMap: Record<string, string> = {
                // USDT variants
                'usdt': 'usdterc20', // Default to Ethereum if just "usdt"
                'usdt-erc20': 'usdterc20',
                'usdt_erc20': 'usdterc20',
                'usdterc20': 'usdterc20',
                'usdt-eth': 'usdterc20',
                'usdt_eth': 'usdterc20',
                'usdt-sol': 'usdtsol',
                'usdt_sol': 'usdtsol',
                'usdtsol': 'usdtsol',
                // USDC variants
                'usdc': 'usdce', // Default to Ethereum if just "usdc"
                'usdc-erc20': 'usdce',
                'usdc_erc20': 'usdce',
                'usdcerc20': 'usdce',
                'usdc-eth': 'usdce',
                'usdc_eth': 'usdce',
                'usdce': 'usdce',
                'usdceerc20': 'usdce',
                // Native tokens
                'sol': 'sol',
                'eth': 'eth',
                'btc': 'btc',
            }

            normalizedCurrency = currencyMap[actualCurrency] || actualCurrency

            console.log(`📝 Currency mapping:`)
            console.log(`   From NowPayments: "${actualCurrency}"`)
            console.log(`   Normalized to: "${normalizedCurrency}"\n`)

            // Check if update is needed
            const currentCurrency = activePayment.actuallyPaidCurrency?.toLowerCase()
            
            // If we inferred currency from address and it matches API, prefer inferred (more reliable)
            if (inferredCurrency && normalizedCurrency !== inferredCurrency) {
                console.log('⚠️  Mismatch detected:')
                console.log(`   API says: "${normalizedCurrency}"`)
                console.log(`   Address suggests: "${inferredCurrency}"`)
                console.log(`   Using address-based inference (more reliable)\n`)
                normalizedCurrency = inferredCurrency
            }
            
            if (currentCurrency === normalizedCurrency) {
                console.log('✅ Currency is already correct - no update needed')
                return
            }

            // Update the payment record
            console.log('💾 Updating payment record...\n')
            
            const updated = await prisma.cryptoPayment.update({
                where: { id: activePayment.id },
                data: {
                    actuallyPaidCurrency: normalizedCurrency,
                },
            })

            console.log('✅ Payment updated successfully!')
            console.log(`   Old Currency: ${currentCurrency || 'N/A'}`)
            console.log(`   New Currency: ${normalizedCurrency}`)
            console.log(`   Payment ID: ${updated.paymentId}`)
            console.log(`   Order ID: ${updated.orderId}\n`)

            // Display what will be shown in admin panel
            const displayMap: Record<string, string> = {
                'usdterc20': 'USDT on ETH',
                'usdtsol': 'USDT on SOL',
                'usdce': 'USDC on ETH',
                'sol': 'SOL',
                'eth': 'ETH',
                'btc': 'BTC',
            }
            
            const displayName = displayMap[normalizedCurrency] || normalizedCurrency.toUpperCase()
            console.log(`📊 Admin Panel will now show: "CRYPTO (${displayName})"\n`)

        } catch (error: any) {
            console.error('❌ Error querying NowPayments API:', error.message)
            if (error.response) {
                console.error('   Response:', JSON.stringify(error.response.data, null, 2))
            }
            console.log('\n💡 Fallback: Check the payment address to determine network')
            console.log('   Ethereum addresses start with "0x"')
            console.log('   Solana addresses are base58 encoded (longer, no "0x")')
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

traceAndFixCurrency()

