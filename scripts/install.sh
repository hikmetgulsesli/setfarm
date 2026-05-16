#!/usr/bin/env bash
set -euo pipefail

# Setfarm installer
# Usage: curl -fsSL https://raw.githubusercontent.com/hikmetgulsesli/setfarm/v2.3.37/scripts/install.sh | bash

REPO="https://github.com/hikmetgulsesli/setfarm.git"
DEST="${HOME}/.openclaw/workspace/setfarm"
LEGACY_DEST="${HOME}/.openclaw/setfarm-repo"

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

# Runtime scripts still resolve the platform source through this stable path.
# Keep it as a compatibility link to the real install root.
if [ -L "$LEGACY_DEST" ]; then
  ln -sfn "$DEST" "$LEGACY_DEST"
elif [ ! -e "$LEGACY_DEST" ]; then
  ln -s "$DEST" "$LEGACY_DEST"
else
  echo "Note: $LEGACY_DEST already exists; leaving it unchanged."
fi

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
