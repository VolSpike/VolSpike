import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
    const prisma = new PrismaClient()
    const email = process.env.SEED_USER_EMAIL || 'test@volspike.com'
    const plainPassword = process.env.SEED_USER_PASSWORD || 'password'
    const tier = process.env.SEED_USER_TIER || 'free'

    const passwordHash = await bcrypt.hash(plainPassword, 12)

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            emailVerified: new Date(),
            tier,
        },
        create: {
            email,
            passwordHash,
            emailVerified: new Date(),
            tier,
        },
    })

    // eslint-disable-next-line no-console
    console.log('✅ Seeded user in Neon:', {
        email: user.email,
        tier: user.tier,
        emailVerified: user.emailVerified,
        hasPassword: Boolean(user.passwordHash),
    })

    await prisma.$disconnect()
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seed error', err)
    process.exit(1)
})


