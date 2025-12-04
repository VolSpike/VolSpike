import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const alerts = await prisma.openInterestAlert.findMany({
    where: { symbol: 'MAVIAUSDT' },
    orderBy: { ts: 'desc' },
    take: 10
  })

  console.log('MAVIAUSDT OI Alerts from database:')
  console.log('===================================')
  alerts.forEach(a => {
    const pct = (Number(a.pctChange) * 100).toFixed(2)
    const ts = new Date(a.ts).toLocaleString('en-US', { timeZone: 'America/New_York' })
    console.log(`${ts} - ${a.direction} ${pct}% (Current: ${a.current}, 5min ago: ${a.baseline})`)
  })

  console.log(`\nTotal alerts for MAVIAUSDT: ${alerts.length}`)
}

main().finally(() => prisma.$disconnect())
