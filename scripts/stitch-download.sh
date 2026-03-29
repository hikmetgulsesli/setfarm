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

# Step 0: Clean stitch/ if it belongs to a different project (parallel project safety)
if [ -f ".stitch" ]; then
  EXISTING_PID=""
  # Try JSON format first, then plain text
  EXISTING_PID=$(node -e "try{console.log(JSON.parse(require(\"fs\").readFileSync(\".stitch\",\"utf-8\")).projectId||\"\")}catch{console.log(require(\"fs\").readFileSync(\".stitch\",\"utf-8\").trim())}" 2>/dev/null)
  if [ -n "$EXISTING_PID" ] && [ "$EXISTING_PID" != "$STITCH_PROJECT_ID" ]; then
    echo "Cleaning stitch/ — previous project $EXISTING_PID != current $STITCH_PROJECT_ID"
    rm -rf stitch
  fi
fi
mkdir -p stitch

# Step 1: Create manifest
SCREEN_IDS=$(node -e "try{JSON.parse(process.argv[1]).forEach(s=>{if(s.screenId)console.log(s.screenId)})}catch{}" "$SCREEN_MAP" 2>/dev/null | tr "\n" ",")
if [ -n "$SCREEN_IDS" ]; then
  node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch "$SCREEN_IDS"
else
  node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch
fi

# Step 2: Download each screen from manifest — count failures
DOWNLOAD_FAIL=0
DOWNLOAD_TOTAL=0
if [ -f "stitch/DESIGN_MANIFEST.json" ]; then
  node -e "
    const m=JSON.parse(require(\"fs\").readFileSync(\"stitch/DESIGN_MANIFEST.json\",\"utf-8\"));
    m.forEach(s=>{if(s.screenId && s.htmlFile)console.log(s.screenId+\"|\"+s.htmlFile)});
  " 2>/dev/null | while IFS="|" read -r SID SFILE; do
    if [ -n "$SID" ] && [ ! -f "stitch/$SFILE" ]; then
      DOWNLOAD_TOTAL=$((DOWNLOAD_TOTAL + 1))
      echo "Downloading screen $SID -> stitch/$SFILE"
      if ! node "$STITCH_SCRIPT" download-screen "$STITCH_PROJECT_ID" "$SID" "stitch/$SFILE"; then
        echo "ERROR: Failed to download $SID"
        DOWNLOAD_FAIL=$((DOWNLOAD_FAIL + 1))
      fi
      sleep 0.2
    fi
  done
fi

# Step 3: Extract design tokens
node "$STITCH_SCRIPT" extract-tokens stitch stitch/design-tokens.css 2>/dev/null || true

# Step 4: Agent workspace fallback — ONLY from matching project (parallel safety)
HTML_COUNT=$(find stitch -name "*.html" ! -name "DESIGN_MANIFEST.json" 2>/dev/null | wc -l)
if [ "$HTML_COUNT" -eq 0 ]; then
  echo "No HTML from Stitch API - trying agent workspace fallback (project-isolated)..."
  for WS_DIR in "$HOME"/.openclaw/workspace-*; do
    [ -d "$WS_DIR/stitch" ] || continue
    # Check if workspace belongs to same stitch project
    WS_PID=""
    if [ -f "$WS_DIR/.stitch" ]; then
      WS_PID=$(node -e "try{console.log(JSON.parse(require(\"fs\").readFileSync(\"$WS_DIR/.stitch\",\"utf-8\")).projectId||\"\")}catch{console.log(require(\"fs\").readFileSync(\"$WS_DIR/.stitch\",\"utf-8\").trim())}" 2>/dev/null)
    fi
    if [ "$WS_PID" = "$STITCH_PROJECT_ID" ]; then
      N=$(find "$WS_DIR/stitch" -name "*.html" 2>/dev/null | wc -l)
      if [ "$N" -gt 0 ]; then
        echo "Found $N HTML file(s) in matching workspace $WS_DIR - copying..."
        cp "$WS_DIR/stitch"/*.html stitch/ 2>/dev/null || true
      fi
      # Also copy manifest if we dont have one
      [ ! -s "stitch/DESIGN_MANIFEST.json" ] && [ -f "$WS_DIR/stitch/DESIGN_MANIFEST.json" ] && cp "$WS_DIR/stitch/DESIGN_MANIFEST.json" stitch/ 2>/dev/null || true
    fi
  done
  HTML_COUNT=$(find stitch -name "*.html" ! -name "DESIGN_MANIFEST.json" 2>/dev/null | wc -l)
fi

if [ "$HTML_COUNT" -eq 0 ]; then
  echo "FATAL: STITCH_PROJECT_ID set but 0 HTML files downloaded"
  exit 1
fi

# Step 5: Validate manifest is non-empty
MANIFEST_COUNT=0
if [ -f "stitch/DESIGN_MANIFEST.json" ]; then
  MANIFEST_COUNT=$(node -e "try{const m=JSON.parse(require(\"fs\").readFileSync(\"stitch/DESIGN_MANIFEST.json\",\"utf-8\"));console.log(Array.isArray(m)?m.length:(m.screens?m.screens.length:0))}catch{console.log(0)}" 2>/dev/null)
fi
if [ "$MANIFEST_COUNT" -eq 0 ]; then
  echo "WARN: DESIGN_MANIFEST is empty — regenerating from HTML files..."
  node "$STITCH_SCRIPT" create-manifest "$STITCH_PROJECT_ID" stitch 2>/dev/null || true
  MANIFEST_COUNT=$(node -e "try{const m=JSON.parse(require(\"fs\").readFileSync(\"stitch/DESIGN_MANIFEST.json\",\"utf-8\"));console.log(Array.isArray(m)?m.length:(m.screens?m.screens.length:0))}catch{console.log(0)}" 2>/dev/null)
  if [ "$MANIFEST_COUNT" -eq 0 ]; then
    echo "FATAL: DESIGN_MANIFEST still empty after regeneration"
    exit 1
  fi
fi

echo "Stitch: $HTML_COUNT HTML files, $MANIFEST_COUNT manifest entries"

# Write .stitch as JSON (project isolation metadata)
node -e "require(\"fs\").writeFileSync(\".stitch\",JSON.stringify({projectId:\"$STITCH_PROJECT_ID\",downloadedAt:new Date().toISOString(),htmlCount:$HTML_COUNT,manifestCount:parseInt(\"$MANIFEST_COUNT\")||0},null,2))" 2>/dev/null || echo "$STITCH_PROJECT_ID" > .stitch

git add stitch/ .stitch && git commit -m "design: Stitch UI screens + manifest + tokens" || true
