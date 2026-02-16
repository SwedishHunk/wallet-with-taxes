#!/usr/bin/env bash
set -euo pipefail

# Make script path-safe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamped log filename
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="logs/e2e-${TIMESTAMP}.log"

# Run command and tee output, capture exit code
set +e
"$@" 2>&1 | tee "$LOG_FILE"
EXIT_CODE=$?
set -e

exit $EXIT_CODE
