import { pgGet, pgQuery } from "../db-pg.js";
import { classifyStackFailure, getStackModule } from "../installer/stack-modules/registry.js";
import type { StackFailureClassification } from "../installer/stack-modules/types.js";
import { getStackPack, listStackPacks } from "../installer/stack-contract/packs.js";
import type { StackPackId } from "../installer/stack-contract/types.js";
import type { RunInfo, StepInfo } from "../installer/status.js";

type StoryRow = {
  story_id: string;
  title?: string | null;
  status?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
  story_branch?: string | null;
  pr_url?: string | null;
  output?: string | null;
  updated_at?: string | null;
};

type ObservationRow = {
  step_id?: string | null;
  story_id?: string | null;
  status?: string | null;
  summary?: string | null;
  detail?: string | null;
  check_id?: string | null;
  event_type?: string | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OperationalFailureOwner = "product" | "infra" | "platform" | "none";
export type OperationalRecoveryPolicy = "no_action" | "manual_review" | "product_retry" | "infra_retry" | "platform_fix";

export interface RunOperationalModel {
  schema: "setfarm.run-operational-model.v1";
  run: {
    id: string;
    runNumber?: number;
    workflow: string;
    status: string;
    terminal: boolean;
    task: string;
    updatedAt?: string;
  };
  stack: {
    stackPackId: StackPackId;
    label: string;
    runtimeKind: string;
    systemSmokeRunner: string;
    shouldAllocateRuntime: boolean;
    evidenceClasses: string[];
    confidence: "high" | "medium" | "low";
    evidence: string[];
  };
  pipeline: {
    currentStepId: string | null;
    currentStoryId: string | null;
    failedStepId: string | null;
    stepsTotal: number;
    stepsDone: number;
  };
  stories: {
    total: number;
    verified: number;
    doneAwaitingVerify: number;
    failed: number;
    skipped: number;
    running: number;
    pending: number;
    completed: number;
  };
  failure: {
    present: boolean;
    owner: OperationalFailureOwner;
    action: StackFailureClassification["action"] | "none";
    category: string;
    reason: string;
    retryable: boolean;
    recoveryPolicy: OperationalRecoveryPolicy;
    postMergeQualityRegression: boolean;
    mergedPrQualityFailure: boolean;
    sourceStepId: string | null;
    sourceStoryId: string | null;
    summary: string;
  };
  evidence: {
    latestSummary: string | null;
    latestStatus: string | null;
    observationCount: number;
  };
}

const STACK_IDS = new Set<StackPackId>(listStackPacks().map((pack) => pack.id));
const TERMINAL_RUN_STATUSES = new Set(["completed", "done", "failed", "cancelled", "canceled", "error"]);
const DONE_STEP_STATUSES = new Set(["done", "completed", "verified", "pass"]);
const ACTIVE_STEP_STATUSES = new Set(["running", "active"]);

function safeJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function asStackPackId(value: unknown): StackPackId | null {
  const id = String(value || "").trim();
  return STACK_IDS.has(id as StackPackId) ? id as StackPackId : null;
}

function inferStackPackId(run: Pick<RunInfo, "task" | "context">): { id: StackPackId; confidence: "high" | "medium" | "low"; evidence: string[] } {
  const context = safeJson((run as any).context);
  const explicit = asStackPackId(context.stack_pack_id || context.detected_stack || context.setup_stack_pack_id);
  const text = `${run.task || ""} ${context.tech_stack || ""} ${context.platform || ""}`.toLowerCase();
  const browserGameHint = /\b(browser-game|browser game|canvas-game|arcade|gameplay|playable game|keyboard controls)\b/.test(text);
  if (explicit && explicit !== "vite-react-web-app") return { id: explicit, confidence: "high", evidence: [`context stack_pack_id=${explicit}`] };
  if (browserGameHint) {
    const evidence = explicit === "vite-react-web-app"
      ? ["task/context browser-game hints override generic vite-react stack_pack_id"]
      : ["task/context browser-game hints"];
    return { id: "browser-game-canvas", confidence: explicit === "vite-react-web-app" ? "high" : "medium", evidence };
  }
  if (explicit) return { id: explicit, confidence: "high", evidence: [`context stack_pack_id=${explicit}`] };
  if (/\b(next\.?js|nextjs)\b/.test(text)) return { id: "nextjs-web-app", confidence: "medium", evidence: ["task/context Next.js hints"] };
  if (/\b(react native|react-native|expo)\b/.test(text)) return { id: "react-native-expo", confidence: "medium", evidence: ["task/context React Native hints"] };
  if (/\b(ios|iphone|swiftui|xcode)\b/.test(text)) return { id: "ios-app", confidence: "medium", evidence: ["task/context iOS hints"] };
  if (/\b(android|kotlin|gradle)\b/.test(text)) return { id: "android-app", confidence: "medium", evidence: ["task/context Android hints"] };
  if (/\b(python|fastapi|flask|django)\b/.test(text)) return { id: "python-web", confidence: "low", evidence: ["task/context Python hints"] };
  if (/\b(static html|plain html)\b/.test(text)) return { id: "static-html-site", confidence: "low", evidence: ["task/context static HTML hints"] };
  return { id: "vite-react-web-app", confidence: "low", evidence: ["default web stack fallback"] };
}

function storySummary(stories: StoryRow[]): RunOperationalModel["stories"] {
  const out = { total: stories.length, verified: 0, doneAwaitingVerify: 0, failed: 0, skipped: 0, running: 0, pending: 0, completed: 0 };
  for (const story of stories) {
    const status = String(story.status || "pending").toLowerCase();
    if (status === "verified") out.verified++;
    else if (status === "done" || status === "completed") out.doneAwaitingVerify++;
    else if (status === "failed") out.failed++;
    else if (status === "skipped" || status === "cancelled" || status === "canceled") out.skipped++;
    else if (status === "running" || status === "active") out.running++;
    else out.pending++;
  }
  out.completed = out.verified;
  return out;
}

function latestFailureSource(steps: StepInfo[], stories: StoryRow[], observations: ObservationRow[]): {
  stepId: string | null;
  storyId: string | null;
  text: string;
} {
  const failedObservation = observations.find((row) => {
    const status = String(row.status || "").toLowerCase();
    return status === "fail" || status === "failed" || /failure|failed|regression/i.test(`${row.summary || ""} ${row.detail || ""}`);
  });
  if (failedObservation) {
    return {
      stepId: failedObservation.step_id || null,
      storyId: failedObservation.story_id || null,
      text: `${failedObservation.summary || ""}\n${failedObservation.detail || ""}`.trim(),
    };
  }

  const failedStep = [...steps].reverse().find((step) => String(step.status || "").toLowerCase() === "failed");
  if (failedStep) return { stepId: failedStep.step_id, storyId: (failedStep as any).current_story_id || null, text: String((failedStep as any).output || "") };

  const failedStory = [...stories].reverse().find((story) => String(story.status || "").toLowerCase() === "failed");
  if (failedStory) return { stepId: null, storyId: failedStory.story_id, text: String(failedStory.output || "") };

  return { stepId: null, storyId: null, text: "" };
}

function currentStep(steps: StepInfo[]): string | null {
  const active = steps.find((step) => ACTIVE_STEP_STATUSES.has(String(step.status || "").toLowerCase()));
  if (active) return active.step_id;
  const firstOpen = steps.find((step) => !DONE_STEP_STATUSES.has(String(step.status || "").toLowerCase()));
  return firstOpen?.step_id || null;
}

function recoveryPolicyFor(classification: StackFailureClassification | null, runStatus: string, postMergeQualityRegression: boolean): OperationalRecoveryPolicy {
  if (!classification) return "no_action";
  if (postMergeQualityRegression) return "manual_review";
  if (classification.owner === "infra") return "infra_retry";
  if (classification.owner === "platform") return "platform_fix";
  if (String(runStatus || "").toLowerCase() === "failed") return "manual_review";
  return "product_retry";
}

export function buildRunOperationalModel(input: {
  run: RunInfo;
  steps: StepInfo[];
  stories: StoryRow[];
  observations?: ObservationRow[];
}): RunOperationalModel {
  const { run, steps, stories } = input;
  const observations = input.observations || [];
  const stack = inferStackPackId(run);
  const pack = getStackPack(stack.id);
  const module = getStackModule(stack.id);
  const currentStepId = currentStep(steps);
  const failedStep = steps.find((step) => String(step.status || "").toLowerCase() === "failed") || null;
  const failureSource = latestFailureSource(steps, stories, observations);
  const failureText = failureSource.text;
  const hasFailure = Boolean(failureText || failedStep || String(run.status || "").toLowerCase() === "failed");
  const postMergeQualityRegression = /POST_MERGE_QUALITY_REGRESSION|PR is already MERGED|already MERGED|merged PR/i.test(failureText);
  const mergedPrQualityFailure = postMergeQualityRegression || /VERIFY_SYSTEM_SMOKE_FAILURE|SYSTEM_SMOKE_FAILURE/i.test(failureText) && /MERGED|merged/i.test(failureText);
  const classifyStep = failureSource.stepId || failedStep?.step_id || currentStepId || "verify";
  const classification = hasFailure
    ? postMergeQualityRegression
      ? {
          owner: "product" as const,
          action: "product_retry" as const,
          category: "post_merge_quality_regression",
          reason: "A merged story PR failed downstream product evidence; Setfarm must not reopen the merged story branch.",
        }
      : classifyStackFailure(stack.id, { stepId: classifyStep, failure: failureText || String((failedStep as any)?.output || ""), hasMachineEvidence: true })
    : null;
  const executionPlan = module.executionPlanForStep(classifyStep);
  const storiesOut = storySummary(stories);
  const stepsDone = steps.filter((step) => DONE_STEP_STATUSES.has(String(step.status || "").toLowerCase())).length;
  const latestObservation = observations[0];
  const owner = classification?.owner || "none";
  const recoveryPolicy = recoveryPolicyFor(classification, run.status, postMergeQualityRegression);

  return {
    schema: "setfarm.run-operational-model.v1",
    run: {
      id: run.id,
      runNumber: (run as any).run_number,
      workflow: (run as any).workflow_id || "",
      status: run.status,
      terminal: TERMINAL_RUN_STATUSES.has(String(run.status || "").toLowerCase()),
      task: run.task,
      updatedAt: (run as any).updated_at,
    },
    stack: {
      stackPackId: stack.id,
      label: pack.label,
      runtimeKind: module.runtimeKind(),
      systemSmokeRunner: executionPlan.systemSmokeRunner,
      shouldAllocateRuntime: executionPlan.shouldAllocateRuntime,
      evidenceClasses: executionPlan.evidenceClasses,
      confidence: stack.confidence,
      evidence: stack.evidence,
    },
    pipeline: {
      currentStepId,
      currentStoryId: (run as any).current_story_id || stories.find((story) => ["running", "done", "failed"].includes(String(story.status || "").toLowerCase()))?.story_id || null,
      failedStepId: failedStep?.step_id || null,
      stepsTotal: steps.length,
      stepsDone,
    },
    stories: storiesOut,
    failure: {
      present: hasFailure,
      owner,
      action: classification?.action || "none",
      category: classification?.category || "none",
      reason: classification?.reason || "",
      retryable: recoveryPolicy === "infra_retry" || recoveryPolicy === "product_retry",
      recoveryPolicy,
      postMergeQualityRegression,
      mergedPrQualityFailure,
      sourceStepId: failureSource.stepId || failedStep?.step_id || null,
      sourceStoryId: failureSource.storyId,
      summary: failureText.split("\n").find(Boolean)?.slice(0, 500) || classification?.reason || "",
    },
    evidence: {
      latestSummary: latestObservation?.summary || null,
      latestStatus: latestObservation?.status || null,
      observationCount: observations.length,
    },
  };
}

export async function getRunOperationalModel(runId: string): Promise<RunOperationalModel | null> {
  const run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id = $1", [runId]);
  if (!run) return null;
  const [steps, stories, observations] = await Promise.all([
    pgQuery<StepInfo>("SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index ASC", [runId]),
    pgQuery<StoryRow>("SELECT * FROM stories WHERE run_id = $1 ORDER BY story_index ASC", [runId]),
    pgQuery<ObservationRow>(
      `SELECT step_id, story_id, status, summary, detail, check_id, event_type, metadata, created_at, updated_at
       FROM run_observations
       WHERE run_id = $1
       ORDER BY created_at DESC
       LIMIT 250`,
      [runId],
    ),
  ]);
  return buildRunOperationalModel({ run, steps, stories, observations });
}
