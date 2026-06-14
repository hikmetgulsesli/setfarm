import fs from "node:fs";
import path from "node:path";
import { pgBegin, pgGet, pgQuery, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { STACK_PACKS } from "./stack-contract/packs.js";
import type { StackPackId } from "./stack-contract/types.js";
import { hasBrowserGameIntent } from "./task-intent.js";

export type ContractStatus = "pass" | "fail" | "pending" | "deferred" | "na";

export interface ContractItem {
  id: string;
  label: string;
  status: ContractStatus;
  owner: string;
  evidence?: string;
  blocker?: string;
  storyId?: string;
  stepId?: string;
  updatedAt: string;
}

export interface ContractPhase {
  id: string;
  label: string;
  status: ContractStatus;
  items: ContractItem[];
}

export interface ContractStoryOwnership {
  storyId: string;
  title: string;
  status: string;
  ownsScreens: string[];
  scopeFiles: string[];
  sharedFiles: string[];
  dependsOn: string[];
  deferred: boolean;
  blocker?: string;
}

type ScreenRef = {
  screenId: string;
  name?: string;
  title?: string;
  type?: string;
};

type InternalStoryOwnership = ContractStoryOwnership & {
  ownsScreenIds: string[];
};

export interface RunContract {
  schema: "setfarm.run-contract.v1";
  version: 1;
  runId: string;
  runNumber?: number;
  workflowId: string;
  status: string;
  task: string;
  project: {
    repo: string;
    branch: string;
    displayName: string;
    techStack: string;
    uiLanguage: string;
  };
  stackPack: {
    id: StackPackId | "unknown";
    label: string;
    confidence: "high" | "medium" | "low";
    evidence: string[];
  };
  progress: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    deferred: number;
    na: number;
  };
  phases: ContractPhase[];
  stories: ContractStoryOwnership[];
  artifacts: {
    stitchDir?: string;
    designScreenCount: number;
    htmlCount: number;
    pngCount: number;
    domManifest: boolean;
    uiContract: boolean;
  };
  blockers: string[];
  updatedAt: string;
  reason: string;
}

