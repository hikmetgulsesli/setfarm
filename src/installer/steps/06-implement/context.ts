/**
 * 06-implement context injection — story-level context for the developer agent.
 *
 * Extracted from step-ops.ts injectStoryContext (lines 508-744).
 * Called from the loop claim path AFTER story selection + worktree creation.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pgGet, pgQuery } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { getStories, getCurrentStory, formatStoryForTemplate, formatCompletedStories, formatStoryRoadmap, parseAcceptanceCriteria } from "../../story-ops.js";
import type { Story } from "../../types.js";
import { parseOutputKeyValues } from "../../context-ops.js";
import { collectUiBehaviorRequirements, type UiBehaviorRequirement } from "../03-stories/context.js";
import { sanitizeDesignMismatchFeedback } from "../../error-taxonomy.js";
import { sanitizeRetryFeedbackForCurrentSource } from "../../retry-feedback.js";
import { readSupervisorMemory } from "../../product-supervisor.js";
import { IMPLICIT_STORY_SCOPE_FILES } from "../../story-scope.js";
import { applyStackContractContext } from "../../stack-contract/context.js";
import { applyLibraryPackContext } from "../../library-packs/context.js";
import { assembleImplementContext } from "../../setup-handoff.js";

const STITCH_HTML_EXCERPT_CHARS = 2500;
const STITCH_HTML_TOTAL_CHARS = 6000;
const DESIGN_DOM_EXCERPT_CHARS = 3000;
const UI_BEHAVIOR_CONTRACT_CHARS = 4500;

const WORKTREE_METADATA_FILES = new Set([
  ".story-scope-files",
  ".story-branch",
  "pre-commit",
]);
const WORKTREE_METADATA_PREFIXES = [
  "node_modules/",
  "references/",
  "stitch/",
  "dist/",
  ".git/",
];

const STORY_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
  SKIPPED: "skipped",
  VERIFIED: "verified",
} as const;

// Template vars that may be empty but must exist to prevent MISSING_INPUT_GUARD
const OPTIONAL_TEMPLATE_VARS = [
  "completed_stories", "story_roadmap", "stories_remaining", "progress", "project_memory",
  "story_scope_files", "story_shared_files", "story_scope_description",
  "story_implementation_contract",
  "implement_context", "implement_context_path",
  "file_skeletons", "scope_reminder", "stitch_html", "design_dom",
  "ui_behavior_contract",
  "project_tree", "installed_packages", "shared_code", "recent_stories_code",
  "component_registry", "api_routes", "design_rules", "detected_platform",
  "previous_failure", "failure_category", "failure_suggestion", "verify_feedback",
  "detected_stack", "stack_rules", "stack_contract", "stack_pack_id",
  "stack_prompt", "stack_setup_contract", "stack_verification_contract",
  "library_pack_ids", "library_packs", "library_prompt",
  "supervisor_memory",
];

function normalizedStatusFromStepOutput(output: string): string {
  try {
    const parsed = parseOutputKeyValues(output);
    const raw = (parsed["status"] || "").trim();
    return (raw.indexOf("\n") >= 0 ? raw.slice(0, raw.indexOf("\n")).trim() : raw).split(/\s/)[0].toLowerCase();
  } catch {
    return "";
  }
}

function extractActionableRetryFailureText(text: string): string {
  if (!text.trim()) return "";
  const status = normalizedStatusFromStepOutput(text);
  if (status !== "done" && status !== "skip") return sanitizeDesignMismatchFeedback(text);

  const lines = text.split(/\r?\n/);
  const actionableStart = lines.findIndex((line) =>
    /\b(REMAINING|FAILURES?|ERRORS?|ISSUES?|BLOCKERS?|FEEDBACK|PREVIOUS_FAILURE|PR_NOT_MERGED|PR_MISSING|VERIFY_SYSTEM_SMOKE_FAILURE|SYSTEM_SMOKE_FAILURE|QUALITY GATE|GUARDRAIL)\b/i.test(line),
  );
  if (actionableStart >= 0) {
    return sanitizeDesignMismatchFeedback(lines.slice(actionableStart).join("\n"));
  }
  return "";
}

function sanitizedRetryFailureText(text: string, repoPath?: string): string {
  const actionable = extractActionableRetryFailureText(text);
  if (!actionable.trim()) return "";
  return sanitizeRetryFeedbackForCurrentSource(actionable, { repoPath });
}

/**
 * Inject story-level context into the run context for the developer agent.
 * Called from step-ops.ts loop claim path after story is selected.
 */
