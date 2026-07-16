import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  type ProductCompilationAttemptExpiredRecoveryResult,
  type ProductCompilationAttemptReservationResult,
} from "./product-compilation-attempt-repository.js";
import {
  ProductCompilationAttemptArtifactRefV1Schema,
  type ProductCompilationAttemptArtifactRefV1,
  type ProductCompilationProjectionReceiptV1,
  createProductCompilationArtifactManifestV1,
  prepareProductCompilationAttemptWorkspaceV1,
  projectAcceptedProductCompilationAttemptV1,
  writeProductCompilationArtifactManifestV1,
  writeProductCompilationAttemptEvidenceV1,
  writeProductCompilationRequestV1,
} from "./product-compilation-attempt-workspace.js";
import {
  DesignSourceGenerationAuthorityV1Schema,
  DesignSourceGenerationRequestV2Schema,
  type DesignSourceGenerationAuthorityV1,
  type DesignSourceGenerationRequestV2,
} from "./schemas/design-source-generation-authority-v1.js";
import { NormalizedRelativeLocatorSchema, Sha256Schema, hasUniqueStrings } from "./schemas/common-v1.js";
import {
  ProductCompilationAttemptFailureV1Schema,
  ProductCompilationAttemptIdSchema,
  ProductCompilationAttemptOutputRefsV1Schema,
  ProductCompilationAttemptV1Schema,
  type ProductCompilationAttemptFailureV1,
  type ProductCompilationAttemptV1,
} from "./schemas/product-compilation-attempt-v1.js";

const OutputRefNameSchema = z.enum([
  "directResponseEvidenceHash",
  "renderedSemanticsHash",
  "candidateSelectionHash",
  "responseBindingsHash",
  "designSourceClosureHash",
]);

const AcceptedAuthorityArtifactSchema = z.object({
  outputRef: OutputRefNameSchema,
  source: ProductCompilationAttemptArtifactRefV1Schema,
}).strict();

const AcceptedProjectionArtifactSchema = z.object({
  source: ProductCompilationAttemptArtifactRefV1Schema,
  targetPath: NormalizedRelativeLocatorSchema,
}).strict();

