import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgQuery, pgRun, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { computePredictedScreenFiles } from "./steps/03-stories/context.js";
import { resolveStackContract } from "./stack-contract/reconcile.js";
import { getStackPack } from "./stack-contract/packs.js";
import type {
  ScopeTargetRole,
  StackPack,
  StackPackId,
  TargetResolutionRule,
} from "./stack-contract/types.js";

const SETUP_SCHEMA = "setfarm.setup-certificate.v1";
const FILE_TREE_SCHEMA = "setfarm.file-tree-manifest.v1";
const IMPLEMENT_CONTEXT_SCHEMA = "setfarm.implement-context.v1";

export interface StoryScopeTarget {
  role: ScopeTargetRole;
  surface_id?: string;
  screen_id?: string;
  domain_slug?: string;
  target_slug?: string;
  action_ids?: string[];
  entity_names?: string[];
  resolved_path?: string | null;
}

export interface StoryDependencyRequest {
  name: string;
  ecosystem?: string;
  reason?: string;
  requested_by_action_ids?: string[];
}

export interface StorySharedEditRequest {
  role: ScopeTargetRole;
  action?: string;
  intent?: string;
  edit_scope?: string;
  requested_by?: string;
}

export interface ResolvedTarget {
  storyId: string;
  role: ScopeTargetRole;
  surfaceId?: string;
  screenId?: string;
  domainSlug: string;
  targetSlug: string;
  path: string;
  ruleId: string;
  sharedEdit?: boolean;
  editScope?: string;
  source: "scope_target" | "shared_edit_request";
}

export interface DependencyEvidence {
  requested: StoryDependencyRequest[];
  approved: StoryDependencyRequest[];
  installed: StoryDependencyRequest[];
  rejected: Array<StoryDependencyRequest & { reason: string }>;
}

export interface FileTreeManifest {
  schema: typeof FILE_TREE_SCHEMA;
  runId: string;
  stackPackId: StackPackId | "unknown";
  resolvedTargets: ResolvedTarget[];
  dependencyPlan: DependencyEvidence;
  mockInjectionPoints: Array<Record<string, unknown>>;
  routeRegistrationPlan: ResolvedTarget[];
}

export interface SetupCertificate {
  schema: typeof SETUP_SCHEMA;
  runId: string;
  projectName: string;
  projectSlug: string;
  platform: string;
  techStack: string;
  stackPackId: StackPackId | "unknown";
  commands: Record<string, string>;
  entrypoints: string[];
  setupOwnedFiles: string[];
  forbiddenDuringImplement: string[];
  sharedFiles: string[];
  scaffoldSnapshot: string[];
  generatedDesignFiles: string[];
  designAuthority: {
    required: boolean;
    source: "stitch" | "none";
    screenMap: string;
    rules: string[];
    conversionPolicy: string;
    conversionNote: string;
  };
  fileTreeManifestPath: string;
  targetResolutionRules: Record<string, TargetResolutionRule>;
  dependencyEvidence: DependencyEvidence;
  buildEvidence: Record<string, string>;
  createdAt: string;
}

interface StoryRow {
  id: string;
  story_id: string;
  story_index: number;
  title: string;
  depends_on: string | null;
  scope_targets: string | null;
  requested_dependencies: string | null;
  shared_edit_requests: string | null;
  file_skeletons: string | null;
  implementation_contract: string | null;
}

