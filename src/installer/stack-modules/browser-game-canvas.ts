import fs from "node:fs";
import path from "node:path";
import type { StackClaimChecklistContext, StackPlanContext, StackRetryFeedbackContext, StackRuntimeIssueContext } from "./types.js";
import { stackPackFromRepo } from "../stack-contract/identity.js";

function normalizeRelPath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function readTextIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function stripSourceComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function listSourceFiles(root: string, relDir = ""): string[] {
  const absDir = path.join(root, relDir);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const rel = normalizeRelPath(path.join(relDir, entry.name));
    if (entry.isDirectory()) {
      if (/^(node_modules|dist|build|coverage|\.git|\.next|stitch|references)$/.test(entry.name)) continue;
      out.push(...listSourceFiles(root, rel));
      continue;
    }
    if (/\.(tsx?|jsx?)$/i.test(entry.name)) out.push(rel);
  }
  return out;
}

function hasBrowserGameStackContract(workdir: string, repoPath = ""): boolean {
  const roots = [workdir, repoPath].filter((root, index, arr) => root && fs.existsSync(root) && arr.indexOf(root) === index);
  return roots.some((root) => stackPackFromRepo(root) === "browser-game-canvas");
}

export function browserGameRuntimeSemanticIssues(context: StackRuntimeIssueContext): string[] {
  const workdir = context.workdir;
  if (!workdir || !fs.existsSync(workdir)) return [];
  if (!hasBrowserGameStackContract(workdir, context.repoPath || "")) return [];

  const allSource = listSourceFiles(workdir)
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file))
    .map((file) => `\n// FILE: ${file}\n${readTextIfExists(path.join(workdir, file))}`)
    .join("\n");
  const clean = stripSourceComments(allSource);
  const hasTimerPrimitive = /\b(?:setInterval|requestAnimationFrame)\s*\(/.test(clean);
  const dispatchesRuntimeAction =
    /\b(?:dispatch|[A-Za-z_$][\w$]*(?:Ref)?\.current)\s*\(\s*\{[\s\S]{0,240}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`]/i.test(clean);
  const namedRafDispatchLoop =
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]{0,2400}\b(?:dispatch|[A-Za-z_$][\w$]*Ref\.current)\s*\(\s*\{[\s\S]{0,240}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`][\s\S]{0,2400}\brequestAnimationFrame\s*\(\s*\1\s*\)/i.test(clean) ||
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{[\s\S]{0,2400}\b(?:dispatch|[A-Za-z_$][\w$]*Ref\.current)\s*\(\s*\{[\s\S]{0,240}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`][\s\S]{0,2400}\brequestAnimationFrame\s*\(\s*\1\s*\)/i.test(clean);
  const hasScheduledRuntimeAction =
    (hasTimerPrimitive && dispatchesRuntimeAction) ||
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\b(?:actions?\.)?(?:tick|advance|step|update)[A-Za-z0-9_]*\s*(?:\(|,|\))/i.test(clean) ||
    /\b(?:tick|advance|step|update)[A-Za-z0-9_]*\s*\([^)]*\)\s*[\s\S]{0,800}\b(?:setInterval|requestAnimationFrame)\s*\(/i.test(clean) ||
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\b(?:dispatch|[A-Za-z_$][\w$]*Ref\.current)\s*\(\s*\{[\s\S]{0,180}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`]/i.test(clean) ||
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\bset[A-Z][A-Za-z0-9_]*\s*\([\s\S]{0,300}\b(?:tick|advance|step|update)[A-Za-z0-9_]*\s*\(/i.test(clean) ||
    namedRafDispatchLoop;

  if (hasTimerPrimitive && hasScheduledRuntimeAction) return [];
  return [
    "BROWSER_GAME_RUNTIME_LOOP_MISSING: browser-game projects must wire a visible runtime loop with setInterval/requestAnimationFrame and a scheduled tick/advance/step/update action. Defining an advance reducer or exposing a manual settings button is not enough; the playable scene must move or progress without manual debug calls.",
  ];
}

export function browserGameClaimDoneChecklist(_context: StackClaimChecklistContext): string[] {
  return [
    "Browser-game interactive stories must keep every data-setfarm-root wrapper as a neutral viewport frame: className includes relative, min-h-screen or h-screen, w-full or w-screen, and overflow-hidden.",
    "Browser-game runtime must contain a visible scheduled loop using setInterval or requestAnimationFrame that dispatches or calls a tick/advance/step/update action; reducer definitions without a timer do not count.",
    "Interactive runtime state must be exposed from live source through window.app or globalThis.app with state and actions; window.game, comments, and type declarations do not count.",
    "Generated Stitch screens must remain imported/reachable and wired through their declared actions prop IDs; do not replace generated gameplay/settings screens with custom shells.",
    "Before STATUS: done, run build/test and search scoped source for the runtime loop primitive plus window.app/globalThis.app assignment.",
  ];
}

export function browserGameSanitizeRetryFeedback(context: StackRetryFeedbackContext): string {
  const feedback = context.feedback;
  if (!/\b(?:BROWSER_GAME_RUNTIME_LOOP_MISSING|Browser-game runtime|browser-game projects|gameplay runtime|GAME_RUNTIME)\b/i.test(feedback)) {
    return feedback;
  }
  const candidateRepos = [...new Set([context.contractRepoPath, context.repoPath].map((item) => String(item || "").trim()).filter(Boolean))];
  const stackPacks = candidateRepos.map(stackPackFromRepo).filter(Boolean);
  if (stackPacks.some((packId) => packId === "browser-game-canvas")) return feedback;
  return feedback
    .split(/\n\s*ALSO_FIX:\s*\n/i)
    .filter((block) => !/\b(?:BROWSER_GAME_RUNTIME_LOOP_MISSING|Browser-game runtime|browser-game projects|gameplay runtime|GAME_RUNTIME)\b/i.test(block))
    .join("\n\nALSO_FIX:\n")
    .trim();
}

export function browserGamePlanPlatformContract(_context: StackPlanContext): string {
  return "- Type: Game\n- Runtime: browser game loop or React-hosted simulation depending on TECH_STACK.\n- Input Model: keyboard and touch controls are first-class and visible/recoverable.\n- Pause/Restart: pause freezes simulation; restart resets session state without clearing high score/preferences.\n- Save State: high score/preferences only unless task asks for saved games.\n- Design Conversion Policy: reference visual shell/overlays only; gameplay runtime and physics are implemented from action/state contracts.\n### route_guard_policy\n- Protected Surfaces: none by default.\n- Public Surfaces: SURF_GAMEPLAY and SURF_GAME_SETTINGS.\n- Guard Implementation Owner: app/game shell story owns panel visibility only.";
}

export function browserGamePlanUiVisionSummary(context: StackPlanContext): string {
  return `${context.projectName} should feel like a playable browser game from the first viewport, with the playfield, score, pause/restart controls, and recovery states immediately visible. Stitch may design the game shell, HUD, overlays, and settings surfaces, but gameplay runtime details remain governed by the GameSession action/state contract. The design should avoid generic dashboards and keep every visual element tied to play, progress, input, or recovery.`;
}

export function browserGamePlanMockDataContract(_context: StackPlanContext): string[] {
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
