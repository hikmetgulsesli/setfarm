DESIGN ENFORCEMENT (frontend stories — MANDATORY checklist before commit):
- FONTS: Google Fonts <link> in layout <head> (NOT next/font for static exports).
  :root must have --font-heading and --font-body CSS vars.
  h1-h6 → var(--font-heading), body → var(--font-body).
  BANNED font-family values: system-ui, Roboto, Arial, Inter, Helvetica.
- COLORS: shadcn/ui → update globals.css --accent from default gray to palette accent.
  Keep HSL format. Do not leave shadcn boilerplate unchanged.
- LAYOUT: Hero → asymmetric grid, NOT centered text-center single-column.
  Feature/tool grids → first item lg:col-span-2 or unequal column widths.
- NEVER: emoji icons, purple gradients, transition:all
- ALWAYS: cursor-pointer on clickables, hover/focus states, focus-visible rings
- LINKS: NEVER use href="#" or href="javascript:void(0)" — these are dead links.
  Every <Link> and <a> MUST point to a real route (e.g. /dashboard, /customers, /settings).
  If the destination page doesn't exist yet, create a minimal placeholder page with the route.
  If a sidebar/navbar has navigation items, EVERY item MUST have a working href.
  Before commit: grep -rn 'href="#"' src/ — if ANY match found, you MUST fix them all.
- HANDLERS: NEVER use onClick={() => {}} or onChange={() => {}} — empty handlers are banned.
  Every interactive element MUST have a real handler, even if it just logs or shows a toast.