function safeJsonArray<T = any>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonObject(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function slugify(value: string | undefined, fallback: string): string {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || fallback;
}

function pascalCase(value: string): string {
  const words = slugify(value, "component").split("-").filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("") || "Component";
}

function normalizeActionId(value: string): string {
  return String(value || "ACT_ACTION").toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => vars[key] ?? "");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function relativeSetupPath(repo: string, filePath: string): string {
  return normalizePath(path.relative(repo, filePath));
}

export function setupDir(repo: string): string {
  return path.join(repo, ".setfarm", "setup");
}

export function setupCertificatePath(repo: string): string {
  return path.join(setupDir(repo), "SETUP_CERTIFICATE.json");
}

export function fileTreeManifestPath(repo: string): string {
  return path.join(setupDir(repo), "FILE_TREE_MANIFEST.json");
}

export function implementContextPath(repo: string, storyId: string): string {
  return path.join(repo, ".setfarm", "implement-context", `${storyId}.json`);
}

function selectStackPack(repo: string, context: Record<string, string>): StackPack {
  const contract = resolveStackContract({
    repoPath: repo,
    taskText: context["prd"] || context["task"] || "",
    projectSlug: context["project_slug"] || context["PROJECT_SLUG"] || undefined,
  });
  if (contract.packId) return getStackPack(contract.packId);

  const techStack = String(context["tech_stack"] || context["TECH_STACK"] || "").toLowerCase();
  if (techStack.includes("next")) return getStackPack("nextjs-web-app");
  if (techStack.includes("static")) return getStackPack("static-html-site");
  if (techStack.includes("browser-game") || String(context["platform"] || "").toLowerCase() === "game") return getStackPack("browser-game-canvas");
  if (techStack.includes("node-express")) return getStackPack("node-express-api");
  if (techStack.includes("node-cli")) return getStackPack("node-cli");
  if (techStack.includes("python-web")) return getStackPack("python-web");
  if (techStack.includes("python-cli")) return getStackPack("python-cli");
  if (techStack.includes("react-native") || techStack.includes("expo")) return getStackPack("react-native-expo");
  if (techStack.includes("android")) return getStackPack("android-app");
  if (techStack.includes("ios")) return getStackPack("ios-app");
  if (techStack.includes("electron")) return getStackPack("desktop-electron");
  return getStackPack("vite-react-web-app");
}

function ruleFor(pack: StackPack, role: ScopeTargetRole): TargetResolutionRule {
  const rule = pack.targetResolutionRules?.[role];
  if (!rule) {
    throw Object.assign(new Error(`SCOPE_TARGET_UNRESOLVED: stack pack ${pack.id} has no targetResolutionRule for role ${role}`), {
      code: "SCOPE_TARGET_UNRESOLVED",
      missingRole: role,
    });
  }
  return rule;
}

function screenComponentById(repo: string): Map<string, string> {
  const predicted = computePredictedScreenFiles(repo);
  return new Map(predicted.map((screen) => [screen.screenId, path.basename(screen.filePath).replace(/\.(tsx|jsx|ts|js|html)$/i, "")]));
}

function resolveTarget(
  repo: string,
  pack: StackPack,
  storyId: string,
  target: StoryScopeTarget,
  source: ResolvedTarget["source"],
  editScope?: string,
): ResolvedTarget {
  const role = target.role;
  const rule = ruleFor(pack, role);
  const screenComponents = screenComponentById(repo);
  const domainSlug = slugify(target.domain_slug || target.surface_id || target.screen_id, "app");
  const targetSlug = slugify(target.target_slug || target.screen_id || role, role);
  const componentName = target.screen_id && screenComponents.get(target.screen_id)
    ? screenComponents.get(target.screen_id)!
    : pascalCase(targetSlug);
  const actionId = normalizeActionId(target.action_ids?.[0] || target.target_slug || role);
  const entitySlug = slugify(target.entity_names?.[0] || domainSlug, domainSlug);
  const resolvedPath = normalizePath(interpolate(rule.template, {
    domain_slug: domainSlug,
    target_slug: targetSlug,
    ComponentName: componentName,
    screen_id: slugify(target.screen_id, targetSlug),
    action_id: actionId.toLowerCase(),
    ActionId: actionId,
    entity_slug: entitySlug,
  }));

  return {
    storyId,
    role,
    surfaceId: target.surface_id,
    screenId: target.screen_id,
    domainSlug,
    targetSlug,
    path: resolvedPath,
    ruleId: rule.ruleId,
    sharedEdit: source === "shared_edit_request",
    editScope,
    source,
  };
}

function resolveSharedEdit(repo: string, pack: StackPack, story: StoryRow, request: StorySharedEditRequest): ResolvedTarget {
  const target: StoryScopeTarget = {
    role: request.role,
    domain_slug: slugify(story.title, "app"),
    target_slug: slugify(request.role, request.role),
    action_ids: [],
    entity_names: [],
    resolved_path: null,
  };
  return resolveTarget(repo, pack, story.story_id, target, "shared_edit_request", request.edit_scope || request.action || request.role);
}

function dependencyEvidence(pack: StackPack, stories: StoryRow[]): DependencyEvidence {
  const requested = stories.flatMap((story) => safeJsonArray<StoryDependencyRequest>(story.requested_dependencies));
  const allowed = new Set(pack.dependencyPolicy?.allowedDependencies || []);
  const ecosystem = pack.dependencyPolicy?.ecosystem || "none";
  const approved: StoryDependencyRequest[] = [];
  const rejected: Array<StoryDependencyRequest & { reason: string }> = [];

  for (const dep of requested) {
    const name = String(dep.name || "").trim();
    if (!name) continue;
    if (ecosystem === "none") {
      rejected.push({ ...dep, reason: "stack pack does not allow runtime dependencies" });
    } else if (dep.ecosystem && dep.ecosystem !== ecosystem) {
      rejected.push({ ...dep, reason: `dependency ecosystem ${dep.ecosystem} does not match stack ecosystem ${ecosystem}` });
    } else if (!allowed.has(name)) {
      rejected.push({ ...dep, reason: "dependency is not in stack pack allowedDependencies" });
    } else {
      approved.push({ ...dep, name, ecosystem });
    }
  }

  return { requested, approved, installed: [], rejected };
}

function packageHasDependency(repo: string, name: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
    return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
  } catch {
    return false;
  }
}

