# Nuclei Module Recommendation

## Current Implementation Analysis

### What Nuclei Does
The nuclei module is a comprehensive vulnerability scanner that performs:

1. **Two-Pass Scanning**:
   - **Pass 1 - Baseline Scan** (45s timeout):
     - Basic vulnerability detection
     - Technology fingerprinting
     - Common misconfigurations
   
   - **Pass 2 - Deep Scan** (90s timeout):
     - Technology-specific vulnerabilities
     - Common vulnerability patterns
     - Potentially uses headless browser for JavaScript-heavy sites

2. **Additional Features**:
   - CVE-specific verification
   - Custom workflow execution for detected technologies
   - EPSS score integration for CVE prioritization
   - Parallel scanning with concurrency control

### Current Performance Issues
- **Total Time**: Up to 135+ seconds minimum (45s baseline + 90s deep scan)
- **Resource Usage**: Can spawn headless Chrome instances
- **Complexity**: Runs extensive template sets

## Recommendation: Split Between Tiers

### Keep in Tier 1: Baseline Nuclei Scan
Create a lightweight version that ONLY runs the baseline scan:
- **Timeout**: 30-45 seconds max
- **Templates**: Only critical/high severity baseline templates
- **Purpose**: Quick vulnerability detection
- **Expected Time**: 15-30 seconds

### Move to Tier 2: Full Nuclei Scan
The complete two-pass scan with all features:
- **All current functionality**
- **Technology-specific scanning**
- **Workflow execution**
- **CVE verification**
- **Headless browser scanning**
- **Expected Time**: 2-5 minutes

## Implementation Approach

### Option 1: Create Separate Functions (Recommended)
```typescript
// For Tier 1
export async function runNucleiBaseline(job: NucleiJob): Promise<number> {
  // Only run baseline scan with strict timeout
  return runBaselineScan(job.domain, job.scanId, 30000);
}

// For Tier 2  
export async function runNucleiFull(job: NucleiJob): Promise<number> {
  // Run complete two-pass scan with workflows
  return runNuclei(job);
}
```

### Option 2: Add Tier Parameter
```typescript
export async function runNuclei(job: NucleiJob & { tier?: 'tier1' | 'tier2' }): Promise<number> {
  if (job.tier === 'tier1') {
    // Only baseline scan
    return runBaselineScan(job.domain, job.scanId, 30000);
  }
  // Full scan for tier2
  return runFullScan(job);
}
```

## Benefits of This Approach

1. **Tier 1 Performance**: Reduces scan time from 2+ minutes to <30 seconds
2. **Still Valuable**: Baseline scan catches critical vulnerabilities quickly
3. **Scalability**: Tier 1 can handle more concurrent scans
4. **Depth When Needed**: Tier 2 provides comprehensive coverage

## Quick Wins vs Deep Analysis

### Tier 1 - Quick Wins (Baseline)
- SQL injection patterns
- XSS vulnerabilities
- Exposed sensitive files
- Basic misconfigurations
- Technology detection

### Tier 2 - Deep Analysis (Full)
- Technology-specific CVEs
- Complex workflow-based vulnerabilities
- JavaScript-rendered content scanning
- Comprehensive template coverage
- Advanced attack patterns

## Action Items

1. **Modify nuclei.ts** to expose separate functions for baseline vs full scan
2. **Update worker.ts** to use baseline version for Tier 1
3. **Configure tier2 worker** to use full nuclei scan
4. **Set appropriate timeouts**: 30s for Tier 1, 5 minutes for Tier 2
5. **Test both modes** to ensure proper separation

## Expected Impact

- **Tier 1 scan time**: Reduce from timeout/hang to ~3-4 minutes total
- **Tier 1 reliability**: No more timeouts from nuclei
- **Tier 2 value**: Comprehensive security analysis when needed
- **User experience**: Fast initial results, deep scan available on demand