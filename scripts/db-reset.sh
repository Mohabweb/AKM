#!/usr/bin/env bash
# Rebuilds a throwaway local Postgres database from migrations + seed, for tests.
# Usage: DATABASE_URL=postgres://postgres@localhost:5432 scripts/db-reset.sh [dbname]
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${DATABASE_URL:-postgres://postgres@localhost:5432}"
DB="${1:-akm_test}"
psql "$BASE/postgres" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB with (force)" -c "create database $DB"
URL="$BASE/$DB"
psql "$URL" -v ON_ERROR_STOP=1 -q -f db/test/bootstrap.sql
for f in db/migrations/*.sql; do echo "-> $f"; psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$URL" -v ON_ERROR_STOP=1 -q -f db/seed.sql
echo "ready: $URL"
