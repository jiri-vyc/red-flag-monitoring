# Sourced by the deploy scripts.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-hackathon}" AWS_REGION="${AWS_REGION:-eu-central-1}"

ACCOUNT_ID=526983806399
API_FUNCTION=rfm-api
WEB_FUNCTION=rfm-web
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