export async function injectStoryContext(
  nextStory: any,
  step: { run_id: string; step_id: string; retry_count: number; max_retries: number },
  context: Record<string, string>,
  helpers: {
    readProgressFile: (runId: string) => Promise<string>;
    readProjectMemory: (ctx: Record<string, string>) => Promise<string>;
    resolveStoryScreens: (storyId: string, ctx: Record<string, string>, runId: string, source: string) => Promise<void>;
    generateSrcTree: (repoPath: string) => string;
    getProjectTree: (workdir: string) => string;
    getInstalledPackages: (workdir: string) => string;
    getSharedCode: (workdir: string) => string;
    getRecentStoryCode: (runId: string, repoPath: string, storyId: string) => Promise<string>;
    getComponentRegistry: (workdir: string) => string;
    getApiRoutes: (workdir: string) => string;
    updateRunContext: (runId: string, ctx: Record<string, string>) => Promise<void>;
  },
): Promise<void> {
  // Clear stale story context at claim time (not just completeStep).
  // Prevents cross-contamination when parallel stories share the same run context.
  const pipelineStoryBranch = context["story_branch"] || "";
  const pipelineStoryWorkdir = context["story_workdir"] || context["repo"] || "";
  delete context["pr_url"];
  delete context["story_branch"];
  delete context["current_story_id"];
  delete context["current_story_title"];
  delete context["current_story"];
  delete context["verify_feedback"];
  delete context["previous_failure"];
  delete context["failure_category"];
  delete context["failure_suggestion"];

  const story: Story = {
    id: nextStory.id,
    runId: nextStory.run_id,
    storyIndex: nextStory.story_index,
    storyId: nextStory.story_id,
    title: nextStory.title,
    description: nextStory.description,
    acceptanceCriteria: parseAcceptanceCriteria(nextStory.acceptance_criteria),
    status: nextStory.status as Story["status"],
    output: nextStory.output ?? undefined,
    retryCount: nextStory.retry_count,
    maxRetries: nextStory.max_retries,
  };
  const storyRepoPath = context["story_workdir"] || context["repo"] || context["REPO"] || "";
  const retryFailureText = nextStory.output && (nextStory.abandoned_count > 0 || nextStory.retry_count > 0)
    ? sanitizedRetryFailureText(String(nextStory.output), storyRepoPath)
    : "";

  const allStories = await getStories(step.run_id);
  const pendingCount = allStories.filter((s: any) => s.status === STORY_STATUS.PENDING || s.status === STORY_STATUS.RUNNING).length;

  context["current_story"] = formatStoryForTemplate(story);
  context["current_story_id"] = story.storyId;
  context["current_story_title"] = story.title;
  context["completed_stories"] = formatCompletedStories(allStories);
  context["story_roadmap"] = await formatStoryRoadmap(step.run_id, story.storyId);
  context["stories_remaining"] = String(pendingCount);
  context["progress"] = await helpers.readProgressFile(step.run_id);
  context["project_memory"] = await helpers.readProjectMemory(context);
  context["supervisor_memory"] = readSupervisorMemory(context);
  const stackContract = applyStackContractContext(context, {
    repoPath: storyRepoPath,
    taskText: context["prd"] || context["task"] || "",
    persist: Boolean(storyRepoPath),
  });
  applyLibraryPackContext(context, {
    repoPath: storyRepoPath,
    stackContract,
    taskText: context["prd"] || context["task"] || "",
    persist: Boolean(storyRepoPath),
  });

  // Story scope discipline injection (from planner's STORIES_JSON)
  await injectScopeContext(nextStory, context);

  // Clear stale story-specific context from previous story, then restore the
  // pipeline-owned worktree values set by the loop claim path.
  context["pr_url"] = "";
  context["story_branch"] = pipelineStoryBranch || `${step.run_id.slice(0, 8)}-${story.storyId}`.toLowerCase();
  context["story_workdir"] = pipelineStoryWorkdir;

  // Inject source tree
  const repoPath = storyRepoPath;
  context["verify_feedback"] = retryFailureText;

  if (repoPath && !context["src_tree"]) {
    const srcTree = helpers.generateSrcTree(repoPath);
    if (srcTree) context["src_tree"] = srcTree;
  }

  // Resolve story screens from SCREEN_MAP
  await helpers.resolveStoryScreens(story.storyId, context, step.run_id, "story-claim");

  // Inject stitch HTML content for this story's screens
  await injectStitchHtml(context, step.run_id, story.storyId);

  // Inject DESIGN_DOM for element-level coding guidance
  injectDesignDom(context);

  // Inject explicit behavior requirements from Stitch controls for this story's
  // screens. This is the prevention layer before smoke-test catches dead UI.
  injectUiBehaviorContract(context);

  // Smart Context Injection (implement-only)
  if (step.step_id === "implement") {
    await injectSmartContext(context, step.run_id, story.storyId, helpers);
  }

  // Platform-Specific Design Rules (implement + verify)
  if (step.step_id === "implement" || step.step_id === "verify") {
    try {
      const { detectPlatform, getDesignRules } = await import("../../design-rules.js");
      const platform = detectPlatform(context["repo"] || "");
      context["design_rules"] = getDesignRules(platform);
      context["detected_platform"] = platform;
    } catch (e) { logger.debug(`[design-rules] ${String(e).slice(0, 80)}`); }

  }

  // Inject previous_failure from prior abandon/verify-retry output before
  // persisting context, otherwise the next developer claim can render blank
  // retry feedback.
  if (retryFailureText) {
    const { classifyError } = await import("../../error-taxonomy.js");
    const classified = classifyError(retryFailureText);
    context["previous_failure"] = retryFailureText;
    context["failure_category"] = classified.category;
    context["failure_suggestion"] = classified.suggestion;
  }

  // Default optional template vars
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Persist story context to DB
  await helpers.updateRunContext(step.run_id, context);
}

