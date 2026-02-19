# Design Checklist Reference

> Pre-delivery visual QA checklist for verifier and reviewer agents.
> Check EVERY item. REJECT if any critical item fails.

---

## Visual Quality Checklist

### Icons (CRITICAL - reject on fail)
- [ ] No emoji characters used as UI icons
- [ ] All icons are from the same SVG library (Lucide or Heroicons)
- [ ] Icons are consistent size (w-5 h-5 or w-6 h-6)
- [ ] Icons use `currentColor` for color inheritance
- [ ] Icon stroke width is consistent across the project

### Typography (CRITICAL - reject on fail)
- [ ] Project uses a distinctive font pair (NOT Inter/Roboto/Arial/system-ui)
- [ ] Google Fonts or Fontshare link is in `<head>`
- [ ] Heading font and body font are different
- [ ] Font weights vary purposefully (not everything the same weight)
- [ ] Body text line-height is 1.5-1.7
- [ ] Text does not run full viewport width (max 65-75 characters)

### Colors (CRITICAL - reject on fail)
- [ ] Project does NOT use purple gradient as primary aesthetic
- [ ] CSS custom properties defined for all colors
- [ ] Color palette matches the project domain (see design-standards.md)
- [ ] Sufficient contrast ratio: 4.5:1 for text, 3:1 for large text

### Layout
- [ ] Layout is NOT a basic centered single-column with no character
- [ ] Some visual asymmetry or rhythm variation exists
- [ ] Adequate negative space between sections (min py-16)
- [ ] Cards have appropriate padding (min p-6)

---

## Interaction Checklist

### Hover and Focus States (CRITICAL - reject on fail)
- [ ] `cursor-pointer` on ALL clickable elements (buttons, links, cards)
- [ ] Hover states exist on all interactive elements
- [ ] Hover transitions are 150-200ms
- [ ] Focus-visible ring on all focusable elements
- [ ] No `outline: none` without replacement focus style
- [ ] Active state on buttons (subtle scale or color change)

### Animations
- [ ] No `transition: all` used anywhere
- [ ] All animations are 150-300ms duration
- [ ] Only `transform` and `opacity` are animated
- [ ] `prefers-reduced-motion` media query is present
- [ ] No layout shift on hover (no width/height/margin animation)

---

## Light/Dark Mode Checklist

- [ ] Both light and dark modes are implemented
- [ ] `color-scheme` meta tag is set
- [ ] `theme-color` meta tag is set for both modes
- [ ] All text is readable in both modes (4.5:1 contrast)
- [ ] No pure white (#fff) text in dark mode
- [ ] No pure black (#000) background in dark mode
- [ ] Form inputs are explicitly styled in dark mode
- [ ] Selection highlight is visible in both modes
- [ ] Scrollbar appearance is acceptable in both modes

---

## Layout / Responsive Checklist

### Breakpoints
- [ ] Tested at 375px (mobile)
- [ ] Tested at 768px (tablet)
- [ ] Tested at 1024px (small desktop)
- [ ] Tested at 1440px (desktop)
- [ ] No horizontal scrollbar at any width
- [ ] No overlapping content at any width

### Mobile
- [ ] Touch targets are minimum 44x44px
- [ ] Columns stack vertically on mobile
- [ ] Text is readable without zooming (min 16px base)
- [ ] Navigation is accessible on mobile (hamburger or bottom nav)

---

## Accessibility Checklist

### Semantic HTML
- [ ] Proper heading hierarchy (h1 > h2 > h3, no skipping)
- [ ] `<button>` for actions, `<a>` for links (no div onclick)
- [ ] Landmark elements used (header, nav, main, footer)
- [ ] Lists use `<ul>` or `<ol>`

### Keyboard
- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual order
- [ ] Escape closes modals and dropdowns
- [ ] Skip link present for main content

### Screen Reader
- [ ] Images have meaningful `alt` or `alt=""`
- [ ] Icon-only buttons have `aria-label`
- [ ] Dynamic content uses `aria-live`
- [ ] Form inputs have associated labels

---

## Backend Quality Checklist

### Security
- [ ] No SQL string concatenation (parameterized queries only)
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` exists with dummy values
- [ ] No secrets hardcoded in source code
- [ ] Input validation on all API endpoints

### API Quality
- [ ] Correct HTTP status codes used
- [ ] Consistent error response format
- [ ] API routes use RESTful conventions
- [ ] Error messages are helpful but do not expose internals

### Code Quality
- [ ] No empty catch blocks (silent error swallowing)
- [ ] No TODO or FIXME left in production code
- [ ] No console.log left in production code (use proper logging)
- [ ] TypeScript: no `any` types without justification
- [ ] Business logic separated from route handlers

---

## How to Use This Checklist

### For Verifier Agent
Run through the **Visual Quality**, **Interaction**, and **Layout/Responsive** sections for every story with frontend changes. REJECT if any CRITICAL item fails.

### For Reviewer Agent
Run through ALL sections during code review. REJECT the PR if:
- Any CRITICAL item in Visual Quality fails
- Any CRITICAL item in Interaction fails
- Any item in Backend Quality / Security fails
- Overall design looks generic/AI-generated ("AI slop")

### Rejection Reasons (copy-paste for feedback)
- "REJECTED: Emoji icons used instead of SVG library icons"
- "REJECTED: Using Inter/Roboto/Arial - must use distinctive font pair"
- "REJECTED: Purple gradient aesthetic - must use project-specific palette"
- "REJECTED: Missing cursor-pointer on clickable elements"
- "REJECTED: Missing hover/focus states on interactive elements"
- "REJECTED: Contrast ratio below 4.5:1"
- "REJECTED: SQL string concatenation detected (injection risk)"
- "REJECTED: .env file not in .gitignore"
