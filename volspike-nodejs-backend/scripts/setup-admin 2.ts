/**
 * Script to check and setup admin account
 * 
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/setup-admin.ts --email nsitnikov1@gmail.com
 */

import { PrismaClient, Role } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set!')
  process.exit(1)
}

const prisma = new PrismaClient()

async function setupAdmin() {
  try {
    const args = process.argv.slice(2)
    const emailArg = args.find(arg => arg.startsWith('--email='))?.split('=')[1]

    if (!emailArg) {
      console.error('❌ ERROR: Must provide --email')
      console.log('\nUsage:')
      console.log('  npx tsx scripts/setup-admin.ts --email nsitnikov1@gmail.com')
      process.exit(1)
    }

    console.log('\n=== ADMIN ACCOUNT SETUP ===\n')
    console.log(`🔍 Checking account: ${emailArg}\n`)

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: emailArg,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        passwordHash: true,
        createdAt: true,
      }
    })

    if (!user) {
      console.log(`❌ User not found: ${emailArg}`)
      console.log(`\n💡 User does not exist. You need to:`)
      console.log(`   1. Sign up at https://volspike.com/auth`)
      console.log(`   2. Then run this script again to set role to ADMIN`)
      process.exit(1)
    }

    console.log(`✅ User found:`)
    console.log(`   Email: ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Current Role: ${user.role}`)
    console.log(`   Status: ${user.status}`)
    console.log(`   Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`)
    console.log(`   Has Password: ${user.passwordHash ? 'Yes' : 'No'}`)
    console.log(`   Created: ${user.createdAt.toLocaleString()}`)

    if (user.role === 'ADMIN') {
      console.log(`\n✅ Account is already set as ADMIN!`)
      console.log(`\n📋 Login Credentials:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: [Your password - use the one you set during signup]`)
      console.log(`\n🔗 Login URL: https://volspike.com/auth`)
      console.log(`   After login, go to: https://volspike.com/admin`)
    } else {
      console.log(`\n🔧 Updating role to ADMIN...`)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN }
      })

      console.log(`✅ Role updated to ADMIN!`)
      console.log(`\n📋 Login Credentials:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: [Your password - use the one you set during signup]`)
      console.log(`\n🔗 Login URL: https://volspike.com/auth`)
      console.log(`   After login, go to: https://volspike.com/admin`)
    }

    // Check if email is verified
    if (!user.emailVerified) {
      console.log(`\n⚠️  WARNING: Email is not verified!`)
      console.log(`   You may need to verify your email before accessing admin features.`)
    }

    // Check if password exists
    if (!user.passwordHash) {
      console.log(`\n⚠️  WARNING: No password set!`)
      console.log(`   This account may be OAuth-only. You may need to:`)
      console.log(`   1. Set a password via password reset, OR`)
      console.log(`   2. Use OAuth login (Google)`)
    }

    console.log(`\n✅ Setup complete!\n`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setupAdmin()

