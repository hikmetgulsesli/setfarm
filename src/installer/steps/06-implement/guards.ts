/**
 * 06-implement guards — scope enforcement, design compliance, test runner.
 *
 * Extracted from step-ops.ts completeStep loop block (lines 2537-2872).
 * Called from step-ops.ts during loop story completion.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pgGet, pgQuery, pgRun } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import type { ParsedOutput, ValidationResult } from "../types.js";
import { buildTestFixPrompt, detectTestFramework, runTests } from "../../test-generation.js";
import { isImplicitStoryScopeFile } from "../../story-scope.js";
import { ensureStoryBranchWorktree, latestRetryPatchForStory, latestRetryStashPatchForStory } from "../../worktree-ops.js";
import { buildSupervisorChecklistFromProject } from "../../supervisor/checklist.js";
import { formatSupervisorBlockerFeedback } from "../../supervisor/intervention.js";
import { runImplementSupervisorScan } from "../../supervisor/run-supervisor.js";
import { formatSupervisorFindings, scanSupervisorChecklist } from "../../supervisor/scanner.js";
import type { SupervisorFinding } from "../../supervisor/types.js";
import { resolvePlatformScript } from "../../paths.js";
import { ensureSmokeBuildFresh } from "../../smoke-gate.js";
import { summarizeImplementEvidenceValidation, validateImplementEvidenceArtifacts } from "../../implement-evidence.js";
import { classifyError } from "../../error-taxonomy.js";
import { hasBrowserGameIntent } from "../../task-intent.js";

// ── Module interface methods ────────────────────────────────────

export function normalize(parsed: ParsedOutput): void {
  // Trim STATUS to first word (multi-line leak fix from Wave 13+)
  if (parsed["status"]) {
    const raw = parsed["status"].trim();
    parsed["status"] = (raw.indexOf("\n") >= 0 ? raw.slice(0, raw.indexOf("\n")).trim() : raw).split(/\s/)[0].toLowerCase();
  }
  if (!parsed["changes"]) {
    parsed["changes"] =
      parsed["summary"] ||
      parsed["implementation_summary"] ||
      parsed["change_summary"] ||
      parsed["files_changed"];
  }
  if (!parsed["story_branch"] && parsed["storybranch"]) {
    parsed["story_branch"] = parsed["storybranch"];
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];
  const status = (parsed["status"] || "").toLowerCase();
  if (!status) errors.push("Missing STATUS field");
  if (status === "done" && !parsed["changes"] && !parsed["story_branch"]) {
    errors.push("STATUS: done requires CHANGES or STORY_BRANCH field");
  }
  return { ok: errors.length === 0, errors };
}

// ── Scope enforcement (called from step-ops loop completion) ────

export interface ScopeCheckResult {
  passed: boolean;
  reason?: string;
  category?: string;
  suggestion?: string;
  outOfScope?: string[];
}

const SCOPE_EXTS = /\.(tsx?|jsx?|vue|svelte|css|scss|html)$/i;
const SCOPE_IGNORE = /^(node_modules\/|dist\/|\.next\/|build\/|coverage\/|stitch\/|references\/|DESIGN\.md|PROJECT_MEMORY\.md|\.gitignore|package(-lock)?\.json|tsconfig|vite\.config|tailwind\.config|postcss\.config|eslint\.config|README|index\.html$)/;

function isImplicitSharedSourceFile(f: string): boolean {
  return isImplicitStoryScopeFile(f);
}

export function getOutOfScopeStoryFiles(sourceFiles: string[], declaredScopeFiles: string[]): string[] {
  const allowed = new Set<string>();
  declaredScopeFiles.forEach(f => allowed.add(f));
  if (allowed.size === 0) return [];
  return sourceFiles.filter(f => !allowed.has(f) && !isImplicitSharedSourceFile(f));
}

function parseScopeFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((f: any) => typeof f === "string");
  } catch {}
  return [];
}

export function computeScopeFileLimits(hasDeps: boolean, declaredScopeFiles: string[], declaredSharedFiles: string[] = [], implicitTouchedFiles: string[] = []): { hardLimit: number; softLimit: number } {
  const baseHardLimit = hasDeps ? 30 : 12;
  const baseSoftLimit = hasDeps ? 20 : 8;
  const ceiling = hasDeps ? 50 : 30;
  void declaredSharedFiles;
  const declaredSourceCount = [...new Set([...declaredScopeFiles, ...implicitTouchedFiles])].filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f)).length;
  const dynamicHardLimit = declaredSourceCount > 0 ? Math.min(ceiling, declaredSourceCount + 6) : baseHardLimit;
  const hardLimit = Math.max(baseHardLimit, dynamicHardLimit);
  const softLimit = Math.max(baseSoftLimit, Math.ceil(hardLimit * 0.7));
  return { hardLimit, softLimit };
}

export function detectPackageBuildCommand(workdir: string): string[] | null {
  try {
    const pkgPath = path.join(workdir, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg?.scripts?.build) return ["npm", "run", "build"];
  } catch {}
  return null;
}

function summarizeBuildFailure(err: any): string {
  const raw = `${err?.stdout || ""}\n${err?.stderr || ""}\n${err?.message || ""}`;
  return raw
    .split("\n")
    .map((line: string) => line.trimEnd())
    .filter(Boolean)
    .slice(-40)
    .join("\n")
    .slice(0, 3000);
}

function summarizeTestFailure(text: string): string {
  return String(text || "")
    .split("\n")
    .map((line: string) => line.trimEnd())
    .filter(Boolean)
    .slice(-80)
    .join("\n")
    .slice(0, 3000);
}

export function parseGitStatusPorcelainPath(line: string): string {
  if (!line || !line.trim()) return "";
  const raw = line.slice(3).trim().replace(/^"|"$/g, "");
  if (!raw) return "";
  if (raw.includes(" -> ")) {
    return raw.split(" -> ").map((part) => part.trim().replace(/^"|"$/g, "")).filter(Boolean).pop() || "";
  }
  return raw;
}

function listTouchedFiles(workdir: string, baseBranch: string): string[] {
  const files = new Set<string>();
  try {
    const diffOut = execFileSync("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
      cwd: workdir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).trim();
    diffOut.split("\n").map(s => s.trim()).filter(Boolean).forEach(f => files.add(f));
  } catch {}
  try {
    const statusOut = execFileSync("git", ["status", "--porcelain", "-uall"], {
      cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    });
    statusOut.split(/\r?\n/).map(parseGitStatusPorcelainPath).filter(Boolean).forEach(f => files.add(f));
  } catch {}
  return [...files];
}

function stripSourceComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function booleanAttributeIsTruthy(attrs: string, name: string): boolean {
  const match = new RegExp(`\\b${name}\\b(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*([^}]+?)\\s*\\}))?`, "i").exec(attrs);
  if (!match) return false;
  const value = (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();
  if (!value) return true;
  return !["false", "0", "null", "undefined"].includes(value);
}

export function sourceExposesWindowApp(source: string): boolean {
  const clean = stripSourceComments(source);
  return (
    /\b(?:window|globalThis)\s*(?:\.\s*app|\[\s*["']app["']\s*\])\s*=/.test(clean) ||
    /\(\s*(?:window|globalThis)(?:\s+as\s+[^)]+)+\)\s*(?:\.\s*app|\[\s*["']app["']\s*\])\s*=/.test(clean)
  );
}

export function checkBuildGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  retryCount: number,
  maxRetries: number,
): ScopeCheckResult {
  if (!workdir || retryCount >= maxRetries) return { passed: true };
  const cmd = detectPackageBuildCommand(workdir);
  if (!cmd) return { passed: true };

  try {
    execFileSync(cmd[0], cmd.slice(1), {
      cwd: workdir,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    return { passed: true };
  } catch (err: any) {
    const summary = summarizeBuildFailure(err);
    return {
      passed: false,
      reason: `BUILD_FAILED: Story ${storyId} (${storyTitle}) reported STATUS: done but npm run build failed.\n${summary}`,
      category: "BUILD_FAILED",
      suggestion: "Fix TypeScript/build errors in the story worktree, then run npm run build before completing",
    };
  }
}

export function checkTestGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  baseBranch: string,
  retryCount: number,
  maxRetries: number,
): ScopeCheckResult {
  if (!workdir || !baseBranch || retryCount >= maxRetries) return { passed: true };
  const touched = listTouchedFiles(workdir, baseBranch);
  const touchedTests = touched.filter(f => /\.(test|spec)\.(tsx?|jsx?)$/i.test(f));
  if (touchedTests.length === 0) return { passed: true };

  const framework = detectTestFramework(workdir);
  if (framework.runner === "none") return { passed: true };

  const result = runTests(workdir, framework);
  if (result.passed) return { passed: true };
  const summary = summarizeTestFailure([
    result.errorSummary,
    result.rawOutput,
  ].filter(Boolean).join("\n"));
  return {
    passed: false,
    reason: `TEST_FAILED: Story ${storyId} (${storyTitle}) reported STATUS: done but its touched test files fail under ${framework.command}. Touched tests: ${touchedTests.slice(0, 12).join(", ")}\n${summary}`,
    category: "TEST_FAILED",
    suggestion: buildTestFixPrompt(result),
  };
}

export async function checkRuntimeBridgeGate(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
): Promise<ScopeCheckResult> {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const storyRow = await pgGet<{ description: string | null; acceptance_criteria: string | null; scope_files: string | null }>(
    "SELECT description, acceptance_criteria, scope_files FROM stories WHERE id = $1",
    [currentStoryDbId],
  );
  const storyText = [
    storyTitle,
    storyRow?.description || "",
    storyRow?.acceptance_criteria || "",
  ].join("\n");
  if (!/\bwindow\.app\b/i.test(storyText)) return { passed: true };

  const scopeFiles = parseScopeFiles(storyRow?.scope_files)
    .filter(f => /\.(tsx?|jsx?)$/i.test(f))
    .filter(f => fs.existsSync(path.join(workdir, f)));
  for (const rel of scopeFiles) {
    try {
      const source = fs.readFileSync(path.join(workdir, rel), "utf-8");
      if (sourceExposesWindowApp(source)) return { passed: true };
    } catch {}
  }

  return {
    passed: false,
    reason: `RUNTIME_BRIDGE_MISSING: Story ${storyId} (${storyTitle}) acceptance criteria require window.app, but no scoped source file assigns window.app/globalThis.app. window.game, comments, or type declarations are not enough; expose the live runtime state bridge from a React effect or equivalent update point.`,
    category: "RUNTIME_BRIDGE_MISSING",
    suggestion: "Assign window.app/globalThis.app with live screen/status, score/progress where present, level/difficulty where present, paused/gameOver, domain entities, storageStatus/lastError state, and action hooks before reporting STATUS: done.",
  };
}


function cleanupSmokeArtifacts(workdir: string): void {
  for (const name of ["smoke-home.png", "smoke-after-click.png"]) {
    try { fs.rmSync(path.join(workdir, name), { force: true }); } catch {}
  }
}

function summarizeSmokeFailure(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "smoke-test exited non-zero without output";

  try {
    const parsed = JSON.parse(trimmed);
    const lines: string[] = [];
    if (parsed.status) lines.push(`status=${parsed.status}`);
    if (typeof parsed.confidence === "number") lines.push(`confidence=${parsed.confidence}`);
    if (typeof parsed.buttonWiringIssues === "number") lines.push(`buttonWiringIssues=${parsed.buttonWiringIssues}`);
    if (Array.isArray(parsed.buttonWiringDetails) && parsed.buttonWiringDetails.length > 0) {
      lines.push("buttonWiringDetails:");
      for (const detail of parsed.buttonWiringDetails.slice(0, 12)) lines.push(`- ${detail}`);
    }
    if (Array.isArray(parsed.consoleErrors) && parsed.consoleErrors.length > 0) {
      lines.push("consoleErrors:");
      for (const detail of parsed.consoleErrors.slice(0, 8)) lines.push(`- ${detail}`);
    }
    if (Array.isArray(parsed.failures) && parsed.failures.length > 0) {
      lines.push("failures:");
      for (const failure of parsed.failures.slice(0, 16)) lines.push(`- ${failure}`);
    }
    return (lines.join("\n") || trimmed).slice(0, 3000);
  } catch {}

  return trimmed
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-80)
    .join("\n")
    .slice(0, 3000);
}

export function checkQaFixSmokeGate(storyId: string, storyTitle: string, workdir: string): ScopeCheckResult {
  if (!/^QA-FIX-\d+/i.test(storyId)) return { passed: true };
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };

  const smokeScript = resolvePlatformScript("smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) return { passed: true };

  try {
    const buildFresh = ensureSmokeBuildFresh(workdir, {
      logPrefix: "qa-fix-smoke-prebuild",
      stepId: "implement",
    });
    if (!buildFresh.ok) {
      cleanupSmokeArtifacts(workdir);
      return {
        passed: false,
        reason: `QA_FIX_SMOKE_PREBUILD_FAILED: Story ${storyId} (${storyTitle}) reported STATUS: done but the project build failed before platform smoke-test could run.\n${buildFresh.failure}`,
        category: "QA_FIX_SMOKE_PREBUILD_FAILED",
        suggestion: "Fix the project build first. QA-FIX smoke evidence must be produced from fresh build artifacts, not stale dist output.",
      };
    }
    execFileSync("node", [smokeScript, workdir], {
      cwd: workdir,
      timeout: 180000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    cleanupSmokeArtifacts(workdir);
    return { passed: true };
  } catch (err: any) {
    const summary = summarizeSmokeFailure(`${err?.stdout || ""}\n${err?.stderr || ""}\n${err?.message || ""}`);
    cleanupSmokeArtifacts(workdir);
    return {
      passed: false,
      reason: `QA_FIX_SMOKE_STILL_FAILING: Story ${storyId} (${storyTitle}) reported STATUS: done but platform smoke-test still fails on the story worktree.\n${summary}`,
      category: "QA_FIX_SMOKE_STILL_FAILING",
      suggestion: "Fix every reported UNWIRED_BUTTON, blank page, console, network, hydration, and layout failure before reporting STATUS: done. Disabled placeholder controls must use disabled or aria-disabled; active controls need real behavior.",
    };
  }
}

export function checkImplementEvidenceGate(storyId: string, storyTitle: string, workdir: string): ScopeCheckResult {
  const safeStoryId = storyId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const evidenceDir = path.join(workdir, ".setfarm", "implement", safeStoryId);
  const hasRuntimeSurfaceContract = fs.existsSync(path.join(workdir, "src", "screens", "SCREEN_INDEX.json"));
  if (!hasPackageScript(workdir, "preview") && !hasRuntimeSurfaceContract && !fs.existsSync(evidenceDir)) {
    return {
      passed: true,
      reason: "Implement evidence skipped: package.json has no preview script and no generated screen contract, so this story is treated as non-runtime evidence scope.",
    };
  }
  const result = validateImplementEvidenceArtifacts(workdir, storyId);
  const summary = summarizeImplementEvidenceValidation(result);
  if (!result.ok) {
    const evidenceRuntimeDetails = summarizeRuntimeEvidenceFailures(result.artifactPaths.evidence);
    const details = [
      result.missingArtifacts.length > 0 ? `Missing artifacts: ${result.missingArtifacts.join(", ")}` : "",
      ...result.issues.map((issue) => `${issue.code}: ${issue.message}`),
      evidenceRuntimeDetails,
    ].filter(Boolean).join("\n");
    const visualIssue = result.issues.find((issue) => issue.code.startsWith("VISUAL_EVIDENCE"));
    const classified = classifyError(`IMPLEMENT_EVIDENCE_INCOMPLETE:\n${details}`);
    return {
      passed: false,
      category: visualIssue?.code || classified.category || "IMPLEMENT_EVIDENCE_INCOMPLETE",
      reason: `IMPLEMENT_EVIDENCE_INCOMPLETE: Story ${storyId} (${storyTitle}) reported STATUS: done without acceptable orchestrator-owned implementation evidence.\n${summary}\n${details}`,
      suggestion: classified.category !== "IMPLEMENT_EVIDENCE_INCOMPLETE"
        ? classified.suggestion
        : "Write IMPLEMENT_INTENT.json and IMPLEMENT_VERIFICATION_REQUEST.json, then let Setfarm generate IMPLEMENT_EVIDENCE.json from runtime execution. Do not self-certify flow success in prose.",
    };
  }
  return {
    passed: true,
    reason: summary,
  };
}

function summarizeRuntimeEvidenceFailures(evidencePath: string | undefined): string {
  if (!evidencePath || !fs.existsSync(evidencePath)) return "";
  try {
    const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf-8"));
    const lines: string[] = [];
    if (Array.isArray(evidence?.issues)) {
      for (const issue of evidence.issues.slice(0, 4)) {
        const code = String(issue?.code || "IMPLEMENT_EVIDENCE_RUNTIME_ISSUE").trim();
        const message = String(issue?.message || issue?.detail || "").replace(/\s+/g, " ").trim();
        if (message) lines.push(`${code}: ${message.slice(0, 700)}`);
      }
    }
    for (const flow of Array.isArray(evidence?.flows) ? evidence.flows : []) {
      for (const interaction of Array.isArray(flow?.interactions) ? flow.interactions : []) {
        const status = String(interaction?.status || "").toLowerCase();
        if (status && status !== "pass" && status !== "passed") {
          const id = String(interaction?.id || flow?.flowId || "interaction");
          const detail = String(interaction?.detail || interaction?.error || interaction?.message || "").replace(/\s+/g, " ").trim();
          lines.push(`IMPLEMENT_INTERACTION_FAILED: ${id}${detail ? `: ${detail.slice(0, 900)}` : ""}`);
        }
      }
      if (lines.length >= 6) break;
    }
    return lines.length > 0 ? `Runtime evidence details:\n${lines.slice(0, 6).join("\n")}` : "";
  } catch (err: any) {
    return `Runtime evidence details unavailable: ${String(err?.message || err).slice(0, 300)}`;
  }
}

function hasPackageScript(workdir: string, scriptName: string): boolean {
  try {
    const pkgPath = path.join(workdir, "package.json");
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return typeof pkg?.scripts?.[scriptName] === "string" && pkg.scripts[scriptName].trim().length > 0;
  } catch {
    return false;
  }
}

type JsxBlock = { attrs: string; inner: string; index: number };

const ICON_ALIASES: Record<string, string[]> = {
  analytics: ["BarChart3", "ChartBar", "LineChart", "analytics"],
  assignment_return: ["PackageCheck", "Undo2", "ClipboardCheck", "assignment_return"],
  arrow_drop_down: ["ChevronDown", "ArrowDown", "CaretDown", "arrow_drop_down"],
  arrow_drop_up: ["ChevronUp", "ArrowUp", "CaretUp", "arrow_drop_up"],
  calendar_today: ["CalendarDays", "Calendar", "calendar_today"],
  dashboard: ["LayoutDashboard", "Gauge", "Home", "dashboard"],
  description: ["FileText", "ScrollText", "description"],
  emoji_events: ["Trophy", "Award", "Medal", "emoji_events"],
  filter_list: ["ListFilter", "Filter", "filter_list"],
  help: ["HelpCircle", "CircleHelp", "help"],
  inventory_2: ["PackageSearch", "Archive", "Package", "Boxes", "inventory_2"],
  keyboard_arrow_down: ["ArrowDown", "ChevronDown", "keyboard_arrow_down"],
  keyboard_arrow_left: ["ArrowLeft", "ChevronLeft", "keyboard_arrow_left"],
  keyboard_arrow_right: ["ArrowRight", "ChevronRight", "keyboard_arrow_right"],
  keyboard_arrow_up: ["ArrowUp", "ChevronUp", "keyboard_arrow_up"],
  logout: ["LogOut", "LogOutIcon", "logout"],
  memory: ["Cpu", "MemoryStick", "memory"],
  menu: ["Menu", "menu"],
  menu_book: ["BookOpen", "Book", "NotebookText", "menu_book"],
  notifications: ["Bell", "BellRing", "notifications"],
  play_arrow: ["Play", "play_arrow"],
  play_circle: ["CirclePlay", "PlayCircle", "Play", "play_circle"],
  policy: ["ShieldAlert", "ShieldCheck", "policy"],
  power_settings_new: ["Power", "power_settings_new"],
  refresh: ["RefreshCw", "RefreshCcw", "RotateCw", "refresh"],
  restart_alt: ["RefreshCw", "RefreshCcw", "RotateCcw", "restart_alt"],
  search_off: ["SearchX", "Search", "search_off"],
  sort: ["ArrowUpDown", "ArrowDownUp", "ListFilter", "sort"],
  sports_esports: ["Gamepad2", "Gamepad", "Joystick", "sports_esports"],
  settings: ["Settings", "settings"],
  terminal: ["Terminal", "terminal"],
  tune: ["SlidersHorizontal", "ListFilter", "Settings2", "tune"],
  widgets: ["Boxes", "LayoutGrid", "Grid3X3", "widgets"],
};

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["']([^"']*)["']\\s*\\})`, "i").exec(attrs);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

function isDeadHrefValue(value: string | null): boolean {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "#" || normalized.startsWith("javascript:void(0)");
}

function isExplicitlyInertAnchor(attrs: string): boolean {
  return booleanAttributeIsTruthy(attrs, "aria-current")
    || booleanAttributeIsTruthy(attrs, "aria-disabled")
    || booleanAttributeIsTruthy(attrs, "disabled");
}

function normalizeControlLabel(value: string): string {
  return String(value || "")
    .replace(/\[icon:[^\]]*\]/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedHasTokenPhrase(haystack: string, phrase: string): boolean {
  const compact = normalizeControlLabel(phrase);
  if (!compact) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(compact)}(?:\\s|$)`).test(haystack);
}

function jsxVisibleText(inner: string): string {
  return inner
    .replace(/\{[^}]*\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsxBlocks(source: string, tag: "a" | "button"): JsxBlock[] {
  const clean = stripSourceComments(source);
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks: JsxBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(clean)) !== null) {
    blocks.push({ attrs: match[1] || "", inner: match[2] || "", index: match.index });
  }
  return blocks;
}

function blockHaystack(block: JsxBlock): string {
  return normalizeControlLabel(`${block.attrs} ${jsxVisibleText(block.inner)}`);
}

function blockHasIcon(block: JsxBlock, icon: string): boolean {
  const expected = String(icon || "").trim();
  if (!expected) return true;
  const raw = `${block.attrs}\n${block.inner}`;
  const normalized = normalizeControlLabel(raw);
  const aliases = ICON_ALIASES[expected] || [expected];
  return aliases.some((alias) => {
    if (normalizedHasTokenPhrase(normalized, alias)) return true;
    return new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(raw);
  });
}

function iconExpectationHint(icon: string): string {
  const expected = String(icon || "").trim();
  const aliases = (ICON_ALIASES[expected] || [])
    .filter((alias) => alias && alias !== expected)
    .slice(0, 4);
  return aliases.length > 0 ? ` (accepted SVG aliases: ${aliases.join(", ")})` : "";
}

function blockMatchesControl(block: JsxBlock, control: any): boolean {
  const label = normalizeControlLabel(control?.label || control?.text || "");
  const icon = String(control?.icon || "").trim();
  const haystack = blockHaystack(block);
  if (label && haystack.includes(label)) return true;
  if (icon && blockHasIcon(block, icon)) return true;
  return false;
}

function isDisplayOnlyDesignButton(control: any): boolean {
  const label = String(control?.label || control?.text || "").trim();
  const icon = String(control?.icon || "").trim();
  const classes = Array.isArray(control?.classes) ? control.classes.filter(Boolean) : [];
  if (!label || icon || classes.length > 0) return false;
  return true;
}

function sourceHasVisibleControlText(source: string, label: string): boolean {
  const text = normalizeControlLabel(jsxVisibleText(stripSourceComments(source)));
  return normalizedHasTokenPhrase(text, label);
}

function buttonIsActionable(block: JsxBlock): boolean {
  const attrs = block.attrs || "";
  const isDisabled = booleanAttributeIsTruthy(attrs, "disabled") || booleanAttributeIsTruthy(attrs, "aria-disabled");
  const isSubmit = /\btype\s*=\s*(?:"submit"|'submit'|{\s*["']submit["']\s*})/i.test(attrs);
  const hasHandler = /\bon(?:Click|PointerDown|PointerUp|MouseDown|MouseUp|TouchStart|TouchEnd|KeyDown|Submit)\s*=/.test(attrs);
  return isDisabled || isSubmit || hasHandler;
}

function loadDesignDomScreens(workdir: string, repoPath = ""): any[] {
  const candidates = [
    path.join(workdir, "stitch", "DESIGN_DOM.json"),
    repoPath ? path.join(repoPath, "stitch", "DESIGN_DOM.json") : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.screens)) return parsed.screens;
      if (parsed?.screens && typeof parsed.screens === "object") return Object.values(parsed.screens);
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed).filter((value: any) => value && typeof value === "object" && (value.buttons || value.navLinks || value.navigation || value.links));
      }
    } catch {}
  }
  return [];
}

function loadScreenIndex(workdir: string, repoPath = ""): any[] {
  const candidates = [
    path.join(workdir, "src", "screens", "SCREEN_INDEX.json"),
    repoPath ? path.join(repoPath, "src", "screens", "SCREEN_INDEX.json") : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function designScreenForIndexEntry(entry: any, screens: any[]): any | undefined {
  const entryScreenId = String(entry?.screenId || "").trim();
  const entryTitle = normalizeControlLabel(entry?.title || entry?.name || "");
  return screens.find((screen) => String(screen?.screenId || screen?.id || "").trim() === entryScreenId)
    || screens.find((screen) => normalizeControlLabel(screen?.title || screen?.name || screen?.screenName || "") === entryTitle);
}

export function findDesignDomImplementationFindings(workdir: string, scopeFiles: string[], repoPath = ""): SupervisorFinding[] {
  if (!workdir || !fs.existsSync(workdir) || scopeFiles.length === 0) return [];
  const checklist = buildSupervisorChecklistFromProject({
    runId: "adhoc-scan",
    workdir,
    repoPath,
    scopeFiles,
  });
  if (checklist.items.length === 0) return [];
  return scanSupervisorChecklist(workdir, checklist, scopeFiles).findings
    .filter((finding) => finding.status !== "passed")
    .slice(0, 24);
}

export function findDesignDomImplementationIssues(workdir: string, scopeFiles: string[], repoPath = ""): string[] {
  const blockers = findDesignDomImplementationFindings(workdir, scopeFiles, repoPath)
    .filter((finding) => finding.severity === "blocker");
  return formatSupervisorFindings(blockers).slice(0, 12);
}

type ScreenOwnershipRef = {
  screenId?: string;
  id?: string;
  name?: string;
  title?: string;
  type?: string;
  file?: string;
  filePath?: string;
  componentName?: string;
};

function normalizeRelPath(value: string): string {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseStoryScreenRefs(raw: unknown): ScreenOwnershipRef[] {
  return parseJsonArray(raw)
    .map((item): ScreenOwnershipRef | null => {
      if (typeof item === "string") {
        const value = item.trim();
        return value ? { screenId: value, name: value, title: value } : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        screenId: String(record.screenId || record.id || record.slug || "").trim() || undefined,
        id: String(record.id || "").trim() || undefined,
        name: String(record.name || record.title || record.screenTitle || "").trim() || undefined,
        title: String(record.title || record.name || record.screenTitle || "").trim() || undefined,
        type: String(record.type || record.kind || "").trim() || undefined,
        file: String(record.file || "").trim() || undefined,
        filePath: String(record.filePath || record.path || "").trim() || undefined,
        componentName: String(record.componentName || record.component || "").trim() || undefined,
      };
    })
    .filter((item): item is ScreenOwnershipRef => Boolean(item));
}

function screenRefMatchesIndexEntry(ref: ScreenOwnershipRef, entry: any): boolean {
  const refIds = [
    ref.screenId,
    ref.id,
    ref.name,
    ref.title,
    ref.componentName,
  ].map((value) => normalizeControlLabel(String(value || ""))).filter(Boolean);
  const entryIds = [
    entry?.screenId,
    entry?.id,
    entry?.name,
    entry?.title,
    entry?.componentName,
  ].map((value) => normalizeControlLabel(String(value || ""))).filter(Boolean);
  if (refIds.some((refId) => entryIds.includes(refId))) return true;

  const refFile = normalizeRelPath(ref.filePath || ref.file || "");
  const entryFile = normalizeRelPath(String(entry?.file || ""));
  return Boolean(refFile && entryFile && refFile === entryFile);
}

function componentNameForScreenEntry(entry: any): string {
  const explicit = String(entry?.componentName || "").trim();
  if (explicit) return explicit;
  const file = normalizeRelPath(String(entry?.file || ""));
  const basename = file.split("/").pop()?.replace(/\.(tsx|jsx|ts|js)$/i, "") || "";
  return basename && /^[A-Z][A-Za-z0-9_$]*$/.test(basename) ? basename : "";
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

const PLATFORM_HELPER_CONTAMINATION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "isTilingBackgroundRepeat",
    pattern: /\b(?:isTilingBackgroundRepeat|window\s*\.\s*isTilingBackgroundRepeat|globalThis\s*\.\s*isTilingBackgroundRepeat)\b/,
  },
];

export function findPlatformHelperContaminationIssues(workdir: string, repoPath = ""): string[] {
  const root = workdir && fs.existsSync(workdir) ? workdir : (repoPath && fs.existsSync(repoPath) ? repoPath : "");
  if (!root) return [];

  const issues: string[] = [];
  for (const file of listSourceFiles(root)) {
    if (!/^src\//i.test(file)) continue;
    if (/\.(test|spec)\.(tsx?|jsx?)$/i.test(file)) continue;
    if (/^src\/test\//i.test(file)) continue;

    let source = "";
    try {
      source = fs.readFileSync(path.join(root, file), "utf-8");
    } catch {
      continue;
    }
    const clean = stripSourceComments(source);
    for (const marker of PLATFORM_HELPER_CONTAMINATION_PATTERNS) {
      const match = marker.pattern.exec(clean);
      if (!match) continue;
      issues.push(
        `PLATFORM_HELPER_CONTAMINATION: ${file} contains Setfarm platform helper "${marker.name}". ` +
        "Visual QA/test harness helpers must live in Setfarm, not generated product source.",
      );
      break;
    }
  }
  return issues.slice(0, 20);
}

function sourceRendersComponent(source: string, componentName: string): boolean {
  const clean = stripSourceComments(source);
  const escaped = escapeRegExp(componentName);
  return new RegExp(`<\\s*${escaped}\\b`).test(clean)
    || new RegExp(`React\\.createElement\\(\\s*${escaped}\\b`).test(clean);
}

function sourceReferencesGeneratedScreens(source: string, componentNames: string[]): boolean {
  const clean = stripSourceComments(source);
  if (/from\s+["'][^"']*(?:\/screens|\\screens|src\/screens|src\\screens)/i.test(clean)) return true;
  if (/\bSCREEN_INDEX\b/.test(clean)) return true;
  return componentNames.some((name) => name && sourceRendersComponent(clean, name));
}

const GENERATED_SCREEN_IGNORED_REQUIRED_PROPS = new Set(["children", "className", "style", "ref", "key"]);

function extractTypeOrInterfaceBody(source: string, typeName: string): string {
  const escaped = escapeRegExp(typeName);
  const typeMatch = new RegExp(`\\btype\\s+${escaped}\\s*=\\s*\\{`, "m").exec(source);
  const interfaceMatch = new RegExp(`\\binterface\\s+${escaped}\\s*\\{`, "m").exec(source);
  const match = typeMatch || interfaceMatch;
  if (!match) return "";
  const start = source.indexOf("{", match.index);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return "";
}

function extractRequiredMembers(body: string): string[] {
  const required = new Set<string>();
  const lines = body.split(/\r?\n/);
  let depth = 0;
  for (const line of lines) {
    const match = depth === 0
      ? /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:/.exec(line)
      : null;
    if (match) {
      const name = match[1];
      const optional = Boolean(match[2]);
      if (!optional && !GENERATED_SCREEN_IGNORED_REQUIRED_PROPS.has(name)) required.add(name);
    }
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth = Math.max(0, depth + opens - closes);
  }
  return [...required];
}

function extractGeneratedScreenRequiredProps(source: string, componentName: string): string[] {
  const required = new Set<string>();
  for (const typeName of [`${componentName}Props`, "Props"]) {
    extractRequiredMembers(extractTypeOrInterfaceBody(source, typeName)).forEach((prop) => required.add(prop));
  }
  return [...required];
}

function sourceMissingRequiredPropsForComponent(source: string, componentName: string, requiredProps: string[]): string[] {
  if (requiredProps.length === 0) return [];
  const clean = stripSourceComments(source);
  const jsxRe = new RegExp(`<\\s*${escapeRegExp(componentName)}\\b([^>]*)>`, "g");
  const missing = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = jsxRe.exec(clean)) !== null) {
    const attrs = match[1] || "";
    if (attrs.includes("...")) continue;
    const provided = new Set<string>();
    const attrRe = /\b([A-Za-z_$][\w$]*)\s*=/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(attrs)) !== null) provided.add(attrMatch[1]);
    for (const prop of requiredProps) {
      if (!provided.has(prop)) missing.add(prop);
    }
  }
  return [...missing];
}

export function findGeneratedScreenRequiredPropIssues(workdir: string, repoPath = ""): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const screenIndex = loadScreenIndex(workdir, repoPath);
  if (screenIndex.length === 0) return [];
  const sourceFiles = listSourceFiles(workdir)
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file))
    .filter((file) => !/^src\/screens\/(?:SCREEN_INDEX|index)\./i.test(file));
  const issues: string[] = [];

  for (const entry of screenIndex) {
    const componentName = componentNameForScreenEntry(entry);
    const screenFile = normalizeRelPath(String(entry?.file || entry?.filePath || ""));
    if (!componentName || !screenFile) continue;
    const worktreeScreen = path.join(workdir, screenFile);
    const repoScreen = repoPath ? path.join(repoPath, screenFile) : "";
    const screenSourcePath = fs.existsSync(worktreeScreen) ? worktreeScreen : (repoScreen && fs.existsSync(repoScreen) ? repoScreen : "");
    if (!screenSourcePath) continue;
    let requiredProps: string[] = [];
    try {
      requiredProps = extractGeneratedScreenRequiredProps(fs.readFileSync(screenSourcePath, "utf-8"), componentName);
    } catch {
      requiredProps = [];
    }
    if (requiredProps.length === 0) continue;

    for (const file of sourceFiles) {
      if (file === screenFile || /^src\/screens\//i.test(file)) continue;
      const abs = path.join(workdir, file);
      try {
        const source = fs.readFileSync(abs, "utf-8");
        if (!sourceRendersComponent(source, componentName)) continue;
        const missing = sourceMissingRequiredPropsForComponent(source, componentName, requiredProps);
        if (missing.length > 0) {
          issues.push(`GENERATED_SCREEN_REQUIRED_PROPS_UNWIRED: ${file} renders ${componentName} without required generated screen prop(s): ${missing.join(", ")}. Preserve generated screen prop contracts and wire them from app state/adapters before reporting done.`);
        }
      } catch {}
    }
  }

  return issues.slice(0, 24);
}

function generatedScreenComponents(workdir: string, repoPath = ""): Set<string> {
  return new Set(loadScreenIndex(workdir, repoPath).map(componentNameForScreenEntry).filter(Boolean));
}

function readTextIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function repoLooksLikeBrowserGame(workdir: string, repoPath = ""): boolean {
  const roots = [workdir, repoPath].filter((root, index, arr) => root && fs.existsSync(root) && arr.indexOf(root) === index);
  const combined = roots.map((root) => [
    readTextIfExists(path.join(root, "package.json")),
    readTextIfExists(path.join(root, "stitch", "SCREEN_MAP.json")),
    readTextIfExists(path.join(root, "src", "screens", "SCREEN_INDEX.json")),
    readTextIfExists(path.join(root, ".setfarm", "RUN_CONTRACT.json")),
    readTextIfExists(path.join(root, "PROJECT_MEMORY.md")),
  ].join("\n")).join("\n").toLowerCase();

  return hasBrowserGameIntent(combined);
}

function browserGameRuntimeLoopIssues(workdir: string, repoPath = ""): string[] {
  if (!repoLooksLikeBrowserGame(workdir, repoPath)) return [];
  const allSource = listSourceFiles(workdir)
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file))
    .map((file) => {
      const source = readTextIfExists(path.join(workdir, file));
      return `\n// FILE: ${file}\n${source}`;
    })
    .join("\n");
  const clean = stripSourceComments(allSource);
  const hasTimerPrimitive = /\b(?:setInterval|requestAnimationFrame)\s*\(/.test(clean);
  const namedRafDispatchLoop =
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]{0,2400}\bdispatch\s*\(\s*\{[\s\S]{0,240}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`][\s\S]{0,2400}\brequestAnimationFrame\s*\(\s*\1\s*\)/i.test(clean) ||
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{[\s\S]{0,2400}\bdispatch\s*\(\s*\{[\s\S]{0,240}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`][\s\S]{0,2400}\brequestAnimationFrame\s*\(\s*\1\s*\)/i.test(clean);
  const hasScheduledRuntimeAction =
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\b(?:actions?\.)?(?:tick|advance|step|update)[A-Za-z0-9_]*\s*(?:\(|,|\))/i.test(clean) ||
    /\b(?:tick|advance|step|update)[A-Za-z0-9_]*\s*\([^)]*\)\s*[\s\S]{0,800}\b(?:setInterval|requestAnimationFrame)\s*\(/i.test(clean) ||
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\bdispatch\s*\(\s*\{[\s\S]{0,180}\btype\s*:\s*['"`](?:tick|advance|step|update)['"`]/i.test(clean) ||
    /\b(?:setInterval|requestAnimationFrame)\s*\([\s\S]{0,800}\bset[A-Z][A-Za-z0-9_]*\s*\([\s\S]{0,300}\b(?:tick|advance|step|update)[A-Za-z0-9_]*\s*\(/i.test(clean) ||
    namedRafDispatchLoop;

  if (hasTimerPrimitive && hasScheduledRuntimeAction) return [];
  return [
    "BROWSER_GAME_RUNTIME_LOOP_MISSING: browser-game projects must wire a visible runtime loop with setInterval/requestAnimationFrame and a scheduled tick/advance/step/update action. Defining an advance reducer or exposing a manual settings button is not enough; the playable scene must move or progress without manual debug calls.",
  ];
}

function appRouterFiles(workdir: string): string[] {
  return listSourceFiles(workdir)
    .filter((file) => !/^src\/screens\//i.test(file))
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file))
    .filter((file) => /(^|\/)(App|app|Root|root|Layout|layout|Router|router|main)\.(tsx?|jsx?)$/i.test(file));
}

function gitDiffForFiles(workdir: string, files: string[]): string {
  if (files.length === 0) return "";
  const chunks: string[] = [];
  for (const args of [
    ["diff", "--unified=0", "HEAD", "--", ...files],
    ["diff", "--unified=0", "HEAD^..HEAD", "--", ...files],
  ]) {
    try {
      const out = execFileSync("git", args, {
        cwd: workdir,
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      }).trim();
      if (out) chunks.push(out);
    } catch {}
  }
  return chunks.join("\n");
}

function removedDiffLines(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("-") && !line.startsWith("---"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

function addedDiffLines(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

function extractSurfSegments(line: string): string[] {
  const segments = new Set<string>();
  const re = /(?:^|[./])features\/(surf-[A-Za-z0-9_-]+)\//g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) segments.add(match[1]);
  return [...segments];
}

function extractJsxAttrNames(fragment: string): string[] {
  const attrs = new Set<string>();
  const attrRe = /\b([A-Za-z_$][\w$]*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(fragment)) !== null) {
    const name = match[1];
    if (!["className", "style", "data"].includes(name)) attrs.add(name);
  }
  return [...attrs];
}

function componentHasPropInSources(
  sources: Array<{ file: string; source: string }>,
  componentName: string,
  propName: string,
): boolean {
  const componentRe = new RegExp(`<\\s*${escapeRegExp(componentName)}\\b([^>]*)`, "g");
  for (const { source } of sources) {
    let match: RegExpExecArray | null;
    while ((match = componentRe.exec(source)) !== null) {
      const attrs = match[1] || "";
      if (attrs.includes("...")) return true;
      if (new RegExp(`\\b${escapeRegExp(propName)}\\s*=`).test(attrs)) return true;
    }
  }
  return false;
}

function extractSemanticIntegrationTokens(line: string): string[] {
  const tokens = new Set<string>();
  const attrRe = /\b(data-testid|data-action-id|aria-live|aria-label|role)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(line)) !== null) {
    const name = match[1];
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (!value) continue;
    tokens.add(`${name}=${value}`);
  }
  return [...tokens];
}

function sourceHasSemanticIntegrationToken(source: string, token: string): boolean {
  const [name, value] = token.split("=", 2);
  if (!name || !value) return false;
  const valuePattern = escapeRegExp(value);
  return new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"${valuePattern}"|'${valuePattern}'|\\{\\s*["']${valuePattern}["']\\s*\\})`).test(source);
}

function findAppIntegrationBehaviorRegressionIssues(
  workdir: string,
  previousEntries: Array<{ file: string; componentName: string; title: string }>,
  currentScopeFiles: string[],
): string[] {
  const routerFiles = appRouterFiles(workdir);
  if (routerFiles.length === 0) return [];
  const diff = gitDiffForFiles(workdir, routerFiles);
  if (!diff) return [];

  const scopeSet = new Set(currentScopeFiles.map(normalizeRelPath));
  const scopeText = currentScopeFiles.map(normalizeRelPath).join("\n");
  const removed = removedDiffLines(diff);
  const added = addedDiffLines(diff);
  const issues: string[] = [];

  const removedForeignSurfSegments = new Set<string>();
  for (const line of removed) {
    for (const segment of extractSurfSegments(line)) {
      if (!scopeText.includes(`src/features/${segment}/`) && !scopeText.includes(`features/${segment}/`)) {
        removedForeignSurfSegments.add(segment);
      }
    }
  }
  if (removedForeignSurfSegments.size > 0) {
    issues.push(`APP_INTEGRATION_SCOPE_REGRESSION: app/router diff removes existing feature action wiring outside the current story scope (${[...removedForeignSurfSegments].join(", ")}). Later stories may add their own wiring but must not delete previous story action helpers or keyboard/control bridges without an explicit replacement contract.`);
  }

  const sources = routerFiles.map((file) => {
    try {
      return { file, source: fs.readFileSync(path.join(workdir, file), "utf-8") };
    } catch {
      return { file, source: "" };
    }
  });

  const removedSemanticTokens = new Set<string>();
  for (const line of removed) {
    for (const token of extractSemanticIntegrationTokens(line)) removedSemanticTokens.add(token);
  }
  for (const token of removedSemanticTokens) {
    if (sources.some(({ source }) => sourceHasSemanticIntegrationToken(source, token))) continue;
    issues.push(`APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract "${token}". Later stories may extend shared shell integration but must not remove prior story-visible test IDs, action IDs, ARIA labels, live regions, or roles without an explicit equivalent replacement.`);
  }

  for (const entry of previousEntries) {
    if (scopeSet.has(normalizeRelPath(entry.file))) continue;
    const componentRemovedLines = removed.filter((line) => new RegExp(`<\\s*${escapeRegExp(entry.componentName)}\\b`).test(line));
    if (componentRemovedLines.length === 0) continue;
    const componentAddedLines = added.filter((line) => new RegExp(`<\\s*${escapeRegExp(entry.componentName)}\\b`).test(line)).join("\n");
    for (const line of componentRemovedLines) {
      for (const prop of extractJsxAttrNames(line)) {
        if (componentAddedLines.includes(`${prop}=`)) continue;
        if (componentHasPropInSources(sources, entry.componentName, prop)) continue;
        issues.push(`APP_INTEGRATION_PROP_REGRESSION: app/router diff removes prop "${prop}" from previously verified generated screen ${entry.componentName} (${entry.file}). Preserve prior screen state/action adapters when adding later screens, or replace them with an equivalent explicit adapter.`);
      }
    }
  }

  return [...new Set(issues)].slice(0, 12);
}

function actionFunctionIsOnlyShellState(source: string): boolean {
  const clean = stripSourceComments(source);
  if (!/\bexport\s+function\s+\w*(?:save|update|apply|search|filter|sort|resolve|retry)\w*\s*\(/i.test(clean)) return false;
  const bodyMatch = clean.match(/\bexport\s+function\s+\w+\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/m);
  const body = bodyMatch ? bodyMatch[1] : clean;
  if (!/\bstore\.(?:setActivePanel|navigate|selectRecord)\s*\(/.test(body)) return false;
  if (/\bstore\.(?:createDraftReturn|updateRecord|saveRecord|setRecords|replaceRecords|mutate|dispatch)\s*\(/.test(body)) return false;
  if (/\b(?:records|items|rows|cards|tasks)\s*(?:=|\.map\s*\(|\.filter\s*\(|\.reduce\s*\(|\.push\s*\()/.test(body)) return false;
  if (/\b(?:localStorage|sessionStorage|indexedDB|fetch)\b/.test(body)) return false;
  return true;
}

function fileHasGeneratedIconFallback(source: string): boolean {
  const clean = stripSourceComments(source);
  if (!/\b(?:Circle|BadgeHelp)\b/.test(clean)) return false;
  // BadgeHelp is our converter fallback. It is never a real Stitch intent, so
  // any generated screen that imports/renders it must be repaired upstream.
  if (/\bBadgeHelp\b/.test(clean)) return true;
  const semanticTerms = "Dashboard|Inventory|Reports|Help|Logout|Sort|Date Range|Missing Proof|Notifications|Analytics|Settings|Policy|Status|Filter|Search|Save|Retry";
  const semanticLabels = new RegExp(`\\b(?:${semanticTerms})\\b`);
  const genericIconNearSemanticText = new RegExp(`<Circle\\b[\\s\\S]{0,220}(?:${semanticTerms})|(?:${semanticTerms})[\\s\\S]{0,220}<Circle\\b`);
  return semanticLabels.test(clean) && genericIconNearSemanticText.test(clean);
}

export function findGeneratedScreenIconFallbackIssues(workdir: string, repoPath = ""): string[] {
  const root = repoPath && fs.existsSync(repoPath) ? repoPath : workdir;
  if (!root || !fs.existsSync(root)) return [];
  const issues: string[] = [];
  for (const file of listSourceFiles(root).filter((rel) => /^src\/screens\/.+\.(tsx|jsx)$/i.test(rel))) {
    const abs = path.join(root, file);
    let source = "";
    try { source = fs.readFileSync(abs, "utf-8"); } catch { continue; }
    if (fileHasGeneratedIconFallback(source)) {
      issues.push(`GENERATED_ICON_FALLBACK: ${file} renders generic BadgeHelp/Circle icons in a generated screen. Material/Stitch icons must map to a meaningful SVG icon; do not silently replace domain, navigation, status, filter, search, save, retry, settings, reports, help, or logout icons with a generic fallback.`);
    }
  }
  return issues.slice(0, 24);
}

export function findGeneratedRuntimeSemanticIssues(workdir: string, repoPath = ""): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const components = generatedScreenComponents(workdir, repoPath);
  if (components.size === 0) return [];
  const componentList = [...components];
  const issues: string[] = [];

  issues.push(...browserGameRuntimeLoopIssues(workdir, repoPath));

  for (const file of listSourceFiles(workdir).filter((rel) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(rel))) {
    const abs = path.join(workdir, file);
    let source = "";
    try { source = fs.readFileSync(abs, "utf-8"); } catch { continue; }
    const clean = stripSourceComments(source);

    if (components.size > 1 && /\bactiveScreen\s*:\s*["'][A-Z][A-Za-z0-9_$]*["']/.test(clean)) {
      issues.push(`GENERATED_RUNTIME_HARDCODED_SCREEN: ${file} assigns activeScreen to a string literal while multiple generated screens exist. Derive the screen from the actual route/panel/render branch so QA bridge evidence cannot lie.`);
    }

    if (/^src\/features\/surf-[^/]+\/act_[^/]+\.(ts|tsx|js|jsx)$/i.test(file) && actionFunctionIsOnlyShellState(source)) {
      issues.push(`ACTION_SEMANTIC_NOOP: ${file} appears to complete a visible save/update/search/filter/sort/resolve/retry action by changing only route/panel/selection shell state. Declared actions must mutate/search/filter/persist/recover domain data or render a visible in-screen result.`);
    }
  }

  issues.push(...findGeneratedScreenIconFallbackIssues(workdir, repoPath));

  for (const file of appRouterFiles(workdir)) {
    let source = "";
    try { source = fs.readFileSync(path.join(workdir, file), "utf-8"); } catch { continue; }
    const clean = stripSourceComments(source);
    const rendered = componentList.filter((name) => sourceRendersComponent(clean, name));
    if (components.size >= 3 && rendered.length >= 2 && /\bactiveRoute\s*!==\s*["'][^"']+["']/.test(clean)) {
      issues.push(`GENERATED_ROUTE_COLLAPSE: ${file} routes every non-primary activeRoute through a single generated screen branch. Each generated Product Surface or visible nav destination must have a distinct render path, or be explicitly disabled/inert in the generated UI.`);
    }
  }

  return [...new Set(issues)].slice(0, 24);
}

const GENERATED_SHELL_DIAGNOSTIC_TEXT =
  /\b(?:session\s+status|storage\s+status|runtime\s+status|app\s+status|shell\s+status|qa\s+status|smoke\s+status|status\s*bar|statusbar|debug\s+(?:panel|bar|strip|status|statusbar)|diagnostic\s+(?:panel|bar|strip|status|statusbar)|telemetry\s+(?:panel|bar|strip|status|statusbar))\b/i;
const GENERATED_SHELL_DIAGNOSTIC_MARKUP =
  /(?:data-testid|aria-label|className|class|id)\s*=\s*(?:"[^"]*\b(?:(?:session|storage|runtime|shell|app[-_ ]?shell|debug|diagnostic|telemetry|smoke|qa)[-_ ]?(?:status|statusbar|strip|bar|panel|banner|message)|status[-_ ]?bar)\b[^"]*"|'[^']*\b(?:(?:session|storage|runtime|shell|app[-_ ]?shell|debug|diagnostic|telemetry|smoke|qa)[-_ ]?(?:status|statusbar|strip|bar|panel|banner|message)|status[-_ ]?bar)\b[^']*'|\{`[^`]*\b(?:(?:session|storage|runtime|shell|app[-_ ]?shell|debug|diagnostic|telemetry|smoke|qa)[-_ ]?(?:status|statusbar|strip|bar|panel|banner|message)|status[-_ ]?bar)\b[^`]*`\})/i;
const GENERATED_SHELL_GLOBAL_LAYOUT =
  /\b(?:fixed|absolute|sticky|top-0|inset-x-0|left-0|right-0|w-screen|w-full|min-w-\[|z-\d+|overflow-x-(?:auto|scroll|visible))\b/i;
const GENERATED_SHELL_VISIBLE_DIAGNOSTIC_JSX =
  /<[^>]+>\s*(?:Route|Panel|Records|Storage|Selected|Session|Runtime|Debug|QA)\s*:\s*(?:\{[^}]*\}|[^<]*)<\/[^>]+>/i;
const JSX_MAIN_LANDMARK_TAG = /<\s*main\b/i;
const JSX_MAIN_ROLE_LANDMARK = /<\s*(?:div|section|article)\b[^>]*\brole\s*=\s*(?:"main"|'main'|\{\s*["']main["']\s*\})/i;

function hasVisibleGeneratedShellDiagnosticChrome(source: string): boolean {
  const clean = stripSourceComments(source);
  if (GENERATED_SHELL_VISIBLE_DIAGNOSTIC_JSX.test(clean)) return true;
  if (GENERATED_SHELL_DIAGNOSTIC_MARKUP.test(clean)) return true;
  if (!GENERATED_SHELL_DIAGNOSTIC_TEXT.test(clean)) return false;
  return GENERATED_SHELL_GLOBAL_LAYOUT.test(clean);
}

function sourceHasMainLandmark(source: string): boolean {
  const clean = stripSourceComments(source);
  return JSX_MAIN_LANDMARK_TAG.test(clean) || JSX_MAIN_ROLE_LANDMARK.test(clean);
}

function findClosingTagEnd(source: string, tagName: string, openStart: number): number {
  const tagPattern = new RegExp(`<\\s*(/?)\\s*${escapeRegExp(tagName)}\\b[^>]*>`, "ig");
  tagPattern.lastIndex = openStart;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    const full = match[0] || "";
    const closing = Boolean(match[1]);
    const selfClosing = /\/\s*>$/.test(full);
    if (closing) {
      depth -= 1;
    } else if (!selfClosing) {
      depth += 1;
    }
    if (depth === 0) return (match.index || 0) + full.length;
  }
  return source.length;
}

function mainLandmarkSpans(source: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  for (const match of source.matchAll(/<\s*main\b[^>]*>/ig)) {
    const start = match.index || 0;
    spans.push({ start, end: findClosingTagEnd(source, "main", start) });
  }
  const rolePattern = /<\s*(div|section|article)\b[^>]*\brole\s*=\s*(?:"main"|'main'|\{\s*["']main["']\s*\})[^>]*>/ig;
  for (const match of source.matchAll(rolePattern)) {
    const start = match.index || 0;
    const tagName = match[1] || "";
    if (!tagName) continue;
    spans.push({ start, end: findClosingTagEnd(source, tagName, start) });
  }
  return spans;
}

function sourceWrapsGeneratedComponentInMainLandmark(source: string, componentNames: Set<string>): boolean {
  if (componentNames.size === 0) return false;
  const clean = stripSourceComments(source);
  const spans = mainLandmarkSpans(clean);
  if (spans.length === 0) return false;
  for (const componentName of componentNames) {
    if (!sourceRendersComponent(clean, componentName)) continue;
    const escaped = escapeRegExp(componentName);
    const componentPattern = new RegExp(`<\\s*${escaped}\\b`, "ig");
    for (const match of clean.matchAll(componentPattern)) {
      const componentIndex = match.index || 0;
      if (spans.some((span) => componentIndex > span.start && componentIndex < span.end)) return true;
    }
  }
  return false;
}

function generatedScreenMainComponents(workdir: string, repoPath: string, screenIndex: any[]): Set<string> {
  const components = new Set<string>();
  for (const entry of screenIndex) {
    const componentName = componentNameForScreenEntry(entry);
    const screenFile = normalizeRelPath(String(entry?.file || entry?.filePath || ""));
    if (!componentName || !screenFile || !/^src\/screens\/.+\.(tsx|jsx)$/i.test(screenFile)) continue;
    const candidates = [
      path.join(workdir, screenFile),
      repoPath ? path.join(repoPath, screenFile) : "",
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        if (sourceHasMainLandmark(fs.readFileSync(candidate, "utf-8"))) {
          components.add(componentName);
        }
        break;
      } catch {}
    }
  }
  return components;
}

function generatedScreenRequiresFlexMount(source: string): boolean {
  const clean = stripSourceComments(source);
  const hasSidebarWidth = /(?:^|[\s"'`])(?:w-\[[^\]]+\]|w-\d+)(?=[\s"'`])/m.test(clean);
  return /return\s*\(\s*<>/.test(clean)
    && hasSidebarWidth
    && /\bshrink-0\b/.test(clean)
    && /\bflex-1\b/.test(clean)
    && /\bh-screen\b/.test(clean);
}

function generatedScreenRequiresViewportMount(source: string): boolean {
  const clean = stripSourceComments(source);
  const returnFragment = /return\s*\(\s*<>/.test(clean);
  const firstViewportLayer = /return\s*\(\s*(?:<>\s*)?<(?:div|main|section)\b[^>]*\bclassName\s*=\s*(?:"[^"]*\b(?:absolute|fixed)\b[^"]*\binset-0\b[^"]*"|'[^']*\b(?:absolute|fixed)\b[^']*\binset-0\b[^']*'|\{\s*["'][^"']*\b(?:absolute|fixed)\b[^"']*\binset-0\b[^"']*["']\s*\})/m.test(clean);
  const fixedViewportChrome = /\b(?:fixed|absolute)\b/.test(clean)
    && /\b(?:inset-0|top-0|bottom-0|left-0|right-0|h-screen|w-full)\b/.test(clean);
  return returnFragment && (firstViewportLayer || fixedViewportChrome);
}

function generatedFlexMountComponents(workdir: string, repoPath: string, screenIndex: any[]): Set<string> {
  const components = new Set<string>();
  for (const entry of screenIndex) {
    const componentName = componentNameForScreenEntry(entry);
    const screenFile = normalizeRelPath(String(entry?.file || entry?.filePath || ""));
    if (!componentName || !screenFile || !/^src\/screens\/.+\.(tsx|jsx)$/i.test(screenFile)) continue;
    const candidates = [
      path.join(workdir, screenFile),
      repoPath ? path.join(repoPath, screenFile) : "",
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        if (generatedScreenRequiresFlexMount(fs.readFileSync(candidate, "utf-8"))) {
          components.add(componentName);
        }
        break;
      } catch {}
    }
  }
  return components;
}

function generatedViewportMountComponents(workdir: string, repoPath: string, screenIndex: any[]): Set<string> {
  const components = new Set<string>();
  for (const entry of screenIndex) {
    const componentName = componentNameForScreenEntry(entry);
    const screenFile = normalizeRelPath(String(entry?.file || entry?.filePath || ""));
    if (!componentName || !screenFile || !/^src\/screens\/.+\.(tsx|jsx)$/i.test(screenFile)) continue;
    const candidates = [
      path.join(workdir, screenFile),
      repoPath ? path.join(repoPath, screenFile) : "",
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        if (generatedScreenRequiresViewportMount(fs.readFileSync(candidate, "utf-8"))) {
          components.add(componentName);
        }
        break;
      } catch {}
    }
  }
  return components;
}

function generatedRootMounts(source: string): Array<{ className: string; attrs: string }> {
  const mounts: Array<{ className: string; attrs: string }> = [];
  const rootAttrPattern = /<([A-Za-z][\w.]*)\b([^>]*\bdata-setfarm-root\b[^>]*)>/g;
  for (const match of source.matchAll(rootAttrPattern)) {
    const attrs = match[2] || "";
    const classMatch = attrs.match(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|{\s*["']([^"']*)["']\s*})/);
    mounts.push({ className: classMatch ? (classMatch[1] || classMatch[2] || classMatch[3] || "") : "", attrs });
  }
  return mounts;
}

function rootMountHasFlex(mount: { className: string; attrs: string }): boolean {
  if (/\bflex\b/.test(mount.className)) return true;
  return /\bstyle\s*=\s*\{\s*\{[^}]*\bdisplay\s*:\s*["']flex["'][^}]*\}\s*\}/m.test(mount.attrs);
}

function sourceMountsGeneratedFlexScreenSafely(source: string, componentNames: Set<string>): boolean {
  if (componentNames.size === 0) return true;
  if (![...componentNames].some((name) => sourceRendersComponent(source, name))) return true;
  const mounts = generatedRootMounts(source);
  if (mounts.length === 0) return true;
  return mounts.some(rootMountHasFlex);
}

function rootMountHasViewportFrame(mount: { className: string; attrs: string }): boolean {
  const hasPosition = /\b(?:relative|fixed|absolute)\b/.test(mount.className)
    || /\bstyle\s*=\s*\{\s*\{[^}]*\bposition\s*:\s*["'](?:relative|fixed|absolute)["'][^}]*\}\s*\}/m.test(mount.attrs);
  const hasViewportHeight = /\b(?:min-h-screen|h-screen|min-h-dvh|h-dvh|min-h-\[(?:100d?vh|100%)\]|h-\[(?:100d?vh|100%)\])\b/.test(mount.className)
    || /\bstyle\s*=\s*\{\s*\{[^}]*\b(?:minHeight|height)\s*:\s*["'](?:100d?vh|100%)["'][^}]*\}\s*\}/m.test(mount.attrs);
  const hasViewportWidth = /\b(?:w-full|w-screen|min-w-full|min-w-screen)\b/.test(mount.className)
    || /\bstyle\s*=\s*\{\s*\{[^}]*\b(?:width|minWidth)\s*:\s*["'](?:100d?vw|100vw|100%)["'][^}]*\}\s*\}/m.test(mount.attrs);
  const hasOverflowControl = /\b(?:overflow-hidden|overflow-x-hidden)\b/.test(mount.className)
    || /\bstyle\s*=\s*\{\s*\{[^}]*\boverflow(?:X)?\s*:\s*["']hidden["'][^}]*\}\s*\}/m.test(mount.attrs);
  return hasPosition && hasViewportHeight && hasViewportWidth && hasOverflowControl;
}

function sourceMountsGeneratedViewportScreenSafely(source: string, componentNames: Set<string>): boolean {
  if (componentNames.size === 0) return true;
  if (![...componentNames].some((name) => sourceRendersComponent(source, name))) return true;
  const mounts = generatedRootMounts(source);
  if (mounts.length === 0) return true;
  return mounts.some(rootMountHasViewportFrame);
}

export function findGeneratedScreenShellChromeIssues(workdir: string, repoPath = ""): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const screenIndex = loadScreenIndex(workdir, repoPath);
  const componentNames = screenIndex.map(componentNameForScreenEntry).filter(Boolean);
  if (componentNames.length === 0) return [];
  const mainLandmarkComponents = generatedScreenMainComponents(workdir, repoPath, screenIndex);
  const flexMountComponents = generatedFlexMountComponents(workdir, repoPath, screenIndex);
  const viewportMountComponents = generatedViewportMountComponents(workdir, repoPath, screenIndex);

  const candidateFiles = listSourceFiles(workdir)
    .filter((file) => !/^src\/screens\//i.test(file))
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file))
    .filter((file) => /(^|\/)(App|app|Root|root|Layout|layout|Router|router|main)\.(tsx?|jsx?)$/i.test(file));

  const offenders: string[] = [];
  const landmarkOffenders: string[] = [];
  for (const file of candidateFiles) {
    let source = "";
    try {
      source = fs.readFileSync(path.join(workdir, file), "utf-8");
    } catch {
      continue;
    }
    if (!sourceReferencesGeneratedScreens(source, componentNames)) continue;
    if (hasVisibleGeneratedShellDiagnosticChrome(source)) offenders.push(file);
    if (!sourceMountsGeneratedFlexScreenSafely(source, flexMountComponents)) {
      landmarkOffenders.push(`${file}:flex-mount`);
    }
    if (!sourceMountsGeneratedViewportScreenSafely(source, viewportMountComponents)) {
      landmarkOffenders.push(`${file}:viewport-mount`);
    }
    if (
      mainLandmarkComponents.size > 0
      && sourceWrapsGeneratedComponentInMainLandmark(source, mainLandmarkComponents)
    ) {
      landmarkOffenders.push(file);
    }
  }

  return [
    ...offenders.map((file) =>
    `GENERATED_SCREEN_SHELL_CHROME_UNSAFE: ${file} renders visible diagnostic/session/status/debug/QA chrome around generated full-screen screens. Keep smoke/debug state in window.app/globalThis.app or test-only data, not visible app shell chrome that can push, cover, or overflow generated screens on mobile.`,
    ),
    ...landmarkOffenders.map((file) =>
      file.endsWith(":flex-mount")
        ? `GENERATED_SCREEN_LAYOUT_MOUNT_UNSAFE: ${file.replace(/:flex-mount$/, "")} mounts a generated full-screen Stitch screen with sibling sidebar/content layout inside a non-flex data-setfarm-root container. Preserve the generated screen structure and make the mount root a flex container so desktop sidebar and content render side-by-side.`
        : file.endsWith(":viewport-mount")
          ? `GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE: ${file.replace(/:viewport-mount$/, "")} mounts an absolute/fixed generated full-screen Stitch screen inside a data-setfarm-root container without stable viewport height and positioning. Use a neutral root such as <div data-setfarm-root className="relative min-h-screen w-full overflow-hidden"> so absolute generated layers have a real viewport frame.`
        : `GENERATED_SCREEN_SHELL_LANDMARK_UNSAFE: ${file} wraps generated full-screen Stitch screens in an app-shell main landmark while generated screen components already render their own main landmark. Use a neutral <div data-setfarm-root> container and keep generated screens as the semantic and visual root.`,
    ),
  ];
}

function screenEntriesForRefs(screenIndex: any[], refs: ScreenOwnershipRef[], scopeFiles: string[] = []): Array<{ file: string; componentName: string; title: string }> {
  const scoped = new Set(scopeFiles.map(normalizeRelPath).filter(Boolean));
  return screenIndex
    .filter((entry) => {
      const file = normalizeRelPath(String(entry?.file || ""));
      if (!file || !/^src\/screens\/.+\.(tsx|jsx)$/i.test(file)) return false;
      if (scoped.size > 0 && !scoped.has(file)) return false;
      return refs.some((ref) => screenRefMatchesIndexEntry(ref, entry));
    })
    .map((entry) => ({
      file: normalizeRelPath(String(entry?.file || "")),
      componentName: componentNameForScreenEntry(entry),
      title: String(entry?.title || entry?.name || entry?.componentName || "").trim(),
    }))
    .filter((entry) => entry.file && entry.componentName);
}

function missingRenderedGeneratedScreens(workdir: string, entries: Array<{ file: string; componentName: string; title: string }>): Array<{ file: string; componentName: string; title: string }> {
  if (entries.length === 0) return [];
  const ownedFiles = new Set(entries.map((entry) => entry.file));
  const candidateFiles = listSourceFiles(workdir)
    .filter((file) => !ownedFiles.has(file))
    .filter((file) => !/^src\/screens\/(?:SCREEN_INDEX|index)\.(tsx?|jsx?)$/i.test(file))
    .filter((file) => !/\.(test|spec)\.(tsx?|jsx?)$/i.test(file));

  const sources = candidateFiles.map((file) => {
    try {
      return { file, source: fs.readFileSync(path.join(workdir, file), "utf-8") };
    } catch {
      return { file, source: "" };
    }
  });

  return entries.filter((entry) => !sources.some(({ source }) => sourceRendersComponent(source, entry.componentName)));
}

export function findGeneratedScreenIntegrationIssues(
  workdir: string,
  scopeFiles: string[],
  storyScreensRaw: unknown = [],
  repoPath = "",
): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const storyScreens = parseStoryScreenRefs(storyScreensRaw);
  if (storyScreens.length === 0) return [];

  const screenIndex = loadScreenIndex(workdir, repoPath);
  const ownedEntries = screenEntriesForRefs(screenIndex, storyScreens, scopeFiles);
  const missing = missingRenderedGeneratedScreens(workdir, ownedEntries);
  if (missing.length === 0) return [];

  return [
    `GENERATED_SCREEN_NOT_INTEGRATED: owned generated screen(s) are not rendered by the app/router surface: ${missing.map((entry) => `${entry.componentName} (${entry.file})`).join(", ")}. Import/render each owned generated screen from src/screens or a generated barrel and wire declared actions props/action IDs; do not replace it with custom duplicate UI.`,
  ];
}

export function findGeneratedScreenRegressionIssues(
  workdir: string,
  previousStoryScreensRaw: unknown[] = [],
  repoPath = "",
  currentScopeFiles: string[] = [],
): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const previousRefs = previousStoryScreensRaw.flatMap((raw) => parseStoryScreenRefs(raw));
  if (previousRefs.length === 0) return [];

  const screenIndex = loadScreenIndex(workdir, repoPath);
  const previousEntries = screenEntriesForRefs(screenIndex, previousRefs);
  const byFile = new Map<string, { file: string; componentName: string; title: string }>();
  for (const entry of previousEntries) byFile.set(entry.file, entry);
  const missing = missingRenderedGeneratedScreens(workdir, [...byFile.values()]);
  const issues: string[] = [];
  if (missing.length > 0) {
    issues.push(`GENERATED_SCREEN_REGRESSION: previously verified generated screen(s) are no longer rendered by the app/router surface: ${missing.map((entry) => `${entry.componentName} (${entry.file})`).join(", ")}. Keep prior story screens reachable while integrating the current story screens; do not replace prior generated screens with custom duplicate UI.`);
  }
  issues.push(...findAppIntegrationBehaviorRegressionIssues(workdir, [...byFile.values()], currentScopeFiles));
  return issues;
}

export async function checkDesignDomImplementationGate(
  runId: string,
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): Promise<ScopeCheckResult> {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const row = await pgGet<{ scope_files: string | null; retry_count: number | null }>(
    "SELECT scope_files, retry_count FROM stories WHERE id = $1",
    [currentStoryDbId],
  );
  const scopeFiles = parseScopeFiles(row?.scope_files).filter((file) => /^src\/screens\/.+\.(tsx|jsx)$/i.test(file));
  if (scopeFiles.length === 0) return { passed: true };
  const scan = await runImplementSupervisorScan({
    runId,
    workdir,
    repoPath,
    storyId,
    scopeFiles,
    repeatedBlockerCount: row?.retry_count || 0,
  });
  if (scan.blockers.length === 0) return { passed: true };
  const feedback = formatSupervisorBlockerFeedback(scan.blockers);
  return {
    passed: false,
    reason: `${feedback}\nStory ${storyId} (${storyTitle}) reported STATUS: done with unresolved supervisor checklist blocker(s).`,
    category: "SUPERVISOR_BLOCKERS_OPEN",
    suggestion: "Use the supervisor checklist/state/intervention files under .setfarm/supervisor/<runId>/ and fix only the scoped story files until scanner evidence closes every blocker. If SUPERVISOR_FIXER_PLAN.json exists, use its provider/allowed-files guidance for the next scoped repair attempt.",
  };
}

export async function checkGeneratedScreenIntegrationGate(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): Promise<ScopeCheckResult> {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const row = await pgGet<{ scope_files: string | null; story_screens: string | null }>(
    "SELECT scope_files, story_screens FROM stories WHERE id = $1",
    [currentStoryDbId],
  );
  const scopeFiles = parseScopeFiles(row?.scope_files);
  const issues = findGeneratedScreenIntegrationIssues(workdir, scopeFiles, row?.story_screens || [], repoPath);
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while an owned generated screen was not integrated into the rendered app surface.`,
    category: "GENERATED_SCREEN_NOT_INTEGRATED",
    suggestion: "Render every owned generated screen through the app/router surface and wire its declared actions prop IDs before reporting STATUS: done. Preserve previously implemented state behavior while replacing duplicate custom UI.",
  };
}

export async function checkGeneratedScreenRegressionGate(
  runId: string,
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): Promise<ScopeCheckResult> {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const current = await pgGet<{ story_index: number | null; scope_files: string | null }>(
    "SELECT story_index, scope_files FROM stories WHERE id = $1",
    [currentStoryDbId],
  );
  if (current?.story_index == null) return { passed: true };
  const scopeFiles = parseScopeFiles(current.scope_files);
  const previousRows = await pgQuery<{ story_screens: string | null }>(
    "SELECT story_screens FROM stories WHERE run_id = $1 AND story_index < $2 AND status IN ('done', 'verified') ORDER BY story_index",
    [runId, current.story_index],
  );
  const issues = findGeneratedScreenRegressionIssues(
    workdir,
    previousRows.map((row) => row.story_screens || []),
    repoPath,
    scopeFiles,
  );
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while regressing a previously verified generated screen integration.`,
    category: "GENERATED_SCREEN_REGRESSION",
    suggestion: "Preserve previously verified generated screens through the app/router surface while adding the current story screens. Restore the prior render path and keep current-story changes bounded.",
  };
}

export function checkGeneratedScreenShellChromeGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): ScopeCheckResult {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const issues = findGeneratedScreenShellChromeIssues(workdir, repoPath);
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while app-level chrome can visually break generated full-screen Stitch surfaces.`,
    category: "GENERATED_SCREEN_SHELL_CHROME_UNSAFE",
    suggestion: "Remove visible diagnostic/session/status/debug/QA strips from the app shell around generated screens. Expose deterministic smoke state through window.app/globalThis.app and keep generated screens mounted as the visual viewport root.",
  };
}

export function checkGeneratedScreenRequiredPropsGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): ScopeCheckResult {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const issues = findGeneratedScreenRequiredPropIssues(workdir, repoPath);
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while required generated screen props are not wired from the app shell/router.`,
    category: "GENERATED_SCREEN_REQUIRED_PROPS_UNWIRED",
    suggestion: "Wire every required generated screen prop from scoped app state/adapters or pass a typed spread adapter before reporting done. Do not edit generated src/screens/*.tsx files unless they are owned by the story.",
  };
}

export function checkGeneratedRuntimeSemanticGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): ScopeCheckResult {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const issues = findGeneratedRuntimeSemanticIssues(workdir, repoPath);
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while generated-screen runtime semantics are incomplete or misleading.`,
    category: "GENERATED_RUNTIME_SEMANTIC_INCOMPLETE",
    suggestion: "Use real generated-screen route branches, derive runtime bridge state from the actual rendered screen, replace generic icon fallbacks with semantic SVG icons, and make visible actions mutate/search/filter/persist domain data instead of only route/panel state.",
  };
}

export function checkPlatformHelperContaminationGate(
  storyId: string,
  storyTitle: string,
  workdir: string,
  repoPath = "",
): ScopeCheckResult {
  if (!workdir || !fs.existsSync(workdir)) return { passed: true };
  const issues = findPlatformHelperContaminationIssues(workdir, repoPath);
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while generated product source contains Setfarm platform/test harness helper code.`,
    category: "PLATFORM_HELPER_CONTAMINATION",
    suggestion: "Remove Setfarm visual-QA/test harness helpers from app source. Fix the platform scanner/router in Setfarm instead of adding globals or helper shims to generated projects.",
  };
}

/**
 * Check scope_files declaration against actual worktree files.
 * scope_files is an ownership boundary, not a promise that every listed file
 * must be created. Fail only when too little of the declared scope exists,
 * which catches no-work/hallucinated-output without forcing optional sibling
 * CSS or test helper files into every story.
 */
