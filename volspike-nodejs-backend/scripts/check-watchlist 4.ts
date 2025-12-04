import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function checkWatchlist() {
    try {
        const email = 'colin.paran@gmail.com'
        
        console.log(`\n=== Checking watchlist for ${email} ===\n`)
        
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                watchlists: {
                    include: {
                        items: {
                            include: {
                                contract: {
                                    select: { symbol: true, isActive: true },
                                },
                            },
                        },
                    },
                },
            },
        })
        
        if (!user) {
            console.log(`❌ User not found: ${email}`)
            return
        }
        
        console.log(`✅ User found: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Tier: ${user.tier}`)
        console.log(`   Watchlists count: ${user.watchlists.length}`)
        
        if (user.watchlists.length === 0) {
            console.log(`\n❌ NO WATCHLISTS FOUND!`)
        } else {
            console.log(`\n✅ Watchlists:`)
            user.watchlists.forEach((watchlist, idx) => {
                console.log(`\n   ${idx + 1}. "${watchlist.name}"`)
                console.log(`      ID: ${watchlist.id}`)
                console.log(`      Created: ${watchlist.createdAt}`)
                console.log(`      Items: ${watchlist.items.length}`)
                if (watchlist.items.length > 0) {
                    console.log(`      Symbols:`)
                    watchlist.items.forEach(item => {
                        console.log(`         - ${item.contract.symbol}`)
                    })
                }
            })
        }
        
        // Also check if there are any watchlists at all for this user ID
        const allWatchlists = await prisma.watchlist.findMany({
            where: { userId: user.id },
        })
        
        console.log(`\n=== Direct query result ===`)
        console.log(`Total watchlists for user ID ${user.id}: ${allWatchlists.length}`)
        
    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkWatchlist()

