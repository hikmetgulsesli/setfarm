import type { LibraryPack, LibraryPackId } from "./types.js";

const WEB_REACT_STACKS = ["nextjs-web-app", "vite-react-web-app", "browser-game-canvas"] as const;
const WEB_STACKS = ["nextjs-web-app", "vite-react-web-app", "static-html-site", "browser-game-canvas"] as const;

export const LIBRARY_PACKS: Record<LibraryPackId, LibraryPack> = {
  "ui-shadcn-radix": {
    id: "ui-shadcn-radix",
    label: "shadcn/ui and Radix UI",
    appliesToStacks: ["nextjs-web-app", "vite-react-web-app"],
    whenToUse: "Use for React application surfaces that need accessible dialogs, menus, tabs, popovers, sidebars, forms, tables, or a durable component system.",
    intentSignals: ["dashboard", "admin", "saas", "settings", "table", "modal", "dialog", "tabs", "sidebar", "command palette"],
    designSignals: ["dialog", "popover", "tabs", "menu", "sidebar", "table", "form field", "data grid"],
    installNotes: [
      "Use only when the project setup already includes the library or setup explicitly owns adding dependencies.",
      "Implement agents must not run dependency installs during the implement step.",
    ],
    constraints: [
      "Library defaults never override Stitch, design tokens, screen maps, or DESIGN_DOM.",
      "Keep generated components in the stack-appropriate component directory.",
      "Prefer accessible Radix primitives for complex interactive controls.",
    ],
    prompt: [
      "Use shadcn/ui or Radix UI patterns only for selected React UI primitives.",
      "Match Stitch layout, spacing, tokens, and component intent before applying library defaults.",
      "Do not add decorative component wrappers that are not present in the design contract.",
    ].join("\n"),
  },
  "icons-lucide": {
    id: "icons-lucide",
    label: "Lucide Icons",
    appliesToStacks: [...WEB_REACT_STACKS],
    whenToUse: "Use when the project needs interface icons for navigation, toolbar actions, status indicators, or icon-only buttons.",
    intentSignals: ["icon", "icons", "toolbar", "navigation", "sidebar", "action button", "status"],
    designSignals: ["icon", "toolbar", "nav item", "status", "button icon"],
    installNotes: [
      "Use existing lucide-react dependency when present.",
      "If missing during implement, report the missing dependency instead of installing it.",
    ],
    constraints: [
      "Every icon-only button needs an accessible name.",
      "Icon choice must match DESIGN_DOM semantics even when the library uses a different component name.",
    ],
    prompt: [
      "Use Lucide icons for interface controls when selected and available.",
      "Do not use icon fonts for Material Symbols or generic glyph text.",
      "Keep icon labels, aria-labels, and visible behavior aligned with the DOM contract.",
    ].join("\n"),
  },
  "motion-animation": {
    id: "motion-animation",
    label: "Motion and Animation",
    appliesToStacks: [...WEB_REACT_STACKS],
    whenToUse: "Use for purposeful transitions, animated state changes, game feel, or interaction feedback when requested by PRD or design.",
    intentSignals: ["animation", "animated", "motion", "transition", "micro-interaction", "smooth", "gesture"],
    designSignals: ["animation", "motion", "transition", "hover", "gesture"],
    installNotes: [
      "Use existing animation dependencies when present.",
      "Prefer CSS transitions for simple visual feedback.",
    ],
    constraints: [
      "Animation must not hide missing functionality.",
      "Respect reduced-motion expectations where practical.",
      "Do not add heavy animation libraries for static pages or simple dashboards.",
    ],
    prompt: [
      "Use motion only where it clarifies state, feedback, or gameplay.",
      "Keep animation subordinate to the design contract and accessibility.",
      "Prefer lightweight CSS when library support is not already available.",
    ].join("\n"),
  },
  "creative-canvas": {
    id: "creative-canvas",
    label: "Creative Canvas",
    appliesToStacks: ["vite-react-web-app", "static-html-site", "browser-game-canvas"],
    whenToUse: "Use for browser games, custom canvas scenes, generative visuals, particles, sprites, and interactive visual systems.",
    intentSignals: ["game", "arcade", "canvas", "sprite", "particle", "physics", "playable", "level", "score"],
    designSignals: ["canvas", "game board", "sprite", "scene", "playfield"],
    installNotes: [
      "Use Canvas 2D for simple games and visualizations unless the PRD requires a specialized engine.",
      "Use an existing rendering dependency only when already configured or setup owns it.",
    ],
    constraints: [
      "The scene must be nonblank and verifiable in Playwright screenshots.",
      "Controls must affect live state or be hidden/disabled when inactive.",
      "Expose deterministic state for smoke tests when the project contract requires it.",
    ],
    prompt: [
      "Use canvas or scene-native code for the primary interactive visual surface.",
      "Implement real state transitions, input handling, scoring/progress, restart, and terminal states when required.",
      "Keep visual assets and gameplay behavior testable without relying on decorative placeholders.",
    ].join("\n"),
  },
  "forms-validation": {
    id: "forms-validation",
    label: "Forms and Validation",
    appliesToStacks: ["nextjs-web-app", "vite-react-web-app", "python-web"],
    whenToUse: "Use when the project needs structured forms, validation, submission state, errors, filters, search, settings, onboarding, or data entry.",
    intentSignals: ["form", "forms", "validation", "login", "signup", "checkout", "settings", "filter", "search", "data entry"],
    designSignals: ["input", "select", "textarea", "checkbox", "radio", "validation", "error message"],
    installNotes: [
      "Use existing form libraries only when already present.",
      "Plain controlled inputs are acceptable when the project does not already include a form library.",
    ],
    constraints: [
      "Required fields must have visible labels and usable validation feedback.",
      "Submit buttons need real submit or save behavior, not inert click handlers.",
    ],
    prompt: [
      "Implement forms with real validation, disabled/loading/error states, and persistent results when required.",
      "Keep form behavior aligned with PRD acceptance criteria and DESIGN_DOM controls.",
      "Do not add a form library during implement if the dependency is missing.",
    ].join("\n"),
  },
  "charts-data-viz": {
    id: "charts-data-viz",
    label: "Charts and Data Visualization",
    appliesToStacks: ["nextjs-web-app", "vite-react-web-app", "python-web"],
    whenToUse: "Use for dashboards, analytics, reports, KPI cards, charts, graphs, timelines, and comparative data views.",
    intentSignals: ["chart", "charts", "graph", "analytics", "metrics", "kpi", "report", "dashboard", "timeline", "data visualization"],
    designSignals: ["chart", "graph", "metric", "kpi", "legend", "axis", "sparkline"],
    installNotes: [
      "Use existing chart dependencies when present.",
      "Fallback to semantic HTML, SVG, or Canvas when adding dependencies is not owned by setup.",
    ],
    constraints: [
      "Charts must communicate real values from the project state or fixtures.",
      "Legends, labels, and empty states must remain readable on mobile and desktop.",
    ],
    prompt: [
      "Use chart or visualization patterns only when the PRD/design requires data comparison or metrics.",
      "Keep data labels, legends, and responsive sizing readable.",
      "Do not add decorative charts that are not backed by project data or acceptance criteria.",
    ].join("\n"),
  },
};

export function listLibraryPacks(): LibraryPack[] {
  return Object.values(LIBRARY_PACKS);
}

export function getLibraryPack(id: LibraryPackId): LibraryPack {
  return LIBRARY_PACKS[id];
}

export function isWebStack(id: string | undefined): boolean {
  return WEB_STACKS.includes(id as (typeof WEB_STACKS)[number]);
}
