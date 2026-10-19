#!/usr/bin/env bash
# Usage: deploy/drafting-worker.sh
# Builds the backend as a Linux arm64 bundle and deploys it to the rfm-drafting-worker Lambda, which the API
# invokes asynchronously for each drafting job (backend/src/draftingWorker.ts).
source "$(dirname "$0")/common.sh"

bundle="$BUILD_DIR/drafting-worker"
archive="$BUILD_DIR/drafting-worker.zip"
database="${RFM_DATABASE:-main}"
handler="backend/dist/draftingWorker.handler"
# Drafts with Claude on Bedrock (default model in backend/src/config.ts), signed with the execution role's credentials.
environment="Variables={NODE_ENV=production,DATABASE_AUTH=iam,DATABASE_URL=postgres://postgres@$(cluster_endpoint):5432/$database,DRAFT_GENERATOR=bedrock,BEDROCK_AUTH=iam}"

build_backend_bundle "$bundle"
rm -f "$archive"
(cd "$bundle" && zip -qr "$archive" .)

if aws lambda get-function --function-name "$DRAFTING_WORKER_FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$DRAFTING_WORKER_FUNCTION" \
    --zip-file "fileb://$archive" --architectures arm64 >/dev/null
  aws lambda wait function-updated-v2 --function-name "$DRAFTING_WORKER_FUNCTION"
  aws lambda update-function-configuration --function-name "$DRAFTING_WORKER_FUNCTION" \
    --role "$(role_arn "$DRAFTING_WORKER_FUNCTION-execution")" --handler "$handler" --runtime nodejs24.x \
    --timeout 900 --memory-size 1024 --environment "$environment" >/dev/null
else
  aws lambda create-function --function-name "$DRAFTING_WORKER_FUNCTION" \
    --zip-file "fileb://$archive" --architectures arm64 \
    --role "$(role_arn "$DRAFTING_WORKER_FUNCTION-execution")" --handler "$handler" --runtime nodejs24.x \
    --timeout 900 --memory-size 1024 --environment "$environment" \
    --tags project=red-flag-monitoring >/dev/null
fi
aws lambda wait function-updated-v2 --function-name "$DRAFTING_WORKER_FUNCTION"

# A failed job is retried by the user as a new job (POST /api/drafting-jobs/:id/retry), not by Lambda.
aws lambda put-function-event-invoke-config --function-name "$DRAFTING_WORKER_FUNCTION" \
  --maximum-retry-attempts 0 --maximum-event-age-in-seconds 900 >/dev/null

# Caps parallel Bedrock calls. Accounts with a low concurrency quota cannot reserve any, so this is best effort.
if ! aws lambda put-function-concurrency --function-name "$DRAFTING_WORKER_FUNCTION" \
  --reserved-concurrent-executions 3 >/dev/null; then
  echo "warning: could not reserve concurrency for $DRAFTING_WORKER_FUNCTION, it runs unreserved" >&2
fi

echo "$DRAFTING_WORKER_FUNCTION is up to date"
