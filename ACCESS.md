# GCP Scanner Access & Monitoring Guide

## Authentication & Access

### Proper Login (ryan@simplcyber.io)
```bash
# Login with correct account
gcloud auth login --account=ryan@simplcyber.io

# Set project
gcloud config set project precise-victory-467219-s4

# Set up application default credentials
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login --quiet
```

## Database Access (Firestore)

### View All Scans
```bash
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/scans?pageSize=20"
```

### View Specific Scan
```bash
SCAN_ID="Ta3HE1Wa2x9"
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/scans/$SCAN_ID"
```

### View Findings for Scan
```bash
SCAN_ID="Ta3HE1Wa2x9"
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/findings?pageSize=50" | grep -A10 -B5 "$SCAN_ID"
```

### View Artifacts for Scan
```bash
SCAN_ID="Ta3HE1Wa2x9"
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/artifacts?pageSize=50" | grep -A10 -B5 "$SCAN_ID"
```

## Deployment & Testing

### Build and Deploy Worker
```bash
gcloud builds submit --config cloudbuild-worker-only.yaml --project=precise-victory-467219-s4
```

### Run Test Scan
```bash
gcloud run jobs execute scanner-job --project=precise-victory-467219-s4 --region=us-central1
```

### Monitor Job Execution
```bash
# Get execution details
gcloud run jobs executions describe EXECUTION_NAME --project=precise-victory-467219-s4 --region=us-central1

# Get logs for specific execution
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scanner-job AND labels.\"run.googleapis.com/execution_name\"=EXECUTION_NAME" --project=precise-victory-467219-s4 --format="table(timestamp,textPayload)" --limit=50 --order=desc

# Cancel hung execution
gcloud run jobs executions cancel EXECUTION_NAME --project=precise-victory-467219-s4 --region=us-central1 --quiet
```

## Current Status Summary

### ✅ WORKING COMPONENTS
- **Scanner execution**: Jobs start and run successfully
- **Module logging**: Clear START/COMPLETE/FAIL messages with timing
- **Data persistence**: Scans, findings, and artifacts written to Firestore
- **Multiple modules**: breach_directory_probe, shodan, spf_dmarc, tls_scan all working
- **Graceful degradation**: Failed modules don't crash entire scan
- **DNS twist removal**: Moved to Tier 2, no longer slowing Tier 1 scans

### ❌ OUTSTANDING ISSUES
1. **Timeout mechanism broken**: Promise.race not working, modules hang indefinitely
2. **endpointDiscovery hangs**: Always stops after finding assets, never completes
3. **TLS script path**: Python script not found at expected location
4. **Scan completion**: Scans stuck in "processing" status forever

### 📊 TEST SCAN RESULTS (Ta3HE1Wa2x9)
**Target**: vulnerable-test-site.vercel.app
**Status**: processing (hung)
**Started**: 2025-08-05T16:04:11.548Z

**Modules Completed**:
- ✅ breach_directory_probe: 250ms, 0 findings
- ✅ shodan: 291ms, 0 findings (API 403 error)
- ✅ spf_dmarc: Found SPF missing, DMARC missing
- ❌ endpointDiscovery: Found Supabase backend, then hung
- ❌ tls_scan: Python script missing errors

**Artifacts Written**: 15+ artifacts including:
- breach_directory_summary
- spf_missing (MEDIUM severity)
- dmarc_missing (MEDIUM severity) 
- scan_summary entries
- Backend detection: supabase:ltiuuauafphpwewqktdv

## Key Commands Reference

```bash
# Quick scan status check
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/scans?pageSize=5&orderBy=createTime%20desc"

# Quick artifact check for recent scans
gcloud auth print-access-token | xargs -I {} curl -H "Authorization: Bearer {}" \
"https://firestore.googleapis.com/v1/projects/precise-victory-467219-s4/databases/(default)/documents/artifacts?pageSize=10&orderBy=createTime%20desc"

# Monitor recent logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scanner-job AND timestamp>=\"$(date -u -v-10M +%Y-%m-%dT%H:%M:%SZ)\"" --project=precise-victory-467219-s4 --format="table(timestamp,textPayload)" --limit=20
```

## Project Structure
- **Project ID**: precise-victory-467219-s4
- **Region**: us-central1
- **Database**: Firestore (default)
- **Collections**: scans, findings, artifacts
- **Job Name**: scanner-job
- **Service Account**: scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com