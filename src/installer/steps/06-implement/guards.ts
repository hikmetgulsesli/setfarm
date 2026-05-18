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
import { ensureStoryBranchWorktree } from "../../worktree-ops.js";
import { buildSupervisorChecklistFromProject } from "../../supervisor/checklist.js";
import { formatSupervisorBlockerFeedback } from "../../supervisor/intervention.js";
import { runImplementSupervisorScan } from "../../supervisor/run-supervisor.js";
import { formatSupervisorFindings, scanSupervisorChecklist } from "../../supervisor/scanner.js";
import type { SupervisorFinding } from "../../supervisor/types.js";

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
    const statusOut = execFileSync("git", ["status", "--porcelain"], {
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

  const smokeScript = path.join(os.homedir(), ".openclaw", "setfarm-repo", "scripts", "smoke-test.mjs");
  if (!fs.existsSync(smokeScript)) return { passed: true };

  try {
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

type JsxBlock = { attrs: string; inner: string; index: number };

const ICON_ALIASES: Record<string, string[]> = {
  arrow_drop_down: ["ChevronDown", "ArrowDown", "CaretDown", "arrow_drop_down"],
  arrow_drop_up: ["ChevronUp", "ArrowUp", "CaretUp", "arrow_drop_up"],
  emoji_events: ["Trophy", "Award", "Medal", "emoji_events"],
  help: ["HelpCircle", "CircleHelp", "help"],
  keyboard_arrow_down: ["ArrowDown", "ChevronDown", "keyboard_arrow_down"],
  keyboard_arrow_left: ["ArrowLeft", "ChevronLeft", "keyboard_arrow_left"],
  keyboard_arrow_right: ["ArrowRight", "ChevronRight", "keyboard_arrow_right"],
  keyboard_arrow_up: ["ArrowUp", "ChevronUp", "keyboard_arrow_up"],
  logout: ["LogOut", "LogOutIcon", "logout"],
  memory: ["Cpu", "MemoryStick", "memory"],
  menu: ["Menu", "menu"],
  menu_book: ["BookOpen", "Book", "NotebookText", "menu_book"],
  play_arrow: ["Play", "play_arrow"],
  play_circle: ["CirclePlay", "PlayCircle", "Play", "play_circle"],
  power_settings_new: ["Power", "power_settings_new"],
  refresh: ["RefreshCw", "RefreshCcw", "RotateCw", "refresh"],
  restart_alt: ["RefreshCw", "RefreshCcw", "RotateCcw", "restart_alt"],
  sports_esports: ["Gamepad2", "Gamepad", "Joystick", "sports_esports"],
  settings: ["Settings", "settings"],
  terminal: ["Terminal", "terminal"],
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

function sourceRendersComponent(source: string, componentName: string): boolean {
  const clean = stripSourceComments(source);
  const escaped = escapeRegExp(componentName);
  return new RegExp(`<\\s*${escaped}\\b`).test(clean)
    || new RegExp(`React\\.createElement\\(\\s*${escaped}\\b`).test(clean);
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
): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const previousRefs = previousStoryScreensRaw.flatMap((raw) => parseStoryScreenRefs(raw));
  if (previousRefs.length === 0) return [];

  const screenIndex = loadScreenIndex(workdir, repoPath);
  const previousEntries = screenEntriesForRefs(screenIndex, previousRefs);
  const byFile = new Map<string, { file: string; componentName: string; title: string }>();
  for (const entry of previousEntries) byFile.set(entry.file, entry);
  const missing = missingRenderedGeneratedScreens(workdir, [...byFile.values()]);
  if (missing.length === 0) return [];

  return [
    `GENERATED_SCREEN_REGRESSION: previously verified generated screen(s) are no longer rendered by the app/router surface: ${missing.map((entry) => `${entry.componentName} (${entry.file})`).join(", ")}. Keep prior story screens reachable while integrating the current story screens; do not replace prior generated screens with custom duplicate UI.`,
  ];
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
  const current = await pgGet<{ story_index: number | null }>(
    "SELECT story_index FROM stories WHERE id = $1",
    [currentStoryDbId],
  );
  if (current?.story_index == null) return { passed: true };
  const previousRows = await pgQuery<{ story_screens: string | null }>(
    "SELECT story_screens FROM stories WHERE run_id = $1 AND story_index < $2 AND status IN ('done', 'verified') ORDER BY story_index",
    [runId, current.story_index],
  );
  const issues = findGeneratedScreenRegressionIssues(
    workdir,
    previousRows.map((row) => row.story_screens || []),
    repoPath,
  );
  if (issues.length === 0) return { passed: true };
  return {
    passed: false,
    reason: `${issues.join("\n")}\nStory ${storyId} (${storyTitle}) reported STATUS: done while regressing a previously verified generated screen integration.`,
    category: "GENERATED_SCREEN_REGRESSION",
    suggestion: "Preserve previously verified generated screens through the app/router surface while adding the current story screens. Restore the prior render path and keep current-story changes bounded.",
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
  const required = Math.max(1, Math.ceil(declared.length * 0.5));
  if (present.length < required) {
    return {
      passed: false,
      reason: `SCOPE_FILE_MISSING: Story ${storyId} (${storyTitle}) declared scope_files=${JSON.stringify(declared)} but only ${present.length}/${declared.length} exist as non-empty files (required at least ${required}). Missing: ${missing.join(", ") || "none"}. You reported STATUS: done but too little of the owned scope exists.`,
      category: "SCOPE_FILE_MISSING",
      suggestion: "Write meaningful non-empty implementation code in the primary files listed in scope_files before reporting done",
    };
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
    const statusOut = execFileSync("git", ["status", "--porcelain"], {
      cwd: workdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    });
    dirtyFiles = statusOut.split(/\r?\n/).map(parseGitStatusPorcelainPath).filter(Boolean);
  } catch {}

  const allTouched = Array.from(new Set([...changedFiles, ...dirtyFiles]));
  const sourceFiles = allTouched.filter(f => SCOPE_EXTS.test(f) && !SCOPE_IGNORE.test(f));
  const forbiddenArtifacts = allTouched.filter(f => /^(QA_REPORT\.md|qa-report\.(md|json|txt)|smoke-(home|after-click)\.png|index\.html|package(-lock)?\.json|vite\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|eslint\.config\.[cm]?[jt]s)$/i.test(f));
  if (forbiddenArtifacts.length > 0 && retryCount < maxRetries) {
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
  if (sourceFiles.length === 0 && retryCount < maxRetries) {
    return {
      passed: false,
      reason: `NO WORK DETECTED: Story ${storyId} (${storyTitle}) reported STATUS: done but the worktree has ZERO source-file changes vs ${baseBranch}. The agent appears to have shortcut the task.`,
      category: "NO_WORK",
      suggestion: "Actually implement the story — write files and commit them",
    };
  }

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
  if (sourceFiles.length > 0 && retryCount < maxRetries) {
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
  if (testFiles.length > 0 && retryCount < maxRetries) {
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
  if (sourceFiles.length > HARD_LIMIT && retryCount < maxRetries) {
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
    if (fs.existsSync(candidateWd)) return candidateWd;
    if (contextWorkdir && fs.existsSync(contextWorkdir)) {
      try {
        const branch = execFileSync("git", ["branch", "--show-current"], {
          cwd: contextWorkdir,
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim().toLowerCase();
        if (branch === storyBranch.toLowerCase()) return contextWorkdir;
      } catch {
        // Fall through to rehydrate from the canonical repo.
      }
    }
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
