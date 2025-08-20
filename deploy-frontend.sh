#!/bin/bash

# Deploy Frontend to Cloud Run

set -e

PROJECT_ID="precise-victory-467219-s4"
REGION="us-central1"
SERVICE_NAME="scanner-frontend"

echo "🚀 Deploying frontend to Cloud Run..."

# Submit build
echo "📦 Building and pushing container..."
gcloud builds submit \
  --config=cloudbuild-frontend.yaml \
  --project=$PROJECT_ID

# Get the service URL
echo "✅ Deployment complete!"
echo ""
echo "🌐 Frontend URL:"
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)"

echo ""
echo "📊 View logs:"
echo "gcloud logging read 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\"' --project=$PROJECT_ID --limit=20"