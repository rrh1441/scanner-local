# Module-by-Module Debugging Guide

All security scanning modules worked perfectly on Fly.io but are having issues on Google Cloud Platform. This guide provides systematic debugging for each module to identify and fix the root causes.

## Overview

**Current Problem**: 5+ minute execution time vs 3-minute Fly.io baseline  
**Primary Suspect**: Firestore validation errors blocking writes  
**Secondary Suspects**: Network latency, resource constraints, timeout issues

## Active Modules (15 total)

### Immediate Parallel Start (8 modules)
1. `breach_directory_probe` 
2. `shodan`
3. `dns_twist`
4. `document_exposure`
5. `endpoint_discovery`
6. `tls_scan`
7. `spf_dmarc`
8. `config_exposure_scanner`
9. `accessibility_scan`

### After Endpoint Discovery (6 modules)
10. `nuclei`
11. `tech_stack_scan`
12. `abuse_intel_scan`
13. `client_secret_scanner`
14. `backend_exposure_scanner`
15. `asset_correlator` (final)

## Module Debugging Framework

### Phase 1: Identify Failing Modules

#### 1.1 Extract Module-Specific Logs
```bash
# For each module, check its logs
MODULE_NAME="shodan"  # Replace with actual module name

gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scanner-job AND textPayload:\"[$MODULE_NAME]\"" --limit=50 --format="table(timestamp,textPayload)" --project=precise-victory-467219-s4 --freshness=1h
```

#### 1.2 Module Success/Failure Pattern
Look for these patterns in logs:
- ✅ **Success**: `[$MODULE_NAME] Done — X findings/results`
- ❌ **Firestore Error**: `Failed to insert finding: Error: Value for argument "data" is not a valid Firestore document`
- ⏳ **Timeout**: No completion message after expected time
- 🔌 **Network Error**: Connection or API failures

### Phase 2: Systematic Module Analysis

## Module 1: breach_directory_probe

**Function**: Searches BreachDirectory and LeakCheck for compromised credentials  
**Expected Runtime**: 2-5 seconds  
**Dependencies**: External APIs (BreachDirectory, LeakCheck)

### Debug Commands
```bash
# Check module logs
gcloud logging read "textPayload:\"[breach_directory_probe]\" OR textPayload:\"[breachDirectoryProbe]\"" --limit=20 --project=precise-victory-467219-s4

# Test API connectivity
curl -H "X-API-KEY: $LEAKCHECK_API_KEY" "https://leakcheck.io/api/public"
```

### Common Issues
- **API Key Issues**: Check `leakcheck-api-key` secret
- **Rate Limiting**: API throttling causing delays
- **Firestore Writes**: Undefined fields in finding objects

---

## Module 2: shodan

**Function**: Discovers internet-exposed services using Shodan API  
**Expected Runtime**: 2-5 seconds  
**Dependencies**: Shodan API

### Debug Commands
```bash
# Check logs - we saw this working
gcloud logging read "textPayload:\"[Shodan]\"" --limit=10 --project=precise-victory-467219-s4

# Test Shodan API
curl -H "Authorization: Bearer $SHODAN_API_KEY" "https://api.shodan.io/shodan/host/count?query=domain:example.com"
```

### Status: ✅ WORKING
From logs: `[Shodan] Done — 0 services found, 0 unique after deduplication, 0 API calls for 1 targets`

---

## Module 3: dns_twist

**Function**: Finds typosquatted domains for phishing detection  
**Expected Runtime**: 30-60 seconds  
**Dependencies**: dnstwist tool, DNS resolution

### Debug Commands
```bash
# Check logs
gcloud logging read "textPayload:\"[dns_twist]\" OR textPayload:\"[dnsTwist]\"" --limit=20 --project=precise-victory-467219-s4

# Test dnstwist tool availability
gcloud run jobs execute test-dnstwist --region=us-central1 --project=precise-victory-467219-s4 --args="dnstwist --help"
```