function installApprovedDependencies(repo: string, evidence: DependencyEvidence, pack: StackPack): DependencyEvidence {
  if (pack.dependencyPolicy?.ecosystem !== "npm") return evidence;
  const missing = evidence.approved.filter((dep) => !packageHasDependency(repo, dep.name));
  if (missing.length === 0) return evidence;
  try {
    execFileSync("npm", ["install", ...missing.map((dep) => dep.name)], {
      cwd: repo,
      timeout: 180000,
      stdio: "pipe",
    });
    return { ...evidence, installed: missing };
  } catch (e) {
    const rejected = missing.map((dep) => ({ ...dep, reason: `npm install failed: ${String((e as Error).message || e).slice(0, 200)}` }));
    return { ...evidence, rejected: [...evidence.rejected, ...rejected] };
  }
}

function assertDependencyPlanAccepted(evidence: DependencyEvidence): void {
  if (evidence.rejected.length === 0) return;
  const reason = evidence.rejected
    .slice(0, 8)
    .map((dep) => `${dep.name || "(unnamed)"}: ${dep.reason}`)
    .join("; ");
  throw Object.assign(new Error(`DEPENDENCY_REQUEST_REJECTED: ${reason}`), {
    code: "DEPENDENCY_REQUEST_REJECTED",
    rejectedDependencies: evidence.rejected,
  });
}

function scaffoldSnapshot(repo: string): string[] {
  const files: string[] = [];
  const roots = ["package.json", "index.html", "src", "app", "pages", "public", "main.py", "requirements.txt", "pyproject.toml"];
  for (const rel of roots) {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) {
      for (const entry of fs.readdirSync(abs).slice(0, 200)) files.push(normalizePath(path.join(rel, entry)));
    } else {
      files.push(rel);
    }
  }
  return files.sort();
}

function generatedDesignFiles(repo: string): string[] {
  const stitch = path.join(repo, "stitch");
  if (!fs.existsSync(stitch)) return [];
  return fs.readdirSync(stitch)
    .filter((name) => /\.(html|json|md|css|png)$/i.test(name))
    .map((name) => normalizePath(path.join("stitch", name)))
    .sort();
}

function targetSkeleton(target: ResolvedTarget): string {
  if (target.source === "shared_edit_request") return `Shared edit grant: ${target.editScope || target.role}.`;
  if (target.role === "surface_component") return `Resolved surface component for ${target.screenId || target.surfaceId || target.targetSlug}.`;
  if (target.role === "action_handler") return `Resolved action handler for ${target.targetSlug}.`;
  return `Resolved ${target.role} target for ${target.domainSlug}.`;
}

async function writeResolvedStories(
  runId: string,
  rows: StoryRow[],
  resolved: ResolvedTarget[],
  pack: StackPack,
): Promise<void> {
  const byStory = new Map<string, ResolvedTarget[]>();
  for (const target of resolved) {
    const current = byStory.get(target.storyId) || [];
    current.push(target);
    byStory.set(target.storyId, current);
  }

  const sharedCandidates = new Set(pack.implementationBoundaries?.sharedFiles || []);
  for (const row of rows) {
    const targets = byStory.get(row.story_id) || [];
    const scopeFiles = [...new Set(targets.map((target) => target.path))];
    const sharedFiles = [...sharedCandidates].filter((file) => !scopeFiles.includes(file));
    const existingSkeletons = safeJsonObject(row.file_skeletons);
    const skeletons = {
      ...existingSkeletons,
      ...Object.fromEntries(targets.map((target) => [target.path, targetSkeleton(target)])),
    };
    const contract = safeJsonObject(row.implementation_contract);
    contract.resolved_scope_roles = targets.map((target) => ({
      role: target.role,
      path: target.path,
      source: target.source,
      editScope: target.editScope,
    }));
    await pgRun(
      "UPDATE stories SET scope_files = $1, resolved_scope_files = $1, shared_files = $2, file_skeletons = $3, implementation_contract = $4, updated_at = $5 WHERE run_id = $6 AND story_id = $7",
      [
        JSON.stringify(scopeFiles),
        JSON.stringify(sharedFiles),
        JSON.stringify(skeletons),
        JSON.stringify(contract),
        now(),
        runId,
        row.story_id,
      ],
    );
  }
}

