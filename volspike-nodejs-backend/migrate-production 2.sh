#!/bin/bash

# Production Database Migration Script for Neon
# This script will run the Prisma migration against your Neon production database

echo "🚀 VolSpike Production Database Migration"
echo "========================================"
echo ""

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required"
    echo ""
    echo "Please run this command with your Neon DATABASE_URL:"
    echo "DATABASE_URL='postgresql://username:password@host:port/database' ./migrate-production.sh"
    echo ""
    echo "You can find your DATABASE_URL in:"
    echo "1. Neon Dashboard → Your project → Connection Details"
    echo "2. Or in your deployment platform's environment variables"
    echo ""
    exit 1
fi

echo "📊 Running migration against production database..."
echo "Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/:***@/')"
echo ""

# Run the migration
npx prisma db push --schema=./prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Create test user in production"
    echo "2. Test authentication flow"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check your DATABASE_URL and try again."
    echo ""
    exit 1
fi
