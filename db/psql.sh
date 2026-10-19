#!/usr/bin/env bash
# Usage: db/psql.sh <database> [psql args...]
set -euo pipefail

database="${1:?usage: db/psql.sh <database> [psql args...]}"
shift
cluster="${RFM_CLUSTER:-database-1}"
export AWS_PROFILE="${AWS_PROFILE:-hackathon}" AWS_REGION="${AWS_REGION:-eu-central-1}"

account="$(aws sts get-caller-identity --query Account --output text)"
[ "$account" = 526983806399 ] || { echo "refusing to run against AWS account $account" >&2; exit 1; }

host="$(aws rds describe-db-clusters --db-cluster-identifier "$cluster" --query 'DBClusters[0].Endpoint' --output text)"

PGPASSWORD="$(aws rds generate-db-auth-token --hostname "$host" --port 5432 --username postgres)" \
PGOPTIONS='-c client_min_messages=warning' \
  exec psql "host=$host port=5432 dbname=$database user=postgres sslmode=verify-full sslrootcert=system connect_timeout=45" \
  -X -v ON_ERROR_STOP=1 "$@"
