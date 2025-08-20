# Scanner Debugging Logs

## Current Issues

1. **Modules are timing out at 3 minutes instead of completing in seconds**
   - breach_directory_probe: Works (200-500ms)
   - shodan: Works (200-500ms)
   - document_exposure: Times out (should be 1-2s)
   - endpoint_discovery: Times out (should be 30-45s)
   - tls_scan: Times out (should be 15-30s)
   - spf_dmarc: Times out (should be 1-3s)
   - config_exposure: Times out (should be 10-20s)

2. **Message redelivery was happening (FIXED)**
   - Changed Pub/Sub ack deadline from 10s to 600s
   - This prevented duplicate processing

3. **Missing API keys (FIXED)**
   - Added LEAKCHECK_API_KEY and SERPER_KEY to Cloud Run service

## Commands to Check Full Workflow

### 1. Check if scan was published to Pub/Sub
```bash
# Check API logs for scan creation
gcloud logging read "resource.labels.service_name=scanner-api AND textPayload:\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=10 \
  --freshness=10m

# Check if message was published to Pub/Sub topic
gcloud logging read "textPayload:\"Published scan job SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=5 \
  --freshness=10m
```

### 2. Check if scanner-service received the message
```bash
# Check if Eventarc delivered message to Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service AND jsonPayload.message:\"Processing scan request\" AND jsonPayload.scanId=\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,jsonPayload.message,jsonPayload.scanId)" \
  --limit=5 \
  --freshness=10m

# Check if worker started processing
gcloud logging read "textPayload:\"[worker] Processing scan SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=5 \
  --freshness=10m
```

### 3. Check module execution
```bash
# Check which modules started
gcloud logging read "textPayload:\"[worker]\" AND textPayload:\"STARTING\" AND textPayload:\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=20 \
  --freshness=10m \
  --order=asc

# Check which modules completed
gcloud logging read "textPayload:\"[worker]\" AND textPayload:\"COMPLETED\" AND textPayload:\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=20 \
  --freshness=10m \
  --order=asc

# Check for module timeouts
gcloud logging read "textPayload:\"TIMEOUT\" AND textPayload:\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=10 \
  --freshness=10m
```

### 4. Check for specific module logs (endpoint_discovery)
```bash
# Check endpoint discovery detailed logs
gcloud logging read "textPayload:\"[endpointDiscovery]\" AND textPayload:\"SCAN_ID\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=30 \
  --freshness=10m \
  --order=asc

# Check for network errors
gcloud logging read "(textPayload:\"ECONNREFUSED\" OR textPayload:\"ENOTFOUND\" OR textPayload:\"ETIMEDOUT\" OR textPayload:\"getaddrinfo\") AND timestamp>=\"2025-08-14T12:00:00Z\"" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=10
```

### 5. Check for errors and failures
```bash
# Check for any errors in scanner-service
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service AND severity=ERROR" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,jsonPayload.message,jsonPayload.error)" \
  --limit=10 \
  --freshness=10m

# Check for memory/CPU issues
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service AND (textPayload:\"memory\" OR textPayload:\"Memory exceeded\" OR textPayload:\"killed\")" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=10 \
  --freshness=1h
```

### 6. Check service configuration
```bash
# Check service status
gcloud run services describe scanner-service \
  --region=us-central1 \
  --project=precise-victory-467219-s4 \
  --format="yaml" | grep -E "memory|cpu|timeout|concurrency|image"

# Check Eventarc trigger status
gcloud eventarc triggers describe scanner-pubsub-trigger \
  --location=us-central1 \
  --project=precise-victory-467219-s4 \
  --format="yaml"

# Check subscription configuration
gcloud pubsub subscriptions describe eventarc-us-central1-scanner-pubsub-trigger-sub-798 \
  --project=precise-victory-467219-s4 \
  --format="yaml" | grep -E "ackDeadline|retry|push"
```

### 7. Check Firestore updates
```bash
# Check if scan status is being updated
gcloud firestore documents describe scans/SCAN_ID \
  --project=precise-victory-467219-s4 \
  --format=json | jq '.fields.status,.fields.updated_at'
```

## Replace SCAN_ID with actual scan IDs:
- FFBLlsAwHM_ (vulnerable-test-site.vercel.app - timed out)
- Hr-LJoSRItF (vulnerable-test-site.vercel.app - timed out)
- FfzNVOOYCcS (vulnerable-test-site.vercel.app - timed out)
- Qn-t4eVcN2p (vulnerable-test-site.vercel.app - timed out)
- WSLd4-tZxla (google.com - partially worked)
- Li-LONxXwGp (vulnerable-test-site.vercel.app - never picked up)
- PYQ-myPIqw0 (example.com - latest test)

## Key Findings

1. **Modules hang on specific domains**
   - vulnerable-test-site.vercel.app: Only breach_directory_probe and shodan complete
   - google.com: More modules complete but endpoint_discovery still hangs
   - example.com: Testing now

2. **The hanging appears to happen in HTTP requests**
   - Modules start but never complete
   - No error messages are logged
   - The 3-minute timeout kills them

3. **Possible causes:**
   - Network connectivity issues in Cloud Run
   - DNS resolution problems
   - Firewall/egress restrictions
   - Async/Promise handling issues
   - Resource limits (CPU/memory)

## What Needs to be Fixed

1. **Add more detailed logging in modules** (DONE)
   - Log before and after each HTTP request
   - Log DNS resolution
   - Log connection establishment
   - Log response receipt

2. **Check network configuration**
   - Verify Cloud Run can make outbound HTTPS requests
   - Check if there are VPC or firewall restrictions
   - Test DNS resolution from within the container

3. **Add proper timeouts to all HTTP requests**
   - Ensure axios timeouts are set correctly
   - Add circuit breakers for hanging requests
   - Implement retry logic with exponential backoff

4. **Test with different deployment configurations**
   - Increase memory/CPU limits
   - Change container concurrency
   - Try different regions