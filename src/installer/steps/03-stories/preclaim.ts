import fs from "node:fs";
import path from "node:path";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import {
  collectUiBehaviorRequirements,
  computePredictedScreenFiles,
  extractExplicitMaxStories,
  isPrdPseudoScreen,
  type UiBehaviorRequirement,
} from "./context.js";

type PredictedScreen = ReturnType<typeof computePredictedScreenFiles>[number];

interface StoryDraft {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  depends_on: string[];
  screens: string[];
  scope_files: string[];
  shared_files: string[];
  scope_description: string;
  file_skeletons: Record<string, string>;
}

interface StoryGroup {
  key: "primary" | "metrics" | "settings" | "support";
  title: string;
  description: string;
  screens: PredictedScreen[];
}

const APP_SCOPE_FILES = [
  "src/App.tsx",
  "src/App.css",
  "src/main.tsx",
  "src/index.css",
  "src/contexts/AppContext.tsx",
  "src/types/domain.ts",
  "src/hooks/useAppState.ts",
  "src/utils/storage.ts",
];

function compactText(text: string, fallback: string): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 180) : fallback;
}

function humanizeProjectLabel(input: string, fallback: string): string {
  const cleaned = String(input || "")
    .replace(/^(?:Proje|Project)\s*:\s*/i, "")
    .replace(/\s+(?:Build|Create|Make|Implement|Design|Write|Add|Fix|Yap|Olustur|Oluştur|Kur|Gelistir|Geliştir)\b[\s\S]*$/i, "")
    .replace(/\s+(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();

  if (!cleaned) return fallback;
  const hasSlugShape = /[-_]/.test(cleaned) || /^[a-z0-9]+$/.test(cleaned);
  if (!hasSlugShape) return compactText(cleaned, fallback);

  const words = cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word && !/^\d{4,8}$/.test(word));
  if (words.length === 0) return compactText(cleaned, fallback);

  const acronyms = new Set(["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa", "iot"]);
  return compactText(words.map((word) => {
    const lower = word.toLowerCase();
    if (acronyms.has(lower)) return lower.toUpperCase();
    if (lower === "rootfix") return "Root Fix";
    if (lower === "scopefix") return "Scope Fix";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" "), fallback);
}

function extractProjectLabel(text: string, fallback: string): string {
  const raw = String(text || "");
  const projectLine = raw.match(/(?:^|\n)\s*(?:Proje|Project)\s*:\s*([^\n]+)/i)?.[1]?.trim();
  const candidate = projectLine || raw.split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
  const cleaned = candidate
    .replace(/^(?:Proje|Project)\s*:\s*/i, "")
    .replace(/\s+(?:Build|Create|Make|Implement|Platform|React|Vite|TypeScript)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();
  return humanizeProjectLabel(cleaned, fallback);
}

function loadScreenMap(repo: string): any[] {
  const p = path.join(repo, "stitch", "SCREEN_MAP.json");
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.isArray(parsed) ? parsed.filter((screen: any) => !isPrdPseudoScreen(screen)) : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildAcceptanceCriteria(repo: string): string[] {
  const reqs = collectUiBehaviorRequirements(repo);
  const criteria = reqs.slice(0, 30).map((req) => {
    const trigger = [req.label, req.icon ? `icon ${req.icon}` : ""].filter(Boolean).join(" / ");
    return `${req.screenTitle}: ${req.kind} \"${trigger}\" must produce visible behavior: ${req.expectedBehavior}.`;
  });
  criteria.push("All visible active buttons/icons from Stitch screens have non-empty handlers or an explicit disabled/hidden state.");
  criteria.push("All generated screens are wired into the app shell and remain responsive on desktop and mobile.");
  criteria.push("Stateful interactions persist only when the PRD or DESIGN_DOM explicitly requires persistence; no unrelated demo flows are added.");
  return unique(criteria).slice(0, 40);
}

function behaviorCriterion(req: UiBehaviorRequirement): string {
  const trigger = [req.label, req.icon ? `icon ${req.icon}` : ""].filter(Boolean).join(" / ");
  return `${req.screenTitle}: ${req.kind} "${trigger}" must produce visible behavior: ${req.expectedBehavior}.`;
}

function buildAcceptanceCriteriaForScreens(repo: string, screenIds: string[], fallbackTitle: string): string[] {
  const screenSet = new Set(screenIds);
  const criteria = collectUiBehaviorRequirements(repo)
    .filter((req) => screenSet.has(req.screenId))
    .map(behaviorCriterion);

  criteria.push(`${fallbackTitle}: all visible active controls have non-empty handlers or an explicit disabled/hidden state.`);
  criteria.push(`${fallbackTitle}: screen state changes are visible in the DOM and remain responsive on desktop and mobile.`);
  criteria.push(`${fallbackTitle}: no product control uses data-smoke-ignore to bypass smoke checks.`);
  return unique(criteria);
}

export function buildSingleStoryScopeFiles(screenFiles: string[]): string[] {
  return unique([
    ...screenFiles,
    "src/App.tsx",
    "src/App.css",
    "src/main.tsx",
    "src/index.css",
    "src/contexts/AppContext.tsx",
  ]);
}

function screenBucket(screen: PredictedScreen): StoryGroup["key"] {
  const text = `${screen.screenId} ${screen.title} ${screen.filePath}`.toLowerCase();
  if (/ayar|setting|profil|profile|account|hesap|preference|tercih|user|kullanici/.test(text)) return "settings";
  if (/insight|istatistik|stat|metric|dashboard|rapor|report|pipeline|kanban|board|analiz/.test(text)) return "metrics";
  if (/hata|error|storage|bos|empty|fallback|support|yardim|help/.test(text)) return "support";
  return "primary";
}

function chooseScreenGroups(predicted: PredictedScreen[], maxStories: number | null): StoryGroup[] {
  const cap = maxStories && maxStories > 1 ? Math.max(1, Math.min(maxStories - 1, 4)) : 4;
  const groups: StoryGroup[] = [
    {
      key: "primary",
      title: "Primary workflow screens",
      description: "Main list/detail/form workflow screens and direct user actions.",
      screens: [],
    },
    {
      key: "metrics",
      title: "Pipeline, metrics and status screens",
      description: "Operational board, dashboard, summary, reporting and status views.",
      screens: [],
    },
    {
      key: "settings",
      title: "Settings, profile and account screens",
      description: "Profile/account controls, preferences, toggles and close/back behavior.",
      screens: [],
    },
    {
      key: "support",
      title: "Empty, error and supporting states",
      description: "Empty, loading, storage-error, retry and recovery states.",
      screens: [],
    },
  ];

  const byKey = new Map(groups.map((group) => [group.key, group]));
  for (const screen of predicted) {
    byKey.get(screenBucket(screen))?.screens.push(screen);
  }

  const nonEmpty = groups.filter((group) => group.screens.length > 0);
  if (nonEmpty.length === 0) return [];
  if (nonEmpty.length <= cap) return nonEmpty;

  const kept = nonEmpty.slice(0, cap);
  const overflow = nonEmpty.slice(cap).flatMap((group) => group.screens);
  kept[kept.length - 1].screens.push(...overflow);
  return kept;
}

function fileSkeletons(files: string[], screenFiles: Set<string>): Record<string, string> {
  return Object.fromEntries(files.map((file) => [
    file,
    screenFiles.has(file)
      ? "Generated Stitch screen wired to shared app state and visible behavior handlers."
      : "Shared app state, integration, styling, or persistence implementation file.",
  ]));
}

function buildScreenMap(screenMap: any[], predicted: PredictedScreen[], stories: StoryDraft[]): any[] {
  const screenToStories = new Map<string, string[]>();
  for (const story of stories) {
    for (const screenId of story.screens) {
      const current = screenToStories.get(screenId) || [];
      current.push(story.id);
      screenToStories.set(screenId, current);
    }
  }

  return (screenMap.length > 0 ? screenMap.filter((screen: any) => !isPrdPseudoScreen(screen)) : predicted.map((s) => ({
    screenId: s.screenId,
    name: s.title,
    type: "screen",
    description: s.title,
  }))).map((s: any) => {
    const screenId = s.screenId || s.id;
    return {
      screenId,
      name: s.name || s.title || screenId,
      type: s.type || "screen",
      description: s.description || s.name || s.title || "Generated screen",
      stories: screenToStories.get(screenId) || [],
    };
  }).filter((s: any) => s.screenId);
}

export function buildAutoStoriesOutput(params: {
  repo: string;
  task?: string;
  context?: Record<string, string>;
  predicted: PredictedScreen[];
  screenMap?: any[];
  maxStories?: number | null;
}): string {
  const { repo, predicted, screenMap = [], maxStories = null } = params;
  const product = extractProjectLabel(
    params.context?.["project_display_name"] || params.context?.["project_name"] || params.context?.["project_slug"] || params.context?.["task"] || params.task || "",
    "Uygulama",
  );
  const screenFiles = unique(predicted.map((s) => s.filePath));
  const screenFileSet = new Set(screenFiles);

  let stories: StoryDraft[];
  if (maxStories === 1) {
    const scopeFiles = buildSingleStoryScopeFiles(screenFiles);
    stories = [{
      id: "US-001",
      title: `${product} - complete single-story implementation`,
      description: "Single explicit-cap story covering generated screens, app integration, visible controls, route/state behavior, and any persistence explicitly required by PRD/DESIGN_DOM.",
      acceptanceCriteria: buildAcceptanceCriteria(repo),
      depends_on: [],
      screens: unique(predicted.map((s) => s.screenId)),
      scope_files: scopeFiles,
      shared_files: [],
      scope_description: "One-story explicit user cap: implement all generated screens, visible button/icon behavior, app integration, and only the state/persistence behavior required by the project context.",
      file_skeletons: fileSkeletons(scopeFiles, screenFileSet),
    }];
  } else {
    const groups = chooseScreenGroups(predicted, maxStories);
    const appStory: StoryDraft = {
      id: "US-001",
      title: `${product} - app shell, state and persistence`,
      description: "Build the shared application shell, navigation state, domain types, persistence helpers, profile/settings panel wiring, and smoke-visible window.app state used by generated screens.",
      acceptanceCriteria: [
        "App shell wires every generated Stitch screen into one coherent application flow; first screen is the actual product surface, not a landing page.",
        "Shared state exposes visible active screen, selected item, storage status, last error, active panel, and item count through window.app.",
        "Profile/account icon opens a visible panel/drawer/page and close/back controls visibly dismiss it.",
        "localStorage success, corrupted JSON, retry, and clear-data paths produce visible DOM feedback when persistence is required.",
        "No product control uses data-smoke-ignore; inactive controls are disabled/hidden explicitly.",
      ],
      depends_on: [],
      screens: unique(predicted.map((s) => s.screenId)),
      scope_files: APP_SCOPE_FILES,
      shared_files: screenFiles,
      scope_description: "Shared app integration and state ownership. Generated src/screens files are read-only shared context here; screen stories own all edits to those files.",
      file_skeletons: fileSkeletons(APP_SCOPE_FILES, screenFileSet),
    };

    stories = [appStory];
    groups.forEach((group, index) => {
      const id = `US-${String(index + 2).padStart(3, "0")}`;
      const groupScreenFiles = unique(group.screens.map((s) => s.filePath));
      const groupScreenIds = unique(group.screens.map((s) => s.screenId));
      const scopeFiles = unique(groupScreenFiles);
      stories.push({
        id,
        title: `${product} - ${group.title}`,
        description: `${group.description} Implement the owned generated screens with visible form, navigation, filtering, retry, toggle, and selection behavior from DESIGN_DOM.`,
        acceptanceCriteria: buildAcceptanceCriteriaForScreens(repo, groupScreenIds, group.title),
        depends_on: ["US-001"],
        screens: groupScreenIds,
        scope_files: scopeFiles,
        shared_files: APP_SCOPE_FILES,
        scope_description: `${group.title}: own only ${scopeFiles.join(", ")}; use shared app state files without taking ownership.`,
        file_skeletons: fileSkeletons(scopeFiles, screenFileSet),
      });
    });
  }

  const mappedScreens = buildScreenMap(screenMap, predicted, stories);
  return [
    "STATUS: done",
    "STORIES_JSON:",
    JSON.stringify(stories, null, 2),
    "SCREEN_MAP:",
    JSON.stringify(mappedScreens, null, 2),
    "",
  ].join("\n");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (process.env.SETFARM_DISABLE_AUTO_STORIES === "1") return;

  const maxStories = extractExplicitMaxStories(`${ctx.task || ""}\n${ctx.context["task"] || ""}\n${ctx.context["prd"] || ""}`);

  const existing = await pgGet<{ cnt: string }>("SELECT COUNT(*)::text as cnt FROM stories WHERE run_id = $1", [ctx.runId]);
  if (Number(existing?.cnt || 0) > 0) return;

  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  if (!repo) return;
  const predicted = computePredictedScreenFiles(repo);
  if (predicted.length === 0) return;

  const screenMap = loadScreenMap(repo);
  const output = buildAutoStoriesOutput({
    repo,
    task: ctx.task,
    context: ctx.context,
    predicted,
    screenMap,
    maxStories,
  });

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) return;

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, output);
  logger.info(`[module:stories preclaim] AUTO-COMPLETED stories without planner agent (${predicted.length} screen(s), ${Buffer.byteLength(output, "utf-8")} bytes)`, {
    runId: ctx.runId,
    stepId: ctx.stepId,
  });
}
