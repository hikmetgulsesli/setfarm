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

# Step 4: Verify
HTML_COUNT=$(find stitch -name "*.html" 2>/dev/null | wc -l)
if [ "$HTML_COUNT" -eq 0 ]; then
  echo "FATAL: STITCH_PROJECT_ID set but 0 HTML files downloaded"
  exit 1
fi
echo "Stitch: $HTML_COUNT HTML files downloaded successfully"

# Commit
echo "$STITCH_PROJECT_ID" > .stitch
git add stitch/ .stitch && git commit -m "design: Stitch UI screens + manifest + tokens" || true