export async function checkScopeFilesGate(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
): Promise<ScopeCheckResult> {
  const declRow = await pgGet<{ scope_files: string | null }>(
    "SELECT scope_files FROM stories WHERE id = $1",
    [currentStoryDbId]
  );
  if (!declRow?.scope_files) return { passed: true };

  let declared: string[] = [];
  try {
    const parsed = JSON.parse(declRow.scope_files || "[]");
    if (Array.isArray(parsed)) declared = parsed.filter((f: any) => typeof f === "string");
  } catch { declared = []; }
  if (declared.length === 0) return { passed: true };

  const missing: string[] = [];
  const present: string[] = [];
  for (const rel of declared) {
    const abs = path.join(workdir, rel);
    try {
      const st = fs.statSync(abs);
      if (st.isFile() && st.size > 0) present.push(rel); else missing.push(rel);
    } catch { missing.push(rel); }
  }
  const missingRequired = missing.filter(isRequiredDeclaredScopeFile);
  if (missingRequired.length > 0) {
    return {
      passed: false,
      reason: `SCOPE_FILE_MISSING: Story ${storyId} (${storyTitle}) reported STATUS: done but required declared scope file(s) do not exist as non-empty files: ${missingRequired.join(", ")}. Declared scope_files=${JSON.stringify(declared)}.`,
      category: "SCOPE_FILE_MISSING",
      suggestion: "Create the required screen/app/runtime files listed in scope_files before reporting done. Do not replace an owned generated screen with a custom overlay in another file.",
    };
  }

  const primaryDeclared = declared.filter(rel => !isOptionalScopeCompanionFile(rel));
  const primaryPresent = present.filter(rel => !isOptionalScopeCompanionFile(rel));
  const requiredUniverse = primaryDeclared.length > 0 ? primaryDeclared : declared;
  const presentUniverse = primaryDeclared.length > 0 ? primaryPresent : present;
  const required = Math.max(1, Math.ceil(requiredUniverse.length * 0.5));
  if (presentUniverse.length < required) {
    return {
      passed: false,
      reason: `SCOPE_FILE_MISSING: Story ${storyId} (${storyTitle}) declared scope_files=${JSON.stringify(declared)} but only ${presentUniverse.length}/${requiredUniverse.length} primary files exist as non-empty files (required at least ${required}; ${present.length}/${declared.length} total declared files exist). Missing: ${missing.join(", ") || "none"}. You reported STATUS: done but too little of the owned primary scope exists.`,
      category: "SCOPE_FILE_MISSING",
      suggestion: "Write meaningful non-empty implementation code in the primary files listed in scope_files before reporting done",
    };
  }
  return { passed: true };
}