interface DbRun {
  id: string;
  run_number?: number;
  workflow_id: string;
  task: string;
  status: string;
  context: string | Record<string, unknown>;
  meta?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DbStep {
  id: string;
  run_id?: string;
  step_id: string;
  agent_id?: string;
  status: string;
  output?: string | null;
  retry_count?: number;
  max_retries?: number;
  type?: string;
  current_story_id?: string | null;
}

interface DbStory {
  id: string;
  run_id?: string;
  story_index?: number;
  story_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  status: string;
  output?: string | null;
  retry_count?: number;
  max_retries?: number;
  depends_on?: string | null;
  scope_files?: string | null;
  scope_targets?: string | null;
  resolved_scope_files?: string | null;
  shared_files?: string | null;
  shared_edit_requests?: string | null;
  story_screens?: string | null;
  implementation_contract?: string | null;
  pr_url?: string | null;
  story_branch?: string | null;
  merge_status?: string | null;
}

export interface BuildRunContractInput {
  run: DbRun;
  steps: DbStep[];
  stories: DbStory[];
  context?: Record<string, any>;
  reason?: string;
  now?: string;
}

const CONTRACT_CONTEXT_KEY = "run_contract";

function safeParse<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseContext(raw: unknown): Record<string, any> {
  const parsed = safeParse<Record<string, any>>(raw, {});
  return parsed && !Array.isArray(parsed) ? parsed : {};
}

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((v) => v.trim()).filter(Boolean);
  if (raw == null) return [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const parsed = safeParse<unknown>(trimmed, null);
    if (Array.isArray(parsed)) return parsed.map(String).map((v) => v.trim()).filter(Boolean);
    return trimmed
      .split(/\r?\n|,/)
      .map((v) => v.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function parseScreenRefs(raw: unknown): ScreenRef[] {
  if (raw == null || raw === "") return [];
  const parsed = typeof raw === "string" ? safeParse<unknown>(raw.trim(), raw) : raw;
  const items = Array.isArray(parsed) ? parsed : parseStringList(raw);
  const screens: ScreenRef[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const screenId = item.trim();
      if (screenId) screens.push({ screenId, name: screenId });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const screenId = String(record.screenId || record.id || record.slug || "").trim();
    const name = String(record.name || record.title || record.screenTitle || "").trim();
    const type = String(record.type || record.kind || "").trim();
    const fallbackId = screenId || name;
    if (!fallbackId) continue;
    screens.push({
      screenId: fallbackId,
      name: name || fallbackId,
      title: String(record.title || "").trim() || undefined,
      type: type || undefined,
    });
  }
  return screens;
}

function parseOwnedScreenRefs(story: DbStory): ScreenRef[] {
  const explicit = parseScreenRefs(story.story_screens);
  if (explicit.length > 0) return explicit;
  const contract = safeParse<Record<string, unknown>>(story.implementation_contract, {});
  const ids = parseStringList(contract.owned_screen_ids);
  const files = parseStringList(contract.owned_screen_files);
  return ids.map((screenId, index) => ({
    screenId,
    name: files[index] ? path.basename(files[index], path.extname(files[index])) : screenId,
  }));
}

function formatScreenRef(screen: ScreenRef): string {
  const label = screen.name || screen.title || screen.screenId;
  return screen.type ? `${label} (${screen.type})` : label;
}

function parseObjectList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  const parsed = safeParse<any>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function fileExists(repo: string, relPath: string): boolean {
  return Boolean(repo && fs.existsSync(path.join(repo, relPath)));
}

function dirExists(repo: string, relPath: string): boolean {
  return Boolean(repo && fs.existsSync(path.join(repo, relPath)) && fs.statSync(path.join(repo, relPath)).isDirectory());
}

function listFiles(dir: string, extension: string): string[] {
  try {
    if (!dir || !fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(extension));
  } catch {
    return [];
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return safeParse<T>(fs.readFileSync(filePath, "utf-8"), fallback);
  } catch {
    return fallback;
  }
}

function phaseStatus(items: ContractItem[]): ContractStatus {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "pending")) return "pending";
  if (items.some((item) => item.status === "pass")) return "pass";
  if (items.some((item) => item.status === "deferred")) return "deferred";
  return "pending";
}

function visibleStoryStatus(status: string): string {
  if (status === "skipped") return "failed";
  if (status === "na" || status === "n/a") return "pending";
  return status || "pending";
}

function isTerminalStepStatus(status: string | undefined): boolean {
  return ["done", "failed", "skipped"].includes(status || "");
}

function makeItem(
  id: string,
  label: string,
  status: ContractStatus,
  owner: string,
  updatedAt: string,
  extra: Partial<ContractItem> = {},
): ContractItem {
  return { id, label, status, owner, updatedAt, ...extra };
}

function requiredStatus(done: boolean, present: boolean): ContractStatus {
  if (!done) return "pending";
  if (present) return "pass";
  return done ? "fail" : "pending";
}

function detectStackPack(context: Record<string, any>, run: DbRun, repo: string): RunContract["stackPack"] {
  const task = `${run.task || ""} ${context.prd || ""}`.toLowerCase();
  const tech = String(context.tech_stack || "").toLowerCase();
  const evidence: string[] = [];
  let id: StackPackId | "unknown" = "unknown";
  let confidence: "high" | "medium" | "low" = "low";

  if (repo && (fileExists(repo, "next.config.js") || fileExists(repo, "next.config.mjs") || fileExists(repo, "next.config.ts") || dirExists(repo, "app") || dirExists(repo, "pages"))) {
    id = "nextjs-web-app";
    confidence = "high";
    evidence.push("Next.js repository evidence");
  } else if (/\b(android|kotlin|gradle)\b/.test(`${tech} ${task}`) || fileExists(repo, "settings.gradle") || fileExists(repo, "settings.gradle.kts")) {
    id = "android-app";
    confidence = fileExists(repo, "settings.gradle") || fileExists(repo, "settings.gradle.kts") ? "high" : "medium";
    evidence.push("Android project signals");
  } else if (/\b(ios|iphone|swift|xcode)\b/.test(`${tech} ${task}`) || fs.existsSync(repo) && fs.readdirSync(repo).some((name) => name.endsWith(".xcodeproj") || name.endsWith(".xcworkspace"))) {
    id = "ios-app";
    confidence = "medium";
    evidence.push("iOS project signals");
  } else if (hasBrowserGameIntent(`${tech} ${task}`)) {
    id = "browser-game-canvas";
    confidence = "medium";
    evidence.push("Browser game task or PRD hints");
  } else if (tech.includes("next")) {
    id = "nextjs-web-app";
    confidence = "medium";
    evidence.push("tech_stack includes Next.js");
  } else if (tech.includes("vite") || tech.includes("react") || fileExists(repo, "vite.config.ts") || fileExists(repo, "vite.config.js")) {
    id = "vite-react-web-app";
    confidence = fileExists(repo, "vite.config.ts") || fileExists(repo, "vite.config.js") ? "high" : "medium";
    evidence.push("Vite/React stack evidence");
  } else if (fileExists(repo, "index.html")) {
    id = "static-html-site";
    confidence = "medium";
    evidence.push("Static index.html evidence");
  } else if (fileExists(repo, "pyproject.toml") || fileExists(repo, "requirements.txt")) {
    id = /\b(fastapi|flask|django|web|api)\b/.test(task) ? "python-web" : "python-cli";
    confidence = "medium";
    evidence.push("Python project evidence");
  }

  const pack = id === "unknown" ? null : STACK_PACKS[id];
  return {
    id,
    label: pack?.label || "Unknown stack",
    confidence,
    evidence: evidence.length > 0 ? evidence : ["No resolved stack evidence yet"],
  };
}

function resolveScreenMap(context: Record<string, any>, repo: string): any[] {
  const fromContext = parseObjectList(context.screen_map);
  if (fromContext.length > 0) return fromContext;
  const candidates = [
    repo ? path.join(repo, "stitch", "SCREEN_MAP.json") : "",
    repo ? path.join(repo, "SCREEN_MAP.json") : "",
    repo ? path.join(repo, "stitch", "DESIGN_MANIFEST.json") : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const parsed = readJsonFile<any>(candidate, null);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.screens)) return parsed.screens;
  }
  return [];
}

