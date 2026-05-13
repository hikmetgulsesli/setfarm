BEFORE writing code:
1. Read the story task and acceptance criteria from the claim via jq only; do not
   print the full claim JSON.
2. Do NOT read full references/*.md files during implement. The mandatory rules
   are already embedded in this prompt. If blocked on a specific rule, read only
   the matching heading with rg/sed and cap output to 80 lines.
3. If stitch/ directory exists:
   a. Read stitch/DESIGN_MANIFEST.json only to identify/count screens
   b. Read only the stitch/*.html files for STORY_SCREENS / current scope, and
      only when layout details are not already available from the injected
      STORY_SCREENS/UI contract
   c. Read stitch/design-tokens.css only enough to import it and confirm token names
   d. Implementation MUST match Stitch design (layout, colors, fonts)
   e. NEVER use fonts/colors NOT in design-tokens.css
   f. You MUST @import stitch/design-tokens.css from the main CSS entry — do NOT copy or recreate tokens.
   g. stitch/design-tokens.css is the SINGLE SOURCE OF TRUTH for all design values.

SCREEN COVERAGE RULE (CRITICAL):
- Implement only current SCOPE_FILES. Do not create routes/pages/screens outside
  this story to satisfy global manifest coverage.
- For app-shell stories, use src/screens/SCREEN_INDEX.json and src/screens/index.ts
  to wire generated screens into reachable flow without reading every screen file.
- For screen-owner stories, verify only the generated screen files in SCOPE_FILES.
- Global screen coverage is checked by verify/supervisor after stories are merged;
  do not solve it by editing out-of-scope files.
