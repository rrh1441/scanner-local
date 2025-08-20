# Job Monitoring Reference

Quick reference for monitoring scanner job execution on Google Cloud Platform.

## Current Status (2025-08-04 18:00 UTC)

### ✅ ISSUES RESOLVED
1. **Firestore Validation Fixed**: Added undefined → null sanitization in `apps/workers/core/artifactStoreGCP.ts`
2. **Resource Scaling Complete**: Updated to 4 CPU / 6GB RAM  
3. **Job Configuration Fixed**: Now runs Pub/Sub worker (`worker-pubsub.js`)

### 🔄 IN PROGRESS  
- **Docker Build**: Building updated image with correct file paths
- **Build ID**: `88e6228b-83fd-4d94-976e-038916b10a78`

### 📋 NEXT ACTIONS FOR NEW AGENT
1. **Wait for build completion** (~2-3 minutes)
2. **Execute new job** with fixed image
3. **Monitor scan execution** - should complete in <5 minutes  
4. **Verify Pub/Sub message processing** from queue

## Performance Expectations
- **Previous Issue**: 30+ minute timeouts due to Firestore errors
- **Expected Now**: <5 minutes per scan  
- **Root Cause Fixed**: Undefined field validation blocking all writes

## Quick Status Commands

### 1. Check Build Status
```bash
gcloud builds list --limit=1 --project=precise-victory-467219-s4 --format="table(id,status,startTime,finishTime)"
```

### 2. Execute New Job (after build completes)
```bash
gcloud run jobs execute scanner-job --region=us-central1 --project=precise-victory-467219-s4
```

### 3. Monitor Active Execution
```bash
gcloud run jobs executions list --job=scanner-job --region=us-central1 --project=precise-victory-467219-s4 --limit=1
```

### 4. View Live Logs
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scanner-job" --limit=20 --format="table(timestamp,textPayload)" --project=precise-victory-467219-s4 --freshness=5m
```

### 5. Check Messages Being Processed
```bash
gcloud pubsub subscriptions pull scan-jobs-subscription --limit=5 --project=precise-victory-467219-s4
```

### 6. Monitor Specific Execution (replace EXECUTION_ID)
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scanner-job AND labels.\"run.googleapis.com/execution_name\"=EXECUTION_ID" --limit=50 --format="table(timestamp,textPayload)" --project=precise-victory-467219-s4
```

## Web Console Links

### Job Execution Logs
https://console.cloud.google.com/logs/viewer?project=precise-victory-467219-s4&advancedFilter=resource.type%3D%22cloud_run_job%22%0Aresource.labels.job_name%3D%22scanner-job%22

### Cloud Run Jobs Dashboard
https://console.cloud.google.com/run/jobs?project=precise-victory-467219-s4

### Pub/Sub Monitoring
https://console.cloud.google.com/cloudpubsub/subscription/list?project=precise-victory-467219-s4

## Performance Expectations

### Target Performance (Fly.io baseline)
- **Total Time**: <3 minutes
- **Active Modules**: 15 modules (14 scanners + asset correlator)
- **Parallel Execution**: 8 immediate + 6 after endpoint discovery

### Status Indicators
- ✅ **Running**: "1 task currently running"
- ✅ **Success**: "1 task completed successfully" 
- ❌ **Failed**: "1 task failed to complete"

## Troubleshooting Commands

### Manual Job Execution
```bash
gcloud run jobs execute scanner-job --region=us-central1 --project=precise-victory-467219-s4
```

### List Recent Executions
```bash
gcloud run jobs executions list --job=scanner-job --region=us-central1 --limit=5 --project=precise-victory-467219-s4
```

### Check Service Account Permissions
```bash
gcloud projects get-iam-policy precise-victory-467219-s4 --flatten="bindings[].members" --format="table(bindings.role)" --filter=bindings.members:scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com
```

## Key Technical Fixes Applied

### 1. Firestore Validation Fix
**File**: `apps/workers/core/artifactStoreGCP.ts`  
**Change**: Added sanitization in `insertFindingInternal()` and `insertArtifactInternal()`
```typescript
// Sanitize undefined values to null for Firestore compatibility
const sanitizedFinding: any = { ...finding };
Object.keys(sanitizedFinding).forEach(key => {
  if (sanitizedFinding[key] === undefined) {
    sanitizedFinding[key] = null;
  }
});
```

### 2. Resource Scaling  
**Updated**: 2 CPU / 4GB → 4 CPU / 6GB RAM
```bash
gcloud run jobs update scanner-job --region=us-central1 --project=precise-victory-467219-s4 --cpu=4 --memory=6Gi
```

### 3. Job Configuration  
**Entry Point**: Changed from `worker.js` to `worker-pubsub.js`
```bash  
gcloud run jobs update scanner-job --region=us-central1 --project=precise-victory-467219-s4 --command="node" --args="worker-pubsub.js"
```

### 4. Docker Path Fix
**Dockerfile Update**: Added file copy to root directory
```dockerfile
RUN if [ -f "apps/workers/dist/worker-pubsub.js" ]; then cp apps/workers/dist/worker-pubsub.js .; fi
CMD ["node", "worker-pubsub.js"]
```

## Messages in Queue
There are **5+ messages** waiting in `scan-jobs-subscription` ready for processing once the new image deploys.

---

*Last updated: 2025-08-04 18:00 UTC*