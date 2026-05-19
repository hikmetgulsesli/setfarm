# 02-design - Design Step Module

The second pipeline step. It builds a scoped Stitch design brief from PLAN's
Product Surfaces, generates Stitch artifacts, then verifies that the generated
design stays inside the Product Surface contract.

## Input

- `prd`: PRD from plan
- `repo`: project directory
- `product_surfaces`: semantic `SURF_*` contract from PLAN
- `device_type`: optional, defaults to desktop

## Preclaim Side Effects

Before the agent claim:

- skips Stitch when `DESIGN_REQUIRED=false`
- writes `stitch/DESIGN_BRIEF.md` with `STRICT_UI_SCOPE_CONTRACT`,
  Product Surfaces, action control hints, UI anti-goals, and passive
  `FULL_PRD_APPENDIX`
- ensures the Stitch project exists
- requests Stitch artifacts for Product Surface-backed targets
- downloads `stitch/DESIGN.md`, `stitch/*.html`, `stitch/*.png`, DOM, tokens,
  and `stitch/DESIGN_MANIFEST.json`
- verifies every generated screen maps to one or more Product Surfaces
- fails with `DESIGN_SURFACE_MISMATCH` for missing surfaces, unrelated screens,
  out-of-scope screens, or unmapped controls

The agent verifies the generated design. It does not call Stitch again.

## Parsed Output

- `STATUS: done`
- `DEVICE_TYPE`
- `DESIGN_SYSTEM`
- `SCREEN_MAP` with preserved `surfaceIds`

## Completion Side Effects

- stores design system, screen map, and device type in context
- builds design contracts
- persists screenshots to cache

## Prompt Budget

`maxPromptSize: 10240` bytes.
