SETUP-BUILD step — build baseline is ready. Confirm and complete.

## Repo State

REPO: {{REPO}}
TECH_STACK: {{TECH_STACK}}
BUILD_CMD hint: {{BUILD_CMD_HINT}}

Pipeline preClaim already did:
- npm install
- npm run build baseline
- compatibility checks for React/Next/testing libraries
- Tailwind install when needed
- stitch-to-jsx generated `src/screens/*.tsx` and committed them

## Work

1. Set BUILD_CMD from the hint or choose the correct build command.
2. Output and call `step complete`.

## Output

```
STATUS: done
BUILD_CMD: npm run build
```

Do not read `rules.md`; the rules are embedded below.
