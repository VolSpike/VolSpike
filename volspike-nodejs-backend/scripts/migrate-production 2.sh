#!/bin/bash
# Production database migration script
# This script runs Prisma migrations against the production database

set -e

echo "🔄 Starting production database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL before running this script"
    exit 1
fi

echo "📊 Database URL: ${DATABASE_URL:0:30}..." # Show first 30 chars for security

# Generate Prisma Client
echo "🔨 Generating Prisma Client..."
npx prisma generate

# Push schema changes to database
echo "📤 Pushing schema changes to database..."
npx prisma db push --accept-data-loss

echo "✅ Migration completed successfully!"
echo ""
echo "📋 Summary:"
echo "  - Added expiresAt field to CryptoPayment model"
echo "  - Added renewalReminderSent field to CryptoPayment model"
echo "  - Added index on expiresAt for performance"
echo ""
echo "🎉 Your database is now ready for crypto subscription expiration tracking!"

