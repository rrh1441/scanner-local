#\!/bin/bash

# GCP Scanner Deployment Script
# This script contains all the commands needed to deploy the scanner to GCP

set -e

# Configuration
PROJECT_ID="precise-victory-467219-s4"
REGION="us-central1"
SERVICE_ACCOUNT="scanner-worker-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 GCP Scanner Deployment Script"
echo "================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Function to run gcloud commands with error handling
run_gcloud() {
    echo "Running: $@"
    if \! "$@"; then
        echo "❌ Command failed. You may need to run: gcloud auth login"
        exit 1
    fi
    echo "✅ Success"
    echo ""
}

echo "📋 Step 1: Update Cloud Run Job with environment variable"
echo "This sets RUNTIME_MODE=gcp so the worker knows it's running in Cloud Run"
echo "Command to run:"
echo "gcloud run jobs update scanner-job \\"
echo "    --set-env-vars=\"RUNTIME_MODE=gcp\" \\"
echo "    --region=$REGION \\"
echo "    --project=$PROJECT_ID"
echo ""

echo "📋 Step 2: Set up Eventarc Trigger"
echo "This connects Pub/Sub to the Cloud Run Job"
echo "Command to run:"
echo "gcloud eventarc triggers create scan-trigger \\"
echo "    --destination-run-job=scanner-job \\"
echo "    --destination-run-region=$REGION \\"
echo "    --location=$REGION \\"
echo "    --project=$PROJECT_ID \\"
echo "    --event-filters=\"type=google.cloud.pubsub.topic.v1.messagePublished\" \\"
echo "    --service-account=\"$SERVICE_ACCOUNT\" \\"
echo "    --transport-topic=scan-jobs"
echo ""

echo "📋 Step 3: Grant Secret Manager access"
echo "This allows the job to access the SHODAN_API_KEY secret"
echo "Commands to run:"
echo "# Grant access to the secret"
echo "gcloud secrets add-iam-policy-binding shodan-api-key \\"
echo "    --member=\"serviceAccount:$SERVICE_ACCOUNT\" \\"
echo "    --role=\"roles/secretmanager.secretAccessor\" \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "# Update the job to use the secret"
echo "gcloud run jobs update scanner-job \\"
echo "    --update-secrets=\"SHODAN_API_KEY=shodan-api-key:latest\" \\"
echo "    --region=$REGION \\"
echo "    --project=$PROJECT_ID"
echo ""

echo "📋 Step 4: Test the deployment"
echo "Publish a test message to trigger a scan"
echo "Command to run:"
echo "gcloud pubsub topics publish scan-jobs \\"
echo "    --message='{"
echo "      \"scanId\": \"test-$(date +%s)\","
echo "      \"companyName\": \"Test Company\","
echo "      \"domain\": \"example.com\","
echo "      \"originalDomain\": \"example.com\","
echo "      \"tags\": [\"test\"],"
echo "      \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
echo "    }' \\"
echo "    --project=$PROJECT_ID"
echo ""

echo "📋 Step 5: Check logs"
echo "View the job execution logs"
echo "Command to run:"
echo "gcloud logging read 'resource.type=\"cloud_run_job\" resource.labels.job_name=\"scanner-job\"' \\"
echo "    --project=$PROJECT_ID --limit=50 --format=json | jq -r '.[] | .textPayload'"
echo ""

echo "📋 Additional useful commands:"
echo ""
echo "# List all Cloud Run jobs:"
echo "gcloud run jobs list --region=$REGION --project=$PROJECT_ID"
echo ""
echo "# Describe the scanner job:"
echo "gcloud run jobs describe scanner-job --region=$REGION --project=$PROJECT_ID"
echo ""
echo "# List Eventarc triggers:"
echo "gcloud eventarc triggers list --location=$REGION --project=$PROJECT_ID"
echo ""
echo "# View recent Pub/Sub messages:"
echo "gcloud pubsub subscriptions pull scan-jobs-subscription --auto-ack --limit=10 --project=$PROJECT_ID"
echo ""

echo "⚠️  IMPORTANT: You need to run these commands manually with proper authentication."
echo "Run 'gcloud auth login' first if you haven't already."
EOF < /dev/null