import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ActionIdSchema,
  CommandIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const TimestampSchema = z.string().datetime({ offset: true });
const ObservationRefSchema = z.string().regex(/^OBS_[a-f0-9]{64}$/);
const EvidenceBundleIdSchema = z.string().regex(/^EVB_[a-f0-9]{64}$/);
const InvariantRefSchema = z
  .string()
  .min(5)
  .max(200)
  .regex(/^INV_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const EvidenceArtifactRefV2Schema = z
  .object({
    hash: Sha256Schema,
    mediaType: z.string().min(3).max(160).regex(/^[^\s/]+\/[^\s/]+$/),
    locator: NormalizedRelativeLocatorSchema,
  })
  .strict();

const ObservationOwnerSchema = z.literal("setfarm-orchestrator");
const ObservationCoreSchema = z.object({
  observationRef: ObservationRefSchema,
  owner: ObservationOwnerSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema,
}).strict();

const CommandObservationV2Schema = ObservationCoreSchema.extend({
  kind: z.literal("command"),
  commandRef: CommandIdSchema,
  exitCode: z.number().int(),
  stdoutArtifactHash: Sha256Schema,
  stderrArtifactHash: Sha256Schema.optional(),
}).strict();

const RuntimeObservationV2Schema = ObservationCoreSchema.extend({
  kind: z.literal("runtime"),
  runtimeSessionId: BoundedIdentitySchema,
  runtimeArtifactHash: Sha256Schema,
  stateBeforeHash: Sha256Schema.optional(),
  stateAfterHash: Sha256Schema.optional(),
}).strict();

const ControlObservationV2Schema = ObservationCoreSchema.extend({
  kind: z.literal("control"),
  actionRef: ActionIdSchema.optional(),
  controlRef: ControlIdSchema,
  beforeArtifactHash: Sha256Schema,
  afterArtifactHash: Sha256Schema,
}).strict();

export const EvidenceObservationV2Schema = z.discriminatedUnion("kind", [
  CommandObservationV2Schema,
  RuntimeObservationV2Schema,
  ControlObservationV2Schema,
]).superRefine((value, context) => {
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Observation completion must not precede its start",
    });
  }
  if (value.observationRef !== computeObservationRef(value)) {
    context.addIssue({
      code: "custom",
      path: ["observationRef"],
      message: "Observation ref must hash exact orchestrator-owned evidence",
    });
  }
});

export type EvidenceObservationV2 = z.infer<typeof EvidenceObservationV2Schema>;
export type EvidenceObservationDraftV2 = EvidenceObservationV2 extends infer Observation
  ? Observation extends unknown
    ? Omit<Observation, "observationRef">
    : never
  : never;

export const EvidencePredicateResultV2Schema = z
  .object({
    invariantRef: InvariantRefSchema,
    predicateRef: EvidenceIdSchema,
    actionRef: ActionIdSchema.optional(),
    controlRef: ControlIdSchema.optional(),
    required: z.boolean(),
    verdict: z.enum(["pass", "fail", "inconclusive"]),
    observationRefs: z.array(ObservationRefSchema).min(1).max(5_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.observationRefs)) {
      context.addIssue({
        code: "custom",
        path: ["observationRefs"],
        message: "Predicate observation refs must be unique",
      });
    }
  });

export type EvidencePredicateResultV2 = z.infer<typeof EvidencePredicateResultV2Schema>;

const EvidenceBundleCoreV2Schema = z
  .object({
    schema: z.literal("setfarm.evidence-bundle.v2"),
    evidenceId: EvidenceBundleIdSchema,
    runId: BoundedIdentitySchema,
    storyId: StoryIdSchema,
    packetHash: Sha256Schema,
    sliceHash: Sha256Schema,
    sourceRevision: SourceRevisionV1Schema,
    attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/).optional(),
    aggregateVerdict: z.enum(["pass", "fail", "inconclusive", "incomplete"]),
    predicates: z.array(EvidencePredicateResultV2Schema).min(1).max(5_000),
    observations: z.array(EvidenceObservationV2Schema).min(1).max(20_000),
    artifacts: z.array(EvidenceArtifactRefV2Schema).min(1).max(20_000),
    runner: z.object({
      id: BoundedIdentitySchema,
      version: z.string().min(1).max(200),
      environmentHash: Sha256Schema,
    }).strict(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,
  })
  .strict();

export type EvidenceBundleV2 = z.infer<typeof EvidenceBundleCoreV2Schema>;
export type EvidenceBundleDraftV2 = Omit<
  EvidenceBundleV2,
  "schema" | "evidenceId" | "aggregateVerdict" | "observations"
