# Web Guidelines Reference

> Accessibility, forms, animation, performance, and dark mode standards.
> Condensed from Vercel web-design-guidelines. All rules are mandatory.

---

## Accessibility (WCAG 2.1 AA)

### Semantic HTML
- Use `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`
- Use heading hierarchy: `<h1>` then `<h2>` then `<h3>` (never skip levels)
- Use `<button>` for actions, `<a>` for navigation (never `<div onclick>`)
- Use `<ul>`/`<ol>` for lists, `<table>` for tabular data
- Use `<time datetime="...">` for dates

### ARIA Labels
- Every interactive element needs an accessible name
- Icon-only buttons: `aria-label="Close"` or `<span class="sr-only">Close</span>`
- Form inputs: associated `<label>` or `aria-label`
- Dynamic content: `aria-live="polite"` for updates, `"assertive"` for errors
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Navigation landmarks: `<nav aria-label="Main navigation">`

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order must be logical (follow visual order)
- `focus-visible` styles on all focusable elements (never `outline: none`)
- Escape key closes modals and dropdowns
- Enter/Space activates buttons
- Arrow keys navigate within components (tabs, menus, radio groups)
- Skip link: `<a href="#main-content" class="sr-only focus:not-sr-only">`

### Color and Contrast
- Text contrast: minimum 4.5:1 (normal text), 3:1 (large text 18px bold / 24px)
- Interactive elements: 3:1 contrast against adjacent colors
- Never use color alone to convey information (add icons, patterns, or text)
- Test with a contrast checker tool

### Screen Readers
- Images: meaningful `alt` text or `alt=""` for decorative
- SVG icons: `aria-hidden="true"` when decorative, `role="img"` + `aria-label` when meaningful
- Hidden text for context: `class="sr-only"` (visually hidden, screen-reader visible)
- Live regions for dynamic updates: `aria-live="polite"`

---

## Forms

### Labels and Input
- Every input MUST have a visible `<label>` (not just placeholder)
- Placeholders supplement labels, never replace them
- Use `htmlFor` / `for` to associate labels with inputs
- Group related fields with `<fieldset>` + `<legend>`
- Use appropriate `inputmode`: `numeric`, `email`, `tel`, `url`, `search`
- Use appropriate `type`: `email`, `password`, `number`, `tel`, `url`, `date`

### Autocomplete
- Add `autocomplete` attribute to all user-facing form fields
- Common values: `name`, `email`, `tel`, `street-address`, `postal-code`
- Login forms: `autocomplete="username"` + `autocomplete="current-password"`
- New account: `autocomplete="new-password"`
- Search: `autocomplete="off"` is acceptable

### Validation and Errors
- Validate on blur (immediate feedback) AND on submit (catch-all)
- Show inline errors directly below the invalid field
- Error message format: describe what went wrong AND how to fix it
- Invalid fields: red border + `aria-invalid="true"` + `aria-describedby` linking to error
- Success state: green checkmark or "Saved" confirmation
- Never clear the form on validation failure

### Form UX
- Submit button text describes the action: "Create Account" not "Submit"
- Disable submit button while processing (prevent double submit)
- Show loading state during submission
- Mark required fields with `*` and explain at the top: "* Required"
- Keep forms short - ask only what you need

---

## Animation and Motion

