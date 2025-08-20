#!/bin/bash

# Script to run production scan test with vulnerable-test-site.vercel.app

echo "🚀 Starting production scan test"
echo "Target: https://vulnerable-test-site.vercel.app"
echo ""

# Set the target URL
export SCAN_TARGET="https://vulnerable-test-site.vercel.app"

# Create a scan request payload
cat > /tmp/scan_request.json <<EOF
{
  "target": "https://vulnerable-test-site.vercel.app",
  "company_name": "Vulnerable Test Site",
  "scan_type": "full",
  "tier": 1
}
EOF

echo "📋 Scan configuration:"
cat /tmp/scan_request.json
echo ""

echo "⚠️  Please authenticate manually if needed:"
echo "Run: gcloud auth login --account=ryan@simplcyber.io"
echo ""
echo "Then execute the scan with:"
echo "gcloud run jobs execute scanner-job --project=precise-victory-467219-s4 --region=us-central1"
echo ""
echo "After the scan starts, capture the execution name (e.g., scanner-job-XXXXX)"
echo "Then monitor with:"
echo 'EXECUTION_NAME="scanner-job-XXXXX"  # Replace with actual'
echo 'gcloud run jobs executions describe $EXECUTION_NAME --project=precise-victory-467219-s4 --region=us-central1'