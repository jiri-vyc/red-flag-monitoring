#!/usr/bin/env bash
# Usage: deploy/api.sh
# Builds the backend as a Linux arm64 bundle and deploys it to the rfm-api Web Function.
source "$(dirname "$0")/common.sh"

bundle="$BUILD_DIR/api"
database="${RFM_DATABASE:-main}"

build_backend_bundle "$bundle"
cp "$DEPLOY_DIR/api/index.js" "$bundle/index.js"

aws lambda-web deploy --name "$API_FUNCTION" --create --code "$bundle" --entry-point index.js \
  --execution-role-arn "$(role_arn "$API_FUNCTION-execution")" \
  --endpoint-name "$ENDPOINT_NAME" --timeout-seconds 900 \
  --env NODE_ENV=production \
  --env DATABASE_AUTH=iam \
  --env "ENGINE_VERSION=$(git -C "$SRC_DIR" rev-parse --short HEAD)" \
  --env "DATABASE_URL=postgres://postgres@$(cluster_endpoint):5432/$database" \
  --env "DRAFTING_WORKER_FUNCTION=$DRAFTING_WORKER_FUNCTION" \
  --env ALERT_TRIAGE=bedrock \
  --env BEDROCK_AUTH=iam \
  --tags project=red-flag-monitoring \
  --query endpointUrl --output text
