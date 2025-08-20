#!/bin/bash

# Full Production Test Script for DealBrief Scanner
# Target: https://vulnerable-test-site.vercel.app

set -e

echo "========================================="
echo "🚀 DealBrief Scanner - Full Production Test"
echo "========================================="
echo ""
echo "Target: https://vulnerable-test-site.vercel.app"
echo "Date: $(date)"
echo ""

# Step 1: Execute the scan
echo "📋 Step 1: Executing scanner job..."
echo "----------------------------------------"
EXECUTION_OUTPUT=$(gcloud run jobs execute scanner-job \
  --project=precise-victory-467219-s4 \
  --region=us-central1 \
  --update-env-vars="SCAN_TARGET=https://vulnerable-test-site.vercel.app,COMPANY_NAME=Vulnerable Test Site" \
  2>&1)

echo "$EXECUTION_OUTPUT"

# Extract execution name
EXECUTION_NAME=$(echo "$EXECUTION_OUTPUT" | grep -oE "scanner-job-[a-z0-9]+" | head -1)

if [ -z "$EXECUTION_NAME" ]; then
  echo "❌ Failed to extract execution name"
  exit 1
fi

echo ""
echo "✅ Scan started with execution: $EXECUTION_NAME"
echo ""

# Step 2: Wait and monitor
echo "📋 Step 2: Monitoring execution..."
echo "----------------------------------------"
sleep 10

# Check status every 30 seconds for up to 5 minutes
MAX_CHECKS=10
CHECK_COUNT=0

while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
  echo "Checking status (attempt $((CHECK_COUNT + 1))/$MAX_CHECKS)..."
  
  STATUS=$(gcloud run jobs executions describe $EXECUTION_NAME \
    --project=precise-victory-467219-s4 \
    --region=us-central1 \
    --format="value(status.conditions[0].type)")
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "Completed" ]; then
    echo "✅ Execution completed successfully!"
    break
  fi
  
  CHECK_COUNT=$((CHECK_COUNT + 1))
  sleep 30
done

echo ""
echo "📋 Step 3: Fetching execution logs..."
echo "----------------------------------------"

# Get logs for this execution
gcloud logging read "resource.type=cloud_run_job AND \
  resource.labels.job_name=scanner-job AND \
  labels.\"run.googleapis.com/execution_name\"=$EXECUTION_NAME" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=100 \
  --order=asc > scan_logs_$EXECUTION_NAME.txt

echo "Logs saved to: scan_logs_$EXECUTION_NAME.txt"

# Check for module completions
echo ""
echo "📋 Step 4: Verifying module completions..."
echo "----------------------------------------"

MODULES=(
  "breach_directory_probe"
  "shodan"
  "document_exposure"
  "endpointDiscovery"
  "spf_dmarc"
  "config_exposure"
  "tls_scan"
  "nuclei"
  "tech_stack_scan"
  "abuse_intel_scan"
  "client_secret_scanner"
  "backend_exposure_scanner"
  "accessibility_scan"
  "asset_correlator"
)

for MODULE in "${MODULES[@]}"; do
  if grep -q "COMPLETE.*$MODULE" scan_logs_$EXECUTION_NAME.txt; then
    echo "✅ $MODULE - Completed"
  else
    echo "❌ $MODULE - Not completed or timed out"
  fi
done

# Extract scan ID
echo ""
echo "📋 Step 5: Extracting scan ID..."
echo "----------------------------------------"

SCAN_ID=$(grep "Processing scan" scan_logs_$EXECUTION_NAME.txt | grep -oE "[a-zA-Z0-9]{8,}" | head -1)

if [ -z "$SCAN_ID" ]; then
  echo "⚠️  Could not extract scan ID from logs"
  echo "Trying alternative method..."
  
  # Try to get from Firestore directly
  SCAN_ID=$(gcloud firestore documents list \
    --collection-path=scans \
    --project=precise-victory-467219-s4 \
    --limit=1 \
    --format="value(name)" | grep -oE "[a-zA-Z0-9]+$")
fi

if [ -n "$SCAN_ID" ]; then
  echo "✅ Scan ID: $SCAN_ID"
  
  echo ""
  echo "📋 Step 6: Checking Firestore data..."
  echo "----------------------------------------"
  
  # Check scan document
  echo "Fetching scan document..."
  gcloud firestore documents get scans/$SCAN_ID \
    --project=precise-victory-467219-s4 \
    --format=json > scan_$SCAN_ID.json 2>/dev/null || echo "Could not fetch scan document"
  
  # Check for findings
  echo "Checking for findings..."
  FINDINGS_COUNT=$(gcloud firestore documents list \
    --collection-path=findings \
    --project=precise-victory-467219-s4 \
    --filter="scan_id=$SCAN_ID" \
    --format="value(name)" | wc -l)
  
  echo "Found $FINDINGS_COUNT findings"
  
  # Check for artifacts  
  echo "Checking for artifacts..."
  ARTIFACTS_COUNT=$(gcloud firestore documents list \
    --collection-path=artifacts \
    --project=precise-victory-467219-s4 \
    --filter="scan_id=$SCAN_ID" \
    --format="value(name)" | wc -l)
  
  echo "Found $ARTIFACTS_COUNT artifacts"
else
  echo "❌ Could not determine scan ID"
fi

echo ""
echo "========================================="
echo "📊 Test Summary"
echo "========================================="
echo "Execution: $EXECUTION_NAME"
echo "Status: $STATUS"
echo "Scan ID: ${SCAN_ID:-Unknown}"
echo "Findings: ${FINDINGS_COUNT:-Unknown}"
echo "Artifacts: ${ARTIFACTS_COUNT:-Unknown}"
echo "Logs: scan_logs_$EXECUTION_NAME.txt"
echo ""

# Check for critical issues
if grep -q "TIMEOUT" scan_logs_$EXECUTION_NAME.txt; then
  echo "⚠️  Warning: Some modules timed out"
  grep "TIMEOUT" scan_logs_$EXECUTION_NAME.txt | head -5
fi

if grep -q "ERROR" scan_logs_$EXECUTION_NAME.txt; then
  echo "⚠️  Warning: Errors detected"
  grep "ERROR" scan_logs_$EXECUTION_NAME.txt | head -5
fi

echo ""
echo "✅ Full test completed!"
echo ""
echo "Next steps:"
echo "1. Review the logs: cat scan_logs_$EXECUTION_NAME.txt"
echo "2. Check scan details: cat scan_$SCAN_ID.json"
echo "3. Deploy report generation service to create intelligence reports"