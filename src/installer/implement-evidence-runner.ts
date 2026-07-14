import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import type { ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import type { SourceRevisionV1 } from "../execution/schemas/execution-attempt-v1.js";
import {
  createCanonicalEvidenceBundleV2,
  type CanonicalCommandTraceV1,
  type CanonicalEvidenceResultV1,
  type CanonicalInteractionTraceV1,
} from "../evidence/canonical-evidence-runner.js";
import {
  compileEvidencePlanV1,
  flattenEvidencePlanInteractions,
  type EvidencePlanV1,
} from "../evidence/evidence-plan-v1.js";
import { implementEvidenceArtifactPaths, readImplementEvidenceConfig } from "./implement-evidence.js";
import { writeImplementEvidenceArtifact } from "./implement-evidence-writer.js";
import type { CapturedRuntimeState, InteractionRequest, RuntimeDriver, RuntimeSession } from "./runtime-driver.js";
import { createStackRuntimeEvidenceDriver } from "./stack-runtime-evidence-driver.js";
import { WebPreviewRuntimeDriver } from "./web-runtime-driver.js";
import { classifyStackFailure } from "./stack-modules/registry.js";
import type { StackFailureAction, StackFailureOwner } from "./stack-modules/types.js";
import type { StackPackId } from "./stack-contract/types.js";

type RawInteractionRequest = Record<string, any>;

export interface ImplementEvidenceRunResult {
  attempted: boolean;
  evidencePath?: string;
  ok: boolean;
  reason: string;
  failureOwner?: StackFailureOwner;
  failureAction?: StackFailureAction;
  failureCategory?: string;
  evidencePlan?: EvidencePlanV1;
  canonicalEvidence?: CanonicalEvidenceResultV1;
}

export interface ImplementEvidenceObservation {
  checkId: string;
  label: string;
  status: "pending" | "running" | "pass" | "fail" | "retry" | "blocked" | "info";
  summary?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  filePaths?: string[];
  eventType?: string;
}

export type ImplementEvidenceObserver = (observation: ImplementEvidenceObservation) => void | Promise<void>;

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is RawInteractionRequest {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cssAttributeSelector(name: string, value: string): string {
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${name}="${escaped}"]`;
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const SUPPORTED_INTERACTION_ACTIONS = new Set(["click", "fill", "press", "select", "wait", "navigate", "snapshot", "invoke", "reset"]);
const SNAPSHOT_ALIAS_ACTIONS = new Set(["read", "inspect", "observe"]);

function isSnapshotAliasInteraction(action: string, target: string, value = ""): boolean {
  if (!SNAPSHOT_ALIAS_ACTIONS.has(action)) return false;
  const subject = `${target} ${value}`.trim().toLowerCase();
  return /\bwindow\.app\b|\bglobalthis\.app\b|\bapp\s+state\b|\bstate\s+bridge\b|\bdocument\b|\bdom\b|\bbody\b/.test(subject);
}

export function normalizeInteractionRequests(value: unknown): InteractionRequest[] {
  if (!Array.isArray(value)) return [];
  const interactions: InteractionRequest[] = [];
  for (const [index, raw] of value.entries()) {
    if (!isObject(raw)) continue;
    const actionId = typeof raw.actionId === "string" ? raw.actionId.trim() : "";
    if (actionId) {
      interactions.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : actionId,
        action: "click",
        target: cssAttributeSelector("data-action-id", actionId),
        waitCondition: typeof raw.waitCondition === "string" ? raw.waitCondition as InteractionRequest["waitCondition"] : "dom_idle",
        timeoutMs: numberOrUndefined(raw.timeoutMs) ?? 1000,
      });
      continue;
    }
    const action = typeof raw.action === "string" ? raw.action.trim() : "";
    const target = typeof raw.target === "string" ? raw.target.trim() : "";
    const rawValue = typeof raw.value === "string" ? raw.value : "";
    if (isSnapshotAliasInteraction(action, target, rawValue)) {
      interactions.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `flow-${index + 1}`,
        action: "snapshot",
        ...(target ? { target } : {}),
        ...(rawValue ? { value: rawValue } : {}),
        ...(isObject(raw.inputValues) ? { inputValues: raw.inputValues } : {}),
        ...(typeof raw.waitCondition === "string"
          ? { waitCondition: raw.waitCondition as InteractionRequest["waitCondition"] }
          : {}),
        ...(numberOrUndefined(raw.timeoutMs) !== undefined ? { timeoutMs: numberOrUndefined(raw.timeoutMs) } : {}),
      });
      continue;
    }
    if (SUPPORTED_INTERACTION_ACTIONS.has(action)) {
      interactions.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `flow-${index + 1}`,
        action: action as InteractionRequest["action"],
        ...(target ? { target } : {}),
        ...(rawValue ? { value: rawValue } : {}),
        ...(isObject(raw.inputValues) ? { inputValues: raw.inputValues } : {}),
        ...(typeof raw.waitCondition === "string"
          ? { waitCondition: raw.waitCondition as InteractionRequest["waitCondition"] }
          : {}),
        ...(numberOrUndefined(raw.timeoutMs) !== undefined ? { timeoutMs: numberOrUndefined(raw.timeoutMs) } : {}),
      });
      continue;
    }
  }
  return interactions;
}

function describeInteraction(interaction: InteractionRequest): string {
  return `${interaction.action} ${interaction.target || interaction.value || ""}`.trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractTargetActionId(target: string | undefined): string {
  if (!target) return "";
  const single = target.match(/data-action-id\s*=\s*'([^']+)'/);
  if (single?.[1]) return single[1];
  const double = target.match(/data-action-id\s*=\s*"([^"]+)"/);
  if (double?.[1]) return double[1];
  return "";
}

function actionIdsFromDomSnapshot(domSnapshotPath: string | undefined): string[] {
  if (!domSnapshotPath || !fs.existsSync(domSnapshotPath)) return [];
  try {
    const dom = JSON.parse(fs.readFileSync(domSnapshotPath, "utf-8"));
    const html = `${String(dom?.rootHtml || "")}\n${String(dom?.bodyText || "")}`;
    const actionIds: string[] = [];
    for (const match of html.matchAll(/data-action-id\s*=\s*(?:"([^"]+)"|'([^']+)')/g)) {
      actionIds.push(String(match[1] || match[2] || ""));
    }
    return uniqueStrings(actionIds).slice(0, 30);
  } catch {
    return [];
  }
}

function actionIdTokens(value: string): Set<string> {
  return new Set(String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !["action", "button", "click", "open", "show"].includes(token)));
}

function suggestedActionIds(missingActionId: string, availableActionIds: string[]): string[] {
  const wanted = actionIdTokens(missingActionId);
  if (wanted.size === 0) return [];
  return availableActionIds
    .map((candidate) => {
      const have = actionIdTokens(candidate);
      let score = 0;
      for (const token of wanted) {
        if (have.has(token)) score += 2;
        else if ([...have].some((item) => item.includes(token) || token.includes(item))) score += 1;
      }
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .map((item) => item.candidate)
    .slice(0, 5);
}

function stateBridgeScreen(stateBridge: Record<string, unknown> | null | undefined): string {
  const state = stateBridge && typeof stateBridge === "object" ? (stateBridge as any).state : null;
  const screen = state && typeof state === "object" ? state.screen : (stateBridge as any)?.screen;
  return typeof screen === "string" && screen.trim() ? screen.trim() : "";
}

function failedInteractionContext(interaction: InteractionRequest, capture: any): string {
  const parts: string[] = [];
  const screen = stateBridgeScreen(capture?.stateBridge);
  if (screen) parts.push(`currentScreen=${screen}`);
  const actionIds = actionIdsFromDomSnapshot(capture?.domSnapshotPath);
  const targetActionId = extractTargetActionId(interaction.target);
  if (targetActionId) {
    parts.push(`availableActionIds=${actionIds.length > 0 ? actionIds.join(",") : "(none)"}`);
  } else if (actionIds.length > 0) {
    parts.push(`availableActionIds=${actionIds.join(",")}`);
  }
  if (targetActionId && !actionIds.includes(targetActionId)) {
    parts.push(`missingTargetActionId=${targetActionId}`);
    const suggestions = suggestedActionIds(targetActionId, actionIds);
    if (suggestions.length > 0) parts.push(`suggestedActionIds=${suggestions.join(",")}`);
    parts.push("hint=target is not present in the current runtime surface; add an executable prerequisite navigation/open-surface interaction or expose a reachable control before requesting this target");
  }
  return parts.length > 0 ? parts.join(" | ") : "";
}

function hasPackageScript(workdir: string, scriptName: string): boolean {
  const pkg = readJson(`${workdir}/package.json`);
  return !!pkg?.scripts?.[scriptName];
}

function isStackPackId(value: unknown): value is StackPackId {
  return [
    "nextjs-web-app",
    "vite-react-web-app",
    "static-html-site",
    "browser-game-canvas",
    "node-express-api",
    "node-cli",
    "python-cli",
    "python-web",
    "react-native-expo",
    "android-app",
    "ios-app",
    "desktop-electron",
  ].includes(String(value));
}

function writeJsonIfMissing(filePath: string, value: Record<string, unknown>): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return true;
}

function writeV3EvidenceArtifacts(input: {
  workdir: string;
  storyId: string;
  paths: Record<string, string>;
  plan: EvidencePlanV1;
}): string[] {
  const now = new Date().toISOString();
  const planPath = path.join(input.workdir, ".setfarm", "evidence-v2", input.storyId, "EVIDENCE_PLAN.json");
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `${canonicalJsonStringify(input.plan)}\n`);
  const actionByInteraction = new Map(input.plan.flows.flatMap((flow) =>
    flow.interactions.map((interaction) => [
      interaction.id,
      interaction.action === "invoke" && interaction.target ? interaction.target : flow.actionRef,
    ] as const)));
  fs.mkdirSync(path.dirname(input.paths.intent), { recursive: true });
  const adapter = input.plan.runtime?.adapter;
  const browserRuntime = !adapter || adapter === "browser-service";
  fs.writeFileSync(input.paths.intent, `${JSON.stringify({
    schema: "setfarm.implement-intent.v1",
    storyId: input.storyId,
    storyType: adapter === "cli-process" ? "cli" : adapter === "http-service" ? "api" : "ui_interactive",
    acceptanceCriteria: input.plan.predicateRefs.map((predicateRef) => ({
      id: predicateRef,
      description: "Exact required predicate from the sealed implementation slice",
    })),
    boundSurfaces: [],
    boundActions: [...new Set(input.plan.flows.map((flow) => flow.actionRef))].sort(),
    boundDataEntities: [],
    runtimeEvidenceRequired: {
      minFlowCount: input.plan.flows.length,
      requiredArtifactTypes: browserRuntime
        ? ["screenshot_per_flow", "dom_snapshot", "typed_command_evidence"]
        : ["runtime_snapshot_per_flow", "typed_command_evidence"],
      testBridgeRequired: false,
    },
    evidencePlanHash: input.plan.planHash,
    generatedBy: "setfarm-evidence-planner-v1",
    generatedAt: now,
  }, null, 2)}\n`);
  fs.writeFileSync(input.paths.request, `${JSON.stringify({
    schema: "setfarm.implement-verification-request.v1",
    storyId: input.storyId,
    status: "ready_for_orchestrator_verification",
    interactionRequests: flattenEvidencePlanInteractions(input.plan).map((interaction) => ({
      ...interaction,
      actionRef: actionByInteraction.get(interaction.id),
    })),
    uncoveredCriteria: [],
    knownGaps: [],
    evidencePlanHash: input.plan.planHash,
    generatedBy: "setfarm-evidence-planner-v1",
    generatedAt: now,
  }, null, 2)}\n`);
  return [planPath, input.paths.intent, input.paths.request];
}

function synthesizeDefaultEvidenceArtifacts(input: {
  workdir: string;
  storyId: string;
  paths: Record<string, string>;
}): string[] {
  const now = new Date().toISOString();
  const written: string[] = [];
  const intentWritten = writeJsonIfMissing(input.paths.intent, {
    schema: "setfarm.implement-intent.v1",
    storyId: input.storyId,
    storyType: "ui_interactive",
    acceptanceCriteria: [],
    boundSurfaces: [],
    boundActions: [],
    boundDataEntities: [],
    runtimeEvidenceRequired: {
      minFlowCount: 1,
      requiredArtifactTypes: ["screenshot_per_flow", "dom_snapshot", "build_pass"],
      testBridgeRequired: false,
    },
    autoGenerated: true,
    generatedBy: "setfarm.implement-evidence-runner",
    generatedAt: now,
  });
  if (intentWritten) written.push(input.paths.intent);

  const requestWritten = writeJsonIfMissing(input.paths.request, {
    schema: "setfarm.implement-verification-request.v1",
    storyId: input.storyId,
    status: "ready_for_orchestrator_verification",
    interactionRequests: [
      {
        id: "auto-snapshot",
        action: "snapshot",
        waitCondition: "dom_idle",
        timeoutMs: 1000,
      },
    ],
    uncoveredCriteria: [],
    knownGaps: ["Agent did not provide an explicit IMPLEMENT_VERIFICATION_REQUEST.json; Setfarm captured a conservative runtime snapshot instead."],
    autoGenerated: true,
    generatedBy: "setfarm.implement-evidence-runner",
    generatedAt: now,
  });
  if (requestWritten) written.push(input.paths.request);
  return written;
}

function runBuildCommand(workdir: string): { cmd: string; exitCode: number; summary?: string } {
  if (!hasPackageScript(workdir, "build")) {
    return { cmd: "npm run build", exitCode: 0, summary: "Skipped: package.json has no build script." };
  }
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: workdir,
      timeout: 240000,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    return { cmd: "npm run build", exitCode: 0 };
  } catch (err: any) {
    return {
      cmd: "npm run build",
      exitCode: typeof err?.status === "number" ? err.status : 1,
      summary: `${err?.stdout || ""}\n${err?.stderr || ""}\n${err?.message || ""}`.split("\n").slice(-40).join("\n").slice(0, 3000),
    };
  }
}

function runDeclaredCommand(
  workdir: string,
  command: EvidencePlanV1["commands"][number],
): { cmd: string; commandRef: string; exitCode: number; summary?: string; stdout: string; stderr: string; startedAt: string; completedAt: string } {
  const startedAt = new Date().toISOString();
  const cwd = path.resolve(workdir, command.cwd);
  const root = path.resolve(workdir);
  if (cwd !== root && !cwd.startsWith(`${root}${path.sep}`)) {
    return {
      cmd: command.argv.join(" "),
      commandRef: command.commandRef,
      exitCode: 1,
      summary: "Declared command cwd escapes the exact story worktree.",
      stdout: "",
      stderr: "Declared command cwd escapes the exact story worktree.",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
  try {
    const stdout = execFileSync(command.argv[0]!, command.argv.slice(1), {
      cwd,
      timeout: command.timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });
    return {
      cmd: command.argv.join(" "),
      commandRef: command.commandRef,
      exitCode: 0,
      stdout,
      stderr: "",
      startedAt,
      completedAt: new Date().toISOString(),
      ...(stdout.trim() ? { summary: stdout.slice(-3_000) } : {}),
    };
  } catch (error: any) {
    const stdout = String(error?.stdout || "");
    const stderr = String(error?.stderr || error?.message || "");
    return {
      cmd: command.argv.join(" "),
      commandRef: command.commandRef,
      exitCode: typeof error?.status === "number" ? error.status : 1,
      summary: `${stdout}\n${stderr}\n${error?.message || ""}`
        .split("\n").slice(-80).join("\n").slice(0, 6_000),
      stdout,
      stderr,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

export async function runImplementEvidenceIfRequested(input: {
  runId: string;
  runNumber?: number | null;
  storyId: string;
  workdir: string;
  stackPackId?: StackPackId | string | null;
  v3?: Readonly<{
    slice: ImplementationSliceV1;
    sliceHash: string;
    attemptId: string;
    sourceRevision: SourceRevisionV1;
  }>;
  observe?: ImplementEvidenceObserver;
}): Promise<ImplementEvidenceRunResult> {
  const evidenceStartedAt = new Date().toISOString();
  async function observe(observation: ImplementEvidenceObservation): Promise<void> {
    if (!input.observe) return;
    await Promise.resolve(input.observe(observation)).catch(() => undefined);
  }

  const config = readImplementEvidenceConfig();
  if (config.mode === "off" && !input.v3) return { attempted: false, ok: true, reason: "Implement evidence gate is off." };

  const paths = implementEvidenceArtifactPaths(input.workdir, input.storyId);
  const evidencePlan = input.v3
    ? compileEvidencePlanV1({ slice: input.v3.slice, sliceHash: input.v3.sliceHash })
    : undefined;
  if (evidencePlan) {
    const written = writeV3EvidenceArtifacts({
      workdir: input.workdir,
      storyId: input.storyId,
      paths,
      plan: evidencePlan,
    });
    await observe({
      checkId: "implement.evidence.plan.v1",
      label: "Sealed implementation evidence plan",
      status: "pass",
      summary: `Compiled ${evidencePlan.predicateRefs.length} exact predicates into ${evidencePlan.flows.length} flow(s).`,
      filePaths: written,
      metadata: { planHash: evidencePlan.planHash, predicateRefs: evidencePlan.predicateRefs },
      eventType: "implement.evidence.plan.compiled",
    });
  } else if (!fs.existsSync(paths.request)) {
    if (!hasPackageScript(input.workdir, "preview")) {
      return { attempted: false, ok: config.mode !== "blocking", reason: "No implementation verification request artifact found." };
    }
    const written = synthesizeDefaultEvidenceArtifacts({ workdir: input.workdir, storyId: input.storyId, paths });
    await observe({
      checkId: "implement.evidence.request.auto",
      label: "Implement evidence request auto-generated",
      status: "info",
      summary: "No agent verification request found; Setfarm generated a conservative snapshot request.",
      filePaths: written,
      metadata: { autoGenerated: true, written },
      eventType: "implement.evidence.request.auto_generated",
    });
  }
  if (!hasPackageScript(input.workdir, "preview") && !input.v3) {
    return { attempted: false, ok: config.mode !== "blocking", reason: "No package preview script available for runtime evidence." };
  }

  const request = readJson(paths.request);
  const interactions = evidencePlan
    ? flattenEvidencePlanInteractions(evidencePlan)
    : normalizeInteractionRequests(request?.interactionRequests);
  await observe({
    checkId: "implement.runtime.build",
    label: "Implement runtime build",
    status: "running",
    summary: "Running build before runtime evidence capture.",
    eventType: "implement.runtime.build.started",
  });
  const commands = evidencePlan?.commands.length
    ? evidencePlan.commands.map((command) => runDeclaredCommand(input.workdir, command))
    : [runBuildCommand(input.workdir)];
  const canonicalCommands: CanonicalCommandTraceV1[] = evidencePlan
    ? (commands as ReturnType<typeof runDeclaredCommand>[]).map((command) => ({
      commandRef: command.commandRef,
      exitCode: command.exitCode,
      stdout: command.stdout,
      stderr: command.stderr,
      startedAt: command.startedAt,
      completedAt: command.completedAt,
    }))
    : [];
  const canonicalize = (execution: Readonly<{
    runtimeSessionId?: string;
    initialCapture?: CapturedRuntimeState;
    interactions?: readonly CanonicalInteractionTraceV1[];
    runtimeError?: string;
  }> = {}): CanonicalEvidenceResultV1 | undefined => input.v3 && evidencePlan
    ? createCanonicalEvidenceBundleV2({
        runId: input.runId,
        storyId: input.storyId,
        workdir: input.workdir,
        attemptId: input.v3.attemptId,
        sourceRevision: input.v3.sourceRevision,
        slice: input.v3.slice,
        plan: evidencePlan,
        execution: {
          commands: canonicalCommands,
          interactions: execution.interactions ?? [],
          ...(execution.runtimeSessionId ? { runtimeSessionId: execution.runtimeSessionId } : {}),
          ...(execution.initialCapture ? { initialCapture: execution.initialCapture } : {}),
          ...(execution.runtimeError ? { runtimeError: execution.runtimeError } : {}),
        },
        startedAt: evidenceStartedAt,
        completedAt: new Date().toISOString(),
      })
    : undefined;
  await observe({
    checkId: "implement.runtime.build",
    label: "Implement runtime build",
    status: commands.some((command) => command.exitCode !== 0) ? "fail" : "pass",
    summary: commands.some((command) => command.exitCode !== 0) ? "Build failed before runtime evidence capture." : "Build passed before runtime evidence capture.",
    detail: commands.find((command) => command.exitCode !== 0)?.summary || "",
    metadata: { commands },
    eventType: commands.some((command) => command.exitCode !== 0) ? "implement.runtime.build.failed" : "implement.runtime.build.completed",
  });
  if (commands.some((command) => command.exitCode !== 0)) {
    const evidencePath = writeImplementEvidenceArtifact({
      workdir: input.workdir,
      storyId: input.storyId,
      runtime: { kind: "browser", status: "not_started" },
      commands,
      flows: [],
      verdict: "fail",
      issues: [{ code: "IMPLEMENT_EVIDENCE_BUILD_FAILED", message: commands.find((command) => command.exitCode !== 0)?.summary || "Build failed." }],
    });
    await observe({
      checkId: "implement.evidence.artifact",
      label: "Implement evidence artifact",
      status: "fail",
      summary: "Wrote failing implementation evidence after build failure.",
      metadata: { evidencePath },
      filePaths: [evidencePath],
      eventType: "implement.evidence.artifact.failed",
    });
    const canonicalEvidence = canonicalize({ runtimeError: "Typed command execution failed before runtime evidence." });
    return {
      attempted: true,
      evidencePath,
      ok: false,
      reason: "Build failed before runtime evidence.",
      ...(evidencePlan ? { evidencePlan } : {}),
      ...(canonicalEvidence ? { canonicalEvidence } : {}),
    };
  }

  if (evidencePlan?.runtime && input.stackPackId && evidencePlan.runtime.stackPackId !== input.stackPackId) {
    const reason = `Sealed runtime adapter ${evidencePlan.runtime.stackPackId} does not match claimed stack ${input.stackPackId}.`;
    const canonicalEvidence = canonicalize({ runtimeError: reason });
    return {
      attempted: true,
      ok: false,
      reason,
      evidencePlan,
      ...(canonicalEvidence ? { canonicalEvidence } : {}),
    };
  }
  if (evidencePlan && !evidencePlan.runtime) {
    const reason = input.stackPackId
      ? `Claimed stack ${input.stackPackId} requires a sealed runtime evidence contract.`
      : "V3 runtime evidence requires a sealed stack-owned adapter contract.";
    const canonicalEvidence = canonicalize({ runtimeError: reason });
    return {
      attempted: true,
      ok: false,
      reason,
      ...(evidencePlan ? { evidencePlan } : {}),
      ...(canonicalEvidence ? { canonicalEvidence } : {}),
    };
  }

  const driver: RuntimeDriver = evidencePlan?.runtime
    ? createStackRuntimeEvidenceDriver(evidencePlan.runtime)
    : new WebPreviewRuntimeDriver();
  let session: RuntimeSession | null = null;
  const flows: Array<{ flowId: string; description?: string; interactions: any[]; captures: any[] }> = [];
  const issues: Array<{ code: string; message: string }> = [];
  const canonicalInteractions: CanonicalInteractionTraceV1[] = [];
  let canonicalInitialCapture: CapturedRuntimeState | undefined;
  let canonicalRuntimeError: string | undefined;
  try {
    await observe({
      checkId: "implement.runtime.start",
      label: "Implement runtime start",
      status: "running",
      summary: "Starting temporary story runtime.",
      metadata: { workdir: input.workdir },
      eventType: "implement.runtime.started",
    });
    session = await driver.start({
      runId: input.runId,
      runNumber: input.runNumber ?? null,
      storyId: input.storyId,
      workdir: input.workdir,
    });
    await observe({
      checkId: "implement.runtime.start",
      label: "Implement runtime start",
      status: "pass",
      summary: `Runtime started at ${session.url}.`,
      metadata: { url: session.url, port: session.port, sessionId: session.sessionId },
      eventType: "implement.runtime.readying",
    });
    await driver.waitReady(session);
    await observe({
      checkId: "implement.runtime.ready",
      label: "Implement runtime ready",
      status: "pass",
      summary: `Runtime ready at ${session.url}.`,
      metadata: { url: session.url, port: session.port, sessionId: session.sessionId },
      eventType: "implement.runtime.ready",
    });
    const initialCapture = await driver.captureState(session);
    canonicalInitialCapture = initialCapture;
    let previousCapture = initialCapture;
    flows.push({ flowId: "initial", description: "Initial runtime capture", interactions: [], captures: [initialCapture] });
    await observe({
      checkId: "implement.runtime.capture.initial",
      label: "Initial runtime capture",
      status: "pass",
      summary: "Initial orchestrator-owned runtime state captured.",
      evidence: {
        screenshotPath: initialCapture.screenshotPath,
        domSnapshotPath: initialCapture.domSnapshotPath,
        runtimeSnapshotPath: initialCapture.runtimeSnapshotPath,
        stateBridge: initialCapture.stateBridge || null,
      },
      filePaths: [
        initialCapture.screenshotPath,
        initialCapture.domSnapshotPath,
        initialCapture.accessibilitySnapshotPath,
        initialCapture.runtimeSnapshotPath,
      ].filter(Boolean) as string[],
      eventType: "implement.runtime.capture.completed",
    });

    for (let i = 0; i < interactions.length; i += 1) {
      const interaction = interactions[i]!;
      await observe({
        checkId: `implement.runtime.interaction.${i + 1}`,
        label: `Runtime interaction ${i + 1}`,
        status: "running",
        summary: describeInteraction(interaction),
        metadata: { interaction },
        eventType: "implement.runtime.interaction.started",
      });
      const result = await driver.interact(session, interaction);
      const capture = await driver.captureState(session);
      canonicalInteractions.push({ request: interaction, result, before: previousCapture, after: capture });
      previousCapture = capture;
      flows.push({
        flowId: interaction.id || `flow-${i + 1}`,
        description: describeInteraction(interaction),
        interactions: [result],
        captures: [capture],
      });
      const failureContext = result.status !== "pass" ? failedInteractionContext(interaction, capture) : "";
      if (result.status !== "pass") {
        const baseMessage = result.detail || `${result.action} failed.`;
        issues.push({ code: "IMPLEMENT_INTERACTION_FAILED", message: failureContext ? `${baseMessage}\n${failureContext}` : baseMessage });
      }
      await observe({
        checkId: `implement.runtime.interaction.${i + 1}`,
        label: `Runtime interaction ${i + 1}`,
        status: result.status === "pass" ? "pass" : "fail",
        summary: failureContext || result.detail || `${result.action} ${result.status}`,
        detail: result.status === "pass" ? undefined : (result.detail || ""),
        metadata: { interaction, result, failureContext: failureContext || undefined },
        evidence: {
          screenshotPath: capture.screenshotPath,
          domSnapshotPath: capture.domSnapshotPath,
          runtimeSnapshotPath: capture.runtimeSnapshotPath,
          stateBridge: capture.stateBridge || null,
        },
        filePaths: [
          capture.screenshotPath,
          capture.domSnapshotPath,
          capture.accessibilitySnapshotPath,
          capture.runtimeSnapshotPath,
        ].filter(Boolean) as string[],
        eventType: result.status === "pass" ? "implement.runtime.interaction.completed" : "implement.runtime.interaction.failed",
      });
    }
  } catch (err: any) {
    canonicalRuntimeError = String(err?.message || err).slice(0, 1000);
    issues.push({ code: "IMPLEMENT_EVIDENCE_RUNTIME_FAILED", message: canonicalRuntimeError });
    await observe({
      checkId: "implement.runtime.failure",
      label: "Implement runtime failure",
      status: "fail",
      summary: String(err?.message || err).slice(0, 500),
      detail: String(err?.stack || err).slice(0, 3000),
      eventType: "implement.runtime.failed",
    });
  } finally {
    if (session) {
      await driver.stop(session)
        .then(() => observe({
          checkId: "implement.runtime.stop",
          label: "Implement runtime stop",
          status: "pass",
          summary: `Runtime stopped at ${session!.url}.`,
          metadata: { url: session!.url, port: session!.port, sessionId: session!.sessionId },
          eventType: "implement.runtime.stopped",
        }))
        .catch((err: any) => observe({
          checkId: "implement.runtime.stop",
          label: "Implement runtime stop",
          status: "fail",
          summary: String(err?.message || err).slice(0, 500),
          eventType: "implement.runtime.cleanup_failed",
        }));
    }
  }

  const evidencePath = writeImplementEvidenceArtifact({
    workdir: input.workdir,
    storyId: input.storyId,
    runtime: session || {
      kind: evidencePlan?.runtime?.adapter === "browser-service"
        ? "browser"
        : evidencePlan?.runtime
          ? "process"
          : "browser",
      status: "not_started",
    },
    commands,
    flows,
    verdict: issues.length === 0 ? "pass" : "fail",
    issues,
  });
  const canonicalEvidence = canonicalize({
    ...(session?.sessionId ? { runtimeSessionId: session.sessionId } : {}),
    ...(canonicalInitialCapture ? { initialCapture: canonicalInitialCapture } : {}),
    interactions: canonicalInteractions,
    ...(canonicalRuntimeError ? { runtimeError: canonicalRuntimeError } : {}),
  });
  const canonicalOk = canonicalEvidence ? canonicalEvidence.bundle.aggregateVerdict === "pass" : issues.length === 0;
  const predicateFailureText = canonicalEvidence
    ? canonicalEvidence.bundle.predicates
        .filter((predicate) => predicate.required && predicate.verdict !== "pass")
        .map((predicate) => `${predicate.predicateRef}:${predicate.verdict}`)
        .join("\n")
    : "";
  const failureText = [issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"), predicateFailureText]
    .filter(Boolean)
    .join("\n");
  const failureClassification = !canonicalOk
    ? classifyStackFailure(isStackPackId(input.stackPackId) ? input.stackPackId : "vite-react-web-app", {
      stepId: "implement",
      failure: failureText,
      hasMachineEvidence: true,
    })
    : null;
  await observe({
    checkId: "implement.evidence.artifact",
    label: "Implement evidence artifact",
    status: canonicalOk ? "pass" : "fail",
    summary: canonicalOk ? "Wrote passing implementation evidence." : "Wrote failing implementation evidence.",
    metadata: {
      evidencePath,
      flowCount: flows.length,
      issueCount: issues.length,
      canonicalAggregateVerdict: canonicalEvidence?.bundle.aggregateVerdict,
      canonicalEvidenceBundleHash: canonicalEvidence?.bundleHash,
      failureOwner: failureClassification?.owner,
      failureAction: failureClassification?.action,
      failureCategory: failureClassification?.category,
    },
    filePaths: [evidencePath],
    eventType: canonicalOk ? "implement.evidence.artifact.completed" : "implement.evidence.artifact.failed",
  });
  return {
    attempted: true,
    evidencePath,
    ok: canonicalOk,
    reason: canonicalOk
      ? "Implementation evidence captured."
      : canonicalEvidence
        ? `Canonical evidence verdict: ${canonicalEvidence.bundle.aggregateVerdict}.`
        : issues.map((issue) => issue.code).join(", "),
    failureOwner: failureClassification?.owner,
    failureAction: failureClassification?.action,
    failureCategory: failureClassification?.category,
    ...(evidencePlan ? { evidencePlan } : {}),
    ...(canonicalEvidence ? { canonicalEvidence } : {}),
  };
}