function normalizeScreenId(screen: any): string {
  return String(screen?.screenId || screen?.id || screen?.name || screen?.title || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function summarizeBlocker(step: DbStep | undefined, story: DbStory | undefined): string[] {
  const blockers: string[] = [];
  if (step && step.status === "failed") {
    blockers.push(`${step.step_id}: ${String(step.output || "failed").replace(/\s+/g, " ").slice(0, 180)}`);
  }
  if (story && story.status === "failed") {
    blockers.push(`${story.story_id}: ${String(story.output || "failed").replace(/\s+/g, " ").slice(0, 180)}`);
  }
  return blockers;
}

export function buildRunContract(input: BuildRunContractInput): RunContract {
  const updatedAt = input.now || now();
  const context = input.context || parseContext(input.run.context);
  const repo = String(context.repo || "");
  const branch = String(context.branch || "");
  const techStack = String(context.tech_stack || "");
  const uiLanguage = String(context.ui_language || "");
  const screenMap = resolveScreenMap(context, repo);
  const screenIds = new Set(screenMap.map(normalizeScreenId).filter(Boolean));
  const stitchDir = repo ? path.join(repo, "stitch") : "";
  const htmlFiles = listFiles(stitchDir, ".html");
  const pngFiles = listFiles(stitchDir, ".png");
  const stepById = new Map(input.steps.map((step) => [step.step_id, step]));
  const done = (stepId: string) => stepById.get(stepId)?.status === "done";
  const reached = (stepId: string) => ["running", "done", "failed", "skipped"].includes(stepById.get(stepId)?.status || "");
  const stepCompleteOrPast = (stepId: string) => isTerminalStepStatus(stepById.get(stepId)?.status);
  const phaseStatusForSteps = (items: ContractItem[], stepIds: string[]): ContractStatus => {
    const status = phaseStatus(items);
    if (status === "fail") return "fail";
    if (stepIds.some((stepId) => {
      const stepStatus = stepById.get(stepId)?.status;
      return stepStatus && !isTerminalStepStatus(stepStatus);
    })) {
      return "pending";
    }
    return status;
  };
  const failedStep = input.steps.find((step) => step.status === "failed");
  const failedStory = input.stories.find((story) => story.status === "failed");
  const stackPack = detectStackPack(context, input.run, repo);
  const buildDone = done("setup-build");

  const storyOwnership: InternalStoryOwnership[] = input.stories.map((story) => {
    const screenRefs = parseOwnedScreenRefs(story);
    const ownsScreens = screenRefs.map(formatScreenRef);
    const ownsScreenIds = screenRefs.map(normalizeScreenId).filter(Boolean);
    const resolvedScopeFiles = parseStringList(story.resolved_scope_files);
    const physicalScopeFiles = parseStringList(story.scope_files);
    const logicalScopeTargets = parseStringList(story.scope_targets);
      return {
        storyId: story.story_id,
        title: story.title,
        status: visibleStoryStatus(story.status),
        ownsScreens,
        ownsScreenIds,
        scopeFiles: resolvedScopeFiles.length
          ? resolvedScopeFiles
          : physicalScopeFiles.length
          ? physicalScopeFiles
          : logicalScopeTargets,
      sharedFiles: parseStringList(story.shared_files),
      dependsOn: parseStringList(story.depends_on),
      deferred: ["pending", "waiting"].includes(story.status),
      blocker: story.status === "failed" ? String(story.output || "failed").slice(0, 220) : undefined,
    };
  });

  const ownedScreens = new Set(storyOwnership.flatMap((story) => story.ownsScreenIds).filter(Boolean));
  const unownedScreens = [...screenIds].filter((screenId) => !ownedScreens.has(screenId));
  const storiesDone = stepCompleteOrPast("stories");
  const designDone = stepCompleteOrPast("design");
  const setupDone = stepCompleteOrPast("setup-repo");
  const designRequired = String(context.design_required ?? "true").toLowerCase() !== "false";
  const productSurfaceCount = new Set(String(context.prd || "").match(/\bSURF_[A-Z0-9_]+\b/g) || []).size;

  const phases: ContractPhase[] = [];
  const planItems: ContractItem[] = [
    makeItem("plan.repo", "Repository path resolved", requiredStatus(done("plan"), Boolean(repo)), "planner", updatedAt, { stepId: "plan", evidence: repo || "missing repo" }),
    makeItem("plan.branch", "Feature branch resolved", requiredStatus(done("plan"), Boolean(branch)), "planner", updatedAt, { stepId: "plan", evidence: branch || "missing branch" }),
    makeItem("plan.stack", "Technology stack declared", requiredStatus(done("plan"), Boolean(techStack)), "planner", updatedAt, { stepId: "plan", evidence: techStack || "missing tech_stack" }),
    makeItem("plan.prd", "PRD captured in run context", requiredStatus(done("plan"), String(context.prd || "").length >= 500), "planner", updatedAt, { stepId: "plan", evidence: String(context.prd || "").length ? `${String(context.prd || "").length} chars` : "missing prd" }),
    makeItem("plan.surfaces", "Product Surfaces declared when design is required", requiredStatus(done("plan"), !designRequired || productSurfaceCount > 0), "planner", updatedAt, { stepId: "plan", evidence: designRequired ? `${productSurfaceCount} surface id(s)` : "design bypass" }),
    makeItem("plan.language", "UI language declared", requiredStatus(done("plan"), Boolean(uiLanguage)), "planner", updatedAt, { stepId: "plan", evidence: uiLanguage || "missing ui_language" }),
  ];
  phases.push({ id: "plan", label: "Plan", status: phaseStatusForSteps(planItems, ["plan"]), items: planItems });

  const designItems: ContractItem[] = [
    makeItem("design.stitch_dir", "Stitch artifact directory exists", requiredStatus(designDone, !designRequired || Boolean(stitchDir && fs.existsSync(stitchDir))), "designer", updatedAt, { stepId: "design", evidence: designRequired ? (stitchDir || "missing repo") : "design bypass" }),
    makeItem("design.screen_map", "Screen map is machine readable", requiredStatus(designDone, !designRequired || screenMap.length > 0), "designer", updatedAt, { stepId: "design", evidence: `${screenMap.length} screen(s)` }),
    makeItem("design.html", "HTML design exports downloaded", requiredStatus(designDone, !designRequired || htmlFiles.length >= Math.max(1, screenMap.length)), "designer", updatedAt, { stepId: "design", evidence: `${htmlFiles.length} html file(s)` }),
    makeItem("design.png", "PNG screenshots downloaded", requiredStatus(designDone, !designRequired || pngFiles.length >= Math.max(1, screenMap.length)), "designer", updatedAt, { stepId: "design", evidence: `${pngFiles.length} png file(s)` }),
    makeItem("design.dom", "DOM extraction manifest exists", requiredStatus(designDone, !designRequired || fileExists(repo, "stitch/DESIGN_DOM.json")), "designer", updatedAt, { stepId: "design", evidence: "stitch/DESIGN_DOM.json" }),
    makeItem("design.ui_contract", "UI contract exists", requiredStatus(designDone, !designRequired || fileExists(repo, "stitch/UI_CONTRACT.json")), "designer", updatedAt, { stepId: "design", evidence: "stitch/UI_CONTRACT.json" }),
    makeItem("design.tokens", "Design tokens exist", requiredStatus(designDone, !designRequired || fileExists(repo, "stitch/design-tokens.json") || fileExists(repo, "stitch/design-tokens.css")), "designer", updatedAt, { stepId: "design", evidence: "design tokens" }),
    makeItem("design.md", "Design markdown exists", requiredStatus(designDone, !designRequired || fileExists(repo, "stitch/DESIGN.md") || fileExists(repo, "DESIGN.md")), "designer", updatedAt, { stepId: "design", evidence: "DESIGN.md" }),
  ];
  phases.push({ id: "design", label: "Design", status: phaseStatusForSteps(designItems, ["design"]), items: designItems });

  const storiesWithAc = input.stories.filter((story) => parseStringList(story.acceptance_criteria).length > 0);
  const storiesWithScope = input.stories.filter((story) =>
    parseStringList(story.scope_targets).length > 0
    || parseStringList(story.resolved_scope_files).length > 0
    || parseStringList(story.scope_files).length > 0
  );
  const storiesWithScreens = input.stories.filter((story) => parseOwnedScreenRefs(story).length > 0);
  const storyItems: ContractItem[] = [
    makeItem("stories.count", "Stories decomposed", requiredStatus(storiesDone, input.stories.length > 0), "planner", updatedAt, { stepId: "stories", evidence: `${input.stories.length} story(ies)` }),
    makeItem("stories.ac", "Every story has acceptance criteria", requiredStatus(storiesDone, input.stories.length > 0 && storiesWithAc.length === input.stories.length), "planner", updatedAt, { stepId: "stories", evidence: `${storiesWithAc.length}/${input.stories.length}` }),
    makeItem("stories.scope_targets", "Every story has logical ownership targets", requiredStatus(storiesDone, input.stories.length > 0 && storiesWithScope.length === input.stories.length), "planner", updatedAt, { stepId: "stories", evidence: `${storiesWithScope.length}/${input.stories.length}` }),
    makeItem("stories.screen_ownership", "Design screens are assigned or explicitly deferred", requiredStatus(storiesDone, screenIds.size === 0 || unownedScreens.length === 0), "planner", updatedAt, { stepId: "stories", evidence: unownedScreens.length ? `unowned: ${unownedScreens.join(", ")}` : `${storiesWithScreens.length} story screen map(s)` }),
  ];
  for (const story of storyOwnership) {
    storyItems.push(makeItem(
      `stories.owner.${story.storyId}`,
      `${story.storyId} owns ${story.ownsScreens.length || 0} screen(s)`,
      !storiesDone ? "pending" : story.deferred ? "deferred" : "pass",
      "story-planner",
      updatedAt,
      { storyId: story.storyId, evidence: story.ownsScreens.join(", ") || "non-visual or shared story" },
    ));
  }
  phases.push({ id: "stories", label: "Stories", status: phaseStatusForSteps(storyItems, ["stories"]), items: storyItems });

  const repoExists = Boolean(repo && fs.existsSync(repo));
  const packageJson = repo ? readJsonFile<any>(path.join(repo, "package.json"), null) : null;
  const pack = stackPack.id !== "unknown" ? STACK_PACKS[stackPack.id] : null;
  const entryExists = Boolean(pack?.fileContract.entrypoints.some((entry) => {
    if (entry.includes("*")) return true;
    return fileExists(repo, entry);
  }));
  const setupItems: ContractItem[] = [
    makeItem("setup.repo_exists", "Repository exists on disk", requiredStatus(setupDone, repoExists), "setup", updatedAt, { stepId: "setup-repo", evidence: repo || "missing repo" }),
    makeItem("setup.stack_pack", "Framework stack pack resolved", requiredStatus(buildDone, stackPack.id !== "unknown"), "setup", updatedAt, { stepId: "setup-build", evidence: `${stackPack.id} (${stackPack.confidence})` }),
    makeItem("setup.package", "Package manifest exists when required", requiredStatus(buildDone, stackPack.id === "static-html-site" || Boolean(packageJson) || stackPack.id === "android-app" || stackPack.id === "ios-app"), "setup", updatedAt, { stepId: "setup-build", evidence: packageJson ? "package.json" : "not required or missing" }),
    makeItem("setup.build_cmd", "Build command captured", requiredStatus(buildDone, Boolean(context.build_cmd) || Boolean(pack?.setup.build)), "setup", updatedAt, { stepId: "setup-build", evidence: String(context.build_cmd || pack?.setup.build || "") }),
    makeItem("setup.entrypoint", "Stack entrypoint exists", requiredStatus(buildDone, entryExists || stackPack.id === "unknown"), "setup", updatedAt, { stepId: "setup-build", evidence: pack?.fileContract.entrypoints.join(", ") || "unknown" }),
    makeItem("setup.dist", "Build artifact exists when browser build is complete", requiredStatus(buildDone, !["vite-react-web-app", "nextjs-web-app", "browser-game-canvas"].includes(stackPack.id) || fileExists(repo, "dist/index.html") || dirExists(repo, ".next")), "setup", updatedAt, { stepId: "setup-build", evidence: "dist/index.html or .next" }),
  ];
  phases.push({ id: "setup-build", label: "Setup And Build", status: phaseStatusForSteps(setupItems, ["setup-repo", "setup-build"]), items: setupItems });

  const verifiedStories = input.stories.filter((story) => story.status === "verified").length;
  const doneStories = input.stories.filter((story) => story.status === "done").length;
  const failedStories = input.stories.filter((story) => story.status === "failed").length;
  const runningStories = input.stories.filter((story) => story.status === "running").length;
  const implementStep = stepById.get("implement");
  const implementReached = reached("implement") || input.stories.some((story) => ["running", "done", "verified", "failed", "skipped"].includes(story.status));
  const currentStoryId = implementStep?.current_story_id || input.steps.find((step) => step.current_story_id)?.current_story_id || "";
  const implementationDone = implementStep?.status === "done";
  const currentStoryEvidence = runningStories > 0
    ? (currentStoryId || "missing current story")
    : implementationDone
    ? "implementation complete"
    : "loop idle between story gates";
  const implItems: ContractItem[] = [
    makeItem("impl.loop_started", "Implementation loop state is visible", !implementReached ? "pending" : input.stories.length === 0 ? "pending" : "pass", "developer", updatedAt, { stepId: "implement", evidence: `${verifiedStories} verified, ${doneStories} done, ${failedStories} failed` }),
    makeItem(
      "impl.current_story",
      "Current story is explicit while a story is running",
      !implementReached
        ? "pending"
        : implementStep?.status === "running" && runningStories > 0 && !currentStoryId
        ? "fail"
        : implementStep?.status === "running" && runningStories > 0
        ? "pass"
        : implementationDone
        ? "pass"
        : "pending",
      "developer",
      updatedAt,
      { stepId: "implement", evidence: currentStoryEvidence },
    ),
    makeItem("impl.no_failed_stories", "No story is failed without a blocker", !implementReached ? "pending" : failedStories > 0 ? "fail" : "pass", "supervisor", updatedAt, { stepId: "implement", evidence: `${failedStories} failed story(ies)` }),
  ];
  phases.push({ id: "implement", label: "Implementation", status: phaseStatusForSteps(implItems, ["implement"]), items: implItems });

  for (const stepId of ["verify", "security-gate", "qa-test", "final-test", "deploy"]) {
    const step = stepById.get(stepId);
    const status = step?.status === "done" ? "pass" : step?.status === "failed" ? "fail" : step?.status === "skipped" ? "fail" : "pending";
    phases.push({
      id: stepId,
      label: stepId.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
      status,
      items: [
        makeItem(`${stepId}.status`, `${stepId} step status`, status, stepId, updatedAt, {
          stepId,
          evidence: step?.status || "waiting",
          blocker: step?.status === "failed" || step?.status === "skipped" ? String(step.output || step.status).slice(0, 220) : undefined,
        }),
      ],
    });
  }

  const publicStoryOwnership: ContractStoryOwnership[] = storyOwnership.map(({ ownsScreenIds: _ownsScreenIds, ...story }) => story);
  const allItems = phases.flatMap((phase) => phase.items);
  const progress = allItems.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, pass: 0, fail: 0, pending: 0, deferred: 0, na: 0 } as RunContract["progress"],
  );

  return {
    schema: "setfarm.run-contract.v1",
    version: 1,
    runId: input.run.id,
    runNumber: input.run.run_number,
    workflowId: input.run.workflow_id,
    status: input.run.status,
    task: input.run.task,
    project: {
      repo,
      branch,
      displayName: String(context.project_display_name || context.project_name || path.basename(repo || "") || "Setfarm Project"),
      techStack,
      uiLanguage: uiLanguage || "English",
    },
    stackPack,
    progress,
    phases,
    stories: publicStoryOwnership,
    artifacts: {
      stitchDir: stitchDir || undefined,
      designScreenCount: screenMap.length,
      htmlCount: htmlFiles.length,
      pngCount: pngFiles.length,
      domManifest: fileExists(repo, "stitch/DESIGN_DOM.json"),
      uiContract: fileExists(repo, "stitch/UI_CONTRACT.json"),
    },
    blockers: summarizeBlocker(failedStep, failedStory),
    updatedAt,
    reason: input.reason || "refresh",
  };
}

