DESIGN ENFORCEMENT (frontend stories — MANDATORY checklist before commit):
- FONTS: Google Fonts <link> in layout <head> (NOT next/font for static exports).
  :root must have --font-heading and --font-body CSS vars.
  h1-h6 → var(--font-heading), body → var(--font-body).
  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.
  - If stitch/*.html or DESIGN_DOM contains Material Symbols icon names,
    YOU MUST add this to index.html <head> or app/layout.tsx:
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
    Without this link, icons render as plain text instead of symbols.
- COLORS: shadcn/ui → update globals.css --accent from default gray to palette accent.
  Keep HSL format. Do not leave shadcn boilerplate unchanged.
- LAYOUT: Hero → asymmetric grid, NOT centered text-center single-column.
  Feature/tool grids → first item lg:col-span-2 or unequal column widths.
- NEVER: emoji icons, purple gradients, transition:all
- ALWAYS: cursor-pointer on clickables, hover/focus states, focus-visible rings
- LINKS: NEVER use href="#" or href="javascript:void(0)" — these are dead links.
  Every <Link> and <a> MUST point to a real project-specific route from PRD/Stitch/DESIGN_DOM.
  If the destination page doesn't exist yet, create a minimal placeholder page with the route.
  If a sidebar/navbar has navigation items, EVERY item MUST have a working href.
  Before commit: grep -rn 'href="#"' src/ — if ANY match found, you MUST fix them all.
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
1. If stitch/ has screen HTML files, there MUST be matching React components in components/
2. Screen components MUST be imported and rendered in the main page (app/page.tsx or equivalent)
3. NEVER create inline/duplicate overlay or screen implementations in page files
4. If a component exists in components/ matching a Stitch screen, you MUST use it — do NOT recreate it
5. After implementation, verify: every screen in DESIGN_MANIFEST.json has a matching import in the render tree

FRAMEWORK-AWARE DESIGN TOKEN INTEGRATION:
1. NEXT.JS (app/ dir): app/globals.css BAŞINA @import "../stitch/design-tokens.css"
2. REACT (Vite/CRA): src/index.css veya src/main.tsx'de design-tokens.css import et
3. RULES: design-tokens.css IMPORT edilir (copy-paste YAPILMAZ), var(--property-name) ile kullan,
   design-tokens.css dışında --font-*, --color-* tanımlama YASAK, mevcut CSS dosyalarını SILME

NO STITCH = NO CODE:
If a page does NOT have a corresponding Stitch HTML in stitch/:
- Do NOT create it with mock data or placeholder content
- Add it to MISSING_SCREENS list in output
- Only implement pages that have Stitch HTML reference
