#!/usr/bin/env bash
set -euo pipefail

# Setfarm installer
# Usage: curl -fsSL https://raw.githubusercontent.com/hikmetgulsesli/setfarm/v2.3.78/scripts/install.sh | bash

REPO="https://github.com/hikmetgulsesli/setfarm.git"
DEST="${HOME}/.openclaw/workspace/setfarm"
LEGACY_DEST="${HOME}/.openclaw/setfarm-repo"
CONFIG_DIR="${HOME}/.openclaw/setfarm"
CONFIG_ENV="${CONFIG_DIR}/.env.local"

echo "Installing Setfarm..."

mkdir -p "$(dirname "$DEST")" "$(dirname "$LEGACY_DEST")"

migrate_runtime_env() {
  local source_dir="$1"
  local source_env=""
  local migrated=0

  for candidate in \
    "$source_dir/scripts/.env.local" \
    "$source_dir/scripts/.env" \
    "$source_dir/.env.local" \
    "$source_dir/.env"; do
    if [ -f "$candidate" ]; then
      source_env="$candidate"
      break
    fi
  done

  if [ -z "$source_env" ]; then
    return
  fi

  mkdir -p "$CONFIG_DIR"
  touch "$CONFIG_ENV"
  chmod 600 "$CONFIG_ENV" 2>/dev/null || true

  for key in STITCH_API_KEY SETFARM_PG_URL DATABASE_URL MASTER_POSTGRES_URL MASTER_MARIADB_URL MASTER_MONGODB_URL; do
    if grep -Eq "^(export[[:space:]]+)?${key}=" "$source_env" && ! grep -Eq "^(export[[:space:]]+)?${key}=" "$CONFIG_ENV"; then
      grep -E "^(export[[:space:]]+)?${key}=" "$source_env" | tail -n 1 >> "$CONFIG_ENV"
      migrated=1
    fi
  done

  if [ "$migrated" = "1" ]; then
    echo "Migrated runtime env keys to $CONFIG_ENV"
  fi
}

migrate_runtime_env_from_backups() {
  for backup in "${HOME}"/.openclaw/setfarm-repo.backup-*; do
    if [ -d "$backup" ]; then
      migrate_runtime_env "$backup"
    fi
  done
}

# Clone or pull
if [ -d "$DEST/.git" ]; then
  echo "Updating existing install..."
  git -C "$DEST" pull --ff-only origin main
else
  echo "Cloning repository..."
  git clone "$REPO" "$DEST"
fi

cd "$DEST"

migrate_runtime_env "$DEST"
migrate_runtime_env_from_backups

# Runtime scripts still resolve the platform source through this stable path.
# Keep it as a compatibility link to the real install root.
link_legacy_runtime() {
  if [ -L "$LEGACY_DEST" ]; then
    ln -sfn "$DEST" "$LEGACY_DEST"
    return
  fi

  if [ ! -e "$LEGACY_DEST" ]; then
    ln -s "$DEST" "$LEGACY_DEST"
    return
  fi

  local dest_real
  local legacy_real
  dest_real="$(cd "$DEST" && pwd -P)"
  legacy_real="$(cd "$LEGACY_DEST" 2>/dev/null && pwd -P || true)"

  if [ "$legacy_real" = "$dest_real" ]; then
    return
  fi

  migrate_runtime_env "$LEGACY_DEST"

  if [ ! -d "$LEGACY_DEST/.git" ] || [ "${SETFARM_REPLACE_LEGACY:-0}" = "1" ]; then
    local backup
    backup="${LEGACY_DEST}.backup-$(date +%Y%m%d%H%M%S)"
    echo "Backing up stale legacy runtime: $LEGACY_DEST -> $backup"
    mv "$LEGACY_DEST" "$backup"
    ln -s "$DEST" "$LEGACY_DEST"
    return
  fi

  echo "Warning: $LEGACY_DEST is a separate git checkout; leaving it unchanged."
  echo "Set SETFARM_REPLACE_LEGACY=1 to back it up and link to $DEST."
}

link_legacy_runtime

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
