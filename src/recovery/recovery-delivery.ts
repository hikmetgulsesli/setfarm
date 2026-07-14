import { z } from "zod";

import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import {
  ExpectedDeltaV1Schema,
  RecoveryDispatchClassV1Schema,
  RecoveryOwnerV1Schema,
} from "./recovery-case.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const TimestampSchema = z.string().datetime({ offset: true });
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const FindingIdSchema = z.string().regex(/^FIND_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function isCanonical(values: readonly string[]): boolean {
  const expected = canonical(values);
  return values.length === expected.length && values.every((value, index) => value === expected[index]);
}

function canonicalExpectedDelta(value: z.infer<typeof ExpectedDeltaV1Schema>) {
  if (value.kind === "source_change") {
    return {
      ...value,
      invariantRefs: canonical(value.invariantRefs),
      requiredPaths: canonical(value.requiredPaths),
    };
  }
  if (value.kind === "evidence_refresh") {
    return { ...value, predicateRefs: canonical(value.predicateRefs) };
  }
  if (value.kind === "upstream_recompile") {
    return { ...value, artifactKinds: canonical(value.artifactKinds) as typeof value.artifactKinds };
  }
  return value;
}

const RecoveryCaseRevisionCoreV1Schema = z.object({
  schema: z.literal("setfarm.recovery-case-revision.v1"),
  revisionId: RecoveryRevisionIdSchema,
  revisionIdentityKey: Sha256Schema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionNumber: z.number().int().positive(),
  parentRevisionId: RecoveryRevisionIdSchema.optional(),
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  findingSetHash: Sha256Schema,
  findingIds: z.array(FindingIdSchema).min(1).max(5_000),
  packetHash: Sha256Schema,
  contractSliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  owner: RecoveryOwnerV1Schema,
  expectedDelta: ExpectedDeltaV1Schema,
  allowedPaths: z.array(NormalizedRelativeLocatorSchema).max(20_000),
  evidencePlan: z.array(EvidenceIdSchema).min(1).max(5_000),
  evidencePlanArtifactHash: Sha256Schema.optional(),
  createdAt: TimestampSchema,
}).strict();

export type RecoveryCaseRevisionV1 = z.infer<typeof RecoveryCaseRevisionCoreV1Schema>;
export type RecoveryCaseRevisionDraftV1 = Omit<
  RecoveryCaseRevisionV1,
  "schema" | "revisionId" | "revisionIdentityKey" | "createdAt"
>;

function revisionIdentity(value: RecoveryCaseRevisionDraftV1): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-case-revision-identity.v1",
    ...value,
  });
}

export const RecoveryCaseRevisionV1Schema = RecoveryCaseRevisionCoreV1Schema.superRefine((value, context) => {
  const { schema: _schema, revisionId: _revisionId, revisionIdentityKey: _key, createdAt: _createdAt, ...draft } = value;
  const expected = revisionIdentity(draft);
  if (value.revisionIdentityKey !== expected) {
    context.addIssue({ code: "custom", path: ["revisionIdentityKey"], message: "Revision key must bind exact recovery semantics" });
  }
  if (value.revisionId !== `RREV_${expected}`) {
    context.addIssue({ code: "custom", path: ["revisionId"], message: "Revision ID must derive from its semantic key" });
  }
  if ((value.revisionNumber === 1) !== !value.parentRevisionId) {
    context.addIssue({ code: "custom", path: ["parentRevisionId"], message: "Only the first recovery revision may omit a parent" });
  }
  for (const [name, values] of [
    ["findingIds", value.findingIds],
    ["allowedPaths", value.allowedPaths],
    ["evidencePlan", value.evidencePlan],
  ] as const) {
    if (!isCanonical(values)) {
      context.addIssue({ code: "custom", path: [name], message: `${name} must be unique and canonically sorted` });
    }
  }
  if (value.expectedDelta.kind === "source_change") {
    const allowed = new Set(value.allowedPaths);
    value.expectedDelta.requiredPaths.forEach((requiredPath, index) => {
      if (!allowed.has(requiredPath)) {
        context.addIssue({
          code: "custom",
          path: ["expectedDelta", "requiredPaths", index],
          message: `Required repair path is outside revision authority: ${requiredPath}`,
        });
      }
    });
  } else if (value.allowedPaths.length > 0) {
    context.addIssue({ code: "custom", path: ["allowedPaths"], message: "Non-source revision cannot grant write paths" });
  }
  const ownerValid =
    (value.owner === "implement" && value.expectedDelta.kind === "source_change")
    || (value.owner === "supervisor" && ["source_change", "evidence_refresh", "upstream_recompile"].includes(value.expectedDelta.kind))
    || (value.owner === "compiler" && value.expectedDelta.kind === "upstream_recompile")
    || (value.owner === "infrastructure" && value.expectedDelta.kind === "evidence_refresh")
    || (value.owner === "operator" && value.expectedDelta.kind === "operator_action");
  if (!ownerValid) {
    context.addIssue({ code: "custom", path: ["owner"], message: "Revision owner lacks authority for its expected delta" });
  }
});

export function createRecoveryCaseRevisionV1(
  input: RecoveryCaseRevisionDraftV1,
  options: Readonly<{ now?: Date }> = {},
): RecoveryCaseRevisionV1 {
  const parsed = RecoveryCaseRevisionCoreV1Schema.omit({
    schema: true,
    revisionId: true,
    revisionIdentityKey: true,
    createdAt: true,
  }).parse(input);
  const draft = {
    ...parsed,
    findingIds: canonical(parsed.findingIds),
    expectedDelta: canonicalExpectedDelta(parsed.expectedDelta),
    allowedPaths: canonical(parsed.allowedPaths),
    evidencePlan: canonical(parsed.evidencePlan),
  };
  const identity = revisionIdentity(draft);
  const now = new Date(options.now ?? new Date());
  if (!Number.isFinite(now.getTime())) throw new Error("RECOVERY_REVISION_TIME_INVALID");
  return RecoveryCaseRevisionV1Schema.parse({
    schema: "setfarm.recovery-case-revision.v1",
    revisionId: `RREV_${identity}`,
    revisionIdentityKey: identity,
    ...draft,
    createdAt: now.toISOString(),
  });
}

