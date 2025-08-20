#\!/bin/bash

# GCP Scanner Deployment Commands
# Copy and paste these commands one by one

# Configuration
PROJECT_ID="precise-victory-467219-s4"
REGION="us-central1"

echo "=== GCP Scanner Deployment Commands ==="
echo ""
echo "Step 1: Update Cloud Run Job with environment variable"
echo "------------------------------------------------------"
cat << 'STEP1'
gcloud run jobs update scanner-job \
    --set-env-vars="RUNTIME_MODE=gcp" \
    --region=us-central1 \
    --project=precise-victory-467219-s4
STEP1

echo ""
echo "Step 2: Set up Eventarc Trigger"
echo "-------------------------------"
cat << 'STEP2'
gcloud eventarc triggers create scan-trigger \
    --destination-run-job=scanner-job \
    --destination-run-region=us-central1 \
    --location=us-central1 \
    --project=precise-victory-467219-s4 \
    --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" \
    --service-account="scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com" \
    --transport-topic=scan-jobs
STEP2

echo ""
echo "Step 3a: Grant Secret Manager access"
echo "------------------------------------"
cat << 'STEP3A'
gcloud secrets add-iam-policy-binding shodan-api-key \
    --member="serviceAccount:scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=precise-victory-467219-s4
STEP3A

echo ""
echo "Step 3b: Update job with secret"
echo "-------------------------------"
cat << 'STEP3B'
gcloud run jobs update scanner-job \
    --update-secrets="SHODAN_API_KEY=shodan-api-key:latest" \
    --region=us-central1 \
    --project=precise-victory-467219-s4
STEP3B

echo ""
echo "Step 4: Test with a scan"
echo "------------------------"
cat << 'STEP4'
gcloud pubsub topics publish scan-jobs \
    --message='{
      "scanId": "test-123",
      "companyName": "Test Company",
      "domain": "example.com",
      "originalDomain": "example.com",
      "tags": ["test"],
      "createdAt": "2024-01-30T12:00:00Z"
    }' \
    --project=precise-victory-467219-s4
STEP4

echo ""
echo "Step 5: Check logs"
echo "------------------"
cat << 'STEP5'
gcloud logging read 'resource.type="cloud_run_job" resource.labels.job_name="scanner-job"' \
    --project=precise-victory-467219-s4 --limit=50 --format=json | jq -r '.[] | .textPayload'
STEP5

echo ""
echo "=== End of Commands ==="
