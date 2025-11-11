#!/bin/bash
# Quick script to test monthly renewal using Stripe CLI

echo "🔍 Finding your active subscription..."

# List active subscriptions
SUBSCRIPTION_ID=$(stripe subscriptions list --status=active --limit=1 --format=json | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SUBSCRIPTION_ID" ]; then
    echo "❌ No active subscription found"
    exit 1
fi

echo "✅ Found subscription: $SUBSCRIPTION_ID"
echo ""
echo "📅 Current subscription details:"
stripe subscriptions retrieve $SUBSCRIPTION_ID --format=yaml | grep -E "(current_period_end|status|customer)"

echo ""
echo "🔄 Triggering invoice payment..."
stripe trigger invoice.payment_succeeded

echo ""
echo "✅ Check your webhook logs to verify the event was received!"

