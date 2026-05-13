DESIGN ENFORCEMENT (frontend stories — MANDATORY checklist before commit):
- FONTS: Google Fonts <link> in layout <head> (NOT next/font for static exports).
  :root must have --font-heading and --font-body CSS vars.
  h1-h6 → var(--font-heading), body → var(--font-body).
  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.
  - Do NOT add Material Symbols, Material Icons, icon-font links, or icon
    ligature text. If Stitch contains those names, replace them in source UI
    with inline SVG components or an already-installed SVG icon library.
- COLORS: shadcn/ui → update globals.css --accent from default gray to palette accent.
  Keep HSL format. Do not leave shadcn boilerplate unchanged.
- LAYOUT: Hero → asymmetric grid, NOT centered text-center single-column.
  Feature/tool grids → first item lg:col-span-2 or unequal column widths.
- NEVER: emoji icons, icon fonts, Material Symbols, purple gradients, transition:all
- ALWAYS: cursor-pointer on clickables, hover/focus states, focus-visible rings
- LINKS: never leave a dead, unhandled `href="#"` or `href="javascript:void(0)"`.
  If a generated Stitch component already has `<a>` tags or nav classes, preserve
  the tag, className, nesting and layout. Do NOT replace anchors with `<span>`,
  `<div>`, or text-only elements.
  Prefer a real route when the route/page is in scope. If the target is out of
  scope, keep the `<a>` and add an `onClick`/keyboard-safe behavior that prevents
  default navigation and produces visible in-screen state, or mark it explicitly
  disabled/hidden when the story says it is unavailable.
  If a sidebar/navbar has navigation items, every visible item must either
  navigate, change visible state, or be intentionally disabled.
- HANDLERS: NEVER use onClick={() => {}} or onChange={() => {}} — empty handlers are banned.
  Every interactive element MUST have a real user-visible effect: change state, submit data,
  open/close a modal or drawer, update storage, or navigate to a real route. console.log,
  alert-only, and toast-only handlers do NOT count as functional behavior.
  - Check DESIGN_DOM buttons for expectedRoute field. If a button has expectedRoute,
    implement it with React Router Link or onClick navigation to that exact route.
  - For icon buttons, create a working project-specific route or an in-screen
    modal/drawer that preserves the Stitch layout. A visible icon button with no user-visible
    result is a blocking implementation failure.

STITCH COMPONENT IMPORT RULES (NO EXCEPTIONS):
1. Generated Stitch components live in src/screens/ unless the project scaffold
   explicitly uses another generated path.
2. If a generated screen is in SCOPE_FILES, preserve its component and generated
   layout; add only story-owned behavior/dynamic state.
3. If a generated screen is shared-only, import/render it only through its
   exported component/action prop contract from src/screens/index.ts and
   src/screens/SCREEN_INDEX.json. Do not bulk-read or modify shared screen files.
4. NEVER create inline/duplicate overlay or screen implementations in page files.
5. Verify current story scope before commit. Global screen reachability is
   enforced by verify/supervisor after merge.

FRAMEWORK-AWARE DESIGN TOKEN INTEGRATION:
1. NEXT.JS (app/ dir): add @import "../stitch/design-tokens.css" at the top of app/globals.css.
2. REACT (Vite/CRA): import design-tokens.css from src/index.css or src/main.tsx.
3. RULES: import design-tokens.css, do not copy-paste it. Use var(--property-name).
   Do not define --font-* or --color-* outside design-tokens.css. Do not delete existing CSS files.

NO STITCH = NO CODE:
If a page does NOT have a corresponding Stitch HTML in stitch/:
- Do NOT create it with mock data or placeholder content
- Add it to MISSING_SCREENS list in output
- Only implement pages that have Stitch HTML reference
