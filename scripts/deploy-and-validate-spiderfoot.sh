#!/bin/bash

set -e

echo "🚀 Deploying SpiderFoot validation script to production..."

# Copy the validation script to the worker app
echo "📋 Copying validation script..."
cp scripts/validate-spiderfoot-production.ts apps/workers/validate-spiderfoot.ts

# Add tsx dependency to worker if not present
echo "📦 Checking dependencies..."
cd apps/workers
if ! grep -q '"tsx"' package.json; then
    echo "Adding tsx dependency..."
    npm install --save-dev tsx
fi
cd ../..

# Deploy the worker with the validation script
echo "🚢 Deploying to Fly.io..."
fly deploy --app dealbrief-scanner

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Run the validation script on the production server
echo "🔍 Running SpiderFoot validation on production server..."
fly ssh console --app dealbrief-scanner --command "npx tsx validate-spiderfoot.ts"

echo "✅ SpiderFoot validation completed!" 