const AcceptedArtifactSetSchema = z.object({
  outputRefs: ProductCompilationAttemptOutputRefsV1Schema,
  authorityArtifacts: z.array(AcceptedAuthorityArtifactSchema).min(1).max(20),
  projectionArtifacts: z.array(AcceptedProjectionArtifactSchema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  const outputNames = Object.keys(value.outputRefs).sort();
  const authorityNames = value.authorityArtifacts.map((artifact) => artifact.outputRef).sort();
  if (canonicalJsonStringify(outputNames) !== canonicalJsonStringify(authorityNames)) {
    context.addIssue({
      code: "custom",
      path: ["authorityArtifacts"],
      message: "Accepted artifact authority must bind every output ref exactly once",
    });
  }
  if (new Set(authorityNames).size !== authorityNames.length) {
    context.addIssue({
      code: "custom",
      path: ["authorityArtifacts"],
      message: "Accepted artifact output refs must be unique",
    });
  }
  for (const artifact of value.authorityArtifacts) {
    if (value.outputRefs[artifact.outputRef] !== artifact.source.contentHash) {
      context.addIssue({
        code: "custom",
        path: ["authorityArtifacts"],
        message: "Accepted authority artifact hash must equal its output ref",
      });
    }
  }
  const targets = value.projectionArtifacts.map((artifact) => artifact.targetPath);
  if (new Set(targets).size !== targets.length) {
    context.addIssue({
      code: "custom",
      path: ["projectionArtifacts"],
      message: "Accepted projection targets must be unique",
    });
  }
});

export type DesignSourceAcceptedArtifactSetV2 = z.infer<typeof AcceptedArtifactSetSchema>;

const AcceptedArtifactBundlePayloadSchema = AcceptedArtifactSetSchema.extend({
  schema: z.literal("setfarm.design-source-accepted-artifact-bundle.v1"),
  attemptId: ProductCompilationAttemptIdSchema,
  requestHash: Sha256Schema,
}).strict();

type AcceptedArtifactBundlePayload = z.infer<typeof AcceptedArtifactBundlePayloadSchema>;

const AcceptedArtifactBundleSchema = AcceptedArtifactBundlePayloadSchema.extend({
  bundleHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { bundleHash: _bundleHash, ...payload } = value;
  if (hashCanonicalJson(payload) !== value.bundleHash) {
    context.addIssue({
      code: "custom",
      path: ["bundleHash"],
      message: "Accepted artifact bundle hash must bind its exact canonical payload",
    });
  }
});

type AcceptedArtifactBundle = z.infer<typeof AcceptedArtifactBundleSchema>;

export const DesignSourceGenerationRetryDeltaV1Schema = z.object({
  schema: z.literal("setfarm.design-source-generation-retry-delta.v1"),
  parentAttemptRef: ProductCompilationAttemptIdSchema,
  parentFailureArtifactHash: Sha256Schema,
  parentFailureFingerprint: Sha256Schema,
  previousRequestHash: Sha256Schema,
  changes: z.array(z.object({
    stageId: z.string().regex(/^DSGS_[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/),
    previousHash: Sha256Schema,
    nextHash: Sha256Schema,
  }).strict()).min(1).max(200),
}).strict().superRefine((value, context) => {
  const stageIds = value.changes.map((change) => change.stageId);
  if (new Set(stageIds).size !== stageIds.length) {
    context.addIssue({
      code: "custom",
      path: ["changes"],
      message: "Retry delta stage IDs must be unique",
    });
  }
  value.changes.forEach((change, index) => {
    if (change.previousHash === change.nextHash) {
      context.addIssue({
        code: "custom",
        path: ["changes", index],
        message: "Retry delta must prove an exact changed stage prompt hash",
      });
    }
  });
});

export type DesignSourceGenerationRetryDeltaV1 = z.infer<
  typeof DesignSourceGenerationRetryDeltaV1Schema
>;

const DispatchFailureSeedSchema = z.object({
  failureFingerprint: Sha256Schema,
  operationalCauseHash: Sha256Schema,
  reasonCodes: z.array(z.string().min(1).max(500)).min(1).max(100).refine(hasUniqueStrings, {
    message: "Dispatch failure reason codes must be unique",
  }),
  evidence: z.unknown(),
}).strict();

export class DesignSourceMaterializationFailureV2 extends Error {
  readonly disposition: "rejected" | "infrastructure_failure";
  readonly failure: z.infer<typeof DispatchFailureSeedSchema>;

  constructor(input: Readonly<{
    disposition: "rejected" | "infrastructure_failure";
    failure: z.input<typeof DispatchFailureSeedSchema>;
    message?: string;
  }>) {
    const failure = DispatchFailureSeedSchema.parse(input.failure);
    super(input.message ?? failure.reasonCodes.join(","));
    this.name = "DesignSourceMaterializationFailureV2";
    this.disposition = input.disposition;
    this.failure = failure;
  }
}

const FailureArtifactSchema = DispatchFailureSeedSchema.extend({
  schema: z.literal("setfarm.design-source-generation-failure-artifact.v1"),
  attemptId: ProductCompilationAttemptIdSchema,
  requestHash: Sha256Schema,
  disposition: z.enum(["rejected", "infrastructure_failure", "dispatch_ambiguous"]),
}).strict();

export type DesignSourceGenerationDispatchResultV2 =
  | Readonly<{ disposition: "accepted"; response: unknown; rawEvidence: string | Uint8Array }>
  | Readonly<{
      disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous";
      failure: z.input<typeof DispatchFailureSeedSchema>;
      rawEvidence: string | Uint8Array;
    }>;

export type DesignSourceGenerationStagePromptV2 = Readonly<{
  stageId: string;
  prompt: string;
}>;

export type DesignSourceGenerationAcceptedStageResultV2 = Readonly<{
  stageId: string;
  targetRefs: readonly string[];
  response: unknown;
  rawEvidence: ProductCompilationAttemptArtifactRefV1;
}>;

export type DesignSourceGenerationWriteEvidenceV2 = (
  input: Readonly<{
    area: "raw" | "request" | "download" | "render" | "selection";
    locator: string;
    content: string | Uint8Array;
    expectedHash?: string;
  }>,
) => Promise<Readonly<{ path: string; contentHash: string; byteLength: number; created: boolean }>>;

export type DesignSourceCompilationAttemptRepositoryPortV2 = Readonly<{
  reserve(input: unknown): Promise<ProductCompilationAttemptReservationResult>;
  recoverExpired(input: unknown): Promise<ProductCompilationAttemptExpiredRecoveryResult>;
  commitDispatchIntent(input: unknown): Promise<ProductCompilationAttemptV1>;
  sealAccepted(input: unknown): Promise<ProductCompilationAttemptV1>;
  sealFailure(input: unknown): Promise<ProductCompilationAttemptV1>;
  heartbeat(input: unknown, leaseMs?: number): Promise<ProductCompilationAttemptV1>;
  get(attemptId: string): Promise<ProductCompilationAttemptV1 | undefined>;
}>;

export type DesignSourceCompilationAttemptRunnerDependenciesV2 = Readonly<{
  repository: DesignSourceCompilationAttemptRepositoryPortV2;
  dispatchStage(input: Readonly<{
    authority: DesignSourceGenerationAuthorityV1;
    request: DesignSourceGenerationRequestV2;
    stage: DesignSourceGenerationRequestV2["stages"][number];
    prompt: string;
    attempt: ProductCompilationAttemptV1;
    externalOperationId: string;
    signal: AbortSignal;
    writeEvidence: DesignSourceGenerationWriteEvidenceV2;
  }>): Promise<DesignSourceGenerationDispatchResultV2>;
  reuseStage?(input: Readonly<{
    authority: DesignSourceGenerationAuthorityV1;
    request: DesignSourceGenerationRequestV2;
    stage: DesignSourceGenerationRequestV2["stages"][number];
    prompt: string;
    attempt: ProductCompilationAttemptV1;
    parentAttemptRef: string;
    signal: AbortSignal;
    writeEvidence: DesignSourceGenerationWriteEvidenceV2;
  }>): Promise<Extract<DesignSourceGenerationDispatchResultV2, { disposition: "accepted" }>>;
  materializeAccepted(input: Readonly<{
    authority: DesignSourceGenerationAuthorityV1;
    request: DesignSourceGenerationRequestV2;
    stageResults: readonly DesignSourceGenerationAcceptedStageResultV2[];
    attempt: ProductCompilationAttemptV1;
    signal: AbortSignal;
    writeEvidence: DesignSourceGenerationWriteEvidenceV2;
  }>): Promise<DesignSourceAcceptedArtifactSetV2>;
  planRetry?(input: Readonly<{
    authority: DesignSourceGenerationAuthorityV1;
    request: DesignSourceGenerationRequestV2;
    stagePrompts: readonly DesignSourceGenerationStagePromptV2[];
    attempt: ProductCompilationAttemptV1;
    failure: ProductCompilationAttemptFailureV1;
    failureEvidence: unknown;
  }>): Promise<Readonly<{ stagePrompts: readonly DesignSourceGenerationStagePromptV2[] }> | null>;
  projectAccepted?(input: Readonly<{
    repo: string;
    attempt: ProductCompilationAttemptV1;
  }>): Promise<ProductCompilationProjectionReceiptV1>;
}>;

export type DesignSourceCompilationAttemptRunnerInputV2 = Readonly<{
  repo: string;
  authority: unknown;
  request: unknown;
  stagePrompts: readonly DesignSourceGenerationStagePromptV2[];
  ownerClaimId: number;
  ownerInstanceId: string;
  leaseMs?: number;
  heartbeatIntervalMs?: number;
  duplicateWaitMs?: number;
  duplicatePollMs?: number;
}>;

export type DesignSourceCompilationAttemptRunnerResultV2 =
  | Readonly<{
      status: "accepted";
      attempt: ProductCompilationAttemptV1;
      attempts: readonly ProductCompilationAttemptV1[];
      projection: ProductCompilationProjectionReceiptV1;
      replayed: boolean;
    }>
  | Readonly<{
      status: "rejected" | "infrastructure_failure";
      attempt: ProductCompilationAttemptV1;
      attempts: readonly ProductCompilationAttemptV1[];
      failure: ProductCompilationAttemptFailureV1;
      stopReason: "no_retry" | "maximum_attempts" | "unchanged_retry" | "repeated_failure";
    }>
  | Readonly<{
      status: "dispatch_ambiguous";
      attempt: ProductCompilationAttemptV1;
      attempts: readonly ProductCompilationAttemptV1[];
      failure: ProductCompilationAttemptFailureV1;
    }>
  | Readonly<{
      status: "in_progress";
      attempt: ProductCompilationAttemptV1;
      attempts: readonly ProductCompilationAttemptV1[];
    }>
  | Readonly<{
      status: "runner_failure";
      code:
        | "DESIGN_SOURCE_RUNNER_INPUT_INVALID"
        | "DESIGN_SOURCE_RUNNER_RESERVATION_FAILED"
        | "DESIGN_SOURCE_RUNNER_ATTEMPT_AUTHORITY_MISMATCH"
        | "DESIGN_SOURCE_RUNNER_IMMUTABLE_INPUT_INVALID"
        | "DESIGN_SOURCE_RUNNER_DISPATCH_INTENT_FAILED"
        | "DESIGN_SOURCE_RUNNER_FAILURE_SEAL_FAILED"
        | "DESIGN_SOURCE_RUNNER_ACCEPTED_ARTIFACT_INVALID"
        | "DESIGN_SOURCE_RUNNER_ACCEPTED_SEAL_FAILED"
        | "DESIGN_SOURCE_RUNNER_REPLAY_INVALID"
        | "DESIGN_SOURCE_RUNNER_PROJECTION_FAILED"
        | "DESIGN_SOURCE_RUNNER_RETRY_PLANNER_FAILED";
      attempts: readonly ProductCompilationAttemptV1[];
      attempt?: ProductCompilationAttemptV1;
    }>;

type CanonicalPrompt = Readonly<{ prompt: string; bytes: Buffer; promptHash: string }>;
type CanonicalStagePrompt = CanonicalPrompt & Readonly<{ stageId: string }>;

type StoredAttemptInputs = Readonly<{
  authority: DesignSourceGenerationAuthorityV1;
  request: DesignSourceGenerationRequestV2;
  stagePrompts: readonly CanonicalStagePrompt[];
  retryDelta: DesignSourceGenerationRetryDeltaV1 | null;
}>;

type SingleAttemptResult =
  | Readonly<{
      kind: "accepted";
      attempt: ProductCompilationAttemptV1;
      projection: ProductCompilationProjectionReceiptV1;
      replayed: boolean;
    }>
  | Readonly<{
      kind: "failed";
      attempt: ProductCompilationAttemptV1;
      inputs: StoredAttemptInputs;
    }>
  | Readonly<{ kind: "in_progress"; attempt: ProductCompilationAttemptV1 }>
  | Readonly<{ kind: "runner_failure"; result: Extract<DesignSourceCompilationAttemptRunnerResultV2, { status: "runner_failure" }> }>;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function equalCanonical(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function errorFact(error: unknown): Readonly<{ name: string; code: string | null; message: string }> {
  if (!(error instanceof Error)) {
    return { name: "NonErrorThrown", code: null, message: String(error) };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  return { name: error.name || "Error", code, message: error.message };
}

export function canonicalDesignSourceGenerationPromptV2(promptInput: string): CanonicalPrompt {
  const prompt = String(promptInput).replace(/\r\n?/g, "\n").trimEnd();
  if (!prompt) throw new Error("DESIGN_SOURCE_GENERATION_PROMPT_EMPTY");
  const bytes = Buffer.from(`${prompt}\n`, "utf8");
  return { prompt, bytes, promptHash: sha256(bytes) };
}

function canonicalStagePrompts(
  request: DesignSourceGenerationRequestV2,
  stagePromptsInput: readonly DesignSourceGenerationStagePromptV2[],
): readonly CanonicalStagePrompt[] {
  const byStage = new Map<string, CanonicalPrompt>();
  for (const stagePrompt of stagePromptsInput) {
    if (byStage.has(stagePrompt.stageId)) throw new Error("DESIGN_SOURCE_STAGE_PROMPT_DUPLICATE");
    byStage.set(stagePrompt.stageId, canonicalDesignSourceGenerationPromptV2(stagePrompt.prompt));
  }
  if (byStage.size !== request.stages.length) {
    throw new Error("DESIGN_SOURCE_STAGE_PROMPT_INCOMPLETE");
  }
  return request.stages.map((stage) => {
    const prompt = byStage.get(stage.stageId);
    if (!prompt || prompt.promptHash !== stage.promptHash) {
      throw new Error("DESIGN_SOURCE_STAGE_PROMPT_HASH_MISMATCH");
    }
    return { stageId: stage.stageId, ...prompt };
  });
}

function requireExactTargetPartition(
  authority: DesignSourceGenerationAuthorityV1,
  request: DesignSourceGenerationRequestV2,
): void {
  const flattened = request.stages.flatMap((stage) => stage.targetRefs);
  if (!equalCanonical(flattened, authority.targetRefs)) {
    throw new Error("DESIGN_SOURCE_STAGE_TARGET_PARTITION_INVALID");
  }
}

export function createInitialDesignSourceGenerationRequestV2(input: Readonly<{
  authority: unknown;
  stages: readonly Readonly<{
    stageId: string;
    targetRefs: readonly string[];
    prompt: string;
  }>[];
}>): DesignSourceGenerationRequestV2 {
  const authority = DesignSourceGenerationAuthorityV1Schema.parse(input.authority);
  const request = DesignSourceGenerationRequestV2Schema.parse({
    schema: "setfarm.design-source-generation-request.v2",
    authorityHash: hashCanonicalJson(authority),
    ordinal: 1,
    retryAuthority: null,
    stages: input.stages.map((stage) => ({
      stageId: stage.stageId,
      targetRefs: stage.targetRefs,
      promptHash: canonicalDesignSourceGenerationPromptV2(stage.prompt).promptHash,
    })),
  });
  requireExactTargetPartition(authority, request);
  return request;
}

function runnerFailure(
  code: Extract<DesignSourceCompilationAttemptRunnerResultV2, { status: "runner_failure" }>["code"],
  attempts: readonly ProductCompilationAttemptV1[],
  attempt?: ProductCompilationAttemptV1,
): Extract<DesignSourceCompilationAttemptRunnerResultV2, { status: "runner_failure" }> {
  return { status: "runner_failure", code, attempts: [...attempts], ...(attempt ? { attempt } : {}) };
}

function recordAttempt(attempts: ProductCompilationAttemptV1[], attempt: ProductCompilationAttemptV1): void {
  const index = attempts.findIndex((candidate) => candidate.attemptId === attempt.attemptId);
  if (index === -1) attempts.push(attempt);
  else attempts[index] = attempt;
}

function requireAttemptBinding(input: Readonly<{
  attempt: ProductCompilationAttemptV1;
  authority: DesignSourceGenerationAuthorityV1;
  request: DesignSourceGenerationRequestV2;
  requestHash: string;
  ownerClaimId?: number;
}>): ProductCompilationAttemptV1 {
  const attempt = ProductCompilationAttemptV1Schema.parse(input.attempt);
  if (
    attempt.runId !== input.authority.runId
    || attempt.originClaimId !== input.authority.originClaimId
    || (input.ownerClaimId !== undefined && attempt.ownerClaimId !== input.ownerClaimId)
    || attempt.passKind !== "design_source_generation"
    || attempt.authorityHash !== input.request.authorityHash
    || attempt.requestHash !== input.requestHash
    || attempt.ordinal !== input.request.ordinal
    || !equalCanonical(attempt.retryAuthority, input.request.retryAuthority)
  ) {
    throw new Error("DESIGN_SOURCE_ATTEMPT_BINDING_MISMATCH");
  }
  return attempt;
}

function artifactWrite(
  repo: string,
  attempt: ProductCompilationAttemptV1,
): DesignSourceGenerationWriteEvidenceV2 {
  return (input) => writeProductCompilationAttemptEvidenceV1({ repo, attempt, ...input });
}

async function writeStageRawEvidence(
  writeEvidence: DesignSourceGenerationWriteEvidenceV2,
  stageId: string,
  evidence: string | Uint8Array,
): Promise<ProductCompilationAttemptArtifactRefV1> {
  const receipt = await writeEvidence({
    area: "raw",
    locator: `stages/${stageId}/response.bin`,
    content: evidence,
  });
  return ProductCompilationAttemptArtifactRefV1Schema.parse({
    area: "raw",
    locator: `stages/${stageId}/response.bin`,
    contentHash: receipt.contentHash,
    byteLength: receipt.byteLength,
  });
}

async function safeReadAt(root: string, locatorInput: string): Promise<Buffer> {
  const locator = NormalizedRelativeLocatorSchema.parse(locatorInput);
  const segments = locator.split("/");
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]!);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) throw new Error("DESIGN_SOURCE_ARTIFACT_SYMLINK");
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new Error("DESIGN_SOURCE_ARTIFACT_PARENT_INVALID");
    }
    if (index === segments.length - 1 && !stat.isFile()) {
      throw new Error("DESIGN_SOURCE_ARTIFACT_FILE_INVALID");
    }
  }
  const resolvedRoot = await realpath(root);
  const resolvedTarget = await realpath(cursor);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("DESIGN_SOURCE_ARTIFACT_PATH_ESCAPE");
  }
  return readFile(cursor);
}

