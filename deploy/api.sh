#!/usr/bin/env bash
# Usage: deploy/api.sh
# Builds the backend as a Linux arm64 bundle and deploys it to the rfm-api Web Function.
source "$(dirname "$0")/common.sh"

bundle="$BUILD_DIR/api"
database="${RFM_DATABASE:-main}"
cluster_endpoint="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" \
  --query 'DBClusters[0].Endpoint' --output text)"

npm run build --prefix "$SRC_DIR" -w backend

rm -rf "$bundle"
mkdir -p "$bundle/backend" "$bundle/web"
cp "$SRC_DIR/package.json" "$SRC_DIR/package-lock.json" "$bundle/"
cp "$SRC_DIR/backend/package.json" "$bundle/backend/"
cp "$SRC_DIR/web/package.json" "$bundle/web/"
docker run --rm --platform linux/arm64 -v "$bundle:/app" -w /app node:24 \
  npm ci --omit=dev --workspace backend --no-audit --no-fund
# Workspace links point at packages that are either copied below or not shipped.
rm -rf "$bundle/web" "$bundle/node_modules/backend" "$bundle/node_modules/web" "$bundle/node_modules/.bin"
cp -R "$SRC_DIR/backend/dist" "$bundle/backend/dist"
cp "$DEPLOY_DIR/api/index.js" "$bundle/index.js"
assert_no_symlinks "$bundle"

aws lambda-web deploy --name "$API_FUNCTION" --create --code "$bundle" --entry-point index.js \
  --execution-role-arn "$(role_arn "$API_FUNCTION-execution")" \
  --endpoint-name "$ENDPOINT_NAME" --timeout-seconds 900 \
  --env NODE_ENV=production \
  --env DATABASE_AUTH=iam \
  --env "ENGINE_VERSION=$(git -C "$SRC_DIR" rev-parse --short HEAD)" \
  --env "DATABASE_URL=postgres://postgres@$cluster_endpoint:5432/$database" \
  --tags project=red-flag-monitoring \
  --query endpointUrl --output text