> & Readonly<{ observations: readonly EvidenceObservationDraftV2[] }>;

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withoutObservationRef(
  value: EvidenceObservationV2 | EvidenceObservationDraftV2,
): EvidenceObservationDraftV2 {
  const { observationRef: _observationRef, ...identity } = value as EvidenceObservationV2;
  return identity;
}

export function computeObservationRef(
  value: EvidenceObservationV2 | EvidenceObservationDraftV2,
): string {
  return `OBS_${hashCanonicalJson({
    schema: "setfarm.evidence-observation.v2",
    ...withoutObservationRef(value),
  })}`;
}

function observationArtifactHashes(value: EvidenceObservationV2): string[] {
  if (value.kind === "command") {
    return [value.stdoutArtifactHash, ...(value.stderrArtifactHash ? [value.stderrArtifactHash] : [])];
  }
  if (value.kind === "runtime") {
    return [
      value.runtimeArtifactHash,
      ...(value.stateBeforeHash ? [value.stateBeforeHash] : []),
      ...(value.stateAfterHash ? [value.stateAfterHash] : []),
    ];
  }
  return [value.beforeArtifactHash, value.afterArtifactHash];
}

export function aggregateEvidenceVerdict(
  predicates: readonly EvidencePredicateResultV2[],
): EvidenceBundleV2["aggregateVerdict"] {
  const required = predicates.filter((predicate) => predicate.required);
  if (required.length === 0) return "incomplete";
  if (required.some((predicate) => predicate.verdict === "fail")) return "fail";
  if (required.some((predicate) => predicate.verdict === "inconclusive")) return "inconclusive";
  return "pass";
}

function computeEvidenceId(value: Omit<EvidenceBundleV2, "evidenceId">): string {
  return `EVB_${hashCanonicalJson(value)}`;
}

function predicateKey(predicate: EvidencePredicateResultV2): string {
  return hashCanonicalJson(predicate);
}

export const EvidenceBundleV2Schema = EvidenceBundleCoreV2Schema.superRefine((value, context) => {
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Evidence completion must not precede its start",
    });
  }
  const observationRefs = value.observations.map((observation) => observation.observationRef);
  if (!hasUniqueStrings(observationRefs)) {
    context.addIssue({ code: "custom", path: ["observations"], message: "Observation refs must be unique" });
  }
  const canonicalObservationRefs = [...observationRefs].sort(lexical);
  if (observationRefs.some((reference, index) => reference !== canonicalObservationRefs[index])) {
    context.addIssue({
      code: "custom",
      path: ["observations"],
      message: "Observations must use canonical ref order",
    });
  }
  const availableObservations = new Set(observationRefs);
  value.predicates.forEach((predicate, predicateIndex) => {
    predicate.observationRefs.forEach((reference, observationIndex) => {
      if (!availableObservations.has(reference)) {
        context.addIssue({
          code: "custom",
          path: ["predicates", predicateIndex, "observationRefs", observationIndex],
          message: `Predicate references absent observation ${reference}`,
        });
      }
    });
    const canonicalRefs = [...predicate.observationRefs].sort(lexical);
    if (predicate.observationRefs.some((reference, index) => reference !== canonicalRefs[index])) {
      context.addIssue({
        code: "custom",
        path: ["predicates", predicateIndex, "observationRefs"],
        message: "Predicate observation refs must use canonical order",
      });
    }
    if (predicate.controlRef) {
      const exactControlEvidence = predicate.observationRefs.some((reference) => {
        const observation = value.observations.find((candidate) => candidate.observationRef === reference);
        return observation?.kind === "control"
          && observation.controlRef === predicate.controlRef
          && (!predicate.actionRef || observation.actionRef === predicate.actionRef);
      });
      if (!exactControlEvidence) {
        context.addIssue({
          code: "custom",
          path: ["predicates", predicateIndex, "controlRef"],
          message: "Control predicates require exact orchestrator control evidence",
        });
      }
    }
  });
  const predicateKeys = value.predicates.map(predicateKey);
  if (!hasUniqueStrings(predicateKeys)) {
    context.addIssue({ code: "custom", path: ["predicates"], message: "Predicate results must be unique" });
  }
  const predicateIdentityKeys = value.predicates.map((predicate) => hashCanonicalJson({
    invariantRef: predicate.invariantRef,
    predicateRef: predicate.predicateRef,
    ...(predicate.actionRef ? { actionRef: predicate.actionRef } : {}),
    ...(predicate.controlRef ? { controlRef: predicate.controlRef } : {}),
  }));
  if (!hasUniqueStrings(predicateIdentityKeys)) {
    context.addIssue({
      code: "custom",
      path: ["predicates"],
      message: "A bundle cannot publish contradictory results for one predicate identity",
    });
  }
  const canonicalPredicateKeys = [...predicateKeys].sort(lexical);
  if (predicateKeys.some((key, index) => key !== canonicalPredicateKeys[index])) {
    context.addIssue({
      code: "custom",
      path: ["predicates"],
      message: "Predicate results must use canonical content order",
    });
  }
  const referencedObservations = new Set(value.predicates.flatMap((predicate) => predicate.observationRefs));
  value.observations.forEach((observation, index) => {
    if (!referencedObservations.has(observation.observationRef)) {
      context.addIssue({
        code: "custom",
        path: ["observations", index],
        message: "Evidence observations cannot be orphaned from predicates",
      });
    }
  });
  const artifactHashes = value.artifacts.map((artifact) => artifact.hash);
  if (!hasUniqueStrings(artifactHashes)) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Evidence artifact hashes must be unique" });
  }
  const canonicalArtifactHashes = [...artifactHashes].sort(lexical);
  if (artifactHashes.some((hash, index) => hash !== canonicalArtifactHashes[index])) {
    context.addIssue({
      code: "custom",
      path: ["artifacts"],
      message: "Evidence artifacts must use canonical hash order",
    });
  }
  const availableArtifacts = new Set(artifactHashes);
  value.observations.forEach((observation, index) => {
    if (
      Date.parse(observation.startedAt) < Date.parse(value.startedAt)
      || Date.parse(observation.completedAt) > Date.parse(value.completedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observations", index],
        message: "Observation time must be contained by the evidence bundle",
      });
    }
    observationArtifactHashes(observation).forEach((hash) => {
      if (!availableArtifacts.has(hash)) {
        context.addIssue({
          code: "custom",
          path: ["observations", index],
          message: `Observation references absent evidence artifact ${hash}`,
        });
      }
    });
  });
  const expectedAggregate = aggregateEvidenceVerdict(value.predicates);
  if (value.aggregateVerdict !== expectedAggregate) {
    context.addIssue({
      code: "custom",
      path: ["aggregateVerdict"],
      message: `Aggregate verdict must be ${expectedAggregate} for required child verdicts`,
    });
  }
  const { evidenceId: _evidenceId, ...identity } = value;
  if (value.evidenceId !== computeEvidenceId(identity)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceId"],
      message: "Evidence ID must bind exact packet, slice, source, predicates, and observations",
    });
  }
});