async function readAttemptArtifact(
  repo: string,
  attempt: ProductCompilationAttemptV1,
  artifact: ProductCompilationAttemptArtifactRefV1,
): Promise<Buffer> {
  const parsed = ProductCompilationAttemptArtifactRefV1Schema.parse(artifact);
  const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo, attempt });
  const bytes = await safeReadAt(workspace[parsed.area], parsed.locator);
  if (bytes.length !== parsed.byteLength || sha256(bytes) !== parsed.contentHash) {
    throw new Error("DESIGN_SOURCE_ARTIFACT_HASH_MISMATCH");
  }
  return bytes;
}

async function writeAttemptInputs(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  authority: DesignSourceGenerationAuthorityV1;
  request: DesignSourceGenerationRequestV2;
  stagePrompts: readonly CanonicalStagePrompt[];
  retryDelta: DesignSourceGenerationRetryDeltaV1 | null;
}>): Promise<void> {
  const authorityBytes = canonicalJsonBytes(input.authority);
  const authority = await writeProductCompilationAttemptEvidenceV1({
    repo: input.repo,
    attempt: input.attempt,
    area: "request",
    locator: "authority.json",
    content: authorityBytes,
    expectedHash: input.attempt.authorityHash,
  });
  if (authority.contentHash !== input.attempt.authorityHash) {
    throw new Error("DESIGN_SOURCE_AUTHORITY_WRITE_HASH_MISMATCH");
  }
  for (const stage of input.request.stages) {
    const prompt = input.stagePrompts.find((candidate) => candidate.stageId === stage.stageId);
    if (!prompt) throw new Error("DESIGN_SOURCE_STAGE_PROMPT_MISSING");
    const receipt = await writeProductCompilationAttemptEvidenceV1({
      repo: input.repo,
      attempt: input.attempt,
      area: "request",
      locator: `stages/${stage.stageId}/prompt.md`,
      content: prompt.bytes,
      expectedHash: stage.promptHash,
    });
    if (receipt.contentHash !== stage.promptHash) {
      throw new Error("DESIGN_SOURCE_STAGE_PROMPT_WRITE_HASH_MISMATCH");
    }
  }
  const request = await writeProductCompilationRequestV1({
    repo: input.repo,
    attempt: input.attempt,
    request: input.request,
  });
  if (request.contentHash !== input.attempt.requestHash) {
    throw new Error("DESIGN_SOURCE_REQUEST_WRITE_HASH_MISMATCH");
  }
  if (input.request.ordinal === 2) {
    if (!input.retryDelta || hashCanonicalJson(input.retryDelta) !== input.request.retryAuthority?.retryDeltaHash) {
      throw new Error("DESIGN_SOURCE_RETRY_DELTA_AUTHORITY_MISMATCH");
    }
    await writeProductCompilationAttemptEvidenceV1({
      repo: input.repo,
      attempt: input.attempt,
      area: "request",
      locator: "retry-delta.json",
      content: canonicalJsonBytes(input.retryDelta),
      expectedHash: input.request.retryAuthority.retryDeltaHash,
    });
  } else if (input.retryDelta) {
    throw new Error("DESIGN_SOURCE_ORDINAL_ONE_RETRY_DELTA_FORBIDDEN");
  }
}

