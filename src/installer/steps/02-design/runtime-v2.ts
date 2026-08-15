import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, opendir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../../../product-compiler/canonical-json.js";
import {
  STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1,
  parseStitchStageProviderRejectionProcessEnvelopeV1,
} from "../../../product-compiler/stitch-stage-provider-rejection-v1.js";
import {
  DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
  runDesignSourceAuthorityV2,
  type DesignSourceAuthorityRuntimeDependenciesV2,
  type DesignSourceStageArtifactV2,
} from "../../../product-compiler/design-source-runtime-v2.js";
import type { OperationalFailureCauseV1 } from "../../../execution/schemas/operational-failure-cause-v1.js";
import { ProductCompilationAttemptRepository } from "../../../product-compiler/product-compilation-attempt-repository.js";
import type { DesignInteractionGraphV2 } from "../../../product-compiler/schemas/design-interaction-graph-v2.js";
import type { StitchTargetResponseBindingsV3 } from "../../../product-compiler/schemas/stitch-target-candidate-selection-v2.js";
import {
  prepareV3DesignContractV2,
  type V3DesignContractV2,
} from "../../../product-compiler/v3-design-contract-v2.js";
import { resolvePlatformScript } from "../../paths.js";
import {
  inspectCompilerEnglishAdmissionLedgerAuthorityV1,
  type CompilerEnglishAdmissionLedgerAuthorityV1,
} from "../../../execution/compiler-english-admission-ledger-v1.js";

const ProjectIdentitySchema = z.object({
  schema: z.literal("setfarm.stitch-project-identity.v1"),
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/),
  name: z.string().min(1).max(1_000),
  source: z.enum(["stitch-file", "exact-title", "created"]),
}).strict();

const AttemptTransportOutputSchema = z.object({
  schema: z.literal("setfarm.stitch-attempt-transport.v1"),
  screens: z.array(z.object({
    screenId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/),
    title: z.string().min(1).max(500),
  }).strict()).max(1_000),
}).passthrough();

type SqlLike = ConstructorParameters<typeof ProductCompilationAttemptRepository>[0];

export type DesignPreclaimScreenMapV2 = ReadonlyArray<Readonly<{
  screenId: string;
  name: string;
  type: string;
  description: string;
  surfaceIds: readonly string[];
}>>;

export type DesignPreclaimV2Result =
  | Readonly<{
      status: "accepted";
      projectId: string;
      contract: V3DesignContractV2;
      designGraph: DesignInteractionGraphV2;
      responseBindings: StitchTargetResponseBindingsV3;
      screenMap: DesignPreclaimScreenMapV2;
      context: Readonly<Record<string, string>>;
      completionOutput: string;
      attemptId: string;
      replayed: boolean;
    }>
  | Readonly<{
      status: "rejected" | "infrastructure_failure" | "dispatch_ambiguous" | "in_progress" | "runner_failure";
      code: string;
      diagnostic: string;
      attemptId?: string;
      operationalFailureCause?: OperationalFailureCauseV1;
    }>;

type ExecOnceInput = Readonly<{
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
}>;

