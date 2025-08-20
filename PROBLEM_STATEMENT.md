# Critical Issue: Scanner Modules Hanging on IPv6 DNS Resolution

## Context
We have a Cloud Run service (Node.js) that executes security scanning modules. Some modules shell out to external binaries (httpx, sslscan, dig, nuclei) using Node's `child_process.execFile()`.

## The Problem
**Modules that use subprocess calls hang indefinitely** while pure Node.js modules work fine.

### Working Modules (100-1400ms completion):
- client_secret_scanner (pure Node.js)
- backend_exposure_scanner (pure Node.js)  
- lightweight_cve_check (pure Node.js)
- abuse_intel_scan (uses axios HTTP client)
- denial_wallet_scan (pure Node.js)

### Hanging Modules:
- **techStackScan**: Calls `httpx` binary via execFile, hangs after "Starting httpx detection"
- **tlsScan**: Calls `sslscan` binary via spawn, hangs
- **spfDmarc**: Calls `dig` binary via execFile, hangs
- **nuclei**: Calls `nuclei` binary, doesn't even start

## Root Cause Hypothesis
GCP Cloud Run prefers IPv6. When binaries try to resolve DNS, they attempt AAAA (IPv6) lookups first, which hang indefinitely. Node.js has `NODE_OPTIONS="--dns-result-order=ipv4first"` set, but **subprocess binaries don't inherit this**.

## Failed Solution Attempt
Added `-4` flag to force IPv4:
```javascript
// In fastTechDetection.ts
const { stdout } = await exec('httpx', [
  '-u', url,
  '-4',            // FORCE IPv4 - but httpx doesn't support this flag!
  '-td',           
  '-json',         
  '-timeout', '10',
  '-silent',       
  '-no-color'      
], {
  timeout: 15000,
  killSignal: 'SIGKILL'
});
```

**Problem: httpx doesn't have a `-4` flag.** We need the correct flags for each tool.

## Required Solution
Need the CORRECT IPv4-only flags for:
1. **httpx** - What flag forces IPv4-only? 
2. **sslscan** - Does `--ipv4` work or different flag?
3. **dig** - Is it `-4` or `+noaaaa` or something else?
4. **nuclei** - What flag forces IPv4?

## Alternative Solutions?
1. Can we set DNS resolution order at the container/OS level?
2. Should we use a different approach than subprocess?
3. Can we pre-resolve domains to IPv4 and pass IPs instead?

## Code Locations
- `/apps/workers/util/fastTechDetection.ts` - httpx calls
- `/apps/workers/modules/tlsScan.ts` - sslscan calls
- `/apps/workers/modules/spfDmarc.ts` - dig calls

Please provide the EXACT, TESTED flags that will force IPv4-only resolution for these tools.