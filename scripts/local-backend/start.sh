#!/usr/bin/env bash
# LOCAL TEST TOOLING ONLY. Postgres (already running) -> akm_dev DB -> PostgREST -> gateway on :54321.
# Needs a PostgREST binary at $POSTGREST_BIN (https://github.com/PostgREST/postgrest/releases).
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE="${DATABASE_URL:-postgres://postgres@localhost:5432}"; DB="${1:-akm_dev}"
bash scripts/db-reset.sh "$DB" >/dev/null
export LOCAL_JWT_SECRET="${LOCAL_JWT_SECRET:-local-dev-jwt-secret-local-dev-jwt-secret}"
cat > /tmp/akm-postgrest.conf <<CONF
db-uri = "$BASE/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$LOCAL_JWT_SECRET"
server-port = 54322
db-pool = 10
CONF
"${POSTGREST_BIN:-postgrest}" /tmp/akm-postgrest.conf >/tmp/postgrest.log 2>&1 &
echo $! > /tmp/postgrest.pid
sleep 1
DATABASE_URL="$BASE/$DB" node scripts/local-backend/gateway.mjs >/tmp/gateway.log 2>&1 &
echo $! > /tmp/gateway.pid
sleep 1; echo "backend up (postgrest pid $(cat /tmp/postgrest.pid), gateway pid $(cat /tmp/gateway.pid))"
