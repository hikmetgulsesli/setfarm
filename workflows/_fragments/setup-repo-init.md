Instructions:
1. If repo doesn't exist: mkdir -p {{repo}} && cd {{repo}} && git init
2. Ensure GitHub remote exists:
   git remote -v || PROJECT_NAME=$(basename {{repo}}) && gh repo create hikmetgulsesli/$PROJECT_NAME --public --source . --remote origin --push 2>/dev/null || true
3. Ensure main branch exists (CRITICAL — all PRs MUST target main):
   git branch -M main 2>/dev/null || true
   git push -u origin main 2>/dev/null || true
3.5. Create .gitignore BEFORE any npm install or build (CRITICAL — prevents node_modules/dist pollution):
   If .gitignore does not exist or is missing essential entries, create/update it:
   - ALWAYS include: node_modules/, .next/, dist/, build/, .env, .env.local, .env*.local
   - ALWAYS include: .turbo/, .vercel/, .output/, .cache/, .parcel-cache/
   - ALWAYS include: *.tsbuildinfo, .DS_Store, .worktrees/, .setfarm-step-output.txt
   - For Next.js: add next-env.d.ts (optional)
   - For Vite: add *.local
   - For React Native: add ios/Pods/, android/.gradle/, *.apk, *.ipa
   - git add .gitignore && git commit -m "chore: add .gitignore" 2>/dev/null || true
4. Create feature branch: git checkout -b {{branch}}
5. Read package.json, test config to understand build/test setup
6. Run build + tests to establish baseline
7. Create references symlink: ln -sfn $HOME/.openclaw/setfarm-repo/references references
8. Push feature branch: git push -u origin {{branch}}
9. IMPORTANT: All PRs MUST use --base main (not the feature branch). The feature branch is for development, main is the merge target.

EXISTING CODE CHECK (resume safety):
- If the project directory already exists:
  a. Run git status to check if working tree is clean
  b. Run existing build+test commands to verify baseline
  c. Fix any issues before proceeding
  d. Set EXISTING_CODE: true in output
