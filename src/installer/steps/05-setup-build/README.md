# 05-setup-build - Setup Build Step Module

Runs after setup-repo. It installs dependencies, verifies the baseline build, checks compatibility, and converts Stitch output into source screens.

## Input

- `repo`, `tech_stack`
- `stitch/DESIGN_MANIFEST.json`

## Preclaim Side Effects

1. Run `npm install`.
2. Run baseline build.
3. Run compatibility checks.
4. Configure Tailwind when Stitch output requires it.
5. Run `stitch-to-jsx.mjs`.
6. Store the build command hint in context.

## Parsed Output

- `STATUS: done`
- `BUILD_CMD`

## Prompt Budget

`maxPromptSize: 6144` bytes.
