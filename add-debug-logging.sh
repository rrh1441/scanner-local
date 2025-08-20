#!/bin/bash

# Add detailed logging to hanging modules

echo "Adding debug logging to hanging modules..."

# tlsScan.ts
sed -i '' 's/export async function runTlsScan(job: {/export async function runTlsScan(job: {\n  console.log(`[tlsScan] START at ${new Date().toISOString()}`);/' apps/workers/modules/tlsScan.ts 2>/dev/null || true

# spfDmarc.ts  
sed -i '' 's/export async function runSpfDmarc(job: {/export async function runSpfDmarc(job: {\n  console.log(`[spfDmarc] START at ${new Date().toISOString()}`);/' apps/workers/modules/spfDmarc.ts 2>/dev/null || true

# configExposureScanner.ts
sed -i '' 's/export async function runConfigExposureScanner(job: {/export async function runConfigExposureScanner(job: {\n  console.log(`[configExposure] START at ${new Date().toISOString()}`);/' apps/workers/modules/configExposureScanner.ts 2>/dev/null || true

# aiPathFinder.ts
sed -i '' 's/export async function runAiPathFinder(job: {/export async function runAiPathFinder(job: {\n  console.log(`[aiPathFinder] START at ${new Date().toISOString()}`);/' apps/workers/modules/aiPathFinder.ts 2>/dev/null || true

# documentExposure.ts
sed -i '' 's/export async function runDocumentExposure(job: {/export async function runDocumentExposure(job: {\n  console.log(`[documentExposure] START at ${new Date().toISOString()}`);/' apps/workers/modules/documentExposure.ts 2>/dev/null || true

# assetCorrelator.ts
sed -i '' 's/export async function runAssetCorrelator(job: {/export async function runAssetCorrelator(job: {\n  console.log(`[assetCorrelator] START at ${new Date().toISOString()}`);/' apps/workers/modules/assetCorrelator.ts 2>/dev/null || true

echo "Debug logging added to modules"