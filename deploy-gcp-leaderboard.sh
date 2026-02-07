#!/bin/bash
set -e

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SA_EMAIL="leaderboard-writer@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Using project: $PROJECT_ID"
echo "Service Account: $SA_EMAIL"

# Enable required APIs
echo "Enabling Cloud Functions and Cloud Build APIs..."
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com

# Deploy function
echo "Deploying Cloud Function 'leaderboard'..."
gcloud functions deploy leaderboard \
  --gen2 \
  --runtime nodejs20 \
  --entry-point leaderboard \
  --source ./gcp-function \
  --region $REGION \
  --trigger-http \
  --allow-unauthenticated \
  --service-account $SA_EMAIL \
  --set-env-vars BUCKET_NAME=local34-game-leaderboard

# Get URL
echo "Getting function URL..."
URL=$(gcloud functions describe leaderboard --gen2 --region $REGION --format="value(serviceConfig.uri)")

echo "----------------------------------------"
echo "Deployment successful!"
echo "Function URL: $URL"
echo "----------------------------------------"

# Update .env or config if possible (but user might need to verify)
echo "Please update your frontend configuration with this URL."
