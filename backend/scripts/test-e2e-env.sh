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

# Set NODE_ENV for test
export NODE_ENV=test

# Run e2e tests
npm run test:e2e
