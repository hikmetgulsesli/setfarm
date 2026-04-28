BEFORE writing code:
1. Read the story task and acceptance criteria from the claim via jq only; do not
   print the full claim JSON.
2. Do NOT read full references/*.md files during implement. The mandatory rules
   are already embedded in this prompt. If blocked on a specific rule, read only
   the matching heading with rg/sed and cap output to 80 lines.
3. If stitch/ directory exists:
   a. Read stitch/DESIGN_MANIFEST.json only to identify/count screens
   b. Read only the stitch/*.html files for STORY_SCREENS / current scope
   c. Read stitch/design-tokens.css only enough to import it and confirm token names
   d. Implementation MUST match Stitch design (layout, colors, fonts)
   e. NEVER use fonts/colors NOT in design-tokens.css
   f. You MUST @import stitch/design-tokens.css from the main CSS entry — do NOT copy or recreate tokens.
   g. stitch/design-tokens.css is the SINGLE SOURCE OF TRUTH for all design values.

SCREEN COVERAGE RULE (CRITICAL):
- Before marking implement as done, verify EVERY screen in DESIGN_MANIFEST.json has a corresponding page/component
- Read stitch/DESIGN_MANIFEST.json → count total screens
- Compare with actual pages created in the project
- If any Stitch screen has NO matching page → you MUST create it before completing
- Check: for each screen in manifest, does a route/page exist? If not, create it.
- A screen titled 'X Detail' needs a /x/[id] dynamic route
- A screen titled 'X List' needs a /x listing page
- A screen titled 'X Form' needs a /x/new or modal form
