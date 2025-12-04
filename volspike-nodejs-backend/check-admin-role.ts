import { PrismaClient } from '@prisma/client'

const DATABASE_URL = "postgresql://neondb_owner:npg_3HkfewYAN8vy@ep-snowy-sunset-ahlodmvx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
})

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'nsitnikov1@gmail.com' },
    select: {
      id: true,
      email: true,
      role: true,
      tier: true,
      status: true,
      emailVerified: true,
    },
  })
  
  console.log('User details:', JSON.stringify(user, null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
