# Tier 2 Scanner Implementation Guide

## Overview
This guide applies all lessons learned from Tier 1 implementation to set up Tier 2 scans efficiently. Tier 2 modules perform deeper, more resource-intensive security scanning that builds upon Tier 1 findings.

## Module Organization

### Tier 1 Modules (Fast scan, <5 minutes):
Currently Active:
1. **shodan** - Shodan API scanning
2. **breach_directory_probe** - Breach data lookup (via LeakCheck)
3. **document_exposure** - Public document discovery
4. **endpoint_discovery** - Web endpoint enumeration
5. **tls_scan** - TLS/SSL configuration check
6. **spf_dmarc** - Email security configuration
7. **config_exposure** - Configuration file exposure
8. **nuclei** - Vulnerability scanning (lightweight mode)
9. **tech_stack_scan** - Technology stack detection
10. **abuse_intel_scan** - Abuse intelligence lookup
11. **client_secret_scanner** - Exposed credentials detection
12. **backend_exposure_scanner** - Backend service enumeration
13. **accessibility_scan** - WCAG compliance check
14. **asset_correlator** - Final correlation of all findings

To Add to Tier 1:
- **denial_wallet_scan** - Cloud cost exploitation detection
- **ai_path_finder** - AI-powered intelligent path discovery (informs other modules)
- **whois_wrapper** - RDAP + Whoxy domain registration data

### Tier 2 Modules (Deep scan, 10-15 minutes):
1. **nuclei** - Full/intensive vulnerability scanning with all templates
2. **dns_twist** - Domain permutation and typosquatting detection
3. **adversarial_media_scan** - Media monitoring for brand/security mentions
4. **censys** - Internet-wide scan data and certificate transparency
5. **trufflehog** - Secret scanning in repositories and web assets
6. **zap_scan** - OWASP ZAP security scanner
7. **web_archive_scanner** - Historical website analysis
8. **openvas_scan** - OpenVAS vulnerability scanner
9. **db_port_scan** - Database port and service scanning
10. **email_bruteforce_surface** - Email service detection (OWA, Exchange, IMAP)
11. **rate_limit_scan** - Authentication rate limit bypass testing
12. **rdp_vpn_templates** - RDP/VPN vulnerability detection

### Deprecated/Cut Modules:
- **spider_foot** - Replaced by better individual modules
- **target_discovery** - Redundant with endpointDiscovery
- **cve_verifier** - Helper module for lightweightCveCheck

## Architecture Design (Lessons from Tier 1)

### 1. Separate Service Deployment
Create a dedicated `scanner-tier2-service` to isolate resource-intensive operations:

```yaml
# Cloud Run Configuration
service: scanner-tier2-service
memory: 4Gi  # Higher memory for intensive modules
cpu: 2        # More CPU for parallel processing
timeout: 600s # 10 minutes for longer scans
concurrency: 1 # Prevent resource contention
min-instances: 0 # Scale to zero
max-instances: 5 # Limited scaling for cost control
```

### 2. Triggering Mechanism

#### Option A: Chain from Tier 1 Completion
```javascript
// In tier1 scanner completion handler
async function onTier1Complete(scanId) {
  // Write tier1 completion to Firestore
  await firestore.collection('scans').doc(scanId).update({
    tier1_status: 'completed',
    tier1_completed_at: new Date(),
    tier2_status: 'pending'
  });
  
  // Trigger tier2 via Pub/Sub
  await pubsub.topic('scan-tier2-jobs').publish({
    scanId,
    tier1Results: summary,
    trigger: 'tier1-completion'
  });
}
```

#### Option B: Scheduled Batch Processing
```yaml
# Cloud Scheduler for off-peak processing
schedule: "0 2 * * *"  # 2 AM daily
timezone: "America/New_York"
target:
  type: pubsub
  topic: scan-tier2-batch
```

### 3. Module-Specific Optimizations

#### DNS Twist (Lightweight but API-intensive)
```javascript
// Batch domain checks to reduce API calls
const batchSize = 50;
const permutations = generatePermutations(domain);
for (let i = 0; i < permutations.length; i += batchSize) {
  const batch = permutations.slice(i, i + batchSize);
  await Promise.all(batch.map(checkDomain));
}
```

