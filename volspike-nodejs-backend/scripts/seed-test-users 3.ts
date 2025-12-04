/*
  DANGER: This script deletes ALL users and related records, then seeds test accounts.
  To run, you must:
    - export DATABASE_URL=...
    - export DANGEROUSLY_ERASE_ALL_USERS=YES
    - npm run seed:test -- --really-erase
*/

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function eraseAllUsers() {
  console.log('⚠️  Deleting user-related data (this is destructive)...')
  // Order matters due to FKs
  await prisma.auditLog.deleteMany({})
  await prisma.adminSession.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.verificationToken.deleteMany({})
  await prisma.walletAccount.deleteMany({})
  await prisma.alertSubscription.deleteMany({})
  await prisma.alert.deleteMany({})
  await prisma.watchlistItem.deleteMany({})
  await prisma.watchlist.deleteMany({})
  await prisma.preference.deleteMany({})
  // Finally users
  await prisma.user.deleteMany({})
}

async function seedUsers() {
  console.log('🌱 Seeding test users...')
  const password = 'Test123456!'
  const hash = await bcrypt.hash(password, 12)

  const now = new Date()

  const users = [
    { email: 'free-test@volspike.com', tier: 'free' },
    { email: 'pro-test@volspike.com', tier: 'pro' },
    { email: 'gmail-policy@googlemail.com', tier: 'free' },
  ]

  for (const u of users) {
    await prisma.user.create({
      data: {
        email: u.email.toLowerCase().trim(),
        tier: u.tier,
        emailVerified: now,
        passwordHash: hash,
        passwordChangedAt: now,
        role: 'USER',
        status: 'ACTIVE',
      },
    })
  }

  console.log('✅ Seed complete.')
  console.table(users.map(u => ({ email: u.email, tier: u.tier, password })))
}

async function main() {
  requireEnv('DATABASE_URL')
  const guard = process.env.DANGEROUSLY_ERASE_ALL_USERS === 'YES'
  const really = process.argv.includes('--really-erase')

  if (!guard || !really) {
    console.error('\nRefusing to run. This script deletes ALL users.\n')
    console.error('To proceed, set: DANGEROUSLY_ERASE_ALL_USERS=YES and pass --really-erase')
    process.exit(1)
  }

  const count = await prisma.user.count()
  console.log(`Current users: ${count}`)

  await eraseAllUsers()
  await seedUsers()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