### Common Issues
- **Tool Installation**: dnstwist binary not in container
- **DNS Timeouts**: Slow DNS resolution on GCP
- **Memory Usage**: Large wordlists causing OOM

---

## Module 4: document_exposure

**Function**: Searches for accidentally exposed documents via Google dorking  
**Expected Runtime**: 15-30 seconds  
**Dependencies**: Google Custom Search API

### Debug Commands
```bash
# Check logs
gcloud logging read "textPayload:\"[document_exposure]\" OR textPayload:\"[documentExposure]\"" --limit=20 --project=precise-victory-467219-s4

# Test Google Search API (if used)
# Check for API quota limits
```

### Common Issues
- **Google API Limits**: Search quota exceeded
- **User-Agent Blocking**: Google blocking automated requests
- **Parsing Errors**: HTML parsing failures

---

## Module 5: endpoint_discovery

**Function**: Discovers web endpoints, APIs, and hidden paths  
**Expected Runtime**: 30-45 seconds  
**Dependencies**: HTTP crawling, JavaScript parsing

### Debug Commands
```bash
# Check logs - we saw this working
gcloud logging read "textPayload:\"[endpointDiscovery]\"" --limit=20 --project=precise-victory-467219-s4
```

### Status: ✅ WORKING  
From logs: Found Supabase backend and web assets

---

## Module 6: spf_dmarc

**Function**: Evaluates email security configuration  
**Expected Runtime**: 1-3 seconds  
**Dependencies**: DNS resolution

### Debug Commands
```bash
# Check logs - we saw Firestore errors here
gcloud logging read "textPayload:\"[spfDmarc]\" OR textPayload:\"[spf_dmarc]\"" --limit=20 --project=precise-victory-467219-s4
```

### Status: ❌ FAILING - Firestore Issues
**Error**: `Cannot use "undefined" as a Firestore value (found in field "repro_command")`

**Fix Required**: 
```typescript
// In spfDmarc.ts, ensure all fields are defined
const finding = {
  type: 'spf_dmarc_issue',
  severity: 'medium',
  title: 'SPF/DMARC Configuration Issue',
  description: dmarcIssue || 'No description available',
  repro_command: reproCommand || null, // Change undefined to null
  // ... other fields
};
```

---

## Module 7: nuclei

**Function**: Vulnerability scanning with Nuclei templates  
**Expected Runtime**: 20-40 seconds (Tier 1)  
**Dependencies**: endpoint_discovery, nuclei binary

### Debug Commands
```bash
# Check logs
gcloud logging read "textPayload:\"[nuclei]\"" --limit=30 --project=precise-victory-467219-s4

# Test nuclei installation
gcloud run jobs execute test-nuclei --region=us-central1 --project=precise-victory-467219-s4 --args="nuclei --version"
```

### Common Issues
- **Binary Missing**: nuclei not installed in container
- **Template Updates**: Outdated templates causing failures
- **Memory Limits**: Large template sets hitting memory limits
- **Timeout Issues**: 20s timeout too aggressive for GCP

---

## Phase 3: Firestore Debugging

### Root Cause Analysis
The primary issue appears to be Firestore validation errors. All modules write findings to Firestore, and undefined values are causing failures.

### 3.1 Identify Undefined Fields
```bash
# Search for all Firestore errors
gcloud logging read "textPayload:\"Cannot use \\\"undefined\\\" as a Firestore value\"" --limit=50 --project=precise-victory-467219-s4

# Look for specific field names causing issues
gcloud logging read "textPayload:\"found in field\"" --limit=20 --project=precise-victory-467219-s4
```

### 3.2 Common Undefined Fields
From the error we saw:
- `repro_command`: Often undefined when no command available
- `confidence`: May be undefined when not calculated
- `metadata`: Could be undefined for some finding types
- `artifacts`: May be undefined when no artifacts present

### 3.3 Fix Firestore Writes
**Location**: `apps/workers/core/artifactStoreGCP.ts`

