import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { logger } from "../lib/logger.js";

export type ProductSupervisorPhase = "plan" | "design" | "stories" | "implement" | "deploy";

export interface ProductSupervisorStory {
  story_id?: string | null;
  story_index?: number | null;
  title?: string | null;
  description?: string | null;
  acceptance_criteria?: string | null;
  scope_files?: string | null;
  shared_files?: string | null;
  scope_description?: string | null;
}

export interface ProductSupervisorInput {
  phase: ProductSupervisorPhase;
  runId: string;
  stepId: string;
  task?: string;
  parsed?: Record<string, string | undefined>;
  context?: Record<string, string>;
  rawOutput?: string;
  workdir?: string;
  baseRef?: string;
  stories?: ProductSupervisorStory[];
  currentStory?: ProductSupervisorStory | null;
}

export interface ProductSupervisorResult {
  ok: boolean;
  code: string;
  reason: string;
  issues: string[];
  memoryEntry: string;
}

const TOKEN_STOP_WORDS = new Set([
  "a", "about", "across", "active", "add", "admin", "all", "also", "and", "app",
  "application", "based", "bridge", "broader", "build", "browser", "button", "can", "client", "code",
  "component", "components", "control", "controls", "create", "current", "data",
  "declared", "desktop", "design", "develop", "display", "dom", "done", "edit", "engine", "error", "feature",
  "features", "file", "flow", "for", "from", "grid", "help", "high", "home",
  "implement", "include", "includes", "input", "interface", "layout", "level",
  "levels", "local", "main", "make", "menu", "mobile", "mode", "new", "page",
  "owned", "owner", "panel", "platform", "project", "react", "record", "records", "report", "repo",
  "required", "requirements", "responsive", "route", "screen", "screens", "section",
  "boundaries", "boundary", "changes", "editing", "files", "group", "groups", "helper", "read",
  "scope", "settings", "shared", "shell", "sibling", "siblings", "state", "status", "summary", "support", "surface", "system", "task",
  "test", "tests", "the", "these", "those", "through", "touch", "typescript", "ui", "use", "user",
  "using", "view", "visible", "vite", "web", "wire", "wiring", "with", "without", "workflow",
  "bir", "bu", "icin", "için", "ile", "proje", "uygulama", "uygulamasi", "ve",
  "veya", "yap", "yeni",
]);

const GENERIC_SCREEN_TERMS = new Set([
  "board", "complete", "completion", "dashboard", "detail", "edit", "empty", "error",
  "form", "game", "help", "home", "insight", "insights", "list", "main", "menu",
  "metric", "metrics", "option", "options", "overlay", "overview", "panel", "pause", "play",
  "player", "primary", "progress", "result", "results", "settings", "status",
  "summary", "support", "workflow",
]);

const PRODUCT_OPTIONAL_GROUPS: Array<{ name: string; terms: string[]; taskHints: RegExp }> = [
  { name: "auth/login", terms: ["auth", "login", "signin", "signup"], taskHints: /\b(auth|login|sign ?in|sign ?up|private|admin|account|user)\b/i },
  { name: "profile/account", terms: ["profile", "account"], taskHints: /\b(profile|account|user|auth|login|sign ?in|hesap|profil|kullanici|kullanıcı)\b/i },
];

const IMPLEMENT_SCAN_EXT = /\.(tsx?|jsx?|vue|svelte|html)$/i;
const IMPLEMENT_SCAN_IGNORE = /^(node_modules\/|dist\/|build\/|\.next\/|coverage\/|stitch\/|references\/)/;

function normalizeText(text: string): string {
  return String(text || "")
    .replace(/[İ]/g, "I")
    .replace(/[ı]/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o");
}

function tokenise(text: string): string[] {
  const normalized = normalizeText(text);
  const raw = normalized.match(/[a-z0-9][a-z0-9_-]{2,}/g) || [];
  const out: string[] = [];
  for (const token of raw) {
    if (/^\d+$/.test(token)) continue;
    if (/^\d{4,8}$/.test(token)) continue;
    const parts = token.split(/[-_]+/).filter(Boolean);
    for (const part of parts.length > 1 ? parts : [token]) {
      if (part.length < 3 || /^\d+$/.test(part) || TOKEN_STOP_WORDS.has(part)) continue;
      out.push(part);
    }
  }
  return [...new Set(out)];
}

function taskDomainTokens(task: string): string[] {
  const withoutProjectPrefix = String(task || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:Project|Proje)\s*:\s*[^\s]+\s*/i, ""))
    .join("\n");
  return tokenise(withoutProjectPrefix).slice(0, 40);
}

function parseJsonArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeGit(workdir: string, args: string[], timeout = 10000): string {
  try {
    return execFileSync("git", args, {
      cwd: workdir,
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function changedFilesForImplement(workdir: string, baseRef: string): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const files = new Set<string>();
  const diffRef = baseRef ? `${baseRef}...HEAD` : "HEAD";
  const diff = safeGit(workdir, ["diff", "--name-only", diffRef]);
  diff.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => files.add(file));

  const status = safeGit(workdir, ["status", "--porcelain"]);
  for (const line of status.split(/\r?\n/)) {
    const rel = line.slice(3).trim();
    if (rel) files.add(rel.replace(/^"|"$/g, ""));
  }
  return [...files].filter((file) => !IMPLEMENT_SCAN_IGNORE.test(file.replace(/\\/g, "/")));
}

function sourceWithoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (_match, prefix) => `${prefix}${" ".repeat(Math.max(0, _match.length - prefix.length))}`);
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function hasAttribute(attrs: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b\\s*(?:=|$)`, "i").test(attrs);
}

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
  return hasAttribute(attrs, "aria-current") || hasAttribute(attrs, "aria-disabled") || hasAttribute(attrs, "disabled");
}

function findStaticInteractionIssues(workdir: string, files: string[]): string[] {
  const issues: string[] = [];
  for (const rel of files.filter((file) => IMPLEMENT_SCAN_EXT.test(file)).slice(0, 80)) {
    const abs = path.join(workdir, rel);
    let source = "";
    try {
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      source = fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    const malformedUrl = /https?:\/\/https?\/\//i.exec(source);
    if (malformedUrl) {
      issues.push(`${rel}:${lineForIndex(source, malformedUrl.index)} malformed URL/protocol: ${malformedUrl[0]}`);
    }

    const clean = sourceWithoutComments(source);

    const deadHref = /<a\b([^>]*)>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = deadHref.exec(clean)) !== null) {
      const attrs = linkMatch[1] || "";
      if (isDeadHrefValue(attrValue(attrs, "href")) && !isExplicitlyInertAnchor(attrs)) {
        issues.push(`${rel}:${lineForIndex(clean, linkMatch.index)} active link uses a dead href`);
        if (issues.length >= 12) break;
      }
    }

    const button = /<button\b([^>]*)>/gi;
    let match: RegExpExecArray | null;
    while ((match = button.exec(clean)) !== null) {
      const attrs = match[1] || "";
      const isDisabled = hasAttribute(attrs, "disabled") || hasAttribute(attrs, "aria-disabled");
      const isSubmit = /\btype\s*=\s*(?:"submit"|'submit'|{\s*["']submit["']\s*})/i.test(attrs);
      const hasHandler = /\bon(?:Click|PointerDown|PointerUp|MouseDown|MouseUp|TouchStart|TouchEnd|KeyDown|Submit)\s*=/.test(attrs);
      if (!isDisabled && !isSubmit && !hasHandler) {
        issues.push(`${rel}:${lineForIndex(clean, match.index)} active <button> has no event handler, disabled state, or submit type`);
        if (issues.length >= 12) break;
      }
    }
    if (issues.length >= 12) break;
  }
  return issues;
}

function parsePrdScreenRows(prd: string): Array<{ name: string; description: string }> {
  const rows: Array<{ name: string; description: string }> = [];
  const lines = String(prd || "").split(/\r?\n/);
  let inScreens = false;
  for (const line of lines) {
    if (/^##+\s+Screens\b/i.test(line.trim())) {
      inScreens = true;
      continue;
    }
    if (inScreens && /^##+\s+/.test(line.trim())) break;
    if (!inScreens || !/^\s*\|/.test(line) || /^\s*\|\s*-+/.test(line)) continue;
    const cols = line.split("|").map((v) => v.trim()).filter(Boolean);
    if (cols.length < 4 || /^#$/i.test(cols[0]) || /screen name/i.test(cols[1])) continue;
    rows.push({ name: cols[1], description: cols.slice(3).join(" ") });
  }
  return rows;
}

function specificScreenTerms(name: string, description: string): string[] {
  return tokenise(`${name} ${description}`)
    .filter((term) => !GENERIC_SCREEN_TERMS.has(term))
    .slice(0, 12);
}

function normalizeScreenName(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function screenNameMatches(expectedName: string, actualName: string): boolean {
  const expected = normalizeScreenName(expectedName);
  const actual = normalizeScreenName(actualName);
  if (!expected || !actual) return false;
  if (expected === actual) return true;
  if (actual.startsWith(`${expected} `)) return true;
  if (expected.startsWith(`${actual} `)) return true;

  const expectedTokens = expected.split(" ").filter(Boolean);
  const actualTokens = new Set(actual.split(" ").filter(Boolean));
  if (expectedTokens.length < 2) return false;
  return expectedTokens.every((token) => actualTokens.has(token));
}

function enoughDomainCoverage(sourceTerms: string[], targetText: string): boolean {
  if (sourceTerms.length < 3) return true;
  const targetTerms = new Set(tokenise(targetText));
  const hits = sourceTerms.filter((term) => targetTerms.has(term));
  return hits.length >= Math.min(3, sourceTerms.length);
}

function checkPlan(input: ProductSupervisorInput): string[] {
  const parsed = input.parsed || {};
  const task = input.task || input.context?.task || "";
  const prd = parsed.prd || input.context?.prd || "";
  const issues: string[] = [];
  const taskTerms = taskDomainTokens(task);

  if (!enoughDomainCoverage(taskTerms, prd)) {
    const prdTerms = new Set(tokenise(prd));
    const missing = taskTerms.filter((term) => !prdTerms.has(term)).slice(0, 8);
    issues.push(`PLAN_TRACEABILITY: PRD does not preserve enough task/domain terms. Missing examples: ${missing.join(", ") || "n/a"}.`);
  }

  const rows = parsePrdScreenRows(prd);
  const declaredCount = Number.parseInt(parsed.prd_screen_count || "", 10);
  if (Number.isFinite(declaredCount) && rows.length > 0 && declaredCount !== rows.length) {
    issues.push(`PLAN_SCREEN_COUNT: PRD_SCREEN_COUNT=${declaredCount} but Screens table has ${rows.length} row(s).`);
  }

  const taskTermSet = new Set(taskTerms);
  for (const row of rows.slice(0, 30)) {
    const specific = specificScreenTerms(row.name, "");
    if (specific.length === 0) continue;
    const traceable = specific.some((term) => taskTermSet.has(term));
    if (!traceable && taskTerms.length >= 3) {
      issues.push(`PLAN_SCREEN_DRIFT: Screen "${row.name}" has unrequested specific terms: ${specific.slice(0, 5).join(", ")}.`);
    }
  }

  const normalizedTask = normalizeText(task);
  const screenText = normalizeText(rows.map((row) => `${row.name} ${row.description}`).join(" "));
  for (const group of PRODUCT_OPTIONAL_GROUPS) {
    if (group.taskHints.test(normalizedTask)) continue;
    if (group.terms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(screenText))) {
      issues.push(`PLAN_OPTIONAL_MODULE_DRIFT: PRD introduces ${group.name} behavior but the task does not request it.`);
    }
  }

  return issues;
}

function checkDesign(input: ProductSupervisorInput): string[] {
  const context = input.context || {};
  const parsed = input.parsed || {};
  const prd = context.prd || context.PRD || parsed.prd || "";
  const rows = parsePrdScreenRows(prd);
  const screenMap = parseJsonArray(parsed.screen_map || context.screen_map || context.SCREEN_MAP || "");
  const issues: string[] = [];

  if (screenMap.length === 0) {
    issues.push("DESIGN_SCREEN_MAP_EMPTY: design did not produce SCREEN_MAP entries.");
    return issues;
  }

  const seen = new Map<string, number>();
  for (const screen of screenMap) {
    const key = normalizeScreenName(String(screen?.name || ""));
    if (!key) {
      issues.push("DESIGN_SCREEN_NAME_MISSING: SCREEN_MAP contains an entry without a usable name.");
      continue;
    }
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name).slice(0, 8);
  if (duplicates.length > 0) {
    issues.push(`DESIGN_SCREEN_DUPLICATE: duplicate screen names in SCREEN_MAP: ${duplicates.join(", ")}.`);
  }

  if (rows.length > 0) {
    const missing = rows
      .filter((row) => !screenMap.some((screen) => screenNameMatches(row.name, String(screen?.name || ""))))
      .map((row) => row.name)
      .slice(0, 8);
    const extra = screenMap
      .filter((screen) => !rows.some((row) => screenNameMatches(row.name, String(screen?.name || ""))))
      .map((screen) => String(screen?.name || "unnamed"))
      .slice(0, 8);

    if (screenMap.length !== rows.length) {
      issues.push(`DESIGN_SCREEN_COUNT_DRIFT: SCREEN_MAP has ${screenMap.length} screen(s) but PRD Screens table has ${rows.length}.`);
    }
    if (missing.length > 0) {
      issues.push(`DESIGN_SCREEN_MISSING: missing PRD screen(s): ${missing.join(", ")}.`);
    }
    if (extra.length > 0) {
      issues.push(`DESIGN_SCREEN_EXTRA: unrequested design screen(s): ${extra.join(", ")}.`);
    }
  }

  return issues;
}

function stringifyStory(story: ProductSupervisorStory): string {
  return [
    story.story_id || "",
    story.title || "",
    story.description || "",
    story.acceptance_criteria || "",
    story.scope_description || "",
    story.scope_files || "",
  ].join(" ");
}

function checkStories(input: ProductSupervisorInput): string[] {
  const stories = input.stories || [];
  const context = input.context || {};
  const source = [
    input.task || context.task || "",
    context.prd || context.PRD || "",
    context.screen_map || context.SCREEN_MAP || "",
  ].join(" ");
  const sourceTerms = new Set(tokenise(source));
  const issues: string[] = [];

  if (stories.length === 0) {
    issues.push("STORY_SUPERVISION_EMPTY: no stories available for supervisor review.");
    return issues;
  }

  const allStoryText = stories.map(stringifyStory).join(" ");
  if (!enoughDomainCoverage(taskDomainTokens(input.task || context.task || ""), allStoryText)) {
    issues.push("STORY_TRACEABILITY: stories do not preserve enough original task/domain terms.");
  }

  for (const story of stories) {
    const label = story.story_id || story.title || "unknown";
    const text = stringifyStory(story);
    if (/\b(TODO|coming soon|placeholder|lorem ipsum)\b/i.test(text)) {
      issues.push(`STORY_PLACEHOLDER: ${label} contains placeholder completion language.`);
    }

    const titleTerms = tokenise(`${story.title || ""} ${story.description || ""}`)
      .filter((term) => !GENERIC_SCREEN_TERMS.has(term));
    const traced = titleTerms.filter((term) => sourceTerms.has(term));
    const untraced = titleTerms.filter((term) => !sourceTerms.has(term));
    if (untraced.length >= 3 && traced.length === 0 && sourceTerms.size >= 5) {
      issues.push(`STORY_DOMAIN_DRIFT: ${label} introduces untraced terms: ${untraced.join(", ")}.`);
    }

    const ac = parseJsonArray(story.acceptance_criteria);
    if (story.story_index !== 0 && ac.length === 0) {
      issues.push(`STORY_ACCEPTANCE_MISSING: ${label} has no acceptance criteria.`);
    }
  }
  return issues;
}

function checkImplement(input: ProductSupervisorInput): string[] {
  const story = input.currentStory;
  const output = input.rawOutput || "";
  const issues: string[] = [];
  if (!story) return issues;

  if (/\b(TODO|coming soon|placeholder|not implemented)\b/i.test(output)) {
    issues.push(`IMPLEMENT_PLACEHOLDER: ${story.story_id || story.title || "story"} completion output still mentions placeholder or unfinished work.`);
  }

  const workdir = input.workdir || input.context?.story_workdir || input.context?.repo || "";
  if (workdir && fs.existsSync(workdir)) {
    const changedFiles = changedFilesForImplement(workdir, input.baseRef || input.context?.story_base_ref || "HEAD");
    if (changedFiles.length === 0) {
      issues.push(`IMPLEMENT_NO_DELTA: ${story.story_id || story.title || "story"} reported done but supervisor found no changed files in the story worktree.`);
    }

    const interactionIssues = findStaticInteractionIssues(workdir, changedFiles);
    if (interactionIssues.length > 0) {
      issues.push(`IMPLEMENT_INTERACTION_CONTRACT: active controls or URLs are not wired correctly. ${interactionIssues.slice(0, 8).join("; ")}`);
    }
  }
  return issues;
}

function checkDeploy(input: ProductSupervisorInput): string[] {
  const parsed = input.parsed || {};
  const issues: string[] = [];
  const deployUrl = parsed.deploy_url || parsed.url || "";
  if (deployUrl && /https?:\/\/https?\/\//i.test(deployUrl)) {
    issues.push(`DEPLOY_URL_MALFORMED: deploy URL has duplicate/broken protocol: ${deployUrl}`);
  }
  if ((parsed.status || "").toLowerCase() === "done") {
    const report = [deployUrl, parsed.systemd_unit || "", parsed.port || "", input.rawOutput || ""].join(" ");
    if (!/\b(health|smoke|curl|systemctl|active|running|200|ok)\b/i.test(report)) {
      issues.push("DEPLOY_EVIDENCE_MISSING: deploy completion lacks health/systemd/smoke evidence.");
    }
  }
  return issues;
}

export function runProductSupervisorGate(input: ProductSupervisorInput): ProductSupervisorResult {
  let issues: string[] = [];
  if (input.phase === "plan") issues = checkPlan(input);
  if (input.phase === "design") issues = checkDesign(input);
  if (input.phase === "stories") issues = checkStories(input);
  if (input.phase === "implement") issues = checkImplement(input);
  if (input.phase === "deploy") issues = checkDeploy(input);

  const ok = issues.length === 0;
  const code = ok ? "PRODUCT_SUPERVISOR_OK" : `PRODUCT_SUPERVISOR_${input.phase.toUpperCase()}_BLOCKED`;
  const reason = ok
    ? `${input.phase} passed product-supervisor review`
    : issues.join(" ");
  const memoryEntry = formatSupervisorMemoryEntry(input, { ok, code, reason, issues, memoryEntry: "" });
  return { ok, code, reason, issues, memoryEntry };
}

function repoFromContext(context: Record<string, string> | undefined): string {
  return String(context?.repo || context?.REPO || "").trim();
}

function ensureGitExclude(repo: string, relPath: string): void {
  try {
    const infoDir = path.join(repo, ".git", "info");
    if (!fs.existsSync(infoDir)) return;
    const excludePath = path.join(infoDir, "exclude");
    const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf-8") : "";
    if (existing.split(/\r?\n/).includes(relPath)) return;
    fs.appendFileSync(excludePath, `${existing.endsWith("\n") || !existing ? "" : "\n"}${relPath}\n`);
  } catch {
    // supervisor memory is best-effort; never block on git exclude updates
  }
}

export function supervisorMemoryPath(context: Record<string, string> | undefined): string {
  const repo = repoFromContext(context);
  return repo ? path.join(repo, "SUPERVISOR_MEMORY.md") : "";
}

export function readSupervisorMemory(context: Record<string, string> | undefined): string {
  const memoryPath = supervisorMemoryPath(context);
  if (!memoryPath) return "(no supervisor memory yet)";
  try {
    if (!fs.existsSync(memoryPath)) return "(no supervisor memory yet)";
    return fs.readFileSync(memoryPath, "utf-8");
  } catch {
    return "(no supervisor memory yet)";
  }
}

function formatSupervisorMemoryEntry(input: ProductSupervisorInput, result: ProductSupervisorResult): string {
  const story = input.currentStory?.story_id ? ` story=${input.currentStory.story_id}` : "";
  const status = result.ok ? "pass" : "blocked";
  const lines = [
    `### ${new Date().toISOString()} ${input.phase} ${status}${story}`,
    `- Code: ${result.code}`,
    `- Step: ${input.stepId}`,
    `- Summary: ${result.reason.slice(0, 800)}`,
  ];
  if (result.issues.length > 0) {
    for (const issue of result.issues.slice(0, 8)) lines.push(`- Issue: ${issue.slice(0, 500)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function updateSupervisorMemory(
  context: Record<string, string> | undefined,
  entry: string,
): void {
  if (!context || !entry.trim()) return;
  const repo = repoFromContext(context);
  if (!repo) return;
  try {
    const memoryPath = path.join(repo, "SUPERVISOR_MEMORY.md");
    const existing = fs.existsSync(memoryPath)
      ? fs.readFileSync(memoryPath, "utf-8")
      : (context.supervisor_memory || "# Supervisor Memory\n\n");
    let next = `${existing.trimEnd()}\n\n${entry}`;
    const lines = next.split(/\r?\n/);
    if (lines.length > 260) {
      next = ["# Supervisor Memory", "", ...lines.slice(-240)].join("\n");
    }
    const finalMemory = next.endsWith("\n") ? next : `${next}\n`;
    context.supervisor_memory = next.slice(-6000);
    context.product_supervisor_status = entry.includes(" blocked") ? "blocked" : "ok";
    if (entry.includes(" blocked")) context.product_supervisor_blocked = entry.slice(0, 1200);
    else delete context.product_supervisor_blocked;
    if (!fs.existsSync(repo)) return;
    ensureGitExclude(repo, "SUPERVISOR_MEMORY.md");
    fs.writeFileSync(memoryPath, finalMemory);
  } catch (err) {
    logger.warn(`[product-supervisor] memory update failed: ${String(err).slice(0, 160)}`, {});
  }
}