function isOptionalScopeCompanionFile(rel: string): boolean {
  return /^src\/features\/surf-[^/]+\/act_[^/]+\.[cm]?[tj]sx?$/.test(rel);
}

function isRequiredDeclaredScopeFile(rel: string): boolean {
  return /^src\/screens\/.+\.(tsx|jsx)$/i.test(rel);
}

function meaningfulDeletedDiffLines(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("-") && !line.startsWith("---"))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length >= 12)
    .filter((line) => !/^[{}()[\],;]+$/.test(line));
}

function retryPatchRepoCandidates(workdir: string): string[] {
  const candidates = [workdir].filter(Boolean);
  if (workdir && fs.existsSync(workdir)) {
    try {
      const commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
        cwd: workdir,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const absoluteCommonDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(workdir, commonDir);
      if (path.basename(absoluteCommonDir) === ".git") candidates.push(path.dirname(absoluteCommonDir));
    } catch {
      // Best effort; workdir remains a candidate.
    }
  }
  return [...new Set(candidates)];
}

function latestRetryPatchTextForStory(workdir: string, storyId: string, baseBranch: string): string {
  const aliases = [...new Set([storyId, `${String(baseBranch || "").slice(0, 8)}-${storyId}`].map((id) => String(id || "").trim()).filter(Boolean))];
  for (const repo of retryPatchRepoCandidates(workdir)) {
    for (const id of aliases) {
      const patchPath = latestRetryPatchForStory(repo, id);
      if (patchPath && fs.existsSync(patchPath)) {
        try { return fs.readFileSync(patchPath, "utf-8"); } catch {}
      }
    }
  }
  for (const id of aliases) {
    const patch = latestRetryStashPatchForStory(workdir, id);
    if (patch.trim()) return patch;
  }
  return "";
}

