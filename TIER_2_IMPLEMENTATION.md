# Tier 2 Deep Security Scanning - Implementation Reference

This document outlines how to implement Tier 2 deep security scanning with its own dedicated API endpoint.

## Current Status

**Tier 1** (Implemented): Passive reconnaissance and safe discovery
- Rate limiting: ✅ Header analysis only (no active testing)
- Duration: ~3 minutes
- Authorization: None required

**Tier 2** (Not Implemented): Active security testing and deep analysis
- Rate limiting: 🔄 Would include active rate limit bypass testing
- Duration: ~15-20 minutes  
- Authorization: Required

## API Endpoint Design

### New Endpoint: `POST /api/scans/deep`

**Purpose**: Separate endpoint for authorized deep security scanning

**Request Body**:
```json
{
  "companyName": "Example Corp",
  "domain": "example.com",
  "authorization": {
    "type": "explicit_consent",
    "authorizer": "security@example.com",
    "scope": ["vulnerability_testing", "active_probing"],
    "timestamp": "2025-07-02T16:00:00Z"
  },
  "options": {
    "includeActiveTests": true,
    "zapScanLevel": "baseline", // "baseline" | "full" | "api"
    "maxDuration": 1200,        // seconds (20 minutes)
    "skipModules": ["db_port_scan"] // optional exclusions
  }
}
```

**Response**:
```json
{
  "scanId": "tier2_abc123def456",
  "status": "queued",
  "tier": "TIER_2",
  "estimatedDuration": "15-20 minutes",
  "modules": {
    "total": 20,
    "tier1": 12,
    "tier2_additional": 8
  },
  "authorization": {
    "verified": true,
    "scope": ["vulnerability_testing", "active_probing"]
  }
}
```

## Implementation Files

### 1. API Route Handler
**File**: `/apps/api/routes/deepScan.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { DeepScanQueue } from '../core/deepScanQueue.js';

export async function deepScanRoutes(fastify: FastifyInstance) {
  // POST /api/scans/deep
  fastify.post('/deep', {
    schema: {
      body: {
        type: 'object',
        required: ['companyName', 'domain', 'authorization'],
        properties: {
          companyName: { type: 'string', minLength: 1 },
          domain: { type: 'string', pattern: '^[a-zA-Z0-9.-]+$' },
          authorization: {
            type: 'object',
            required: ['type', 'authorizer'],
            properties: {
              type: { type: 'string', enum: ['explicit_consent', 'signed_contract'] },
              authorizer: { type: 'string', format: 'email' },
              scope: { type: 'array', items: { type: 'string' } },
              timestamp: { type: 'string', format: 'date-time' }
            }
          },
          options: {
            type: 'object',
            properties: {
              includeActiveTests: { type: 'boolean', default: true },
              zapScanLevel: { type: 'string', enum: ['baseline', 'full', 'api'], default: 'baseline' },
              maxDuration: { type: 'number', minimum: 600, maximum: 3600, default: 1200 },
              skipModules: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { companyName, domain, authorization, options } = request.body;
    
    // Validate authorization
    const authResult = await validateDeepScanAuthorization(authorization, domain);
    if (!authResult.valid) {
      return reply.code(403).send({
        error: 'AUTHORIZATION_REQUIRED',
        message: 'Deep scanning requires explicit authorization',
        details: authResult.reason
      });
    }
    
    // Create deep scan job
    const scanId = `tier2_${generateId()}`;
    const job = {
      id: scanId,
      tier: 'TIER_2',
      companyName,
      domain,
      authorization: authResult,
      options: options || {},
      createdAt: new Date().toISOString()
    };
    
    // Queue the job
    await DeepScanQueue.enqueue(job);
    
    // Log authorization for audit
    await logDeepScanAuthorization(scanId, authorization);
    
    return {
      scanId,
      status: 'queued',
      tier: 'TIER_2',
      estimatedDuration: '15-20 minutes',
      modules: {
        total: 20,
        tier1: 12,
        tier2_additional: 8
      },
      authorization: {
        verified: true,
        scope: authorization.scope
      }
    };
  });
}
```

### 2. Deep Scan Worker
**File**: `/apps/workers/deepWorker.ts`

