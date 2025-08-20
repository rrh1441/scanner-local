# Scanner Module Debugging Handoff
*Last Updated: 2025-08-15 18:10 PST*

## Executive Summary
**MAJOR PROGRESS**: Identified and fixed the root cause - IPv6 network issues on GCP. The NODE_OPTIONS fix has resolved the core networking problem. We now have 9/16 modules working reliably. The endpointDiscovery module is partially fixed (HTTP requests work, but still times out overall).

## Key Fix Applied
**IPv6 Black Hole Issue RESOLVED** ✅
- Added `NODE_OPTIONS="--dns-result-order=ipv4first"` to Dockerfiles
- This forces Node.js to prefer IPv4, avoiding GCP's IPv6 routing issues
- HTTP requests that were hanging indefinitely now complete in milliseconds

## Current Status

### ✅ WORKING (9 modules)
1. `breach_directory_probe` - 1322ms (was 1174ms)
2. `shodan_scan` - 1239ms (was 1095ms)
3. `denial_wallet_scan` - 32ms (was 20ms)
4. `abuse_intel_scan` - 70ms (was 58ms)
5. `lightweight_cve_check` - 65ms (was 53ms)
6. `backend_exposure_scanner` - 18ms (stable)
7. `client_secret_scanner` - 18ms (stable)
8. `whois_wrapper` - 1084ms (stable - buffer fix still working)
9. `spf_dmarc` - 5-7 seconds (stable - buffer fix still working)

### ⚠️ PARTIALLY FIXED (1 module)
- **`endpointDiscovery`** - HTTP requests now work (146ms response times!)
  - ✅ Robots.txt parsing works
  - ✅ Sitemap parsing works
  - ✅ Initial crawlPage request completes
  - ❌ Module still times out overall (needs investigation into what happens after initial crawl)

### ⚠️ INCONSISTENT (1 module)
- `tls_scan` - Still inconsistent
  - Spawn() implementation helped but needs hard timeout
  - IPv6 fix may have improved reliability (needs testing)

### ❌ BROKEN - HIGH PRIORITY (5 modules)
1. **`techStackScan`** - WebTech fails with directory error: `/home/scanner/.local/share/webtech`
2. **`configExposureScanner`** - Unknown cause (needs logging)
3. **`aiPathFinder`** - OpenAI API calls likely still hanging (needs timeout config)
4. **`documentExposure`** - Serper API calls likely still hanging (needs timeout config)
5. **`assetCorrelator`** - Depends on other broken modules

### 🚫 MOVED TO TIER 2
- `accessibility_scan` - Too slow for Tier 1

## Current Deployment
- **Service**: scanner-service-00041-7jw
- **Region**: us-central1
- **Project**: precise-victory-467219-s4
- **Latest changes**: 
  - NODE_OPTIONS IPv6 fix applied
  - Debug endpoint added at `/debug/network-test`
  - Enhanced logging in endpointDiscovery

## What We Fixed in This Session
1. **Confirmed IPv6 hypothesis** - Added debug endpoint that proved IPv6 was the issue
2. **Applied NODE_OPTIONS fix** - Forces IPv4 DNS resolution, fixing the network hangs
3. **Added detailed logging** - endpointDiscovery now logs request timing
4. **Deployed successfully** - New image built and deployed to Cloud Run

## CRITICAL: COMPREHENSIVE LOGGING PLAN

**IMPORTANT**: Each broken module currently has ONLY ONE console.log at the start. This is completely inadequate for debugging. The following logging MUST be added to EVERY module listed below.

### Logging Requirements for ALL Modules
Every module needs AT MINIMUM these log points:
1. **START** - When module begins (ALREADY EXISTS)
2. **EACH MAJOR STEP** - Before/after each significant operation
3. **API CALLS** - Before making, after receiving response
4. **ERRORS** - Catch blocks with full error details
5. **COMPLETION** - When module finishes with timing
6. **TIMEOUTS** - When operations are taking too long

### Module-Specific Logging Plan

