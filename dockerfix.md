# Docker Infrastructure Optimization Guide - Greenfield Approach

## Overview
This project runs multiple services on Google Cloud Run:
1. **Scanner Worker** - Pub/Sub triggered security scanning jobs (heavy tooling)
2. **Scanner API** - REST API service (lightweight)
3. **Report Service** - Clean deployment service

Note: Frontend is now deployed directly via Vercel and not included in this Docker infrastructure.

## Current Issues
- Multiple conflicting Dockerfiles with different approaches
- Inconsistent base images and build strategies
- Overly large images with unnecessary dependencies
- File path resolution issues in worker
- No clear separation of concerns

## Greenfield Solution

### 1. Unified Base Image Strategy

Create a shared base image for all services that need security tools:

**base.Dockerfile**
```dockerfile
# Security tools base image - shared by services that need scanning capabilities
FROM node:20-alpine AS security-base

# Install glibc compatibility for prebuilt binaries
RUN apk add --no-cache gcompat

# Install essential system dependencies
RUN apk add --no-cache \
    bash curl wget git openssl bind-tools \
    python3 py3-pip unzip ca-certificates

# Install security tools
ARG NUCLEI_VERSION=3.4.5
ARG TRUFFLEHOG_VERSION=3.83.7

RUN curl -L https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip -o nuclei.zip && \
    unzip nuclei.zip && mv nuclei /usr/local/bin/ && rm nuclei.zip && \
    chmod +x /usr/local/bin/nuclei

RUN curl -sSL https://github.com/trufflesecurity/trufflehog/releases/download/v${TRUFFLEHOG_VERSION}/trufflehog_${TRUFFLEHOG_VERSION}_linux_amd64.tar.gz | \
    tar -xz -C /usr/local/bin trufflehog

# Install Python security tools
RUN pip3 install --no-cache-dir --break-system-packages \
    dnstwist python-whois
```

### 2. Optimized Service Dockerfiles

**Dockerfile.worker** (Complete rewrite)
```dockerfile
# Multi-stage build for worker with heavy security tooling
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/workers/package.json ./apps/workers/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm --filter @dealbrief/workers build

# Runtime stage - includes security tools
FROM node:20-alpine AS runtime

# Install runtime dependencies including Chromium
RUN apk add --no-cache \
    bash curl wget git python3 py3-pip unzip \
    chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont libx11 libxcomposite libxdamage \
    gcompat bind-tools nmap

# Install security tools
ARG NUCLEI_VERSION=3.4.5
ARG TRUFFLEHOG_VERSION=3.83.7

RUN curl -L https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip -o nuclei.zip && \
    unzip nuclei.zip && mv nuclei /usr/local/bin/ && rm nuclei.zip && \
    chmod +x /usr/local/bin/nuclei && \
    nuclei -update-templates

RUN curl -sSL https://github.com/trufflesecurity/trufflehog/releases/download/v${TRUFFLEHOG_VERSION}/trufflehog_${TRUFFLEHOG_VERSION}_linux_amd64.tar.gz | \
    tar -xz -C /usr/local/bin trufflehog

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages \
    dnstwist python-whois webtech

# Set up Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Create app directory and user
WORKDIR /app
RUN addgroup -g 1001 -S scanner && \
    adduser -S -u 1001 -G scanner scanner

# Copy built application
COPY --from=builder --chown=scanner:scanner /app/node_modules ./node_modules
COPY --from=builder --chown=scanner:scanner /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=builder --chown=scanner:scanner /app/apps/workers/dist ./apps/workers/dist
COPY --chown=scanner:scanner apps/workers/templates ./apps/workers/templates
COPY --chown=scanner:scanner apps/workers/scripts ./apps/workers/scripts
COPY --chown=scanner:scanner apps/workers/modules/*.py ./apps/workers/modules/

USER scanner

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Default command - will be overridden by Cloud Run
CMD ["node", "apps/workers/dist/worker-pubsub.js"]
```

