import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  EvidenceIdSchema,
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const TimestampSchema = z.string().datetime({ offset: true });
const FindingIdSchema = z.string().regex(/^FIND_[a-f0-9]{64}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const AttemptRefSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);

export const RecoveryOwnerV1Schema = z.enum([
  "implement",
  "supervisor",
  "compiler",
  "infrastructure",
  "operator",
]);

export const RecoveryStatusV1Schema = z.enum([
  "open",
  "repairing",
  "evidencing",
  "resolved",
  "blocked",
  "superseded",
]);

export const RecoveryDispatchClassV1Schema = z.enum([
  "product_implementation",
  "supervisor_repair",
  "evidence_only",
]);

export const ExpectedDeltaV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("source_change"),
    invariantRefs: z.array(z.string().regex(/^INV_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)).min(1).max(1_000),
    requiredPaths: z.array(NormalizedRelativeLocatorSchema).min(1).max(10_000),
  }).strict(),
  z.object({
    kind: z.literal("evidence_refresh"),
    predicateRefs: z.array(EvidenceIdSchema).min(1).max(5_000),
  }).strict(),
  z.object({
    kind: z.literal("upstream_recompile"),
    artifactKinds: z.array(z.enum([
      "product_spec",
      "design_graph",
      "build_topology",
      "story_plan",
      "implementation_slice",
    ])).min(1).max(5),
  }).strict(),
  z.object({
    kind: z.literal("operator_action"),
    reasonCode: z.enum([
      "credential_required",
      "external_state_required",
      "policy_decision_required",
      "specification_decision_required",
    ]),
  }).strict(),
]);

export const RecoveryBudgetV1Schema = z.object({
  limits: z.object({
    implement: z.number().int().min(0).max(1),
    supervisorRepair: z.number().int().min(0).max(1),
    evidenceOnly: z.number().int().min(0).max(3),
  }).strict(),
  used: z.object({
    implement: z.number().int().min(0).max(1),
    supervisorRepair: z.number().int().min(0).max(1),
    evidenceOnly: z.number().int().min(0).max(3),
  }).strict(),
}).strict().superRefine((value, context) => {
  for (const key of ["implement", "supervisorRepair", "evidenceOnly"] as const) {
    if (value.used[key] > value.limits[key]) {
      context.addIssue({
        code: "custom",
        path: ["used", key],
        message: `${key} usage exceeds its bounded recovery budget`,
      });
    }
  }
});

export const RecoveryTerminalV1Schema = z.object({
  owner: RecoveryOwnerV1Schema,
  outcome: z.enum(["resolved", "blocked", "superseded"]),
  reasonCode: z.enum([
    "evidence_satisfied",
    "specification_incomplete",
    "evidence_inconclusive",
    "budget_exhausted",
    "source_superseded",
    "upstream_recompile_required",
    "operator_required",
  ]),
  evidenceBundleHashes: z.array(Sha256Schema).max(5_000),
}).strict().superRefine((value, context) => {
  if (!isCanonical(value.evidenceBundleHashes)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceBundleHashes"],
      message: "Terminal evidence bundle hashes must be unique and canonically sorted",
    });
  }
  if (value.outcome === "resolved" && value.evidenceBundleHashes.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["evidenceBundleHashes"],
      message: "Resolved recovery requires current exact evidence",
    });
  }
});

const RecoveryCaseCoreV1Schema = z.object({
  schema: z.literal("setfarm.recovery-case.v1"),
  recoveryCaseId: RecoveryCaseIdSchema,
  dedupeKey: Sha256Schema,
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  findingSetHash: Sha256Schema,
  findingIds: z.array(FindingIdSchema).min(1).max(5_000),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  owner: RecoveryOwnerV1Schema,
  expectedDelta: ExpectedDeltaV1Schema,
  allowedPaths: z.array(NormalizedRelativeLocatorSchema).max(20_000),
  evidencePlan: z.array(EvidenceIdSchema).min(1).max(5_000),
  priorAttemptRefs: z.array(AttemptRefSchema).max(5_000),
  budget: RecoveryBudgetV1Schema,
  status: RecoveryStatusV1Schema,
  terminal: RecoveryTerminalV1Schema.optional(),
  decisionRefs: z.array(Sha256Schema).max(10_000),
  stateVersion: z.number().int().positive(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export type RecoveryCaseV1 = z.infer<typeof RecoveryCaseCoreV1Schema>;
export type RecoveryCaseDraftV1 = Omit<
  RecoveryCaseV1,
  "schema" | "recoveryCaseId" | "dedupeKey" | "stateVersion" | "createdAt" | "updatedAt"
>;

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(lexical);
}

export function computeRecoveryCaseDedupeKey(input: Readonly<{
  runId: string;
  storyId: string;
  findingSetHash: string;
  packetHash: string;
  sliceHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-case-dedupe.v1",
    runId: input.runId,
    storyId: input.storyId,
    findingSetHash: input.findingSetHash,
    packetHash: input.packetHash,
    sliceHash: input.sliceHash,
    sourceRevision: input.sourceRevision,
  });
}

function expectedRecoveryCaseId(dedupeKey: string): string {
  return `RCV_${dedupeKey}`;
}

export function computeRecoveryDispatchDedupeKey(input: Readonly<{
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>;
  runId: string;
  storyId: string;
  findingIds: readonly string[];
  packetHash: string;
  sliceHash: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  evidencePlan: readonly string[];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-dispatch-dedupe.v1",
    dispatchClass: input.dispatchClass,
    runId: input.runId,
    storyId: input.storyId,
    findingIds: sortedUnique(input.findingIds),
    packetHash: input.packetHash,
    sliceHash: input.sliceHash,
    // The tree hash is the unchanged-source identity. An empty Git commit must
    // not create another model retry for identical product source.
    sourceTreeHash: input.sourceRevision.treeHash,
    ...(input.dispatchClass === "evidence_only"
      ? { evidencePlan: sortedUnique(input.evidencePlan) }
      : {}),
  });
}