#### 1. techStackScan.ts
```typescript
// Line 165 - After target discovery
console.log(`[techStackScan] Target discovery complete: ${targetResult.total} targets found`);

// Line 170-180 - Before each detection method
console.log(`[techStackScan] Starting WebTech detection...`);
// After WebTech
console.log(`[techStackScan] WebTech complete: ${results.length} technologies found`);

console.log(`[techStackScan] Starting WhatWeb detection...`);
// After WhatWeb
console.log(`[techStackScan] WhatWeb complete: ${results.length} technologies found`);

console.log(`[techStackScan] Starting header detection...`);
// After headers
console.log(`[techStackScan] Header detection complete: ${results.length} technologies found`);

console.log(`[techStackScan] Starting favicon detection...`);
// After favicon
console.log(`[techStackScan] Favicon detection complete: ${results.length} technologies found`);

// Before vulnerability check
console.log(`[techStackScan] Starting vulnerability enrichment for ${techs.length} technologies...`);

// At the end
console.log(`[techStackScan] COMPLETE in ${Date.now() - start}ms with ${allDetections.length} technologies`);
```

#### 2. configExposureScanner.ts
```typescript
// Add after each path check
console.log(`[configExposureScanner] Checking ${paths.length} config paths...`);

// In each request
console.log(`[configExposureScanner] Checking path: ${path}`);

// After request
console.log(`[configExposureScanner] Path ${path} returned status ${status}`);

// At completion
console.log(`[configExposureScanner] COMPLETE: Found ${exposures.length} exposures in ${Date.now() - start}ms`);
```

#### 3. aiPathFinder.ts
```typescript
// Before OpenAI call
console.log(`[aiPathFinder] Preparing OpenAI request for ${domain}...`);

// After OpenAI call
console.log(`[aiPathFinder] OpenAI response received in ${Date.now() - apiStart}ms`);

// For each discovered path
console.log(`[aiPathFinder] AI suggested path: ${path}`);

// At completion
console.log(`[aiPathFinder] COMPLETE: Found ${paths.length} AI-suggested paths in ${Date.now() - start}ms`);
```

#### 4. documentExposure.ts
```typescript
// Before Serper call
console.log(`[documentExposure] Calling Serper API for ${domain}...`);

// After Serper call
console.log(`[documentExposure] Serper returned ${results.length} results in ${Date.now() - serperStart}ms`);

// For each document found
console.log(`[documentExposure] Found document: ${docUrl} (${docType})`);

// At completion
console.log(`[documentExposure] COMPLETE: Found ${documents.length} exposed documents in ${Date.now() - start}ms`);
```

#### 5. assetCorrelator.ts
```typescript
// Log which modules it's waiting for
console.log(`[assetCorrelator] Waiting for data from: ${missingModules.join(', ')}`);

// Log what data is available
console.log(`[assetCorrelator] Available data from: ${availableModules.join(', ')}`);

// During correlation
console.log(`[assetCorrelator] Correlating ${assets.length} assets...`);

// At completion
console.log(`[assetCorrelator] COMPLETE: Correlated ${correlations.length} assets in ${Date.now() - start}ms`);
```

#### 6. tlsScan.ts (INCONSISTENT)
```typescript
// Before spawn
console.log(`[tlsScan] Starting sslscan process for ${domain}...`);

// On data received
console.log(`[tlsScan] Received ${data.length} bytes from sslscan`);

// On timeout
console.log(`[tlsScan] WARNING: sslscan timeout after 30s, killing process`);

// On completion
console.log(`[tlsScan] sslscan completed in ${Date.now() - start}ms`);

// At module completion
console.log(`[tlsScan] COMPLETE: Found ${vulnerabilities.length} TLS issues in ${Date.now() - start}ms`);
```

#### 7. endpointDiscovery.ts (PARTIALLY WORKING)
```typescript
// After crawlPage line 878
console.log(`[endpointDiscovery] crawlPage returned, discovered ${discovered.size} endpoints so far`);

// Before bruteForce line 886
console.log(`[endpointDiscovery] Starting bruteForce enumeration...`);

// After bruteForce line 892
console.log(`[endpointDiscovery] bruteForce complete, total endpoints: ${discovered.size}`);

// Before visibility check
console.log(`[endpointDiscovery] Starting visibility check for ${discovered.size} endpoints...`);

// After visibility check
console.log(`[endpointDiscovery] Visibility check complete`);

// Before return
console.log(`[endpointDiscovery] COMPLETE: Returning ${discovered.size} endpoints in ${Date.now() - start}ms`);
```