function checkRejectedRetryPatchReapplied(workdir: string, storyId: string, baseBranch: string): ScopeCheckResult {
  try {
    const retryPatch = latestRetryPatchTextForStory(workdir, storyId, baseBranch);
    if (!retryPatch.trim()) return { passed: true };
    const previousDeleted = new Set(meaningfulDeletedDiffLines(retryPatch));
    if (previousDeleted.size === 0) return { passed: true };
    const currentDiff = execFileSync("git", ["diff", "--no-ext-diff", "HEAD", "--"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const repeated = meaningfulDeletedDiffLines(currentDiff).filter((line) => previousDeleted.has(line));
    const uniqueRepeated = [...new Set(repeated)];
    if (uniqueRepeated.length >= 2) {
      return {
        passed: false,
        reason: `RETRY_PATCH_REAPPLIED: Story ${storyId} repeated ${uniqueRepeated.length} deletion(s) from a previously rejected retry patch. Do not re-apply discarded worktree deletions. Treat the listed lines as previously verified wiring to preserve or restore before making the current scoped fix. Preserve/restore: ${uniqueRepeated.slice(0, 6).join(" | ")}`,
        category: "RETRY_PATCH_REAPPLIED",
        suggestion: "Preserve or restore the repeated lines from the rejected retry patch, then make a fresh minimal fix for the current failure",
      };
    }
  } catch (err) {
    logger.debug(`[retry-patch-gate] skipped for ${storyId}: ${String(err).slice(0, 120)}`);
  }
  return { passed: true };
}

/**
 * Check for zero-work (Bug D), stub commits, scope bleed, scope overflow.
 */
export async function checkScopeEnforcement(
  storyId: string,
  currentStoryDbId: string,
  storyTitle: string,
  workdir: string,
  baseBranch: string,
  retryCount: number,
  maxRetries: number,
): Promise<ScopeCheckResult> {
  if (!workdir || !baseBranch || !fs.existsSync(workdir)) return { passed: true };

  // Collect changed files (committed + uncommitted)
  let changedFiles: string[] = [];
  try {
    const diffOut = execFileSync("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
      cwd: workdir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).trim();
    changedFiles = diffOut ? diffOut.split("\n").filter(Boolean) : [];
  } catch { return { passed: true }; }

  let dirtyFiles: string[] = [];
  try {
    const statusOut = execFileSync("git", ["status", "--porcelain", "-uall"], {
      cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    });
    dirtyFiles = statusOut.split(/\r?\n/).map(parseGitStatusPorcelainPath).filter(Boolean);
  } catch {}

  const allTouched = Array.from(new Set([...changedFiles, ...dirtyFiles]));
  const sourceFiles = allTouched.filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f));
  const forbiddenArtifacts = allTouched.filter(f => /^(QA_REPORT\.md|qa-report\.(md|json|txt)|smoke-(home|after-click)\.png|index\.html|package(-lock)?\.json|vite\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|eslint\.config\.[cm]?[jt]s)$/i.test(f));
  if (forbiddenArtifacts.length > 0) {
    return {
      passed: false,
      reason: `SCOPE_BLEED: Story ${storyId} committed QA/test artifact(s) that do not belong in product code: ${forbiddenArtifacts.join(", ")}. Remove these files/commits and keep reports in step output, not in the repo.`,
      category: "SCOPE_BLEED",
      suggestion: "Remove QA report/smoke artifact files from the story branch before completing",
      outOfScope: forbiddenArtifacts,
    };
  }

  // Dependencies increase limits
  const depRow = await pgGet<{ depends_on: string | null }>("SELECT depends_on FROM stories WHERE id = $1", [currentStoryDbId]);
  const hasDeps = depRow?.depends_on && depRow.depends_on !== "[]" && depRow.depends_on !== "null";
  const scopeRow = await pgGet<{ scope_files: string | null; shared_files: string | null }>(
    "SELECT scope_files, shared_files FROM stories WHERE id = $1",
    [currentStoryDbId]
  );
  const declaredScopeFiles = parseScopeFiles(scopeRow?.scope_files);
  const declaredSharedFiles = parseScopeFiles(scopeRow?.shared_files);
  const implicitSourceFiles = sourceFiles.filter(isImplicitSharedSourceFile);
  const { hardLimit: HARD_LIMIT, softLimit: SOFT_LIMIT } = computeScopeFileLimits(!!hasDeps, declaredScopeFiles, declaredSharedFiles, implicitSourceFiles);

  // Zero-work floor
  if (sourceFiles.length === 0) {
    return {
      passed: false,
      reason: `NO WORK DETECTED: Story ${storyId} (${storyTitle}) reported STATUS: done but the worktree has ZERO source-file changes vs ${baseBranch}. The agent appears to have shortcut the task.`,
      category: "NO_WORK_DETECTED",
      suggestion: "Actually implement the story — write files and commit them",
    };
  }

  const retryPatchResult = checkRejectedRetryPatchReapplied(workdir, storyId, baseBranch);
  if (!retryPatchResult.passed) return retryPatchResult;

  // Anti-stub check is intentionally advisory. Small QA fixes often change a
  // color token, aria label, handler, import, or dependency in fewer than ten
  // inserted lines. Zero-work, scope, build, and smoke gates catch real no-op
  // completions without forcing agents to pad code.
  if (sourceFiles.length > 0 && retryCount < maxRetries) {
    let inserts = 0;
    try {
      const shortstat = execFileSync("git", ["diff", "--shortstat", `${baseBranch}...HEAD`, "--", ...sourceFiles], {
        cwd: workdir, timeout: 5000, stdio: "pipe",
      }).toString().trim();
      const mInserts = shortstat.match(/(\d+)\s+insertion/);
      inserts = mInserts ? parseInt(mInserts[1], 10) : 0;
    } catch {}
    if (inserts > 0 && inserts < 10) {
      logger.warn(`[scope-check] Story ${storyId} has a small source diff (${inserts} insertion(s)); allowing and relying on build/smoke gates`, {});
    }
  }

  // Scope bleed detection
  if (sourceFiles.length > 0) {
    if (declaredScopeFiles.length > 0) {
      const allowed = new Set<string>();
      declaredScopeFiles.forEach(f => allowed.add(f));
      if (allowed.size > 0) {
        const outOfScope = getOutOfScopeStoryFiles(sourceFiles, declaredScopeFiles);
        if (outOfScope.length > 0) {
          const allowedList = [...allowed].slice(0, 15).join(", ");
          const oosList = outOfScope.slice(0, 10).join(", ");
          return {
            passed: false,
            reason: `SCOPE_BLEED: Story ${storyId} modified ${outOfScope.length} file(s) outside its SCOPE_FILES list: ${oosList}. Allowed SCOPE_FILES: ${allowedList}. shared_files are read-only/import context unless also listed in scope_files. Re-read your SCOPE_FILES in the claim input and modify ONLY those files. Revert all other changes. Integration files (App.tsx, main.tsx, routing) belong to the integration story, not yours.`,
            category: "SCOPE_BLEED",
            suggestion: `Only modify declared SCOPE_FILES. Revert or move out-of-scope files: ${oosList}`,
            outOfScope,
          };
        }
      }
    }
  }

  // Regression guard: implementation stories may add or adjust tests, but they
  // must not delete a large chunk of prior tests just to make a new story pass.
  // This catches the common App.tsx integration failure mode where the agent
  // removes accepted search/form/card tests while adding unrelated UI.
  const testFiles = sourceFiles.filter(f => /\.(test|spec)\.(tsx?|jsx?)$/i.test(f));
  if (testFiles.length > 0) {
    let storyText = storyTitle;
    try {
      const storyRow = await pgGet<{ description: string | null; acceptance_criteria: string | null }>(
        "SELECT description, acceptance_criteria FROM stories WHERE id = $1",
        [currentStoryDbId]
      );
      storyText += "\n" + (storyRow?.description || "") + "\n" + (storyRow?.acceptance_criteria || "");
    } catch {}

    const explicitDeletionStory = /\b(remove|delete|drop|cleanup|replace|rewrite|migrate|rename)\b/i.test(storyText);
    if (!explicitDeletionStory) {
      const heavyDeletes: string[] = [];
      try {
        const numstat = execFileSync("git", ["diff", "--numstat", baseBranch, "--", ...testFiles], {
          cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
        }).trim();
        for (const line of numstat.split("\n").filter(Boolean)) {
          const [addedRaw, deletedRaw, file] = line.split("\t");
          const added = Number.parseInt(addedRaw || "0", 10) || 0;
          const deleted = Number.parseInt(deletedRaw || "0", 10) || 0;
          if (deleted >= 20 && deleted > Math.max(added * 2, added + 10)) {
            heavyDeletes.push(`${file}: -${deleted}/+${added}`);
          }
        }
      } catch {}
      if (heavyDeletes.length > 0) {
        return {
          passed: false,
          reason: `REGRESSION_RISK: Story ${storyId} deleted substantial existing test coverage without an explicit deletion/migration requirement. Deleted tests usually represent accepted previous-story behavior. Files: ${heavyDeletes.slice(0, 8).join(", ")}`,
          category: "REGRESSION_RISK",
          suggestion: "Restore prior tests and make the new implementation pass them; only change tests for this story's new acceptance criteria",
        };
      }
    }
  }

  // Hard overflow
  if (sourceFiles.length > HARD_LIMIT) {
    return {
      passed: false,
      reason: `SCOPE OVERFLOW: Story ${storyId} (${storyTitle}) modified ${sourceFiles.length} source files — hard limit is ${HARD_LIMIT}. Files: ${sourceFiles.slice(0, 15).join(", ")}`,
      category: "SCOPE_OVERFLOW",
      suggestion: "Reset worktree and re-implement with only the files this story owns",
    };
  }

  // Soft warning (no failure)
  if (sourceFiles.length > SOFT_LIMIT) {
    logger.warn(`[scope-check] Story ${storyId} touched ${sourceFiles.length} files (soft limit ${SOFT_LIMIT})`, {});
  }

  return { passed: true, reason: sourceFiles.length > SOFT_LIMIT ? `Story ${storyId} touched ${sourceFiles.length} files — above typical scope` : undefined };
}

