#!/bin/bash
# setup-repo.sh — Full repo setup for ANY project type
# Usage: setup-repo.sh <REPO_PATH> <BRANCH> <STITCH_PROJECT_ID> <SCREEN_MAP_JSON>
set -e

REPO="$1"
BRANCH="$2"
STITCH_PROJECT_ID="$3"
SCREEN_MAP="$4"
TECH_STACK="${5:-vite-react}"
STITCH_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/stitch-api.mjs"

EXISTING_CODE=false

normalize_stack() {
  local raw
  raw=$(printf "%s" "${1:-vite-react}" | tr '[:upper:]' '[:lower:]')
  raw=$(printf "%s" "$raw" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
  case "$raw" in
    vite-react|react-vite|react-vite-typescript|vite-react-typescript|react-ts-vite|vite-ts-react|react-typescript-vite|web|react)
      printf "vite-react"
      ;;
    *)
      if printf "%s" "$raw" | grep -Eq '(^|-)vite(-|$)' && printf "%s" "$raw" | grep -Eq '(^|-)react(-|$)'; then
        printf "vite-react"
      else
        printf "%s" "$raw"
      fi
      ;;
  esac
}

TECH_STACK_RAW="$TECH_STACK"
TECH_STACK=$(normalize_stack "$TECH_STACK")
if [ "$TECH_STACK_RAW" != "$TECH_STACK" ]; then
  echo "Normalized TECH_STACK: $TECH_STACK_RAW -> $TECH_STACK"
fi

clean_branch_tracking() {
  local branch="$1"
  git config --unset-all "branch.$branch.remote" 2>/dev/null || true
  git config --unset-all "branch.$branch.merge" 2>/dev/null || true
}

# 1. Create repo if needed
if [ -d "$REPO/.git" ]; then
  echo "Repo already exists at $REPO"
  EXISTING_CODE=true
  cd "$REPO"
else
  mkdir -p "$REPO"
  cd "$REPO"
  git init -b main 2>/dev/null || { git init && git branch -M main 2>/dev/null || true; }
  echo "Initialized new repo at $REPO"
fi

# 2. GitHub remote (with duplicate-name fallback)
PROJECT_NAME=$(basename "$REPO")
PACKAGE_NAME=$(printf "%s" "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//')
[ -n "$PACKAGE_NAME" ] || PACKAGE_NAME="setfarm-app"
if ! git remote -v 2>/dev/null | grep -q origin; then
  # cuddly-sleeping-quail: gh repo create --push requires at least one commit.
  # If this is a fresh `git init` with no commits, create a README and commit
  # so --push has something to push. Run #389 postmortem: empty dir → git init
  # → gh repo create --push → "no commits found" → FATAL.
  if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    [ -f README.md ] || echo "# $PROJECT_NAME" > README.md
    [ -f .gitignore ] || printf "node_modules/\ndist/\n.env\n" > .gitignore
    git add README.md .gitignore 2>/dev/null || true
    git commit -m "chore: initial commit" >/dev/null 2>&1 || true
  fi
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
clean_branch_tracking main
# Commit existing files (stitch/, README, etc.) if any, otherwise empty commit
git add -A 2>/dev/null || true
git diff --cached --quiet && git commit --allow-empty -m "chore: initial commit" 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: initial commit" 2>/dev/null || true
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

# 4.5. Scaffold baseline app for fresh JS/TS projects.
# Implement stories should not create package/config/App/main from scratch. That
# baseline belongs here so setup-build can install deps and every story worktree
# gets a stable node_modules symlink from the main repo.
if [ ! -f package.json ]; then
  case "$TECH_STACK" in
    vite-react|react|web)
      mkdir -p src
      cat > package.json <<EOF
{
  "name": "$PACKAGE_NAME",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "vite": "^5.3.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
EOF
      cat > index.html <<EOF
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>$PROJECT_NAME</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF
      cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
      cat > tsconfig.node.json <<'EOF'
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
EOF
      cat > vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
EOF
      cat > postcss.config.js <<'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF
      cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
EOF
      cat > src/main.tsx <<'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
EOF
      cat > src/App.tsx <<'EOF'
export default function App() {
  return <main data-setfarm-root="baseline" className="min-h-screen bg-slate-50 text-slate-950" />;
}
EOF
      cat > src/index.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}
