import {
  collectUiBehaviorRequirements,
  type UiBehaviorRequirement,
} from "./context.js";
import type { PrdSurfaceAction } from "./prd-contract-parser.js";

export interface PredictedScreenRef {
  screenId: string;
  title: string;
  filePath: string;
}

export interface StoryOwnedAction {
  id: string;
  trigger: string;
  state_change: string;
  ui_feedback: string;
  surface_id?: string;
  control_hint?: string;
  generated_action_ids?: string[];
}

export function normalizeActionKey(text: string): string {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(text: string, fallback: string): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 180) : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function surfaceIdWords(surfaceId?: string): string[] {
  return normalizeActionKey(String(surfaceId || "").replace(/^SURF_/i, "").replace(/_/g, " "))
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function surfaceActionMatchesScreen(action: PrdSurfaceAction, screen: PredictedScreenRef): boolean {
  const title = normalizeActionKey(`${screen.screenId} ${screen.title} ${screen.filePath}`);
  const surfaceName = normalizeActionKey(action.surfaceName || "");
  if (surfaceName && title.includes(surfaceName)) return true;

  const words = surfaceIdWords(action.surfaceId);
  if (words.length > 0 && words.every((word) => title.includes(word))) return true;
  if (words.length > 1 && words.filter((word) => title.includes(word)).length >= Math.min(2, words.length)) return true;
  return false;
}

export function surfaceActionsForScreens(
  predicted: PredictedScreenRef[],
  screenIds: string[],
  actions: PrdSurfaceAction[],
): PrdSurfaceAction[] {
  if (actions.length === 0) return [];
  const screenSet = new Set(screenIds);
  const screens = predicted.filter((screen) => screenSet.has(screen.screenId));
  return actions.filter((action) => screens.some((screen) => surfaceActionMatchesScreen(action, screen)));
}

function actionIdForRequirement(req: UiBehaviorRequirement): string {
  const raw = req.action || req.label || req.kind;
  const suffix = String(raw || "action")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `ACT_${suffix || "ACTION"}`;
}

function semanticActionVerb(actionId: string): string {
  return normalizeActionKey(actionId.replace(/^ACT_/i, "").replace(/_/g, " ")).split(/\s+/)[0] || "action";
}

function requirementKey(req: UiBehaviorRequirement): string {
  return normalizeActionKey([
    req.kind,
    req.label,
    req.icon,
    req.action,
    req.route,
    req.expectedBehavior,
  ].filter(Boolean).join(" "));
}

function generatedActionToken(req: UiBehaviorRequirement): string {
  return compactText(String(req.action || req.label || req.kind || "control"), "control");
}

function semanticActionMatchesRequirement(action: PrdSurfaceAction, req: UiBehaviorRequirement): boolean {
  const key = requirementKey(req);
  const verb = semanticActionVerb(action.id);
  const hint = normalizeActionKey(action.controlHint || "");
  if (hint.includes("search") && /\b(search|filter|query)\b/.test(key)) return true;
  if (hint.includes("form") && /\b(save|submit|change|apply|persist|cancel|close|back)\b/.test(key)) return true;
  if (hint.includes("button") && verb && key.includes(verb)) return true;
  if (hint.includes("inline") && /\b(select|edit|update|status|assign)\b/.test(key)) return true;
  if (hint.includes("context") && /\b(assign|export|filter|menu|more|action)\b/.test(key)) return true;
  return Boolean(verb && key.includes(verb));
}

function semanticStateChange(action: PrdSurfaceAction): string {
  const key = normalizeActionKey(action.id);
  if (/\bsearch|filter\b/.test(key)) return "Update query/filter state and derive the visible result set from shared product data.";
  if (/\bcreate|open\b/.test(key)) return "Open the requested editor/detail context and initialize the required draft or selected record state.";
  if (/\bsave|submit|preferences\b/.test(key)) return "Validate input, persist the requested state change, and refresh derived visible product state.";
  if (/\bcancel|close|back\b/.test(key)) return "Close the active editor/panel without losing the previous valid shared state.";
  if (/\bretry|load|recover\b/.test(key)) return "Retry the recoverable operation, preserve last known good data, and update loading/error status.";
  if (/\bassign|reassign\b/.test(key)) return "Update ownership/assignment state and all derived workload/activity indicators.";
  if (/\bstatus|queue|stage|priority|update\b/.test(key)) return "Update record workflow status and keep queue/status aggregates consistent.";
  if (/\bexport|download\b/.test(key)) return "Generate an export/copy state from the current visible filters and record export status.";
  return `Apply ${action.id} to shared app state with visible deterministic feedback.`;
}

function semanticUiFeedback(action: PrdSurfaceAction): string {
  const key = normalizeActionKey(action.id);
  if (/\bsearch|filter\b/.test(key)) return "Result count, active filters, or empty state changes visibly.";
  if (/\bsave|submit|preferences\b/.test(key)) return "Validation, loading, success, and retryable failure feedback are visible.";
  if (/\bcancel|close|back\b/.test(key)) return "The editor/panel visibly closes or shows an unsaved-change choice.";
  if (/\bretry|load|recover\b/.test(key)) return "Loading, recovered data, or retryable error state is visible.";
  if (/\bassign|status|queue|stage|priority|update\b/.test(key)) return "Badges, lanes, counts, timestamps, or activity feed update visibly.";
  if (/\bexport|download\b/.test(key)) return "Export progress, confirmation, or retryable export failure is visible.";
  return "Visible DOM/state/URL feedback matching the PRD action and generated Stitch control.";
}

export function buildOwnedActionsForScreens(
  repo: string,
  screenIds: string[],
  semanticActions: PrdSurfaceAction[] = [],
): StoryOwnedAction[] {
  const screenSet = new Set(screenIds);
  const reqs = collectUiBehaviorRequirements(repo).filter((req) => screenSet.has(req.screenId));
  const coveredReqs = new Set<UiBehaviorRequirement>();
  const semanticContracts = semanticActions.map((action) => {
    const matches = reqs.filter((req) => semanticActionMatchesRequirement(action, req));
    for (const req of matches) coveredReqs.add(req);
    return {
      id: action.id,
      trigger: `${action.surfaceName || action.surfaceId || "Owned surface"}: ${action.id}${action.controlHint ? ` (${action.controlHint})` : ""}`,
      state_change: semanticStateChange(action),
      ui_feedback: semanticUiFeedback(action),
      surface_id: action.surfaceId,
      control_hint: action.controlHint,
      generated_action_ids: unique(matches.map(generatedActionToken)),
    };
  });

  const fallbackContracts = reqs
    .filter((req) => !coveredReqs.has(req))
    .slice(0, Math.max(0, 20 - semanticContracts.length))
    .map((req) => ({
      id: actionIdForRequirement(req),
      trigger: `${req.screenTitle}: ${req.kind} "${req.label}"`,
      state_change: req.expectedBehavior,
      ui_feedback: "Visible DOM/state/URL feedback matching the generated Stitch control.",
    }));

  const seen = new Set<string>();
  return [...semanticContracts, ...fallbackContracts].filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}
