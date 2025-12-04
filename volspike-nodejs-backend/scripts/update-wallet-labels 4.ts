/**
 * Script to update existing wallet labels to remove "Donation" and redundant info
 * Run with: npx tsx scripts/update-wallet-labels.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Updating wallet labels...\n')

    // Update BTC wallet
    const btcWallet = await prisma.adminWallet.findFirst({
        where: { currency: 'BTC' },
    })
    if (btcWallet && btcWallet.label?.includes('Donation')) {
        await prisma.adminWallet.update({
            where: { id: btcWallet.id },
            data: { label: 'Bitcoin Wallet' },
        })
        console.log(`✅ Updated BTC wallet: Bitcoin Wallet`)
    }

    // Update ETH wallet (native)
    const ethWallet = await prisma.adminWallet.findFirst({
        where: { currency: 'ETH', network: null },
    })
    if (ethWallet) {
        const newLabel = 'Ethereum Wallet'
        await prisma.adminWallet.update({
            where: { id: ethWallet.id },
            data: { label: newLabel },
        })
        console.log(`✅ Updated ETH wallet: ${newLabel}`)
    }

    // Update SOL wallet (native)
    const solWallet = await prisma.adminWallet.findFirst({
        where: { currency: 'SOL', network: null },
    })
    if (solWallet) {
        const newLabel = 'Solana Wallet'
        await prisma.adminWallet.update({
            where: { id: solWallet.id },
            data: { label: newLabel },
        })
        console.log(`✅ Updated SOL wallet: ${newLabel}`)
    }

    console.log('\n✨ Done! Wallet labels updated successfully.')
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

