# Design Standards Reference

> This document defines mandatory design rules for all frontend work.
> Every developer, reviewer, and verifier agent MUST follow these standards.

---

## Anti-Patterns (BANNED)

These patterns produce generic "AI slop" output. Using ANY of these is grounds for REJECTION.

### BANNED: Emoji Icons
- NEVER use emoji characters as UI icons
- NEVER use emoji in navigation, buttons, cards, or headers
- ALWAYS use SVG icons from Lucide React or Heroicons exclusively

### BANNED: Generic Fonts
- NEVER use Inter, Roboto, Arial, Helvetica, system-ui as primary font
- NEVER use only one font weight (everything looks the same)
- ALWAYS use a distinctive font pair from the table below

### BANNED: Purple Gradient Aesthetic
- NEVER use purple-to-blue gradient backgrounds
- NEVER use purple-on-white or purple-on-dark-gray color schemes
- NEVER use Indigo/violet as primary brand color (overused in AI products)
- ALWAYS use a project-specific color palette from the table below

### BANNED: Lazy Animations
- NEVER use `transition: all` (animates everything, causes jank)
- NEVER use animations longer than 400ms (feels sluggish)
- NEVER animate layout properties (width, height, margin, padding)
- ONLY animate `transform` and `opacity`
- Duration: 150-300ms
- Use `prefers-reduced-motion: reduce` media query

### BANNED: Boring Layouts
- NEVER use perfectly symmetrical 3-column grids
- NEVER use centered single-column with no visual rhythm
- NEVER make every section identical height and structure
- USE asymmetric layouts, varied section heights
- USE generous negative space
- BREAK the grid occasionally for visual interest

---

## Typography: Font Pairs

Choose ONE pair per project. Include Google Fonts link in `<head>`.

| # | Heading Font | Body Font | Mood | Google Fonts URL |
|---|-------------|-----------|------|-----------------|
| 1 | **Space Grotesk** | DM Sans | Modern tech, clean | `family=Space+Grotesk:wght@500;700&family=DM+Sans:wght@400;500;700` |
| 2 | **Outfit** | Source Sans 3 | Friendly SaaS | `family=Outfit:wght@500;600;700&family=Source+Sans+3:wght@400;600` |
| 3 | **Sora** | Nunito Sans | Rounded, approachable | `family=Sora:wght@500;600;700&family=Nunito+Sans:wght@400;600` |
| 4 | **Clash Display** | General Sans | Bold, editorial | Use Fontshare CDN |
| 5 | **Plus Jakarta Sans** | Work Sans | Professional, warm | `family=Plus+Jakarta+Sans:wght@500;600;700&family=Work+Sans:wght@400;500` |
| 6 | **Manrope** | Karla | Geometric, minimal | `family=Manrope:wght@500;600;700&family=Karla:wght@400;500` |
| 7 | **Red Hat Display** | Red Hat Text | IBM-style, authoritative | `family=Red+Hat+Display:wght@500;700&family=Red+Hat+Text:wght@400;500` |
| 8 | **Albert Sans** | Figtree | Soft, contemporary | `family=Albert+Sans:wght@500;600;700&family=Figtree:wght@400;500` |
| 9 | **Satoshi** | Cabinet Grotesk | Startup chic | Use Fontshare CDN |
| 10 | **Bricolage Grotesque** | Instrument Sans | Quirky, distinctive | `family=Bricolage+Grotesque:wght@500;700&family=Instrument+Sans:wght@400;500` |

### Typography Rules
- Heading: font-weight 600-700, tracking tight (-0.02em to -0.01em)
- Body: font-weight 400-500, line-height 1.5-1.7
- Small text: minimum 14px (0.875rem)
- Line width: 65-75 characters max for readability
- Use `text-wrap: balance` for headings
- Use `font-variant-numeric: tabular-nums` for data/numbers

---

## Color Palettes

Choose ONE palette per project based on domain. Define as CSS custom properties.

### 1. SaaS / Productivity
```css
--primary: #2563eb;      /* Blue 600 */
--primary-hover: #1d4ed8; /* Blue 700 */
--accent: #f59e0b;        /* Amber 500 */
--surface: #f8fafc;       /* Slate 50 */
--surface-dark: #0f172a;  /* Slate 900 */
--text: #1e293b;          /* Slate 800 */
--text-muted: #64748b;    /* Slate 500 */
--border: #e2e8f0;        /* Slate 200 */
```

