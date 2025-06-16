#!/bin/bash

# Test Multi-Level Cache Functionality
# This script tests the OCR service cache behavior and performance

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing Multi-Level Cache Functionality${NC}"
echo "========================================="

# Test configuration
TEST_URL="https://www.sam.gov/api/prod/opps/v3/opportunities/1234567890.pdf"
SERVICE_URL="http://localhost:8100"

# Function to measure request time
measure_time() {
    local start=$(date +%s%N)
    "$@"
    local end=$(date +%s%N)
    echo $(( ($end - $start) / 1000000 )) # Convert to milliseconds
}

# Setup port forward
echo "🔌 Setting up port forward to OCR service..."
kubectl port-forward svc/ocr-service 8100:8100 -n medcontracthub &
PF_PID=$!
sleep 5

# Test 1: First request (cache miss - should be slow)
echo -e "\n${YELLOW}Test 1: Initial Request (Cache Miss)${NC}"
echo "------------------------------------"
TIME_MS=$(measure_time curl -s -X POST $SERVICE_URL/process/url \
    -H "Content-Type: application/json" \
    -d "{\"document_url\": \"$TEST_URL\", \"model\": \"pixtral-12b-latest\"}")

echo "Response time: ${TIME_MS}ms"
if [ $TIME_MS -gt 5000 ]; then
    echo -e "${GREEN}✓ As expected, first request took longer (no cache)${NC}"
else
    echo -e "${RED}❌ Unexpected: First request was too fast${NC}"
fi

# Get initial cache metrics
echo -e "\n📊 Cache metrics after first request:"
curl -s $SERVICE_URL/cache/metrics | jq '.cache_metrics'

sleep 2

# Test 2: Second request (should hit L1 cache)
echo -e "\n${YELLOW}Test 2: Second Request (L1 Cache Hit)${NC}"
echo "-------------------------------------"
TIME_MS=$(measure_time curl -s -X POST $SERVICE_URL/process/url \
    -H "Content-Type: application/json" \
    -d "{\"document_url\": \"$TEST_URL\", \"model\": \"pixtral-12b-latest\"}")

echo "Response time: ${TIME_MS}ms"
if [ $TIME_MS -lt 100 ]; then
    echo -e "${GREEN}✓ Excellent! L1 cache hit with fast response${NC}"
elif [ $TIME_MS -lt 500 ]; then
    echo -e "${YELLOW}⚠ Good response time, likely from cache${NC}"
else
    echo -e "${RED}❌ Response too slow for cache hit${NC}"
fi

# Test 3: Multiple different documents
echo -e "\n${YELLOW}Test 3: Processing Multiple Documents${NC}"
echo "-------------------------------------"
for i in {1..5}; do
    TEST_URL_MULTI="https://www.sam.gov/api/prod/opps/v3/opportunities/test-$i.pdf"
    curl -s -X POST $SERVICE_URL/process/url \
        -H "Content-Type: application/json" \
        -d "{\"document_url\": \"$TEST_URL_MULTI\", \"model\": \"pixtral-12b-latest\"}" > /dev/null
    echo "Processed document $i"
done

# Get cache metrics after multiple requests
echo -e "\n📊 Cache metrics after multiple requests:"
METRICS=$(curl -s $SERVICE_URL/cache/metrics)
echo $METRICS | jq '.cache_metrics'

# Test 4: Vector search functionality
echo -e "\n${YELLOW}Test 4: Vector Search Functionality${NC}"
echo "-----------------------------------"
SEARCH_RESPONSE=$(curl -s -X POST $SERVICE_URL/community/search \
    -H "Content-Type: application/json" \
    -d '{"query": "medical equipment requirements", "limit": 5}')

if echo $SEARCH_RESPONSE | jq -e '.results' > /dev/null 2>&1; then
    RESULT_COUNT=$(echo $SEARCH_RESPONSE | jq '.results | length')
    echo -e "${GREEN}✓ Vector search returned $RESULT_COUNT results${NC}"
else
    echo -e "${RED}❌ Vector search failed${NC}"
fi

# Test 5: Cache eviction simulation
echo -e "\n${YELLOW}Test 5: Cache Eviction Test${NC}"
echo "---------------------------"
echo "Processing many documents to trigger eviction..."
for i in {1..20}; do
    TEST_URL_EVICT="https://www.sam.gov/api/prod/opps/v3/opportunities/evict-test-$i.pdf"
    curl -s -X POST $SERVICE_URL/process/url \
        -H "Content-Type: application/json" \
        -d "{\"document_url\": \"$TEST_URL_EVICT\", \"model\": \"pixtral-12b-latest\"}" > /dev/null &
done
wait

# Final cache metrics
echo -e "\n📊 Final cache metrics:"
FINAL_METRICS=$(curl -s $SERVICE_URL/cache/metrics)
echo $FINAL_METRICS | jq '.cache_metrics'

# Calculate improvements
TOTAL_REQUESTS=$(echo $FINAL_METRICS | jq -r '.cache_metrics.total_requests // 0')
HIT_RATE=$(echo $FINAL_METRICS | jq -r '.cache_metrics.hit_rate // "0"')
PROMOTIONS=$(echo $FINAL_METRICS | jq -r '.cache_metrics.promotions // 0')
EVICTIONS=$(echo $FINAL_METRICS | jq -r '.cache_metrics.evictions // 0')

echo -e "\n${BLUE}📈 Test Summary${NC}"
echo "==============="
echo "Total Requests: $TOTAL_REQUESTS"
echo "Overall Hit Rate: ${HIT_RATE}"
echo "Cache Promotions: $PROMOTIONS"
echo "Cache Evictions: $EVICTIONS"

# Cleanup
kill $PF_PID 2>/dev/null || true

echo -e "\n${GREEN}✅ Cache functionality tests completed!${NC}"