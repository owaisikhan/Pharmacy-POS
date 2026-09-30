#!/usr/bin/env bash
# Builds a fresh local database from the migrations and runs the scenario
# tests. Needs a local Postgres 16: PGHOST/PGPORT point at it.
set -euo pipefail
cd "$(dirname "$0")"
DB=pharmacy_pos_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f 00_supabase_stub.sql
for f in ../migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d $DB -f 10_scenarios.sql
echo "ALL SCENARIOS PASSED"
