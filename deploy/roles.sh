#!/usr/bin/env bash
# Usage: deploy/roles.sh
# Creates or updates the least-privilege execution roles rfm-api-execution and rfm-web-execution.
source "$(dirname "$0")/common.sh"

cluster_resource_id="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" \
  --query 'DBClusters[0].DbClusterResourceId' --output text)"
eu_anthropic_profiles="arn:aws:bedrock:$AWS_REGION:$ACCOUNT_ID:inference-profile/eu.anthropic.*"

trust_policy='{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}'

logs_statements() {
  local log_group="arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/aws/lambda/web/$1"
  cat <<JSON
    { "Sid": "CreateLogGroup", "Effect": "Allow", "Action": "logs:CreateLogGroup", "Resource": "$log_group" },
    {
      "Sid": "WriteLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "$log_group:*"
    }
JSON
}

api_policy="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
$(logs_statements "$API_FUNCTION"),
    {
      \"Sid\": \"ConnectToAurora\",
      \"Effect\": \"Allow\",
      \"Action\": \"rds-db:connect\",
      \"Resource\": \"arn:aws:rds-db:$AWS_REGION:$ACCOUNT_ID:dbuser:$cluster_resource_id/postgres\"
    },
    {
      \"Sid\": \"InvokeEuAnthropicProfiles\",
      \"Effect\": \"Allow\",
      \"Action\": [\"bedrock:InvokeModel\", \"bedrock:InvokeModelWithResponseStream\"],
      \"Resource\": \"$eu_anthropic_profiles\"
    },
    {
      \"Sid\": \"InvokeAnthropicModelsOnlyThroughEuProfiles\",
      \"Effect\": \"Allow\",
      \"Action\": [\"bedrock:InvokeModel\", \"bedrock:InvokeModelWithResponseStream\"],
      \"Resource\": \"arn:aws:bedrock:eu-*::foundation-model/anthropic.*\",
      \"Condition\": { \"StringLike\": { \"bedrock:InferenceProfileArn\": \"$eu_anthropic_profiles\" } }
    }
  ]
}"

web_policy="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
$(logs_statements "$WEB_FUNCTION")
  ]
}"

ensure_role() {
  local role_name="$1" policy="$2" description="$3"

  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    aws iam update-assume-role-policy --role-name "$role_name" --policy-document "$trust_policy"
  else
    aws iam create-role --role-name "$role_name" --description "$description" \
      --assume-role-policy-document "$trust_policy" --tags Key=project,Value=red-flag-monitoring >/dev/null
  fi

  aws iam put-role-policy --role-name "$role_name" --policy-name execution --policy-document "$policy"
  echo "role $(role_arn "$role_name") is up to date"
}

ensure_role "$API_FUNCTION-execution" "$api_policy" "rfm-api Web Function: logs, Aurora IAM auth, Bedrock EU Anthropic"
ensure_role "$WEB_FUNCTION-execution" "$web_policy" "rfm-web Web Function: logs only"
