# DESIGN-FIRST (MANDATORY)

The Stitch files below are the design source of truth. The full HTML is not
pasted into the prompt; read only current SCOPE_FILES from WORKDIR. If a
generated screen is shared/read-only for this story, use SCREEN_INDEX/index.ts
and the injected contracts instead of reading any component source from that
shared screen. Focused line-range reads are allowed only for generated screen
files explicitly listed in SCOPE_FILES. Write only files in the current story
scope. Setfarm enforces this at runtime:
reading a generated src/screens/*.tsx file outside SCOPE_FILES kills and
retries the claim before generated-screen context overload.

STORY SCREENS:
{{story_screens}}

STITCH FILES TO READ:
- stitch/DESIGN_MANIFEST.json
- stitch/design-tokens.css
- stitch/DESIGN_DOM.json
- relevant stitch/*.html files listed in STORY_SCREENS only when the injected
  contract is insufficient, capped to focused excerpts

DESIGN TOKENS:
{{design_tokens}}

DESIGN DOM:
The prompt excerpt is intentionally short. If full structure is needed, read
only the current story screens from stitch/DESIGN_DOM.json. Do not paste the
entire project DOM into the prompt.

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
  For Turkish tasks, visible labels, placeholders, aria-labels, titles, and
  error messages should be Turkish unless they are technical terms or brand
  names.

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
