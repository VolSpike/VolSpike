import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function test() {
  try {
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful!')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

test()
