#!/usr/bin/env bash
# Usage: deploy/roles.sh
# Creates or updates the least-privilege execution roles rfm-api-execution, rfm-web-execution and
# rfm-drafting-worker-execution, their log groups (10 years for the audit log, 14 days for the web) and the
# saved Logs Insights query rfm/audit.
source "$(dirname "$0")/common.sh"

cluster_resource_id="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER" \
  --query 'DBClusters[0].DbClusterResourceId' --output text)"
eu_anthropic_profiles="arn:aws:bedrock:$AWS_REGION:$ACCOUNT_ID:inference-profile/eu.anthropic.*"
drafting_worker_arn="arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$DRAFTING_WORKER_FUNCTION"

trust_policy='{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}'

# The runtime writes to the configured group and to a sibling "<group>.local".
logs_statements() {
  local log_group="arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/aws/lambda/web/$1"
  cat <<JSON
    {
      "Sid": "CreateLogGroups",
      "Effect": "Allow",
      "Action": "logs:CreateLogGroup",
      "Resource": ["$log_group", "$log_group:*", "$log_group.local", "$log_group.local:*"]
    },
    {
      "Sid": "WriteLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": ["$log_group:*", "$log_group.local:*"]
    }
JSON
}

# Statements shared by the API and the drafting worker: Aurora as postgres, Anthropic models via EU profiles.
data_statements() {
  cat <<JSON
    {
      "Sid": "ConnectToAurora",
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:$AWS_REGION:$ACCOUNT_ID:dbuser:$cluster_resource_id/postgres"
    },
    {
      "Sid": "InvokeEuAnthropicProfiles",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "$eu_anthropic_profiles"
    },
    {
      "Sid": "InvokeAnthropicModelsOnlyThroughEuProfiles",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:eu-*::foundation-model/anthropic.*",
      "Condition": { "StringLike": { "bedrock:InferenceProfileArn": "$eu_anthropic_profiles" } }
    }
JSON
}

api_policy="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
$(logs_statements "$API_FUNCTION"),
$(data_statements),
    {
      \"Sid\": \"LaunchDraftingJobs\",
      \"Effect\": \"Allow\",
      \"Action\": \"lambda:InvokeFunction\",
      \"Resource\": \"$drafting_worker_arn\"
    }
  ]
}"

# A classic Lambda writes to /aws/lambda/<name>, not to the /aws/lambda/web/ groups of Web Functions.
drafting_worker_log_group="arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/aws/lambda/$DRAFTING_WORKER_FUNCTION"
drafting_worker_policy="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Sid\": \"WriteLogs\",
      \"Effect\": \"Allow\",
      \"Action\": [\"logs:CreateLogStream\", \"logs:PutLogEvents\"],
      \"Resource\": \"$drafting_worker_log_group:*\"
    },
$(data_statements)
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

# The API and the drafting worker write the audit log (#5): AML Act § 16 keeps records for 10 years.
AUDIT_RETENTION_DAYS=3653
DEFAULT_RETENTION_DAYS=14
AUDIT_QUERY_NAME="rfm/audit"

ensure_log_group() {
  local log_group="$1" retention_days="$2"

  if [ "$(aws logs describe-log-groups --log-group-name-prefix "$log_group" \
    --query "length(logGroups[?logGroupName=='$log_group'])" --output text)" = 0 ]; then
    aws logs create-log-group --log-group-name "$log_group" --tags project=red-flag-monitoring
  fi

  aws logs put-retention-policy --log-group-name "$log_group" --retention-in-days "$retention_days"
}

# Audit lines come as a JSON envelope's "message" from the Web Function and as plain text from the classic Lambda;
# the regex follows formatAuditLine in backend/src/application/audit/auditLog.ts.
ensure_audit_query() {
  local query_id
  local query_string='fields @timestamp, @log, coalesce(message, @message) as line
| filter line like "[audit] "
| parse line /\[audit\] action=(?<action>\S+) entity_type=(?<entityType>\S+) entity_id=(?<entityId>\S+) actor_id=(?<actorId>\S+) payload=(?<payload>.*) \[\/audit\]/
| display @timestamp, action, entityType, entityId, actorId, payload, @log
| sort @timestamp desc
| limit 1000'

  query_id="$(aws logs describe-query-definitions --query-definition-name-prefix "$AUDIT_QUERY_NAME" \
    --query "queryDefinitions[?name=='$AUDIT_QUERY_NAME'].queryDefinitionId | [0]" --output text)"

  if [ "$query_id" = None ]; then
    aws logs put-query-definition --name "$AUDIT_QUERY_NAME" --query-string "$query_string" \
      --log-group-names "/aws/lambda/web/$API_FUNCTION" "/aws/lambda/$DRAFTING_WORKER_FUNCTION" >/dev/null
  else
    aws logs put-query-definition --name "$AUDIT_QUERY_NAME" --query-string "$query_string" \
      --log-group-names "/aws/lambda/web/$API_FUNCTION" "/aws/lambda/$DRAFTING_WORKER_FUNCTION" \
      --query-definition-id "$query_id" >/dev/null
  fi

  echo "Logs Insights query $AUDIT_QUERY_NAME is up to date"
}

ensure_log_group "/aws/lambda/web/$API_FUNCTION" "$AUDIT_RETENTION_DAYS"
ensure_log_group "/aws/lambda/web/$API_FUNCTION.local" "$AUDIT_RETENTION_DAYS"
ensure_log_group "/aws/lambda/web/$WEB_FUNCTION" "$DEFAULT_RETENTION_DAYS"
ensure_log_group "/aws/lambda/web/$WEB_FUNCTION.local" "$DEFAULT_RETENTION_DAYS"
ensure_log_group "/aws/lambda/$DRAFTING_WORKER_FUNCTION" "$AUDIT_RETENTION_DAYS"
ensure_audit_query
ensure_role "$API_FUNCTION-execution" "$api_policy" \
  "rfm-api Web Function: logs, Aurora IAM auth, Bedrock EU Anthropic, launching drafting jobs"
ensure_role "$WEB_FUNCTION-execution" "$web_policy" "rfm-web Web Function: logs only"
ensure_role "$DRAFTING_WORKER_FUNCTION-execution" "$drafting_worker_policy" \
  "rfm-drafting-worker Lambda: logs, Aurora IAM auth, Bedrock EU Anthropic"
