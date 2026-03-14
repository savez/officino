#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Permissions already set via POSTGRES_USER/POSTGRES_DB env vars
    -- This script runs on first init only
    SELECT 'Database initialized' as status;
EOSQL
