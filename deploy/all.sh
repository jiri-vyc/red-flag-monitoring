#!/usr/bin/env bash
# Usage: deploy/all.sh
# Roles first, then the drafting worker the API launches jobs in, then the API, then the web, which bakes
# the API endpoint into its /api rewrite.
set -euo pipefail
deploy_dir="$(dirname "$0")"

"$deploy_dir/roles.sh"
"$deploy_dir/drafting-worker.sh"
"$deploy_dir/api.sh"
"$deploy_dir/web.sh"
