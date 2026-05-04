# PLAN Step Rules

The PLAN output is the run's product contract: detailed PRD plus technical
decisions. A precise PRD reduces retries in design, stories, implementation,
verify, and QA.

## Required Output Fields

```
STATUS: done
REPO: $HOME/projects/<slug>
BRANCH: <branch-name>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
PRD:
<PRD body — at least 2000 characters, English, includes every section below>
PRD_SCREEN_COUNT: <number of rows in the Screens table, minimum 3>
DB_REQUIRED: <none|postgres|sqlite>
```

## Mandatory PRD Sections

### 1. Overview
- Summarize the product in 2-3 sentences.
- Define the target users.
- Define the user-facing language. If the task is Turkish and no other
  language is specified, use Turkish UI copy; otherwise follow the task.

### 2. Goals
- List 4-6 concrete product goals.
- Include measurable goals such as accessibility, responsive behavior, and
  loading performance.

### 3. Tech Stack Details
- Framework: React 18 / Next.js 14 / etc.
- Build: Vite / Webpack.
- Styling: Tailwind / CSS Modules.
- State: useState/useReducer / Zustand / Redux.
- Storage: localStorage / IndexedDB / Postgres.
- Routing: React Router / Next.js routing.

### 4. Functional Requirements
Use one subsection per feature. Include exact behavior, validation, and visible
state changes. Example:

```
4.1 Photo Upload
- Supported formats: JPG, PNG, WEBP, GIF
- Max size: 10 MB
- Required and optional fields
- Error messages shown to users
- Success-state behavior

4.2 Filtering
- Which fields can be filtered
- Default behavior
```

### 5. Data Model
- Entities: User, Photo, Category, etc.
- Fields and types for each entity.
- localStorage or database schema.

### 6. UI/UX Requirements

#### 6.1 Design System Selection (mandatory for frontend)
- **Aesthetic:** minimal | brutalist | luxury | editorial | industrial | organic | playful | corporate
- **Color Palette:** Primary, Secondary, Background, Surface, Text, Border, Success, Error, Warning hex values
- **Typography:** Heading font + Body font
- **Icon Library:** Lucide React or Heroicons (NEVER emoji)

#### 6.2 Spacing & Components
- Spacing scale: 4/8/16/24/32/48/64 px.
- Border radius values.
- Shadow definitions.
- Button, card, and form patterns.

### 7. Non-Functional Requirements

#### 7.1 Performance
- Initial load under 2 seconds.
- Page transitions under 100ms.
- Bundle size target.

#### 7.2 Accessibility (WCAG 2.1 AA)
- Full keyboard navigation.
- Screen reader support with ARIA labels.
- Contrast ratio >= 4.5:1 for text, >= 3:1 for large text.
- Focus states for every interactive element.
- Touch targets >= 44x44 px.

#### 7.3 Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- iOS Safari 14+, Android Chrome 90+
- Responsive: mobile 320px+ → desktop 1920px+

### 8. Project Structure

```
src/
├── components/      # Reusable components
├── screens/         # Screen/page components
├── hooks/           # Custom React hooks
├── utils/           # Helper functions
├── types/           # TypeScript types
├── App.tsx
└── main.tsx
```

### 9. Window State for Testing

```
window.app = {
  state: '<idle|loading|error|...>',
  // other important state fields
}
```

### 10. Screens (mandatory table)

```
| # | Screen Name | Type | Description |
|---|-----------|-----|----------|
| 1 | Dashboard | dashboard | KPI cards and recent activity |
| 2 | ...
```

Minimum 3 rows. Every row must be a unique screen. Include modals, empty
states, and error pages when they are product-relevant.

### Min Screen Counts
- Landing/static: 3-5
- Game (web/mobile): 5-8
- Dashboard/analytics: 8-15
- CRUD app: 10-15
- CRM/SaaS: 20-35

## TECH_STACK Selection

- `vite-react`: SPA, game, dashboard, utility, portfolio (default)
- `nextjs`: SSR/SEO, blog, e-commerce, multi-page content
- `vanilla-ts`: CLI, minimal web utility
- `node-express`: API-only, no UI
- `react-native`: Mobile

Use `vite-react` when unclear. If the task explicitly names a framework, use it.

## DB_REQUIRED

- `none`: Static, portfolio, game, local-storage app
- `postgres`: User data, CRUD, auth, shared persisted data
- `sqlite`: Only when explicitly requested

Use `none` when unclear.

## REPO and BRANCH

- REPO: `$HOME/projects/<slug>` — slug from task title, kebab-case, ASCII.
- BRANCH: `feature-<name>` or the project slug, kebab-case.

## User-Facing Language Rules

- Pipeline instructions, story titles, technical reports, and output fields are English.
- Visible application copy follows the user's requested language. For Turkish
  tasks, use Turkish-visible UI copy.
- Do not mix random English labels into a Turkish UI unless they are technical
  terms or brand names.

## Do Not

- Do not write user stories; the next step owns that.
- Do not write code.
- Do not use vague phrases such as "modern design" without concrete choices.
- Do not omit the color palette or accessibility section.
- Do not output fewer than 3 screens.
- Do not output a PRD shorter than 2000 characters.
