#!/usr/bin/env bash
# run-safe.sh — Per-repo flock locking for parallel run protection
# Adapted from upstream antfarm PR #251
#
# Usage: run-safe.sh <repo_path> <workflow_id> [run_label]
#
# Ensures only one setfarm workflow runs per repo at a time.
# Uses flock to acquire an exclusive lock before starting the run.

set -euo pipefail

REPO_PATH="${1:?Usage: run-safe.sh <repo_path> <workflow_id> [run_label]}"
WORKFLOW_ID="${2:?Usage: run-safe.sh <repo_path> <workflow_id> [run_label]}"
RUN_LABEL="${3:-}"

# Validate repo path
if [ ! -d "$REPO_PATH" ]; then
  echo "ERROR: Directory does not exist: $REPO_PATH" >&2
  exit 2
fi

if [ ! -d "$REPO_PATH/.git" ]; then
  echo "ERROR: Not a git repository: $REPO_PATH" >&2
  exit 2
fi

# Create a safe lock key from the repo path
SAFE_KEY=$(echo "$REPO_PATH" | tr "/" "-" | tr " " "_" | sed "s/^-//")
LOCK_FILE="/tmp/setfarm-${SAFE_KEY}.lock"

echo "[run-safe] Repo: $REPO_PATH"
echo "[run-safe] Workflow: $WORKFLOW_ID"
echo "[run-safe] Lock file: $LOCK_FILE"

# Try to acquire lock (non-blocking)
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "ERROR: Another setfarm run is already active for this repo." >&2
  echo "Lock file: $LOCK_FILE" >&2
  echo "To force: rm $LOCK_FILE" >&2
  exit 1
fi

echo "[run-safe] Lock acquired. Starting workflow..."

# Build the run command
CMD="setfarm workflow run --workflow $WORKFLOW_ID --repo $REPO_PATH"
if [ -n "$RUN_LABEL" ]; then
  CMD="$CMD --label \"$RUN_LABEL\""
fi

# Execute
eval "$CMD"
EXIT_CODE=$?

echo "[run-safe] Workflow finished with exit code: $EXIT_CODE"
exit $EXIT_CODE
