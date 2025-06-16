#!/bin/bash

# Monitor Multi-Level Cache Performance
# This script provides real-time monitoring of the OCR service cache performance

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Multi-Level Cache Performance Monitor${NC}"
echo "========================================"

# Function to get cache metrics
get_cache_metrics() {
    local POD_NAME=$(kubectl get pod -l app=ocr-service -n medcontracthub -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    
    if [ -z "$POD_NAME" ]; then
        echo -e "${RED}❌ No OCR service pod found${NC}"
        return 1
    fi
    
    kubectl exec $POD_NAME -n medcontracthub -- curl -s http://localhost:8100/cache/metrics 2>/dev/null
}

# Function to get Redis metrics
get_redis_metrics() {
    local CACHE_TYPE=$1
    local REDIS_POD=$(kubectl get pod -l app=redis-$CACHE_TYPE-cache -n medcontracthub -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    
    if [ -z "$REDIS_POD" ]; then
        echo "N/A"
        return
    fi
    
    kubectl exec $REDIS_POD -n medcontracthub -- redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r'
}

# Function to format percentage with color
format_percentage() {
    local value=$1
    local threshold_yellow=70
    local threshold_green=85
    
    if (( $(echo "$value >= $threshold_green" | bc -l) )); then
        echo -e "${GREEN}${value}%${NC}"
    elif (( $(echo "$value >= $threshold_yellow" | bc -l) )); then
        echo -e "${YELLOW}${value}%${NC}"
    else
        echo -e "${RED}${value}%${NC}"
    fi
}

# Main monitoring loop
while true; do
    clear
    echo -e "${BLUE}📊 Multi-Level Cache Performance Monitor${NC}"
    echo "========================================"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Get cache metrics
    METRICS=$(get_cache_metrics)
    
    if [ $? -eq 0 ] && [ -n "$METRICS" ]; then
        # Parse metrics
        L1_HITS=$(echo $METRICS | jq -r '.cache_metrics.l1_hits // 0')
        L2_HITS=$(echo $METRICS | jq -r '.cache_metrics.l2_hits // 0')
        L3_HITS=$(echo $METRICS | jq -r '.cache_metrics.l3_hits // 0')
        MISSES=$(echo $METRICS | jq -r '.cache_metrics.misses // 0')
        TOTAL_REQUESTS=$(echo $METRICS | jq -r '.cache_metrics.total_requests // 0')
        HIT_RATE=$(echo $METRICS | jq -r '.cache_metrics.hit_rate // "0.00"')
        PROMOTIONS=$(echo $METRICS | jq -r '.cache_metrics.promotions // 0')
        EVICTIONS=$(echo $METRICS | jq -r '.cache_metrics.evictions // 0')
        
        # Calculate percentages
        if [ "$TOTAL_REQUESTS" -gt 0 ]; then
            L1_PERCENT=$(echo "scale=2; $L1_HITS * 100 / $TOTAL_REQUESTS" | bc)
            L2_PERCENT=$(echo "scale=2; $L2_HITS * 100 / $TOTAL_REQUESTS" | bc)
            L3_PERCENT=$(echo "scale=2; $L3_HITS * 100 / $TOTAL_REQUESTS" | bc)
        else
            L1_PERCENT="0.00"
            L2_PERCENT="0.00"
            L3_PERCENT="0.00"
        fi
        
        # Display metrics
        echo -e "${YELLOW}📈 Cache Hit Statistics${NC}"
        echo "------------------------"
        echo -e "Overall Hit Rate: $(format_percentage ${HIT_RATE%\%})"
        echo -e "Total Requests:   $TOTAL_REQUESTS"
        echo ""
        
        echo -e "${YELLOW}🎯 Hit Distribution${NC}"
        echo "-------------------"
        printf "L1 (Hot):  %8d hits (%s)\n" $L1_HITS "$(format_percentage $L1_PERCENT)"
        printf "L2 (Warm): %8d hits (%s)\n" $L2_HITS "$(format_percentage $L2_PERCENT)"
        printf "L3 (Cold): %8d hits (%s)\n" $L3_HITS "$(format_percentage $L3_PERCENT)"
        printf "Misses:    %8d\n" $MISSES
        echo ""
        
        echo -e "${YELLOW}🔄 Cache Operations${NC}"
        echo "-------------------"
        printf "Promotions: %d\n" $PROMOTIONS
        printf "Evictions:  %d\n" $EVICTIONS
        echo ""
        
        # Get Redis memory usage
        echo -e "${YELLOW}💾 Memory Usage${NC}"
        echo "---------------"
        L1_MEM=$(get_redis_metrics "l1")
        L2_MEM=$(get_redis_metrics "l2")
        printf "L1 Cache: %s\n" "${L1_MEM:-N/A}"
        printf "L2 Cache: %s\n" "${L2_MEM:-N/A}"
        echo ""
        
        # Cache configuration
        L1_TTL=$(echo $METRICS | jq -r '.cache_config.l1_ttl_hours // 24')
        L2_TTL=$(echo $METRICS | jq -r '.cache_config.l2_ttl_days // 7')
        
        echo -e "${YELLOW}⚙️  Configuration${NC}"
        echo "----------------"
        echo "L1 TTL: ${L1_TTL} hours"
        echo "L2 TTL: ${L2_TTL} days"
        
    else
        echo -e "${RED}❌ Unable to fetch cache metrics${NC}"
        echo "Retrying..."
    fi
    
    echo ""
    echo "Press Ctrl+C to exit. Refreshing in 5 seconds..."
    sleep 5
done