export function createEvidenceBundleV2(input: EvidenceBundleDraftV2): EvidenceBundleV2 {
  const draft = EvidenceBundleCoreV2Schema.omit({
    schema: true,
    evidenceId: true,
    aggregateVerdict: true,
    observations: true,
  }).extend({
    observations: z.array(z.discriminatedUnion("kind", [
      CommandObservationV2Schema.omit({ observationRef: true }),
      RuntimeObservationV2Schema.omit({ observationRef: true }),
      ControlObservationV2Schema.omit({ observationRef: true }),
    ])).min(1).max(20_000),
  }).strict().parse(input);
  const observations = draft.observations.map((observation) => EvidenceObservationV2Schema.parse({
    ...observation,
    observationRef: computeObservationRef(observation),
  })).sort((left, right) => lexical(left.observationRef, right.observationRef));
  const predicates = [...draft.predicates].map((predicate) => ({
    ...predicate,
    observationRefs: [...predicate.observationRefs].sort(lexical),
  })).sort((left, right) => lexical(predicateKey(left), predicateKey(right)));
  const artifacts = [...draft.artifacts].sort((left, right) => lexical(left.hash, right.hash));
  const withoutId = {
    schema: "setfarm.evidence-bundle.v2" as const,
    runId: draft.runId,
    storyId: draft.storyId,
    packetHash: draft.packetHash,
    sliceHash: draft.sliceHash,
    sourceRevision: draft.sourceRevision,
    ...(draft.attemptId ? { attemptId: draft.attemptId } : {}),
    aggregateVerdict: aggregateEvidenceVerdict(predicates),
    predicates,
    observations,
    artifacts,
    runner: draft.runner,
    startedAt: draft.startedAt,
    completedAt: draft.completedAt,
  };
  return EvidenceBundleV2Schema.parse({
    ...withoutId,
    evidenceId: computeEvidenceId(withoutId),
  });
}

export function computeEvidenceBundleHash(value: EvidenceBundleV2): string {
  return hashCanonicalJson(EvidenceBundleV2Schema.parse(value));
}
