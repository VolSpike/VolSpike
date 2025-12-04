#!/bin/bash
# Script to update DATABASE_URL in .env file
# Usage: ./update-database-url.sh "postgresql://neondb_owner:NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

if [ -z "$1" ]; then
    echo "❌ Error: Please provide the new DATABASE_URL"
    echo ""
    echo "Usage:"
    echo "  ./update-database-url.sh 'postgresql://neondb_owner:NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'"
    exit 1
fi

NEW_DATABASE_URL="$1"
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check if DATABASE_URL exists in .env
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    # Update existing DATABASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$NEW_DATABASE_URL|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$NEW_DATABASE_URL|" "$ENV_FILE"
    fi
    echo "✅ Updated DATABASE_URL in .env file"
else
    # Add DATABASE_URL if it doesn't exist
    echo "DATABASE_URL=$NEW_DATABASE_URL" >> "$ENV_FILE"
    echo "✅ Added DATABASE_URL to .env file"
fi

echo ""
echo "📋 Updated .env file. Please verify:"
echo "   DATABASE_URL=$NEW_DATABASE_URL"
echo ""
echo "⚠️  Make sure .env is in .gitignore and never commit it!"