function assertNoTargetConflicts(resolved: ResolvedTarget[], pack: StackPack): void {
  const writers = new Map<string, ResolvedTarget[]>();
  for (const target of resolved) {
    const current = writers.get(target.path) || [];
    current.push(target);
    writers.set(target.path, current);
  }
  const shared = new Set(pack.implementationBoundaries?.sharedFiles || []);
  const conflicts = [...writers.entries()].filter(([, targets]) => {
    const owners = new Set(targets.map((target) => target.storyId));
    if (owners.size <= 1) return false;
    return !targets.every((target) => target.sharedEdit || shared.has(target.path));
  });
  if (conflicts.length > 0) {
    const msg = conflicts
      .slice(0, 6)
      .map(([file, targets]) => `${file}: ${targets.map((target) => `${target.storyId}/${target.role}`).join(", ")}`)
      .join("; ");
    throw Object.assign(new Error(`SCOPE_TARGET_CONFLICT: ${msg}`), { code: "SCOPE_TARGET_CONFLICT" });
  }
}

export async function materializeSetupBuildContracts(
  runId: string,
  repo: string,
  context: Record<string, string>,
  buildCommand: string,
): Promise<{ manifest: FileTreeManifest; certificate: SetupCertificate }> {
  const pack = selectStackPack(repo, context);
  if (!pack.targetResolutionRules || Object.keys(pack.targetResolutionRules).length === 0) {
    throw Object.assign(new Error(`SCOPE_TARGET_UNRESOLVED: stack pack ${pack.id} has empty targetResolutionRules`), {
      code: "SCOPE_TARGET_UNRESOLVED",
    });
  }

  const rows = await pgQuery<StoryRow>(
    "SELECT id, story_id, story_index, title, depends_on, scope_targets, requested_dependencies, shared_edit_requests, file_skeletons, implementation_contract FROM stories WHERE run_id = $1 ORDER BY story_index",
    [runId],
  );
  const dependencyPlan = installApprovedDependencies(repo, dependencyEvidence(pack, rows), pack);
  assertDependencyPlanAccepted(dependencyPlan);
  const resolved: ResolvedTarget[] = [];
  for (const row of rows) {
    for (const target of safeJsonArray<StoryScopeTarget>(row.scope_targets)) {
      if (!target?.role) continue;
      resolved.push(resolveTarget(repo, pack, row.story_id, target, "scope_target"));
    }
    for (const request of safeJsonArray<StorySharedEditRequest>(row.shared_edit_requests)) {
      if (!request?.role) continue;
      const sharedTarget = resolveSharedEdit(repo, pack, row, request);
      const forbidden = new Set(pack.implementationBoundaries?.forbiddenDuringImplement || []);
      if (!forbidden.has(sharedTarget.path)) resolved.push(sharedTarget);
    }
  }
  assertNoTargetConflicts(resolved, pack);
  await writeResolvedStories(runId, rows, resolved, pack);

  const relManifest = ".setfarm/setup/FILE_TREE_MANIFEST.json";
  const manifest: FileTreeManifest = {
    schema: FILE_TREE_SCHEMA,
    runId,
    stackPackId: pack.id,
    resolvedTargets: resolved,
    dependencyPlan,
    mockInjectionPoints: pack.mockInjectionPolicy ? [pack.mockInjectionPolicy as unknown as Record<string, unknown>] : [],
    routeRegistrationPlan: resolved.filter((target) => target.role === "route_registration"),
  };

  const certificate: SetupCertificate = {
    schema: SETUP_SCHEMA,
    runId,
    projectName: context["project_display_name"] || context["project_name"] || context["PROJECT_NAME"] || "",
    projectSlug: context["project_slug"] || context["PROJECT_SLUG"] || "",
    platform: context["platform"] || context["PLATFORM"] || pack.platform || "",
    techStack: context["tech_stack"] || context["TECH_STACK"] || pack.techStackAliases?.[0] || "",
    stackPackId: pack.id,
    commands: Object.fromEntries(Object.entries(pack.setup).filter(([, value]) => Boolean(value))) as Record<string, string>,
    entrypoints: pack.fileContract.entrypoints,
    setupOwnedFiles: pack.implementationBoundaries?.setupOwnedFiles || [],
    forbiddenDuringImplement: pack.implementationBoundaries?.forbiddenDuringImplement || [],
    sharedFiles: pack.implementationBoundaries?.sharedFiles || [],
    scaffoldSnapshot: scaffoldSnapshot(repo),
    generatedDesignFiles: generatedDesignFiles(repo),
    designAuthority: {
      required: pack.designPolicy !== "none",
      source: pack.designPolicy === "none" ? "none" : "stitch",
      screenMap: "stitch/SCREEN_MAP.json",
      rules: ["DESIGN_MANIFEST.json and SCREEN_MAP.json are design authority when present."],
      conversionPolicy: pack.conversionPolicy || "none",
      conversionNote: pack.conversionPolicy === "reference_only"
        ? "Reference material only; implement native/runtime-equivalent UI without copying raw HTML/CSS."
        : "Stack pack may consume generated Stitch JSX artifacts.",
    },
    fileTreeManifestPath: relManifest,
    targetResolutionRules: pack.targetResolutionRules!,
    dependencyEvidence: dependencyPlan,
    buildEvidence: {
      buildCommand,
      artifactPath: fs.existsSync(path.join(repo, "dist", "index.html")) ? "dist/index.html" : "",
      stdoutPath: "",
      stderrPath: "",
    },
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(setupDir(repo), { recursive: true });
  fs.writeFileSync(fileTreeManifestPath(repo), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(setupCertificatePath(repo), JSON.stringify(certificate, null, 2) + "\n");
  logger.info(`[setup-handoff] wrote FILE_TREE_MANIFEST and SETUP_CERTIFICATE (${pack.id})`, { runId });
  return { manifest, certificate };
}

function readJsonFile<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function assembleImplementContext(params: {
  repo: string;
  runId: string;
  storyId: string;
  storyRow: {
    scope_targets?: string | null;
    shared_edit_requests?: string | null;
    implementation_contract?: string | null;
    depends_on?: string | null;
  };
}): Record<string, unknown> | null {
  const certificate = readJsonFile<SetupCertificate>(setupCertificatePath(params.repo));
  const manifest = readJsonFile<FileTreeManifest>(fileTreeManifestPath(params.repo));
  if (!certificate || !manifest) return null;

  const storyTargets = manifest.resolvedTargets.filter((target) => target.storyId === params.storyId);
  const forbidden = new Set(certificate.forbiddenDuringImplement || []);
  const resolvedScopeFiles = [...new Set(storyTargets.filter((target) => !target.sharedEdit).map((target) => target.path))];
  const sharedEditableFiles = storyTargets
    .filter((target) => target.sharedEdit)
    .map((target) => ({
      path: target.path,
      allowedForThisStory: !forbidden.has(target.path),
      editScope: target.editScope || "shared_edit",
      grantedBy: `${params.storyId}.shared_edit_requests`,
    }));

  const context = {
    schema: IMPLEMENT_CONTEXT_SCHEMA,
    runId: params.runId,
    storyId: params.storyId,
    setupCertificatePath: relativeSetupPath(params.repo, setupCertificatePath(params.repo)),
    fileTreeManifestPath: relativeSetupPath(params.repo, fileTreeManifestPath(params.repo)),
    resolvedScopeFiles,
    readOnlyFiles: certificate.sharedFiles.filter((file) => !resolvedScopeFiles.includes(file)),
    sharedEditableFiles,
    forbiddenFiles: certificate.forbiddenDuringImplement,
    dependencyContext: {
      availableDependencies: certificate.dependencyEvidence.approved.map((dep) => dep.name),
      forbiddenDependencyChanges: true,
    },
    ownedActions: safeJsonObject(params.storyRow.implementation_contract).owned_actions || [],
    ownedSurfaces: safeJsonObject(params.storyRow.implementation_contract).owned_surface_ids || [],
    mockDataContract: {
      injectionPoints: manifest.mockInjectionPoints,
      productionIsolation: manifest.mockInjectionPoints.map((point) => point.productionIsolation).filter(Boolean),
    },
    routeGuardPolicy: {},
    assemblyRules: {
      scopeResolution: "apply FILE_TREE_MANIFEST resolvedTargets for this story only",
      sharedEditConflict: "forbiddenDuringImplement beats story.shared_edit_requests",
      dependencyCheck: "all depends_on story IDs must be completed before this story starts",
      mockDataSource: "PLAN mock_data_contract merged with stack mockInjectionPolicy",
    },
    verificationCommands: certificate.commands,
  };

  const file = implementContextPath(params.repo, params.storyId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(context, null, 2) + "\n");
  return context;
}
