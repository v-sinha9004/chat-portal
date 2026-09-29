#!/bin/bash
set -e

# Automatically create both logical databases if they do not exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE chat_portal_auth'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'chat_portal_auth')\gexec
    SELECT 'CREATE DATABASE chat_portal_users'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'chat_portal_users')\gexec
EOSQL
