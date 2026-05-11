UI CONTRACT (auto-generated from Stitch design — EVERY element MUST work):
{{ui_contract}}

LAYOUT STRUCTURE (auto-extracted from Stitch HTML — REPRODUCE THIS EXACTLY):
{{layout_skeleton}}

LAYOUT RULES (MANDATORY):
1. Every container shown above must exist in the implementation with the same
   nesting.
2. Use the same CSS class names or semantic component equivalents.
3. Preserve flex/grid layout type.
4. Preserve container properties: border, radius, padding, background, gap.
5. Do not flatten the hierarchy.
6. Do not invent a different layout.
7. Read `stitch/<screen>.html` for full detail if the skeleton is unclear.

DESIGN CONTRACT RULES:
1. Every navigation anchor must preserve the generated `<a>` tag, className,
   nesting and layout. If the route is real and in scope, navigate there. If the
   target is a Stitch placeholder or out of scope, keep the anchor and add
   visible in-screen behavior or an explicit disabled state; do not replace it
   with `<span>`.
2. Every button must have functional behavior. Priority:
   a) Best: implement the full project-specific feature, panel, modal, page, or
      flow described by PRD/Stitch/DESIGN_DOM.
   b) Acceptable only when truly out of scope: show visible feedback explaining
      the feature is planned.
   c) Never: empty handler, console.log only, or missing handler.
   If using option (b), add the feature to INCOMPLETE.md with reason.
3. Every input must have onChange and controlled state.
4. Replace hardcoded demo data with dynamic props/state.
