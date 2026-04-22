#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="/Users/meenaali/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"

cd "$SCRIPT_DIR"
"$PYTHON_BIN" run.py