async function readStoredInputs(
  repo: string,
  attemptInput: ProductCompilationAttemptV1,
): Promise<StoredAttemptInputs> {
  const attempt = ProductCompilationAttemptV1Schema.parse(attemptInput);
  const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo, attempt });
  const authorityBytes = await safeReadAt(workspace.request, "authority.json");
  const requestBytes = await safeReadAt(workspace.request, "request.json");
  const authority = DesignSourceGenerationAuthorityV1Schema.parse(JSON.parse(authorityBytes.toString("utf8")));
  const request = DesignSourceGenerationRequestV2Schema.parse(JSON.parse(requestBytes.toString("utf8")));
  const stagePrompts = await Promise.all(request.stages.map(async (stage) => {
    const promptBytes = await safeReadAt(workspace.request, `stages/${stage.stageId}/prompt.md`);
    if (sha256(promptBytes) !== stage.promptHash || !promptBytes.toString("utf8").endsWith("\n")) {
      throw new Error("DESIGN_SOURCE_STORED_STAGE_PROMPT_MISMATCH");
    }
    return {
      stageId: stage.stageId,
      prompt: promptBytes.toString("utf8").slice(0, -1),
      bytes: promptBytes,
      promptHash: stage.promptHash,
    };
  }));
  if (
    !authorityBytes.equals(canonicalJsonBytes(authority))
    || !requestBytes.equals(canonicalJsonBytes(request))
    || hashCanonicalJson(authority) !== attempt.authorityHash
    || hashCanonicalJson(request) !== attempt.requestHash
    || request.authorityHash !== attempt.authorityHash
    || request.ordinal !== attempt.ordinal
    || !equalCanonical(request.retryAuthority, attempt.retryAuthority)
    || authority.runId !== attempt.runId
    || authority.originClaimId !== attempt.originClaimId
  ) {
    throw new Error("DESIGN_SOURCE_STORED_INPUT_AUTHORITY_MISMATCH");
  }
  requireExactTargetPartition(authority, request);
  let retryDelta: DesignSourceGenerationRetryDeltaV1 | null = null;
  if (request.ordinal === 2) {
    const retryAuthority = request.retryAuthority;
    if (!retryAuthority) throw new Error("DESIGN_SOURCE_STORED_RETRY_AUTHORITY_MISSING");
    const bytes = await safeReadAt(workspace.request, "retry-delta.json");
    retryDelta = DesignSourceGenerationRetryDeltaV1Schema.parse(JSON.parse(bytes.toString("utf8")));
    if (
      !bytes.equals(canonicalJsonBytes(retryDelta))
      || hashCanonicalJson(retryDelta) !== retryAuthority.retryDeltaHash
      || retryDelta.parentAttemptRef !== retryAuthority.parentAttemptRef
      || retryDelta.parentFailureArtifactHash !== retryAuthority.parentFailureArtifactHash
      || retryDelta.parentFailureFingerprint !== retryAuthority.parentFailureFingerprint
    ) {
      throw new Error("DESIGN_SOURCE_STORED_RETRY_DELTA_MISMATCH");
    }
  }
  return {
    authority,
    request,
    stagePrompts,
    retryDelta,
  };
}

function acceptedBundle(
  attempt: ProductCompilationAttemptV1,
  artifactsInput: DesignSourceAcceptedArtifactSetV2,
): AcceptedArtifactBundle {
  const artifacts = AcceptedArtifactSetSchema.parse(artifactsInput);
  const payload = AcceptedArtifactBundlePayloadSchema.parse({
    schema: "setfarm.design-source-accepted-artifact-bundle.v1",
    attemptId: attempt.attemptId,
    requestHash: attempt.requestHash,
    ...artifacts,
  });
  return AcceptedArtifactBundleSchema.parse({ ...payload, bundleHash: hashCanonicalJson(payload) });
}

async function verifyAcceptedBundleArtifacts(
  repo: string,
  attempt: ProductCompilationAttemptV1,
  bundle: AcceptedArtifactBundle,
): Promise<void> {
  if (
    bundle.attemptId !== attempt.attemptId
    || bundle.requestHash !== attempt.requestHash
    || (attempt.outputRefs && !equalCanonical(bundle.outputRefs, attempt.outputRefs))
  ) {
    throw new Error("DESIGN_SOURCE_ACCEPTED_BUNDLE_ATTEMPT_MISMATCH");
  }
  await Promise.all([
    ...bundle.authorityArtifacts.map((artifact) => readAttemptArtifact(repo, attempt, artifact.source)),
    ...bundle.projectionArtifacts.map((artifact) => readAttemptArtifact(repo, attempt, artifact.source)),
  ]);
}

async function writeAcceptedBundle(
  repo: string,
  attempt: ProductCompilationAttemptV1,
  artifacts: DesignSourceAcceptedArtifactSetV2,
): Promise<AcceptedArtifactBundle> {
  const bundle = acceptedBundle(attempt, artifacts);
  await verifyAcceptedBundleArtifacts(repo, attempt, bundle);
  await writeProductCompilationAttemptEvidenceV1({
    repo,
    attempt,
    area: "selection",
    locator: "accepted-artifacts.json",
    content: canonicalJsonBytes(bundle),
  });
  return bundle;
}

