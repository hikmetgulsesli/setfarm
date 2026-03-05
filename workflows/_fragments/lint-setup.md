LINT SETUP (MANDATORY):
- Check if package.json has a "lint" script
- If NO lint script exists, set one up:
  a. For React/Next.js: npm install -D eslint @eslint/js typescript-eslint
  b. Add "lint": "eslint \"**/*.{ts,tsx}\"" to package.json scripts
  c. Create a basic eslint.config.js if none exists
- Run the lint command to verify it works
- Run: npx eslint --fix "client/src/**/*.{ts,tsx}" (or equivalent) to auto-fix
- If ERRORS remain after --fix, manually fix them (empty catch blocks, useless assignments etc.)
- Warnings are acceptable. ERRORS are NOT — fix all errors before reporting done.
- Run lint again to confirm 0 errors before completing
- Lint MUST be working with 0 errors before STATUS: done
