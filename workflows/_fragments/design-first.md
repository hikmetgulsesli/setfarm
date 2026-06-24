# DESIGN-FIRST (MANDATORY)

The injected Stitch contracts below are the design source of truth during
implement. Use STORY_SCREENS, DESIGN_MANIFEST, DESIGN_TOKENS, UI CONTRACT,
LAYOUT STRUCTURE, SCREEN_INDEX/index.ts, claim-summary designContracts, and
scoped generated screen contracts.
If a generated screen is shared/read-only for this story, use
SCREEN_INDEX/index.ts and the injected contracts instead of reading any
component source from that shared screen. Focused line-range reads are allowed
only for generated screen files explicitly listed in SCOPE_FILES. If no
generated screen source exists for the stack, focused story-owned Stitch
HTML/DESIGN_DOM files are allowed binding design sources. Write only files in
the current story scope. Setfarm enforces generated-screen source boundaries at
runtime.

STORY SCREENS:
{{story_screens}}

STITCH RAW FILES:
For generated-screen claims, do not read unrelated stitch/*.html,
.stitch-screens*.json, stitch/DESIGN_DOM.json, or stitch/design-tokens.css.
For stacks without generated screens, focused story-owned Stitch HTML and
DESIGN_DOM are allowed binding design sources.

DESIGN TOKENS:
{{design_tokens}}

DESIGN DOM:
Use injected STORY_SCREENS, UI CONTRACT, LAYOUT STRUCTURE, DESIGN_MANIFEST,
DESIGN_TOKENS, SCREEN_INDEX/index.ts, claim-summary designContracts, and
generated screen contracts as binding design input. For stacks without generated
screens, focused story-owned Stitch HTML/DESIGN_DOM files are allowed for
missing detail.

UI CONTRACT (auto-generated from Stitch design — EVERY element MUST work):
{{ui_contract}}

LAYOUT STRUCTURE (auto-extracted from Stitch HTML — REPRODUCE THIS EXACTLY):
{{layout_skeleton}}

DESIGN ENFORCEMENT (MANDATORY):
- FONTS: copy ordinary Google text-font `<link>` tags from the Stitch HTML into
  `index.html <head>` only when `index.html` is in SCOPE_FILES. Do not copy
  Material Symbols, Material Icons, or any icon-font links.
  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.
- ICONS: if Stitch HTML/DESIGN_DOM contains Material Symbols, Material Icons,
  icon-font classes, or ligature text, replace them in source UI with inline
  SVG components or an already-installed SVG icon library.
- COLORS: use colors from design-tokens.css. Do not define your own hex/rgb
  colors. Always use var(--color-*). If Stitch HTML shows a hex color, map it
  to the matching design token.
- LAYOUT: preserve the Stitch flex/grid hierarchy and nesting.
- NEVER: emoji icons, icon fonts, Material Symbols, purple gradients,
  transition: all, dead unhandled placeholder links, empty handlers,
  console.log-only handlers.
- ALWAYS: cursor-pointer on clickables, hover/focus states, focus-visible rings.
- LINKS: every visible link must navigate, change visible state, or be
  intentionally disabled. Preserve generated Stitch `<a>` tags, className,
  nesting and layout; do not replace anchors with `<span>` just to remove
  `href="#"`.
- HANDLERS: every handler must produce real product behavior.

LANGUAGE:
- Agent-facing code comments, reports, and technical outputs should be English.
- Visible application copy must follow the user's requested product language.
  If the user explicitly requests a non-English product language, localize only
  visible application copy; keep code, comments, reports, and technical output
  in English.

DESIGN CONTRACT RULES:
1. Every navigation anchor must preserve the generated `<a>` tag, className,
   nesting and layout. If the route is real and in scope, navigate there. If the
   target is a Stitch placeholder or out of scope, keep the anchor and add
   visible in-screen behavior or an explicit disabled state; do not replace it
   with `<span>`.
2. Every button must have a functional onClick handler that changes state,
   opens a modal/drawer, navigates, submits a form, or is intentionally disabled.
3. Every input must have onChange and controlled state.
4. Replace hardcoded demo data with dynamic props/state.