### Implementation Instructions

1. **DO NOT SKIP ANY MODULE**
2. Add EVERY log listed above
3. Use consistent format: `[moduleName] message`
4. Include timing information where relevant
5. Log both successes AND failures
6. Make sure to log BEFORE and AFTER async operations

### Verification Commands
After adding logging, verify with:
```bash
# Check log count per module (should be >5 for each)
for module in techStackScan configExposureScanner aiPathFinder documentExposure assetCorrelator tlsScan endpointDiscovery; do 
  echo "$module: $(grep -c "console.log" apps/workers/modules/$module.ts)"
done
```

## NEXT STEPS - DO THESE IN ORDER

### 1. Add comprehensive logging (45 min)
Implement ALL logging listed above. DO NOT SKIP ANY MODULE.

### 2. Fix techStackScan WebTech error (5 min)
```bash
# In Dockerfile.worker and Dockerfile.scanner-service, add after line 63:
RUN mkdir -p /home/scanner/.local/share/webtech && \
    chown -R scanner:scanner /home/scanner/.local
```

### 3. Deploy and analyze logs (15 min)
Deploy with new logging and run a test scan to see EXACTLY where each module fails.

## Testing Commands

### Test IPv6 fix (should complete quickly now):
```bash
curl -s "https://scanner-service-w6v7pps5wa-uc.a.run.app/debug/network-test?domain=openai.com"
```

### Deploy and Test
```bash
# Build
npm run build:workers

# Deploy (already has NODE_OPTIONS fix)
gcloud builds submit --config=cloudbuild-worker.yaml --project=precise-victory-467219-s4

# Force new revision if needed
gcloud run deploy scanner-service \
  --image=us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-service:latest \
  --region=us-central1 \
  --project=precise-victory-467219-s4

# Test scan
curl -X POST https://scanner-service-w6v7pps5wa-uc.a.run.app/tasks/scan \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "vulnerable-test-site.vercel.app",
    "scan_id": "test-'$(date +%s)'",
    "companyName": "Test"
  }' --max-time 60

# Check module timings
gcloud logging read "resource.type=cloud_run_revision AND textPayload:TIMING" \
  --project=precise-victory-467219-s4 --limit=20 --format="table(timestamp,textPayload)"

# Check endpointDiscovery specifically
gcloud logging read "resource.type=cloud_run_revision AND textPayload:endpointDiscovery" \
  --project=precise-victory-467219-s4 --limit=20 --format="table(timestamp,textPayload)"
```

## Key Files Modified
1. `/Users/ryanheger/dealbrief-scanner/Dockerfile.worker` - Added NODE_OPTIONS
2. `/Users/ryanheger/dealbrief-scanner/Dockerfile.scanner-service` - Added NODE_OPTIONS
3. `/Users/ryanheger/dealbrief-scanner/apps/workers/server.ts` - Added debug endpoint
4. `/Users/ryanheger/dealbrief-scanner/apps/workers/modules/endpointDiscovery.ts` - Added detailed logging

## Success Criteria
- ✅ HTTP requests complete without hanging
- ✅ At least 9 modules working reliably
- ⚠️ All 16 Tier 1 modules complete in < 30 seconds total (PARTIAL)
- ⚠️ endpointDiscovery completes and finds endpoints (PARTIAL - requests work)
- ❌ Zero timeouts in normal operation (still have overall timeout)

## Critical Discovery
**The IPv6 issue was THE root cause**. Gemini's analysis was correct - GCP prefers IPv6 but the egress path doesn't support it properly, causing silent TCP hangs. The NODE_OPTIONS fix forces IPv4 and immediately resolved the networking issues. This explains why it worked on Fly.io (IPv4 default) but failed on GCP (IPv6 default).

## Notes for Next Session
1. The core networking is fixed - modules can now make HTTP requests
2. Focus on module-specific issues (missing directories, API timeouts, logic bugs)
3. Don't remove NODE_OPTIONS - it's critical for GCP Cloud Run
4. The httpClient already has good timeout handling with undici
5. Some modules may have logic issues beyond just networking

