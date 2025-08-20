# How to Trigger a Scan - GCP Deployment

## Quick Start - Single Scan

### Using the GCP Scanner API (Recommended)
```bash
curl -X POST https://scanner-api-w6v7pps5wa-uc.a.run.app/scan \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Vulnerable Test Site", "domain": "vulnerable-test-site.vercel.app"}'
```

**Note:** The API uses camelCase field names (`companyName`, not `company_name`)




### Response Format
```json
{
  "scanId": "E_P4qM_Szq6",
  "status": "queued",
  "companyName": "Company Name", 
  "domain": "vulnerable-test-site.vercel.app",
  "originalDomain": "vulnerable-test-site.vercel.app",
  "message": "Scan started successfully"
}
```

## Check Scan Results

### Check Scan Status via API
```bash
# Replace SCAN_ID with actual scan ID from response
curl https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/SCAN_ID/status
```

### Check Scan Findings
```bash
curl https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/SCAN_ID/findings
```

### Query Firestore for Results
```bash
# Get scan document
gcloud firestore documents get scans/SCAN_ID \
  --project=precise-victory-467219-s4 \
  --format=json

# Note: gcloud firestore commands require additional configuration
# Use the API endpoints above for easier access
```

## Bulk Scans

### JSON Array
```bash
curl -X POST https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {"companyName": "Vulnerable Test Site", "domain": "vulnerable-test-site.vercel.app"},
    {"companyName": "Company 2", "domain": "example2.com"}
  ]'
```

### CSV Upload
```bash
curl -X POST https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/csv \
  -F "file=@companies.csv"
```

## Additional Options

### Add Tags
```bash
curl -X POST https://scanner-api-w6v7pps5wa-uc.a.run.app/scan \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Vulnerable Test Site", "domain": "vulnerable-test-site.vercel.app", "tags": ["priority", "test"]}'
```

### Scan Tiers
- **TIER_1**: Safe, automated modules (default) - 13 modules
- **TIER_2**: Deep scanning with active probing (requires authorization)

## GCP Architecture

### Components
1. **scanner-api**: Cloud Run service that receives scan requests
2. **scan-jobs**: Pub/Sub topic for queuing scan jobs
3. **scanner-pubsub-trigger**: Eventarc trigger that connects Pub/Sub to Cloud Run
4. **scanner-service**: Cloud Run service that processes scans (scales to zero)
5. **Firestore**: Stores scan results, findings, and artifacts

### Data Flow
1. POST request to scanner-api → Creates scan in Firestore
2. scanner-api publishes message to scan-jobs Pub/Sub topic
3. Eventarc trigger receives Pub/Sub message and invokes scanner-service
4. scanner-service processes the scan (auto-scales from 0 to handle request)
5. Results stored in Firestore collections (scans, findings, artifacts)
6. Service scales back to zero when idle

## Monitoring

### Check Pub/Sub Queue
```bash
# Check for pending messages (Eventarc manages the subscription)
gcloud pubsub subscriptions pull eventarc-us-central1-scanner-pubsub-trigger-sub-798 \
  --project=precise-victory-467219-s4 \
  --limit=5 \
  --format=json

# Check if Eventarc trigger is active
gcloud eventarc triggers describe scanner-pubsub-trigger \
  --location=us-central1 \
  --project=precise-victory-467219-s4 \
  --format="value(state)"
```

### View Scanner Logs
```bash
# Scanner API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-api" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=20 \
  --order=desc

# Scanner Service (worker) logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=scanner-service" \
  --project=precise-victory-467219-s4 \
  --format="table(timestamp,textPayload)" \
  --limit=20 \
  --order=desc
```

## Troubleshooting

### Issue: Scan stuck in "processing"
**Cause**: The scanner-service may not be receiving messages from Eventarc
**Solution**: 
1. Check if Eventarc trigger is active: `gcloud eventarc triggers describe scanner-pubsub-trigger --location=us-central1 --project=precise-victory-467219-s4`
2. Check if messages are in the queue (see monitoring commands)
3. Verify scanner-service can scale: `gcloud run services describe scanner-service --region=us-central1 --project=precise-victory-467219-s4`
4. Check worker logs for errors

### Issue: No findings returned
**Cause**: Worker may not have completed or may have failed
**Solution**: Check scanner-service logs for the scan ID

### Issue: 400 Error "Company name and domain are required"
**Cause**: Using wrong field names
**Solution**: Use camelCase: `companyName` and `domain`

## Common Finding Types
- `tls_weakness` - SSL/TLS vulnerabilities
- `typo_domain` - Domain typosquatting threats
- `discovered_endpoints` - Exposed endpoints
- `breach_directory_summary` - Breach database checks
- `spf_dmarc_issues` - Email security configuration
- `config_exposure` - Exposed configuration files
- `tech_stack` - Detected technologies
- `accessibility_issues` - ADA compliance issues
- `client_secrets` - Exposed API keys/secrets
- `backend_exposure` - Exposed backend services
- `abuse_intel` - IP reputation issues
- `nuclei_findings` - Vulnerability scanner results

## Example: Full Scan Test

```bash
# 1. Trigger scan
RESPONSE=$(curl -s -X POST https://scanner-api-w6v7pps5wa-uc.a.run.app/scan \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Vulnerable Test Site", "domain": "vulnerable-test-site.vercel.app"}')

# 2. Extract scan ID
SCAN_ID=$(echo $RESPONSE | grep -o '"scanId":"[^"]*' | cut -d'"' -f4)
echo "Scan ID: $SCAN_ID"

# 3. Wait for processing
sleep 60

# 4. Check status
curl https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/$SCAN_ID/status

# 5. Get findings
curl https://scanner-api-w6v7pps5wa-uc.a.run.app/scan/$SCAN_ID/findings
```

## Report Generation

After scan completion, generate intelligence reports:

```bash
# Generate report (requires report service deployment)
curl -X POST https://scanner-reports-[hash].run.app/generate \
  -H 'Content-Type: application/json' \
  -d '{"scanId": "YOUR_SCAN_ID", "reportType": "standard", "format": "both"}'
```

Report types:
- `summary`: Executive summary (Critical/High only, 2-3 pages)
- `standard`: IT management report (Critical/High/Medium, 5-10 pages)
- `detailed`: Security team report (All findings, 10+ pages)

Formats:
- `html`: Web viewable
- `pdf`: Downloadable PDF
- `both`: Both formats

---

*Last updated: 2025-08-14*
*Deployment: GCP (precise-victory-467219-s4)*
*Architecture: Eventarc-triggered Cloud Run with scale-to-zero*