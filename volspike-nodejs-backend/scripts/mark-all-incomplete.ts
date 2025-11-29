/**
 * Migration script: Mark all existing assets as incomplete (isComplete = false)
 * This ensures admin must manually review and mark assets as Complete before
 * they enter weekly refresh cycles.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔄 Marking all assets as incomplete...')
    
    const result = await prisma.asset.updateMany({
        data: {
            isComplete: false,
        },
    })
    
    console.log(`✅ Updated ${result.count} assets to incomplete status`)
    console.log('📝 Admin must now review and mark assets as Complete manually')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

