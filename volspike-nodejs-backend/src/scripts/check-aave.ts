import { prisma } from '../lib/prisma'

async function main() {
  const alerts = await prisma.volumeAlert.findMany({
    where: { asset: 'AAVE' },
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: {
      id: true,
      symbol: true,
      asset: true,
      priceChange: true,
      oiChange: true,
      timestamp: true,
    }
  })
  console.log('AAVE alerts:', JSON.stringify(alerts, null, 2))
  
  // Also check latest alerts overall
  const latest = await prisma.volumeAlert.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: {
      id: true,
      asset: true,
      priceChange: true,
      oiChange: true,
      timestamp: true,
    }
  })
  console.log('\nLatest 5 alerts:', JSON.stringify(latest, null, 2))
}

main().then(() => prisma.$disconnect())
