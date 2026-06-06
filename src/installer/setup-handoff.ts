import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgQuery, pgRun, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { computePredictedScreenFiles } from "./steps/03-stories/context.js";
import { resolveStackContract } from "./stack-contract/reconcile.js";
import { getStackPack } from "./stack-contract/packs.js";
import { validateStackPack } from "./stack-contract/validators.js";
import type {
  ScopeTargetRole,
  StackPack,
  StackPackId,
  TargetResolutionRule,
} from "./stack-contract/types.js";

const SETUP_SCHEMA = "setfarm.setup-certificate.v1";
const FILE_TREE_SCHEMA = "setfarm.file-tree-manifest.v1";
const SHARED_GRANTS_SCHEMA = "setfarm.shared-grants.v1";
const IMPLEMENT_CONTEXT_SCHEMA = "setfarm.implement-context.v2";

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
  resolvedPath: string;
  ruleId: string;
  sharedEdit?: boolean;
  editScope?: string;
  collisionStatus?: "unique" | "pending_shared_grant" | "shared";
  sharedGrantRequestId?: string;
  source: "scope_target" | "shared_edit_request";
}

export interface SharedGrant {
  grantId: string;
  runId: string;
  storyId: string;
  path: string;
  role: ScopeTargetRole;
  editScope: string;
  status: "granted" | "denied";
  reason: string;
  source: "shared_edit_request" | "stack_shared_file";
}

export interface SharedGrantsArtifact {
  schema: typeof SHARED_GRANTS_SCHEMA;
  version: number;
  runId: string;
  grants: SharedGrant[];
}

export interface DependencyEvidence {
  requested: StoryDependencyRequest[];
  approved: StoryDependencyRequest[];
  installed: StoryDependencyRequest[];
  rejected: Array<StoryDependencyRequest & { reason: string }>;
}

export interface DesignImportValidateSummary {
  status: "pass" | "fail" | "skipped" | "missing";
  reportPath: string;
  checkedAt?: string;
  fixMode?: boolean;
  screensValidated: string[];
  failedRules: unknown[];
  fixesApplied: unknown[];
  rootCauseCategory?: string;
  summary?: Record<string, unknown>;
}

