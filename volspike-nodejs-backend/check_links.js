const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const messages = await prisma.telegramMessage.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    select: {
      id: true,
      text: true,
      date: true,
      links: true,
    }
  })
  
  console.log('Most recent 5 messages:')
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    console.log('\n' + (i + 1) + '. Date: ' + msg.date.toISOString())
    console.log('   Text: ' + (msg.text ? msg.text.substring(0, 100) : 'null'))
    console.log('   Links: ' + JSON.stringify(msg.links))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
