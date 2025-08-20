# PRODUCTION DEPLOYMENT - DealBrief Scanner Fast-Ack Fix

## What We Fixed
- **Created hardened HTTP client** with timeout protection (`/apps/workers/net/httpClient.ts`)
- **Built Fastify server** with fast-ack pattern (`/apps/workers/server.ts`)
- **Integrated Cloud Tasks** to decouple acknowledgment from processing
- **Updated to Node 20** with distroless Docker runtime

## 1. Set Up Your API Keys (REQUIRED)

```bash
# Your modules WILL NOT WORK without these
gcloud auth login
gcloud config set project precise-victory-467219-s4

# Create ALL required secrets
echo -n "YOUR_ACTUAL_SHODAN_KEY" | gcloud secrets create shodan-key --data-file=-
echo -n "YOUR_SERPER_KEY" | gcloud secrets create serper-key --data-file=-
echo -n "YOUR_OPENAI_KEY" | gcloud secrets create openai-key --data-file=-
echo -n "YOUR_LEAKCHECK_KEY" | gcloud secrets create leakcheck-key --data-file=-
echo -n "YOUR_ABUSEIPDB_KEY" | gcloud secrets create abuseipdb-key --data-file=-
echo -n "YOUR_CENSYS_ID" | gcloud secrets create censys-id --data-file=-
echo -n "YOUR_CENSYS_SECRET" | gcloud secrets create censys-secret --data-file=-

# Grant service account access to ALL secrets
for secret in shodan-key serper-key openai-key leakcheck-key abuseipdb-key censys-id censys-secret; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 2. Create Cloud Tasks Queue

```bash
# Create the queue for worker tasks
gcloud tasks queues create scan-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --min-backoff=10s \
  --max-backoff=300s
```

## 3. Build and Deploy

```bash
cd apps/workers

# Build Docker image
docker build -t gcr.io/precise-victory-467219-s4/scanner-service:latest .

# Push to GCR
docker push gcr.io/precise-victory-467219-s4/scanner-service:latest

# Deploy to Cloud Run with ALL environment variables and secrets
gcloud run deploy scanner-service \
  --image gcr.io/precise-victory-467219-s4/scanner-service:latest \
  --platform managed \
  --region us-central1 \
  --service-account scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --max-instances 10 \
  --min-instances 1 \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT=precise-victory-467219-s4,GCP_LOCATION=us-central1,TASKS_QUEUE=scan-queue,NODE_OPTIONS=--dns-result-order=ipv4first" \
  --update-secrets="SHODAN_API_KEY=shodan-key:latest,SERPER_KEY=serper-key:latest,OPENAI_API_KEY=openai-key:latest,LEAKCHECK_API_KEY=leakcheck-key:latest,ABUSEIPDB_API_KEY=abuseipdb-key:latest,CENSYS_API_ID=censys-id:latest,CENSYS_API_SECRET=censys-secret:latest"

# Get the service URL for TASKS_WORKER_URL
SERVICE_URL=$(gcloud run services describe scanner-service --region=us-central1 --format='value(status.url)')
echo "Your TASKS_WORKER_URL is: ${SERVICE_URL}/tasks/scan"

# Update the service with the worker URL
gcloud run services update scanner-service \
  --region us-central1 \
  --update-env-vars="TASKS_WORKER_URL=${SERVICE_URL}/tasks/scan"
```

## 4. Update Eventarc Trigger

```bash
# List existing triggers
gcloud eventarc triggers list --location=us-central1

# If you have an existing trigger, update it to point to /events
gcloud eventarc triggers update scanner-pubsub-trigger \
  --location=us-central1 \
  --destination-run-service=scanner-service \
  --destination-run-path=/events

# Or create a new trigger
gcloud eventarc triggers create scanner-pubsub-trigger \
  --location=us-central1 \
  --destination-run-service=scanner-service \
  --destination-run-path=/events \
  --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" \
  --event-filters="topic=projects/precise-victory-467219-s4/topics/scan-requests" \
  --service-account=scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com
```

## 5. Test the Deployment

### 5.1 Health Check
```bash
SERVICE_URL=$(gcloud run services describe scanner-service --region=us-central1 --format='value(status.url)')
curl ${SERVICE_URL}/
# Should return: {"status":"ok","ts":1234567890}
```

### 5.2 Test Direct Endpoint (Debug)
```bash
curl -X POST ${SERVICE_URL}/debug/test-endpoints \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'
```

### 5.3 Test Full Production Flow
```bash
# Publish a real scan request
gcloud pubsub topics publish scan-requests \
  --message='{"scan_id":"prod-test-001","domain":"example.com","companyName":"Example"}'

# Watch logs in real-time
gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service" \
  --project=precise-victory-467219-s4