### Performance Rules
- Only animate `transform` and `opacity` (GPU-accelerated)
- Use `will-change` sparingly: only on elements about to animate
- Remove `will-change` after animation completes
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding`
- Use `translate()` instead of `position` changes

### Timing
- Micro-interactions (hover, focus, toggle): 100-150ms
- Content transitions (expand, slide, fade): 200-250ms
- Page transitions: 250-300ms
- Staggered reveals: 50-100ms between items
- Never exceed 400ms for any single animation

### Easing Functions
- Entrances: `cubic-bezier(0.16, 1, 0.3, 1)` (overshoot, spring feel)
- Exits: `cubic-bezier(0.7, 0, 0.84, 0)` (fast start, clean end)
- Standard: `ease-out` for most interactions
- Never use `linear` for UI animations (feels mechanical)

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- This media query MUST be included in every project
- Essential motion (progress indicators) can use reduced alternatives
- Parallax effects should be completely disabled

### Animation Patterns
- **Fade in up:** `opacity: 0; transform: translateY(8px)` to `opacity: 1; transform: none`
- **Scale in:** `opacity: 0; transform: scale(0.95)` to `opacity: 1; transform: none`
- **Slide from side:** `transform: translateX(-100%)` to `transform: none`
- **Stagger children:** delay each item by 50ms: `transition-delay: calc(var(--i) * 50ms)`

---

## Typography

### Numeric Data
- Use `font-variant-numeric: tabular-nums` for columns of numbers
- Use `font-variant-numeric: oldstyle-nums` for body text with numbers
- Align numeric columns to the right

### Text Wrapping
- Headlines: `text-wrap: balance` (distribute text evenly across lines)
- Body text: max-width 65-75 characters (`max-w-prose` or `max-w-[65ch]`)
- Do not let text run full viewport width
- Use `hyphens: auto` for justified text (if used)

### Typographic Details
- Use real quotation marks, not straight quotes
- Use en-dash for ranges (2020-2024)
- Use em-dash for breaks
- Use proper ellipsis character
- Use `<abbr title="...">` for abbreviations

---

## Images and Media

### Performance
- Always set explicit `width` and `height` attributes (prevents layout shift)
- Use `loading="lazy"` for below-fold images
- Use `fetchpriority="high"` for LCP (Largest Contentful Paint) image
- Use modern formats: WebP or AVIF with JPEG/PNG fallback
- Responsive images: `srcset` + `sizes` for multiple resolutions
- `<img>` for content images, CSS `background-image` for decorative only

### Optimization
- Compress all images before serving
- Serve appropriate sizes (do not serve 4000px images in 400px containers)
- Use CDN for image delivery when possible
- SVG for icons and logos (vector, infinitely scalable)
- Avoid large unoptimized screenshots or photos

### Accessibility
- Meaningful images: descriptive `alt` text (what the image conveys)
- Decorative images: `alt=""` (empty alt, not missing alt)
- Complex images (charts, diagrams): `alt` + longer description or `aria-describedby`
- Video: captions and transcript

---

## Performance

### Critical Rendering
- Inline critical CSS or use `<link rel="preload">`
- `<link rel="preconnect">` for external resources (fonts, CDNs)
- Font display: `font-display: swap` (show fallback font immediately)
- Defer non-critical JS: `<script defer>` or `<script type="module">`

### Lists and Data
- Virtualize lists with 50+ items (use react-virtual, tanstack-virtual, etc.)
- Paginate or infinite-scroll large datasets
- Skeleton loaders for async content (not spinners)
- Optimistic UI updates where possible

### Bundle Size
- Tree-shake imports: `import { X } from 'lib'` not `import * as lib from 'lib'`
- Lazy load routes/pages (code splitting)
- Analyze bundle with webpack-bundle-analyzer or similar
- Watch for large dependencies (moment.js -> date-fns, lodash -> lodash-es)

### Loading States
- Show skeleton/placeholder immediately (not blank screen)
- Progress indicators for operations > 1 second
- Optimistic updates: show expected result before server confirms
- Error states with retry action

---

## Dark Mode

### Implementation
```html
<html data-theme="dark">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

### Color Rules
- Use CSS custom properties for ALL colors (no hardcoded hex in components)
- Dark mode is NOT just inverting colors - design it intentionally
- Reduce surface contrast in dark mode (do not use pure black #000)
- Use lighter font weights in dark mode (light text on dark renders thicker)
- Shadows are nearly invisible in dark mode - use borders or subtle glows instead
- Test scrollbar, selection, and input colors in dark mode

### Form Elements in Dark Mode
```css
.dark input, .dark select, .dark textarea {
  background-color: var(--surface-alt);
  color: var(--text);
  border-color: var(--border);
}

.dark ::selection {
  background-color: var(--primary);
  color: white;
}
```

### Dark Mode Checklist
- All text readable (4.5:1 minimum contrast)
- No pure white (#fff) text on dark backgrounds (use #f5f5f5 or similar)
- No pure black (#000) backgrounds (use #0f0f0f or similar)
- Form inputs, selects, textareas styled explicitly
- Scrollbar styled or native
- Selection highlight visible
- Images do not blind users (consider reducing brightness)
- Charts and data viz colors work in both modes

---

## Responsive Design

### Breakpoints (Tailwind defaults)
```
sm: 640px    - Mobile landscape
md: 768px    - Tablet portrait
lg: 1024px   - Tablet landscape / small desktop
xl: 1280px   - Desktop
2xl: 1536px  - Large desktop
```

### Mobile-First Rules
- Design mobile first, enhance for larger screens
- Touch targets: minimum 44x44px
- No horizontal scroll on any viewport
- Stack columns on mobile (flex-col then md:flex-row)
- Hide non-essential elements on mobile (use hidden md:block)
- Test at: 375px, 768px, 1024px, 1440px

### Responsive Typography
- Base font: 16px minimum (never smaller on mobile)
- Scale headings down on mobile
- Use `clamp()` for fluid typography: `font-size: clamp(1.5rem, 3vw, 2.5rem)`
- Reduce padding/margins proportionally on mobile