export function computeRevisionDispatchDedupeKey(input: Readonly<{
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>;
  runId: string;
  storyId: string;
  findingIds: readonly string[];
  packetHash: string;
  sourceTreeHash: string;
  evidencePlan: readonly string[];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-revision-dispatch-dedupe.v1",
    dispatchClass: input.dispatchClass,
    runId: input.runId,
    storyId: input.storyId,
    findingIds: canonical(input.findingIds),
    packetHash: input.packetHash,
    sourceTreeHash: input.sourceTreeHash,
    ...(input.dispatchClass === "evidence_only" ? { evidencePlan: canonical(input.evidencePlan) } : {}),
  });
}

export function computeRevisionFindingDispatchKey(input: Readonly<{
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>;
  runId: string;
  storyId: string;
  findingId: string;
  packetHash: string;
  sourceTreeHash: string;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-revision-finding-dispatch-dedupe.v1",
    dispatchClass: input.dispatchClass,
    runId: input.runId,
    storyId: input.storyId,
    findingId: FindingIdSchema.parse(input.findingId),
    packetHash: Sha256Schema.parse(input.packetHash),
    sourceTreeHash: input.sourceTreeHash,
  });
}

export const RecoveryRevisionDispatchV1Schema = z.object({
  schema: z.literal("setfarm.recovery-revision-dispatch.v1"),
  dispatchId: RecoveryDispatchIdSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  dispatchClass: RecoveryDispatchClassV1Schema,
  dispatchDedupeKey: Sha256Schema,
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  sourceRevision: SourceRevisionV1Schema,
  packetHash: Sha256Schema,
  contractSliceHash: Sha256Schema,
  findingSetHash: Sha256Schema,
  findingIds: z.array(FindingIdSchema).min(1).max(5_000),
  evidencePlan: z.array(EvidenceIdSchema).min(1).max(5_000),
  evidencePlanArtifactHash: Sha256Schema.optional(),
  authorizedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const expected = computeRevisionDispatchDedupeKey({
    dispatchClass: value.dispatchClass,
    runId: value.runId,
    storyId: value.storyId,
    findingIds: value.findingIds,
    packetHash: value.packetHash,
    sourceTreeHash: value.sourceRevision.treeHash,
    evidencePlan: value.evidencePlan,
  });
  if (value.dispatchDedupeKey !== expected || value.dispatchId !== `RDISP_${expected}`) {
    context.addIssue({ code: "custom", path: ["dispatchId"], message: "Dispatch ID must bind exact unchanged-source authorization" });
  }
  if (!isCanonical(value.findingIds) || !isCanonical(value.evidencePlan)) {
    context.addIssue({ code: "custom", path: ["findingIds"], message: "Dispatch refs must be canonical" });
  }
});

export type RecoveryRevisionDispatchV1 = z.infer<typeof RecoveryRevisionDispatchV1Schema>;

export const RecoveryDeliveryStateV1Schema = z.enum([
  "authorized",
  "leased",
  "attempt_reserved",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "superseded",
]);

export const RecoveryDispatchDeliveryV1Schema = z.object({
  schema: z.literal("setfarm.recovery-dispatch-delivery.v1"),
  dispatchId: RecoveryDispatchIdSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  state: RecoveryDeliveryStateV1Schema,
  ownerInstanceId: BoundedIdentitySchema.optional(),
  leaseToken: z.string().min(16).max(500).optional(),
  leaseExpiresAt: TimestampSchema.optional(),
  attemptId: AttemptIdSchema.optional(),
  claimId: z.number().int().positive().optional(),
  executionSliceHash: Sha256Schema.optional(),
  attemptCount: z.number().int().nonnegative(),
  terminalResult: z.record(z.string(), z.unknown()),
  diagnostic: z.string().max(10_000).optional(),
  authorizedAt: TimestampSchema,
  startedAt: TimestampSchema.optional(),
  terminalAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const leaseFields = [value.ownerInstanceId, value.leaseToken, value.leaseExpiresAt].filter(Boolean).length;
  if ((value.state === "authorized" && leaseFields !== 0) || (value.state !== "authorized" && leaseFields !== 3)) {
    context.addIssue({ code: "custom", path: ["leaseToken"], message: "Delivery lease identity must match its state" });
  }
  if (Boolean(value.attemptId) !== Boolean(value.claimId)) {
    context.addIssue({ code: "custom", path: ["attemptId"], message: "Delivery attempt and claim identities must be paired" });
  }
  const requiresAttempt = ["attempt_reserved", "running", "succeeded", "failed"].includes(value.state);
  if (requiresAttempt && (!value.attemptId || !value.executionSliceHash)) {
    context.addIssue({ code: "custom", path: ["attemptId"], message: "Attempt delivery state requires attempt and execution slice" });
  }
  const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(value.state);
  if (terminal !== Boolean(value.terminalAt)) {
    context.addIssue({ code: "custom", path: ["terminalAt"], message: "Terminal delivery state requires an exact terminal timestamp" });
  }
});

export type RecoveryDispatchDeliveryV1 = z.infer<typeof RecoveryDispatchDeliveryV1Schema>;
