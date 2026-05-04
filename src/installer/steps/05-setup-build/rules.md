# SETUP-BUILD Step Rules

Pipeline preClaim already did:
- `npm install`
- baseline `npm run build`
- compatibility checks
- Tailwind install when Stitch HTML needs Tailwind
- `stitch-to-jsx.mjs`
- generated-screen auto-commit

If the build had failed, preClaim would have failed before this step. Reaching
this prompt means the baseline is green.

## Your Single Step

1. Report BUILD_CMD. Usually this is `npm run build`.
2. Output and call `step complete`.

## Output

```
STATUS: done
BUILD_CMD: npm run build
```

Use `tsc -p tsconfig.json` only when no package build script exists. Use `tsc`
for vanilla TypeScript. Backend-only projects may leave it empty only when no
build command exists.

## Do Not

- Do not run `npm install` or `npm run build`.
- Do not change package.json.
- Do not create files under src.
- Do not run Stitch generation.
