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
