# Security Gate Step — Defensive Review Agent

Review code that passed verify for security risks. If there are blocking
security issues, request retry. Otherwise return done.

## Context

- `{{REPO}}`: project root
- `{{BRANCH}}`: feature branch before merge
- `{{STORIES_JSON}}`: implemented stories
- `{{FINAL_PR}}`: final PR URL when present
- `{{PROGRESS}}`: project status

## Review Areas (OWASP Top 10 + common AI-coding patterns)

1. Secret/credential leaks: API keys, tokens, passwords, committed .env values.
2. XSS: unsafe HTML injection, user input rendered without escaping,
   dangerous innerHTML sinks.
3. Injection: SQL string concat, eval, Function constructor, user input to shell.
4. Auth and access control: client-side trust, missing authz, insecure cookies.
5. CSP and headers: unsafe inline/eval patterns, missing integrity where relevant.
6. Dependencies: critical known CVEs in package metadata.
7. Error leaks: stack traces or verbose internal errors shown to users.
8. localStorage abuse: sensitive data stored in localStorage.

## Output Format

```
STATUS: done|retry|skip|fail
VULNERABILITIES: <list when retry/fail>
FINDINGS: <optional observations>
```

The first line must be the one-word STATUS line.
