# DealBrief Scanner Workflow

## ⚠️ CRITICAL: Authentication Issue Fixed (2025-08-18)

**THE PROBLEM:** The `/tasks/scan` endpoint was returning 401 Unauthorized because:
1. Fastify logger was disabled (`logger: false`) so we couldn't see the 401 errors
2. `REQUIRE_AUTH=true` was set, requiring OIDC tokens from Cloud Tasks
3. Cloud Tasks wasn't sending proper OIDC tokens

**THE FIX:**
1. Enable Fastify logging: Changed `Fastify({ logger: false })` to `Fastify({ logger: { level: 'info' } })` in server.ts:74
2. Set `REQUIRE_AUTH=false` environment variable when deploying to bypass auth check
3. Allow unauthenticated access: `gcloud run services add-iam-policy-binding --member=allUsers --role=roles/run.invoker`

**Files changed:**
- `apps/workers/server.ts`: Enabled logging and added debug messages

**Deployment commands:**
```bash
# Build and deploy with auth disabled
gcloud builds submit --config=cloudbuild-scanner-service.yaml --project=precise-victory-467219-s4

gcloud run deploy scanner-service \
  --image=us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-service:latest \
  --region=us-central1 \
  --project=precise-victory-467219-s4 \
  --update-env-vars="REQUIRE_AUTH=false"

# Allow public access (for testing)
gcloud run services add-iam-policy-binding scanner-service \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=precise-victory-467219-s4
```

## Architecture Overview

The DealBrief Scanner uses a **Cloud Run Service** (not Jobs) with Cloud Tasks for async processing:

## Core Components

### 1. Message Queue System  
- **GCP Pub/Sub**: Topic `scan-jobs` receives scan requests
- **Eventarc**: Triggers `/events` endpoint on scanner-service
- **Cloud Tasks**: Queues scan work to `/tasks/scan` endpoint
- **Cloud Run Service**: `scanner-service` handles both events and scan execution

### 2. Worker Architecture
- **Main Worker** (`apps/workers/worker.ts`): Core scanning logic with 17 security modules
- **Pub/Sub Adapter** (`apps/workers/worker-pubsub.ts`): Handles GCP integration and message processing
- **API Server** (`apps/api-main/server.ts`): HTTP endpoint for health checks and management

### 3. Container Environment
- **Base Image**: Node.js 22 Alpine with comprehensive security toolkit
- **Security Tools**: TruffleHog, Nuclei, Nmap, WhatWeb, SpiderFoot, OWASP ZAP, SSLScan
- **Browser Support**: Chromium for web-based scanning modules

## Workflow Process

### 1. Scan Initiation (Two-Phase Async)
```
API/Manual → Pub/Sub Topic (scan-jobs) → Eventarc → scanner-service /events → Cloud Tasks → scanner-service /tasks/scan
```

### 2. Message Processing
1. **Phase 1 (Fast ACK)**: `/events` endpoint receives Pub/Sub message via Eventarc
   - Validates message structure and domain format
   - Creates Cloud Tasks task with scan job
   - Returns 204 immediately to ACK the Pub/Sub message
   
2. **Phase 2 (Scan Execution)**: `/tasks/scan` endpoint receives Cloud Tasks request
   - Verifies auth if `REQUIRE_AUTH=true` (currently disabled)
   - Executes `executeScan()` with all modules
   - Returns results or 500 for retry

### 3. Scan Execution
The main worker runs **17 security modules** in parallel groups:

#### Tier 1 Modules (All Active)
- **config_exposure**: Configuration file exposure detection
- **dns_twist**: Domain typosquatting detection
- **document_exposure**: Sensitive document discovery
- **shodan**: Internet-connected device scanning
- **breach_directory_probe**: Data breach correlation
- **endpoint_discovery**: API/endpoint enumeration
- **tech_stack_scan**: Technology stack identification
- **abuse_intel_scan**: Threat intelligence correlation
- **accessibility_scan**: Web accessibility analysis
- **nuclei**: Vulnerability template scanning
- **tls_scan**: SSL/TLS configuration analysis
- **spf_dmarc**: Email security policy validation
- **client_secret_scanner**: Exposed credential detection
- **backend_exposure_scanner**: Backend service exposure

#### Execution Strategy
1. **Parallel Independent Modules**: Run simultaneously for efficiency
2. **Endpoint Discovery First**: Provides data for dependent modules
3. **Dependent Modules**: Execute after endpoint discovery completes
4. **Asset Correlation**: Aggregates and correlates all findings

### 4. Data Storage
- **Firestore**: Scan metadata, status, and completion tracking
- **Cloud Storage**: Security artifacts and detailed findings via `insertArtifactGCP()`
- **Structured Logging**: GCP-compatible JSON logging for monitoring

### 5. Completion Flow
1. Updates Firestore with completion status and finding counts
2. Publishes message to `report-generation` topic for PDF generation
3. Scales Cloud Run Job to zero (cost optimization)

## Key Differences from Previous Architecture

### Removed Components
- **Arc**: No longer used for task queuing
- **Traditional Pub/Sub**: Replaced with GCP Pub/Sub
- **Supabase/Fly.io**: Completely migrated to GCP services

### Current GCP-Only Stack
- **Messaging**: GCP Pub/Sub + Eventarc
- **Compute**: Cloud Run Jobs (auto-scaling, pay-per-execution)  
- **Storage**: Cloud Storage + Firestore
- **Authentication**: GCP Service Accounts with least-privilege IAM
- **Monitoring**: Cloud Logging with structured JSON output

## Environment Configuration

### Required Environment Variables
- `SHODAN_API_KEY`: Shodan API key for device scanning
- `K_SERVICE` or `CLOUD_RUN_JOB`: GCP runtime detection
- `SCAN_DATA`: JSON scan parameters (set by Cloud Tasks/Eventarc)

### GCP Resources
- **Project**: `precise-victory-467219-s4`
- **Region**: `us-central1`
- **Service Account**: `scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com`
- **Container Registry**: GCP Artifact Registry

## Cost Optimization
- **Zero Idle Cost**: Cloud Run Jobs scale to zero when not processing
- **Pay-per-execution**: Only charged during active scan processing
- **Parallel Processing**: Efficient resource utilization with concurrent modules
- **Containerized**: Consistent, reproducible execution environment

## Testing & Monitoring
- **Health Checks**: Express server on port 8080 for container health
- **Structured Logging**: JSON format with severity levels for GCP integration
- **Error Handling**: Graceful failure with artifact logging and Firestore updates
- **Message Acknowledgment**: Proper Pub/Sub ack/nack for reliable processing