# SETUP-BUILD Step Rules

Pipeline preClaim already did:
- `npm install`
- baseline `npm run build`
- compatibility checks
- Tailwind install when Stitch HTML needs Tailwind
- `stitch-to-jsx.mjs`
- generated-screen auto-commit

If preClaim found no blocker, reaching this prompt means the baseline is green.
If the prompt contains `SETUP_BUILD_PRECLAIM_BLOCKER`, this step is a scoped
repair pass for that blocker only.

## Normal Path

1. Report BUILD_CMD. Usually this is `npm run build`.
2. Output and call `step complete`.

## Repair Path

When `Previous failure` contains `SETUP_BUILD_PRECLAIM_BLOCKER`:

1. Read the blocker text and its failure category.
2. Repair only setup/build-owned or generated-import baseline files needed by that blocker.
   - For `design_import_failure`, allowed repair targets are `scripts/stitch-to-jsx.mjs`,
     `scripts/generated-screen-validator.mjs`, generated `src/screens/*`, and generated
     screen CSS/runtime files.
   - Do not move the problem into IMPLEMENT. Generated screen mechanical defects must be
     fixed before IMPLEMENT_CONTEXT is assembled.
3. Rerun `node scripts/generated-screen-validator.mjs "$REPO" --fix` for design import failures.
4. Rerun the declared build command.
5. Output `STATUS: done` only when validation and build are green.

## Output

```
STATUS: done
BUILD_CMD: npm run build
```

Use `tsc -p tsconfig.json` only when no package build script exists. Use `tsc`
for vanilla TypeScript. Backend-only projects may leave it empty only when no
build command exists.

## Do Not

- In the normal path, do not run `npm install` or `npm run build`.
- In the repair path, run only the validation/build commands needed to prove the fix.
- Do not change package.json unless the blocker is explicitly a setup dependency failure.
- Do not create product feature files under src.
- Do not run Stitch generation.