#### Censys (API-based scanning)
```javascript
// Use Censys API for certificate and host data
const censysClient = new CensysAPI({
  apiId: process.env.CENSYS_API_ID,
  apiSecret: process.env.CENSYS_API_SECRET
});

// Query certificates and hosts
const results = await Promise.all([
  censysClient.searchCertificates(domain),
  censysClient.searchHosts(domain),
  censysClient.searchWebsites(domain)
]);
```

#### AI Path Finder (OpenAI Rate Limits)
```javascript
// Implement exponential backoff and caching
const cache = new Map();
async function aiAnalyze(endpoint) {
  if (cache.has(endpoint)) return cache.get(endpoint);
  
  try {
    const result = await openai.complete({
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,  // Lower for consistency
      max_tokens: 500    // Limit response size
    });
    cache.set(endpoint, result);
    return result;
  } catch (err) {
    if (err.status === 429) {
      await sleep(Math.pow(2, retryCount) * 1000);
      return aiAnalyze(endpoint);
    }
  }
}
```

## Implementation Steps

### Step 1: Create Tier 2 Service Infrastructure

```bash
# 1. Create the service
gcloud run deploy scanner-tier2-service \
  --image=us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-tier2:latest \
  --region=us-central1 \
  --memory=4Gi \
  --cpu=2 \
  --timeout=600 \
  --max-instances=5 \
  --min-instances=0 \
  --service-account=scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
  --set-env-vars="NODE_OPTIONS=--dns-result-order=ipv4first,TIER=2" \
  --no-allow-unauthenticated

# 2. Set up secrets (reuse existing ones)
gcloud run services update scanner-tier2-service \
  --update-secrets=OPENAI_API_KEY=openai-api-key:latest,\
SERPER_KEY=serper-key:latest,\
WHOXY_API_KEY=whoxy-api-key:latest,\
CENSYS_PAT=censys-api-token:latest \
  --region=us-central1

# 3. Create Pub/Sub topic for tier 2
gcloud pubsub topics create scan-tier2-jobs \
  --project=precise-victory-467219-s4

# 4. Create Eventarc trigger
gcloud eventarc triggers create scanner-tier2-trigger \
  --location=us-central1 \
  --service-account=scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
  --destination-run-service=scanner-tier2-service \
  --destination-run-region=us-central1 \
  --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" \
  --transport-topic=scan-tier2-jobs
```

### Step 2: Update Worker Code for Tier 2

```typescript
// apps/workers/worker-tier2.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { tier2Modules } from './modules/tier2';

const firestore = getFirestore();

export async function processTier2Scan(scanId: string, domain: string) {
  const scan = await firestore.collection('scans').doc(scanId).get();
  const tier1Results = scan.data()?.tier1Results || {};
  
  // Update status
  await firestore.collection('scans').doc(scanId).update({
    tier2_status: 'processing',
    tier2_started_at: new Date()
  });

  const moduleResults = {};
  const moduleOrder = [
    // Quick modules first
    'dns_twist',
    'censys',
    
    // Medium duration
    'adversarial_media_scan',
    'email_bruteforce_surface',
    'rate_limit_scan',
    
    // Long running
    'nuclei',  // Full intensive mode
    'trufflehog',
    'web_archive_scanner',
    'db_port_scan',
    'rdp_vpn_templates',
    'zap_scan',
    'openvas_scan'
  ];

  for (const moduleName of moduleOrder) {
    try {
      console.log(`[tier2] Starting ${moduleName} for ${domain}`);
      const startTime = Date.now();
      
      // Pass tier1 results to tier2 modules for context
      const result = await tier2Modules[moduleName].execute({
        domain,
        scanId,
        tier1Context: tier1Results
      });
      
      moduleResults[moduleName] = {
        success: true,
        duration: Date.now() - startTime,
        findings: result
      };
      
      // Stream results to Firestore
      await firestore.collection('findings').add({
        scanId,
        module: moduleName,
        tier: 2,
        findings: result,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error(`[tier2] Module ${moduleName} failed:`, error);
      moduleResults[moduleName] = {
        success: false,
        error: error.message
      };
    }
  }

  // Final update
  await firestore.collection('scans').doc(scanId).update({
    tier2_status: 'completed',
    tier2_completed_at: new Date(),
    tier2_results: moduleResults
  });
}
```