### 2. DevTool / CLI Dashboard
```css
--primary: #22d3ee;      /* Cyan 400 */
--primary-hover: #06b6d4; /* Cyan 500 */
--accent: #a3e635;        /* Lime 400 */
--surface: #18181b;       /* Zinc 900 */
--surface-alt: #27272a;   /* Zinc 800 */
--text: #fafafa;          /* Zinc 50 */
--text-muted: #a1a1aa;    /* Zinc 400 */
--border: #3f3f46;        /* Zinc 700 */
--success: #4ade80;       /* Green 400 */
--error: #f87171;         /* Red 400 */
--warning: #fbbf24;       /* Amber 400 */
```

### 3. Analytics / Dashboard
```css
--primary: #0ea5e9;      /* Sky 500 */
--primary-hover: #0284c7; /* Sky 600 */
--accent: #f472b6;        /* Pink 400 */
--surface: #fafafa;       /* Neutral 50 */
--surface-dark: #171717;  /* Neutral 900 */
--text: #262626;          /* Neutral 800 */
--text-muted: #737373;    /* Neutral 500 */
--chart-1: #0ea5e9;
--chart-2: #8b5cf6;
--chart-3: #f472b6;
--chart-4: #34d399;
--chart-5: #fb923c;
```

### 4. Documentation / Knowledge Base
```css
--primary: #059669;      /* Emerald 600 */
--primary-hover: #047857; /* Emerald 700 */
--accent: #0891b2;        /* Cyan 600 */
--surface: #fffbeb;       /* Amber 50 */
--surface-dark: #1c1917;  /* Stone 900 */
--text: #292524;          /* Stone 800 */
--text-muted: #78716c;    /* Stone 500 */
--border: #e7e5e4;        /* Stone 200 */
```

### 5. Monitoring / Status
```css
--primary: #10b981;      /* Emerald 500 */
--primary-hover: #059669; /* Emerald 600 */
--accent: #f43f5e;        /* Rose 500 */
--surface: #111827;       /* Gray 900 */
--surface-alt: #1f2937;   /* Gray 800 */
--text: #f9fafb;          /* Gray 50 */
--text-muted: #9ca3af;    /* Gray 400 */
--up: #10b981;
--down: #ef4444;
--degraded: #f59e0b;
```

### 6. Portfolio / Creative
```css
--primary: #e11d48;      /* Rose 600 */
--primary-hover: #be123c; /* Rose 700 */
--accent: #7c3aed;        /* Violet 600 */
--surface: #fefce8;       /* Yellow 50 */
--surface-dark: #0c0a09;  /* Stone 950 */
--text: #1c1917;          /* Stone 900 */
--text-muted: #57534e;    /* Stone 600 */
```

### 7. E-commerce / Marketplace
```css
--primary: #ea580c;      /* Orange 600 */
--primary-hover: #c2410c; /* Orange 700 */
--accent: #0d9488;        /* Teal 600 */
--surface: #fff7ed;       /* Orange 50 */
--surface-dark: #1a1a2e;  /* Custom dark */
--text: #1e1b4b;          /* Indigo 950 */
--text-muted: #6b7280;    /* Gray 500 */
--price: #059669;
--sale: #dc2626;
```

### 8. Social / Community
```css
--primary: #8b5cf6;      /* Violet 500 - exception: OK as social platform */
--primary-hover: #7c3aed; /* Violet 600 */
--accent: #06b6d4;        /* Cyan 500 */
--surface: #faf5ff;       /* Violet 50 */
--surface-dark: #0f0f23;  /* Custom dark */
--text: #1e1b4b;          /* Indigo 950 */
--text-muted: #6b7280;    /* Gray 500 */
```

---

## Icon Rules

### Allowed Libraries (choose ONE per project)
1. **Lucide React** - `npm install lucide-react` - preferred for most projects
2. **Heroicons** - `npm install @heroicons/react` - good for Tailwind projects
3. **Simple Icons** - brand/logo icons only (GitHub, Twitter, etc.)

### Icon Standards
- ViewBox: `0 0 24 24` (standard)
- Size: `w-5 h-5` (20px) for inline, `w-6 h-6` (24px) for standalone
- Stroke width: 1.5-2 (consistent across project)
- Color: `currentColor` (inherits text color)
- Never mix icon libraries in the same project
- Never use Font Awesome (bloated, inconsistent)

---

## Layout Principles

### Asymmetry and Visual Interest
- Avoid perfectly balanced layouts - slight asymmetry feels more human
- Use CSS Grid with varied column spans: `grid-cols-[2fr_1fr]` not always `grid-cols-2`
- Hero sections: image/graphic should be offset, not perfectly centered
- Overlap elements slightly with negative margins or absolute positioning

### Negative Space
- More whitespace = more premium feeling
- Section padding: minimum `py-16` (64px), prefer `py-20` to `py-24`
- Card padding: minimum `p-6` (24px)
- Between sections: use `gap-8` to `gap-16` generously

