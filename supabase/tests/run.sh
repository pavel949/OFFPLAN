#!/usr/bin/env bash
# Usage: PGHOST=... PGPORT=... PGUSER=postgres PGDATABASE=rls_test supabase/tests/run.sh
# Creates a scratch database, applies stub + migrations, runs RLS tests.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${PGDATABASE:-rls_test}"
psql -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists \"$DB\"" -c "create database \"$DB\"" >/dev/null
export PGDATABASE="$DB"
export PGOPTIONS="-c client_min_messages=warning"
psql -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f" || { echo "migration failed: $f"; exit 1; }
done
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/10_rls_hardening.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/20_registry.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/30_deals.sql | sed "/^$/d"

psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/40_project_evidence.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/60_project_sources.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/70_legal_topics.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/80_project_photos.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/90_cv_methodology.sql | sed "/^$/d"
psql -q -tA -v ON_ERROR_STOP=1 -f supabase/tests/50_privileges.sql | sed "/^$/d"