### Step 3: Module Configuration

```javascript
// apps/workers/modules/tier2/config.ts
export const tier2Config = {
  dns_twist: {
    maxPermutations: 500,
    checkMX: true,
    checkNS: true,
    whoisLookup: true,
    screenshotSuspicious: true
  },
  
  censys: {
    apiId: process.env.CENSYS_API_ID,
    apiSecret: process.env.CENSYS_API_SECRET,
    searchTypes: ['certificates', 'hosts', 'websites'],
    maxResults: 100,
    includeHistorical: true
  },
  
  adversarial_media_scan: {
    searchEngines: ['google', 'bing', 'duckduckgo'],
    keywords: ['breach', 'hack', 'vulnerability', 'exposed', 'leak'],
    maxResults: 50,
    includeSocialMedia: true,
    sentiment: true
  },
  
  ai_path_finder: {
    model: 'gpt-4-turbo-preview',
    maxEndpoints: 100,
    discoveryPatterns: [
      '/api/*',
      '/admin/*',
      '/internal/*',
      '/.git/*',
      '/backup/*',
      '/graphql',
      '/.well-known/*'
    ],
    deeperThanTier1: true  // Go beyond endpointDiscovery module
  },
  
  accessibility_scan: {
    standards: ['WCAG2AA', 'Section508'],
    includeWarnings: true,
    screenshotViolations: true,
    maxPagesToScan: 10
  }
};
```

### Step 4: Rate Limiting and Resource Management

```typescript
// apps/workers/util/rateLimiter.ts
class RateLimiter {
  private queues = new Map<string, Array<() => Promise<any>>>();
  private processing = new Map<string, boolean>();
  
  constructor(private limits: Record<string, number>) {}
  
  async execute<T>(service: string, fn: () => Promise<T>): Promise<T> {
    if (!this.queues.has(service)) {
      this.queues.set(service, []);
    }
    
    return new Promise((resolve, reject) => {
      this.queues.get(service)!.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      
      this.process(service);
    });
  }
  
  private async process(service: string) {
    if (this.processing.get(service)) return;
    this.processing.set(service, true);
    
    const queue = this.queues.get(service)!;
    const limit = this.limits[service] || 1;
    const delay = 1000 / limit; // ms between requests
    
    while (queue.length > 0) {
      const batch = queue.splice(0, 1);
      await Promise.all(batch.map(fn => fn()));
      await new Promise(r => setTimeout(r, delay));
    }
    
    this.processing.set(service, false);
  }
}

export const rateLimiter = new RateLimiter({
  openai: 10,      // 10 req/sec
  serper: 100,     // 100 req/sec  
  whoxy: 5,        // 5 req/sec
  censys: 2        // 2 req/sec (API limits)
});
```

### Step 5: Monitoring and Alerting

```yaml
# monitoring/tier2-alerts.yaml
apiVersion: monitoring.googleapis.com/v1
kind: AlertPolicy
metadata:
  name: tier2-scanner-alerts
spec:
  conditions:
    - displayName: "Tier 2 Module Timeout"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          resource.labels.service_name="scanner-tier2-service"
          textPayload=~"Module .* timeout"
        comparison: COMPARISON_GT
        thresholdValue: 5
        duration: 300s
        
    - displayName: "High Memory Usage"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          metric.type="run.googleapis.com/container/memory/utilizations"
        comparison: COMPARISON_GT
        thresholdValue: 0.9
        duration: 60s
```

## Deployment Checklist

### Pre-deployment:
- [ ] Create Dockerfile for tier2 with all Python dependencies
- [ ] Build and push tier2 image to Artifact Registry
- [ ] Verify all tier2 modules compile and load
- [ ] Test each module individually with timeout handling

### Infrastructure:
- [ ] Deploy scanner-tier2-service to Cloud Run
- [ ] Create scan-tier2-jobs Pub/Sub topic
- [ ] Set up Eventarc trigger
- [ ] Configure secrets and environment variables
- [ ] Set up monitoring and alerts

