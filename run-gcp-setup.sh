#!/bin/bash
set -e

PROJECT_ID="precise-victory-467219-s4"
REGION="us-central1"

echo "1. Rebuilding Docker image with updated code..."
gcloud builds submit --config cloudbuild-worker.yaml --project=$PROJECT_ID

echo "2. Updating Cloud Run Job with environment variable..."
gcloud run jobs update scanner-job \
    --set-env-vars="RUNTIME_MODE=gcp" \
    --region=$REGION \
    --project=$PROJECT_ID

echo "3. Granting Secret Manager access..."
gcloud secrets add-iam-policy-binding shodan-api-key \
    --member="serviceAccount:scanner-worker-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

echo "4. Adding secret to Cloud Run Job..."
gcloud run jobs update scanner-job \
    --update-secrets="SHODAN_API_KEY=shodan-api-key:latest" \
    --region=$REGION \
    --project=$PROJECT_ID

echo "5. Creating Eventarc trigger..."
gcloud eventarc triggers create scan-trigger \
    --destination-run-job=scanner-job \
    --destination-run-region=$REGION \
    --location=$REGION \
    --project=$PROJECT_ID \
    --event-filters="type=google.cloud.pubsub.topic.v1.messagePublished" \
    --service-account="scanner-worker-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --transport-topic=scan-jobs \
    || echo "Trigger might already exist"

echo "✅ Setup complete. Test with:"
echo "gcloud pubsub topics publish scan-jobs --message='{\"scanId\":\"test-123\",\"companyName\":\"Test Company\",\"domain\":\"example.com\",\"createdAt\":\"2024-01-30T12:00:00Z\"}' --project=$PROJECT_ID"