// ── Internal helpers ───────────────────────────────────────────────

async function injectScopeContext(nextStory: any, context: Record<string, string>): Promise<void> {
  try {
    const scopeRow = await pgGet<{ scope_files: string; shared_files: string; scope_description: string; file_skeletons: string; implementation_contract: string; scope_targets: string | null; shared_edit_requests: string | null; depends_on: string | null }>(
      "SELECT scope_files, shared_files, scope_description, file_skeletons, implementation_contract, scope_targets, shared_edit_requests, depends_on FROM stories WHERE id = $1",
      [nextStory.id]
    );
    const baseRepo = context["repo"] || context["REPO"] || context["story_workdir"] || "";
    if (scopeRow && baseRepo) {
      const implementContext = assembleImplementContext({
        repo: baseRepo,
        runId: nextStory.run_id || "",
        storyId: nextStory.story_id || nextStory.id || "",
        storyRow: scopeRow,
      });
      if (implementContext) {
        context["implement_context"] = JSON.stringify(implementContext, null, 2);
        context["implement_context_path"] = `.setfarm/implement-context/${nextStory.story_id || nextStory.id}.json`;
        const resolved = Array.isArray((implementContext as any).resolvedScopeFiles)
          ? (implementContext as any).resolvedScopeFiles
          : [];
        const sharedWritable = Array.isArray((implementContext as any).sharedEditableFiles)
          ? (implementContext as any).sharedEditableFiles
              .filter((entry: any) => entry?.allowedForThisStory)
              .map((entry: any) => entry.path)
          : [];
        const merged = [...new Set([...resolved, ...sharedWritable])].filter(Boolean);
        if (merged.length > 0) context["story_scope_files"] = merged.join(", ");
      }
    }
    if (scopeRow?.scope_files) {
      try {
        const list = JSON.parse(scopeRow.scope_files);
        if (Array.isArray(list) && list.length > 0) context["story_scope_files"] = list.join(", ");
      } catch (e) { logger.debug(`[context] Malformed scope_files JSON: ${String(e).slice(0, 80)}`); }
    }
    if (scopeRow?.implementation_contract) {
      try {
        const contract = JSON.parse(scopeRow.implementation_contract);
        if (contract && typeof contract === "object" && Object.keys(contract).length > 0) {
          context["story_implementation_contract"] = JSON.stringify(contract, null, 2);
        }
      } catch (e) { logger.debug(`[context] Malformed implementation_contract JSON: ${String(e).slice(0, 80)}`); }
    }
    if (scopeRow?.shared_files) {
      try {
        const list = JSON.parse(scopeRow.shared_files);
        if (Array.isArray(list) && list.length > 0) context["story_shared_files"] = list.join(", ");
      } catch (e) { logger.debug(`[context] Malformed shared_files JSON: ${String(e).slice(0, 80)}`); }
    }
    if (scopeRow?.scope_description) context["story_scope_description"] = scopeRow.scope_description;
    if (scopeRow?.file_skeletons) {
      try {
        const skeletons = JSON.parse(scopeRow.file_skeletons);
        if (typeof skeletons === "object" && Object.keys(skeletons).length > 0) {
          context["file_skeletons"] = Object.entries(skeletons)
            .map(([filePath, sig]) => `${filePath}:\n${sig}`)
            .join("\n\n");
        }
      } catch (e) { logger.debug(`[context] Malformed file_skeletons JSON: ${String(e).slice(0, 80)}`); }
    }
    // Write .story-scope-files to worktree for pre-commit hook
    if (context["story_scope_files"] && context["story_workdir"]) {
      try {
        const scopeList = context["story_scope_files"].split(", ");
        const implicitFiles = IMPLICIT_STORY_SCOPE_FILES;
        const allAllowed = [...new Set([...scopeList, ...implicitFiles])];
        const scopeFilePath = path.join(context["story_workdir"], ".story-scope-files");
        fs.writeFileSync(scopeFilePath, allAllowed.join("\n") + "\n");
        try { fs.chmodSync(scopeFilePath, 0o664); } catch { /* best effort */ }
        cleanupOutOfScopeWorktreeFiles(
          context["story_workdir"],
          allAllowed,
          String(nextStory.story_id || nextStory.id || "story"),
          String(nextStory.run_id || ""),
        );
      } catch (e) { logger.debug(`[scope-file] ${String(e).slice(0, 80)}`); }
    }
    if (context["story_scope_files"]) {
      context["scope_reminder"] = "SCOPE ENFORCEMENT: You may ONLY write files in [" + context["story_scope_files"] + "]. shared_files are read-only/import context unless also listed in scope_files. Test files (*.test.*, *.spec.*), src/test/setup.*, src/test/utils.*, src/setupTests.*, and Vitest/Jest-only config (vitest.config.*, jest.config.*) are allowed. src/types/*, domain model files, vite.config.*, tailwind.config.*, tsconfig.*, index.html, App.tsx, main.tsx, index.css are FORBIDDEN unless in your scope_files. Never edit shared exported types to fix only your screen; use local display/adaptor types inside scoped files. Violation = instant SCOPE_BLEED rejection.";
    }
  } catch (e) {
    logger.debug(`[scope-inject] Could not read story scope columns: ${String(e).slice(0, 120)}`);
  }
}

