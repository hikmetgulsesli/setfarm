import type postgres from "postgres";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";

type Sql = postgres.Sql | postgres.TransactionSql;
type JsonObject = Readonly<Record<string, unknown>>;

export const LEGACY_RESUME_PLAN_SCHEMA = "setfarm.legacy-resume-plan.v1" as const;
export const OPERATOR_ACTION_STATE_SCHEMA = "setfarm.operator-action-state.v1" as const;

export type LegacyResumePlanReasonCode =
  | "COMPILER_PROTOCOL_RESUME_FORBIDDEN"
  | "RUN_STATUS_NOT_RESUMABLE"
  | "LEGACY_RESUME_PLAN_CONTEXT_INVALID"
  | "LEGACY_RESUME_PLAN_META_INVALID"
  | "LEGACY_RESUME_PLAN_TOPOLOGY_INVALID"
  | "LEGACY_RESUME_PLAN_TOPOLOGY_AMBIGUOUS"
  | "LEGACY_RESUME_PLAN_LOOP_CONFIG_INVALID"
  | "LEGACY_RESUME_PLAN_VERIFY_EACH_AMBIGUOUS"
  | "LEGACY_RESUME_PLAN_TARGET_MISSING";

export type LegacyResumePlanSource = Readonly<{
  schema: typeof OPERATOR_ACTION_STATE_SCHEMA;
  run: JsonObject;
  steps: readonly JsonObject[];
  stories: readonly JsonObject[];
}>;

export type LegacyResumeStepMutation = Readonly<{
  stepDbId: string;
  workflowStepId: string;
  stepIndex: number;
  fromStatus: string;
  fromRetryCount: number;
  fromAbandonedCount: number;
  fromCurrentStoryId: string | null;
  fromOutput: string | null;
  toStatus: "pending" | "waiting";
  clearCurrentStory: true;
  resetRetryCount: true;
  resetAbandonedCount: true;
  clearOutput: boolean;
}>;

export type LegacyResumeStoryMutation = Readonly<{
  storyDbId: string;
  storyId: string;
  storyIndex: number;
  fromStatus: "failed" | "skipped";
  fromRetryCount: number;
  fromClaimedBy: string | null;
  fromClaimedAt: string | null;
  fromPrUrl: string | null;
  toStatus: "pending";
  resetRetryCount: true;
  clearClaim: true;
}>;

export type LegacyResumePlanV1 = Readonly<{
  schema: typeof LEGACY_RESUME_PLAN_SCHEMA;
  runId: string;
  workflowId: string;
  sourceStatus: "failed" | "cancelled";
  targetStepDbId: string;
  targetWorkflowStepId: string;
  targetStepIndex: number;
  mode: "direct" | "verify_each";
  verifyEachLoopStepDbId: string | null;
  contextBefore: string;
  contextAfter: string;
  metaBefore: string | null;
  metaAfter: string;
  stepMutations: readonly LegacyResumeStepMutation[];
  storyMutations: readonly LegacyResumeStoryMutation[];
  stateHash: string;
  planHash: string;
}>;

export type LegacyResumePlanResult = Readonly<{
  stateHash: string;
}> & (
  | Readonly<{ status: "ready"; plan: LegacyResumePlanV1 }>
  | Readonly<{ status: "denied"; reasonCode: LegacyResumePlanReasonCode }>
);

const CONTEXT_KEYS_TO_SCRUB = Object.freeze([
  "previous_failure",
  "failure_category",
  "failure_suggestion",
  "verify_feedback",
  "current_story_id",
  "current_story_title",
  "current_story",
  "story_workdir",
  "story_branch",
  "pr_url",
  "quality_failure_fingerprint",
  "quality_failure_repeat_count",
  "failure_route_action",
  "failure_route_category",
  "failure_route_policy",
  "failure_route_reason",
  "post_merge_quality_regression_story_id",
  "post_merge_quality_regression_pr_url",
] as const);

const META_KEYS_TO_SCRUB = Object.freeze([
  "terminal_failure",
  "terminal_marked_at",
  "terminal_reason",
  "resume_cleared_terminal_failure_at",
] as const);

function object(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return { ...(value as Record<string, unknown>) };
}

