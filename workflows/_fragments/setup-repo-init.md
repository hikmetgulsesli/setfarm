Instructions:
1. If repo doesn't exist: mkdir -p {{repo}} && cd {{repo}} && git init
2. Ensure GitHub remote exists:
   git remote -v || PROJECT_NAME=$(basename {{repo}}) && gh repo create hikmetgulsesli/$PROJECT_NAME --public --source . --remote origin --push 2>/dev/null || true
3. Ensure main branch exists (CRITICAL for final PR):
   git branch -M main 2>/dev/null || true
   git push -u origin main 2>/dev/null || true
3.5. Ensure .worktrees/ is in .gitignore (prevents worktree dirs from being committed):
   grep -qxF '.worktrees/' .gitignore 2>/dev/null || echo '.worktrees/' >> .gitignore
4. Create feature branch: git checkout -b {{branch}}
5. Read package.json, test config to understand build/test setup
6. Run build + tests to establish baseline
7. Create references symlink: ln -sfn /home/setrox/.openclaw/setfarm-repo/references references
8. Push: git push -u origin {{branch}}

EXISTING CODE CHECK (resume safety):
- If the project directory already exists:
  a. Run `git status` to check if working tree is clean
  b. Run existing build+test commands to verify baseline
  c. Fix any issues before proceeding
  d. Set EXISTING_CODE: true in output
