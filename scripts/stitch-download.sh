#!/bin/bash
# stitch-download.sh — Download Stitch screens into stitch/ directory
# Usage: stitch-download.sh <STITCH_PROJECT_ID> <SCREEN_MAP_JSON>
set -e

STITCH_PROJECT_ID="$1"
SCREEN_MAP="$2"
STITCH_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/stitch-api.mjs"

if [ -z "$STITCH_PROJECT_ID" ]; then
  echo "No STITCH_PROJECT_ID provided, skipping stitch download"
  exit 0
fi

mkdir -p stitch

# Step 1: Create manifest
SCREEN_IDS=$(node -e "try{JSON.parse(process.argv[1]).forEach(s=>{if(s.screenId)console.log(s.screenId)})}catch{}" "$SCREEN_MAP" 2>/dev/null | tr "\n" ",")
if [ -n "$SCREEN_IDS" ]; then
  node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch "$SCREEN_IDS"
else
  node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch
fi

# Step 2: Download each screen from manifest
if [ -f "stitch/DESIGN_MANIFEST.json" ]; then
  node -e "
    const m=JSON.parse(require(\"fs\").readFileSync(\"stitch/DESIGN_MANIFEST.json\",\"utf-8\"));
    m.forEach(s=>{if(s.screenId && s.htmlFile)console.log(s.screenId+\"|\"+s.htmlFile)});
  " 2>/dev/null | while IFS="|" read -r SID SFILE; do
    if [ -n "$SID" ] && [ ! -f "stitch/$SFILE" ]; then
      echo "Downloading screen $SID -> stitch/$SFILE"
      node "$STITCH_SCRIPT" download-screen "$STITCH_PROJECT_ID" "$SID" "stitch/$SFILE" || echo "WARN: Failed to download $SID"
    fi
  done
fi

# Step 3: Extract design tokens
node "$STITCH_SCRIPT" extract-tokens stitch stitch/design-tokens.css 2>/dev/null || true

# Step 4: Agent workspace fallback — copy already-downloaded HTML from design agent workspaces
HTML_COUNT=$(find stitch -name "*.html" 2>/dev/null | wc -l)
if [ "$HTML_COUNT" -eq 0 ]; then
  echo "No HTML from Stitch API - trying agent workspace fallback..."
  # Copy HTML files from any workspace stitch/ directory
  for WS in "$HOME"/.openclaw/workspace-*/stitch; do
    [ -d "$WS" ] || continue
    N=$(find "$WS" -name "*.html" 2>/dev/null | wc -l)
    if [ "$N" -gt 0 ]; then
      echo "Found $N HTML file(s) in $WS - copying..."
      cp "$WS"/*.html stitch/ 2>/dev/null || true
    fi
  done
  # Also retry create-manifest using .stitch-screens.json from workspace
  for WS_DIR in "$HOME"/.openclaw/workspace-*; do
    [ -d "$WS_DIR" ] || continue
    [ -f "$WS_DIR/.stitch-screens.json" ] || continue
    echo "Found .stitch-screens.json in $WS_DIR - retrying manifest..."
    cp "$WS_DIR/.stitch-screens.json" .stitch-screens.json 2>/dev/null || true
    ( cd "$WS_DIR" && node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch 2>/dev/null ) || true
    [ -f "$WS_DIR/stitch/DESIGN_MANIFEST.json" ] && cp "$WS_DIR/stitch/DESIGN_MANIFEST.json" stitch/ 2>/dev/null || true
    break
  done
  HTML_COUNT=$(find stitch -name "*.html" 2>/dev/null | wc -l)
fi

if [ "$HTML_COUNT" -eq 0 ]; then
  echo "FATAL: STITCH_PROJECT_ID set but 0 HTML files downloaded"
  exit 1
fi
echo "Stitch: $HTML_COUNT HTML files downloaded successfully"

# Commit
echo "$STITCH_PROJECT_ID" > .stitch
git add stitch/ .stitch && git commit -m "design: Stitch UI screens + manifest + tokens" || true
