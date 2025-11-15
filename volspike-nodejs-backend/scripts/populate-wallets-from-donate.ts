/**
 * Script to populate admin wallets from the Donate page
 * Run with: npx tsx scripts/populate-wallets-from-donate.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Wallet addresses from the Donate page
const wallets = [
    {
        address: 'bc1q69rs0qplxwzq0v4rtycn3lklzddz9g29g3n0lv',
        currency: 'BTC',
        network: null,
        label: 'Bitcoin Wallet',
    },
    {
        address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
        currency: 'ETH',
        network: null,
        label: 'Ethereum Wallet',
    },
    {
        address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
        currency: 'USDC',
        network: 'Ethereum',
        label: 'USDC on Ethereum',
    },
    {
        address: '0xE66b0a890c3DB2b1E864E5D3367d38Bd9AC014E9',
        currency: 'USDT',
        network: 'Ethereum',
        label: 'USDT on Ethereum',
    },
    {
        address: 'DWDTRqQ2zJn6becjTypRwSAVBqoGEh7v7PoAjvwiJ2PS',
        currency: 'SOL',
        network: null,
        label: 'Solana Wallet',
    },
    {
        address: 'DWDTRqQ2zJn6becjTypRwSAVBqoGEh7v7PoAjvwiJ2PS',
        currency: 'USDT',
        network: 'Solana',
        label: 'USDT on Solana',
    },
]

async function main() {
    console.log('🚀 Populating admin wallets from Donate page...\n')

    for (const wallet of wallets) {
        try {
            // Check if wallet already exists
            const existing = await prisma.adminWallet.findUnique({
                where: {
                    address_currency: {
                        address: wallet.address,
                        currency: wallet.currency,
                    },
                },
            })

            if (existing) {
                console.log(`⏭️  Skipping ${wallet.currency} - already exists`)
                continue
            }

            // Create wallet
            const created = await prisma.adminWallet.create({
                data: {
                    address: wallet.address,
                    currency: wallet.currency,
                    network: wallet.network,
                    label: wallet.label,
                },
            })

            console.log(`✅ Created ${wallet.currency} wallet: ${wallet.label}`)
            console.log(`   Address: ${wallet.address}\n`)
        } catch (error: any) {
            if (error.code === 'P2002') {
                console.log(`⏭️  Skipping ${wallet.currency} - duplicate entry\n`)
            } else {
                console.error(`❌ Error creating ${wallet.currency} wallet:`, error.message)
            }
        }
    }

    console.log('✨ Done! Wallets populated successfully.')
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

