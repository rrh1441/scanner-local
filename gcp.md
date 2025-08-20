# GCP Architecture & Binary Management

## Overview

DealBrief Scanner runs on Google Cloud Platform using a **serverless, containerized architecture** with Cloud Run Jobs. The system manages a comprehensive suite of security tools and binaries through Docker container images and automated deployment pipelines.

## Architecture Components

### 🏗️ **Core Infrastructure**

```
┌─────────────────────────────────────────────────────────────────┐
│                      GCP PROJECT                                │
│                 precise-victory-467219-s4                      │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │   Pub/Sub       │    │   Cloud Run      │    │ Secret     │ │
│  │   Topic:        │───▶│   Job:           │◄───│ Manager    │ │
│  │   scan-jobs     │    │   scanner-job    │    │            │ │
│  └─────────────────┘    └──────────────────┘    └────────────┘ │
│           │                       │                            │
│           │              ┌─────────────────┐                   │
│           │              │   Cloud Build   │                   │
│           │              │   (CI/CD)       │                   │
│           │              └─────────────────┘                   │
│           │                       │                            │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │   Eventarc      │    │   Artifact       │    │ Firestore  │ │
│  │   Trigger       │    │   Registry       │    │ Database   │ │
│  │   scan-trigger  │    │   (Docker Images)│    │            │ │
│  └─────────────────┘    └──────────────────┘    └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 📦 **Container Architecture**

The system uses **multi-stage Docker builds** with three main container types:

1. **scanner-worker** - Main security scanning engine
2. **scanner-api** - REST API for scan management  
3. **scanner-reports** - Report generation service

## Binary Management & Tool Installation

### 🔧 **Security Tools Inventory**

The `Dockerfile.worker` manages installation of all security tools:

#### **System Tools (Alpine APK)**
```dockerfile
RUN apk add --no-cache \
    bash curl wget git python3 py3-pip unzip \
    chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont libx11 libxcomposite libxdamage \
    gcompat bind-tools nmap
```

- **nmap**: Network mapping and port scanning
- **dig/bind-tools**: DNS resolution and analysis
- **chromium**: Headless browser for accessibility and dynamic testing
- **python3**: Runtime for custom security scripts

#### **SSL/TLS Tools**
```dockerfile
# Try Alpine package first, fallback to static binary
RUN apk add --no-cache sslscan || \
    (wget -O /usr/local/bin/sslscan https://github.com/rbsec/sslscan/releases/download/2.0.15/sslscan-2.0.15-static-linux-x86_64 && \
     chmod +x /usr/local/bin/sslscan)
```

- **sslscan v2.0.15**: SSL/TLS configuration analysis
- **Custom Python validator**: `/apps/workers/scripts/tls_verify.py` for certificate validation

#### **Vulnerability Scanners**
```dockerfile
# Nuclei - Latest vulnerability scanner
ARG NUCLEI_VERSION=3.4.5
RUN curl -L https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip -o nuclei.zip && \
    unzip nuclei.zip && mv nuclei /usr/local/bin/ && rm nuclei.zip && \
    chmod +x /usr/local/bin/nuclei && \
    nuclei -update-templates

# TruffleHog - Secret detection
ARG TRUFFLEHOG_VERSION=3.83.7
RUN curl -sSL https://github.com/trufflesecurity/trufflehog/releases/download/v${TRUFFLEHOG_VERSION}/trufflehog_${TRUFFLEHOG_VERSION}_linux_amd64.tar.gz | \
    tar -xz -C /usr/local/bin trufflehog
```

- **nuclei v3.4.5**: Vulnerability scanner with auto-updating templates
- **trufflehog v3.83.7**: Git secret scanning

#### **Python Security Libraries**
```dockerfile
RUN pip3 install --no-cache-dir --break-system-packages \
    dnstwist python-whois webtech
