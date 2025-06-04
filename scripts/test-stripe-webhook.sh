#!/bin/bash

# Test Stripe Webhook Script
# This script sends a test webhook to your local endpoint
# Make sure your dev server is running on http://localhost:3000

WEBHOOK_URL="http://localhost:3000/api/webhooks/stripe"
WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-"your_webhook_secret_here"}

# Test payload for subscription created event
PAYLOAD='{
  "id": "evt_test_webhook_'$(date +%s)'",
  "object": "event",
  "api_version": "2024-12-18.acacia",
  "created": '$(date +%s)',
  "data": {
    "object": {
      "id": "sub_test_123",
      "object": "subscription",
      "customer": "cus_test_123",
      "status": "trialing",
      "current_period_start": '$(date +%s)',
      "current_period_end": '$(date -d "+1 month" +%s)',
      "trial_start": '$(date +%s)',
      "trial_end": '$(date -d "+14 days" +%s)',
      "items": {
        "data": [{
          "price": {
            "id": "price_test_starter",
            "nickname": "Starter Plan"
          }
        }]
      }
    }
  },
  "type": "customer.subscription.created"
}'

echo "🚀 Testing Stripe Webhook..."
echo "📍 Endpoint: $WEBHOOK_URL"
echo "📦 Event Type: customer.subscription.created"
echo ""

# Calculate signature (simplified for testing - in production Stripe calculates this)
TIMESTAMP=$(date +%s)
SIGNATURE="t=${TIMESTAMP},v1=test_signature"

# Send the webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -H "stripe-signature: $SIGNATURE" \
  -d "$PAYLOAD")

# Extract body and status code
BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)

# Display results
echo "📨 Response Status: $STATUS"
echo "📄 Response Body: $BODY"
echo ""

if [ "$STATUS" = "200" ]; then
  echo "✅ Webhook test successful!"
else
  echo "❌ Webhook test failed with status $STATUS"
fi

echo ""
echo "💡 Tips:"
echo "1. Make sure your dev server is running: npm run dev"
echo "2. Set STRIPE_WEBHOOK_SECRET in your .env.local"
echo "3. Use Stripe CLI for real webhook testing: stripe listen --forward-to localhost:3000/api/webhooks/stripe"