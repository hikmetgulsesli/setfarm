# Design System Document

## 1. Overview: The Obsidian Loom

This design system gives calendar and task surfaces a high-end editorial feel. The interface should feel like a premium physical planner translated into a dark digital product: layered, calm, and precise.

Use geometric headings, functional body copy, asymmetric spacing, and tonal surfaces instead of heavy borders.

## 2. Colors

- `surface-dim`: `#131313`
- `primary`: `#c0c1ff`
- `surface-container`: `#201f1f`
- `surface-container-highest`: `#353534`
- `error`: `#ffb4ab`

Do not use 1px solid borders to define calendar grids or section structure. Prefer background shifts and negative space.

Floating elements may use semi-transparent surfaces, `backdrop-filter: blur(20px)`, and a subtle `primary` to `primary-container` gradient for primary actions.

## 3. Typography

- Display: Space Grotesk, 3.5rem, bold
- Headline: Space Grotesk, 1.5rem, medium
- Title: DM Sans, 1.125rem, semi-bold
- Body: DM Sans, 0.875rem, regular
- Label: DM Sans, 0.6875rem, uppercase

All agent-facing instructions must be English. Visible product copy should follow the explicit language requirement from the product task, if one exists.

## 4. Elevation

Height is indicated by color brightness, not heavy drop shadows.

- Nested cards use a darker or lighter surface token than their parent.
- Floating modals may use soft ambient shadows.
- If separation is required for accessibility, use `outline-variant` at low opacity.

## 5. Components

### Calendar Grid

Avoid grid lines. Each day cell is defined by spacing and content. Mark today with a `primary-fixed` circle behind the date number.

### Buttons

- Primary: `0.5rem` radius, gradient fill, title typography.
- Secondary: transparent surface, low-opacity ghost border, title typography.

### Event Cards

Avoid dividers. Use a `4px` vertical accent bar to categorize event types.

### Input Fields

Use `surface-container-high` as the field background. Active state uses a bottom-only border in `primary`.

### Navigation

Use a compact vertical rail with icons and clear active state. Expanded labels use title typography.

## 6. Rules

- Use asymmetrical margins where it improves editorial rhythm.
- Use surface shifts for hover and active states.
- Do not use pure black.
- Do not use fully opaque borders.
- Do not crowd dense grids; collapse overflow into a concise count label.
- Do not use generic link blue; use the defined primary accent.