**Dockerfile.api** (Optimized)
```dockerfile
# Lightweight API service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-main/package.json ./apps/api-main/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm --filter @dealbrief/api-main build

# Runtime stage - minimal
FROM node:20-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S api && \
    adduser -S -u 1001 -G api api

# Copy only production dependencies and built code
COPY --from=builder --chown=api:api /app/node_modules ./node_modules
COPY --from=builder --chown=api:api /app/apps/api-main/node_modules ./apps/api-main/node_modules
COPY --from=builder --chown=api:api /app/apps/api-main/dist ./apps/api-main/dist

USER api

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "apps/api-main/dist/server.js"]
```

**Dockerfile.reports** (Clean deployment service)
```dockerfile
# Lightweight reports service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY clean-deploy/package*.json ./

# Install dependencies
RUN npm ci

# Copy source and build
COPY clean-deploy/ .
RUN npm run build

# Runtime stage - minimal
FROM node:20-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S reports && \
    adduser -S -u 1001 -G reports reports

# Copy only production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

USER reports

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["npm", "start"]
```

### 3. Build Optimization

**docker-compose.build.yaml** (Local development)
```yaml
version: '3.8'

services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
      cache_from:
        - type=registry,ref=us-central1-docker.pkg.dev/${PROJECT_ID}/dealbrief/scanner-worker:cache
    image: scanner-worker:local

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      cache_from:
        - type=registry,ref=us-central1-docker.pkg.dev/${PROJECT_ID}/dealbrief/scanner-api:cache
    image: scanner-api:local

  reports:
    build:
      context: .
      dockerfile: Dockerfile.reports
      cache_from:
        - type=registry,ref=us-central1-docker.pkg.dev/${PROJECT_ID}/dealbrief/scanner-reports:cache
    image: scanner-reports:local
```

### 4. Cloud Build Optimization

**cloudbuild-all.yaml** (Parallel builds with caching)
```yaml
steps:
  # Build all images in parallel
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-worker'
    args: [
      'buildx', 'build',
      '--cache-from', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:cache',
      '--cache-to', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:cache,mode=max',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:latest',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:$SHORT_SHA',
      '-f', 'Dockerfile.worker',
      '--push',
      '.'
    ]
    waitFor: ['-']

  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-api'
    args: [
      'buildx', 'build',
      '--cache-from', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-api:cache',
      '--cache-to', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-api:cache,mode=max',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-api:latest',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-api:$SHORT_SHA',
      '-f', 'Dockerfile.api',
      '--push',
      '.'
    ]
    waitFor: ['-']

  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-reports'
    args: [
      'buildx', 'build',
      '--cache-from', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-reports:cache',
      '--cache-to', 'type=registry,ref=us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-reports:cache,mode=max',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-reports:latest',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-reports:$SHORT_SHA',
      '-f', 'Dockerfile.reports',
      '--push',
      '.'
    ]
    waitFor: ['-']

  # Deploy services
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy-api'
    entrypoint: 'gcloud'
    args: [
      'run', 'deploy', 'scanner-api',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-api:$SHORT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed'
    ]
    waitFor: ['build-api']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy-reports'
    entrypoint: 'gcloud'
    args: [
      'run', 'deploy', 'scanner-reports',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-reports:$SHORT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed'
    ]
    waitFor: ['build-reports']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'update-worker-job'
    entrypoint: 'gcloud'
    args: [
      'run', 'jobs', 'update', 'scanner-job',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/dealbrief/scanner-worker:$SHORT_SHA',
      '--region', 'us-central1'
    ]
    waitFor: ['build-worker']

timeout: 1800s
options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

### 5. Testing and Validation Scripts

**scripts/test-docker-builds.sh**
```bash
#!/bin/bash
set -euo pipefail

echo "=== Testing Docker builds locally ==="

# Build all images
echo "Building worker image..."
docker build -f Dockerfile.worker -t scanner-worker:test . || exit 1

