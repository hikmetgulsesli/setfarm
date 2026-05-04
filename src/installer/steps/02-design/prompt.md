DESIGN step — Stitch screens and tokens are ready. Report DESIGN_SYSTEM only.

## Repo

REPO: {{REPO}}
PRD screen count: {{PRD_SCREEN_COUNT}}

## Prepared by the pipeline

- stitch/*.html and *.png screens
- stitch/DESIGN_MANIFEST.json with screenId/title list
- stitch/design-tokens.css and design-tokens.json with colors/fonts
- SCREEN_MAP already injected into context:

```json
{{SCREEN_MAP}}
```

## Your Work

1. Read `stitch/design-tokens.css` or `.json`.
2. Produce DESIGN_SYSTEM JSON: palette, fonts, aesthetic.
3. Return the SCREEN_MAP above unchanged unless a type correction is necessary.
4. Output the key-value format below, then call `step complete`.

## Output

```
STATUS: done
DEVICE_TYPE: DESKTOP
DESIGN_SYSTEM: <JSON>
SCREEN_MAP: <same JSON from above>
```

Do not read `rules.md`; the rules are embedded below.
