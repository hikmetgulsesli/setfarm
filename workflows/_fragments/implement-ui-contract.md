UI CONTRACT (auto-generated from Stitch design — EVERY element MUST work):
{{ui_contract}}

LAYOUT STRUCTURE (auto-extracted from Stitch HTML — REPRODUCE THIS EXACTLY):
{{layout_skeleton}}

LAYOUT RULES (MANDATORY):
1. Every container shown above MUST exist in your implementation with the SAME nesting
2. Use the same CSS class names or semantic equivalents (.score-board → ScoreBoard component)
3. Preserve flex/grid layout type — if Stitch uses flex, use flex. If grid, use grid.
4. Preserve container properties (border, border-radius, padding, background, gap)
5. Do NOT flatten the hierarchy — if Stitch shows a wrapper card, you MUST have a wrapper
6. Do NOT invent your own layout — follow the skeleton above
7. Read stitch/<screen>.html for full detail if skeleton is unclear

DESIGN CONTRACT RULES:
1. Every navigation link MUST route to its page (install react-router-dom if needed)
2. Every button MUST have a functional onClick handler. Options by priority:
   a) BEST: Implement the full project-specific feature, panel, modal, page, or flow described by PRD/Stitch/DESIGN_DOM.
   b) ACCEPTABLE: Show a visible feedback (toast, snackbar, modal) saying the feature is planned
   c) NEVER: Empty handler (() => {}), console.log only, or no handler at all
   If using option (b), add the feature to INCOMPLETE.md at project root with description and reason.
3. Every input MUST have onChange and controlled state
4. All hardcoded demo data MUST be replaced with dynamic props/state
