#!/usr/bin/env bash
set -euo pipefail

# Make script path-safe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# Validate .env.test exists
if [[ ! -f ".env.test" ]]; then
  echo "Missing .env.test in backend/" >&2
  exit 1
fi

# Load environment variables
set -a
source ".env.test"
set +a

# Validate required variables
if [[ -z "${TEST_DATABASE_HOST:-}" || -z "${TEST_DATABASE_USER:-}" || -z "${TEST_DATABASE_PASSWORD:-}" ]]; then
  echo "Missing required TEST_DATABASE_* variables in .env.test" >&2
  exit 1
fi

# Set default port
PORT="${TEST_DATABASE_PORT:-5432}"

export PGPASSWORD="$TEST_DATABASE_PASSWORD"

# Terminate any active connections
echo "Terminating active connections to inner_wallet_test..."
psql -h "$TEST_DATABASE_HOST" -U "$TEST_DATABASE_USER" -p "$PORT" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='inner_wallet_test';" || true

# Drop database
echo "Dropping database inner_wallet_test..."
psql -h "$TEST_DATABASE_HOST" -U "$TEST_DATABASE_USER" -p "$PORT" -d postgres -c "DROP DATABASE IF EXISTS inner_wallet_test;"
echo "Database dropped."