function normalizeRepoPath(raw: string): string {
  return raw.trim().replace(/^"|"$/g, "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function parsePorcelainStatus(output: string): Array<{ code: string; file: string }> {
  const entries: Array<{ code: string; file: string }> = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim() || line.length < 4) continue;
    const code = line.slice(0, 2);
    const raw = line.slice(3).trim();
    if (!raw) continue;
    const parts = raw.includes(" -> ") ? raw.split(" -> ") : [raw];
    for (const part of parts) {
      const file = normalizeRepoPath(part);
      if (file) entries.push({ code, file });
    }
  }
  return entries;
}

function isAllowedWorktreePath(file: string, allowed: Set<string>): boolean {
  if (allowed.has(file)) return true;
  if (WORKTREE_METADATA_FILES.has(file)) return true;
  return WORKTREE_METADATA_PREFIXES.some((prefix) => file === prefix.slice(0, -1) || file.startsWith(prefix));
}

function isTrackedInHead(workdir: string, file: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${file}`], {
      cwd: workdir,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function listFilesRecursive(root: string, dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(root, abs));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      out.push(path.relative(root, abs).replace(/\\/g, "/"));
    }
  }
  return out;
}

function removeEmptyDirsUpTo(root: string, dir: string): void {
  let current = dir;
  const normalizedRoot = path.resolve(root);
  while (path.resolve(current).startsWith(normalizedRoot) && path.resolve(current) !== normalizedRoot) {
    try {
      if (fs.readdirSync(current).length > 0) return;
      fs.rmdirSync(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

export function cleanupOutOfScopeWorktreeFiles(
  workdir: string,
  allowedFiles: string[],
  storyId = "story",
  runId = "",
): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const gitPath = path.join(workdir, ".git");
  if (!fs.existsSync(gitPath)) return [];

  const allowed = new Set(allowedFiles.map(normalizeRepoPath).filter(Boolean));
  if (allowed.size === 0) return [];

  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain"], {
      cwd: workdir,
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    logger.debug(`[scope-clean] Could not inspect ${storyId}: ${String(e).slice(0, 120)}`);
    return [];
  }
  if (!status) return [];

  const cleaned: string[] = [];
  for (const entry of parsePorcelainStatus(status)) {
    const file = entry.file;
    if (isAllowedWorktreePath(file, allowed)) continue;

    const abs = path.join(workdir, file);
    try {
      if (entry.code === "??" || !isTrackedInHead(workdir, file)) {
        let removed = false;
        if (fs.existsSync(abs) && fs.lstatSync(abs).isDirectory()) {
          for (const child of listFilesRecursive(workdir, abs)) {
            if (isAllowedWorktreePath(child, allowed)) continue;
            fs.rmSync(path.join(workdir, child), { recursive: true, force: true });
            removeEmptyDirsUpTo(workdir, path.dirname(path.join(workdir, child)));
            cleaned.push(child);
            removed = true;
          }
        } else {
          fs.rmSync(abs, { recursive: true, force: true });
          removed = true;
        }
        if (removed && !cleaned.includes(file)) cleaned.push(file);
      } else {
        try {
          execFileSync("git", ["restore", "--staged", "--worktree", "--", file], {
            cwd: workdir,
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          });
        } catch {
          execFileSync("git", ["checkout", "HEAD", "--", file], {
            cwd: workdir,
            timeout: 10000,
            stdio: ["pipe", "pipe", "pipe"],
          });
        }
        cleaned.push(file);
      }
    } catch (e) {
      logger.warn(`[scope-clean] Failed to clean out-of-scope file ${file} for ${storyId}: ${String(e).slice(0, 160)}`, { runId });
    }
  }

  if (cleaned.length > 0) {
    logger.warn(`[scope-clean] Cleaned ${cleaned.length} out-of-scope dirty file(s) before ${storyId} claim: ${cleaned.slice(0, 10).join(", ")}`, { runId });
  }
  return cleaned;
}

async function injectStitchHtml(context: Record<string, string>, runId: string, storyId: string): Promise<void> {
  const storyScreensRaw = context["story_screens"] || "[]";
  try {
    const storyScreensParsed = JSON.parse(storyScreensRaw);
    const repoPath = context["repo"] || context["REPO"] || "";
    if (Array.isArray(storyScreensParsed) && storyScreensParsed.length > 0 && repoPath) {
      let stitchHtmlContent = "";
      for (const screen of storyScreensParsed) {
        const htmlFile = path.join(repoPath, screen.htmlFile || `stitch/${screen.screenId}.html`);
        if (fs.existsSync(htmlFile)) {
          const html = fs.readFileSync(htmlFile, "utf-8");
          const excerpt = html.replace(/\s+/g, " ").trim();
          const truncated = excerpt.length > STITCH_HTML_EXCERPT_CHARS
            ? excerpt.slice(0, STITCH_HTML_EXCERPT_CHARS) + " ...(truncated; use injected UI contracts instead of reading raw HTML)"
            : excerpt;
          stitchHtmlContent += `\nSTITCH SCREEN: ${screen.name || screen.screenId}\nFILE: ${screen.htmlFile || `stitch/${screen.screenId}.html`}\nHTML_EXCERPT: ${truncated}\n`;
          if (stitchHtmlContent.length > STITCH_HTML_TOTAL_CHARS) {
            stitchHtmlContent = stitchHtmlContent.slice(0, STITCH_HTML_TOTAL_CHARS) + "\n...(truncated; use UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of reading raw stitch HTML)\n";
            break;
          }
        }
      }
      if (stitchHtmlContent) {
        context["stitch_html"] = stitchHtmlContent;
        context["_stitch_html_transient"] = "true";
        logger.info(`[stitch-html-inject] Injected ${storyScreensParsed.length} screen HTML(s) (${stitchHtmlContent.length} chars)`, { runId });
      }
    }
  } catch (e) {
    logger.warn(`[stitch-html-inject] Failed: ${String(e)}`, { runId });
  }
}

function injectDesignDom(context: Record<string, string>): void {
  try {
    const storyScreens = JSON.parse(context["story_screens"] || "[]");
    const repoDom = context["repo"] || context["REPO"] || "";
    const designDomPath = path.join(repoDom, "stitch", "DESIGN_DOM.json");
    if (repoDom && fs.existsSync(designDomPath)) {
      const fullDom = JSON.parse(fs.readFileSync(designDomPath, "utf-8"));
      if (fullDom.screens) {
        const storyScreenIds = storyScreens.map((s: any) => s.screenId);
        const filteredScreens: Record<string, any> = {};
        for (const sid of storyScreenIds) {
          if (fullDom.screens[sid]) filteredScreens[sid] = fullDom.screens[sid];
        }
        const domToInject = Object.keys(filteredScreens).length > 0 ? filteredScreens : fullDom.screens;
        const domJson = JSON.stringify(domToInject);
        context["design_dom"] = domJson.length > DESIGN_DOM_EXCERPT_CHARS
          ? domJson.substring(0, DESIGN_DOM_EXCERPT_CHARS) + "...(truncated; use injected UI behavior contract instead of reading full DESIGN_DOM.json)"
          : domJson;
      }
    }
  } catch (e) { logger.debug(`[design-dom] ${String(e).slice(0, 80)}`); }
}

function renderUiBehaviorContract(reqs: UiBehaviorRequirement[]): string {
  if (reqs.length === 0) return "";
  const lines = [
    "Every control below is from Stitch DOM and MUST be implemented in this story when its screen is in scope.",
    "Each control needs real visible behavior: route/panel/dialog/state change/form validation. Empty onClick is forbidden.",
  ];
  let currentScreen = "";
  let totalBytes = lines.join("\n").length;
  for (const req of reqs) {
    const screenLine = `- ${req.screenId} (${req.screenTitle})`;
    if (currentScreen !== req.screenId) {
      if (totalBytes + screenLine.length > UI_BEHAVIOR_CONTRACT_CHARS) break;
      lines.push(screenLine);
      totalBytes += screenLine.length + 1;
      currentScreen = req.screenId;
    }
    const bits = [
      `${req.kind} "${req.label}"`,
      req.icon ? `icon=${req.icon}` : "",
      req.action ? `action=${req.action}` : "",
      req.route ? `route=${req.route}` : "",
      `expects=${req.expectedBehavior}`,
    ].filter(Boolean);
    const line = `  - ${bits.join("; ")}`;
    if (totalBytes + line.length > UI_BEHAVIOR_CONTRACT_CHARS) {
      lines.push("  - ...(truncated; continue with listed controls and generated screen contracts; do not read full DESIGN_DOM.json)");
      break;
    }
    lines.push(line);
    totalBytes += line.length + 1;
  }
  return lines.join("\n");
}

function injectUiBehaviorContract(context: Record<string, string>): void {
  try {
    const repoPath = context["repo"] || context["REPO"] || "";
    if (!repoPath) return;
    const reqs = collectUiBehaviorRequirements(repoPath);
    if (reqs.length === 0) return;

    let storyScreenIds = new Set<string>();
    try {
      const storyScreens = JSON.parse(context["story_screens"] || "[]");
      if (Array.isArray(storyScreens)) {
        storyScreenIds = new Set(storyScreens.map((s: any) => String(s?.screenId || "")).filter(Boolean));
      }
    } catch {
      storyScreenIds = new Set<string>();
    }

    const scopedReqs = storyScreenIds.size > 0
      ? reqs.filter(r => storyScreenIds.has(r.screenId))
      : reqs;
    const contract = renderUiBehaviorContract(scopedReqs.length > 0 ? scopedReqs : reqs);
    if (contract) context["ui_behavior_contract"] = contract;
  } catch (e) {
    logger.debug(`[ui-behavior-contract] ${String(e).slice(0, 100)}`);
  }
}

async function injectSmartContext(
  context: Record<string, string>,
  runId: string,
  storyId: string,
  helpers: {
    getProjectTree: (workdir: string) => string;
    getInstalledPackages: (workdir: string) => string;
    getSharedCode: (workdir: string) => string;
    getRecentStoryCode: (runId: string, repoPath: string, storyId: string) => Promise<string>;
    getComponentRegistry: (workdir: string) => string;
    getApiRoutes: (workdir: string) => string;
  },
): Promise<void> {
  const repoPath = context["repo"] || "";
  const workdir = context["story_workdir"] || repoPath;
  if (!workdir) return;
  try {
    const projectTree = helpers.getProjectTree(workdir);
    if (projectTree) context["project_tree"] = projectTree;

    const packages = helpers.getInstalledPackages(workdir);
    if (packages) context["installed_packages"] = packages;

    const sharedCode = helpers.getSharedCode(workdir);
    if (sharedCode) context["shared_code"] = sharedCode;

    const recentCode = await helpers.getRecentStoryCode(runId, repoPath, storyId);
    if (recentCode) context["recent_stories_code"] = recentCode;

    const components = helpers.getComponentRegistry(workdir);
    if (components) context["component_registry"] = components;

    const apiRoutes = helpers.getApiRoutes(workdir);
    if (apiRoutes) context["api_routes"] = apiRoutes;

    logger.info(`[smart-context] Injected: tree=${projectTree.length}c packages=${packages.length}c shared=${sharedCode.length}c recent=${recentCode.length}c components=${components.length}c api=${apiRoutes.length}c`, { runId });

    // Truncate if total context is too large (>200K estimated tokens)
    const totalChars = Object.values(context).reduce((sum, v) => sum + (v?.length || 0), 0);
    const estimatedTokens = Math.ceil(totalChars / 4);
    if (estimatedTokens > 200000) {
      context["recent_stories_code"] = (context["recent_stories_code"] || "").slice(0, 20000);
      context["shared_code"] = (context["shared_code"] || "").slice(0, 15000);
      logger.warn(`[smart-context] Context too large (${estimatedTokens} tokens est.), truncated`, { runId });
    }
  } catch (e) {
    logger.warn(`[smart-context] Injection failed: ${String(e)}`, { runId });
  }
}
