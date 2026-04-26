/**
 * 06-implement context injection — story-level context for the developer agent.
 *
 * Extracted from step-ops.ts injectStoryContext (lines 508-744).
 * Called from the loop claim path AFTER story selection + worktree creation.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pgGet, pgQuery } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { getStories, getCurrentStory, formatStoryForTemplate, formatCompletedStories, formatStoryRoadmap } from "../../story-ops.js";
import type { Story } from "../../types.js";
import { collectUiBehaviorRequirements, type UiBehaviorRequirement } from "../03-stories/context.js";

const STITCH_HTML_EXCERPT_CHARS = 2500;
const STITCH_HTML_TOTAL_CHARS = 6000;
const DESIGN_DOM_EXCERPT_CHARS = 3000;
const UI_BEHAVIOR_CONTRACT_CHARS = 4500;

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
  "file_skeletons", "scope_reminder", "stitch_html", "design_dom",
  "ui_behavior_contract",
  "project_tree", "installed_packages", "shared_code", "recent_stories_code",
  "component_registry", "api_routes", "design_rules", "detected_platform",
  "previous_failure", "failure_category", "failure_suggestion", "verify_feedback",
  "detected_stack", "stack_rules",
];

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

  const story: Story = {
    id: nextStory.id,
    runId: nextStory.run_id,
    storyIndex: nextStory.story_index,
    storyId: nextStory.story_id,
    title: nextStory.title,
    description: nextStory.description,
    acceptanceCriteria: (() => { try { return JSON.parse(nextStory.acceptance_criteria); } catch { logger.warn("Bad acceptance_criteria JSON for story " + nextStory.story_id); return []; } })(),
    status: nextStory.status as Story["status"],
    output: nextStory.output ?? undefined,
    retryCount: nextStory.retry_count,
    maxRetries: nextStory.max_retries,
  };

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

  // Story scope discipline injection (from planner's STORIES_JSON)
  await injectScopeContext(nextStory, context);

  // Clear stale story-specific context from previous story, then restore the
  // pipeline-owned worktree values set by the loop claim path.
  context["pr_url"] = "";
  context["story_branch"] = pipelineStoryBranch || `${step.run_id.slice(0, 8)}-${story.storyId}`.toLowerCase();
  context["story_workdir"] = pipelineStoryWorkdir;
  context["verify_feedback"] = "";

  // Inject source tree
  const repoPath = context["story_workdir"] || context["repo"] || context["REPO"] || "";
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

  // Default optional template vars
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Persist story context to DB
  await helpers.updateRunContext(step.run_id, context);

  // Inject previous_failure from prior abandon output
  if (nextStory.output && (nextStory.abandoned_count > 0 || nextStory.retry_count > 0)) {
    const { classifyError } = await import("../../error-taxonomy.js");
    const classified = classifyError(nextStory.output);
    context["previous_failure"] = nextStory.output;
    context["failure_category"] = classified.category;
    context["failure_suggestion"] = classified.suggestion;
  }
}

// ── Internal helpers ───────────────────────────────────────────────

async function injectScopeContext(nextStory: any, context: Record<string, string>): Promise<void> {
  try {
    const scopeRow = await pgGet<{ scope_files: string; shared_files: string; scope_description: string; file_skeletons: string }>(
      "SELECT scope_files, shared_files, scope_description, file_skeletons FROM stories WHERE id = $1",
      [nextStory.id]
    );
    if (scopeRow?.scope_files) {
      try {
        const list = JSON.parse(scopeRow.scope_files);
        if (Array.isArray(list) && list.length > 0) context["story_scope_files"] = list.join(", ");
      } catch (e) { logger.debug(`[context] Malformed scope_files JSON: ${String(e).slice(0, 80)}`); }
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
        const implicitFiles = ["vitest.config.ts","vitest.config.js","jest.config.ts","jest.config.js","src/test/setup.ts","src/test/utils.ts","src/setupTests.ts"];
        const allAllowed = [...new Set([...scopeList, ...implicitFiles])];
        const scopeFilePath = path.join(context["story_workdir"], ".story-scope-files");
        fs.writeFileSync(scopeFilePath, allAllowed.join("\n") + "\n");
        try { fs.chmodSync(scopeFilePath, 0o664); } catch { /* best effort */ }
      } catch (e) { logger.debug(`[scope-file] ${String(e).slice(0, 80)}`); }
    }
    if (context["story_scope_files"]) {
      context["scope_reminder"] = "SCOPE ENFORCEMENT: You may ONLY write files in [" + context["story_scope_files"] + "]. Test files (*.test.tsx) and test config (vitest.config.ts, src/test/setup.ts) are also allowed. App.tsx, main.tsx, index.css are FORBIDDEN unless in your scope_files. Violation = instant SCOPE_BLEED rejection.";
    }
  } catch (e) {
    logger.debug(`[scope-inject] Could not read story scope columns: ${String(e).slice(0, 120)}`);
  }
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
            ? excerpt.slice(0, STITCH_HTML_EXCERPT_CHARS) + " ...(truncated; read file for full HTML)"
            : excerpt;
          stitchHtmlContent += `\nSTITCH SCREEN: ${screen.name || screen.screenId}\nFILE: ${screen.htmlFile || `stitch/${screen.screenId}.html`}\nHTML_EXCERPT: ${truncated}\n`;
          if (stitchHtmlContent.length > STITCH_HTML_TOTAL_CHARS) {
            stitchHtmlContent = stitchHtmlContent.slice(0, STITCH_HTML_TOTAL_CHARS) + "\n...(truncated; read stitch files for full design)\n";
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
          ? domJson.substring(0, DESIGN_DOM_EXCERPT_CHARS) + "...(truncated; read stitch/DESIGN_DOM.json for full DOM)"
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
      lines.push("  - ...(truncated; read stitch/DESIGN_DOM.json for the full behavior contract)");
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
