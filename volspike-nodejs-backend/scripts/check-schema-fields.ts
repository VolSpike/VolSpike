import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchemaFields() {
  try {
    console.log('🔍 Checking production database for schema fields...\n');

    // Check VolumeAlert table columns
    const volumeAlertColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'volume_alerts'
      AND column_name IN ('detectionTime', 'priceChange', 'oiChange')
      ORDER BY column_name
    `;

    console.log('📊 VolumeAlert table - Field Status:\n');
    
    const foundColumns = volumeAlertColumns.map(col => col.column_name.toLowerCase());
    
    const fieldsToCheck = [
      { name: 'detectionTime', type: 'DateTime?' },
      { name: 'priceChange', type: 'Float?' },
      { name: 'oiChange', type: 'Float?' }
    ];

    fieldsToCheck.forEach(field => {
      const exists = foundColumns.includes(field.name.toLowerCase());
      const status = exists ? '✅ EXISTS' : '❌ MISSING';
      console.log(`  ${field.name} (${field.type}): ${status}`);
      if (exists) {
        const col = volumeAlertColumns.find(c => c.column_name.toLowerCase() === field.name.toLowerCase());
        console.log(`    └─ Type: ${col?.data_type}`);
      }
    });

    console.log('\n📋 All VolumeAlert columns in production:\n');
    const allColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'volume_alerts'
      ORDER BY column_name
    `;
    
    allColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkSchemaFields();

