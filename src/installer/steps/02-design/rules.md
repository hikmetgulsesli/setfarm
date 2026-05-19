# DESIGN Step Rules

The pipeline already prepared:
- Stitch screens: `stitch/*.html`, `*.png`
- `stitch/DESIGN_MANIFEST.json`
- `stitch/DESIGN_BRIEF.md`
- `stitch/DESIGN_DOM.json`
- `stitch/design-tokens.css` and `design-tokens.json`
- SCREEN_MAP from the manifest

Your single decision is DESIGN_SYSTEM: aesthetic, palette, fonts, icon library,
radius, and spacing.

## Do Not

- Do not call the Stitch API.
- Do not edit HTML/CSS.
- Do not hand-write SCREEN_MAP from scratch.
- Do not remove `surfaceIds` from SCREEN_MAP entries when they exist.
- Do not regenerate design tokens.

## Work

1. Read `stitch/design-tokens.css` or `design-tokens.json`.
2. Extract palette, font families, and aesthetic.
3. Produce DESIGN_SYSTEM JSON using the schema below.
4. Preserve the Product Surface mapping already verified by preclaim.
5. Return output.

## DESIGN_SYSTEM Schema

```json
{
  "aesthetic": "minimal|brutalist|luxury|editorial|industrial|organic|playful|corporate",
  "palette": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "border": "#hex",
    "success": "#hex",
    "error": "#hex",
    "warning": "#hex"
  },
  "typography": {
    "heading": "Font Name",
    "body": "Font Name"
  },
  "iconLibrary": "lucide|heroicons",
  "borderRadius": "4|8|12|16",
  "spacing": "4|8|16|24|32|48|64"
}
```

## Aesthetic Guide

- minimal: whitespace, restrained color, simple sans-serif
- brutalist: bold type, high contrast, geometric
- luxury: serif heading, dark palette, gold accent
- editorial: serif heading, columns, typography emphasis
- industrial: monospace, technical, blueprint-like
- organic: soft radius, natural colors, flowing type
- playful: bright colors, rounded corners, friendly
- corporate: professional, serious, restrained

## Output Format

```
STATUS: done
DEVICE_TYPE: DESKTOP|TABLET|MOBILE
DESIGN_SYSTEM:
{
  "aesthetic": "...",
  "palette": { ... },
  "typography": { ... }
}
SCREEN_MAP:
[
  {"screenId": "...", "name": "...", "type": "...", "description": "...", "surfaceIds": ["SURF_*"]}
]
```

Wrong outputs:
- "DESIGN_SYSTEM not generated yet, working on it..."
- calling Stitch API again
- editing baseline HTML files
