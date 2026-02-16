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

# Set NODE_ENV for test
export NODE_ENV=test

# Reset test database and run e2e tests
echo "Running deterministic e2e test suite..."
echo "Step 1: Reset test database..."
npm run db:reset:test

echo "Step 2: Running e2e tests..."
npm run test:e2e

echo "E2E test suite completed successfully."