async function readAcceptedBundle(
  repo: string,
  attempt: ProductCompilationAttemptV1,
): Promise<AcceptedArtifactBundle> {
  const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo, attempt });
  const bytes = await safeReadAt(workspace.selection, "accepted-artifacts.json");
  const bundle = AcceptedArtifactBundleSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (!bytes.equals(canonicalJsonBytes(bundle))) {
    throw new Error("DESIGN_SOURCE_ACCEPTED_BUNDLE_NON_CANONICAL");
  }
  await verifyAcceptedBundleArtifacts(repo, attempt, bundle);
  return bundle;
}

async function finalizeAccepted(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  bundle?: AcceptedArtifactBundle;
  projectAccepted?: DesignSourceCompilationAttemptRunnerDependenciesV2["projectAccepted"];
}>): Promise<ProductCompilationProjectionReceiptV1> {
  const attempt = ProductCompilationAttemptV1Schema.parse(input.attempt);
  const bundle = input.bundle ?? await readAcceptedBundle(input.repo, attempt);
  await verifyAcceptedBundleArtifacts(input.repo, attempt, bundle);
  const manifest = createProductCompilationArtifactManifestV1({
    attempt,
    authorityArtifacts: bundle.authorityArtifacts,
    projectionArtifacts: bundle.projectionArtifacts,
  });
  await writeProductCompilationArtifactManifestV1({ repo: input.repo, attempt, manifest });
  const project = input.projectAccepted ?? projectAcceptedProductCompilationAttemptV1;
  return project({ repo: input.repo, attempt });
}

async function persistFailure(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous";
  failure: z.input<typeof DispatchFailureSeedSchema>;
}>): Promise<ProductCompilationAttemptFailureV1> {
  const seed = DispatchFailureSeedSchema.parse(input.failure);
  const artifact = FailureArtifactSchema.parse({
    schema: "setfarm.design-source-generation-failure-artifact.v1",
    attemptId: input.attempt.attemptId,
    requestHash: input.attempt.requestHash,
    disposition: input.disposition,
    ...seed,
  });
  const receipt = await writeProductCompilationAttemptEvidenceV1({
    repo: input.repo,
    attempt: input.attempt,
    area: "raw",
    locator: "failure.json",
    content: canonicalJsonBytes(artifact),
  });
  return ProductCompilationAttemptFailureV1Schema.parse({
    failureArtifactHash: receipt.contentHash,
    failureFingerprint: seed.failureFingerprint,
    operationalCauseHash: seed.operationalCauseHash,
    reasonCodes: seed.reasonCodes,
  });
}

async function readStoredFailureArtifact(
  repo: string,
  attempt: ProductCompilationAttemptV1,
): Promise<z.infer<typeof FailureArtifactSchema>> {
  if (!attempt.failure || !attempt.disposition || attempt.disposition === "accepted") {
    throw new Error("DESIGN_SOURCE_STORED_FAILURE_MISSING");
  }
  const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo, attempt });
  const bytes = await safeReadAt(workspace.raw, "failure.json");
  const artifact = FailureArtifactSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (
    !bytes.equals(canonicalJsonBytes(artifact))
    || sha256(bytes) !== attempt.failure.failureArtifactHash
    || artifact.attemptId !== attempt.attemptId
    || artifact.requestHash !== attempt.requestHash
    || artifact.disposition !== attempt.disposition
    || artifact.failureFingerprint !== attempt.failure.failureFingerprint
    || artifact.operationalCauseHash !== attempt.failure.operationalCauseHash
    || !equalCanonical(artifact.reasonCodes, attempt.failure.reasonCodes)
  ) {
    throw new Error("DESIGN_SOURCE_STORED_FAILURE_AUTHORITY_MISMATCH");
  }
  return artifact;
}

function fence(attempt: ProductCompilationAttemptV1, ownerInstanceId: string) {
  return {
    attemptId: attempt.attemptId,
    generation: attempt.generation,
    fenceToken: attempt.fenceToken,
    ownerInstanceId,
  };
}

function externalOperationId(attempt: ProductCompilationAttemptV1): string {
  return `PCO_${hashCanonicalJson({
    schema: "setfarm.design-source-external-operation.v1",
    attemptId: attempt.attemptId,
    requestHash: attempt.requestHash,
  })}`;
}

async function dispatchWithHeartbeat<T>(input: Readonly<{
  repository: DesignSourceCompilationAttemptRepositoryPortV2;
  attempt: ProductCompilationAttemptV1;
  ownerInstanceId: string;
  leaseMs: number;
  heartbeatIntervalMs: number;
  dispatch(signal: AbortSignal): Promise<T>;
}>): Promise<T> {
  const controller = new AbortController();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;
  let heartbeatError: unknown;
  let rejectHeartbeat!: (error: unknown) => void;
  const heartbeatFailure = new Promise<never>((_resolve, reject) => {
    rejectHeartbeat = reject;
  });
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      inFlight = input.repository
        .heartbeat(fence(input.attempt, input.ownerInstanceId), input.leaseMs)
        .then(() => {
          inFlight = undefined;
          schedule();
        })
        .catch((error: unknown) => {
          heartbeatError = error;
          inFlight = undefined;
          controller.abort(error);
          rejectHeartbeat(error);
        });
    }, input.heartbeatIntervalMs);
  };
  schedule();
  const dispatched = Promise.resolve().then(() => input.dispatch(controller.signal));
  dispatched.catch(() => undefined);
  try {
    const result = await Promise.race([dispatched, heartbeatFailure]);
    if (heartbeatError) throw heartbeatError;
    return result;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await inFlight?.catch(() => undefined);
  }
}

async function waitForTerminal(input: Readonly<{
  repository: DesignSourceCompilationAttemptRepositoryPortV2;
  attempt: ProductCompilationAttemptV1;
  waitMs: number;
  pollMs: number;
}>): Promise<ProductCompilationAttemptV1> {
  let current = ProductCompilationAttemptV1Schema.parse(input.attempt);
  const deadline = Date.now() + input.waitMs;
  while (["reserved", "dispatching"].includes(current.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, input.pollMs));
    const observed = await input.repository.get(current.attemptId);
    if (observed) current = ProductCompilationAttemptV1Schema.parse(observed);
  }
  return current;
}

async function sealFailure(input: Readonly<{
  repository: DesignSourceCompilationAttemptRepositoryPortV2;
  repo: string;
  attempt: ProductCompilationAttemptV1;
  ownerInstanceId: string;
  disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous";
  failure: z.input<typeof DispatchFailureSeedSchema>;
}>): Promise<ProductCompilationAttemptV1> {
  const failure = await persistFailure(input);
  return input.repository.sealFailure({
    ...fence(input.attempt, input.ownerInstanceId),
    disposition: input.disposition,
    failure,
  });
}

type AmbiguousFailurePhase =
  | "provider_dispatch"
  | "dispatch_result_validation"
  | "accepted_artifact_materialization";

function ambiguousFailureSeed(
  attempt: ProductCompilationAttemptV1,
  phase: AmbiguousFailurePhase,
  stageId: string | null,
  error: unknown,
): z.input<typeof DispatchFailureSeedSchema> {
  const fact = errorFact(error);
  const occurrenceIdentity = {
    schema: "setfarm.design-source-failure-fingerprint.v1",
    requestHash: attempt.requestHash,
    phase,
    stageId,
    errorName: fact.name,
    errorCode: fact.code,
  };
  const failureCode = phase === "provider_dispatch"
    ? "DESIGN_SOURCE_DISPATCH_AMBIGUOUS"
    : phase === "dispatch_result_validation"
      ? "DESIGN_SOURCE_DISPATCH_RESULT_INVALID"
      : "DESIGN_SOURCE_ACCEPTED_ARTIFACT_INVALID";
  const cause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "design",
    boundary: `product_compiler.design_source.${phase}`,
    failureClass: phase === "provider_dispatch" ? "infrastructure_failure" : "contract_invalid",
    failureCode,
  };
  return {
    failureFingerprint: hashCanonicalJson(occurrenceIdentity),
    operationalCauseHash: hashCanonicalJson(cause),
    reasonCodes: [failureCode],
    evidence: { cause, phase, stageId, error: fact },
  };
}

