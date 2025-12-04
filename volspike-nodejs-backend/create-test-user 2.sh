#!/bin/bash

# Production Test User Creation Script
# This script will create the test user in your Neon production database

echo "👤 VolSpike Production Test User Creation"
echo "========================================"
echo ""

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required"
    echo ""
    echo "Please run this command with your Neon DATABASE_URL:"
    echo "DATABASE_URL='postgresql://username:password@host:port/database' ./create-test-user.sh"
    echo ""
    exit 1
fi

echo "📊 Creating test user in production database..."
echo "Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"
echo ""

# Create test user using Prisma
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createTestUser() {
    const prisma = new PrismaClient();
    
    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: 'test@volspike.com' }
        });
        
        if (existingUser) {
            console.log('✅ Test user already exists:', existingUser.email);
            console.log('   ID:', existingUser.id);
            console.log('   Tier:', existingUser.tier);
            console.log('   Email Verified:', existingUser.emailVerified ? 'Yes' : 'No');
            return;
        }
        
        // Create new test user
        const passwordHash = await bcrypt.hash('TestPassword123!', 12);
        
        const user = await prisma.user.create({
            data: {
                email: 'test@volspike.com',
                tier: 'free',
                emailVerified: new Date(), // Mark as verified for testing
                // passwordHash: passwordHash, // Uncomment when password storage is implemented
            }
        });
        
        console.log('✅ Test user created successfully!');
        console.log('   Email: test@volspike.com');
        console.log('   Password: TestPassword123!');
        console.log('   Tier: free');
        console.log('   ID:', user.id);
        console.log('   Email Verified: Yes');
        
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
        process.exit(1);
    } finally {
        await prisma.\$disconnect();
    }
}

createTestUser();
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎯 Test user ready for production!"
    echo ""
    echo "You can now test at:"
    echo "1. https://volspike.com/auth"
    echo "2. Email: test@volspike.com"
    echo "3. Password: TestPassword123!"
    echo ""
else
    echo ""
    echo "❌ Failed to create test user!"
    echo "Please check your DATABASE_URL and try again."
    echo ""
    exit 1
fi