function worktreeBranch(workdir: string): string {
  if (!workdir || !fs.existsSync(workdir)) return "";
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim().toLowerCase();
  } catch {
    return "";
  }
}

export function selectMatchingStoryWorktree(storyBranch: string, contextWorkdir: string, canonicalWorkdir: string): string {
  const branch = String(storyBranch || "").trim().toLowerCase();
  if (!branch) return contextWorkdir && fs.existsSync(contextWorkdir) ? contextWorkdir : "";

  if (contextWorkdir && fs.existsSync(contextWorkdir) && worktreeBranch(contextWorkdir) === branch) {
    return contextWorkdir;
  }
  if (canonicalWorkdir && fs.existsSync(canonicalWorkdir) && worktreeBranch(canonicalWorkdir) === branch) {
    return canonicalWorkdir;
  }
  return "";
}

/**
 * Resolve worktree path for scope check (fixes parallel story context overwrite bug).
 */
export async function resolveStoryWorktree(currentStoryDbId: string, contextWorkdir: string): Promise<string> {
  const storyBranchRow = await pgGet<{ story_branch: string | null; context: string | null }>(
    "SELECT s.story_branch, r.context FROM stories s JOIN runs r ON r.id = s.run_id WHERE s.id = $1", [currentStoryDbId]
  );
  const storyBranch = storyBranchRow?.story_branch || "";
  if (storyBranch) {
    const worktreeBase = path.join(os.homedir(), ".openclaw", "workspaces", "workflows", "feature-dev", "agents", "developer", "story-worktrees");
    const candidateWd = path.join(worktreeBase, storyBranch);
    const selected = selectMatchingStoryWorktree(storyBranch, contextWorkdir, candidateWd);
    if (selected) return selected;
    try {
      const runContext = JSON.parse(storyBranchRow?.context || "{}") as Record<string, string>;
      const repo = runContext["repo"] || "";
      const reviewWorkdir = ensureStoryBranchWorktree(repo, storyBranch);
      if (reviewWorkdir) return reviewWorkdir;
    } catch {
      // Last resort below.
    }
  }
  return contextWorkdir && fs.existsSync(contextWorkdir) ? contextWorkdir : "";
}
