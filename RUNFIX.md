# Scanner Architecture Fix - CRITICAL

## Current Problem
The scanner is configured as a Cloud Run Service with Pub/Sub PUSH subscription, causing issues:
- Services randomly shut down mid-scan
- "No available instance" errors
- Scans get stuck in queued/processing state
- Can't maintain consistent scale-to-zero behavior

## Root Cause
**WRONG APPROACH**: Using Cloud Run Service with Pub/Sub push endpoint
**RIGHT APPROACH**: Using Cloud Run with Eventarc triggers (NOT Cloud Run Jobs - those can't be triggered by Eventarc)

## The Fix - Use Eventarc with Cloud Run

### Step 1: Keep the Cloud Run Service 
The scanner-service is already deployed. Keep it but we'll trigger it differently.

### Step 2: Delete the Push Subscription
```bash
# Remove the push endpoint from the subscription
gcloud pubsub subscriptions update scan-jobs-subscription \
  --clear-push-config \
  --project=precise-victory-467219-s4
```

### Step 3: Create Eventarc Trigger
```bash
# Create an Eventarc trigger that connects Pub/Sub to Cloud Run
gcloud eventarc triggers create scanner-pubsub-trigger \
  --location=us-central1 \
  --destination-run-service=scanner-service \
  --destination-run-region=us-central1 \
  --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" \
  --event-filters="topic=projects/precise-victory-467219-s4/topics/scan-jobs" \
  --service-account=scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
  --project=precise-victory-467219-s4
```

### Step 4: Update worker-pubsub.ts to Handle Eventarc
Eventarc sends CloudEvents format. The code needs to handle this:

```typescript
// Pub/Sub push endpoint adapter for Cloud Run with Eventarc
server.post('/', async (req, res) => {
  let scanId: string | undefined;
  
  try {
    // Handle both direct Pub/Sub push AND Eventarc CloudEvents
    let data: any;
    
    if (req.body.message) {
      // Direct Pub/Sub push format
      data = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString());
    } else if (req.headers['ce-type'] === 'google.cloud.pubsub.topic.v1.messagePublished') {
      // Eventarc CloudEvents format
      const pubsubMessage = req.body.message || req.body;
      data = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString());
    } else {
      res.status(400).send('Bad Request: unknown message format');
      return;
    }
    
    scanId = data.scanId;
    
    // Rest of the processing logic...
    // IMPORTANT: Use set() with {merge: true} not update() to create documents
    await db.collection('scans').doc(scanId).set({
      status: 'processing',
      // ... other fields
    }, { merge: true });
```

### Step 5: Configure Service for Scale-to-Zero
```bash
gcloud run services update scanner-service \
  --region=us-central1 \
  --project=precise-victory-467219-s4 \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=1 \
  --cpu=2 \
  --memory=4Gi \
  --timeout=600
```

## Why This Works

1. **Eventarc Integration**: Eventarc is designed to trigger Cloud Run services from events (like Pub/Sub messages)
2. **Proper Lifecycle**: Each message triggers a new request to the service, which processes it and returns
3. **Scale-to-Zero**: Service can scale down to 0 when not in use, saving costs
4. **No Instance Management**: Cloud Run handles all the instance lifecycle automatically
5. **Built-in Retries**: Eventarc handles retries if the service fails

## Current Status Check

```bash
# Check if Eventarc trigger exists
gcloud eventarc triggers list --location=us-central1 --project=precise-victory-467219-s4

# Check subscription configuration
gcloud pubsub subscriptions describe scan-jobs-subscription --project=precise-victory-467219-s4

# Check service status
gcloud run services describe scanner-service --region=us-central1 --project=precise-victory-467219-s4
```

## Testing

```bash
# Publish a test message
gcloud pubsub topics publish scan-jobs \
  --message='{"scanId":"test-'$(date +%s)'","companyName":"Test Company","domain":"vulnerable-test-site.vercel.app","createdAt":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' \
  --project=precise-victory-467219-s4

# Check logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service" \
  --limit=20 \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,jsonPayload.message,jsonPayload.scanId)" \
  --freshness=2m
```

## Key Points

- **DO NOT** use Cloud Run Jobs - they can't be triggered by Eventarc
- **DO NOT** use Pub/Sub PUSH subscriptions directly to Cloud Run - use Eventarc
- **DO** use Firestore set() with {merge: true} instead of update() to handle non-existent documents
- **DO** ensure the service handles CloudEvents format from Eventarc

## References
- [Eventarc with Cloud Run](https://cloud.google.com/run/docs/triggering/trigger-with-events)
- [Pub/Sub triggers for Cloud Run](https://cloud.google.com/run/docs/triggering/pubsub-triggers)
- [CloudEvents specification](https://cloudevents.io/)