```

- **dnstwist**: Domain typosquatting detection
- **python-whois**: WHOIS data collection  
- **webtech**: Technology stack detection

### 📁 **File Structure in Container**

```
/app/
├── node_modules/                    # Node.js dependencies
├── apps/
│   └── workers/
│       ├── dist/                    # Compiled TypeScript
│       │   └── worker-pubsub.js     # Main entry point
│       ├── node_modules/            # Worker-specific dependencies
│       ├── templates/               # Scanning templates
│       ├── scripts/                 # Python security scripts
│       │   └── tls_verify.py       # Custom TLS validation
│       └── modules/                 # Security modules
│           └── *.py                # Python helper scripts
/usr/local/bin/
├── nuclei                          # Vulnerability scanner
├── trufflehog                      # Secret scanner  
└── sslscan                         # SSL/TLS scanner
/usr/bin/
├── nmap                           # Network mapper
├── dig                            # DNS lookup
├── chromium-browser               # Headless browser
└── python3                        # Python runtime
```

## Deployment Pipeline

### 🚀 **Cloud Build CI/CD**

#### **Build Configuration** (`cloudbuild-all.yaml`)
```yaml
steps:
  # Parallel Docker builds with caching
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-worker'
    args: [
      'buildx', 'build',
      '--cache-from', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:cache',
      '--cache-to', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:cache,mode=max',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:latest',
      '-f', 'Dockerfile.worker',
      '--push', '.'
    ]
```

**Key Features:**
- **Layer caching**: Speeds up builds by reusing unchanged layers
- **Multi-architecture support**: Uses `buildx` for advanced Docker features
- **Parallel builds**: All containers build simultaneously
- **Automatic deployment**: Updates Cloud Run Jobs with new images

#### **Build Performance**
- **Machine Type**: `E2_HIGHCPU_8` (8 vCPU, optimized for compilation)
- **Timeout**: 30 minutes (1800s)
- **Registry**: Artifact Registry in `us-central1`

### 🔄 **Deployment Process**

1. **Code Push** → GitHub triggers Cloud Build
2. **Multi-stage Build**:
   - Stage 1: Compile TypeScript with pnpm
   - Stage 2: Install security tools and create runtime image
3. **Image Push** → Artifact Registry
4. **Service Update** → Cloud Run Job automatically updated
5. **Health Check** → Verify deployment success

### 📋 **Manual Deployment Commands**

```bash
# Quick worker-only deployment
gcloud builds submit --config cloudbuild-worker-only.yaml

# Full system deployment  
gcloud builds submit --config cloudbuild-all.yaml

# Emergency manual deployment
./run-gcp-setup.sh
```

## Runtime Environment

### ⚡ **Cloud Run Job Configuration**

```yaml
Job: scanner-job
Region: us-central1
Resources:
  Memory: 6Gi
  CPU: 4 vCPU
  Timeout: 45 minutes
  Max Retries: 1
  Parallelism: 1