function expiredDispatchFailureSeed(
  attempt: ProductCompilationAttemptV1,
): z.input<typeof DispatchFailureSeedSchema> {
  const cause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "design",
    boundary: "product_compiler.design_source.expired_dispatch_recovery",
    failureClass: "infrastructure_failure",
    failureCode: "DESIGN_SOURCE_DISPATCH_LEASE_EXPIRED",
  };
  return {
    failureFingerprint: hashCanonicalJson({
      schema: "setfarm.design-source-failure-fingerprint.v1",
      requestHash: attempt.requestHash,
      phase: "expired_dispatch_recovery",
      externalOperationId: attempt.dispatch?.externalOperationId ?? null,
    }),
    operationalCauseHash: hashCanonicalJson(cause),
    reasonCodes: ["DESIGN_SOURCE_DISPATCH_LEASE_EXPIRED"],
    evidence: {
      cause,
      attemptId: attempt.attemptId,
      generation: attempt.generation,
      dispatch: attempt.dispatch,
      recoveryDisposition: "quarantine_without_redispatch",
    },
  };
}

function carryForwardFailureSeed(
  attempt: ProductCompilationAttemptV1,
  stageId: string,
  error: unknown,
): z.input<typeof DispatchFailureSeedSchema> {
  const fact = errorFact(error);
  const cause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "design",
    boundary: "product_compiler.design_source.carry_forward",
    failureClass: "infrastructure_failure",
    failureCode: "DESIGN_SOURCE_CARRY_FORWARD_INVALID",
  };
  return {
    failureFingerprint: hashCanonicalJson({
      schema: "setfarm.design-source-failure-fingerprint.v1",
      requestHash: attempt.requestHash,
      phase: "carry_forward",
      stageId,
      errorName: fact.name,
      errorCode: fact.code,
    }),
    operationalCauseHash: hashCanonicalJson(cause),
    reasonCodes: ["DESIGN_SOURCE_CARRY_FORWARD_INVALID"],
    evidence: { cause, stageId, error: fact },
  };
}