export interface DesignVisualSmokeSummary {
  status: "pass" | "fail" | "skipped" | "missing";
  checkedAt?: string;
  screensChecked: string[];
  failedChecks: unknown[];
  headlessBinaryVersion?: string;
  viewports: string[];
  reason?: string;
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
  sharedGrantsPath: string;
  targetResolutionRules: Record<string, TargetResolutionRule>;
  routerParadigm?: string;
  slugRules?: Record<string, string>;
  slugRuleTests?: Array<Record<string, string>>;
  sharedEditValidationPolicy?: string;
  patchWindowMarkers?: Array<Record<string, string>>;
  utilityFilePolicy?: Record<string, unknown>;
  buildStrippingPolicy?: Record<string, unknown>;
  sandboxPrewarm?: Record<string, unknown>;
  prewarmEvidencePath?: string;
  mockInjectionContract?: Record<string, unknown>;
  designImportValidate?: DesignImportValidateSummary;
  designVisualSmoke?: DesignVisualSmokeSummary;
  dependencyEvidence: DependencyEvidence;
  dependencyResolutionPolicy?: Record<string, unknown>;
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

export function sharedGrantsPath(repo: string): string {
  return path.join(setupDir(repo), "SHARED_GRANTS.json");
}

export function designImportValidatePath(repo: string): string {
  return path.join(setupDir(repo), "DESIGN_IMPORT_VALIDATE.json");
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
    resolvedPath,
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

function generatedScreenSourceFiles(repo: string): string[] {
  const screensDir = path.join(repo, "src", "screens");
  if (!fs.existsSync(screensDir)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(tsx|jsx)$/i.test(name)) continue;
      out.push(relativeSetupPath(repo, abs));
    }
  };
  walk(screensDir);
  return out.sort();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readDesignImportValidateSummary(repo: string): DesignImportValidateSummary {
  const reportFile = designImportValidatePath(repo);
  const reportPath = relativeSetupPath(repo, reportFile);
  const raw = readJsonFile<Record<string, unknown>>(reportFile);
  if (!raw) {
    return {
      status: "missing",
      reportPath,
      screensValidated: [],
      failedRules: [],
      fixesApplied: [],
    };
  }

  const rawStatus = raw.status;
  const status: DesignImportValidateSummary["status"] =
    rawStatus === "pass" || rawStatus === "fail" || rawStatus === "skipped" ? rawStatus : "fail";

  return {
    status,
    reportPath: typeof raw.reportPath === "string" ? raw.reportPath : reportPath,
    checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : undefined,
    fixMode: typeof raw.fixMode === "boolean" ? raw.fixMode : undefined,
    screensValidated: stringArray(raw.screensValidated),
    failedRules: Array.isArray(raw.failedRules) ? raw.failedRules : [],
    fixesApplied: Array.isArray(raw.fixesApplied) ? raw.fixesApplied : [],
    rootCauseCategory: typeof raw.rootCauseCategory === "string" ? raw.rootCauseCategory : undefined,
    summary: raw.summary && typeof raw.summary === "object" && !Array.isArray(raw.summary)
      ? raw.summary as Record<string, unknown>
      : undefined,
  };
}

function defaultDesignVisualSmokeSummary(): DesignVisualSmokeSummary {
  return {
    status: "skipped",
    screensChecked: [],
    failedChecks: [],
    viewports: ["1280x800", "375x812"],
    reason: "not configured in this stack pack yet",
  };
}

function assertDesignImportReady(repo: string, certificate?: SetupCertificate): void {
  const screenFiles = generatedScreenSourceFiles(repo);
  const summary = certificate?.designImportValidate || readDesignImportValidateSummary(repo);
  if (screenFiles.length === 0 && summary.status === "missing") return;
  if (summary.status === "pass") return;

  const reportPath = summary.reportPath || relativeSetupPath(repo, designImportValidatePath(repo));
  throw Object.assign(new Error(
    `DESIGN_IMPORT_VALIDATE_BLOCKED: generated screen baseline is not validated (${summary.status}). ` +
    `Inspect ${reportPath}, scripts/stitch-to-jsx.mjs, scripts/generated-screen-validator.mjs, and src/screens/*.tsx. ` +
    "Run node scripts/generated-screen-validator.mjs <repo-path> --fix and npm run build before IMPLEMENT.",
  ), {
    code: "DESIGN_IMPORT_VALIDATE_BLOCKED",
    reportPath,
    failedRules: summary.failedRules,
  });
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

function grantIdFor(target: ResolvedTarget, index: number): string {
  return normalizeActionId(`GRANT_${target.storyId}_${target.role}_${index}`).toUpperCase();
}

export function annotateResolvedTargetsForSetup(
  resolved: ResolvedTarget[],
  pack: StackPack,
  runId: string,
): { targets: ResolvedTarget[]; grants: SharedGrant[] } {
  const writers = new Map<string, ResolvedTarget[]>();
  for (const target of resolved) {
    const current = writers.get(target.path) || [];
    current.push(target);
    writers.set(target.path, current);
  }
  const shared = new Set(pack.implementationBoundaries?.sharedFiles || []);
  const forbidden = new Set(pack.implementationBoundaries?.forbiddenDuringImplement || []);
  const targets: ResolvedTarget[] = resolved.map((target) => ({ ...target, collisionStatus: "unique" }));
  const byIdentity = new Map(targets.map((target) => [`${target.storyId}:${target.role}:${target.path}:${target.source}`, target]));
  const grants: SharedGrant[] = [];
  const conflicts = [...writers.entries()].filter(([file, pathTargets]) => {
    const pathOwners = new Set(pathTargets.map((target) => target.storyId));
    if (pathOwners.size <= 1) return false;

    if (shared.has(file)) {
      for (const original of pathTargets) {
        const current = byIdentity.get(`${original.storyId}:${original.role}:${original.path}:${original.source}`);
        if (!current) continue;
        current.collisionStatus = original.sharedEdit ? "pending_shared_grant" : "shared";
      }
      return false;
    }

    if (pathTargets.every((target) => target.sharedEdit)) return false;
    return true;
  });

  if (conflicts.length > 0) {
    const msg = conflicts
      .slice(0, 6)
      .map(([file, fileTargets]) => `${file}: ${fileTargets.map((target) => `${target.storyId}/${target.role}/${target.source}`).join(", ")}`)
      .join("; ");
    throw Object.assign(new Error(`FILE_TREE_PATH_COLLISION: ${msg}`), { code: "FILE_TREE_PATH_COLLISION" });
  }

  let grantIndex = 1;
  for (const target of targets) {
    if (!target.sharedEdit) continue;
    target.collisionStatus = target.collisionStatus === "pending_shared_grant" ? "pending_shared_grant" : "shared";
    const grantId = grantIdFor(target, grantIndex++);
    target.sharedGrantRequestId = grantId;
    const deniedReason = forbidden.has(target.path)
      ? "target path is forbiddenDuringImplement"
      : !shared.has(target.path)
        ? "target path is not declared as a stack shared file"
        : "";
    grants.push({
      grantId,
      runId,
      storyId: target.storyId,
      path: target.path,
      role: target.role,
      editScope: target.editScope || target.role,
      status: deniedReason ? "denied" : "granted",
      reason: deniedReason || "validated against story shared_edit_requests and stack sharedFiles",
      source: "shared_edit_request",
    });
  }

  const denied = grants.filter((grant) => grant.status === "denied");
  if (denied.length > 0) {
    const msg = denied
      .slice(0, 6)
      .map((grant) => `${grant.grantId}:${grant.path}:${grant.reason}`)
      .join("; ");
    throw Object.assign(new Error(`SHARED_TARGET_GRANT_DENIED: ${msg}`), { code: "SHARED_TARGET_GRANT_DENIED", deniedGrants: denied });
  }

  return { targets, grants };
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
  const packIssues = validateStackPack(pack);
  if (packIssues.length > 0) {
    const msg = packIssues.slice(0, 8).map((issue) => `${issue.code}:${issue.message}`).join("; ");
    throw Object.assign(new Error(`SETUP_CONTRACT_INVALID: ${msg}`), { code: "SETUP_CONTRACT_INVALID", issues: packIssues });
  }
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
  const { targets: resolvedTargets, grants } = annotateResolvedTargetsForSetup(resolved, pack, runId);
  await writeResolvedStories(runId, rows, resolvedTargets, pack);

  const relManifest = ".setfarm/setup/FILE_TREE_MANIFEST.json";
  const relSharedGrants = ".setfarm/setup/SHARED_GRANTS.json";
  const manifest: FileTreeManifest = {
    schema: FILE_TREE_SCHEMA,
    runId,
    stackPackId: pack.id,
    resolvedTargets,
    dependencyPlan,
    mockInjectionPoints: pack.mockInjectionPolicy ? [pack.mockInjectionPolicy as unknown as Record<string, unknown>] : [],
    routeRegistrationPlan: resolvedTargets.filter((target) => target.role === "route_registration"),
  };
  const sharedGrants: SharedGrantsArtifact = {
    schema: SHARED_GRANTS_SCHEMA,
    version: 1,
    runId,
    grants,
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
    sharedGrantsPath: relSharedGrants,
    targetResolutionRules: pack.targetResolutionRules!,
    routerParadigm: pack.routerParadigm,
    slugRules: pack.slugRules as unknown as Record<string, string>,
    slugRuleTests: pack.slugRuleTests as unknown as Array<Record<string, string>>,
    sharedEditValidationPolicy: pack.sharedEditValidationPolicy,
    patchWindowMarkers: pack.patchWindowMarkers as unknown as Array<Record<string, string>>,
    utilityFilePolicy: pack.utilityFilePolicy as unknown as Record<string, unknown>,
    buildStrippingPolicy: pack.buildStrippingPolicy as unknown as Record<string, unknown>,
    sandboxPrewarm: pack.sandboxPrewarm as unknown as Record<string, unknown>,
    prewarmEvidencePath: pack.sandboxPrewarm?.artifactPath,
    mockInjectionContract: pack.mockInjectionPolicy as unknown as Record<string, unknown>,
    designImportValidate: readDesignImportValidateSummary(repo),
    designVisualSmoke: defaultDesignVisualSmokeSummary(),
    dependencyEvidence: dependencyPlan,
    dependencyResolutionPolicy: pack.dependencyResolutionPolicy as unknown as Record<string, unknown>,
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
  fs.writeFileSync(sharedGrantsPath(repo), JSON.stringify(sharedGrants, null, 2) + "\n");
  fs.writeFileSync(setupCertificatePath(repo), JSON.stringify(certificate, null, 2) + "\n");
  logger.info(`[setup-handoff] wrote FILE_TREE_MANIFEST, SHARED_GRANTS, and SETUP_CERTIFICATE (${pack.id})`, { runId });
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

function safeJsonStringArray(raw: unknown): string[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function assembleImplementContext(params: {
  repo: string;
  runId: string;
  storyId: string;
  storyRow: {
    scope_files?: string | null;
    scope_targets?: string | null;
    shared_edit_requests?: string | null;
    implementation_contract?: string | null;
    depends_on?: string | null;
  };
}): Record<string, unknown> | null {
  const certificate = readJsonFile<SetupCertificate>(setupCertificatePath(params.repo));
  const manifest = readJsonFile<FileTreeManifest>(fileTreeManifestPath(params.repo));
  const sharedGrants = readJsonFile<SharedGrantsArtifact>(sharedGrantsPath(params.repo));
  if (!certificate || !manifest) return null;
  assertDesignImportReady(params.repo, certificate);

  const storyTargets = manifest.resolvedTargets.filter((target) => target.storyId === params.storyId);
  const declaredScopeFiles = safeJsonStringArray(params.storyRow.scope_files);
  const forbidden = new Set(certificate.forbiddenDuringImplement || []);
  const grantsById = new Map((sharedGrants?.grants || []).map((grant) => [grant.grantId, grant]));
  const manifestScopeFiles = storyTargets.filter((target) => !target.sharedEdit).map((target) => target.path);
  const resolvedScopeFiles = [...new Set(manifestScopeFiles.length > 0 ? manifestScopeFiles : declaredScopeFiles)];
  const sharedEditableFiles = storyTargets
    .filter((target) => {
      if (!target.sharedEdit) return false;
      const grant = target.sharedGrantRequestId ? grantsById.get(target.sharedGrantRequestId) : null;
      return grant?.status === "granted";
    })
    .map((target) => ({
      path: target.path,
      allowedForThisStory: !forbidden.has(target.path),
      editScope: target.editScope || "shared_edit",
      grantedBy: target.sharedGrantRequestId || `${params.storyId}.shared_edit_requests`,
    }));

  const context = {
    schema: IMPLEMENT_CONTEXT_SCHEMA,
    runId: params.runId,
    storyId: params.storyId,
    setupCertificatePath: relativeSetupPath(params.repo, setupCertificatePath(params.repo)),
    fileTreeManifestPath: relativeSetupPath(params.repo, fileTreeManifestPath(params.repo)),
    sharedGrantsPath: relativeSetupPath(params.repo, sharedGrantsPath(params.repo)),
    sharedGrantsVersion: sharedGrants?.version || 0,
    resolvedScopeFiles,
    readOnlyFiles: certificate.sharedFiles.filter((file) => !resolvedScopeFiles.includes(file)),
    sharedEditableFiles,
    forbiddenFiles: certificate.forbiddenDuringImplement,
    dependencyContext: {
      availableDependencies: certificate.dependencyEvidence.approved.map((dep) => dep.name),
      forbiddenDependencyChanges: true,
      resolutionPolicy: certificate.dependencyResolutionPolicy || "setup_build_only",
    },
    stackContext: {
      stackPackId: certificate.stackPackId,
      routerParadigm: certificate.routerParadigm,
      slugRules: certificate.slugRules,
      sharedEditValidationPolicy: certificate.sharedEditValidationPolicy,
      patchWindowMarkers: certificate.patchWindowMarkers || [],
      utilityFilePolicy: certificate.utilityFilePolicy,
      buildStrippingPolicy: certificate.buildStrippingPolicy,
      sandboxPrewarm: certificate.sandboxPrewarm,
    },
    ownedActions: safeJsonObject(params.storyRow.implementation_contract).owned_actions || [],
    ownedSurfaces: safeJsonObject(params.storyRow.implementation_contract).owned_surface_ids || [],
    mockDataContract: {
      injectionPoints: manifest.mockInjectionPoints,
      productionIsolation: manifest.mockInjectionPoints.map((point) => point.productionIsolation).filter(Boolean),
    },
    routeGuardPolicy: {},
    assemblyRules: {
      scopeResolution: "apply FILE_TREE_MANIFEST resolvedTargets for this story; dynamically created repair stories fall back to declared story scope_files",
      sharedEditConflict: "forbiddenDuringImplement beats story.shared_edit_requests; SHARED_GRANTS is the permission source",
      sharedGrantPolicy: "sharedEditableFiles are emitted only for grants with status=granted",
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