function requiredString(row: JsonObject, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function requiredInteger(row: JsonObject, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function nullableString(row: JsonObject, key: string): string | null | undefined {
  const value = row[key];
  return value === null || typeof value === "string" ? value : undefined;
}

function parseStoredObject(
  raw: unknown,
  nullable: boolean,
): Readonly<{ canonical: string; value: Record<string, unknown> }> | undefined {
  if (raw === null && nullable) return { canonical: "{}", value: {} };
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = object(JSON.parse(raw) as unknown);
    return parsed ? { canonical: raw, value: parsed } : undefined;
  } catch {
    return undefined;
  }
}

function scrubbedStoredObject(
  parsed: Readonly<{ value: Record<string, unknown> }>,
  keys: readonly string[],
): string {
  const scrubbed = { ...parsed.value };
  for (const key of keys) delete scrubbed[key];
  return canonicalJsonStringify(scrubbed);
}

function denied(
  stateHash: string,
  reasonCode: LegacyResumePlanReasonCode,
): LegacyResumePlanResult {
  return Object.freeze({ status: "denied", stateHash, reasonCode });
}

function exactSourceState(source: LegacyResumePlanSource): LegacyResumePlanSource {
  return Object.freeze({
    schema: OPERATOR_ACTION_STATE_SCHEMA,
    run: Object.freeze({ ...source.run }),
    steps: Object.freeze(source.steps.map((row) => Object.freeze({ ...row }))),
    stories: Object.freeze(source.stories.map((row) => Object.freeze({ ...row }))),
  });
}

export function operatorActionStateHash(source: LegacyResumePlanSource): string {
  return hashCanonicalJson(exactSourceState(source));
}

export async function readLegacyResumePlanSource(
  sql: Sql,
  runId: string,
  options: Readonly<{ lock?: boolean }> = {},
): Promise<LegacyResumePlanSource | null> {
  if (!runId.trim()) throw new TypeError("LEGACY_RESUME_PLAN_RUN_ID_REQUIRED");
  const lock = options.lock === true ? " FOR UPDATE" : "";
  const runRows = await sql.unsafe<Array<{ row: unknown }>>(
    `SELECT to_jsonb(run_row) AS row
       FROM runs run_row
      WHERE id = $1${lock}`,
    [runId],
  );
  if (!runRows[0]) return null;
  const run = object(runRows[0].row);
  if (!run) throw new Error("LEGACY_RESUME_PLAN_RUN_ROW_INVALID");

  // Operational action lock order is a platform invariant: run first, then
  // every step, then every story in deterministic topology order.
  const stepRows = await sql.unsafe<Array<{ row: unknown }>>(
    `SELECT to_jsonb(step_row) AS row
       FROM steps step_row
      WHERE run_id = $1
      ORDER BY step_index, id${lock}`,
    [runId],
  );
  const storyRows = await sql.unsafe<Array<{ row: unknown }>>(
    `SELECT to_jsonb(story_row) AS row
       FROM stories story_row
      WHERE run_id = $1
      ORDER BY story_index, id${lock}`,
    [runId],
  );
  const steps = stepRows.map(({ row }) => object(row));
  const stories = storyRows.map(({ row }) => object(row));
  if (steps.some((row) => !row) || stories.some((row) => !row)) {
    throw new Error("LEGACY_RESUME_PLAN_TOPOLOGY_ROW_INVALID");
  }
  return exactSourceState({
    schema: OPERATOR_ACTION_STATE_SCHEMA,
    run,
    steps: steps as Record<string, unknown>[],
    stories: stories as Record<string, unknown>[],
  });
}

type ParsedStep = Readonly<{
  row: JsonObject;
  id: string;
  runId: string;
  stepId: string;
  stepIndex: number;
  type: string;
  status: string;
  retryCount: number;
  abandonedCount: number;
  currentStoryId: string | null;
  output: string | null;
  loopConfigRaw: string | null;
}>;

type ParsedStory = Readonly<{
  row: JsonObject;
  id: string;
  runId: string;
  storyId: string;
  storyIndex: number;
  status: string;
  retryCount: number;
  claimedBy: string | null;
  claimedAt: string | null;
  prUrl: string | null;
}>;

function parseStep(row: JsonObject): ParsedStep | undefined {
  const id = requiredString(row, "id");
  const runId = requiredString(row, "run_id");
  const stepId = requiredString(row, "step_id");
  const stepIndex = requiredInteger(row, "step_index");
  const type = requiredString(row, "type");
  const status = requiredString(row, "status");
  const retryCount = requiredInteger(row, "retry_count");
  const abandonedCount = requiredInteger(row, "abandoned_count");
  const currentStoryId = nullableString(row, "current_story_id");
  const output = nullableString(row, "output");
  const loopConfigRaw = nullableString(row, "loop_config");
  if (
    !id || !runId || !stepId || stepIndex === undefined || !type || !status
    || retryCount === undefined || abandonedCount === undefined
    || currentStoryId === undefined || output === undefined || loopConfigRaw === undefined
  ) {
    return undefined;
  }
  return {
    row, id, runId, stepId, stepIndex, type, status,
    retryCount, abandonedCount, currentStoryId, output, loopConfigRaw,
  };
}

function parseStory(row: JsonObject): ParsedStory | undefined {
  const id = requiredString(row, "id");
  const runId = requiredString(row, "run_id");
  const storyId = requiredString(row, "story_id");
  const storyIndex = requiredInteger(row, "story_index");
  const status = requiredString(row, "status");
  const retryCount = requiredInteger(row, "retry_count");
  const claimedBy = nullableString(row, "claimed_by");
  const claimedAt = nullableString(row, "claimed_at");
  const prUrl = nullableString(row, "pr_url");
  if (
    !id || !runId || !storyId || storyIndex === undefined || !status
    || retryCount === undefined || claimedBy === undefined || claimedAt === undefined || prUrl === undefined
  ) {
    return undefined;
  }
  return { row, id, runId, storyId, storyIndex, status, retryCount, claimedBy, claimedAt, prUrl };
}

function duplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function loopConfig(
  step: ParsedStep,
): Readonly<{ verifyEach: boolean; verifyStep: string | null }> | undefined {
  if (step.loopConfigRaw === null || step.loopConfigRaw.trim() === "") {
    return step.type === "loop" ? undefined : { verifyEach: false, verifyStep: null };
  }
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = object(JSON.parse(step.loopConfigRaw) as unknown);
  } catch {
    return undefined;
  }
  if (!parsed) return undefined;
  if (parsed.verifyEach !== undefined && typeof parsed.verifyEach !== "boolean") return undefined;
  const verifyEach = parsed.verifyEach === true;
  const verifyStep = parsed.verifyStep === undefined || parsed.verifyStep === null
    ? null
    : typeof parsed.verifyStep === "string" && parsed.verifyStep.trim().length > 0
      ? parsed.verifyStep
      : undefined;
  if (verifyStep === undefined || (verifyEach && !verifyStep)) return undefined;
  return { verifyEach, verifyStep };
}