async function runSingleAttempt(input: Readonly<{
  repo: string;
  authority: DesignSourceGenerationAuthorityV1;
  request: DesignSourceGenerationRequestV2;
  stagePrompts: readonly CanonicalStagePrompt[];
  retryDelta: DesignSourceGenerationRetryDeltaV1 | null;
  ownerClaimId: number;
  ownerInstanceId: string;
  leaseMs: number;
  heartbeatIntervalMs: number;
  duplicateWaitMs: number;
  duplicatePollMs: number;
  dependencies: DesignSourceCompilationAttemptRunnerDependenciesV2;
  attempts: ProductCompilationAttemptV1[];
}>): Promise<SingleAttemptResult> {
  const requestHash = hashCanonicalJson(input.request);
  let reservation: ProductCompilationAttemptReservationResult;
  try {
    reservation = await input.dependencies.repository.reserve({
      runId: input.authority.runId,
      originClaimId: input.authority.originClaimId,
      ownerClaimId: input.ownerClaimId,
      passKind: "design_source_generation",
      authorityHash: input.request.authorityHash,
      requestHash,
      ordinal: input.request.ordinal,
      retryAuthority: input.request.retryAuthority,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs: input.leaseMs,
    });
  } catch {
    return { kind: "runner_failure", result: runnerFailure("DESIGN_SOURCE_RUNNER_RESERVATION_FAILED", input.attempts) };
  }

  let attempt = ProductCompilationAttemptV1Schema.parse(reservation.attempt);
  recordAttempt(input.attempts, attempt);
  if (
    (reservation.status === "duplicate" || reservation.status === "active_conflict")
    && ["reserved", "dispatching"].includes(attempt.state)
  ) {
    try {
      const recovered = await input.dependencies.repository.recoverExpired({
        attemptId: attempt.attemptId,
        runId: input.authority.runId,
        ownerClaimId: input.ownerClaimId,
        ownerInstanceId: input.ownerInstanceId,
        leaseMs: input.leaseMs,
      });
      attempt = ProductCompilationAttemptV1Schema.parse(recovered.attempt);
      recordAttempt(input.attempts, attempt);
      if (recovered.status === "dispatching_must_quarantine") {
        try {
          attempt = await sealFailure({
            repository: input.dependencies.repository,
            repo: input.repo,
            attempt,
            ownerInstanceId: input.ownerInstanceId,
            disposition: "dispatch_ambiguous",
            failure: expiredDispatchFailureSeed(attempt),
          });
          recordAttempt(input.attempts, attempt);
          return {
            kind: "failed",
            attempt,
            inputs: {
              authority: input.authority,
              request: input.request,
              stagePrompts: input.stagePrompts,
              retryDelta: input.retryDelta,
            },
          };
        } catch {
          return {
            kind: "runner_failure",
            result: runnerFailure(
              "DESIGN_SOURCE_RUNNER_FAILURE_SEAL_FAILED",
              input.attempts,
              attempt,
            ),
          };
        }
      }
      reservation = { status: "reserved", attempt };
    } catch {
      // The repository uses the database clock as authority. A live lease,
      // same-owner recovery, or concurrent recovery loss remains an ordinary
      // active conflict and follows the bounded terminal wait below.
    }
  }
  if (reservation.status !== "already_accepted") {
    try {
      requireAttemptBinding({
        attempt,
        authority: input.authority,
        request: input.request,
        requestHash,
        ...(reservation.status === "reserved" ? { ownerClaimId: input.ownerClaimId } : {}),
      });
    } catch {
      return {
        kind: "runner_failure",
        result: runnerFailure("DESIGN_SOURCE_RUNNER_ATTEMPT_AUTHORITY_MISMATCH", input.attempts, attempt),
      };
    }
  }

  if (reservation.status !== "reserved") {
    if (["reserved", "dispatching"].includes(attempt.state)) {
      attempt = await waitForTerminal({
        repository: input.dependencies.repository,
        attempt,
        waitMs: input.duplicateWaitMs,
        pollMs: input.duplicatePollMs,
      });
      recordAttempt(input.attempts, attempt);
    }
    if (["reserved", "dispatching"].includes(attempt.state)) {
      return { kind: "in_progress", attempt };
    }
    let stored: StoredAttemptInputs;
    try {
      stored = await readStoredInputs(input.repo, attempt);
      if (attempt.disposition === "accepted") {
        const projection = await finalizeAccepted({
          repo: input.repo,
          attempt,
          projectAccepted: input.dependencies.projectAccepted,
        });
        return { kind: "accepted", attempt, projection, replayed: true };
      }
      await readStoredFailureArtifact(input.repo, attempt);
    } catch {
      return {
        kind: "runner_failure",
        result: runnerFailure("DESIGN_SOURCE_RUNNER_REPLAY_INVALID", input.attempts, attempt),
      };
    }
    return { kind: "failed", attempt, inputs: stored };
  }

  try {
    await writeAttemptInputs({
      repo: input.repo,
      attempt,
      authority: input.authority,
      request: input.request,
      stagePrompts: input.stagePrompts,
      retryDelta: input.retryDelta,
    });
  } catch {
    return {
      kind: "runner_failure",
      result: runnerFailure("DESIGN_SOURCE_RUNNER_IMMUTABLE_INPUT_INVALID", input.attempts, attempt),
    };
  }

  const operationId = externalOperationId(attempt);
  try {
    attempt = await input.dependencies.repository.commitDispatchIntent({
      ...fence(attempt, input.ownerInstanceId),
      externalOperationId: operationId,
    });
    recordAttempt(input.attempts, attempt);
  } catch {
    return {
      kind: "runner_failure",
      result: runnerFailure("DESIGN_SOURCE_RUNNER_DISPATCH_INTENT_FAILED", input.attempts, attempt),
    };
  }

  const writer = artifactWrite(input.repo, attempt);
  const stageResults: DesignSourceGenerationAcceptedStageResultV2[] = [];
  for (const stage of input.request.stages) {
    const stagePrompt = input.stagePrompts.find((candidate) => candidate.stageId === stage.stageId)!;
    const carryForward = input.retryDelta !== null
      && !input.retryDelta.changes.some((change) => change.stageId === stage.stageId);
    let dispatchResult: DesignSourceGenerationDispatchResultV2;
    let rawEvidence: ProductCompilationAttemptArtifactRefV1;
    try {
      const delivery = await dispatchWithHeartbeat({
        repository: input.dependencies.repository,
        attempt,
        ownerInstanceId: input.ownerInstanceId,
        leaseMs: input.leaseMs,
        heartbeatIntervalMs: input.heartbeatIntervalMs,
        dispatch: async (signal) => {
          const result = carryForward
            ? await (() => {
                if (!input.dependencies.reuseStage || !input.request.retryAuthority) {
                  throw new Error("DESIGN_SOURCE_CARRY_FORWARD_HANDLER_MISSING");
                }
                return input.dependencies.reuseStage({
                  authority: input.authority,
                  request: input.request,
                  stage,
                  prompt: stagePrompt.prompt,
                  attempt,
                  parentAttemptRef: input.request.retryAuthority.parentAttemptRef,
                  signal,
                  writeEvidence: writer,
                });
              })()
            : await input.dependencies.dispatchStage({
                authority: input.authority,
                request: input.request,
                stage,
                prompt: stagePrompt.prompt,
                attempt,
                externalOperationId: `${operationId}:${stage.stageId}`,
                signal,
                writeEvidence: writer,
              });
          const raw = await writeStageRawEvidence(writer, stage.stageId, result.rawEvidence);
          return { result, raw };
        },
      });
      dispatchResult = delivery.result;
      rawEvidence = delivery.raw;
    } catch (error) {
      try {
        attempt = await sealFailure({
          repository: input.dependencies.repository,
          repo: input.repo,
          attempt,
          ownerInstanceId: input.ownerInstanceId,
          disposition: carryForward ? "infrastructure_failure" : "dispatch_ambiguous",
          failure: carryForward
            ? carryForwardFailureSeed(attempt, stage.stageId, error)
            : ambiguousFailureSeed(attempt, "provider_dispatch", stage.stageId, error),
        });
        recordAttempt(input.attempts, attempt);
        return { kind: "failed", attempt, inputs: {
          authority: input.authority,
          request: input.request,
          stagePrompts: input.stagePrompts,
          retryDelta: input.retryDelta,
        } };
      } catch {
        return {
          kind: "runner_failure",
          result: runnerFailure("DESIGN_SOURCE_RUNNER_FAILURE_SEAL_FAILED", input.attempts, attempt),
        };
      }
    }

    if (dispatchResult.disposition !== "accepted") {
      let failure: z.infer<typeof DispatchFailureSeedSchema>;
      try {
        failure = DispatchFailureSeedSchema.parse(dispatchResult.failure);
      } catch (error) {
        try {
          attempt = await sealFailure({
            repository: input.dependencies.repository,
            repo: input.repo,
            attempt,
            ownerInstanceId: input.ownerInstanceId,
            disposition: "dispatch_ambiguous",
            failure: ambiguousFailureSeed(attempt, "dispatch_result_validation", stage.stageId, error),
          });
          recordAttempt(input.attempts, attempt);
          return { kind: "failed", attempt, inputs: {
            authority: input.authority,
            request: input.request,
            stagePrompts: input.stagePrompts,
            retryDelta: input.retryDelta,
          } };
        } catch {
          return {
            kind: "runner_failure",
            result: runnerFailure("DESIGN_SOURCE_RUNNER_FAILURE_SEAL_FAILED", input.attempts, attempt),
          };
        }
      }
      try {
        attempt = await sealFailure({
          repository: input.dependencies.repository,
          repo: input.repo,
          attempt,
          ownerInstanceId: input.ownerInstanceId,
          disposition: dispatchResult.disposition,
          failure: {
            ...failure,
            evidence: {
              stageId: stage.stageId,
              rawEvidence,
              providerEvidence: failure.evidence,
            },
          },
        });
        recordAttempt(input.attempts, attempt);
        return { kind: "failed", attempt, inputs: {
          authority: input.authority,
          request: input.request,
          stagePrompts: input.stagePrompts,
          retryDelta: input.retryDelta,
        } };
      } catch {
        return {
          kind: "runner_failure",
          result: runnerFailure("DESIGN_SOURCE_RUNNER_FAILURE_SEAL_FAILED", input.attempts, attempt),
        };
      }
    }
    stageResults.push({
      stageId: stage.stageId,
      targetRefs: stage.targetRefs,
      response: dispatchResult.response,
      rawEvidence,
    });
  }

  let bundle: AcceptedArtifactBundle;
  try {
    bundle = await dispatchWithHeartbeat({
      repository: input.dependencies.repository,
      attempt,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs: input.leaseMs,
      heartbeatIntervalMs: input.heartbeatIntervalMs,
      dispatch: async (signal) => {
        const artifacts = await input.dependencies.materializeAccepted({
          authority: input.authority,
          request: input.request,
          stageResults,
          attempt,
          signal,
          writeEvidence: writer,
        });
        return writeAcceptedBundle(input.repo, attempt, artifacts);
      },
    });
  } catch (error) {
    const typed = error instanceof DesignSourceMaterializationFailureV2 ? error : undefined;
    try {
      attempt = await sealFailure({
        repository: input.dependencies.repository,
        repo: input.repo,
        attempt,
        ownerInstanceId: input.ownerInstanceId,
        disposition: typed?.disposition ?? "infrastructure_failure",
        failure: typed?.failure ?? {
          ...ambiguousFailureSeed(attempt, "accepted_artifact_materialization", null, error),
          reasonCodes: ["DESIGN_SOURCE_ACCEPTED_ARTIFACT_INVALID"],
        },
      });
      recordAttempt(input.attempts, attempt);
      return { kind: "failed", attempt, inputs: {
        authority: input.authority,
        request: input.request,
        stagePrompts: input.stagePrompts,
        retryDelta: input.retryDelta,
      } };
    } catch {
      return {
        kind: "runner_failure",
        result: runnerFailure("DESIGN_SOURCE_RUNNER_ACCEPTED_ARTIFACT_INVALID", input.attempts, attempt),
      };
    }
  }

  try {
    attempt = await input.dependencies.repository.sealAccepted({
      ...fence(attempt, input.ownerInstanceId),
      outputRefs: bundle.outputRefs,
    });
    recordAttempt(input.attempts, attempt);
  } catch {
    return {
      kind: "runner_failure",
      result: runnerFailure("DESIGN_SOURCE_RUNNER_ACCEPTED_SEAL_FAILED", input.attempts, attempt),
    };
  }

  try {
    const projection = await finalizeAccepted({
      repo: input.repo,
      attempt,
      bundle,
      projectAccepted: input.dependencies.projectAccepted,
    });
    return { kind: "accepted", attempt, projection, replayed: false };
  } catch {
    return {
      kind: "runner_failure",
      result: runnerFailure("DESIGN_SOURCE_RUNNER_PROJECTION_FAILED", input.attempts, attempt),
    };
  }
}

