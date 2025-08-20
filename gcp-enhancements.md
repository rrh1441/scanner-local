# GCP Scanner Enhancements

This document describes the production-ready enhancements added to the scanner after the GCP migration.

## 1. Dead Letter Queue (DLQ) Setup

### Purpose
Ensures failed messages are not lost and can be analyzed for debugging.

### Setup Instructions
```bash
# Run the setup script to configure DLQ
tsx apps/workers/setup-dlq.ts

# This will:
# - Create a dead letter topic: scan-jobs-dlq
# - Create a monitoring subscription: scan-jobs-dlq-subscription
# - Configure max 5 delivery attempts before sending to DLQ
# - Set message retention to 7 days
```

### Monitoring DLQ Messages
```bash
# View messages in the dead letter queue
gcloud pubsub subscriptions pull scan-jobs-dlq-subscription \
  --project=precise-victory-467219-s4 \
  --limit=10 \
  --auto-ack

# Check DLQ message count
gcloud pubsub subscriptions describe scan-jobs-dlq-subscription \
  --project=precise-victory-467219-s4 \
  --format="value(numUnackedMessages)"
```

## 2. Failed Scan Monitoring

### Purpose
Automatically detects and alerts on failed scans to ensure system reliability.

### Deployment as Cloud Function
```bash
# Deploy the monitoring function
gcloud functions deploy monitor-scans \
  --runtime nodejs20 \
  --trigger-schedule="*/15 * * * *" \
  --entry-point=monitorScans \
  --source=apps/workers \
  --set-env-vars="ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  --region=us-central1 \
  --project=precise-victory-467219-s4
```

### Manual Monitoring
```bash
# Run monitoring script manually
tsx apps/workers/monitor-failed-scans.ts
```

### Alert Configuration
Set these environment variables:
- `ALERT_WEBHOOK_URL`: Slack/Discord webhook for notifications
- `ALERT_PUBSUB_TOPIC`: Pub/Sub topic for programmatic alerts

## 3. Rate Limiting

### Purpose
Prevents API abuse and ensures fair usage across all clients.

### Configuration
The API now implements multi-tier rate limiting:

#### Global Limits
- **Default**: 100 requests per minute per IP
- **Localhost**: Unlimited (for development)

#### Endpoint-Specific Limits
- **Scan Creation** (`/scan`, `/scans`, `/api/scans`): 10 per minute
- **Bulk Operations** (`/scan/bulk`, `/scan/csv`): 2 per minute
- **Status Checks** (`/scan/:id/status`): 60 per minute

#### Custom API Keys
Clients can use API keys for higher limits:
```bash
curl -X POST https://api.dealbrief.com/scan \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Example", "domain": "example.com"}'
```

### Rate Limit Headers
All responses include rate limit information:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2024-01-01T12:00:00Z
```

### Error Response
When rate limit is exceeded:
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 45s",
  "date": "2024-01-01T12:00:00Z",
  "expiresIn": "45s"
}
```

## 4. Enhanced Pub/Sub Configuration

### Message Processing
- **Acknowledgment Deadline**: 10 minutes (600 seconds)
- **Max Concurrent Messages**: 1 (prevents memory overload)
- **Retry Policy**: 5 attempts before DLQ

### Graceful Shutdown
The worker now handles SIGTERM signals properly:
```javascript
process.on('SIGTERM', async () => {
  await subscription.close();
  process.exit(0);
});
```

## 5. Monitoring & Alerting Setup

### Cloud Monitoring Dashboard
Create a dashboard to monitor:
- Failed scan rate
- DLQ message count
- API rate limit violations
- Worker memory usage
- Scan processing time

### Alert Policies
```bash
# Create alert for high failure rate
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="High Scan Failure Rate" \
  --condition="rate(failed_scans) > 0.1"
```

## 6. Testing the Enhancements

### Test Rate Limiting
```bash
# Test rate limit (will fail after 10 requests)
for i in {1..15}; do
  curl -X POST http://localhost:3000/scan \
    -H "Content-Type: application/json" \
    -d '{"companyName": "Test", "domain": "test.com"}'
  sleep 0.5
done
```

### Test DLQ
```bash
# Send a malformed message to trigger DLQ
gcloud pubsub topics publish scan-jobs \
  --message='{"invalid": "message"}' \
  --project=precise-victory-467219-s4
```

### Test Monitoring
```bash
# Manually fail a scan in Firestore
firebase firestore:update scans/test-scan-123 \
  --data '{"status": "failed", "error": "Test failure", "failed_at": "2024-01-01T12:00:00Z"}'

# Run monitor to see alert
tsx apps/workers/monitor-failed-scans.ts
```

## 7. Production Checklist

- [ ] Deploy DLQ configuration: `tsx apps/workers/setup-dlq.ts`
- [ ] Deploy monitoring Cloud Function
- [ ] Configure alert webhooks/emails
- [ ] Test rate limiting with expected load
- [ ] Set up Cloud Monitoring dashboards
- [ ] Document API rate limits for clients
- [ ] Configure Cloud Logging exports
- [ ] Set up error budget and SLOs

## 8. Future Enhancements

1. **Redis-based Rate Limiting**: For multi-instance deployments
2. **API Key Management**: Database-backed API keys with custom limits
3. **Scan Quotas**: Monthly/daily scan limits per organization
4. **Priority Queues**: Separate queues for different scan priorities
5. **Webhook Callbacks**: Notify clients when scans complete
6. **Scan Scheduling**: Allow scheduling scans for off-peak hours