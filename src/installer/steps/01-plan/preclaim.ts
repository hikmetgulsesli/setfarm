import os from "node:os";
import path from "node:path";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ClaimContext } from "../types.js";

const DEFAULT_STACK = "vite-react";

type ProjectKind = "game" | "product";

function transliterate(input: string): string {
  return input
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Şş]/g, "s")
    .replace(/[İIı]/g, "i")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c");
}

export function slugify(input: string): string {
  const slug = transliterate(input)
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "setfarm-project";
}

function extractProjectName(task: string): string {
  const projectLine = task.match(/(?:^|\n)\s*(?:Project|Proje)\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (projectLine) {
    const inlineTaskStart = projectLine.match(
      /^(.+?)\s+(?:build|create|make|develop|implement|design|write|add|fix|yap|olustur|oluştur|kur|gelistir|geliştir)\b/i,
    );
    return (inlineTaskStart?.[1] || projectLine).trim();
  }
  const firstLine = task.split(/\n+/).map(line => line.trim()).find(Boolean) || "setfarm-project";
  return firstLine.replace(/^(?:Project|Proje)\s*:\s*/i, "").slice(0, 80);
}

function humanizeProjectName(input: string): string {
  const cleaned = String(input || "")
    .replace(/^(?:Project|Proje)\s*:\s*/i, "")
    .replace(/\s+(?:build|create|make|develop|implement|design|write|add|fix|yap|olustur|oluştur|kur|gelistir|geliştir)\b[\s\S]*$/i, "")
    .replace(/\s+(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();

  if (!cleaned) return "Setfarm Project";

  const normalized = transliterate(cleaned);
  const hasSlugShape = /[-_]/.test(normalized) || /^[a-z0-9]+$/.test(normalized);
  if (!hasSlugShape) {
    return cleaned.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  const words = normalized
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word && !/^\d{4,8}$/.test(word));

  if (words.length === 0) return cleaned.slice(0, 80);

  const acronyms = new Set(["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa", "iot"]);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      if (lower === "rootfix") return "Root Fix";
      if (lower === "scopefix") return "Scope Fix";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .slice(0, 80);
}

function inferTechStack(task: string): string {
  const lower = task.toLowerCase();
  if (/\breact native\b|mobil uygulama|mobile app/.test(lower)) return "react-native";
  if (/\bnext\s*(?:\.?js|js)\b|\bnextjs\b|\bseo\b|\bssr\b/.test(lower)) return "nextjs";
  if (/\bnode\b|\bexpress\b|api only|sadece api/.test(lower)) return "node-express";
  if (/\bvanilla\b|frameworksiz|plain ts/.test(lower)) return "vanilla-ts";
  return DEFAULT_STACK;
}

function inferDbRequired(task: string): string {
  const lower = task.toLowerCase();
  if (/\bsqlite\b/.test(lower)) return "sqlite";
  if (/\bpostgres\b|\bpostgresql\b|\bauth\b|giris|login|sign in|account|create account|hesap olustur|user data|multi user|shared data|database/.test(lower)) return "postgres";
  return "none";
}

function inferProjectKind(task: string): ProjectKind {
  const lower = transliterate(task).toLowerCase();
  if (/\b(game|oyun|puzzle|arcade|score|level|pause|resume|restart|keyboard controls?|playfield)\b/.test(lower)) {
    return "game";
  }
  return "product";
}

export function inferUiLanguage(task: string): string {
  const normalized = transliterate(task).toLowerCase();
  if (/\b(english|ingilizce)\b/.test(normalized)) return "English";
  if (/\b(turkish|turkce)\b/.test(normalized)) return "Turkish";
  return "English";
}

function taskBullets(task: string): string[] {
  const normalizeTaskLine = (line: string): string => {
    let current = line.trim().replace(/^[-*]\s*/, "");
    if (/^Platform\s*:/i.test(current)) return "";
    if (/^(?:Project|Proje)\s*:/i.test(current)) {
      current = current.replace(/^(?:Project|Proje)\s*:\s*/i, "").trim();
      const verb = current.match(/\b(build|create|make|develop|implement|design|write|add|fix|yap|olustur|oluştur|kur|gelistir|geliştir)\b[\s\S]*$/i)?.[0];
      if (verb) return verb.trim();
      return "";
    }
    return current;
  };

  const bullets = task
    .split(/\n+/)
    .map(normalizeTaskLine)
    .filter(Boolean)
    .slice(0, 12);
  return bullets.length > 0 ? bullets : ["Deliver a working product surface where the first screen is the actual application workflow."];
}

function screensForTask(task: string): Array<{ name: string; type: string; description: string }> {
  const lower = task.toLowerCase();
  if (/game|oyun/.test(lower)) {
    const screens = [
      { name: "Game Board", type: "play", description: "Playable main scene with the playfield, user-controlled entities, score/progress, status, and primary controls." },
      { name: "Main Menu", type: "menu", description: "Start, resume, restart, and any task-requested mode or difficulty actions." },
      { name: "Pause Overlay", type: "overlay", description: "Paused state with resume, restart, and return-to-menu actions." },
      { name: "Game Over", type: "result", description: "Final score/progress summary, replay, and return-to-menu actions." },
    ];
    if (/\b(level complete|victory|win|complete state|bolum|bölüm)\b/i.test(lower)) {
      screens.push({ name: "Progress Complete", type: "result", description: "Task-requested win, level-complete, or progress-complete state with continue/restart/menu actions." });
    }
    if (/\b(keyboard|touch|controls?|help|rules|yardim|yardım|how to)\b/i.test(lower)) {
      screens.push({ name: "Controls Help", type: "help", description: "Task-requested keyboard/touch controls and concise rules." });
    }
    if (/\b(settings?|options?|preferences?|difficulty|audio|speed|ayar|tercih)\b/i.test(lower)) {
      screens.push({ name: "Game Options", type: "settings", description: "Task-requested settings such as audio, difficulty, speed, controls, or preferences." });
    }
    return screens;
  }
  const screens = [
    { name: "Dashboard", type: "dashboard", description: "Primary data, filters, and the main product actions." },
    { name: "Create Edit", type: "form", description: "CRUD form with validation, cancel, and save behavior." },
    { name: "Detail", type: "detail", description: "Selected record summary with secondary actions." },
    { name: "Insights", type: "insights", description: "Useful summary metrics for the user." },
    { name: "Settings", type: "settings", description: "Preferences and visible state-changing controls." },
    { name: "Error State", type: "error", description: "Retry and clear actions for storage or runtime errors." },
    { name: "Empty State", type: "empty", description: "No-data state that guides the user to the first action." },
  ];
  if (/\b(profile|account|user|auth|login|sign in|profil|hesap|kullanici|kullanıcı)\b/i.test(lower)) {
    screens.push({ name: "Profile", type: "panel", description: "Task-requested account details, toggles, and close/back behavior." });
  }
  return screens;
}

function platformLineForStack(stack: string): string {
  if (stack === "nextjs") return "Framework: Next.js, TypeScript, with explicit client/server route boundaries.";
  if (stack === "react-native") return "Framework: React Native and TypeScript with mobile UI patterns.";
  if (stack === "node-express") return "Runtime: Node.js + Express with API-focused modules.";
  if (stack === "vanilla-ts") return "Runtime: Vanilla TypeScript, minimal bundling.";
  return "Framework: React 18 + Vite + TypeScript.";
}

function projectStructureForStack(stack: string): string {
  if (stack === "nextjs") {
    return [
      "Use the Next.js app router structure: src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/components, src/screens, src/hooks, src/utils, and src/types.",
      "Do not introduce a Vite-style src/main.tsx entrypoint. Use src/App.tsx only as an optional client component imported by src/app/page.tsx.",
      "Client interactivity belongs behind 'use client' boundaries; server files must not use browser APIs directly.",
      "Stitch HTML screens are translated into the app/page workflow after setup/build; no generated design screen should remain unused.",
    ].join("\n");
  }
  if (stack === "react-native") {
    return "Use src/components, src/screens, src/hooks, src/utils, src/types, and a mobile app entry. Keep navigation and native state boundaries explicit.";
  }
  if (stack === "node-express") {
    return "Use src/routes, src/controllers, src/services, src/types, and src/server.ts. Keep API handlers separate from business logic.";
  }
  return "Use src/components, src/screens, src/hooks, src/utils, src/types, src/App.tsx, and src/main.tsx. Stitch HTML screens are translated into the App workflow after setup/build; no generated design screen should remain unused.";
}

export function buildAutoPlanOutput(task: string): string {
  const rawProjectName = extractProjectName(task);
  const projectName = humanizeProjectName(rawProjectName);
  const slug = slugify(rawProjectName);
  const stack = inferTechStack(task);
  const dbRequired = inferDbRequired(task);
  const uiLanguage = inferUiLanguage(task);
  const projectKind = inferProjectKind(task);
  const repo = path.join(os.homedir(), "projects", slug);
  const branch = `feature-${slug}`.slice(0, 80).replace(/-+$/g, "");
  const bullets = taskBullets(task);
  const screens = screensForTask(task);
  const screenRows = screens
    .map((screen, idx) => `| ${idx + 1} | ${screen.name} | ${screen.type} | ${screen.description} |`)
    .join("\n");
  const requirementRows = bullets.map((line, idx) => `- R${idx + 1}: ${line}`).join("\n");

  const goals = projectKind === "game"
    ? [
      "- Provide a working first-load playable game surface, not a landing page or generic dashboard.",
      "- Ensure Start, Pause, Resume, Restart, keyboard/touch controls, and game-over actions visibly change the game state.",
      "- Keep gameplay state single-sourced so score/progress, playfield entities, status/HUD, pause, and game-over UI cannot drift.",
      "- Avoid text overflow, incoherent overlap, dead controls, and broken mobile controls on desktop and mobile.",
      "- Expose deterministic game state so smoke, final-test, and deploy gates can verify actual post-click and post-keyboard behavior.",
    ]
    : [
      "- Provide a working first-load experience with populated, empty, loading, and error states.",
      "- Ensure every visible button and icon button triggers a real route, state change, panel, modal, or form behavior.",
      "- Avoid text overflow, incoherent overlap, dead controls, and broken back navigation on mobile and desktop.",
      "- Persist data through localStorage or the chosen data layer with visible error, retry, and reset behavior.",
      "- Expose deterministic state so smoke, final-test, and deploy gates can verify the application surface.",
    ];

  const functionalRequirements = projectKind === "game"
    ? [
      requirementRows,
      "- Gameplay controls provide visible post-action state changes for click/touch and keyboard input.",
      "- Pause/resume freezes and restarts the game loop without spawning duplicate timers.",
      "- Restart resets the playfield, user-controlled entities, score/progress, level/difficulty where present, and game-over state consistently.",
      "- Product controls must not use data-smoke-ignore; intentionally unavailable controls are disabled or aria-disabled.",
    ]
    : [
      requirementRows,
      "- Forms provide required-field validation and visible error messages.",
      "- Filtering, search, create, edit, delete, profile, settings, retry, and clear actions produce visible state changes in smoke tests.",
      "- Product controls must not use data-smoke-ignore; intentionally unavailable controls are disabled or aria-disabled.",
    ];

  const dataModel = projectKind === "game"
    ? [
      "- Game state includes playfield entities, user input state, score/progress, level/difficulty where present, status, paused, and gameOver fields.",
      "- HUD/status panels derive from the same gameplay state used by the simulation; do not keep divergent display-only state.",
      "- Timers and repeated input use stable callbacks/effects so interval setup does not thrash every frame.",
      "- Persistence is limited to high score and explicit preferences unless the task asks for saved games.",
      "- Corrupt persisted high-score/preferences data shows visible recovery feedback instead of silently resetting when persistence is used.",
    ]
    : [
      "- Entity fields are defined as TypeScript types that match the task domain.",
      "- Every persisted record includes id, createdAt, and updatedAt.",
      "- Global preferences such as settings and profile data are separated from domain entity state.",
      "- Storage schema is versioned; corrupt JSON shows a visible error state instead of silently resetting.",
    ];

  const uiRequirements = projectKind === "game"
    ? [
      `- User-facing language: ${uiLanguage}.`,
      "- Aesthetic: focused game UI with a clear playfield, readable score/status panels, and controls that do not compete with gameplay.",
      "- Palette: high-contrast game entities, readable HUD colors, Background #0F172A, Surface #111827, Text #F8FAFC, Border #334155, Success #22C55E, Error #F43F5E, Warning #F59E0B.",
      "- Typography: system sans; compact status labels use small but readable headings.",
      "- Components: stable board dimensions, visible focus rings, and 44x44px touch targets for mobile controls.",
      "- Do not add profile/account panels unless the user explicitly asks for account features.",
    ]
    : [
      `- User-facing language: ${uiLanguage}.`,
      "- Aesthetic: corporate/minimal, quiet, scannable, and appropriate for repeated product use.",
      "- Palette: Primary #2563EB, Secondary #475569, Background #F8FAFC, Surface #FFFFFF, Text #0F172A, Border #E2E8F0, Success #16A34A, Error #DC2626, Warning #D97706.",
      "- Typography: Inter or system sans; compact panels use small but readable headings.",
      "- Components: cards at 8px radius or less, clear focus rings, and 44x44px touch targets.",
      "- The profile/account icon must open a panel, drawer, or page with close/back behavior.",
    ];

  const nonFunctional = projectKind === "game"
    ? [
      "- Performance: target first load under 2s and stable frame/input handling without duplicate intervals.",
      "- Accessibility: WCAG 2.1 AA, keyboard controls, aria-labels, focus states, and sufficient contrast.",
      "- Responsive: support 320px mobile widths through desktop with a stable board aspect ratio and non-overlapping controls.",
      "- Error handling: storage/preferences errors are visible, retryable, and clearable when persistence is used.",
    ]
    : [
      "- Performance: target first load under 2s and client state transitions under 100ms.",
      "- Accessibility: WCAG 2.1 AA, keyboard navigation, aria-labels, focus states, and sufficient contrast.",
      "- Responsive: support 320px mobile widths through desktop with stacking, grid, or scrollable columns.",
      "- Error handling: storage and form errors are visible, retryable, and clearable.",
    ];

  const windowState = projectKind === "game"
    ? "window.app = { state: { screen, status, score, level, progress, entities, paused, gameOver, storageStatus, lastError }, dispatch } exposes current gameplay and test state using fields that match the requested game."
    : "window.app = { state, screen, lastError, storageStatus, itemCount, activePanel } exposes the main dogfood and test state.";

  return [
    "STATUS: done",
    `PROJECT_SLUG: ${slug}`,
    `PROJECT_DISPLAY_NAME: ${projectName}`,
    `REPO: ${repo}`,
    `BRANCH: ${branch}`,
    `TECH_STACK: ${stack}`,
    `UI_LANGUAGE: ${uiLanguage}`,
    "PRD:",
    `# ${projectName} PRD`,
    "",
    "## Overview",
    `${projectName} turns the user's request into a directly usable application. The first screen is not a landing page; it is the real workflow surface where the user can inspect data, take actions, and recover from empty or error states. User-facing copy language: ${uiLanguage}. Pipeline metadata, story titles, component identifiers, and technical reports remain English.`,
    "",
    "## Goals",
    ...goals,
    "",
    "## Technical Decisions",
    `- ${platformLineForStack(stack)}`,
    projectKind === "game"
      ? "- Styling: Tailwind CSS or plain CSS modules with stable board sizing, clear status panels, and responsive controls."
      : "- Styling: Tailwind CSS or plain CSS modules with a restrained product-tool visual system.",
    "- State: React state plus reducer/context; avoid an extra global-state library for small apps.",
    `- Storage: ${projectKind === "game" && dbRequired === "none" ? "localStorage only for high score/preferences when used, with visible recovery for corrupt data" : dbRequired === "none" ? "localStorage with visible retry and clear actions for persistence failures" : dbRequired}.`,
    "- Icons: Lucide React; do not use emoji as controls.",
    projectKind === "game"
      ? "- Test surface: expose score/progress, level/difficulty where present, status, paused/gameOver, gameplay entities, storageStatus, and lastError under window.app."
      : "- Test surface: expose state, active screen, errors, counters, and active panel under window.app.",
    "",
    "## Functional Requirements",
    ...functionalRequirements,
    "",
    "## Data Model",
    ...dataModel,
    "",
    "## UI/UX Requirements",
    ...uiRequirements,
    "",
    "## Non-Functional",
    ...nonFunctional,
    "",
    "## Project Structure",
    projectStructureForStack(stack),
    "",
    "## Window State",
    windowState,
    "",
    "## Screens",
    "| # | Screen Name | Type | Description |",
    "|---|-----------|-----|----------|",
    screenRows,
    `PRD_SCREEN_COUNT: ${screens.length}`,
    `DB_REQUIRED: ${dbRequired}`,
  ].join("\n");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (process.env.SETFARM_DISABLE_AUTO_PLAN === "1") return;

  const output = buildAutoPlanOutput(ctx.task || ctx.context["task"] || "");
  const step = await pgGet<{ id: string }>(
    "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
    [ctx.runId, ctx.stepId],
  );
  if (!step?.id) throw new Error(`plan preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, output);
  logger.info(`[module:plan preclaim] AUTO-COMPLETED plan without planner agent (${Buffer.byteLength(output, "utf-8")} bytes)`, {
    runId: ctx.runId,
    stepId: ctx.stepId,
  });
}
