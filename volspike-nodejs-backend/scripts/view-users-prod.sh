#!/bin/bash

# Quick script to view production users
# Usage: ./scripts/view-users-prod.sh

export DATABASE_URL="postgresql://neondb_owner:npg_xrRg5IhoZa6d@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

npx tsx scripts/view-users.ts