export function compileLegacyResumePlan(sourceInput: LegacyResumePlanSource): LegacyResumePlanResult {
  const source = exactSourceState(sourceInput);
  const stateHash = operatorActionStateHash(source);
  const runId = requiredString(source.run, "id");
  const workflowId = requiredString(source.run, "workflow_id");
  const protocol = requiredString(source.run, "protocol");
  const sourceStatus = requiredString(source.run, "status");
  if (!runId || !workflowId || !protocol || !sourceStatus) {
    return denied(stateHash, "LEGACY_RESUME_PLAN_TOPOLOGY_INVALID");
  }
  if (protocol !== "legacy") return denied(stateHash, "COMPILER_PROTOCOL_RESUME_FORBIDDEN");
  if (sourceStatus !== "failed" && sourceStatus !== "cancelled") {
    return denied(stateHash, "RUN_STATUS_NOT_RESUMABLE");
  }

  const parsedContext = parseStoredObject(source.run.context, false);
  if (!parsedContext) return denied(stateHash, "LEGACY_RESUME_PLAN_CONTEXT_INVALID");
  const parsedMeta = parseStoredObject(source.run.meta, true);
  if (!parsedMeta) return denied(stateHash, "LEGACY_RESUME_PLAN_META_INVALID");

  const steps = source.steps.map(parseStep);
  const stories = source.stories.map(parseStory);
  if (steps.some((step) => !step) || stories.some((story) => !story)) {
    return denied(stateHash, "LEGACY_RESUME_PLAN_TOPOLOGY_INVALID");
  }
  const exactSteps = steps as ParsedStep[];
  const exactStories = stories as ParsedStory[];
  if (
    exactSteps.some((step) => step.runId !== runId)
    || exactStories.some((story) => story.runId !== runId)
  ) {
    return denied(stateHash, "LEGACY_RESUME_PLAN_TOPOLOGY_INVALID");
  }
  if (
    duplicate(exactSteps.map((step) => step.id))
    || duplicate(exactSteps.map((step) => step.stepId))
    || duplicate(exactSteps.map((step) => String(step.stepIndex)))
    || duplicate(exactStories.map((story) => story.id))
    || duplicate(exactStories.map((story) => story.storyId))
    || duplicate(exactStories.map((story) => String(story.storyIndex)))
  ) {
    return denied(stateHash, "LEGACY_RESUME_PLAN_TOPOLOGY_AMBIGUOUS");
  }

  const parsedLoopConfigs = new Map<string, ReturnType<typeof loopConfig>>();
  for (const step of exactSteps) {
    if (step.loopConfigRaw === null && step.type !== "loop") continue;
    const parsed = loopConfig(step);
    if (!parsed) return denied(stateHash, "LEGACY_RESUME_PLAN_LOOP_CONFIG_INVALID");
    parsedLoopConfigs.set(step.id, parsed);
    if (parsed.verifyEach && exactSteps.filter((candidate) => candidate.stepId === parsed.verifyStep).length !== 1) {
      return denied(stateHash, "LEGACY_RESUME_PLAN_TOPOLOGY_INVALID");
    }
  }

  const targetStatuses = sourceStatus === "failed" ? new Set(["failed"]) : new Set(["failed", "cancelled"]);
  const target = exactSteps.find((step) => targetStatuses.has(step.status));
  if (!target) return denied(stateHash, "LEGACY_RESUME_PLAN_TARGET_MISSING");

  const verifyEachLoops = exactSteps.filter((step) => {
    const config = parsedLoopConfigs.get(step.id);
    return step.type === "loop"
      && ["running", "failed", "cancelled"].includes(step.status)
      && config?.verifyEach === true
      && config.verifyStep === target.stepId;
  });
  if (verifyEachLoops.length > 1) {
    return denied(stateHash, "LEGACY_RESUME_PLAN_VERIFY_EACH_AMBIGUOUS");
  }
  const verifyEachLoop = verifyEachLoops[0] ?? null;

  const stepMutations = new Map<string, LegacyResumeStepMutation>();
  const addStepMutation = (
    step: ParsedStep,
    toStatus: "pending" | "waiting",
    clearOutput: boolean,
  ): void => {
    stepMutations.set(step.id, {
      stepDbId: step.id,
      workflowStepId: step.stepId,
      stepIndex: step.stepIndex,
      fromStatus: step.status,
      fromRetryCount: step.retryCount,
      fromAbandonedCount: step.abandonedCount,
      fromCurrentStoryId: step.currentStoryId,
      fromOutput: step.output,
      toStatus,
      clearCurrentStory: true,
      resetRetryCount: true,
      resetAbandonedCount: true,
      clearOutput,
    });
  };

  if (verifyEachLoop) {
    addStepMutation(verifyEachLoop, "pending", false);
    addStepMutation(target, "waiting", true);
  } else {
    addStepMutation(target, "pending", false);
  }
  for (const step of exactSteps) {
    if (step.stepIndex <= target.stepIndex || stepMutations.has(step.id)) continue;
    if (["failed", "skipped", "cancelled"].includes(step.status)) addStepMutation(step, "waiting", true);
  }

  const resetsLoopStories = target.type === "loop" || verifyEachLoop !== null;
  const storyMutations: LegacyResumeStoryMutation[] = resetsLoopStories
    ? exactStories
      .filter((story) => ["failed", "skipped"].includes(story.status) && !(story.prUrl?.trim()))
      .map((story) => ({
        storyDbId: story.id,
        storyId: story.storyId,
        storyIndex: story.storyIndex,
        fromStatus: story.status as "failed" | "skipped",
        fromRetryCount: story.retryCount,
        fromClaimedBy: story.claimedBy,
        fromClaimedAt: story.claimedAt,
        fromPrUrl: story.prUrl,
        toStatus: "pending" as const,
        resetRetryCount: true as const,
        clearClaim: true as const,
      }))
    : [];

  const withoutHash = {
    schema: LEGACY_RESUME_PLAN_SCHEMA,
    runId,
    workflowId,
    sourceStatus: sourceStatus as "failed" | "cancelled",
    targetStepDbId: target.id,
    targetWorkflowStepId: target.stepId,
    targetStepIndex: target.stepIndex,
    mode: verifyEachLoop ? "verify_each" as const : "direct" as const,
    verifyEachLoopStepDbId: verifyEachLoop?.id ?? null,
    contextBefore: parsedContext.canonical,
    contextAfter: scrubbedStoredObject(parsedContext, CONTEXT_KEYS_TO_SCRUB),
    metaBefore: source.run.meta === null ? null : parsedMeta.canonical,
    metaAfter: scrubbedStoredObject(parsedMeta, META_KEYS_TO_SCRUB),
    stepMutations: [...stepMutations.values()].sort(
      (left, right) => left.stepIndex - right.stepIndex || left.stepDbId.localeCompare(right.stepDbId),
    ),
    storyMutations: storyMutations.sort(
      (left, right) => left.storyIndex - right.storyIndex || left.storyDbId.localeCompare(right.storyDbId),
    ),
    stateHash,
  };
  const plan: LegacyResumePlanV1 = Object.freeze({
    ...withoutHash,
    planHash: hashCanonicalJson(withoutHash),
  });
  return Object.freeze({ status: "ready", stateHash, plan });
}
