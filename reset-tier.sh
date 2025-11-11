#!/bin/bash
# Quick script to reset user tier to free

echo "Resetting user tier to 'free'..."
echo ""

cd volspike-nodejs-backend

# Use the new DATABASE_URL (replace with your actual new password)
DATABASE_URL="postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx tsx reset-user-tier.ts

echo ""
echo "✅ Done! User tier reset to 'free'"