### Grid Breaking
- Not everything needs to be in a grid
- Float a testimonial or callout outside the content column
- Use full-bleed backgrounds with contained content
- Pull quotes or stats can break the rhythm

---

## Animation Standards

### Timing
- Micro-interactions (hover, focus): 150ms
- Element transitions (expand, slide): 200-250ms
- Page transitions: 300ms max
- Never exceed 400ms for any animation

### Properties (ONLY these)
```css
/* ALLOWED */
transform: translateX(), translateY(), scale(), rotate()
opacity: 0 to 1

/* BANNED */
width, height, margin, padding, top, left, right, bottom
```

### Easing
- Default: `ease-out` (fast start, smooth end)
- Entrances: `cubic-bezier(0.16, 1, 0.3, 1)` (spring feel)
- Exits: `ease-in`
- Never use `linear` for UI animations

### Accessibility
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Patterns

### Cards
- Use subtle shadows: `shadow-sm` or custom `0 1px 3px rgba(0,0,0,0.08)`
- Border: `border border-[--border]` (use CSS custom property)
- Rounded: `rounded-xl` (12px) or `rounded-2xl` (16px)
- Hover: subtle lift `hover:-translate-y-0.5 hover:shadow-md` with 200ms transition
- Glass effect (dark mode): `bg-white/5 backdrop-blur-md border-white/10`

### Buttons
- `cursor-pointer` on ALL clickable elements (mandatory)
- Primary: filled with `--primary`, white text
- Secondary: outlined or ghost style
- Minimum touch target: 44x44px
- Hover state: darken or shift color
- Focus state: visible ring `focus-visible:ring-2 focus-visible:ring-offset-2`
- Active state: slight scale down `active:scale-[0.98]`
- Loading state: spinner or disabled style

### Navigation
- Sticky/fixed top navbar preferred
- Active state clearly visible
- Mobile: hamburger to slide-out or bottom sheet
- Logo left, nav center or right, CTA far right

### Forms
- Label always visible (no placeholder-only inputs)
- Error states: red border + inline error message below field
- Success feedback: green checkmark or toast
- `autocomplete` attribute on all form fields

---

## Dark Mode Requirements

When implementing dark mode:
- Use CSS custom properties for all colors (see palettes above)
- `<html>` gets `class="dark"` or `data-theme="dark"`
- Set `<meta name="color-scheme" content="light dark">`
- Set `<meta name="theme-color">` for browser chrome
- Contrast ratio: minimum 4.5:1 for text, 3:1 for large text
- Explicitly set `select`, `input`, `textarea` background colors
- Test both modes - dark mode is not optional

---

## Design Tokens (First Story Requirement)

Every project MUST create design tokens in the first user story:

```css
:root {
  /* Colors - from chosen palette */
  --primary: #...;
  --primary-hover: #...;
  --accent: #...;
  --surface: #...;
  --text: #...;
  --text-muted: #...;
  --border: #...;

  /* Typography - from chosen font pair */
  --font-heading: "Font Name", sans-serif;
  --font-body: "Font Name", sans-serif;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Radii */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
}

.dark {
  --surface: #...;
  --text: #...;
  /* ... dark overrides ... */
}
```

---

## Project Setup Requirements (MANDATORY)

Every project MUST include these files from the FIRST story:

### .env.example (REQUIRED)
- ALWAYS create `.env.example` in the project root with all required env vars
- Use dummy/placeholder values (never real secrets)
- Comment each variable explaining its purpose
- `.env` MUST be in `.gitignore` (NEVER commit real secrets)
- If the project uses NO env vars, create `.env.example` with a comment: `# No environment variables required`
- The build/verify step WILL FAIL if `.env.example` is missing

```bash
# Example .env.example
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# API Keys (get from dashboard)
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Auth
JWT_SECRET=your-secret-here-min-32-chars
```

### .gitignore (REQUIRED)
- MUST include: `.env`, `node_modules/`, `.next/`, `out/`, `dist/`, `.vite/`
- MUST include OS files: `.DS_Store`, `Thumbs.db`
- MUST include IDE files: `.vscode/`, `.idea/`

### Package Scripts (REQUIRED)
- `build` script must exist and work
- `dev` script for local development
- `test` script (even if placeholder initially)
- `typecheck` script if using TypeScript: `tsc --noEmit`

---

## Project Naming Convention (MANDATORY)

Project names MUST be human-readable and clean. This applies to:
- Project titles in Mission Control
- Repository display names
- Page titles and meta tags
- README headings

