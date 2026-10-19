#!/usr/bin/env bash
# Usage: [BACKEND_URL=https://...] [NEXT_PUBLIC_API_MODE=mock|live] deploy/web.sh
# Builds the Next.js standalone bundle for Linux arm64 and deploys it to the rfm-web Web Function.
source "$(dirname "$0")/common.sh"

bundle="$BUILD_DIR/web"
backend_url="${BACKEND_URL:-$(endpoint_url "$API_FUNCTION")}"
api_mode="${NEXT_PUBLIC_API_MODE:-mock}"
image=rfm-web-build

# BACKEND_URL and NEXT_PUBLIC_* are baked into the bundle at build time; changing them needs a redeploy.
docker build --platform linux/arm64 --target build -f "$SRC_DIR/web/Dockerfile" -t "$image" \
  --build-arg "BACKEND_URL=$backend_url" --build-arg "NEXT_PUBLIC_API_MODE=$api_mode" "$SRC_DIR"

rm -rf "$bundle"
mkdir -p "$bundle"
container="$(docker create --platform linux/arm64 "$image")"
trap 'docker rm "$container" >/dev/null' EXIT
docker cp "$container:/app/web/.next/standalone/." "$bundle/"
docker cp "$container:/app/web/.next/static" "$bundle/web/.next/static"
docker cp "$container:/app/web/public" "$bundle/web/public"
cp "$DEPLOY_DIR/web/index.js" "$bundle/index.js"
assert_no_symlinks "$bundle"

aws lambda-web deploy --name "$WEB_FUNCTION" --create --code "$bundle" --entry-point index.js \
  --execution-role-arn "$(role_arn "$WEB_FUNCTION-execution")" \
  --endpoint-name "$ENDPOINT_NAME" --timeout-seconds 900 \
  --env NODE_ENV=production \
  --env NEXT_TELEMETRY_DISABLED=1 \
  --env "BACKEND_URL=$backend_url" \
  --tags project=red-flag-monitoring \
  --query endpointUrl --output text