```typescript
// Add field validation before Firestore write
function sanitizeFinding(finding: any): any {
  const sanitized = { ...finding };
  
  // Convert undefined to null for all fields
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      sanitized[key] = null;
    }
  });
  
  // Ensure required fields exist
  sanitized.repro_command = sanitized.repro_command || null;
  sanitized.confidence = sanitized.confidence || 0;
  sanitized.metadata = sanitized.metadata || {};
  sanitized.artifacts = sanitized.artifacts || [];
  
  return sanitized;
}

// Update insertFinding function
export async function insertFinding(scanId: string, finding: Finding): Promise<void> {
  try {
    const sanitizedFinding = sanitizeFinding(finding);
    await db.collection('findings').add({
      scan_id: scanId,
      ...sanitizedFinding,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to insert finding:', error);
    // Continue execution - don't let Firestore errors stop scanning
  }
}
```

## Phase 4: Performance Optimization

### 4.1 Resource Scaling Test
```bash
# Increase job resources
gcloud run jobs update scanner-job \
  --region=us-central1 \
  --memory=6Gi \
  --cpu=4 \
  --project=precise-victory-467219-s4

# Test with more resources
gcloud run jobs execute scanner-job --region=us-central1 --project=precise-victory-467219-s4
```

### 4.2 Timeout Optimization
**Location**: `apps/workers/modules/tierConfig.ts`

Compare GCP vs Fly.io timeouts:
```typescript
// Reduce timeouts for GCP environment
export const ENDPOINT_DISCOVERY_CONFIG = {
  tier1: {
    requestTimeout: 5000,     // Increase from 3000
    maxConcurrentRequests: 8, // Reduce from 12 
    // ... other settings
  }
};
```

### 4.3 Parallel Execution Verification
Ensure modules actually run in parallel:
```bash
# Check if multiple modules log simultaneously
gcloud logging read "resource.type=cloud_run_job" --limit=100 --format="table(timestamp,textPayload)" --project=precise-victory-467219-s4 | grep -E "\[(shodan|endpointDiscovery|spfDmarc)\]"
```

## Phase 5: Module-Specific Fixes

### 5.1 High Priority Fixes
1. **spf_dmarc**: Fix undefined `repro_command` field
2. **nuclei**: Verify binary installation and timeout settings
3. **accessibility_scan**: Check Puppeteer/browser setup in GCP
4. **dns_twist**: Verify dnstwist tool availability

### 5.2 Medium Priority Investigation
5. **document_exposure**: Google API quota and rate limiting
6. **tech_stack_scan**: Dependency detection reliability
7. **abuse_intel_scan**: AbuseIPDB API connectivity
8. **client_secret_scanner**: LLM integration timeouts

### 5.3 Low Priority (Likely Working)
9. **breach_directory_probe**: API integration
10. **config_exposure_scanner**: File detection
11. **backend_exposure_scanner**: Cloud service detection
12. **asset_correlator**: Data aggregation

## Testing Protocol

### Individual Module Testing
```bash
# Create isolated module test
echo '{
  "scanId": "test-module-' + MODULE_NAME + '",
  "companyName": "Test",
  "domain": "example.com"
}' | gcloud pubsub topics publish scan-jobs --message=-

# Monitor specific module
gcloud logging read "textPayload:\"[' + MODULE_NAME + ']\"" --follow --project=precise-victory-467219-s4
```

### Success Criteria Per Module
- **Execution Time**: <expected runtime from MODULE_REFERENCE.md
- **Clean Logs**: No error messages or undefined value issues
- **Findings Stored**: Proper Firestore writes without validation errors
- **Resource Usage**: No memory/CPU limits hit

## Quick Fix Implementation Order

1. **Immediate**: Fix Firestore undefined field handling (affects all modules)
2. **Short Term**: Increase job resources (4 CPU, 6GB RAM) for performance
3. **Medium Term**: Module-specific timeout and configuration tuning
4. **Long Term**: Infrastructure optimization and monitoring improvements

---

**Goal**: Achieve <3 minute scan completion matching Fly.io performance
**Success Metric**: All 15 modules complete successfully with proper error handling