```

### 🔐 **Security & IAM**

#### **Service Account**: `scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com`

**Permissions:**
- **Secret Manager**: Access to API keys (Shodan, OpenAI, etc.)
- **Firestore**: Read/write scan results and findings
- **Pub/Sub**: Receive scan job messages
- **Cloud Storage**: Store scan artifacts (if needed)

#### **Secret Management**
```bash
# Secrets stored in Secret Manager:
- SHODAN_API_KEY
- OPENAI_API_KEY  
- SERPER_KEY
- CENSYS_PAT
- ABUSEIPDB_API_KEY
- LEAKCHECK_API_KEY
- CAPTCHA_API_KEY
- WHOXY_API_KEY
```

### 🌐 **Network & Security**

- **VPC**: Default GCP VPC with outbound internet access
- **Firewall**: Managed by Cloud Run (no inbound access)
- **TLS**: All API communication over HTTPS
- **Container Security**: Non-root user (`scanner:1001`)

## Tool Execution Architecture

### 🛠️ **Binary Execution Pattern**

Each security tool is executed via Node.js child processes:

```typescript
// Example: nmap execution
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function runNmap(target: string): Promise<string> {
  const { stdout } = await exec('nmap', [
    '-sS', '-O', '-sV', 
    '--script=default',
    target
  ], { timeout: 30000 });
  
  return stdout;
}
```

### 🔧 **Tool Integration Points**

| Tool | Purpose | Integration Method | Timeout |
|------|---------|-------------------|---------|
| **nmap** | Port scanning | `child_process.execFile()` | 30s |
| **nuclei** | Vulnerability scanning | `child_process.execFile()` | 90s |
| **sslscan** | SSL/TLS analysis | `child_process.execFile()` | 15s |
| **dig** | DNS resolution | `child_process.execFile()` | 5s |
| **chromium** | Browser automation | Puppeteer library | 120s |
| **python3** | Custom scripts | `child_process.execFile()` | 15s |
| **trufflehog** | Secret scanning | `child_process.execFile()` | 60s |

### 🚦 **Error Handling & Resilience**

```typescript
// Robust tool execution with error handling
async function executeWithTimeout<T>(
  toolName: string,
  command: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    command(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${toolName} timeout`)), timeoutMs)
    )
  ]);
}
```

## Performance & Monitoring

### 📊 **Resource Usage**

**Container Metrics** (during scan):
- **Memory**: ~2-4GB peak (6GB allocated)
- **CPU**: 2-4 cores active (4 allocated) 
- **Network**: ~50MB data transfer per scan
- **Disk**: ~2GB (read-only container + temp files)

### 📈 **Scaling Characteristics**

- **Cold Start**: ~15-30 seconds (container initialization)
- **Warm Start**: ~2-5 seconds (reused container)
- **Concurrent Scans**: 1 per job instance (controlled by Pub/Sub)
- **Auto-scaling**: Cloud Run manages instance scaling

### 🔍 **Logging & Observability**

**Structured Logging**:
```typescript
// Centralized logging with scan correlation
log(`[${toolName}] STARTING - scan_id=${scanId}`);
log(`[${toolName}] COMPLETED - duration=${duration}ms scan_id=${scanId}`);
log(`[${toolName}] ERROR - ${error.message} scan_id=${scanId}`);
```

**Monitoring Commands**:
```bash
# View recent job executions
gcloud run jobs executions list --job=scanner-job --region=us-central1

# Monitor real-time logs
gcloud logging tail "resource.type=cloud_run_job"

# Check job status
gcloud run jobs describe scanner-job --region=us-central1
```

## Disaster Recovery & Maintenance

### 🔄 **Backup & Recovery**

- **Container Images**: Stored in Artifact Registry with version tags
- **Configuration**: Infrastructure as Code (deployment scripts)
- **Secrets**: Managed by Secret Manager (encrypted, versioned)
- **Data**: Firestore provides automatic backups

### 🛠️ **Maintenance Procedures**

#### **Tool Updates**
```dockerfile
# Update tool versions in Dockerfile.worker
ARG NUCLEI_VERSION=3.4.5  # ← Update version
ARG TRUFFLEHOG_VERSION=3.83.7  # ← Update version

# Trigger rebuild
gcloud builds submit --config cloudbuild-worker-only.yaml
```

#### **Emergency Rollback**
```bash
# Rollback to previous image
gcloud run jobs update scanner-job \
    --image=us-central1-docker.pkg.dev/precise-victory-467219-s4/dealbrief/scanner-worker:PREVIOUS_SHA \
    --region=us-central1
```

### 🚨 **Health Monitoring**

**Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1
```

**Alerting**: Cloud Run automatically restarts unhealthy containers

## Cost Optimization

### 💰 **Resource Costs**

**Estimated Monthly Costs** (100 scans/day):
- **Cloud Run**: ~$50-80/month (6GB RAM, 4 CPU)
- **Artifact Registry**: ~$5-10/month (image storage)
- **Cloud Build**: ~$10-20/month (CI/CD)
- **Firestore**: ~$10-25/month (scan results)
- **Secret Manager**: ~$1-5/month (API keys)
- **Total**: ~$80-140/month

### ⚡ **Optimization Strategies**

1. **Right-sizing**: Use minimum required resources per job
2. **Cold start reduction**: Keep one instance warm during business hours
3. **Image optimization**: Multi-stage builds minimize final image size
4. **Caching**: Aggressive Docker layer caching reduces build time

---

## Quick Reference

### 🚀 **Common Commands**

```bash
# Deploy latest code
gcloud builds submit --config cloudbuild-worker-only.yaml

# Execute test scan  
gcloud run jobs execute scanner-job --region=us-central1

# View logs
gcloud logging read "resource.type=cloud_run_job" --limit=50

# Check job status
gcloud run jobs describe scanner-job --region=us-central1

# Update configuration
gcloud run jobs update scanner-job --set-env-vars="NEW_VAR=value"
```

### 📞 **Troubleshooting**

| Issue | Solution |
|-------|----------|
| Tool not found | Check `Dockerfile.worker` installation |
| Permission denied | Verify service account IAM roles |
| Timeout errors | Adjust tool timeout values |
| Out of memory | Increase job memory allocation |
| Cold starts | Consider keeping warm instances |

---

*Last updated: 2025-08-08*  
*Architecture: Serverless containerized security scanning on GCP*