EOF
      git add package.json index.html tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js src/
      git commit -m "chore: scaffold vite react app" 2>/dev/null || true
      ;;
    nextjs)
      mkdir -p src/app
      cat > package.json <<EOF
{
  "name": "$PACKAGE_NAME",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4"
  }
}
EOF
      cat > next.config.mjs <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
EOF
      cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
      cat > next-env.d.ts <<'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited.
EOF
      cat > postcss.config.js <<'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF
      cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/screens/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
EOF
      cat > src/app/layout.tsx <<EOF
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "$PROJECT_NAME",
  description: "Setfarm generated application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF
      cat > src/app/page.tsx <<'EOF'
export default function Home() {
  return <main data-setfarm-root="baseline" className="min-h-screen bg-slate-50 text-slate-950" />;
}
EOF
      cat > src/app/globals.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}
EOF
      git add package.json next.config.mjs tsconfig.json next-env.d.ts postcss.config.js tailwind.config.js src/
      git commit -m "chore: scaffold nextjs app" 2>/dev/null || true
      ;;
    *)
      echo "FATAL: no automatic scaffold for TECH_STACK=$TECH_STACK_RAW (normalized: $TECH_STACK)"
      echo "STATUS: fail"
      exit 1
      ;;
  esac
fi

if [ ! -f package.json ]; then
  echo "FATAL: baseline scaffold did not create package.json for TECH_STACK=$TECH_STACK_RAW (normalized: $TECH_STACK)"
  echo "STATUS: fail"
  exit 1
fi

# Remove any accidentally tracked gitignored files (dist/, node_modules, etc.)
git rm -r --cached dist/ 2>/dev/null || true
git rm -r --cached node_modules/ 2>/dev/null || true
git rm --cached .setfarm-step-output.txt 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: untrack gitignored files" 2>/dev/null || true

# 5. Feature branch
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH" 2>/dev/null || true
clean_branch_tracking "$BRANCH"

# 6. References symlink
ln -sfn "$HOME/.openclaw/setfarm-repo/references" references 2>/dev/null || true

# 7. Stitch download (if project ID provided and not empty)
if [ -n "$STITCH_PROJECT_ID" ] && [ "$STITCH_PROJECT_ID" != "undefined" ] && [ "$STITCH_PROJECT_ID" != "" ]; then
  # PRD Generator already populates stitch/ — skip download if HTML files exist
  EXISTING_HTML=$(find stitch -name "*.html" 2>/dev/null | wc -l)
  if [ "$EXISTING_HTML" -ge 2 ]; then
    echo "=== STITCH SKIP: PRD Generator already placed $EXISTING_HTML HTML files in stitch/ ==="
  else
    echo "=== STITCH DOWNLOAD ==="
    bash "$HOME/.openclaw/setfarm-repo/scripts/stitch-download.sh" "$STITCH_PROJECT_ID" "$SCREEN_MAP"
    STITCH_EXIT=$?
    if [ $STITCH_EXIT -ne 0 ]; then
      echo "FATAL: Stitch download failed with exit code $STITCH_EXIT"
      echo "STATUS: fail"
      exit 1
    fi
  fi
fi

# 7.5. Commit stitch design assets + any PRD Generator files to git
if [ -d "stitch" ] && [ "$(find stitch -name "*.html" 2>/dev/null | wc -l)" -gt 0 ]; then
  git add stitch/ .stitch DESIGN_MANIFEST.json DESIGN.md UI_CONTRACT.json design-tokens.* 2>/dev/null || true
  git add stitch/ 2>/dev/null || true
  git diff --cached --quiet || git commit -m "design: Stitch UI screens + manifest + tokens"
  echo "Committed stitch design assets to git"
fi

# 8. Push
if ! git push -u origin "$BRANCH" 2>&1; then
  echo "WARN: git push to $BRANCH failed — may need manual intervention"
fi

echo "============================================"
echo "STATUS: done"
echo "EXISTING_CODE: $EXISTING_CODE"
echo "============================================"