export async function runDesignSourceCompilationAttemptsV2(
  input: DesignSourceCompilationAttemptRunnerInputV2,
  dependencies: DesignSourceCompilationAttemptRunnerDependenciesV2,
): Promise<DesignSourceCompilationAttemptRunnerResultV2> {
  const attempts: ProductCompilationAttemptV1[] = [];
  let authority: DesignSourceGenerationAuthorityV1;
  let request: DesignSourceGenerationRequestV2;
  let stagePrompts: readonly CanonicalStagePrompt[];
  try {
    authority = DesignSourceGenerationAuthorityV1Schema.parse(input.authority);
    request = DesignSourceGenerationRequestV2Schema.parse(input.request);
    stagePrompts = canonicalStagePrompts(request, input.stagePrompts);
    requireExactTargetPartition(authority, request);
    if (
      request.ordinal !== 1
      || request.retryAuthority !== null
      || request.authorityHash !== hashCanonicalJson(authority)
      || !Number.isInteger(input.ownerClaimId)
      || input.ownerClaimId <= 0
      || !input.ownerInstanceId
      || input.ownerInstanceId.length > 500
    ) {
      throw new Error("DESIGN_SOURCE_INITIAL_REQUEST_INVALID");
    }
  } catch {
    return runnerFailure("DESIGN_SOURCE_RUNNER_INPUT_INVALID", attempts);
  }

  const leaseMs = input.leaseMs ?? 5 * 60_000;
  const heartbeatIntervalMs = input.heartbeatIntervalMs ?? Math.max(1_000, Math.floor(leaseMs / 3));
  const duplicateWaitMs = input.duplicateWaitMs ?? 30_000;
  const duplicatePollMs = input.duplicatePollMs ?? 50;
  if (
    leaseMs < 5_000
    || leaseMs > 30 * 60_000
    || heartbeatIntervalMs < 1
    || heartbeatIntervalMs >= leaseMs
    || duplicateWaitMs < 0
    || duplicatePollMs < 1
  ) {
    return runnerFailure("DESIGN_SOURCE_RUNNER_INPUT_INVALID", attempts);
  }

  let retryDelta: DesignSourceGenerationRetryDeltaV1 | null = null;
  for (;;) {
    const single = await runSingleAttempt({
      repo: input.repo,
      authority,
      request,
      stagePrompts,
      retryDelta,
      ownerClaimId: input.ownerClaimId,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs,
      heartbeatIntervalMs,
      duplicateWaitMs,
      duplicatePollMs,
      dependencies,
      attempts,
    });
    if (single.kind === "runner_failure") return single.result;
    if (single.kind === "in_progress") {
      return { status: "in_progress", attempt: single.attempt, attempts: [...attempts] };
    }
    if (single.kind === "accepted") {
      return {
        status: "accepted",
        attempt: single.attempt,
        attempts: [...attempts],
        projection: single.projection,
        replayed: single.replayed,
      };
    }

    const failedAttempt = ProductCompilationAttemptV1Schema.parse(single.attempt);
    const failure = failedAttempt.failure!;
    if (failedAttempt.disposition === "dispatch_ambiguous") {
      return { status: "dispatch_ambiguous", attempt: failedAttempt, attempts: [...attempts], failure };
    }
    const disposition = failedAttempt.disposition as "rejected" | "infrastructure_failure";
    if (failedAttempt.ordinal === 2) {
      const parentFingerprint = failedAttempt.retryAuthority?.parentFailureFingerprint;
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: parentFingerprint === failure.failureFingerprint
          ? "repeated_failure"
          : "maximum_attempts",
      };
    }
    if (!dependencies.planRetry) {
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: "no_retry",
      };
    }

    let planned: Readonly<{ stagePrompts: readonly DesignSourceGenerationStagePromptV2[] }> | null;
    let failureEvidence: unknown;
    try {
      failureEvidence = (await readStoredFailureArtifact(input.repo, failedAttempt)).evidence;
    } catch {
      return runnerFailure("DESIGN_SOURCE_RUNNER_REPLAY_INVALID", attempts, failedAttempt);
    }
    try {
      planned = await dependencies.planRetry({
        authority: single.inputs.authority,
        request: single.inputs.request,
        stagePrompts: single.inputs.stagePrompts.map(({ stageId, prompt }) => ({ stageId, prompt })),
        attempt: failedAttempt,
        failure,
        failureEvidence,
      });
    } catch {
      return runnerFailure("DESIGN_SOURCE_RUNNER_RETRY_PLANNER_FAILED", attempts, failedAttempt);
    }
    if (!planned) {
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: "no_retry",
      };
    }

    let nextStagePrompts: readonly CanonicalStagePrompt[];
    try {
      const nextRequestShape = DesignSourceGenerationRequestV2Schema.parse({
        ...single.inputs.request,
        stages: single.inputs.request.stages.map((stage) => {
          const plannedPrompt = planned!.stagePrompts.find((candidate) => candidate.stageId === stage.stageId);
          if (!plannedPrompt) throw new Error("DESIGN_SOURCE_RETRY_STAGE_PROMPT_MISSING");
          return {
            ...stage,
            promptHash: canonicalDesignSourceGenerationPromptV2(plannedPrompt.prompt).promptHash,
          };
        }),
      });
      nextStagePrompts = canonicalStagePrompts(nextRequestShape, planned.stagePrompts);
    } catch {
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: "unchanged_retry",
      };
    }
    const changes = single.inputs.request.stages.flatMap((stage) => {
      const next = nextStagePrompts.find((candidate) => candidate.stageId === stage.stageId)!;
      return next.promptHash === stage.promptHash ? [] : [{
        stageId: stage.stageId,
        previousHash: stage.promptHash,
        nextHash: next.promptHash,
      }];
    });
    if (changes.length === 0) {
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: "unchanged_retry",
      };
    }

    retryDelta = DesignSourceGenerationRetryDeltaV1Schema.parse({
      schema: "setfarm.design-source-generation-retry-delta.v1",
      parentAttemptRef: failedAttempt.attemptId,
      parentFailureArtifactHash: failure.failureArtifactHash,
      parentFailureFingerprint: failure.failureFingerprint,
      previousRequestHash: failedAttempt.requestHash,
      changes,
    });
    const retryAuthority = {
      parentAttemptRef: failedAttempt.attemptId,
      parentFailureArtifactHash: failure.failureArtifactHash,
      parentFailureFingerprint: failure.failureFingerprint,
      retryDeltaHash: hashCanonicalJson(retryDelta),
    };
    request = DesignSourceGenerationRequestV2Schema.parse({
      schema: "setfarm.design-source-generation-request.v2",
      authorityHash: failedAttempt.authorityHash,
      ordinal: 2,
      retryAuthority,
      stages: single.inputs.request.stages.map((stage) => ({
        ...stage,
        promptHash: nextStagePrompts.find((candidate) => candidate.stageId === stage.stageId)!.promptHash,
      })),
    });
    if (hashCanonicalJson(request) === failedAttempt.requestHash) {
      return {
        status: disposition,
        attempt: failedAttempt,
        attempts: [...attempts],
        failure,
        stopReason: "unchanged_retry",
      };
    }
    stagePrompts = nextStagePrompts;
  }
}
