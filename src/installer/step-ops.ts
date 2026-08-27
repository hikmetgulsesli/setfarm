import { getSql, pgQuery, pgGet, pgRun, pgExec, pgBegin, now } from "../db-pg.js";
import type { PgTransactionSql } from "../db-pg.js";
import type { LoopConfig, Story } from "./types.js";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type postgres from "postgres";
import { emitEvent } from "./events.js";
import { recordObservation } from "./observations.js";
import { recordGateObservation, recordStackEvidencePlanObservation, recordStepOutputObservation } from "./operation-observability.js";
import { isBrowserRuntimeStack, resolveOperationalStackContract, stackEvidenceMetadata } from "./stack-evidence.js";
import { logger } from "../lib/logger.js";
import { runQualityChecks, formatQualityReport } from "./quality-gates.js";
import {
  CLEANUP_THROTTLE_MS,
  RUN_STATUS,
  STORY_STATUS,
  PROTECTED_CONTEXT_KEYS,
  isStepOutputContextKeyProtected,
  OPTIONAL_TEMPLATE_VARS,
  PR_REVIEW_DELAY_MS,
} from "./constants.js";
import { getPRState, invalidatePRStateCache, tryReopenPR, tryAutoMergePR, findPrByBranch, resolveClosedPR, getPRHeadBranch } from "./pr-state.js";
import { failStep, terminalizeLoopClaimAndState } from "./step-fail.js";
import { advancePipeline, checkLoopContinuation } from "./step-advance.js";
import {
  mergeExactSourceIntoFeature,
  mergeStoryIntoFeature,
  proveExactCommitAncestor,
  runMergeQueue,
} from "./merge-queue-ops.js";
import { refreshRunContractSafe } from "./contract-ledger.js";
import {
  observeShadowAttemptClaim,
  captureShadowSourceRevision,
} from "../execution/shadow-attempt-recorder.js";
import {
  createV3ImplementationAttemptHandoffV1,
  loadV3ImplementationAttemptContext,
  reserveV3ImplementationAttempt,
  type V3ImplementationAttemptResult,
} from "../execution/v3-implementation-attempt.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../product-compiler/compiler-english-admission-v1.js";
import {
  compileCompilerStoryEnglishAdmissionV1,
  compilerStoryEnglishAdmissionStateV1,
  type CompilerStoryEnglishAdmissionAuthorityV1,
} from "../product-compiler/compiler-story-english-admission-v1.js";
import type {
  CompilerEnglishAdmissionReceiptV1,
} from "../product-compiler/schemas/compiler-english-admission-receipt-v1.js";
import type {
  CompilerStoryEnglishAdmissionReceiptV1,
} from "../product-compiler/schemas/compiler-story-english-admission-receipt-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../execution/compiler-story-english-admission-publication-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  type CompilerStoryEnglishAdmissionClaimProofV1,
} from "../execution/compiler-story-english-admission-ledger-v1.js";
import type { PreparedV3StoriesCompletionV1 } from "./steps/03-stories/guards.js";
import { isValidStitchHtmlFile } from "../product-compiler/stitch-render-artifact.js";
import { ensureCompilerClaimFence } from "../execution/compiler-claim-fence.js";
import type { ClaimAttemptFenceV1 } from "../execution/schemas/claim-envelope-v1.js";
import type { ClaimEnvelopeV1 } from "../execution/schemas/claim-envelope-v1.js";
import { OperationalFailureCauseError } from "../execution/schemas/operational-failure-cause-v1.js";
import { assertClaimAuthority } from "../execution/claim-authority.js";
import { isV3OperationalStageWorkflowStepIdV1 } from "../execution/operational-failure-cause-authority-v1.js";
import { requestRunTerminationInTransaction } from "../execution/run-termination.js";
import { ClaimMutationAuthorityError } from "../execution/claim-mutation-authority.js";
import {
  markRuntimeCompletionOwnerCommittedInTransaction,
} from "../execution/runtime-completion.js";
import {
  createSingleEffectCompletionPlanDescriptorV1,
  type RuntimeCompletionPlanV1,
  type RuntimeCompletionSubjectV1,
} from "../execution/schemas/runtime-completion-plan-v1.js";
import {
  closeExactSingleStepClaimInTransaction,
  closeInternalProductionClaimOwnerAfterTerminalMutationV1,
  closeUniqueSingleStepClaimForRecoveryInTransaction,
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../execution/claim-attempt-transition.js";
import {
  bindRuntimeSessionAttemptInTransaction,
  parseRuntimeClaimIntentV1,
  reserveRuntimeSessionInTransaction,
  type RuntimeClaimIntentV1,
} from "../execution/runtime-session-repository.js";
import {
  loadAuthenticatedV3SupervisorRetryPreparationSourceV1,
  publishLoopClaimRuntime,
  type AuthenticatedV3SupervisorRetryPreparationSourceV1,
  publishSingleClaimRuntime,
  type LoopClaimAuthorityPublication,
} from "../execution/claim-runtime-publication.js";
import {
  loadAndRevalidateV3StoryClaimRuntimeBindingV1,
  type V3StoryClaimRuntimeSubjectV1,
} from "../execution/v3-story-claim-runtime-binding-v1.js";
import type { V3PreparationClaimAuthorityV1 } from "../execution/v3-preparation-claim-authority.js";
import { createV3PreparationBlockRepository } from "../execution/v3-preparation-block-repository.js";
import {
  createPostgresTerminalDependencyAttemptReader,
} from "../execution/v3-preparation-eligibility.js";
import {
  createPostgresV3PendingStoryReader,
  createV3NormalImplementationPreclaim,
} from "../execution/v3-normal-implementation-preclaim.js";
import { captureV3GitCommitRevision, resolveV3GitRevision } from "../execution/v3-git-revision.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import type { EvidenceBundleV2 } from "../evidence/evidence-bundle-v2.js";
import {
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  createInternalProductionClaimCanonicalOwnerIdentityV1,
  createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1,
  validateInternalProductionCanonicalOwnerIdentityV1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionOwnerReservationCloseV1,
} from "../internal-production/owner-admission-v1.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import { createFindingSetFromEvidenceBundleV2 } from "../findings/evidence-finding-set.js";
import { readDefaultGithubReview } from "../findings/github-review-source.js";
import {
  routeV3GithubReview,
  type V3GithubReviewRouteResult,
} from "../findings/v3-github-review-router.js";
import {
  classifyV3EvidenceFailure,
  createV3RecoveryCompletionPlanDescriptor,
} from "../recovery/v3-recovery-effect.js";
import {
  createV3RecoveryWorkRouter,
  type V3RecoveryRoutedWork,
} from "../recovery/v3-recovery-work-router.js";
import { createFindingRecoveryRepository } from "../recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../recovery/recovery-delivery-repository.js";
import type { V3RecoveryClaimHandoffV1 } from "../recovery/v3-recovery-claim-authority.js";
import {
  createV3ImplementationContextV1,
  type V3ImplementationContextV1,
  type V3ImplementationClaimHandoffV1,
} from "../execution/v3-implementation-handoff.js";
import { parseOperationalRetryDirectiveStoryOutput } from "../execution/operational-retry-directive.js";
import {
  createV3SupervisorRetryDirectiveV1,
  parseV3SupervisorRetryDirectiveStoryOutputV1,
  serializeV3SupervisorRetryDirectiveV1,
} from "../execution/v3-supervisor-retry-directive.js";
import {
  parseV3ImplementationAgentOutputV1,
  type V3ImplementationAgentOutputV1,
} from "../execution/v3-implementation-output.js";
import {
  projectCanonicalV3PlanParsedOutputV1,
  resolveV3PlanOutputAuthorityV1,
  shouldRunLegacyProductSupervisorV1,
  V3PlanOutputRejectedError,
  type V3PlanOutputAuthorityV1,
} from "../execution/v3-plan-output-authority.js";
import {
  projectCanonicalV3PlanParsedOutputV2,
  resolveV3PlanOutputAuthorityV2,
  shouldRunLegacyProductSupervisorV2,
  V3PlanOutputV2RejectedError,
  type V3PlanOutputAuthorityV2,
} from "../execution/v3-plan-output-authority-v2.js";
import {
  createV3StageFailureV1,
  createV3StageRetryDedupeKeyV1,
  createV3StageRetrySourceV1,
  serializeV3StageFailureDiagnostic,
  type V3StageRetrySourceV1,
} from "../execution/v3-stage-retry-authority.js";
import { completeV3PlanProductSpecRefusal } from "../execution/v3-plan-refusal.js";
import {
  completeV3DeployAuthorityRefusal,
  V3DeployRefusalLifecycleError,
} from "../execution/v3-deploy-refusal.js";
import { V3DeployAuthorityError } from "../execution/v3-deploy-authority.js";
import { V3DeployPublicationPendingError } from "../execution/v3-deploy-publication.js";
import {
  V3DeployReceiptV1Schema,
  type V3DeployReceiptV1,
} from "../execution/schemas/v3-deploy-receipt-v1.js";
import { createV3DeployReceiptRepository } from "../execution/v3-deploy-receipt-repository.js";
import { handleV3ImplementationRefusal } from "../recovery/v3-implementation-refusal.js";
import { createPostgresV3DownstreamEvidenceRouter } from "../recovery/v3-downstream-evidence-router.js";
import { commitV3DownstreamEvidenceDecision } from "../recovery/v3-downstream-recovery-transition.js";
import { createAcceptedCandidateRepository } from "../evidence/accepted-candidate-repository.js";
import {
  shouldMaterializeRepoDeployEnvironment,
  shouldRunLegacyDeployCompletionGuard,
} from "./steps/11-deploy/env-policy.js";

class V3PlatformPreclaimLifecycleError extends Error {
  readonly hardPreClaim = true;

  constructor(cause: unknown) {
    super(`V3_PLATFORM_PRECLAIM_LIFECYCLE_FAILED:${String(cause).slice(0, 800)}`, {
      cause,
    });
    this.name = "V3PlatformPreclaimLifecycleError";
  }
}

// ── Re-exports from extracted modules (backwards compat for cli.ts, medic.ts) ──
export { resolveTemplate, parseOutputKeyValues } from "./context-ops.js";
export { getStories, getCurrentStory } from "./story-ops.js";
export { computeHasFrontendChanges } from "./step-guardrails.js";
export { archiveRunProgress } from "./cleanup-ops.js";
export { failStep } from "./step-fail.js";

// ── Imports from extracted modules (used internally) ──
import { resolveTemplate, parseOutputKeyValues, readProgressFile, readProjectMemory, updateProjectMemory, getProjectTree, getInstalledPackages, getSharedCode, getRecentStoryCode, getComponentRegistry, getApiRoutes, pruneContextForStep } from "./context-ops.js";
import { getStories, formatStoryForTemplate, formatCompletedStories, parseAcceptanceCriteria, parseAndInsertStories } from "./story-ops.js";
import { createStoryWorktree, removeStoryWorktree, findWorktreeDir, syncBaseBranch, ensureStoryBranchWorktree, discardDirtyRetryWorktreeState } from "./worktree-ops.js";
import { computeHasFrontendChanges, checkTestFailures, checkQualityGate, checkRequiredOutputFields, processDesignCompletion, processSetupCompletion, processSetupDesignContracts, processBrowserCheck, processDesignFidelityCheck, checkStoryDesignCompliance, checkImportConsistency } from "./step-guardrails.js";
import { cleanupAbandonedSteps as _cleanupAbandonedSteps, cleanupProjectEphemera, scheduleRunCronTeardown } from "./cleanup-ops.js";
import { isVerifyRetryInfraFailure, isVerifyRetryMergeBlocker, isVerifyRetryQualityFailure } from "./verify-retry-routing.js";
import { markSupervisorInterventions, readSupervisorState, readSupervisorVisualResult, upsertSupervisorRunMetadata, writeSupervisorState } from "./supervisor/state.js";
import { resolveStoryVisualScope } from "./supervisor/visual-qa.js";
import {
  cleanupOutOfScopeWorktreeFiles,
  injectStoryContext as injectStoryContextFromModule,
  mergeRetryFailureTexts,
} from "./steps/06-implement/context.js";
import { assembleImplementContext } from "./setup-handoff.js";
import {
  missionControlApi,
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
} from "../runtime-config.js";
import { sanitizeDesignMismatchFeedback } from "./error-taxonomy.js";
import {
  applyEnglishOutputPolicyToResolvedPrompt,
  migratePersistedAgentPromptTemplate,
} from "./prompt-contracts.js";
import { routeDownstreamQualityFailure } from "./failure-router.js";
import { IMPLICIT_STORY_SCOPE_FILES, isImplicitStoryScopeFile } from "./story-scope.js";
import { resolvePlatformScript } from "./paths.js";
import { ensureSmokeBuildFresh } from "./smoke-gate.js";
import {
  closeReservedClaimRuntimeInTransaction,
  handleV3PreDispatchFailure,
} from "./v3-pre-dispatch-failure.js";
import {
  getRunStatus, getRunContext, updateRunContext, failRun,
  getWorkflowId as _getWorkflowId,
  verifyStory, skipFailedStories, countAllStories, countStoriesByStatus,
  findStoryByStatus, getStoryInfo,
  setStepStatus,
  findLoopStep, findActiveLoop,
  recordStepTransition,
} from "./repo.js";

function applyV3ImplementationSliceContext(
  context: Record<string, string>,
  compiled: V3ImplementationAttemptResult,
): void {
  // The structured handoff carries the exact CAS-backed objects to the
  // spawner. Generic run context keeps locators only so it cannot become a
  // second, stale copy of the implementation authority.
  context["implementation_context_protocol"] = "v3";
  delete context["implementation_slice_v1"];
  delete context["evidence_plan_v1"];
  delete context["finding_set_v1"];
  delete context["review_evidence_artifacts_v1"];
  context["implementation_slice_hash"] = compiled.sliceHash;
  context["implementation_slice_ref"] = compiled.sliceRefKey;
  context["evidence_plan_hash"] = compiled.evidencePlan.planHash;
  context["evidence_plan_artifact_hash"] = compiled.evidencePlanArtifactHash;
  context["evidence_plan_ref"] = compiled.evidencePlanRefKey;
  context["product_build_packet_hash"] = compiled.packetHash;
  context["product_compilation_report_hash"] = compiled.compilationReportHash;
  if (compiled.operationalRetry) {
    context["operational_retry_directive_hash"] = compiled.operationalRetry.directive.directiveHash;
    context["operational_retry_artifact_hash"] = compiled.operationalRetry.artifactHash;
  } else {
    delete context["operational_retry_directive_hash"];
    delete context["operational_retry_artifact_hash"];
  }
  if (compiled.recovery) {
    context["finding_set_hash"] = compiled.recovery.findingSet.findingSetHash;
    context["recovery_case_revision_id"] = compiled.recovery.revision.revisionId;
    context["recovery_dispatch_id"] = compiled.recovery.dispatch.dispatchId;
    context["recovery_dispatch_class"] = compiled.recovery.dispatch.dispatchClass;
  } else {
    delete context["finding_set_hash"];
    delete context["recovery_case_revision_id"];
    delete context["recovery_dispatch_id"];
    delete context["recovery_dispatch_class"];
  }
}

const QUALITY_FIX_STEPS = new Set(["supervise", "security-gate", "qa-test", "final-test"]);
const HARD_PRECLAIM_STEPS = new Set(["setup-build", "security-gate", "qa-test", "final-test"]);
const QA_FIX_SOURCE_EXT = /\.(tsx?|jsx?|css|scss|vue|svelte)$/i;
const QA_FIX_IGNORE = /^(node_modules\/|dist\/|build\/|\.next\/|coverage\/|stitch\/|references\/)|(^|\/)(package(-lock)?\.json|tsconfig[^/]*\.json|vite\.config\.[^/]+|tailwind\.config\.[^/]+|postcss\.config\.[^/]+|eslint\.config\.[^/]+|index\.html)$/;
const SMOKE_INFRA_FAILURE = /(?:\b(agent-browser|browser control|playwright|chromium|chrome|page\.goto|browser|context|target page)\b[\s\S]{0,320}\b(ETIMEDOUT|ECONNREFUSED|ECONNRESET|EPIPE|timed out|timeout|target page|context or browser has been closed|browser has been closed|target closed|protocol error)\b|\bsystem smoke did not return structured JSON\b|\bsmoke did not return structured JSON\b)/i;
const ACTIONABLE_RETRY_OUTPUT_PATTERN = "PR_REVIEW_COMMENTS_OPEN|actionable PR review comments|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:[[:space:]]*retry";
const ACTIVE_RETRY_STORY_SQL = `(retry_count > 0 OR COALESCE(output, '') ~* '${ACTIONABLE_RETRY_OUTPUT_PATTERN}')`;
const ACTIVE_RETRY_STORY_ALIAS_SQL = `(active_st.retry_count > 0 OR COALESCE(active_st.output, '') ~* '${ACTIONABLE_RETRY_OUTPUT_PATTERN}')`;
const PR_EACH_DELIVERY_BLOCKED_STEP_SQL = `(
  s.step_id = 'implement'
  AND s.type = 'loop'
  AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
  AND (
    COALESCE(r.context::jsonb ->> 'failure_category', '') = 'PR_REVIEW_COMMENTS_OPEN'
    OR COALESCE(r.context::jsonb ->> 'previous_failure', '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
    OR COALESCE(r.context::jsonb ->> 'verify_feedback', '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
  )
  AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running'))
  AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
)`;
const ACTIONABLE_RETRY_OUTPUT_RE = /\b(?:PR_REVIEW_COMMENTS_OPEN|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:\s*retry)\b|actionable PR review comments/i;
const PR_REVIEW_COMMENT_RETRY_LIMIT = 3;

function recoverableOutputTmpFiles(callerGatewayAgent?: string): string[] {
  let files: string[];
  try {
    files = fs.readdirSync("/tmp").filter((file) => file.startsWith("setfarm-output-") && file.endsWith(".txt"));
  } catch {
    return [];
  }
  if (callerGatewayAgent) {
    const direct = `setfarm-output-${callerGatewayAgent}.txt`;
    const spawnerPrefix = `setfarm-output-${callerGatewayAgent}-spawner-`;
    files = files.filter((file) => file === direct || file.startsWith(spawnerPrefix));
  }
  return files.sort((a, b) => {
    try {
      return fs.statSync(path.join("/tmp", b)).mtimeMs - fs.statSync(path.join("/tmp", a)).mtimeMs;
    } catch {
      return 0;
    }
  });
}

function applyRetryFailureContext(
  context: Record<string, any>,
  failure: string,
  category?: string,
  suggestion?: string,
): void {
  const nextFailure = String(failure || "").trim();
  if (nextFailure) {
    context["previous_failure"] = mergeRetryFailureTexts([
      String(context["previous_failure"] || ""),
      nextFailure,
    ]);
  }
  if (category) context["failure_category"] = category;
  if (suggestion) context["failure_suggestion"] = suggestion;
}


const QA_FIX_MAX_STORIES = Math.max(1, parseInt(process.env.SETFARM_QA_FIX_MAX_STORIES || "4", 10) || 4);
const QA_FIX_REPEAT_LIMIT = Math.max(1, parseInt(process.env.SETFARM_QA_FIX_REPEAT_LIMIT || "2", 10) || 2);
const SUPERVISED_STORY_IDS_CONTEXT_KEY = "supervised_story_ids";

function markStorySupervisorStatePassedInWorkdir(
  workdir: string,
  runId: string,
  storyId: string,
  decision: string,
  acCoverage = "",
): void {
  if (!workdir || !runId || !storyId) return;
  const nowIso = new Date().toISOString();
  const state = readSupervisorState(workdir, runId);
  const story = state.stories[storyId] || {
    status: "passed",
    currentWorker: undefined,
    openBlockers: [],
    warnings: [],
    resolved: [],
    lastEvidenceAt: nowIso,
  };

  const previousOpen = [...new Set([...(story.openBlockers || []), ...(story.warnings || [])])];
  for (const itemId of previousOpen) {
    if (!story.resolved.includes(itemId)) story.resolved.push(itemId);
    const evidence = state.evidence[itemId];
    if (evidence) {
      state.evidence[itemId] = {
        ...evidence,
        status: "passed",
        observed: [
          ...(Array.isArray(evidence.observed) ? evidence.observed : []),
          `Resolved by story-scoped LLM supervisor ${decision} decision.`,
        ].slice(-12),
        message: `Supervisor ${decision} decision cleared this previous finding.`,
        checkedAt: nowIso,
      };
    }
  }

  const syntheticId = `llm-supervisor:${storyId}:decision`;
  if (!story.resolved.includes(syntheticId)) story.resolved.push(syntheticId);
  story.openBlockers = [];
  story.warnings = [];
  story.status = "passed";
  story.lastEvidenceAt = nowIso;
  state.stories[storyId] = story;
  state.evidence[syntheticId] = {
    itemId: syntheticId,
    storyId,
    status: "passed",
    severity: "info",
    observed: [`SUPERVISOR_DECISION: ${decision}`, acCoverage].filter(Boolean),
    lastScan: "llm-supervisor",
    files: [],
    message: `Story-scoped supervisor completed with ${decision}.`,
    checkedAt: nowIso,
  } as any;
  state.projectStatus = Object.values(state.stories).some((item: any) => (item.openBlockers || []).length > 0)
    ? "blocked"
    : "implementing";
  writeSupervisorState(workdir, state);
}

function compactObservationText(value: unknown, max = 900): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function recordLiveObservation(options: {
  runId: string;
  stepId: string;
  storyId?: string | null;
  agentId?: string | null;
  checkId: string;
  label: string;
  status: "pending" | "running" | "pass" | "fail" | "retry" | "blocked" | "info";
  summary?: string | null;
  detail?: string | null;
  evidence?: Record<string, unknown> | null;
  filePaths?: string[] | null;
  github?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await recordObservation({
    ...options,
    summary: compactObservationText(options.summary || options.detail || options.label, 300),
    detail: compactObservationText(options.detail || options.summary || "", 1200),
  });
}

async function recordImplementGateObservation(
  step: { run_id: string; step_id: string; agent_id?: string | null },
  story: { story_id?: string | null; title?: string | null } | null | undefined,
  checkId: string,
  label: string,
  result: { passed: boolean; reason?: string; category?: string; suggestion?: string; outOfScope?: string[] },
): Promise<void> {
  await recordLiveObservation({
    runId: step.run_id,
    stepId: step.step_id,
    storyId: story?.story_id || "",
    agentId: step.agent_id || "",
    checkId,
    label,
    status: result.passed ? "pass" : "fail",
    summary: result.passed ? `${label} passed` : result.category || `${label} failed`,
    detail: result.reason || result.suggestion || "",
    filePaths: result.outOfScope || [],
    metadata: {
      category: result.category || "",
      suggestion: result.suggestion || "",
      storyTitle: story?.title || "",
    },
  });
}

function stripSetfarmGitWrapperPath(value: string | undefined): string {
  return String(value || "")
    .split(path.delimiter)
    .filter((entry) => entry && path.basename(entry) !== ".setfarm-bin")
    .join(path.delimiter);
}

function platformGitEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const hostUser = os.userInfo();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...extra,
    HOME: hostUser.homedir || os.homedir(),
    USER: hostUser.username || process.env.USER,
    PATH: stripSetfarmGitWrapperPath(extra.PATH || process.env.PATH),
  };
  for (const key of ["GH_CONFIG_DIR", "GH_TOKEN", "GITHUB_TOKEN", "XDG_CONFIG_HOME"]) {
    if (!(key in extra)) delete env[key];
  }
  return env;
}

function sanitizePlatformProcessPath(): void {
  const cleaned = stripSetfarmGitWrapperPath(process.env.PATH);
  if (cleaned && cleaned !== process.env.PATH) process.env.PATH = cleaned;
}

function execPlatformGit(args: string[], options: {
  cwd: string;
  timeout: number;
  stdio: any;
  encoding?: BufferEncoding;
  env?: NodeJS.ProcessEnv;
}): Buffer | string {
  return execFileSync("git", args, {
    ...options,
    env: platformGitEnv(options.env),
  } as any);
}

export function humanizeProjectDisplayName(input: string): string {
  const cleaned = String(input || "")
    .replace(/^Project\s*:\s*/i, "")
    .replace(/\s+(?:build|create|make|develop|implement|design|write|add|fix)\b[\s\S]*$/i, "")
    .replace(/\s+(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();
  const source = cleaned || input || "Setfarm Project";
  const words = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word && !/^\d{4,8}$/.test(word));
  if (words.length === 0) return String(source).slice(0, 80);

  const acronyms = new Set(["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa", "iot"]);
  return words.map((word) => {
    const lower = word.toLowerCase();
    if (acronyms.has(lower)) return lower.toUpperCase();
    if (lower === "rootfix") return "Root Fix";
    if (lower === "scopefix") return "Scope Fix";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ").slice(0, 80);
}

export function normalizeMissionControlHostname(input: string, fallbackProjectName: string): string {
  const fallback = `${fallbackProjectName}.setrox.com.tr`;
  let value = String(input || "").trim();
  if (!value) return fallback;

  value = value
    .replace(/^https?:\/\/https?:\/\//i, "https://")
    .replace(/^https?:\/\/https\/\//i, "https://")
    .replace(/^https?:\/\/http\/\//i, "http://")
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    value = parsed.hostname;
  } catch {
    value = value.split(/[/?#]/)[0];
  }

  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^https?\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:+$/, "")
    .toLowerCase();

  return /^[a-z0-9.-]+$/.test(value) && value.includes(".") ? value : fallback;
}

export function normalizeMissionControlSummary(input: string, displayName: string): string {
  const raw = String(input || "").replace(/\s+/g, " ").trim();
  const looksLikeRawTask =
    /^Project\s*:/i.test(raw) ||
    /\b(?:Build|Create|Make|Develop|Implement)\s+a\b/i.test(raw) ||
    /\bReact\/Vite\/TypeScript\b/i.test(raw) ||
    /\bRequirements?\s*:/i.test(raw) ||
    raw.length > 180;
  if (!raw || looksLikeRawTask) {
    return `${displayName} web application.`;
  }
  return raw.slice(0, 180);
}

function isQaFixStoryId(storyId: string | null | undefined): boolean {
  return /^QA-FIX-\d+$/i.test((storyId || "").trim());
}

function isSmokeInfrastructureFailure(failure: string): boolean {
  return SMOKE_INFRA_FAILURE.test(failure);
}

const GH_PR_URL_REGEX = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+(?:[?#].*)?$/i;

function formatCommandError(error: unknown): string {
  const err = error as { message?: string; stdout?: Buffer | string; stderr?: Buffer | string };
  const message = String(err?.message || error || "").split("\n")[0];
  const stderr = Buffer.isBuffer(err?.stderr) ? err.stderr.toString("utf-8") : String(err?.stderr || "");
  const stdout = Buffer.isBuffer(err?.stdout) ? err.stdout.toString("utf-8") : String(err?.stdout || "");
  return [message, stderr.trim(), stdout.trim()].filter(Boolean).join(" | ").slice(0, 900);
}

function isValidGithubPrUrl(prUrl: string, expectedRepoName = ""): boolean {
  return GH_PR_URL_REGEX.test(prUrl) && (!expectedRepoName || prUrl.includes(`/${expectedRepoName}/`));
}

function githubRepoSlugFromRemote(remoteUrl: string): string {
  const remote = String(remoteUrl || "").trim();
  const httpsMatch = remote.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:[#?].*)?$/i);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;
  const sshMatch = remote.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
  return "";
}

function githubRepoSlugForPath(repoPath: string): string {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: repoPath,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    }).toString().trim();
    return githubRepoSlugFromRemote(remote);
  } catch {
    return "";
  }
}

function gitRefExists(repoPath: string, ref: string): boolean {
  try {
    execPlatformGit(["rev-parse", "--verify", ref], {
      cwd: repoPath,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function storyBranchIntegratedInBase(repoPath: string, storyBranchName: string, baseBranch: string): boolean {
  if (!repoPath || !storyBranchName) return false;
  const baseRefs = [`origin/${baseBranch || "main"}`, baseBranch || "main"];
  const branchRefs = [`origin/${storyBranchName}`, storyBranchName];
  try {
    execPlatformGit(["fetch", "origin", "--prune"], {
      cwd: repoPath,
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    // Best effort; local refs may still be sufficient.
  }
  for (const branchRef of branchRefs) {
    if (!gitRefExists(repoPath, branchRef)) continue;
    for (const baseRef of baseRefs) {
      if (!gitRefExists(repoPath, baseRef)) continue;
      try {
        execPlatformGit(["merge-base", "--is-ancestor", branchRef, baseRef], {
          cwd: repoPath,
          timeout: 10_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return true;
      } catch {
        // Branch has commits not present in this base ref.
      }
    }
  }
  return false;
}

function findGithubPrUrlByBranchApi(repoPath: string, branch: string, expectedRepoName: string, allowMerged = true): string {
  const slug = githubRepoSlugForPath(repoPath);
  if (!slug || !branch) return "";
  const [owner] = slug.split("/");
  const params = new URLSearchParams({ head: `${owner}:${branch}`, state: "all", per_page: "20" });
  try {
    const raw = execFileSync("curl", [
      "-fsSL",
      "-H", "Accept: application/vnd.github+json",
      "-H", "User-Agent: setfarm-auto-pr-recovery",
      `https://api.github.com/repos/${slug}/pulls?${params.toString()}`,
    ], {
      cwd: repoPath,
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    }).toString();
    const prs = JSON.parse(raw) as Array<{ html_url?: string; state?: string; merged_at?: string | null }>;
    for (const pr of prs) {
      const state = String(pr.state || "").toLowerCase();
      const usable = state === "open" || (allowMerged && Boolean(pr.merged_at));
      const url = String(pr.html_url || "");
      if (usable && isValidGithubPrUrl(url, expectedRepoName)) return url;
    }
  } catch {
    return "";
  }
  return "";
}

async function ensureStoryPrUrlForBranch(options: {
  runId: string;
  repoPath: string;
  storyBranchName: string;
  baseBranch: string;
  storyId: string;
  storyTitle: string;
  changes: string;
  existingPrUrl?: string;
}): Promise<{ prUrl: string; error: string }> {
  const {
    runId,
    repoPath,
    storyBranchName,
    baseBranch,
    storyId,
    storyTitle,
    changes,
    existingPrUrl = "",
  } = options;
  const expectedRepoName = repoPath.split("/").pop() || "";
  const branchIntegrated = storyBranchIntegratedInBase(repoPath, storyBranchName, baseBranch || "main");
  if (existingPrUrl && isValidGithubPrUrl(existingPrUrl, expectedRepoName)) {
    const existingState = getPRState(existingPrUrl);
    const existingHeadBranch = getPRHeadBranch(existingPrUrl, repoPath);
    const headMatchesStoryBranch = (existingHeadBranch || "").toLowerCase() === storyBranchName.toLowerCase();
    if (existingState === "OPEN" || (existingState === "MERGED" && branchIntegrated)) {
      if (headMatchesStoryBranch) {
        return { prUrl: existingPrUrl, error: "" };
      }
      logger.warn(`[auto-pr] Ignoring ${existingState} existing PR ${existingPrUrl} for story ${storyId}; head ${existingHeadBranch || "(unknown)"} does not match ${storyBranchName}`, { runId });
    }
    if (existingState === "MERGED" && !branchIntegrated) {
      logger.warn(`[auto-pr] Ignoring MERGED existing PR ${existingPrUrl} for story ${storyId}; branch ${storyBranchName} still has commits not integrated into ${baseBranch || "main"}`, { runId });
    } else if (existingState !== "OPEN" && existingState !== "MERGED") {
      logger.warn(`[auto-pr] Ignoring ${existingState} existing PR ${existingPrUrl} for story ${storyId}; Setfarm will search/create a usable PR`, { runId });
    }
  }
  if (!repoPath || !storyBranchName) {
    return { prUrl: "", error: `AUTO_PR_CREATE_FAILED: missing repo or story branch for ${storyId}` };
  }

  const pushResult = pushStoryBranch(repoPath, storyBranchName);
  if (pushResult.error) {
    logger.warn(`[auto-pr] push failed for ${storyBranchName}: ${pushResult.error}`, { runId });
  }

  try {
    const existingPr = execFileSync("gh", ["pr", "list", "--head", storyBranchName, "--state", "open", "--json", "url,state", "--jq", ".[0].url // \"\""], {
      cwd: repoPath, timeout: 15_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).toString().trim();
    if (existingPr && isValidGithubPrUrl(existingPr, expectedRepoName)) {
      logger.info(`[auto-pr] Reusing usable existing PR ${existingPr} for story ${storyId}`, { runId });
      return { prUrl: existingPr, error: "" };
    }
  } catch (listErr) {
    logger.warn(`[auto-pr] pr list failed for ${storyBranchName}: ${formatCommandError(listErr)}`, { runId });
  }

  const apiExistingPr = findGithubPrUrlByBranchApi(repoPath, storyBranchName, expectedRepoName, branchIntegrated);
  if (apiExistingPr) {
    logger.info(`[auto-pr] Reusing GitHub API discovered PR ${apiExistingPr} for story ${storyId}`, { runId });
    return { prUrl: apiExistingPr, error: "" };
  }

  const prTitle = `feat: ${storyId || "story"} - ${(storyTitle || "").slice(0, 70)}`;
  const prBody = `## Story\n${storyId || ""}: ${storyTitle || ""}\n\n## Changes\n${changes.slice(0, 1500)}\n\n_Auto-created by setfarm after story completion._`;
  try {
    const prOut = execFileSync("gh", ["pr", "create", "--base", baseBranch || "main", "--head", storyBranchName, "--title", prTitle, "--body", prBody], {
      cwd: repoPath, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
    }).toString().trim();
    const urlMatch = prOut.match(/https?:\/\/github\.com\/\S+/);
    const prUrl = urlMatch?.[0] || "";
    if (prUrl && isValidGithubPrUrl(prUrl, expectedRepoName)) {
      logger.info(`[auto-pr] Created PR ${prUrl} for story ${storyId}`, { runId });
      return { prUrl, error: "" };
    }
    return { prUrl: "", error: `AUTO_PR_CREATE_FAILED: gh pr create returned no valid PR URL for ${storyBranchName}. Output: ${prOut.slice(0, 300)}` };
  } catch (createErr) {
    const apiCreatedPr = findGithubPrUrlByBranchApi(repoPath, storyBranchName, expectedRepoName, branchIntegrated);
    if (apiCreatedPr) {
      logger.info(`[auto-pr] Recovered PR ${apiCreatedPr} after gh pr create failed for story ${storyId}`, { runId });
      return { prUrl: apiCreatedPr, error: "" };
    }
    return { prUrl: "", error: `AUTO_PR_CREATE_FAILED: ${storyBranchName}: ${formatCommandError(createErr)}` };
  }
}

function gitCommandOk(cwd: string, args: string[], timeout = 5000): boolean {
  try {
    execFileSync("git", args, { cwd, timeout, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

async function storyAlreadyIntegratedInBase(options: {
  runId: string;
  storyDbId: string;
  storyId: string;
  workdir: string;
  baseBranch: string;
}): Promise<{ integrated: boolean; detail: string }> {
  const story = await pgGet<{ story_branch: string | null; pr_url: string | null }>(
    "SELECT story_branch, pr_url FROM stories WHERE id = $1",
    [options.storyDbId],
  );
  const candidates = [
    story?.story_branch || "",
    `${options.runId.slice(0, 8)}-${options.storyId}`.toLowerCase(),
  ].map(s => s.trim()).filter(Boolean);
  const uniqueCandidates = [...new Set(candidates)];

  let ancestorRef = "";
  for (const branch of uniqueCandidates) {
    for (const ref of [branch, `origin/${branch}`]) {
      if (!gitCommandOk(options.workdir, ["rev-parse", "--verify", ref])) continue;
      if (gitCommandOk(options.workdir, ["merge-base", "--is-ancestor", ref, options.baseBranch])) {
        ancestorRef = ref;
        break;
      }
    }
    if (ancestorRef) break;
  }

  const storyCommitPattern = new RegExp(`\\b${options.storyId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  let baseHasStoryCommit = false;
  try {
    const logOut = execFileSync("git", ["log", "--format=%H%x09%s", "-n", "120", options.baseBranch], {
      cwd: options.workdir,
      timeout: 8000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    baseHasStoryCommit = storyCommitPattern.test(logOut);
  } catch {
    baseHasStoryCommit = false;
  }

  if (ancestorRef && baseHasStoryCommit) {
    return {
      integrated: true,
      detail: `${options.storyId} branch ${ancestorRef} is already an ancestor of ${options.baseBranch}, and ${options.baseBranch} contains a story commit for ${options.storyId}.`,
    };
  }

  if (story?.pr_url) {
    const prState = getPRState(story.pr_url);
    if (prState === "MERGED" && (ancestorRef || baseHasStoryCommit)) {
      return {
        integrated: true,
        detail: `${options.storyId} PR is MERGED and local base evidence confirms the story is integrated.`,
      };
    }
  }

  return {
    integrated: false,
    detail: `${options.storyId} has no local integration proof for ${options.baseBranch}; ancestorRef=${ancestorRef || "none"} storyCommit=${baseHasStoryCommit ? "yes" : "no"}.`,
  };
}

function parseGitStatusPaths(status: string): string[] {
  const files = new Set<string>();
  for (const line of String(status || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = line.slice(3).trim().replace(/^"|"$/g, "");
    if (!raw) continue;
    if (raw.includes(" -> ")) {
      const parts = raw.split(" -> ").map((part) => part.trim().replace(/^"|"$/g, "")).filter(Boolean);
      for (const part of parts) files.add(part);
      continue;
    }
    files.add(raw);
  }
  return [...files].filter(Boolean);
}

function normalizeScopeFile(file: string): string {
  return String(file || "")
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function readStoryScopeFilesFromWorktree(workdir: string): string[] {
  try {
    const scopePath = path.join(workdir, ".story-scope-files");
    if (!fs.existsSync(scopePath)) return [];
    return fs.readFileSync(scopePath, "utf-8")
      .split(/\r?\n/)
      .map((line) => normalizeScopeFile(line))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseDeclaredScopeFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((file): file is string => typeof file === "string")
        .map(normalizeScopeFile)
        .filter(Boolean);
    }
  } catch {
    // Fall through to newline/comma parsing for defensive compatibility.
  }
  return String(raw)
    .split(/[\r\n,]+/)
    .map(normalizeScopeFile)
    .filter(Boolean);
}

function extractQualityFailureScopeFiles(failure: string): string[] {
  const files = new Set<string>();
  const text = String(failure || "");
  const candidateRe = /(?:^|[\s`'"])((?:\.\/)?(?:(?:src|assets|public|pages|app|components|lib|styles|css|scripts|test|tests)\/[A-Za-z0-9._/@+\-]+|[A-Za-z0-9._@+\-]+\.html))(?::\d+)?(?=[\s`'"),.;:—-]|$)/gm;
  let match: RegExpExecArray | null;
  while ((match = candidateRe.exec(text))) {
    const file = normalizeScopeFile(match[1] || "")
      .replace(/:\d+$/, "")
      .replace(/[),.;]+$/, "");
    if (!file || file.includes("://")) continue;
    if (/^(node_modules|dist|build|coverage|\.next)\//.test(file)) continue;
    if (!/\.(?:html|css|scss|js|jsx|mjs|cjs|ts|tsx|json)$/i.test(file)) continue;
    files.add(file);
  }
  return [...files];
}

function mergeScopeFilesJson(existingRaw: string | null | undefined, extraFiles: string[]): { json: string; files: string[]; added: string[] } {
  const existing = parseDeclaredScopeFiles(existingRaw);
  const seen = new Set(existing);
  const added: string[] = [];
  for (const file of extraFiles.map(normalizeScopeFile).filter(Boolean)) {
    if (seen.has(file)) continue;
    seen.add(file);
    added.push(file);
  }
  const files = [...seen];
  return { json: JSON.stringify(files), files, added };
}

function isPlatformInternalCommitPath(file: string): boolean {
  return file === ".story-scope-files"
    || file === ".story-branch"
    || file === "pre-commit"
    || file === "SUPERVISOR_MEMORY.md"
    || file === "PROJECT_MEMORY.md"
    || file === ".setfarm"
    || file.startsWith(".setfarm/")
    || file.startsWith(".setfarm-bin/")
    || file.startsWith("node_modules/")
    || file.startsWith("references/");
}

function isPlatformTransientRuntimeArtifact(file: string): boolean {
  return file === "smoke-home.png"
    || file === "smoke-after-click.png"
    || file.startsWith("test-results/")
    || file.startsWith("playwright-report/")
    || file.startsWith(".playwright/")
    || file.startsWith(".nyc_output/")
    || file.startsWith("coverage/")
    || /\.(?:webm|mp4|zip)$/i.test(file)
    || /(?:^|\/)(?:screenshot|smoke|visual|qa)[^/]*\.(?:png|jpg|jpeg|json)$/i.test(file);
}

function isPlatformNonStoryCommitPath(file: string): boolean {
  return isPlatformInternalCommitPath(file) || isPlatformTransientRuntimeArtifact(file);
}

function isPlatformMetadataOnlyVerifyRetry(output: string): boolean {
  const normalized = output.toLowerCase();
  const mentionsPlatformMetadata =
    /\bsupervisor_memory\.md\b/i.test(output)
    || /\bproject_memory\.md\b/i.test(output)
    || /\bclaude\.md\b/i.test(output)
    || /\.setfarm(?:\/|\b)/i.test(output);
  if (!mentionsPlatformMetadata) return false;

  const isDirtyStatusComplaint =
    /\bgit status\b/.test(normalized)
    || /\bdirty\b/.test(normalized)
    || /\bmodified\b/.test(normalized)
    || /\bclean workspace\b/.test(normalized)
    || /\bclean worktree\b/.test(normalized)
    || /\bclean git status\b/.test(normalized);
  if (!isDirtyStatusComplaint) return false;

  const failedCheck = /\b(build|test|lint|smoke)\b[\s\S]{0,80}\b(fail|failed|failure|error|broken)\b/.test(normalized);
  const productBlocker = /\b(runtime|button|link|control|conflict|scope_bleed|non-functional|broken|missing|blocker)\b/.test(normalized);
  return !failedCheck && !productBlocker;
}

function gitPorcelainPath(line: string): string {
  const raw = String(line || "").replace(/\r$/, "");
  if (!raw.trim()) return "";
  const status = raw.slice(0, 2);
  const body = /^[ MADRCU?!]{2}\s/.test(raw.slice(0, 3))
    ? raw.slice(3).trim()
    : raw.trim().replace(/^[ MADRCU?!]{1,2}\s+/, "");
  if (!body) return "";
  if (/[RC]/.test(status)) {
    const renamed = body.match(/^(.+?)\s+->\s+(.+)$/);
    if (renamed) return renamed[2].trim().replace(/^"|"$/g, "");
  }
  return body.replace(/^"|"$/g, "");
}

function isPlatformMetadataOnlyDirtyStatus(status: string): boolean {
  const files = String(status || "")
    .split(/\r?\n/)
    .map(gitPorcelainPath)
    .filter(Boolean);
  return files.length > 0 && files.every(isPlatformNonStoryCommitPath);
}

function isPlatformStoryCommitAllowed(file: string, scopeFiles: Set<string>): boolean {
  if (scopeFiles.has(file)) return true;
  return isImplicitStoryScopeFile(file);
}

export function commitStoryWorktreeScopeIfNeeded(
  workdir: string,
  storyId: string,
  storyTitle: string,
  declaredScopeFiles: string[] = [],
  commitType = "feat",
  strictDeclaredScope = false,
): { committed: boolean; sha: string; stagedFiles: string[]; error: string } {
  if (!workdir || !fs.existsSync(workdir)) {
    return { committed: false, sha: "", stagedFiles: [], error: "PLATFORM_STORY_COMMIT_MISSING_WORKDIR" };
  }

  let status = "";
  try {
    status = String(execPlatformGit(["status", "--porcelain=v1", "-uall"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }));
  } catch (err) {
    return { committed: false, sha: "", stagedFiles: [], error: `PLATFORM_STORY_COMMIT_STATUS_FAILED: ${formatCommandError(err)}` };
  }

  try {
    execPlatformGit(["reset", "-q", "HEAD", "--", "."], {
      cwd: workdir,
      timeout: 20_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    return { committed: false, sha: "", stagedFiles: [], error: `PLATFORM_STORY_COMMIT_RESET_FAILED: ${formatCommandError(err)}` };
  }

  const touched = parseGitStatusPaths(status).filter((file) => !isPlatformNonStoryCommitPath(file));
  if (touched.length === 0) return { committed: false, sha: "", stagedFiles: [], error: "" };

  const scopeFiles = new Set((declaredScopeFiles.length > 0 ? declaredScopeFiles : readStoryScopeFilesFromWorktree(workdir)).map(normalizeScopeFile));
  if (scopeFiles.size === 0) {
    return {
      committed: false,
      sha: "",
      stagedFiles: [],
      error: `PLATFORM_STORY_COMMIT_SCOPE_MISSING: ${storyId} has uncommitted files but .story-scope-files is empty or missing.`,
    };
  }

  const blocked = touched.filter((file) => strictDeclaredScope
    ? !scopeFiles.has(file)
    : !isPlatformStoryCommitAllowed(file, scopeFiles));
  if (blocked.length > 0) {
    return {
      committed: false,
      sha: "",
      stagedFiles: [],
      error: `PLATFORM_STORY_COMMIT_SCOPE_BLOCKED: ${storyId} has out-of-scope uncommitted file(s): ${blocked.slice(0, 12).join(", ")}.`,
    };
  }

  try {
    execPlatformGit(["add", "--", ...touched], {
      cwd: workdir,
      timeout: 20_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const staged = String(execPlatformGit(["diff", "--cached", "--name-only"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    })).trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (staged.length === 0) return { committed: false, sha: "", stagedFiles: [], error: "" };

    const commitTitle = (storyTitle || "story work").replace(/\s+/g, " ").trim().slice(0, 90);
    const safeCommitType = /^[a-z][a-z0-9-]*$/i.test(commitType) ? commitType.toLowerCase() : "feat";
    execPlatformGit(["commit", "-m", `${safeCommitType}: ${storyId} - ${commitTitle}`], {
      cwd: workdir,
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        GIT_AUTHOR_NAME: "Setfarm Supervisor",
        GIT_AUTHOR_EMAIL: "setfarm-supervisor@example.invalid",
        GIT_COMMITTER_NAME: "Setfarm Supervisor",
        GIT_COMMITTER_EMAIL: "setfarm-supervisor@example.invalid",
      },
    });
    const sha = String(execPlatformGit(["rev-parse", "HEAD"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    })).trim();
    return { committed: true, sha, stagedFiles: staged, error: "" };
  } catch (err) {
    return { committed: false, sha: "", stagedFiles: [], error: `PLATFORM_STORY_COMMIT_FAILED: ${formatCommandError(err)}` };
  }
}

export function cleanupBlockedStoryCommitScope(
  workdir: string,
  storyId: string,
  declaredScopeFiles: string[] = [],
  runId = "",
): string[] {
  if (!workdir || !fs.existsSync(workdir)) return [];
  const declared = declaredScopeFiles.length > 0
    ? declaredScopeFiles
    : readStoryScopeFilesFromWorktree(workdir);
  if (declared.length === 0) return [];
  const allAllowed = [...new Set([...declared, ...getImplicitScopeFiles(workdir)])];
  return cleanupOutOfScopeWorktreeFiles(workdir, allAllowed, storyId, runId);
}

function pushStoryBranch(workdir: string, storyBranch: string | null | undefined): { pushed: boolean; error: string } {
  if (!workdir || !fs.existsSync(workdir)) {
    return { pushed: false, error: "PLATFORM_STORY_PUSH_MISSING_WORKDIR" };
  }
  let branch = String(storyBranch || "").trim().toLowerCase();
  if (!branch) {
    try {
      branch = String(execPlatformGit(["branch", "--show-current"], {
        cwd: workdir,
        encoding: "utf-8",
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"],
      })).trim().toLowerCase();
    } catch (err) {
      return { pushed: false, error: `PLATFORM_STORY_PUSH_BRANCH_FAILED: ${formatCommandError(err)}` };
    }
  }
  if (!branch) return { pushed: false, error: "PLATFORM_STORY_PUSH_MISSING_BRANCH" };
  const pushArgs = ["push", "-u", "origin", branch];
  const leasePushArgs = ["push", "--force-with-lease", "-u", "origin", branch];
  const runPush = (args: string[]) => execPlatformGit(args, {
    cwd: workdir,
    timeout: 45_000,
    stdio: ["pipe", "pipe", "pipe"],
    env: { GIT_TERMINAL_PROMPT: "0" },
  });
  const isStaleRemotePush = (message: string) => (
    /\bnon-fast-forward\b/i.test(message)
    || /\[rejected\]/i.test(message)
    || /fetch first/i.test(message)
    || /Updates were rejected/i.test(message)
  );
  try {
    runPush(pushArgs);
    return { pushed: true, error: "" };
  } catch (err) {
    const firstError = formatCommandError(err);
    if (isStaleRemotePush(firstError)) {
      try {
        runPush(leasePushArgs);
        return { pushed: true, error: "" };
      } catch (leaseErr) {
        return { pushed: false, error: `PLATFORM_STORY_PUSH_FAILED: ${firstError}; after force-with-lease: ${formatCommandError(leaseErr)}` };
      }
    }
    if (/github\.com|could not read Username|Authentication failed|terminal prompts disabled/i.test(firstError)) {
      try {
        execFileSync("gh", ["auth", "setup-git", "--hostname", "github.com"], {
          cwd: workdir,
          timeout: 20_000,
          stdio: ["ignore", "pipe", "pipe"],
          env: platformGitEnv(),
        });
        runPush(pushArgs);
        return { pushed: true, error: "" };
      } catch (retryErr) {
        const authRetryError = formatCommandError(retryErr);
        if (isStaleRemotePush(authRetryError)) {
          try {
            runPush(leasePushArgs);
            return { pushed: true, error: "" };
          } catch (leaseErr) {
            return { pushed: false, error: `PLATFORM_STORY_PUSH_FAILED: ${firstError}; after gh auth setup-git: ${authRetryError}; after force-with-lease: ${formatCommandError(leaseErr)}` };
          }
        }
        return { pushed: false, error: `PLATFORM_STORY_PUSH_FAILED: ${firstError}; after gh auth setup-git: ${authRetryError}` };
      }
    }
    return { pushed: false, error: `PLATFORM_STORY_PUSH_FAILED: ${firstError}` };
  }
}

function storyWorkdirMatchesBranch(workdir: string, storyBranch: string): boolean {
  if (!workdir || !fs.existsSync(workdir) || !storyBranch) return false;
  try {
    const branch = String(execPlatformGit(["branch", "--show-current"], {
      cwd: workdir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })).trim().toLowerCase();
    return branch === storyBranch.toLowerCase();
  } catch {
    return false;
  }
}

function ensureStoryAuditWorkdir(
  context: Record<string, string>,
  storyBranch: string | null | undefined,
  agentId: string | null | undefined,
  runId: string,
  storyId: string,
  purpose: string,
): string {
  const branch = String(storyBranch || context["story_branch"] || "").trim().toLowerCase();
  if (!branch) return "";

  const current = context["story_workdir"] || "";
  if (storyWorkdirMatchesBranch(current, branch)) {
    context["story_workdir"] = current;
    return current;
  }

  const repo = context["repo"] || "";
  const workdir = ensureStoryBranchWorktree(repo, branch, agentId || undefined);
  if (workdir) {
    context["story_branch"] = branch;
    context["story_workdir"] = workdir;
    logger.info(`[story-workdir] ${purpose} will use ${workdir} for ${storyId} (${branch})`, { runId });
    return workdir;
  }

  logger.error(`[story-workdir] Could not prepare ${purpose} worktree for ${storyId} (${branch})`, { runId });
  return "";
}

type StorySmokeRow = {
  story_id: string;
  story_index: number;
  status: string;
  scope_files: string | null;
};

type StorySmokeDecision = { run: boolean; reason: string };

function parseScopeFileList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((file): file is string => typeof file === "string")
      : [];
  } catch {
    return [];
  }
}

function mergeStoryScopeFiles(context: Record<string, string>, files: string[]): string[] {
  const existing = String(context["story_scope_files"] || "")
    .split(",")
    .map(file => file.trim())
    .filter(Boolean);
  const merged = [...new Set([...existing, ...files.map(file => String(file || "").trim()).filter(Boolean)])];
  if (merged.length > 0) {
    context["story_scope_files"] = merged.join(", ");
  }
  return merged;
}

function isDesignImportBlockedError(error: unknown): boolean {
  return /DESIGN_IMPORT_VALIDATE|DESIGN_IMPORT_/i.test(String(error instanceof Error ? error.message : error));
}

function markDesignImportBlocked(context: Record<string, string>, error: unknown): void {
  const message = String(error instanceof Error ? error.message : error).trim();
  context["previous_failure"] = message || "DESIGN_IMPORT_VALIDATE_BLOCKED";
  context["failure_category"] = "design_import_failure";
  context["failure_suggestion"] =
    "Generated Stitch screen import did not pass deterministic validation. Inspect .setfarm/setup/DESIGN_IMPORT_VALIDATE.json, scripts/stitch-to-jsx.mjs, scripts/generated-screen-validator.mjs, and src/screens/*.tsx. Fix the converter/normalizer baseline, rerun generated-screen-validator --fix and npm run build, then retry setup-build. Do not pass generated-screen mechanical defects to IMPLEMENT.";
  context["scope_reminder"] =
    "DESIGN IMPORT BLOCKED: IMPLEMENT_CONTEXT was intentionally not assembled because generated screen conversion failed before implementation. Repair the Stitch-to-JSX import pipeline or generated-screen validator, not product logic.";
}

function buildStoryScopeReminder(scopeFiles: string[]): string {
  return "SCOPE ENFORCEMENT: You may ONLY write files in [" + scopeFiles.join(", ") + "]. shared_files are read-only/import context unless also listed in scope_files. Existing test/support files (*.test.*, *.spec.*, src/test/setup.*, src/test/utils.*, src/setupTests.*, vitest.config.*, jest.config.*) may be touched only when required to keep declared checks passing; do not add optional new tests after CHECK_BUILD_CMD/CHECK_TEST_CMD pass. src/types/*, domain model files, vite.config.*, tailwind.config.*, tsconfig.*, index.html, App.tsx, main.tsx, index.css are FORBIDDEN unless in your scope_files. Never edit shared exported types to fix only your screen; use local display/adaptor types inside scoped files. Do not create project-tree probe/scratch files such as src/_probe.tsx, src/probe.tsx, tmp.ts, or scratch.tsx to infer types; use claim-summary designContracts.componentTypes. Violation = instant SCOPE_BLEED rejection.";
}

function syncStoryScopeContext(
  context: Record<string, string>,
  story: { story_id?: string | null; id?: string | null; scope_files?: string | null; shared_files?: string | null },
  storyWorkdir: string,
  runId: string,
): string[] {
  const scopeFiles = parseDeclaredScopeFiles(story.scope_files);
  const sharedFiles = parseDeclaredScopeFiles(story.shared_files);

  if (scopeFiles.length > 0) {
    context["story_scope_files"] = scopeFiles.join(", ");
    context["scope_reminder"] = buildStoryScopeReminder(scopeFiles);
  } else {
    delete context["story_scope_files"];
    delete context["scope_reminder"];
  }

  if (sharedFiles.length > 0) {
    context["story_shared_files"] = sharedFiles.join(", ");
  } else {
    delete context["story_shared_files"];
  }

  if (storyWorkdir && scopeFiles.length > 0) {
    try {
      const allAllowed = [...new Set([...scopeFiles, ...getImplicitScopeFiles(storyWorkdir)])];
      const scopePath = path.join(storyWorkdir, ".story-scope-files");
      fs.writeFileSync(scopePath, allAllowed.join("\n") + "\n");
      try { fs.chmodSync(scopePath, 0o664); } catch { /* best effort */ }
      cleanupOutOfScopeWorktreeFiles(
        storyWorkdir,
        allAllowed,
        String(story.story_id || story.id || "story"),
        runId,
      );
    } catch (e) {
      logger.debug(`[scope-sync] Could not write story scope sidecar: ${String(e).slice(0, 120)}`);
    }
  }

  return scopeFiles;
}

function prependScopeReminderIfMissing(input: string, context: Record<string, string>): string {
  const reminder = String(context["scope_reminder"] || "").trim();
  if (!reminder || /\bSCOPE ENFORCEMENT:/i.test(input)) return input;
  return `${reminder}\n\n${input}`;
}

function withStepModulePromptAliases(context: Record<string, string>, runId: string): Record<string, string> {
  const aliased = { ...context };
  const assign = (target: string, ...sources: string[]) => {
    if (String(aliased[target] || "").trim()) return;
    for (const source of sources) {
      const value = String(aliased[source] || "");
      if (value.trim()) {
        aliased[target] = value;
        return;
      }
    }
    aliased[target] = "";
  };

  assign("RUN_ID", "run_id");
  if (!aliased["RUN_ID"]) aliased["RUN_ID"] = runId;
  assign("TASK", "task");
  assign("STORY_ID", "current_story_id");
  assign("MAIN_REPO", "repo");
  assign("STORY_WORKDIR", "story_workdir");
  assign("STORY_BRANCH", "story_branch");
  assign("SCOPE_FILES", "story_scope_files");
  assign("SCOPE_REMINDER", "scope_reminder");
  assign("STORY_ROADMAP", "story_roadmap");
  assign("STORY", "current_story");
  assign("STORY_IMPLEMENTATION_CONTRACT", "story_implementation_contract");
  assign("IMPLEMENT_CONTEXT", "implement_context");
  assign("IMPLEMENT_CONTEXT_PATH", "implement_context_path");
  assign("STORY_SCREENS", "story_screens");
  assign("DESIGN_RULES", "design_rules");
  assign("SUPERVISOR_MEMORY", "supervisor_memory");
  assign("SETFARM_MEMORY", "setfarm_memory");
  assign("STACK_MEMORY_FILES", "stack_memory_files");
  assign("PREVIOUS_FAILURE", "previous_failure");
  assign("FAILURE_CATEGORY", "failure_category");
  assign("FAILURE_SUGGESTION", "failure_suggestion");
  return aliased;
}

async function resolveLoopClaimInput(
  step: { step_id: string; run_id: string; input_template: string },
  prunedContextLoop: Record<string, string>,
  context: Record<string, string>,
): Promise<string> {
  const renderContext = withStepModulePromptAliases(prunedContextLoop, step.run_id);
  let resolvedInput = applyEnglishOutputPolicyToResolvedPrompt(prependScopeReminderIfMissing(
    resolveTemplate(migratePersistedAgentPromptTemplate(step.input_template), renderContext),
    context,
  ));

  // Step module takeover for loop claims. Single-step claims already use
  // buildPrompt(); loop claims need the same module source of truth after
  // injectStoryContext() has populated story-specific variables.
  try {
    const _modRegistryP = await import("./steps/registry.js");
    const _stepModuleP = _modRegistryP.get(step.step_id);
    if (_stepModuleP) {
      const _modulePrompt = _stepModuleP.buildPrompt({
        runId: step.run_id,
        task: renderContext["task"] || renderContext["TASK"] || "",
        context: renderContext,
      });
      if (_modulePrompt && _modulePrompt.length > 0) {
        const _modulePromptBytes = Buffer.byteLength(_modulePrompt, "utf8");
        if (_modulePromptBytes > _stepModuleP.maxPromptSize) {
          logger.warn("[step-module] " + _stepModuleP.id + " loop prompt " + _modulePromptBytes + " bytes > budget " + _stepModuleP.maxPromptSize + " - using anyway, investigate", { runId: step.run_id });
        }
        resolvedInput = renderContext["implementation_context_protocol"] === "v3"
          ? applyEnglishOutputPolicyToResolvedPrompt(_modulePrompt)
          : applyEnglishOutputPolicyToResolvedPrompt(prependScopeReminderIfMissing(
              resolveTemplate(_modulePrompt, renderContext),
              context,
            ));
        logger.info("[step-module] " + _stepModuleP.id + " loop buildPrompt override (" + _modulePromptBytes + "b)", { runId: step.run_id });
      }
    }
  } catch (_pe) {
    logger.warn("[step-module] loop buildPrompt failed (falling back to template): " + String(_pe).slice(0, 200), { runId: step.run_id });
  }

  return resolvedInput;
}

async function detectVerifyScopeDiffFailure(
  runId: string,
  storyId: string,
  repoPath: string,
  baseRef: string,
  headRef = "HEAD",
): Promise<string> {
  if (!storyId || !repoPath || !baseRef) return "";
  const story = await pgGet<{ story_id: string; title: string; scope_files: string | null }>(
    "SELECT story_id, title, scope_files FROM stories WHERE run_id = $1 AND story_id = $2 LIMIT 1",
    [runId, storyId],
  );
  if (!story?.scope_files) return "";
  const declaredScope = parseScopeFileList(story.scope_files);
  if (declaredScope.length === 0) return "";

  const { getChangedFiles } = await import("./static-analysis.js");
  const { getOutOfScopeStoryFiles } = await import("./steps/06-implement/guards.js");
  const changedFiles = getChangedFiles(repoPath, baseRef, headRef);
  const outOfScope = getOutOfScopeStoryFiles(changedFiles, declaredScope);
  if (outOfScope.length === 0) return "";

  const sharedTypeFiles = outOfScope.filter(file =>
    /^src\/types(?:\/|\.|$)/.test(file) || /(?:^|\/)(domain|types)\.(tsx?|d\.ts)$/.test(file),
  );
  const sharedTypeHint = sharedTypeFiles.length > 0
    ? "\nShared exported/domain types are read-only for this story. Keep them compatible; use a local render/display type or adapter inside the owned screen, and narrow before calling shared helpers."
    : "";

  return [
    `SCOPE_BLEED: Story ${story.story_id} (${story.title}) PR diff modifies ${outOfScope.length} file(s) outside scope_files.`,
    `Allowed scope_files: ${declaredScope.join(", ")}`,
    `Out-of-scope files: ${outOfScope.slice(0, 20).join(", ")}`,
    "shared_files are read-only/import context unless also listed in scope_files.",
    sharedTypeHint.trim(),
  ].filter(Boolean).join("\n");
}

async function detectVerifyGeneratedScreenRegressionFailure(
  runId: string,
  storyId: string,
  workdir: string,
  repoPath: string,
): Promise<string> {
  if (!runId || !storyId || !workdir || !fs.existsSync(workdir)) return "";
  const story = await pgGet<{ story_id: string; title: string; story_index: number | null }>(
    "SELECT story_id, title, story_index FROM stories WHERE run_id = $1 AND story_id = $2 LIMIT 1",
    [runId, storyId],
  );
  if (!story || story.story_index == null) return "";

  const previousRows = await pgQuery<{ story_screens: string | null }>(
    "SELECT story_screens FROM stories WHERE run_id = $1 AND story_index < $2 AND status IN ('done', 'verified') ORDER BY story_index",
    [runId, story.story_index],
  );
  if (previousRows.length === 0) return "";

  const { findGeneratedScreenRegressionIssues } = await import("./steps/06-implement/guards.js");
  const issues = findGeneratedScreenRegressionIssues(
    workdir,
    previousRows.map((row) => row.story_screens || []),
    repoPath,
  );
  if (issues.length === 0) return "";

  return [
    issues.join("\n"),
    `Story ${story.story_id} (${story.title}) reached verify while regressing a previously verified generated screen integration.`,
  ].join("\n");
}

async function hasPriorPrReviewCommentRetry(runId: string, storyId: string): Promise<boolean> {
  if (!runId || !storyId) return false;
  try {
    const observationRows = await pgQuery<{ found: string }>(
      `
        SELECT '1' AS found
        FROM run_observations
        WHERE run_id = $1
          AND (story_id = $2 OR story_id = '')
          AND (
            coalesce(summary, '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
            OR coalesce(detail, '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
            OR check_id = 'verify.pr_comments.fetch'
          )
          AND (
            coalesce(summary, '') ILIKE '%actionable%'
            OR coalesce(detail, '') ILIKE '%actionable%'
            OR status = 'blocked'
          )
        LIMIT 1
      `,
      [runId, storyId],
    );
    if (observationRows.length > 0) return true;

    const storyRows = await pgQuery<{ found: string }>(
      `
        SELECT '1' AS found
        FROM stories
        WHERE run_id = $1
          AND story_id = $2
          AND coalesce(output, '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
        LIMIT 1
      `,
      [runId, storyId],
    );
    return storyRows.length > 0;
  } catch (e) {
    logger.warn(`[verify-pr-comments] Could not inspect prior PR comment retry state for ${storyId}: ${String(e).slice(0, 160)}`);
    return false;
  }
}

export function isResolvedNoRepeatVisualRetryIssue(value: string | undefined): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return /\bvisual qa\b/i.test(text)
    && /\bviewport_integrity\b/i.test(text)
    && /\brepeat\s*=\s*no-repeat\b/i.test(text)
    && /\bsize\s*=\s*(cover|contain|100%\s+100%|100%|calc\()/i.test(text);
}

async function shouldDeferVerifyRetryExhaustionForResolvedEvidence(
  runId: string,
  storyId: string,
  issues: string,
  context: Record<string, string>,
): Promise<boolean> {
  if (!runId || !storyId || !isResolvedNoRepeatVisualRetryIssue(issues)) return false;
  if (String(context["verify_retry_exhaustion_deferred"] || "").includes(`${storyId}:`)) return false;

  try {
    const rows = await pgQuery<{ found: string }>(
      `
        WITH latest_retry AS (
          SELECT COALESCE(MAX(created_at), TIMESTAMP 'epoch') AS ts
          FROM run_observations
          WHERE run_id = $1
            AND (story_id = $2 OR story_id = '')
            AND (
              event_type = 'story.retry'
              OR check_id LIKE 'story.retry:%'
              OR label ILIKE '%retry%'
            )
        )
        SELECT '1' AS found
        FROM run_observations o, latest_retry r
        WHERE o.run_id = $1
          AND o.story_id = $2
          AND o.created_at >= r.ts
          AND o.status = 'pass'
          AND (
            o.check_id = 'supervisor-decision'
            OR o.check_id = 'stack-evidence:verify'
            OR o.event_type IN ('story.done', 'story.verified')
          )
        ORDER BY o.created_at DESC
        LIMIT 1
      `,
      [runId, storyId],
    );
    return rows.length > 0;
  } catch (e) {
    logger.warn(`[verify] Could not inspect resolved retry evidence for ${storyId}: ${String(e).slice(0, 160)}`, { runId });
    return false;
  }
}

type V3VerifyReviewRouteDisposition = Readonly<{
  blockAgent: boolean;
  result: V3GithubReviewRouteResult;
}>;

function v3ReviewErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return "V3_GITHUB_REVIEW_SOURCE_UNAVAILABLE";
}

function v3ReviewErrorRetryable(code: string): boolean {
  return code === "GITHUB_REVIEW_HEAD_CHANGED_DURING_FETCH"
    || code === "GITHUB_REVIEW_GRAPHQL_INCOMPLETE"
    || code === "V3_GITHUB_REVIEW_SOURCE_UNAVAILABLE";
}

async function routeExactV3GithubReviewBeforeVerifyAgent(input: Readonly<{
  runId: string;
  verifyStepDbId: string;
  verifyClaimId: number;
  storyId: string;
  prUrl: string;
  repositoryPath: string;
  context: Record<string, string>;
}>): Promise<V3VerifyReviewRouteDisposition> {
  const result = await routeV3GithubReview({
    runId: input.runId,
    verifyStepDbId: input.verifyStepDbId,
    verifyClaimId: input.verifyClaimId,
    storyId: input.storyId,
    prUrl: input.prUrl,
    repositoryPath: input.repositoryPath,
  });
  if (!("recoveryCaseId" in result)) {
    delete input.context["v3_review_recovery_case_id"];
    delete input.context["v3_review_dispatch_id"];
    delete input.context["v3_review_finding_set_hash"];
    delete input.context["v3_review_evidence_artifact_hashes"];
    delete input.context["v3_review_route_status"];
    return { blockAgent: false, result };
  }
  input.context["v3_review_route_status"] = result.status;
  input.context["v3_review_recovery_case_id"] = result.recoveryCaseId;
  input.context["v3_review_finding_set_hash"] = result.findingSetHash;
  input.context["v3_review_evidence_artifact_hashes"] = JSON.stringify(result.evidenceArtifactHashes);
  if (result.dispatchId) input.context["v3_review_dispatch_id"] = result.dispatchId;
  await updateRunContext(input.runId, input.context);
  await recordObservation({
    runId: input.runId,
    stepId: "verify",
    storyId: input.storyId,
    phase: "verify",
    checkId: `v3.github-review.route:${result.findingSetHash}`,
    label: "V3 exact GitHub review routing",
    status: result.status === "unchanged_terminal" ? "blocked" : "retry",
    summary: `${result.status}:${result.recoveryCaseId}`,
    detail: result.dispatchId
      ? `Exact actionable GitHub review evidence authorized dispatch ${result.dispatchId}`
      : "Exact actionable GitHub review evidence already has canonical recovery ownership",
    evidence: {
      schema: "setfarm.v3-github-review-route-observation.v1",
      headSha: result.headSha,
      findingSetHash: result.findingSetHash,
      recoveryCaseId: result.recoveryCaseId,
      dispatchId: result.dispatchId ?? null,
      evidenceArtifactHashes: result.evidenceArtifactHashes,
    },
  });
  return { blockAgent: true, result };
}

async function detectOpenPrReviewCommentFailure(
  prUrl: string | null | undefined,
  storyId: string,
  context: Record<string, string>,
  runId = "",
  stepId = "verify",
): Promise<string> {
  const url = String(prUrl || "").trim();
  if (!url) return "";

  try {
    const {
      fetchPrState,
      formatPrCommentsForAgent,
      resolveHistoricalInlineReviewThreads,
      resolveMechanicallySatisfiedInlineReviewThreads,
    } = await import("./steps/07-verify/pr-comments.js");
    let state = await fetchPrState(url, context["repo_full"] || "");
    if (state) {
      let formatted = formatPrCommentsForAgent(state);
      const actionableCount = formatted ? Number(formatted.match(/^## PR Comments \((\d+) actionable\)/m)?.[1] || 0) : 0;
      if (runId) {
        await recordLiveObservation({
          runId,
          stepId,
          storyId,
          checkId: "verify.pr_comments.fetch",
          label: "Fetch PR review comments",
          status: actionableCount > 0 ? "blocked" : "pass",
          summary: actionableCount > 0 ? `${actionableCount} actionable PR comment(s)` : "No actionable PR comments",
          detail: formatted || `PR state ${state.state}, checks ${state.checksStatus || "unknown"}`,
          github: {
            prUrl: url,
            state: state.state,
            checksStatus: state.checksStatus || "",
            mergeable: state.mergeable || "",
            mergeStateStatus: state.mergeStateStatus || "",
            actionableComments: actionableCount,
            totalComments: state.comments?.length || 0,
          },
        });
      }
      context["pr_comments"] = formatted || "";
      context["pr_check_state"] = state.checksStatus || "";
      context["pr_created_at"] = state.createdAt || "";
      context["pr_mergeable"] = state.mergeable || "";
      context["pr_merge_state_status"] = state.mergeStateStatus || "";
      const reviewStateAllowsResolution =
        state.checksStatus !== "failing" &&
        state.mergeable !== "CONFLICTING" &&
        !["DIRTY", "BLOCKED"].includes(state.mergeStateStatus || "");
      const localRepoPath = String(context["repo"] || "").trim();
      if (formatted && reviewStateAllowsResolution && localRepoPath) {
        const verifiedResolution = await resolveMechanicallySatisfiedInlineReviewThreads(state, localRepoPath);
        if (verifiedResolution.resolved > 0) {
          context["pr_verified_review_threads_resolved"] = String(verifiedResolution.resolved);
          if (runId) {
            await recordLiveObservation({
              runId,
              stepId,
              storyId,
              checkId: "verify.pr_comments.resolve_verified",
              label: "Resolve verified review threads",
              status: "pass",
              summary: `${verifiedResolution.resolved} mechanically verified thread(s) resolved`,
              detail: verifiedResolution.failures.join("\n"),
              github: {
                prUrl: url,
                resolved: verifiedResolution.resolved,
                failed: verifiedResolution.failed,
                candidates: verifiedResolution.candidates,
                policyDecision: "mechanically_satisfied_current_thread",
              },
              metadata: { policyDecision: "mechanically_satisfied_current_thread" },
            });
          }
          const refreshedState = await fetchPrState(url, context["repo_full"] || "");
          if (refreshedState) {
            state = refreshedState;
            formatted = formatPrCommentsForAgent(refreshedState);
            context["pr_comments"] = formatted || "";
            context["pr_check_state"] = refreshedState.checksStatus || "";
            context["pr_created_at"] = refreshedState.createdAt || "";
            context["pr_mergeable"] = refreshedState.mergeable || "";
            context["pr_merge_state_status"] = refreshedState.mergeStateStatus || "";
          }
        }
        if (verifiedResolution.failed > 0) {
          context["pr_verified_review_thread_resolution_failed"] = verifiedResolution.failures.join("\n").slice(0, 1200);
          if (runId) {
            await recordLiveObservation({
              runId,
              stepId,
              storyId,
              checkId: "verify.pr_comments.resolve_verified_failed",
              label: "Resolve verified review threads",
              status: "fail",
              summary: `${verifiedResolution.failed} verified thread resolution failure(s)`,
              detail: verifiedResolution.failures.join("\n"),
              github: {
                prUrl: url,
                resolved: verifiedResolution.resolved,
                failed: verifiedResolution.failed,
                candidates: verifiedResolution.candidates,
                policyDecision: "mechanically_satisfied_current_thread",
              },
              metadata: { policyDecision: "mechanically_satisfied_current_thread" },
            });
          }
        }
      }
      if (!formatted && reviewStateAllowsResolution) {
        const historicalResolution = await resolveHistoricalInlineReviewThreads(state);
        if (historicalResolution.resolved > 0) {
          context["pr_historical_review_threads_resolved"] = String(historicalResolution.resolved);
          if (runId) {
            await recordLiveObservation({
              runId,
              stepId,
              storyId,
              checkId: "verify.pr_comments.resolve_historical",
              label: "Resolve historical review threads",
              status: "pass",
              summary: `${historicalResolution.resolved} historical thread(s) resolved`,
              detail: historicalResolution.failures.join("\n"),
              github: { prUrl: url, resolved: historicalResolution.resolved, failed: historicalResolution.failed, policyDecision: "historical_or_outdated_thread" },
              metadata: { policyDecision: "historical_or_outdated_thread" },
            });
          }
          const refreshedState = await fetchPrState(url, context["repo_full"] || "");
          if (refreshedState) {
            state = refreshedState;
            formatted = formatPrCommentsForAgent(refreshedState);
            context["pr_comments"] = formatted || "";
            context["pr_check_state"] = refreshedState.checksStatus || "";
            context["pr_created_at"] = refreshedState.createdAt || "";
            context["pr_mergeable"] = refreshedState.mergeable || "";
            context["pr_merge_state_status"] = refreshedState.mergeStateStatus || "";
          }
        }
        if (historicalResolution.failed > 0) {
          context["pr_historical_review_thread_resolution_failed"] = historicalResolution.failures.join("\n").slice(0, 1200);
          if (runId) {
            await recordLiveObservation({
              runId,
              stepId,
              storyId,
              checkId: "verify.pr_comments.resolve_historical_failed",
              label: "Resolve historical review threads",
              status: "fail",
              summary: `${historicalResolution.failed} historical thread resolution failure(s)`,
              detail: historicalResolution.failures.join("\n"),
              github: { prUrl: url, resolved: historicalResolution.resolved, failed: historicalResolution.failed, policyDecision: "historical_or_outdated_thread" },
              metadata: { policyDecision: "historical_or_outdated_thread" },
            });
          }
        }
      }
      if (formatted) {
        return [
          state.state === "MERGED"
            ? `PR_REVIEW_COMMENTS_OPEN: ${storyId} PR is merged but still has current actionable PR review comments. This is a verify lifecycle violation; do not mark the story verified until the comments are no longer actionable.`
            : `PR_REVIEW_COMMENTS_OPEN: ${storyId} has actionable PR review comments that must be fixed before merge.`,
          formatted,
        ].join("\n");
      }
      return "";
    }
  } catch (e) {
    logger.warn(`[verify-pr-comments] Fresh PR comment check failed for ${storyId}: ${String(e).slice(0, 180)}`);
    if (runId) {
      await recordLiveObservation({
        runId,
        stepId,
        storyId,
        checkId: "verify.pr_comments.fetch_failed",
        label: "Fetch PR review comments",
        status: "fail",
        summary: "PR review comment fetch failed",
        detail: String(e),
        github: { prUrl: url },
      });
    }
  }

  const fallback = String(context["pr_comments"] || "").trim();
  if (/^## PR Comments \(\d+ actionable\)/m.test(fallback)) {
    return [
      `PR_REVIEW_COMMENTS_OPEN: ${storyId} has actionable PR review comments that must be fixed before merge.`,
      fallback,
    ].join("\n");
  }
  return "";
}

async function fastForwardMechanicallySatisfiedPrReviewRetry(
  step: any,
  story: any,
  context: Record<string, string>,
): Promise<boolean> {
  const storyOutput = String(story?.output || "");
  if (!/\bPR_REVIEW_COMMENTS_OPEN\b|actionable PR review comments/i.test(storyOutput)) return false;

  const prUrl = String(story?.pr_url || context["pr_url"] || context["final_pr"] || "").trim();
  const repoPath = String(context["repo"] || "").trim();
  if (!prUrl || !repoPath) return false;

  try {
    const {
      fetchPrState,
      formatPrCommentsForAgent,
      resolveMechanicallySatisfiedInlineReviewThreads,
    } = await import("./steps/07-verify/pr-comments.js");
    let state = await fetchPrState(prUrl, context["repo_full"] || "");
    if (!state) return false;

    let formatted = formatPrCommentsForAgent(state);
    if (formatted) {
      const reviewStateAllowsResolution =
        state.checksStatus !== "failing" &&
        state.mergeable !== "CONFLICTING" &&
        !["DIRTY", "BLOCKED"].includes(state.mergeStateStatus || "");
      if (!reviewStateAllowsResolution) return false;

      const resolution = await resolveMechanicallySatisfiedInlineReviewThreads(state, repoPath);
      if (resolution.candidates === 0 || resolution.failed > 0) return false;

      const refreshedState = await fetchPrState(prUrl, context["repo_full"] || "");
      if (!refreshedState) return false;
      state = refreshedState;
      formatted = formatPrCommentsForAgent(refreshedState);
      if (formatted) return false;
    }

    const output = [
      "STATUS: done",
      `STORY_BRANCH: ${String(story.story_branch || context["story_branch"] || "").trim()}`,
      `PR_URL: ${prUrl}`,
      "CHANGES: Current PR review retry is already satisfied by the PR head; Setfarm returned the story to verify without spawning another implement claim.",
      "RECOVERY: mechanically-satisfied-pr-review-retry",
    ].join("\n");
    await pgRun(
      "UPDATE stories SET status = 'done', claimed_by = NULL, claimed_at = NULL, output = $1, updated_at = $2 WHERE id = $3 AND status = 'pending'",
      [output, now(), story.id],
    );
    await pgRun(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3 AND status IN ('pending','running','waiting')",
      [output, now(), step.id],
    );
    await recordLiveObservation({
      runId: step.run_id,
      stepId: step.step_id,
      storyId: story.story_id,
      checkId: "implement.pr_comments.fast_forward_satisfied",
      label: "Fast-forward satisfied PR review retry",
      status: "pass",
      summary: "PR review retry already satisfied by current PR head",
      detail: output,
      github: {
        prUrl,
        state: state.state,
        checksStatus: state.checksStatus || "",
        mergeable: state.mergeable || "",
        mergeStateStatus: state.mergeStateStatus || "",
        policyDecision: "mechanically_satisfied_current_thread_preclaim",
      },
      metadata: { policyDecision: "mechanically_satisfied_current_thread_preclaim" },
    });
    emitEvent({
      ts: now(),
      event: "story.done",
      runId: step.run_id,
      workflowId: await getWorkflowId(step.run_id),
      stepId: step.step_id,
      storyId: story.story_id,
      storyTitle: story.title,
      detail: "PR review retry already satisfied by current PR head",
    });
    return true;
  } catch (err) {
    logger.warn(`[claim] PR review retry fast-forward failed for ${story?.story_id || "unknown"}: ${String(err).slice(0, 180)}`, { runId: step.run_id });
    return false;
  }
}

function prReviewSettleRemainingMs(context: Record<string, string>): number {
  const createdAt = String(context["pr_created_at"] || context["verify_pending_since"] || "").trim();
  const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
  if (!Number.isFinite(createdMs) || createdMs <= 0) return PR_REVIEW_DELAY_MS;
  return Math.max(0, PR_REVIEW_DELAY_MS - (Date.now() - createdMs));
}

function prReviewSettleComplete(context: Record<string, string>): boolean {
  return prReviewSettleRemainingMs(context) <= 0;
}

function isOpenPrDeliveryBlockerContext(context: Record<string, string>): boolean {
  const category = String(context["failure_category"] || "").trim();
  const failure = `${context["previous_failure"] || ""}\n${context["verify_feedback"] || ""}`;
  return (
    ["PR_NOT_MERGED", "PR_MISSING", "VERIFY_MERGE_BLOCKER", "PR_REVIEW_COMMENTS_OPEN"].includes(category) ||
    /\b(PR_NOT_MERGED|PR_MISSING|VERIFY_MERGE_BLOCKER|PR_REVIEW_COMMENTS_OPEN):/i.test(failure)
  );
}

function prDeliveryBlockerStoryId(context: Record<string, string>): string {
  const failure = `${context["previous_failure"] || ""}\n${context["verify_feedback"] || ""}`;
  const explicit = failure.match(/\b(?:PR_NOT_MERGED|PR_MISSING|VERIFY_MERGE_BLOCKER|PR_REVIEW_COMMENTS_OPEN):\s*([A-Z]+-\d+)\b/i)?.[1];
  return (explicit || context["current_story_id"] || "").trim();
}

function isSupervisorEscalatableReviewFailure(category: string | undefined, failure: string): boolean {
  return (
    String(category || "") === "PR_REVIEW_COMMENTS_OPEN" ||
    /\bPR_REVIEW_COMMENTS_OPEN\b|actionable PR review comments/i.test(failure)
  );
}

function extractPrReviewActionableCount(failure: string): number | null {
  const header = String(failure || "").match(/^## PR Comments \((\d+) actionable\)/m);
  if (!header) return null;
  const count = Number.parseInt(header[1] || "", 10);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

async function fetchFreshPrStateName(
  prUrl: string,
  storyId: string,
  context: Record<string, string>,
  runId: string,
  stepId: string,
): Promise<string> {
  try {
    const { fetchPrState } = await import("./steps/07-verify/pr-comments.js");
    const state = await fetchPrState(prUrl, context["repo_full"] || "");
    if (state) {
      context["pr_check_state"] = state.checksStatus || "";
      context["pr_mergeable"] = state.mergeable || "";
      context["pr_merge_state_status"] = state.mergeStateStatus || "";
      await recordLiveObservation({
        runId,
        stepId,
        storyId,
        checkId: "verify.pr_state.fresh",
        label: "Verify PR merge state",
        status: state.state === "MERGED" ? "pass" : "blocked",
        summary: `PR state ${state.state}`,
        detail: `PR state: ${state.state}, checks: ${state.checksStatus || "unknown"}, mergeable: ${state.mergeable || "unknown"}, mergeStateStatus: ${state.mergeStateStatus || "unknown"}`,
        github: {
          prUrl,
          state: state.state,
          checksStatus: state.checksStatus || "",
          mergeable: state.mergeable || "",
          mergeStateStatus: state.mergeStateStatus || "",
          actionableComments: 0,
          totalComments: state.comments?.length || 0,
        },
      });
      return state.state || "UNKNOWN";
    }
  } catch (e) {
    logger.warn(`[verify-pr-state] Fresh PR state check failed for ${storyId}: ${String(e).slice(0, 180)}`, { runId });
  }
  invalidatePRStateCache(prUrl);
  return getPRState(prUrl);
}

async function publishVerifyRetryToImplement(input: Readonly<{
  verifyStep: StepRow;
  retryStoryId: string;
  retryCount: number;
  failure: string;
  retryStoryBranch: string;
  context: Record<string, string>;
  loopStepId?: string;
  superviseStepName: string;
  category: string;
}>): Promise<void> {
  const transitionTime = now();
  await pgBegin(async (sql) => {
    const supervisorSteps = await sql.unsafe<Array<{ id: string }>>(
      `SELECT id
         FROM steps
        WHERE run_id = $1 AND step_id = $2`,
      [input.verifyStep.run_id, input.superviseStepName],
    );
    const supervisorStep = supervisorSteps[0];
    if (!supervisorStep) throw new Error("VERIFY_RETRY_SUPERVISOR_STEP_NOT_FOUND");

    await closeUniqueSingleStepClaimForRecoveryInTransaction(sql, {
      runId: input.verifyStep.run_id,
      stepDbId: supervisorStep.id,
      workflowStepId: input.superviseStepName,
      outcome: "infra_retry",
      diagnostic: `${input.category} routed story back to implement; exact supervisor owner recovered`,
      runtimeAgentId: "verify-retry-recovery-owner",
      now: new Date(transitionTime),
    });

    const stories = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = 'pending',
              claimed_by = NULL,
              claimed_at = NULL,
              retry_count = $2,
              output = $3,
              story_branch = COALESCE(NULLIF($4, ''), story_branch),
              updated_at = $5
        WHERE id = $1
          AND run_id = $6
          AND status = 'done'
        RETURNING id`,
      [
        input.retryStoryId,
        input.retryCount,
        input.failure,
        input.retryStoryBranch,
        transitionTime,
        input.verifyStep.run_id,
      ],
    );
    if (stories.length !== 1) throw new Error("VERIFY_RETRY_STORY_CAS_LOST");

    const runs = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE runs
          SET context = $2, updated_at = $3
        WHERE id = $1 AND status IN ('running', 'resuming')
        RETURNING id`,
      [input.verifyStep.run_id, JSON.stringify(input.context), transitionTime],
    );
    if (runs.length !== 1) throw new Error("VERIFY_RETRY_RUN_CAS_LOST");

    if (input.loopStepId) {
      const loopSteps = await sql.unsafe<Array<{ id: string }>>(
        `UPDATE steps
            SET status = 'pending', updated_at = $2
          WHERE id = $1 AND run_id = $3
          RETURNING id`,
        [input.loopStepId, transitionTime, input.verifyStep.run_id],
      );
      if (loopSteps.length !== 1) throw new Error("VERIFY_RETRY_LOOP_STEP_CAS_LOST");
    }

    const supervisorUpdated = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'waiting', current_story_id = NULL, updated_at = $3
        WHERE id = $1
          AND run_id = $2
          AND status IN ('waiting', 'pending', 'running', 'done')
        RETURNING id`,
      [supervisorStep.id, input.verifyStep.run_id, transitionTime],
    );
    if (supervisorUpdated.length !== 1) throw new Error("VERIFY_RETRY_SUPERVISOR_STEP_CAS_LOST");
  });
}

async function routeVerifyScopeFailureToImplement(
  verifyStep: StepRow,
  context: Record<string, string>,
  storyId: string,
  failure: string,
  options: {
    category?: string;
    suggestion?: string;
  } = {},
): Promise<void> {
  const retryStory = await pgGet<{ id: string; retry_count: number; max_retries: number; pr_url: string | null; story_branch: string | null }>(
    "SELECT id, retry_count, max_retries, pr_url, story_branch FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
    [verifyStep.run_id, storyId],
  );
  if (!retryStory) return;

  const newRetry = retryStory.retry_count + 1;
  const prHeadBranch = retryStory.pr_url ? getPRHeadBranch(retryStory.pr_url, context["repo"] || "") : null;
  const retryStoryBranch = (prHeadBranch || retryStory.story_branch || "").trim().toLowerCase();
  context["verify_feedback"] = failure;
  context["previous_failure"] = failure;
  context["failure_category"] = options.category || "SCOPE_BLEED";
  context["failure_suggestion"] = options.suggestion || "Revert out-of-scope files from the story branch. Only modify files listed in scope_files; use local adapters instead of changing shared exported types.";
  if (retryStory.pr_url) context["pr_url"] = retryStory.pr_url;
  if (retryStoryBranch) context["story_branch"] = retryStoryBranch;

  const isReviewFailure = isSupervisorEscalatableReviewFailure(options.category, failure);
  if (isReviewFailure) {
    const actionableCount = extractPrReviewActionableCount(failure);
    const previousReviewStoryId = context["pr_review_retry_story_id"] || "";
    const previousReviewCount = Number.parseInt(context["pr_review_retry_count"] || "0", 10);
    const previousActionableCount = Number.parseInt(context["pr_review_last_actionable_count"] || "", 10);
    const sameReviewStory = previousReviewStoryId === storyId;
    const madeReviewProgress = sameReviewStory && actionableCount !== null && Number.isFinite(previousActionableCount) && actionableCount < previousActionableCount;
    const nextReviewRetry = madeReviewProgress ? 1 : (sameReviewStory && Number.isFinite(previousReviewCount) ? previousReviewCount + 1 : 1);
    const reviewRetryExhausted = nextReviewRetry > PR_REVIEW_COMMENT_RETRY_LIMIT;
    const storyRetryForReview = Math.min(newRetry, Math.max(0, retryStory.max_retries));

    context["pr_review_retry_story_id"] = storyId;
    context["pr_review_retry_count"] = String(nextReviewRetry);
    if (actionableCount !== null) context["pr_review_last_actionable_count"] = String(actionableCount);
    if (madeReviewProgress) delete context["pr_review_supervisor_escalated_story_id"];

    if (!reviewRetryExhausted) {
      const loopStep = await findLoopStep(verifyStep.run_id);
      const loopConfig = parseLoopConfigSafe(loopStep?.loop_config || "", verifyStep.run_id);
      const superviseStepName = loopConfig?.superviseStep || "supervise";
      await publishVerifyRetryToImplement({
        verifyStep,
        retryStoryId: retryStory.id,
        retryCount: storyRetryForReview,
        failure,
        retryStoryBranch,
        context,
        loopStepId: loopStep?.id,
        superviseStepName,
        category: options.category || "VERIFY_SCOPE_FAILURE",
      });
      emitEvent({ ts: now(), event: "story.retry", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId, detail: failure });
      return;
    }

    const terminalRetry = Math.max(0, retryStory.max_retries);
    if (context["pr_review_supervisor_escalated_story_id"] === storyId) {
      const terminalFailure = [
        `PR_REVIEW_COMMENTS_MANUAL_REVIEW: ${storyId} exhausted developer retries and one supervisor escalation, but actionable PR review comments remain.`,
        failure,
      ].join("\n");
      context["verify_feedback"] = terminalFailure;
      context["previous_failure"] = terminalFailure;
      context["failure_category"] = "PR_REVIEW_COMMENTS_OPEN";
      context["failure_suggestion"] = "Manual review required: developer retries and supervisor escalation did not clear actionable PR review comments.";
      context["current_story_id"] = storyId;
      await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, terminalFailure, now(), retryStory.id]);
      await updateRunContext(verifyStep.run_id, context);
      const loopStep = await findLoopStep(verifyStep.run_id);
      if (loopStep?.id) await setStepStatus(loopStep.id, "failed");
      await failRun(verifyStep.run_id, true);
      scheduleRunCronTeardown(verifyStep.run_id);
      logger.warn(`[verify-pr-comments] ${storyId} review retry budget and supervisor escalation exhausted; failing for manual review`, { runId: verifyStep.run_id });
      return;
    }
    const loopStep = await findLoopStep(verifyStep.run_id);
    const loopConfig = parseLoopConfigSafe(loopStep?.loop_config || "", verifyStep.run_id);
    const superviseStepName = loopConfig?.superviseStep || "supervise";
    context["verify_feedback"] = failure;
    context["previous_failure"] = failure;
    context["failure_category"] = "PR_REVIEW_COMMENTS_OPEN";
    context["failure_suggestion"] = "Developer PR review retries are exhausted. Escalate this actionable PR review feedback to the story supervisor for a scoped manager-owned fix; do not fail the run until supervisor has audited or patched the story.";
    context["current_story_id"] = storyId;
    context["supervisor_scope"] = "story";
    context["pr_review_supervisor_escalated_story_id"] = storyId;
    clearStorySupervised(context, storyId);
    await pgRun("UPDATE stories SET status = 'done', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), retryStory.id]);
    if (loopStep?.id) await setStepStatus(loopStep.id, "running");
    await pgRun(
      "UPDATE steps SET status = 'pending', current_story_id = $1, updated_at = $2 WHERE run_id = $3 AND step_id = $4 AND status IN ('waiting','done','pending','failed')",
      [retryStory.id, now(), verifyStep.run_id, superviseStepName],
    );
    await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), verifyStep.id]);
    await updateRunContext(verifyStep.run_id, context);
    emitEvent({ ts: now(), event: "story.retry", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: superviseStepName, storyId, detail: "PR review retry budget exhausted; escalated to supervisor" });
    logger.warn(`[verify-pr-comments] ${storyId} review retry budget exhausted; escalated to ${superviseStepName}`, { runId: verifyStep.run_id });
    return;
  }

  if (newRetry > retryStory.max_retries) {
    const terminalRetry = Math.max(0, retryStory.max_retries);
    await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), retryStory.id]);
    await updateRunContext(verifyStep.run_id, context);
    const loopStep = await findLoopStep(verifyStep.run_id);
    if (loopStep?.id) await setStepStatus(loopStep.id, "failed");
    await failRun(verifyStep.run_id, true);
    scheduleRunCronTeardown(verifyStep.run_id);
    return;
  }

  const loopStep = await findLoopStep(verifyStep.run_id);
  const loopConfig = parseLoopConfigSafe(loopStep?.loop_config || "", verifyStep.run_id);
  const superviseStepName = loopConfig?.superviseStep || "supervise";
  await publishVerifyRetryToImplement({
    verifyStep,
    retryStoryId: retryStory.id,
    retryCount: newRetry,
    failure,
    retryStoryBranch,
    context,
    loopStepId: loopStep?.id,
    superviseStepName,
    category: options.category || "VERIFY_SCOPE_FAILURE",
  });
  emitEvent({ ts: now(), event: "story.retry", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId, detail: failure });
}

function getImplicitScopeFiles(workdir: string): string[] {
  void workdir;
  return [...new Set(IMPLICIT_STORY_SCOPE_FILES)];
}

function isSystemSmokeBoundaryFile(file: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  return (
    /^src\/screens\//.test(normalized) ||
    /^src\/app\//.test(normalized) ||
    /^src\/pages\//.test(normalized) ||
    /^app\//.test(normalized) ||
    /^pages\//.test(normalized) ||
    /^src\/App\.(tsx?|jsx?)$/.test(normalized) ||
    /^src\/main\.(tsx?|jsx?)$/.test(normalized) ||
    /^src\/index\.(tsx?|jsx?|css)$/.test(normalized)
  );
}

function ownsSystemSmokeBoundary(row: Pick<StorySmokeRow, "scope_files">): boolean {
  return parseScopeFileList(row.scope_files).some(isSystemSmokeBoundaryFile);
}

export function decideStorySystemSmokeGate(storyId: string, rows: StorySmokeRow[]): StorySmokeDecision {
  const current = rows.find(row => row.story_id === storyId);
  if (!current) {
    return { run: true, reason: `story ${storyId} not found; running smoke gate conservatively` };
  }

  const laterUiStory = rows.find(row =>
    row.story_index > current.story_index &&
    !["verified", "skipped", "failed"].includes(row.status) &&
    ownsSystemSmokeBoundary(row)
  );
  if (laterUiStory) {
    return {
      run: false,
      reason: `deferred until later UI/integration story ${laterUiStory.story_id}`,
    };
  }

  if (!ownsSystemSmokeBoundary(current)) {
    return {
      run: false,
      reason: `${storyId} owns no route/screen/entry files`,
    };
  }

  return { run: true, reason: `${storyId} is the last pending UI/integration boundary` };
}

async function shouldRunStorySystemSmokeGate(runId: string, storyId: string): Promise<StorySmokeDecision> {
  const rows = await pgQuery<StorySmokeRow>(
    "SELECT story_id, story_index, status, scope_files FROM stories WHERE run_id = $1 ORDER BY story_index ASC",
    [runId],
  );
  return decideStorySystemSmokeGate(storyId, rows);
}

function qualityFailureFingerprint(failure: string): string {
  const normalized = failure
    .replace(/QA-FIX-\d+/gi, "QA-FIX")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<uuid>")
    .replace(/#[0-9]+/g, "#<n>")
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, "<time>")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 3000);
  return crypto.createHash("sha1").update(normalized).digest("hex");
}

function postMergeRepairMaxRetries(currentRetryCount: number, maxRetries: number, matchingRetryCount: number): number {
  const current = Math.max(0, Number(currentRetryCount || 0));
  const configuredMax = Math.max(0, Number(maxRetries || 0));
  const matching = Math.max(1, Number(matchingRetryCount || 1));
  const remainingPostMergeAttempts = Math.max(0, QA_FIX_REPEAT_LIMIT - matching + 1);
  return Math.max(configuredMax, current + remainingPostMergeAttempts);
}

function runSystemSmokeGate(repoPath: string, runId: string, stepId: string): { ok: boolean; output: string; failure: string; infraFailure: boolean } {
  const smokeScript = resolvePlatformScript("smoke-test.mjs");
  if (!repoPath || !fs.existsSync(repoPath) || !fs.existsSync(smokeScript)) {
    return { ok: true, output: "skip (smoke script or repo missing)", failure: "", infraFailure: false };
  }

  try {
    const buildFresh = ensureSmokeBuildFresh(repoPath, {
      runId,
      stepId,
      buildCommand: "npm run build",
      logPrefix: "system-smoke-prebuild",
    });
    if (!buildFresh.ok) {
      return { ok: false, output: "", failure: buildFresh.failure, infraFailure: false };
    }
    logger.info(`[system-smoke-gate] Running smoke-test.mjs`, { runId, stepId });
    const output = execFileSync("node", [smokeScript, repoPath], {
      cwd: repoPath,
      timeout: 240_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return { ok: true, output: output.slice(-2000) || "pass (system smoke gate)", failure: "", infraFailure: false };
  } catch (err) {
    const failure = formatExecFailure(err, 6000);
    return { ok: false, output: "", failure, infraFailure: isSmokeInfrastructureFailure(failure) };
  }
}

function runPostMergeBuildGate(
  repoPath: string,
  buildCmd: string,
  runId: string,
  stepId: string,
): { ok: boolean; output: string; failure: string } {
  const command = String(buildCmd || "npm run build").trim();
  if (!repoPath || !fs.existsSync(repoPath) || !command || command === "true") {
    return { ok: true, output: "skip (build command unavailable)", failure: "" };
  }

  try {
    logger.info(`[verify-build-gate] Running ${command}`, { runId, stepId });
    const output = execFileSync("sh", ["-lc", command], {
      cwd: repoPath,
      timeout: 240_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: process.env.CI || "1",
      },
    }).trim();
    return { ok: true, output: output.slice(-2000) || `pass (${command})`, failure: "" };
  } catch (err) {
    return { ok: false, output: "", failure: formatExecFailure(err, 6000) };
  }
}

async function confirmFailedSystemSmokeGate(
  repoPath: string,
  runId: string,
  stepId: string,
  context: Record<string, string>,
  logPrefix: string,
  firstFailure: string,
): Promise<{ ok: boolean; output: string; failure: string; infraFailure: boolean }> {
  logger.warn(`[${logPrefix}] Smoke failed; re-running once before routing to QA-FIX: ${firstFailure.slice(0, 200)}`, { runId });
  syncBaseBranch(repoPath, "main");
  const confirmGate = runSystemSmokeGate(repoPath, runId, `${stepId}-confirm`);
  if (confirmGate.ok) {
    context["smoke_test_result"] = `pass after confirm rerun (first smoke failure treated as transient)\n${confirmGate.output}`;
    delete context["previous_failure"];
    delete context["failure_category"];
    await updateRunContext(runId, context);
    logger.warn(`[${logPrefix}] Smoke failure did not reproduce; suppressing QA-FIX route`, { runId });
  }
  return confirmGate;
}

async function ensureSystemSmokeBeforeAutoVerify(
  runId: string,
  context: Record<string, string>,
  logPrefix: string,
  story: { story_id: string },
): Promise<boolean> {
  const repoPath = context["repo"] || context["REPO"] || "";
  if (!repoPath) return true;

  syncBaseBranch(repoPath, "main");
  const buildGate = runPostMergeBuildGate(repoPath, context["build_cmd"] || "npm run build", runId, "verify");
  if (!buildGate.ok) {
    const failure = `BUILD_FAILED: Post-merge build failed for ${story.story_id} on current main.\n${buildGate.failure}`;
    context["previous_failure"] = failure;
    context["current_story_id"] = story.story_id;
    context["failure_category"] = "BUILD_FAILED";
    context["failure_suggestion"] = "Fix the merged main build before auto-verifying the story. Route the failure through the same quality-fix path instead of accepting final supervision.";
    await updateRunContext(runId, context);
    logger.warn(`[${logPrefix}-build-gate] Build failed; blocked auto-verify for ${story.story_id}: ${buildGate.failure.slice(0, 200)}`, { runId });
    return false;
  }

  const decision = await shouldRunStorySystemSmokeGate(runId, story.story_id);
  if (!decision.run) {
    context["smoke_test_result"] = `deferred for ${story.story_id}: ${decision.reason}`;
    await updateRunContext(runId, context);
    logger.info(`[${logPrefix}-smoke-gate] Deferred system smoke for ${story.story_id}: ${decision.reason}`, { runId });
    return true;
  }

  const smokeGate = runSystemSmokeGate(repoPath, runId, "verify");
  if (smokeGate.ok) {
    context["smoke_test_result"] = smokeGate.output;
    await updateRunContext(runId, context);
    return true;
  }

  let failure = smokeGate.failure || "unknown smoke-test failure";

  if (smokeGate.infraFailure) {
    context["previous_failure"] = `VERIFY_SYSTEM_SMOKE_FAILURE for ${story.story_id}:\n${failure}`;
    context["current_story_id"] = story.story_id;
    context["failure_category"] = "SMOKE_INFRA_FAILURE";
    await updateRunContext(runId, context);
    logger.warn(`[${logPrefix}-smoke-gate] Infra failure; not auto-verifying ${story.story_id}: ${failure.slice(0, 200)}`, { runId });
    return false;
  }

  const confirmGate = await confirmFailedSystemSmokeGate(repoPath, runId, "verify", context, `${logPrefix}-smoke-gate`, failure);
  if (confirmGate.ok) return true;
  failure = confirmGate.failure || failure;

  context["previous_failure"] = `VERIFY_SYSTEM_SMOKE_FAILURE for ${story.story_id}:\n${failure}`;
  context["current_story_id"] = story.story_id;
  context["failure_category"] = confirmGate.infraFailure ? "SMOKE_INFRA_FAILURE" : "VERIFY_SYSTEM_SMOKE_FAILURE";
  await updateRunContext(runId, context);

  logger.warn(`[${logPrefix}-smoke-gate] Smoke failed; blocked auto-verify for ${story.story_id}: ${failure.slice(0, 200)}`, { runId });
  return false;
}

function collectQaFixScopeFiles(repoPath: string): string[] {
  const srcDir = path.join(repoPath, "src");
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(repoPath, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!QA_FIX_IGNORE.test(rel + "/")) walk(abs);
        continue;
      }
      if (QA_FIX_SOURCE_EXT.test(rel) && !QA_FIX_IGNORE.test(rel)) out.push(rel);
    }
  };
  if (fs.existsSync(srcDir)) walk(srcDir);
  return [...new Set(out)].sort();
}

function qualityFixAcceptanceCriteria(failure: string): string[] {
  const issueCriteria = failure
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s*(CRITICAL|WARNING|ERROR|FAIL|BLOCKER)\b/i.test(line))
    .slice(0, 12)
    .map((line) => `Resolve reported issue: ${line.replace(/^-\s*/, "")}`);
  return [
    "All reported QA/final-test failures are fixed in the rendered app.",
    "npm run build passes on current main.",
    "Platform smoke-test passes without blank page, dead button, console, network, or layout failures.",
    "No unrelated toolchain/config churn is introduced.",
    ...issueCriteria,
  ];
}

async function resolveQualityFailureStoryId(runId: string, context: Record<string, string>, failure: string): Promise<string> {
  const explicit = String(context["current_story_id"] || "").trim();
  if (explicit) return explicit;

  const reportedStoryIds = [...new Set((failure.match(/\b(?:US|QA-FIX)-\d{3}\b/g) || []).map((id) => id.trim()))];
  for (const storyId of reportedStoryIds) {
    const row = await pgGet<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status IN ('pending','running','done','verified','skipped') LIMIT 1",
      [runId, storyId],
    );
    if (row?.story_id) return row.story_id;
  }

  const latest = await pgGet<{ story_id: string }>(
    "SELECT story_id FROM stories WHERE run_id = $1 AND story_id NOT LIKE 'QA-FIX-%' AND status IN ('pending','running','done','verified','skipped') ORDER BY story_index DESC LIMIT 1",
    [runId],
  );
  return latest?.story_id || "";
}

async function closeRoutedQualityClaimInTransaction(
  sql: postgres.TransactionSql,
  step: { id: string; run_id: string; step_id: string },
  diagnostic: string,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<void> {
  if (claimEnvelope) {
    await closeExactSingleStepClaimInTransaction(sql, {
      envelope: claimEnvelope,
      outcome: "completed",
      diagnostic,
    });
    return;
  }

  await closeLegacyClaimOwnersInTransaction(sql, {
    runId: step.run_id,
    workflowStepId: step.step_id,
    storyId: null,
    diagnostic,
  });
}

export async function closeLegacyClaimOwnersInTransaction(
  sql: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    workflowStepId: string;
    storyId: string | null;
    diagnostic: string;
  }>,
): Promise<void> {
  const owners = await sql.unsafe<Array<{ id: string }>>(
    `SELECT cl.id::text AS id
       FROM claim_log cl
       JOIN runs r ON r.id = cl.run_id
      WHERE r.protocol = 'legacy'
        AND cl.run_id = $1
        AND cl.step_id = $2
        AND cl.story_id IS NOT DISTINCT FROM $3::text
        AND cl.outcome IS NULL
      ORDER BY cl.id
      FOR UPDATE OF cl`,
    [input.runId, input.workflowStepId, input.storyId],
  );
  for (const owner of owners) {
    const closed = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE claim_log
          SET outcome = 'completed',
              duration_ms = LEAST(
                CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS BIGINT),
                2147483647
              )::INTEGER,
              diagnostic = $2
        WHERE id = $1::bigint AND outcome IS NULL
        RETURNING id::text AS id`,
      [owner.id, input.diagnostic.slice(0, 1_000)],
    );
    if (closed.length !== 1) throw new Error("LEGACY_CLAIM_TERMINAL_CAS_LOST");
    await closeInternalProductionClaimOwnerAfterTerminalMutationV1(sql, closed[0]!.id);
  }
}

async function markRoutedQualityOwnerCommittedInTransaction(
  sql: postgres.TransactionSql,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<void> {
  if (!claimEnvelope) return;
  await markRuntimeCompletionOwnerCommittedInTransaction(sql, {
    claimId: claimEnvelope.claimId,
    claimOutcome: "completed",
    plan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "quality_route",
      continuation: { type: "quality_route_finalize" },
      effectPayload: { workflowStepId: claimEnvelope.workflowStepId },
    }),
  });
}

function resolveV3DownstreamSourceContext(context: Record<string, string>): Readonly<{
  worktree: string;
  branch: string;
}> {
  const worktree = String(context["repo"] || "").trim();
  if (!worktree) throw new Error("V3_DOWNSTREAM_EVIDENCE_WORKTREE_REQUIRED");
  let branch = String(context["branch"] || "").trim();
  if (!branch) {
    try {
      branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: worktree,
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      throw new Error("V3_DOWNSTREAM_EVIDENCE_BRANCH_REQUIRED");
    }
  }
  if (!branch || branch === "HEAD") throw new Error("V3_DOWNSTREAM_EVIDENCE_BRANCH_REQUIRED");
  return { worktree, branch };
}

export async function routeQualityFailureToImplement(
  step: { id: string; run_id: string; step_id: string; step_index: number; agent_id: string },
  output: string,
  context: Record<string, string>,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<boolean> {
  const isVerifySystemSmokeFailure = step.step_id === "verify" && output.startsWith("SYSTEM_SMOKE_FAILURE:");
  const isVerifyRetryFailure = step.step_id === "verify" && isVerifyRetryQualityFailure(output);
  if (!QUALITY_FIX_STEPS.has(step.step_id) && !isVerifySystemSmokeFailure && !isVerifyRetryFailure) return false;

  // Protocol v3 never interprets downstream agent prose, expands a story's
  // scope, or creates a QA-FIX story. Recompile every sealed StoryPlan slice
  // against the exact integrated tree, publish canonical bundle/findings, and
  // route only a durable typed recovery dispatch. Legacy/shadow remains below.
  if (
    claimEnvelope?.protocol === "v3"
    && (step.step_id === "qa-test" || step.step_id === "final-test")
  ) {
    const { worktree, branch } = resolveV3DownstreamSourceContext(context);
    const route = await createPostgresV3DownstreamEvidenceRouter(getSql()).route({
      runId: step.run_id,
      stepDbId: step.id,
      workflowStepId: step.step_id,
      phase: step.step_id === "qa-test" ? "qa" : "final",
      parentClaimId: claimEnvelope.claimId,
      worktree,
      branch,
    });
    const committed = await commitV3DownstreamEvidenceDecision(getSql(), {
      envelope: claimEnvelope,
      route,
    });
    await recordStepTransition(
      step.id,
      step.run_id,
      "running",
      committed.decision.outcome === "recovery_routed" ? "waiting" : "failed",
      step.agent_id,
      "v3DownstreamEvidence:canonicalDecision",
      {
        routeHash: committed.decision.routeHash,
        outcome: committed.decision.outcome,
        routedStoryIds: committed.decision.recoveryRoutes.map((item) => item.storyId),
      },
    );
    logger.warn(
      `[v3-downstream] ${step.step_id} canonical decision ${committed.decision.outcome} (${committed.decision.routeHash})`,
      { runId: step.run_id },
    );
    return true;
  }

  const loopStep = await pgGet<{ id: string; step_index: number; status: string; loop_config: string | null }>(
    "SELECT id, step_index, status, loop_config FROM steps WHERE run_id = $1 AND step_id = 'implement' AND type = 'loop' LIMIT 1",
    [step.run_id],
  );
  if (!loopStep) return false;

  let loopConfig: Partial<LoopConfig> = {};
  try { loopConfig = JSON.parse(loopStep.loop_config || "{}"); } catch {}
  if (loopConfig.over && loopConfig.over !== "stories") return false;

  const failure = output.slice(0, 6000);
  if (isVerifyRetryFailure && isVerifyRetryMergeBlocker(output)) {
    const reason = [
      "VERIFY_MERGE_BLOCKER:",
      "Verify reported an unmergeable PR state (CONFLICTING/DIRTY/BLOCKED, merge conflicts, or conflict markers).",
      "This is not a downstream app-quality defect, so Setfarm will not create another QA-FIX story.",
      "Resolve the story/PR branch merge conflict or restart with a clean branch set before continuing.",
      "",
      "Failure report:",
      failure.slice(0, 3000),
    ].join("\n");
    context["previous_failure"] = reason;
    context["failure_category"] = "VERIFY_MERGE_BLOCKER";
    context["failure_suggestion"] = "Resolve the conflicting PR/story branch state; do not route this to QA-FIX.";
    await updateRunContext(step.run_id, context);
    await failRun(step.run_id, true, reason);
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason.slice(0, 500) });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "VERIFY_MERGE_BLOCKER" });
    logger.error(`[quality-fix] Verify merge blocker detected for ${step.step_id}; refusing QA-FIX routing`, { runId: step.run_id });
    return true;
  }

  const fingerprint = qualityFailureFingerprint(failure);
  const priorFingerprint = context["quality_failure_fingerprint"] || "";
  const repeatCount = priorFingerprint === fingerprint
    ? (parseInt(context["quality_failure_repeat_count"] || "0", 10) || 0) + 1
    : 1;
  context["quality_failure_fingerprint"] = fingerprint;
  context["quality_failure_repeat_count"] = String(repeatCount);

  const existingActiveFix = await pgGet<{ id: string; story_id: string }>(
    "SELECT id, story_id FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending','running') ORDER BY story_index DESC LIMIT 1",
    [step.run_id],
  );

  const existingFixCount = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*)::text as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%'",
    [step.run_id],
  );
  const existingFixCountNum = parseInt(existingFixCount?.cnt || "0", 10) || 0;
  const qualityRouteStoryId = await resolveQualityFailureStoryId(step.run_id, context, failure);

  const routeDecision = routeDownstreamQualityFailure({
    runId: step.run_id,
    stepId: step.step_id,
    failure,
    stackPackId: context["stack_pack_id"] || context["detected_stack"] || "",
    currentStoryId: qualityRouteStoryId,
    hasMachineEvidence: /\b(smoke|screenshot|QA_JSON|FINAL_TEST|IMPLEMENT_EVIDENCE|runtime|browser|interaction)\b/i.test(failure),
    existingRepairCount: existingFixCountNum,
    repeatedFailureCount: repeatCount,
  });
  context["failure_route_action"] = routeDecision.action;
  context["failure_route_category"] = routeDecision.category;
  context["failure_route_policy"] = routeDecision.policy;
  context["failure_route_reason"] = routeDecision.reason;

  if (!routeDecision.qaFixAllowed) {
    if (routeDecision.action === "infra_retry") {
      const reason = [
        "SETFARM_INFRA_RETRY:",
        routeDecision.reason,
        `Failure category: ${routeDecision.category}`,
        "",
        "Failure report:",
        failure.slice(0, 3000),
      ].join("\n");
      context["previous_failure"] = reason;
      context["failure_category"] = routeDecision.category;
      context["failure_suggestion"] = "Retry platform/tooling infrastructure for this stack; do not consume product story retry budget.";
      await updateRunContext(step.run_id, context);
      await failStep(step.id, reason, claimEnvelope);
      return true;
    }

    if (routeDecision.action === "re_claim") {
      const routed = await routeOriginalStoryQualityFailureToImplement(
        step,
        context,
        qualityRouteStoryId,
        failure,
        routeDecision.category,
        routeDecision.reason,
        claimEnvelope,
      );
      if (routed) return true;
    }

    const reason = [
      "QUALITY_FAILURE_ROUTER_BLOCKED_QA_FIX:",
      routeDecision.reason,
      `Route action: ${routeDecision.action}`,
      `Failure category: ${routeDecision.category}`,
      "",
      "Failure report:",
      failure.slice(0, 3000),
    ].join("\n");
    context["previous_failure"] = reason;
    context["failure_category"] = routeDecision.category;
    context["failure_suggestion"] = routeDecision.action === "re_claim"
      ? "Retry the original implementation story with orchestrator-owned evidence instead of creating QA-FIX."
      : "Treat this as a platform/setup failure and inspect Setfarm gates before retrying.";
    await updateRunContext(step.run_id, context);
    await failRun(step.run_id, true, reason);
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason.slice(0, 500) });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: routeDecision.category });
    logger.error(`[quality-router] Blocked QA-FIX routing for ${step.step_id}: ${routeDecision.category}: ${routeDecision.reason}`, { runId: step.run_id });
    return true;
  }

  if (!existingActiveFix && (existingFixCountNum >= QA_FIX_MAX_STORIES || repeatCount > QA_FIX_REPEAT_LIMIT)) {
    const reason = [
      "QUALITY_FIX_LOOP_GUARD:",
      `Refusing to create another QA-FIX story after ${existingFixCountNum} existing QA-FIX stories and ${repeatCount} repeated matching failure(s).`,
      "The pipeline is cycling on downstream quality failures. Stop the run and inspect the root cause instead of generating more repair stories.",
      "",
      "Failure report:",
      failure.slice(0, 3000),
    ].join("\n");
    context["previous_failure"] = reason;
    context["failure_category"] = "QUALITY_FIX_LOOP_GUARD";
    context["failure_suggestion"] = "Inspect the app and Setfarm guards; do not create another QA-FIX story for this same failure.";
    await updateRunContext(step.run_id, context);
    await failRun(step.run_id, true, reason);
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason.slice(0, 500) });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "QUALITY_FIX_LOOP_GUARD" });
    logger.error(`[quality-fix] Loop guard tripped for ${step.step_id}; refusing more QA-FIX stories`, { runId: step.run_id });
    return true;
  }

  const repoPath = context["repo"] || context["REPO"] || "";
  let scopeFiles = repoPath ? collectQaFixScopeFiles(repoPath) : [];
  if (scopeFiles.length === 0) {
    const scopeRows = await pgQuery<{ scope_files: string | null }>(
      "SELECT scope_files FROM stories WHERE run_id = $1 AND scope_files IS NOT NULL ORDER BY story_index",
      [step.run_id],
    );
    const fromStories: string[] = [];
    for (const row of scopeRows) {
      try {
        const parsed = JSON.parse(row.scope_files || "[]");
        if (Array.isArray(parsed)) fromStories.push(...parsed.filter((f: any) => typeof f === "string"));
      } catch {}
    }
    scopeFiles = [...new Set(fromStories)].sort();
  }

  const priorStories = await pgQuery<{ story_id: string }>(
    "SELECT story_id FROM stories WHERE run_id = $1 AND status IN ('done','verified','skipped') ORDER BY story_index",
    [step.run_id],
  );
  const dependsOn = priorStories.map((s) => s.story_id).filter(Boolean);
  const title = `QA fix — ${step.step_id} runtime failures`;
  const description = [
    `Downstream ${step.step_id} found runtime/acceptance failures after story PRs were merged.`,
    "Fix only the reported failures on current main. Do not add unrelated features or redesign the app.",
    "Run npm run build and the platform smoke test before reporting STATUS: done.",
    "",
    "Failure report:",
    failure,
  ].join("\n");
  const acceptance = qualityFixAcceptanceCriteria(failure);
  const scopeDescription = `QA/final fix scope derived from existing source files after ${step.step_id} failure.`;

  let fixStoryId = existingActiveFix?.story_id || "";
  if (!existingActiveFix) {
    const nextMeta = await pgGet<{ cnt: string; max_idx: number | null }>(
      "SELECT COUNT(*)::text as cnt, MAX(story_index) as max_idx FROM stories WHERE run_id = $1",
      [step.run_id],
    );
    const n = existingFixCountNum + 1;
    fixStoryId = `QA-FIX-${String(n).padStart(3, "0")}`;
    const storyIndex = (nextMeta?.max_idx ?? -1) + 1;
    const insertedFix = await pgGet<{ id: string; story_id: string }>(
      `INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, depends_on, scope_files, shared_files, scope_description, created_at, updated_at, output, quality_failure_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 4, $8, $9, $10, $11, $12, $12, $13, $14)
       ON CONFLICT (run_id, story_id) WHERE status IN ('pending', 'running')
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         acceptance_criteria = EXCLUDED.acceptance_criteria,
         output = EXCLUDED.output,
         depends_on = COALESCE(stories.depends_on, EXCLUDED.depends_on),
         scope_files = COALESCE(stories.scope_files, EXCLUDED.scope_files),
         shared_files = COALESCE(stories.shared_files, EXCLUDED.shared_files),
         scope_description = EXCLUDED.scope_description,
         quality_failure_fingerprint = EXCLUDED.quality_failure_fingerprint,
         updated_at = EXCLUDED.updated_at
       RETURNING id, story_id`,
      [
        crypto.randomUUID(),
        step.run_id,
        storyIndex,
        fixStoryId,
        title,
        description,
        JSON.stringify(acceptance),
        dependsOn.length > 0 ? JSON.stringify(dependsOn) : null,
        scopeFiles.length > 0 ? JSON.stringify(scopeFiles) : null,
        scopeFiles.length > 0 ? JSON.stringify(scopeFiles) : null,
        scopeDescription,
        now(),
        failure,
        fingerprint,
      ],
    );
    if (insertedFix?.story_id) fixStoryId = insertedFix.story_id;
  } else {
    await pgRun(
      `UPDATE stories
       SET title = $1,
           description = $2,
           acceptance_criteria = $3,
           output = $4,
           depends_on = COALESCE(depends_on, $5),
           scope_files = COALESCE(scope_files, $6),
           shared_files = COALESCE(shared_files, $7),
           scope_description = $8,
           quality_failure_fingerprint = $9,
           updated_at = $10
       WHERE id = $11`,
      [
        title,
        description,
        JSON.stringify(acceptance),
        failure,
        dependsOn.length > 0 ? JSON.stringify(dependsOn) : null,
        scopeFiles.length > 0 ? JSON.stringify(scopeFiles) : null,
        scopeFiles.length > 0 ? JSON.stringify(scopeFiles) : null,
        scopeDescription,
        fingerprint,
        now(),
        existingActiveFix.id,
      ],
    );
  }

  delete context["status"];
  context["previous_failure"] = `DOWNSTREAM_QUALITY_FAILURE from ${step.step_id}:\n${failure}`;
  context["failure_category"] = "DOWNSTREAM_QUALITY_FAILURE";
  context["failure_suggestion"] = "Return to implement, fix the generated QA-FIX story on current main, then let verify/security/QA/final/deploy rerun.";
  context["current_story_id"] = fixStoryId;
  await updateRunContext(step.run_id, context);

  await pgBegin(async (sql) => {
    await closeRoutedQualityClaimInTransaction(
      sql,
      step,
      `quality failure routed to ${fixStoryId}`,
      claimEnvelope,
    );
    await sql.unsafe(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
      [now(), loopStep.id],
    );
    await sql.unsafe(
      "UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_index > $3",
      [now(), step.run_id, loopStep.step_index],
    );
    await markRoutedQualityOwnerCommittedInTransaction(sql, claimEnvelope);
  });

  await recordStepTransition(loopStep.id, step.run_id, loopStep.status, "pending", undefined, "qualityFailure:routeToImplement", { storyId: fixStoryId, fromStep: step.step_id });
  await recordStepTransition(step.id, step.run_id, "running", "waiting", step.agent_id, "qualityFailure:routeToImplement", { storyId: fixStoryId });
  const wfId = await _getWorkflowId(step.run_id);
  emitEvent({ ts: now(), event: "story.retry", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: fixStoryId, detail: `Created ${fixStoryId} from ${step.step_id} failure` });
  emitEvent({ ts: now(), event: "step.pending", runId: step.run_id, workflowId: wfId, stepId: "implement", detail: `Downstream quality failure routed to ${fixStoryId}` });
  logger.warn(`[quality-fix] Routed ${step.step_id} failure back to implement via ${fixStoryId}`, { runId: step.run_id });
  return true;
}

async function routeOriginalStoryQualityFailureToImplement(
  step: { id: string; run_id: string; step_id: string; step_index: number; agent_id: string },
  context: Record<string, string>,
  storyId: string,
  failure: string,
  category: string,
  routeReason: string,
  claimEnvelope?: ClaimEnvelopeV1,
): Promise<boolean> {
  const normalizedStoryId = String(storyId || "").trim();
  if (!normalizedStoryId) return false;

  const retryStory = await pgGet<{ id: string; story_id: string; title: string | null; status: string; retry_count: number; max_retries: number; story_branch: string | null; pr_url: string | null; scope_files: string | null }>(
    "SELECT id, story_id, title, status, retry_count, max_retries, story_branch, pr_url, scope_files FROM stories WHERE run_id = $1 AND story_id = $2 AND status IN ('pending','running','done','verified','skipped') LIMIT 1",
    [step.run_id, normalizedStoryId],
  );
  if (!retryStory) return false;

  const loopStep = await pgGet<{ id: string; step_index: number; status: string }>(
    "SELECT id, step_index, status FROM steps WHERE run_id = $1 AND step_id = 'implement' AND type = 'loop' LIMIT 1",
    [step.run_id],
  );
  if (!loopStep) return false;

  const retryFailure = [
    `DOWNSTREAM_QUALITY_FAILURE from ${step.step_id}:`,
    routeReason,
    "",
    failure,
  ].join("\n").slice(0, 12000);
  const newRetry = (retryStory.retry_count || 0) + 1;

  context["previous_failure"] = retryFailure;
  context["failure_category"] = category || "DOWNSTREAM_QUALITY_FAILURE";
  context["failure_suggestion"] = "Retry the original implementation story with orchestrator-owned evidence. Do not create a QA-FIX story.";
  context["current_story_id"] = retryStory.story_id;
  context["current_story_title"] = retryStory.title || "";
  delete context["status"];

  const repairScope = mergeScopeFilesJson(retryStory.scope_files, extractQualityFailureScopeFiles(failure));
  if (repairScope.files.length > 0) {
    context["story_scope_files"] = repairScope.files.join(", ");
  }
  if (repairScope.added.length > 0) {
    context["failure_suggestion"] =
      `Retry the original implementation story with downstream repair scope expanded to: ${repairScope.added.join(", ")}. Do not create a QA-FIX story.`;
  }

  if (retryStory.pr_url && getPRState(retryStory.pr_url) === "MERGED") {
    const matchingQualityRetry = Math.max(1, parseInt(context["quality_failure_repeat_count"] || "1", 10) || 1);
    if (matchingQualityRetry > QA_FIX_REPEAT_LIMIT) {
      const terminalRetry = Math.max(0, retryStory.max_retries || 0);
      const exhaustedRetryFailure = [
        "POST_MERGE_QUALITY_REGRESSION_RETRY_EXHAUSTED:",
        `${retryStory.story_id} PR is already MERGED and matching current-main repair retries are exhausted (${QA_FIX_REPEAT_LIMIT}/${QA_FIX_REPEAT_LIMIT}).`,
        `Story retry count is ${retryStory.retry_count}/${retryStory.max_retries}; post-merge quality repair budget is tracked by matching failure fingerprint so infra/model retries do not consume it.`,
        routeReason,
        "",
        "Failure report:",
        failure.slice(0, 3000),
      ].join("\n");
      await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, exhaustedRetryFailure, now(), retryStory.id]);
      context["previous_failure"] = exhaustedRetryFailure;
      context["failure_category"] = "POST_MERGE_QUALITY_REGRESSION";
      context["failure_suggestion"] = "Post-merge main repair retry budget is exhausted.";
      context["post_merge_quality_regression_story_id"] = retryStory.story_id;
      context["post_merge_quality_regression_pr_url"] = retryStory.pr_url;
      await updateRunContext(step.run_id, context);
      await setStepStatus(loopStep.id, "failed");
      await failRun(step.run_id, true, exhaustedRetryFailure);
      scheduleRunCronTeardown(step.run_id);
      const wfId = await _getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: retryStory.story_id, detail: exhaustedRetryFailure.slice(0, 500) });
      emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "POST_MERGE_QUALITY_REGRESSION_RETRY_EXHAUSTED" });
      logger.error(`[quality-router] Post-merge story retry exhausted for ${retryStory.story_id} after ${step.step_id} failure`, { runId: step.run_id });
      return true;
    }

    const mergedRetryFailure = [
      "POST_MERGE_QUALITY_REGRESSION:",
      `${retryStory.story_id} PR is already MERGED; retry on current main with a fresh story branch instead of reopening the merged branch.`,
      routeReason,
      "",
      "Failure report:",
      failure.slice(0, 3000),
    ].join("\n");
    context["previous_failure"] = mergedRetryFailure;
    context["failure_category"] = "POST_MERGE_QUALITY_REGRESSION";
    context["failure_suggestion"] = "Retry the original story on current main with a fresh branch; do not reopen the already merged PR branch.";
    context["post_merge_quality_regression_story_id"] = retryStory.story_id;
    context["post_merge_quality_regression_pr_url"] = retryStory.pr_url;
    context["post_merge_quality_repair_budget"] = `${matchingQualityRetry}/${QA_FIX_REPEAT_LIMIT}`;
    delete context["story_branch"];
    const postMergeMaxRetries = postMergeRepairMaxRetries(retryStory.retry_count, retryStory.max_retries, matchingQualityRetry);
    await updateRunContext(step.run_id, context);
    await pgBegin(async (sql) => {
      await closeRoutedQualityClaimInTransaction(
        sql,
        step,
        `post-merge quality failure routed to original story ${retryStory.story_id} on current main`,
        claimEnvelope,
      );
      await sql.unsafe(
        "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, story_branch = NULL, merge_status = NULL, scope_files = $3, resolved_scope_files = $3, updated_at = $4, max_retries = $6 WHERE id = $5",
        [newRetry, mergedRetryFailure, repairScope.json, now(), retryStory.id, postMergeMaxRetries],
      );
      await sql.unsafe(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
        [now(), loopStep.id],
      );
      await sql.unsafe(
        "UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_index > $3",
        [now(), step.run_id, loopStep.step_index],
      );
      await markRoutedQualityOwnerCommittedInTransaction(sql, claimEnvelope);
    });
    await recordStepTransition(loopStep.id, step.run_id, loopStep.status, "pending", undefined, "qualityFailure:routeMergedStoryMainRepair", { storyId: retryStory.story_id, fromStep: step.step_id });
    await recordStepTransition(step.id, step.run_id, "running", "waiting", step.agent_id, "qualityFailure:routeMergedStoryMainRepair", { storyId: retryStory.story_id });
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "story.retry", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: retryStory.story_id, detail: `Post-merge downstream ${step.step_id} failure routed to current-main story retry` });
    emitEvent({ ts: now(), event: "step.pending", runId: step.run_id, workflowId: wfId, stepId: "implement", detail: `Post-merge quality failure routed to original story ${retryStory.story_id} on current main` });
    logger.warn(`[quality-router] Routed post-merge ${step.step_id} failure back to original story ${retryStory.story_id} on current main`, { runId: step.run_id });
    return true;
  }

  if (retryStory.story_branch) context["story_branch"] = retryStory.story_branch;

  if (retryStory.status === "pending" || retryStory.status === "running") {
    await updateRunContext(step.run_id, context);
    await pgBegin(async (sql) => {
      await closeRoutedQualityClaimInTransaction(
        sql,
        step,
        `quality failure already routed to original story ${retryStory.story_id}`,
        claimEnvelope,
      );
      await sql.unsafe(
        "UPDATE steps SET status = 'waiting', current_story_id = NULL, updated_at = $1 WHERE id = $2",
        [now(), step.id],
      );
      await sql.unsafe(
        "UPDATE steps SET status = CASE WHEN status = 'waiting' THEN 'pending' ELSE status END, current_story_id = COALESCE(current_story_id, $1), updated_at = $2 WHERE id = $3",
        [retryStory.story_id, now(), loopStep.id],
      );
      await markRoutedQualityOwnerCommittedInTransaction(sql, claimEnvelope);
    });
    await recordStepTransition(step.id, step.run_id, "running", "waiting", step.agent_id, "qualityFailure:originalStoryAlreadyRouted", { storyId: retryStory.story_id, fromStep: step.step_id });
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "story.retry", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: retryStory.story_id, detail: `Duplicate downstream ${step.step_id} failure observed while original story was already ${retryStory.status}` });
    emitEvent({ ts: now(), event: "step.pending", runId: step.run_id, workflowId: wfId, stepId: "implement", detail: `Original story ${retryStory.story_id} already routed for downstream quality failure` });
    logger.warn(`[quality-router] Duplicate ${step.step_id} quality failure suppressed; original story ${retryStory.story_id} is already ${retryStory.status}`, { runId: step.run_id });
    return true;
  }

  if (newRetry > (retryStory.max_retries || 0)) {
    const terminalRetry = Math.max(0, retryStory.max_retries || 0);
    await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, retryFailure, now(), retryStory.id]);
    await updateRunContext(step.run_id, context);
    await setStepStatus(loopStep.id, "failed");
    await failRun(step.run_id, true, retryFailure);
    scheduleRunCronTeardown(step.run_id);
    const wfId = await _getWorkflowId(step.run_id);
    emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: retryStory.story_id, detail: retryFailure.slice(0, 500) });
    emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: category || "DOWNSTREAM_QUALITY_FAILURE" });
    logger.error(`[quality-router] Original story retry exhausted for ${retryStory.story_id} after ${step.step_id} failure`, { runId: step.run_id });
    return true;
  }

  await updateRunContext(step.run_id, context);
  await pgBegin(async (sql) => {
    await closeRoutedQualityClaimInTransaction(
      sql,
      step,
      `quality failure routed to original story ${retryStory.story_id}`,
      claimEnvelope,
    );
    await sql.unsafe(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, scope_files = $3, resolved_scope_files = $3, updated_at = $4 WHERE id = $5",
      [newRetry, retryFailure, repairScope.json, now(), retryStory.id],
    );
    await sql.unsafe(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
      [now(), loopStep.id],
    );
    await sql.unsafe(
      "UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_index > $3",
      [now(), step.run_id, loopStep.step_index],
    );
    await markRoutedQualityOwnerCommittedInTransaction(sql, claimEnvelope);
  });

  await recordStepTransition(loopStep.id, step.run_id, loopStep.status, "pending", undefined, "qualityFailure:routeOriginalStory", { storyId: retryStory.story_id, fromStep: step.step_id });
  await recordStepTransition(step.id, step.run_id, "running", "waiting", step.agent_id, "qualityFailure:routeOriginalStory", { storyId: retryStory.story_id });
  const wfId = await _getWorkflowId(step.run_id);
  emitEvent({ ts: now(), event: "story.retry", runId: step.run_id, workflowId: wfId, stepId: "implement", storyId: retryStory.story_id, detail: `Downstream ${step.step_id} failure routed to original story` });
  emitEvent({ ts: now(), event: "step.pending", runId: step.run_id, workflowId: wfId, stepId: "implement", detail: `Downstream quality failure routed to original story ${retryStory.story_id}` });
  logger.warn(`[quality-router] Routed ${step.step_id} failure back to original story ${retryStory.story_id}`, { runId: step.run_id });
  return true;
}

// Predicted screen file helpers. Mirrors scripts/stitch-to-jsx.mjs
// toComponentName(); keep the two implementations in sync so story scope files
// match the generated screen component paths.
function toComponentNameForStitch(title: string): string {
  return title
    .replace(/[\u0131\u0130]/g, "i").replace(/[\u015f\u015e]/g, "s").replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[\u011f\u011e]/g, "g").replace(/[\u00fc\u00dc]/g, "u").replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/).filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function computePredictedScreenFiles(repoPath: string): Array<{ screenId: string; title: string; filePath: string }> {
  if (!repoPath) return [];
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest)) return [];
    return manifest
      .filter((s: any) => !isPrdPseudoDesignScreen(s))
      .filter((s: any) => s?.title && s?.screenId)
      .map((s: any) => {
        const name = toComponentNameForStitch(String(s.title));
        return { screenId: String(s.screenId), title: String(s.title), filePath: name ? `src/screens/${name}.tsx` : "" };
      })
      .filter(s => s.filePath !== "");
  } catch (e) {
    logger.warn(`[predicted-screens] Failed to parse DESIGN_MANIFEST.json: ${String(e).slice(0, 120)}`);
    return [];
  }
}

function normalizedStatusFromStepOutput(output: string): string {
  try {
    const parsed = parseOutputKeyValues(output);
    const raw = (parsed["status"] || "").trim();
    return (raw.indexOf("\n") >= 0 ? raw.slice(0, raw.indexOf("\n")).trim() : raw).split(/\s/)[0].toLowerCase();
  } catch {
    return "";
  }
}

function isSuccessfulStepOutput(output: string): boolean {
  const status = normalizedStatusFromStepOutput(output);
  return status === "done" || status === "skip";
}

function sanitizedRetryFailureText(text: string): string {
  if (!text.trim()) return "";
  if (/^IMPLEMENT_PRE_DELTA_CHECK_VIOLATION:/i.test(text.trim())) return "";
  const status = normalizedStatusFromStepOutput(text);
  if (status !== "done" && status !== "skip") return sanitizeDesignMismatchFeedback(text);

  const lines = text.split(/\r?\n/);
  const actionableStart = lines.findIndex((line) =>
    /\b(REMAINING|FAILURES?|ERRORS?|ISSUES?|BLOCKERS?|FEEDBACK|PREVIOUS_FAILURE|PR_REVIEW_COMMENTS_OPEN|PR_NOT_MERGED|PR_MISSING|VERIFY_SYSTEM_SMOKE_FAILURE|SYSTEM_SMOKE_FAILURE|QUALITY GATE|GUARDRAIL)\b/i.test(line),
  );
  if (actionableStart >= 0) {
    return sanitizeDesignMismatchFeedback(lines.slice(actionableStart).join("\n"));
  }
  return "";
}

function cleanRetryIssueText(value: string | undefined): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (["none", "(none)", "n/a", "na", "null", "undefined", "no issues"].includes(normalized)) {
    return "";
  }
  if (/^status:\s*retry\s*$/i.test(text)) return "";
  if (/^(feedback|issues|findings|blockers|test_failures):\s*(none|\(none\)|n\/a|na|null|undefined)\s*$/i.test(text)) {
    return "";
  }
  return text;
}

function formatRetryIssueBlock(label: string, value: string | undefined): string {
  const text = cleanRetryIssueText(value);
  return text ? `STATUS: retry\n${label}:\n${text}` : "";
}

export function resolveVerifyRetryIssues(
  parsedOutput: Record<string, string>,
  context: Record<string, string>,
  output: string,
): string {
  for (const [label, value] of [
    ["FEEDBACK", parsedOutput["feedback"]],
    ["ISSUES", parsedOutput["issues"]],
    ["TEST_FAILURES", parsedOutput["test_failures"]],
    ["FINDINGS", parsedOutput["findings"]],
    ["BLOCKERS", parsedOutput["blockers"]],
  ] as Array<[string, string | undefined]>) {
    const block = formatRetryIssueBlock(label, value);
    if (block) return block;
  }

  const rawOutput = cleanRetryIssueText(output);
  if (rawOutput) return rawOutput;

  for (const [label, value] of [
    ["FEEDBACK", context["feedback"]],
    ["ISSUES", context["issues"]],
    ["TEST_FAILURES", context["test_failures"]],
    ["FINDINGS", context["findings"]],
    ["BLOCKERS", context["blockers"]],
  ] as Array<[string, string | undefined]>) {
    const block = formatRetryIssueBlock(label, value);
    if (block) return block;
  }

  return "STATUS: retry\nFEEDBACK:\n- Verifier requested retry but did not provide actionable feedback.";
}

/**
 * Wrapper: calls cleanup-ops.cleanupAbandonedSteps with advancePipeline callback.
 * Maintains the original zero-arg signature for backwards compatibility.
 */
export async function cleanupAbandonedSteps(): Promise<void> {
  await _cleanupAbandonedSteps(advancePipeline);
}

async function getWorkflowId(runId: string): Promise<string | undefined> {
  return await _getWorkflowId(runId);
}

/**
 * Wave 5 fix #20 (plan: reactive-frolicking-cupcake): safe loop_config parser.
 * Previously three call sites did `JSON.parse(step.loop_config)` without a
 * try/catch. A corrupted or half-written loop_config row (possible during
 * migrations or medic resets) would throw and crash the claim loop. This
 * helper returns `null` on any error and logs the failure so we can see it.
 */
function parseLoopConfigSafe(raw: string | null, runId?: string): LoopConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoopConfig;
  } catch (e) {
    logger.warn(`[loop-config] Failed to parse loop_config: ${String(e).slice(0, 150)}`, runId ? { runId } : {});
    return null;
  }
}

function firstOutputWord(value: string | undefined): string {
  return String(value || "").trim().split(/\s+/)[0].toLowerCase();
}

function assertExactGitBranchWorktree(workdir: string, expectedBranch: string): void {
  if (!workdir || !fs.existsSync(workdir) || !expectedBranch) {
    throw new Error("V3_SUPERVISE_BOUND_WORKTREE_REQUIRED");
  }
  const observedBranch = execFileSync("git", ["branch", "--show-current"], {
    cwd: workdir,
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (observedBranch !== expectedBranch) {
    throw new Error("V3_SUPERVISE_BOUND_WORKTREE_BRANCH_MISMATCH");
  }
}

async function authenticatedV3SupervisorStoryWorktree(input: Readonly<{
  runId: string;
  superviseStepDbId: string;
  runtimeSessionId: string;
  boundSubject: RuntimeCompletionSubjectV1;
}>): Promise<Readonly<{
  workdir: string;
  storyBranch: string;
  storyTitle: string;
  scopeFiles: string | null;
  runId: string;
  superviseStepDbId: string;
  runtimeSessionId: string;
  storyDbId: string;
  storyId: string;
}>> {
  const rows = await pgBegin(async (transaction) => {
    const runs = await transaction.unsafe<Array<{ id: string }>>(
      "SELECT id FROM runs WHERE id = $1 FOR UPDATE",
      [input.runId],
    );
    if (runs.length !== 1) throw new Error("V3_SUPERVISE_BOUND_WORKTREE_RUN_INVALID");
    return transaction.unsafe<Array<{
    worktree: string | null;
    story_branch: string | null;
    title: string;
    scope_files: string | null;
    }>>(
    `SELECT runtime.worktree, story.story_branch, story.title, story.scope_files
       FROM v3_story_claim_runtime_bindings_v1 binding
       JOIN runtime_sessions runtime
         ON runtime.session_id = binding.runtime_session_id
        AND runtime.claim_id = binding.claim_id
        AND runtime.run_id = binding.run_id
       JOIN stories story
         ON story.id = binding.story_db_id
        AND story.run_id = binding.run_id
        AND story.story_id = binding.story_id
        AND story.claim_generation = binding.story_claim_generation
      WHERE binding.runtime_session_id = $1
        AND binding.run_id = $2
        AND binding.step_db_id = $3
        AND binding.workflow_step_id = 'supervise'
        AND binding.subject_kind = 'story_member'
        AND binding.story_db_id = $4
        AND binding.story_id = $5
      LIMIT 2
      FOR UPDATE OF binding, runtime, story`,
    [
      input.runtimeSessionId,
      input.runId,
      input.superviseStepDbId,
      input.boundSubject.storyDbId,
      input.boundSubject.storyId,
    ],
    );
  });
  if (rows.length !== 1) throw new Error("V3_SUPERVISE_BOUND_WORKTREE_IDENTITY_INVALID");
  const workdir = rows[0]!.worktree?.trim() ?? "";
  const storyBranch = rows[0]!.story_branch?.trim() ?? "";
  assertExactGitBranchWorktree(workdir, storyBranch);
  return {
    workdir,
    storyBranch,
    storyTitle: rows[0]!.title,
    scopeFiles: rows[0]!.scope_files,
    runId: input.runId,
    superviseStepDbId: input.superviseStepDbId,
    runtimeSessionId: input.runtimeSessionId,
    storyDbId: input.boundSubject.storyDbId,
    storyId: input.boundSubject.storyId,
  };
}

async function revalidateAuthenticatedV3SupervisorStoryWorktree(
  input: Awaited<ReturnType<typeof authenticatedV3SupervisorStoryWorktree>>,
): Promise<void> {
  const current = await authenticatedV3SupervisorStoryWorktree({
    runId: input.runId,
    superviseStepDbId: input.superviseStepDbId,
    runtimeSessionId: input.runtimeSessionId,
    boundSubject: { storyDbId: input.storyDbId, storyId: input.storyId },
  });
  if (current.workdir !== input.workdir || current.storyBranch !== input.storyBranch) {
    throw new Error("V3_SUPERVISE_BOUND_WORKTREE_DRIFT");
  }
}

function captureExactCleanBoundStoryRevision(
  workdir: string,
  storyBranch: string,
): Readonly<{ sha: string; treeHash: string }> {
  assertExactGitBranchWorktree(workdir, storyBranch);
  const porcelain = execFileSync("git", ["status", "--porcelain"], {
    cwd: workdir,
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (porcelain) throw new Error("V3_SUPERVISE_RETRY_SOURCE_WORKTREE_DIRTY");
  const commitSha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: workdir,
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return captureV3GitCommitRevision({ repo: workdir, commitSha });
}

function parseStoryIdSet(value: string | undefined): Set<string> {
  return new Set(String(value || "").split(",").map((v) => v.trim()).filter(Boolean));
}

function markStorySupervised(context: Record<string, string>, storyId: string): void {
  const ids = parseStoryIdSet(context[SUPERVISED_STORY_IDS_CONTEXT_KEY]);
  ids.add(storyId);
  context[SUPERVISED_STORY_IDS_CONTEXT_KEY] = Array.from(ids).sort().join(",");
}

function isStorySupervised(context: Record<string, string>, storyId: string): boolean {
  return parseStoryIdSet(context[SUPERVISED_STORY_IDS_CONTEXT_KEY]).has(storyId);
}

function clearStorySupervised(context: Record<string, string>, storyId: string): void {
  const ids = parseStoryIdSet(context[SUPERVISED_STORY_IDS_CONTEXT_KEY]);
  ids.delete(storyId);
  context[SUPERVISED_STORY_IDS_CONTEXT_KEY] = Array.from(ids).sort().join(",");
}

async function isVerifyEachVerifyStep(step: { run_id: string; step_id: string }): Promise<boolean> {
  const loopStep = await pgGet<{ loop_config: string | null }>(
    "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND step_id = 'implement' LIMIT 1",
    [step.run_id],
  );
  const loopConfig = parseLoopConfigSafe(loopStep?.loop_config || null, step.run_id);
  return !!(loopConfig?.verifyEach && (loopConfig.verifyStep || "verify") === step.step_id);
}

async function getSuperviseEachConfigForStep(step: { run_id: string; step_id: string }): Promise<{ loopStepId: string; verifyStep: string; superviseStep: string } | null> {
  const loopStep = await pgGet<{ id: string; loop_config: string | null }>(
    "SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND step_id = 'implement' LIMIT 1",
    [step.run_id],
  );
  const loopConfig = parseLoopConfigSafe(loopStep?.loop_config || null, step.run_id);
  const superviseStep = loopConfig?.superviseStep || "supervise";
  if (!loopStep || !loopConfig?.superviseEach || superviseStep !== step.step_id) return null;
  const pendingStory = await pgGet<{ story_id: string }>(
    "SELECT story_id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1",
    [step.run_id],
  );
  if (!pendingStory) return null;
  return { loopStepId: loopStep.id, verifyStep: loopConfig.verifyStep || "verify", superviseStep };
}

async function findUnsupervisedDoneStory(runId: string, context: Record<string, string>): Promise<{ id: string; story_id: string; title: string; retry_count: number; max_retries: number; pr_url: string | null; story_branch: string | null; scope_files: string | null } | undefined> {
  const supervised = parseStoryIdSet(context[SUPERVISED_STORY_IDS_CONTEXT_KEY]);
  const rows = await pgQuery<{ id: string; story_id: string; title: string; retry_count: number; max_retries: number; pr_url: string | null; story_branch: string | null; scope_files: string | null }>(
    "SELECT id, story_id, title, retry_count, max_retries, pr_url, story_branch, scope_files FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC",
    [runId],
  );
  return rows.find((story) => !supervised.has(story.story_id));
}

function findOpenSupervisorStateIssues(context: Record<string, string>, runId: string): string[] {
  const workdirs = [...new Set([context["story_workdir"], context["repo"]].filter(Boolean))];
  const issues: string[] = [];
  for (const workdir of workdirs) {
    try {
      const state = readSupervisorState(workdir, runId);
      for (const [storyId, story] of Object.entries(state.stories || {})) {
        const resolvedIds = new Set(story.resolved || []);
        const isActiveFinding = (itemId: string): boolean => {
          const evidence = state.evidence?.[itemId];
          if (!evidence) return false;
          if (resolvedIds.has(itemId)) return false;
          return evidence.status !== "passed";
        };
        for (const itemId of (story.openBlockers || []).filter(isActiveFinding)) issues.push(`${storyId}:${itemId}`);
        for (const itemId of (story.warnings || []).filter(isActiveFinding)) issues.push(`${storyId}:${itemId}`);
      }
    } catch (e) {
      logger.warn(`[supervise-each] Could not inspect supervisor state in ${workdir}: ${String(e).slice(0, 150)}`, { runId });
    }
  }
  return [...new Set(issues)];
}

function findBlockingSupervisorEvidenceForStory(
  workdirs: string[],
  runId: string,
  storyId: string,
  storyBranch?: string | null,
): { category: string; message: string; detail: string } | null {
  for (const workdir of expandSupervisorEvidenceWorkdirs(workdirs, storyBranch || undefined)) {
    try {
      if (!isUsableSupervisorEvidenceWorkdir(workdir)) {
        logger.warn(`[supervise-each] Ignoring stale supervisor evidence from inactive workdir ${workdir} for ${storyId}`, { runId });
        continue;
      }

      const visual = readSupervisorVisualResult(workdir, runId);
      if (visual && !visual.skipped && !visual.ok && (!visual.storyId || visual.storyId === storyId)) {
        const blockerIssues = visual.issues
          .filter((issue) => issue.severity === "blocker")
          .slice(0, 8)
          .map((issue) => `- [${issue.severity}] ${issue.type} ${issue.viewport} ${issue.route}: ${issue.detail}`);
        return {
          category: "SUPERVISOR_VISUAL_QA_BLOCKED",
          message: `Supervisor visual QA blocked ${storyId}`,
          detail: [
            `STATUS: retry`,
            `SUPERVISOR_VISUAL_QA_BLOCKED: ${storyId}`,
            `WORKDIR: ${workdir}`,
            blockerIssues.length > 0 ? blockerIssues.join("\n") : "- Visual QA failed with no blocker details.",
            visual.screenshots.length > 0 ? `SCREENSHOTS: ${visual.screenshots.slice(0, 6).join(", ")}` : "",
          ].filter(Boolean).join("\n"),
        };
      }

      const state = readSupervisorState(workdir, runId);
      const story = state.stories?.[storyId];
      const resolvedIds = new Set(story?.resolved || []);
      const openBlockers = [...new Set(story?.openBlockers || [])].filter((itemId) => {
        const evidence = state.evidence?.[itemId];
        if (!evidence) return false;
        if (resolvedIds.has(itemId)) return false;
        return evidence.status !== "passed";
      });
      if (openBlockers.length > 0) {
        const blockerLines = openBlockers.slice(0, 8).map((itemId) => {
          const evidence = state.evidence?.[itemId];
          return `- ${itemId}: ${evidence?.message || evidence?.status || "open supervisor blocker"}`;
        });
        return {
          category: "SUPERVISOR_EVIDENCE_BLOCKED",
          message: `Supervisor evidence blocked ${storyId}`,
          detail: [
            `STATUS: retry`,
            `SUPERVISOR_EVIDENCE_BLOCKED: ${storyId}`,
            `WORKDIR: ${workdir}`,
            blockerLines.length > 0 ? blockerLines.join("\n") : "- Supervisor state is blocked.",
          ].join("\n"),
        };
      }
    } catch (e) {
      logger.warn(`[supervise-each] Could not inspect supervisor evidence in ${workdir}: ${String(e).slice(0, 150)}`, { runId });
    }
  }
  return null;
}

function expandSupervisorEvidenceWorkdirs(workdirs: string[], storyBranch?: string): string[] {
  const roots = new Set<string>();
  const add = (candidate: string) => {
    if (!candidate) return;
    try {
      roots.add(path.resolve(candidate));
    } catch {
      roots.add(candidate);
    }
  };

  for (const workdir of workdirs.filter(Boolean)) {
    add(workdir);
    const normalized = workdir.replace(/\\/g, "/");
    const match = normalized.match(/^(.*\/workflows\/[^/]+\/agents)\/[^/]+\/story-worktrees\/([^/]+)$/);
    if (!match) continue;
    const agentsRoot = match[1];
    const branch = storyBranch || match[2];
    try {
      for (const agentDir of fs.readdirSync(agentsRoot)) {
        const candidate = path.join(agentsRoot, agentDir, "story-worktrees", branch);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) add(candidate);
      }
    } catch {
      // Keep direct roots; missing sibling worktrees are not fatal.
    }
  }

  return [...roots];
}

function isUsableSupervisorEvidenceWorkdir(workdir: string): boolean {
  try {
    if (!workdir || !fs.existsSync(workdir) || !fs.statSync(workdir).isDirectory()) return false;
    const sourceMarkers = [
      "package.json",
      "index.html",
      "src",
      "app",
      "pages",
      "ios",
      "android",
      "Package.swift",
      "pyproject.toml",
      "Cargo.toml",
      "go.mod",
      "pubspec.yaml",
    ];
    return sourceMarkers.some((marker) => fs.existsSync(path.join(workdir, marker)));
  } catch {
    return false;
  }
}

async function routeBlockingSupervisorEvidenceToImplement(params: {
  runId: string;
  verifyStepId: string;
  verifyStepName: string;
  loopStepId: string;
  story: {
    id: string;
    story_id: string;
    title?: string;
    retry_count?: number;
    max_retries?: number;
    story_branch?: string | null;
  };
  context: Record<string, string>;
  workdirs: string[];
}): Promise<boolean> {
  const blocking = findBlockingSupervisorEvidenceForStory(
    params.workdirs,
    params.runId,
    params.story.story_id,
    params.story.story_branch,
  );
  if (!blocking) return false;

  const story = params.story;
  const newRetry = (story.retry_count || 0) + 1;
  const failure = blocking.detail.slice(0, 6000);
  params.context["previous_failure"] = failure;
  params.context["failure_category"] = blocking.category;
  params.context["failure_suggestion"] = "Return to the same story branch and fix the supervisor evidence blocker before verify can run. The LLM supervisor pass cannot override open visual/state evidence.";
  params.context["current_story_id"] = story.story_id;
  params.context["current_story_title"] = story.title || "";
  if (story.story_branch) params.context["story_branch"] = story.story_branch;
  clearStorySupervised(params.context, story.story_id);

  const supervisorWorkdir = params.workdirs.find(Boolean) || "";
  if (supervisorWorkdir) {
    upsertSupervisorRunMetadata({
      workdir: supervisorWorkdir,
      runId: params.runId,
      scope: "story",
      status: "blocked",
      mainRepo: params.context["repo"] || "",
      storyId: story.story_id,
      storyWorkdir: supervisorWorkdir,
    });
    markSupervisorInterventions({
      workdir: supervisorWorkdir,
      runId: params.runId,
      storyId: story.story_id,
      result: "sent",
    });
  }

  await recordObservation({
    runId: params.runId,
    stepId: params.verifyStepName,
    storyId: story.story_id,
    phase: params.verifyStepName,
    checkId: "verify_each.supervisor_evidence_blocked",
    status: "fail",
    label: "Supervisor evidence blocked verify",
    detail: failure.slice(0, 1800),
  });

  if (newRetry > (story.max_retries || 0)) {
    const terminalRetry = Math.max(0, story.max_retries || 0);
    await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), story.id]);
    await updateRunContext(params.runId, params.context);
    await setStepStatus(params.loopStepId, "failed");
    await failRun(params.runId, true);
    const wfId = await getWorkflowId(params.runId);
    emitEvent({ ts: now(), event: "story.failed", runId: params.runId, workflowId: wfId, stepId: params.verifyStepName, storyId: story.story_id, detail: blocking.message });
    emitEvent({ ts: now(), event: "run.failed", runId: params.runId, workflowId: wfId, detail: blocking.message });
    scheduleRunCronTeardown(params.runId);
    return true;
  }

  await pgRun(
    "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, updated_at = $3 WHERE id = $4",
    [newRetry, failure, now(), story.id],
  );
  await updateRunContext(params.runId, params.context);
  await setStepStatus(params.loopStepId, "pending");
  await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), params.verifyStepId]);
  emitEvent({ ts: now(), event: "story.retry", runId: params.runId, workflowId: await getWorkflowId(params.runId), stepId: params.verifyStepName, storyId: story.story_id, detail: failure.slice(0, 500) });
  logger.warn(`[verify] Supervisor evidence blocked ${story.story_id}; returning to implement before reviewer claim`, { runId: params.runId });
  return true;
}

async function shouldAutoCompleteFinalSuperviseEachStep(runId: string, context: Record<string, string>): Promise<{ ok: boolean; reason: string }> {
  const loopStatus = await pgGet<{ status: string }>(
    "SELECT status FROM steps WHERE run_id = $1 AND type = 'loop' AND step_id = 'implement' LIMIT 1",
    [runId],
  );
  if (loopStatus?.status !== "done") return { ok: false, reason: "implement loop is not done" };

  const storyCounts = await pgGet<{ total: string; active: string; unverified: string }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status IN ('pending','running','done'))::text AS active,
       COUNT(*) FILTER (WHERE status NOT IN ('verified'))::text AS unverified
     FROM stories
     WHERE run_id = $1`,
    [runId],
  );
  if (parseInt(storyCounts?.total || "0", 10) === 0) return { ok: false, reason: "no stories exist" };
  if (parseInt(storyCounts?.active || "0", 10) > 0) return { ok: false, reason: "story work remains" };
  if (parseInt(storyCounts?.unverified || "0", 10) > 0) return { ok: false, reason: "not all stories are verified" };

  const openIssues = findOpenSupervisorStateIssues(context, runId);
  if (openIssues.length > 0) return { ok: false, reason: `open supervisor issue(s): ${openIssues.slice(0, 8).join(", ")}` };

  return { ok: true, reason: "all story supervisors passed and all stories are verified" };
}


function formatExecFailure(e: unknown, max = 900): string {
  const err = e as any;
  const parts = [String(err?.message || e || "unknown error")];
  const stderr = err?.stderr ? String(err.stderr).trim() : "";
  const stdout = err?.stdout ? String(err.stdout).trim() : "";
  if (stderr) parts.push(`stderr: ${stderr}`);
  if (stdout) parts.push(`stdout: ${stdout}`);
  return parts.join(" | ").replace(/\s+/g, " ").slice(0, max);
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function currentGitBranch(repo: string): string {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: repo, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function isVerifyRetryOutsideStoryVisualScope(
  issues: string,
  context: Record<string, string>,
  storyId: string,
): boolean {
  if (!storyId) return false;
  if (!/\b(visual|layout|overflow|viewport|screenshot|screen|desktop|mobile)\b/i.test(issues)) return false;
  const repos = [
    context["repo"] || "",
    context["story_workdir"] || "",
  ].filter(Boolean);
  return repos.some((repo) => resolveStoryVisualScope(repo, storyId).skip);
}

function gitBranchExists(repo: string, branch: string): boolean {
  if (!repo || !branch || /^[0-9a-f]{40}$/i.test(branch)) return false;
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeRunBranchContext(context: Record<string, string>, runId: string, repo: string): string {
  const current = repo ? currentGitBranch(repo) : "";
  const candidates = uniqueNonEmpty([runId, context["BRANCH"], context["branch"], current]);
  const branch = candidates.find((b) => repo && gitBranchExists(repo, b)) || current || context["BRANCH"] || context["branch"] || runId;
  if (branch) {
    if (context["branch"] !== branch || context["BRANCH"] !== branch) {
      logger.warn(`[branch-normalize] Canonicalized run branch to ${branch} (branch=${context["branch"] || ""}, BRANCH=${context["BRANCH"] || ""}, current=${current || ""})`, { runId });
    }
    context["branch"] = branch;
    context["BRANCH"] = branch;
  }
  return branch;
}

function setLocalMainAuthoritative(repo: string, enabled: boolean, runId: string): void {
  try {
    if (enabled) {
      execFileSync("git", ["config", "setfarm.localMainAuthoritative", "true"], {
        cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      execFileSync("git", ["config", "--unset", "setfarm.localMainAuthoritative"], {
        cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch (configErr) {
    if (enabled) {
      logger.warn(`[setup-build] Could not mark local main authoritative: ${formatExecFailure(configErr, 300)}`, { runId });
    }
  }
}

function isLocalMainAuthoritative(repo: string): boolean {
  try {
    const value = execFileSync("git", ["config", "--get", "setfarm.localMainAuthoritative"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return value === "true";
  } catch {
    return false;
  }
}

function resolveVerifyPreflightBaseRef(
  repo: string,
  context: Record<string, string>,
  analysisBranch: string,
): string {
  if (!analysisBranch || analysisBranch === "main") return "main";

  const storyBaseRef = (context["story_base_ref"] || "").trim();
  if (storyBaseRef) return storyBaseRef;

  return isLocalMainAuthoritative(repo) ? "main" : "origin/main";
}

function gitRefHasProjectSource(repo: string, ref = "main"): boolean {
  if (!repo) return false;
  try {
    const output = execFileSync("git", ["ls-tree", "--name-only", ref, "--", "package.json", "index.html", "src", "assets"], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return /\b(package\.json|index\.html|src|assets)\b/.test(output);
  } catch (e) {
    logger.debug(`[git-source-check] ${String(e).slice(0, 80)}`);
    return false;
  }
}

function pointLocalMainAtHead(repo: string, runId: string): boolean {
  const current = currentGitBranch(repo);
  if (current === "main") return true;
  try {
    execFileSync("git", ["branch", "-f", "main", "HEAD"], {
      cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch (branchErr) {
    logger.warn(`[setup-build] Could not fast-set local main to setup baseline: ${formatExecFailure(branchErr, 400)}`, { runId });
    return false;
  }
}

function publishSetupBaselineToMain(repo: string, runBranch: string, runId: string): boolean {
  if (!repo) return false;
  try {
    const initialCurrent = currentGitBranch(repo);
    const branchCandidates = uniqueNonEmpty([runId, runBranch, initialCurrent]);
    const publishBranch = branchCandidates.find((b) => gitBranchExists(repo, b)) || initialCurrent;

    if (publishBranch && initialCurrent !== publishBranch) {
      try {
        execFileSync("git", ["checkout", publishBranch], {
          cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (checkoutErr) {
        throw new Error(`checkout ${publishBranch} failed: ${formatExecFailure(checkoutErr)}`);
      }
    }

    try {
      execFileSync("git", ["rm", "-r", "--cached", "--ignore-unmatch", "node_modules"], {
        cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {}

    try {
      const dirty = execFileSync("git", ["status", "--porcelain"], {
        cwd: repo, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (dirty) {
        execFileSync("git", ["add", "-A"], { cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
        try {
          execFileSync("git", ["rm", "-r", "--cached", "--ignore-unmatch", ".setfarm", ".setfarm-bin", ".worktrees", "references", "SUPERVISOR_MEMORY.md", "PROJECT_MEMORY.md", "CLAUDE.md"], {
            cwd: repo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
          });
        } catch {}
        execFileSync("git", ["commit", "-m", "chore: finalize setup baseline"], {
          cwd: repo,
          timeout: 20000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, GIT_COMMITTER_NAME: "Moltclaw AI", GIT_COMMITTER_EMAIL: "setrox@moltclaw.local" },
        });
      }
    } catch (commitErr) {
      logger.warn(`[setup-build] Baseline commit step skipped/failed: ${formatExecFailure(commitErr, 300)}`, { runId });
    }

    const current = currentGitBranch(repo) || publishBranch;
    if (current) {
      try {
        execFileSync("git", ["push", "origin", current], {
          cwd: repo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (pushBranchErr) {
        logger.warn(`[setup-build] Could not push setup branch ${current}: ${formatExecFailure(pushBranchErr, 500)}`, { runId });
      }
    }

    try {
      execFileSync("git", ["push", "origin", "HEAD:main"], {
        cwd: repo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (pushMainErr) {
      try {
        execFileSync("git", ["fetch", "origin", "main"], { cwd: repo, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
        execFileSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
        execFileSync("git", ["push", "origin", "HEAD:main"], { cwd: repo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
      } catch (retryErr) {
        if (!pointLocalMainAtHead(repo, runId)) {
          throw new Error(`push HEAD:main failed: ${formatExecFailure(pushMainErr)}; retry failed: ${formatExecFailure(retryErr)}`);
        }
        setLocalMainAuthoritative(repo, true, runId);
        logger.warn(`[setup-build] Remote main publish failed; using local main baseline for implement worktrees: ${formatExecFailure(pushMainErr, 500)}; retry failed: ${formatExecFailure(retryErr, 500)}`, { runId });
        logger.info(`[setup-build] Published setup baseline to local main from ${current || "HEAD"}; story worktrees will branch from local main`, { runId });
        return true;
      }
    }

    pointLocalMainAtHead(repo, runId);
    setLocalMainAuthoritative(repo, false, runId);
    syncBaseBranch(repo, "main");
    logger.info(`[setup-build] Published setup baseline to main from ${current || "HEAD"}; story PRs will branch from main`, { runId });
    return true;
  } catch (e) {
    logger.warn(`[setup-build] Could not publish setup baseline to main: ${formatExecFailure(e)}`, { runId });
    return false;
  }
}

// ── Peek (lightweight work check) ───────────────────────────────────

export type PeekResult = "HAS_WORK" | "NO_WORK";

/**
 * Lightweight check: does this agent have any pending/waiting steps in active runs?
 * Unlike claimStep(), this runs a single cheap COUNT query — no cleanup, no context resolution.
 * Returns "HAS_WORK" if any pending/waiting steps exist, "NO_WORK" otherwise.
 */
export async function peekStep(agentId: string, callerGatewayAgent?: string): Promise<PeekResult> {
    // OUTPUT RECOVERY at peek time: if a previous session wrote output but died before
    // completing, recover it now. This prevents the "peek→NO_WORK→loop forever" problem
    // where claimStep's recovery never runs because peek returns NO_WORK first.
    // Scans ALL output files in /tmp — each parallel agent writes to its own file
    // (e.g. setfarm-output-koda.txt, setfarm-output-flux.txt)
    try {
      // Caller-scoped recovery must include both legacy direct files and
      // spawner-owned files: setfarm-output-<agent>-spawner-<id>.txt.
      const tmpFiles = recoverableOutputTmpFiles(callerGatewayAgent);
      for (const fileName of tmpFiles) {
        const filePath = `/tmp/${fileName}`;
        try {
          const output = fs.readFileSync(filePath, 'utf-8').trim();
          if (!output.includes('STATUS:')) continue;
          // P2-06: Skip if file is older than current run (cross-contamination guard)
          const fileStat = fs.statSync(filePath);
          const fileAge = Date.now() - fileStat.mtimeMs;
          if (fileAge > 1800000) { fs.unlinkSync(filePath); continue; } // older than 30min = stale
          // Find any running step for this agent role that could match
          const runningStep = await pgGet<{ id: string; step_id: string; run_id: string }>(
            `SELECT s.id, s.step_id, s.run_id FROM steps s JOIN runs r ON r.id = s.run_id
             WHERE s.agent_id = $1 AND s.status = 'running' AND r.status = 'running'
             LIMIT 1`, [agentId]
          );
          if (runningStep) {
            // peek-recovery FILE_STALE: skip file from previous step
            const _prt = await pgGet<{ started_at: string | null }>(
              "SELECT started_at FROM steps WHERE id = $1", [runningStep.id]
            );
            if (_prt?.started_at && fileStat.mtimeMs < new Date(_prt.started_at).getTime() - 5000) {
              logger.info(`[peek-recovery] Skipping stale ${fileName} (before step start)`, { runId: runningStep.run_id });
              continue;
            }
            // Skip orphan recovery for design step — pre-claim generates screens, recovery would corrupt output
            if (runningStep.step_id === 'design') {
              logger.info(`[peek-recovery] Skipping orphan recovery for design step — pre-claim handles it`, { runId: runningStep.run_id });
              continue;
            }
            // v2026.4.12: Skip orphan recovery for stories step if output lacks STORIES_JSON.
            // Orphaned output from previous step (plan) gets picked up and auto-completes
            // stories with 0 stories, wasting a retry attempt.
            if (runningStep.step_id === 'stories' && !output.includes('STORIES_JSON')) {
              logger.info(`[peek-recovery] Skipping orphan recovery for stories step — output lacks STORIES_JSON`, { runId: runningStep.run_id });
              continue;
            }
            logger.info(`[peek-recovery] Found orphaned output ${fileName} for ${runningStep.step_id} (${agentId}) — auto-completing`, { runId: runningStep.run_id });
            try {
              const { completeStep } = await import("./step-ops.js");
              const result = await completeStep(runningStep.id, output);
              fs.unlinkSync(filePath);
              logger.info(`[peek-recovery] Auto-completed ${runningStep.step_id} from ${fileName}, advanced=${result.advanced}`, { runId: runningStep.run_id });
              break; // One recovery per peek call
            } catch (e) {
              logger.warn(`[peek-recovery] Auto-complete failed for ${fileName}: ${String(e)}`, { runId: runningStep.run_id });
            }
          }
        } catch (e) { logger.debug(`[output-recovery] File read failed: ${String(e).slice(0, 100)}`); }
      }
    } catch (e) { /* non-fatal — /tmp read failed */ }

    // AUTO-PR/peek-claim race fix (2026-04-21): peek must match claim's semantics.
    // Claim returns NO_WORK when all pending stories are dep-blocked AND running stories
    // exist. Peek was previously permissive (just checked "pending exists") — causing
    // infinite HAS_WORK→claim NO_WORK cycle that burned agent sessions with no progress.
    const row = await pgGet<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.agent_id = $1 AND r.status = 'running'
         AND NOT ${PR_EACH_DELIVERY_BLOCKED_STEP_SQL}
         AND NOT EXISTS (
           SELECT 1 FROM steps prev
           WHERE prev.run_id = s.run_id
             AND prev.step_index < s.step_index
             AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
             AND NOT (
               prev.type = 'loop'
               AND prev.status = 'running'
               AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
               AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
               AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
               AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
               AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
             )
             AND NOT (
               prev.type = 'loop'
               AND prev.status = 'pending'
               AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
               AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
               AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
               AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
               AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
             )
         )
         AND (
          (
            s.status = 'pending'
            AND NOT (
              s.type = 'loop'
              AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
              AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
              AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
              AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
            )
          )
          OR (s.status = 'running' AND s.type = 'loop' AND (
            (
              EXISTS (
                SELECT 1 FROM stories st
                WHERE st.run_id = s.run_id AND st.status = 'pending'
                  AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(
                      CASE
                        WHEN st.depends_on IS NULL OR st.depends_on = 'null' OR st.depends_on = ''
                        THEN '[]'::jsonb
                        ELSE st.depends_on::jsonb
                      END
                    ) AS dep
                    WHERE NOT EXISTS (
                      SELECT 1 FROM stories d
                      WHERE d.run_id = s.run_id AND d.story_id = dep
                        AND d.status IN ('done', 'failed', 'verified', 'skipped')
                    )
                  )
              )
              AND NOT (
                COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
                AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
                AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
              )
            )
            OR (
              NOT (COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb)
              AND EXISTS (SELECT 1 FROM stories st WHERE st.run_id = s.run_id AND st.status = 'done')
            )
          ))
         )`, [agentId]
    );
    return (row?.cnt ?? 0) > 0 ? "HAS_WORK" : "NO_WORK";
}

// ── Claim ───────────────────────────────────────────────────────────

interface ClaimResult {
  found: boolean;
  stepId?: string;
  workflowStepId?: string;
  runId?: string;
  protocol?: "legacy" | "shadow" | "v3";
  storyId?: string;
  storyDbId?: string;
  claimGeneration?: number;
  attempt?: ClaimAttemptFenceV1;
  claimId?: number;
  claimAgentId?: string;
  runtimeSessionId?: string;
  runtimeOwnerInstanceId?: string;
  recoveryDispatchId?: string;
  recoveryRevisionId?: string;
  recoveryLeaseToken?: string;
  v3ImplementationHandoff?: V3ImplementationClaimHandoffV1;
  v3StageRetrySource?: V3StageRetrySourceV1;
  compilerCompletionOutput?: string;
  resolvedInput?: string;
}

export type ClaimStepRecoveryDispatchClass = "product_implementation" | "supervisor_repair";

export type ClaimStepWorkIntent = Readonly<{
  workflowId: string;
  recoveryDispatchClass: ClaimStepRecoveryDispatchClass;
}>;

type RuntimeClaimOwnership = Readonly<{
  sessionId: string;
  ownerInstanceId: string;
}>;

async function closeUnstartedStoryClaimExact(
  identity: Readonly<{
    claimId: number | null;
    runId: string;
    workflowStepId: string;
    storyId: string;
    claimAgentId: string;
  }>,
  diagnostic: string,
  outcome: "failed" | "infra_retry" = "failed",
  runtime?: RuntimeClaimOwnership,
): Promise<void> {
  if (identity.claimId === null) return;
  await pgBegin((sql) => closeReservedClaimRuntimeInTransaction(sql, {
    claimId: identity.claimId!,
    runId: identity.runId,
    workflowStepId: identity.workflowStepId,
    storyId: identity.storyId,
    claimAgentId: identity.claimAgentId,
    outcome,
    diagnostic,
    runtime,
  }));
}

/** Step row as returned by the step selection query in claimStep. */
type StepRow = {
  id: string;
  step_id: string;
  run_id: string;
  step_index: number;
  input_template: string;
  type: string;
  loop_config: string | null;
  step_status: string;
  current_story_id: string | null;
  retry_count: number;
  output: string | null;
  protocol?: "legacy" | "shadow" | "v3";
};


// ── Source Tree Injection ────────────────────────────────────────────

/**
 * Generate a compact directory tree of src/ to inject into story context.
 * Helps agents discover existing directories and avoid creating duplicates
 * (e.g., contexts/ when context/ already exists).
 */
function generateSrcTree(repoPath: string): string {
  if (!repoPath || !fs.existsSync(repoPath)) return "";
  const srcDir = path.join(repoPath, "src");
  if (!fs.existsSync(srcDir)) return "";
  
  const lines: string[] = [];
  function walk(dir: string, prefix: string, depth: number) {
    if (depth > 4) return; // max 4 levels deep
    let entries: string[];
    try {
      entries = fs.readdirSync(dir).filter(e => 
        !e.startsWith(".") && e !== "node_modules" && !e.endsWith(".test.tsx") && !e.endsWith(".test.ts")
      ).sort();
    } catch { return; }
    
    const dirs = entries.filter(e => {
      try { return fs.statSync(path.join(dir, e)).isDirectory(); } catch { return false; }
    });
    const files = entries.filter(e => {
      try { return fs.statSync(path.join(dir, e)).isFile(); } catch { return false; }
    });
    
    for (const f of files) lines.push(prefix + f);
    for (const d of dirs) {
      lines.push(prefix + d + "/");
      walk(path.join(dir, d), prefix + "  ", depth + 1);
    }
  }
  
  walk(srcDir, "  ", 0);
  if (lines.length === 0) return "";
  if (lines.length > 80) {
    // Too large — only show directories
    const dirLines = lines.filter(l => l.trimEnd().endsWith("/"));
    return "src/\n" + dirLines.join("\n");
  }
  return "src/\n" + lines.join("\n");
}

// ── Extracted helpers (private, called only from claimStep) ──────────

/**
 * Auto-complete design step with existing HTML files.
 * Shared by .stitch dedup and PRD Generator cache path.
 */
function isReusableStitchHtml(filePath: string): boolean {
  return isValidStitchHtmlFile(filePath);
}

function isPrdPseudoDesignScreen(screen: any): boolean {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  const screenId = String(screen?.screenId || screen?.id || "").trim().toLowerCase();
  return /\b(?:prd|requirements?)\b/.test(`${screenId} ${title} ${htmlFile}`);
}

function reusableDesignScreens(repoPath: string, htmlFiles: string[]): Array<{ screenId: string; name: string }> {
  const stitchDir = path.join(repoPath, "stitch");
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(manifest)) {
        return manifest
          .filter((screen: any) => !isPrdPseudoDesignScreen(screen))
          .filter((screen: any) => {
            const sid = String(screen?.screenId || screen?.id || "");
            return sid && isReusableStitchHtml(path.join(stitchDir, sid + ".html"));
          })
          .map((screen: any) => ({
            screenId: String(screen.screenId || screen.id),
            name: String(screen.title || screen.name || screen.screenId || screen.id),
          }));
      }
    } catch (e) {
      logger.warn(`[design-dedup] Manifest parse failed: ${String(e).slice(0, 120)}`, {});
    }
  }

  return htmlFiles
    .filter((file: string) => isReusableStitchHtml(path.join(stitchDir, file)))
    .map((file: string) => ({
      screenId: file.replace(".html", ""),
      name: file.replace(".html", ""),
    }));
}

function expectedDesignScreenCount(repoPath: string): number {
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return 0;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifest)) return 0;
    return manifest.filter((screen: any) => !isPrdPseudoDesignScreen(screen)).length;
  } catch {
    return 0;
  }
}

function normalizeDesignScreenName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0130]/g, "I")
    .replace(/[\u0131]/g, "i")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function designScreenNameMatches(expectedName: string, actualName: string): boolean {
  const expected = normalizeDesignScreenName(expectedName);
  const actual = normalizeDesignScreenName(actualName);
  if (!expected || !actual) return false;
  if (expected === actual) return true;
  if (actual.startsWith(`${expected} `)) return true;
  if (expected.startsWith(`${actual} `)) return true;

  const expectedTokens = expected.split(" ").filter(Boolean);
  const actualTokens = new Set(actual.split(" ").filter(Boolean));
  if (expectedTokens.length < 2) return false;
  return expectedTokens.every((token) => actualTokens.has(token));
}

function parsePrdDesignSurfaces(prd: string): Array<{ surfaceId: string; name: string; description: string }> {
  const surfaces: Array<{ surfaceId: string; name: string; description: string }> = [];
  const lines = String(prd || "").split(/\r?\n/);
  let inSurfaces = false;
  let current: { surfaceId: string; name: string; description: string } | null = null;
  const pushCurrent = () => {
    if (!current) return;
    if (!current.name) current.name = current.surfaceId.replace(/^SURF_/, "").replace(/_/g, " ");
    surfaces.push(current);
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##+\s+(?:\d+\.\s*)?Product Surfaces\b/i.test(trimmed)) {
      inSurfaces = true;
      continue;
    }
    if (inSurfaces && /^##\s+/.test(trimmed)) break;
    if (!inSurfaces) continue;
    const heading = trimmed.match(/^#{3,5}\s+SURFACE\s*:\s*([A-Z0-9_ -]+)(?:\s*[-:]\s*(.+))?$/i);
    const bulletId = trimmed.match(/^[-*]\s*(?:SURFACE_ID|Surface ID)\s*:\s*([A-Z0-9_ -]+)$/i);
    if (heading || bulletId) {
      pushCurrent();
      const rawId = String(heading?.[1] || bulletId?.[1] || "").trim();
      const cleanId = rawId.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const surfaceId = cleanId.startsWith("SURF_") ? cleanId : `SURF_${cleanId || "SURFACE"}`;
      current = { surfaceId, name: String(heading?.[2] || rawId).replace(/^SURF[_ -]?/i, "").replace(/[_-]+/g, " ").trim(), description: "" };
      continue;
    }
    if (!current) continue;
    const field = trimmed.match(/^[-*]\s*([^:]+):\s*(.+)$/);
    if (!field) continue;
    const key = field[1].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key === "name") current.name = field[2].trim();
    if (key === "purpose" || key === "core content" || key === "design guidance") {
      current.description = `${current.description} ${field[2].trim()}`.trim();
    }
  }
  pushCurrent();
  return surfaces;
}

function reconcileReusableDesignScreens(
  reusableScreens: Array<{ screenId: string; name: string }>,
  prd: string,
): {
  screens: Array<{ screenId: string; name: string; type: string; description: string; surfaceIds?: string[] }>;
  missing: string[];
  dropped: string[];
  duplicates: string[];
} {
  const surfaces = parsePrdDesignSurfaces(prd);
  if (surfaces.length === 0) {
    return {
      screens: reusableScreens.map((screen) => ({
        screenId: screen.screenId,
        name: screen.name,
        type: "page",
        description: screen.name,
      })),
      missing: [],
      dropped: [],
      duplicates: [],
    };
  }

  const screens: Array<{ screenId: string; name: string; type: string; description: string; surfaceIds?: string[] }> = [];
  const missing: string[] = [];
  const usedIds = new Set<string>();
  const duplicates: string[] = [];

  for (const surface of surfaces) {
    const matches = reusableScreens.filter((screen) => designScreenNameMatches(surface.name, screen.name) || designScreenNameMatches(surface.surfaceId.replace(/^SURF_/, ""), screen.name));
    const chosen = matches.find((screen) => !usedIds.has(screen.screenId)) || matches[0];
    if (!chosen) {
      missing.push(`${surface.surfaceId} ${surface.name}`.trim());
      continue;
    }
    if (matches.length > 1) duplicates.push(surface.name);
    usedIds.add(chosen.screenId);
    screens.push({
      screenId: chosen.screenId,
      name: chosen.name || surface.name,
      type: "page",
      description: surface.description || `${surface.name} Product Surface`,
      surfaceIds: [surface.surfaceId],
    });
  }

  const dropped = reusableScreens
    .filter((screen) => !usedIds.has(screen.screenId) || !surfaces.some((surface) => designScreenNameMatches(surface.name, screen.name) || designScreenNameMatches(surface.surfaceId.replace(/^SURF_/, ""), screen.name)))
    .map((screen) => screen.name)
    .filter(Boolean);

  return { screens, missing, dropped, duplicates };
}

function clearReusableDesignCache(repoPath: string): void {
  try { fs.rmSync(path.join(repoPath, "stitch"), { recursive: true, force: true }); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
  try { fs.unlinkSync(path.join(repoPath, ".stitch")); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
}

async function autoCompleteDesignStep(step: StepRow, db: any, htmlFiles: string[], projectId: string): Promise<boolean> {
  const dRepoPath = (await getRunContext(step.run_id))["repo"] || "";
  const dCtx = await getRunContext(step.run_id);
  if (!dRepoPath) return false;

  const reusableScreens = reusableDesignScreens(dRepoPath, htmlFiles);
  const expectedFromManifest = expectedDesignScreenCount(dRepoPath);
  if (expectedFromManifest > 0 && reusableScreens.length < expectedFromManifest) {
    logger.warn(`[design-dedup] Existing design incomplete: ${reusableScreens.length}/${expectedFromManifest} valid HTMLs — waiting for generation`, { runId: step.run_id });
    return false;
  }

  const prdSurfaces = parsePrdDesignSurfaces(dCtx["prd"] || dCtx["PRD"] || "");
  if (prdSurfaces.length > 0 && reusableScreens.length < prdSurfaces.length) {
    logger.warn(`[design-dedup] Existing design incomplete: ${reusableScreens.length}/${prdSurfaces.length} Product Surface-backed valid screens — clearing cache to force regeneration`, { runId: step.run_id });
    clearReusableDesignCache(dRepoPath);
    return false;
  }

  if (reusableScreens.length === 0) {
    logger.warn(`[design-dedup] Existing design has no valid HTMLs — waiting for generation`, { runId: step.run_id });
    return false;
  }

  const reconciliation = reconcileReusableDesignScreens(reusableScreens, dCtx["prd"] || dCtx["PRD"] || "");
  if (reconciliation.missing.length > 0) {
    const missing = reconciliation.missing.slice(0, 8).join(", ");
    logger.warn(`[design-dedup] Existing design cache missing Product Surface(s): ${missing} — clearing cache to force regeneration`, { runId: step.run_id });
    dCtx["design_dedup_mismatch"] = `missing=${missing}`;
    await updateRunContext(step.run_id, dCtx);
    clearReusableDesignCache(dRepoPath);
    return false;
  }

  if (reconciliation.dropped.length > 0 || reconciliation.duplicates.length > 0) {
    logger.warn(`[design-dedup] Reconciled reusable design cache to Product Surfaces (dropped=${reconciliation.dropped.length}, duplicates=${reconciliation.duplicates.length})`, { runId: step.run_id });
  }

  const dScreenMap = reconciliation.screens;
  dCtx["stitch_project_id"] = projectId;
  dCtx["screens_generated"] = String(dScreenMap.length);
  dCtx["screen_map"] = JSON.stringify(dScreenMap);
  dCtx["device_type"] = dCtx["device_type"] || "DESKTOP";
  dCtx["design_system"] = dCtx["design_system"] || "reused from existing designs";
  dCtx["design_notes"] = `Reused ${dScreenMap.length} existing screen designs`;
  await updateRunContext(step.run_id, dCtx);
  const dOutput = [
    "STATUS: done",
    `STITCH_PROJECT_ID: ${projectId}`,
    `DEVICE_TYPE: ${dCtx["device_type"]}`,
    `DESIGN_SYSTEM: ${dCtx["design_system"]}`,
    `SCREEN_MAP: ${JSON.stringify(dScreenMap)}`,
    `SCREENS_GENERATED: ${dScreenMap.length}`,
    `DESIGN_NOTES: Reused ${dScreenMap.length} screens (auto-skip)`,
  ].join("\n");
  await completeStep(step.id, dOutput);
  logger.info(`[design-dedup] Auto-skipped design through completeStep guardrails — reusing ${dScreenMap.length} valid screens (project ${projectId})`, { runId: step.run_id });
  return true;
}

/**
 * DESIGN STEP DEDUP: If .stitch + stitch/*.html exist, auto-complete design step.
 * Also auto-skips when stitch/ has ≥2 HTML files from PRD Generator cache.
 * Returns true if the step was auto-completed (caller should return { found: false }).
 */
async function handleDesignDedup(step: StepRow, db: any): Promise<boolean> {
  if (step.step_id !== "design") return false;

  const dRepoPath = (await getRunContext(step.run_id))["repo"] || "";
  if (!dRepoPath) return false;

  const dStitchFile = path.join(dRepoPath, ".stitch");
  const dStitchDir = path.join(dRepoPath, "stitch");

  // Fix 2: Also auto-skip when stitch/ has ≥2 HTML files WITHOUT .stitch file
  // (PRD Generator copies HTML from cache — no .stitch metadata needed)
  if (!fs.existsSync(dStitchDir)) return false;

  const dHtmlFiles = fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html"));

  // Case A: .stitch file exists — validate freshness
  if (fs.existsSync(dStitchFile)) {
    try {
      const dData = JSON.parse(fs.readFileSync(dStitchFile, "utf-8"));
      // Only reuse if .stitch was written DURING this run (prevents cross-run contamination)
      const runRow = await pgGet<any>("SELECT created_at FROM runs WHERE id = $1", [step.run_id]);
      const runCreatedAt = runRow ? new Date(runRow.created_at).getTime() : 0;
      const stitchUpdatedAt = dData.updatedAt ? new Date(dData.updatedAt).getTime() : 0;
      // 60s tolerance: PRD Generator writes .stitch seconds before run starts
      const STALE_TOLERANCE_MS = 60000;
      if (stitchUpdatedAt < (runCreatedAt - STALE_TOLERANCE_MS)) {
        logger.info(`[design-dedup] .stitch is stale (written ${dData.updatedAt}, run started ${runRow?.created_at}) — deleting to force fresh design`, { runId: step.run_id });
        try { fs.unlinkSync(dStitchFile); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        try { fs.rmSync(dStitchDir, { recursive: true, force: true }); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        return false;
      }

      if (dData.projectId && dHtmlFiles.length > 0) {
        return await autoCompleteDesignStep(step, db, dHtmlFiles, dData.projectId);
      }
    } catch (e) { logger.warn(`[design-dedup] .stitch parse error: ${e}`, { runId: step.run_id }); }
  }

  // Case B: No .stitch file but stitch/ has ≥2 HTML files (PRD Generator cache)
  if (dHtmlFiles.length >= 2) {
    logger.info(`[design-dedup] No .stitch file but stitch/ has ${dHtmlFiles.length} HTML files — auto-skipping design step`, { runId: step.run_id });
    return await autoCompleteDesignStep(step, db, dHtmlFiles, "prd-generator-cache");
  }

  return false;
}

/**
 * DEPLOY ENV GUARD: Auto-generate .env for projects with auth/DB before deploy.
 * Mutates the filesystem only (no return value needed).
 */
async function handleDeployEnvGuard(step: StepRow): Promise<void> {
  if (!shouldMaterializeRepoDeployEnvironment({
    stepId: step.step_id,
    protocol: step.protocol,
  })) return;

  const dCtx = await getRunContext(step.run_id);
  const repoPath = dCtx["repo"] || "";
  if (!repoPath || fs.existsSync(path.join(repoPath, ".env"))) return;

  const envLines: string[] = [];
  // DB connection — prefer external DB
  const dbUrl = dCtx["database_url"] || "";
  const dbHost = dCtx["db_host"] || process.env.SETFARM_DEFAULT_DB_HOST || "localhost";
  const dbPort = dCtx["db_port"] || process.env.SETFARM_DEFAULT_DB_PORT || "5432";
  const dbName = dCtx["db_name"] || path.basename(repoPath).replace(/-/g, "_");
  const dbUser = dCtx["db_user"] || process.env.SETFARM_DEFAULT_DB_USER || "postgres";
  const dbPass = dCtx["db_password"] || process.env.SETFARM_DEFAULT_DB_PASS || "";
  if (dbUrl) {
    envLines.push(`DATABASE_URL=${dbUrl}`);
  } else {
    // Check if project uses Prisma/DB
    const pkgPath = path.join(repoPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps["prisma"] || allDeps["@prisma/client"] || allDeps["drizzle-orm"] || allDeps["typeorm"]) {
          envLines.push(`DATABASE_URL=postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`);
        }
      } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    }
  }
  // NextAuth secret
  const pkgPath2 = path.join(repoPath, "package.json");
  if (fs.existsSync(pkgPath2)) {
    try {
      const pkg2 = JSON.parse(fs.readFileSync(pkgPath2, "utf-8"));
      const allDeps2 = { ...pkg2.dependencies, ...pkg2.devDependencies };
      if (allDeps2["next-auth"] || allDeps2["@auth/core"]) {
        const secret = execFileSync("openssl", ["rand", "-base64", "32"], { timeout: 5000 }).toString().trim();
        const hostname = path.basename(repoPath);
        envLines.push(`NEXTAUTH_SECRET=${secret}`);
        envLines.push(`NEXTAUTH_URL=https://${hostname}.setrox.com.tr`);
      }
    } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
  }
  if (envLines.length > 0) {
    fs.writeFileSync(path.join(repoPath, ".env"), envLines.join("\n") + "\n");
    logger.info(`[deploy-env] Generated .env with ${envLines.length} var(s): ${envLines.map(l => l.split("=")[0]).join(", ")}`, { runId: step.run_id });
  }
}

/**
 * Auto-complete stories that already have a PR (open or merged).
 * Checks BOTH running AND pending stories — medic resets running->pending faster
 * than cron claims, so pending stories with PRs must also be caught.
 */
async function autoCompleteStoriesWithPRs(
  step: StepRow,
  runIdPrefix: string,
  context: Record<string, string>,
  db: any,
): Promise<void> {
  const autoCompleteStories = await pgQuery<any>("SELECT * FROM stories WHERE run_id = $1 AND status = 'pending' ORDER BY story_index ASC", [step.run_id]);
  for (const rs of autoCompleteStories) {
    const retryCount = Number(rs.retry_count || 0);
    const hasActionableRetryOutput = ACTIONABLE_RETRY_OUTPUT_RE.test(String(rs.output || ""));
    if (retryCount > 0 || hasActionableRetryOutput) {
      const reason = retryCount > 0 ? `retry_count=${retryCount}` : "actionable retry output";
      logger.info(`[claim-auto-complete] Story ${rs.story_id} has ${reason}; skipping stale PR auto-complete so implement can apply verify feedback`, { runId: step.run_id });
      continue;
    }

    // Build expected branch: {runId_prefix}-{STORY_ID} e.g. "433ff7a1-US-001"
    const storyBranchForCheck = (rs.story_branch || `${runIdPrefix}-${rs.story_id}`).toLowerCase();
    const existingPrUrl = rs.pr_url || "";

    try {
      let prUrl = existingPrUrl;
      let prFound = false;

      if (prUrl) {
        const state = getPRState(prUrl);
        if (state === "MERGED" || state === "OPEN") {
          prFound = true;
        } else if (state === "CLOSED") {
          prFound = tryReopenPR(prUrl, rs.story_id, step.run_id);
        }
      } else if (storyBranchForCheck && context["repo"]) {
        const foundUrl = findPrByBranch(context["repo"], storyBranchForCheck);
        if (foundUrl) {
          prUrl = foundUrl;
          prFound = true;
        }
      }

      // Wave 5 fix #19 (plan: reactive-frolicking-cupcake): validate PR URL
      // format before auto-completing. Previously any non-empty string would
      // auto-complete the story, which meant a malformed or placeholder URL
      // could silently mark work as done. Require the github.com/owner/repo/pull/N
      // shape, and also confirm it belongs to the expected repo.
      const GH_PR_REGEX = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+(?:[?#].*)?$/i;
      const expectedRepoName = (context["repo"] || "").split("/").pop() || "";
      const prUrlValid = prUrl && GH_PR_REGEX.test(prUrl) && (!expectedRepoName || prUrl.includes(`/${expectedRepoName}/`));
      if (prFound && prUrlValid) {
          await pgRun("UPDATE stories SET status = 'done', pr_url = $1, story_branch = $2, updated_at = $3 WHERE id = $4 AND status = 'pending'", [prUrl, storyBranchForCheck, now(), rs.id]);
          await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2 AND current_story_id = $3", [now(), step.id, rs.id]);
        logger.info(`[claim-auto-complete] Story ${rs.story_id} auto-completed — PR exists: ${prUrl}`, { runId: step.run_id });
        emitEvent({ ts: now(), event: "story.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: rs.story_id, storyTitle: rs.title, detail: `Auto-completed — PR exists (${prUrl})` });
        await refreshRunContractSafe(step.run_id, "story.auto_completed");
      } else if (prFound && !prUrlValid) {
        logger.warn(`[claim-auto-complete] Story ${rs.story_id} has PR "${prUrl}" but format invalid or wrong repo — NOT auto-completing`, { runId: step.run_id });
      }
    } catch (e) {
      logger.warn(`[claim-auto-complete] PR check failed for story ${rs.story_id}: ${String(e)}`, { runId: step.run_id });
    }
  }
}

/**
 * Resolve story_screens from SCREEN_MAP for a given storyId.
 * Mutates context["story_screens"] and optionally context["design_warning"].
 */
async function resolveStoryScreens(
  storyId: string,
  context: Record<string, string>,
  runId: string,
  logPrefix: string,
): Promise<void> {
  const screenMapRaw = context["screen_map"];
  if (!screenMapRaw) return;

  try {
    const screenMap = JSON.parse(screenMapRaw);
    if (Array.isArray(screenMap)) {
      const storyScreens = screenMap
        .filter((s: any) => Array.isArray(s.stories) && s.stories.includes(storyId))
        .map((s: any) => ({
          screenId: s.screenId,
          name: s.name,
          type: s.type,
          htmlFile: `stitch/${s.screenId}.html`,
        }));
      context["story_screens"] = JSON.stringify(storyScreens);
      // Warn if referenced screen HTML files don't exist
      const repoPath = context["repo"] || context["REPO"] || "";
      if (repoPath && storyScreens.length > 0) {
        const missing = storyScreens.filter((s: any) => !fs.existsSync(path.join(repoPath, s.htmlFile)));
        if (missing.length > 0) {
          context["design_warning"] = `WARNING: ${missing.length} design reference file(s) missing: ${missing.map((s: any) => s.htmlFile).join(", ")}. Implement based on screen names and design-tokens.css.`;
          logger.warn(`[${logPrefix}] Missing design files for story ${storyId}: ${missing.map((s: any) => s.htmlFile).join(", ")}`, { runId });
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to parse screen_map for story ${storyId}`, { runId });
    context["story_screens"] = "";
  }
}

/**
 * Inject story-specific context vars after a story is claimed in a loop step.
 * Mutates `context` in-place with current_story, completed_stories, story_screens, etc.
 */
async function injectStoryContext(
  nextStory: any,
  step: StepRow,
  context: Record<string, string>,
): Promise<void> {
  await injectStoryContextFromModule(nextStory, step, context, {
    readProgressFile,
    readProjectMemory,
    resolveStoryScreens,
    generateSrcTree,
    getProjectTree,
    getInstalledPackages,
    getSharedCode,
    getRecentStoryCode,
    getComponentRegistry,
    getApiRoutes,
    updateRunContext,
  });
}

/**
 * Inject verify-each story context for the single-step verify claim path.
 * Mutates `context` in-place and updates DB context.
 * Returns false if all stories were auto-verified (caller should return { found: false }).
 */
async function injectVerifyContext(
  step: StepRow,
  context: Record<string, string>,
  db: any,
  agentId: string,
): Promise<boolean> {
  const loopStepForVerify = await findLoopStep(step.run_id);
  if (!loopStepForVerify?.loop_config) return true;

  const lcCheck: LoopConfig = JSON.parse(loopStepForVerify.loop_config);
  if (!lcCheck.verifyEach || lcCheck.verifyStep !== step.step_id) return true;

  // Auto-verify stories whose PRs are already merged/closed-with-ancestry.
  // Also auto-merges OPEN PRs after abandonment (prevents "son mil" loop).
  const nextUnverified = await autoVerifyDoneStories(step.run_id, context, "claim-auto-verify", { autoMergeOpen: true });

  if (!nextUnverified) {
    if (context["verify_quality_failure_routed"]) {
      await updateRunContext(step.run_id, context);
      logger.warn(`[claim-auto-verify] Routed verify smoke failure to implement; suppressing reviewer claim`, { runId: step.run_id });
      return false;
    }
    // All stories auto-verified — no agent work needed, advance pipeline
    await pgRun("UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2", [now(), step.id]);
    logger.info(`[claim-auto-verify] All stories auto-verified, triggering pipeline advancement`, { runId: step.run_id });
    try { await checkLoopContinuation(step.run_id, loopStepForVerify.id); } catch (e) { logger.error("[claim-auto-verify] checkLoopContinuation failed: " + String(e), { runId: step.run_id }); }
    return false;
  }

  // Inject unverified story context for agent verification
  if (!nextUnverified.pr_url && context["auto_pr_create_failed"]) {
    await updateRunContext(step.run_id, context);
    logger.warn(`[claim-auto-verify] Story ${nextUnverified.story_id} has no PR URL after platform auto-PR repair attempt; deferring reviewer claim`, { runId: step.run_id });
    return false;
  }

  if (isStorySupervised(context, nextUnverified.story_id)) {
    clearVerifiedStoryFailureContext(context);
  }

  if (nextUnverified.output) {
    const storyOutput = parseOutputKeyValues(nextUnverified.output);
    for (const [key, value] of Object.entries(storyOutput)) {
      if (isStepOutputContextKeyProtected(key, context)) continue;
      context[key] = value;
    }
  }
  // Override with DB columns if available (more reliable than output parse)
  if (nextUnverified.pr_url) context["pr_url"] = nextUnverified.pr_url;
  if (nextUnverified.story_branch) context["story_branch"] = nextUnverified.story_branch;
  context["current_story_id"] = nextUnverified.story_id;
  context["current_story_title"] = nextUnverified.title;
  if (nextUnverified.story_branch) {
    const workdir = ensureStoryAuditWorkdir(context, nextUnverified.story_branch, agentId, step.run_id, nextUnverified.story_id, "verify_each");
    if (!workdir) {
      const failure = `PLATFORM_STORY_WORKTREE_MISSING: ${nextUnverified.story_id} has branch ${nextUnverified.story_branch}, but Setfarm could not prepare a story worktree for reviewer verification. Reviewer must not audit the main repo fallback.`;
      context["previous_failure"] = failure;
      context["failure_category"] = "PLATFORM_STORY_WORKTREE_MISSING";
      context["failure_suggestion"] = "Fix Setfarm worktree rehydration or repo branch state before spawning supervisor/reviewer agents.";
      await updateRunContext(step.run_id, context);
      return false;
    }
  }
  if (await routeBlockingSupervisorEvidenceToImplement({
    runId: step.run_id,
    verifyStepId: step.id,
    verifyStepName: step.step_id,
    loopStepId: loopStepForVerify.id,
    story: nextUnverified,
    context,
    workdirs: [context["story_workdir"], context["repo"]],
  })) {
    return false;
  }
  if (step.retry_count === 0 && context["previous_failure"]) {
    const staleImplementFailure = /\b(RUNTIME_BRIDGE_MISSING|BUILD_FAILED|TEST_FAILED|SCOPE_BLEED|SCOPE_WRITE_VIOLATION|NO_WORK|SCOPE_FILE_MISSING|PRODUCT_SUPERVISOR_IMPLEMENT_BLOCKED)\b/i
      .test(`${context["failure_category"] || ""}\n${context["previous_failure"] || ""}`);
    if (staleImplementFailure) {
      delete context["previous_failure"];
      delete context["failure_category"];
      delete context["failure_suggestion"];
    }
  }
  const storyObj: Story = {
    id: nextUnverified.id, runId: nextUnverified.run_id,
    storyIndex: nextUnverified.story_index, storyId: nextUnverified.story_id,
    title: nextUnverified.title, description: nextUnverified.description,
    acceptanceCriteria: parseAcceptanceCriteria(nextUnverified.acceptance_criteria),
    status: nextUnverified.status, output: nextUnverified.output,
    retryCount: nextUnverified.retry_count, maxRetries: nextUnverified.max_retries,
  };
  context["current_story"] = formatStoryForTemplate(storyObj);

  // Resolve story_screens from SCREEN_MAP for verify_each
  await resolveStoryScreens(nextUnverified.story_id, context, step.run_id, "verify-claim");

  await pgRun("UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(context), now(), step.run_id]);
  logger.info(`Verify step: injected story ${nextUnverified.story_id} context`, { runId: step.run_id });

  return true;
}

async function injectSuperviseEachContext(
  step: StepRow,
  context: Record<string, string>,
  agentId: string,
  authenticatedSubject?: V3StoryClaimRuntimeSubjectV1,
): Promise<boolean> {
  if (authenticatedSubject?.kind === "final_product") {
    context["supervisor_scope"] = "final-product";
    delete context["current_story_id"];
    delete context["current_story_title"];
    delete context["current_story"];
    delete context["story_workdir"];
    delete context["story_scope_files"];
    delete context["story_shared_files"];
    delete context["scope_reminder"];
    delete context["pr_url"];
    delete context["story_branch"];
    delete context["story_diff_base"];
    await updateRunContext(step.run_id, context);
    return true;
  }
  const loopStepForSupervise = await findLoopStep(step.run_id);
  if (!loopStepForSupervise?.loop_config) return true;

  const lcCheck: LoopConfig = JSON.parse(loopStepForSupervise.loop_config);
  if (!lcCheck.superviseEach || (lcCheck.superviseStep || "supervise") !== step.step_id) return true;

  let story: any | undefined;
  if (authenticatedSubject?.kind === "story_member") {
    story = await pgGet<any>(
      `SELECT * FROM stories
        WHERE run_id = $1 AND id = $2 AND story_id = $3 AND story_index = $4
          AND claim_generation = $5 AND status = 'done'
        LIMIT 1`,
      [
        step.run_id,
        authenticatedSubject.storyDbId,
        authenticatedSubject.storyId,
        authenticatedSubject.storyIndex,
        authenticatedSubject.storyClaimGeneration,
      ],
    );
    if (!story) throw new Error("V3_SUPERVISE_AUTHENTICATED_STORY_MISSING");
  } else if (step.current_story_id) {
    story = await pgGet<any>(
      "SELECT * FROM stories WHERE run_id = $1 AND id = $2 AND status = 'done' LIMIT 1",
      [step.run_id, step.current_story_id],
    );
  }
  const currentStoryId = context["current_story_id"] || "";
  if (!authenticatedSubject && !story && currentStoryId) {
    story = await pgGet<any>(
      "SELECT * FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [step.run_id, currentStoryId],
    );
  }
  if (!authenticatedSubject && !story) {
    story = await findUnsupervisedDoneStory(step.run_id, context);
  }
  if (!story) {
    const remainingStoryWork = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending','running','done')",
      [step.run_id],
    );
    const loopStatus = await pgGet<{ status: string }>(
      "SELECT status FROM steps WHERE run_id = $1 AND type = 'loop' AND step_id = 'implement' LIMIT 1",
      [step.run_id],
    );
    if (loopStatus?.status === "done" && parseInt(remainingStoryWork?.cnt || "0", 10) === 0) {
      context["supervisor_scope"] = "final-product";
      delete context["current_story_id"];
      delete context["current_story_title"];
      delete context["current_story"];
      delete context["story_scope_files"];
      delete context["story_shared_files"];
      delete context["scope_reminder"];
      delete context["pr_url"];
      delete context["story_branch"];
      if (/SUPERVISOR_AC_CONTEXT_MISSING|story-scoped supervisor/i.test(context["previous_failure"] || "")) {
        delete context["previous_failure"];
        delete context["failure_category"];
        delete context["failure_suggestion"];
      }
      await updateRunContext(step.run_id, context);
      logger.info(`[supervise-each] No story remains to audit; claiming ${step.step_id} as final-product supervisor`, { runId: step.run_id });
    }
    return true;
  }

  const storyBranch = (story.story_branch || `${step.run_id.slice(0, 8)}-${story.story_id}`).toLowerCase();
  const storyDiffBase = (lcCheck.mergeStrategy === "pr-each" || lcCheck.verifyEach)
    ? "main"
    : (context["story_base_ref"] || context["branch"] || "main");
  context["supervisor_scope"] = "story";
  context["current_story_id"] = story.story_id;
  context["current_story_title"] = story.title || "";
  if (story.pr_url) context["pr_url"] = story.pr_url;
  context["story_branch"] = storyBranch;
  context["story_diff_base"] = storyDiffBase;

  const workdir = ensureStoryAuditWorkdir(context, storyBranch, agentId, step.run_id, story.story_id, "supervise_each");
  if (!workdir) {
    const failure = `PLATFORM_STORY_WORKTREE_MISSING: ${story.story_id} has branch ${storyBranch}, but Setfarm could not prepare a story worktree for supervisor audit. Supervisor must not audit the main repo fallback.`;
    context["previous_failure"] = failure;
    context["failure_category"] = "PLATFORM_STORY_WORKTREE_MISSING";
    context["failure_suggestion"] = "Fix Setfarm worktree rehydration or repo branch state before spawning supervisor/reviewer agents.";
    await updateRunContext(step.run_id, context);
    return false;
  }
  syncStoryScopeContext(context, story, workdir, step.run_id);
  upsertSupervisorRunMetadata({
    workdir,
    runId: step.run_id,
    scope: "story",
    status: "active",
    mainRepo: context["repo"] || "",
    storyId: story.story_id,
    storyWorkdir: workdir,
    supervisorSessionId: agentId,
  });

  const storyObj: Story = {
    id: story.id,
    runId: story.run_id,
    storyIndex: story.story_index,
    storyId: story.story_id,
    title: story.title,
    description: story.description || "",
    acceptanceCriteria: parseAcceptanceCriteria(story.acceptance_criteria),
    status: story.status,
    output: story.output,
    retryCount: story.retry_count,
    maxRetries: story.max_retries,
  };
  context["current_story"] = formatStoryForTemplate(storyObj);
  await updateRunContext(step.run_id, context);
  return true;
}

/**
 * Claim a single (non-loop) step: atomic claim, optional verify context injection,
 * progress/stories injection, and missing-input guard.
 * Returns a ClaimResult.
 */
async function publishSingleClaimAndRuntime(
  step: StepRow,
  claimAgentId: string,
  rawRuntimeIntent?: RuntimeClaimIntentV1,
  planAuthoritySeal?: Readonly<{
    productSemanticsVersion: "v2";
    outputAuthorityVersion: "product_build_v1";
  }>,
  storyAdmissionProof?: CompilerStoryEnglishAdmissionClaimProofV1,
  storySubject?: Readonly<
    | { kind: "story_member"; storyDbId: string; storyId: string }
    | { kind: "final_product" }
  >,
): Promise<Readonly<{
  claimId: number;
  protocol: "legacy" | "shadow" | "v3";
  runtime?: RuntimeClaimOwnership;
  storySubject?: V3StoryClaimRuntimeSubjectV1;
}> | undefined> {
  return publishSingleClaimRuntime(getSql(), {
    runId: step.run_id,
    stepDbId: step.id,
    workflowStepId: step.step_id,
    claimAgentId,
    runtimeIntent: rawRuntimeIntent,
    planAuthoritySeal,
    storyAdmissionProof,
    storySubject,
  });
}

async function publishLoopClaimAndRuntime(
  step: StepRow,
  story: any,
  claimAgentId: string,
  callerGatewayAgent: string | undefined,
  parallelLimit: number,
  rawRuntimeIntent?: RuntimeClaimIntentV1,
  recoveryHandoff?: V3RecoveryClaimHandoffV1,
  preparationAuthority?: V3PreparationClaimAuthorityV1,
  storyAdmissionProof?: CompilerStoryEnglishAdmissionClaimProofV1,
  supervisorRetryPreparationSource?: AuthenticatedV3SupervisorRetryPreparationSourceV1,
): Promise<Readonly<{
  claimId: number;
  claimGeneration: number;
  protocol: "legacy" | "shadow" | "v3";
  runtime?: RuntimeClaimOwnership;
  baseRevision?: V3PreparationClaimAuthorityV1["baseRevision"];
  claimAuthority?: LoopClaimAuthorityPublication;
  storySubject?: V3StoryClaimRuntimeSubjectV1;
}> | undefined> {
  return publishLoopClaimRuntime(getSql(), {
    runId: step.run_id,
    stepDbId: step.id,
    workflowStepId: step.step_id,
    storyDbId: story.id,
    storyId: story.story_id,
    claimAgentId,
    callerGatewayAgent,
    parallelLimit,
    runtimeIntent: rawRuntimeIntent,
    recoveryHandoff,
    preparationAuthority,
    storyAdmissionProof,
    supervisorRetryPreparationSource,
  });
}

function recoveryBranchName(work: V3RecoveryRoutedWork): string {
  const dispatchToken = work.handoff.dispatchId.replace(/^RDISP_/, "").slice(0, 16);
  return `recovery-${work.step.run_id.slice(0, 8)}-${dispatchToken}`.toLowerCase();
}

function sameRecoverySource(
  observed: Readonly<{ sha: string; treeHash: string }>,
  expected: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return observed.sha.toLowerCase() === expected.sha.toLowerCase()
    && observed.treeHash.toLowerCase() === expected.treeHash.toLowerCase();
}

async function recordRecoveryPreparationFailure(
  work: V3RecoveryRoutedWork,
  code: string,
  detail: string,
): Promise<void> {
  await recordObservation({
    runId: work.step.run_id,
    stepId: work.step.step_id,
    storyId: work.story.story_id,
    phase: "v3-recovery-claim",
    checkId: `v3_recovery.claim_preparation:${work.handoff.dispatchId}`,
    label: "V3 recovery claim preparation",
    status: "blocked",
    summary: code,
    detail: detail.slice(0, 4_000),
    evidence: {
      schema: "setfarm.v3-recovery-claim-preparation-failure.v1",
      code,
      recoveryCaseId: work.handoff.recoveryCaseId,
      revisionId: work.handoff.revisionId,
      dispatchId: work.handoff.dispatchId,
      dispatchClass: work.handoff.dispatchClass,
      findingSetHash: work.handoff.directive.findingSetHash,
      sourceRevision: work.handoff.directive.sourceRevision,
      leaseOwner: work.handoff.lease.ownerInstanceId,
    },
  });
}

/**
 * Canonical v3 recovery never re-enters the legacy pending-story/retry path.
 * The durable delivery lease selects one exact failed story and source revision;
 * this function turns that lease into one bound claim/runtime/attempt handoff.
 */
async function claimV3RecoveryWork(
  work: V3RecoveryRoutedWork,
  agentId: string,
  callerGatewayAgent: string | undefined,
  runtimeIntent: RuntimeClaimIntentV1,
  executionRole: "developer" | "supervisor",
  storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1,
): Promise<ClaimResult> {
  const step: StepRow = work.step;
  const story: any = { ...work.story };
  const handoff = work.handoff;
  if (step.step_id !== "implement" || step.type !== "loop" || story.status !== "failed") {
    throw new Error("V3_RECOVERY_ROUTED_WORK_INVALID");
  }
  if (runtimeIntent.ownerInstanceId !== handoff.lease.ownerInstanceId) {
    throw new Error("V3_RECOVERY_RUNTIME_LEASE_OWNER_MISMATCH");
  }
  const expectedDispatchClass = executionRole === "supervisor"
    ? "supervisor_repair"
    : "product_implementation";
  const expectedRecoveryOwner = executionRole === "supervisor" ? "supervisor" : "implement";
  if (
    handoff.dispatchClass !== expectedDispatchClass
    || handoff.recoveryOwner !== expectedRecoveryOwner
  ) {
    throw new Error("V3_RECOVERY_EXECUTION_ROLE_MISMATCH");
  }

  const context: Record<string, string> = await getRunContext(step.run_id);
  context["run_id"] = step.run_id;
  if (context["repo"] && step.step_index >= 4) {
    normalizeRunBranchContext(context, step.run_id, context["repo"]);
  }
  const repo = String(context["repo"] || "").trim();
  if (!repo || !fs.existsSync(repo) || !fs.existsSync(path.join(repo, ".git"))) {
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_REPO_UNAVAILABLE",
      "Canonical recovery source repository is absent; the leased delivery was not published as a model claim",
    );
    return { found: false };
  }

  const baseRef = handoff.directive.sourceRevision.sha.toLowerCase();
  try {
    const resolved = execFileSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim().toLowerCase();
    if (resolved !== baseRef) throw new Error(`resolved ${resolved || "empty"}`);
  } catch (error) {
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_SOURCE_COMMIT_UNAVAILABLE",
      `Dispatch source commit ${baseRef} is not available in the canonical repository: ${String(error).slice(0, 500)}`,
    );
    return { found: false };
  }

  const storyBranch = recoveryBranchName(work);
  const storyWorkdir = createStoryWorktree(repo, storyBranch, baseRef, agentId);
  if (!storyWorkdir) {
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_WORKTREE_PREPARATION_FAILED",
      `Could not create an isolated worktree at dispatch source ${baseRef}`,
    );
    return { found: false };
  }
  let observedSource: Awaited<ReturnType<typeof captureShadowSourceRevision>>;
  try {
    observedSource = await captureShadowSourceRevision(storyWorkdir);
  } catch (error) {
    removeStoryWorktree(repo, storyBranch, agentId);
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_SOURCE_CAPTURE_FAILED",
      `Could not fingerprint the prepared recovery worktree: ${String(error).slice(0, 500)}`,
    );
    return { found: false };
  }
  if (!sameRecoverySource(observedSource, handoff.directive.sourceRevision)) {
    removeStoryWorktree(repo, storyBranch, agentId);
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_SOURCE_REVISION_MISMATCH",
      `Prepared source ${observedSource.sha}/${observedSource.treeHash} differs from dispatch ${baseRef}/${handoff.directive.sourceRevision.treeHash}`,
    );
    return { found: false };
  }

  const publication = await publishLoopClaimAndRuntime(
    step,
    story,
    agentId,
    callerGatewayAgent,
    1,
    runtimeIntent,
    handoff,
    undefined,
    storyAdmissionProof,
  );
  if (!publication) {
    removeStoryWorktree(repo, storyBranch, agentId);
    return { found: false };
  }
  if (
    publication.protocol !== "v3"
    || publication.claimAuthority?.mode !== "recovery"
    || publication.claimAuthority.handoff.dispatchId !== handoff.dispatchId
    || publication.claimAuthority.handoff.revisionId !== handoff.revisionId
    || publication.storySubject?.kind !== "story_member"
    || publication.storySubject.storyDbId !== story.id
    || publication.storySubject.storyId !== story.story_id
  ) {
    throw new Error("V3_RECOVERY_PUBLICATION_AUTHORITY_MISMATCH");
  }

  const legacyClaimId = publication.claimId;
  const claimRuntime = publication.runtime;
  story.claim_generation = publication.claimGeneration;
  story.status = "running";
  story.claimed_by = agentId;
  context["story_branch"] = storyBranch;
  context["story_workdir"] = storyWorkdir;
  context["story_base_ref"] = baseRef;
  context["claim_generation"] = String(publication.claimGeneration);
  await pgRun(
    "UPDATE stories SET story_branch = $1, updated_at = $2 WHERE id = $3 AND status = 'running'",
    [storyBranch, now(), story.id],
  );
  await recordStepTransition(
    step.id,
    step.run_id,
    step.step_status,
    "running",
    agentId,
    "claimV3RecoveryWork",
    { storyId: story.story_id, dispatchId: handoff.dispatchId },
  );

  await injectStoryContext(story, step, context);
  let compiled: V3ImplementationAttemptResult;
  try {
    compiled = await reserveV3ImplementationAttempt({
      runId: step.run_id,
      stepId: step.step_id,
      storyId: story.story_id,
      claimId: legacyClaimId,
      role: executionRole,
      agentId,
      branch: storyBranch,
      worktree: storyWorkdir,
      findingSetHash: handoff.directive.findingSetHash,
      recoveryDelivery: {
        dispatchId: handoff.dispatchId,
        revisionId: handoff.revisionId,
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseToken: handoff.lease.leaseToken,
      },
    });
  } catch (error) {
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_ATTEMPT_RESERVATION_FAILED",
      String((error as Error)?.message || error),
    );
    // The lifecycle reconciler owns this exact post-publication/pre-attempt
    // crash window. Never turn the failed story back into generic pending work.
    return { found: false };
  }
  applyV3ImplementationSliceContext(context, compiled);
  const v3ImplementationHandoff = createV3ImplementationAttemptHandoffV1({
    stepDbId: step.id,
    storyDbId: story.id,
    claimId: legacyClaimId,
    branch: storyBranch,
    workdir: storyWorkdir,
    compiled,
  });
  const prunedContext = pruneContextForStep(context, step.step_id);
  const resolvedInput = await resolveLoopClaimInput(step, prunedContext, context);
  const missing = [...new Set(
    [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map((match) => match[1]!.toLowerCase()),
  )];
  if (missing.length > 0) {
    await recordRecoveryPreparationFailure(
      work,
      "V3_RECOVERY_CONTEXT_INCOMPLETE",
      `Sealed recovery input still has unresolved variables: ${missing.join(", ")}`,
    );
    throw new Error(`V3_RECOVERY_CONTEXT_INCOMPLETE:${missing.join(",")}`);
  }
  if (!claimRuntime) throw new Error("V3_RECOVERY_RUNTIME_PUBLICATION_MISSING");
  await pgBegin((sql) => bindRuntimeSessionAttemptInTransaction(sql, {
    sessionId: claimRuntime.sessionId,
    attemptId: compiled.attempt.attemptId,
    ownerInstanceId: claimRuntime.ownerInstanceId,
  }));

  emitEvent({
    ts: now(),
    event: "story.started",
    runId: step.run_id,
    workflowId: await getWorkflowId(step.run_id),
    stepId: step.step_id,
    agentId,
    storyId: story.story_id,
    storyTitle: story.title,
    detail: `canonical recovery ${handoff.dispatchClass} ${handoff.dispatchId}`,
  });
  logger.info(`[v3-recovery] Bound ${handoff.dispatchClass} ${handoff.dispatchId} to ${compiled.attempt.attemptId}`, {
    runId: step.run_id,
    stepId: step.step_id,
  });
  return {
    found: true,
    stepId: step.id,
    workflowStepId: step.step_id,
    runId: step.run_id,
    protocol: "v3",
    storyId: story.story_id,
    storyDbId: story.id,
    claimGeneration: publication.claimGeneration,
    attempt: {
      attemptId: compiled.attempt.attemptId,
      generation: compiled.attempt.generation,
      fenceToken: compiled.attempt.fenceToken,
    },
    claimId: legacyClaimId,
    claimAgentId: agentId,
    runtimeSessionId: claimRuntime.sessionId,
    runtimeOwnerInstanceId: claimRuntime.ownerInstanceId,
    recoveryDispatchId: handoff.dispatchId,
    recoveryRevisionId: handoff.revisionId,
    recoveryLeaseToken: handoff.lease.leaseToken,
    v3ImplementationHandoff,
    resolvedInput,
  };
}

type RunningSingleStepClaimReissueV1 = Readonly<
  | { status: "absent" }
  | { status: "refused" }
  | {
      status: "authenticated";
      claimId: number;
      runtime?: RuntimeClaimOwnership & {
        state: "reserved" | "starting" | "running";
      };
    }
>;

type RunningSingleStepOwnerReservationRowV1 = Readonly<{
  reservation_ref: string;
  reservation_hash: string;
  category: string;
  owner_key: string;
  owner_key_hash: string;
  producer_purpose_hash: string;
  producer_implementation_id: string;
  producer_implementation_hash: string;
  reservation_payload: unknown;
  reservation_head_predecessor_hash: string;
  state: string;
  canonical_owner_identity: unknown | null;
  binding_hash: string | null;
  binding_payload: unknown | null;
  close_kind: string | null;
  terminal_owner_ref: string | null;
  terminal_owner_hash: string | null;
  close_head_predecessor_hash: string | null;
  close_head_successor_hash: string | null;
  preserved_fence_ref: string | null;
  preserved_fence_hash: string | null;
  close_ref: string | null;
  close_hash: string | null;
  close_payload: unknown | null;
  head_version: string | number;
}>;

type RunningSingleStepOwnerAuthorityRowV1 = Readonly<{
  authority_ref: string;
  authority_hash: string;
  authority_kind: string;
  phase_key: string;
  predecessor_head_hash: string;
  successor_head_hash: string;
  authority_body: unknown;
}>;

type RunningSingleStepOwnerMigrationApplicationV1 = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1";
  evidenceHash: string;
  authorizationRef: string;
  authorizationHash: string;
  authorizationConsumptionRef: string;
  authorizationConsumptionHash: string;
  applicationHash: string;
}>;

type RunningSingleStepOwnerAdvancingAuthorityV1 = Readonly<{
  version: number;
  authority: RunningSingleStepOwnerAuthorityRowV1;
}>;

const RUNNING_SINGLE_STEP_OWNER_SHA256_V1 = /^[a-f0-9]{64}$/;
const RUNNING_SINGLE_STEP_OWNER_REF_V1 = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;

function validateRunningSingleStepOwnerMigrationApplicationV1(
  value: unknown,
  evidenceHash: string,
): RunningSingleStepOwnerMigrationApplicationV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  }
  const application = value as Record<string, unknown>;
  const keys = Object.keys(application);
  const expectedKeys = [
    "schema", "evidenceHash", "authorizationRef", "authorizationHash",
    "authorizationConsumptionRef", "authorizationConsumptionHash", "applicationHash",
  ];
  if (
    keys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(application, key))
    || application.schema !== "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1"
    || application.evidenceHash !== evidenceHash
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(evidenceHash)
    || evidenceHash === "0".repeat(64)
    || !RUNNING_SINGLE_STEP_OWNER_REF_V1.test(String(application.authorizationRef))
    || !RUNNING_SINGLE_STEP_OWNER_REF_V1.test(String(application.authorizationConsumptionRef))
    || [
      application.authorizationHash,
      application.authorizationConsumptionHash,
      application.applicationHash,
    ].some((hash) => typeof hash !== "string" || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(hash))
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  const body = {
    schema: application.schema,
    evidenceHash: application.evidenceHash,
    authorizationRef: application.authorizationRef,
    authorizationHash: application.authorizationHash,
    authorizationConsumptionRef: application.authorizationConsumptionRef,
    authorizationConsumptionHash: application.authorizationConsumptionHash,
  };
  if (application.applicationHash !== hashCanonicalJson(body)) {
    throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  }
  return Object.freeze({
    ...body,
    applicationHash: application.applicationHash,
  }) as RunningSingleStepOwnerMigrationApplicationV1;
}

function runningSingleStepOwnerAdmissionSuccessorV1(input: Readonly<{
  version: number;
  predecessorHeadHash: string;
  transitionKind: "reservation" | "close" | "fence" | "release";
  transitionRef: string;
  transitionHash: string;
  migrationApplication: RunningSingleStepOwnerMigrationApplicationV1;
}>): Readonly<{ version: number; hash: string; payload: Readonly<Record<string, unknown>> }> {
  const payload = Object.freeze({
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: input.version + 1,
    predecessorHeadHash: input.predecessorHeadHash,
    transitionKind: input.transitionKind,
    transitionRef: input.transitionRef,
    transitionHash: input.transitionHash,
    migrationApplication: input.migrationApplication,
  });
  return Object.freeze({
    version: input.version + 1,
    hash: hashCanonicalJson(payload),
    payload,
  });
}

async function validateRunningSingleStepOwnerAncestryV1(
  sql: PgTransactionSql,
  headHash: string,
  version: number,
  migrationApplication: RunningSingleStepOwnerMigrationApplicationV1,
  seen = new Set<string>(),
): Promise<readonly RunningSingleStepOwnerAdvancingAuthorityV1[]> {
  if (
    !Number.isSafeInteger(version)
    || version < 0
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(headHash)
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  if (version === 0) {
    if (headHash !== "0".repeat(64)) {
      throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
    }
    return Object.freeze([]);
  }
  if (seen.has(headHash)) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  seen.add(headHash);
  const authorities = await sql.unsafe<RunningSingleStepOwnerAuthorityRowV1[]>(
    `SELECT authority_ref,authority_hash,authority_kind,phase_key,
            predecessor_head_hash,successor_head_hash,authority_body
       FROM internal_production_owner_admission_authorities_v1
      WHERE successor_head_hash=$1 AND predecessor_head_hash<>successor_head_hash`,
    [headHash],
  );
  const fenceAuthorities = authorities.filter(({ authority_kind }) => authority_kind === "fence");
  if (fenceAuthorities.length === 1) {
    const authority = fenceAuthorities[0]!;
    const fence = validateInternalProductionGlobalOwnerAdmissionFenceV1(authority.authority_body);
    const expectedCount = fence.targetFamily.kind === "source-run-launch" ? 3 : 1;
    const transition = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
      purpose: fence.purpose,
      pendingInputRef: fence.pendingInputRef,
      pendingInputHash: fence.pendingInputHash,
      targetFamilyHash: fence.targetFamily.kind === "source-run-launch"
        ? fence.targetFamily.targetFamilyHash
        : hashCanonicalJson(fence.targetFamily),
      ownerIdentitySetHash: fence.ownerIdentitySetHash,
    });
    const expectedSuccessor = runningSingleStepOwnerAdmissionSuccessorV1({
      version: version - 1,
      predecessorHeadHash: authority.predecessor_head_hash,
      transitionKind: "fence",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication,
    });
    if (
      authorities.length !== expectedCount
      || expectedSuccessor.hash !== headHash
      || fence.ownerAdmissionHeadHash !== headHash
      || authority.authority_ref !== fence.fenceRef
      || authority.authority_hash !== fence.fenceHash
      || authority.phase_key !== fence.pendingInputRef
      || authority.predecessor_head_hash !== fence.predecessorFenceHeadHash
      || canonicalJsonStringify(authority.authority_body) !== canonicalJsonStringify(fence)
    ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
    if (fence.targetFamily.kind === "source-run-launch") {
      const reservations = authorities.filter(({ authority_kind }) => authority_kind === "reservation");
      const expectedPairs = [
        fence.targetFamily.sourceRunReservation,
        fence.targetFamily.runReservation,
      ];
      if (
        reservations.length !== 2
        || expectedPairs.some((pair) => !reservations.some((candidate) => (
          candidate.authority_ref === pair.reservationRef
          && candidate.authority_hash === pair.reservationHash
          && candidate.predecessor_head_hash === authority.predecessor_head_hash
          && candidate.successor_head_hash === headHash
        )))
      ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
    }
    const predecessors = await validateRunningSingleStepOwnerAncestryV1(
      sql,
      authority.predecessor_head_hash,
      version - 1,
      migrationApplication,
      seen,
    );
    return Object.freeze([
      ...authorities.map((member) => Object.freeze({ version, authority: member })),
      ...predecessors,
    ]);
  }
  const authority = authorities[0];
  if (authorities.length !== 1 || !authority) {
    throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  }
  let expectedSuccessor: ReturnType<typeof runningSingleStepOwnerAdmissionSuccessorV1>;
  if (authority.authority_kind === "reservation") {
    const body = authority.authority_body as Partial<{
      producerImplementationId: string;
    }>;
    const producer = typeof body.producerImplementationId === "string"
      ? INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows.find(
        ({ implementationId }) => implementationId === body.producerImplementationId,
      )
      : undefined;
    if (!producer) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
    const reservation = validateInternalProductionOwnerReservationV1(authority.authority_body, producer);
    expectedSuccessor = runningSingleStepOwnerAdmissionSuccessorV1({
      version: version - 1,
      predecessorHeadHash: reservation.ownerAdmissionHeadPredecessorHash,
      transitionKind: "reservation",
      transitionRef: reservation.reservationRef,
      transitionHash: reservation.reservationHash,
      migrationApplication,
    });
    if (
      authority.authority_ref !== reservation.reservationRef
      || authority.authority_hash !== reservation.reservationHash
      || authority.phase_key !== reservation.reservationRef
      || authority.predecessor_head_hash !== reservation.ownerAdmissionHeadPredecessorHash
      || canonicalJsonStringify(authority.authority_body) !== canonicalJsonStringify(reservation)
    ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  } else if (authority.authority_kind === "close") {
    const close = validateInternalProductionOwnerReservationCloseV1(authority.authority_body);
    const transitionHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
      reservationRef: close.reservationRef,
      reservationHash: close.reservationHash,
      terminalOwnerRef: close.terminalOwnerRef,
      terminalOwnerHash: close.terminalOwnerHash,
    });
    expectedSuccessor = runningSingleStepOwnerAdmissionSuccessorV1({
      version: version - 1,
      predecessorHeadHash: close.ownerAdmissionHeadPredecessorHash,
      transitionKind: "close",
      transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${transitionHash}`,
      transitionHash,
      migrationApplication,
    });
    if (
      authority.authority_ref !== close.closeRef
      || authority.authority_hash !== close.closeHash
      || authority.phase_key !== close.reservationRef
      || authority.predecessor_head_hash !== close.ownerAdmissionHeadPredecessorHash
      || canonicalJsonStringify(authority.authority_body) !== canonicalJsonStringify(close)
    ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  } else if (authority.authority_kind === "release") {
    const release = validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(
      authority.authority_body,
    );
    const transition = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
      fenceRef: release.fenceRef,
      fenceHash: release.fenceHash,
      releaseAuthority: release.releaseAuthority,
    });
    expectedSuccessor = runningSingleStepOwnerAdmissionSuccessorV1({
      version: version - 1,
      predecessorHeadHash: release.ownerAdmissionHeadPredecessorHash,
      transitionKind: "release",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication,
    });
    if (
      authority.authority_ref !== release.releaseRef
      || authority.authority_hash !== release.releaseHash
      || authority.phase_key !== release.fenceRef
      || authority.predecessor_head_hash !== release.ownerAdmissionHeadPredecessorHash
      || canonicalJsonStringify(authority.authority_body) !== canonicalJsonStringify(release)
    ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  } else {
    throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  }
  if (
    expectedSuccessor.version !== version
    || expectedSuccessor.hash !== headHash
    || authority.successor_head_hash !== headHash
    || authority.predecessor_head_hash !== expectedSuccessor.payload.predecessorHeadHash
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  const predecessors = await validateRunningSingleStepOwnerAncestryV1(
    sql,
    authority.predecessor_head_hash,
    version - 1,
    migrationApplication,
    seen,
  );
  return Object.freeze([Object.freeze({ version, authority }), ...predecessors]);
}

async function observeRunningSingleStepOwnerAncestryV1(
  sql: PgTransactionSql,
): Promise<readonly RunningSingleStepOwnerAdvancingAuthorityV1[]> {
  const heads = await sql.unsafe<Array<{
    head_version: string | number;
    head_hash: string;
    active_fence_ref: string | null;
    active_fence_hash: string | null;
    active_target_family_hash: string | null;
    migration_application_evidence_hash: string;
    head_payload: unknown;
  }>>(
    `SELECT head_version,head_hash,active_fence_ref,active_fence_hash,
            active_target_family_hash,migration_application_evidence_hash,head_payload
       FROM internal_production_owner_admission_head_v1
      WHERE singleton=TRUE
      FOR UPDATE`,
  );
  const head = heads[0];
  const version = Number(head?.head_version);
  if (
    heads.length !== 1
    || !head
    || !Number.isSafeInteger(version)
    || version < 0
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(head.head_hash)
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(head.migration_application_evidence_hash)
    || (head.active_fence_ref === null) !== (head.active_fence_hash === null)
    || (head.active_target_family_hash !== null && head.active_fence_ref === null)
    || head.active_fence_ref !== null
    || head.active_fence_hash !== null
    || head.active_target_family_hash !== null
    || head.head_payload === null
    || typeof head.head_payload !== "object"
    || Array.isArray(head.head_payload)
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  const headPayload = head.head_payload as Record<string, unknown>;
  const expectedPayloadKeys = version === 0
    ? ["schema", "version", "migrationApplication"]
    : [
        "schema", "version", "predecessorHeadHash", "transitionKind",
        "transitionRef", "transitionHash", "migrationApplication",
      ];
  const payloadKeys = Object.keys(headPayload);
  if (
    payloadKeys.length !== expectedPayloadKeys.length
    || expectedPayloadKeys.some((key) => !Object.prototype.hasOwnProperty.call(headPayload, key))
    || headPayload.schema !== "setfarm.internal-production-owner-admission-head.v1"
    || headPayload.version !== version
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  const migrationApplication = validateRunningSingleStepOwnerMigrationApplicationV1(
    headPayload.migrationApplication,
    head.migration_application_evidence_hash,
  );
  if (version === 0) {
    if (head.head_hash !== "0".repeat(64)) {
      throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
    }
  } else if (
    typeof headPayload.predecessorHeadHash !== "string"
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(headPayload.predecessorHeadHash)
    || !["reservation", "close", "fence", "release"].includes(String(headPayload.transitionKind))
    || typeof headPayload.transitionRef !== "string"
    || !RUNNING_SINGLE_STEP_OWNER_REF_V1.test(headPayload.transitionRef)
    || typeof headPayload.transitionHash !== "string"
    || !RUNNING_SINGLE_STEP_OWNER_SHA256_V1.test(headPayload.transitionHash)
    || hashCanonicalJson(headPayload) !== head.head_hash
  ) throw new Error("RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID");
  return validateRunningSingleStepOwnerAncestryV1(
    sql,
    head.head_hash,
    version,
    migrationApplication,
  );
}

async function authenticateRunningSingleStepOwnerSidecarsV1(
  sql: PgTransactionSql,
  expected: ReadonlyArray<Readonly<{
    ownerKey: string;
    category: "claim" | "runtime-session";
    implementation: "a-claim-single-runtime-v1" | "a-runtime-session-v1";
    identity: ReturnType<
      typeof createInternalProductionClaimCanonicalOwnerIdentityV1
      | typeof createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1
    >;
  }>>,
): Promise<boolean> {
  let ancestry: readonly RunningSingleStepOwnerAdvancingAuthorityV1[];
  try {
    ancestry = await observeRunningSingleStepOwnerAncestryV1(sql);
  } catch {
    return false;
  }
  const rows = await sql.unsafe<RunningSingleStepOwnerReservationRowV1[]>(
    `SELECT reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
            producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
            reservation_payload,reservation_head_predecessor_hash,state,
            canonical_owner_identity,binding_hash,binding_payload,close_kind,
            terminal_owner_ref,terminal_owner_hash,close_head_predecessor_hash,
            close_head_successor_hash,preserved_fence_ref,preserved_fence_hash,
            close_ref,close_hash,close_payload,head_version
       FROM internal_production_owner_reservations_v1
      WHERE owner_key = ANY($1::text[])
      ORDER BY owner_key,reservation_ref
      FOR UPDATE`,
    [expected.map(({ ownerKey }) => ownerKey)],
  );
  if (rows.length !== expected.length) return false;
  for (const authority of expected) {
    const matching = rows.filter((row) => row.owner_key === authority.ownerKey);
    if (matching.length !== 1) return false;
    const row = matching[0]!;
    const producer = INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows.find(
      ({ implementationId }) => implementationId === authority.implementation,
    );
    if (!producer) return false;
    try {
      const reservation = validateInternalProductionOwnerReservationV1(
        row.reservation_payload,
        producer,
      );
      const identity = validateInternalProductionCanonicalOwnerIdentityV1(
        row.canonical_owner_identity,
      );
      const bound = validateInternalProductionBoundOwnerReservationV1(row.binding_payload);
      const reservationAuthorities = await sql.unsafe<RunningSingleStepOwnerAuthorityRowV1[]>(
        `SELECT authority_ref,authority_hash,authority_kind,phase_key,
                predecessor_head_hash,successor_head_hash,authority_body
           FROM internal_production_owner_admission_authorities_v1
          WHERE authority_ref=$1 AND authority_hash=$2
          FOR SHARE`,
        [row.reservation_ref, row.reservation_hash],
      );
      const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
      const bindingAuthorities = await sql.unsafe<RunningSingleStepOwnerAuthorityRowV1[]>(
        `SELECT authority_ref,authority_hash,authority_kind,phase_key,
                predecessor_head_hash,successor_head_hash,authority_body
           FROM internal_production_owner_admission_authorities_v1
          WHERE authority_ref=$1 AND authority_hash=$2
          FOR SHARE`,
        [bindingRef, bound.bindingHash],
      );
      const reservationAuthority = reservationAuthorities[0];
      const bindingAuthority = bindingAuthorities[0];
      const headVersion = Number(row.head_version);
      const reservationEdges = ancestry.filter(({ authority: edge }) => (
        edge.authority_kind === "reservation"
        && edge.authority_ref === reservation.reservationRef
        && edge.authority_hash === reservation.reservationHash
      ));
      const reservationEdge = reservationEdges[0];
      if (
        row.state !== "bound"
        || row.category !== authority.category
        || row.owner_key !== authority.ownerKey
        || row.producer_implementation_id !== authority.implementation
        || row.reservation_ref !== reservation.reservationRef
        || row.reservation_hash !== reservation.reservationHash
        || row.owner_key_hash !== reservation.ownerKeyHash
        || row.producer_purpose_hash !== reservation.producerPurposeHash
        || row.producer_implementation_hash !== reservation.producerImplementationHash
        || row.reservation_head_predecessor_hash
          !== reservation.ownerAdmissionHeadPredecessorHash
        || !Number.isSafeInteger(headVersion)
        || headVersion <= 0
        || reservationEdges.length !== 1
        || !reservationEdge
        || reservationEdge.version !== headVersion
        || ancestry.filter(({ version }) => version === headVersion).length !== 1
        || canonicalJsonStringify(identity) !== canonicalJsonStringify(authority.identity)
        || row.binding_hash !== bound.bindingHash
        || bound.category !== authority.category
        || bound.ownerKey !== authority.ownerKey
        || bound.producerImplementationId !== authority.implementation
        || bound.reservationRef !== reservation.reservationRef
        || bound.reservationHash !== reservation.reservationHash
        || canonicalJsonStringify(bound.canonicalOwnerIdentity)
          !== canonicalJsonStringify(authority.identity)
        || row.close_kind !== null
        || row.terminal_owner_ref !== null
        || row.terminal_owner_hash !== null
        || row.close_head_predecessor_hash !== null
        || row.close_head_successor_hash !== null
        || row.preserved_fence_ref !== null
        || row.preserved_fence_hash !== null
        || row.close_ref !== null
        || row.close_hash !== null
        || row.close_payload !== null
        || reservationAuthorities.length !== 1
        || bindingAuthorities.length !== 1
        || !reservationAuthority
        || !bindingAuthority
        || reservationAuthority.authority_ref !== reservation.reservationRef
        || reservationAuthority.authority_hash !== reservation.reservationHash
        || reservationAuthority.authority_kind !== "reservation"
        || reservationAuthority.phase_key !== reservation.reservationRef
        || reservationAuthority.predecessor_head_hash
          !== reservation.ownerAdmissionHeadPredecessorHash
        || reservationAuthority.successor_head_hash
          !== reservationEdge.authority.successor_head_hash
        || canonicalJsonStringify(reservationAuthority.authority_body)
          !== canonicalJsonStringify(reservation)
        || bindingAuthority.authority_ref !== bindingRef
        || bindingAuthority.authority_hash !== bound.bindingHash
        || bindingAuthority.authority_kind !== "binding"
        || bindingAuthority.phase_key !== reservation.reservationRef
        || bindingAuthority.predecessor_head_hash !== reservationAuthority.successor_head_hash
        || bindingAuthority.successor_head_hash !== reservationAuthority.successor_head_hash
        || canonicalJsonStringify(bindingAuthority.authority_body)
          !== canonicalJsonStringify(bound)
      ) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function authenticateRunningSingleStepClaimReissueV1(
  step: StepRow,
  agentId: string,
  runtimeIntent?: RuntimeClaimIntentV1,
): Promise<RunningSingleStepClaimReissueV1> {
  return pgBegin(async (sql) => {
    const rows = await sql.unsafe<Array<{
      claim_id: string;
      open_claim_count: string;
      claim_run_id: string;
      claim_step_id: string;
      claim_story_id: string | null;
      claim_agent_id: string;
      session_id: string | null;
      runtime_claim_id: string | null;
      runtime_run_id: string | null;
      runtime_step_db_id: string | null;
      runtime_workflow_step_id: string | null;
      runtime_story_db_id: string | null;
      runtime_story_id: string | null;
      runtime_attempt_id: string | null;
      runtime_claim_agent_id: string | null;
      owner_instance_id: string | null;
      runtime_agent_id: string | null;
      runtime_kind: string | null;
      session_key: string | null;
      worktree: string | null;
      runtime_path: string | null;
      transcript_path: string | null;
      runtime_state: string | null;
    }>>(
      `SELECT claim.id::text AS claim_id,
              (SELECT COUNT(*)::text FROM claim_log open_claim
                WHERE open_claim.run_id=$1 AND open_claim.step_id=$2
                  AND open_claim.story_id IS NULL AND open_claim.outcome IS NULL) AS open_claim_count,
              claim.run_id AS claim_run_id,claim.step_id AS claim_step_id,
              claim.story_id AS claim_story_id,claim.agent_id AS claim_agent_id,
              runtime.session_id,runtime.claim_id::text AS runtime_claim_id,
              runtime.run_id AS runtime_run_id,runtime.step_db_id AS runtime_step_db_id,
              runtime.workflow_step_id AS runtime_workflow_step_id,
              runtime.story_db_id AS runtime_story_db_id,runtime.story_id AS runtime_story_id,
              runtime.attempt_id AS runtime_attempt_id,
              runtime.claim_agent_id AS runtime_claim_agent_id,
              runtime.owner_instance_id,runtime.runtime_agent_id,runtime.runtime_kind,
              runtime.session_key,runtime.worktree,runtime.runtime_path,
              runtime.transcript_path,runtime.state AS runtime_state
         FROM claim_log claim
         LEFT JOIN LATERAL (
           SELECT * FROM runtime_sessions candidate
            WHERE candidate.claim_id=claim.id
            ORDER BY candidate.session_id
            LIMIT 2
            FOR UPDATE
         ) runtime ON TRUE
        WHERE claim.run_id=$1 AND claim.step_id=$2
          AND claim.story_id IS NULL AND claim.outcome IS NULL
        ORDER BY claim.id
        LIMIT 2
        FOR UPDATE OF claim`,
      [step.run_id, step.step_id],
    );
    if (rows.length === 0) return { status: "absent" };
    const observed = rows[0]!;
    if (rows.length !== 1 || observed.open_claim_count !== "1") return { status: "refused" };
    const claimId = Number(observed.claim_id);
    if (!Number.isSafeInteger(claimId) || claimId <= 0 || String(claimId) !== observed.claim_id) {
      throw new Error("SINGLE_STEP_CLAIM_ID_INVALID");
    }
    if (
      observed.claim_run_id !== step.run_id
      || observed.claim_step_id !== step.step_id
      || observed.claim_story_id !== null
      || observed.claim_agent_id !== agentId
      || Boolean(observed.session_id) !== Boolean(runtimeIntent)
    ) return { status: "refused" };
    if (runtimeIntent && (
      observed.runtime_claim_id !== observed.claim_id
      || observed.runtime_run_id !== step.run_id
      || observed.runtime_step_db_id !== step.id
      || observed.runtime_workflow_step_id !== step.step_id
      || observed.runtime_story_db_id !== null
      || observed.runtime_story_id !== null
      || observed.runtime_attempt_id !== null
      || observed.runtime_claim_agent_id !== agentId
      || !["reserved", "starting", "running"].includes(observed.runtime_state ?? "")
      || observed.session_id !== runtimeIntent.sessionId
      || observed.owner_instance_id !== runtimeIntent.ownerInstanceId
      || observed.runtime_agent_id !== runtimeIntent.runtimeAgentId
      || observed.runtime_kind !== runtimeIntent.runtimeKind
      || observed.session_key !== (runtimeIntent.sessionKey ?? null)
      || observed.worktree !== (runtimeIntent.worktree ?? null)
      || observed.runtime_path !== (runtimeIntent.runtimePath ?? null)
      || observed.transcript_path !== (runtimeIntent.transcriptPath ?? null)
    )) return { status: "refused" };
    const exactSidecars = await authenticateRunningSingleStepOwnerSidecarsV1(sql, [
      {
        ownerKey: observed.claim_id,
        category: "claim",
        implementation: "a-claim-single-runtime-v1",
        identity: createInternalProductionClaimCanonicalOwnerIdentityV1({
          claimIdText: observed.claim_id,
        }),
      },
      ...(runtimeIntent ? [{
        ownerKey: runtimeIntent.sessionId,
        category: "runtime-session" as const,
        implementation: "a-runtime-session-v1" as const,
        identity: createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1({
          sessionId: runtimeIntent.sessionId,
        }),
      }] : []),
    ]);
    if (!exactSidecars) return { status: "refused" };
    return {
      status: "authenticated",
      claimId,
      ...(runtimeIntent ? {
        runtime: {
          sessionId: runtimeIntent.sessionId,
          ownerInstanceId: runtimeIntent.ownerInstanceId,
          state: observed.runtime_state as "reserved" | "starting" | "running",
        },
      } : {}),
    };
  });
}

async function claimSingleStep(
  step: StepRow,
  agentId: string,
  context: Record<string, string>,
  db: any,
  runtimeIntent?: RuntimeClaimIntentV1,
  storyAdmissionProof?: CompilerStoryEnglishAdmissionClaimProofV1,
): Promise<ClaimResult> {
  const runProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [step.run_id],
  );
  const runningReissue = step.step_status === "running"
    ? await authenticateRunningSingleStepClaimReissueV1(step, agentId, runtimeIntent)
    : undefined;
  if (runningReissue?.status === "refused") return { found: false };
  let v3StageRetrySource: V3StageRetrySourceV1 | undefined;
  let v3PriorStageRetryDedupeKeys: ReadonlySet<string> | undefined;
  if (runProtocol?.protocol === "v3" && step.retry_count > 0) {
    const unsettledFailure = await pgGet<{ count: string }>(
      `SELECT COUNT(DISTINCT cl.id)::text AS count
         FROM claim_log cl
         JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
        WHERE cl.run_id = $1
          AND cl.step_id = $2
          AND cl.story_id IS NULL
          AND cl.outcome = 'failed'
          AND completion.state IN ('requested', 'draining', 'processing')`,
      [step.run_id, step.step_id],
    );
    if (Number(unsettledFailure?.count || 0) > 0) {
      // The prior claim has committed its owner transition, but its mandatory
      // effects and runtime release still own continuation. A poll here is a
      // normal wait, not evidence that retry authority is missing.
      return { found: false };
    }
    type PreviousStageFailureRow = {
      claim_id: string;
      diagnostic: string | null;
      output: string;
      output_hash: string;
      instruction: string | null;
      max_retries: number;
    };
    const previousRows = await pgQuery<PreviousStageFailureRow>(
      `SELECT cl.id::text AS claim_id,
              cl.diagnostic,
              completion.output,
              completion.output_hash,
              completion.claim_envelope ->> 'input' AS instruction,
              current_step.max_retries
         FROM claim_log cl
         JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
         JOIN steps current_step ON current_step.id = $1
        WHERE cl.run_id = $2
          AND cl.step_id = $3
          AND cl.story_id IS NULL
          AND cl.outcome = 'failed'
          AND completion.state = 'accepted'
          AND completion.apply_phase = 'effects_committed'
        ORDER BY cl.claimed_at ASC, cl.id ASC
        LIMIT 101`,
      [step.id, step.run_id, step.step_id],
    );
    const previous = previousRows[previousRows.length - 1];
    const previousClaimIds = previousRows.map((row) => {
      const previousClaimId = Number(row.claim_id);
      return Number.isSafeInteger(previousClaimId)
        && previousClaimId > 0
        && String(previousClaimId) === row.claim_id
        ? previousClaimId
        : null;
    });
    const retryHistoryInvalid = previousRows.length !== step.retry_count
      || previousRows.length > 100
      || previousClaimIds.some((claimId) => claimId === null)
      || previousRows.some((row) => !row.instruction || !row.output || !row.diagnostic);
    if (retryHistoryInvalid || !previous?.instruction || !previous.output || !previous.diagnostic) {
      const diagnostic = "V3_STAGE_RETRY_SOURCE_UNAVAILABLE: bounded stage retry requires the exact prior instruction, output, and validator failure; blind model redispatch is forbidden";
      await pgRun(
        "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3 AND status IN ('pending', 'running')",
        [diagnostic, now(), step.id],
      );
      await recordObservation({
        runId: step.run_id,
        stepId: step.step_id,
        phase: "recovery",
        checkId: `v3.stage-retry.source-unavailable:${step.retry_count}`,
        label: "V3 stage retry source authority",
        status: "blocked",
        summary: diagnostic,
        evidence: {
          schema: "setfarm.v3-stage-retry-source-unavailable.v1",
          retryOrdinal: step.retry_count,
          modelRedispatchBudget: 0,
        },
      });
      await failRun(step.run_id, true, diagnostic);
      return { found: false };
    }
    const retryHistory: V3StageRetrySourceV1[] = [];
    let historyHashMismatch = false;
    for (const [index, row] of previousRows.entries()) {
      const source = createV3StageRetrySourceV1({
        workflowStepId: step.step_id,
        retryOrdinal: index + 1,
        maxRetries: row.max_retries,
        previousClaimId: previousClaimIds[index]!,
        previousInstructionContent: row.instruction!,
        previousOutputContent: row.output,
        diagnostic: row.diagnostic!,
      });
      if (source.previousOutput.artifactHash !== row.output_hash) {
        historyHashMismatch = true;
        break;
      }
      retryHistory.push(source);
    }
    if (historyHashMismatch) {
      const diagnostic = "V3_STAGE_RETRY_HISTORY_HASH_MISMATCH: retry history no longer matches its canonical completion hash";
      await pgRun(
        "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3 AND status IN ('pending', 'running')",
        [diagnostic, now(), step.id],
      );
      await failRun(step.run_id, true, diagnostic);
      return { found: false };
    }
    v3StageRetrySource = retryHistory[retryHistory.length - 1];
    const dispatchedDedupeKeys = new Set<string>();
    for (let index = 1; index < retryHistory.length; index += 1) {
      const priorSource = retryHistory[index - 1]!;
      const dispatchedInstruction = previousRows[index]!.instruction!;
      dispatchedDedupeKeys.add(createV3StageRetryDedupeKeyV1({
        workflowStepId: step.step_id,
        previousInstructionHash: priorSource.previousInstruction.artifactHash,
        currentInstructionHash: crypto.createHash("sha256")
          .update(Buffer.from(dispatchedInstruction, "utf8"))
          .digest("hex"),
        previousOutputHash: priorSource.previousOutput.artifactHash,
        failureHash: priorSource.failure.failureHash,
      }));
    }
    v3PriorStageRetryDedupeKeys = dispatchedDedupeKeys;
  }
  let shouldRecordSingleStepTransition = false;
  let singleStepClaimId: number | null = null;
  let singleStepClaimEnvelope: ClaimEnvelopeV1 | undefined;
  let singleStepRuntime: RuntimeClaimOwnership | undefined;
  let authenticatedStorySubject: V3StoryClaimRuntimeSubjectV1 | undefined;
  let compilerCompletionOutput: string | undefined;

  async function recordSingleStepHandoff(reason: string): Promise<void> {
    if (shouldRecordSingleStepTransition) {
      await recordStepTransition(step.id, step.run_id, "pending", "running", agentId, reason);
      emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
      shouldRecordSingleStepTransition = false;
    }
  }

  async function closeSingleStepHandoff(outcome: string, diagnostic: string): Promise<void> {
    if (singleStepClaimId === null) return;
    await pgBegin((sql) => closeReservedClaimRuntimeInTransaction(sql, {
      claimId: singleStepClaimId!,
      runId: step.run_id,
      workflowStepId: step.step_id,
      storyId: null,
      claimAgentId: agentId,
      outcome,
      diagnostic,
      runtime: singleStepRuntime,
    }));
  }

  async function terminalizeV3PlatformPreclaim(
    diagnostic: string,
    operationalFailureCause?: OperationalFailureCauseError,
  ): Promise<void> {
    if (!singleStepClaimEnvelope || singleStepClaimEnvelope.protocol !== "v3") {
      throw new Error("V3_PLATFORM_PRECLAIM_CLAIM_AUTHORITY_REQUIRED");
    }
    await failStep(
      step.id,
      diagnostic,
      singleStepClaimEnvelope,
      {
        singleStepMode: "terminal_platform_preclaim",
        ...(operationalFailureCause
          ? { operationalFailureCause: operationalFailureCause.failureCause }
          : {}),
      },
    );
  }

  async function terminalizeSharedV3PlatformPreclaim(
    diagnostic: string,
    operationalFailureCause?: OperationalFailureCauseError,
  ): Promise<boolean> {
    const fresh = await authenticateRunningSingleStepClaimReissueV1(
      step,
      agentId,
      runtimeIntent,
    );
    if (
      fresh.status !== "authenticated"
      || fresh.claimId !== singleStepClaimId
      || !fresh.runtime
      || fresh.runtime.state !== "reserved"
    ) return false;
    try {
      await terminalizeV3PlatformPreclaim(diagnostic, operationalFailureCause);
      return true;
    } catch (error) {
      if (
        error instanceof ClaimMutationAuthorityError
        && error.ownerType === "runtime_session"
        && error.ownerId === fresh.runtime.sessionId
        && (error.ownerState === "starting" || error.ownerState === "running")
      ) return false;
      throw error;
    }
  }

  // Single-step idempotency: some models run `step claim` twice and overwrite
  // their claim file. If this role already owns a running non-loop step, reissue
  // the same claim instead of returning NO_WORK and orphaning the step.
  if (step.step_status === "running") {
    if (runningReissue?.status === "absent") {
      await pgRun(
        `UPDATE steps
         SET status = 'pending', updated_at = $1
         WHERE id = $2
           AND status = 'running'
           AND NOT EXISTS (
             SELECT 1 FROM claim_log
             WHERE run_id = $3 AND step_id = $4 AND story_id IS NULL AND outcome IS NULL
           )`,
        [now(), step.id, step.run_id, step.step_id],
      );
      logger.warn(`[claim-idempotent] Requeued orphaned running step ${step.step_id}; no open claim exists for ${agentId}`, { runId: step.run_id, stepId: step.step_id });
      return { found: false };
    }
    if (runningReissue?.status !== "authenticated") return { found: false };
    singleStepClaimId = runningReissue.claimId;
    singleStepRuntime = runningReissue.runtime;
    if (runProtocol?.protocol === "v3" && step.step_id === "supervise") {
      if (!singleStepRuntime) throw new Error("V3_SUPERVISE_RUNTIME_BINDING_REQUIRED");
      authenticatedStorySubject = await getSql().begin((transaction) =>
        loadAndRevalidateV3StoryClaimRuntimeBindingV1(transaction, {
          claimId: singleStepClaimId!,
          runtimeSessionId: singleStepRuntime!.sessionId,
          runId: step.run_id,
          stepDbId: step.id,
          workflowStepId: "supervise",
        })) as V3StoryClaimRuntimeSubjectV1;
    }
    logger.info(`[claim-idempotent] Re-issued running step ${step.step_id} to ${agentId}`, { runId: step.run_id, stepId: step.step_id });
  } else {
    const productSemanticsVersion = context["product_semantics_version"] === "v1"
      || context["product_semantics_version"] === "v2"
      ? context["product_semantics_version"]
      : process.env.SETFARM_PRODUCT_SEMANTICS_VERSION === "v1"
        ? "v1"
        : "v2";
    const planAuthoritySeal = runProtocol?.protocol === "v3"
      && step.step_id === "plan"
      && productSemanticsVersion === "v2"
      ? {
          productSemanticsVersion: "v2" as const,
          outputAuthorityVersion: "product_build_v1" as const,
        }
      : undefined;
    let superviseSubjectCandidate: Readonly<
      | { kind: "story_member"; storyDbId: string; storyId: string }
      | { kind: "final_product" }
    > | undefined;
    if (runProtocol?.protocol === "v3" && step.step_id === "supervise") {
      if (step.current_story_id) {
        const selected = await pgGet<{ id: string; story_id: string }>(
          "SELECT id, story_id FROM stories WHERE run_id = $1 AND id = $2 AND status = 'done' LIMIT 1",
          [step.run_id, step.current_story_id],
        );
        if (!selected) {
          throw new Error("V3_SUPERVISE_STORY_SUBJECT_SELECTION_INVALID");
        }
        superviseSubjectCandidate = {
          kind: "story_member",
          storyDbId: selected.id,
          storyId: selected.story_id,
        };
      } else {
        superviseSubjectCandidate = { kind: "final_product" };
      }
    }
    const publication = await publishSingleClaimAndRuntime(
      step,
      agentId,
      runtimeIntent,
      planAuthoritySeal,
      storyAdmissionProof,
      superviseSubjectCandidate,
    );
    if (!publication) return { found: false };
    singleStepClaimId = publication.claimId;
    singleStepRuntime = publication.runtime;
    authenticatedStorySubject = publication.storySubject;
    if (planAuthoritySeal) {
      context["product_semantics_version"] = "v2";
      context["plan_output_authority_version"] = "product_build_v1";
    }
    logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });
    shouldRecordSingleStepTransition = true;
  }

  singleStepClaimEnvelope = {
    schema: "setfarm.claim-envelope.v1",
    protocol: runProtocol?.protocol || "legacy",
    issuedAt: new Date().toISOString(),
    stepId: step.id,
    workflowStepId: step.step_id,
    runId: step.run_id,
    claimId: singleStepClaimId,
    claimAgentId: agentId,
    runtimeAgentId: runtimeIntent?.runtimeAgentId || agentId,
  };

  // Publish a LiveDB handoff immediately after the atomic DB claim. Claim-side
  // deferrals below must close this row if no agent is spawned, otherwise a
  // spawner restart can leave a running step with no observable owner.
  await recordSingleStepHandoff("claimSingleStep:atomic");

  // Inject previous failure context so agent knows what to fix on retry.
  // Some verify-each retries intentionally leave the previous successful
  // reviewer output on the step while context.previous_failure carries the
  // real blocker (for example PR_NOT_MERGED). Do not replace that actionable
  // failure with a stale STATUS: done report.
  if (step.retry_count > 0) {
    const existingFailure = sanitizedRetryFailureText(context["previous_failure"] || "");
    const stepOutputLooksSuccessful = step.output ? isSuccessfulStepOutput(step.output) : false;
    const failureText = existingFailure || (!stepOutputLooksSuccessful ? sanitizedRetryFailureText(step.output || "") : "");
    const { classifyError } = await import("./error-taxonomy.js");
    if (failureText) {
      const classified = classifyError(failureText);
      const currentCategory = context["failure_category"] || "";
      const currentSuggestion = context["failure_suggestion"] || "";
      if (context["previous_failure"] !== failureText) context["previous_failure"] = failureText;
      if (!currentCategory || currentCategory === "UNKNOWN") context["failure_category"] = classified.category;
      if (!currentSuggestion || /Unexpected error/i.test(currentSuggestion)) context["failure_suggestion"] = classified.suggestion;
      const source = existingFailure ? "context" : "step-output";
      logger.info(`[claim] Injected previous_failure from ${source} (${context["failure_category"] || classified.category}) for retry ${step.retry_count} of ${step.step_id}`, { runId: step.run_id });
    } else if (step.output && stepOutputLooksSuccessful) {
      logger.info(`[claim] Skipped successful step output as retry previous_failure for ${step.step_id}`, { runId: step.run_id });
    }
  }

  // #260: Default optional template vars to prevent MISSING_INPUT_GUARD false positives
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }

  // Inject progress for any step in a run that has stories
  const hasStories = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1", [step.run_id]);
  if ((hasStories?.cnt ?? 0) > 0) {
    context["progress"] = await readProgressFile(step.run_id);
    context["project_memory"] = await readProjectMemory(context);

    // Inject stories_json for non-loop steps that need it
    const allStoriesForCtx = await getStories(step.run_id);
    const storiesForTemplate = allStoriesForCtx.map(s => ({
      id: s.storyId,
      title: s.title,
      description: s.description,
      acceptanceCriteria: s.acceptanceCriteria,
    }));
    context["stories_json"] = JSON.stringify(storiesForTemplate, null, 2);
  }

  // (Stories predicted_screen_files inject moved to 03-stories/context.ts —
  // invoked via the step-module claim delegation block.)

  // BUG FIX: If this is a verify step for a verify_each loop, inject the correct
  // story info from the oldest unverified 'done' story (not from stale context).
  if (!await injectSuperviseEachContext(step, context, agentId, authenticatedStorySubject)) {
    await pgRun(
      "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status = 'running'",
      [now(), step.id],
    );
    await closeSingleStepHandoff("infra_retry", "supervise_each story worktree was missing; no supervisor spawned");
    return { found: false };
  }
  if (step.step_id === "supervise" && context["supervisor_scope"] === "final-product") {
    const finalSupervise = await shouldAutoCompleteFinalSuperviseEachStep(step.run_id, context);
    if (finalSupervise.ok) {
      compilerCompletionOutput = [
        "STATUS: done",
        "SUPERVISOR_DECISION: pass",
        `AC_COVERAGE: ${finalSupervise.reason}`,
        "CHECKS: deterministic supervise-each final gate; no LLM supervisor spawned",
      ].join("\n");
      if (singleStepClaimId === null || !singleStepRuntime) {
        throw new Error("V3_FINAL_PRODUCT_COMPILER_COMPLETION_RUNTIME_REQUIRED");
      }
      return {
        found: true,
        stepId: step.id,
        workflowStepId: step.step_id,
        runId: step.run_id,
        protocol: "v3",
        claimId: singleStepClaimId,
        claimAgentId: agentId,
        runtimeSessionId: singleStepRuntime.sessionId,
        runtimeOwnerInstanceId: singleStepRuntime.ownerInstanceId,
        compilerCompletionOutput,
      };
    }
    logger.info(`[supervise-each] Final supervisor remains agent-owned: ${finalSupervise.reason}`, { runId: step.run_id });
  }

  if (!await injectVerifyContext(step, context, db, agentId)) {
    await pgRun(
      "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status = 'running'",
      [now(), step.id],
    );
    await closeSingleStepHandoff("completed", "verify_each auto-verified or advanced without agent spawn");
    return { found: false };
  }

  // ═══ VERIFY PRE-FLIGHT: Static analysis for verify step speedup ═══
  if (step.step_id === "verify" && context["repo"] && (context["story_branch"] || context["branch"])) {
    try {
      const { buildPreFlightReport, formatPreFlightForAgent } = await import("./static-analysis.js");
      const analysisBranch = context["story_branch"] || context["branch"];
      const repoPath = context["repo"];
      if (analysisBranch && analysisBranch !== "main") {
        try {
          execFileSync("git", ["fetch", "--prune", "origin", "main", analysisBranch], {
            cwd: repoPath,
            timeout: 30_000,
            stdio: ["ignore", "ignore", "ignore"],
          });
          execFileSync("git", ["checkout", "-B", analysisBranch, `origin/${analysisBranch}`], {
            cwd: repoPath,
            timeout: 30_000,
            stdio: ["ignore", "ignore", "ignore"],
          });
        } catch (checkoutErr) {
          logger.warn(`[preflight] Could not prepare PR branch ${analysisBranch}: ${String(checkoutErr).slice(0, 220)}`, { runId: step.run_id });
        }
      }
      const baseRef = resolveVerifyPreflightBaseRef(repoPath, context, analysisBranch);
      const report = buildPreFlightReport(repoPath, baseRef, "HEAD");
      context["preflight_analysis"] = formatPreFlightForAgent(report);
      context["preflight_diff"] = report.diffSummary;
      context["preflight_errors"] = [report.eslintErrors, report.tscErrors, report.contractErrors].filter(Boolean).join("\n");
      const scopeFailure = await detectVerifyScopeDiffFailure(step.run_id, context["current_story_id"] || "", repoPath, baseRef, "HEAD");
      if (scopeFailure) {
        context["preflight_errors"] = [context["preflight_errors"], scopeFailure].filter(Boolean).join("\n");
        context["preflight_analysis"] = `${context["preflight_analysis"]}\n\nVERIFY SCOPE CHECK:\n${scopeFailure}`;
        logger.warn(`[preflight-scope] Verify blocked ${context["current_story_id"] || "(unknown story)"} before reviewer spawn: ${scopeFailure.slice(0, 240)}`, { runId: step.run_id });
        await routeVerifyScopeFailureToImplement(step, context, context["current_story_id"] || "", scopeFailure);
        await pgRun("UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2 AND status = 'running'", [now(), step.id]);
        await recordStepTransition(step.id, step.run_id, "running", "waiting", agentId, "verify-scope-preflight");
        await closeSingleStepHandoff("completed", "verify scope failure routed to implement");
        return { found: false };
      }
      const generatedScreenRegressionFailure = await detectVerifyGeneratedScreenRegressionFailure(
        step.run_id,
        context["current_story_id"] || "",
        context["story_workdir"] || repoPath,
        repoPath,
      );
      if (generatedScreenRegressionFailure) {
        context["preflight_errors"] = [context["preflight_errors"], generatedScreenRegressionFailure].filter(Boolean).join("\n");
        context["preflight_analysis"] = `${context["preflight_analysis"]}\n\nVERIFY GENERATED SCREEN REGRESSION CHECK:\n${generatedScreenRegressionFailure}`;
        logger.warn(`[preflight-generated-screen-regression] Verify blocked ${context["current_story_id"] || "(unknown story)"} before reviewer spawn: ${generatedScreenRegressionFailure.slice(0, 240)}`, { runId: step.run_id });
        await routeVerifyScopeFailureToImplement(step, context, context["current_story_id"] || "", generatedScreenRegressionFailure, {
          category: "GENERATED_SCREEN_REGRESSION",
          suggestion: "Restore every previously verified generated screen render path before review. Keep prior story screens reachable while integrating current-story screens; do not replace generated components with custom duplicate UI.",
        });
        await pgRun("UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2 AND status = 'running'", [now(), step.id]);
        await recordStepTransition(step.id, step.run_id, "running", "waiting", agentId, "verify-generated-screen-regression-preflight");
        await closeSingleStepHandoff("completed", "verify generated screen regression routed to implement");
        return { found: false };
      }
      logger.info(`[preflight] Verify pre-flight: ${report.changedFiles.length} files, ${report.totalIssues} issue(s)`, { runId: step.run_id });
    } catch (e) {
      logger.warn(`[preflight] Skipped: ${String(e)}`, { runId: step.run_id });
    }
  }

  // (Design pre-claim moved to src/installer/steps/02-design/preclaim.ts —
  // invoked by the step-module delegation block below as module.preClaim.)

  // PR REVIEW DELAY GATE: Wait for external review comments (Gemini, Copilot) before verify claim
  // BUG FIX: Previously used step.updated_at as baseline but updated it on every defer, resetting
  // the timer infinitely. Now uses context["verify_pending_since"] as stable baseline.
  const reviewPrUrl = context["pr_url"] || context["final_pr"] || "";
  if (step.step_id === "verify" && reviewPrUrl) {
    let hasReviewSignal = false;
    context["pr_comments"] = "";
    context["pr_check_state"] = "";
    context["pr_mergeable"] = "";
    context["pr_merge_state_status"] = "";
    if (runProtocol?.protocol === "v3") {
      try {
        const storyId = context["current_story_id"] || "";
        const repositoryPath = context["repo"] || "";
        if (!storyId || !repositoryPath || singleStepClaimId === null) {
          const identityError = new Error("Exact story, repository and verify claim identity are required");
          Object.assign(identityError, { code: "V3_GITHUB_REVIEW_ROUTE_IDENTITY_MISSING" });
          throw identityError;
        }
        const routed = await routeExactV3GithubReviewBeforeVerifyAgent({
          runId: step.run_id,
          verifyStepDbId: step.id,
          verifyClaimId: singleStepClaimId,
          storyId,
          prUrl: reviewPrUrl,
          repositoryPath,
          context,
        });
        if (routed.blockAgent) {
          await pgRun(
            "UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2 AND status = 'running'",
            [now(), step.id],
          );
          await recordStepTransition(step.id, step.run_id, "running", "waiting", agentId, "v3-exact-github-review-route");
          await closeSingleStepHandoff("completed", `exact GitHub review evidence ${routed.result.status}; canonical recovery owns the story`);
          logger.warn(`[v3-review] ${storyId} routed from exact GitHub thread evidence before reviewer spawn`, { runId: step.run_id });
          return { found: false };
        }

        // Check/merge state is operational metadata only. V3 never formats
        // comment prose and never derives actionability from this adapter.
        const { fetchPrState } = await import("./steps/07-verify/pr-comments.js");
        const state = await fetchPrState(reviewPrUrl, context["repo_full"] || "");
        if (state) {
          context["pr_check_state"] = state.checksStatus || "";
          context["pr_created_at"] = state.createdAt || "";
          context["pr_mergeable"] = state.mergeable || "";
          context["pr_merge_state_status"] = state.mergeStateStatus || "";
          hasReviewSignal =
            routed.result.status === "pr_not_open" ||
            state.checksStatus === "failing" ||
            state.mergeable === "CONFLICTING" ||
            ["DIRTY", "BLOCKED"].includes(state.mergeStateStatus || "");
        }
        delete context["v3_review_read_failure_fingerprint"];
        delete context["v3_review_read_failure_count"];
      } catch (e) {
        const code = v3ReviewErrorCode(e);
        const fingerprint = crypto.createHash("sha256")
          .update(`${step.run_id}\n${step.id}\n${context["current_story_id"] || ""}\n${reviewPrUrl}\n${code}\n${String(e)}`)
          .digest("hex");
        const previousFingerprint = context["v3_review_read_failure_fingerprint"] || "";
        const previousCount = Number.parseInt(context["v3_review_read_failure_count"] || "0", 10);
        const failureCount = previousFingerprint === fingerprint && Number.isFinite(previousCount)
          ? previousCount + 1
          : 1;
        const retry = v3ReviewErrorRetryable(code) && failureCount <= 3;
        context["v3_review_read_failure_fingerprint"] = fingerprint;
        context["v3_review_read_failure_count"] = String(failureCount);
        context["previous_failure"] = `${code}: exact GitHub review evidence could not be established`;
        context["failure_category"] = "V3_GITHUB_REVIEW_EVIDENCE_UNAVAILABLE";
        context["failure_suggestion"] = retry
          ? "Retry the bounded exact GitHub evidence read; do not spawn a reviewer from stale or prose-derived comments."
          : "Platform operator must restore exact GitHub review evidence authority before verification can continue.";
        await updateRunContext(step.run_id, context);
        await recordObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: context["current_story_id"] || undefined,
          phase: "verify",
          checkId: `v3.github-review.read:${fingerprint}`,
          label: "V3 exact GitHub review evidence read",
          status: retry ? "retry" : "blocked",
          summary: `${code}:attempt-${failureCount}`,
          detail: String(e).slice(0, 4_000),
          evidence: {
            schema: "setfarm.v3-github-review-read-failure.v1",
            code,
            fingerprint,
            attempt: failureCount,
            retryBound: 3,
          },
        });
        await pgRun(
          `UPDATE steps SET status = $1, updated_at = $2 WHERE id = $3 AND status = 'running'`,
          [retry ? "pending" : "waiting", now(), step.id],
        );
        await recordStepTransition(step.id, step.run_id, "running", retry ? "pending" : "waiting", agentId, "v3-github-review-evidence-failure");
        await closeSingleStepHandoff(retry ? "infra_retry" : "failed", `${code}: exact GitHub review evidence unavailable`);
        logger.warn(`[v3-review] ${code} (${failureCount}/3); reviewer spawn blocked`, { runId: step.run_id, stepId: step.step_id });
        return { found: false };
      }
    } else {
      try {
        const { fetchPrState, formatPrCommentsForAgent } = await import("./steps/07-verify/pr-comments.js");
        const state = await fetchPrState(reviewPrUrl, context["repo_full"] || "");
        if (state) {
          const formatted = formatPrCommentsForAgent(state);
          context["pr_comments"] = formatted || "";
          context["pr_check_state"] = state.checksStatus || "";
          context["pr_created_at"] = state.createdAt || "";
          context["pr_mergeable"] = state.mergeable || "";
          context["pr_merge_state_status"] = state.mergeStateStatus || "";
          hasReviewSignal =
            state.comments.length > 0 ||
            state.checksStatus === "failing" ||
            state.mergeable === "CONFLICTING" ||
            ["DIRTY", "BLOCKED"].includes(state.mergeStateStatus || "");
        }
      } catch (e) {
        logger.warn(`[review-delay] PR signal check failed: ${String(e).slice(0, 160)}`, { runId: step.run_id, stepId: step.step_id });
      }
    }
    if (context["verify_pending_pr_url"] !== reviewPrUrl) {
      context["verify_pending_pr_url"] = reviewPrUrl;
      context["verify_pending_since"] = new Date().toISOString();
      await updateRunContext(step.run_id, context);
    }
    if (!context["verify_pending_since"]) {
      context["verify_pending_since"] = new Date().toISOString();
      await updateRunContext(step.run_id, context);
    }
    const elapsed = Date.now() - new Date(context["verify_pending_since"]).getTime();
    if (!hasReviewSignal && elapsed < PR_REVIEW_DELAY_MS) {
      const remaining = Math.round((PR_REVIEW_DELAY_MS - elapsed) / 1000);
      logger.info(`[review-delay] PR review delay: ${remaining}s remaining — deferring verify claim`, { runId: step.run_id, stepId: step.step_id });
      // Revert status to pending so next cron can retry — DO NOT touch updated_at
      await pgRun("UPDATE steps SET status = 'pending' WHERE id = $1", [step.id]);
      await closeSingleStepHandoff("infra_retry", `PR review delay deferral; ${remaining}s remaining before agent spawn`);
      return { found: false };
    }
    if (hasReviewSignal) {
      logger.info(`[review-delay] PR already has review/check signal — skipping wait`, { runId: step.run_id, stepId: step.step_id });
    }
    const storyIdForReviewSignal = context["current_story_id"] || "";
    if (runProtocol?.protocol !== "v3" && storyIdForReviewSignal && context["pr_comments"]) {
      const prReviewCommentsFailure = await detectOpenPrReviewCommentFailure(
        reviewPrUrl,
        storyIdForReviewSignal,
        context,
        step.run_id,
        step.step_id,
      );
      if (prReviewCommentsFailure) {
        await routeVerifyScopeFailureToImplement(step, context, storyIdForReviewSignal, prReviewCommentsFailure, {
          category: "PR_REVIEW_COMMENTS_OPEN",
          suggestion: "Address every actionable PR review comment in the same story branch. Do not spawn reviewer for already-known actionable review feedback.",
        });
        await pgRun("UPDATE steps SET status = 'waiting', updated_at = $1 WHERE id = $2 AND status = 'running'", [now(), step.id]);
        await recordStepTransition(step.id, step.run_id, "running", "waiting", agentId, "verify-pr-comments-preclaim");
        await closeSingleStepHandoff("completed", "actionable PR review comments routed to implement before reviewer spawn");
        logger.warn(`[verify-pr-comments] ${storyIdForReviewSignal} has actionable PR review comments — routed before reviewer spawn`, { runId: step.run_id });
        return { found: false };
      }
    }
    // Delay passed — clean up marker so a future retry starts fresh
    delete context["verify_pending_since"];
    delete context["verify_pending_pr_url"];
    await updateRunContext(step.run_id, context);
  }

  // Default optional template vars for non-story steps (design, security-gate, etc.)
  for (const v of OPTIONAL_TEMPLATE_VARS) {
    if (!context[v]) context[v] = "";
  }
  // Wave 14 Bug K: per-step context allowlist. Strips PROTECTED keys (DB
  // credentials, API tokens) and non-allowlisted bloat before template
  // resolution. DB-persisted run.context is untouched — only the agent
  // prompt is trimmed. See constants.ts STEP_CONTEXT_ALLOWLIST for the list.
  const prunedContextSingle = pruneContextForStep(context, step.step_id);
  const contextBytesBefore = JSON.stringify(context).length;
  const contextBytesAfter = JSON.stringify(prunedContextSingle).length;
  if (contextBytesBefore > contextBytesAfter + 1000) {
    logger.info(`[context-prune] ${step.step_id}: ${contextBytesBefore}→${contextBytesAfter} bytes (${Math.round((1 - contextBytesAfter / contextBytesBefore) * 100)}% trimmed)`, { runId: step.run_id });
  }
  // (Stories first-attempt reminder moved to 03-stories/context.ts — invoked
  // via the step-module claim delegation block below.)
  // (Plan step reminder is owned by the plan module's injectContext.)

  // Heavy module preClaim work can run before an agent process exists (for
  // example design Stitch generation). Record the claim before that point so
  // LiveDB/dashboard can see real activity instead of a bare running step.
  await recordSingleStepHandoff("claimSingleStep:preClaim");

  // Step module claim-side delegation (v2026-04-14). Order:
  //   1. preClaim — heavy work BEFORE agent claims (Stitch API for design step)
  //   2. injectContext — inject step-specific context vars
  // Both share the same pruned context object so changes flow into the agent's
  // resolved prompt below.
  try {
    const _modRegistry = await import("./steps/registry.js");
    const _stepModule = _modRegistry.get(step.step_id);
    if (!_stepModule
      && singleStepClaimEnvelope?.protocol === "v3"
      && step.step_id === "stories") {
      throw new Error("V3_STORIES_COMPILER_MODULE_REQUIRED");
    }
    if (_stepModule) {
      const _modCtx = {
        runId: step.run_id,
        stepId: step.step_id,
        task: prunedContextSingle["task"] || prunedContextSingle["TASK"] || "",
        retryCount: step.retry_count,
        context: prunedContextSingle,
        claimEnvelope: singleStepClaimEnvelope,
      };
      if (singleStepClaimEnvelope?.protocol === "v3"
        && step.step_id === "stories"
        && typeof _stepModule.preClaim !== "function") {
        throw new Error("V3_STORIES_COMPILER_PRECLAIM_REQUIRED");
      }
      if (_stepModule.preClaim) {
        try {
          const preClaimContextBefore = { ...prunedContextSingle };
          const preClaimResult = await _stepModule.preClaim(_modCtx);
          if (preClaimResult?.disposition === "compiler_completion") {
            if (singleStepClaimEnvelope?.protocol !== "v3"
              || step.type !== "single"
              || Buffer.byteLength(preClaimResult.output, "utf8") > 4_000_000
              || !/^STATUS:\s*done$/m.test(preClaimResult.output)) {
              throw new Error("COMPILER_PRECLAIM_COMPLETION_INVALID");
            }
            compilerCompletionOutput = preClaimResult.output;
          }
          const mergedPreClaimKeys: string[] = [];
          for (const [key, value] of Object.entries(prunedContextSingle)) {
            if (preClaimContextBefore[key] !== value) {
              context[key] = value;
              mergedPreClaimKeys.push(key);
            }
          }
          if (mergedPreClaimKeys.length > 0) {
            await updateRunContext(step.run_id, context);
            logger.info(`[step-module] ${_stepModule.id} merged ${mergedPreClaimKeys.length} preClaim context update(s) without persisting prompt prune: ${mergedPreClaimKeys.slice(0, 12).join(", ")}`, { runId: step.run_id });
          }
          // Refresh both started_at AND updated_at so medic's checkClaimedButStuck
          // measures agent runtime, not preClaim duration. (Medic uses updated_at
          // — not started_at — so we must touch updated_at too.)
          await pgRun("UPDATE steps SET started_at = $1, updated_at = $1 WHERE id = $2", [now(), step.id]);
          logger.info(`[step-module] ${_stepModule.id} preClaim ok — timestamps refreshed`, { runId: step.run_id });
          const postPreClaimStep = await pgGet<{ status: string }>("SELECT status FROM steps WHERE id = $1", [step.id]);
          if (postPreClaimStep && postPreClaimStep.status !== "running") {
            logger.info(`[step-module] ${_stepModule.id} preClaim changed step status to ${postPreClaimStep.status}; skipping agent spawn`, { runId: step.run_id, stepId: step.step_id });
            const outcome = postPreClaimStep.status === "cancelled" ? "cancelled" : postPreClaimStep.status === "failed" ? "failed" : "infra_retry";
            await closeSingleStepHandoff(outcome, `preClaim changed step status to ${postPreClaimStep.status}; no agent spawned`);
            return { found: false };
          }
          if (compilerCompletionOutput !== undefined) {
            if (singleStepClaimId === null) throw new Error("COMPILER_PRECLAIM_CLAIM_MISSING");
            return {
              found: true,
              stepId: step.id,
              workflowStepId: step.step_id,
              runId: step.run_id,
              protocol: "v3",
              claimId: singleStepClaimId,
              claimAgentId: agentId,
              ...(singleStepRuntime ? {
                runtimeSessionId: singleStepRuntime.sessionId,
                runtimeOwnerInstanceId: singleStepRuntime.ownerInstanceId,
              } : {}),
              compilerCompletionOutput,
            };
          }
          if (singleStepClaimEnvelope?.protocol === "v3" && step.step_id === "stories") {
            throw new Error("V3_STORIES_COMPILER_COMPLETION_REQUIRED");
          }
        } catch (_pce) {
          const preClaimError = `PRECLAIM_BLOCKED [${_stepModule.id}]: ${String(_pce).slice(0, 1200)}`;
          if (
            _pce instanceof V3DeployPublicationPendingError
            && step.step_id === "deploy"
            && singleStepClaimEnvelope?.protocol === "v3"
          ) {
            // The deploy service is healthy but the exact DB commit outcome
            // could not be read. Leave the claim/effect ledger untouched for
            // canonical recovery; never terminalize or dispatch a model from
            // an ambiguous publication result.
            logger.warn(
              `[step-module] deploy publication pending canonical reconciliation: ${_pce.receiptHash}`,
              { runId: step.run_id, stepId: step.step_id },
            );
            return { found: false };
          }
          if (
            _pce instanceof V3DeployAuthorityError
            && step.step_id === "deploy"
            && singleStepClaimEnvelope?.protocol === "v3"
          ) {
            let refusal;
            try {
              refusal = await completeV3DeployAuthorityRefusal({
                sql: getSql(),
                envelope: singleStepClaimEnvelope,
                error: _pce,
              });
            } catch (transitionError) {
              throw new V3DeployRefusalLifecycleError(_pce, transitionError);
            }
            logger.error(
              `[step-module] deploy preClaim terminally refused by compiler authority: ${_pce.code}:${refusal.refusalHash}`,
              { runId: step.run_id, stepId: step.step_id },
            );
            return { found: false };
          }
          const v3PlatformPreclaim = singleStepClaimEnvelope?.protocol === "v3";
          if (v3PlatformPreclaim || HARD_PRECLAIM_STEPS.has(step.step_id)) {
            const ownedPreClaimError = v3PlatformPreclaim
              ? `PLATFORM_PRECLAIM_TERMINAL [${_stepModule.id}]: ${preClaimError}`
              : preClaimError;
            logger.warn(
              `[step-module] ${_stepModule.id} preClaim failed as ${v3PlatformPreclaim ? "v3 platform-owned terminal gate" : "hard gate"}: ${String(_pce).slice(0, 200)}`,
              { runId: step.run_id },
            );
            try {
              if (v3PlatformPreclaim) {
                const terminalized = await terminalizeSharedV3PlatformPreclaim(
                  ownedPreClaimError,
                  _pce instanceof OperationalFailureCauseError ? _pce : undefined,
                );
                if (!terminalized) {
                  logger.warn(
                    `[step-module] ${_stepModule.id} preClaim failed after fresh runtime authority refused terminalization; ordinary drain/recovery retains terminal authority`,
                    { runId: step.run_id, stepId: step.step_id },
                  );
                  return { found: false };
                }
              } else {
                await failStep(step.id, ownedPreClaimError, singleStepClaimEnvelope);
              }
            } catch (transitionError) {
              if (v3PlatformPreclaim) {
                throw new V3PlatformPreclaimLifecycleError(transitionError);
              }
              throw transitionError;
            }
            return { found: false };
          }
          logger.warn(`[step-module] ${_stepModule.id} preClaim failed (non-fatal): ${String(_pce).slice(0, 200)}`, { runId: step.run_id });
        }
      }
      await _stepModule.injectContext(_modCtx);
    }
  } catch (_ie) {
    if (
      _ie instanceof V3DeployRefusalLifecycleError
      || _ie instanceof V3DeployAuthorityError
      || _ie instanceof V3PlatformPreclaimLifecycleError
    ) {
      logger.error(`[step-module] terminal preClaim lifecycle failed closed: ${String(_ie).slice(0, 500)}`, {
        runId: step.run_id,
        stepId: step.step_id,
      });
      throw _ie;
    }
    if (singleStepClaimEnvelope?.protocol === "v3" && step.step_id === "stories") {
      const diagnostic = `PLATFORM_PRECLAIM_TERMINAL [stories]: ${String(_ie).slice(0, 1_000)}`;
      try {
        const terminalized = await terminalizeSharedV3PlatformPreclaim(
          diagnostic,
          _ie instanceof OperationalFailureCauseError ? _ie : undefined,
        );
        if (!terminalized) return { found: false };
      } catch (transitionError) {
        throw new V3PlatformPreclaimLifecycleError(transitionError);
      }
      return { found: false };
    }
    logger.warn(`[step-module] injectContext failed: ${String(_ie).slice(0, 200)}`, { runId: step.run_id });
  }
  let resolvedInput = resolveTemplate(
    migratePersistedAgentPromptTemplate(step.input_template),
    prunedContextSingle,
  );

  // Step module takeover: if a module is registered for this step, its
  // buildPrompt() replaces the workflow.yml input_template output. This is
  // how the module's prompt.md + rules.md actually reach the agent (phase 2
  // of the module pilot — without this, AGENTS.md stays the source of truth
  // and the module's prompt sits unused).
  try {
    const _modRegistryP = await import("./steps/registry.js");
    const _stepModuleP = _modRegistryP.get(step.step_id);
    if (_stepModuleP) {
      const _modulePrompt = _stepModuleP.buildPrompt({
        runId: step.run_id,
        task: prunedContextSingle["task"] || prunedContextSingle["TASK"] || "",
        context: prunedContextSingle,
      });
      if (_modulePrompt && _modulePrompt.length > 0) {
        const _modulePromptBytes = Buffer.byteLength(_modulePrompt, "utf8");
        if (_modulePromptBytes > _stepModuleP.maxPromptSize) {
          logger.warn(`[step-module] ${_stepModuleP.id} prompt ${_modulePromptBytes} bytes > budget ${_stepModuleP.maxPromptSize} — using anyway, investigate`, { runId: step.run_id });
        }
        resolvedInput = prunedContextSingle["implementation_context_protocol"] === "v3"
          ? _modulePrompt
          : resolveTemplate(_modulePrompt, prunedContextSingle);
        logger.info(`[step-module] ${_stepModuleP.id} buildPrompt override (${_modulePromptBytes}b)`, { runId: step.run_id });
      }
    }
  } catch (_pe) {
    logger.warn(`[step-module] buildPrompt failed (falling back to template): ${String(_pe).slice(0, 200)}`, { runId: step.run_id });
  }
  resolvedInput = applyEnglishOutputPolicyToResolvedPrompt(resolvedInput);

  // MISSING_INPUT_GUARD (v1.5.53): First miss -> retry step, second -> fail run.
  // WAL race condition can cause false positives — one retry absorbs that.
  const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
  if (allMissing.length > 0) {
    const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
    if (runProtocol?.protocol === "v3") {
      if (singleStepClaimId === null || !singleStepClaimEnvelope) {
        throw new Error("V3_STAGE_INPUT_UNRESOLVED_CLAIM_AUTHORITY_MISSING");
      }
      const diagnostic = `V3_STAGE_INPUT_UNRESOLVED: ${reason}; unchanged input has no model redispatch authority`;
      const operationalFailureCause = isV3OperationalStageWorkflowStepIdV1(step.step_id)
        ? {
            schema: "setfarm.operational-failure-cause.v1" as const,
            workflowStepId: step.step_id,
            boundary: "stage_context_assembly",
            failureClass: "contract_invalid" as const,
            failureCode: "V3_STAGE_INPUT_UNRESOLVED",
          }
        : undefined;
      const transitionTime = now();
      await pgBegin(async (sql) => {
        await closeReservedClaimRuntimeInTransaction(sql, {
          claimId: singleStepClaimId!,
          runId: step.run_id,
          workflowStepId: step.step_id,
          storyId: null,
          claimAgentId: agentId,
          outcome: "failed",
          diagnostic,
          runtime: singleStepRuntime,
        });
        const steps = await sql.unsafe<Array<{ id: string }>>(
          `UPDATE steps
              SET status = 'failed', output = $1, updated_at = $2
            WHERE id = $3 AND run_id = $4 AND step_id = $5 AND status = 'running'
            RETURNING id`,
          [diagnostic, transitionTime, step.id, step.run_id, step.step_id],
        );
        if (steps.length !== 1) throw new Error("V3_STAGE_INPUT_UNRESOLVED_STEP_CAS_LOST");
        await requestRunTerminationInTransaction(sql, {
          runId: step.run_id,
          targetStatus: "failed",
          requestedBy: "setfarm.v3-stage-input-authority",
          diagnostic,
          ...(operationalFailureCause ? { failureCause: operationalFailureCause } : {}),
          evidence: {
            schema: "setfarm.v3-stage-input-unresolved.v1",
            missingVariables: allMissing,
            modelRedispatchBudget: 0,
          },
          now: new Date(transitionTime),
        });
      });
      await recordObservation({
        runId: step.run_id,
        stepId: step.step_id,
        phase: "v3-pre-dispatch",
        checkId: `v3_stage_input.unresolved:${allMissing.join(",")}`,
        label: "V3 stage input authority",
        status: "blocked",
        summary: diagnostic,
        evidence: {
          schema: "setfarm.v3-stage-input-unresolved.v1",
          missingVariables: allMissing,
          modelRedispatchBudget: 0,
        },
      });
      const workflowId = await getWorkflowId(step.run_id);
      emitEvent({
        ts: now(), event: "step.failed", runId: step.run_id, workflowId,
        stepId: step.step_id, agentId, detail: diagnostic,
      });
      emitEvent({
        ts: now(), event: "run.failed", runId: step.run_id, workflowId,
        detail: diagnostic,
      });
      scheduleRunCronTeardown(step.run_id);
      return { found: false };
    }
    // Check step's retry_count to decide retry vs fail
    const stepRetry = await pgGet<{ retry_count: number }>("SELECT retry_count FROM steps WHERE id = $1", [step.id]);
    const retryCount = stepRetry?.retry_count ?? 0;
    logger.warn(`${reason} (retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
    if (retryCount > 0) {
      // Second occurrence — fail run (Wave 13 J-2: mark terminal so medic won't revive)
      await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
      await failRun(step.run_id, true);
      const wfId = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: reason });
      emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: reason });
      scheduleRunCronTeardown(step.run_id);
      await closeSingleStepHandoff("failed", reason + " — failing run (retry exhausted)");
    } else {
      // First occurrence — retry step (possible WAL lag)
      await pgRun("UPDATE steps SET status = 'pending', retry_count = retry_count + 1, output = $1, updated_at = $2 WHERE id = $3", [reason + " — retrying once", now(), step.id]);
      logger.info(`[missing-input] Step ${step.step_id} will retry — possible WAL lag`, { runId: step.run_id });
      await closeSingleStepHandoff("infra_retry", reason + " — retrying once");
    }
    return { found: false };
  }

  if (v3StageRetrySource && v3PriorStageRetryDedupeKeys) {
    const currentInstructionHash = crypto.createHash("sha256")
      .update(Buffer.from(resolvedInput, "utf8"))
      .digest("hex");
    const currentDedupeKey = createV3StageRetryDedupeKeyV1({
      workflowStepId: step.step_id,
      previousInstructionHash: v3StageRetrySource.previousInstruction.artifactHash,
      currentInstructionHash,
      previousOutputHash: v3StageRetrySource.previousOutput.artifactHash,
      failureHash: v3StageRetrySource.failure.failureHash,
    });
    if (v3PriorStageRetryDedupeKeys.has(currentDedupeKey)) {
      if (singleStepClaimId === null || !singleStepClaimEnvelope) {
        throw new Error("V3_STAGE_RETRY_DUPLICATE_CLAIM_AUTHORITY_MISSING");
      }
      const diagnostic = `V3_STAGE_RETRY_DUPLICATE_UNCHANGED_TUPLE: ${currentDedupeKey}; the same instruction/output/failure tuple cannot be sent to a model twice`;
      const operationalFailureCause = isV3OperationalStageWorkflowStepIdV1(step.step_id)
        ? {
            schema: "setfarm.operational-failure-cause.v1" as const,
            workflowStepId: step.step_id,
            boundary: "stage_retry_authority",
            failureClass: "retry_delta_missing" as const,
            failureCode: "V3_STAGE_RETRY_DUPLICATE_UNCHANGED_TUPLE",
          }
        : undefined;
      await pgBegin(async (sql) => {
        await closeReservedClaimRuntimeInTransaction(sql, {
          claimId: singleStepClaimId!,
          runId: step.run_id,
          workflowStepId: step.step_id,
          storyId: null,
          claimAgentId: agentId,
          outcome: "failed",
          diagnostic,
          runtime: singleStepRuntime,
        });
        await sql.unsafe(
          "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3 AND status IN ('pending', 'running')",
          [diagnostic, now(), step.id],
        );
        await requestRunTerminationInTransaction(sql, {
          runId: step.run_id,
          targetStatus: "failed",
          requestedBy: "setfarm.v3-stage-retry-authority",
          diagnostic,
          ...(operationalFailureCause ? { failureCause: operationalFailureCause } : {}),
          evidence: {
            schema: "setfarm.v3-stage-retry-dedupe-block.v1",
            dedupeKey: currentDedupeKey,
            modelRedispatchBudget: 0,
          },
        });
      });
      await recordObservation({
        runId: step.run_id,
        stepId: step.step_id,
        phase: "recovery",
        checkId: `v3.stage-retry.duplicate:${currentDedupeKey}`,
        label: "V3 stage retry dedupe",
        status: "blocked",
        summary: diagnostic,
        evidence: {
          schema: "setfarm.v3-stage-retry-dedupe-block.v1",
          dedupeKey: currentDedupeKey,
          modelRedispatchBudget: 0,
        },
      });
      await refreshRunContractSafe(step.run_id, "v3.stage-retry.duplicate");
      return { found: false };
    }
  }

  // Ensure observability has been recorded before returning an agent handoff.
  // Usually this is a no-op because heavy preClaim already opened the handoff.
  await recordSingleStepHandoff("claimSingleStep");

  if (singleStepClaimId === null) throw new Error("SINGLE_STEP_CLAIM_HANDOFF_MISSING");
  return {
    found: true,
    stepId: step.id,
    workflowStepId: step.step_id,
    runId: step.run_id,
    protocol: runProtocol?.protocol || "legacy",
    claimId: singleStepClaimId,
    claimAgentId: agentId,
    ...(singleStepRuntime ? {
      runtimeSessionId: singleStepRuntime.sessionId,
      runtimeOwnerInstanceId: singleStepRuntime.ownerInstanceId,
    } : {}),
    ...(v3StageRetrySource ? { v3StageRetrySource } : {}),
    resolvedInput,
  };
}

// ── End extracted helpers ────────────────────────────────────────────

/**
 * Throttle cleanupAbandonedSteps: run at most once every 30 seconds (matches cron interval).
 */
let lastCleanupTime = 0;

/**
 * Find and claim a pending step for an agent, returning the resolved input.
 */
export async function claimStep(
  agentId: string,
  callerGatewayAgent?: string,
  rawRuntimeIntent?: RuntimeClaimIntentV1,
  workIntent?: ClaimStepWorkIntent,
): Promise<ClaimResult> {
  const runtimeIntent = rawRuntimeIntent
    ? parseRuntimeClaimIntentV1(rawRuntimeIntent)
    : undefined;
  if (workIntent) {
    if (!runtimeIntent) throw new Error("V3_RECOVERY_RUNTIME_CLAIM_INTENT_REQUIRED");
    const executionRole = workIntent.recoveryDispatchClass === "supervisor_repair"
      ? "supervisor"
      : "developer";
    if (agentId !== `${workIntent.workflowId}_${executionRole}`) {
      throw new Error("V3_RECOVERY_CLAIM_ROLE_MISMATCH");
    }
    let admittedStory: Readonly<{
      runId: string;
      storyId: string;
      proof: CompilerStoryEnglishAdmissionClaimProofV1;
    }> | undefined;
    const recoveryWork = await createV3RecoveryWorkRouter(getSql(), {
      admitCandidate: async (candidate) => {
        const authority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
          getSql(),
          { runId: candidate.runId },
        );
        admittedStory = Object.freeze({
          runId: candidate.runId,
          storyId: candidate.storyId,
          proof: createCompilerStoryEnglishAdmissionClaimProofV1(authority),
        });
      },
    }).acquireNext({
      workflowId: workIntent.workflowId,
      dispatchClass: workIntent.recoveryDispatchClass,
      ownerInstanceId: runtimeIntent.ownerInstanceId,
    });
    if (recoveryWork) {
      if (!admittedStory
        || admittedStory.runId !== recoveryWork.step.run_id
        || admittedStory.storyId !== recoveryWork.story.story_id) {
        throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_RECOVERY_CANDIDATE_PROOF_MISSING");
      }
      return claimV3RecoveryWork(
        recoveryWork,
        agentId,
        callerGatewayAgent,
        runtimeIntent,
        executionRole,
        admittedStory.proof,
      );
    }
  }
  // Throttle cleanup: run at most once every 5 minutes across all agents
  const epochMs = Date.now();
  if (epochMs - lastCleanupTime >= CLEANUP_THROTTLE_MS) {
    await cleanupAbandonedSteps();
    lastCleanupTime = epochMs;
  }

  // OUTPUT RECOVERY: If a previous agent session died after writing output but before completing,
  // recover the output. Scans all setfarm-output-*.txt files (each parallel agent has its own).
  try {
    // Caller-scoped recovery must include both legacy direct files and
    // spawner-owned files: setfarm-output-<agent>-spawner-<id>.txt.
    const tmpFiles = recoverableOutputTmpFiles(callerGatewayAgent);
    for (const fileName of tmpFiles) {
      const filePath = `/tmp/${fileName}`;
      try {
        const recoveryOutput = fs.readFileSync(filePath, 'utf-8').trim();
        if (!recoveryOutput.includes('STATUS:')) continue;
        const runningStep = await pgGet<{ id: string; step_id: string; run_id: string }>(
          `SELECT s.id, s.step_id, s.run_id FROM steps s JOIN runs r ON r.id = s.run_id
           WHERE s.agent_id = $1 AND s.status = 'running' AND r.status = 'running'
           LIMIT 1`, [agentId]
        );
        if (runningStep) {
          // Skip orphan recovery for design step — pre-claim generates screens, recovery would corrupt output
          if (runningStep.step_id === 'design') {
            logger.info(`[output-recovery] Skipping orphan recovery for design step — pre-claim handles it`, { runId: runningStep.run_id });
            continue;
          }
          // v2026.4.12: Skip stories step if output lacks STORIES_JSON — prevents 0-stories auto-complete
          if (runningStep.step_id === 'stories' && !recoveryOutput.includes('STORIES_JSON')) {
            logger.info(`[output-recovery] Skipping orphan recovery for stories step — output lacks STORIES_JSON`, { runId: runningStep.run_id });
            continue;
          }
          logger.info(`[output-recovery] Found orphaned ${fileName} for ${runningStep.step_id} — auto-completing`, { runId: runningStep.run_id });
          try {
            const { completeStep } = await import("./step-ops.js");
            await completeStep(runningStep.id, recoveryOutput);
            fs.unlinkSync(filePath);
            return { found: false };
          } catch (e) {
            logger.warn(`[output-recovery] Auto-complete failed for ${fileName}: ${String(e)}`, { runId: runningStep.run_id });
          }
        }
      } catch (e) { logger.debug(`[output-recovery] Single file failed: ${String(e).slice(0, 80)}`); }
    }
  } catch (e) { logger.warn(`[output-recovery] Check failed: ${String(e)}`, {}); }

  // Allow claiming from both pending AND running loop steps (parallel story execution)
  //
  // DEVELOPER-POOL AWARE SELECTION:
  // For implement steps (the only pool-based step), restrict candidates to runs
  // that are either unassigned or assigned to THIS caller. Without this filter,
  // the LIMIT 1 could return a step belonging to another developer's run; the
  // downstream CAS would then fail and the caller would return NO_WORK even
  // though another claimable run exists (starvation bug — 2026-04-14 postmortem).
  // Also prefer own-run (0), then unassigned (1), so an already-reserved
  // developer resumes their own work before picking up a new one.
  const step = await pgGet<StepRow>(
        `SELECT s.id, s.step_id, s.run_id, s.step_index, s.input_template, s.type, s.loop_config, s.status as step_status, s.current_story_id, s.retry_count, s.output, r.protocol
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.agent_id = $1
           AND (
             s.status = 'pending'
             OR s.status = 'running'
           )
           AND r.status IN ('running', 'resuming')
           AND NOT ${PR_EACH_DELIVERY_BLOCKED_STEP_SQL}
           AND (
             $2::text IS NULL
             OR s.step_id <> 'implement'
             OR r.assigned_developer IS NULL
             OR r.assigned_developer = $2
           )
           AND NOT (
             s.step_id = 'verify'
             AND r.context::jsonb ? 'verify_pending_since'
             AND r.context::jsonb ? 'verify_pending_pr_url'
             AND (r.context::jsonb ->> 'verify_pending_since')::timestamptz > NOW() - ($3::int * interval '1 millisecond')
             AND NOT EXISTS (
               SELECT 1 FROM stories verify_done_st
               WHERE verify_done_st.run_id = s.run_id
                 AND verify_done_st.status = 'done'
                 AND verify_done_st.pr_url IS NOT NULL
                 AND verify_done_st.pr_url <> (r.context::jsonb ->> 'verify_pending_pr_url')
             )
           )
           AND NOT (
             s.step_id = COALESCE((
               SELECT NULLIF(verify_loop.loop_config::jsonb ->> 'verifyStep', '')
               FROM steps verify_loop
               WHERE verify_loop.run_id = s.run_id
                 AND verify_loop.type = 'loop'
                 AND verify_loop.step_id = 'implement'
                 AND COALESCE(verify_loop.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
               LIMIT 1
             ), 'verify')
             AND EXISTS (
               SELECT 1 FROM stories verify_wait_st
               WHERE verify_wait_st.run_id = s.run_id
                 AND verify_wait_st.status = 'done'
                 AND (
                   COALESCE(r.context::jsonb ->> 'supervised_story_ids', '') = ''
                   OR POSITION(',' || verify_wait_st.story_id || ',' IN ',' || COALESCE(r.context::jsonb ->> 'supervised_story_ids', '') || ',') = 0
                 )
             )
           )
           AND NOT EXISTS (
             SELECT 1 FROM steps prev
	             WHERE prev.run_id = s.run_id
	               AND prev.step_index < s.step_index
	               AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
	               AND NOT (
	                 prev.type = 'loop'
	                 AND prev.status = 'running'
	                 AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
	                 AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
	                 AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	               AND NOT (
	                 prev.type = 'loop'
	                 AND prev.status = 'pending'
	                 AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
	                 AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
	                 AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	               AND NOT (
	                 s.step_id = COALESCE((
	                   SELECT NULLIF(sup_loop.loop_config::jsonb ->> 'superviseStep', '')
	                   FROM steps sup_loop
	                   WHERE sup_loop.run_id = s.run_id
	                     AND sup_loop.type = 'loop'
	                     AND sup_loop.step_id = 'implement'
	                     AND COALESCE(sup_loop.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
	                   LIMIT 1
	                 ), 'supervise')
	                 AND EXISTS (
	                   SELECT 1 FROM stories sup_done_st
	                   WHERE sup_done_st.run_id = s.run_id
	                     AND sup_done_st.status = 'done'
	                 )
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_ALIAS_SQL})
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	           )
         ORDER BY
           CASE
             WHEN s.status = 'running' THEN 0
             WHEN $2::text IS NOT NULL AND r.assigned_developer = $2 THEN 0
             WHEN r.assigned_developer IS NULL THEN 1
             ELSE 2
           END,
           s.step_index ASC, s.status ASC
         LIMIT 1`, [agentId, callerGatewayAgent ?? null, PR_REVIEW_DELAY_MS]);

  if (!step) return { found: false };

  let storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1 | undefined;
  if (step.protocol === "v3"
    && ((step.step_id === "implement" && step.type === "loop")
      || (step.step_id === "supervise" && step.type === "single"))) {
    const authority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
      getSql(),
      { runId: step.run_id },
    );
    storyAdmissionProof = createCompilerStoryEnglishAdmissionClaimProofV1(authority);
  }

  // Cheap pre-guard. The publication transaction locks and revalidates the run.
  if (![RUN_STATUS.RUNNING, "resuming"].includes((await getRunStatus(step.run_id)) as any)) {
    return { found: false };
  }

  // DESIGN STEP DEDUP
  if (await handleDesignDedup(step, null)) return { found: false };

  // DEPLOY ENV GUARD
  await handleDeployEnvGuard(step);

  // Get run context
  const context: Record<string, string> = await getRunContext(step.run_id);

  // Always inject run_id so templates can use {{run_id}} (e.g. for scoped progress files)
  context["run_id"] = step.run_id;

  // Keep branch aliases canonical after setup-repo. A stale lowercase `branch`
  // with a newer uppercase `BRANCH` can make setup-build publish from the wrong ref.
  if (step.step_index >= 4 && context["repo"]) {
    normalizeRunBranchContext(context, step.run_id, context["repo"]);
  }

  // Compute has_frontend_changes from git diff when repo and branch are available
  if (context["repo"] && context["branch"]) {
    context["has_frontend_changes"] = computeHasFrontendChanges(context["repo"], context["branch"]);
  } else {
    context["has_frontend_changes"] = "false";
  }

  // T6: Loop step claim logic
  if (step.type === "loop") {
    const loopConfig: LoopConfig | null = parseLoopConfigSafe(step.loop_config, step.run_id);
    if (loopConfig?.over === "stories") {
      const isPrEach = loopConfig?.mergeStrategy === "pr-each" || !!loopConfig?.verifyEach;
      const runProtocol = await pgGet<{ protocol: string }>(
        "SELECT protocol FROM runs WHERE id = $1",
        [step.run_id],
      );
      // Bug C fix (plan: reactive-frolicking-cupcake.md, run #342 postmortem):
      // Capture the base branch's commit SHA on the FIRST claim of the implement
      // loop and store it in context. All story worktrees in this loop must be
      // created from the SAME commit, even if setup-build later writes more
      // commits to the same branch (which run #342 actually did — there was a
      // 269c2df setup-build commit, then a 9c26285 follow-up after the agent
      // already reported done; US-001's worktree was on 269c2df while US-002+
      // were on 9c26285, and the merge queue then conflicted on package.json
      // because the bases diverged).
      //
      // Once captured, the value is sticky for the lifetime of a direct-merge
      // implement step. pr-each intentionally uses moving main after each PR merge.
      if (isPrEach && context["implement_base_commit"]) {
        delete context["implement_base_commit"];
        await updateRunContext(step.run_id, context);
        logger.info(`[implement] Cleared pinned base commit because pr-each uses main after each merge`, { runId: step.run_id });
      }
      if (
        runProtocol?.protocol !== "v3"
        && !isPrEach
        && context["repo"]
        && context["branch"]
        && !context["implement_base_commit"]
      ) {
        try {
          const sha = execFileSync("git", ["rev-parse", context["branch"]], {
            cwd: context["repo"], encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
          }).trim();
          if (/^[0-9a-f]{40}$/i.test(sha)) {
            context["implement_base_commit"] = sha;
            await updateRunContext(step.run_id, context);
            logger.info(`[implement] Captured base commit ${sha.slice(0, 8)} from ${context["branch"]} — all story worktrees will be created from this SHA`, { runId: step.run_id });
          }
        } catch (e) {
          logger.warn(`[implement] Could not capture base commit for ${context["branch"]}: ${String(e).slice(0, 150)}`, { runId: step.run_id });
        }
      }

      // Idempotent loop claim: some agents may accidentally run `step claim` twice.
      // The first call moves the story to running; the second used to return NO_WORK
      // and overwrite the claim file, leaving the story orphaned. Re-issue the same
      // running story to this role instead of burning the claim.
      if (step.current_story_id) {
        const runningStory = await pgGet<any>("SELECT * FROM stories WHERE id = $1 AND run_id = $2 AND status = 'running'", [step.current_story_id, step.run_id]);
        if (runningStory && (!runningStory.claimed_by || runningStory.claimed_by === agentId)) {
          const idempotentProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
            "SELECT protocol FROM runs WHERE id = $1",
            [step.run_id],
          );
          const existingClaim = await pgGet<{
            id: string;
            session_id: string | null;
            owner_instance_id: string | null;
            attempt_id: string | null;
          }>(
            `SELECT cl.id::text, rs.session_id, rs.owner_instance_id, rs.attempt_id
               FROM claim_log cl
               LEFT JOIN runtime_sessions rs ON rs.claim_id = cl.id
              WHERE cl.run_id = $1
                AND cl.step_id = $2
                AND cl.story_id = $3
                AND cl.agent_id = $4
                AND cl.outcome IS NULL
              ORDER BY cl.id DESC
              LIMIT 1`,
            [step.run_id, step.step_id, runningStory.story_id, agentId],
          );
          const claimId = Number(existingClaim?.id);
          if (!Number.isSafeInteger(claimId) || claimId <= 0) {
            logger.warn(`[claim-idempotent] Refusing to re-issue ${runningStory.story_id} without its exact open claim`, { runId: step.run_id, stepId: step.step_id });
            return { found: false };
          }
          if (existingClaim?.session_id) {
            if (!runtimeIntent || existingClaim.session_id !== runtimeIntent.sessionId) {
              logger.warn(`[claim-idempotent] Durable runtime ${existingClaim.session_id} still owns ${runningStory.story_id}; refusing a second runtime`, { runId: step.run_id, stepId: step.step_id });
              return { found: false };
            }
          } else if ((idempotentProtocol?.protocol || "legacy") !== "legacy") {
            logger.warn(`[claim-idempotent] Compiler claim ${claimId} has no durable runtime owner`, { runId: step.run_id, stepId: step.step_id });
            return { found: false };
          }
          const storyBranch = (runningStory.story_branch || `${step.run_id.slice(0, 8)}-${runningStory.story_id}`).toLowerCase();
          context["story_branch"] = storyBranch;
          if (context["repo"]) {
            const storyWorkdir = findWorktreeDir(context["repo"], storyBranch, agentId) || findWorktreeDir(context["repo"], runningStory.story_id, agentId) || "";
            if (storyWorkdir) context["story_workdir"] = storyWorkdir;
          }
          context["claim_generation"] = String(runningStory.claim_generation ?? 0);
          await injectStoryContext(runningStory, step, context);
          if (step.step_id === "implement") {
            try {
              const { buildTestGenerationPrompt } = await import("./test-generation.js");
              const techStack = context["tech_stack"] || "react";
              const acceptanceCriteria = runningStory.title || "";
              context["test_generation_prompt"] = buildTestGenerationPrompt(runningStory.title, acceptanceCriteria, techStack);
            } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          }
          const prunedContextLoop = pruneContextForStep(context, step.step_id);
          let resolvedInput = await resolveLoopClaimInput(step, prunedContextLoop, context);
          let attempt: ClaimAttemptFenceV1 | undefined;
          if ((idempotentProtocol?.protocol || "legacy") !== "legacy") {
            const fence = await ensureCompilerClaimFence(getSql(), {
              claimId,
              runId: step.run_id,
              stepId: step.step_id,
              storyId: runningStory.story_id,
              storyDbId: runningStory.id,
              claimAgentId: agentId,
              diagnostic: "COMPILER_IDEMPOTENT_CLAIM_FENCE_REQUIRED",
            });
            if (fence.status !== "fenced") {
              logger.warn(`[claim-idempotent] Compiler fence unavailable for ${runningStory.story_id}: ${fence.status === "blocked" ? fence.reason : fence.status}`, { runId: step.run_id, stepId: step.step_id });
              return { found: false };
            }
            attempt = fence.attempt;
            if (idempotentProtocol?.protocol === "v3") {
              const compiled = await loadV3ImplementationAttemptContext({
                runId: step.run_id,
                storyId: runningStory.story_id,
                attemptId: attempt.attemptId,
              });
              applyV3ImplementationSliceContext(context, compiled);
              resolvedInput = await resolveLoopClaimInput(
                step,
                pruneContextForStep(context, step.step_id),
                context,
              );
            }
            if (existingClaim?.session_id && !existingClaim.attempt_id) {
              await pgBegin((sql) => bindRuntimeSessionAttemptInTransaction(sql, {
                sessionId: existingClaim.session_id!,
                attemptId: attempt!.attemptId,
                ownerInstanceId: existingClaim.owner_instance_id!,
              }));
            }
          }
          logger.info(`[claim-idempotent] Re-issued running story ${runningStory.story_id} to ${agentId}`, { runId: step.run_id, stepId: step.step_id });
          return {
            found: true,
            stepId: step.id,
            workflowStepId: step.step_id,
            runId: step.run_id,
            protocol: idempotentProtocol?.protocol || "legacy",
            storyId: runningStory.story_id,
            storyDbId: runningStory.id,
            claimGeneration: Number(runningStory.claim_generation ?? 0),
            claimId,
            claimAgentId: agentId,
            ...(existingClaim?.session_id ? {
              runtimeSessionId: existingClaim.session_id,
              runtimeOwnerInstanceId: existingClaim.owner_instance_id!,
            } : {}),
            ...(attempt ? { attempt } : {}),
            resolvedInput,
          };
        }
      }

      // Auto-complete stories that already have a PR (open or merged)
      const runIdPrefix = step.run_id.slice(0, 8);
      if (runProtocol?.protocol !== "v3") {
        await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null);
      }

      if (runProtocol?.protocol !== "v3" && isPrEach && isOpenPrDeliveryBlockerContext(context)) {
        const blockedStoryId = prDeliveryBlockerStoryId(context);
        if (blockedStoryId) {
          const blockedStory = await pgGet<{ status: string }>(
            "SELECT status FROM stories WHERE run_id = $1 AND story_id = $2 LIMIT 1",
            [step.run_id, blockedStoryId],
          );
          if (blockedStory?.status === "verified") {
            clearVerifiedStoryFailureContext(context);
            delete context["current_story_id"];
            delete context["current_story_title"];
            delete context["current_story"];
            delete context["pr_url"];
            delete context["story_branch"];
            await updateRunContext(step.run_id, context);
            logger.info(`[pr-each] Cleared stale PR delivery blocker for verified story ${blockedStoryId}`, { runId: step.run_id });
          }
        }
      }

      if (runProtocol?.protocol !== "v3" && isPrEach && isOpenPrDeliveryBlockerContext(context)) {
        const activeRetriedForDeliveryBlocker = await pgGet<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_SQL}`,
          [step.run_id],
        );
        const activeQaFixForDeliveryBlocker = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
          [step.run_id],
        );
        if (
          parseInt(activeRetriedForDeliveryBlocker?.cnt || "0", 10) === 0
          && parseInt(activeQaFixForDeliveryBlocker?.cnt || "0", 10) === 0
        ) {
          const blockedStoryId = prDeliveryBlockerStoryId(context);
          const verifyStepName = loopConfig.verifyStep || "verify";
          await pgRun(
            "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting','done','pending','running')",
            [now(), step.run_id, verifyStepName],
          );
          await recordGateObservation({
            runId: step.run_id,
            stepId: step.step_id,
            storyId: blockedStoryId,
            checkId: "implement.pr_each_delivery_blocker",
            label: "PR-each delivery blocker",
            status: "blocked",
            summary: context["failure_category"] || "Open verify/PR delivery blocker",
            detail: String(context["previous_failure"] || context["verify_feedback"] || "").slice(0, 1500),
          });
          logger.warn(`[pr-each] Blocking new story claim while verify delivery blocker is open: ${context["failure_category"] || "unknown"} ${blockedStoryId}`, { runId: step.run_id });
          return { found: false };
        }
      }

      // pr-each means strict serial delivery: a story with status=done must be
      // reviewed, fixed, merged into main, and marked verified before the next
      // story can be claimed. This prevents US-002/US-003 from branching from a
      // stale baseline while US-001's PR is still open.
      if (runProtocol?.protocol !== "v3" && loopConfig?.superviseEach && loopConfig.superviseStep) {
        const superviseActiveRetriedStory = await pgGet<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_SQL}`,
          [step.run_id],
        );
        const activeQaFix = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
          [step.run_id],
        );
        const awaitingSupervisor = await findUnsupervisedDoneStory(step.run_id, context);
        if (
          awaitingSupervisor
          && parseInt(activeQaFix?.cnt || "0", 10) === 0
          && parseInt(superviseActiveRetriedStory?.cnt || "0", 10) === 0
        ) {
          context["supervisor_scope"] = "story";
          context["current_story_id"] = awaitingSupervisor.story_id;
          context["current_story_title"] = awaitingSupervisor.title;
          if (awaitingSupervisor.pr_url) context["pr_url"] = awaitingSupervisor.pr_url;
          if (awaitingSupervisor.story_branch) context["story_branch"] = awaitingSupervisor.story_branch;
          context["story_diff_base"] = (loopConfig.mergeStrategy === "pr-each" || loopConfig.verifyEach)
            ? "main"
            : (context["story_base_ref"] || context["branch"] || "main");
          await updateRunContext(step.run_id, context);
          await pgRun(
            "UPDATE steps SET status = 'pending', current_story_id = $1, updated_at = $2 WHERE run_id = $3 AND step_id = $4 AND status IN ('waiting','done','pending')",
            [awaitingSupervisor.id, now(), step.run_id, loopConfig.superviseStep],
          );
          logger.info(`[supervise-each] Waiting for supervisor before verify: ${awaitingSupervisor.story_id}`, { runId: step.run_id });
          return { found: false };
        }
      }

      if (loopConfig?.verifyEach && loopConfig.verifyStep) {
        const activeRetriedStory = await pgGet<{ cnt: string }>(
          `SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running') AND ${ACTIVE_RETRY_STORY_SQL}`,
          [step.run_id],
        );
        const awaitingVerify = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
          [step.run_id],
        );
        const activeQaFix = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
          [step.run_id],
        );
        if (
          parseInt(awaitingVerify?.cnt || "0", 10) > 0
          && parseInt(activeQaFix?.cnt || "0", 10) === 0
          && parseInt(activeRetriedStory?.cnt || "0", 10) === 0
        ) {
          await pgRun(
            "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting','done','pending')",
            [now(), step.run_id, loopConfig.verifyStep],
          );
          logger.info(`[pr-each] Waiting for done story PR verification before claiming next story`, { runId: step.run_id });
          return { found: false };
        }
      }

      // Story selection + claim must be atomic to prevent
      // two parallel crons from selecting the same story (race condition fix #4)
      // P2-01: Fake transaction removed — claim uses RETURNING for atomicity

      let pendingStories: any[] = [];
      let nextStory: any | undefined;
      let v3PreparationAuthority: V3PreparationClaimAuthorityV1 | undefined;
      let v3PreparedBaseRevision: V3PreparationClaimAuthorityV1["baseRevision"] | undefined;
      let v3SupervisorRetryPreparationSource: Awaited<ReturnType<
        typeof loadAuthenticatedV3SupervisorRetryPreparationSourceV1
      >>;

      if (runProtocol?.protocol === "v3") {
        if (step.step_id !== "implement") {
          logger.error("[v3-preclaim] Story loop is not the canonical implement step", {
            runId: step.run_id,
            stepId: step.step_id,
          });
          return { found: false };
        }
        const sql = getSql();
        const artifactReader = createRuntimeArtifactReader({
          sql,
          artifactRoot: resolveProductArtifactDir(),
          artifactLimits: resolveProductArtifactCapacity(),
        });
        v3SupervisorRetryPreparationSource = await loadAuthenticatedV3SupervisorRetryPreparationSourceV1(
          sql,
          {
            runId: step.run_id,
            stepDbId: step.id,
            workflowStepId: step.step_id,
          },
        );
        const blockRepository = createV3PreparationBlockRepository(sql);
        const preclaim = createV3NormalImplementationPreclaim({
          readPacket: (runId) => artifactReader.readSealedPacket(runId),
          readPendingStories: createPostgresV3PendingStoryReader(sql),
          readTerminalDependencyAttempts: createPostgresTerminalDependencyAttemptReader(sql),
          blockRepository,
          ...((isPrEach || v3SupervisorRetryPreparationSource)
            ? {
                syncBeforePin: ({ repo }: { repo: string }) => {
                  if (v3SupervisorRetryPreparationSource) {
                    execFileSync(
                      "git",
                      ["check-ref-format", "--branch", v3SupervisorRetryPreparationSource.storyBranch],
                      { cwd: repo, timeout: 5_000, stdio: ["ignore", "ignore", "pipe"] },
                    );
                    execFileSync(
                      "git",
                      [
                        "fetch",
                        "origin",
                        `refs/heads/${v3SupervisorRetryPreparationSource.storyBranch}:refs/remotes/origin/${v3SupervisorRetryPreparationSource.storyBranch}`,
                      ],
                      { cwd: repo, timeout: 20_000, stdio: ["ignore", "ignore", "pipe"] },
                    );
                  } else if (!syncBaseBranch(repo, "main")) {
                    throw new Error("V3_NORMAL_PRECLAIM_PR_EACH_SYNC_FAILED");
                  }
                },
              }
            : {}),
        });
        const requestedBaseRef = v3SupervisorRetryPreparationSource
          ? `refs/remotes/origin/${v3SupervisorRetryPreparationSource.storyBranch}`
          : isPrEach
            ? "main"
            : (context["implement_base_commit"] || context["branch"] || "master");
        const prepared = await preclaim.prepare({
          runId: step.run_id,
          stepId: step.step_id,
          repo: context["repo"] || "",
          requestedBaseRef,
          ...(v3SupervisorRetryPreparationSource
            ? { supervisorRetryPreparationSource: v3SupervisorRetryPreparationSource }
            : {}),
          ...(v3SupervisorRetryPreparationSource
            ? { expectedSha: v3SupervisorRetryPreparationSource.sourceRevision.sha }
            : {}),
          ...(!isPrEach && !v3SupervisorRetryPreparationSource && context["implement_base_commit"]
            ? { expectedSha: context["implement_base_commit"] }
            : {}),
        });
        if (prepared.status === "blocked") {
          if (prepared.block && prepared.ledgerStatus !== "unchanged") {
            await recordObservation({
              runId: step.run_id,
              stepId: step.step_id,
              storyId: prepared.story?.story_id,
              phase: "v3-normal-preclaim",
              checkId: `v3_preparation.block:${prepared.block.blockId}`,
              label: "V3 implementation preparation",
              status: "blocked",
              summary: prepared.error.code,
              detail: prepared.error.message.slice(0, 4_000),
              evidence: prepared.block,
            });
          }
          logger.warn(`[v3-preclaim] ${prepared.error.code}: ${prepared.error.message}`, {
            runId: step.run_id,
            stepId: step.step_id,
          });
          return { found: false };
        }
        if (prepared.status === "ready") {
          if (v3SupervisorRetryPreparationSource && (
            prepared.story.id !== v3SupervisorRetryPreparationSource.storyDbId
            || prepared.story.story_id !== v3SupervisorRetryPreparationSource.storyId
          )) {
            throw new Error("V3_SUPERVISOR_RETRY_PREPARATION_STORY_DRIFT");
          }
          const exactStory = await pgGet<any>(
            `SELECT * FROM stories
              WHERE id = $1 AND run_id = $2 AND story_id = $3 AND status = 'pending'
              LIMIT 1`,
            [prepared.story.id, step.run_id, prepared.story.story_id],
          );
          if (!exactStory) return { found: false };
          nextStory = exactStory;
          pendingStories = [exactStory];
          v3PreparationAuthority = prepared.authority;
          v3PreparedBaseRevision = prepared.baseRevision;
          if (!isPrEach && !v3SupervisorRetryPreparationSource
            && context["implement_base_commit"] !== prepared.baseRevision.sha) {
            context["implement_base_commit"] = prepared.baseRevision.sha;
            await updateRunContext(step.run_id, context);
          }
        }
      } else {
        // Legacy/shadow keep the historical dependency/status semantics byte-for-byte.
        pendingStories = await pgQuery<any>(
          `SELECT * FROM stories
           WHERE run_id = $1 AND status = 'pending'
           ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC`,
          [step.run_id],
        );

        for (const candidate of pendingStories) {
          if (candidate.depends_on) {
            try {
              const deps: string[] = JSON.parse(candidate.depends_on);
              if (deps.length > 0) {
                const completedIds = (await pgQuery<{ story_id: string }>("SELECT story_id FROM stories WHERE run_id = $1 AND status IN ('done', 'failed', 'verified', 'skipped')", [step.run_id])
                ).map((r: any) => r.story_id);
                const completedSet = new Set(completedIds);
                const unmet = deps.filter(d => !completedSet.has(d));
                if (unmet.length > 0) {
                  logger.info(`Story ${candidate.story_id} blocked by unmet dependencies: ${unmet.join(', ')}`, { runId: step.run_id });
                  continue;
                }
              }
            } catch (e) {
              logger.warn(`Failed to parse depends_on for story ${candidate.story_id}: ${String(e)}`, { runId: step.run_id });
            }
          }
          nextStory = candidate;
          break;
        }
      }

      if (!nextStory) {
        // (removed: fake transaction cleanup)
        // Wave 1 fix #2 (plan: reactive-frolicking-cupcake): previously, if there were no
        // next pending stories but a failed story existed, we called skipFailedStories to
        // convert failed → skipped so the loop could "finish" and the pipeline could march
        // on. Commit 96dd442 removed the equivalent call from step-advance.ts with the
        // message "fail run if any story fails — no more silent skip + broken deploy", but
        // this claim-path copy was left behind, re-introducing the silent skip whenever a
        // loop runs out of pending work while holding a failed story. We now leave failed
        // stories in 'failed' status so the run-level guardrail in checkLoopContinuation
        // fails the run instead of silently marching on.
        const failedStory = await pgGet<{ id: string; story_id: string }>(
          "SELECT id, story_id FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index, id LIMIT 1",
          [step.run_id],
        );

        // Check if other stories are still running in parallel
        const runningStory = await pgGet<{ id: string }>("SELECT id FROM stories WHERE run_id = $1 AND status = 'running'", [step.run_id]);
        if (runningStory) {
          // (removed: fake transaction cleanup)
        return { found: false }; // Other stories still running, wait for them
        }

        if (failedStory) {
          const pendingCompletionOwner = await pgGet<{ count: number }>(
            `SELECT COUNT(*)::integer AS count
               FROM runtime_completion_requests rcr
              WHERE rcr.run_id = $1
                AND rcr.story_db_id = $2
                AND (
                  rcr.state IN ('requested', 'draining', 'processing')
                  OR EXISTS (
                    SELECT 1 FROM runtime_completion_effects rce
                     WHERE rce.request_id = rcr.request_id
                       AND rce.mandatory
                       AND rce.state NOT IN ('applied', 'reconciled')
                  )
                )`,
            [step.run_id, failedStory.id],
          );
          if ((pendingCompletionOwner?.count ?? 0) > 0) {
            logger.info("[loop-guard] Failed story is still owned by its durable completion effect", {
              runId: step.run_id,
              stepId: step.step_id,
            });
            return { found: false };
          }

          const failedRunProtocol = await pgGet<{ protocol: string }>(
            "SELECT protocol FROM runs WHERE id = $1",
            [step.run_id],
          );
          let failureDiagnostic = `LOOP_FAILED_STORY_TERMINAL: story ${failedStory.story_id || failedStory.id} is failed and has no durable recovery owner`;
          if (failedRunProtocol?.protocol === "v3") {
            const recovery = await pgGet<{
              recovery_status: string | null;
              active_deliveries: number;
            }>(
              `SELECT rc.status AS recovery_status,
                      (SELECT COUNT(*)::integer
                         FROM recovery_dispatch_deliveries delivery
                        WHERE delivery.run_id = $1
                          AND delivery.story_id = $2
                          AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_deliveries
                 FROM recovery_cases rc
                WHERE rc.run_id = $1 AND rc.story_id = $2
                ORDER BY rc.updated_at DESC, rc.recovery_case_id
                LIMIT 1`,
              [step.run_id, failedStory.story_id || ""],
            );
            if ((recovery?.active_deliveries ?? 0) > 0) {
              logger.info("[loop-guard] Canonical recovery delivery owns the failed v3 story", {
                runId: step.run_id,
                stepId: step.step_id,
              });
              return { found: false };
            }
            failureDiagnostic = recovery?.recovery_status === "blocked"
              ? `V3_RECOVERY_BUDGET_EXHAUSTED: story ${failedStory.story_id || failedStory.id} reached canonical blocked state`
              : `V3_RECOVERY_OWNER_MISSING: failed story ${failedStory.story_id || failedStory.id} has no active delivery or mandatory completion effect (case=${recovery?.recovery_status || "missing"})`;
          }
          logger.error(failureDiagnostic, { runId: step.run_id, stepId: step.step_id });
          await pgRun(
            "UPDATE steps SET status = 'failed', current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3 AND status IN ('pending', 'running')",
            [failureDiagnostic, now(), step.id],
          );
          await failRun(step.run_id, true, failureDiagnostic);
          const failedWfId = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: failedWfId, stepId: step.step_id, detail: failureDiagnostic });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: failedWfId, detail: failureDiagnostic });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // DEPENDENCY DEADLOCK GUARD: pending stories exist but all blocked by deps — FAIL RUN (v1.5.53)
        if (pendingStories.length > 0 && !failedStory) {
          const deadlockMsg = `Dependency deadlock: ${pendingStories.length} pending stories all blocked by unmet dependencies — failing run`;
          logger.error(deadlockMsg, { runId: step.run_id });
          for (const blocked of pendingStories) {
            await pgRun("UPDATE stories SET status = 'failed', output = 'Failed: dependency deadlock', updated_at = $1 WHERE id = $2", [now(), blocked.id]);
          }
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [deadlockMsg, now(), step.id]);
          await failRun(step.run_id, true);
          const wfIdDL = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdDL, stepId: step.step_id, detail: deadlockMsg });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdDL, detail: deadlockMsg });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // #157 GUARD: 0 total stories means planner did not produce STORIES_JSON
        const totalStories = { cnt: await countAllStories(step.run_id) };
        if (totalStories.cnt === 0) {
          const noStoriesReason = "No stories exist — planner did not produce STORIES_JSON";
          logger.warn(noStoriesReason, { runId: step.run_id, stepId: step.step_id });
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [noStoriesReason, now(), step.id]);
          await failRun(step.run_id, true);
          const wfId157 = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId157, stepId: step.step_id, detail: noStoriesReason });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId157, detail: noStoriesReason });
          scheduleRunCronTeardown(step.run_id);
          return { found: false };
        }

        // PENDING STORY GUARD: If pending stories remain but agent said "done", DON'T complete the loop.
        // Reset step to pending so the next claim cycle picks up remaining stories.
        const remainingPending = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'pending'", [step.run_id]);
        if ((remainingPending?.cnt ?? 0) > 0) {
          logger.warn(`[loop-guard] ${remainingPending?.cnt} pending stories remain — refusing to complete implement loop`, { runId: step.run_id });
          await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
          return { found: false };
        }

        const durableCompletionOwner = await pgGet<{ count: number }>(
          `SELECT COUNT(*)::integer AS count
             FROM runtime_completion_requests rcr
            WHERE rcr.run_id = $1 AND rcr.step_db_id = $2
              AND (
                rcr.state IN ('requested', 'draining', 'processing')
                OR EXISTS (
                  SELECT 1 FROM runtime_completion_effects rce
                   WHERE rce.request_id = rcr.request_id
                     AND rce.mandatory
                     AND rce.state NOT IN ('applied', 'reconciled')
                )
              )`,
          [step.run_id, step.id],
        );
        if ((durableCompletionOwner?.count ?? 0) > 0) {
          logger.info("[loop-guard] Durable completion/effect owner still controls loop finalization", {
            runId: step.run_id,
            stepId: step.step_id,
          });
          return { found: false };
        }

        const finalLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
        if (finalLoopConfig?.mergeStrategy === "direct-merge") {
          const diagnostic = "DIRECT_MERGE_COMPLETION_RECEIPT_MISSING: all stories are terminal but no durable merge/final-PR effect owns loop finalization";
          await pgRun(
            "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
            [diagnostic, now(), step.id],
          );
          await failRun(step.run_id, true, diagnostic);
          emitEvent({
            ts: now(),
            event: "step.failed",
            runId: step.run_id,
            workflowId: await getWorkflowId(step.run_id),
            stepId: step.step_id,
            detail: diagnostic,
          });
          return { found: false };
        }

        // No pending, running, failed, or durable completion-owned stories.
        // Only a non-direct-merge loop may publish done from this claim path.
        await pgRun("UPDATE steps SET status = 'done', updated_at = $1 WHERE id = $2", [now(), step.id]);
        emitEvent({ ts: now(), event: "step.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
        await advancePipeline(step.run_id);
        return { found: false };
      }

      if (
        runProtocol?.protocol !== "v3"
        && await fastForwardMechanicallySatisfiedPrReviewRetry(step, nextStory, context)
      ) {
        logger.info(`[claim] Fast-forwarded satisfied PR review retry for ${nextStory.story_id}; verify will re-check PR state`, { runId: step.run_id });
        return { found: false };
      }

      // PARALLEL LIMIT: Don't exceed max concurrent running stories
      const runningStoryCount = { cnt: await countStoriesByStatus(step.run_id, "running") };
      // Compatibility fence: legacy completion APIs identify only the shared
      // loop step. Compiler runs stay serial until the immutable completion
      // token replaces steps.current_story_id as lifecycle authority.
      const parallelLimit = runProtocol?.protocol === "legacy" ? (loopConfig?.parallelCount ?? 3) : 1;
      if (runningStoryCount.cnt >= parallelLimit) {
        // (removed: fake transaction cleanup)
        return { found: false }; // At capacity, wait for running stories to finish
      }

      // ISSUE-1 FIX: Use {runIdPrefix}-{storyId} for branch name to prevent collisions across runs
      const storyRunPrefix = step.run_id.slice(0, 8);
      const isPostMergeQualityRepair =
        context["failure_category"] === "POST_MERGE_QUALITY_REGRESSION" ||
        context["post_merge_quality_regression_story_id"] === nextStory.story_id ||
        /\bPOST_MERGE_QUALITY_REGRESSION\b/i.test(String(nextStory.output || ""));
      const existingStoryBranch = String(nextStory.story_branch || "").trim().toLowerCase();
      const storyBranch = (
        isPostMergeQualityRepair
          ? `${storyRunPrefix}-${nextStory.story_id}-repair-${Math.max(1, Number(nextStory.retry_count || 0))}`
          : (existingStoryBranch || `${storyRunPrefix}-${nextStory.story_id}`)
      ).toLowerCase();

      // GUARD: Repo path MUST exist — without it, agent works in wrong directory
      if (!context["repo"]) {
        const noRepoReason = "MISSING_REPO: context['repo'] is empty — cannot implement story without project path";
        logger.error(`[claim] ${noRepoReason} (story=${nextStory.story_id})`, { runId: step.run_id });
        await pgRun("UPDATE stories SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
          [noRepoReason, now(), nextStory.id]);
        emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, detail: noRepoReason });
        return { found: false };
      }

      if (
        runProtocol?.protocol === "v3"
        && (!v3PreparationAuthority || !v3PreparedBaseRevision)
      ) {
        const reason = "V3_PREPARATION_AUTHORITY_UNAVAILABLE: a v3 story reached publication without the exact ready authority";
        const transitionTime = now();
        await pgBegin(async (sql) => {
          const lockedRuns = await sql.unsafe<Array<{ id: string }>>(
            `SELECT id FROM runs
              WHERE id = $1 AND protocol = 'v3' AND status IN ('running', 'resuming')
              FOR UPDATE`,
            [step.run_id],
          );
          if (lockedRuns.length !== 1) {
            throw new Error("V3_PRE_DISPATCH_RUN_LOCK_INVALID");
          }
          await sql.unsafe(
            `UPDATE stories
                SET status = 'failed', output = $2, claimed_at = NULL,
                    claimed_by = NULL, updated_at = $3
              WHERE id = $1 AND run_id = $4 AND story_id = $5 AND status = 'pending'`,
            [nextStory.id, reason, transitionTime, step.run_id, nextStory.story_id],
          );
          await sql.unsafe(
            `UPDATE steps
                SET status = 'failed', output = $2, current_story_id = NULL, updated_at = $3
              WHERE id = $1 AND run_id = $4 AND step_id = $5 AND status IN ('pending', 'running')`,
            [step.id, reason, transitionTime, step.run_id, step.step_id],
          );
          await requestRunTerminationInTransaction(sql, {
            runId: step.run_id,
            targetStatus: "failed",
            requestedBy: "setfarm.v3-pre-dispatch",
            diagnostic: reason,
            failureCause: {
              schema: "setfarm.operational-failure-cause.v1",
              workflowStepId: step.step_id,
              boundary: "implementation.pre_dispatch",
              failureClass: "platform_authority_invalid",
              failureCode: "V3_PREPARATION_AUTHORITY_UNAVAILABLE",
            },
            evidence: { source: "claimLoopStep", errorCode: "V3_PREPARATION_AUTHORITY_UNAVAILABLE" },
            now: new Date(transitionTime),
          });
        });
        await recordObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: nextStory.story_id,
          phase: "v3-pre-dispatch",
          checkId: "v3_pre_dispatch.authority_unavailable",
          label: "V3 implementation pre-dispatch authority",
          status: "blocked",
          summary: "Missing preparation authority terminalized before claim publication",
          detail: reason,
          evidence: {
            schema: "setfarm.v3-pre-dispatch-authority-failure.v1",
            errorCode: "V3_PREPARATION_AUTHORITY_UNAVAILABLE",
            claimPublished: false,
            modelDispatched: false,
          },
        });
        scheduleRunCronTeardown(step.run_id);
        return { found: false };
      }

      const requestedBaseRef = v3SupervisorRetryPreparationSource
        ? `refs/remotes/origin/${v3SupervisorRetryPreparationSource.storyBranch}`
        : isPrEach ? "main" : (context["implement_base_commit"] || context["branch"] || "master");
      const publication = await publishLoopClaimAndRuntime(
        step,
        nextStory,
        agentId,
        callerGatewayAgent,
        parallelLimit,
        runtimeIntent,
        undefined,
        v3PreparationAuthority,
        storyAdmissionProof,
        v3SupervisorRetryPreparationSource,
      );
      if (!publication) {
        logger.info(`[claim] Story publication lost a concurrency or termination race`, { runId: step.run_id, stepId: step.step_id });
        return { found: false };
      }
      const legacyClaimId = publication.claimId;
      const claimRuntime = publication.runtime;
      if (
        runProtocol?.protocol === "v3"
        && (
          publication.claimAuthority?.mode !== "preparation"
          || publication.claimAuthority.authority.authorityHash !== v3PreparationAuthority!.authorityHash
          || publication.baseRevision?.sha !== v3PreparedBaseRevision!.sha
          || publication.baseRevision.treeHash !== v3PreparedBaseRevision!.treeHash
          || publication.storySubject?.kind !== "story_member"
          || publication.storySubject.storyDbId !== nextStory.id
          || publication.storySubject.storyId !== nextStory.story_id
        )
      ) {
        const authorityReason = "V3_PREPARATION_PUBLICATION_RESULT_MISMATCH";
        await handleV3PreDispatchFailure({
          step,
          story: nextStory,
          agentId,
          claimId: legacyClaimId,
          runtime: claimRuntime,
          authority: v3PreparationAuthority!,
          phase: "reservation",
          error: Object.assign(new Error(authorityReason), { code: authorityReason }),
          preserveStoryOutput: Boolean(v3SupervisorRetryPreparationSource),
        });
        logger.error(authorityReason, { runId: step.run_id, stepId: step.step_id });
        return { found: false };
      }
      const baseRef = runProtocol?.protocol === "v3"
        ? publication.baseRevision!.sha
        : requestedBaseRef;
      nextStory.claim_generation = publication.claimGeneration;
      nextStory.status = "running";
      nextStory.claimed_by = agentId;
      await recordStepTransition(step.id, step.run_id, step.step_status, "running", agentId, "claimLoopStep", { storyId: nextStory.story_id });

      // Provision after durable ownership publication. A crash here leaves a
      // recoverable reserved runtime, never an ownerless running story.
      //
      // direct-merge pins all sibling stories to one feature-branch commit.
      // pr-each is different: each story starts from the latest main after the
      // previous story PR was merged and local main was synced.
      if (runProtocol?.protocol !== "v3" && isPrEach && context["repo"]) {
        syncBaseBranch(context["repo"], "main");
      }
      let storyWorkdir = createStoryWorktree(context["repo"], storyBranch, baseRef, agentId);
      let worktreeFailureDetail = "";
      if (storyWorkdir && runProtocol?.protocol === "v3") {
        try {
          const observed = resolveV3GitRevision({
            repo: storyWorkdir,
            requestedRef: "HEAD",
            expectedSha: baseRef,
          });
          if (
            observed.treeHash !== publication.baseRevision!.treeHash
            || observed.treeHash !== v3PreparedBaseRevision!.treeHash
          ) {
            throw new Error("V3_PREPARATION_WORKTREE_TREE_MISMATCH");
          }
        } catch (error) {
          worktreeFailureDetail = String((error as Error)?.message || error).slice(0, 1_000);
          removeStoryWorktree(context["repo"], storyBranch, agentId);
          storyWorkdir = "";
        }
      }
      if (!storyWorkdir) {
        const wtReason = `Worktree creation failed for story ${nextStory.story_id} — cannot isolate exact prepared source${worktreeFailureDetail ? `: ${worktreeFailureDetail}` : ""}`;
        logger.error(wtReason, { runId: step.run_id, stepId: step.step_id });
        await handleV3PreDispatchFailure({
          step,
          story: nextStory,
          agentId,
          claimId: legacyClaimId,
          runtime: claimRuntime,
          authority: v3PreparationAuthority!,
          phase: "source",
          error: Object.assign(new Error(wtReason), {
            code: "V3_PREPARATION_WORKTREE_UNAVAILABLE",
          }),
          preserveStoryOutput: Boolean(v3SupervisorRetryPreparationSource),
          repo: context["repo"],
          storyBranch,
        });
        return { found: false };
      }

      context["story_workdir"] = storyWorkdir;
      context["story_base_ref"] = baseRef;

      // Verify node_modules symlink is intact after worktree creation
      if (storyWorkdir) {
        const nmLink = path.join(storyWorkdir, "node_modules");
        const nmSource = path.join(context["repo"] || "", "node_modules");
        try {
          const stat = fs.lstatSync(nmLink);
          if (!stat.isSymbolicLink()) {
            // node_modules exists but is NOT a symlink — delete and recreate
            fs.rmSync(nmLink, { recursive: true, force: true });
            fs.symlinkSync(nmSource, nmLink);
            logger.info(`[worktree] Repaired node_modules symlink in ${storyWorkdir}`, { runId: step.run_id });
          }
        } catch {
          // Doesn't exist — create symlink
          if (fs.existsSync(nmSource)) {
            try { fs.symlinkSync(nmSource, nmLink); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
          }
        }
      }

      // ISSUE-1 FIX: Read ACTUAL git branch from worktree and inject into context
      // This ensures the agent uses the correct branch name instead of creating its own
      const actualWorktreeDir = storyWorkdir || context["repo"];
      try {
        const actualBranch = execFileSync("git", ["branch", "--show-current"], {
          cwd: actualWorktreeDir, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (actualBranch) {
          // Wave 4 fix #11: force lowercase here too — git itself is case-sensitive
          // on Linux, so a `US-005` branch and a `us-005` branch are genuinely distinct
          // references and the merge queue ends up trying to merge only one of them.
          const actualBranchLc = actualBranch.toLowerCase();
          context["story_branch"] = actualBranchLc;
          // Also persist to stories table so verify step can reference it
          await pgRun("UPDATE stories SET story_branch = $1 WHERE id = $2", [actualBranchLc, nextStory.id]);
          logger.info(`[story-branch] Set story_branch=${actualBranchLc} from worktree (story=${nextStory.story_id})`, { runId: step.run_id });
        }
      } catch (branchErr) {
        // Fallback: use the computed branch name (already lowercased on line 1126)
        context["story_branch"] = storyBranch;
        logger.warn(`[story-branch] Could not read branch from worktree, using computed: ${storyBranch}`, { runId: step.run_id });
      }

      // v2026.4.12: Merge dependency branches into worktree for integration stories.
      // Stories with depends_on start from implement_base_commit (empty project).
      // Without this, the agent sees no code from prior stories and reimplements
      // everything, causing scope-bleed on 10+ files (run #408 US-004 failure mode).
      if (nextStory.depends_on && storyWorkdir) {
        try {
          const deps: string[] = JSON.parse(nextStory.depends_on);
          if (deps.length > 0) {
            // Query each dep individually — ANY($2) with JS arrays unreliable in porsager/postgres
            const depBranches: { story_branch: string; story_id: string }[] = [];
            for (const depId of deps) {
              const row = await pgGet<{ story_branch: string; story_id: string }>(
                "SELECT story_branch, story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status IN ('done','verified') AND story_branch IS NOT NULL",
                [step.run_id, depId]
              );
              if (row) depBranches.push(row);
            }
            const storyScopeFiles = new Set<string>();
            try {
              const parsedScopeFiles = JSON.parse(nextStory.scope_files || "[]");
              if (Array.isArray(parsedScopeFiles)) {
                for (const f of parsedScopeFiles) {
                  if (typeof f === "string" && f.trim()) storyScopeFiles.add(f.trim());
                }
              }
            } catch (e) { logger.debug(`[dep-merge] Failed parsing scope_files: ${String(e).slice(0, 80)}`); }
            // Use git checkout (not merge) to copy files WITHOUT merge commits.
            // Merge commits cause merge-queue conflicts because the same changes
            // appear on multiple branches. checkout just updates the working tree.
            let mergedCount = 0;
            for (const dep of depBranches) {
              try {
                // Get list of files changed in the dep branch vs base
                const diffOutput = execFileSync("git", ["diff", "--name-only", baseRef, dep.story_branch], {
                  cwd: storyWorkdir, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                }).trim();
                if (!diffOutput) continue;
                const depFiles = diffOutput.split("\n").filter(f => f.length > 0);
                // Checkout each file from the dep branch into working tree
                for (const f of depFiles) {
                  try {
                    execFileSync("git", ["checkout", dep.story_branch, "--", f], {
                      cwd: storyWorkdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
                    });
                  } catch (e) { logger.debug(`[worktree] File not in worktree: ${String(e).slice(0, 80)}`); }
                }
                // Unstage all — files exist in working tree but NOT committed
                execFileSync("git", ["reset", "HEAD"], {
                  cwd: storyWorkdir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
                });
                // Mark dependency files as assume-unchanged so git ignores them
                // for commit/diff. Keep current-story scope files trackable:
                // integration stories often need to edit a file originally
                // introduced by a dependency, and hiding those edits makes PRs
                // miss required source changes.
                let ignoredDepFileCount = 0;
                let editableDepFileCount = 0;
                for (const f of depFiles) {
                  if (storyScopeFiles.has(f)) {
                    try {
                      execFileSync("git", ["update-index", "--no-assume-unchanged", "--no-skip-worktree", f], {
                        cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                      });
                    } catch {
                      try {
                        execFileSync("git", ["update-index", "--no-assume-unchanged", f], {
                          cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                        });
                      } catch (e) { logger.debug(`[worktree] Could not clear index flags: ${String(e).slice(0, 80)}`); }
                    }
                    editableDepFileCount++;
                    continue;
                  }
                  try {
                    execFileSync("git", ["update-index", "--assume-unchanged", f], {
                      cwd: storyWorkdir, timeout: 3000, stdio: ["pipe", "pipe", "pipe"],
                    });
                    ignoredDepFileCount++;
                  } catch (e) { logger.debug(`[worktree] File not found: ${String(e).slice(0, 80)}`); }
                }
                mergedCount++;
                logger.info(`[dep-merge] Copied ${depFiles.length} files from ${dep.story_id} (${dep.story_branch}) into ${nextStory.story_id} worktree (${ignoredDepFileCount} assume-unchanged, ${editableDepFileCount} editable scope files)`, { runId: step.run_id });
              } catch (mergeErr) {
                logger.warn(`[dep-merge] Failed copying ${dep.story_id} into ${nextStory.story_id}: ${String(mergeErr).slice(0, 150)}`, { runId: step.run_id });
              }
            }
            if (mergedCount > 0) {
              logger.info(`[dep-merge] Merged ${mergedCount}/${depBranches.length} dependency branches into ${nextStory.story_id}`, { runId: step.run_id });
            }
            // Expand shared_files with ALL other stories' scope_files (transitive).
            // Direct deps are insufficient: US-004 depends on US-002/003 but also
            // needs US-001's files (index.css, tokens). Instead of computing
            // transitive closure, just include all stories' scope_files.
            const depScopeFiles: string[] = [];
            const allStoryScopes = await pgQuery<{ scope_files: string | null; story_id: string }>(
              "SELECT scope_files, story_id FROM stories WHERE run_id = $1 AND story_id != $2",
              [step.run_id, nextStory.story_id]
            );
            for (const row of allStoryScopes) {
              if (row?.scope_files) {
                try {
                  const files: string[] = JSON.parse(row.scope_files);
                  if (Array.isArray(files)) {
                    for (const f of files) {
                      if (typeof f !== "string") continue;
                      if (!fs.existsSync(path.join(storyWorkdir, f))) continue;
                      depScopeFiles.push(f);
                    }
                  }
                } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
              }
            }
            if (depScopeFiles.length > 0) {
              const currentShared: string[] = JSON.parse(nextStory.shared_files || "[]").filter((f: any) => typeof f === "string");
              const expandedShared = [...new Set([...currentShared, ...depScopeFiles])];
              await pgRun(
                "UPDATE stories SET shared_files = $1, updated_at = $2 WHERE id = $3",
                [JSON.stringify(expandedShared), now(), nextStory.id]
              );
              nextStory.shared_files = JSON.stringify(expandedShared);
              logger.info(`[dep-merge] Expanded ${nextStory.story_id} shared_files with ${depScopeFiles.length} dependency scope files`, { runId: step.run_id });
            }
          }
        } catch (e) {
          logger.warn(`[dep-merge] Failed to process depends_on for ${nextStory.story_id}: ${String(e).slice(0, 200)}`, { runId: step.run_id });
        }
      }

      const wfId = await getWorkflowId(step.run_id);
      emitEvent({ ts: now(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
      emitEvent({ ts: now(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
      logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

      // Wave 14 Bug L: inject claim_generation into context so completeStep can
      // verify the agent that reports done is the SAME agent that claimed the story.
      // Stale agents (from a previous abandoned claim) report done with an old gen.
      context["claim_generation"] = String(nextStory.claim_generation ?? 0);

      // Inject story context (template vars, screen_map, optional vars, previous_failure)
      await injectStoryContext(nextStory, step, context);

      // Inject test generation prompt so agent writes tests alongside implementation
      if (step.step_id === "implement") {
        try {
          const { buildTestGenerationPrompt } = await import("./test-generation.js");
          const techStack = context["tech_stack"] || "react";
          const acceptanceCriteria = nextStory.title || "";
          context["test_generation_prompt"] = buildTestGenerationPrompt(nextStory.title, acceptanceCriteria, techStack);
        } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      }

      let nativeV3Attempt: ClaimAttemptFenceV1 | undefined;
      let nativeV3ImplementationHandoff: V3ImplementationClaimHandoffV1 | undefined;
      if (runProtocol?.protocol === "v3") {
        let pendingOperationalRetry: ReturnType<typeof parseOperationalRetryDirectiveStoryOutput>;
        try {
          pendingOperationalRetry = parseOperationalRetryDirectiveStoryOutput(nextStory.output);
          const pendingSupervisorRetry = parseV3SupervisorRetryDirectiveStoryOutputV1(nextStory.output);
          if (pendingSupervisorRetry && (
            pendingSupervisorRetry.storyDbId !== nextStory.id
            || pendingSupervisorRetry.storyId !== nextStory.story_id
            || pendingSupervisorRetry.storyClaimGeneration + 1 !== publication.claimGeneration
            || pendingSupervisorRetry.retryOrdinal !== nextStory.retry_count
            || pendingSupervisorRetry.maxRetries !== nextStory.max_retries
            || pendingSupervisorRetry.sourceRevision.sha !== publication.baseRevision?.sha
            || pendingSupervisorRetry.sourceRevision.treeHash !== publication.baseRevision?.treeHash
          )) {
            throw new Error("V3_SUPERVISOR_RETRY_PUBLICATION_IDENTITY_MISMATCH");
          }
          const compiled = await reserveV3ImplementationAttempt({
            runId: step.run_id,
            stepId: step.step_id,
            storyId: nextStory.story_id,
            claimId: legacyClaimId,
            role: agentId,
            agentId,
            branch: String(context["story_branch"] || storyBranch),
            worktree: storyWorkdir,
            ...(pendingOperationalRetry ? { operationalRetry: pendingOperationalRetry } : {}),
            ...(pendingSupervisorRetry ? { supervisorRetry: pendingSupervisorRetry } : {}),
          });
          applyV3ImplementationSliceContext(context, compiled);
          nativeV3Attempt = {
            attemptId: compiled.attempt.attemptId,
            generation: compiled.attempt.generation,
            fenceToken: compiled.attempt.fenceToken,
          };
          nativeV3ImplementationHandoff = createV3ImplementationAttemptHandoffV1({
            stepDbId: step.id,
            storyDbId: nextStory.id,
            claimId: legacyClaimId,
            branch: String(context["story_branch"] || storyBranch),
            workdir: storyWorkdir,
            compiled,
          });
        } catch (error) {
          const operationalRetryRefused = Boolean(pendingOperationalRetry)
            || String(nextStory.output || "").includes("setfarm.operational-retry-directive.v1")
            || String(nextStory.output || "").includes("setfarm.v3-supervisor-retry-directive.v1");
          await handleV3PreDispatchFailure({
            step,
            story: nextStory,
            agentId,
            claimId: legacyClaimId,
            runtime: claimRuntime,
            authority: v3PreparationAuthority!,
            phase: "reservation",
            error,
            operationalRetryRefused,
            preserveStoryOutput: Boolean(v3SupervisorRetryPreparationSource),
            repo: context["repo"],
            storyBranch,
          });
          return { found: false };
        }
      }

      // Wave 14 Bug K: per-step context allowlist for loop (story-each) claims.
      // Loop steps inject heavy design context (stitch_html, design_dom, etc.)
      // which only implement needs. Downstream loop steps (verify-each if used,
      // or single-step verify after the loop) should not see that bloat.
      const prunedContextLoop = pruneContextForStep(context, step.step_id);
      const loopBytesBefore = JSON.stringify(context).length;
      const loopBytesAfter = JSON.stringify(prunedContextLoop).length;
      if (loopBytesBefore > loopBytesAfter + 1000) {
        logger.info(`[context-prune] ${step.step_id} (loop story=${nextStory.story_id}): ${loopBytesBefore}→${loopBytesAfter} bytes (${Math.round((1 - loopBytesAfter / loopBytesBefore) * 100)}% trimmed)`, { runId: step.run_id });
      }
      const resolvedInput = await resolveLoopClaimInput(step, prunedContextLoop, context);

      // Item 7: MISSING_INPUT_GUARD inside claim flow (v1.5.53: retry once before failing run)
      const allMissing = [...new Set([...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase()))];
      if (allMissing.length > 0) {
        const reason = `Blocked: unresolved variable(s) [${allMissing.join(", ")}] in input`;
        if (runProtocol?.protocol === "v3") {
          await handleV3PreDispatchFailure({
            step,
            story: nextStory,
            agentId,
            claimId: legacyClaimId,
            runtime: claimRuntime,
            authority: v3PreparationAuthority!,
            phase: "source",
            error: Object.assign(new Error(reason), {
              code: "V3_IMPLEMENTATION_INPUT_UNRESOLVED",
            }),
            repo: context["repo"],
            storyBranch,
          });
          return { found: false };
        }
        const storyRetry = await pgGet<{ retry_count: number }>("SELECT retry_count FROM stories WHERE id = $1", [nextStory.id]);
        const retryCount = storyRetry?.retry_count ?? 0;
        logger.warn(`${reason} (story=${nextStory.story_id}, retry=${retryCount})`, { runId: step.run_id, stepId: step.step_id });
        await closeUnstartedStoryClaimExact({
          claimId: legacyClaimId,
          runId: step.run_id,
          workflowStepId: step.step_id,
          storyId: nextStory.story_id,
          claimAgentId: agentId,
        }, reason, "failed", claimRuntime);
        // Reset the claimed story
        if (retryCount > 0) {
          // Second occurrence — fail everything (Wave 13 J-2: terminal flag)
          await pgRun("UPDATE stories SET status = 'failed', updated_at = $1 WHERE id = $2", [now(), nextStory.id]);
          await pgRun("UPDATE steps SET status = 'failed', output = $1, current_story_id = NULL, updated_at = $2 WHERE id = $3", [reason + " — failing run (retry exhausted)", now(), step.id]);
          await failRun(step.run_id, true);
          const wfId2 = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId2, stepId: step.step_id, detail: reason });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId2, detail: reason });
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          scheduleRunCronTeardown(step.run_id);
        } else {
          // First occurrence — retry story (possible WAL lag)
          await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = retry_count + 1, output = $1, updated_at = $2 WHERE id = $3", [reason + " — retrying once", now(), nextStory.id]);
          await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
          if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
          logger.info(`[missing-input] Story ${nextStory.story_id} will retry — possible WAL lag`, { runId: step.run_id });
        }
        return { found: false };
      }


      // GUARD: Empty critical variables — catches "" values that missing-input guard misses
      const CRITICAL_STORY_VARS = ["repo", "story_workdir", "branch"];
      const emptyVars = CRITICAL_STORY_VARS.filter(v => v in context && context[v] !== undefined && context[v].trim() === "");
      if (emptyVars.length > 0) {
        const emptyReason = `EMPTY_CRITICAL_VARS: [${emptyVars.join(", ")}] are empty — cannot implement story`;
        logger.warn(`[claim] ${emptyReason} (story=${nextStory.story_id})`, { runId: step.run_id });
        if (runProtocol?.protocol === "v3") {
          await handleV3PreDispatchFailure({
            step,
            story: nextStory,
            agentId,
            claimId: legacyClaimId,
            runtime: claimRuntime,
            authority: v3PreparationAuthority!,
            phase: "source",
            error: Object.assign(new Error(emptyReason), {
              code: "V3_IMPLEMENTATION_CRITICAL_CONTEXT_EMPTY",
            }),
            repo: context["repo"],
            storyBranch,
          });
          return { found: false };
        }
        await closeUnstartedStoryClaimExact({
          claimId: legacyClaimId,
          runId: step.run_id,
          workflowStepId: step.step_id,
          storyId: nextStory.story_id,
          claimAgentId: agentId,
        }, emptyReason, "failed", claimRuntime);
        await pgRun("UPDATE stories SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
          [emptyReason, now(), nextStory.id]);
        await pgRun("UPDATE steps SET current_story_id = NULL, updated_at = $1 WHERE id = $2", [now(), step.id]);
        if (context["repo"]) removeStoryWorktree(context["repo"], storyBranch, agentId);
        return { found: false };
      }

      let shadowAttempt: ClaimAttemptFenceV1 | undefined = nativeV3Attempt;
      if (runProtocol?.protocol === "shadow") {
        const shadowClaim = await observeShadowAttemptClaim({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: nextStory.story_id,
          legacyClaimId,
          legacyClaimGeneration: Number(nextStory.claim_generation ?? 0),
          attemptClass: step.step_id === "implement"
            ? "product_implementation"
            : "evidence_only",
          role: agentId,
          agentId,
          branch: String(context["story_branch"] || storyBranch),
          worktree: storyWorkdir,
        });
        if (
          shadowClaim.status === "observed"
          && shadowClaim.code === "ATTEMPT_RESERVED"
          && shadowClaim.attempt?.evidenceRefs.includes(`setfarm://claim-log/${legacyClaimId}`)
        ) {
          shadowAttempt = {
            attemptId: shadowClaim.attempt.attemptId,
            generation: shadowClaim.attempt.generation,
            fenceToken: shadowClaim.attempt.fenceToken,
          };
        }
      }

      if (runProtocol?.protocol && runProtocol.protocol !== "legacy") {
        if (!shadowAttempt) {
          const fence = await ensureCompilerClaimFence(getSql(), {
            claimId: legacyClaimId,
            runId: step.run_id,
            stepId: step.step_id,
            storyId: nextStory.story_id,
            storyDbId: nextStory.id,
            claimAgentId: agentId,
            diagnostic: "COMPILER_ATTEMPT_RESERVATION_REQUIRED: claim withdrawn before runtime spawn",
          });
          if (fence.status === "fenced") {
            shadowAttempt = fence.attempt;
          } else {
            if (fence.status === "reverted" && context["repo"]) {
              removeStoryWorktree(context["repo"], storyBranch, agentId);
            }
            logger.warn(`[claim] compiler claim not handed off: ${fence.status === "blocked" ? fence.reason : fence.status}`, { runId: step.run_id, stepId: step.step_id });
            return { found: false };
          }
        }
      }

      if (shadowAttempt && claimRuntime) {
        await pgBegin((sql) => bindRuntimeSessionAttemptInTransaction(sql, {
          sessionId: claimRuntime.sessionId,
          attemptId: shadowAttempt!.attemptId,
          ownerInstanceId: claimRuntime.ownerInstanceId,
        }));
      }

      return {
        found: true,
        stepId: step.id,
        workflowStepId: step.step_id,
        runId: step.run_id,
        protocol: (runProtocol?.protocol || "legacy") as "legacy" | "shadow" | "v3",
        storyId: nextStory.story_id,
        storyDbId: nextStory.id,
        claimGeneration: Number(nextStory.claim_generation ?? 0),
        ...(shadowAttempt ? { attempt: shadowAttempt } : {}),
        claimId: legacyClaimId,
        claimAgentId: agentId,
        ...(claimRuntime ? {
          runtimeSessionId: claimRuntime.sessionId,
          runtimeOwnerInstanceId: claimRuntime.ownerInstanceId,
        } : {}),
        ...(nativeV3ImplementationHandoff ? { v3ImplementationHandoff: nativeV3ImplementationHandoff } : {}),
        resolvedInput,
      };
    }
  }

  // Single (non-loop) step claim path
  return await claimSingleStep(
    step,
    agentId,
    context,
    null,
    runtimeIntent,
    storyAdmissionProof,
  );
}

// ── Complete ────────────────────────────────────────────────────────

/**
 * Complete a step: save output, merge context, advance pipeline.
 */
export async function completeStep(
  stepId: string,
  output: string,
  claimEnvelope?: ClaimEnvelopeV1,
  options: Readonly<{ deferContinuationToEffectLedger?: boolean }> = {},
): Promise<{ advanced: boolean; runCompleted: boolean }> {
  sanitizePlatformProcessPath();

  type StepRow = { id: string; run_id: string; step_id: string; step_index: number; type: string; loop_config: string | null; current_story_id: string | null; agent_id: string; retry_count: number; max_retries: number };
  let step = await pgGet<StepRow>("SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id, agent_id, retry_count, max_retries FROM steps WHERE id = $1", [stepId]);

  if (!step) {
    // Compatibility fallback: older prompts sometimes passed runId instead of
    // stepId. Only resolve it when exactly one active step exists; choosing the
    // first active step can complete/fail the wrong phase when implement and
    // verify overlap in verifyEach mode.
    const fallbackSteps = await pgQuery<StepRow>(
      `SELECT id, run_id, step_id, step_index, type, loop_config, current_story_id, agent_id, retry_count, max_retries
       FROM steps
       WHERE run_id = $1 AND status IN ('running', 'pending')
       ORDER BY step_index ASC
       LIMIT 2`,
      [stepId],
    );
    if (fallbackSteps.length === 1) {
      step = fallbackSteps[0];
      logger.warn(`[completeStep] Agent passed runId "${stepId}" instead of stepId — resolved to only active step "${step.id}" (${step.step_id})`, { runId: step.run_id });
    } else if (fallbackSteps.length > 1) {
      const active = fallbackSteps.map((s) => `${s.step_id}:${s.id}`).join(", ");
      throw new Error(`Ambiguous step id: "${stepId}" is a runId with multiple active steps (${active}). Agent must pass the exact stepId from claim JSON.`);
    } else {
      throw new Error(`Step not found: ${stepId}`);
    }
  }

  const completionAuthority = claimEnvelope
    ? await assertClaimAuthority(getSql(), claimEnvelope, step.id)
    : undefined;
  let v3SuperviseBoundSubject: V3StoryClaimRuntimeSubjectV1 | undefined;
  let v3SuperviseRuntimeSessionId: string | undefined;
  if (completionAuthority?.protocol === "v3" && step.step_id === "supervise") {
    const superviseStep = step;
    v3SuperviseBoundSubject = await getSql().begin(async (transaction) => {
      const requests = await transaction.unsafe<Array<{ runtime_session_id: string }>>(
        `SELECT runtime_session_id
           FROM runtime_completion_requests
          WHERE claim_id = $1 AND run_id = $2 AND step_db_id = $3
          LIMIT 2`,
        [completionAuthority.envelope.claimId, superviseStep.run_id, superviseStep.id],
      );
      if (requests.length !== 1) throw new Error("V3_SUPERVISE_COMPLETION_REQUEST_IDENTITY_INVALID");
      v3SuperviseRuntimeSessionId = requests[0]!.runtime_session_id;
      return loadAndRevalidateV3StoryClaimRuntimeBindingV1(transaction, {
        claimId: completionAuthority.envelope.claimId,
        runtimeSessionId: requests[0]!.runtime_session_id,
        runId: superviseStep.run_id,
        stepDbId: superviseStep.id,
        workflowStepId: "supervise",
      });
    }) as V3StoryClaimRuntimeSubjectV1;
  }
  const runProtocol = await pgGet<{ protocol: string }>("SELECT protocol FROM runs WHERE id = $1", [step.run_id]);
  if (runProtocol?.protocol !== "legacy" && !completionAuthority) {
    throw new Error("CLAIM_ENVELOPE_REQUIRED");
  }
  if (completionAuthority?.storyDbId) {
    step.current_story_id = completionAuthority.storyDbId;
  }

  // Guard: don't process late completions for terminal runs. Agents can keep
  // running after a user cancellation until their OpenClaw session is reaped;
  // accepting their output would mutate context/stories after the run is dead.
  const runStatus = await getRunStatus(step.run_id);
  if (runStatus === RUN_STATUS.FAILED || runStatus === RUN_STATUS.CANCELLED) {
    logger.warn(`[completeStep] Ignoring late completion for terminal run (${runStatus})`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  const isNativeV3ImplementCompletion = completionAuthority?.protocol === "v3"
    && step.step_id === "implement"
    && step.type === "loop"
    && Boolean(completionAuthority.storyId && completionAuthority.storyDbId);
  const isNativeV3PlanCompletion = completionAuthority?.protocol === "v3"
    && step.step_id === "plan"
    && step.type === "single";
  const atomicNativeV3PlanCompletion = isNativeV3PlanCompletion
    && options.deferContinuationToEffectLedger === true;
  const isNativeV3StoriesCompletion = completionAuthority?.protocol === "v3"
    && step.step_id === "stories"
    && step.type === "single";
  const atomicNativeV3StoriesCompletion = isNativeV3StoriesCompletion
    && options.deferContinuationToEffectLedger === true;
  if (isNativeV3StoriesCompletion && !atomicNativeV3StoriesCompletion) {
    throw new Error("V3_STORIES_RUNTIME_COMPLETION_OWNER_REQUIRED");
  }
  let nativeV3AgentOutput: V3ImplementationAgentOutputV1 | undefined;
  let nativeV3AgentContext: V3ImplementationContextV1 | undefined;
  let nativeV3AttemptContext: V3ImplementationAttemptResult | undefined;
  let nativeV3PlanAuthority: V3PlanOutputAuthorityV1 | V3PlanOutputAuthorityV2 | undefined;
  let preparedV3StoriesCompletion: PreparedV3StoriesCompletionV1 | undefined;

  if (
    completionAuthority?.protocol === "v3"
    && step.type === "single"
    && step.retry_count > 0
  ) {
    const priorFailure = await pgGet<{ output_hash: string; diagnostic: string | null }>(
      `SELECT completion.output_hash, cl.diagnostic
         FROM claim_log cl
         JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
        WHERE cl.run_id = $1
          AND cl.step_id = $2
          AND cl.story_id IS NULL
          AND cl.id <> $3
          AND cl.outcome = 'failed'
          AND completion.state = 'accepted'
          AND completion.apply_phase = 'effects_committed'
        ORDER BY cl.claimed_at DESC, cl.id DESC
        LIMIT 1`,
      [step.run_id, step.step_id, completionAuthority.envelope.claimId],
    );
    const currentOutputHash = crypto.createHash("sha256")
      .update(Buffer.from(output, "utf8"))
      .digest("hex");
    if (priorFailure?.diagnostic && priorFailure.output_hash === currentOutputHash) {
      await recordObservation({
        runId: step.run_id,
        stepId: step.step_id,
        phase: "recovery",
        checkId: `v3.stage-retry.output-unchanged:${currentOutputHash}`,
        label: "V3 stage retry expected delta",
        status: "fail",
        summary: "Retry returned the exact previous output bytes; preserving the prior typed failure tuple so redispatch dedupe can block another model.",
        evidence: {
          schema: "setfarm.v3-stage-retry-output-unchanged.v1",
          outputHash: currentOutputHash,
          previousFailurePreserved: true,
        },
      });
      await failStep(step.id, priorFailure.diagnostic, completionAuthority.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  // Native v3 forks before legacy KEY:value merging and every prose classifier.
  // The only accepted agent influence is the strict, handoff-bound JSON
  // protocol. Platform worktree/process policy and canonical evidence still run
  // below; summary prose is inert data and cannot mutate operational context.
  if (isNativeV3ImplementCompletion) {
    const envelope = completionAuthority.envelope;
    const attemptId = envelope.attempt?.attemptId;
    if (!attemptId || !envelope.storyId || !envelope.storyDbId) {
      throw new Error("V3_IMPLEMENTATION_COMPLETION_IDENTITY_REQUIRED");
    }
    const compiled = await loadV3ImplementationAttemptContext({
      runId: envelope.runId,
      storyId: envelope.storyId,
      attemptId,
    });
    nativeV3AttemptContext = compiled;
    if (!compiled.attempt.branch || !compiled.attempt.worktree) {
      throw new Error("V3_IMPLEMENTATION_ATTEMPT_WORKSPACE_IDENTITY_REQUIRED");
    }
    const handoff = createV3ImplementationAttemptHandoffV1({
      stepDbId: step.id,
      storyDbId: envelope.storyDbId,
      claimId: envelope.claimId,
      branch: compiled.attempt.branch,
      workdir: compiled.attempt.worktree,
      compiled,
    });
    nativeV3AgentContext = createV3ImplementationContextV1({ handoff });
    nativeV3AgentOutput = parseV3ImplementationAgentOutputV1(output, nativeV3AgentContext);
    if (nativeV3AgentOutput.disposition === "refused") {
      await handleV3ImplementationRefusal({
        envelope,
        context: nativeV3AgentContext,
        output: nativeV3AgentOutput,
        rawOutput: output,
      });
      return { advanced: false, runCompleted: false };
    }
  }

  // Merge KEY: value lines into run context (legacy/shadow only).
  const candidateContextSnapshot = await pgGet<{ context: string }>(
    "SELECT context FROM runs WHERE id = $1",
    [step.run_id],
  );
  const context: Record<string, string> = candidateContextSnapshot?.context
    ? JSON.parse(candidateContextSnapshot.context)
    : {};

  // Parse KEY: value lines and merge into context
  // #197: Protect seed context keys from being overwritten by step output
  const parsed: Record<string, string> = isNativeV3ImplementCompletion
    ? {
        status: "done",
        changes: nativeV3AgentOutput?.disposition === "ready_for_evidence"
          ? nativeV3AgentOutput.summary
          : "",
      }
    : parseOutputKeyValues(output);
  if (isNativeV3PlanCompletion) {
    try {
      const planInput = {
        task: context["task"] || "",
        parsed,
        ...(context["plan_output_authority_version"] !== "product_build_v1"
          ? { allowSemanticOnlyCompatibility: true }
          : {}),
        ...(context["requested_stack_prefix"] && context["stack_pack_id"]
          ? { requestedStackPackId: context["stack_pack_id"] }
          : {}),
      };
      const semanticsV2 = context["product_semantics_version"] === "v2";
      nativeV3PlanAuthority = semanticsV2
        ? resolveV3PlanOutputAuthorityV2(planInput)
        : resolveV3PlanOutputAuthorityV1(planInput);
      if (nativeV3PlanAuthority.status === "proposal") {
        const canonicalPrd = semanticsV2
          ? projectCanonicalV3PlanParsedOutputV2({
              parsed,
              authority: nativeV3PlanAuthority as Extract<V3PlanOutputAuthorityV2, { status: "proposal" }>,
            }).prd
          : projectCanonicalV3PlanParsedOutputV1({
              parsed,
              authority: nativeV3PlanAuthority as Extract<V3PlanOutputAuthorityV1, { status: "proposal" }>,
            }).prd;
        // The typed proposal is the only model-owned PLAN payload. Legacy
        // KEY:value siblings are neither specification nor operational
        // authority, so do not let them enter run context even transiently.
        for (const key of Object.keys(parsed)) {
          if (key !== "status" && key !== "prd") delete parsed[key];
        }
        parsed.prd = canonicalPrd;
      }
    } catch (error) {
      // A malformed or semantically invalid typed PLAN proposal is an agent
      // output rejection, not a runtime-manager failure.  Keep it inside the
      // exact claim lifecycle so failStep can close the claim, publish the
      // bounded retry plan, and let the drained completion settle normally.
      // Throwing here would make the completion coordinator quarantine a
      // healthy, already-drained runtime and strand the run without a retry.
      const failure = createV3StageFailureV1({
        workflowStepId: "plan",
        kind: "output_contract_invalid",
        diagnostics: error instanceof V3PlanOutputRejectedError || error instanceof V3PlanOutputV2RejectedError
          ? error.diagnostics
          : [{
              code: "V3_PLAN_OUTPUT_REJECTED",
              path: "",
              message: String(error instanceof Error ? error.message : error).slice(0, 4_000),
            }],
      });
      const diagnostic = serializeV3StageFailureDiagnostic(
        error instanceof V3PlanOutputRejectedError || error instanceof V3PlanOutputV2RejectedError
          ? `V3_PLAN_OUTPUT_REJECTED: ${error.message}`
          : "V3_PLAN_OUTPUT_REJECTED",
        failure,
      );
      await failStep(step.id, diagnostic, completionAuthority!.envelope);
      return { advanced: false, runCompleted: false };
    }
    if (nativeV3PlanAuthority.status === "rejection") {
      await completeV3PlanProductSpecRefusal({
        envelope: completionAuthority!.envelope,
        task: context["task"] || "",
        rejection: nativeV3PlanAuthority.rejection,
      });
      return { advanced: false, runCompleted: false };
    }
    const delivery = nativeV3PlanAuthority.deliverySelection;
    context["plan_source_transport"] = nativeV3PlanAuthority.sourceTransport;
    context["plan_source_proposal_hash"] = nativeV3PlanAuthority.sourceProposalHash;
    if (nativeV3PlanAuthority.sourceTransport === "product_build_proposal_v1") {
      context["plan_semantic_proposal_hash"] = nativeV3PlanAuthority.sourceSemanticProposalHash;
      context["plan_product_build_authority"] =
        nativeV3PlanAuthority.planProductBuildAuthorityCanonicalBytes;
      context["plan_product_build_authority_hash"] =
        nativeV3PlanAuthority.planProductBuildAuthority.authorityHash;
      context["product_runtime_behavior_proposal"] =
        nativeV3PlanAuthority.runtimeBehaviorProposalCanonicalBytes;
      context["product_runtime_behavior_proposal_hash"] =
        nativeV3PlanAuthority.runtimeBehaviorProposalHash;
      context["product_runtime_behavior_contract"] =
        nativeV3PlanAuthority.runtimeBehaviorCanonicalBytes;
      context["product_runtime_behavior_contract_hash"] =
        nativeV3PlanAuthority.runtimeBehaviorContract.contractHash;
    }
    context["product_semantics_version"] = nativeV3PlanAuthority.productSpec.schema === "setfarm.product-spec.v2"
      ? "v2"
      : "v1";
    context["product_spec_schema"] = nativeV3PlanAuthority.productSpec.schema;
    context["product_persistence_projection"] = canonicalJsonStringify(nativeV3PlanAuthority.persistenceProjectionEvidence);
    context["product_persistence_projection_hash"] = hashCanonicalJson(nativeV3PlanAuthority.persistenceProjectionEvidence);
    context["product_delivery_selection"] = nativeV3PlanAuthority.deliverySelectionCanonicalBytes;
    context["product_delivery_selection_hash"] = nativeV3PlanAuthority.deliverySelectionHash;
    context["product_delivery_profile_id"] = delivery.profileId;
    context["product_delivery_catalog_version"] = delivery.catalogVersion;
    context["product_delivery_catalog_hash"] = delivery.catalogHash;
    context["product_delivery_stack_pack_id"] = delivery.stackPackId;
    context["product_delivery_conversion_policy"] = delivery.design.conversionPolicy;
    context["product_delivery_design_projection"] = delivery.design.projection;
    context["product_delivery_topology_hash"] = delivery.topology.descriptorHash;
    context["stack_pack_id"] = delivery.stackPackId;
    context["detected_stack"] = delivery.stackPackId;
    context["platform"] = delivery.delivery.platform;
    context["tech_stack"] = delivery.delivery.techStack;
    context["design_required"] = String(delivery.delivery.designRequired);
  }
  if (!isNativeV3ImplementCompletion) {
    for (const [key, value] of Object.entries(parsed)) {
      if (isStepOutputContextKeyProtected(key, context)) {
        logger.warn(`[context] Blocked overwrite of protected key "${key}" (current: "${context[key]}", attempted: "${value}")`, { runId: step.run_id });
        continue;
      }
      context[key] = value;
    }
  }

  // Wave 13 Bug N (run #344 postmortem): dangerous command guard. In run #344
  // multiple agents ran `rm -rf node_modules && npm install` inside their
  // worktrees, which destroyed the node_modules symlink pointing at the main
  // project and triggered cascading install failures. Others ran `git push
  // --force` on feature branches. We can't stop the shell at invocation time,
  // but agents tend to echo their commands into STDOUT for auditing — if we
  // see one of these patterns in the output we fail the step immediately with
  // corrective guidance, denying the success path and forcing a retry.
  const DANGEROUS_CMDS: Array<{ rx: RegExp; label: string }> = [
    { rx: /\brm\s+-[rf]+\s+[^|;&]*\bnode_modules\b/, label: "rm -rf node_modules" },
    { rx: /\brm\s+-[rf]+\s+[^|;&]*\.vite\b/, label: "rm -rf .vite" },
    { rx: /\bgit\s+push\s+--force\b/, label: "git push --force" },
    { rx: /\bgit\s+reset\s+--hard\s+origin\/(main|master)\b/, label: "git reset --hard origin/main" },
  ];
  if (!isNativeV3ImplementCompletion && !isNativeV3PlanCompletion) {
    for (const { rx, label } of DANGEROUS_CMDS) {
      const m = output.match(rx);
      if (m) {
        const snippet = m[0].slice(0, 120);
        logger.error(`[dangerous-cmd] Blocked command pattern "${label}" in ${step.step_id} output: ${snippet}`, { runId: step.run_id });
        await failStep(stepId, `DANGEROUS_COMMAND_DETECTED: "${snippet}". The "${label}" pattern is banned — node_modules is a symlink to the main repo so rm -rf breaks sibling worktrees, and force-push / hard-reset destroy history. Use 'git clean -fdx' for build artifacts, 'npm ci' for dependency reset, or push a revert commit instead. Re-implement the story without running that command.`, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }
  }

  // Expand tilde in repo path (Node.js fs does not expand ~)
  if (context["repo"]?.startsWith("~/")) {
    context["repo"] = context["repo"].replace(/^~\//, os.homedir() + "/");
  }
  if (context["story_workdir"]?.startsWith("~/")) {
    context["story_workdir"] = context["story_workdir"].replace(/^~\//, os.homedir() + "/");
  }

  // Loop completion can arrive after a spawner restart/shutdown has cleared
  // steps.current_story_id but before the agent's output is processed. Recover
  // the story from explicit output fields instead of silently dropping a valid
  // completion and re-claiming the same work.
  if (step.type === "loop" && !step.current_story_id) {
    const reportedStoryId = (parsed["story_id"] || "").trim();
    const reportedBranch = (parsed["story_branch"] || context["story_branch"] || "").trim().toLowerCase();
    if (reportedStoryId || reportedBranch) {
      const runPrefix = step.run_id.slice(0, 8).toLowerCase();
      const candidates = await pgQuery<any>(
        `SELECT *
         FROM stories
         WHERE run_id = $1
           AND status IN ('pending','running')
           AND (
             ($2 <> '' AND lower(story_id) = lower($2))
             OR ($3 <> '' AND lower(COALESCE(story_branch, '')) = lower($3))
             OR ($3 <> '' AND lower($3) = lower($4 || '-' || story_id))
           )
         ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, story_index ASC
         LIMIT 1`,
        [step.run_id, reportedStoryId, reportedBranch, runPrefix],
      );
      const recoveredStory = candidates[0];
      if (recoveredStory) {
        const storyBranch = (recoveredStory.story_branch || reportedBranch || `${runPrefix}-${recoveredStory.story_id}`).toLowerCase();
        let storyWorkdir = "";
        if (context["repo"]) {
          storyWorkdir = findWorktreeDir(context["repo"], storyBranch, step.agent_id)
            || findWorktreeDir(context["repo"], recoveredStory.story_id, step.agent_id)
            || "";
          if (!storyWorkdir && storyBranch) {
            storyWorkdir = createStoryWorktree(context["repo"], storyBranch, context["story_base_ref"] || "main", step.agent_id);
          }
        }
        context["story_branch"] = storyBranch;
        if (storyWorkdir) context["story_workdir"] = storyWorkdir;
        await pgRun(
          `UPDATE stories
           SET status = 'running',
               story_branch = COALESCE(NULLIF(story_branch, ''), $1),
               claimed_at = COALESCE(claimed_at, NOW()),
               claimed_by = COALESCE(claimed_by, $2),
               updated_at = NOW()
           WHERE id = $3 AND status IN ('pending','running')`,
          [storyBranch, step.agent_id, recoveredStory.id],
        );
        await pgRun(
          "UPDATE steps SET status = 'running', current_story_id = $1, updated_at = NOW() WHERE id = $2 AND current_story_id IS NULL",
          [recoveredStory.id, step.id],
        );
        await recordStepTransition(step.id, step.run_id, null, "running", step.agent_id, "recoverLoopCompletionStory", { storyId: recoveredStory.story_id });
        step = { ...step, current_story_id: recoveredStory.id };
        recoveredStory.status = "running";
        recoveredStory.story_branch = storyBranch;
        await injectStoryContext(recoveredStory, step as any, context);
        logger.warn(`[loop-recover] Restored current_story_id for ${recoveredStory.story_id} from completion output`, { runId: step.run_id, stepId: step.step_id });
      }
    }
  }

  // FIX 1: Explicit fail interceptor — agent reported STATUS: fail/error
  // Wave 13 Bug J-3 (run #344 postmortem): extend parser to handle "retry" and
  // treat unknown status values as failures. Previously only fail/failed/error
  // tripped the failStep path; "retry" (and anything else) silently fell through
  // to the default "done" flow, so run #344's verify step was marked done even
  // though Iris explicitly reported STATUS: retry with a list of blocking issues.
  // Wave 13+ hotfix: parseOutputKeyValues can leak trailing lines into the
  // STATUS value when agent output lacks blank separators. Run #352 US-003:
  // parsed["status"] = "done\nstepId: ..." instead of just "done".
  // Fix: trim and extract only the first word from the status value.
  const rawStatus = (parsed["status"] || "").trim();
  const statusVal = (rawStatus.indexOf("\n") >= 0 ? rawStatus.slice(0, rawStatus.indexOf("\n")).trim() : rawStatus).split(/\s/)[0].toLowerCase() || undefined;
  const isV3DownstreamCompletion = completionAuthority?.envelope.protocol === "v3"
    && (step.step_id === "qa-test" || step.step_id === "final-test");
  const isV3DeterministicDeployCompletion = completionAuthority?.envelope.protocol === "v3"
    && step.step_id === "deploy";
  if (!isNativeV3ImplementCompletion && !atomicNativeV3StoriesCompletion) {
    await recordStepOutputObservation(step, parsed, output, context);
    await recordStackEvidencePlanObservation(step, context);
  }
  const superviseEachConfigForStep = await getSuperviseEachConfigForStep(step);
  const supervisorDecisionVal = firstOutputWord(parsed["supervisor_decision"]);
  const v3SuperviseSuccess = statusVal === "done"
    && ["pass", "fixed"].includes(supervisorDecisionVal);
  if (v3SuperviseBoundSubject
    && !v3SuperviseSuccess
    && superviseEachConfigForStep
    && v3SuperviseBoundSubject.kind === "story_member") {
    return await handleSuperviseEachCompletion(
      step,
      superviseEachConfigForStep.loopStepId,
      superviseEachConfigForStep.verifyStep,
      output,
      context,
      completionAuthority?.envelope,
      false,
      v3SuperviseBoundSubject?.kind === "story_member"
        ? {
            storyDbId: v3SuperviseBoundSubject.storyDbId,
            storyId: v3SuperviseBoundSubject.storyId,
          }
        : undefined,
      options.deferContinuationToEffectLedger ?? false,
      false,
      true,
      v3SuperviseRuntimeSessionId,
    );
  }
  if (v3SuperviseBoundSubject?.kind === "final_product" && !v3SuperviseSuccess) {
    context["previous_failure"] = `Authenticated supervisor rejected non-success output ${supervisorDecisionVal || statusVal || "unknown"}: ${output.slice(0, 6_000)}`;
    context["failure_category"] = "LLM_SUPERVISOR_BLOCKED";
    context["failure_suggestion"] = "Return an exact STATUS done with SUPERVISOR_DECISION pass or fixed after resolving every blocker.";
    context["supervisor_scope"] = v3SuperviseBoundSubject.kind === "final_product"
      ? "final-product"
      : "story";
    await updateRunContext(step.run_id, context);
    await failStep(
      step.id,
      `Authenticated supervisor rejected non-success output ${supervisorDecisionVal || statusVal || "unknown"}: ${output.slice(0, 6_000)}`,
      completionAuthority?.envelope,
    );
    return { advanced: false, runCompleted: false };
  }
  if (step.step_id === "qa-test" && !isV3DownstreamCompletion) {
    const _modRegistry = await import("./steps/registry.js");
    const _stepModule = _modRegistry.get(step.step_id);
    if (_stepModule) {
      if (_stepModule.normalize) _stepModule.normalize(parsed);
      const _result = _stepModule.validateOutput(parsed);
      if (!_result.ok) {
        const _modErr = `GUARDRAIL [module:${_stepModule.id}]: ${_result.errors.join("; ")}`;
        logger.warn(`[step-module] ${_modErr}`, { runId: step.run_id });
        await failStep(stepId, _modErr, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }
  }
  if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
    if (
      isV3DownstreamCompletion
      && await routeQualityFailureToImplement(step, output, context, completionAuthority?.envelope)
    ) {
      return { advanced: false, runCompleted: false };
    }
    logger.warn(`Agent reported STATUS: ${parsed["status"]} — failing step`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Agent reported failure: ${parsed["status"]}. Output: ${output.slice(0, 500)}`, completionAuthority?.envelope);
    return { advanced: false, runCompleted: false };
  }
  let verifyEachRetryHandledLater = false;
  if (statusVal === "retry") {
    // Soft retry: failStep bounces the step back to pending and increments
    // retry_count; if retries are exhausted the existing step-fail logic
    // escalates to a terminal fail. Verify-each already handles this in its
    // own path (step-ops.ts handleVerifyEachCompletion); this branch closes
    // the gap for single-step verify (direct-merge workflows).
    verifyEachRetryHandledLater = await isVerifyEachVerifyStep(step);
    if (!verifyEachRetryHandledLater) {
      if (
        isV3DownstreamCompletion
        && await routeQualityFailureToImplement(step, output, context, completionAuthority?.envelope)
      ) {
        return { advanced: false, runCompleted: false };
      }
      if ((step.step_id === "qa-test" || step.step_id === "final-test" || step.step_id === "verify") && isSmokeInfrastructureFailure(output)) {
        logger.warn(`[status-parser] Smoke/browser infra retry for ${step.step_id}; retrying step without QA-FIX routing`, { runId: step.run_id, stepId: step.step_id });
        await failStep(stepId, `INFRA: smoke browser infrastructure failed; retry ${step.step_id}, do not modify app code.\n${output.slice(0, 2000)}`, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
      if (await routeQualityFailureToImplement(step, output, context, completionAuthority?.envelope)) {
        return { advanced: false, runCompleted: false };
      }
      logger.warn(`[status-parser] Agent reported STATUS: retry — bouncing step to pending`, { runId: step.run_id, stepId: step.step_id });
      await failStep(stepId, `Agent requested retry: ${output.slice(0, 500)}`, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
    logger.info(`[status-parser] Verify-each retry will be handled by story retry path`, { runId: step.run_id, stepId: step.step_id });
  }
  if (statusVal && statusVal !== "done" && statusVal !== "skip" && !(statusVal === "retry" && verifyEachRetryHandledLater)) {
    // Whitelist: any explicit status other than done/skip/retry/fail is garbage
    // and must fail loudly. This catches typos, hallucinations ("STATUS: ok"),
    // and future agents that invent new status words without platform support.
    logger.warn(`[status-parser] Agent reported unknown STATUS: "${parsed["status"]}" — treating as failure`, { runId: step.run_id, stepId: step.step_id });
    await failStep(stepId, `Unknown STATUS: "${parsed["status"]}". Expected one of: done, skip, retry, fail.`, completionAuthority?.envelope);
    return { advanced: false, runCompleted: false };
  }
  if (!statusVal) {
    // Missing STATUS line — legacy agents still expect the default "done" flow,
    // but surface a warning so we can tighten this later if needed.
    logger.warn(`[status-parser] Missing STATUS in agent output — assuming done (legacy)`, { runId: step.run_id, stepId: step.step_id });
  }

  // FIX 6: Status is ephemeral — do not propagate upstream status to downstream steps
  delete context["status"];

  // No fallback extraction — if upstream didn't output required keys,
  // the missing input guard will catch it and fail cleanly.

  // EAGER CONTEXT SAVE: Persist merged context BEFORE guardrail checks.
  // Guardrails (test, quality, db-provision) may call failStep + return early,
  // which previously skipped the context save — losing parsed output keys.
  // v1.5.47: Snapshot context before save so guardrail failures can rollback bad values.
  const prevContextJson = candidateContextSnapshot;
  let completionOwnedContextJson = prevContextJson?.context;
  const persistCompletionContext = async (): Promise<void> => {
    if (atomicNativeV3PlanCompletion || atomicNativeV3StoriesCompletion) return;
    if (completionOwnedContextJson === undefined) {
      throw new Error("STEP_COMPLETION_PRIOR_RUN_CONTEXT_REQUIRED");
    }
    const nextContextJson = JSON.stringify(context);
    const updated = await pgQuery<{ id: string }>(
      `UPDATE runs
          SET context = $1, updated_at = $2
        WHERE id = $3
          AND context = $4
        RETURNING id`,
      [nextContextJson, now(), step.run_id, completionOwnedContextJson],
    );
    if (updated.length !== 1) throw new Error("STEP_COMPLETION_RUN_CONTEXT_CAS_LOST");
    completionOwnedContextJson = nextContextJson;
  };
  const restoreCompletionContext = async (restoredContextJson = prevContextJson?.context): Promise<void> => {
    if (atomicNativeV3PlanCompletion || atomicNativeV3StoriesCompletion || restoredContextJson === undefined) return;
    if (completionOwnedContextJson === undefined) {
      throw new Error("STEP_COMPLETION_PRIOR_RUN_CONTEXT_REQUIRED");
    }
    const restored = await pgQuery<{ id: string }>(
      `UPDATE runs
          SET context = $1, updated_at = $2
        WHERE id = $3
          AND context = $4
        RETURNING id`,
      [restoredContextJson, now(), step.run_id, completionOwnedContextJson],
    );
    if (restored.length !== 1) throw new Error("STEP_COMPLETION_CONTEXT_RESTORE_CAS_LOST");
    completionOwnedContextJson = restoredContextJson;
  };
  if (!isNativeV3ImplementCompletion && !atomicNativeV3PlanCompletion && !atomicNativeV3StoriesCompletion) {
    await persistCompletionContext();
  }

  // Step module delegation (v2026-04-14).
  // Registered modules OWN their step's validation and side effects.
  // Order: normalize (mutate parsed) → validateOutput (reject on fail) → onComplete (side effects).
  // Unregistered steps fall through to legacy guardrails below.
  if (!isNativeV3ImplementCompletion) {
    const _modRegistry = await import("./steps/registry.js");
    const _stepModule = _modRegistry.get(step.step_id);
    if (_stepModule) {
      if (_stepModule.normalize) _stepModule.normalize(parsed);
      const _result = _stepModule.validateOutput(parsed);
      if (!_result.ok) {
        const _modErr = `GUARDRAIL [module:${_stepModule.id}]: ${_result.errors.join("; ")}`;
        logger.warn(`[step-module] ${_modErr}`, { runId: step.run_id });
        await restoreCompletionContext();
        await failStep(stepId, _modErr, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
      if (_stepModule.onComplete) {
        try {
          let completeCurrentStoryId = "";
          if (step.current_story_id) {
            const completeStory = await pgGet<{ story_id: string }>(
              "SELECT story_id FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
              [step.current_story_id, step.run_id],
            );
            completeCurrentStoryId = completeStory?.story_id || "";
          }
          if (!completeCurrentStoryId) completeCurrentStoryId = context["current_story_id"] || "";
          const completeContext = { runId: step.run_id, stepId: step.step_id, parsed, context, currentStoryId: completeCurrentStoryId, rawOutput: output };
          if (atomicNativeV3StoriesCompletion && _stepModule.id === "stories") {
            const { prepareV3StoriesCompletionV1 } = await import("./steps/03-stories/guards.js");
            preparedV3StoriesCompletion = await prepareV3StoriesCompletionV1(completeContext);
          } else {
            await _stepModule.onComplete(completeContext);
          }
          if (!atomicNativeV3PlanCompletion && !atomicNativeV3StoriesCompletion) await persistCompletionContext();
          logger.info(`[step-module] ${_stepModule.id} onComplete ok`, { runId: step.run_id });
        } catch (_oe) {
          // Module onComplete threw — treat as fatal guardrail rejection (e.g. stories
          // 0-stories, missing scope_files, hallucinated screen path).
          const _msg = `GUARDRAIL [module:${_stepModule.id}]: ${String(_oe instanceof Error ? _oe.message : _oe).slice(0, 400)}`;
          logger.warn(`[step-module] ${_msg}`, { runId: step.run_id });
          if (!atomicNativeV3PlanCompletion && prevContextJson) {
            let restoredContext = prevContextJson.context;
            if (_stepModule.id === "supervise") {
              try {
                const supervisorContext = JSON.parse(prevContextJson.context || "{}");
                supervisorContext["previous_failure"] = _msg;
                supervisorContext["failure_category"] = "SUPERVISOR_OUTPUT_INVALID";
                supervisorContext["failure_suggestion"] = "Re-run the supervisor audit. If passing or fixing a story-scoped checkpoint, AC_COVERAGE must use the exact current story acceptance-criteria count, for example checked 20/20 acceptance criteria.";
                restoredContext = JSON.stringify(supervisorContext);
              } catch {
                restoredContext = prevContextJson.context;
              }
            }
            await restoreCompletionContext(restoredContext);
          }
          await failStep(stepId, _msg, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }
      }

      const supervisorPhase =
        step.step_id === "plan" ? "plan" :
        step.step_id === "design" ? "design" :
        step.step_id === "deploy" ? "deploy" :
        "";
      const supervisorInput = {
        protocol: completionAuthority?.protocol ?? "legacy",
        stepId: step.step_id,
      } as const;
      const runLegacyProductSupervisor = context["product_semantics_version"] === "v2"
        ? shouldRunLegacyProductSupervisorV2({
            ...supervisorInput,
            ...(nativeV3PlanAuthority
              ? { planAuthority: nativeV3PlanAuthority as V3PlanOutputAuthorityV2 }
              : {}),
          })
        : shouldRunLegacyProductSupervisorV1({
            ...supervisorInput,
            ...(nativeV3PlanAuthority
              ? { planAuthority: nativeV3PlanAuthority as V3PlanOutputAuthorityV1 }
              : {}),
          });
      if (supervisorPhase && runLegacyProductSupervisor && (parsed["status"] || "").toLowerCase() === "done") {
        const { runProductSupervisorGate, updateSupervisorMemory } = await import("./product-supervisor.js");
        const supervisor = runProductSupervisorGate({
          phase: supervisorPhase as any,
          runId: step.run_id,
          stepId: step.step_id,
          task: context["task"] || "",
          parsed,
          context,
          rawOutput: output,
        });
        updateSupervisorMemory(context, supervisor.memoryEntry);
        if (!supervisor.ok) {
          context["previous_failure"] = supervisor.reason;
          context["failure_category"] = supervisor.code;
          context["failure_suggestion"] = "Treat this as product-manager feedback: preserve the original task/PRD, remove untraceable modules, and re-output a coherent result before coding continues.";
          if (!atomicNativeV3PlanCompletion) await persistCompletionContext();
          await failStep(stepId, `GUARDRAIL [product-supervisor:${supervisorPhase}]: ${supervisor.reason}`, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }
        if (!atomicNativeV3PlanCompletion) await persistCompletionContext();
      }
    }
  }

  // (Legacy REPO DEDUP for plan moved to 01-plan/guards.ts normalize() —
  //  bug fix: stitch is now WIPED during reset (was preserved, causing run #445
  //  to inherit 5-day-old stitch from a prior task). Module owns it now.)

  // REQUIRED OUTPUT FIELDS GUARDRAIL (Wave 3 fix #12 + Wave 9 auto-derive)
  // Enforce that each step's agent output contains fields the pipeline actually
  // reads downstream. Wave 9 addition: before firing the guardrail, try to
  // auto-derive missing fields from filesystem/package.json state so agents
  // that copy only the tail of a script's output (and skip EXISTING_CODE /
  // BUILD_CMD on the last line) don't burn a retry slot. Run #344 proved
  // this: every single run was eating one retry on both setup-repo and
  // setup-build for exactly this reason — the script emitted the field but
  // the agent forwarded only STATUS: done. The derivation is conservative —
  // only fills when a reliable source exists, otherwise the guardrail still
  // fires and the agent gets a chance to correct.
  if (!isNativeV3ImplementCompletion && parsed["status"]?.toLowerCase() === "done") {
    // (setup-repo EXISTING_CODE + setup-build BUILD_CMD auto-derive moved to
    //  04-setup-repo/preclaim.ts and 05-setup-build/preclaim.ts — modules
    //  expose *_hint context vars that their onComplete stamp into the final fields.)

    const missingFieldsMsg = checkRequiredOutputFields(step.step_id, parsed);
    if (missingFieldsMsg) {
      logger.warn(`[required-fields-guardrail] ${missingFieldsMsg}`, { runId: step.run_id, stepId: step.step_id });
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "required-output-fields",
        label: "Required output fields",
        status: "fail",
        summary: "Required output fields missing",
        detail: missingFieldsMsg,
      });
      await restoreCompletionContext();
      await failStep(stepId, missingFieldsMsg, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  // TEST FAILURE GUARDRAIL — soft retry with fix instructions instead of hard fail
  if (!isNativeV3ImplementCompletion && parsed["status"]?.toLowerCase() === "done") {
    const testFailMsg = checkTestFailures(output);
    if (testFailMsg && step.retry_count < step.max_retries) {
      logger.warn(`Test guardrail triggered — soft retry with fix instructions`, { runId: step.run_id, stepId: step.step_id });
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "test-guardrail",
        label: "Test guardrail",
        status: "retry",
        summary: "Test evidence requested retry",
        detail: testFailMsg,
      });
      // Inject failure details as previous_failure so agent knows what to fix
      const { classifyError: _ce1 } = await import("./error-taxonomy.js");
      const _cl1 = _ce1(testFailMsg);
      applyRetryFailureContext(context, `TEST GUARDRAIL: ${testFailMsg}`, _cl1.category, _cl1.suggestion);
      await persistCompletionContext();
      await failStep(stepId, testFailMsg, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    } else if (testFailMsg) {
      // Max retries reached — hard fail
      logger.warn(`Test guardrail — max retries reached, hard fail`, { runId: step.run_id, stepId: step.step_id });
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "test-guardrail",
        label: "Test guardrail",
        status: "fail",
        summary: "Test guardrail exhausted retries",
        detail: testFailMsg,
      });
      await restoreCompletionContext();
      await failStep(stepId, testFailMsg, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  // QUALITY GATE GUARDRAIL — soft retry with fix context
  if (!isNativeV3ImplementCompletion && parsed["status"]?.toLowerCase() === "done") {
    const qgPath = (step.step_id === "implement" && context["story_workdir"])
      ? context["story_workdir"]
      : (context["repo"] || context["REPO"] || "");
    const qgMsg = checkQualityGate(step.step_id, qgPath);
    if (qgMsg && step.retry_count < step.max_retries) {
      logger.warn(`[quality-gate] Soft retry with fix instructions`, { runId: step.run_id, stepId: step.step_id });
      const qgSummary = qgMsg
        .split(/\n/)
        .map(line => line.trim())
        .find(line => line.length > 0) || "Quality gate requested retry";
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "quality-gate",
        label: "Quality gate",
        status: "retry",
        summary: `Quality gate retry: ${qgSummary}`,
        detail: qgMsg,
        metadata: { repoPath: qgPath },
      });
      const { classifyError: _ce2 } = await import("./error-taxonomy.js");
      const _cl2 = _ce2(qgMsg);
      applyRetryFailureContext(context, `QUALITY GATE: ${qgMsg}`, _cl2.category, _cl2.suggestion);
      await persistCompletionContext();
      await failStep(stepId, qgMsg, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    } else if (qgMsg) {
      logger.warn(`[quality-gate] Max retries — hard fail`, { runId: step.run_id, stepId: step.step_id });
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "quality-gate",
        label: "Quality gate",
        status: "fail",
        summary: "Quality gate exhausted retries",
        detail: qgMsg,
        metadata: { repoPath: qgPath },
      });
      await restoreCompletionContext();
      await failStep(stepId, qgMsg, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  // Design Contract + Rules — moved to 02-design/guards.ts onComplete (called via step-module delegation).
  // The download fallback below stays as belt-and-suspenders if the module's preClaim missed something.
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    // Immediately download Stitch HTML after design completes (don't wait for setup-repo)
    const dRepo = context["repo"] || context["REPO"] || "";
    let dProjId = context["stitch_project_id"] || "";
    const dScreenCount = parseInt(context["screens_generated"] || "0", 10);
    const dScreenMap = context["screen_map"] || "";
    const dHasScreens = dScreenCount > 0 || (dScreenMap.length > 10 && dScreenMap.includes("screenId"));

    // AUTO-CREATE Stitch project if agent didn't create one
    if (dRepo && !dProjId && dHasScreens) {
      const stitchScript = resolvePlatformScript("stitch-api.mjs");
      const projectName = path.basename(dRepo);
      logger.info(`[design-auto-project] Creating Stitch project "${projectName}"`, { runId: step.run_id });
      try {
        const ensureOut = execFileSync("node", [stitchScript, "ensure-project", projectName, dRepo], { encoding: "utf-8", timeout: 30000, cwd: dRepo });
        let ensureResult: any = {};
        try { ensureResult = JSON.parse(ensureOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        dProjId = ensureResult.projectId || "";
        if (dProjId) {
          context["stitch_project_id"] = dProjId;
          logger.info(`[design-auto-project] Created Stitch project: ${dProjId}`, { runId: step.run_id });
        }
      } catch (e) {
        logger.warn(`[design-auto-project] Failed: ${e}`, { runId: step.run_id });
      }
    }

    if (dRepo) {
      try {
        const dotStitchPath = path.join(dRepo, ".stitch");
        if (fs.existsSync(dotStitchPath)) {
          const dotStitch = JSON.parse(fs.readFileSync(dotStitchPath, "utf-8"));
          const fileProjectId = String(dotStitch?.projectId || "").trim();
          if (fileProjectId && fileProjectId !== dProjId) {
            logger.warn(`[design-download] Context Stitch project ${dProjId || "(empty)"} differed from repo .stitch ${fileProjectId}; using repo .stitch`, { runId: step.run_id });
            dProjId = fileProjectId;
            context["stitch_project_id"] = fileProjectId;
          }
        }
      } catch (e) {
        logger.warn(`[design-download] Could not verify repo .stitch project id: ${String(e).slice(0, 160)}`, { runId: step.run_id });
      }
    }

    if (dRepo && dProjId && dHasScreens) {
      const dStitchDir = path.join(dRepo, "stitch");
      // Only generate if no HTML exists (skip if already downloaded by pre-claim)
      {
        const stitchScript = resolvePlatformScript("stitch-api.mjs");
        const existingHtmlCount = fs.existsSync(dStitchDir)
          ? fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html")).length : 0;
        let screenMapArr: any[] = [];
        try { screenMapArr = JSON.parse(dScreenMap); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
        if (screenMapArr.length > 0 && existingHtmlCount === 0) {
          const designSystem = context["design_system"] || "";
          const deviceType = context["device_type"] || "DESKTOP";
          const uiLanguage = context["ui_language"] || context["UI_LANGUAGE"] || "English";

          const prd = context["prd"] || context["PRD"] || "";
          const productVision = context["ui_vision_summary"] || context["UI_VISION_SUMMARY"] || "";
          const screenDescs = screenMapArr.map((s: any, i: number) =>
            `${i + 1}. ${s.name} (${s.type || "screen"}) - ${s.description || "UI screen"}`
          ).join("\n");

          const prompt = `# DESIGN_BRIEF

## STRICT_UI_SCOPE_CONTRACT
- Design only UI that maps to the SCREEN_MAP/Product Surface targets below.
- Do not invent modules, workflows, dashboards, marketing pages, admin areas, ecommerce flows, docs, PRD pages, or settings outside those targets.
- Physical screen count, routing, tabs, modals, drawers, and component hierarchy are Stitch decisions, but every generated screen must be traceable to an existing target.
- All visible user-facing text must be in ${uiLanguage}.
- Keep screen metadata and technical identifiers in English.
- Target device type: ${deviceType}.

## PRODUCT_SURFACE_TARGETS
${screenDescs}

## PRODUCT_VISION_SUMMARY
${productVision}

## DESIGN_SYSTEM_CONTEXT
${designSystem}

## UI_SAFE_PRD_CONTEXT
Use this only to understand visible product behavior, user-facing empty/error states, and action feedback. Do not render this text, database schema, tests, repo paths, or implementation details as UI.
If this section conflicts with PRODUCT_SURFACE_TARGETS, PRODUCT_SURFACE_TARGETS wins.

${prd}`;

          const promptFile = path.join(dStitchDir, ".generate-prompt.txt");
          fs.writeFileSync(promptFile, prompt);

          logger.info(`[design-generate] Auto-generating ${screenMapArr.length} screens via generate-all-screens`, { runId: step.run_id });
          try {
            const genOut = execFileSync("node", [stitchScript, "generate-all-screens", dProjId, promptFile, deviceType, "GEMINI_3_1_PRO"], { encoding: "utf-8", timeout: 600000, cwd: dRepo });
            let genResult: any = {};
            try { genResult = JSON.parse(genOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
            logger.info(`[design-generate] Generated ${genResult.total || 0} screens in ${genResult.elapsedSeconds || "?"}s`, { runId: step.run_id });
          } catch (genErr) {
            logger.warn(`[design-generate] generate-all-screens failed: ${genErr}`, { runId: step.run_id });
          }
        }

        // DOWNLOAD: Batch download all screens (HTML + PNG + manifest + tokens)
        const expectedHtmlCount = screenMapArr.length || dScreenCount;
        const currentHtmlCount = fs.existsSync(dStitchDir)
          ? fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html")).length : 0;
        if (expectedHtmlCount > 0 && currentHtmlCount >= expectedHtmlCount) {
          logger.info(`[design-download] Skip download; ${currentHtmlCount}/${expectedHtmlCount} HTML files already present from design preclaim`, { runId: step.run_id });
        } else {
          logger.info(`[design-download] Downloading all screens from Stitch project ${dProjId}`, { runId: step.run_id });
          try {
            const dlOut = execFileSync("node", [stitchScript, "download-all", dProjId, dStitchDir], { encoding: "utf-8", timeout: 180000, cwd: dRepo });
            let dlResult: any = {};
            try { dlResult = JSON.parse(dlOut); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
            logger.info(`[design-download] Downloaded ${dlResult.downloaded || 0}/${dlResult.total || 0} screens`, { runId: step.run_id });
          } catch (dlErr) {
            logger.warn(`[design-download] Batch download failed: ${dlErr}`, { runId: step.run_id });
          }
        }

        // GUARD: Verify HTML files actually exist after download
        const htmlAfterDownload = fs.readdirSync(dStitchDir).filter((f: string) => f.endsWith(".html"));
        if (htmlAfterDownload.length === 0 && dScreenCount > 0) {
          const failMsg = `GUARDRAIL: Design step claims ${dScreenCount} screens but 0 HTML files downloaded. Stitch project may be deleted or API failed. Remove .stitch file and retry.`;
          logger.error(`[design-download] ${failMsg}`, { runId: step.run_id });
          // Remove stale .stitch so retry creates fresh project
          const staleStitch = path.join(dRepo, ".stitch");
          if (fs.existsSync(staleStitch)) { try { fs.unlinkSync(staleStitch); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); } }
          await failStep(stepId, failMsg, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }
      }
    }

    // #21 fix (plan: reactive-frolicking-cupcake.md): sync stitch_project_id back
    // to MC's prds table. The MC dashboard's "View Design" link reads from
    // prds.stitch_project_id, but that column only gets populated when the user
    // creates a PRD via MC's preview flow (prd-generator.ts:475). For runs
    // started via setfarm CLI directly, or for runs where the design step
    // discovered/auto-created a Stitch project after the PRD already existed,
    // the prds row stays empty and the dashboard shows "no design available".
    // Setfarm shares the same Postgres database as MC, so we can write
    // directly. Idempotent: only fills in NULL, never overwrites a value the
    // PRD generator already set.
    const prdsSyncProjId = context["stitch_project_id"] || "";
    if (prdsSyncProjId) {
      try {
        const updateRes = await pgRun(
          "UPDATE prds SET stitch_project_id = $1, updated_at = NOW() WHERE run_id = $2 AND (stitch_project_id IS NULL OR stitch_project_id = '')",
          [prdsSyncProjId, step.run_id],
        );
        // pgRun returns the result; the underlying postgres client exposes count via .count
        const affected = (updateRes as any)?.count ?? 0;
        if (affected > 0) {
          logger.info(`[design] Synced stitch_project_id=${prdsSyncProjId} to prds row for run ${step.run_id.slice(0, 8)}`, { runId: step.run_id });
        }
      } catch (syncErr) {
        // Non-fatal: prds table may not exist (setfarm-only deployment) or
        // schema may differ. Log and continue — never block the design step
        // on a sync failure.
        logger.warn(`[design] prds.stitch_project_id sync skipped: ${String(syncErr).slice(0, 200)}`, { runId: step.run_id });
      }
    }
  }

  // DB Auto-Provisioning (setup step)
  // (setup-repo branch ensure + DB provision + design contracts moved to
  //  04-setup-repo/preclaim.ts. setup-build branch fallback moved to
  //  05-setup-build/preclaim.ts via shared branch normalize.)

  // (setup-build baseline, stitch-to-jsx, compat engine moved to
  //  05-setup-build/preclaim.ts and guards.ts. Module delegation handles failure.)

  // SETUP-BUILD APP.TSX SCAFFOLD BASELINE GUARDRAIL.
  // setup-repo creates a neutral App.tsx marked with data-setfarm-root="baseline".
  // If setup-build or its agent rewrites App.tsx before implement, surface it so
  // downstream reviewers can catch feature code leaking into the baseline.
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    try {
      const repoPath = context["repo"] || "";
      const appTsxPath = path.join(repoPath, "src", "App.tsx");
      if (repoPath && fs.existsSync(appTsxPath)) {
        const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");
        const lineCount = appTsxContent.split("\n").length;
        // Accept either Setfarm's neutral baseline or older Vite starter signals.
        const hasSetfarmBaseline = /data-setfarm-root=["']baseline["']/.test(appTsxContent);
        const hasReactLogo = /reactLogo|react\.svg|vite\.svg/i.test(appTsxContent);
        const hasCountState = /useState\(0\)|count.*setCount|setCount.*count/i.test(appTsxContent);
        const hasViteDemo = /count is|edit.*app\.tsx|HMR|vite \+ react/i.test(appTsxContent);
        const looksLikeDefault = hasSetfarmBaseline || hasReactLogo || hasCountState || hasViteDemo;
        if (!looksLikeDefault) {
          const preview = appTsxContent.slice(0, 200).replace(/\s+/g, " ");
          logger.warn(`[setup-build-scope] src/App.tsx does NOT match setup scaffold baseline after setup-build (${lineCount} lines, preview: "${preview}..."). Implement will start from this modified baseline.`, { runId: step.run_id });
          // Record in context so verify/qa-test can see it downstream if needed
          context["setup_build_app_tsx_drift"] = `lines=${lineCount},hasSetupBaseline=false`;
          await persistCompletionContext();
        }
      }
    } catch (appTsxErr) {
      if (appTsxErr instanceof Error && appTsxErr.message === "STEP_COMPLETION_RUN_CONTEXT_CAS_LOST") {
        throw appTsxErr;
      }
      logger.warn(`[setup-build-scope] App.tsx drift check skipped: ${String(appTsxErr).slice(0, 150)}`, { runId: step.run_id });
    }
  }

  // pr-each story branches target main, so setup-build must publish the clean
  // scaffold/build baseline to main before implement starts. Without this,
  // US-001 branches from an empty/stale main and every later PR collides.
  if (step.step_id === "setup-build" && parsed["status"]?.toLowerCase() === "done") {
    const setupBranch = normalizeRunBranchContext(context, step.run_id, context["repo"] || "");
    await persistCompletionContext();
    const baselinePublished = publishSetupBaselineToMain(context["repo"] || "", setupBranch, step.run_id);
    if (!baselinePublished) {
      const reason = "SETUP_BASELINE_MAIN_SYNC_FAILED: setup-build could not publish the baseline to main. pr-each implement cannot start safely until main contains the scaffold/build baseline.";
      await failStep(stepId, reason, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  let v3DeployReceipt: V3DeployReceiptV1 | undefined;
  if (isV3DeterministicDeployCompletion && parsed["status"]?.toLowerCase() === "done") {
    let rawReceipt: unknown;
    try {
      rawReceipt = JSON.parse(parsed["deploy_receipt_json"] || "");
    } catch {
      throw new V3DeployAuthorityError(
        "V3_DEPLOY_PACKET_INVALID",
        "deterministic deploy completion is missing a parseable typed receipt",
        { runId: step.run_id },
      );
    }
    const receipt = V3DeployReceiptV1Schema.safeParse(rawReceipt);
    if (
      !receipt.success
      || receipt.data.runId !== step.run_id
      || receipt.data.receiptHash !== parsed["deploy_receipt_hash"]
      || receipt.data.candidateHash !== parsed["accepted_candidate_hash"]
      || receipt.data.sourceAfter.sha !== parsed["accepted_source_sha"]
      || receipt.data.sourceAfter.treeHash !== parsed["accepted_source_tree_hash"]
    ) {
      throw new V3DeployAuthorityError(
        "V3_DEPLOY_PACKET_INVALID",
        "deterministic deploy output does not bind its typed receipt and AcceptedCandidate source",
        { runId: step.run_id, receiptHash: parsed["deploy_receipt_hash"] || null },
      );
    }
    v3DeployReceipt = receipt.data;
    logger.info("[deploy-v3] typed runtime, health and exact-source receipt accepted; legacy deploy guardrails bypassed", {
      runId: step.run_id,
      stepId: step.step_id,
    });
  }

  // Legacy deploy remains agent-owned and keeps its historical health/MC/DNS
  // guardrails. V3 was already health-checked by the typed executor; running
  // these again would reintroduce pre-terminal Projects registration and
  // post-acceptance tunnel/source side effects.
  if (shouldRunLegacyDeployCompletionGuard({
    stepId: step.step_id,
    protocol: completionAuthority?.envelope.protocol,
  }) && parsed["status"]?.toLowerCase() === "done") {
    const port = context["port"] || parsed["port"] || "";
    const serviceName = context["service_name"] || parsed["service_name"] || "";
    let deployErr = "";

    // Health check: curl
    if (port) {
      try {
        execFileSync("curl", ["-sf", "--max-time", "5", `http://127.0.0.1:${port}/`],
          { timeout: 10_000, stdio: "pipe" });
      } catch {
        deployErr = `GUARDRAIL: Deploy health check failed — service not responding on port ${port}`;
      }
    }

    // Service check: systemctl
    if (!deployErr && serviceName) {
      try {
        const isActive = execFileSync("systemctl", ["--user", "is-active", serviceName],
          { timeout: 5_000, stdio: "pipe" }).toString().trim();
        if (isActive !== "active") {
          deployErr = `GUARDRAIL: Service ${serviceName} is ${isActive}, not active`;
        }
      } catch {
        deployErr = `GUARDRAIL: Service ${serviceName} not found or inactive`;
      }
    }

    if (deployErr) {
      logger.warn(`[deploy-guardrail] ${deployErr}`, { runId: step.run_id, stepId: step.step_id });
      await restoreCompletionContext();
      await failStep(stepId, deployErr, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }

    // MC registration guardrail: verify project is registered in Mission Control
    const deployType = parsed["deploy_type"] || "";
    if (!deployType || deployType === "new-web" || deployType === "new-mobile" || deployType === "update") {
      const projectName = context["run_slug"] || (context["repo"] ? path.basename(context["repo"]) : "");
      if (projectName) {
        try {
          const mcCheck = execFileSync("curl", ["-sf", "--max-time", "5", missionControlApi(`/api/projects/${projectName}`)],
            { timeout: 10_000, stdio: "pipe" }).toString().trim();
          const mcData = JSON.parse(mcCheck);
          if (!mcData.id) {
            deployErr = `GUARDRAIL: Project "${projectName}" not found in Mission Control after deploy. MC registration failed.`;
          } else {
            const expectedDomain = `${projectName}.setrox.com.tr`;
            const canonicalDomain = normalizeMissionControlHostname(mcData.domain || parsed["deploy_url"] || expectedDomain, projectName);
            const rawDisplayName = mcData.displayName || mcData.display_name || context["project_display_name"] || context["project_name"] || projectName;
            const canonicalDisplayName = humanizeProjectDisplayName(rawDisplayName);
            const canonicalSummary = normalizeMissionControlSummary(mcData.summary || "", canonicalDisplayName);
            const needsPatch =
              mcData.domain !== canonicalDomain ||
              !mcData.displayName ||
              mcData.displayName === projectName ||
              mcData.displayName === mcData.name ||
              mcData.displayName !== canonicalDisplayName ||
              mcData.summary !== canonicalSummary;

            if (needsPatch) {
              const patchBody = JSON.stringify({
                displayName: canonicalDisplayName,
                summary: canonicalSummary,
                domain: canonicalDomain,
              });
              execFileSync("curl", [
                "-sf",
                "--max-time",
                "5",
                "-X",
                "PATCH",
                missionControlApi(`/api/projects/${projectName}`),
                "-H",
                "Content-Type: application/json",
                "-d",
                patchBody,
              ], { timeout: 10_000, stdio: "pipe" });

              const patchedRaw = execFileSync("curl", ["-sf", "--max-time", "5", missionControlApi(`/api/projects/${projectName}`)],
                { timeout: 10_000, stdio: "pipe" }).toString().trim();
              const patched = JSON.parse(patchedRaw);
              if (patched.domain !== canonicalDomain) {
                deployErr = `GUARDRAIL: Mission Control domain normalization failed for "${projectName}" (expected ${canonicalDomain}, got ${patched.domain || "empty"}).`;
              }
            }
            logger.info(`[deploy-guardrail] MC registration verified: ${projectName}`, { runId: step.run_id });
          }
        } catch {
          deployErr = `GUARDRAIL: Project "${projectName}" not found in Mission Control. Deploy must register the project.`;
        }
        if (deployErr) {
          logger.warn(`[deploy-guardrail] ${deployErr}`, { runId: step.run_id, stepId: step.step_id });
          await restoreCompletionContext();
          await failStep(stepId, deployErr, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }
      }
    }

    // ISSUE-3 FIX: Verify main branch has source code (package.json)
    // If feature→main merge (Issue 2 guardrail) worked, main should have all source.
    // This is a safety check — warns but doesn't block deploy.
    const deployRepoPath = context["repo"] || "";
    if (deployRepoPath) {
      try {
        const mainHasPackageJson = execFileSync("git", ["show", "main:package.json"], {
          cwd: deployRepoPath, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
        }).toString().trim();
        if (!mainHasPackageJson) {
          logger.warn(`[deploy-guardrail] main branch missing package.json — source may not be merged`, { runId: step.run_id });
        } else {
          logger.info(`[deploy-guardrail] main branch source verification passed (package.json exists)`, { runId: step.run_id });
        }
      } catch {
        logger.warn(`[deploy-guardrail] main branch source verification failed — package.json not found on main`, { runId: step.run_id });
      }
    }

    // Tunnel + DNS auto-create: ensure Cloudflare tunnel entry + DNS CNAME exist
    const deployProjectName = context["run_slug"] || (context["repo"] ? path.basename(context["repo"]) : "");
    if (deployProjectName && port) {
      const hostname = `${deployProjectName}.setrox.com.tr`;
      let tunnelOk = false;
      // Try sudo first, then non-sudo fallback
      for (const cmd of [["sudo", "bash"], ["bash"]]) {
        if (tunnelOk) break;
        try {
          execFileSync(cmd[0], [...cmd.slice(1), path.join(os.homedir(), ".openclaw/scripts/tunnel-add.sh"), hostname, String(port)], {
            timeout: 30000, stdio: "pipe",
          });
          tunnelOk = true;
          logger.info(`[deploy-guardrail] Tunnel + DNS ensured for ${hostname}:${port}`, { runId: step.run_id });
        } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      }
      if (!tunnelOk) {
        logger.warn(`[deploy-guardrail] Tunnel/DNS setup failed for ${hostname}`, { runId: step.run_id });
      }
    }
  }

  // SCREEN_MAP Enforcement (design step) — design owns screen identification
  // v12.0: design step SCREEN_MAP no longer requires stories field (stories step adds it later)
  logger.info(`[completeStep] step_id=${step.step_id} status=${parsed["status"]} has_screen_map=${!!context["screen_map"]}`, { runId: step.run_id });
  if (step.step_id === "design" && parsed["status"]?.toLowerCase() === "done") {
    if (String(context["design_required"] || parsed["design_required"] || "true").toLowerCase() === "false") {
      logger.info("[screen-map-guardrail] Skipped because DESIGN_REQUIRED=false", { runId: step.run_id });
    } else {
    logger.info(`[screen-map-guardrail] Entering design step guardrail check`, { runId: step.run_id });
    let screenMapErr: string | null = null;
    const screenMapRaw = context["screen_map"];
    if (!screenMapRaw || !screenMapRaw.trim()) {
      screenMapErr = "GUARDRAIL: SCREEN_MAP is required. Design assets were not generated; retry design generation before implementation.";
    } else {
      try {
        const sm = JSON.parse(screenMapRaw);
        if (!Array.isArray(sm) || sm.length === 0) {
          screenMapErr = "GUARDRAIL: SCREEN_MAP is empty array. Design must identify unique screens. Retry with valid SCREEN_MAP.";
        } else {
          for (const scr of sm) {
            if (!scr.screenId || !scr.name) {
              screenMapErr = "GUARDRAIL: SCREEN_MAP entries must have screenId and name. Fix SCREEN_MAP format.";
              break;
            }
          }
          const prdSurfaces = parsePrdDesignSurfaces(context["prd"] || context["PRD"] || "");
          if (!screenMapErr && prdSurfaces.length > 0) {
            const covered = new Set<string>();
            for (const scr of sm) {
              if (Array.isArray(scr.surfaceIds)) {
                for (const id of scr.surfaceIds) covered.add(String(id));
              }
            }
            const missing = prdSurfaces.filter((surface) => !covered.has(surface.surfaceId));
            if (missing.length > 0) {
              screenMapErr = `GUARDRAIL: SCREEN_MAP is missing Product Surface coverage: ${missing.map(s => s.surfaceId).slice(0, 8).join(", ")}.`;
            }
          }
          if (!screenMapErr && String(context["design_required"] || "true").toLowerCase() !== "false" && sm.length < 1) {
            screenMapErr = "GUARDRAIL: SCREEN_MAP is empty. Design must identify Stitch screens mapped to Product Surfaces.";
          }
        }
      } catch {
        screenMapErr = "GUARDRAIL: SCREEN_MAP is not valid JSON. Fix SCREEN_MAP format.";
      }
    }
    if (screenMapErr) {
      logger.warn(`[screen-map-guardrail] SCREEN_MAP validation failed: ${screenMapErr}`, { runId: step.run_id, stepId: step.step_id });
      await failStep(stepId, screenMapErr, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
    }
  }

  // Browser DOM Gate (implement step — advisory)
  // Use story_workdir for implement — story code lives in worktree, not main repo.
  if (!isNativeV3ImplementCompletion && step.step_id === "implement" && parsed["status"]?.toLowerCase() === "done") {
    const browserCtx = context["story_workdir"]
      ? { ...context, repo: context["story_workdir"] }
      : context;
    processBrowserCheck(browserCtx, step.run_id, step.step_id);
  }

  // Design Fidelity Check (verify + final-test steps — BLOCKING on structural/wiring errors)
  if ((step.step_id === "verify" || step.step_id === "final-test") && parsed["status"]?.toLowerCase() === "done") {
    const fidelityErr = await processDesignFidelityCheck(context, step.run_id);
    if (fidelityErr) {
      logger.warn(`[design-fidelity-gate] Blocking: ${fidelityErr}`, { runId: step.run_id, stepId: step.step_id });
      await restoreCompletionContext();
      await failStep(stepId, fidelityErr, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
  }

  // Import Consistency Check (verify + final-test — BLOCKING on duplicate dirs/imports)
  if ((step.step_id === "verify" || step.step_id === "final-test") && parsed["status"]?.toLowerCase() === "done") {
    const repoPath = context["repo"] || context["REPO"] || "";
    if (repoPath) {
      const importErr = checkImportConsistency(repoPath);
      if (importErr) {
        logger.warn(`[import-consistency-gate] Blocking: ${importErr}`, { runId: step.run_id, stepId: step.step_id });
        await restoreCompletionContext();
        await failStep(stepId, importErr, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }
  }

  // SMOKE TEST GUARDRAIL (final-test): run the platform smoke test ourselves.
  // Agent-reported smoke output is useful context, but the gate must not trust
  // the model for runtime checks such as dead buttons, blank pages, and console
  // failures. This keeps final-test deterministic even when the tester skips or
  // misreports the smoke script.
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    let smokeResult = parsed["smoke_test_result"] || "";
    const repoPath = context["repo"] || "";
    const smokeScript = resolvePlatformScript("smoke-test.mjs");
    const stackContract = resolveOperationalStackContract(context, false);
    if (!isBrowserRuntimeStack(stackContract)) {
      context["smoke_test_result"] = smokeResult || `stack-specific final evidence required for ${stackContract.packId || "unknown stack"}; browser smoke skipped`;
      await recordGateObservation({
        runId: step.run_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        checkId: "final-system-smoke",
        label: "Final system smoke",
        status: "info",
        summary: "Browser final smoke skipped for non-browser stack",
        detail: context["smoke_test_result"],
        metadata: stackEvidenceMetadata(stackContract),
      });
      await persistCompletionContext();
    } else {
    let smokeFailure = "";
    if (repoPath && fs.existsSync(smokeScript)) {
      try {
        let isPrEachFinal = false;
        try {
          const loopRow = await pgGet<{ loop_config?: any }>(
            "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND loop_config IS NOT NULL LIMIT 1",
            [step.run_id]
          );
          const loopConfigRaw = loopRow?.loop_config;
          const loopConfig = typeof loopConfigRaw === "string" ? JSON.parse(loopConfigRaw || "{}") : (loopConfigRaw || {});
          isPrEachFinal = loopConfig?.mergeStrategy === "pr-each" || !!loopConfig?.verifyEach;
        } catch (loopErr) {
          logger.warn(`[final-test-smoke-gate] loop_config lookup failed: ${String(loopErr).slice(0, 160)}`, { runId: step.run_id });
        }

        if (isPrEachFinal) {
          try {
            execFileSync("git", ["checkout", "main"], { cwd: repoPath, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
            execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: repoPath, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
          } catch (syncErr) {
            logger.warn(`[final-test-smoke-gate] main sync before smoke failed: ${String(syncErr).slice(0, 200)}`, { runId: step.run_id });
          }
        }

        const smokePort = context["preview_port"] || context["dev_server_port"] || "";
        const smokeArgs = [smokeScript, repoPath, ...(smokePort ? ["--port", smokePort] : [])];
        logger.info(`[final-test-smoke-gate] Running smoke-test.mjs as system gate on port ${smokePort || "auto"}`, { runId: step.run_id, stepId: step.step_id });
        const smokeOut = execFileSync("node", smokeArgs, {
          timeout: 240000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            ...(smokePort ? {
              DEV_SERVER_PORT: smokePort,
              PREVIEW_PORT: smokePort,
              PORT: smokePort,
              DEV_SERVER_URL: context["dev_server_url"] || `http://127.0.0.1:${smokePort}`,
              QA_URL: context["qa_url"] || context["dev_server_url"] || `http://127.0.0.1:${smokePort}`,
            } : {}),
          },
        });
        smokeResult = (smokeOut || "").trim().slice(-2000) || "pass (system smoke gate)";
        parsed["smoke_test_result"] = smokeResult;
        logger.info(`[final-test-smoke-gate] smoke-test passed`, { runId: step.run_id });
      } catch (smokeErr: any) {
        smokeFailure = String(smokeErr?.stdout || smokeErr?.stderr || smokeErr?.message || smokeErr).slice(0, 2000);
        smokeResult = smokeResult || smokeFailure;
        parsed["smoke_test_result"] = smokeResult;
        logger.warn(`[final-test-smoke-gate] smoke-test failed: ${smokeFailure.slice(0, 200)}`, { runId: step.run_id });
      }
    }
    if (smokeFailure) {
      if (
        isV3DownstreamCompletion
        && await routeQualityFailureToImplement(step, `SYSTEM_SMOKE_FAILURE:\n${smokeFailure}`, context, completionAuthority?.envelope)
      ) {
        return { advanced: false, runCompleted: false };
      }
      if (isSmokeInfrastructureFailure(smokeFailure)) {
        logger.warn(`[final-test-smoke-gate] smoke infra failure; retrying final-test instead of creating QA-FIX: ${smokeFailure.slice(0, 200)}`, { runId: step.run_id });
        await restoreCompletionContext();
        await failStep(stepId, `INFRA: final-test smoke browser infrastructure failed; retry final-test, do not modify app code.\n${smokeFailure}`, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
      if (await routeQualityFailureToImplement(step, `SYSTEM_SMOKE_FAILURE:\n${smokeFailure}`, context, completionAuthority?.envelope)) {
        return { advanced: false, runCompleted: false };
      }
      await restoreCompletionContext();
      await failStep(stepId, `GUARDRAIL: final-test system smoke test failed. Fix runtime issues and retry.\n${smokeFailure}`, completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
    if (!smokeResult) {
      logger.warn(`[final-test-guardrail] SMOKE_TEST_RESULT missing from final-test output — agent likely skipped smoke test. Retrying.`, { runId: step.run_id, stepId: step.step_id });
      await restoreCompletionContext();
      await failStep(stepId, "GUARDRAIL: final-test completed without SMOKE_TEST_RESULT. You MUST run smoke-test.mjs and include SMOKE_TEST_RESULT in your output.", completionAuthority?.envelope);
      return { advanced: false, runCompleted: false };
    }
    }
  }

  // ISSUE-2 FIX: Pipeline-level feature→main merge guarantee
  // After final-test completes successfully, verify the feature branch is merged into main.
  // Agents sometimes skip or silently fail the merge — this guardrail ensures it happens.
  if (step.step_id === "final-test" && parsed["status"]?.toLowerCase() === "done") {
    const mergeBranch = context["branch"] || "feature/initial-prd";
    const mergeRepo = context["repo"] || "";
    if (mergeRepo && mergeBranch) {
      let isPrEachFinal = false;
      try {
        const loopRow = await pgGet<{ loop_config?: any }>(
          "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND loop_config IS NOT NULL LIMIT 1",
          [step.run_id]
        );
        const loopConfigRaw = loopRow?.loop_config;
        const loopConfig = typeof loopConfigRaw === "string" ? JSON.parse(loopConfigRaw || "{}") : (loopConfigRaw || {});
        isPrEachFinal = loopConfig?.mergeStrategy === "pr-each" || !!loopConfig?.verifyEach;
      } catch (loopErr) {
        logger.warn(`[final-test-merge-guardrail] loop_config lookup failed: ${String(loopErr).slice(0, 160)}`, { runId: step.run_id });
      }

      try {
        if (isPrEachFinal) {
          try {
            execFileSync("git", ["checkout", "main"], { cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
            execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
            logger.info(`[final-test-merge-guardrail] pr-each flow detected; synced main and skipped stale run-branch merge`, { runId: step.run_id });
          } catch (syncErr) {
            logger.warn(`[final-test-merge-guardrail] pr-each main sync failed: ${String(syncErr)}`, { runId: step.run_id });
          }
        } else {
          // Check if an open PR exists for this branch → main
          let prMerged = false;
          try {
            const prUrl = execFileSync("gh", ["pr", "list", "--head", mergeBranch, "--base", "main", "--state", "open", "--json", "url", "--jq", ".[0].url"], {
              cwd: mergeRepo, encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
            }).trim();
            if (prUrl) {
              execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
                cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
              });
              logger.info(`[final-test-merge-guardrail] PR merged via gh: ${prUrl}`, { runId: step.run_id });
              prMerged = true;
            }
          } catch (ghErr) {
            logger.warn(`[final-test-merge-guardrail] gh pr merge attempt failed: ${String(ghErr)}`, { runId: step.run_id });
          }

          // If no open PR was found/merged, try direct git merge
          if (!prMerged) {
            try {
              // Check if branch is already merged into main
              execFileSync("git", ["merge-base", "--is-ancestor", mergeBranch, "main"], {
                cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
              });
              logger.info(`[final-test-merge-guardrail] Branch ${mergeBranch} already merged into main`, { runId: step.run_id });
            } catch {
              // Not yet merged — do direct merge
              try {
                execFileSync("git", ["checkout", "main"], { cwd: mergeRepo, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
                execFileSync("git", ["merge", mergeBranch, "--no-ff", "-m", `Merge ${mergeBranch} into main`], { cwd: mergeRepo, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
                execFileSync("git", ["push", "origin", "main"], { cwd: mergeRepo, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
                logger.info(`[final-test-merge-guardrail] Direct merged ${mergeBranch} into main`, { runId: step.run_id });
              } catch (directMergeErr) {
                logger.warn(`[final-test-merge-guardrail] Direct merge failed: ${String(directMergeErr)}`, { runId: step.run_id });
              }
            }
          }
        }
      } catch (mergeErr) {
        logger.warn(`[final-test-merge-guardrail] Merge guardrail failed: ${String(mergeErr)}`, { runId: step.run_id });
      }

      // After all merge attempts, verify main has source code
      let mainHasSource = false;
      mainHasSource = gitRefHasProjectSource(mergeRepo, "main");

      if (!mainHasSource && step.retry_count < step.max_retries) {
        context["previous_failure"] = "MERGE FAIL: Feature branch not merged into main. Main branch has no project source files.";
        context["failure_category"] = "MERGE_CONFLICT";
        context["failure_suggestion"] = isPrEachFinal
          ? "pr-each flow should already have story PRs merged; sync origin/main or inspect missing project source files"
          : "Merge feature branch into main manually or resolve conflicts";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, "Feature branch not merged into main — source code missing", completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }
  }

  await persistCompletionContext();

  // (parseAndInsertStories + 0-stories + scope_files + overlap + hallucinated-path
  //  + multi-owner guardrails moved to 03-stories/guards.ts onComplete — invoked
  //  via step-module delegation block above.)

  // Auto-generate SCREEN_MAP if stories step did not produce one with story mappings (fallback)
  // v12.0: stories step should output SCREEN_MAP with stories field, but if it doesn't, auto-generate
  if (!atomicNativeV3StoriesCompletion
    && step.step_id === "stories"
    && parsed["status"]?.toLowerCase() === "done") {
    const screenMapRaw = context["screen_map"];
    let needsAutoGen = false;
    if (screenMapRaw) {
      try {
        const sm = JSON.parse(screenMapRaw);
        // Check if stories field is populated
        const hasStoryMappings = Array.isArray(sm) && sm.some((s: any) => Array.isArray(s.stories) && s.stories.length > 0);
        if (!hasStoryMappings) needsAutoGen = true;
      } catch (parseErr: any) {
        needsAutoGen = true;
      }
    } else {
      needsAutoGen = true;
    }
    if (needsAutoGen) {
      const hasUi = (context["has_ui"] || "").toLowerCase() === "true" || ["ui", "fullstack"].includes((context["project_type"] || "").toLowerCase());
      if (hasUi) {
        const autoStories = await getStories(step.run_id);
        if (autoStories.length > 0) {
          const screenMap: Array<{screenId: string; name: string; type: string; description: string; stories: string[]}> = [];
          let scrIdx = 1;
          for (const s of autoStories) {
            if (true) { // All stories in UI projects get screen mapping
              screenMap.push({
                screenId: `SCR-${String(scrIdx++).padStart(3, "0")}`,
                name: s.title,
                type: "app-screen",
                description: s.description || s.title,
                stories: [s.storyId],
              });
            }
          }
          if (screenMap.length === 0) {
            screenMap.push({
              screenId: "SCR-001",
              name: "Main Screen",
              type: "app-screen",
              description: "Primary application interface",
              stories: autoStories.map(s => s.storyId),
            });
          }
          context["screen_map"] = JSON.stringify(screenMap);
          await persistCompletionContext();
          logger.info(`[screen-map-guardrail] Auto-generated SCREEN_MAP with ${screenMap.length} screen(s) from ${autoStories.length} stories (stories step fallback)`, { runId: step.run_id });
        }
      }
    }
  }

  // #157 GUARD: If the IMMEDIATELY NEXT step is a loop, verify stories exist.
  // v12.0: Only fire if no non-loop steps remain between current and next loop step,
  // because intermediate steps (e.g. stories, setup) may produce STORIES_JSON later.
  const nextLoopStep = await pgGet<{ id: string; step_id: string; step_index: number }>("SELECT id, step_id, step_index FROM steps WHERE run_id = $1 AND type = 'loop' AND step_index > $2 AND status = 'waiting' ORDER BY step_index ASC LIMIT 1", [step.run_id, step.step_index]);
  if (nextLoopStep) {
    // Check if there are any non-loop steps between us and the next loop step
    const intermediateSteps = await pgGet<{ cnt: number }>("SELECT COUNT(*) as cnt FROM steps WHERE run_id = $1 AND step_index > $2 AND step_index < $3 AND type != 'loop' AND status IN ('waiting', 'pending')", [step.run_id, step.step_index, nextLoopStep.step_index]);
    if ((intermediateSteps?.cnt ?? 0) === 0) {
      // No intermediate steps — this is the last step before the loop
      const storyCount = {
        cnt: atomicNativeV3StoriesCompletion
          ? preparedV3StoriesCompletion?.storyCount ?? 0
          : await countAllStories(step.run_id),
      };
      if (storyCount.cnt === 0) {
        const noStoriesMsg = "Step completed but produced no STORIES_JSON — downstream loop would run with 0 stories";
        logger.warn(noStoriesMsg, { runId: step.run_id, stepId: step.step_id });
        await pgBegin(async (sql) => {
          if (completionAuthority?.envelope) {
            await closeExactSingleStepClaimInTransaction(sql, {
              envelope: completionAuthority.envelope,
              outcome: "failed",
              diagnostic: noStoriesMsg,
            });
          } else {
            await closeUniqueSingleStepClaimForRecoveryInTransaction(sql, {
              runId: step.run_id,
              stepDbId: step.id,
              workflowStepId: step.step_id,
              outcome: "failed",
              diagnostic: noStoriesMsg,
              runtimeAgentId: "stories-completeness-terminal-owner",
            });
          }
          const failedStep = await sql.unsafe<Array<{ id: string }>>(
            `UPDATE steps
                SET status = 'failed', output = $2, updated_at = NOW()
              WHERE id = $1 AND status IN ('running', 'pending')
              RETURNING id`,
            [step.id, noStoriesMsg],
          );
          if (failedStep.length !== 1) throw new Error("STORIES_COMPLETENESS_STEP_CAS_LOST");
          await requestRunTerminationInTransaction(sql, {
            runId: step.run_id,
            targetStatus: "failed",
            requestedBy: "setfarm.step-ops.stories-completeness",
            diagnostic: noStoriesMsg,
            ...(runProtocol?.protocol === "v3" ? {
              failureCause: {
                schema: "setfarm.operational-failure-cause.v1" as const,
                workflowStepId: step.step_id,
                boundary: "story_plan.completeness",
                failureClass: "contract_invalid",
                failureCode: "STORIES_REQUIRED_OUTPUT_MISSING",
              },
            } : {}),
            evidence: { source: "completeStep.stories-completeness" },
          });
        });
        const wfId157b = await getWorkflowId(step.run_id);
        emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId157b, stepId: step.step_id, detail: noStoriesMsg });
        emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId157b, detail: noStoriesMsg });
        scheduleRunCronTeardown(step.run_id);
        return { advanced: false, runCompleted: false };
      }
    } else {
      logger.info(`[stories-guard] Skipped — ${intermediateSteps?.cnt} step(s) remain before loop step ${nextLoopStep.step_id}`, { runId: step.run_id, stepId: step.step_id });
    }
  }

  // T7: Loop step completion
  // RACE CONDITION GUARD: If loop step but current_story_id is NULL,
  // another parallel agent cleared it. Do NOT fall through to single-step
  // completion — that would prematurely end the loop while stories remain.
  if (step.type === "loop" && !step.current_story_id) {
    logger.warn(`Loop step complete called with no current_story_id — parallel race condition, ignoring`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  if (step.type === "loop" && step.current_story_id) {
    // Wave 14 Bug L: stale claim guard. If story was re-claimed (timeout + re-claim),
    // the original agent may still report done with the old claim_generation. Reject it.
    const agentGen = parseInt(parsed["claim_generation"] || context["claim_generation"] || "0", 10);
    const dbGenRow = await pgGet<{ claim_generation: number }>("SELECT claim_generation FROM stories WHERE id = $1", [step.current_story_id]);
    const dbGen = dbGenRow?.claim_generation ?? 0;
    if (agentGen > 0 && dbGen > 0 && agentGen < dbGen) {
      logger.warn(`[stale-claim] Agent reported claim_generation=${agentGen}, DB has ${dbGen} — rejecting stale output`, { runId: step.run_id, stepId: step.step_id });
      return { advanced: false, runCompleted: false };
    }

    // Look up story info for event
    const storyRow = await getStoryInfo(step.current_story_id);

    // v9.0: Check agent STATUS — skip, fail/error (defense-in-depth), or done
    // Wave 13+ hotfix: parseOutputKeyValues can leak trailing lines into the
    // STATUS value when agent output lacks blank separators. Run #352 US-003:
    // parsed["status"] = "done\nstepId: ..." instead of just "done".
    // Fix: trim and extract only the first word from the status value.
    const rawStatus = (parsed["status"] || "").trim();
    const statusVal = (rawStatus.indexOf("\n") >= 0 ? rawStatus.slice(0, rawStatus.indexOf("\n")).trim() : rawStatus).split(/\s/)[0].toLowerCase() || undefined;
    let storyStatus: string, storyEvent: string;
    if (statusVal === "fail" || statusVal === "failed" || statusVal === "error") {
      storyStatus = STORY_STATUS.FAILED; storyEvent = "story.failed";
    } else if (statusVal === "skip") {
      storyStatus = STORY_STATUS.SKIPPED; storyEvent = "story.skipped";
    } else {
      storyStatus = STORY_STATUS.DONE; storyEvent = "story.done";
    }

    // PHASED DEVELOPMENT — opt-in via loop config `phases: true`
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && step.loop_config) {
      try {
        const lc = JSON.parse(step.loop_config);
        if (lc.phases) {
          const currentPhase = context["implement_phase"] || "foundation";
          const phases = ["foundation", "core", "ui"];
          const phaseIdx = phases.indexOf(currentPhase);

          if (phaseIdx < phases.length - 1) {
            // Check phase gate
            const { checkPhaseGate } = await import("./step-guardrails.js");
            const workdir = context["story_workdir"] || context["repo"] || "";
            const gateResult = checkPhaseGate(workdir, currentPhase);

            if (gateResult && step.retry_count < step.max_retries) {
              // Phase gate failed — retry with fix instructions
              context["previous_failure"] = `PHASE GATE (${currentPhase}): ${gateResult}`;
              context["failure_category"] = "GUARDRAIL_FAIL";
              await persistCompletionContext();
              await failStep(stepId, gateResult, completionAuthority?.envelope);
              logger.info(`[phased-dev] Phase gate failed for ${currentPhase}, retrying`, { runId: step.run_id });
              return { advanced: false, runCompleted: false };
            }

            // Phase passed — advance to next phase
            const nextPhase = phases[phaseIdx + 1];
            context["implement_phase"] = nextPhase;
            context["previous_failure"] = "";
            if (completionAuthority?.envelope) {
              if (completionOwnedContextJson === undefined) {
                throw new Error("STEP_COMPLETION_PRIOR_RUN_CONTEXT_REQUIRED");
              }
              const workdir = context["story_workdir"] || context["repo"] || "";
              const sourceAfter = completionAuthority.envelope.protocol !== "legacy"
                ? await captureShadowSourceRevision(workdir)
                : undefined;
              await completeStoryClaimAndBoundAttempt(getSql(), {
                envelope: completionAuthority.envelope,
                ...(sourceAfter ? { sourceAfter } : {}),
                outputHash: crypto.createHash("sha256").update(output, "utf8").digest("hex"),
                evidenceRefs: [`setfarm://implement-phase/${currentPhase}`],
                storyStatus: "pending",
                storyOutput: output,
                storyBranch: context["story_branch"] || "",
                stepStatus: "pending",
                stepOutput: output,
                runContextJson: JSON.stringify(context),
                expectedRunContextJson: completionOwnedContextJson,
                diagnostic: `Implement phase ${currentPhase} completed; next phase ${nextPhase}`,
              });
            } else {
              // Compatibility path for legacy workers that predate claim
              // envelopes. Close their claim before publishing retryable state.
              if (completionOwnedContextJson === undefined) {
                throw new Error("STEP_COMPLETION_PRIOR_RUN_CONTEXT_REQUIRED");
              }
              const expectedContextJson = completionOwnedContextJson;
              const nextContextJson = JSON.stringify(context);
              await pgBegin(async (sql) => {
                await closeLegacyClaimOwnersInTransaction(sql, {
                  runId: step.run_id,
                  workflowStepId: step.step_id,
                  storyId: storyRow?.story_id || "",
                  diagnostic: `Implement phase ${currentPhase} completed`,
                });
                const updatedContext = await sql.unsafe<Array<{ id: string }>>(
                  `UPDATE runs
                      SET context = $1, updated_at = $2
                    WHERE id = $3
                      AND context = $4
                    RETURNING id`,
                  [nextContextJson, now(), step.run_id, expectedContextJson],
                );
                if (updatedContext.length !== 1) throw new Error("STEP_COMPLETION_RUN_CONTEXT_CAS_LOST");
                await sql`UPDATE stories SET status = 'pending', output = ${output}, claimed_by = NULL, claimed_at = NULL, updated_at = ${now()} WHERE id = ${step.current_story_id}`;
                await sql`UPDATE steps SET status = 'pending', current_story_id = NULL, output = ${output}, updated_at = ${now()} WHERE id = ${step.id}`;
              });
              completionOwnedContextJson = nextContextJson;
            }

            logger.info(`[phased-dev] Phase ${currentPhase} complete, advancing to ${nextPhase}`, { runId: step.run_id });
            return { advanced: false, runCompleted: false };
          }
          // Final phase (ui) — fall through to normal completion
        }
      } catch (e) {
        if (e instanceof Error && [
          "STEP_COMPLETION_RUN_CONTEXT_CAS_LOST",
          "STORY_COMPLETION_RUN_CONTEXT_CAS_LOST",
        ].includes(e.message)) throw e;
        logger.warn(`[phased-dev] Skipped: ${String(e)}`, { runId: step.run_id });
      }
    }

    // Design compliance check — only for implement step, done stories
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && completionAuthority?.protocol !== "v3") {
      const designIssue = checkStoryDesignCompliance(context);
      const isCriticalDesignIssue = !!designIssue && /CRITICAL DESIGN CONTRACT/i.test(designIssue);
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow?.story_id || "",
        agentId: step.agent_id || "",
        checkId: "implement.design_compliance",
        label: "Design compliance check",
        status: designIssue && (isCriticalDesignIssue || step.retry_count >= 2) ? "fail" : designIssue ? "info" : "pass",
        summary: designIssue ? "Design issue detected" : "Design compliance passed",
        detail: designIssue || "",
        metadata: { critical: isCriticalDesignIssue, retryCount: step.retry_count },
      });
      if (designIssue && (isCriticalDesignIssue || step.retry_count >= 2) && step.retry_count < step.max_retries) {
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} failed design check — soft retry`, { runId: step.run_id });
        const { classifyError: _ce3 } = await import("./error-taxonomy.js");
        const _cl3 = _ce3(designIssue);
        context["previous_failure"] = `DESIGN COMPLIANCE: ${designIssue}`;
        context["failure_category"] = _cl3.category;
        context["failure_suggestion"] = _cl3.suggestion;
        await persistCompletionContext();
        await failStep(stepId, designIssue, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      } else if (designIssue && step.retry_count < 2) {
        // First 1-2 attempts: warn only (advisory), let story pass
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} design issues (advisory, retry ${step.retry_count}): ${designIssue}`, { runId: step.run_id });
      } else if (designIssue) {
        // Max retries — log warning but let story pass (advisory)
        logger.warn(`[design-compliance] Story ${storyRow?.story_id} design issues (max retries reached, advisory): ${designIssue}`, { runId: step.run_id });
      }
    }

    // TEST RUNNER — run project tests on implement story completion
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && completionAuthority?.protocol !== "v3") {
      try {
        const { detectTestFramework, runTests, buildTestFixPrompt } = await import("./test-generation.js");
        const testRepo = context["story_workdir"] || context["repo"] || "";
        if (testRepo) {
          const framework = detectTestFramework(testRepo);
          if (framework.runner !== "none") {
            const testResult = runTests(testRepo, framework);
            await recordLiveObservation({
              runId: step.run_id,
              stepId: step.step_id,
              storyId: storyRow?.story_id || "",
              agentId: step.agent_id || "",
              checkId: "implement.advisory_test_runner",
              label: "Advisory test runner",
              status: testResult.passed ? "pass" : "info",
              summary: testResult.passed ? `${framework.runner} tests passed` : `${testResult.failedTests} advisory test failure(s)`,
              detail: testResult.rawOutput || testResult.errorSummary || "",
              metadata: { runner: framework.runner, failedTests: testResult.failedTests },
            });
            if (!testResult.passed) {
              // Full-suite failures stay advisory to avoid unrelated legacy/flaky
              // tests trapping an isolated story. The implement guard below blocks
              // the narrower case we care about: a story that touched/added tests
              // and then reported done while those tests fail.
              logger.warn(`[test-runner] ${testResult.failedTests} test(s) failed for story ${storyRow?.story_id} (advisory, not blocking)`, { runId: step.run_id });
              context["test_warnings"] = `${testResult.failedTests} test(s) failed — see verify step review`;
              await updateRunContext(step.run_id, context);
            }
          }
        }
      } catch (e) {
        logger.warn(`[test-runner] Skipped: ${String(e)}`, { runId: step.run_id });
      }
    }

    // SCOPE ENFORCEMENT — delegated to 06-implement/guards.ts
    // (Wave 6 fix A, Wave 10 Bug D, Wave 13 Bug P9, Wave 14 Bug Q)
    let implementSupervisorWorkdir = "";
    let implementSupervisorBaseRef = "";
    const isNativeV3Completion = completionAuthority?.protocol === "v3";
    let v3CompletionContext: V3ImplementationAttemptResult | undefined = nativeV3AttemptContext;
    let v3CandidateSource: Awaited<ReturnType<typeof captureShadowSourceRevision>> | undefined;
    let v3EvidenceRefs: string[] = [];
    let v3EvidenceBundle: EvidenceBundleV2 | undefined;
    let v3FindingSet: FindingSetV1 | undefined;
    let v3FailureClass: "product" | "infrastructure" | undefined;
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && storyRow?.story_id) {
      try {
        const {
          resolveStoryWorktree,
          checkScopeFilesGate,
          checkScopeEnforcement,
          checkBuildGate,
          checkTestGate,
          checkRuntimeBridgeGate,
          checkQaFixSmokeGate,
          checkImplementEvidenceGate,
          checkGeneratedScreenIntegrationGate,
          checkGeneratedScreenRegressionGate,
          checkGeneratedScreenRequiredPropsGate,
          checkGeneratedRuntimeSemanticGate,
          checkPlatformHelperContaminationGate,
          checkGeneratedScreenShellChromeGate,
          checkDesignDomImplementationGate,
        } = await import("./steps/06-implement/guards.js");
        const wd = await resolveStoryWorktree(step.current_story_id, context["story_workdir"] || "");
        const scopeLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
        const baseBr = context["story_base_ref"] || ((scopeLoopConfig?.mergeStrategy === "pr-each" || scopeLoopConfig?.verifyEach) ? "main" : (context["branch"] || ""));
        implementSupervisorWorkdir = wd || "";
        implementSupervisorBaseRef = baseBr || "";
        if (isNativeV3Completion) {
          const attemptId = completionAuthority?.envelope.attempt?.attemptId;
          if (!attemptId) throw new Error("V3_COMPLETION_ATTEMPT_FENCE_REQUIRED");
          v3CompletionContext ??= await loadV3ImplementationAttemptContext({
            runId: step.run_id,
            storyId: storyRow.story_id,
            attemptId,
          });
          if (path.resolve(v3CompletionContext.attempt.worktree || "") !== path.resolve(wd || "")) {
            throw new Error("V3_COMPLETION_WORKTREE_IDENTITY_MISMATCH");
          }
        }

        // 2026-04-22: setup stories also go through scope checks. Broad
        // configuration files are already covered by SCOPE_IGNORE, so setup
        // can still initialize the project without bypassing ownership checks.
        if (wd && baseBr && fs.existsSync(wd)) {
          // Scope files existence gate (declared files must exist in worktree)
          if (!isNativeV3Completion && step.retry_count < step.max_retries) {
            const sfGate = await checkScopeFilesGate(storyRow.story_id, step.current_story_id, storyRow.title, wd);
            await recordImplementGateObservation(step, storyRow, "implement.scope_files", "Scope files gate", sfGate);
            if (!sfGate.passed) {
              context["previous_failure"] = sfGate.reason!;
              context["failure_category"] = sfGate.category!;
              context["failure_suggestion"] = sfGate.suggestion!;
              await updateRunContext(step.run_id, context);
              await failStep(stepId, sfGate.reason!, completionAuthority?.envelope);
              return { advanced: false, runCompleted: false };
            }
          }

          // Zero-work, stub, scope bleed, scope overflow checks
          let scopeResult: Awaited<ReturnType<typeof checkScopeEnforcement>> = isNativeV3Completion
            ? { passed: true, reason: "V3 scope is enforced by the sealed slice and strict platform candidate commit." }
            : await checkScopeEnforcement(
                storyRow.story_id, step.current_story_id, storyRow.title,
                wd, baseBr, step.retry_count, step.max_retries,
              );
          if (!scopeResult.passed && scopeResult.category === "NO_WORK_DETECTED") {
            const integration = await storyAlreadyIntegratedInBase({
              runId: step.run_id,
              storyDbId: step.current_story_id,
              storyId: storyRow.story_id,
              workdir: wd,
              baseBranch: baseBr,
            });
            if (integration.integrated) {
              scopeResult = {
                passed: true,
                reason: `NO_WORK_ALREADY_INTEGRATED: ${integration.detail} Treating this retry as idempotent completion instead of consuming another story retry.`,
                category: "NO_WORK_ALREADY_INTEGRATED",
                suggestion: "Continue normal build/smoke/PR verification; do not spawn another implement retry for an already integrated story.",
              };
            }
          }
          await recordImplementGateObservation(step, storyRow, "implement.scope_enforcement", "Scope enforcement gate", scopeResult);
          if (!scopeResult.passed && scopeResult.category) {
            if (scopeResult.category === "SCOPE_BLEED" && scopeResult.outOfScope && scopeResult.outOfScope.length > 0 && wd && baseBr) {
              // Clean the branch before retry so the next attempt does not inherit
              // the bad files, but still fail the story. Treating SCOPE_BLEED as
              // advisory lets agents learn the wrong ownership boundary and hides
              // cross-story collisions until later merge/verify stages.
              try {
                const outOfScopeFiles = scopeResult.outOfScope;
                await recordLiveObservation({
                  runId: step.run_id,
                  stepId: step.step_id,
                  storyId: storyRow.story_id,
                  agentId: step.agent_id || "",
                  checkId: "implement.scope_bleed_cleanup",
                  label: "Scope bleed cleanup",
                  status: "running",
                  summary: `Reverting ${outOfScopeFiles.length} out-of-scope file(s)`,
                  detail: outOfScopeFiles.join("\n"),
                  filePaths: outOfScopeFiles,
                });
                const filesToStage = new Set<string>();
                const filesToRemove = new Set<string>();
                for (const file of outOfScopeFiles) {
                  const absFile = path.join(wd, file);
                  try {
                    execFileSync("git", ["checkout", baseBr, "--", file], {
                      cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                    });
                    filesToStage.add(file);
                  } catch (checkoutErr) {
                    fs.rmSync(absFile, { recursive: true, force: true });
                    filesToRemove.add(file);
                  }
                }
                try {
                  if (filesToStage.size > 0) {
                    execFileSync("git", ["add", "--", ...filesToStage], {
                      cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                    });
                  }
                  if (filesToRemove.size > 0) {
                    execFileSync("git", ["rm", "-f", "--ignore-unmatch", "--", ...filesToRemove], {
                      cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                    });
                  }
                  const statusOut = execFileSync("git", ["status", "--porcelain", "--", ...outOfScopeFiles], {
                    cwd: wd, timeout: 5000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
                  }).trim();
                  if (statusOut) {
                    execFileSync("git", ["commit", "-m", `chore: revert out-of-scope files for ${storyRow.story_id}`], {
                      cwd: wd, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
                      env: {
                        ...process.env,
                        GIT_AUTHOR_NAME: "Moltclaw AI",
                        GIT_AUTHOR_EMAIL: "setrox@moltclaw.local",
                        GIT_COMMITTER_NAME: "Moltclaw AI",
                        GIT_COMMITTER_EMAIL: "setrox@moltclaw.local",
                      },
                    });
                  }
                  context["scope_bleed_cleanup"] = `Reverted ${outOfScopeFiles.length} out-of-scope file(s) before retry: ${outOfScopeFiles.slice(0, 5).join(", ")}`;
                  await recordLiveObservation({
                    runId: step.run_id,
                    stepId: step.step_id,
                    storyId: storyRow.story_id,
                    agentId: step.agent_id || "",
                    checkId: "implement.scope_bleed_cleanup_done",
                    label: "Scope bleed cleanup",
                    status: "pass",
                    summary: `Reverted ${outOfScopeFiles.length} out-of-scope file(s)`,
                    detail: outOfScopeFiles.join("\n"),
                    filePaths: outOfScopeFiles,
                  });
                  logger.warn(`[scope-bleed-cleanup] Reverted ${outOfScopeFiles.length} out-of-scope file(s) in ${storyRow.story_id}: ${outOfScopeFiles.slice(0, 5).join(", ")} — failing story for retry`, { runId: step.run_id });
                } catch (commitErr) {
                  context["scope_bleed_cleanup"] = `Scope bleed cleanup partially applied; commit failed: ${String(commitErr).slice(0, 180)}`;
                  await recordLiveObservation({
                    runId: step.run_id,
                    stepId: step.step_id,
                    storyId: storyRow.story_id,
                    agentId: step.agent_id || "",
                    checkId: "implement.scope_bleed_cleanup_failed",
                    label: "Scope bleed cleanup",
                    status: "fail",
                    summary: "Scope bleed cleanup commit failed",
                    detail: String(commitErr),
                    filePaths: outOfScopeFiles,
                  });
                  logger.warn(`[scope-bleed-cleanup] Cleanup commit failed: ${String(commitErr).slice(0, 200)}`, { runId: step.run_id });
                }
              } catch (cleanupErr) {
                context["scope_bleed_cleanup"] = `Scope bleed cleanup failed: ${String(cleanupErr).slice(0, 180)}`;
                logger.warn(`[scope-bleed-cleanup] Cleanup failed: ${String(cleanupErr).slice(0, 200)}`, { runId: step.run_id });
              }
            }
            const shouldDiscardFailedScopeAttempt =
              scopeResult.category === "RETRY_PATCH_REAPPLIED"
              || scopeResult.category === "NO_WORK_DETECTED"
              || scopeResult.category === "APP_INTEGRATION_SCOPE_REGRESSION"
              || scopeResult.category === "APP_INTEGRATION_PROP_REGRESSION"
              || scopeResult.category === "APP_INTEGRATION_SEMANTIC_REGRESSION"
              || scopeResult.category === "GENERATED_SCREEN_INTEGRATION_REGRESSION";
            if (shouldDiscardFailedScopeAttempt && wd) {
              const discardedFiles = discardDirtyRetryWorktreeState(wd, storyRow.story_id, step.run_id);
              if (discardedFiles.length > 0) {
                context["failed_scope_attempt_cleanup"] = `Discarded ${discardedFiles.length} dirty file(s) after ${scopeResult.category}: ${discardedFiles.slice(0, 8).join(", ")}`;
                await recordLiveObservation({
                  runId: step.run_id,
                  stepId: step.step_id,
                  storyId: storyRow.story_id,
                  agentId: step.agent_id || "",
                  checkId: "implement.failed_scope_attempt_cleanup",
                  label: "Failed scope attempt cleanup",
                  status: "pass",
                  summary: `Discarded ${discardedFiles.length} dirty file(s) after ${scopeResult.category}`,
                  detail: discardedFiles.join("\n"),
                  filePaths: discardedFiles,
                  metadata: { category: scopeResult.category },
                });
              }
            }
            applyRetryFailureContext(context, scopeResult.reason!, scopeResult.category, scopeResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, scopeResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }
          // Soft warning (scope creep flag for verify step)
          if (scopeResult.reason && scopeResult.passed) {
            context["scope_creep_warning"] = scopeResult.reason;
          }

          if (!isNativeV3Completion) {
          // Runtime bridge gate: if a story contract explicitly requires
          // window.app, block "done" output that only documents it or exposes a
          // different ad-hoc bridge such as window.game.
          const bridgeResult = await checkRuntimeBridgeGate(
            storyRow.story_id, step.current_story_id, storyRow.title, wd,
          );
          await recordImplementGateObservation(step, storyRow, "implement.runtime_bridge", "Runtime bridge gate", bridgeResult);
          if (!bridgeResult.passed && bridgeResult.category) {
            applyRetryFailureContext(context, bridgeResult.reason!, bridgeResult.category, bridgeResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, bridgeResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Build gate: prompts ask agents to run local checks, but models can
          // still report done with unresolved TypeScript/module errors. Block
          // story completion here so compile failures retry inside implement
          // instead of leaking forward to verify/QA.
          const buildResult = checkBuildGate(
            storyRow.story_id, storyRow.title,
            wd, step.retry_count, step.max_retries,
          );
          await recordImplementGateObservation(step, storyRow, "implement.build", "Build gate", buildResult);
          if (!buildResult.passed && buildResult.category) {
            applyRetryFailureContext(context, buildResult.reason!, buildResult.category, buildResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, buildResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Test gate: if the story touched/added test files, those tests are
          // part of the story's claimed contract. Do not let failing self-tests
          // leak forward to verify as "done".
          const testResult = checkTestGate(
            storyRow.story_id, storyRow.title,
            wd, baseBr, step.retry_count, step.max_retries,
          );
          await recordImplementGateObservation(step, storyRow, "implement.test", "Test gate", testResult);
          if (!testResult.passed && testResult.category) {
            applyRetryFailureContext(context, testResult.reason!, testResult.category, testResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, testResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Generated-screen integration gate: if a story owns generated
          // screens, the rendered app/router surface must consume those screen
          // components instead of silently keeping custom duplicate UI.
          const generatedScreenResult = await checkGeneratedScreenIntegrationGate(
            storyRow.story_id, step.current_story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.generated_screen_integration", "Generated screen integration gate", generatedScreenResult);
          if (!generatedScreenResult.passed && generatedScreenResult.category) {
            applyRetryFailureContext(context, generatedScreenResult.reason!, generatedScreenResult.category, generatedScreenResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, generatedScreenResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Generated-screen regression gate: later screen stories may need the
          // shared app/router surface, but they must preserve previously
          // verified generated screens instead of replacing them with custom
          // duplicate UI while adding the current story screens.
          const generatedScreenRegressionResult = await checkGeneratedScreenRegressionGate(
            step.run_id, storyRow.story_id, step.current_story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.generated_screen_regression", "Generated screen regression gate", generatedScreenRegressionResult);
          if (!generatedScreenRegressionResult.passed && generatedScreenRegressionResult.category) {
            applyRetryFailureContext(context, generatedScreenRegressionResult.reason!, generatedScreenRegressionResult.category, generatedScreenRegressionResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, generatedScreenRegressionResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Generated-screen shell chrome gate: app shells may expose smoke
          // and status state through window.app, but must not render visible
          // debug/session/status strips around full-screen Stitch surfaces.
          // Those strips caused mobile root overflow in real runs and belong
          // in deterministic test state, not in the visual product chrome.
          const generatedScreenShellChromeResult = checkGeneratedScreenShellChromeGate(
            storyRow.story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.generated_screen_shell_chrome", "Generated screen shell chrome gate", generatedScreenShellChromeResult);
          if (!generatedScreenShellChromeResult.passed && generatedScreenShellChromeResult.category) {
            applyRetryFailureContext(context, generatedScreenShellChromeResult.reason!, generatedScreenShellChromeResult.category, generatedScreenShellChromeResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, generatedScreenShellChromeResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Generated-screen required props gate: generated Stitch components
          // often expose typed runtime inputs. The app/router story must wire
          // those from scoped state/adapters instead of advancing with an
          // unrenderable screen or editing generated source out of scope.
          const generatedScreenPropsResult = checkGeneratedScreenRequiredPropsGate(
            storyRow.story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.generated_screen_required_props", "Generated screen required props gate", generatedScreenPropsResult);
          if (!generatedScreenPropsResult.passed && generatedScreenPropsResult.category) {
            applyRetryFailureContext(context, generatedScreenPropsResult.reason!, generatedScreenPropsResult.category, generatedScreenPropsResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, generatedScreenPropsResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // Generated-screen runtime semantic gate: build/smoke can pass even
          // when the app lies through a hardcoded bridge, collapses multiple
          // nav destinations into one screen, uses generic icon fallbacks, or
          // wires visible actions to shell-only route/panel changes. Block that
          // class of fake completion before verify/QA.
          const generatedRuntimeSemanticResult = checkGeneratedRuntimeSemanticGate(
            storyRow.story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.generated_runtime_semantics", "Generated runtime semantics gate", generatedRuntimeSemanticResult);
          if (!generatedRuntimeSemanticResult.passed && generatedRuntimeSemanticResult.category) {
            applyRetryFailureContext(context, generatedRuntimeSemanticResult.reason!, generatedRuntimeSemanticResult.category, generatedRuntimeSemanticResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, generatedRuntimeSemanticResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }
          }

          // Platform helper contamination gate: generated products must not
          // carry Setfarm scanner/test-harness shims. A platform bug should be
          // fixed in Setfarm and replayed, not patched into product source.
          const platformHelperContaminationResult = checkPlatformHelperContaminationGate(
            storyRow.story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.platform_helper_contamination", "Platform helper contamination gate", platformHelperContaminationResult);
          if (!platformHelperContaminationResult.passed && platformHelperContaminationResult.category) {
            applyRetryFailureContext(context, platformHelperContaminationResult.reason!, platformHelperContaminationResult.category, platformHelperContaminationResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, platformHelperContaminationResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // QA-FIX smoke gate: downstream runtime-fix stories are created from
          // concrete smoke failures. Do not let an agent mark the QA-FIX done
          // while the same platform smoke test still fails on its worktree;
          // otherwise the run burns verify cycles and eventually fails with
          // retry exhaustion instead of giving the developer the exact failing
          // controls to patch.
          if (!isNativeV3Completion) {
            const qaSmokeResult = checkQaFixSmokeGate(storyRow.story_id, storyRow.title, wd);
            await recordImplementGateObservation(step, storyRow, "implement.qa_fix_smoke", "QA-FIX smoke gate", qaSmokeResult);
            if (!qaSmokeResult.passed && qaSmokeResult.category) {
              applyRetryFailureContext(context, qaSmokeResult.reason!, qaSmokeResult.category, qaSmokeResult.suggestion!);
              await updateRunContext(step.run_id, context);
              await failStep(stepId, qaSmokeResult.reason!, completionAuthority?.envelope);
              return { advanced: false, runCompleted: false };
            }
          }

          if (isNativeV3Completion) {
            if (!v3CompletionContext || !completionAuthority?.envelope.attempt) {
              throw new Error("V3_COMPLETION_CONTEXT_REQUIRED_BEFORE_EVIDENCE");
            }
            const declaredWritablePaths = v3CompletionContext.slice.recovery?.allowedPaths
              ?? v3CompletionContext.slice.files
                .filter((file) => file.role === "owned" || file.role === "shared_writable")
                .map((file) => file.path);
            const candidateCommit = commitStoryWorktreeScopeIfNeeded(
              wd,
              storyRow.story_id,
              storyRow.title || "",
              [...declaredWritablePaths],
              v3CompletionContext.recovery ? "fix" : "feat",
              true,
            );
            if (candidateCommit.error) {
              throw new Error(`V3_CANDIDATE_COMMIT_REJECTED:${candidateCommit.error}`);
            }
            v3CandidateSource = await captureShadowSourceRevision(wd);
            if (candidateCommit.committed && candidateCommit.sha !== v3CandidateSource.sha) {
              throw new Error("V3_CANDIDATE_COMMIT_SOURCE_IDENTITY_MISMATCH");
            }
            if (v3CompletionContext.supervisorRetry
              && v3CandidateSource.sha === v3CompletionContext.sourceBefore.sha
              && v3CandidateSource.treeHash === v3CompletionContext.sourceBefore.treeHash) {
              throw new Error("V3_SUPERVISOR_RETRY_SOURCE_DELTA_REQUIRED");
            }
            const { createAttemptRepository } = await import("../execution/attempt-repository.js");
            const candidateAttestation = await createAttemptRepository(getSql()).recordCandidateSource({
              attemptId: completionAuthority.envelope.attempt.attemptId,
              generation: completionAuthority.envelope.attempt.generation,
              fenceToken: completionAuthority.envelope.attempt.fenceToken,
              sourceAfter: v3CandidateSource,
            });
            if (candidateAttestation.status !== "candidate") {
              throw new Error("V3_CANDIDATE_SOURCE_FENCE_LOST");
            }
            await recordLiveObservation({
              runId: step.run_id,
              stepId: step.step_id,
              storyId: storyRow.story_id,
              agentId: step.agent_id || "",
              checkId: "implement.v3_candidate_attested",
              label: "V3 candidate source attestation",
              status: "pass",
              summary: `${candidateCommit.committed ? "Committed" : "Attested unchanged"} candidate ${v3CandidateSource.sha}`,
              detail: candidateCommit.stagedFiles.join("\n"),
              filePaths: candidateCommit.stagedFiles,
              metadata: {
                sourceSha: v3CandidateSource.sha,
                sourceTreeHash: v3CandidateSource.treeHash,
                sliceHash: v3CompletionContext.sliceHash,
              },
            });
          }

          const { runImplementEvidenceIfRequested } = await import("./implement-evidence-runner.js");
          const implementEvidenceRun = await runImplementEvidenceIfRequested({
            runId: step.run_id,
            storyId: storyRow.story_id,
            workdir: wd,
            stackPackId: isNativeV3Completion
              ? (v3CompletionContext?.evidencePlan.runtime?.stackPackId
                ?? v3CompletionContext?.slice.runtimeEvidence?.stackPackId
                ?? "")
              : (context["stack_pack_id"] || context["detected_stack"] || ""),
            ...(isNativeV3Completion && v3CompletionContext && v3CandidateSource
              ? {
                  v3: {
                    slice: v3CompletionContext.slice,
                    sliceHash: v3CompletionContext.sliceHash,
                    attemptId: v3CompletionContext.attempt.attemptId,
                    sourceRevision: v3CandidateSource,
                  },
                }
              : {}),
            observe: async (observation) => {
              await recordLiveObservation({
                runId: step.run_id,
                stepId: step.step_id,
                storyId: storyRow.story_id,
                agentId: step.agent_id || "",
                checkId: observation.checkId,
                label: observation.label,
                status: observation.status,
                summary: observation.summary || "",
                detail: observation.detail || "",
                evidence: observation.evidence || {},
                filePaths: observation.filePaths || [],
                metadata: { ...(observation.metadata || {}), eventType: observation.eventType || "" },
              });
            },
          });
          if (isNativeV3Completion) {
            const canonicalEvidence = implementEvidenceRun.canonicalEvidence;
            if (!canonicalEvidence || !v3CandidateSource || !v3CompletionContext) {
              throw new Error("V3_CANONICAL_EVIDENCE_BUNDLE_REQUIRED");
            }
            const { createFindingRecoveryRepository } = await import("../recovery/finding-recovery-repository.js");
            const findingRecovery = createFindingRecoveryRepository(getSql());
            const persistedEvidence = await findingRecovery.putEvidenceBundle(canonicalEvidence.bundle);
            if (persistedEvidence.bundleHash !== canonicalEvidence.bundleHash) {
              throw new Error("V3_CANONICAL_EVIDENCE_PERSISTENCE_HASH_MISMATCH");
            }
            v3EvidenceBundle = canonicalEvidence.bundle;
            const evidenceRef = `setfarm://evidence-bundle/${canonicalEvidence.bundleHash}`;
            v3EvidenceRefs = [evidenceRef];
            context["canonical_evidence_bundle_hash"] = canonicalEvidence.bundleHash;
            context["canonical_evidence_id"] = canonicalEvidence.bundle.evidenceId;
            context["canonical_evidence_verdict"] = canonicalEvidence.bundle.aggregateVerdict;
            if (canonicalEvidence.bundle.aggregateVerdict !== "pass") {
              v3FailureClass = classifyV3EvidenceFailure(canonicalEvidence.bundle);
              v3FindingSet = createFindingSetFromEvidenceBundleV2({
                workdir: wd,
                slice: v3CompletionContext.slice,
                sliceHash: v3CompletionContext.sliceHash,
                bundle: canonicalEvidence.bundle,
              });
              if (!v3FailureClass || !v3FindingSet) {
                throw new Error("V3_CANONICAL_FINDING_SET_REQUIRED");
              }
              const persistedFindingSet = await findingRecovery.putFindingSet(v3FindingSet);
              if (persistedFindingSet.value.findingSetHash !== v3FindingSet.findingSetHash) {
                throw new Error("V3_CANONICAL_FINDING_SET_PERSISTENCE_HASH_MISMATCH");
              }
              v3EvidenceRefs = [...v3EvidenceRefs, `setfarm://finding-set/${v3FindingSet.findingSetHash}`];
              context["canonical_finding_set_hash"] = v3FindingSet.findingSetHash;
              context["canonical_failure_class"] = v3FailureClass;
              const reason = `V3_CANONICAL_EVIDENCE_${canonicalEvidence.bundle.aggregateVerdict.toUpperCase()}: ${canonicalEvidence.bundle.predicates
                .filter((predicate) => predicate.required && predicate.verdict !== "pass")
                .map((predicate) => `${predicate.predicateRef}=${predicate.verdict}`)
                .join(", ")}`;
              context["canonical_recovery_reason"] = reason;
              storyStatus = STORY_STATUS.FAILED;
              storyEvent = "story.failed";
            } else {
              delete context["canonical_finding_set_hash"];
              delete context["canonical_failure_class"];
              delete context["canonical_recovery_reason"];
            }
            await updateRunContext(step.run_id, context);
          }
          await recordLiveObservation({
            runId: step.run_id,
            stepId: step.step_id,
            storyId: storyRow.story_id,
            agentId: step.agent_id || "",
            checkId: "implement.evidence_runner",
            label: "Implement evidence runner",
            status: implementEvidenceRun.attempted ? (implementEvidenceRun.ok ? "pass" : "fail") : "info",
            summary: implementEvidenceRun.reason,
            detail: implementEvidenceRun.evidencePath || "",
            metadata: {
              attempted: implementEvidenceRun.attempted,
              evidencePath: implementEvidenceRun.evidencePath || "",
              failureOwner: implementEvidenceRun.failureOwner || "",
              failureAction: implementEvidenceRun.failureAction || "",
              failureCategory: implementEvidenceRun.failureCategory || "",
            },
          });
          if (!isNativeV3Completion && implementEvidenceRun.failureAction === "infra_retry") {
            const infraReason = [
              "SETFARM_INFRA_RETRY:",
              implementEvidenceRun.reason,
              `Failure category: ${implementEvidenceRun.failureCategory || "stack_tooling_infra_failure"}`,
              "",
              "Implementation evidence runner hit stack tooling infrastructure before product behavior could be judged.",
            ].join("\n");
            applyRetryFailureContext(context, infraReason, implementEvidenceRun.failureCategory || "stack_tooling_infra_failure", "Retry stack tooling infrastructure; do not consume product story retry budget.");
            await updateRunContext(step.run_id, context);
            await failStep(stepId, infraReason, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          const implementEvidenceResult: ReturnType<typeof checkImplementEvidenceGate> = isNativeV3Completion
            ? { passed: true, reason: "V3 canonical EvidenceBundleV2 passed." }
            : checkImplementEvidenceGate(storyRow.story_id, storyRow.title, wd);
          await recordImplementGateObservation(step, storyRow, "implement.evidence", "Implement evidence gate", implementEvidenceResult);
          if (!implementEvidenceResult.passed && implementEvidenceResult.category) {
            applyRetryFailureContext(context, implementEvidenceResult.reason!, implementEvidenceResult.category, implementEvidenceResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, implementEvidenceResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }

          // DESIGN_DOM implementation gate: screen stories must not advance
          // with static controls, missing hrefs, or wrong icons that are
          // already declared in Stitch/DESIGN_DOM. Catch these before verify
          // consumes story retries with review comments about the same contract.
          const designDomResult: Awaited<ReturnType<typeof checkDesignDomImplementationGate>> = isNativeV3Completion
            ? { passed: true, reason: "V3 behavior is owned by sealed predicates and canonical evidence." }
            : await checkDesignDomImplementationGate(
            step.run_id, storyRow.story_id, step.current_story_id, storyRow.title, wd, context["repo"] || "",
          );
          await recordImplementGateObservation(step, storyRow, "implement.design_dom", "DESIGN_DOM implementation gate", designDomResult);
          if (!designDomResult.passed && designDomResult.category) {
            applyRetryFailureContext(context, designDomResult.reason!, designDomResult.category, designDomResult.suggestion!);
            await updateRunContext(step.run_id, context);
            await failStep(stepId, designDomResult.reason!, completionAuthority?.envelope);
            return { advanced: false, runCompleted: false };
          }
        }
      } catch (scopeErr) {
        if (isNativeV3Completion) throw scopeErr;
        logger.warn(`[scope-check] Skipped for story ${storyRow.story_id}: ${String(scopeErr).slice(0, 150)}`, { runId: step.run_id });
      }
    }

    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && storyRow?.story_id && !isNativeV3Completion) {
      const { runProductSupervisorGate, updateSupervisorMemory } = await import("./product-supervisor.js");
      const supervisor = runProductSupervisorGate({
        phase: "implement",
        runId: step.run_id,
        stepId: step.step_id,
        task: context["task"] || "",
        context,
        rawOutput: output,
        workdir: implementSupervisorWorkdir || context["story_workdir"] || context["repo"] || "",
        baseRef: implementSupervisorBaseRef || context["story_base_ref"] || "main",
        currentStory: {
          story_id: storyRow.story_id,
          title: storyRow.title,
        },
      });
      updateSupervisorMemory(context, supervisor.memoryEntry);
      await updateRunContext(step.run_id, context);
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow.story_id,
        agentId: step.agent_id || "",
        checkId: "implement.product_supervisor",
        label: "Product supervisor gate",
        status: supervisor.ok ? "pass" : "blocked",
        summary: supervisor.ok ? "Product supervisor passed" : supervisor.code,
        detail: supervisor.reason || "",
        metadata: { code: supervisor.code || "" },
      });
      if (!supervisor.ok) {
        context["previous_failure"] = supervisor.reason;
        context["failure_category"] = supervisor.code;
        context["failure_suggestion"] = "Treat this as supervisor feedback: finish the actual story, remove placeholder/unfinished work, and report done only with real code behavior.";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, `GUARDRAIL [product-supervisor:implement]: ${supervisor.reason}`, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }

    // PLATFORM STORY COMMIT: developer agents write code only. After all
    // build/scope/product-supervisor gates pass, Setfarm stages exactly the
    // allowed story scope and creates the final story commit before push/PR.
    if (step.step_id === "implement" && storyStatus === STORY_STATUS.DONE && storyRow?.story_id && !isNativeV3Completion) {
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow.story_id,
        agentId: step.agent_id || "",
        checkId: "implement.platform_commit.start",
        label: "Platform story commit",
        status: "running",
        summary: "Staging owned story files",
        detail: storyRow.title || "",
      });
      const commitResult = commitStoryWorktreeScopeIfNeeded(
        implementSupervisorWorkdir || context["story_workdir"] || "",
        storyRow.story_id,
        storyRow.title || "",
      );
      if (commitResult.error) {
        const cleanedScopeBlockedFiles = /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/i.test(commitResult.error)
          ? cleanupBlockedStoryCommitScope(
              implementSupervisorWorkdir || context["story_workdir"] || "",
              storyRow.story_id,
              [],
              step.run_id,
            )
          : [];
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow.story_id,
          agentId: step.agent_id || "",
          checkId: "implement.platform_commit.failed",
          label: "Platform story commit",
          status: "fail",
          summary: "Platform story commit failed",
          detail: cleanedScopeBlockedFiles.length > 0
            ? `${commitResult.error}\n\nCleaned out-of-scope dirty file(s):\n${cleanedScopeBlockedFiles.join("\n")}`
            : commitResult.error,
          filePaths: cleanedScopeBlockedFiles.length > 0 ? cleanedScopeBlockedFiles : commitResult.stagedFiles,
        });
        if (cleanedScopeBlockedFiles.length > 0) {
          context["scope_bleed_cleanup"] = `Cleaned ${cleanedScopeBlockedFiles.length} out-of-scope file(s) after platform commit scope block: ${cleanedScopeBlockedFiles.slice(0, 5).join(", ")}`;
        }
        context["previous_failure"] = commitResult.error;
        context["failure_category"] = "PLATFORM_STORY_COMMIT_FAILED";
        context["failure_suggestion"] = "This is a Setfarm commit ownership failure. Do not ask the developer agent to run git commands; fix the platform scoped commit path or story scope.";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, commitResult.error, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
      if (commitResult.committed) {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow.story_id,
          agentId: step.agent_id || "",
          checkId: "implement.platform_commit.done",
          label: "Platform story commit",
          status: "pass",
          summary: `Committed ${commitResult.stagedFiles.length} file(s) at ${commitResult.sha}`,
          detail: commitResult.stagedFiles.join("\n"),
          filePaths: commitResult.stagedFiles,
          metadata: { sha: commitResult.sha },
        });
        context["platform_story_commit"] = `${storyRow.story_id}:${commitResult.sha}:${commitResult.stagedFiles.join(",")}`.slice(0, 1200);
        await updateRunContext(step.run_id, context);
        logger.info(`[platform-story-commit] ${storyRow.story_id} committed ${commitResult.stagedFiles.length} file(s) at ${commitResult.sha}`, { runId: step.run_id });
      } else {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow.story_id,
          agentId: step.agent_id || "",
          checkId: "implement.platform_commit.noop",
          label: "Platform story commit",
          status: "pass",
          summary: "No owned file changes to commit",
          detail: "",
        });
      }
    }

    // Mark current story done or skipped + persist PR context for verify_each
    // FIX: Remove context fallback to prevent cross-contamination between parallel stories
    let storyPrUrl = GH_PR_URL_REGEX.test(parsed["pr_url"] || "") ? parsed["pr_url"] : "";
    if (isNativeV3Completion) storyPrUrl = "";
    let storyMergeStatus: string | null = null;
    const storyIsQaFix = isQaFixStoryId(storyRow?.story_id);

    // Wave 12 Bug H fix (plan: reactive-frolicking-cupcake.md, run #344 postmortem):
    // Capture the agent's ORIGINAL STORY_BRANCH and PR_URL claims BEFORE any overwrite
    // below. Wave 1 Fix #3 cross-project guard (further down) was reading
    // parsed["story_branch"] AFTER the DB-value overwrite, so any divergence between
    // the agent's claim and the expected branch was erased before the check ran. Run
    // #344 caught it: prism committed pomodoro timer code into the SETFARM-REPO (cwd
    // confusion, agent never 'cd'd to story_workdir), reported STORY_BRANCH: main,
    // but the guard saw "d1605a46-us-002" (DB value) and happily passed. The work
    // landed as a 1067-line commit inside ~/.openclaw/setfarm-repo which had to be
    // reverted manually.
    const agentOriginalBranch = (parsed["story_branch"] || "").trim();
    const agentOriginalPrRaw = (parsed["pr_url"] || "").trim();
    const agentOriginalPr = GH_PR_URL_REGEX.test(agentOriginalPrRaw) ? agentOriginalPrRaw : "";

    // ISSUE-1 FIX: Prefer pipeline-set branch (from DB) over agent's output (agents create wrong names)
    const dbStoryBranch = await pgGet<{ story_branch: string }>("SELECT story_branch FROM stories WHERE id = $1", [step.current_story_id]);
    // Wave 4 fix #11 (plan: reactive-frolicking-cupcake): normalize story_branch to
    // lowercase. Run #338 produced a `35b2cc22-US-005` (uppercase) branch alongside
    // `35b2cc22-us-005` (lowercase) because createStoryWorktree uses toLowerCase()
    // but the agent's STORY_BRANCH output was uppercase and wrote into the DB as-is.
    // Normalize at every point where story_branch is read from agent output or passed
    // to downstream steps.
    const storyBranchName = (dbStoryBranch?.story_branch || parsed["story_branch"] || context["story_branch"] || "").toLowerCase();
    // Always inject DB branch into context so verify agent can find it
    if (storyBranchName) {
      context["story_branch"] = storyBranchName;
      parsed["story_branch"] = storyBranchName;
    }
    // CROSS-PROJECT CONTAMINATION GUARD (run #337 US-002 hallucination fix + Wave 12 Bug H):
    // Agent sessions occasionally carry context from a previous project and fabricate
    // STORY_BRANCH / PR_URL fields pointing at a different repo. Detect that here and
    // fail the step with corrective feedback — never let a fabricated output be marked done.
    // Wave 12 Bug H: now uses the ORIGINAL agent claims captured above, not the
    // DB-overwritten values. Also runs for ALL statuses except SKIPPED (not just DONE)
    // so it still catches a cross-project commit even when the story reported failed
    // (e.g. run #344 US-002 hit 'test(s) failed' first which masked the branch mismatch).
    if (storyStatus !== STORY_STATUS.SKIPPED && !isNativeV3Completion) {
      const expectedRunPrefix = step.run_id.slice(0, 8);
      const expectedRepoName = (context["repo"] || "").split("/").pop() || "";
      const branchMismatch = agentOriginalBranch && expectedRunPrefix && !agentOriginalBranch.toLowerCase().startsWith(expectedRunPrefix.toLowerCase()) && !agentOriginalBranch.toLowerCase().includes(expectedRunPrefix.toLowerCase());
      const prMismatch = agentOriginalPr && expectedRepoName && !agentOriginalPr.includes(`/${expectedRepoName}/`) && !agentOriginalPr.includes(`/${expectedRepoName}.git/`);
      if (branchMismatch || prMismatch) {
        const details: string[] = [];
        if (branchMismatch) details.push(`STORY_BRANCH "${agentOriginalBranch}" does not match run prefix "${expectedRunPrefix}"`);
        if (prMismatch) details.push(`PR_URL "${agentOriginalPr}" does not reference repo "${expectedRepoName}"`);
        const correctiveMsg = `CROSS-PROJECT CONTAMINATION: Agent output references a different project. ${details.join(". ")}. You must work in ${context["repo"] || "the assigned repo"} on story ${storyRow?.story_id} (${storyRow?.title}). Do NOT reference other repos, branches, or PRs. Re-do the work in the correct worktree.`;
        logger.error(`[cross-project-guard] ${correctiveMsg}`, { runId: step.run_id, stepId: step.step_id });
        let restoredContext: Record<string, string> = {};
        try {
          restoredContext = prevContextJson?.context ? JSON.parse(prevContextJson.context) : { ...context };
        } catch {
          restoredContext = { ...context };
        }
        const { classifyError } = await import("./error-taxonomy.js");
        const classified = classifyError(correctiveMsg);
        restoredContext["previous_failure"] = correctiveMsg;
        restoredContext["failure_category"] = classified.category;
        restoredContext["failure_suggestion"] = classified.suggestion;
        try {
          const { updateSupervisorMemory } = await import("./product-supervisor.js");
          updateSupervisorMemory(restoredContext, [
            `### ${new Date().toISOString()} implement cross-project guard story=${storyRow?.story_id || ""} title=${storyRow?.title || ""}`,
            "- Code: CROSS_PROJECT_CONTAMINATION",
            "- Step: implement",
            `- Summary: ${correctiveMsg.slice(0, 1200)}`,
          ].join("\n") + "\n");
        } catch {
          // Retry feedback above is sufficient even if supervisor memory cannot be updated.
        }
        await updateRunContext(step.run_id, restoredContext);
        await failStep(stepId, correctiveMsg, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }

    // PLATFORM STORY PUSH: retry/fix commits on an existing PR must update the
    // remote head before verify reads GitHub review comments. The auto-PR path
    // pushes only when it needs to create/discover a PR, so an already-known
    // PR_URL used to leave fresh local commits invisible to GitHub.
    if (
      storyStatus === STORY_STATUS.DONE &&
      !storyIsQaFix &&
      storyBranchName &&
      context["repo"] &&
      storyBranchName.toLowerCase() !== (context["branch"] || "").toLowerCase()
    ) {
      const pushWorkdir = implementSupervisorWorkdir || context["story_workdir"] || context["repo"];
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow?.story_id || "",
        agentId: step.agent_id || "",
        checkId: "implement.platform_push.start",
        label: "Push story branch",
        status: "running",
        summary: `Pushing ${storyBranchName}`,
        detail: pushWorkdir,
        metadata: { branch: storyBranchName },
      });
      const pushResult = pushStoryBranch(pushWorkdir, storyBranchName);
      if (pushResult.error) {
        const pushFailure = `PLATFORM_STORY_PUSH_FAILED for ${storyRow?.story_id || "story"}: ${pushResult.error}`;
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.platform_push.failed",
          label: "Push story branch",
          status: "fail",
          summary: "Story branch push failed",
          detail: pushFailure,
          metadata: { branch: storyBranchName },
        });
        context["previous_failure"] = pushFailure;
        context["failure_category"] = "PLATFORM_STORY_PUSH_FAILED";
        context["failure_suggestion"] = "This is a Setfarm git transport failure. Do not ask the developer agent to push; fix platform git/remote access, then restart or retry the run.";
        await updateRunContext(step.run_id, context);
        if (!storyRow?.story_id) throw new Error("LOOP_STORY_ID_MISSING");
        await terminalizeLoopClaimAndState({
          runId: step.run_id,
          stepDbId: step.id,
          stepId: step.step_id,
          storyId: storyRow.story_id,
          storyDbId: step.current_story_id!,
          agentId: step.agent_id,
          error: pushFailure,
          outcome: "failed",
          attemptDisposition: "failed",
          ...(completionAuthority?.envelope ? { claimEnvelope: completionAuthority.envelope } : {}),
          state: {
            storyStatus: "failed",
            storyOutput: pushFailure,
            clearStoryClaim: false,
            stepStatus: "failed",
            stepOutput: pushFailure,
            runFailureDiagnostic: pushFailure,
          },
        });
        await recordStepTransition(stepId, step.run_id, "running", "failed", step.agent_id, "completeStep:platformStoryPushFailed", { storyId: storyRow?.story_id, error: pushFailure.slice(0, 300) });
        const wfId = await _getWorkflowId(step.run_id);
        emitEvent({ ts: now(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: "Platform story branch push failed; story retry was not consumed." });
        emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: pushFailure });
        emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: pushFailure });
        scheduleRunCronTeardown(step.run_id);
        return { advanced: false, runCompleted: false };
      }
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow?.story_id || "",
        agentId: step.agent_id || "",
        checkId: "implement.platform_push.done",
        label: "Push story branch",
        status: "pass",
        summary: `Pushed ${storyBranchName}`,
        detail: pushWorkdir,
        metadata: { branch: storyBranchName },
      });
      context["platform_story_push"] = `${storyRow?.story_id || "story"}:${storyBranchName}:${new Date().toISOString()}`;
    }
    // FIX: Validate PR URL belongs to correct repo (cross-contamination guard)
    if (storyPrUrl && context["repo"]) {
      const expectedRepo = context["repo"].split("/").pop() || "";
      if (expectedRepo && !storyPrUrl.includes(expectedRepo)) {
        logger.error(`[cross-repo] Story ${storyRow?.story_id} PR ${storyPrUrl} does not match repo ${expectedRepo}`, { runId: step.run_id });
        storyPrUrl = "";
      }
    }
    // FIX: Prevent duplicate PR URL assignment (cross-contamination between parallel stories)
    if (storyPrUrl && storyRow?.story_id) {
      const duplicatePr = await pgGet<{ story_id: string }>(
        "SELECT story_id FROM stories WHERE run_id = $1 AND pr_url = $2 AND story_id != $3",
        [step.run_id, storyPrUrl, storyRow.story_id],
      );
      if (duplicatePr) {
        logger.error(`[duplicate-pr] PR ${storyPrUrl} already assigned to ${duplicatePr.story_id}, clearing for ${storyRow.story_id}`, { runId: step.run_id });
        storyPrUrl = "";
      }
    }

    // QA-FIX stories are generated from already-confirmed runtime smoke failures.
    // They must land on main before final verification reruns; opening a PR and
    // leaving it unmerged makes final verify test stale main and route the same
    // fixed failures back into another QA-FIX loop.
    if (
      storyStatus === STORY_STATUS.DONE
      && storyIsQaFix
      && !completionAuthority?.envelope
    ) {
      const repoPath = context["repo"] || "";
      if (!repoPath || !storyBranchName) {
        const mergeMsg = `QA_FIX_MERGE_BLOCKED: ${storyRow?.story_id || "QA-FIX"} completed but repo/story_branch is missing, so its fixes cannot be applied to main.`;
        context["previous_failure"] = mergeMsg;
        context["failure_category"] = "QA_FIX_MERGE_BLOCKED";
        context["failure_suggestion"] = "Complete the QA-FIX in the assigned story branch so Setfarm can merge it into main before final verification.";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, mergeMsg, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }

      try {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.qa_fix_merge.start",
          label: "QA-FIX merge to main",
          status: "running",
          summary: `Merging ${storyBranchName} into main`,
          detail: repoPath,
          metadata: { branch: storyBranchName },
        });
        const dirty = execFileSync("git", ["status", "--porcelain"], {
          cwd: repoPath, timeout: 10000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
        }).trim();
        if (dirty && !isPlatformMetadataOnlyDirtyStatus(dirty)) {
          const mergeMsg = `QA_FIX_MERGE_BLOCKED: ${repoPath} has uncommitted changes, refusing to merge ${storyBranchName} into main.`;
          context["previous_failure"] = mergeMsg;
          context["failure_category"] = "QA_FIX_MERGE_BLOCKED";
          context["failure_suggestion"] = "Clean the project repo git state or preserve the changes in a commit, then retry the QA-FIX story.";
          await updateRunContext(step.run_id, context);
          await failStep(stepId, mergeMsg, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }
        if (dirty) {
          logger.warn(`[qa-fix-merge] Ignoring platform metadata-only dirty status before merging ${storyBranchName}: ${dirty.replace(/\s+/g, " ").slice(0, 240)}`, { runId: step.run_id });
          context["qa_fix_platform_metadata_dirty_ignored"] = `${storyRow?.story_id || "QA-FIX"}:${new Date().toISOString()}`;
        }

        try {
          execFileSync("git", ["push", "-u", "origin", storyBranchName], {
            cwd: repoPath, timeout: 30000, stdio: ["pipe", "pipe", "pipe"],
          });
        } catch (pushErr) {
          logger.warn(`[qa-fix-merge] push failed for ${storyBranchName}: ${String(pushErr).slice(0, 220)}`, { runId: step.run_id });
        }

        const mergeResult = mergeStoryIntoFeature(
          repoPath,
          storyBranchName,
          "main",
          `merge: ${storyRow?.story_id || "QA-FIX"} - ${(storyRow?.title || "runtime smoke fixes").slice(0, 80)}`,
        );

        if (!mergeResult.success) {
          await recordLiveObservation({
            runId: step.run_id,
            stepId: step.step_id,
            storyId: storyRow?.story_id || "",
            agentId: step.agent_id || "",
            checkId: "implement.qa_fix_merge.failed",
            label: "QA-FIX merge to main",
            status: "fail",
            summary: "QA-FIX merge failed",
            detail: mergeResult.conflicts.join("\n") || "unknown conflicts",
            filePaths: mergeResult.conflicts,
            metadata: { branch: storyBranchName },
          });
          const mergeMsg = `QA_FIX_MERGE_FAILED: ${storyRow?.story_id || "QA-FIX"} branch ${storyBranchName} could not merge into main. Conflicts: ${mergeResult.conflicts.join(", ") || "unknown"}`;
          context["previous_failure"] = mergeMsg;
          context["failure_category"] = "QA_FIX_MERGE_FAILED";
          context["failure_suggestion"] = "Resolve the merge conflict in the QA-FIX branch against main, then report STATUS: done again.";
          await updateRunContext(step.run_id, context);
          await failStep(stepId, mergeMsg, completionAuthority?.envelope);
          return { advanced: false, runCompleted: false };
        }

        storyStatus = STORY_STATUS.VERIFIED;
        storyEvent = "story.verified";
        storyMergeStatus = "merged";
        context["qa_fix_merged_to_main"] = `${storyRow?.story_id || "QA-FIX"}:${storyBranchName}`;
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.qa_fix_merge.done",
          label: "QA-FIX merge to main",
          status: "pass",
          summary: `${storyRow?.story_id || "QA-FIX"} merged into main`,
          detail: storyBranchName,
          metadata: { branch: storyBranchName, mergeStatus: storyMergeStatus },
        });

        if (storyPrUrl) {
          try {
            execFileSync("gh", ["pr", "close", storyPrUrl, "--comment", "Merged directly into main by Setfarm after QA-FIX smoke gate passed."], {
              cwd: repoPath, timeout: 30000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
            });
          } catch (closeErr) {
            logger.warn(`[qa-fix-merge] could not close stale QA-FIX PR ${storyPrUrl}: ${String(closeErr).slice(0, 220)}`, { runId: step.run_id });
          }
          storyPrUrl = "";
        }

        logger.info(`[qa-fix-merge] Merged ${storyRow?.story_id} (${storyBranchName}) directly into main`, { runId: step.run_id });
      } catch (mergeErr) {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.qa_fix_merge.error",
          label: "QA-FIX merge to main",
          status: "fail",
          summary: "QA-FIX merge error",
          detail: String(mergeErr),
          metadata: { branch: storyBranchName },
        });
        const mergeMsg = `QA_FIX_MERGE_ERROR: ${String(mergeErr).slice(0, 500)}`;
        context["previous_failure"] = mergeMsg;
        context["failure_category"] = "QA_FIX_MERGE_ERROR";
        context["failure_suggestion"] = "Inspect the QA-FIX branch and main repo git state, then retry the same QA-FIX story.";
        await updateRunContext(step.run_id, context);
        await failStep(stepId, mergeMsg, completionAuthority?.envelope);
        return { advanced: false, runCompleted: false };
      }
    }

    // PR-EACH BASE GUARD: Developer agents must not create PRs, but some still
    // do. If they create one against the run branch, retarget it to main before
    // verify sees it; otherwise the story can merge into the wrong branch and
    // the next story starts from stale local main.
    const storyLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
    const requiredPrBase = (storyLoopConfig?.mergeStrategy === "pr-each" || storyLoopConfig?.verifyEach) ? "main" : "";
    if (!isNativeV3Completion && storyStatus === STORY_STATUS.DONE && storyPrUrl && context["auto_pr_create_failed"]) {
      delete context["auto_pr_create_failed"];
      if (context["failure_category"] === "AUTO_PR_CREATE_FAILED") {
        delete context["failure_category"];
        delete context["failure_suggestion"];
      }
    }
    if (!isNativeV3Completion && storyStatus === STORY_STATUS.DONE && storyPrUrl && requiredPrBase && context["repo"]) {
      try {
        const infoRaw = execFileSync("gh", ["pr", "view", storyPrUrl, "--json", "baseRefName,url"], {
          cwd: context["repo"], timeout: 15_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
        }).toString();
        const info = JSON.parse(infoRaw);
        const currentBase = String(info.baseRefName || "");
        if (currentBase && currentBase !== requiredPrBase) {
          const m = String(info.url || storyPrUrl).match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
          if (!m) throw new Error(`cannot parse PR URL ${storyPrUrl}`);
          execFileSync("gh", ["api", "-X", "PATCH", `repos/${m[1]}/${m[2]}/pulls/${m[3]}`, "-f", `base=${requiredPrBase}`], {
            cwd: context["repo"], timeout: 30_000, stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8",
          });
          logger.warn(`[pr-base-guard] Retargeted ${storyPrUrl} from ${currentBase} to ${requiredPrBase} for ${storyRow?.story_id}`, { runId: step.run_id });
        }
      } catch (baseErr) {
        logger.warn(`[pr-base-guard] Could not validate/retarget ${storyPrUrl}: ${String(baseErr).slice(0, 220)}`, { runId: step.run_id });
      }
    }
    // AUTO-PR (2026-04-21): Systemic PR creation — never rely on agent to run gh pr create.
    // If story is DONE and has a pushed branch but no PR URL, system opens PR on main.
    // Runs per-story so each logical unit gets its own PR for isolated review.
    if (
      !isNativeV3Completion &&
      storyStatus === STORY_STATUS.DONE &&
      !storyPrUrl &&
      storyBranchName &&
      context["repo"] &&
      storyBranchName.toLowerCase() !== (context["branch"] || "").toLowerCase()
    ) {
      const autoRepo = context["repo"];
      const autoBase = requiredPrBase || (context["branch"] || "main");
      await recordLiveObservation({
        runId: step.run_id,
        stepId: step.step_id,
        storyId: storyRow?.story_id || "",
        agentId: step.agent_id || "",
        checkId: "implement.auto_pr.start",
        label: "Create or reuse story PR",
        status: "running",
        summary: `Opening PR for ${storyBranchName}`,
        detail: `${storyBranchName} -> ${autoBase}`,
        metadata: { branch: storyBranchName, base: autoBase },
      });
      const ensured = await ensureStoryPrUrlForBranch({
        runId: step.run_id,
        repoPath: autoRepo,
        storyBranchName,
        baseBranch: autoBase,
        storyId: storyRow?.story_id || "story",
        storyTitle: storyRow?.title || "",
        changes: (parsed["changes"] || output || "").toString(),
        existingPrUrl: storyPrUrl,
      });
      if (ensured.prUrl) {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.auto_pr.done",
          label: "Create or reuse story PR",
          status: "pass",
          summary: "Story PR ready",
          detail: ensured.prUrl,
          github: { prUrl: ensured.prUrl, branch: storyBranchName, base: autoBase },
        });
        storyPrUrl = ensured.prUrl;
        parsed["pr_url"] = storyPrUrl;
        context["pr_url"] = storyPrUrl;
        delete context["auto_pr_create_failed"];
        delete context["failure_category"];
        delete context["failure_suggestion"];
      } else {
        await recordLiveObservation({
          runId: step.run_id,
          stepId: step.step_id,
          storyId: storyRow?.story_id || "",
          agentId: step.agent_id || "",
          checkId: "implement.auto_pr.failed",
          label: "Create or reuse story PR",
          status: "fail",
          summary: "Story PR creation failed",
          detail: ensured.error,
          metadata: { branch: storyBranchName, base: autoBase },
        });
        context["auto_pr_create_failed"] = ensured.error;
        context["previous_failure"] = ensured.error;
        context["failure_category"] = "AUTO_PR_CREATE_FAILED";
        context["failure_suggestion"] = "This is a platform PR creation failure. Do not recode the story; Setfarm must create or reuse the story PR before reviewer runs.";
        logger.warn(`[auto-pr] ${ensured.error}`, { runId: step.run_id });
      }
    }

    const exactCompletionEnvelope = completionAuthority?.envelope;
    if (exactCompletionEnvelope) {
      const supportedStoryStatus = ["done", "verified", "skipped", "failed"].includes(storyStatus)
        ? storyStatus as "done" | "verified" | "skipped" | "failed"
        : undefined;
      if (!supportedStoryStatus) throw new Error(`STORY_COMPLETION_STATUS_INVALID: ${storyStatus}`);
      const shadowCompletionWorktree = context["story_workdir"] || context["repo"] || "";
      const sourceAfter = exactCompletionEnvelope.protocol === "v3"
        ? v3CandidateSource
        : exactCompletionEnvelope.protocol !== "legacy" || storyIsQaFix
          ? await captureShadowSourceRevision(shadowCompletionWorktree)
          : undefined;
      if (exactCompletionEnvelope.protocol === "v3" && !sourceAfter) {
        throw new Error("V3_COMPLETION_CANDIDATE_SOURCE_REQUIRED");
      }
      const outputHash = crypto.createHash("sha256").update(output, "utf8").digest("hex");
      const completionLoopConfig = parseLoopConfigSafe(step.loop_config, step.run_id);
      let continuation: {
        type: "story_loop_continue" | "story_direct_merge" | "story_qa_fix_merge" | "story_route_supervise" | "story_route_verify";
        targetStepDbId?: string;
        targetStepId?: string;
      } = { type: "story_loop_continue" };
      if (storyIsQaFix && supportedStoryStatus === "done") {
        if (!sourceAfter) throw new Error("QA_FIX_EXACT_SOURCE_REVISION_REQUIRED");
        continuation = { type: "story_qa_fix_merge" };
      } else if (completionLoopConfig?.superviseEach && completionLoopConfig.superviseStep) {
        const target = await pgGet<{ id: string }>(
          "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
          [step.run_id, completionLoopConfig.superviseStep],
        );
        if (!target) throw new Error("STORY_COMPLETION_SUPERVISE_TARGET_MISSING");
        continuation = {
          type: "story_route_supervise",
          targetStepDbId: target.id,
          targetStepId: completionLoopConfig.superviseStep,
        };
      } else if (completionLoopConfig?.verifyEach && completionLoopConfig.verifyStep) {
        const target = await pgGet<{ id: string }>(
          "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
          [step.run_id, completionLoopConfig.verifyStep],
        );
        if (!target) throw new Error("STORY_COMPLETION_VERIFY_TARGET_MISSING");
        continuation = {
          type: "story_route_verify",
          targetStepDbId: target.id,
          targetStepId: completionLoopConfig.verifyStep,
        };
      } else if (exactCompletionEnvelope.protocol === "v3"
        || completionLoopConfig?.mergeStrategy === "direct-merge") {
        continuation = { type: "story_direct_merge" };
      }
      const completionSubject: RuntimeCompletionSubjectV1 = {
        storyDbId: exactCompletionEnvelope.storyDbId!,
        storyId: exactCompletionEnvelope.storyId!,
        ...(storyPrUrl && /^https?:\/\//.test(storyPrUrl) ? { prUrl: storyPrUrl } : {}),
        ...(sourceAfter ? { sourceSha: sourceAfter.sha } : {}),
      };
      const completionPlan = exactCompletionEnvelope.protocol === "v3"
        ? (() => {
            if (!v3CompletionContext || !v3EvidenceBundle) {
              throw new Error("V3_COMPLETION_RECOVERY_EFFECT_CONTEXT_REQUIRED");
            }
            return createV3RecoveryCompletionPlanDescriptor({
              context: v3CompletionContext,
              evidenceBundle: v3EvidenceBundle,
              ...(v3FindingSet ? { findingSet: v3FindingSet } : {}),
              ...(v3FailureClass ? { failureClass: v3FailureClass } : {}),
              continuation,
              subject: completionSubject,
            });
          })()
        : createSingleEffectCompletionPlanDescriptorV1({
            kind: "story_completion",
            continuation,
            subject: completionSubject,
            effectPayload: {
              storyStatus: supportedStoryStatus,
              storyBranch: storyBranchName || null,
              mergeStatus: storyMergeStatus || null,
            },
          });
      const v3AttemptDisposition = exactCompletionEnvelope.protocol === "v3"
        ? v3EvidenceBundle?.aggregateVerdict === "pass"
          ? "verified" as const
          : v3EvidenceBundle?.aggregateVerdict === "fail"
            ? "failed" as const
            : "inconclusive" as const
        : undefined;
      const canonicalStoryOutput = exactCompletionEnvelope.protocol === "v3"
        ? canonicalJsonStringify({
            schema: "setfarm.v3-story-acceptance-record.v1",
            storyId: exactCompletionEnvelope.storyId,
            attemptId: exactCompletionEnvelope.attempt?.attemptId,
            packetHash: v3CompletionContext?.packetHash,
            sliceHash: v3CompletionContext?.sliceHash,
            sourceRevision: sourceAfter,
            evidenceBundleRef: v3EvidenceRefs.find((ref) => ref.startsWith("setfarm://evidence-bundle/")) || null,
            findingSetRef: v3FindingSet ? `setfarm://finding-set/${v3FindingSet.findingSetHash}` : null,
            aggregateVerdict: v3EvidenceBundle?.aggregateVerdict || "missing",
            failureClass: v3FailureClass || null,
            agentOutputHash: outputHash,
          })
        : output;
      await completeStoryClaimAndBoundAttempt(getSql(), {
        envelope: exactCompletionEnvelope,
        ...(sourceAfter ? { sourceAfter } : {}),
        outputHash,
        evidenceRefs: exactCompletionEnvelope.protocol === "v3" ? v3EvidenceRefs : [],
        ...(v3AttemptDisposition ? { attemptDisposition: v3AttemptDisposition } : {}),
        storyStatus: supportedStoryStatus,
        storyOutput: canonicalStoryOutput,
        storyPrUrl,
        storyBranch: storyBranchName,
        storyMergeStatus,
        stepStatus: "running",
        stepOutput: exactCompletionEnvelope.protocol === "v3" ? canonicalStoryOutput : output,
        completionPlan,
        diagnostic: exactCompletionEnvelope.protocol === "v3"
          ? `V3 story ${storyRow?.story_id || exactCompletionEnvelope.storyId || "unknown"} terminalized with ${v3EvidenceBundle?.aggregateVerdict || "missing"} canonical evidence`
          : `Story ${storyRow?.story_id || exactCompletionEnvelope.storyId || "unknown"} completed through exact claim authority`,
      });
    } else {
      // Compatibility path for pre-envelope legacy runtimes. Compiler runs
      // never reach this branch because completeStep rejects them above.
      await pgBegin(async (sql) => {
        const completedAt = now();
        const updated = await sql.unsafe<Array<{ id: string }>>(
          `UPDATE stories SET status=$1,output=$2,pr_url=$3,story_branch=$4,
                  updated_at=$5,merge_status=COALESCE($7,merge_status)
            WHERE id=$6 AND run_id=$8 AND status='running' RETURNING id`,
          [storyStatus, output, storyPrUrl, storyBranchName, completedAt, step.current_story_id, storyMergeStatus, step.run_id],
        );
        if (updated.length !== 1) throw new Error("LEGACY_STORY_COMPLETION_CAS_LOST");
        await closeLegacyClaimOwnersInTransaction(sql, {
          runId: step.run_id,
          workflowStepId: step.step_id,
          storyId: storyRow?.story_id || "",
          diagnostic: "Legacy story claim completed",
        });
      });
    }
    if (exactCompletionEnvelope && options.deferContinuationToEffectLedger) {
      // The owner transaction above is the first durable product-state commit.
      // Everything below is a projection/continuation and must run from the
      // effect ledger so a crash cannot replay metrics, memory, context, or
      // routing work through the completion owner.
      return { advanced: false, runCompleted: false };
    }
    emitEvent({ ts: now(), event: storyEvent as import("./events.js").EventType, runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story ${storyStatus}: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // B2: Record step_metrics for SLA tracking
    try {
      const claimTs = exactCompletionEnvelope
        ? await pgGet<{ claimed_at: string }>("SELECT claimed_at FROM claim_log WHERE id = $1 LIMIT 1", [exactCompletionEnvelope.claimId])
        : await pgGet<{ claimed_at: string }>("SELECT claimed_at FROM claim_log WHERE step_id = $1 ORDER BY claimed_at DESC LIMIT 1", [step.step_id]);
      const actualClaimedAt = claimTs?.claimed_at || now();
      await pgRun("INSERT INTO step_metrics (run_id, step_name, agent_id, claimed_at, completed_at, duration_ms, outcome, created_at) VALUES ($1, $2, $3, $4, NOW(), EXTRACT(EPOCH FROM NOW() - $5::timestamptz) * 1000, 'completed', NOW())", [step.run_id, step.step_id, step.agent_id || "", actualClaimedAt, actualClaimedAt]);
    } catch (e) { logger.warn(`[step-metrics] insert failed: ${String(e)}`, { runId: step.run_id }); }



    // Update PROJECT_MEMORY.md with completed story info
    if (storyRow && storyStatus !== STORY_STATUS.SKIPPED && !isNativeV3Completion) {
      await updateProjectMemory(context, storyRow.story_id, storyRow.title, storyStatus, output);
    }
    // The spawner owns runtime quiescence. It removes story ephemera/worktrees
    // only after the exact agent process and any OpenClaw fallback are terminal.

    // FIX: Clear story-specific context to prevent cross-contamination between parallel stories
    delete context["pr_url"];
    delete context["story_branch"];
    delete context["current_story_id"];
    delete context["current_story_title"];
    delete context["current_story"];
    delete context["story_base_ref"];
    delete context["verify_feedback"];
    // Wave 1 fix #3 (plan: reactive-frolicking-cupcake): previous_failure is set by
    // failStep and guardrails when a story attempt fails, so the next retry sees its
    // own past error. It is never cleared anywhere, so when the loop finishes this
    // story and claims the NEXT one, the new story's agent inherits the previous
    // story's error message and gets steered by it ("fix the calculator test" while
    // implementing the settings page). Clear it here — story transition is the right
    // boundary, not claim time (retries on the same story must keep seeing it).
    delete context["previous_failure"];
    await updateRunContext(step.run_id, context);

    // Exact-envelope completion already cleared the pointer in the same
    // transaction as claim/attempt/story publication.
    if (!exactCompletionEnvelope) {
      await pgRun("UPDATE steps SET current_story_id = NULL, output = $1, updated_at = $2 WHERE id = $3", [output, now(), step.id]);
    }
    await refreshRunContractSafe(step.run_id, `story.${storyStatus}`);

    const loopConfig: LoopConfig | null = parseLoopConfigSafe(step.loop_config, step.run_id);

    // Wave 3 fix #18 (plan: reactive-frolicking-cupcake): make the loop completion
    // merge strategies explicit. Two branches follow:
    //   1. direct-merge — one batched PR via merge-queue at loop end. Used when
    //      loopConfig.mergeStrategy === "direct-merge".
    //   2. pr-each (default) — each story gets its own PR via the verify step
    //      loop. Used when loopConfig.verifyEach === true. This is the implicit
    //      default; there is no explicit "pr-each" string. If neither branch
    //      matches, we fall through to checkLoopContinuation as a safety net.
    // Any future strategy must be added as an explicit branch above the
    // fall-through, not silently plumbed through.

    // DIRECT-MERGE: No per-story PRs — merge queue runs after all stories complete
    if (isNativeV3Completion || loopConfig?.mergeStrategy === "direct-merge") {
      // Check if all stories are done (no pending/running left)
      const activeCount = await pgGet<{ count: string }>(
        "SELECT COUNT(*) as count FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
        [step.run_id],
      );
      const active = parseInt(activeCount?.count || "0", 10);
      if (active === 0) {
        // All stories done — run merge queue
        logger.info(`[direct-merge] All stories done, starting merge queue`, { runId: step.run_id });
        const repoPath = context["repo"] || "";
        const featureBranch = context["branch"] || "";
        if (repoPath && featureBranch) {
          try {
            const mqResult = await runMergeQueue(step.run_id, repoPath, featureBranch);
            logger.info(`[direct-merge] Merge queue complete: ${mqResult.merged.length} merged, ${mqResult.conflicted.length} conflicts`, { runId: step.run_id });

            // Bug A fix (plan: reactive-frolicking-cupcake.md, run #342 postmortem):
            // Wave 1 #2 removed skipFailedStories from the claim path so the
            // checkLoopContinuation guardrail (96dd442) could fail the run on any
            // failed story. But the direct-merge code path bypasses checkLoopContinuation
            // entirely — runMergeQueue marks conflicted stories as failed (Wave 1 #8)
            // and we then jump straight to advancePipeline. Result: implement step
            // gets marked done and verify/qa-test/deploy all run on a broken state.
            // Run #342 caught this with US-001 + US-003 in 'failed' status while the
            // run sat at 'completed' and PR #2 was merged anyway. Now we explicitly
            // count failed stories AFTER the merge queue and short-circuit to a run
            // failure instead of advancing the pipeline.
            const failedStories = await pgQuery<{ story_id: string; title: string }>(
              "SELECT story_id, title FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index",
              [step.run_id],
            );
            if (failedStories.length > 0) {
              const failList = failedStories.map(s => `${s.story_id} (${s.title})`).join(", ");
              const failMsg = `Direct-merge complete but ${failedStories.length} story(s) failed: ${failList}. Run cannot proceed with broken stories — verify, qa-test, deploy would all be on partial work. Resolve the merge conflicts manually, mark stories verified, and resume the run, or restart with a clean PRD.`;
              logger.error(`[direct-merge] ${failMsg}`, { runId: step.run_id });
              await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
                `STATUS: failed\nMERGE_QUEUE_RESULT: ${mqResult.merged.length} merged, ${mqResult.conflicted.length} conflicted\nFAILED_STORIES: ${failList}\nREASON: ${failMsg}`,
                now(), step.id,
              ]);
              // Wave 13 J-2: terminal flag — medic must not resume this run
              await failRun(step.run_id, true);
              const wfIdF = await getWorkflowId(step.run_id);
              emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdF, stepId: step.step_id, detail: failMsg });
              emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdF, detail: failMsg });
              scheduleRunCronTeardown(step.run_id);
              return { advanced: false, runCompleted: false };
            }

            // Mark loop step done and advance
            await pgRun("UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3", [
              `STATUS: done\nMERGED: ${mqResult.merged.join(', ')}\nCONFLICTS: ${mqResult.conflicted.join(', ')}\nFINAL_PR: ${mqResult.prUrl || 'none'}`,
              now(), step.id,
            ]);
            // Set final_pr in context for verify step
            if (mqResult.prUrl) {
              context["final_pr"] = mqResult.prUrl;
              await updateRunContext(step.run_id, context);
            }
            await refreshRunContractSafe(step.run_id, "implement.direct_merge.done");
            return advancePipeline(step.run_id);
          } catch (mqErr) {
            // Wave 11 Bug G fix (plan: reactive-frolicking-cupcake.md, run #344 postmortem):
            // runMergeQueue throws when too many stories hit conflicts (>= merged count).
            // The previous code marked the step failed and called advancePipeline, which
            // silently moved the pipeline to verify/qa-test/deploy even though implement
            // was in failed state. Wave 8 Bug A fix was INSIDE the try block, so the throw
            // path skipped it entirely. Run #344 caught it: implement=failed, but verify
            // was still claimed 4 times in rapid succession (verify delay-loop) because
            // advancePipeline happily moved forward. Now we directly fail the run —
            // never call advancePipeline when the merge queue has thrown.
            const mqErrMsg = String(mqErr);
            logger.error(`[direct-merge] Merge queue threw — failing run: ${mqErrMsg}`, { runId: step.run_id });
            const failMsg = `Merge queue aborted: ${mqErrMsg}. Too many story branches hit merge conflicts to recover automatically — inspect the stories table for which ones ended in status='failed' with merge_status='conflict', fix those branches manually, or restart the run with a cleaner PRD.`;
            await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
              `STATUS: failed\nERROR: ${failMsg}`,
              now(), step.id,
            ]);
            // Wave 13 J-2: terminal flag — medic must not resume this run
            await failRun(step.run_id, true);
            const wfIdMQ = await getWorkflowId(step.run_id);
            emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdMQ, stepId: step.step_id, detail: failMsg });
            emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdMQ, detail: failMsg });
            scheduleRunCronTeardown(step.run_id);
            return { advanced: false, runCompleted: false };
          }
        } else {
          // Missing repo or branch context — fail the run directly, don't advance
          // (Wave 11 Bug G: this path also advanced past a failed implement step)
          logger.error(`[direct-merge] Missing repo/branch context for merge queue`, { runId: step.run_id });
          const missingMsg = "Missing repo or branch context for merge queue — implement step cannot complete";
          await pgRun("UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3", [
            `STATUS: failed\nERROR: ${missingMsg}`,
            now(), step.id,
          ]);
          // Wave 13 J-2: terminal flag — medic must not resume this run
          await failRun(step.run_id, true);
          const wfIdMissing = await getWorkflowId(step.run_id);
          emitEvent({ ts: now(), event: "step.failed", runId: step.run_id, workflowId: wfIdMissing, stepId: step.step_id, detail: missingMsg });
          emitEvent({ ts: now(), event: "run.failed", runId: step.run_id, workflowId: wfIdMissing, detail: missingMsg });
          scheduleRunCronTeardown(step.run_id);
          return { advanced: false, runCompleted: false };
        }
      }
      // More stories pending — keep loop running
      return { advanced: false, runCompleted: false };
    }

    // SUPERVISE-EACH: run the LLM product supervisor between implement and verify.
    // The story remains status=done, which keeps the implement loop from claiming
    // the next story until the supervisor either passes it to verify or sends it
    // back to implement with manager feedback.
    if (loopConfig?.superviseEach && loopConfig.superviseStep && storyStatus === STORY_STATUS.DONE && storyRow?.story_id) {
      context["supervisor_scope"] = "story";
      context["current_story_id"] = storyRow.story_id;
      context["current_story_title"] = storyRow.title;
      if (storyPrUrl) context["pr_url"] = storyPrUrl;
      if (storyBranchName) context["story_branch"] = storyBranchName;
      clearStorySupervised(context, storyRow.story_id);
      await updateRunContext(step.run_id, context);

      const superviseStep = await pgGet<{ id: string }>(
        "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
        [step.run_id, loopConfig.superviseStep],
      );
      if (superviseStep) {
        await pgRun(
          "UPDATE steps SET status = 'pending', current_story_id = $1, updated_at = $2 WHERE id = $3 AND status IN ('waiting', 'done', 'pending')",
          [step.current_story_id, now(), superviseStep.id],
        );
        await pgRun("UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2", [now(), step.id]);
        logger.info(`[supervise-each] Story ${storyRow.story_id} queued for supervisor before verify`, { runId: step.run_id });
        return { advanced: false, runCompleted: false };
      }
    }

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep && !(storyIsQaFix && storyStatus === STORY_STATUS.VERIFIED)) {
      const verifyStep = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [step.run_id, loopConfig.verifyStep]);

      if (verifyStep) {
        // Only set verify to pending if not already pending/running (prevents race condition with parallel stories)
        await pgRun("UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status IN ('waiting', 'done')", [now(), verifyStep.id]);
        // ISSUE-4 FIX: Preserve started_at — only set on first transition to running
        await pgRun("UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2", [now(), step.id]);
        return { advanced: false, runCompleted: false };
      }
    }

    // No verify_each: check for more stories
    return checkLoopContinuation(step.run_id, step.id);
  }

  // T8: Check if this is a verify step triggered by verify-each
  // NOTE: Don't filter by status='running' — the loop step may have been temporarily
  // reset by cleanupAbandonedSteps, causing this to fall through to single-step path (#52)
  const loopStepRow = await pgGet<{ id: string; loop_config: string | null; run_id: string }>("SELECT id, loop_config, run_id FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1", [step.run_id]);

  if (loopStepRow?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStepRow.loop_config);
    if (v3SuperviseBoundSubject?.kind === "final_product") {
      return await handleSuperviseEachCompletion(
        step,
        loopStepRow.id,
        lc.verifyStep || "verify",
        output,
        context,
        completionAuthority?.envelope,
        false,
        undefined,
        options.deferContinuationToEffectLedger ?? false,
        true,
        true,
        v3SuperviseRuntimeSessionId,
      );
    }
    if (lc.superviseEach && (lc.superviseStep || "supervise") === step.step_id) {
      if (superviseEachConfigForStep) {
        return await handleSuperviseEachCompletion(
          step,
          superviseEachConfigForStep.loopStepId,
          superviseEachConfigForStep.verifyStep,
          output,
          context,
          completionAuthority?.envelope,
          false,
          v3SuperviseBoundSubject?.kind === "story_member"
            ? {
                storyDbId: v3SuperviseBoundSubject.storyDbId,
                storyId: v3SuperviseBoundSubject.storyId,
              }
            : undefined,
          options.deferContinuationToEffectLedger ?? false,
          false,
          v3SuperviseBoundSubject !== undefined,
          v3SuperviseRuntimeSessionId,
        );
      }
      logger.info(`[supervise-each] ${step.step_id} completion has no done story awaiting story supervision; treating it as final supervisor`, { runId: step.run_id });
    }
    if (lc.verifyEach && lc.verifyStep === step.step_id) {
      return await handleVerifyEachCompletion(
        step,
        loopStepRow.id,
        output,
        context,
        completionAuthority?.envelope,
        false,
        undefined,
        options.deferContinuationToEffectLedger ?? false,
      );
    }
  }

  let acceptedCandidateHash: string | undefined;
  if (
    completionAuthority?.envelope.protocol === "v3"
    && step.step_id === "final-test"
  ) {
    // AcceptedCandidate must describe the last product fingerprint. Remove
    // mutable QA/smoke artifacts and stop transient writers before capturing
    // the final-source matrix; no repo cleanup is allowed after publication.
    await cleanupProjectEphemera(step.run_id, "pre-acceptance:final-test", context);
    const { worktree, branch } = resolveV3DownstreamSourceContext(context);
    const route = await createPostgresV3DownstreamEvidenceRouter(getSql()).route({
      runId: step.run_id,
      stepDbId: step.id,
      workflowStepId: "final-test",
      phase: "final",
      parentClaimId: completionAuthority.envelope.claimId,
      worktree,
      branch,
      intent: "final_acceptance",
    });
    if (route.status !== "accepted_candidate_ready") {
      const committed = await commitV3DownstreamEvidenceDecision(getSql(), {
        envelope: completionAuthority.envelope,
        route,
      });
      await recordStepTransition(
        step.id,
        step.run_id,
        "running",
        committed.decision.outcome === "recovery_routed" ? "waiting" : "failed",
        step.agent_id,
        "v3FinalAcceptance:canonicalDecision",
        { routeHash: committed.decision.routeHash, outcome: committed.decision.outcome },
      );
      return { advanced: false, runCompleted: false };
    }
    const accepted = await createAcceptedCandidateRepository({
      sql: getSql(),
      artifactRoot: resolveProductArtifactDir(),
      artifactLimits: resolveProductArtifactCapacity(),
    }).publish({
      runId: step.run_id,
      sourceRevision: route.sourceRevision,
      storyEvidence: route.stories.map((story) => ({
        storyId: story.storyId,
        attemptId: story.attemptId,
        evidencePlanArtifactHash: story.evidencePlanArtifactHash,
        evidenceBundleHash: story.evidenceBundleHash,
      })),
    });
    acceptedCandidateHash = accepted.candidate.candidateHash;
  }

  // Single step: mark done (accept both running and pending — medic may have reset a slow step to pending
  // while the agent was still finishing its work, so we should still accept the completion)
  let _updateChanges: number;
  if (completionAuthority?.envelope) {
    const expectedAtomicContextJson = atomicNativeV3PlanCompletion || atomicNativeV3StoriesCompletion
      ? prevContextJson?.context
      : undefined;
    if ((atomicNativeV3PlanCompletion || atomicNativeV3StoriesCompletion)
      && expectedAtomicContextJson === undefined) {
      throw new Error(atomicNativeV3PlanCompletion
        ? "V3_PLAN_PRIOR_RUN_CONTEXT_REQUIRED"
        : "V3_STORIES_PRIOR_RUN_CONTEXT_REQUIRED");
    }
    let compilerEnglishAdmissionReceipt: CompilerEnglishAdmissionReceiptV1 | undefined;
    let compilerStoryEnglishAdmissionAuthority: CompilerStoryEnglishAdmissionAuthorityV1 | undefined;
    let compilerStoryEnglishAdmissionReceipt: CompilerStoryEnglishAdmissionReceiptV1 | undefined;
    if (atomicNativeV3PlanCompletion) {
      if (!nativeV3PlanAuthority || nativeV3PlanAuthority.status !== "proposal") {
        throw new Error("V3_PLAN_COMPILER_ENGLISH_ADMISSION_AUTHORITY_REQUIRED");
      }
      const englishAuthority = compileCompilerEnglishAdmissionV1({
        claimId: completionAuthority.envelope.claimId,
        runId: step.run_id,
        stepDbId: step.id,
        workflowStepId: "plan",
        productSpec: nativeV3PlanAuthority.productSpec,
        finalContext: context,
      });
      compilerEnglishAdmissionReceipt = compilerEnglishAdmissionReceiptV1(englishAuthority);
      context["plan_english_authority_version"] = compilerEnglishAdmissionReceipt.authorityVersion;
      context["plan_english_admission_receipt_hash"] = hashCanonicalJson(
        compilerEnglishAdmissionReceipt,
      );
    }
    if (atomicNativeV3StoriesCompletion) {
      if (!preparedV3StoriesCompletion) {
        throw new Error("V3_STORIES_COMPILER_ENGLISH_ADMISSION_PREPARATION_REQUIRED");
      }
      compilerStoryEnglishAdmissionAuthority = compileCompilerStoryEnglishAdmissionV1({
        claimId: completionAuthority.envelope.claimId,
        runId: step.run_id,
        stepDbId: step.id,
        workflowStepId: "stories",
        planAuthority: preparedV3StoriesCompletion.planAuthority,
        designAuthoritySubjectHash: preparedV3StoriesCompletion.designAuthoritySubjectHash,
        rawOutput: output,
        expectedOutput: preparedV3StoriesCompletion.expectedOutput,
        finalContext: context,
      });
      compilerStoryEnglishAdmissionReceipt = compilerStoryEnglishAdmissionStateV1(
        compilerStoryEnglishAdmissionAuthority,
      ).receipt;
      context["stories_english_authority_version"] = compilerStoryEnglishAdmissionReceipt.authorityVersion;
      context["stories_english_admission_receipt_hash"] = compilerStoryEnglishAdmissionAuthority.receiptHash;
    }
    const completionPlan = createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance" },
      effectPayload: {
        stepId: step.step_id,
        ...(compilerEnglishAdmissionReceipt ? { compilerEnglishAdmissionReceipt } : {}),
        ...(compilerStoryEnglishAdmissionReceipt ? { compilerStoryEnglishAdmissionReceipt } : {}),
        ...(acceptedCandidateHash ? { acceptedCandidateHash } : {}),
        ...(v3DeployReceipt ? {
          acceptedCandidateHash: v3DeployReceipt.candidateHash,
          deployReceiptHash: v3DeployReceipt.receiptHash,
          terminalProjectProjectionRef: v3DeployReceipt.terminalProjectProjection.evidenceRef,
          terminalProjectProjectionOwner: v3DeployReceipt.terminalProjectProjection.owner,
        } : {}),
      },
    });
    const completionInput = {
      envelope: completionAuthority.envelope,
      stepStatus: "done" as const,
      stepOutput: output,
      ...(atomicNativeV3PlanCompletion || atomicNativeV3StoriesCompletion ? {
        runContextJson: JSON.stringify(context),
        expectedRunContextJson: expectedAtomicContextJson!,
        requireRuntimeCompletionOwner: true,
      } : {}),
      completionPlan,
      diagnostic: `Step ${step.step_id} completed through exact claim authority`,
    };
    if (v3DeployReceipt) {
      const committed = await createV3DeployReceiptRepository(getSql()).publishAndComplete({
        receipt: v3DeployReceipt,
        completion: completionInput,
      });
      if (committed.status === "existing") {
        logger.info("[deploy-v3] canonical deploy receipt already committed; refusing duplicate pipeline advancement", {
          runId: step.run_id,
          stepId: step.step_id,
        });
        return { advanced: false, runCompleted: false };
      }
    } else if (compilerStoryEnglishAdmissionAuthority) {
      await publishCompilerStoryEnglishAdmissionAndCompleteV1(getSql(), {
        authority: compilerStoryEnglishAdmissionAuthority,
        completion: completionInput,
      });
    } else {
      await completeSingleStepClaimAndState(getSql(), completionInput);
    }
    _updateChanges = 1;
  } else {
    _updateChanges = await pgBegin(async (sql) => {
      const updated = await sql.unsafe<Array<{ id: string }>>(
        "UPDATE steps SET status='done',output=$1,updated_at=$2 WHERE id=$3 AND status IN ('running','pending') RETURNING id",
        [output, now(), stepId],
      );
      if (updated.length === 0) return 0;
      if (updated.length !== 1) throw new Error("LEGACY_SINGLE_COMPLETION_CARDINALITY_INVALID");
      await closeLegacyClaimOwnersInTransaction(sql, {
        runId: step.run_id,
        workflowStepId: step.step_id,
        storyId: null,
        diagnostic: "Legacy single-step claim completed",
      });
      return 1;
    });
  }
  if (_updateChanges === 0) {
    // Already completed by another session — skip to prevent double pipeline advancement
    logger.info(`Step already completed, skipping duplicate`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }
  if (atomicNativeV3StoriesCompletion) {
    try {
      await recordStepOutputObservation(step, parsed, output, context);
      await recordStackEvidencePlanObservation(step, context);
    } catch (error) {
      logger.warn(`[stories-authority] post-commit observation publication failed: ${String(error).slice(0, 300)}`, {
        runId: step.run_id,
        stepId: step.step_id,
      });
    }
  }
  if (completionAuthority?.envelope && options.deferContinuationToEffectLedger) {
    return { advanced: false, runCompleted: false };
  }
  await recordStepTransition(stepId, step.run_id, "running", "done", step.agent_id, "completeStep");
  const immutableAcceptedCandidate = completionAuthority?.envelope.protocol === "v3"
    && (
      (step.step_id === "final-test" && !!acceptedCandidateHash)
      || isV3DeterministicDeployCompletion
    );
  await refreshRunContractSafe(
    step.run_id,
    `step.${step.step_id}.done`,
    context,
    immutableAcceptedCandidate ? { writeRepoFiles: false } : {},
  );
  emitEvent({ ts: now(), event: "step.done", runId: step.run_id, workflowId: await getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

  // Post-complete: delete /tmp output files to prevent peek-recovery cross-step contamination
  try {
    const _tmpFiles = fs.readdirSync("/tmp").filter(f => f.startsWith("setfarm-output-") && f.endsWith(".txt"));
    for (const _f of _tmpFiles) { try { fs.unlinkSync("/tmp/" + _f); } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); } }
  } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }

  if (!immutableAcceptedCandidate) {
    await cleanupProjectEphemera(step.run_id, `step-complete:${step.step_id}`, context);
  }

    // B2: Record step_metrics for single step
    try {
      await pgRun("INSERT INTO step_metrics (run_id, step_name, agent_id, claimed_at, completed_at, duration_ms, outcome, created_at) VALUES ($1, $2, $3, $4, NOW(), 0, 'completed', NOW())", [step.run_id, step.step_id, step.agent_id || "", now()]);
    } catch (e) { logger.warn(`[step-metrics] insert failed: ${String(e)}`, { runId: step.run_id }); }


  // Guard: if a loop step is still active (not done), don't advance the pipeline.
  // During verify_each cycles, single steps (test, pr, review, etc.) may get claimed
  // and completed — advancing would skip the loop and break story iteration.
  const activeLoop = await findActiveLoop(step.run_id);
  if (activeLoop) {
    logger.info(`Skipping advancePipeline — loop step still active`, { runId: step.run_id, stepId: step.step_id });
    return { advanced: false, runCompleted: false };
  }

  return advancePipeline(step.run_id);
}

export type RuntimeCompletionEffectsResumeInput = Readonly<{
  protocol?: "legacy" | "shadow" | "v3";
  claimId?: number;
  runtimeSessionId?: string;
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  output: string;
  storyDbId?: string;
  storyId?: string;
  completionPlan?: RuntimeCompletionPlanV1;
}>;

async function authenticatedV3CompletionSubject(
  input: RuntimeCompletionEffectsResumeInput,
): Promise<V3StoryClaimRuntimeSubjectV1 | undefined> {
  if (input.protocol !== "v3") return undefined;
  if (input.workflowStepId !== "implement" && input.workflowStepId !== "supervise") return undefined;
  const workflowStepId = input.workflowStepId;
  if (input.claimId === undefined || !input.runtimeSessionId) {
    throw new Error("V3_STORY_COMPLETION_EFFECT_BINDING_IDENTITY_REQUIRED");
  }
  return getSql().begin((transaction) => loadAndRevalidateV3StoryClaimRuntimeBindingV1(
    transaction,
    {
      claimId: input.claimId!,
      runtimeSessionId: input.runtimeSessionId!,
      runId: input.runId,
      stepDbId: input.stepDbId,
      workflowStepId,
    },
  )) as Promise<V3StoryClaimRuntimeSubjectV1>;
}

function acceptedCandidateHashFromCompletionPlan(
  plan?: RuntimeCompletionPlanV1,
): string | undefined {
  if (plan?.continuation.type !== "single_pipeline_advance") return undefined;
  const hashes = plan.effects
    .map((effect) => effect.payload.acceptedCandidateHash)
    .filter((value): value is string => typeof value === "string");
  if (hashes.length === 0) return undefined;
  if (hashes.length !== 1 || !/^[a-f0-9]{64}$/.test(hashes[0]!)) {
    throw new Error("V3_ACCEPTED_CANDIDATE_COMPLETION_EFFECT_INVALID");
  }
  return hashes[0]!;
}

async function authenticatedV3SupervisorRetryProjection(
  input: RuntimeCompletionEffectsResumeInput,
  subject: V3StoryClaimRuntimeSubjectV1 | undefined,
): Promise<Readonly<{ status: string; directiveHash: string }> | undefined> {
  if (input.workflowStepId !== "supervise"
    || subject?.kind !== "story_member"
    || input.claimId === undefined
    || !input.runtimeSessionId) {
    return undefined;
  }
  const story = await pgGet<{
    status: string;
    claim_generation: number;
    output: string | null;
  }>(
    `SELECT status, claim_generation, output
       FROM stories
      WHERE id = $1 AND run_id = $2 AND story_id = $3`,
    [subject.storyDbId, input.runId, subject.storyId],
  );
  if (!story || !["pending", "failed"].includes(story.status)) return undefined;
  const directive = parseV3SupervisorRetryDirectiveStoryOutputV1(story.output);
  if (story.status === "failed" && !directive) {
    const terminalOwner = await pgGet<{ claim_id: string }>(
      `SELECT binding.claim_id::text AS claim_id
         FROM v3_story_claim_runtime_bindings_v1 binding
         JOIN claim_log claim ON claim.id = binding.claim_id AND claim.run_id = binding.run_id
         JOIN runtime_completion_requests completion
           ON completion.claim_id = binding.claim_id
          AND completion.runtime_session_id = binding.runtime_session_id
          AND completion.run_id = binding.run_id
        WHERE binding.claim_id = $1
          AND binding.runtime_session_id = $2
          AND binding.run_id = $3
          AND binding.story_db_id = $4
          AND binding.story_id = $5
          AND binding.story_claim_generation = $6
          AND claim.outcome IN ('failed', 'completed')
          AND completion.output_hash = $7
          AND completion.apply_phase = 'owner_committed'
        LIMIT 1`,
      [
        input.claimId,
        input.runtimeSessionId,
        input.runId,
        subject.storyDbId,
        subject.storyId,
        subject.storyClaimGeneration,
        crypto.createHash("sha256").update(input.output, "utf8").digest("hex"),
      ],
    );
    if (terminalOwner) return { status: story.status, directiveHash: "terminal-exhausted" };
  }
  if (!directive
    || directive.runId !== input.runId
    || directive.storyDbId !== subject.storyDbId
    || directive.storyId !== subject.storyId
    || directive.storyClaimGeneration !== subject.storyClaimGeneration
    || directive.storyClaimGeneration !== story.claim_generation
    || directive.supervisorClaimId !== input.claimId
    || directive.runtimeSessionId !== input.runtimeSessionId
    || directive.outputHash !== crypto.createHash("sha256").update(input.output, "utf8").digest("hex")) {
    return undefined;
  }
  return { status: story.status, directiveHash: directive.directiveHash };
}

type V3RefusalCompletionEffect = Readonly<{
  refusalHash: string;
  refusalCode: "SOURCE_SNAPSHOT_MISMATCH" | "CONTRACT_SCOPE_CONFLICT";
  attemptId: string;
  findingSetHash: string;
  recoveryCaseId: string;
  priorRecoveryDispatchId?: string;
  priorRecoveryRevisionId?: string;
}>;

function v3RefusalCompletionEffect(plan?: RuntimeCompletionPlanV1): V3RefusalCompletionEffect | undefined {
  const effects = plan?.effects.filter((effect) => effect.effectType === "v3.refusal.recorded") ?? [];
  if (effects.length === 0) return undefined;
  if (effects.length !== 1) throw new Error("V3_REFUSAL_COMPLETION_EFFECT_AMBIGUOUS");
  const payload = effects[0]!.payload;
  const refusalCode = payload.refusalCode;
  const refusalHash = payload.refusalHash;
  const attemptId = payload.attemptId;
  const findingSetHash = payload.findingSetHash;
  const recoveryCaseId = payload.recoveryCaseId;
  const priorRecoveryDispatchId = payload.priorRecoveryDispatchId;
  const priorRecoveryRevisionId = payload.priorRecoveryRevisionId;
  if (
    plan?.continuation.type !== "failure_finalize"
    || !["SOURCE_SNAPSHOT_MISMATCH", "CONTRACT_SCOPE_CONFLICT"].includes(String(refusalCode))
    || typeof refusalHash !== "string" || !/^[a-f0-9]{64}$/.test(refusalHash)
    || typeof attemptId !== "string" || !/^ATT_[A-Za-z0-9-]{16,160}$/.test(attemptId)
    || typeof findingSetHash !== "string" || !/^[a-f0-9]{64}$/.test(findingSetHash)
    || typeof recoveryCaseId !== "string" || !/^RCV_[a-f0-9]{64}$/.test(recoveryCaseId)
    || ((priorRecoveryDispatchId === undefined) !== (priorRecoveryRevisionId === undefined))
    || (priorRecoveryDispatchId !== undefined && (typeof priorRecoveryDispatchId !== "string" || !/^RDISP_[a-f0-9]{64}$/.test(priorRecoveryDispatchId)))
    || (priorRecoveryRevisionId !== undefined && (typeof priorRecoveryRevisionId !== "string" || !/^RREV_[a-f0-9]{64}$/.test(priorRecoveryRevisionId)))
  ) {
    throw new Error("V3_REFUSAL_COMPLETION_EFFECT_INVALID");
  }
  return {
    refusalHash,
    refusalCode: refusalCode as V3RefusalCompletionEffect["refusalCode"],
    attemptId,
    findingSetHash,
    recoveryCaseId,
    ...(priorRecoveryDispatchId ? { priorRecoveryDispatchId } : {}),
    ...(priorRecoveryRevisionId ? { priorRecoveryRevisionId } : {}),
  };
}

async function v3RefusalRecoveryLineageIsSettled(
  effect: V3RefusalCompletionEffect,
): Promise<boolean> {
  const findings = createFindingRecoveryRepository(getSql());
  const terminal = await findings.findRecoveryCase(effect.recoveryCaseId);
  const target = effect.refusalCode === "SOURCE_SNAPSHOT_MISMATCH" ? "superseded" : "blocked";
  if (!terminal || terminal.status !== target || terminal.findingSetHash !== effect.findingSetHash) {
    throw new Error("V3_REFUSAL_TERMINAL_CASE_IDENTITY_MISMATCH");
  }
  if (!effect.priorRecoveryDispatchId || !effect.priorRecoveryRevisionId) return true;
  const deliveries = createRecoveryDeliveryRepository(getSql());
  const dispatch = await deliveries.findDispatch(effect.priorRecoveryDispatchId);
  const delivery = await deliveries.findDelivery(effect.priorRecoveryDispatchId);
  if (
    !dispatch
    || !delivery
    || dispatch.revisionId !== effect.priorRecoveryRevisionId
    || delivery.revisionId !== effect.priorRecoveryRevisionId
    || delivery.attemptId !== effect.attemptId
  ) {
    throw new Error("V3_REFUSAL_PRIOR_RECOVERY_IDENTITY_MISMATCH");
  }
  const priorCase = await findings.findRecoveryCase(dispatch.recoveryCaseId);
  if (!priorCase) throw new Error("V3_REFUSAL_PRIOR_RECOVERY_CASE_MISSING");
  return delivery.state === target && priorCase.status === target;
}

async function settleV3RefusalRecoveryLineage(effect: V3RefusalCompletionEffect): Promise<void> {
  if (await v3RefusalRecoveryLineageIsSettled(effect)) return;
  if (!effect.priorRecoveryDispatchId || !effect.priorRecoveryRevisionId) return;
  const findings = createFindingRecoveryRepository(getSql());
  const deliveries = createRecoveryDeliveryRepository(getSql());
  const dispatch = await deliveries.findDispatch(effect.priorRecoveryDispatchId);
  const delivery = await deliveries.findDelivery(effect.priorRecoveryDispatchId);
  if (!dispatch || !delivery) throw new Error("V3_REFUSAL_PRIOR_RECOVERY_IDENTITY_MISSING");
  const target = effect.refusalCode === "SOURCE_SNAPSHOT_MISMATCH" ? "superseded" : "blocked";
  const reasonCode = effect.refusalCode === "SOURCE_SNAPSHOT_MISMATCH"
    ? "source_superseded"
    : "upstream_recompile_required";
  if (!["succeeded", "failed", "blocked", "superseded"].includes(delivery.state)) {
    const completed = await deliveries.completeDelivery({
      dispatchId: effect.priorRecoveryDispatchId,
      revisionId: effect.priorRecoveryRevisionId,
      attemptId: effect.attemptId,
      state: target,
      terminalResult: {
        schema: "setfarm.v3-refusal-recovery-delivery-result.v1",
        refusalHash: effect.refusalHash,
        findingSetHash: effect.findingSetHash,
        recoveryCaseId: effect.recoveryCaseId,
        outcome: target,
      },
      diagnostic: `${effect.refusalCode} transferred recovery ownership to ${effect.recoveryCaseId}`,
    });
    if (!completed || completed.state !== target) {
      throw new Error("V3_REFUSAL_PRIOR_RECOVERY_DELIVERY_SETTLEMENT_LOST");
    }
  } else if (delivery.state !== target) {
    throw new Error("V3_REFUSAL_PRIOR_RECOVERY_DELIVERY_TERMINAL_CONFLICT");
  }
  const priorCase = await findings.findRecoveryCase(dispatch.recoveryCaseId);
  if (!priorCase) throw new Error("V3_REFUSAL_PRIOR_RECOVERY_CASE_MISSING");
  if (["resolved", "blocked", "superseded"].includes(priorCase.status)) {
    if (priorCase.status !== target) throw new Error("V3_REFUSAL_PRIOR_RECOVERY_CASE_TERMINAL_CONFLICT");
    return;
  }
  const transitioned = await findings.transitionRecoveryCase({
    recoveryCaseId: priorCase.recoveryCaseId,
    expectedStateVersion: priorCase.stateVersion,
    status: target,
    terminal: {
      owner: priorCase.owner,
      outcome: target,
      reasonCode,
      evidenceBundleHashes: [],
    },
    decisionRef: effect.refusalHash,
  });
  if (transitioned.status === "stale_version") {
    const replay = await findings.findRecoveryCase(priorCase.recoveryCaseId);
    if (replay?.status !== target) throw new Error("V3_REFUSAL_PRIOR_RECOVERY_CASE_SETTLEMENT_LOST");
  } else if (transitioned.recoveryCase.status !== target) {
    throw new Error("V3_REFUSAL_PRIOR_RECOVERY_CASE_SETTLEMENT_LOST");
  }
}

export async function reconcileRuntimeCompletionEffects(
  input: RuntimeCompletionEffectsResumeInput,
): Promise<Readonly<{
  result: { advanced: boolean; runCompleted: boolean };
  evidence: Record<string, unknown>;
}> | undefined> {
  const plan = input.completionPlan;
  if (!plan) throw new Error("RUNTIME_COMPLETION_EFFECT_PLAN_REQUIRED");
  const runProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [input.runId],
  );
  if (!runProtocol || (input.protocol !== undefined && input.protocol !== runProtocol.protocol)) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_PROTOCOL_MISMATCH");
  }
  const authenticatedSubject = await authenticatedV3CompletionSubject({
    ...input,
    protocol: runProtocol.protocol,
  });
  if (authenticatedSubject?.kind === "story_member"
    && (input.storyDbId !== authenticatedSubject.storyDbId
      || input.storyId !== authenticatedSubject.storyId)) {
    throw new Error("V3_STORY_COMPLETION_EFFECT_SUBJECT_MISMATCH");
  }
  if (authenticatedSubject?.kind === "final_product" && (input.storyDbId || input.storyId || plan.subject)) {
    throw new Error("V3_FINAL_PRODUCT_COMPLETION_EFFECT_SUBJECT_INVALID");
  }
  const supervisorRetry = await authenticatedV3SupervisorRetryProjection(input, authenticatedSubject);
  if (supervisorRetry) {
    return {
      result: { advanced: false, runCompleted: false },
      evidence: {
        schema: "setfarm.runtime-completion-effect-reconcile.v1",
        reason: "authenticated-supervisor-retry-already-published",
        storyStatus: supervisorRetry.status,
        directiveHash: supervisorRetry.directiveHash,
        evidenceRefs: input.storyDbId ? [`setfarm://story/${input.storyDbId}`] : [],
      },
    };
  }
  const run = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [input.runId]);
  if (!run) throw new Error("RUNTIME_COMPLETION_EFFECT_RUN_NOT_FOUND");
  const terminal = ["completed", "done", "failed", "cancelled"].includes(run.status);
  if (terminal) {
    return {
      result: { advanced: false, runCompleted: ["completed", "done"].includes(run.status) },
      evidence: {
        schema: "setfarm.runtime-completion-effect-reconcile.v1",
        reason: "run-terminal",
        runStatus: run.status,
        evidenceRefs: [`setfarm://run/${input.runId}`],
      },
    };
  }

  const step = await pgGet<{
    id: string;
    step_index: number;
    status: string;
    current_story_id: string | null;
  }>(
    "SELECT id, step_index, status, current_story_id FROM steps WHERE id = $1 AND run_id = $2",
    [input.stepDbId, input.runId],
  );
  if (!step) throw new Error("RUNTIME_COMPLETION_EFFECT_STEP_NOT_FOUND");
  const continuation = plan.continuation.type;
  const refusalEffect = v3RefusalCompletionEffect(plan);
  const subject = plan.subject;
  const baseEvidence = {
    schema: "setfarm.runtime-completion-effect-reconcile.v1",
    continuation,
    evidenceRefs: [
      `setfarm://run/${input.runId}`,
      `setfarm://step/${input.stepDbId}`,
      ...(subject ? [`setfarm://story/${subject.storyDbId}`] : []),
    ],
  };

  if (["failure_finalize", "quality_route_finalize", "terminal_finalize"].includes(continuation)) {
    if (refusalEffect?.priorRecoveryDispatchId) {
      if (!(await v3RefusalRecoveryLineageIsSettled(refusalEffect))) return undefined;
    }
    return {
      result: { advanced: false, runCompleted: false },
      evidence: { ...baseEvidence, reason: "owner-transaction-published-final-state" },
    };
  }

  if (continuation === "story_route_verify" || continuation === "story_route_supervise") {
    if (!subject || !plan.continuation.targetStepDbId) {
      throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_IDENTITY_MISSING");
    }
    const target = await pgGet<{ status: string; current_story_id: string | null }>(
      "SELECT status, current_story_id FROM steps WHERE id = $1 AND run_id = $2",
      [plan.continuation.targetStepDbId, input.runId],
    );
    const story = await pgGet<{ status: string }>(
      "SELECT status FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3",
      [subject.storyDbId, input.runId, subject.storyId],
    );
    const progressed = continuation === "story_route_supervise"
      ? Boolean(
        target
        && ["pending", "running"].includes(target.status)
        && target.current_story_id === subject.storyDbId,
      )
      : Boolean(target && ["pending", "running"].includes(target.status));
    if (progressed || ["verified", "skipped"].includes(story?.status ?? "")) {
      return {
        result: { advanced: false, runCompleted: false },
        evidence: {
          ...baseEvidence,
          reason: progressed ? "exact-target-already-routed" : "story-already-progressed",
          targetStepDbId: plan.continuation.targetStepDbId,
          targetStatus: target?.status ?? "missing",
          storyStatus: story?.status ?? "missing",
        },
      };
    }
    return undefined;
  }

  if (continuation === "story_loop_continue" && subject) {
    const active = await pgGet<{ count: string }>(
      "SELECT COUNT(*) AS count FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
      [input.runId],
    );
    const activeCount = Number(active?.count ?? 0);
    if (activeCount > 0 && step.status === "running" && step.current_story_id === null) {
      return {
        result: { advanced: false, runCompleted: false },
        evidence: { ...baseEvidence, reason: "loop-ready-for-next-story", activeStoryCount: activeCount },
      };
    }
    if (step.status === "done") {
      return {
        result: { advanced: true, runCompleted: false },
        evidence: { ...baseEvidence, reason: "loop-already-finalized" },
      };
    }
    return undefined;
  }

  if (continuation === "story_direct_merge" && subject) {
    const counts = await pgGet<{ active: string; failed: string; unpublished: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('pending', 'running')) AS active,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COUNT(*) FILTER (WHERE status NOT IN ('verified', 'skipped')) AS unpublished
       FROM stories WHERE run_id = $1`,
      [input.runId],
    );
    if (
      step.status === "done"
      && Number(counts?.active ?? 0) === 0
      && Number(counts?.failed ?? 0) === 0
      && Number(counts?.unpublished ?? 0) === 0
    ) {
      return {
        result: { advanced: true, runCompleted: false },
        evidence: { ...baseEvidence, reason: "direct-merge-canonical-state-published" },
      };
    }
    return undefined;
  }

  if (continuation === "story_qa_fix_merge") {
    if (!subject?.sourceSha) {
      throw new Error("RUNTIME_COMPLETION_EFFECT_QA_FIX_SOURCE_IDENTITY_MISSING");
    }
    const story = await pgGet<{
      status: string;
      merge_status: string | null;
    }>(
      "SELECT status, merge_status FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3",
      [subject.storyDbId, input.runId, subject.storyId],
    );
    if (story?.status !== STORY_STATUS.VERIFIED || story.merge_status !== "merged") {
      return undefined;
    }
    const context = await getRunContext(input.runId);
    const repoPath = context["repo"] || "";
    if (!repoPath) return undefined;
    const proof = proveExactCommitAncestor(repoPath, subject.sourceSha, "origin/main");
    if (proof.outcome !== "ancestor") return undefined;
    return {
      result: { advanced: false, runCompleted: false },
      evidence: {
        ...baseEvidence,
        reason: "qa-fix-exact-source-already-published",
        sourceSha: subject.sourceSha,
        targetRef: proof.targetRef,
        targetCommitSha: proof.targetCommitSha,
      },
    };
  }

  if (continuation === "single_pipeline_advance") {
    const activeLoop = await pgGet<{ id: string }>(
      "SELECT id FROM steps WHERE run_id = $1 AND type = 'loop' AND status IN ('pending', 'running') LIMIT 1",
      [input.runId],
    );
    if (activeLoop) {
      return {
        result: { advanced: false, runCompleted: false },
        evidence: { ...baseEvidence, reason: "active-loop-intentionally-blocks-pipeline-advance" },
      };
    }
    const later = await pgGet<{ id: string; status: string }>(
      `SELECT id, status FROM steps
        WHERE run_id = $1 AND step_index > $2 AND status <> 'waiting'
        ORDER BY step_index LIMIT 1`,
      [input.runId, step.step_index],
    );
    if (later) {
      return {
        result: { advanced: true, runCompleted: false },
        evidence: { ...baseEvidence, reason: "later-step-already-visible", laterStepDbId: later.id, laterStatus: later.status },
      };
    }
    return undefined;
  }

  if ((continuation === "verify_each_decision" || continuation === "supervise_each_decision") && subject) {
    const story = await pgGet<{ status: string }>(
      "SELECT status FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3",
      [subject.storyDbId, input.runId, subject.storyId],
    );
    const parsed = parseOutputKeyValues(input.output);
    const decision = firstOutputWord(
      parsed["supervisor_decision"] || parsed["decision"] || parsed["status"] || "",
    );
    const retryDecision = ["retry", "block", "blocked", "failed", "fail"].includes(decision);
    const applied = retryDecision
      ? Boolean(story && story.status !== "done")
      : Boolean(story && ["verified", "skipped"].includes(story.status));
    if (applied) {
      return {
        result: { advanced: false, runCompleted: false },
        evidence: { ...baseEvidence, reason: "story-decision-already-published", decision, storyStatus: story!.status },
      };
    }
    return undefined;
  }

  return undefined;
}

/**
 * Resume only the deterministic continuation after the exact claim/product
 * owner transaction committed. This function never closes a claim. Every
 * mutation is an idempotent projection of canonical story/step/run state, so
 * a coordinator crash can replay it without rerunning agent gates or source
 * publication.
 */
export async function resumeRuntimeCompletionEffects(
  input: RuntimeCompletionEffectsResumeInput,
): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const runProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [input.runId],
  );
  if (!runProtocol || (input.protocol !== undefined && input.protocol !== runProtocol.protocol)) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_PROTOCOL_MISMATCH");
  }
  const authenticatedSubject = await authenticatedV3CompletionSubject({
    ...input,
    protocol: runProtocol.protocol,
  });
  if (authenticatedSubject?.kind === "story_member"
    && (input.storyDbId !== authenticatedSubject.storyDbId
      || input.storyId !== authenticatedSubject.storyId)) {
    throw new Error("V3_STORY_COMPLETION_EFFECT_SUBJECT_MISMATCH");
  }
  if (authenticatedSubject?.kind === "final_product"
    && (input.storyDbId || input.storyId || input.completionPlan?.subject)) {
    throw new Error("V3_FINAL_PRODUCT_COMPLETION_EFFECT_SUBJECT_INVALID");
  }
  if (await authenticatedV3SupervisorRetryProjection(input, authenticatedSubject)) {
    return { advanced: false, runCompleted: false };
  }
  const run = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [input.runId]);
  if (!run) throw new Error("RUNTIME_COMPLETION_EFFECT_RUN_NOT_FOUND");
  if (![RUN_STATUS.RUNNING, "resuming"].includes(run.status as any)) {
    return { advanced: false, runCompleted: ["completed", RUN_STATUS.DONE].includes(run.status) };
  }

  const step = await pgGet<{
    id: string;
    run_id: string;
    step_id: string;
    step_index: number;
    type: string;
    loop_config: string | null;
    current_story_id: string | null;
    agent_id: string;
    status: string;
  }>(
    `SELECT id, run_id, step_id, step_index, type, loop_config,
            current_story_id, agent_id, status
       FROM steps WHERE id = $1 AND run_id = $2 AND step_id = $3`,
    [input.stepDbId, input.runId, input.workflowStepId],
  );
  if (!step) throw new Error("RUNTIME_COMPLETION_EFFECT_STEP_NOT_FOUND");

  const context = await getRunContext(input.runId);
  const isCanonicalV3StoryCompletion = input.completionPlan?.effects.some(
    (effect) => effect.effectType === "v3.recovery.coordinate",
  ) ?? false;
  const refusalEffect = v3RefusalCompletionEffect(input.completionPlan);
  if (refusalEffect) {
    await settleV3RefusalRecoveryLineage(refusalEffect);
    return { advanced: false, runCompleted: false };
  }
  if (input.storyId && input.storyDbId) {
    const story = await pgGet<{
      id: string;
      story_id: string;
      title: string;
      status: string;
      pr_url: string | null;
      story_branch: string | null;
    }>(
      `SELECT id, story_id, title, status, pr_url, story_branch
         FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3`,
      [input.storyDbId, input.runId, input.storyId],
    );
    if (!story || ![STORY_STATUS.DONE, STORY_STATUS.VERIFIED, STORY_STATUS.SKIPPED].includes(story.status as any)) {
      throw new Error(`RUNTIME_COMPLETION_EFFECT_STORY_STATE_INVALID:${story?.status ?? "missing"}`);
    }
    if (step.current_story_id !== null) {
      throw new Error(`RUNTIME_COMPLETION_EFFECT_LOOP_POINTER_NOT_CLEARED:${step.current_story_id}`);
    }

    if (input.completionPlan?.continuation.type === "story_qa_fix_merge") {
      const subject = input.completionPlan.subject;
      if (
        !subject?.sourceSha
        || subject.storyDbId !== story.id
        || subject.storyId !== story.story_id
      ) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_QA_FIX_IDENTITY_MISMATCH");
      }
      const repoPath = context["repo"] || "";
      const storyBranch = story.story_branch || "";
      if (!repoPath || !storyBranch) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_QA_FIX_CONTEXT_MISSING");
      }
      const merge = mergeExactSourceIntoFeature({
        repoPath,
        sourceSha: subject.sourceSha,
        featureBranch: "main",
        commitMessage: `merge: ${story.story_id} exact QA-FIX source`,
      });
      if (!merge.success) {
        throw new Error(`RUNTIME_COMPLETION_EFFECT_QA_FIX_MERGE_FAILED:${merge.error}`);
      }
      const published = await pgRun(
        `UPDATE stories
            SET status = 'verified', merge_status = 'merged', updated_at = $4
          WHERE id = $1 AND run_id = $2 AND story_id = $3
            AND status IN ('done', 'verified')`,
        [story.id, input.runId, story.story_id, now()],
      );
      if (published.changes !== 1) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_QA_FIX_STATE_CAS_LOST");
      }
      story.status = STORY_STATUS.VERIFIED;
      context["qa_fix_merged_to_main"] = `${story.story_id}:${storyBranch}:${subject.sourceSha}`;
    }

    const contextStory = context["current_story_id"] || "";
    if (!contextStory || contextStory === story.story_id || contextStory === story.id) {
      delete context["pr_url"];
      delete context["story_branch"];
      delete context["current_story_id"];
      delete context["current_story_title"];
      delete context["current_story"];
      delete context["story_base_ref"];
      delete context["verify_feedback"];
      delete context["previous_failure"];
      await updateRunContext(input.runId, context);
    }
    if (story.status !== STORY_STATUS.SKIPPED && !isCanonicalV3StoryCompletion) {
      updateProjectMemory(context, story.story_id, story.title, story.status, input.output);
    }
    await refreshRunContractSafe(input.runId, `story.${story.status}`);

    const loopConfig = parseLoopConfigSafe(step.loop_config, input.runId);
    if (
      input.completionPlan?.continuation.type === "story_direct_merge"
      || (!input.completionPlan && loopConfig?.mergeStrategy === "direct-merge")
    ) {
      const activeCount = await pgGet<{ count: string }>(
        "SELECT COUNT(*) AS count FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
        [input.runId],
      );
      if (parseInt(activeCount?.count || "0", 10) > 0) {
        return { advanced: false, runCompleted: false };
      }
      if (step.status === "done") return advancePipeline(input.runId);
      const repoPath = context["repo"] || "";
      const featureBranch = context["branch"] || "";
      if (!repoPath || !featureBranch) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_DIRECT_MERGE_CONTEXT_MISSING");
      }
      try {
        const merge = await runMergeQueue(input.runId, repoPath, featureBranch);
        const failedStories = await pgQuery<{ story_id: string; title: string }>(
          "SELECT story_id, title FROM stories WHERE run_id = $1 AND status = 'failed' ORDER BY story_index",
          [input.runId],
        );
        if (failedStories.length > 0) {
          const detail = failedStories.map((item) => `${item.story_id} (${item.title})`).join(", ");
          const diagnostic = `Direct-merge continuation found failed stories: ${detail}`;
          await pgRun(
            "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
            [diagnostic, now(), step.id],
          );
          await failRun(input.runId, true, diagnostic);
          return { advanced: false, runCompleted: false };
        }
        await pgRun(
          "UPDATE steps SET status = 'done', output = $1, updated_at = $2 WHERE id = $3 AND status <> 'done'",
          [
            `STATUS: done\nMERGED: ${merge.merged.join(", ")}\nCONFLICTS: ${merge.conflicted.join(", ")}\nFINAL_PR: ${merge.prUrl || "none"}`,
            now(),
            step.id,
          ],
        );
        if (merge.prUrl) {
          context["final_pr"] = merge.prUrl;
          await updateRunContext(input.runId, context);
        }
        await refreshRunContractSafe(input.runId, "implement.direct_merge.done");
        return advancePipeline(input.runId);
      } catch (error) {
        const diagnostic = `Merge queue continuation failed: ${String(error)}`;
        await pgRun(
          "UPDATE steps SET status = 'failed', output = $1, updated_at = $2 WHERE id = $3",
          [diagnostic, now(), step.id],
        );
        await failRun(input.runId, true, diagnostic);
        return { advanced: false, runCompleted: false };
      }
    }

    const frozenRoute = input.completionPlan?.continuation;
    if (frozenRoute?.type === "story_route_supervise"
      || frozenRoute?.type === "story_route_verify") {
      if (!frozenRoute.targetStepDbId || !frozenRoute.targetStepId) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_IDENTITY_MISSING");
      }
      const frozenTargetStepDbId = frozenRoute.targetStepDbId;
      const frozenTargetStepId = frozenRoute.targetStepId;
      const expectedWorkflowStepId = frozenRoute.type === "story_route_supervise"
        ? "supervise"
        : frozenTargetStepId;
      if (frozenTargetStepId !== expectedWorkflowStepId) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_WORKFLOW_MISMATCH");
      }
      const target = await pgGet<{ id: string; step_id: string; type: string; status: string }>(
        `SELECT id, step_id, type, status
           FROM steps
          WHERE id = $1 AND run_id = $2`,
        [frozenTargetStepDbId, input.runId],
      );
      if (!target
        || target.step_id !== frozenTargetStepId
        || target.type !== "single") {
        throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_TARGET_DRIFT");
      }
      if (frozenRoute.type === "story_route_supervise") {
        context["supervisor_scope"] = "story";
        context["current_story_id"] = story.story_id;
        context["current_story_title"] = story.title;
        if (story.pr_url) context["pr_url"] = story.pr_url;
        if (story.story_branch) context["story_branch"] = story.story_branch;
        clearStorySupervised(context, story.story_id);
      }
      await pgBegin(async (sql) => {
        const targetUpdated = await sql.unsafe<Array<{ id: string }>>(
          `UPDATE steps
              SET status = 'pending', current_story_id = $1, updated_at = clock_timestamp()
            WHERE id = $2 AND run_id = $3 AND step_id = $4
              AND status IN ('waiting', 'done', 'pending')
            RETURNING id`,
          [
            frozenRoute.type === "story_route_supervise" ? story.id : null,
            frozenTargetStepDbId,
            input.runId,
            frozenTargetStepId,
          ],
        );
        if (targetUpdated.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_TARGET_CAS_LOST");
        const loopUpdated = await sql.unsafe<Array<{ id: string }>>(
          `UPDATE steps
              SET status = 'running', started_at = COALESCE(started_at, clock_timestamp()),
                  updated_at = clock_timestamp()
            WHERE id = $1 AND run_id = $2
            RETURNING id`,
          [step.id, input.runId],
        );
        if (loopUpdated.length !== 1) throw new Error("RUNTIME_COMPLETION_EFFECT_ROUTE_LOOP_CAS_LOST");
      });
      await updateRunContext(input.runId, context);
      return { advanced: false, runCompleted: false };
    }

    if (
      !input.completionPlan
      &&
      loopConfig?.superviseEach
      && loopConfig.superviseStep
      && story.status === STORY_STATUS.DONE
    ) {
      const superviseStep = await pgGet<{ id: string }>(
        "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
        [input.runId, loopConfig.superviseStep],
      );
      if (!superviseStep) throw new Error("RUNTIME_COMPLETION_EFFECT_SUPERVISE_STEP_MISSING");
      context["supervisor_scope"] = "story";
      context["current_story_id"] = story.story_id;
      context["current_story_title"] = story.title;
      if (story.pr_url) context["pr_url"] = story.pr_url;
      if (story.story_branch) context["story_branch"] = story.story_branch;
      clearStorySupervised(context, story.story_id);
      await updateRunContext(input.runId, context);
      await pgBegin(async (sql) => {
        await sql.unsafe(
          "UPDATE steps SET status = 'pending', current_story_id = $1, updated_at = $2 WHERE id = $3 AND status IN ('waiting', 'done', 'pending')",
          [story.id, now(), superviseStep.id],
        );
        await sql.unsafe(
          "UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2",
          [now(), step.id],
        );
      });
      return { advanced: false, runCompleted: false };
    }

    if (
      !input.completionPlan
      &&
      loopConfig?.verifyEach
      && loopConfig.verifyStep
      && story.status !== STORY_STATUS.VERIFIED
    ) {
      const verifyStep = await pgGet<{ id: string }>(
        "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
        [input.runId, loopConfig.verifyStep],
      );
      if (!verifyStep) throw new Error("RUNTIME_COMPLETION_EFFECT_VERIFY_STEP_MISSING");
      await pgBegin(async (sql) => {
        await sql.unsafe(
          "UPDATE steps SET status = 'pending', updated_at = $1 WHERE id = $2 AND status IN ('waiting', 'done')",
          [now(), verifyStep.id],
        );
        await sql.unsafe(
          "UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2",
          [now(), step.id],
        );
      });
      return { advanced: false, runCompleted: false };
    }

    return checkLoopContinuation(input.runId, step.id);
  }

  const loopStep = await pgGet<{ id: string; loop_config: string | null }>(
    "SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1",
    [input.runId],
  );
  if (loopStep?.loop_config) {
    const loopConfig = parseLoopConfigSafe(loopStep.loop_config, input.runId);
    if (loopConfig?.superviseEach && (loopConfig.superviseStep || "supervise") === step.step_id) {
      return handleSuperviseEachCompletion(
        step,
        loopStep.id,
        loopConfig.verifyStep || "verify",
        input.output,
        context,
        undefined,
        true,
        authenticatedSubject?.kind === "story_member"
          ? { storyDbId: authenticatedSubject.storyDbId, storyId: authenticatedSubject.storyId }
          : input.completionPlan?.subject,
        false,
        authenticatedSubject?.kind === "final_product",
        authenticatedSubject !== undefined,
        input.runtimeSessionId,
      );
    }
    if (loopConfig?.verifyEach && loopConfig.verifyStep === step.step_id) {
      return handleVerifyEachCompletion(
        step,
        loopStep.id,
        input.output,
        context,
        undefined,
        true,
        input.completionPlan?.subject,
      );
    }
  }

  const acceptedCandidateHash = step.step_id === "final-test"
    ? acceptedCandidateHashFromCompletionPlan(input.completionPlan)
    : undefined;
  await refreshRunContractSafe(
    input.runId,
    `step.${step.step_id}.done`,
    context,
    acceptedCandidateHash ? { writeRepoFiles: false } : {},
  );
  if (!acceptedCandidateHash) {
    await cleanupProjectEphemera(input.runId, `step-complete-resume:${step.step_id}`, context);
  }
  if (await findActiveLoop(input.runId)) return { advanced: false, runCompleted: false };
  return advancePipeline(input.runId);
}

/**
 * Handle supervise-each completion: manager gate between implement and verify.
 */
async function publishAuthenticatedV3SupervisorPostOwnerRetry(input: Readonly<{
  runId: string;
  superviseStepDbId: string;
  loopStepDbId: string;
  verifyStepName: string;
  runtimeSessionId: string;
  output: string;
  feedback: string;
  boundSubject: RuntimeCompletionSubjectV1;
  sourceRevision?: Readonly<{ sha: string; treeHash: string }>;
}>): Promise<void> {
  await pgBegin(async (transaction) => {
    const runRows = await transaction.unsafe<Array<{ id: string }>>(
      "SELECT id FROM runs WHERE id = $1 AND protocol = 'v3' AND status IN ('running', 'resuming') FOR UPDATE",
      [input.runId],
    );
    if (runRows.length !== 1) throw new Error("V3_SUPERVISE_POST_OWNER_RUN_INVALID");
    const bindingRows = await transaction.unsafe<Array<{ claim_id: string }>>(
      `SELECT claim_id::text AS claim_id
         FROM v3_story_claim_runtime_bindings_v1
        WHERE runtime_session_id = $1 AND run_id = $2
        LIMIT 2`,
      [input.runtimeSessionId, input.runId],
    );
    if (bindingRows.length !== 1) throw new Error("V3_SUPERVISE_POST_OWNER_BINDING_IDENTITY_INVALID");
    const claimId = Number(bindingRows[0]!.claim_id);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
      throw new Error("V3_SUPERVISE_POST_OWNER_CLAIM_ID_INVALID");
    }
    const authenticated = await loadAndRevalidateV3StoryClaimRuntimeBindingV1(transaction, {
      claimId,
      runtimeSessionId: input.runtimeSessionId,
      runId: input.runId,
      stepDbId: input.superviseStepDbId,
      workflowStepId: "supervise",
    });
    if (authenticated.kind !== "story_member"
      || authenticated.storyDbId !== input.boundSubject.storyDbId
      || authenticated.storyId !== input.boundSubject.storyId) {
      throw new Error("V3_SUPERVISE_POST_OWNER_BINDING_MISMATCH");
    }
    const stories = await transaction.unsafe<Array<{
      status: string;
      retry_count: number;
      max_retries: number;
      output: string | null;
    }>>(
      `SELECT status, retry_count, max_retries, output
         FROM stories
        WHERE id = $1 AND run_id = $2 AND story_id = $3 AND claim_generation = $4
        FOR UPDATE`,
      [authenticated.storyDbId, input.runId, authenticated.storyId, authenticated.storyClaimGeneration],
    );
    if (stories.length !== 1) throw new Error("V3_SUPERVISE_POST_OWNER_STORY_INVALID");
    const story = stories[0]!;
    const priorDirective = parseV3SupervisorRetryDirectiveStoryOutputV1(story.output);
    if (story.status === "pending") {
      const outputHash = crypto.createHash("sha256").update(input.output, "utf8").digest("hex");
      if (!priorDirective
        || priorDirective.runId !== input.runId
        || priorDirective.storyDbId !== authenticated.storyDbId
        || priorDirective.storyId !== authenticated.storyId
        || priorDirective.storyClaimGeneration !== authenticated.storyClaimGeneration
        || priorDirective.supervisorClaimId !== claimId
        || priorDirective.runtimeSessionId !== input.runtimeSessionId
        || priorDirective.outputHash !== outputHash
        || !input.sourceRevision
        || priorDirective.sourceRevision.sha !== input.sourceRevision.sha
        || priorDirective.sourceRevision.treeHash !== input.sourceRevision.treeHash
        || priorDirective.retryOrdinal !== story.retry_count
        || priorDirective.maxRetries !== story.max_retries) {
        throw new Error("V3_SUPERVISE_POST_OWNER_PRIOR_DIRECTIVE_IDENTITY_INVALID");
      }
      return;
    }
    if (story.status !== "done") {
      throw new Error(`V3_SUPERVISE_POST_OWNER_STORY_STATE_INVALID:${story.status}`);
    }
    const retryOrdinal = story.retry_count + 1;
    const exhausted = retryOrdinal > story.max_retries;
    if (!exhausted && !input.sourceRevision) {
      throw new Error("V3_SUPERVISE_POST_OWNER_SOURCE_REQUIRED");
    }
    const directive = exhausted ? undefined : createV3SupervisorRetryDirectiveV1({
      runId: input.runId,
      storyDbId: authenticated.storyDbId,
      storyId: authenticated.storyId,
      storyClaimGeneration: authenticated.storyClaimGeneration,
      supervisorClaimId: claimId,
      runtimeSessionId: input.runtimeSessionId,
      outputHash: crypto.createHash("sha256").update(input.output, "utf8").digest("hex"),
      sourceRevision: input.sourceRevision!,
      decision: "retry",
      feedback: input.feedback,
      retryOrdinal,
      maxRetries: story.max_retries,
    });
    const updated = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = $5, retry_count = LEAST(retry_count + 1, max_retries),
              output = $6, claimed_by = NULL, claimed_at = NULL,
              pr_url = NULL, merge_status = NULL, updated_at = clock_timestamp()
        WHERE id = $1 AND run_id = $2 AND story_id = $3
          AND claim_generation = $4 AND status = 'done'
        RETURNING id`,
      [
        authenticated.storyDbId,
        input.runId,
        authenticated.storyId,
        authenticated.storyClaimGeneration,
        exhausted ? "failed" : "pending",
        directive ? serializeV3SupervisorRetryDirectiveV1(directive) : input.feedback,
      ],
    );
    if (updated.length !== 1) throw new Error("V3_SUPERVISE_POST_OWNER_STORY_CAS_LOST");
    const steps = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = CASE
                WHEN id = $2 THEN $5
                WHEN id = $3 THEN $6
                ELSE 'waiting'
              END,
              current_story_id = NULL, updated_at = clock_timestamp()
        WHERE run_id = $1 AND (id = $2 OR id = $3 OR step_id = $4)
        RETURNING id`,
      [
        input.runId,
        input.loopStepDbId,
        input.superviseStepDbId,
        input.verifyStepName,
        exhausted ? "failed" : "pending",
        exhausted ? "failed" : "waiting",
      ],
    );
    if (steps.length !== 3) throw new Error("V3_SUPERVISE_POST_OWNER_STEP_TOPOLOGY_INVALID");
    if (exhausted) {
      await requestRunTerminationInTransaction(transaction, {
        runId: input.runId,
        targetStatus: "failed",
        requestedBy: "setfarm.v3-supervise-post-owner",
        diagnostic: input.feedback,
        evidence: {
          source: "publishAuthenticatedV3SupervisorPostOwnerRetry",
          storyDbId: authenticated.storyDbId,
          storyId: authenticated.storyId,
          storyClaimGeneration: authenticated.storyClaimGeneration,
        },
      });
    }
  });
}

async function handleSuperviseEachCompletion(
  superviseStep: { id: string; run_id: string; step_id: string; step_index: number; current_story_id?: string | null },
  loopStepId: string,
  verifyStepName: string,
  output: string,
  context: Record<string, string>,
  claimEnvelope?: ClaimEnvelopeV1,
  ownerAlreadyCommitted = false,
  boundSubject?: RuntimeCompletionSubjectV1,
  deferContinuationToEffectLedger = false,
  boundFinalProduct = false,
  authenticatedV3Binding = false,
  authenticatedRuntimeSessionId?: string,
): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const parsedOutput = parseOutputKeyValues(output);
  for (const key of PROTECTED_CONTEXT_KEYS) {
    if (key in parsedOutput) {
      logger.warn(`[handleSuperviseEach] Stripped protected key "${key}" from output`, { runId: superviseStep.run_id });
      delete parsedOutput[key];
    }
  }

  const finalProductStatus = firstOutputWord(parsedOutput["status"]);
  const finalProductDecision = firstOutputWord(parsedOutput["supervisor_decision"]);
  const authenticatedV3Success = finalProductStatus === "done"
    && ["pass", "fixed"].includes(finalProductDecision);
  const authenticatedV3RetryIntent = finalProductStatus === "retry"
    || ["block", "blocked"].includes(finalProductDecision);
  if (boundFinalProduct && !authenticatedV3Success) {
    if (ownerAlreadyCommitted) {
      const committed = await pgGet<{ status: string }>(
        "SELECT status FROM steps WHERE id = $1 AND run_id = $2",
        [superviseStep.id, superviseStep.run_id],
      );
      if (!committed || !["pending", "failed", "skipped"].includes(committed.status)) {
        throw new Error(`SUPERVISE_FINAL_PRODUCT_RETRY_RESUME_STATE_INVALID:${committed?.status ?? "missing"}`);
      }
      return { advanced: false, runCompleted: false };
    }
    if (!claimEnvelope) {
      throw new Error("V3_SUPERVISE_NON_SUCCESS_CLAIM_AUTHORITY_REQUIRED");
    }
    const issues = (
      parsedOutput["issues"]
      || parsedOutput["supervisor_memory_append"]
      || output
    ).slice(0, 6_000);
    context["previous_failure"] = `LLM_SUPERVISOR_BLOCKED final product:\n${issues}`;
    context["failure_category"] = "LLM_SUPERVISOR_BLOCKED";
    context["failure_suggestion"] = "Resolve the final-product supervisor blocker, then retry the exact final supervision step.";
    context["supervisor_scope"] = "final-product";
    await updateRunContext(superviseStep.run_id, context);
    await failStep(
      superviseStep.id,
      `Authenticated supervisor rejected non-success output ${finalProductDecision || finalProductStatus || "unknown"}: ${issues}`,
      claimEnvelope,
    );
    return { advanced: false, runCompleted: false };
  }

  if (boundSubject && authenticatedV3Binding && !authenticatedV3Success) {
    const retryIntent = authenticatedV3RetryIntent;
    if (!retryIntent) {
      if (ownerAlreadyCommitted) {
        const committed = await pgGet<{ status: string }>(
          "SELECT status FROM steps WHERE id = $1 AND run_id = $2",
          [superviseStep.id, superviseStep.run_id],
        );
        if (!committed || !["pending", "failed", "skipped"].includes(committed.status)) {
          throw new Error(`V3_SUPERVISE_STORY_FAILURE_RESUME_STATE_INVALID:${committed?.status ?? "missing"}`);
        }
        return { advanced: false, runCompleted: false };
      }
      if (!claimEnvelope) throw new Error("V3_SUPERVISE_STORY_FAILURE_AUTHORITY_REQUIRED");
      await failStep(
        superviseStep.id,
        `Authenticated story supervisor rejected non-success output ${finalProductDecision || finalProductStatus || "unknown"}: ${output.slice(0, 6_000)}`,
        claimEnvelope,
      );
      return { advanced: false, runCompleted: false };
    }
    if (ownerAlreadyCommitted) {
      const committed = await pgGet<{ status: string }>(
        "SELECT status FROM steps WHERE id = $1 AND run_id = $2",
        [superviseStep.id, superviseStep.run_id],
      );
      if (!committed || !["waiting", "failed"].includes(committed.status)) {
        throw new Error(`V3_SUPERVISE_STORY_RETRY_RESUME_STATE_INVALID:${committed?.status ?? "missing"}`);
      }
      return { advanced: false, runCompleted: false };
    }
    if (!claimEnvelope || !authenticatedRuntimeSessionId) {
      throw new Error("V3_SUPERVISE_STORY_RETRY_AUTHORITY_REQUIRED");
    }
    const issues = (
      parsedOutput["issues"]
      || parsedOutput["supervisor_memory_append"]
      || output
    ).slice(0, 6_000);
    const retryBudgetRows = await pgQuery<{ retry_count: number; max_retries: number }>(
      `SELECT retry_count, max_retries
         FROM stories
        WHERE id = $1 AND run_id = $2 AND story_id = $3 AND status = 'done'
        LIMIT 2`,
      [boundSubject.storyDbId, superviseStep.run_id, boundSubject.storyId],
    );
    if (retryBudgetRows.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_BUDGET_INVALID");
    const retryWillExhaust = retryBudgetRows[0]!.retry_count + 1 > retryBudgetRows[0]!.max_retries;
    let exactRejectedSource: Readonly<{ sha: string; treeHash: string }> | undefined;
    if (!retryWillExhaust) {
      const retryStoryWorktree = await authenticatedV3SupervisorStoryWorktree({
        runId: superviseStep.run_id,
        superviseStepDbId: superviseStep.id,
        runtimeSessionId: authenticatedRuntimeSessionId,
        boundSubject,
      });
      await revalidateAuthenticatedV3SupervisorStoryWorktree(retryStoryWorktree);
      assertExactGitBranchWorktree(retryStoryWorktree.workdir, retryStoryWorktree.storyBranch);
      const retryCommit = commitStoryWorktreeScopeIfNeeded(
        retryStoryWorktree.workdir,
        boundSubject.storyId,
        retryStoryWorktree.storyTitle,
        parseDeclaredScopeFiles(retryStoryWorktree.scopeFiles),
        "fix",
      );
      if (retryCommit.error) {
        throw new Error(`PLATFORM_SUPERVISOR_COMMIT_FAILED for ${boundSubject.storyId}: ${retryCommit.error}`);
      }
      await revalidateAuthenticatedV3SupervisorStoryWorktree(retryStoryWorktree);
      assertExactGitBranchWorktree(retryStoryWorktree.workdir, retryStoryWorktree.storyBranch);
      const retryPush = pushStoryBranch(retryStoryWorktree.workdir, retryStoryWorktree.storyBranch);
      if (retryPush.error) {
        throw new Error(`PLATFORM_SUPERVISOR_PUSH_FAILED for ${boundSubject.storyId}: ${retryPush.error}`);
      }
      exactRejectedSource = captureExactCleanBoundStoryRevision(
        retryStoryWorktree.workdir,
        retryStoryWorktree.storyBranch,
      );
    }
    await pgBegin(async (transaction) => {
      const runRows = await transaction.unsafe<Array<{ id: string }>>(
        "SELECT id FROM runs WHERE id = $1 AND protocol = 'v3' AND status IN ('running', 'resuming') FOR UPDATE",
        [superviseStep.run_id],
      );
      if (runRows.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_RUN_INVALID");
      const authenticated = await loadAndRevalidateV3StoryClaimRuntimeBindingV1(
        transaction,
        {
          claimId: claimEnvelope.claimId,
          runtimeSessionId: authenticatedRuntimeSessionId,
          runId: superviseStep.run_id,
          stepDbId: superviseStep.id,
          workflowStepId: "supervise",
        },
      );
      if (authenticated.kind !== "story_member"
        || authenticated.storyDbId !== boundSubject.storyDbId
        || authenticated.storyId !== boundSubject.storyId) {
        throw new Error("V3_SUPERVISE_STORY_RETRY_BINDING_MISMATCH");
      }
      const storyRows = await transaction.unsafe<Array<{
        id: string;
        retry_count: number;
        max_retries: number;
      }>>(
        `SELECT id, retry_count, max_retries
           FROM stories
          WHERE id = $1 AND run_id = $2 AND story_id = $3
            AND claim_generation = $4 AND status = 'done'
          FOR UPDATE`,
        [
          authenticated.storyDbId,
          superviseStep.run_id,
          authenticated.storyId,
          authenticated.storyClaimGeneration,
        ],
      );
      if (storyRows.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_STATE_INVALID");
      const stepRows = await transaction.unsafe<Array<{
        id: string;
        step_id: string;
        type: string;
        status: string;
      }>>(
        `SELECT id, step_id, type, status
           FROM steps
          WHERE run_id = $1
            AND (id = $2 OR id = $3 OR step_id = $4)
          ORDER BY id
          LIMIT 4
          FOR UPDATE`,
        [superviseStep.run_id, loopStepId, superviseStep.id, verifyStepName],
      );
      const implementRows = stepRows.filter((row) => row.id === loopStepId
        && row.step_id === "implement" && row.type === "loop");
      const superviseRows = stepRows.filter((row) => row.id === superviseStep.id
        && row.step_id === superviseStep.step_id && row.type === "single");
      const verifyRows = stepRows.filter((row) => row.step_id === verifyStepName
        && row.type === "single");
      if (stepRows.length !== 3
        || implementRows.length !== 1
        || superviseRows.length !== 1
        || verifyRows.length !== 1
        || superviseRows[0]!.status !== "running"
        || verifyRows[0]!.status !== "waiting") {
        throw new Error("V3_SUPERVISE_STORY_RETRY_STEP_TOPOLOGY_INVALID");
      }
      const story = storyRows[0]!;
      const exhausted = story.retry_count + 1 > story.max_retries;
      if (exhausted !== retryWillExhaust) {
        throw new Error("V3_SUPERVISE_STORY_RETRY_BUDGET_DRIFT");
      }
      const supervisorRetry = exhausted ? undefined : createV3SupervisorRetryDirectiveV1({
        runId: superviseStep.run_id,
        storyDbId: authenticated.storyDbId,
        storyId: authenticated.storyId,
        storyClaimGeneration: authenticated.storyClaimGeneration,
        supervisorClaimId: claimEnvelope.claimId,
        runtimeSessionId: authenticatedRuntimeSessionId,
        outputHash: crypto.createHash("sha256").update(output, "utf8").digest("hex"),
        sourceRevision: exactRejectedSource
          ?? (() => { throw new Error("V3_SUPERVISE_STORY_RETRY_SOURCE_REQUIRED"); })(),
        retryOrdinal: story.retry_count + 1,
        maxRetries: story.max_retries,
        decision: "retry",
        feedback: issues,
      });
      const durableStoryOutput = supervisorRetry
        ? serializeV3SupervisorRetryDirectiveV1(supervisorRetry)
        : issues;
      await closeExactSingleStepClaimInTransaction(transaction, {
        envelope: claimEnvelope,
        outcome: "failed",
        diagnostic: issues,
      });
      const storyUpdated = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE stories
            SET status = $5, claimed_by = NULL, claimed_at = NULL,
                retry_count = LEAST(retry_count + 1, max_retries), output = $6,
                pr_url = NULL, merge_status = NULL, updated_at = clock_timestamp()
          WHERE id = $1 AND run_id = $2 AND story_id = $3
            AND claim_generation = $4 AND status = 'done'
          RETURNING id`,
        [
          authenticated.storyDbId,
          superviseStep.run_id,
          authenticated.storyId,
          authenticated.storyClaimGeneration,
          exhausted ? "failed" : "pending",
          durableStoryOutput,
        ],
      );
      if (storyUpdated.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_CAS_LOST");
      const implementUpdated = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE steps
            SET status = $3, current_story_id = NULL, updated_at = clock_timestamp()
          WHERE id = $1 AND run_id = $2 AND status = $4
          RETURNING id`,
        [
          loopStepId,
          superviseStep.run_id,
          exhausted ? "failed" : "pending",
          implementRows[0]!.status,
        ],
      );
      if (implementUpdated.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_IMPLEMENT_CAS_LOST");
      const superviseUpdated = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE steps
            SET status = $3, current_story_id = NULL, output = $4,
                updated_at = clock_timestamp()
          WHERE id = $1 AND run_id = $2 AND status = 'running'
          RETURNING id`,
        [
          superviseStep.id,
          superviseStep.run_id,
          exhausted ? "failed" : "waiting",
          durableStoryOutput,
        ],
      );
      if (superviseUpdated.length !== 1) throw new Error("V3_SUPERVISE_STORY_RETRY_SUPERVISE_CAS_LOST");
      if (exhausted) {
        await requestRunTerminationInTransaction(transaction, {
          runId: superviseStep.run_id,
          targetStatus: "failed",
          requestedBy: "setfarm.v3-supervise-binding",
          diagnostic: issues,
          evidence: {
            source: "handleSuperviseEachCompletion",
            storyDbId: authenticated.storyDbId,
            storyId: authenticated.storyId,
            storyClaimGeneration: authenticated.storyClaimGeneration,
          },
        });
      }
      await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
        claimId: claimEnvelope.claimId,
        claimOutcome: "failed",
        plan: createSingleEffectCompletionPlanDescriptorV1({
          kind: "single_failure",
          continuation: { type: "failure_finalize" },
          effectPayload: {
            stepStatus: exhausted ? "failed" : "waiting",
            outcome: "failed",
            subjectKind: "story_member",
            storyDbId: authenticated.storyDbId,
            storyId: authenticated.storyId,
            storyClaimGeneration: authenticated.storyClaimGeneration,
          },
        }),
      });
    });
    // Durable retry authority is the locked story/step state above. Mutable run
    // context is deliberately not part of this owner transaction or eligibility.
    return { advanced: false, runCompleted: false };
  }

  const authenticatedStoryWorktree = boundSubject
    && authenticatedV3Binding && authenticatedV3Success
    ? await authenticatedV3SupervisorStoryWorktree({
        runId: superviseStep.run_id,
        superviseStepDbId: superviseStep.id,
        runtimeSessionId: authenticatedRuntimeSessionId
          ?? (() => { throw new Error("V3_SUPERVISE_BOUND_RUNTIME_ID_REQUIRED"); })(),
        boundSubject,
      })
    : undefined;

  let story = undefined as Awaited<ReturnType<typeof findUnsupervisedDoneStory>>;
  if (boundSubject) {
    story = await pgGet<any>(
      "SELECT id, story_id, title, retry_count, max_retries, pr_url, story_branch, scope_files FROM stories WHERE run_id = $1 AND id = $2 AND story_id = $3 LIMIT 1",
      [superviseStep.run_id, boundSubject.storyDbId, boundSubject.storyId],
    );
    if (!story) throw new Error("SUPERVISE_EFFECT_BOUND_STORY_MISSING");
  }
  if (!story && !boundFinalProduct && superviseStep.current_story_id) {
    story = await pgGet<any>(
      "SELECT id, story_id, title, retry_count, max_retries, pr_url, story_branch, scope_files FROM stories WHERE run_id = $1 AND id = $2 AND status = 'done' LIMIT 1",
      [superviseStep.run_id, superviseStep.current_story_id],
    );
  }
  const reportedStoryId = parsedOutput["current_story_id"] || context["current_story_id"] || "";
  if (!story && !boundFinalProduct && reportedStoryId) {
    story = await pgGet<any>(
      "SELECT id, story_id, title, retry_count, max_retries, pr_url, story_branch, scope_files FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [superviseStep.run_id, reportedStoryId],
    );
  }
  if (!story && !boundFinalProduct) {
    story = await findUnsupervisedDoneStory(superviseStep.run_id, context);
  }

  if (ownerAlreadyCommitted) {
    const committed = await pgGet<{ status: string }>(
      "SELECT status FROM steps WHERE id = $1 AND run_id = $2",
      [superviseStep.id, superviseStep.run_id],
    );
    const expectedStatus = boundFinalProduct ? "done" : "waiting";
    if (committed?.status !== expectedStatus) {
      throw new Error(`SUPERVISE_EFFECT_RESUME_STATE_INVALID:${committed?.status ?? "missing"}`);
    }
  } else if (claimEnvelope) {
    if (boundFinalProduct) {
      await completeSingleStepClaimAndState(getSql(), {
        envelope: claimEnvelope,
        stepStatus: "done",
        stepOutput: output,
        clearCurrentStory: true,
        completionPlan: createSingleEffectCompletionPlanDescriptorV1({
          kind: "single_completion",
          continuation: { type: "single_pipeline_advance" },
          effectPayload: { supervisorStepDbId: superviseStep.id, subjectKind: "final_product" },
        }),
        diagnostic: "Final-product supervisor claim completed through exact authority",
      });
      if (deferContinuationToEffectLedger) return { advanced: false, runCompleted: false };
    } else if (!story) {
      throw new Error("SUPERVISE_COMPLETION_TARGET_STORY_MISSING");
    } else {
    const verifyTarget = await pgGet<{ id: string }>(
      "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [superviseStep.run_id, verifyStepName],
    );
    if (!verifyTarget) throw new Error("SUPERVISE_COMPLETION_VERIFY_TARGET_MISSING");
    await completeSingleStepClaimAndState(getSql(), {
      envelope: claimEnvelope,
      stepStatus: "waiting",
      stepOutput: output,
      clearCurrentStory: true,
      completionPlan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "single_completion",
        continuation: {
          type: "supervise_each_decision",
          targetStepDbId: verifyTarget.id,
          targetStepId: verifyStepName,
        },
        subject: {
          storyDbId: story.id,
          storyId: story.story_id,
          ...(story.pr_url && /^https?:\/\//.test(story.pr_url) ? { prUrl: story.pr_url } : {}),
        },
        effectPayload: { supervisorStepDbId: superviseStep.id },
      }),
      diagnostic: "Supervise-each claim completed through exact authority",
    });
    if (deferContinuationToEffectLedger) {
      return { advanced: false, runCompleted: false };
    }
    }
  } else {
    const changed = await pgBegin(async (sql) => {
      const updated = await sql.unsafe<Array<{ id: string }>>(
        "UPDATE steps SET status='waiting',output=$1,current_story_id=NULL,updated_at=$2 WHERE id=$3 AND status IN ('running','pending') RETURNING id",
        [output, now(), superviseStep.id],
      );
      if (updated.length === 0) return 0;
      if (updated.length !== 1) throw new Error("LEGACY_SUPERVISE_COMPLETION_CARDINALITY_INVALID");
      await closeLegacyClaimOwnersInTransaction(sql, {
        runId: superviseStep.run_id,
        workflowStepId: superviseStep.step_id,
        storyId: null,
        diagnostic: "Legacy supervise_each claim completed",
      });
      return 1;
    });
    if (changed === 0) return { advanced: false, runCompleted: false };
  }
  await recordStepTransition(
    superviseStep.id,
    superviseStep.run_id,
    "running",
    boundFinalProduct ? "done" : "waiting",
    undefined,
    "handleSuperviseEachCompletion",
  );
  if (!story) {
    if (boundFinalProduct) {
      delete context["previous_failure"];
      delete context["failure_category"];
      delete context["failure_suggestion"];
      delete context["current_story_id"];
      delete context["current_story_title"];
      delete context["current_story"];
      context["supervisor_scope"] = "final-product";
      await updateRunContext(superviseStep.run_id, context);
      await refreshRunContractSafe(superviseStep.run_id, `step.${superviseStep.step_id}.done`, context);
      if (await findActiveLoop(superviseStep.run_id)) return { advanced: false, runCompleted: false };
      return advancePipeline(superviseStep.run_id);
    }
    const finalSupervise = await shouldAutoCompleteFinalSuperviseEachStep(superviseStep.run_id, context);
    if (finalSupervise.ok) {
      delete context["previous_failure"];
      delete context["failure_category"];
      delete context["failure_suggestion"];
      context["supervisor_scope"] = "final-product";
      await updateRunContext(superviseStep.run_id, context);
      await pgRun("UPDATE steps SET status = 'done', output = $1, current_story_id = NULL, updated_at = $2 WHERE id = $3", [
        [
          "STATUS: done",
          "SUPERVISOR_DECISION: pass",
          `AC_COVERAGE: ${finalSupervise.reason}`,
          "CHECKS: deterministic supervise-each final gate accepted existing completion",
        ].join("\n"),
        now(),
        superviseStep.id,
      ]);
      await recordStepTransition(superviseStep.id, superviseStep.run_id, "waiting", "done", undefined, "superviseEach:final-completion-auto-complete");
      await refreshRunContractSafe(superviseStep.run_id, `step.${superviseStep.step_id}.done`, context);
      emitEvent({
        ts: now(),
        event: "step.done",
        runId: superviseStep.run_id,
        workflowId: await getWorkflowId(superviseStep.run_id),
        stepId: superviseStep.step_id,
        detail: "supervise_each deterministic final gate completed from completion path",
      });
      await recordObservation({
        runId: superviseStep.run_id,
        stepId: superviseStep.step_id,
        phase: superviseStep.step_id,
        checkId: "supervise_each.final_completion_auto_complete",
        status: "pass",
        label: "Supervise-each final completion accepted deterministically",
        detail: finalSupervise.reason,
      });
      return advancePipeline(superviseStep.run_id);
    }
    context["previous_failure"] = "SUPERVISE_EACH_ORPHAN: supervisor completed but no status=done story was available.";
    context["failure_category"] = "SUPERVISE_EACH_ORPHAN";
    await updateRunContext(superviseStep.run_id, context);
    await setStepStatus(loopStepId, "pending");
    logger.warn(`[handleSuperviseEach] No done story found; returning implement loop to pending`, { runId: superviseStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  const status = firstOutputWord(parsedOutput["status"] || context["status"]);
  const decision = firstOutputWord(parsedOutput["supervisor_decision"]);
  const issues = (parsedOutput["issues"] || parsedOutput["supervisor_memory_append"] || output || "").slice(0, 6000);
  const supervisorLedgerWorkdir = context["story_workdir"] || context["repo"] || "";

  try {
    const { updateSupervisorMemory } = await import("./product-supervisor.js");
    const summary = [
      `### ${new Date().toISOString()} llm-supervisor story ${story.story_id} ${decision || status || "unknown"}`,
      `- Step: ${superviseStep.step_id}`,
      `- Story: ${story.story_id} ${story.title}`,
      `- Decision: ${decision || status || "unknown"}`,
      `- Summary: ${(parsedOutput["supervisor_memory_append"] || parsedOutput["changes"] || parsedOutput["checks"] || issues || "").slice(0, 1200)}`,
    ].join("\n");
    updateSupervisorMemory(context, `${summary}\n`);
  } catch (e) { logger.warn(`[handleSuperviseEach] Could not update supervisor memory: ${String(e).slice(0, 150)}`, { runId: superviseStep.run_id }); }

  if ((authenticatedV3Binding && !authenticatedV3Success)
    || status === "retry"
    || decision === "block"
    || decision === "blocked") {
    const newRetry = (story.retry_count || 0) + 1;
    context["previous_failure"] = `LLM_SUPERVISOR_BLOCKED for ${story.story_id}:\n${issues}`;
    context["failure_category"] = "LLM_SUPERVISOR_BLOCKED";
    context["failure_suggestion"] = "Return to the same story branch, fix the manager/audit blocker, then report STATUS: done again.";
    context["current_story_id"] = story.story_id;
    context["current_story_title"] = story.title;
    if (story.story_branch) context["story_branch"] = story.story_branch;
    clearStorySupervised(context, story.story_id);
    if (supervisorLedgerWorkdir) {
      upsertSupervisorRunMetadata({
        workdir: supervisorLedgerWorkdir,
        runId: superviseStep.run_id,
        scope: "story",
        status: "blocked",
        mainRepo: context["repo"] || "",
        storyId: story.story_id,
        storyWorkdir: supervisorLedgerWorkdir,
      });
      markSupervisorInterventions({
        workdir: supervisorLedgerWorkdir,
        runId: superviseStep.run_id,
        storyId: story.story_id,
        result: "sent",
      });
    }

    if (newRetry > (story.max_retries || 0)) {
      const terminalRetry = Math.max(0, story.max_retries || 0);
      await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, issues, now(), story.id]);
      await updateRunContext(superviseStep.run_id, context);
      await setStepStatus(loopStepId, "failed");
      await failRun(superviseStep.run_id, true);
      const wfId = await getWorkflowId(superviseStep.run_id);
      emitEvent({ ts: now(), event: "story.failed", runId: superviseStep.run_id, workflowId: wfId, stepId: superviseStep.step_id, storyId: story.story_id });
      emitEvent({ ts: now(), event: "run.failed", runId: superviseStep.run_id, workflowId: wfId, detail: "Supervisor retries exhausted" });
      scheduleRunCronTeardown(superviseStep.run_id);
      return { advanced: false, runCompleted: false };
    }

    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, updated_at = $3 WHERE id = $4",
      [newRetry, issues, now(), story.id],
    );
    await updateRunContext(superviseStep.run_id, context);
    await setStepStatus(loopStepId, "pending");
    await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_id = $3", [now(), superviseStep.run_id, verifyStepName]);
    emitEvent({ ts: now(), event: "story.retry", runId: superviseStep.run_id, workflowId: await getWorkflowId(superviseStep.run_id), stepId: superviseStep.step_id, storyId: story.story_id, detail: issues.slice(0, 500) });
    logger.warn(`[supervise-each] Supervisor blocked ${story.story_id}; returning to implement`, { runId: superviseStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  let supervisorWorkdir = authenticatedStoryWorktree?.workdir
    ?? (context["story_workdir"] || context["repo"] || "");
  if (!authenticatedStoryWorktree) try {
    const { resolveStoryWorktree } = await import("./steps/06-implement/guards.js");
    const resolved = await resolveStoryWorktree(story.id, context["story_workdir"] || "");
    if (resolved) {
      supervisorWorkdir = resolved;
      context["story_workdir"] = resolved;
    }
  } catch (e) {
    logger.warn(`[supervise-each] Could not resolve story worktree for ${story.story_id}: ${String(e).slice(0, 150)}`, { runId: superviseStep.run_id });
  }

  const blockingSupervisorEvidence = findBlockingSupervisorEvidenceForStory(
    [supervisorLedgerWorkdir, supervisorWorkdir],
    superviseStep.run_id,
    story.story_id,
    story.story_branch,
  );
  if (blockingSupervisorEvidence) {
    const newRetry = (story.retry_count || 0) + 1;
    const failure = blockingSupervisorEvidence.detail.slice(0, 6000);
    if (authenticatedV3Binding && boundSubject) {
      if (!authenticatedRuntimeSessionId) throw new Error("V3_SUPERVISE_POST_OWNER_RUNTIME_ID_REQUIRED");
      const exhausted = newRetry > (story.max_retries || 0);
      let exactRejectedSource: Readonly<{ sha: string; treeHash: string }> | undefined;
      if (!exhausted) {
        await revalidateAuthenticatedV3SupervisorStoryWorktree(authenticatedStoryWorktree!);
        assertExactGitBranchWorktree(supervisorWorkdir, authenticatedStoryWorktree!.storyBranch);
        const evidenceCommit = commitStoryWorktreeScopeIfNeeded(
          supervisorWorkdir,
          story.story_id,
          story.title || "",
          parseDeclaredScopeFiles(story.scope_files),
          "fix",
        );
        if (evidenceCommit.error) throw new Error(`PLATFORM_SUPERVISOR_COMMIT_FAILED for ${story.story_id}: ${evidenceCommit.error}`);
        await revalidateAuthenticatedV3SupervisorStoryWorktree(authenticatedStoryWorktree!);
        assertExactGitBranchWorktree(supervisorWorkdir, authenticatedStoryWorktree!.storyBranch);
        const evidencePush = pushStoryBranch(supervisorWorkdir, authenticatedStoryWorktree!.storyBranch);
        if (evidencePush.error) throw new Error(`PLATFORM_SUPERVISOR_PUSH_FAILED for ${story.story_id}: ${evidencePush.error}`);
        exactRejectedSource = captureExactCleanBoundStoryRevision(
          supervisorWorkdir,
          authenticatedStoryWorktree!.storyBranch,
        );
      }
      await publishAuthenticatedV3SupervisorPostOwnerRetry({
        runId: superviseStep.run_id,
        superviseStepDbId: superviseStep.id,
        loopStepDbId: loopStepId,
        verifyStepName,
        runtimeSessionId: authenticatedRuntimeSessionId,
        output,
        feedback: failure,
        boundSubject,
        ...(exactRejectedSource ? { sourceRevision: exactRejectedSource } : {}),
      });
      return { advanced: false, runCompleted: false };
    }
    context["previous_failure"] = failure;
    context["failure_category"] = blockingSupervisorEvidence.category;
    context["failure_suggestion"] = "Return to the same story branch and fix the supervisor evidence blocker before verify can run. The LLM supervisor pass cannot override open visual/state evidence.";
    context["current_story_id"] = story.story_id;
    context["current_story_title"] = story.title;
    if (story.story_branch) context["story_branch"] = story.story_branch;
    clearStorySupervised(context, story.story_id);
    if (supervisorWorkdir) {
      upsertSupervisorRunMetadata({
        workdir: supervisorWorkdir,
        runId: superviseStep.run_id,
        scope: "story",
        status: "blocked",
        mainRepo: context["repo"] || "",
        storyId: story.story_id,
        storyWorkdir: supervisorWorkdir,
      });
      markSupervisorInterventions({
        workdir: supervisorWorkdir,
        runId: superviseStep.run_id,
        storyId: story.story_id,
        result: "sent",
      });
    }
    await recordObservation({
      runId: superviseStep.run_id,
      stepId: superviseStep.step_id,
      storyId: story.story_id,
      phase: superviseStep.step_id,
      checkId: "supervise_each.supervisor_evidence_blocked",
      status: "fail",
      label: "Supervisor evidence blocked story",
      detail: failure.slice(0, 1800),
    });

    if (newRetry > (story.max_retries || 0)) {
      const terminalRetry = Math.max(0, story.max_retries || 0);
      await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), story.id]);
      await updateRunContext(superviseStep.run_id, context);
      await setStepStatus(loopStepId, "failed");
      await failRun(superviseStep.run_id, true);
      const wfId = await getWorkflowId(superviseStep.run_id);
      emitEvent({ ts: now(), event: "story.failed", runId: superviseStep.run_id, workflowId: wfId, stepId: superviseStep.step_id, storyId: story.story_id, detail: blockingSupervisorEvidence.message });
      emitEvent({ ts: now(), event: "run.failed", runId: superviseStep.run_id, workflowId: wfId, detail: blockingSupervisorEvidence.message });
      scheduleRunCronTeardown(superviseStep.run_id);
      return { advanced: false, runCompleted: false };
    }

    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, updated_at = $3 WHERE id = $4",
      [newRetry, failure, now(), story.id],
    );
    await updateRunContext(superviseStep.run_id, context);
    await setStepStatus(loopStepId, "pending");
    await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_id = $3", [now(), superviseStep.run_id, verifyStepName]);
    emitEvent({ ts: now(), event: "story.retry", runId: superviseStep.run_id, workflowId: await getWorkflowId(superviseStep.run_id), stepId: superviseStep.step_id, storyId: story.story_id, detail: failure.slice(0, 500) });
    logger.warn(`[supervise-each] Supervisor evidence blocked ${story.story_id}; returning to implement`, { runId: superviseStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  if (authenticatedStoryWorktree) {
    await revalidateAuthenticatedV3SupervisorStoryWorktree(authenticatedStoryWorktree);
    assertExactGitBranchWorktree(supervisorWorkdir, authenticatedStoryWorktree.storyBranch);
  }
  const supervisorCommit = commitStoryWorktreeScopeIfNeeded(
    supervisorWorkdir,
    story.story_id,
    story.title || "",
    parseDeclaredScopeFiles(story.scope_files),
    "fix",
  );
  if (supervisorCommit.error) {
    const newRetry = (story.retry_count || 0) + 1;
    const failure = `PLATFORM_SUPERVISOR_COMMIT_FAILED for ${story.story_id}: ${supervisorCommit.error}`;
    if (authenticatedStoryWorktree && /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/i.test(supervisorCommit.error)) {
      await revalidateAuthenticatedV3SupervisorStoryWorktree(authenticatedStoryWorktree);
      assertExactGitBranchWorktree(supervisorWorkdir, authenticatedStoryWorktree.storyBranch);
    }
    const cleanedScopeBlockedFiles = /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/i.test(supervisorCommit.error)
      ? cleanupBlockedStoryCommitScope(
          supervisorWorkdir,
          story.story_id,
          parseDeclaredScopeFiles(story.scope_files),
          superviseStep.run_id,
        )
      : [];
    if (authenticatedV3Binding && boundSubject) throw new Error(failure);
    context["previous_failure"] = failure;
    context["failure_category"] = "PLATFORM_SUPERVISOR_COMMIT_FAILED";
    context["failure_suggestion"] = cleanedScopeBlockedFiles.length > 0
      ? `Supervisor left out-of-scope code; Setfarm cleaned ${cleanedScopeBlockedFiles.length} dirty file(s). Retry the same story using only scope_files.`
      : "Supervisor left uncommitted or out-of-scope code. Return to the same story branch, keep edits inside scope_files, and do not let verify run until platform commit succeeds.";
    if (cleanedScopeBlockedFiles.length > 0) {
      context["scope_bleed_cleanup"] = `Cleaned ${cleanedScopeBlockedFiles.length} out-of-scope file(s) after supervisor commit scope block: ${cleanedScopeBlockedFiles.slice(0, 5).join(", ")}`;
    }
    context["current_story_id"] = story.story_id;
    context["current_story_title"] = story.title;
    if (story.story_branch) context["story_branch"] = story.story_branch;
    clearStorySupervised(context, story.story_id);
    if (supervisorWorkdir) {
      upsertSupervisorRunMetadata({
        workdir: supervisorWorkdir,
        runId: superviseStep.run_id,
        scope: "story",
        status: "blocked",
        mainRepo: context["repo"] || "",
        storyId: story.story_id,
        storyWorkdir: supervisorWorkdir,
      });
    }
    if (cleanedScopeBlockedFiles.length > 0) {
      await recordObservation({
        runId: superviseStep.run_id,
        stepId: superviseStep.step_id,
        storyId: story.story_id,
        phase: superviseStep.step_id,
        checkId: "supervise_each.platform_commit_scope_cleanup",
        status: "pass",
        label: "Supervisor scope cleanup",
        detail: cleanedScopeBlockedFiles.join("\n"),
      });
    }
    if (newRetry > (story.max_retries || 0)) {
      const terminalRetry = Math.max(0, story.max_retries || 0);
      await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), story.id]);
      await updateRunContext(superviseStep.run_id, context);
      await setStepStatus(loopStepId, "failed");
      await failRun(superviseStep.run_id, true);
      const wfId = await getWorkflowId(superviseStep.run_id);
      emitEvent({ ts: now(), event: "story.failed", runId: superviseStep.run_id, workflowId: wfId, stepId: superviseStep.step_id, storyId: story.story_id });
      emitEvent({ ts: now(), event: "run.failed", runId: superviseStep.run_id, workflowId: wfId, detail: failure.slice(0, 500) });
      scheduleRunCronTeardown(superviseStep.run_id);
      return { advanced: false, runCompleted: false };
    }
    await pgRun(
      "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, updated_at = $3 WHERE id = $4",
      [newRetry, failure, now(), story.id],
    );
    await updateRunContext(superviseStep.run_id, context);
    await setStepStatus(loopStepId, "pending");
    await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_id = $3", [now(), superviseStep.run_id, verifyStepName]);
    emitEvent({ ts: now(), event: "story.retry", runId: superviseStep.run_id, workflowId: await getWorkflowId(superviseStep.run_id), stepId: superviseStep.step_id, storyId: story.story_id, detail: failure.slice(0, 500) });
    logger.warn(`[supervise-each] Supervisor fixes for ${story.story_id} could not be platform-committed; returning to implement`, { runId: superviseStep.run_id });
    return { advanced: false, runCompleted: false };
  }
  if (supervisorCommit.committed || (authenticatedV3Binding && boundSubject)) {
    if (authenticatedStoryWorktree) {
      await revalidateAuthenticatedV3SupervisorStoryWorktree(authenticatedStoryWorktree);
      assertExactGitBranchWorktree(supervisorWorkdir, authenticatedStoryWorktree.storyBranch);
    }
    const pushResult = pushStoryBranch(
      supervisorWorkdir,
      authenticatedStoryWorktree?.storyBranch ?? (story.story_branch || context["story_branch"]),
    );
    if (pushResult.error) {
      const newRetry = (story.retry_count || 0) + 1;
      const failure = `PLATFORM_SUPERVISOR_PUSH_FAILED for ${story.story_id}: ${pushResult.error}`;
      if (authenticatedV3Binding && boundSubject) throw new Error(failure);
      context["previous_failure"] = failure;
      context["failure_category"] = "PLATFORM_SUPERVISOR_PUSH_FAILED";
      context["failure_suggestion"] = "Supervisor fixes were committed locally but could not be pushed to the story branch. Fix platform git/remote state before verify.";
      context["current_story_id"] = story.story_id;
      context["current_story_title"] = story.title;
      if (story.story_branch) context["story_branch"] = story.story_branch;
      clearStorySupervised(context, story.story_id);
      if (supervisorWorkdir) {
        upsertSupervisorRunMetadata({
          workdir: supervisorWorkdir,
          runId: superviseStep.run_id,
          scope: "story",
          status: "blocked",
          mainRepo: context["repo"] || "",
          storyId: story.story_id,
          storyWorkdir: supervisorWorkdir,
        });
      }
      if (newRetry > (story.max_retries || 0)) {
        const terminalRetry = Math.max(0, story.max_retries || 0);
        await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, failure, now(), story.id]);
        await updateRunContext(superviseStep.run_id, context);
        await setStepStatus(loopStepId, "failed");
        await failRun(superviseStep.run_id, true);
        const wfId = await getWorkflowId(superviseStep.run_id);
        emitEvent({ ts: now(), event: "story.failed", runId: superviseStep.run_id, workflowId: wfId, stepId: superviseStep.step_id, storyId: story.story_id });
        emitEvent({ ts: now(), event: "run.failed", runId: superviseStep.run_id, workflowId: wfId, detail: failure.slice(0, 500) });
        scheduleRunCronTeardown(superviseStep.run_id);
        return { advanced: false, runCompleted: false };
      }
      await pgRun(
        "UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, pr_url = NULL, merge_status = NULL, updated_at = $3 WHERE id = $4",
        [newRetry, failure, now(), story.id],
      );
      await updateRunContext(superviseStep.run_id, context);
      await setStepStatus(loopStepId, "pending");
      await pgRun("UPDATE steps SET status = 'waiting', retry_count = 0, current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND step_id = $3", [now(), superviseStep.run_id, verifyStepName]);
      emitEvent({ ts: now(), event: "story.retry", runId: superviseStep.run_id, workflowId: await getWorkflowId(superviseStep.run_id), stepId: superviseStep.step_id, storyId: story.story_id, detail: failure.slice(0, 500) });
      logger.warn(`[supervise-each] Supervisor fixes for ${story.story_id} could not be pushed; returning to implement`, { runId: superviseStep.run_id });
      return { advanced: false, runCompleted: false };
    }
    if (supervisorCommit.committed) {
      context["platform_supervisor_commit"] = `${story.story_id}:${supervisorCommit.sha}:${supervisorCommit.stagedFiles.join(",")}`.slice(0, 1200);
      logger.info(`[platform-supervisor-commit] ${story.story_id} committed ${supervisorCommit.stagedFiles.length} supervisor file(s) at ${supervisorCommit.sha}`, { runId: superviseStep.run_id });
    }
  }

  const acCoverage = parsedOutput["ac_coverage"] || "";
  const stateWorkdirs = [...new Set([supervisorLedgerWorkdir, supervisorWorkdir].filter(Boolean))];
  for (const stateWorkdir of stateWorkdirs) {
    try {
      markStorySupervisorStatePassedInWorkdir(stateWorkdir, superviseStep.run_id, story.story_id, decision || status || "pass", acCoverage);
    } catch (e) {
      logger.warn(`[supervise-each] Could not clear supervisor state for ${story.story_id} in ${stateWorkdir}: ${String(e).slice(0, 150)}`, { runId: superviseStep.run_id });
    }
  }

  markStorySupervised(context, story.story_id);
  context["supervisor_scope"] = "story";
  context["current_story_id"] = story.story_id;
  context["current_story_title"] = story.title;
  if (story.pr_url) context["pr_url"] = story.pr_url;
  if (story.story_branch) context["story_branch"] = story.story_branch;
  clearVerifiedStoryFailureContext(context);
  if (supervisorWorkdir) {
    upsertSupervisorRunMetadata({
      workdir: supervisorWorkdir,
      runId: superviseStep.run_id,
      scope: "story",
      status: decision === "fixed" ? "done" : "passed",
      mainRepo: context["repo"] || "",
      storyId: story.story_id,
      storyWorkdir: supervisorWorkdir,
    });
    markSupervisorInterventions({
      workdir: supervisorWorkdir,
      runId: superviseStep.run_id,
      storyId: story.story_id,
      result: "resolved",
    });
  }
  await updateRunContext(superviseStep.run_id, context);

  await recordObservation({
    runId: superviseStep.run_id,
    stepId: superviseStep.step_id,
    storyId: story.story_id,
    phase: superviseStep.step_id,
    checkId: "supervise_each.llm_story_decision",
    status: "pass",
    label: "Supervisor decision",
    detail: acCoverage || issues.slice(0, 1800) || "Supervisor passed story gate",
    metadata: { decision: decision || status || "pass" },
  });

  await pgRun(
    "UPDATE steps SET status = 'pending', updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status IN ('waiting', 'done', 'pending')",
    [now(), superviseStep.run_id, verifyStepName],
  );
  await pgRun("UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2", [now(), loopStepId]);
  logger.info(`[supervise-each] Supervisor passed ${story.story_id}; verify queued`, { runId: superviseStep.run_id });
  return { advanced: false, runCompleted: false };
}

/**
 * Handle verify-each completion: pass or fail the story.
 */
async function handleVerifyEachCompletion(
  verifyStep: { id: string; run_id: string; step_id: string; step_index: number },
  loopStepId: string,
  output: string,
  context: Record<string, string>,
  claimEnvelope?: ClaimEnvelopeV1,
  ownerAlreadyCommitted = false,
  boundSubject?: RuntimeCompletionSubjectV1,
  deferContinuationToEffectLedger = false,
): Promise<{ advanced: boolean; runCompleted: boolean }> {
  const parsedOutput = parseOutputKeyValues(output);
  const verifyRunProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [verifyStep.run_id],
  );

  // Guard: strip protected keys from parsed output to prevent seed value corruption
  for (const key of PROTECTED_CONTEXT_KEYS) {
    if (key in parsedOutput) {
      logger.warn(`[handleVerifyEach] Stripped protected key "${key}" from output`, { runId: verifyStep.run_id });
      delete parsedOutput[key];
    }
  }

  let status = firstOutputWord(parsedOutput["status"] || context["status"]);
  const reportedMergedPrUrl = parsedOutput["merged_pr"] || "";
  if (reportedMergedPrUrl) {
    invalidatePRStateCache(reportedMergedPrUrl);
    context["pr_url"] = reportedMergedPrUrl;
  }

  // Identify the story being verified. An effect-bound subject is
  // authoritative; PR URL and explicit output follow. Context is weakest and
  // may select only a story that is still in the exact done state.
  // Recovery consumes the immutable subject from the completion plan and
  // never re-selects a mutable "latest done" story.
  let verifiedStoryId = boundSubject?.storyId ?? "";
  if (boundSubject) {
    const bound = await pgGet<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3 LIMIT 1",
      [boundSubject.storyDbId, verifyStep.run_id, boundSubject.storyId],
    );
    if (!bound) throw new Error("VERIFY_EFFECT_BOUND_STORY_MISSING");
  }
  if (!verifiedStoryId && reportedMergedPrUrl) {
    const byPr = await pgGet<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE run_id = $1 AND pr_url = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, reportedMergedPrUrl],
    );
    if (byPr) verifiedStoryId = byPr.story_id;
  }
  const reportedStoryId = parsedOutput["current_story_id"] || "";
  if (!verifiedStoryId && reportedStoryId) {
    const byReportedStory = await pgGet<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, reportedStoryId],
    );
    if (byReportedStory) {
      verifiedStoryId = byReportedStory.story_id;
    } else {
      logger.warn(`[verify] Ignoring reported current_story_id ${reportedStoryId}; story is not status=done`, { runId: verifyStep.run_id });
    }
  }
  const contextStoryId = context["current_story_id"] || "";
  if (!verifiedStoryId && contextStoryId) {
    const byContextStory = await pgGet<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, contextStoryId],
    );
    if (byContextStory) {
      verifiedStoryId = byContextStory.story_id;
    } else {
      logger.warn(`[verify] Ignoring stale context current_story_id ${contextStoryId}; story is not status=done`, { runId: verifyStep.run_id });
    }
  }
  if (!verifiedStoryId) {
    const candidates = await pgQuery<{ story_id: string }>(
      "SELECT story_id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 2",
      [verifyStep.run_id],
    );
    if (candidates.length !== 1) {
      throw new Error(`VERIFY_COMPLETION_TARGET_AMBIGUOUS:${candidates.length}`);
    }
    verifiedStoryId = candidates[0]!.story_id;
  }
  const verifiedTarget = await pgGet<{ id: string; story_id: string; pr_url: string | null }>(
    "SELECT id, story_id, pr_url FROM stories WHERE run_id = $1 AND story_id = $2 LIMIT 1",
    [verifyStep.run_id, verifiedStoryId],
  );
  if (!verifiedTarget) throw new Error("VERIFY_COMPLETION_TARGET_STORY_MISSING");

  // Atomic guard: prevent parallel crons from double-completing the same verify step.
  // Only proceed if we are the one that transitions it from running → waiting.
  if (ownerAlreadyCommitted) {
    const committed = await pgGet<{ status: string }>(
      "SELECT status FROM steps WHERE id = $1 AND run_id = $2",
      [verifyStep.id, verifyStep.run_id],
    );
    if (committed?.status !== "waiting") {
      throw new Error(`VERIFY_EFFECT_RESUME_STATE_INVALID:${committed?.status ?? "missing"}`);
    }
  } else if (claimEnvelope) {
    await completeSingleStepClaimAndState(getSql(), {
      envelope: claimEnvelope,
      stepStatus: "waiting",
      stepOutput: output,
      completionPlan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "single_completion",
        continuation: {
          type: "verify_each_decision",
          targetStepDbId: loopStepId,
          targetStepId: "implement",
        },
        subject: {
          storyDbId: verifiedTarget.id,
          storyId: verifiedTarget.story_id,
          ...((reportedMergedPrUrl || verifiedTarget.pr_url) && /^https?:\/\//.test(reportedMergedPrUrl || verifiedTarget.pr_url || "")
            ? { prUrl: reportedMergedPrUrl || verifiedTarget.pr_url! }
            : {}),
        },
        effectPayload: { verifyStepDbId: verifyStep.id },
      }),
      diagnostic: "Verify-each claim completed through exact authority",
    });
    if (deferContinuationToEffectLedger) {
      return { advanced: false, runCompleted: false };
    }
  } else {
    const changed = await pgBegin(async (sql) => {
      const updated = await sql.unsafe<Array<{ id: string }>>(
        "UPDATE steps SET status='waiting',output=$1,updated_at=$2 WHERE id=$3 AND status='running' RETURNING id",
        [output, now(), verifyStep.id],
      );
      if (updated.length === 0) return 0;
      if (updated.length !== 1) throw new Error("LEGACY_VERIFY_COMPLETION_CARDINALITY_INVALID");
      await closeLegacyClaimOwnersInTransaction(sql, {
        runId: verifyStep.run_id,
        workflowStepId: verifyStep.step_id,
        storyId: null,
        diagnostic: "Legacy verify_each claim completed",
      });
      return 1;
    });
    if (changed === 0) return { advanced: false, runCompleted: false };
  }
  await recordStepTransition(verifyStep.id, verifyStep.run_id, "running", "waiting", undefined, "handleVerifyEachCompletion");
  if (status === "retry" && verifiedStoryId && isPlatformMetadataOnlyVerifyRetry(output)) {
    const row = await pgGet<{ pr_url: string | null }>(
      "SELECT pr_url FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, verifiedStoryId],
    );
    if (row?.pr_url && getPRState(row.pr_url) === "MERGED") {
      context["verify_platform_metadata_retry_ignored"] = `${verifiedStoryId}:${new Date().toISOString()}`;
      status = "done";
      logger.warn(`[verify] Ignoring platform metadata-only retry for ${verifiedStoryId}; PR is merged and product checks are not blocked`, { runId: verifyStep.run_id });
    }
  }

  if (status === "retry") {
    const issues = resolveVerifyRetryIssues(parsedOutput, context, output);
    if (verifiedStoryId && isVerifyRetryOutsideStoryVisualScope(issues, context, verifiedStoryId)) {
      context["verify_visual_scope_deferred"] = `${verifiedStoryId}:${new Date().toISOString()}`;
      context["failure_category"] = "VISUAL_QA_SCOPE_DEFERRED";
      context["failure_suggestion"] = "Retry verify with story-scoped visual QA deferred to the screen-owner story.";
      delete context["verify_feedback"];
      delete context["previous_failure"];
      await updateRunContext(verifyStep.run_id, context);
      await pgRun(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
        [now(), verifyStep.id],
      );
      await pgRun(
        "UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2",
        [now(), loopStepId],
      );
      emitEvent({
        ts: now(),
        event: "step.progress",
        runId: verifyStep.run_id,
        workflowId: await getWorkflowId(verifyStep.run_id),
        stepId: verifyStep.step_id,
        storyId: verifiedStoryId,
        detail: `Deferred visual retry outside ${verifiedStoryId} screen ownership.`,
      });
      logger.warn(`[verify] Deferred visual retry outside ${verifiedStoryId} screen ownership; retrying verify without returning to implement`, { runId: verifyStep.run_id });
      return { advanced: false, runCompleted: false };
    }

    if (isVerifyRetryInfraFailure(output)) {
      context["verify_infra_retry"] = issues.slice(0, 4000);
      context["failure_category"] = "VISUAL_QA_INFRA_ERROR";
      context["failure_suggestion"] = "Retry verify after browser/visual QA infrastructure recovers; do not send the story back to implementation for infrastructure-only browser failures.";
      delete context["verify_feedback"];
      delete context["previous_failure"];
      await updateRunContext(verifyStep.run_id, context);
      await pgRun(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
        [now(), verifyStep.id],
      );
      await pgRun(
        "UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2",
        [now(), loopStepId],
      );
      emitEvent({
        ts: now(),
        event: "step.progress",
        runId: verifyStep.run_id,
        workflowId: await getWorkflowId(verifyStep.run_id),
        stepId: verifyStep.step_id,
        storyId: verifiedStoryId || undefined,
        detail: issues.slice(0, 800),
      });
      logger.warn(`[verify] Infrastructure-only verify retry for ${verifiedStoryId || "unknown story"}; keeping story done and retrying verify`, { runId: verifyStep.run_id });
      return { advanced: false, runCompleted: false };
    }

    // Verify failed — retry the story
    // Find the specific story that was being verified
    let retryStory: { id: string; retry_count: number; max_retries: number } | undefined;
    if (verifiedStoryId) {
      retryStory = await pgGet<typeof retryStory>("SELECT id, retry_count, max_retries FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1", [verifyStep.run_id, verifiedStoryId]);
    }
    // Fallback: last done story by updated_at
    if (!retryStory) {
      retryStory = await pgGet<typeof retryStory>("SELECT id, retry_count, max_retries FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1", [verifyStep.run_id]);
    }

    if (retryStory) {
      const newRetry = retryStory.retry_count + 1;
      const failureCategory = isVerifyRetryMergeBlocker(issues) ? "VERIFY_MERGE_BLOCKER" : undefined;
      const failureSuggestion = failureCategory
        ? "Resolve the conflicting PR/story branch state in the same story branch, push it, and do not route this to QA-FIX."
        : undefined;
      context["verify_feedback"] = issues;
      context["previous_failure"] = issues;
      if (failureCategory) context["failure_category"] = failureCategory;
      if (failureSuggestion) context["failure_suggestion"] = failureSuggestion;

	      if (newRetry > retryStory.max_retries) {
	        if (await shouldDeferVerifyRetryExhaustionForResolvedEvidence(verifyStep.run_id, verifiedStoryId, issues, context)) {
	          context["verify_retry_exhaustion_deferred"] = `${verifiedStoryId}:${new Date().toISOString()}`;
	          context["failure_category"] = "VERIFY_STALE_VISUAL_RETRY_DEFERRED";
	          context["failure_suggestion"] = "Fresh story pass evidence exists after the visual retry source was resolved; rerun verify once instead of terminally failing on stale retry output.";
	          delete context["verify_feedback"];
	          delete context["previous_failure"];
	          await updateRunContext(verifyStep.run_id, context);
	          await recordGateObservation({
	            runId: verifyStep.run_id,
	            stepId: verifyStep.step_id,
	            storyId: verifiedStoryId,
	            checkId: "verify.retry_exhaustion.deferred",
	            label: "Verify retry exhaustion deferred",
	            status: "retry",
	            summary: "Retry exhaustion deferred because current story pass evidence resolves the visual blocker.",
	            detail: issues.slice(0, 1500),
	            metadata: { retryCount: newRetry, maxRetries: retryStory.max_retries },
	          });
	          await pgRun(
	            "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = $1 WHERE id = $2",
	            [now(), verifyStep.id],
	          );
	          await pgRun(
	            "UPDATE steps SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = $1 WHERE id = $2",
	            [now(), loopStepId],
	          );
	          logger.warn(`[verify] Deferred retry exhaustion for ${verifiedStoryId}; stale visual retry has newer pass evidence`, { runId: verifyStep.run_id });
	          return { advanced: false, runCompleted: false };
	        }
	        // Story retries exhausted — fail everything (Wave 13 J-2: terminal flag)
	        const terminalRetry = Math.max(0, retryStory.max_retries);
	        await pgRun("UPDATE stories SET status = 'failed', retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [terminalRetry, issues, now(), retryStory.id]);
        await updateRunContext(verifyStep.run_id, context);
        await setStepStatus(loopStepId, "failed");
        await failRun(verifyStep.run_id, true);
        const wfId = await getWorkflowId(verifyStep.run_id);
        emitEvent({ ts: now(), event: "story.failed", runId: verifyStep.run_id, workflowId: wfId, stepId: verifyStep.step_id });
        emitEvent({ ts: now(), event: "run.failed", runId: verifyStep.run_id, workflowId: wfId, detail: "Verification retries exhausted" });
        scheduleRunCronTeardown(verifyStep.run_id);
        return { advanced: false, runCompleted: false };
      }

      // Set story back to pending for retry
      await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = $1, output = $2, updated_at = $3 WHERE id = $4", [newRetry, issues, now(), retryStory.id]);
      emitEvent({ ts: now(), event: "story.retry", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, detail: issues });
      await updateRunContext(verifyStep.run_id, context);
    }

    // Set loop step back to pending for retry
    await setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }

  // Verify PASSED — mark the verified story as 'verified' (not just 'done')
  if (verifiedStoryId) {
    const verifiedRow = await pgGet<{ id: string; pr_url: string | null; story_branch: string | null }>(
      "SELECT id, pr_url, story_branch FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1",
      [verifyStep.run_id, verifiedStoryId],
    );
    if (verifiedRow) {
      if (!verifiedRow.pr_url) {
        context["previous_failure"] = `PR_MISSING: ${verifiedStoryId} cannot be verified until a PR exists and is merged into main.`;
        context["failure_category"] = "PR_MISSING";
        context["failure_suggestion"] = "Create or recover the story PR before verify runs. A story cannot be verified from local worktree output alone.";
        context["current_story_id"] = verifiedStoryId;
        if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
        await updateRunContext(verifyStep.run_id, context);
        await setStepStatus(verifyStep.id, "pending");
        logger.warn(`[verify] ${verifiedStoryId} reported done but has no PR URL — keeping verify pending`, { runId: verifyStep.run_id });
        return { advanced: false, runCompleted: false };
      }
      if (verifyRunProtocol?.protocol === "v3") {
        try {
          const exactReview = await readDefaultGithubReview({
            prUrl: verifiedRow.pr_url,
            repositoryPath: context["repo"] || context["REPO"] || "",
          });
          if (exactReview.actionableThreads.length > 0) {
            context["v3_review_late_head_sha"] = exactReview.headSha;
            context["v3_review_late_thread_ids"] = JSON.stringify(
              exactReview.actionableThreads.map((thread) => thread.threadId).sort(),
            );
            context["pr_url"] = verifiedRow.pr_url;
            context["current_story_id"] = verifiedStoryId;
            if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
            await updateRunContext(verifyStep.run_id, context);
            await setStepStatus(verifyStep.id, "pending");
            await recordObservation({
              runId: verifyStep.run_id,
              stepId: verifyStep.step_id,
              storyId: verifiedStoryId,
              phase: "verify",
              checkId: `v3.github-review.late:${exactReview.headSha}`,
              label: "V3 late exact GitHub review evidence",
              status: "retry",
              summary: `${exactReview.actionableThreads.length} exact actionable thread(s) arrived before merge`,
              detail: "Verification claim completed without merging; the next exact verify claim will authorize canonical recovery.",
              evidence: {
                schema: "setfarm.v3-github-review-late-evidence.v1",
                headSha: exactReview.headSha,
                threadIds: exactReview.actionableThreads.map((thread) => thread.threadId).sort(),
              },
            });
            logger.warn(`[v3-review] ${verifiedStoryId} received exact actionable review evidence before merge; queued typed routing`, { runId: verifyStep.run_id });
            return { advanced: false, runCompleted: false };
          }
        } catch (error) {
          const code = v3ReviewErrorCode(error);
          context["previous_failure"] = `${code}: exact GitHub review state could not be re-read before merge`;
          context["failure_category"] = "V3_GITHUB_REVIEW_EVIDENCE_UNAVAILABLE";
          context["failure_suggestion"] = "Retry through a new exact verify claim; never merge from stale or prose-derived review state.";
          context["pr_url"] = verifiedRow.pr_url;
          context["current_story_id"] = verifiedStoryId;
          await updateRunContext(verifyStep.run_id, context);
          await setStepStatus(verifyStep.id, "pending");
          logger.warn(`[v3-review] ${code}; merge blocked until exact review state can be re-read`, { runId: verifyStep.run_id });
          return { advanced: false, runCompleted: false };
        }
      } else {
        const prReviewCommentsFailure = await detectOpenPrReviewCommentFailure(
          verifiedRow.pr_url,
          verifiedStoryId,
          context,
          verifyStep.run_id,
          verifyStep.step_id,
        );
        if (prReviewCommentsFailure) {
          if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
          context["pr_url"] = verifiedRow.pr_url;
          context["current_story_id"] = verifiedStoryId;
          await routeVerifyScopeFailureToImplement(verifyStep as StepRow, context, verifiedStoryId, prReviewCommentsFailure, {
            category: "PR_REVIEW_COMMENTS_OPEN",
            suggestion: "Address every actionable PR review comment in the same story branch. Setfarm must not resolve current actionable review threads; verify only passes after the comments are no longer actionable from a real code change or reviewer action.",
          });
          await setStepStatus(verifyStep.id, "waiting");
          logger.warn(`[verify-pr-comments] ${verifiedStoryId} has actionable PR review comments — routed back to implement before merge`, { runId: verifyStep.run_id });
          return { advanced: false, runCompleted: false };
        }
      }
      let prState = await fetchFreshPrStateName(verifiedRow.pr_url, verifiedStoryId, context, verifyStep.run_id, verifyStep.step_id);
      if (prState === "OPEN") {
        if (!prReviewSettleComplete(context)) {
          const remaining = Math.round(prReviewSettleRemainingMs(context) / 1000);
          context["previous_failure"] = `PR_REVIEW_SETTLE_PENDING: ${verifiedStoryId} PR is still inside the external review settle window (${remaining}s remaining).`;
          context["failure_category"] = "PR_REVIEW_SETTLE_PENDING";
          context["failure_suggestion"] = "Wait for Gemini/Copilot/human review signals before merging. Setfarm will re-check PR comments after the settle window.";
          context["pr_url"] = verifiedRow.pr_url;
          context["current_story_id"] = verifiedStoryId;
          if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
          await updateRunContext(verifyStep.run_id, context);
          await setStepStatus(verifyStep.id, "pending");
          logger.info(`[verify] ${verifiedStoryId} PR still inside review settle window (${remaining}s remaining) — deferring merge`, { runId: verifyStep.run_id });
          return { advanced: false, runCompleted: false };
        }
        const merged = tryAutoMergePR(verifiedRow.pr_url, verifiedStoryId, verifyStep.run_id);
        if (merged) {
          invalidatePRStateCache(verifiedRow.pr_url);
          prState = await fetchFreshPrStateName(verifiedRow.pr_url, verifiedStoryId, context, verifyStep.run_id, verifyStep.step_id);
        }
      }
      if (prState !== "MERGED") {
        context["previous_failure"] = `PR_NOT_MERGED: ${verifiedStoryId} PR is ${prState}. Address review comments/checks, merge ${verifiedRow.pr_url} into main, then report STATUS: done.`;
        context["failure_category"] = "PR_NOT_MERGED";
        context["failure_suggestion"] = "Do not accept STATUS: done while the story PR is still open. Address review comments/checks, merge the PR into main, and then let verify re-check the merged state.";
        context["pr_url"] = verifiedRow.pr_url;
        context["current_story_id"] = verifiedStoryId;
        if (verifiedRow.story_branch) context["story_branch"] = verifiedRow.story_branch;
        await updateRunContext(verifyStep.run_id, context);
        await setStepStatus(verifyStep.id, "pending");
        logger.warn(`[verify] ${verifiedStoryId} PR is ${prState}, not MERGED — keeping verify pending`, { runId: verifyStep.run_id });
        return { advanced: false, runCompleted: false };
      }

      const repoPath = context["repo"] || context["REPO"] || "";
      if (repoPath) {
        syncBaseBranch(repoPath, "main");
        const buildGate = runPostMergeBuildGate(repoPath, context["build_cmd"] || "npm run build", verifyStep.run_id, verifyStep.step_id);
        if (!buildGate.ok) {
          const failure = `BUILD_FAILED: Post-merge build failed for ${verifiedStoryId} on current main.\n${buildGate.failure}`;
          context["previous_failure"] = failure;
          context["current_story_id"] = verifiedStoryId;
          context["failure_category"] = "BUILD_FAILED";
          context["failure_suggestion"] = "Fix the merged main build before accepting verify. Route the failure through the quality-fix path instead of allowing final supervision to catch it.";
          await updateRunContext(verifyStep.run_id, context);
          if (await routeQualityFailureToImplement(
            { id: verifyStep.id, run_id: verifyStep.run_id, step_id: verifyStep.step_id, step_index: verifyStep.step_index, agent_id: "" },
            `SYSTEM_SMOKE_FAILURE:\n${failure}`,
            context,
          )) {
            logger.warn(`[verify-build-gate] Routed post-merge build failure for ${verifiedStoryId} back to implement`, { runId: verifyStep.run_id });
            return { advanced: false, runCompleted: false };
          }
          await setStepStatus(verifyStep.id, "pending");
          logger.warn(`[verify-build-gate] Post-merge build failed but route-to-implement was unavailable: ${buildGate.failure.slice(0, 200)}`, { runId: verifyStep.run_id });
          return { advanced: false, runCompleted: false };
        }

        const smokeDecision = await shouldRunStorySystemSmokeGate(verifyStep.run_id, verifiedStoryId);
        if (!smokeDecision.run) {
          context["smoke_test_result"] = `deferred for ${verifiedStoryId}: ${smokeDecision.reason}`;
          logger.info(`[verify-smoke-gate] Deferred system smoke for ${verifiedStoryId}: ${smokeDecision.reason}`, { runId: verifyStep.run_id });
        } else {
          const smokeGate = runSystemSmokeGate(repoPath, verifyStep.run_id, verifyStep.step_id);
          if (!smokeGate.ok) {
            let failure = smokeGate.failure || "unknown smoke-test failure";

            if (smokeGate.infraFailure) {
              context["previous_failure"] = `VERIFY_SYSTEM_SMOKE_FAILURE for ${verifiedStoryId}:\n${failure}`;
              context["current_story_id"] = verifiedStoryId;
              context["failure_category"] = "SMOKE_INFRA_FAILURE";
              await updateRunContext(verifyStep.run_id, context);
              await setStepStatus(verifyStep.id, "pending");
              logger.warn(`[verify-smoke-gate] Infra failure; retrying verify without code changes: ${failure.slice(0, 200)}`, { runId: verifyStep.run_id });
              return { advanced: false, runCompleted: false };
            }

            const confirmGate = await confirmFailedSystemSmokeGate(
              repoPath,
              verifyStep.run_id,
              verifyStep.step_id,
              context,
              "verify-smoke-gate",
              failure,
            );

            if (!confirmGate.ok) {
              failure = confirmGate.failure || failure;
              context["previous_failure"] = `VERIFY_SYSTEM_SMOKE_FAILURE for ${verifiedStoryId}:\n${failure}`;
              context["current_story_id"] = verifiedStoryId;
              context["failure_category"] = confirmGate.infraFailure ? "SMOKE_INFRA_FAILURE" : "VERIFY_SYSTEM_SMOKE_FAILURE";
              await updateRunContext(verifyStep.run_id, context);

              if (confirmGate.infraFailure) {
                await setStepStatus(verifyStep.id, "pending");
                logger.warn(`[verify-smoke-gate] Confirm smoke hit infra failure; retrying verify without code changes: ${failure.slice(0, 200)}`, { runId: verifyStep.run_id });
                return { advanced: false, runCompleted: false };
              }

              if (await routeQualityFailureToImplement(
                { id: verifyStep.id, run_id: verifyStep.run_id, step_id: verifyStep.step_id, step_index: verifyStep.step_index, agent_id: "" },
                `SYSTEM_SMOKE_FAILURE:\n${failure}`,
                context,
              )) {
                logger.warn(`[verify-smoke-gate] Routed confirmed smoke failure for ${verifiedStoryId} back to implement`, { runId: verifyStep.run_id });
                return { advanced: false, runCompleted: false };
              }

              await setStepStatus(verifyStep.id, "pending");
              logger.warn(`[verify-smoke-gate] Confirmed smoke failed but route-to-implement was unavailable: ${failure.slice(0, 200)}`, { runId: verifyStep.run_id });
              return { advanced: false, runCompleted: false };
            }
          } else {
            context["smoke_test_result"] = smokeGate.output;
          }
        }
      }

      await verifyStory(verifiedRow.id, output);
      clearVerifiedStoryFailureContext(context);
      logger.info(`Story verified: ${verifiedStoryId}`, { runId: verifyStep.run_id });
    }
  }
  emitEvent({ ts: now(), event: "story.verified", runId: verifyStep.run_id, workflowId: await getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, storyId: verifiedStoryId });

  // Auto-verify 'done' stories whose PRs are already merged (prevents redundant verify cycles)
  const nextUnverifiedStory = await autoVerifyDoneStories(verifyStep.run_id, context, "handleVerifyEach");

  if (context["verify_quality_failure_routed"]) {
    await updateRunContext(verifyStep.run_id, context);
    logger.warn(`[handleVerifyEach] Routed verify smoke failure to implement; not cycling reviewer`, { runId: verifyStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  if (nextUnverifiedStory) {
    // More stories need verification — inject next story's info and cycle verify
    if (nextUnverifiedStory.output) {
      const storyOut = parseOutputKeyValues(nextUnverifiedStory.output);
      for (const [key, value] of Object.entries(storyOut)) {
        if (isStepOutputContextKeyProtected(key, context)) continue;
        context[key] = value;
      }
    }
    // Override with DB columns if available
    if (nextUnverifiedStory.pr_url) context["pr_url"] = nextUnverifiedStory.pr_url;
    if (nextUnverifiedStory.story_branch) context["story_branch"] = nextUnverifiedStory.story_branch;
    context["current_story_id"] = nextUnverifiedStory.story_id;
    await updateRunContext(verifyStep.run_id, context);

    // Set verify step to pending for next story
    await setStepStatus(verifyStep.id, "pending");
    logger.info(`Verify cycling to next unverified story: ${nextUnverifiedStory.story_id}`, { runId: verifyStep.run_id });
    return { advanced: false, runCompleted: false };
  }

  // No more unverified stories — persist context and check loop continuation
  context["supervisor_scope"] = "final-product";
  clearVerifiedStoryFailureContext(context);
  delete context["current_story_id"];
  delete context["current_story_title"];
  delete context["current_story"];
  delete context["pr_url"];
  delete context["story_branch"];
  await updateRunContext(verifyStep.run_id, context);

  try {
    return checkLoopContinuation(verifyStep.run_id, loopStepId);
  } catch (err) {
    logger.error(`checkLoopContinuation failed, recovering: ${String(err)}`, { runId: verifyStep.run_id });
    // Ensure loop step is at least pending so cron can retry
    await setStepStatus(loopStepId, "pending");
    return { advanced: false, runCompleted: false };
  }
}

// ── Auto-verify helper (shared by claim-auto-verify and handleVerifyEach) ──

const MAX_AUTO_VERIFY_ITERATIONS = 5;

function clearVerifiedStoryFailureContext(context: Record<string, string>): void {
  delete context["verify_feedback"];
  delete context["previous_failure"];
  delete context["failure_category"];
  delete context["failure_suggestion"];
  delete context["verify_infra_retry"];
  delete context["verify_visual_scope_deferred"];
  delete context["verify_pending_pr_url"];
  delete context["verify_pending_since"];
}

/**
 * Auto-verify 'done' stories whose PRs are already merged/closed-with-ancestry.
 * Returns the first story that still needs agent verification, or null if all auto-verified.
 */
export async function autoVerifyDoneStories(
  runId: string,
  context: Record<string, string>,
  logPrefix: string,
  options?: { autoMergeOpen?: boolean },
): Promise<any | null> {
  const runProtocol = await pgGet<{ protocol: "legacy" | "shadow" | "v3" }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [runId],
  );
  let count = 0;
  while (true) {
    if (++count > MAX_AUTO_VERIFY_ITERATIONS) {
      logger.info(`[${logPrefix}] Hit MAX_AUTO_VERIFY (${MAX_AUTO_VERIFY_ITERATIONS}) — deferring remaining stories to next cycle`, { runId });
      return pgGet<any>(
        "SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC LIMIT 1",
        [runId],
      );
    }
    const story = await pgGet<any>(
      "SELECT * FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC LIMIT 1",
      [runId],
    );
    if (!story) return null;

    // FIX: If this story has been stuck in verify for too many cycles, force auto-verify.
    // BUG FIX (2026-04-06): Old query was checking implement step's abandoned_count (always 0)
    // instead of verify step. Now reads verifyStep name from loop_config and queries directly.
    const loopStepRow = await pgGet<{ loop_config: string }>(
      "SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND loop_config LIKE '%verifyEach%' LIMIT 1",
      [runId]
    );
    let verifyStepName = "verify";
    try { verifyStepName = JSON.parse(loopStepRow?.loop_config || "{}").verifyStep || "verify"; } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
    const verifyStep = await pgGet<(StepRow & { agent_id: string | null; abandoned_count: number })>(
      `SELECT id, step_id, run_id, step_index, input_template, type, loop_config,
              status AS step_status, current_story_id, retry_count, output,
              agent_id, abandoned_count
         FROM steps
        WHERE run_id = $1 AND step_id = $2 AND status IN ('running','pending','failed','waiting')
        LIMIT 1`,
      [runId, verifyStepName]
    );
    const verifyStepAbandons = verifyStep?.abandoned_count ?? 0;
    const readPrStateForVerify = async (prUrl: string): Promise<string> => {
      if (!verifyStep) return getPRState(prUrl);
      return fetchFreshPrStateName(prUrl, story.story_id, context, runId, verifyStep.id);
    };
    const routeAutoVerifySmokeFailure = async (): Promise<boolean> => {
      if (!["VERIFY_SYSTEM_SMOKE_FAILURE", "BUILD_FAILED"].includes(context["failure_category"] || "") || !verifyStep) return false;
      const failure = context["previous_failure"] || `VERIFY_SYSTEM_SMOKE_FAILURE for ${story.story_id}`;
      const routed = await routeQualityFailureToImplement(
        {
          id: verifyStep.id,
          run_id: runId,
          step_id: verifyStepName,
          step_index: verifyStep.step_index,
          agent_id: verifyStep.agent_id || "",
        },
        `SYSTEM_SMOKE_FAILURE:
${failure}`,
        context,
      );
      if (routed) context["verify_quality_failure_routed"] = story.story_id;
      return routed;
    };
    // Force auto-verify ONLY if PR is already merged (no auto-merge — PR review is mandatory)
    if (verifyStepAbandons >= 3) {
      const prUrl = story.pr_url || "";
      if (prUrl) {
        const fvState = await readPrStateForVerify(prUrl);
        if (fvState === "MERGED") {
          if (!(await ensureSystemSmokeBeforeAutoVerify(runId, context, logPrefix, story))) {
            if (await routeAutoVerifySmokeFailure()) return null;
            return story;
          }
          await verifyStory(story.id, [
            "STATUS: verified",
            `VERIFICATION_SUMMARY: Force-verified after PR was already merged and verify was abandoned ${verifyStepAbandons} time(s).`,
          ].join("\n"));
          clearVerifiedStoryFailureContext(context);
          logger.info(`[${logPrefix}] Story ${story.story_id} force-verified — PR already merged, verify abandoned ${verifyStepAbandons}x`, { runId });
          emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: `Force-verified — PR merged, verify abandoned ${verifyStepAbandons}x` });
          continue;
        }
        // PR not merged → agent must review comments, fix issues, then merge
        logger.info(`[${logPrefix}] Story ${story.story_id} PR still ${fvState} — needs agent review (no auto-merge)`, { runId });
      }
    }

    let prUrl = story.pr_url || "";
    if (!prUrl) {
      const repoPath = context["repo"] || context["REPO"] || "";
      const storyBranchName = (story.story_branch || `${runId.slice(0, 8)}-${story.story_id}`).toLowerCase();
      let loopConfig: Partial<LoopConfig> = {};
      try { loopConfig = loopStepRow?.loop_config ? JSON.parse(loopStepRow.loop_config) : {}; } catch (e) { logger.debug(`[cleanup] ${String(e).slice(0, 80)}`); }
      const baseBranch = (loopConfig?.mergeStrategy === "pr-each" || loopConfig?.verifyEach)
        ? "main"
        : (context["branch"] || "main");
      const ensured = await ensureStoryPrUrlForBranch({
        runId,
        repoPath,
        storyBranchName,
        baseBranch,
        storyId: story.story_id,
        storyTitle: story.title,
        changes: story.output || "",
      });
      if (ensured.prUrl) {
        await pgRun("UPDATE stories SET pr_url = $1, story_branch = $2, updated_at = $3 WHERE id = $4", [ensured.prUrl, storyBranchName, now(), story.id]);
        context["pr_url"] = ensured.prUrl;
        context["story_branch"] = storyBranchName;
        delete context["auto_pr_create_failed"];
        delete context["failure_category"];
        delete context["failure_suggestion"];
        await updateRunContext(runId, context);
        logger.info(`[${logPrefix}] Story ${story.story_id} PR repaired before reviewer claim: ${ensured.prUrl}`, { runId });
        continue;
      }

      context["auto_pr_create_failed"] = ensured.error;
      context["previous_failure"] = ensured.error;
      context["failure_category"] = "AUTO_PR_CREATE_FAILED";
      context["failure_suggestion"] = "This is a platform PR creation failure. Do not spawn reviewer or recode the story until Setfarm creates/reuses the story PR.";
      await updateRunContext(runId, context);
      logger.warn(`[${logPrefix}] ${ensured.error}; deferring reviewer claim`, { runId });
      return story;
    }

    try {
      const prState = await readPrStateForVerify(prUrl);

      if (prState === "MERGED") {
        // A merged PR is not enough; run the same smoke gate normal verify uses
        // before marking the story verified.
        const repoPath = context["repo"] || context["REPO"] || "";
        if (repoPath) syncBaseBranch(repoPath, "main");
        if (repoPath) {
          try {
            const issues = runQualityChecks(repoPath);
            const errors = issues.filter(i => i.severity === "error");
            if (errors.length > 0) {
              logger.warn(`[${logPrefix}-quality] PR merged — quality gate has ${errors.length} error(s); smoke gate must pass before auto-verify:\n${formatQualityReport(issues)}`, { runId });
            }
          } catch (qErr) {
            logger.warn(`[${logPrefix}] runQualityChecks threw: ${String(qErr)}`, { runId });
          }
        }
        if (!(await ensureSystemSmokeBeforeAutoVerify(runId, context, logPrefix, story))) {
          if (await routeAutoVerifySmokeFailure()) return null;
          return story;
        }
        await verifyStory(story.id, "STATUS: verified\nVERIFICATION_SUMMARY: Auto-verified after PR was already merged and Setfarm gates passed.");
        clearVerifiedStoryFailureContext(context);
        logger.info(`[${logPrefix}] Story ${story.story_id} auto-verified — PR merged`, { runId });
        emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title });
        continue;
      }

      if (prState === "CLOSED") {
        const repoPath = context["repo"] || "";
        const runIdPrefix = runId.slice(0, 8);
        const featureBranch = context["branch"] || context["BRANCH"] || "";
        const checkBranches = [featureBranch, "main", "master"].filter(Boolean);
        const resolution = resolveClosedPR(prUrl, story.story_id, runId, repoPath, runIdPrefix, checkBranches);
        if (resolution.alternativePrUrl) {
          await pgRun("UPDATE stories SET pr_url = $1, updated_at = $2 WHERE id = $3", [resolution.alternativePrUrl, now(), story.id]);
          logger.info(`[${logPrefix}] Found alternative PR for ${story.story_id}: ${resolution.alternativePrUrl}`, { runId });
          continue; // Re-check with updated PR
        } else if (resolution.contentInBaseBranch) {
          if (!(await ensureSystemSmokeBeforeAutoVerify(runId, context, logPrefix, story))) {
            if (await routeAutoVerifySmokeFailure()) return null;
            return story;
          }
          await verifyStory(story.id, "STATUS: verified\nVERIFICATION_SUMMARY: Auto-verified after closed PR content was confirmed in the base branch and Setfarm gates passed.");
          clearVerifiedStoryFailureContext(context);
          logger.info(`[${logPrefix}] Story ${story.story_id} auto-verified — CLOSED PR content in base branch`, { runId });
          emitEvent({ ts: now(), event: "story.verified", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: "Auto-verified — CLOSED PR content in base branch" });
          continue;
        } else if (!resolution.reopened) {
          await pgRun("UPDATE stories SET status = 'failed', output = 'Failed: CLOSED PR could not be reopened, content not found in base branch', updated_at = $1 WHERE id = $2", [now(), story.id]);
          logger.warn(`[${logPrefix}] CLOSED PR ${prUrl} — content NOT in base branch — failing story ${story.story_id}`, { runId });
          emitEvent({ ts: now(), event: "story.failed", runId, workflowId: await getWorkflowId(runId), storyId: story.story_id, storyTitle: story.title, detail: "CLOSED PR content not in base branch" });
          continue;
        }
        // reopened=true → fall through to agent verification
        return story;
      }

      if (prState === "OPEN") {
        if (runProtocol?.protocol === "v3") {
          // A background auto-verifier has no exact open verify-claim
          // capability and therefore cannot authorize review recovery. Return
          // the story to claimSingleStep, where the typed GitHub evidence
          // router owns actionability, dedupe and bounded supervisor dispatch.
          logger.info(`[${logPrefix}] V3 story ${story.story_id} has an OPEN PR; deferring to exact verify-claim review routing`, { runId });
          return story;
        }
        const prReviewCommentsFailure = await detectOpenPrReviewCommentFailure(
          prUrl,
          story.story_id,
          context,
          runId,
          verifyStepName,
        );
        if (prReviewCommentsFailure && verifyStep) {
          context["pr_url"] = prUrl;
          context["current_story_id"] = story.story_id;
          if (story.story_branch) context["story_branch"] = story.story_branch;
          await routeVerifyScopeFailureToImplement(verifyStep as StepRow, context, story.story_id, prReviewCommentsFailure, {
            category: "PR_REVIEW_COMMENTS_OPEN",
            suggestion: "Address every actionable PR review comment in the same story branch before Setfarm can mechanically merge the PR.",
          });
          logger.warn(`[${logPrefix}] Story ${story.story_id} OPEN PR has actionable review comments — routed before reviewer spawn`, { runId });
          return story;
        }

        const reviewSettled = prReviewSettleComplete(context);
        if (!reviewSettled) {
          const remaining = Math.round(prReviewSettleRemainingMs(context) / 1000);
          logger.info(`[${logPrefix}] Story ${story.story_id} clean OPEN PR still inside external review settle window (${remaining}s remaining); deferring auto-merge`, { runId });
        }

        const cleanOpenPr =
          reviewSettled &&
          context["pr_check_state"] === "passing" &&
          context["pr_mergeable"] !== "CONFLICTING" &&
          !["DIRTY", "BLOCKED"].includes(context["pr_merge_state_status"] || "");

        if (cleanOpenPr) {
          const merged = tryAutoMergePR(prUrl, story.story_id, runId);
          if (merged) {
            invalidatePRStateCache(prUrl);
            const refreshedState = await readPrStateForVerify(prUrl);
            if (refreshedState === "MERGED") {
              continue;
            }
            logger.info(`[${logPrefix}] Story ${story.story_id} auto-merge requested; PR state is ${refreshedState}, deferring verification`, { runId });
          } else {
            logger.warn(`[${logPrefix}] Story ${story.story_id} clean OPEN PR could not be auto-merged; reviewer still needed`, { runId });
          }
        }

        // OPEN PR with no actionable comments but no clean merge signal still needs reviewer attention.
        return story;
      }
    } catch (e) {
      logger.warn(`[${logPrefix}] PR state check failed for ${prUrl}: ${String(e)}`, { runId });
    }

    return story; // Needs agent verification
  }
}
