# 02-design - Design Step Module

The second pipeline step. It uses Stitch to generate screen designs, then verifies and stores design contracts.

## Input

- `prd`: PRD from plan
- `repo`: project directory
- `device_type`: optional, defaults to desktop

## Preclaim Side Effects

Before the agent claim:

- ensures the Stitch project exists
- generates all PRD screens
- downloads HTML with retries and tracking fallback
- writes `stitch/DESIGN_MANIFEST.json` and `stitch/*.html`

The agent verifies the generated design. It does not call Stitch again.

## Parsed Output

- `STATUS: done`
- `DEVICE_TYPE`
- `DESIGN_SYSTEM`
- `SCREEN_MAP`

## Completion Side Effects

- stores design system, screen map, and device type in context
- builds design contracts
- persists screenshots to cache

## Prompt Budget

`maxPromptSize: 10240` bytes.
