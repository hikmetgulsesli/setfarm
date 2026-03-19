LINT SETUP (MANDATORY):
- Check if package.json has a "lint" script
- If NO lint script exists, detect project type and set one up:

  PROJECT TYPE DETECTION:
  - React/Next.js: has react/next in dependencies → use React lint rules
  - Canvas/Game (vanilla TS): has canvas API usage, no react → use base TS rules only
  - Node.js backend: has express/fastify/koa in dependencies → use Node.js rules
  - Plain JS/TS: none of the above → use base rules only

  a. For React/Next.js projects:
     npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
     Add "lint": "eslint \"src/**/*.{ts,tsx}\"" to package.json scripts
     Create eslint.config.js with: @eslint/js recommended + typescript-eslint + react-hooks

  b. For Canvas/Game or vanilla TS projects (NO React):
     npm install -D eslint @eslint/js typescript-eslint
     Add "lint": "eslint \"src/**/*.ts\"" to package.json scripts
     Create eslint.config.js with: @eslint/js recommended + typescript-eslint ONLY
     Do NOT add any React plugins or JSX rules — these will cause parse errors on non-React code

  c. For Node.js backend projects:
     npm install -D eslint @eslint/js typescript-eslint
     Add "lint": "eslint \"src/**/*.ts\"" to package.json scripts
     Create eslint.config.js with: @eslint/js recommended + typescript-eslint
     Add rule: no-console → off (console is valid in backend)

  d. For plain JS projects (no TypeScript):
     npm install -D eslint @eslint/js
     Add "lint": "eslint \"src/**/*.js\"" to package.json scripts
     Create eslint.config.js with: @eslint/js recommended only

  IMPORTANT: Never use glob "**/*.{ts,tsx}" (matches node_modules). Always scope to "src/**/*".
  IMPORTANT: If eslint.config.js already exists, do NOT overwrite it — just ensure lint script exists.

- TSCONFIG TEST FIX (if vitest/jest is in devDependencies):
  If tsconfig.json exists and does NOT have "types": ["vitest/globals"] (or "jest"):
    - Add "types": ["vitest/globals"] to compilerOptions
    - Ensure test files (*.test.ts, *.test.tsx) are NOT included in main tsconfig build
    - If tsconfig has no "exclude", add: "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
    - OR create tsconfig.app.json for build (without tests) and tsconfig.json for IDE (with tests)
  This prevents "Cannot find module 'vitest'" errors during tsc build.

- Run the lint command to verify it works
- Run: npx eslint --fix "src/**/*.{ts,tsx}" (or equivalent matching the project type) to auto-fix
- If ERRORS remain after --fix, manually fix them (empty catch blocks, useless assignments etc.)
- Warnings are acceptable. ERRORS are NOT — fix all errors before reporting done.
- Run lint again to confirm 0 errors before completing
- Lint MUST be working with 0 errors before STATUS: done
