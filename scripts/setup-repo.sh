#!/bin/bash
# setup-repo.sh — Full repo setup for ANY project type
# Usage: setup-repo.sh <REPO_PATH> <BRANCH> <STITCH_PROJECT_ID> <SCREEN_MAP_JSON>
set -e

REPO="$1"
BRANCH="$2"
STITCH_PROJECT_ID="$3"
SCREEN_MAP="$4"
STITCH_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/stitch-api.mjs"

EXISTING_CODE=false

# 1. Create repo if needed
if [ -d "$REPO/.git" ]; then
  echo "Repo already exists at $REPO"
  EXISTING_CODE=true
  cd "$REPO"
else
  mkdir -p "$REPO"
  cd "$REPO"
  git init
  echo "Initialized new repo at $REPO"
fi

# 2. GitHub remote (with duplicate-name fallback)
PROJECT_NAME=$(basename "$REPO")
if ! git remote -v 2>/dev/null | grep -q origin; then
  if OUTPUT=$(gh repo create "hikmetgulsesli/$PROJECT_NAME" --public --source . --remote origin --push 2>&1); then
    echo "GitHub repo created: hikmetgulsesli/$PROJECT_NAME"
  else
    if echo "$OUTPUT" | grep -qi "Name already exists\|already exists"; then
      # Name taken — try with suffix
      for SUFFIX in 2 3 4 5; do
        ALT_NAME="${PROJECT_NAME}-${SUFFIX}"
        if gh repo create "hikmetgulsesli/$ALT_NAME" --public --source . --remote origin --push 2>/dev/null; then
          echo "GitHub repo created with alt name: hikmetgulsesli/$ALT_NAME"
          break
        fi
      done
    else
      echo "WARN: GitHub API error: $OUTPUT"
    fi
  fi
  # Final check: if still no remote, warn but continue
  if ! git remote -v 2>/dev/null | grep -q origin; then
    echo "FATAL: Could not create GitHub repo (all names taken or API error)"
    echo "STATUS: fail"
    exit 1
  fi
fi

# 3. Main branch
git branch -M main 2>/dev/null || true
git commit --allow-empty -m "chore: initial commit" 2>/dev/null || true
if ! git push -u origin main 2>&1; then
  echo "WARN: git push to main failed — may need manual intervention"
fi

# 4. .gitignore (covers ALL project types)
cat > .gitignore << GITIGNORE
# === Dependencies ===
node_modules/
vendor/
.pnp/
.pnp.js
Pods/
.gradle/
.dart_tool/
.packages
pubspec.lock

# === Build outputs ===
dist/
build/
out/
*.tsbuildinfo
*.js.map

# === Web frameworks ===
# Next.js
.next/
# Nuxt
.nuxt/
.output/
# Angular
.angular/
# Svelte
.svelte-kit/
# Astro
.astro/
# Remix (uses build/)
# Vite / Vanilla / Vue / SolidJS (uses dist/)
# Vercel
.vercel/

# === Mobile — React Native / Expo ===
ios/build/
ios/Pods/
android/app/build/
android/.gradle/
android/.idea/
*.apk
*.aab
*.ipa
*.dSYM.zip
*.dSYM/
.expo/
expo-env.d.ts

# === Mobile — Flutter ===
.flutter-plugins
.flutter-plugins-dependencies
.dart_tool/
build/
flutter_export_environment.sh

# === Mobile — Kotlin / Gradle / Android ===
*.class
*.jar
*.war
*.aar
.gradle/
local.properties
captures/
.externalNativeBuild/
.cxx/

# === iOS / Xcode / Swift ===
*.xcworkspace/xcuserdata/
*.xcodeproj/xcuserdata/
DerivedData/
*.hmap
*.xcuserstate
*.moved-aside
*.pbxuser
!default.pbxuser
*.perspectivev3
!default.perspectivev3
xcuserdata/

# === Ionic ===
www/
plugins/
platforms/

# === Python ===
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.env/

# === Environment & secrets ===
.env
.env.local
.env*.local
.env.production
.env.development

# === IDE & OS ===
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo
*~

# === Caches & misc ===
.turbo/
.cache/
.parcel-cache/
.eslintcache
.worktrees/
.setfarm-step-output.txt
coverage/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
GITIGNORE
git add .gitignore && git commit -m "chore: add .gitignore" 2>/dev/null || true

# 5. Feature branch
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH" 2>/dev/null || true

# 6. References symlink
ln -sfn "$HOME/.openclaw/setfarm-repo/references" references 2>/dev/null || true

# 7. Stitch download (if project ID provided and not empty)
if [ -n "$STITCH_PROJECT_ID" ] && [ "$STITCH_PROJECT_ID" != "undefined" ] && [ "$STITCH_PROJECT_ID" != "" ]; then
  echo "=== STITCH DOWNLOAD ==="
  bash "$HOME/.openclaw/setfarm-repo/scripts/stitch-download.sh" "$STITCH_PROJECT_ID" "$SCREEN_MAP"
  STITCH_EXIT=$?
  if [ $STITCH_EXIT -ne 0 ]; then
    echo "FATAL: Stitch download failed with exit code $STITCH_EXIT"
    echo "STATUS: fail"
    exit 1
  fi
fi

# 8. Push
if ! git push -u origin "$BRANCH" 2>&1; then
  echo "WARN: git push to $BRANCH failed — may need manual intervention"
fi

echo "============================================"
echo "STATUS: done"
echo "EXISTING_CODE: $EXISTING_CODE"
echo "============================================"
