#!/usr/bin/env bash
set -euo pipefail

# Make script path-safe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

echo "Resetting test database..."
bash "$SCRIPT_DIR/db-drop-test.sh"
bash "$SCRIPT_DIR/db-create-test.sh"
echo "Test database reset complete."
