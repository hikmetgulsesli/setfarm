# Security Gate Rules

## Role Boundary

Security gate is read-only. Do not edit source, tests, CSS, config, package,
assets, or generated files. Do not run `git add`, `git commit`, `git push`,
`gh pr`, or merge commands. If any security issue needs a code change, return
`STATUS: retry`; the implement step owns the fix.

## Retry Triggers

- Hardcoded secret: API key, JWT secret, bcrypt salt, token.
- Unsafe HTML render of user input.
- SQL string concat or raw exec/spawn fed by user input.
- Auth bypass or missing authorization check.
- CORS wildcard with credentials.
- Plain password/token in localStorage.
- eval/Function constructor with dynamic input.

## Pass Criteria

- No hardcoded secrets.
- User input is escaped/sanitized at unsafe sinks.
- No client-side-only auth trust for protected actions.
- No critical dependency or configuration failure.

## Skip Criteria

- Project produced no code.
- Documentation/config-only change.

## VULNERABILITIES Format

Each item: file:line + category + short actionable explanation.

```
VULNERABILITIES:
- src/api/users.ts:42 — SQL Injection: raw string interpolation in query; use parameters.
- .env.example:5 — Secret leak: committed JWT secret; rotate and remove.
- src/ui/RichText.tsx:18 — XSS: unsafe HTML sink; sanitize before render.
```

Keep findings one-line and actionable.
