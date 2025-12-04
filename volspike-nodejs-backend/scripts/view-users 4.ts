/**
 * Script to view all users, registrations, and login activity
 * 
 * Usage:
 *   Production: DATABASE_URL="your-production-url" npx tsx scripts/view-users.ts
 *   Or set DATABASE_URL in .env file
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set!')
  console.error('\nPlease set it using one of these methods:')
  console.error('1. Export it: export DATABASE_URL="your-database-url"')
  console.error('2. Add it to .env file in this directory')
  console.error('3. Pass it inline: DATABASE_URL="your-url" npx tsx scripts/view-users.ts')
  console.error('\nExample:')
  console.error('DATABASE_URL="postgresql://user:pass@host/db" npx tsx scripts/view-users.ts')
  process.exit(1)
}

console.log('📊 Connecting to database...')
console.log(`   Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'Connected'}\n`)

const prisma = new PrismaClient()

async function viewUsers() {
  try {
    console.log('\n=== USER REGISTRATION & ACTIVITY REPORT ===\n')

    // Get all users with their details
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
        walletAccounts: {
          select: {
            provider: true,
            address: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        sessions: {
          select: {
            expires: true,
          },
          orderBy: { expires: 'desc' },
          take: 1, // Most recent session
        },
      },
    })

    console.log(`Total Users: ${users.length}\n`)

    // Group by registration method
    const emailUsers = users.filter((u) => u.passwordHash && !u.email.includes('@volspike.wallet'))
    const oauthUsers = users.filter((u) => u.accounts.length > 0 && !u.passwordHash)
    const walletUsers = users.filter((u) => u.email.includes('@volspike.wallet'))

    console.log('📊 Registration Breakdown:')
    console.log(`  📧 Email/Password: ${emailUsers.length}`)
    console.log(`  🔐 OAuth (Google): ${oauthUsers.length}`)
    console.log(`  💼 Wallet Only: ${walletUsers.length}\n`)

    // Show recent registrations (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentUsers = users.filter((u) => u.createdAt >= sevenDaysAgo)
    console.log(`📅 New Users (Last 7 Days): ${recentUsers.length}\n`)

    // Show users with recent logins
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const activeUsers = users.filter((u) => u.lastLoginAt && u.lastLoginAt >= thirtyDaysAgo)
    console.log(`🟢 Active Users (Last 30 Days): ${activeUsers.length}\n`)

    // Detailed user list
    console.log('\n=== DETAILED USER LIST ===\n')

    users.forEach((user, index) => {
      const registrationMethod =
        user.email.includes('@volspike.wallet')
          ? 'Wallet'
          : user.accounts.length > 0
            ? `OAuth (${user.accounts[0].provider})`
            : 'Email/Password'

      const hasWallet = user.walletAccounts.length > 0
      const walletInfo = hasWallet
        ? user.walletAccounts.map((wa) => `${wa.provider}:${wa.address.slice(0, 10)}...`).join(', ')
        : 'None'

      console.log(`${index + 1}. ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Registration: ${registrationMethod}`)
      console.log(`   Created: ${user.createdAt.toLocaleString()}`)
      console.log(`   Tier: ${user.tier}`)
      console.log(`   Email Verified: ${user.emailVerified ? user.emailVerified.toLocaleString() : 'No'}`)
      console.log(`   Last Login: ${user.lastLoginAt ? user.lastLoginAt.toLocaleString() : 'Never'}`)
      console.log(`   Wallets: ${walletInfo}`)
      console.log(`   Status: ${user.status}`)
      console.log('')
    })

    // Summary statistics
    console.log('\n=== SUMMARY STATISTICS ===\n')
    console.log(`Total Registrations: ${users.length}`)
    console.log(`Email Verified: ${users.filter((u) => u.emailVerified).length}`)
    console.log(`Never Logged In: ${users.filter((u) => !u.lastLoginAt).length}`)
    console.log(`Free Tier: ${users.filter((u) => u.tier === 'free').length}`)
    console.log(`Pro Tier: ${users.filter((u) => u.tier === 'pro').length}`)
    console.log(`Elite Tier: ${users.filter((u) => u.tier === 'elite').length}`)

    // Daily registration chart (last 30 days)
    console.log('\n=== DAILY REGISTRATIONS (Last 30 Days) ===\n')
    const dailyRegistrations: Record<string, number> = {}
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    users
      .filter((u) => u.createdAt >= startDate)
      .forEach((u) => {
        const date = u.createdAt.toISOString().split('T')[0]
        dailyRegistrations[date] = (dailyRegistrations[date] || 0) + 1
      })

    Object.entries(dailyRegistrations)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        const bar = '█'.repeat(Math.min(count, 20))
        console.log(`${date}: ${bar} ${count}`)
      })
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

viewUsers()

