#!/bin/bash

# Test Report Generation Workflow
# This script tests the complete scan -> findings -> report pipeline

set -e

echo "================================================"
echo "    DealBrief Scanner Report Generation Test   "
echo "================================================"
echo ""

# Configuration
SCANNER_URL="https://scanner-service-242181373909.us-central1.run.app"
PROJECT_ID="precise-victory-467219-s4"
GCS_BUCKET="precise-victory-467219-s4-scan-artifacts"

# Generate unique identifiers
TIMESTAMP=$(date +%s)
SCAN_ID="report-test-${TIMESTAMP}"
DOMAIN="github.com"  # Use a real domain for better results

echo "📋 Test Configuration:"
echo "  Scan ID: ${SCAN_ID}"
echo "  Domain: ${DOMAIN}"
echo "  Timestamp: $(date -r ${TIMESTAMP} '+%Y-%m-%d %H:%M:%S')"
echo ""

# Step 1: Trigger a scan
echo "1️⃣  Triggering scan..."
echo "─────────────────────────────────────────"

SCAN_RESPONSE=$(curl -X POST "${SCANNER_URL}/tasks/scan" \
  -H "Content-Type: application/json" \
  -d "{\"scan_id\":\"${SCAN_ID}\",\"domain\":\"${DOMAIN}\"}" \
  --max-time 120 -s)

if [ $? -ne 0 ]; then
  echo "❌ Scan failed to complete"
  exit 1
fi

# Extract scan metadata
DURATION=$(echo "${SCAN_RESPONSE}" | jq -r '.metadata.duration_ms')
MODULES_COMPLETED=$(echo "${SCAN_RESPONSE}" | jq -r '.metadata.modules_completed')
MODULES_FAILED=$(echo "${SCAN_RESPONSE}" | jq -r '.metadata.modules_failed')

echo "✅ Scan completed successfully!"
echo "  Duration: $((DURATION / 1000))s"
echo "  Modules completed: ${MODULES_COMPLETED}"
echo "  Modules failed: ${MODULES_FAILED}"
echo ""

# Step 2: Check Firestore for scan record
echo "2️⃣  Checking Firestore for scan record..."
echo "─────────────────────────────────────────"

# This requires gcloud firestore commands or a Node.js script
if command -v node &> /dev/null; then
  cat > /tmp/check-scan.js << 'EOF'
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore({ projectId: process.argv[2] });

(async () => {
  const scanId = process.argv[3];
  const scanDoc = await db.collection('scans').doc(scanId).get();
  
  if (!scanDoc.exists) {
    console.log('❌ Scan not found in Firestore');
    process.exit(1);
  }
  
  const data = scanDoc.data();
  console.log('✅ Scan found in Firestore');
  console.log(`  Status: ${data.status}`);
  console.log(`  Findings count: ${data.findings_count || 0}`);
  
  // Check for findings
  const findings = await db.collection('findings')
    .where('scan_id', '==', scanId)
    .limit(5)
    .get();
  
  console.log(`  Sample findings: ${findings.size} found`);
  findings.forEach(doc => {
    const f = doc.data();
    console.log(`    - [${f.severity}] ${f.title}`);
  });
})().catch(console.error);
EOF

  if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    node /tmp/check-scan.js "${PROJECT_ID}" "${SCAN_ID}"
  else
    echo "⚠️  GOOGLE_APPLICATION_CREDENTIALS not set, skipping Firestore check"
  fi
else
  echo "⚠️  Node.js not available, skipping Firestore check"
fi
echo ""

# Step 3: Check GCS for artifacts
echo "3️⃣  Checking GCS for artifacts..."
echo "─────────────────────────────────────────"

if command -v gsutil &> /dev/null; then
  ARTIFACTS=$(gsutil ls "gs://${GCS_BUCKET}/${SCAN_ID}/" 2>/dev/null || echo "")
  
  if [ -z "$ARTIFACTS" ]; then
    echo "⚠️  No artifacts found in GCS"
  else
    echo "✅ Artifacts found:"
    echo "${ARTIFACTS}" | head -5 | sed 's/^/    /'
    ARTIFACT_COUNT=$(echo "${ARTIFACTS}" | wc -l)
    echo "  Total artifacts: ${ARTIFACT_COUNT}"
  fi
else
  echo "⚠️  gsutil not available, skipping GCS check"
fi
echo ""

# Step 4: Test report generation endpoint
echo "4️⃣  Testing report generation..."
echo "─────────────────────────────────────────"

# Check if report endpoint exists
REPORT_CHECK=$(curl -X GET "${SCANNER_URL}/reports/health" -s -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")

if [ "$REPORT_CHECK" = "000" ] || [ "$REPORT_CHECK" = "404" ]; then
  echo "⚠️  Report endpoint not available (HTTP ${REPORT_CHECK})"
  echo "  Expected endpoint: POST ${SCANNER_URL}/reports/generate"
  echo ""
  echo "  Implementation needed:"
  echo "  1. Create /reports/generate endpoint"
  echo "  2. Aggregate findings from Firestore"
  echo "  3. Generate HTML/PDF report"
  echo "  4. Upload to GCS and return signed URL"
else
  # Try to generate report
  REPORT_RESPONSE=$(curl -X POST "${SCANNER_URL}/reports/generate" \
    -H "Content-Type: application/json" \
    -d "{\"scan_id\":\"${SCAN_ID}\"}" \
    --max-time 30 -s)
  
  if [ $? -eq 0 ]; then
    echo "✅ Report generation endpoint responded"
    echo "  Response: ${REPORT_RESPONSE:0:100}..."
    
    # Check if response contains a URL
    REPORT_URL=$(echo "${REPORT_RESPONSE}" | jq -r '.report_url' 2>/dev/null || echo "")
    if [ -n "$REPORT_URL" ] && [ "$REPORT_URL" != "null" ]; then
      echo "  Report URL: ${REPORT_URL}"
    fi
  else
    echo "❌ Report generation failed"
  fi
fi
echo ""

# Step 5: Summary
echo "📊 Test Summary"
echo "─────────────────────────────────────────"
echo "✅ Scan execution: Success (${DURATION}ms)"

# Check results
ISSUES=0

if [ "${MODULES_FAILED}" != "0" ]; then
  echo "⚠️  Some modules failed: ${MODULES_FAILED}"
  ((ISSUES++))
fi

if [ -z "$ARTIFACTS" ]; then
  echo "⚠️  No GCS artifacts found"
  ((ISSUES++))
fi

if [ "$REPORT_CHECK" = "404" ] || [ "$REPORT_CHECK" = "000" ]; then
  echo "⚠️  Report generation not implemented"
  ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
  echo "✅ All systems operational!"
else
  echo ""
  echo "Issues found: ${ISSUES}"
  echo "See above for details and recommendations."
fi

echo ""
echo "Test complete at $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"