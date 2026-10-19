# Sourced by the deploy scripts.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-hackathon}" AWS_REGION="${AWS_REGION:-eu-central-1}"

ACCOUNT_ID=526983806399
API_FUNCTION=rfm-api
WEB_FUNCTION=rfm-web
DRAFTING_WORKER_FUNCTION=rfm-drafting-worker
ENDPOINT_NAME=dev
CLUSTER="${RFM_CLUSTER:-database-1}"

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(cd "$DEPLOY_DIR/../src" && pwd)"
BUILD_DIR="$DEPLOY_DIR/.build"

account="$(aws sts get-caller-identity --query Account --output text)"
[ "$account" = "$ACCOUNT_ID" ] || { echo "refusing to run against AWS account $account" >&2; exit 1; }
[ "$AWS_REGION" = eu-central-1 ] || { echo "refusing to deploy to region $AWS_REGION" >&2; exit 1; }

role_arn() {
  echo "arn:aws:iam::$ACCOUNT_ID:role/$1"
}

endpoint_url() {
  echo "https://$(aws lambda-web get-web-function-endpoint --function-name "$1" --endpoint-name "$ENDPOINT_NAME" \
    --query domainName --output text)"
}

assert_no_symlinks() {
  if [ -n "$(find "$1" -type l -print -quit)" ]; then
    echo "bundle $1 contains symlinks, which lambda-web deploy skips:" >&2
    find "$1" -type l >&2
    exit 1
  fi
}

cluster_endpoint() {
  aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" --query 'DBClusters[0].Endpoint' --output text
}

# tsc output plus a production-only npm ci for Linux arm64, shared by the API and the drafting worker.
build_backend_bundle() {
  local bundle="$1"

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
  assert_no_symlinks "$bundle"
}
