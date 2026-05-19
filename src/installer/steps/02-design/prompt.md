DESIGN step — Stitch screens and tokens are ready. Report DESIGN_SYSTEM only.

## Repo

REPO: {{REPO}}

## Prepared by the pipeline

- stitch/*.html and *.png screens
- stitch/DESIGN_MANIFEST.json with screenId/title list
- stitch/DESIGN_BRIEF.md with STRICT_UI_SCOPE_CONTRACT and Product Surfaces
- stitch/design-tokens.css and design-tokens.json with colors/fonts
- SCREEN_MAP already injected into context:

```json
{{SCREEN_MAP}}
```

## Your Work

1. Read `stitch/design-tokens.css` or `.json`.
2. Optionally inspect `stitch/DESIGN_BRIEF.md` to confirm Product Surface scope.
3. Produce DESIGN_SYSTEM JSON: palette, fonts, aesthetic.
4. Return the SCREEN_MAP above unchanged unless a type correction is necessary. Preserve `surfaceIds`.
5. Output the key-value format below, then call `step complete`.

## Output

```
STATUS: done
DEVICE_TYPE: DESKTOP
DESIGN_SYSTEM: <JSON>
SCREEN_MAP: <same JSON from above>
```

Do not read `rules.md`; the rules are embedded below.