### Rules
1. **Use natural language** — NOT slugs or kebab-case
   - GOOD: `setrox.com portfolio`, `QR Code Generator`, `Habit Tracker`
   - BAD: `setrox-portfolio-com`, `qr-code-generator-app`, `habit_tracker`

2. **Keep domain names intact** — preserve dots and proper formatting
   - GOOD: `setrox.com portfolio`
   - BAD: `setrox-com-portfolio`, `setroxcom portfolio`

3. **Use Title Case or natural capitalization**
   - GOOD: `Color Palette Generator`, `Typing Speed Test`
   - BAD: `color palette generator`, `COLOR-PALETTE-GENERATOR`

4. **Be concise but descriptive** — 2-4 words ideal
   - GOOD: `Pomodoro Timer`, `URL Shortener`
   - BAD: `A Simple Pomodoro Timer Web Application`

5. **No technical suffixes** — omit words like "app", "web", "frontend", "service"
   - GOOD: `Habit Tracker`
   - BAD: `Habit Tracker App`, `Habit Tracker Web Frontend`

---

## Cloudflare Tunnel Config (CRITICAL — VALIDATE BEFORE RESTART)

The Cloudflare tunnel config at `/etc/cloudflared/config.yml` routes ALL public traffic to services. A broken config takes down EVERY public-facing service (Error 1033).

### Rules for Agents

1. **Before editing `/etc/cloudflared/config.yml`**, always back up first: `sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak`
2. **After editing, ALWAYS validate YAML** before restarting: `python3 -c "import yaml; yaml.safe_load(open('/etc/cloudflared/config.yml'))"`
3. **If validation fails**, restore backup immediately: `sudo cp /etc/cloudflared/config.yml.bak /etc/cloudflared/config.yml`
4. **Every ingress entry MUST have both `hostname:` and `service:` keys** — missing either breaks the entire tunnel
5. **The last entry MUST always be the catch-all**: `- service: http_status:404`
6. **NEVER add duplicate hostnames** — check existing config first
7. **Use short, clean subdomain names** — NEVER use task descriptions as hostnames

### Common Mistakes (ALL BANNED)
- Adding a hostname without a service line
- Adding multiple `service:` keys under one hostname
- Using the full task description as a hostname (e.g., `agentviz-real-time-agent-activity-visualization.setrox.com.tr`)
- Restarting cloudflared without validating YAML first

---

## Gateway Restart Policy

Gateway restarts are allowed when necessary (e.g., after a config fix), but follow this checklist:

1. **Check for active pipelines first**: `antfarm workflow runs` — note any `[running]` runs
2. **If a pipeline is running**, wait for the current step to complete, or accept that the step may need recovery
3. **The unstick-steps watchdog** (`~/.openclaw/scripts/unstick-steps.sh`) runs every 10 minutes and auto-recovers stuck steps after restart
4. **After restart**, verify all channels started: look for `[telegram] starting provider`, `[whatsapp] Listening`, `[discord] logged in` in logs
5. **Prefer hot-reload over restart** when possible: `openclaw config set` triggers config reload without restart

---

## Project Naming & Domain Rules (MANDATORY)

### Project ID Rules
- **Maximum 20 characters** for project IDs
- Use simple, descriptive names: `recipe-book`, `markdown-notepad`, `agentviz`
- **NEVER** use task descriptions as IDs (e.g., `recipe-book-tarif-ekle-malzeme-listesi...` is BANNED)
- Use kebab-case (lowercase with hyphens)
- No articles ("a", "an", "the") in IDs

### Domain/Subdomain Rules
- **Maximum 25 characters** for the subdomain part (before `.setrox.com.tr`)
- Keep it short and memorable: `markdown.setrox.com.tr`, `recipe-book.setrox.com.tr`
- **NEVER** use full descriptions as subdomains
- Prefer single words when possible: `markdown` over `markdown-notepad`
- Must match or closely relate to the project ID

### Project Name Rules
- Clean, short display names: "Recipe Book", "Markdown Notepad", "AgentViz"
- **NEVER** include feature descriptions in the name
- No trailing descriptions (e.g., "Recipe Book - Tarif ekle, malzeme listesi..." is BANNED)
- Feature details go in the `description` field, NOT in the name

### Examples

| GOOD | BAD |
|------|-----|
| `recipe-book` | `recipe-book-tarif-ekle-malzeme-listesi-porsiyon-hesap-t` |
| `markdown.setrox.com.tr` | `markdown-notepad-live-preview-syntax-highlight-local-sto.setrox.com.tr` |
| "AgentViz" | "AgentViz — Real-time Agent Activity Visualization" |
| `expense-tracker` | `an-expense-tracker` |