# Check Cloud Tasks queue
gcloud tasks queues describe scan-queue --location=us-central1
```

## 6. Monitor Success Metrics

```bash
# Check for successful fast-ack (should see immediate 204 responses)
gcloud logging read "resource.type=cloud_run_revision AND textPayload:'/events' AND httpRequest.status=204" \
  --limit=10 \
  --format="table(timestamp,httpRequest.latency)"

# Check for worker completions
gcloud logging read "resource.type=cloud_run_revision AND textPayload:'[worker] done'" \
  --limit=10

# Check for any timeouts (should be ZERO)
gcloud logging read "resource.type=cloud_run_revision AND textPayload:'timeout'" \
  --limit=10

# Check Firestore for results
gcloud firestore documents list artifacts --limit=10
```

## 7. Expected Module Execution Times

With the fast-ack pattern, modules should complete within these times:
- **breach_directory_probe**: ~250ms
- **shodan**: ~300ms
- **document_exposure**: 1-2s
- **endpointDiscovery**: 1-3 minutes (KEY TEST - was timing out before)
- **spf_dmarc**: ~3s
- **config_exposure**: ~6s
- **tls_scan**: ~10s
- **nuclei**: ~30s
- **tech_stack_scan**: ~15s
- **client_secret_scanner**: ~45s
- **accessibility_scan**: ~70s

## 8. Troubleshooting

### If modules fail with "SHODAN_API_KEY environment variable must be configured":
```bash
# Verify secrets are mounted
gcloud run services describe scanner-service --region=us-central1 --format=yaml | grep -A 20 secrets

# Check if secrets exist
gcloud secrets list
```

### If you see "Missing GCP_PROJECT or TASKS_WORKER_URL":
```bash
# Update environment variables
gcloud run services update scanner-service \
  --region us-central1 \
  --update-env-vars="GCP_PROJECT=precise-victory-467219-s4,TASKS_WORKER_URL=${SERVICE_URL}/tasks/scan"
```

### If scans aren't processing:
```bash
# Check Cloud Tasks for errors
gcloud tasks queues describe scan-queue --location=us-central1

# Check for stuck messages
gcloud pubsub subscriptions pull eventarc-us-central1-scanner-pubsub-trigger-sub-798 \
  --limit=5 \
  --format=json
```

### If still seeing timeouts:
```bash
# Check which modules are timing out
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=20 \
  --format="table(timestamp,textPayload)"

# Those specific modules need migration from axios to httpClient
```

## 9. Gradual Module Migration Plan

The modules still use axios. Prioritize migrating these based on timeout frequency:

### High Priority (frequently timeout):
1. **endpointDiscovery.ts** - Complex crawling, needs httpClient
2. **documentExposure.ts** - External API calls, needs httpClient
3. **tlsScan.ts** - Network intensive, needs httpClient

### Medium Priority:
4. **configExposureScanner.ts**
5. **clientSecretScanner.ts**
6. **nuclei.ts**

### Migration Example:
```typescript
// OLD (axios)
import axios from 'axios';
const response = await axios.get(url, { timeout: 10000 });
const data = response.data;

// NEW (httpClient)
import { httpRequest, httpGetText } from '../net/httpClient.js';
const response = await httpRequest({ 
  url, 
  totalTimeoutMs: 10000 
});
const data = new TextDecoder().decode(response.body);
```

## 10. Validate Production Success

Your deployment is successful when:
1. ✅ Pub/Sub messages acknowledge in <1 second
2. ✅ Cloud Tasks queue processes without errors
3. ✅ No timeout errors in logs
4. ✅ All modules complete within 3 minutes
5. ✅ Firestore shows completed scans with artifacts

## 11. Performance Tuning

After 24 hours of monitoring:
```bash
# Increase concurrency if queue is backing up
gcloud run services update scanner-service \
  --region us-central1 \
  --concurrency 20

# Increase Cloud Tasks dispatch rate
gcloud tasks queues update scan-queue \
  --location us-central1 \
  --max-concurrent-dispatches=50

# Scale up if needed
gcloud run services update scanner-service \
  --region us-central1 \
  --max-instances 20
```

## CRITICAL REMINDERS

1. **API Keys are REQUIRED** - The app will crash without them
2. **Use the correct service account** - scanner-worker-sa@precise-victory-467219-s4
3. **Monitor the first 24 hours** - Watch for timeout patterns
4. **Migrate modules gradually** - Don't try to fix everything at once
5. **Keep the old version ready** - In case you need to rollback

## Emergency Rollback

```bash
# List previous revisions
gcloud run revisions list --service=scanner-service --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic scanner-service \
  --to-revisions=scanner-service-[OLD-REVISION]=100 \
  --region=us-central1
```

---

**This is your actual production app.** Test carefully. Monitor closely. The fast-ack pattern will prevent Pub/Sub timeouts, but modules still need migration to fully eliminate HTTP timeouts.