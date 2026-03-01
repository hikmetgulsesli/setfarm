#!/usr/bin/env bash
set -euo pipefail

# Setfarm installer
# Usage: curl -fsSL https://raw.githubusercontent.com/hikmetgulsesli/setfarm/v1.5.6/scripts/install.sh | bash

REPO="https://github.com/hikmetgulsesli/setfarm.git"
DEST="${HOME}/.openclaw/workspace/setfarm"

echo "Installing Setfarm..."

# Clone or pull
if [ -d "$DEST/.git" ]; then
  echo "Updating existing install..."
  git -C "$DEST" pull --ff-only origin main
else
  echo "Cloning repository..."
  git clone "$REPO" "$DEST"
fi

cd "$DEST"

# Build
echo "Installing dependencies..."
npm install --no-fund --no-audit

echo "Building..."
npm run build

# Link CLI globally
echo "Linking CLI..."
npm link

# Install workflows — use linked CLI or fall back to direct node
SETFARM="$(command -v setfarm 2>/dev/null || echo "")"
if [ -z "$SETFARM" ]; then
  SETFARM="node $DEST/dist/cli/cli.js"
fi

echo "Installing workflows..."
$SETFARM install

echo ""
echo "Setfarm installed! Run 'setfarm workflow list' to see available workflows."
