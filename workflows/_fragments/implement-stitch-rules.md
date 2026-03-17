BEFORE writing code:
1. Read the FULL story description and ALL acceptance criteria before coding
2. Read references/design-standards.md + references/backend-standards.md
3. If stitch/ directory exists:
   a. Read stitch/DESIGN_MANIFEST.json → find this story's screen
   b. Read stitch/<story-id>.html for layout reference
   c. Read stitch/design-tokens.css for colors/fonts/spacing
   d. Implementation MUST match Stitch design (layout, colors, fonts)
   e. NEVER use fonts/colors NOT in design-tokens.css
   f. You MUST @import or copy stitch/design-tokens.css into your main CSS file — do NOT recreate tokens.
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