### Integration:
- [ ] Update tier1 completion to trigger tier2
- [ ] Add tier2 status fields to Firestore schema
- [ ] Update API to return tier2 status
- [ ] Add tier2 progress to frontend UI

### Testing:
- [ ] Test single module execution
- [ ] Test full tier2 pipeline
- [ ] Verify Firestore writes
- [ ] Check memory usage under load
- [ ] Validate rate limiting

## Cost Optimization

### 1. Use Spot/Preemptible Instances
```yaml
# For batch processing
gcloud run jobs create scanner-tier2-batch \
  --parallelism=5 \
  --task-timeout=30m \
  --cpu=2 \
  --memory=4Gi
```

### 2. Implement Caching
```javascript
// Cache expensive operations
const cache = new NodeCache({ 
  stdTTL: 3600,  // 1 hour
  checkperiod: 120 
});

// Cache WHOIS lookups
if (cache.has(`whois:${domain}`)) {
  return cache.get(`whois:${domain}`);
}
```

### 3. Schedule for Off-Peak
```javascript
// Run intensive scans during low-cost hours
const schedule = {
  highPriority: 'immediately',
  normal: 'within-1-hour',
  low: 'next-batch-window'  // 2 AM
};
```

## Troubleshooting Guide

### Common Issues:

1. **Module Timeouts**
   - Increase Cloud Run timeout
   - Implement module-level timeouts
   - Break large operations into chunks

2. **Memory Exhaustion**
   - Increase service memory
   - Implement streaming for large datasets
   - Clear caches between modules

3. **API Rate Limits**
   - Implement exponential backoff
   - Use rate limiter utility
   - Cache API responses

4. **Python Module Issues**
   - Ensure all pip packages in Dockerfile
   - Set PYTHONUNBUFFERED=1
   - Use subprocess for isolation

## Success Metrics

### Performance Targets:
- **dns_twist**: < 2 minutes
- **censys**: < 1 minute
- **adversarial_media_scan**: < 2 minutes
- **ai_path_finder**: < 3 minutes
- **accessibility_scan**: < 2 minutes
- **Total Tier 2**: < 10 minutes

### Quality Metrics:
- Zero module crashes
- < 5% timeout rate
- > 95% scan completion
- All findings persisted to Firestore

## Next Steps

1. **Immediate** (Week 1):
   - Deploy tier2 service infrastructure
   - Test dns_twist and client_secret_scanner
   - Set up basic monitoring

2. **Short-term** (Week 2-3):
   - Integrate all tier2 modules
   - Implement rate limiting
   - Add progress tracking

3. **Long-term** (Month 2):
   - Optimize for cost
   - Add ML-based prioritization
   - Implement custom scanning profiles

## Lessons Learned Applied

### From Tier 1 Implementation:
1. ✅ **Use undici instead of axios** - Already migrated all modules
2. ✅ **Implement fast-ack pattern** - Prevent Cloud Run timeouts
3. ✅ **Module isolation** - Each module in try/catch
4. ✅ **Stream results** - Write to Firestore as we go
5. ✅ **Proper timeout handling** - Multiple timeout stages
6. ✅ **IPv4 preference** - NODE_OPTIONS=--dns-result-order=ipv4first
7. ✅ **Service account permissions** - Reuse existing scanner-worker-sa
8. ✅ **Secret management** - Use Secret Manager for all keys
9. ✅ **Eventarc over Cloud Tasks** - Better for Pub/Sub integration
10. ✅ **Scale to zero** - Cost optimization for sporadic load

### New Considerations for Tier 2:
1. **Higher resource requirements** - 4Gi memory, 2 CPU
2. **Longer timeouts needed** - 10 minutes vs 3 minutes
3. **Sequential module execution** - Prevent resource contention
4. **Tier 1 context passing** - Use previous findings
5. **Batch processing option** - For non-urgent scans

## Contact & Support

For issues or questions about Tier 2 implementation:
- Check logs: `gcloud logging read "resource.labels.service_name=scanner-tier2-service"`
- Monitor metrics: Cloud Run console
- Review this guide for troubleshooting steps