export function computeRecoveryFindingDispatchDedupeKey(input: Readonly<{
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>;
  runId: string;
  storyId: string;
  findingId: string;
  packetHash: string;
  sliceHash: string;
  sourceTreeHash: string;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.recovery-finding-dispatch-dedupe.v1",
    dispatchClass: input.dispatchClass,
    runId: input.runId,
    storyId: input.storyId,
    findingId: FindingIdSchema.parse(input.findingId),
    packetHash: Sha256Schema.parse(input.packetHash),
    sliceHash: Sha256Schema.parse(input.sliceHash),
    sourceTreeHash: GitObjectHashSchema.parse(input.sourceTreeHash),
  });
}

function isCanonical(values: readonly string[]): boolean {
  const canonical = sortedUnique(values);
  return values.length === canonical.length && values.every((value, index) => value === canonical[index]);
}

export const RecoveryCaseV1Schema = RecoveryCaseCoreV1Schema.superRefine((value, context) => {
  const expectedDedupe = computeRecoveryCaseDedupeKey(value);
  if (value.dedupeKey !== expectedDedupe) {
    context.addIssue({
      code: "custom",
      path: ["dedupeKey"],
      message: "Recovery dedupe must bind exact finding set, source, packet, and slice",
    });
  }
  if (value.recoveryCaseId !== expectedRecoveryCaseId(value.dedupeKey)) {
    context.addIssue({
      code: "custom",
      path: ["recoveryCaseId"],
      message: "Recovery-case ID must derive from its exact dedupe key",
    });
  }
  for (const [key, values] of [
    ["findingIds", value.findingIds],
    ["allowedPaths", value.allowedPaths],
    ["evidencePlan", value.evidencePlan],
    ["priorAttemptRefs", value.priorAttemptRefs],
    ["decisionRefs", value.decisionRefs],
  ] as const) {
    if (!isCanonical(values)) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be unique and canonically sorted` });
    }
  }
  const terminalStatus = ["resolved", "blocked", "superseded"].includes(value.status);
  if (terminalStatus !== Boolean(value.terminal)) {
    context.addIssue({
      code: "custom",
      path: ["terminal"],
      message: "Terminal recovery states require explicit terminal ownership and evidence",
    });
  }
  if (value.terminal && value.terminal.outcome !== value.status) {
    context.addIssue({
      code: "custom",
      path: ["terminal", "outcome"],
      message: "Terminal outcome must match the recovery status",
    });
  }
  if (value.terminal && value.terminal.owner !== value.owner) {
    context.addIssue({
      code: "custom",
      path: ["terminal", "owner"],
      message: "Terminal owner must be the active bounded recovery owner",
    });
  }
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    context.addIssue({
      code: "custom",
      path: ["updatedAt"],
      message: "Recovery update time must not precede creation",
    });
  }
  const deltaRefs = value.expectedDelta.kind === "source_change"
    ? [
        ["invariantRefs", value.expectedDelta.invariantRefs] as const,
        ["requiredPaths", value.expectedDelta.requiredPaths] as const,
      ]
    : value.expectedDelta.kind === "evidence_refresh"
      ? [["predicateRefs", value.expectedDelta.predicateRefs] as const]
      : value.expectedDelta.kind === "upstream_recompile"
        ? [["artifactKinds", value.expectedDelta.artifactKinds] as const]
        : [];
  for (const [key, refs] of deltaRefs) {
    if (!isCanonical(refs)) {
      context.addIssue({
        code: "custom",
        path: ["expectedDelta", key],
        message: `${key} must be unique and canonically sorted`,
      });
    }
  }
  if (value.expectedDelta.kind === "source_change") {
    if (!value.allowedPaths.length) {
      context.addIssue({ code: "custom", path: ["allowedPaths"], message: "Source repair requires bounded paths" });
    }
    const allowed = new Set(value.allowedPaths);
    value.expectedDelta.requiredPaths.forEach((path, index) => {
      if (!allowed.has(path)) {
        context.addIssue({
          code: "custom",
          path: ["expectedDelta", "requiredPaths", index],
          message: `Expected source delta is outside allowed paths: ${path}`,
        });
      }
    });
  } else if (value.allowedPaths.length) {
    context.addIssue({
      code: "custom",
      path: ["allowedPaths"],
      message: "Non-source recovery must not grant source write paths",
    });
  }
  const ownerDeltaValid =
    (value.owner === "implement" && value.expectedDelta.kind === "source_change")
    || (value.owner === "supervisor" && ["source_change", "evidence_refresh", "upstream_recompile"].includes(value.expectedDelta.kind))
    || (value.owner === "compiler" && value.expectedDelta.kind === "upstream_recompile")
    || (value.owner === "infrastructure" && value.expectedDelta.kind === "evidence_refresh")
    || (value.owner === "operator" && value.expectedDelta.kind === "operator_action");
  if (!ownerDeltaValid) {
    context.addIssue({
      code: "custom",
      path: ["owner"],
      message: "Recovery owner must have authority for the typed expected delta",
    });
  }
  if (value.status === "repairing" && value.owner !== "implement" && value.owner !== "supervisor") {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Repairing recovery requires implement or supervisor ownership",
    });
  }
  if (
    value.status === "evidencing"
    && (value.owner !== "supervisor" && value.owner !== "infrastructure")
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Evidencing recovery requires supervisor or infrastructure ownership",
    });
  }
});

function canonicalExpectedDelta(
  value: z.infer<typeof ExpectedDeltaV1Schema>,
): z.infer<typeof ExpectedDeltaV1Schema> {
  if (value.kind === "source_change") {
    return {
      ...value,
      invariantRefs: sortedUnique(value.invariantRefs),
      requiredPaths: sortedUnique(value.requiredPaths),
    };
  }
  if (value.kind === "evidence_refresh") {
    return { ...value, predicateRefs: sortedUnique(value.predicateRefs) };
  }
  if (value.kind === "upstream_recompile") {
    return { ...value, artifactKinds: sortedUnique(value.artifactKinds) as typeof value.artifactKinds };
  }
  return value;
}

export function createRecoveryCaseV1(
  input: RecoveryCaseDraftV1,
  options: Readonly<{ now?: Date }> = {},
): RecoveryCaseV1 {
  const parsed = RecoveryCaseCoreV1Schema.omit({
    schema: true,
    recoveryCaseId: true,
    dedupeKey: true,
    stateVersion: true,
    createdAt: true,
    updatedAt: true,
  }).parse(input);
  const canonical = {
    ...parsed,
    expectedDelta: canonicalExpectedDelta(parsed.expectedDelta),
    findingIds: sortedUnique(parsed.findingIds),
    allowedPaths: sortedUnique(parsed.allowedPaths),
    evidencePlan: sortedUnique(parsed.evidencePlan),
    priorAttemptRefs: sortedUnique(parsed.priorAttemptRefs),
    decisionRefs: sortedUnique(parsed.decisionRefs),
    ...(parsed.terminal
      ? {
          terminal: {
            ...parsed.terminal,
            evidenceBundleHashes: sortedUnique(parsed.terminal.evidenceBundleHashes),
          },
        }
      : {}),
  };
  const dedupeKey = computeRecoveryCaseDedupeKey(canonical);
  const now = new Date(options.now ?? new Date());
  if (!Number.isFinite(now.getTime())) throw new Error("RECOVERY_CASE_TIME_INVALID");
  return RecoveryCaseV1Schema.parse({
    schema: "setfarm.recovery-case.v1",
    recoveryCaseId: expectedRecoveryCaseId(dedupeKey),
    dedupeKey,
    ...canonical,
    stateVersion: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

export type RecoveryDispatchAuthorizationV1 = Readonly<{
  schema: "setfarm.recovery-dispatch-authorization.v1";
  dispatchId: string;
  recoveryCaseId: string;
  dispatchClass: z.infer<typeof RecoveryDispatchClassV1Schema>;
  dispatchDedupeKey: string;
  sourceRevision: z.infer<typeof SourceRevisionV1Schema>;
  packetHash: string;
  sliceHash: string;
  findingSetHash: string;
  findingIds: string[];
  evidencePlan: string[];
  authorizedAt: string;
}>;
