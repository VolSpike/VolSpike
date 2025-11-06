#!/bin/bash

# Production Deployment Verification Script
# Checks if Open Interest endpoints are live

echo "🔍 Verifying Open Interest Production Deployment..."
echo ""

# Backend URL (Railway)
BACKEND_URL="https://volspike-production.up.railway.app"

# Frontend URL (Vercel)
FRONTEND_URL="https://volspike.com"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Testing Backend Open Interest Endpoint (GET)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test GET endpoint (should return empty data or cached data)
echo "🌐 GET ${BACKEND_URL}/api/market/open-interest"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/api/market/open-interest")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Backend endpoint is live!${NC}"
    echo "Response: $BODY"
    
    # Check if response has "data" field
    if echo "$BODY" | grep -q '"data"'; then
        echo -e "${GREEN}✅ Response structure is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  Response doesn't contain 'data' field (cache may be empty - this is OK)${NC}"
    fi
else
    echo -e "${RED}❌ Backend endpoint failed! HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Testing Frontend Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test frontend health
echo "🌐 GET ${FRONTEND_URL}"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}")

if [ "$FRONTEND_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Frontend is live!${NC}"
else
    echo -e "${RED}❌ Frontend failed! HTTP $FRONTEND_CODE${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$HTTP_CODE" -eq 200 ] && [ "$FRONTEND_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ All systems operational!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Login as Pro tier user (pro-test@volspike.com)"
    echo "  2. Check if 'Open Interest' column is visible"
    echo "  3. Update Digital Ocean script to start posting data"
else
    echo -e "${RED}⚠️  Some checks failed. Review logs above.${NC}"
fi

echo ""

