#!/usr/bin/env bash
# Usage: db/create-wip.sh <name>   creates wip_<name> from golden and applies pending TypeORM migrations
set -euo pipefail

name="${1:?usage: db/create-wip.sh <name>}"
[[ "$name" =~ ^[a-z0-9_]+$ ]] || { echo "name must match [a-z0-9_]+" >&2; exit 1; }
database="wip_$name"
cluster="${RFM_CLUSTER:-database-1}"
export AWS_PROFILE="${AWS_PROFILE:-hackathon}" AWS_REGION="${AWS_REGION:-eu-central-1}"

cd "$(git rev-parse --show-toplevel)"
host="$(aws rds describe-db-clusters --db-cluster-identifier "$cluster" --query 'DBClusters[0].Endpoint' --output text)"
database_url="postgres://postgres@$host:5432/$database"

db/psql.sh postgres -c "create database $database template golden"
# Template copies keep golden's name in typeorm_metadata; TypeORM matches it against current_database() and would see false drift.
db/psql.sh "$database" -q -c "update typeorm_metadata set database = current_database()"

(cd src && DATABASE_AUTH=iam DATABASE_URL="$database_url" npm run migration:run -w backend)

echo
echo "Ready: $database"
echo "  DATABASE_AUTH=iam DATABASE_URL=$database_url"
echo "  Drop when done: db/psql.sh postgres -c 'drop database $database'"
