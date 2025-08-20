#!/bin/bash
# NAT and Egress Validation Script for Cloud Run Scanner Service
# This script validates network connectivity and IPv4/IPv6 behavior

set -e

echo "================================================"
echo "Cloud Run Scanner NAT/Egress Validation"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check command result
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# Function to run connectivity test
test_connectivity() {
    local url=$1
    local description=$2
    
    echo -e "\n${YELLOW}Testing:${NC} $description"
    
    # Test with IPv4 forcing
    echo -n "  IPv4 only: "
    if curl --ipv4 --connect-timeout 3 --max-time 8 -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
    
    # Test without forcing (default behavior)
    echo -n "  Default:   "
    if curl --connect-timeout 3 --max-time 8 -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Failed/Slow${NC}"
    fi
}

# Check if running inside container
if [ -f /.dockerenv ]; then
    echo "Running inside Docker container"
    IN_CONTAINER=true
else
    echo "Running on host system"
    IN_CONTAINER=false
fi

# 1. Check DNS resolution order
echo -e "\n${YELLOW}1. DNS Resolution Configuration${NC}"
if [ -n "$NODE_OPTIONS" ]; then
    echo "  NODE_OPTIONS=$NODE_OPTIONS"
    if echo "$NODE_OPTIONS" | grep -q "dns-result-order=ipv4first"; then
        check_result "IPv4-first DNS ordering configured"
    else
        echo -e "${YELLOW}!${NC} IPv4-first not configured in NODE_OPTIONS"
    fi
else
    echo -e "${YELLOW}!${NC} NODE_OPTIONS not set"
fi

# 2. Test DNS resolution
echo -e "\n${YELLOW}2. DNS Resolution Tests${NC}"
for domain in google.com cloudflare.com vulnerable-test-site.vercel.app; do
    echo "  Testing $domain:"
    
    # IPv4 resolution
    echo -n "    IPv4: "
    if host -t A "$domain" 2>/dev/null | grep -q "has address"; then
        ipv4=$(host -t A "$domain" 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')
        echo -e "${GREEN}$ipv4${NC}"
    else
        echo -e "${RED}Failed${NC}"
    fi
    
    # IPv6 resolution
    echo -n "    IPv6: "
    if host -t AAAA "$domain" 2>/dev/null | grep -q "IPv6 address"; then
        ipv6=$(host -t AAAA "$domain" 2>/dev/null | grep "IPv6 address" | head -1 | awk '{print $NF}')
        echo -e "${YELLOW}$ipv6 (present)${NC}"
    else
        echo "None"
    fi
done

# 3. Test connectivity to various endpoints
echo -e "\n${YELLOW}3. Connectivity Tests${NC}"
test_connectivity "https://google.com" "Google (well-connected)"
test_connectivity "https://cloudflare.com" "Cloudflare (CDN)"
test_connectivity "https://vulnerable-test-site.vercel.app/" "Vulnerable test site (problematic)"
test_connectivity "https://httpbin.org/delay/2" "HTTPBin with 2s delay"

# 4. Check VPC Connector status (if on GCP)
if [ "$IN_CONTAINER" = false ] && command -v gcloud &> /dev/null; then
    echo -e "\n${YELLOW}4. Cloud Run VPC Connector Status${NC}"
    
    SERVICE_NAME=${SERVICE_NAME:-scanner-service}
    REGION=${GCP_LOCATION:-us-central1}
    PROJECT=${GCP_PROJECT:-precise-victory-467219-s4}
    
    echo "  Checking service: $SERVICE_NAME in $REGION"
    
    # Get VPC connector info
    VPC_INFO=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT" \
        --format="value(spec.template.metadata.annotations.run.googleapis.com/vpc-access-connector)" 2>/dev/null || echo "")
    
    if [ -n "$VPC_INFO" ]; then
        echo -e "  VPC Connector: ${YELLOW}$VPC_INFO${NC}"
        
        # Get egress settings
        EGRESS=$(gcloud run services describe "$SERVICE_NAME" \
            --region="$REGION" \
            --project="$PROJECT" \
            --format="value(spec.template.metadata.annotations.run.googleapis.com/vpc-access-egress)" 2>/dev/null || echo "all-traffic")
        
        echo -e "  Egress setting: ${YELLOW}$EGRESS${NC}"
        
        if [ "$EGRESS" = "all-traffic" ]; then
            echo -e "${YELLOW}!${NC} All traffic routed through VPC - ensure Cloud NAT is configured"
        fi
    else
        echo -e "  ${GREEN}✓${NC} No VPC connector (using direct egress)"
    fi
fi

# 5. Timeout behavior test
echo -e "\n${YELLOW}5. Timeout Behavior Tests${NC}"

# Test connect timeout
echo -n "  Connect timeout (3s): "
start_time=$(date +%s)
timeout 5 curl --ipv4 --connect-timeout 3 -s "https://10.255.255.1/" 2>/dev/null || true
end_time=$(date +%s)
duration=$((end_time - start_time))
if [ $duration -le 4 ]; then
    echo -e "${GREEN}✓ Respected ($duration seconds)${NC}"
else
    echo -e "${RED}✗ Too long ($duration seconds)${NC}"
fi

# Test total timeout
echo -n "  Total timeout (8s): "
start_time=$(date +%s)
timeout 10 curl --ipv4 --max-time 8 -s "https://httpbin.org/delay/20" 2>/dev/null || true
end_time=$(date +%s)
duration=$((end_time - start_time))
if [ $duration -le 9 ]; then
    echo -e "${GREEN}✓ Respected ($duration seconds)${NC}"
else
    echo -e "${RED}✗ Too long ($duration seconds)${NC}"
fi

# 6. Summary and Recommendations
echo -e "\n${YELLOW}================================================${NC}"
echo -e "${YELLOW}Summary & Recommendations:${NC}"
echo -e "${YELLOW}================================================${NC}"

echo -e "\n${GREEN}Required Configuration:${NC}"
echo "1. Set NODE_OPTIONS=\"--dns-result-order=ipv4first\" in Dockerfile/env"
echo "2. Use httpClient with forceIPv4: true for external requests"
echo "3. Configure timeouts: total=10s, connect=3s, firstByte=5s, idle=5s"

echo -e "\n${GREEN}If using VPC Connector:${NC}"
echo "1. Configure Cloud NAT for the VPC subnet"
echo "2. Or use 'private-ranges-only' egress setting"
echo "3. Or remove VPC connector for direct egress"

echo -e "\n${GREEN}Testing in production:${NC}"
echo "Deploy a test revision with these settings and run:"
echo "  curl -X POST https://[SERVICE_URL]/debug/test-endpoints -d '{\"domain\":\"vulnerable-test-site.vercel.app\"}'"

echo -e "\n${YELLOW}================================================${NC}"