```typescript
import { config } from 'dotenv';
import { DeepScanQueue } from './core/deepScanQueue.js';
import { initializeDatabase } from './core/artifactStore.js';
import { processTier2Scan } from './core/tier2Processor.js';

config();

const deepQueue = new DeepScanQueue(process.env.REDIS_URL!);

async function startDeepWorker() {
  log('Starting Tier 2 Deep Security Worker');
  
  // Validate required environment
  const requiredEnvVars = [
    'SHODAN_API_KEY',
    'ZAP_API_KEY', 
    'NUCLEI_TEMPLATES_PATH'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      log(`ERROR: ${envVar} not configured - cannot run Tier 2 scans`);
      process.exit(1);
    }
  }
  
  await initializeDatabase();
  
  // Main processing loop
  while (!isShuttingDown) {
    try {
      const job = await deepQueue.getNextJob();
      
      if (job && !isShuttingDown) {
        log(`Processing Tier 2 scan job: ${job.id}`);
        await processTier2Scan(job);
      } else {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s wait
      }
      
    } catch (error) {
      if (!isShuttingDown) {
        log('Deep worker error:', (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30s backoff
      }
    }
  }
}

startDeepWorker().catch(error => {
  log('CRITICAL: Failed to start deep worker:', (error as Error).message);
  process.exit(1);
});
```

### 3. Tier 2 Processor
**File**: `/apps/workers/core/tier2Processor.ts`

```typescript
// All Tier 1 modules + Tier 2 specific modules
const TIER_2_MODULES = [
  // Tier 1 modules (inherited)
  'dns_twist', 'document_exposure', 'shodan', 'breach_directory_probe',
  'endpoint_discovery', 'tech_stack_scan', 'abuse_intel_scan', 
  'accessibility_scan', 'nuclei', 'tls_scan', 'spf_dmarc', 'trufflehog',
  
  // Tier 2 exclusive modules
  'censys',                    // Re-enabled for deep scans
  'zap_scan',                  // Active web app testing
  'rate_limit_scan',           // Active rate limit testing  
  'db_port_scan',              // Database exposure testing
  'denial_wallet_scan',        // Cost amplification testing
  'rdp_vpn_templates',         // RDP/VPN security testing
  'email_bruteforce_surface'   // Email infrastructure testing
];

export async function processTier2Scan(job: Tier2ScanJob): Promise<void> {
  const { id: scanId, companyName, domain, options } = job;
  
  log(`🚨 TIER 2 DEEP SCAN: ${companyName} (${domain}) - AUTHORIZED ACTIVE TESTING`);
  
  // Apply module filters based on options
  const activeModules = TIER_2_MODULES.filter(module => {
    if (options.skipModules?.includes(module)) return false;
    return true;
  });
  
  log(`[${scanId}] 🎯 Tier 2 Deep Scan: ${activeModules.length} modules`);
  
  // Set scan timeout based on options
  const maxDuration = options.maxDuration || 1200; // 20 minutes default
  const scanTimeout = setTimeout(() => {
    log(`[${scanId}] ⏰ Tier 2 scan timeout reached: ${maxDuration}s`);
    // Implement graceful scan termination
  }, maxDuration * 1000);
  
  try {
    // Phase 1: All independent modules (parallel)
    const independentModules = activeModules.filter(m => 
      !['tech_stack_scan', 'abuse_intel_scan', 'nuclei', 'zap_scan', 'rate_limit_scan', 'denial_wallet_scan'].includes(m)
    );
    
    // Phase 2: Endpoint-dependent modules (after discovery)
    const dependentModules = activeModules.filter(m => 
      ['tech_stack_scan', 'abuse_intel_scan', 'nuclei', 'zap_scan', 'rate_limit_scan', 'denial_wallet_scan'].includes(m)
    );
    
    // Execute with enhanced logging and authorization tracking
    await executeTier2Modules(scanId, domain, companyName, independentModules, dependentModules, options);
    
  } finally {
    clearTimeout(scanTimeout);
  }
}
```

### 4. Authorization Validation
**File**: `/apps/api/core/authValidator.ts`

