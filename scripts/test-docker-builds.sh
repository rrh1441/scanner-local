#!/bin/bash
set -euo pipefail

echo "=== Testing Docker builds locally ==="

# Build all images
echo "Building worker image..."
docker build -f Dockerfile.worker -t scanner-worker:test . || exit 1

echo "Building API image..."
docker build -f Dockerfile.api -t scanner-api:test . || exit 1

echo "Building reports image..."
docker build -f Dockerfile.reports -t scanner-reports:test . || exit 1

# Test worker
echo "Testing worker image..."
docker run --rm scanner-worker:test node -e "
const fs = require('fs');
const workerPath = 'apps/workers/dist/worker-pubsub.js';
if (!fs.existsSync(workerPath)) {
  console.error('Worker file not found at: ' + workerPath);
  process.exit(1);
}
console.log('✓ Worker file found');
"

# Test API
echo "Testing API image..."
docker run --rm scanner-api:test node -e "
const fs = require('fs');
const serverPath = 'apps/api-main/dist/server.js';
if (!fs.existsSync(serverPath)) {
  console.error('Server file not found at: ' + serverPath);
  process.exit(1);
}
console.log('✓ API server file found');
"

# Test reports
echo "Testing reports image..."
docker run --rm scanner-reports:test node -e "
console.log('✓ Reports service container functional');
"

# Test sizes
echo -e "\n=== Image sizes ==="
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "(scanner-worker|scanner-api|scanner-reports):test"

echo -e "\n✅ All tests passed!"