export async function refreshRunContract(runId: string, reason = "refresh", contextOverride?: Record<string, any>): Promise<RunContract | null> {
  const run = await pgGet<DbRun>("SELECT id, run_number, workflow_id, task, status, context, meta, created_at, updated_at FROM runs WHERE id = $1", [runId]);
  if (!run) return null;
  const steps = await pgQuery<DbStep>(
    "SELECT id, run_id, step_id, agent_id, status, output, retry_count, max_retries, type, current_story_id FROM steps WHERE run_id = $1 ORDER BY step_index ASC",
    [runId],
  );
  const stories = await pgQuery<DbStory>(
    `SELECT id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries,
            depends_on, scope_files, scope_targets, resolved_scope_files, shared_files, shared_edit_requests, story_screens, implementation_contract, pr_url, story_branch, merge_status
       FROM stories WHERE run_id = $1 ORDER BY story_index ASC`,
    [runId],
  );
  const context = contextOverride || parseContext(run.context);
  const contract = buildRunContract({ run, steps, stories, context, reason });
  await persistRunContract(runId, contract);
  writeRepoContractFiles(contract);
  return contract;
}

export async function refreshRunContractSafe(runId: string, reason = "refresh", contextOverride?: Record<string, any>): Promise<void> {
  try {
    await refreshRunContract(runId, reason, contextOverride);
  } catch (error) {
    logger.warn(`[contract-ledger] refresh failed: ${String(error).slice(0, 400)}`, { runId });
  }
}