```typescript
export interface AuthorizationResult {
  valid: boolean;
  reason?: string;
  scope: string[];
  auditId: string;
}

export async function validateDeepScanAuthorization(
  auth: DeepScanAuthorization, 
  domain: string
): Promise<AuthorizationResult> {
  
  // Check authorization type
  if (!['explicit_consent', 'signed_contract'].includes(auth.type)) {
    return { valid: false, reason: 'Invalid authorization type', scope: [], auditId: '' };
  }
  
  // Validate authorizer email domain matches target domain
  const authorizerDomain = auth.authorizer.split('@')[1];
  if (authorizerDomain !== domain) {
    return { 
      valid: false, 
      reason: 'Authorizer must be from target domain', 
      scope: [], 
      auditId: '' 
    };
  }
  
  // Check scope requirements
  const requiredScopes = ['vulnerability_testing'];
  const hasRequiredScopes = requiredScopes.every(scope => 
    auth.scope?.includes(scope)
  );
  
  if (!hasRequiredScopes) {
    return { 
      valid: false, 
      reason: 'Missing required authorization scopes', 
      scope: [], 
      auditId: '' 
    };
  }
  
  // Generate audit ID
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    valid: true,
    scope: auth.scope || [],
    auditId
  };
}
```

## Deployment Configuration

### Environment Variables
```bash
# Tier 2 specific variables
ZAP_API_URL=http://localhost:8080
ZAP_API_KEY=your_zap_api_key
NUCLEI_FULL_TEMPLATES=true
TIER_2_MAX_DURATION=1800
TIER_2_RATE_LIMIT_TESTING=true

# Authorization
DEEP_SCAN_LOG_LEVEL=info
AUDIT_LOG_RETENTION_DAYS=90
```

### Fly.toml Changes
```toml
[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["api"]
  protocol = "tcp"
  script_checks = []

[[services]]
  internal_port = 3001  
  processes = ["deep-worker"]  # New deep worker process
  protocol = "tcp"

[processes]
  api = "npm run start:api"
  worker = "npm run start:worker" 
  deep-worker = "npm run start:deep-worker"  # New process
```

## Usage Examples

### Basic Tier 2 Scan
```bash
curl -X POST https://api.dealbrief.com/api/scans/deep \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Example Corp",
    "domain": "example.com",
    "authorization": {
      "type": "explicit_consent",
      "authorizer": "security@example.com",
      "scope": ["vulnerability_testing", "active_probing"],
      "timestamp": "2025-07-02T16:00:00Z"
    }
  }'
```

### Advanced Tier 2 Scan with Options
```bash
curl -X POST https://api.dealbrief.com/api/scans/deep \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Example Corp", 
    "domain": "example.com",
    "authorization": {
      "type": "signed_contract",
      "authorizer": "ciso@example.com",
      "scope": ["vulnerability_testing", "active_probing", "database_testing"]
    },
    "options": {
      "zapScanLevel": "full",
      "maxDuration": 1800,
      "skipModules": ["db_port_scan"]
    }
  }'
```

## Security Considerations

### 1. Authorization Audit Trail
- All Tier 2 scans logged with full authorization details
- Audit logs retained for 90 days minimum
- Email verification for authorizers

### 2. Rate Limiting
- Tier 2 scans limited to 1 per domain per hour
- Organization-wide limits: 5 concurrent Tier 2 scans
- API key required for Tier 2 endpoint access

### 3. Notification System
```typescript
// Notify target organization of deep scan initiation
await sendDeepScanNotification({
  domain,
  authorizer: authorization.authorizer,
  scanId,
  estimatedDuration: '15-20 minutes',
  modules: activeModules.length
});
```

## Testing Strategy

### 1. Staging Environment
```bash
# Test Tier 2 against controlled targets
POST /api/scans/deep
{
  "domain": "vulnerable-test-app.staging.com",
  "authorization": { ... }
}
```

### 2. Module-by-Module Validation
- Test each Tier 2 module independently
- Validate authorization requirements
- Verify audit logging

### 3. Performance Benchmarks
- Target: 15-20 minute completion
- Memory: <2GB peak usage
- Concurrent scans: 3 max per worker

---

**Implementation Priority**:
1. API endpoint + basic authorization ✅
2. Deep worker + Tier 2 processor ✅  
3. Authorization validation + audit logging ✅
4. ZAP integration + advanced modules 🔄
5. Performance optimization + monitoring 🔄

This gives you a complete roadmap for implementing Tier 2 as a separate, authorized endpoint with its own worker process and enhanced security testing capabilities.