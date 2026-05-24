SETUP-BUILD step — confirm a green setup baseline, or repair the setup/build preclaim blocker.

## Repo State

REPO: {{REPO}}
TECH_STACK: {{TECH_STACK}}
BUILD_CMD hint: {{BUILD_CMD_HINT}}

## Preclaim Status

Failure category: {{FAILURE_CATEGORY}}
Suggested response: {{FAILURE_SUGGESTION}}
Design import report: {{DESIGN_IMPORT_VALIDATE_REPORT}}

Previous failure:
```
{{PREVIOUS_FAILURE}}
```

Pipeline preClaim already did:
- npm install
- npm run build baseline
- compatibility checks for React/Next/testing libraries
- Tailwind install when needed
- stitch-to-jsx generated `src/screens/*.tsx`
- generated-screen-validator ran before IMPLEMENT handoff

## Work

1. If Failure category is `none`, set BUILD_CMD from the hint and complete.
2. If Previous failure starts with `SETUP_BUILD_PRECLAIM_BLOCKER`, repair only the setup/build or design-import baseline described there.
3. For `design_import_failure`, inspect `.setfarm/setup/DESIGN_IMPORT_VALIDATE.json`, `scripts/stitch-to-jsx.mjs`, `scripts/generated-screen-validator.mjs`, and generated `src/screens/*.tsx`. Fix deterministic conversion/validation defects, rerun the validator with `--fix`, then rerun the build command.
4. Output `STATUS: done` only after the declared build command passes.

## Output

```
STATUS: done
BUILD_CMD: npm run build
```

Do not read `rules.md`; the rules are embedded below.