async function persistRunContract(runId: string, contract: RunContract): Promise<void> {
  const serialized = JSON.stringify(contract);
  await pgBegin(async (sql) => {
    const rows = await sql.unsafe("SELECT context FROM runs WHERE id = $1 FOR UPDATE", [runId]);
    const existing = parseContext(rows[0]?.context || "{}");
    existing[CONTRACT_CONTEXT_KEY] = serialized;
    existing.run_contract_version = String(contract.version);
    existing.run_contract_updated_at = contract.updatedAt;
    await sql.unsafe("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(existing), now(), runId]);
  });
}

function writeRepoContractFiles(contract: RunContract): void {
  const repo = contract.project.repo;
  if (!repo || !fs.existsSync(repo)) return;
  try {
    const dir = path.join(repo, ".setfarm");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "RUN_CONTRACT.json"), JSON.stringify(contract, null, 2));
    fs.writeFileSync(path.join(dir, "STORY_OWNERSHIP.json"), JSON.stringify({
      schema: "setfarm.story-ownership.v1",
      runId: contract.runId,
      updatedAt: contract.updatedAt,
      stories: contract.stories,
    }, null, 2));
  } catch (error) {
    logger.warn(`[contract-ledger] repo contract write failed: ${String(error).slice(0, 240)}`, { runId: contract.runId });
  }
}
