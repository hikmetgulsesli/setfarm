import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ClaimContext } from "../types.js";
import { slugifyIdentity, transliterateIdentity } from "../../runtime-identity.js";

const DEFAULT_STACK = "vite-react";
const PLAN_CONTRACT_SCHEMA_VERSION = "setfarm.plan.v2.2";
const COMMAND_VERB_RE = /\b(build|create|make|develop|implement|design|write|add|fix)\b/i;

type ProjectKind = "game" | "product" | "api" | "cli" | "mobile" | "desktop";
type AutoPlanOptions = {
  runId?: string;
};

export function slugify(input: string): string {
  return slugifyIdentity(input);
}

function extractNamedProductPhrase(input: string): string {
  const source = String(input || "").replace(/\s+/g, " ").trim();
  const match = source.match(/\b(?:called|named|titled)\s+["'“”]?([A-Za-z0-9][A-Za-z0-9&' -]{1,80}?)(?=["'“”]?(?:[.;,]| with\b| for\b| using\b| that\b| which\b| should\b|$))/i);
  return (match?.[1] || "")
    .replace(/["'“”]+/g, "")
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProjectName(task: string): string {
  const projectLine = task.match(/(?:^|\n)\s*Project\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (projectLine) {
    const inlineTaskStart = projectLine.match(new RegExp(`^(.+?)\\s+${COMMAND_VERB_RE.source}`, "i"));
    return (inlineTaskStart?.[1] || projectLine).trim();
  }
  const namedProduct = extractNamedProductPhrase(task);
  if (namedProduct) return namedProduct;
  const firstLine = task.split(/\n+/).map(line => line.trim()).find(Boolean) || "Setfarm Project";
  const withoutVerb = firstLine.replace(new RegExp(`^${COMMAND_VERB_RE.source}\\s+`, "i"), "");
  return withoutVerb.split(/\b(?:with|for|using|including|that|which)\b|[.;,]/i)[0].trim().slice(0, 80) || "Setfarm Project";
}

function humanizeProjectName(input: string): string {
  const cleaned = String(input || "")
    .replace(/^Project\s*:\s*/i, "")
    .replace(/\s+(?:build|create|make|develop|implement|design|write|add|fix)\b[\s\S]*$/i, "")
    .replace(/\s+(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();
  if (!cleaned) return "Setfarm Project";

  const normalized = transliterateIdentity(cleaned);
  const words = normalized.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return cleaned.slice(0, 80);
  const acronyms = new Set(["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa", "iot"]);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .slice(0, 80);
}

function cleanExplicitProjectName(input: string): string {
  const cleaned = transliterateIdentity(String(input || ""))
    .replace(/^Project\s*:\s*/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Setfarm Project";
}

function productNameFromActionDescription(task: string): string {
  const namedProduct = extractNamedProductPhrase(task);
  if (namedProduct) return namedProduct;
  const source = task.split(/\n+/).map(line => line.trim()).find(line => COMMAND_VERB_RE.test(line)) || task;
  const match = source.match(COMMAND_VERB_RE);
  const action = match ? source.slice(match.index ?? 0).trim() : source;
  const cleaned = action
    .replace(new RegExp(`^${COMMAND_VERB_RE.source}\\s+`, "i"), "")
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\b(?:browser|web|mobile)[-\s]+based\b/gi, "")
    .replace(/\b(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js|browser|web|mobile)\b/gi, "")
    .split(/\b(?:with|for|using|including|include|where|that|which)\b|[.;,]/i)[0]
    .replace(/\s+(?:app|application|tool|experience|surface|service)\s*$/i, "")
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function extractProjectDisplayName(task: string, fallbackRawName: string): string {
  const namedProduct = extractNamedProductPhrase(task);
  if (namedProduct && /[a-zA-Z]/.test(transliterateIdentity(namedProduct))) {
    return cleanExplicitProjectName(namedProduct);
  }
  const actionProduct = productNameFromActionDescription(task);
  if (actionProduct && /[a-zA-Z]/.test(transliterateIdentity(actionProduct))) {
    return humanizeProjectName(actionProduct);
  }
  return humanizeProjectName(fallbackRawName);
}

function inferPlatform(task: string): string {
  const lower = task.toLowerCase();
  if (/\b(api only|backend service|rest api|graphql)\b/.test(lower)) return "api";
  if (/\b(cli|command line|terminal app)\b/.test(lower)) return "cli";
  if (/\b(electron|desktop app|desktop application|macos|windows app|linux desktop)\b/.test(lower)) return "desktop";
  if (/\breact native\b|\bmobile app\b|\bios\b|\bandroid\b/.test(lower)) return "mobile";
  if (/\b(game|arcade|puzzle|playfield|score|level|pause|restart)\b/.test(lower)) return "game";
  return "web";
}

function inferTechStack(task: string): string {
  const lower = task.toLowerCase();
  if (/\bandroid\b/.test(lower) && !/\breact native\b|\bexpo\b/.test(lower)) return "android-native";
  if (/\bios\b|\biphone\b|\bipad\b/.test(lower) && !/\breact native\b|\bexpo\b/.test(lower)) return "ios-native";
  if (/\breact native\b|\bexpo\b|mobile app/.test(lower)) return "react-native-expo";
  if (/\belectron\b|desktop app|desktop application/.test(lower)) return "desktop-electron";
  if (/\b(game|arcade|puzzle|playfield|score|level|pause|restart)\b/.test(lower)) return "browser-game";
  if (/\bnext\s*(?:\.?js|js)\b|\bnextjs\b|\bseo\b|\bssr\b/.test(lower)) return "nextjs";
  if (/\bpython\b/.test(lower) && /\b(cli|command line|terminal app)\b/.test(lower)) return "python-cli";
  if (/\bpython\b/.test(lower) && /\b(api only|backend service|rest api|graphql|fastapi|flask|django)\b/.test(lower)) return "python-web";
  if (/\bnode\b|\bexpress\b|api only|rest api|backend service/.test(lower)) return "node-express";
  if (/\bcli|command line|terminal app/.test(lower)) return "node-cli";
  if (/\bstatic html\b|\bhtml only\b|\bno framework\b/.test(lower)) return "static-html";
  return DEFAULT_STACK;
}

function inferDbRequired(task: string): string {
  const lower = task.toLowerCase();
  if (/\bfirebase\b|\bsupabase\b|\bstripe\b|\bexternal api\b|\bmanaged service\b/.test(lower)) return "external";
  if (/\bsqlite\b/.test(lower)) return "sqlite";
  if (/\bpostgres\b|\bpostgresql\b|\bauth\b|login|sign in|account|create account|user data|multi user|shared data|database/.test(lower)) return "postgres";
  return "none";
}

function inferProjectKind(task: string): ProjectKind {
  const platform = inferPlatform(task);
  if (platform === "api" || platform === "cli" || platform === "mobile" || platform === "game" || platform === "desktop") return platform;
  return "product";
}

export function inferUiLanguage(task: string): string {
  const normalized = transliterateIdentity(task).toLowerCase();
  if (/\b(turkish|turkce|tr)\b/.test(normalized)) return "Turkish";
  return "English";
}

function taskBullets(task: string): string[] {
  const bullets = task
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter((line) => line && !/^Project\s*:/i.test(line) && !/^Platform\s*:/i.test(line))
    .slice(0, 10);
  return bullets.length > 0 ? bullets : ["Deliver the requested product as a usable first-screen workflow, not a marketing or placeholder page."];
}

function primaryEntity(task: string, kind: ProjectKind): string {
  if (kind === "game") return "GameSession";
  if (kind === "api") return "Resource";
  if (kind === "cli") return "CommandRun";
  const lower = task.toLowerCase();
  if (/\b(service desk|tickets?|queues?|sla)\b/.test(lower)) return "Ticket";
  if (/\b(crm|customers?|accounts?|contacts?|leads?|opportunities?)\b/.test(lower)) return "Customer";
  if (/\b(inventory|stock|warehouse|products?)\b/.test(lower)) return "Item";
  const match = lower.match(/\b(?:manage|track|triage|plan|organize|edit|create|list|browse|review|approve)\s+(?:a|an|the|many|multiple|all|new|open|active|pending)?\s*([a-z][a-z-]{2,24})s?\b/i);
  const blocked = new Set(["browser", "compact", "service", "desk", "app", "application", "called", "named", "dashboard", "screen", "state", "workflow", "data", "user", "users", "settings"]);
  if (!match?.[1] || blocked.has(match[1])) return "Record";
  const singular = match[1].replace(/s$/i, "");
  return singular.replace(/(^|-)([a-z])/g, (_m, sep, ch) => `${sep}${ch.toUpperCase()}`).replace(/-/g, "");
}

function hasAny(text: string, terms: RegExp): boolean {
  return terms.test(text.toLowerCase());
}

function entityToken(entity: string): string {
  return slugify(entity).toUpperCase().replace(/-/g, "_") || "RECORD";
}

function surfaceSlug(surfaceBlock: string): string {
  const id = surfaceBlock.match(/^### SURFACE:\s*(SURF_[A-Z0-9_]+)/m)?.[1] || "SURF_PRODUCT";
  return slugify(id.replace(/^SURF_/, "").toLowerCase().replace(/_/g, " "));
}

function addSurfaceMetadata(surfaceBlock: string, displayFields: string, representation = "standalone", hostSurfaceId = "none"): string {
  if (/\n- Domain Hint:/i.test(surfaceBlock)) return surfaceBlock;
  const domainHint = surfaceSlug(surfaceBlock);
  return surfaceBlock
    .replace(
      /\n- Data Entities Bound:/,
      `\n- Domain Hint: ${domainHint}\n- Representation: ${representation}\n- Host Surface ID: ${hostSurfaceId}\n- Data Entities Bound:`,
    )
    .replace(/\n- Core Content:/, `\n- Display Fields: ${displayFields}\n- Core Content:`);
}

function productDisplayFields(entity: string): string {
  return `${entity}.id, ${entity}.title, ${entity}.status, ${entity}.createdAt, ${entity}.updatedAt, ActivityEvent.label, ActivityEvent.timestamp, Preference.key, Preference.value`;
}

function productSurfaceBlocks(task: string, entity: string): string[] {
  const lower = task.toLowerCase();
  const token = entityToken(entity);
  const surfaces: string[] = [
    [
      `### SURFACE: SURF_${token}_OPERATIONS`,
      `- Name: ${entity} Operations`,
      `- Purpose: Give the user the main operational view for inspecting, searching, filtering, and acting on ${entity} data.`,
      `- Data Entities Bound: ${entity}, ActivityEvent, Preference`,
      "- Core Content: summary metrics, primary list/board/table, filters, search, selected item preview, empty/loading/error states.",
      "- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent), ACT_CREATE_RECORD (control_hint: primary_button), ACT_SELECT_RECORD (control_hint: inline_edit), ACT_RETRY_LOAD (control_hint: secondary_button)",
      "- Entry Points: direct_url",
      "- Exit & Guard Rules: If data is unavailable, stay on the same surface and show retry/clear actions.",
      "- Auth Required: false",
      "- Design Guidance: Dense but calm product UI; avoid marketing hero composition and unrelated admin/reporting modules.",
    ].join("\n"),
    [
      `### SURFACE: SURF_${token}_EDITOR`,
      `- Name: ${entity} Editor`,
      `- Purpose: Let the user create, edit, validate, save, cancel, and recover ${entity} changes.`,
      `- Data Entities Bound: ${entity}, ValidationError`,
      "- Core Content: form fields, required/optional indicators, validation messages, save/cancel controls, unsaved-state feedback.",
      "- Permitted Actions: ACT_SAVE_RECORD (control_hint: form_submit), ACT_CANCEL_EDIT (control_hint: secondary_button)",
      `- Entry Points: SURF_${token}_OPERATIONS`,
      `- Exit & Guard Rules: Save returns to SURF_${token}_OPERATIONS with persisted changes; cancel preserves existing data and closes the editor.`,
      "- Auth Required: false",
      "- Design Guidance: Form layout must be clear and task-specific; do not invent payment, onboarding, or unrelated identity forms.",
    ].join("\n"),
  ];

  if (hasAny(lower, /\b(queue|queues|sla|triage|pipeline|board|stage|kanban)\b/)) {
    surfaces.push([
      "### SURFACE: SURF_QUEUE_AND_STATUS_MANAGEMENT",
      "- Name: Queue and Status Management",
      `- Purpose: Help users organize ${entity} work by queue, status, SLA, stage, priority, or triage context when those signals are part of the requested product.`,
      `- Data Entities Bound: ${entity}, ActivityEvent, Preference`,
      "- Core Content: queue/status lanes, SLA or priority markers, ownership, blockers, aging indicators, and next-action controls.",
      "- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent), ACT_SELECT_RECORD (control_hint: inline_edit), ACT_UPDATE_RECORD_STATUS (control_hint: inline_edit)",
      `- Entry Points: SURF_${token}_OPERATIONS`,
      `- Exit & Guard Rules: Status changes keep the user in the same ${entity} context and expose recoverable failure feedback.`,
      "- Auth Required: false",
      "- Design Guidance: Represent operational state clearly; do not flatten queue/SLA work into decorative metrics.",
    ].join("\n"));
  }

  if (hasAny(lower, /\b(agent|agents|assignee|assignees|owner|owners|team|teams|workload)\b/)) {
    surfaces.push([
      "### SURFACE: SURF_AGENT_WORKLOAD",
      "- Name: Agent Workload",
      `- Purpose: Show how ${entity} work is assigned, overloaded, pending, or blocked across agents or owners.`,
      `- Data Entities Bound: ${entity}, ActivityEvent`,
      "- Core Content: agent/owner list, workload counts, stale or overdue indicators, reassignment controls, and recent activity.",
      "- Permitted Actions: ACT_SEARCH_RECORDS (control_hint: search_input_persistent), ACT_SELECT_RECORD (control_hint: inline_edit), ACT_ASSIGN_RECORD (control_hint: context_menu), ACT_FILTER_INSIGHTS (control_hint: context_menu)",
      `- Entry Points: SURF_${token}_OPERATIONS, SURF_QUEUE_AND_STATUS_MANAGEMENT`,
      `- Exit & Guard Rules: Reassignment preserves the selected ${entity} and updates visible queue/status counts.`,
      "- Auth Required: false",
      "- Design Guidance: Make workload and ownership scannable without creating a separate HR or account-management module.",
    ].join("\n"));
  }

  if (hasAny(lower, /\b(insight|insights|report|reports|analytics|metric|metrics|summary|summaries|dashboard)\b/)) {
    surfaces.push([
      "### SURFACE: SURF_INSIGHTS",
      "- Name: Insights",
      `- Purpose: Show useful summaries, trends, and status signals derived from ${entity} data without becoming a separate analytics product.`,
      `- Data Entities Bound: ${entity}, ActivityEvent`,
      "- Core Content: small metrics, recent activity, state distribution, actionable follow-up hints, empty/error state.",
      "- Permitted Actions: ACT_FILTER_INSIGHTS (control_hint: context_menu), ACT_EXPORT_SUMMARY (control_hint: secondary_button)",
      `- Entry Points: SURF_${token}_OPERATIONS`,
      `- Exit & Guard Rules: No external BI/admin area; returns to SURF_${token}_OPERATIONS.`,
      "- Auth Required: false",
      "- Design Guidance: Keep insight content project-relevant and compact; no generic charts unrelated to the requested domain.",
    ].join("\n"));
  }

  if (hasAny(lower, /\b(setting|settings|preference|preferences|filter|filters|saved view|saved views)\b/)) {
    surfaces.push([
      "### SURFACE: SURF_SETTINGS_AND_PREFERENCES",
      "- Name: Settings and Preferences",
      `- Purpose: Let users adjust ${entity} workflow preferences, saved filters, defaults, or product settings requested by the task.`,
      "- Data Entities Bound: Preference",
      "- Core Content: saved filters, default views, notification or density preferences when relevant, reset controls, and visible save feedback.",
      "- Permitted Actions: ACT_SAVE_PREFERENCES (control_hint: form_submit), ACT_RETRY_LOAD (control_hint: secondary_button)",
      `- Entry Points: SURF_${token}_OPERATIONS`,
      "- Exit & Guard Rules: Saved preferences immediately affect visible product state or show a clear confirmation.",
      "- Auth Required: false",
      "- Design Guidance: Settings must support the requested workflow only; do not invent unrelated profile or billing areas.",
    ].join("\n"));
  }

  if (hasAny(lower, /\b(empty|error|loading|retry|recover|recovery|failure|failed|offline|corrupt)\b/)) {
    surfaces.push([
      "### SURFACE: SURF_EMPTY_AND_ERROR_RECOVERY",
      "- Name: Empty and Error Recovery",
      `- Purpose: Keep the ${entity} workflow usable when data is missing, filtered away, loading, failed, or corrupt.`,
      `- Data Entities Bound: ${entity}, ActivityEvent, Preference`,
      "- Core Content: clear cause, retry/reset controls, create-first action, clear-filter action, and state-specific guidance.",
      "- Permitted Actions: ACT_RETRY_LOAD (control_hint: primary_button), ACT_CREATE_RECORD (control_hint: secondary_button)",
      `- Entry Points: SURF_${token}_OPERATIONS, SURF_INSIGHTS`,
      `- Exit & Guard Rules: Recovery returns to the active ${entity} workflow and preserves unrelated state.`,
      "- Auth Required: false",
      "- Design Guidance: Recovery states must be useful product states, not blank placeholder panels.",
    ].join("\n"));
  }

  if (!surfaces.some((surface) => /SURF_INSIGHTS/.test(surface))) {
    surfaces.push([
      "### SURFACE: SURF_INSIGHTS",
      "- Name: Insights",
      `- Purpose: Show useful summaries, trends, and status signals derived from ${entity} data without becoming a separate analytics product.`,
      `- Data Entities Bound: ${entity}, ActivityEvent`,
      "- Core Content: small metrics, recent activity, state distribution, actionable follow-up hints, empty/error state.",
      "- Permitted Actions: ACT_FILTER_INSIGHTS (control_hint: context_menu), ACT_EXPORT_SUMMARY (control_hint: secondary_button)",
      `- Entry Points: SURF_${token}_OPERATIONS`,
      `- Exit & Guard Rules: No external BI/admin area; returns to SURF_${token}_OPERATIONS.`,
      "- Auth Required: false",
      "- Design Guidance: Keep insight content project-relevant and compact; no generic charts unrelated to the requested domain.",
    ].join("\n"));
  }

  return surfaces.map((surface) => addSurfaceMetadata(surface, productDisplayFields(entity)));
}

function surfaceBlocks(kind: ProjectKind, entity: string, task = ""): string[] {
  if (kind === "api" || kind === "cli") return [];
  if (kind === "game") {
    return [
      [
        "### SURFACE: SURF_GAMEPLAY",
        "- Name: Gameplay",
        "- Purpose: Let the player start, play, pause, resume, restart, and understand score/progress from the live game state.",
        "- Data Entities Bound: GameSession, PlayerInput, ScoreState, Preference",
        "- Core Content: playfield, status/HUD, score/progress, active controls, pause/game-over state feedback.",
        "- Permitted Actions: ACT_START_GAME (control_hint: primary_button), ACT_PAUSE_GAME (control_hint: keyboard_shortcut), ACT_RESTART_GAME (control_hint: secondary_button)",
        "- Entry Points: direct_url, SURF_GAME_SETTINGS",
        "- Exit & Guard Rules: Remains available without auth; disabled controls must explain inactive state.",
        "- Auth Required: false",
        "- Design Guidance: Prioritize the playfield and readable state over decorative chrome; controls must be visible on mobile and desktop.",
      ].join("\n"),
      [
        "### SURFACE: SURF_GAME_SETTINGS",
        "- Name: Game Settings",
        "- Purpose: Let the player adjust task-relevant options and review concise controls/help without leaving the game context.",
        "- Data Entities Bound: Preference, GameSession",
        "- Core Content: difficulty/speed when relevant, input help, reset preferences, close/back behavior.",
        "- Permitted Actions: ACT_SAVE_PREFERENCES (control_hint: form_submit), ACT_RETURN_TO_GAMEPLAY (control_hint: secondary_button)",
        "- Entry Points: SURF_GAMEPLAY",
        "- Exit & Guard Rules: Returns to SURF_GAMEPLAY and preserves active game state unless restart is chosen.",
        "- Auth Required: false",
        "- Design Guidance: Compact settings; no unrelated admin areas or identity-management modules unless explicitly requested.",
      ].join("\n"),
    ].map((surface) => addSurfaceMetadata(surface, "GameSession.status, GameSession.score, GameSession.level, GameSession.paused, GameSession.gameOver, ScoreState.highScore, Preference.key, Preference.value"));
  }

  return productSurfaceBlocks(task, entity);
}

function actionBlocks(kind: ProjectKind, entity: string, task = ""): string[] {
  if (kind === "api") {
    return [
      "### ACTION: ACT_CREATE_RESOURCE\n- Surface Bound: N/A\n- Trigger: HTTP POST creates a resource from validated DTO input.\n- Preconditions & Auth: Request is authenticated when the selected API contract requires it; payload passes schema validation.\n- Async Behavior: Return deterministic success or error envelope; timeout is surfaced by the caller.\n- Success Effect: Persist resource and return 201 with created representation.\n- Failure Effect: Return validation, auth, conflict, rate-limit, or system error envelope.\n- State Changes: Resource collection gains one item.\n- Persistence Effects: Database write when DB_REQUIRED is not none.\n- User Feedback: API response only.\n- Unauthorized Effect: 401/403 error envelope.",
    ];
  }
  if (kind === "cli") {
    return [
      "### ACTION: ACT_RUN_COMMAND\n- Surface Bound: N/A\n- Trigger: User invokes the primary CLI command with args/flags.\n- Preconditions & Auth: Required args exist; config file is readable when needed.\n- Async Behavior: Print progress only to stderr; stdout remains machine-readable for successful output.\n- Success Effect: Exit 0 and write the requested result.\n- Failure Effect: Exit 1 for user/config errors and 2 for system errors.\n- State Changes: CommandRun status changes from pending to success or failed.\n- Persistence Effects: Writes config/cache only when command contract allows it.\n- User Feedback: Clear stderr diagnostics.\n- Unauthorized Effect: Exit 1 with auth/config guidance when credentials are missing.",
    ];
  }
  if (kind === "game") {
    return [
      "### ACTION: ACT_START_GAME\n- Surface Bound: SURF_GAMEPLAY\n- Trigger: Player clicks/taps Start or presses the configured start key.\n- Preconditions & Auth: Anonymous player; game is idle, paused, or over.\n- Async Behavior: Immediate local state update, no network wait.\n- Success Effect: Game status becomes playing and active input begins.\n- Failure Effect: Keep current state and show inline status if game cannot start.\n- Navigation After Success: target SURF_GAMEPLAY, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: status, score/progress, timers, entities, paused, gameOver.\n- Persistence Effects: Reads high score/preferences; writes high score after game over.\n- User Feedback: HUD updates visibly.\n- Required Role: anonymous.\n- Unauthorized Effect: Not applicable.",
      "### ACTION: ACT_PAUSE_GAME\n- Surface Bound: SURF_GAMEPLAY\n- Trigger: Player clicks Pause or presses pause key.\n- Preconditions & Auth: Game is playing.\n- Async Behavior: Immediate local state update.\n- Success Effect: Simulation freezes without duplicate timers; Resume becomes available.\n- Failure Effect: Disabled state explains why pause is unavailable.\n- Navigation After Success: target SURF_GAMEPLAY, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: paused and status fields.\n- Persistence Effects: None unless preferences are changed.\n- User Feedback: Pause overlay/status appears.\n- Required Role: anonymous.\n- Unauthorized Effect: Not applicable.",
      "### ACTION: ACT_RESTART_GAME\n- Surface Bound: SURF_GAMEPLAY\n- Trigger: Player clicks Restart.\n- Preconditions & Auth: Game is idle, playing, paused, or over.\n- Async Behavior: Immediate local reset.\n- Success Effect: Playfield, entities, score/progress, status, paused, and gameOver reset consistently.\n- Failure Effect: Current state remains visible and retry is available.\n- Navigation After Success: target SURF_GAMEPLAY, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: entire GameSession reset.\n- Persistence Effects: High score preserved.\n- User Feedback: Reset board/HUD visible.\n- Required Role: anonymous.\n- Unauthorized Effect: Not applicable.",
      "### ACTION: ACT_SAVE_PREFERENCES\n- Surface Bound: SURF_GAME_SETTINGS\n- Trigger: Player saves settings/help preferences.\n- Preconditions & Auth: Preference values pass validation.\n- Async Behavior: Disable save while writing to local storage.\n- Success Effect: Preferences apply to future sessions.\n- Failure Effect: Show storage recovery message and keep unsaved values visible.\n- Navigation After Success: target SURF_GAMEPLAY, method back.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: Preference values.\n- Persistence Effects: localStorage preference write.\n- User Feedback: Saved confirmation.\n- Required Role: anonymous.\n- Unauthorized Effect: Not applicable.",
      "### ACTION: ACT_RETURN_TO_GAMEPLAY\n- Surface Bound: SURF_GAME_SETTINGS\n- Trigger: Player closes settings or chooses Back/Resume.\n- Preconditions & Auth: Settings surface is open.\n- Async Behavior: Immediate local navigation, no network wait.\n- Success Effect: Player returns to SURF_GAMEPLAY with active game state preserved.\n- Failure Effect: Keep settings visible and explain why the transition is unavailable.\n- Navigation After Success: target SURF_GAMEPLAY, method back.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: active surface/panel only; gameplay state is unchanged.\n- Persistence Effects: None unless preferences were saved separately.\n- User Feedback: Gameplay controls and HUD are visible again.\n- Required Role: anonymous.\n- Unauthorized Effect: Not applicable.",
    ];
  }

  const token = entityToken(entity);
  const operationsSurface = `SURF_${token}_OPERATIONS`;
  const editorSurface = `SURF_${token}_EDITOR`;
  const lower = task.toLowerCase();
  const actions = [
    `### ACTION: ACT_SEARCH_RECORDS\n- Surface Bound: ${operationsSurface}\n- Trigger: User types in search or changes filters.\n- Preconditions & Auth: ${entity} data is loaded or recoverable.\n- Async Behavior: Debounced local filter or server query; visible loading when remote.\n- Success Effect: Results and empty state update deterministically.\n- Failure Effect: Keep previous results and show retryable error.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: query, filters, visible result set.\n- Persistence Effects: Optional persisted preference for last filters.\n- User Feedback: Result count and active filter badges update.\n- Required Role: any.\n- Unauthorized Effect: Redirect or show auth call-to-action only if auth is in scope.`,
    `### ACTION: ACT_SELECT_RECORD\n- Surface Bound: ${operationsSurface}\n- Trigger: User selects a row, card, lane item, or inline preview target.\n- Preconditions & Auth: ${entity} exists in the current visible result set.\n- Async Behavior: Immediate local selection update; fetch extra detail only if the selected stack/data source requires it.\n- Success Effect: Selected ${entity} detail, preview, or editor context becomes visible without losing list/filter state.\n- Failure Effect: Keep prior selection and show a compact unavailable-state message.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: selected entity id, active surface/panel, and last viewed timestamp.\n- Persistence Effects: Optional last selected ${entity} only when persistence is in scope.\n- User Feedback: Selected item highlight and detail context update visibly.\n- Required Role: any.\n- Unauthorized Effect: Hide or disable restricted detail fields if auth is in scope.`,
    `### ACTION: ACT_CREATE_RECORD\n- Surface Bound: ${operationsSurface}\n- Trigger: User clicks the primary create action.\n- Preconditions & Auth: User can create ${entity} records.\n- Async Behavior: Open editor immediately; no network wait.\n- Success Effect: ${editorSurface} opens with blank/default fields.\n- Failure Effect: Show unavailable-state message if creation is blocked.\n- Navigation After Success: target ${editorSurface}, method modal.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: active editor draft created.\n- Persistence Effects: None until save.\n- User Feedback: Editor appears with focus on first required field.\n- Required Role: any.\n- Unauthorized Effect: Show auth or permission message when auth is in scope.`,
    `### ACTION: ACT_SAVE_RECORD\n- Surface Bound: ${editorSurface}\n- Trigger: User submits the editor form.\n- Preconditions & Auth: Required fields pass validation and user can save ${entity}.\n- Async Behavior: Disable submit, show loading, timeout after 10 seconds with retry.\n- Success Effect: Persist changes and return to ${operationsSurface} with the updated row/card visible.\n- Failure Effect: Inline field errors for validation; banner/toast for system failure; draft is preserved.\n- Navigation After Success: target ${operationsSurface}, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: ${entity} collection and active selection update.\n- Persistence Effects: Write to localStorage or selected database.\n- User Feedback: Success confirmation and updated timestamp visible.\n- Required Role: any.\n- Unauthorized Effect: Show permission message without dropping the draft.`,
    `### ACTION: ACT_CANCEL_EDIT\n- Surface Bound: ${editorSurface}\n- Trigger: User clicks Cancel, Close, Back, or dismisses the editor.\n- Preconditions & Auth: Editor is open with a draft or selected ${entity}.\n- Async Behavior: Immediate local transition; no network wait.\n- Success Effect: Editor closes and returns to ${operationsSurface}; existing persisted ${entity} data remains unchanged.\n- Failure Effect: If unsaved changes require confirmation, keep the editor open and show the choice clearly.\n- Navigation After Success: target ${operationsSurface}, method back.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: active draft cleared or preserved according to confirmation state.\n- Persistence Effects: No persistence write.\n- User Feedback: Editor visibly closes or unsaved-change prompt appears.\n- Required Role: any.\n- Unauthorized Effect: Not applicable unless auth is in scope.`,
    `### ACTION: ACT_RETRY_LOAD\n- Surface Bound: ${operationsSurface}\n- Trigger: User clicks Retry from loading/error/empty recovery UI.\n- Preconditions & Auth: Data source can be retried.\n- Async Behavior: Show retry loading state and prevent duplicate submissions.\n- Success Effect: Replace error with current ${entity} data or a helpful empty state.\n- Failure Effect: Keep retry visible and explain next step.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: loading, lastError, storageStatus.\n- Persistence Effects: None except recovery metadata.\n- User Feedback: Inline status changes visibly.\n- Required Role: any.\n- Unauthorized Effect: Show auth or permission message when auth is in scope.`,
    `### ACTION: ACT_FILTER_INSIGHTS\n- Surface Bound: SURF_INSIGHTS\n- Trigger: User changes insight filter/menu.\n- Preconditions & Auth: Insight source data exists or empty state is valid.\n- Async Behavior: Local update or short loading state for remote aggregation.\n- Success Effect: Metrics and recent activity reflect the chosen filter.\n- Failure Effect: Keep previous metrics and show retry message.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: insight filter and derived metrics.\n- Persistence Effects: Optional last-used insight filter.\n- User Feedback: Metric labels and timestamps update.\n- Required Role: any.\n- Unauthorized Effect: Hide or disable restricted metrics if auth is in scope.`,
    `### ACTION: ACT_EXPORT_SUMMARY\n- Surface Bound: SURF_INSIGHTS\n- Trigger: User clicks Export or Download Summary from insight/reporting controls.\n- Preconditions & Auth: Visible insight data exists or a valid empty export state is allowed.\n- Async Behavior: Generate the export from current filters; show progress and prevent duplicate exports.\n- Success Effect: A downloadable or copyable summary is produced from current ${entity} metrics.\n- Failure Effect: Keep the current insights visible and show retryable export feedback.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: exportStatus, lastExportAt, and export error state.\n- Persistence Effects: No persistence write unless export history is explicitly in scope.\n- User Feedback: Export confirmation or retryable failure message appears.\n- Required Role: any.\n- Unauthorized Effect: Disable export or show permission message when auth is in scope.`,
  ];

  if (hasAny(lower, /\b(queue|queues|sla|triage|pipeline|board|stage|kanban)\b/)) {
    actions.push(`### ACTION: ACT_UPDATE_RECORD_STATUS\n- Surface Bound: SURF_QUEUE_AND_STATUS_MANAGEMENT\n- Trigger: User changes queue, status, SLA state, stage, priority, or triage lane for a visible ${entity}.\n- Preconditions & Auth: ${entity} is selected and the target status/queue value is valid.\n- Async Behavior: Apply optimistic UI only if rollback is defined; otherwise show loading on the changed control.\n- Success Effect: ${entity} appears in the correct queue/status context and derived counts update.\n- Failure Effect: Roll back the visible status/queue change and show contextual retry feedback.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: ${entity}.status, queue/stage/SLA fields, activity event, and visible aggregate counts.\n- Persistence Effects: Persist the status/queue change to localStorage or selected database.\n- User Feedback: Status badge/lane and updated timestamp change visibly.\n- Required Role: any.\n- Unauthorized Effect: Disable restricted status transitions when auth is in scope.`);
  }

  if (hasAny(lower, /\b(agent|agents|assignee|assignees|owner|owners|team|teams|workload)\b/)) {
    actions.push(`### ACTION: ACT_ASSIGN_RECORD\n- Surface Bound: SURF_AGENT_WORKLOAD\n- Trigger: User assigns, reassigns, or clears the owner/agent for a visible ${entity}.\n- Preconditions & Auth: Target agent/owner exists and the ${entity} can be assigned.\n- Async Behavior: Show assignment loading state and prevent duplicate reassignment clicks.\n- Success Effect: Owner/agent, workload counts, and recent activity update consistently.\n- Failure Effect: Restore previous owner/agent and show retryable assignment feedback.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: assignee/owner field, workload aggregates, and activity event.\n- Persistence Effects: Persist assignment to localStorage or selected database.\n- User Feedback: Assignment chip/list and workload counts update visibly.\n- Required Role: any.\n- Unauthorized Effect: Disable assignment control or show permission message when auth is in scope.`);
  }

  if (hasAny(lower, /\b(setting|settings|preference|preferences|filter|filters|saved view|saved views)\b/)) {
    actions.push(`### ACTION: ACT_SAVE_PREFERENCES\n- Surface Bound: SURF_SETTINGS_AND_PREFERENCES\n- Trigger: User saves workflow preferences, saved filters, default view, density, or notification options requested by the task.\n- Preconditions & Auth: Preference values pass validation and belong to the current product workflow.\n- Async Behavior: Disable save while writing; show timeout/retry if persistence stalls.\n- Success Effect: Preferences apply immediately to visible ${entity} workflow state.\n- Failure Effect: Keep unsaved values visible and show a retryable persistence message.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: Preference values and derived visible filters/layout.\n- Persistence Effects: Persist preference values to localStorage or selected database.\n- User Feedback: Saved confirmation and changed UI state are visible.\n- Required Role: any.\n- Unauthorized Effect: Show auth or permission message when auth is in scope.`);
  }

  return actions;
}

function platformContract(kind: ProjectKind, stack: string): string {
  if (kind === "api") {
    return "- Type: API\n- Auth Scheme: bearer_jwt or api_key when task requires auth; otherwise anonymous-safe endpoints.\n- Endpoint Contract: define route, method, request DTO, response DTO, and status codes per action.\n- Pagination: cursor for collections, none for single-resource endpoints.\n- Error Envelope: { error: { code, message, details } }.\n- Rate Limit: Include 429 behavior when public or auth endpoints exist.\n### route_guard_policy\n- Protected Surfaces: none; endpoint authorization is enforced by endpoint/auth middleware when auth is in scope.\n- Public Surfaces: not applicable.\n- Guard Implementation Owner: setup/implementation resolves middleware from endpoint contract, not PLAN paths.";
  }
  if (kind === "cli") {
    return "- Type: CLI\n- Command Contract: command names, args, flags, config file path policy, and examples.\n- STDOUT/STDERR: stdout is machine-readable success output; stderr is progress and diagnostics.\n- Exit Codes: 0 success, 1 user/config error, 2 system error.\n- Filesystem: only paths provided by args/config; no hardcoded directories.\n### route_guard_policy\n- Protected Surfaces: none.\n- Public Surfaces: not applicable.\n- Guard Implementation Owner: not applicable for CLI.";
  }
  if (kind === "mobile") {
    return "- Type: Mobile\n- Navigation: React Native navigation surfaces map to Product Surfaces.\n- Offline Policy: read-only or local-first when DB_REQUIRED is none.\n- Native Permissions: request only if the task explicitly needs camera, location, files, or notifications.\n- Test Handles: use testID for all interactive controls.\n### route_guard_policy\n- Protected Surfaces: none by default; add SURF_* entries only when auth is explicitly requested.\n- Public Surfaces: all anonymous/local surfaces.\n- Redirect On Unauthorized: show permission/auth surface or inline message without data loss.\n- Guard Implementation Owner: app shell story owns navigation plumbing only.";
  }
  if (kind === "game") {
    return "- Type: Game\n- Runtime: browser game loop or React-hosted simulation depending on TECH_STACK.\n- Input Model: keyboard and touch controls are first-class and visible/recoverable.\n- Pause/Restart: pause freezes simulation; restart resets session state without clearing high score/preferences.\n- Save State: high score/preferences only unless task asks for saved games.\n- Design Conversion Policy: reference visual shell/overlays only; gameplay runtime and physics are implemented from action/state contracts.\n### route_guard_policy\n- Protected Surfaces: none by default.\n- Public Surfaces: SURF_GAMEPLAY and SURF_GAME_SETTINGS.\n- Guard Implementation Owner: app/game shell story owns panel visibility only.";
  }
  if (kind === "desktop") {
    return "- Type: Desktop\n- Runtime: Electron desktop shell when TECH_STACK=desktop-electron.\n- Local File Policy: only user-selected files or app-owned data directories; no hardcoded paths.\n- Persistence: local storage or SQLite only when requested.\n- Test Handles: deterministic DOM/test handles for desktop shell smoke tests.\n### route_guard_policy\n- Protected Surfaces: none by default; add protected surfaces only when auth is explicitly requested.\n- Public Surfaces: all local anonymous surfaces.\n- Guard Implementation Owner: app shell story owns navigation plumbing only.";
  }
  return stack === "nextjs"
    ? "- Type: Web\n- Rendering Strategy: hybrid; server components for static/data fetching and client components for interactive Product Surfaces.\n- Auth Storage: httpOnly cookie when auth is in scope; avoid localStorage tokens.\n- CSP Policy: standard by default; no inline script dependencies outside framework needs.\n### route_guard_policy\n- Protected Surfaces: none by default; list SURF_* entries only when auth is explicitly requested.\n- Public Surfaces: anonymous/local product surfaces.\n- Redirect On Unauthorized: preserve current intent and route to auth/permission surface when auth exists.\n- Guard Implementation Owner: app shell story owns middleware/router plumbing, later stories own their surface content."
    : "- Type: Web\n- Rendering Strategy: CSR for Vite React unless the task requests SSR/SEO.\n- Auth Storage: local state/localStorage only for non-sensitive local apps; httpOnly cookie if auth/server is introduced.\n- Test Surface: window.app is allowed for deterministic smoke/final-test inspection.\n### route_guard_policy\n- Protected Surfaces: none by default; list SURF_* entries only when auth is explicitly requested.\n- Public Surfaces: anonymous/local product surfaces.\n- Redirect On Unauthorized: preserve current intent and show auth/permission feedback when auth exists.\n- Guard Implementation Owner: app shell story owns router/surface plumbing, later stories own their surface content.";
}

function designRequiredFor(kind: ProjectKind): boolean {
  return kind !== "api" && kind !== "cli";
}

function platformBehaviorLabel(platform: string): string {
  if (platform === "api") return "API endpoint behavior";
  if (platform === "cli") return "CLI command behavior";
  if (platform === "desktop") return "desktop product behavior";
  if (platform === "mobile") return "mobile app behavior";
  if (platform === "game") return "browser game behavior";
  return "web product behavior";
}

function uiVisionSummary(projectName: string, kind: ProjectKind, entity: string): string {
  if (kind === "api" || kind === "cli") {
    return `${projectName} has DESIGN_REQUIRED=false, so no visual UI is generated. The downstream contract should still preserve a concise operational interface through clear command or endpoint responses, deterministic errors, and product-specific naming. Any future UI surface must derive from Product Surfaces, not from repo or runtime paths.`;
  }
  if (kind === "game") {
    return `${projectName} should feel like a playable browser game from the first viewport, with the playfield, score, pause/restart controls, and recovery states immediately visible. Stitch may design the game shell, HUD, overlays, and settings surfaces, but gameplay runtime details remain governed by the GameSession action/state contract. The design should avoid generic dashboards and keep every visual element tied to play, progress, input, or recovery.`;
  }
  return `${projectName} should feel like a focused ${entity.toLowerCase()} operations product, not a marketing page. Stitch should emphasize dense but readable working surfaces, stable navigation, visible actions, validation/recovery feedback, and domain-specific data content. The visual system must stay inside the declared Product Surfaces and avoid unrelated admin, billing, profile, ecommerce, or generic BI modules.`;
}

function mockDataContract(kind: ProjectKind, entity: string, dbRequired: string): string[] {
  if (kind === "api") {
    return [
      "### mock_data_contract",
      `- Strategy: endpoint fixtures for ${entity} request/response examples and error envelopes.`,
      `- Required Entities: ${entity}, ActivityEvent, Preference when relevant to endpoint behavior.`,
      "- Required States: ready, empty, validation_error, conflict_error, unauthorized, rate_limited, system_error.",
      "- Persistence Seed Policy: use deterministic test fixtures; no runtime secrets.",
      "- Injection Boundary: stack pack resolves API test fixture location.",
      "### data_access_contract",
      `- Client Data Access: API consumers use the endpoint contract; implementation must not invent additional endpoints outside ACT_* actions.`,
      `- Server Data Access: ${dbRequired === "none" ? "in-memory or fixture-backed unless a database is explicitly requested." : `${dbRequired} persistence adapter with DTO validation.`}`,
      "- Fetching Strategy: endpoint handlers return declared DTO/error envelopes only.",
      "- Mutation Strategy: validate request DTO, apply one state change, return deterministic status code.",
    ];
  }
  if (kind === "cli") {
    return [
      "### mock_data_contract",
      `- Strategy: fixture files and argument examples for ${entity} command runs.`,
      `- Required Entities: ${entity}, Preference when config or cache is in scope.`,
      "- Required States: ready, empty_input, invalid_args, config_error, file_error, system_error.",
      "- Persistence Seed Policy: test fixtures only; no hardcoded host paths.",
      "- Injection Boundary: stack pack resolves CLI fixture/config test location.",
      "### data_access_contract",
      "- Client Data Access: command args, flags, stdin, and config files defined by Platform Contract.",
      "- Server Data Access: none unless explicitly requested.",
      "- Fetching Strategy: read only user-provided paths or fixture inputs.",
      "- Mutation Strategy: write only declared output/cache/config targets.",
    ];
  }
  if (kind === "game") {
    return [
      "### mock_data_contract",
      "- Strategy: fixture seed function for GameSession, ScoreState, PlayerInput, and Preference.",
      "- Required Entities: GameSession, PlayerInput, ScoreState, Preference.",
      "- Required States: ready, playing, paused, game_over, empty_preferences, storage_error, input_disabled.",
      "- Persistence Seed Policy: localStorage high score/preferences only unless saved games are requested.",
      "- Injection Boundary: stack pack resolves game fixture/runtime seed location.",
      "### data_access_contract",
      "- Client Data Access: single game runtime state store with deterministic debug exposure for tests.",
      "- Server Data Access: none for local browser games unless explicitly requested.",
      "- Fetching Strategy: no hidden network calls.",
      "- Mutation Strategy: game loop/actions update GameSession once per tick/action and preserve high score/preferences.",
    ];
  }
  return [
    "### mock_data_contract",
    `- Strategy: fixture_files for ${entity}, ActivityEvent, Preference, and validation examples.`,
    `- Required Entities: ${entity}, ActivityEvent, Preference.`,
    "- Required States: ready, empty, loading, error, validation_error, filtered_empty, storage_error.",
    "- Persistence Seed Policy: local fixtures and localStorage seed when DB_REQUIRED=none; server fixture seed when DB_REQUIRED is postgres/sqlite/external.",
    "- Injection Boundary: stack pack resolves fixture file and test bridge locations; PLAN does not emit physical paths.",
    "### data_access_contract",
    `- Client Data Access: ${dbRequired === "none" ? "local state plus localStorage persistence adapter." : "client/server adapter selected by setup stack pack."}`,
    `- Server Data Access: ${dbRequired === "none" ? "none." : `${dbRequired} persistence through generated adapter; secrets supplied only by MC/runtime.`}`,
    "- Fetching Strategy: one declared data source per entity; do not mix raw fetch, SWR, React Query, and local copies unless setup explicitly selects one.",
    "- Mutation Strategy: validate input, apply exactly one write path, refresh derived views, and preserve last good state on failure.",
  ];
}

export function buildAutoPlanOutput(task: string, _options: AutoPlanOptions = {}): string {
  const rawProjectName = extractProjectName(task);
  const projectName = extractProjectDisplayName(task, rawProjectName);
  const projectSlug = slugify(projectName);
  const kind = inferProjectKind(task);
  const platform = inferPlatform(task);
  const stack = inferTechStack(task);
  const dbRequired = inferDbRequired(task);
  const uiLanguage = inferUiLanguage(task);
  const designRequired = designRequiredFor(kind);
  const entity = primaryEntity(task, kind);
  const uiSummary = uiVisionSummary(projectName, kind, entity);
  const bullets = taskBullets(task).map((line, idx) => `- FR-${String(idx + 1).padStart(3, "0")}: ${line}`);
  const surfaces = surfaceBlocks(kind, entity, task);
  const actions = actionBlocks(kind, entity, task);
  const behaviorLabel = platformBehaviorLabel(platform);
  const surfaceSection = designRequired
    ? surfaces.join("\n\n")
    : "DESIGN_REQUIRED=false. Product Surfaces are intentionally skipped for this API/CLI contract.";

  return [
    `CONTRACT_SCHEMA_VERSION: ${PLAN_CONTRACT_SCHEMA_VERSION}`,
    "STATUS: done",
    `PROJECT_NAME: ${projectName}`,
    `PROJECT_SLUG: ${projectSlug}`,
    `PLATFORM: ${platform}`,
    `TECH_STACK: ${stack}`,
    `UI_LANGUAGE: ${uiLanguage}`,
    `DB_REQUIRED: ${dbRequired}`,
    `DESIGN_REQUIRED: ${designRequired ? "true" : "false"}`,
    `UI_VISION_SUMMARY: ${uiSummary}`,
    "PRD:",
    `# ${projectName} Product Contract`,
    "",
    "## 1. Context And Goals",
    `- Overview: ${projectName} turns the user's request into a directly usable ${platform} workflow. The first experience must be the actual ${behaviorLabel}, not a marketing landing page or placeholder demo.`,
    `- Target Audience: Users who need the requested ${platform} product to work immediately with clear feedback, recovery paths, and deterministic verification hooks.`,
    `- UI Language: ${uiLanguage}. Pipeline metadata, action IDs, surface IDs, story titles, technical reports, and file identifiers remain English.`,
    "- Core Objectives:",
    ...bullets,
    "- Business Goals: reduce ambiguity for downstream agents, preserve the requested domain, and keep unrelated modules out of scope.",
    "- User Goals: inspect current state, take primary actions, understand validation/recovery feedback, and return to a stable state after failures.",
    "- Primary Workflows: load product state, perform the main action, recover from validation/system errors, and verify final state through the platform-appropriate test surface.",
    "- Non-Functional: first usable state under 2s for local/frontend apps, WCAG 2.1 AA for UI platforms, deterministic test handles, and responsive behavior for UI platforms.",
    "- External Dependencies: none unless explicitly listed in the task or System Contracts.",
    "",
    "## 2. Data And State Contract",
    "### Entities",
    `- ${entity}:`,
    "  - Fields: id:string required, title:string required, status:enum required, createdAt:timestamp required, updatedAt:timestamp required, metadata:json optional.",
    "  - Relations: ActivityEvent belongs to the primary entity when activity/history is visible.",
    "- ActivityEvent:",
    "  - Fields: id:string required, entityId:string required, label:string required, timestamp:timestamp required, severity:enum optional.",
    "- Preference:",
    "  - Fields: key:string required, value:json required, updatedAt:timestamp required.",
    "### State Architecture",
    `- Server State: ${dbRequired === "none" ? "none for local-only apps; setup may only introduce a backend when the selected stack contract requires it." : `${dbRequired} owns persisted shared data.`}`,
    "- Client/Local State: active surface, selected entity, drafts, filters, loading flags, lastError, and transient feedback.",
    "- URL / Router State: active surface or selected item may be reflected in route/query when the platform supports it.",
    "- Persisted State: local preferences and local-only records when DB_REQUIRED=none; server/external persistence when DB_REQUIRED is postgres/sqlite/external.",
    "- Transient UI State: modal/drawer open state, hover/focus, optimistic flags, and retry timers.",
    "### Data Flow",
    "- Read Path: load seed/current data into a single source of truth, derive visible lists/metrics from it, and expose deterministic test state.",
    "- Write Path: validate input, update local/server state once, then refresh derived views without duplicate state copies.",
    "- Error Path: preserve last good data, set lastError/storageStatus, show retry/clear actions, and keep drafts when safe.",
    "- Side Effects: persistence writes, analytics/logging only when explicitly in scope, and no hidden network calls for local-only products.",
    ...mockDataContract(kind, entity, dbRequired),
    "",
    "## 3. Behavioral And Action Contract",
    actions.join("\n\n"),
    "",
    "## 4. Product Surfaces",
    surfaceSection,
    "",
    "## 5. Validation And Error Strategy",
    "- Validation Rules: required text fields cannot be empty; status/enum values must be known; dates/timestamps must be parseable; destructive actions require explicit user intent.",
    "- Business Logic Errors: show contextual messages near the action and keep the previous valid state.",
    "- System/Network Errors: show a retryable banner or inline state with lastError details suitable for QA, not a silent reset.",
    "- Error Display Policy: forms use inline errors; global load/persist failures use compact banners or state panels; no blocking alert dialogs unless the platform requires them.",
    "",
    "## 6. System Contracts",
    "### environment_contract",
    "- Required Keys: none by default; list key names only when an external provider is required.",
    "- Optional Keys: none by default.",
    "- Secret Handling: MC/runtime supplies values; PLAN never emits values, .env contents, or local secret paths.",
    "- Client Exposed Keys: none unless an explicitly public provider key is required.",
    "- Missing Key Behavior: fail the relevant setup/verify gate with a structured error, never silently substitute fake credentials.",
    "- External Integrations: none by default. If task requests Stripe, Supabase, Firebase, email, maps, or another provider, define provider purpose and failure behavior here.",
    "- Permission Model: anonymous/local by default; if auth is requested, define roles and unauthorized effects per action and surface.",
    "- Security: never expose secrets in client code; persistence errors must be visible; user data should not be silently discarded.",
    "",
    "## 7. Platform Contract",
    platformContract(kind, stack),
    "",
    "## 8. Testability Contract",
    "- Critical Path TC_LOAD_READY: launch product, observe primary surface or command/API readiness, and verify no placeholder/marketing-only first state.",
    "- Critical Path TC_PRIMARY_ACTION: execute the main action from the task and verify visible or response-state change.",
    "- Critical Path TC_ERROR_RECOVERY: force invalid input or a recoverable load/persist failure and verify user feedback plus retry/clear path.",
    stack === "react-native-expo" || stack === "android-native" || stack === "ios-native"
      ? "- Test Handle Policy: every interactive control uses testID; do not rely on window.app."
      : platform === "api"
        ? "- Test Handle Policy: endpoint assertions validate status codes, DTO shape, and error envelope."
        : platform === "cli"
          ? "- Test Handle Policy: stdout/stderr and exit codes are the verification interface."
          : "- Test Handle Policy: every interactive control uses data-testid; expose deterministic window.app state for smoke/final-test when TECH_STACK allows browser globals.",
    "- API Mock Hints: only generate mocks for declared external dependencies or server endpoints.",
    "",
    "## 9. Out Of Scope",
    "- No repo paths, branch names, GitHub URLs, run slugs, package names, or hardcoded local/server directories in PLAN.",
    "- No physical screen table, screen-count field, or agent-invented screen list in PLAN.",
    "- DESIGN receives only scoped UI-facing context derived from Product Surfaces, display fields, permitted actions, validation behavior, and UI anti-goals.",
    "- No modules outside Product Surfaces, Action Contracts, or explicit task requirements.",
    designRequired
      ? "- No local fallback design; DESIGN must use Stitch when DESIGN_REQUIRED=true and must block on Stitch failure."
      : "- No visual design step for DESIGN_REQUIRED=false platform contracts; downstream work must follow the behavioral/platform contract.",
  ].join("\n");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (process.env.SETFARM_DISABLE_AUTO_PLAN === "1") return;

  const output = buildAutoPlanOutput(ctx.task || ctx.context["task"] || "", { runId: ctx.runId });
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
