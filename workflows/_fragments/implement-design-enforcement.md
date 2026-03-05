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
