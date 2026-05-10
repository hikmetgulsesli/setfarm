import os from "node:os";
import path from "node:path";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ClaimContext } from "../types.js";

const DEFAULT_STACK = "vite-react";

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
  if (/\bnext(js)?\b|seo|ssr/.test(lower)) return "nextjs";
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

export function inferUiLanguage(task: string): string {
  const normalized = transliterate(task).toLowerCase();
  if (/\b(english|ingilizce)\b/.test(normalized)) return "English";
  if (/\b(turkish|turkce)\b/.test(normalized)) return "Turkish";
  return "English";
}

function taskBullets(task: string): string[] {
  const bullets = task
    .split(/\n+/)
    .map(line => line.trim().replace(/^[-*]\s*/, ""))
    .filter(line => line && !/^(?:Project|Proje)\s*:/i.test(line) && !/^Platform\s*:/i.test(line))
    .slice(0, 12);
  return bullets.length > 0 ? bullets : ["Deliver a working product surface where the first screen is the actual application workflow."];
}

function screensForTask(task: string): Array<{ name: string; type: string; description: string }> {
  const lower = task.toLowerCase();
  if (/lead|crm|pipeline/.test(lower)) {
    return [
      { name: "Leads", type: "dashboard", description: "Lead list, search, filtering, quick status actions, and new lead entry." },
      { name: "Lead Create Edit", type: "form", description: "Name, company, source, estimated value, status, next action, and date fields." },
      { name: "Pipeline", type: "board", description: "Status columns with lead counts and estimated value totals." },
      { name: "Insights", type: "dashboard", description: "Total leads, won/lost counts, weekly follow-up, and conversion metrics." },
      { name: "Settings", type: "settings", description: "Density, currency, reminder, and persistence preferences." },
      { name: "Profile Panel", type: "panel", description: "User name, timezone, notification toggles, close, and sign-out actions." },
      { name: "Storage Error State", type: "error", description: "Save error, retry, and local data reset actions." },
      { name: "Empty State", type: "empty", description: "No-lead explanation with a primary create-lead call to action." },
    ];
  }
  if (/game|oyun/.test(lower)) {
    return [
      { name: "Playfield", type: "play", description: "Playable main scene, score, and primary controls." },
      { name: "Main Menu", type: "menu", description: "Start game, difficulty, settings, and resume actions." },
      { name: "Results", type: "result", description: "Win/loss outcome, replay, and return-to-menu actions." },
      { name: "Settings", type: "settings", description: "Audio, difficulty, and control preferences." },
      { name: "Help", type: "help", description: "Short rules plus keyboard and touch explanations." },
    ];
  }
  return [
    { name: "Dashboard", type: "dashboard", description: "Primary data, filters, and the main product actions." },
    { name: "Create Edit", type: "form", description: "CRUD form with validation, cancel, and save behavior." },
    { name: "Detail", type: "detail", description: "Selected record summary with secondary actions." },
    { name: "Insights", type: "insights", description: "Useful summary metrics for the user." },
    { name: "Settings", type: "settings", description: "Preferences and visible state-changing controls." },
    { name: "Profile", type: "panel", description: "Account details, toggles, and close behavior." },
    { name: "Error State", type: "error", description: "Retry and clear actions for storage or runtime errors." },
    { name: "Empty State", type: "empty", description: "No-data state that guides the user to the first action." },
  ];
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
  const repo = path.join(os.homedir(), "projects", slug);
  const branch = `feature-${slug}`.slice(0, 80).replace(/-+$/g, "");
  const bullets = taskBullets(task);
  const screens = screensForTask(task);
  const screenRows = screens
    .map((screen, idx) => `| ${idx + 1} | ${screen.name} | ${screen.type} | ${screen.description} |`)
    .join("\n");
  const requirementRows = bullets.map((line, idx) => `- R${idx + 1}: ${line}`).join("\n");

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
    "- Provide a working first-load experience with populated, empty, loading, and error states.",
    "- Ensure every visible button and icon button triggers a real route, state change, panel, modal, or form behavior.",
    "- Avoid text overflow, incoherent overlap, dead controls, and broken back navigation on mobile and desktop.",
    "- Persist data through localStorage or the chosen data layer with visible error, retry, and reset behavior.",
    "- Expose deterministic state so smoke, final-test, and deploy gates can verify the application surface.",
    "",
    "## Technical Decisions",
    `- ${platformLineForStack(stack)}`,
    "- Styling: Tailwind CSS or plain CSS modules with a restrained product-tool visual system.",
    "- State: React state plus reducer/context; avoid an extra global-state library for small apps.",
    `- Storage: ${dbRequired === "none" ? "localStorage with visible retry and clear actions for persistence failures" : dbRequired}.`,
    "- Icons: Lucide React; do not use emoji as controls.",
    "- Test surface: expose state, active screen, errors, counters, and active panel under window.app.",
    "",
    "## Functional Requirements",
    requirementRows,
    "- Forms provide required-field validation and visible error messages.",
    "- Filtering, search, create, edit, delete, profile, settings, retry, and clear actions produce visible state changes in smoke tests.",
    "- Product controls must not use data-smoke-ignore; intentionally unavailable controls are disabled or aria-disabled.",
    "",
    "## Data Model",
    "- Entity fields are defined as TypeScript types that match the task domain.",
    "- Every persisted record includes id, createdAt, and updatedAt.",
    "- Global preferences such as settings and profile data are separated from domain entity state.",
    "- Storage schema is versioned; corrupt JSON shows a visible error state instead of silently resetting.",
    "",
    "## UI/UX Requirements",
    `- User-facing language: ${uiLanguage}.`,
    "- Aesthetic: corporate/minimal, quiet, scannable, and appropriate for repeated product use.",
    "- Palette: Primary #2563EB, Secondary #475569, Background #F8FAFC, Surface #FFFFFF, Text #0F172A, Border #E2E8F0, Success #16A34A, Error #DC2626, Warning #D97706.",
    "- Typography: Inter or system sans; compact panels use small but readable headings.",
    "- Components: cards at 8px radius or less, clear focus rings, and 44x44px touch targets.",
    "- The profile/account icon must open a panel, drawer, or page with close/back behavior.",
    "",
    "## Non-Functional",
    "- Performance: target first load under 2s and client state transitions under 100ms.",
    "- Accessibility: WCAG 2.1 AA, keyboard navigation, aria-labels, focus states, and sufficient contrast.",
    "- Responsive: support 320px mobile widths through desktop with stacking, grid, or scrollable columns.",
    "- Error handling: storage and form errors are visible, retryable, and clearable.",
    "",
    "## Project Structure",
    projectStructureForStack(stack),
    "",
    "## Window State",
    "window.app = { state, screen, lastError, storageStatus, itemCount, activePanel } exposes the main dogfood and test state.",
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