type ExecOnceObservation = Readonly<{
  termination: "exit" | "ambiguous";
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

type ExecOnceExecutor = (input: ExecOnceInput) => Promise<ExecOnceObservation>;

function safeDiagnostic(value: unknown): string {
  return String(value instanceof Error ? value.message : value)
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "AQ.[REDACTED]")
    .replace(/\bauthorization\s*[:=]\s*[\s\S]*/gi, "Authorization=[REDACTED]")
    .replace(/\bbearer(?:\s*[:=]\s*|\s+)[\s\S]*/gi, "Bearer=[REDACTED]")
    .replace(/(api[_-]?key|token)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

function execStitchOnce(input: ExecOnceInput): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("node", [resolvePlatformScript("stitch-api.mjs"), ...input.args], {
      cwd: input.cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: input.timeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(safeDiagnostic(stderr || stdout || error)));
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

function execStitchAttemptOnce(input: ExecOnceInput): Promise<ExecOnceObservation> {
  return new Promise((resolve) => {
    execFile("node", [resolvePlatformScript("stitch-api.mjs"), ...input.args], {
      cwd: input.cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: input.timeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
    }, (error, stdout, stderr) => {
      resolve({
        termination: error === null || (
          typeof error.code === "number"
          && error.killed !== true
          && !error.signal
        ) ? "exit" : "ambiguous",
        exitCode: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
      });
    });
  });
}

export async function ensureStitchProjectIdentityV2(input: Readonly<{
  repo: string;
  projectName: string;
}>, dependencies: Readonly<{
  executeStitch?: (input: ExecOnceInput) => Promise<string>;
}> = {}): Promise<string> {
  const executeStitch = dependencies.executeStitch ?? execStitchOnce;
  const output = await executeStitch({
    args: ["ensure-project-identity", input.projectName, input.repo],
    cwd: path.dirname(resolvePlatformScript("stitch-api.mjs")),
    timeoutMs: 120_000,
  });
  return ProjectIdentitySchema.parse(JSON.parse(output)).projectId;
}

type GenerateStitchStageOnceInputV2 = Readonly<{
  repo: string;
  projectId: string;
  stageId: string;
  prompt: string;
  deviceType: "DESKTOP" | "TABLET" | "MOBILE";
  model: string;
  signal: AbortSignal;
}>;

async function requireNoProviderOutputV2(outputDir: string): Promise<void> {
  let metadata;
  try {
    metadata = await lstat(outputDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("DESIGN_SOURCE_PROVIDER_REJECTION_LOCAL_OUTPUT_PRESENT");
  }
  const directory = await opendir(outputDir);
  try {
    const first = await directory.read();
    if (first !== null) {
      throw new Error("DESIGN_SOURCE_PROVIDER_REJECTION_LOCAL_OUTPUT_PRESENT");
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
}

async function generateStitchStageOnceCoreV2(
  input: GenerateStitchStageOnceInputV2,
  execute: ExecOnceExecutor,
): Promise<Awaited<ReturnType<DesignSourceAuthorityRuntimeDependenciesV2["generateStage"]>>> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `setfarm-stitch-${input.stageId}-`));
  try {
    const promptPath = path.join(workspace, "prompt.md");
    const outputDir = path.join(workspace, "output");
    await writeFile(promptPath, `${input.prompt.trim()}\n`, "utf8");
    const observation = await execute({
      args: [
        "generate-all-screens-attempt",
        input.projectId,
        promptPath,
        outputDir,
        input.deviceType,
        input.model,
      ],
      cwd: input.repo,
      timeoutMs: 15 * 60_000,
      signal: input.signal,
    });
    if (observation.exitCode !== 0) {
      if (observation.termination !== "exit") {
        throw new Error("STITCH_CHILD_EXECUTION_AMBIGUOUS");
      }
      let providerRejection;
      try {
        providerRejection = parseStitchStageProviderRejectionProcessEnvelopeV1(observation);
      } catch {
        throw new Error("STITCH_CHILD_PROVIDER_REJECTION_ENVELOPE_INVALID");
      }
      await requireNoProviderOutputV2(outputDir);
      const reasonCodes = ["DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE"];
      const evidence = {
        phase: "provider_dispatch",
        failedStageIds: [input.stageId],
        providerRejectionPolicyHash: hashCanonicalJson(STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1),
        providerRejection,
      };
      return {
        disposition: "infrastructure_failure",
        failure: {
          failureFingerprint: hashCanonicalJson({
            schema: "setfarm.design-source-provider-rejection-fingerprint.v1",
            stageId: input.stageId,
            reasonCodes,
            evidenceHash: hashCanonicalJson(evidence),
          }),
          operationalCauseHash: hashCanonicalJson({
            schema: "setfarm.operational-failure-cause.v1",
            workflowStepId: "design",
            boundary: "product_compiler.design_source.provider_dispatch",
            failureClass: "infrastructure_failure",
            failureCode: "DESIGN_SOURCE_PROVIDER_REJECTED_BEFORE_ACCEPTANCE",
          }),
          reasonCodes,
          evidence,
        },
        rawEvidence: observation.stderr,
      };
    }
    const stdout = observation.stdout;
    const response = AttemptTransportOutputSchema.parse(JSON.parse(stdout));
    const artifacts: DesignSourceStageArtifactV2[] = [];
    for (const screen of response.screens) {
      let htmlBytes: Buffer | undefined;
      let screenshotBytes: Buffer | undefined;
      try { htmlBytes = await readFile(path.join(outputDir, `${screen.screenId}.html`)); } catch {}
      try { screenshotBytes = await readFile(path.join(outputDir, `${screen.screenId}.png`)); } catch {}
      artifacts.push({
        screenId: screen.screenId,
        ...(htmlBytes ? { htmlBytes } : {}),
        ...(screenshotBytes ? { screenshotBytes } : {}),
      });
    }
    return { disposition: "accepted", response, rawEvidence: stdout, artifacts };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function generateStitchStageOnceV2(
  input: GenerateStitchStageOnceInputV2,
): Promise<Awaited<ReturnType<DesignSourceAuthorityRuntimeDependenciesV2["generateStage"]>>> {
  return generateStitchStageOnceCoreV2(input, execStitchAttemptOnce);
}

export async function generateStitchStageOnceWithExecutorForInternalTestV2(
  input: GenerateStitchStageOnceInputV2,
  executor: ExecOnceExecutor,
): Promise<Awaited<ReturnType<DesignSourceAuthorityRuntimeDependenciesV2["generateStage"]>>> {
  return generateStitchStageOnceCoreV2(input, executor);
}

function exactScreenMap(
  contract: V3DesignContractV2,
  bindings: StitchTargetResponseBindingsV3,
): DesignPreclaimScreenMapV2 {
  const targetById = new Map(contract.generationTargets.targets.map((target) => [target.targetId, target]));
  const surfaceById = new Map(contract.productSpec.surfaces.map((surface) => [surface.id, surface]));
  return bindings.bindings.map((binding) => {
    const target = targetById.get(binding.targetRef);
    if (!target) throw new Error(`DESIGN_V2_TARGET_BINDING_MISSING:${binding.targetRef}`);
    const rootSurface = surfaceById.get(target.surfaceRef);
    if (!rootSurface) throw new Error(`DESIGN_V2_ROOT_SURFACE_MISSING:${target.surfaceRef}`);
    return {
      screenId: binding.responseScreenId,
      name: target.expectedScreenTitle,
      type: rootSurface.kind,
      description: `${rootSurface.name} route-root surface`,
      surfaceIds: [target.surfaceRef, ...target.containedSurfaceRefs],
    };
  });
}

function runnerFailure(result: Exclude<
  Awaited<ReturnType<typeof runDesignSourceAuthorityV2>>["runner"],
  { status: "accepted" }
>): Exclude<DesignPreclaimV2Result, { status: "accepted" }> {
  if (result.status === "runner_failure") {
    return {
      status: "runner_failure",
      code: result.code,
      diagnostic: `${result.code}; attempt=${result.attempt?.attemptId || "none"}`,
      ...(result.attempt ? { attemptId: result.attempt.attemptId } : {}),
    };
  }
  if (result.status === "in_progress") {
    return {
      status: "in_progress",
      code: "DESIGN_SOURCE_ATTEMPT_IN_PROGRESS",
      diagnostic: `DESIGN_SOURCE_ATTEMPT_IN_PROGRESS; attempt=${result.attempt.attemptId}`,
      attemptId: result.attempt.attemptId,
    };
  }
  return {
    status: result.status,
    code: result.failure.reasonCodes.join(","),
    diagnostic: canonicalJsonStringify({
      schema: "setfarm.design-preclaim-failure.v2",
      disposition: result.status,
      attemptId: result.attempt.attemptId,
      failureFingerprint: result.failure.failureFingerprint,
      operationalCauseHash: result.failure.operationalCauseHash,
      reasonCodes: result.failure.reasonCodes,
      ...(result.status === "dispatch_ambiguous" ? {} : { stopReason: result.stopReason }),
    }),
    attemptId: result.attempt.attemptId,
    ...(result.failure.operationalCauseHash === hashCanonicalJson(
      DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
    ) ? {
        operationalFailureCause: DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1,
      } : {}),
  };
}

export async function executeDesignPreclaimV2(input: Readonly<{
  sql: SqlLike;
  repo: string;
  runId: string;
  prd: string;
  originClaimId: number;
  ownerClaimId: number;
  ownerInstanceId: string;
  producerReleaseSha: string;
  deviceType: "DESKTOP" | "TABLET" | "MOBILE";
  englishAdmissionAuthority: CompilerEnglishAdmissionLedgerAuthorityV1;
  provider?: string;
  model?: string;
}>, dependencies: Readonly<{
  ensureProject?: typeof ensureStitchProjectIdentityV2;
  generateStage?: typeof generateStitchStageOnceV2;
}> = {}): Promise<DesignPreclaimV2Result> {
  const contract = prepareV3DesignContractV2(input.prd);
  const englishAdmissionReceipt = inspectCompilerEnglishAdmissionLedgerAuthorityV1(
    input.englishAdmissionAuthority,
  );
  if (englishAdmissionReceipt.runId !== input.runId
    || englishAdmissionReceipt.prdHash !== createHash("sha256").update(input.prd, "utf8").digest("hex")
    || englishAdmissionReceipt.productSpecHash !== hashCanonicalJson(contract.productSpec)) {
    throw new Error("DESIGN_V2_ENGLISH_ADMISSION_BINDING_MISMATCH");
  }
  const ensureProject = dependencies.ensureProject ?? ensureStitchProjectIdentityV2;
  const projectId = await ensureProject({ repo: input.repo, projectName: contract.productSpec.product.name });
  const model = input.model ?? "GEMINI_3_1_PRO";
  const generateStage = dependencies.generateStage ?? generateStitchStageOnceV2;
  const runtime = await runDesignSourceAuthorityV2({
    repo: input.repo,
    runId: input.runId,
    projectId,
    contract,
    originClaimId: input.originClaimId,
    ownerClaimId: input.ownerClaimId,
    ownerInstanceId: input.ownerInstanceId,
    producerReleaseSha: input.producerReleaseSha,
    provider: input.provider ?? "stitch",
    model,
    deviceType: input.deviceType,
    duplicateWaitMs: 15 * 60_000,
    duplicatePollMs: 100,
  }, {
    repository: new ProductCompilationAttemptRepository(input.sql),
    generateStage: async (stage) => generateStage({
      repo: input.repo,
      projectId,
      stageId: stage.stageId,
      prompt: stage.prompt,
      deviceType: input.deviceType,
      model,
      signal: stage.signal,
    }),
  });
  if (runtime.runner.status !== "accepted") return runnerFailure(runtime.runner);
  if (!runtime.artifacts) {
    return {
      status: "runner_failure",
      code: "DESIGN_SOURCE_ACCEPTED_AUTHORITY_MISSING",
      diagnostic: "DESIGN_SOURCE_ACCEPTED_AUTHORITY_MISSING",
      attemptId: runtime.runner.attempt.attemptId,
    };
  }
  const screenMap = exactScreenMap(contract, runtime.artifacts.responseBindings);
  const designSystem = canonicalJsonStringify({
    schema: "setfarm.design-system-authority.v2",
    kind: "stitch_compiled",
    productSpecHash: hashCanonicalJson(contract.productSpec),
    generationTargetsHash: hashCanonicalJson(contract.generationTargets),
    renderedSemanticsHash: hashCanonicalJson(runtime.artifacts.renderedSemantics),
    designGraphHash: hashCanonicalJson(runtime.artifacts.designGraph),
  });
  const context = {
    generation_targets: canonicalJsonStringify(contract.generationTargets),
    stitch_direct_response_evidence: canonicalJsonStringify(runtime.artifacts.directResponseEvidence),
    stitch_rendered_semantics_v2: canonicalJsonStringify(runtime.artifacts.renderedSemantics),
    stitch_candidate_selection: canonicalJsonStringify(runtime.artifacts.candidateSelection),
    stitch_response_bindings: canonicalJsonStringify(runtime.artifacts.responseBindings),
    design_interaction_graph_v2: canonicalJsonStringify(runtime.artifacts.designGraph),
    design_source_attempt_id: runtime.runner.attempt.attemptId,
    design_source_authority_hash: runtime.runner.attempt.authorityHash,
    design_source_request_hash: runtime.runner.attempt.requestHash,
    design_source_output_seal_hash: runtime.runner.attempt.outputSealHash!,
    design_source_product_spec_hash: hashCanonicalJson(contract.productSpec),
    design_source_generation_targets_hash: hashCanonicalJson(contract.generationTargets),
    design_source_compiler_release_sha: input.producerReleaseSha,
    stitch_project_id: projectId,
    device_type: input.deviceType,
    design_system: designSystem,
    design_tokens: "{}",
    screen_map: canonicalJsonStringify(screenMap),
    screens_generated: String(screenMap.length),
  };
  return {
    status: "accepted",
    projectId,
    contract,
    designGraph: runtime.artifacts.designGraph,
    responseBindings: runtime.artifacts.responseBindings,
    screenMap,
    context,
    completionOutput: [
      "STATUS: done",
      `STITCH_PROJECT_ID: ${projectId}`,
      `DEVICE_TYPE: ${input.deviceType}`,
      `DESIGN_SYSTEM: ${designSystem}`,
      `SCREEN_MAP: ${canonicalJsonStringify(screenMap)}`,
      `SCREENS_GENERATED: ${screenMap.length}`,
      `DESIGN_SOURCE_ATTEMPT_ID: ${runtime.runner.attempt.attemptId}`,
      `AUTO_COMPLETED: design-preclaim-v2 (${runtime.runner.replayed ? "immutable replay" : "accepted compilation"})`,
    ].join("\n"),
    attemptId: runtime.runner.attempt.attemptId,
    replayed: runtime.runner.replayed,
  };
}