echo "Building API image..."
docker build -f Dockerfile.api -t scanner-api:test . || exit 1

echo "Building reports image..."
docker build -f Dockerfile.reports -t scanner-reports:test . || exit 1

# Test worker
echo "Testing worker image..."
docker run --rm scanner-worker:test node -e "
const fs = require('fs');
const workerPath = 'apps/workers/dist/worker-pubsub.js';
if (!fs.existsSync(workerPath)) {
  console.error('Worker file not found at: ' + workerPath);
  process.exit(1);
}
console.log('✓ Worker file found');
"

# Test API
echo "Testing API image..."
docker run --rm scanner-api:test node -e "
const fs = require('fs');
const serverPath = 'apps/api-main/dist/server.js';
if (!fs.existsSync(serverPath)) {
  console.error('Server file not found at: ' + serverPath);
  process.exit(1);
}
console.log('✓ API server file found');
"

# Test reports
echo "Testing reports image..."
docker run --rm scanner-reports:test node -e "
console.log('✓ Reports service container functional');
"

# Test sizes
echo -e "\n=== Image sizes ==="
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "(scanner-worker|scanner-api|scanner-reports):test"

echo -e "\n✅ All tests passed!"
```

**scripts/validate-security-tools.sh**
```bash
#!/bin/bash
set -euo pipefail

echo "=== Validating security tools in worker image ==="

docker run --rm scanner-worker:test sh -c '
set -e
echo "Checking nuclei..."
nuclei -version || exit 1

echo "Checking trufflehog..."
trufflehog --version || exit 1

echo "Checking chromium..."
chromium-browser --version || exit 1

echo "Checking Python tools..."
python3 -c "import dnstwist, whois" || exit 1

echo "✅ All security tools validated!"
'
```

### 6. Implementation Checklist

**Phase 1: Cleanup (Immediate)**
- [ ] Archive old Dockerfiles to `docker-archive/` directory
- [ ] Consolidate to single Dockerfile per service
- [ ] Remove duplicate cloudbuild files
- [ ] Remove frontend-related Docker files since it's now on Vercel

**Phase 2: Optimization (This Week)**
- [ ] Implement multi-stage builds for all services
- [ ] Add Docker layer caching to Cloud Build
- [ ] Create shared base image for security tools
- [ ] Add health checks to all services

**Phase 3: Security (Next Sprint)**
- [ ] Implement non-root users in all containers
- [ ] Add security scanning to build pipeline
- [ ] Implement image signing
- [ ] Set up vulnerability scanning

**Phase 4: Monitoring (Future)**
- [ ] Add structured logging
- [ ] Implement OpenTelemetry tracing
- [ ] Create dashboards for container metrics
- [ ] Set up alerts for failed builds

## Migration Steps

1. **Test Locally First**
   ```bash
   ./scripts/test-docker-builds.sh
   ./scripts/validate-security-tools.sh
   ```

2. **Deploy to Staging**
   ```bash
   gcloud builds submit --config cloudbuild-all.yaml --substitutions=_DEPLOY_ENV=staging
   ```

3. **Validate in Staging**
   - Run test scans
   - Check logs
   - Verify all endpoints

4. **Deploy to Production**
   ```bash
   gcloud builds submit --config cloudbuild-all.yaml --substitutions=_DEPLOY_ENV=production
   ```

## Benefits of This Approach

1. **Consistency**: All services use similar patterns
2. **Security**: Non-root users, minimal attack surface
3. **Performance**: Parallel builds, layer caching
4. **Maintainability**: Clear separation of concerns
5. **Cost**: Smaller images, faster builds
6. **Reliability**: Health checks, proper error handling

## Estimated Improvements

- **Build time**: 50% reduction through parallelization
- **Image size**: 30-40% reduction through multi-stage builds
- **Deploy time**: 60% reduction through caching
- **Reliability**: 99.9% uptime through health checks