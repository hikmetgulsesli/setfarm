import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema,
  OperationalFailureIdentityV2Schema,
} from "../../execution/schemas/operational-failure-identity-v2.js";
import {
  OperationalFailureCauseV1Schema,
  operationalFailureCauseHashV1,
} from "../../execution/schemas/operational-failure-cause-v1.js";
import {
  OperationalTerminationRequestV1Schema,
  type OperationalTerminationRequestV1,
} from "./run-operational-snapshot-v1.js";
import {
  OperationalProjectionCapabilitiesV2Schema,
  OperationalProjectionSourceV2Schema,
  RunOperationalSnapshotV2Schema,
} from "./run-operational-snapshot-v2.js";

const CanonicalRefSchema = z.string()
  .regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/)
  .max(4_000);

export const OperationalProjectionCapabilitiesV3Schema =
  OperationalProjectionCapabilitiesV2Schema.safeExtend({
    operationalFailureAuthority: z.boolean(),
  });

export const OperationalProjectionSourceV3Schema = z.object({
  ...OperationalProjectionSourceV2Schema.shape,
  capabilities: OperationalProjectionCapabilitiesV3Schema,
}).strict().superRefine((value, context) => {
  const {
    operationalFailureAuthority: _operationalFailureAuthority,
    ...v2Capabilities
  } = value.capabilities;
  const v2Source = OperationalProjectionSourceV2Schema.safeParse({
    ...value,
    capabilities: v2Capabilities,
  });
  if (!v2Source.success) {
    for (const issue of v2Source.error.issues) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  }
  if (
    value.capabilities.operationalFailureAuthority
    && (!value.migrationVersions.includes(22) || value.verifiedReleaseSha === null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["capabilities", "operationalFailureAuthority"],
      message: "Operational failure authority requires an attested migration 22 shape",
    });
  }
  if (value.projection === "complete" && !value.capabilities.operationalFailureAuthority) {
    context.addIssue({
      code: "custom",
      path: ["projection"],
      message: "A complete v3 projection requires operational failure authority",
    });
  }
});

export const OperationalV3DesignCandidateAuthorityTerminationRequestV1Schema = z.object({
  ...OperationalTerminationRequestV1Schema.shape,
  targetStatus: z.literal("failed"),
  state: z.literal("terminalized"),
  requestedBy: z.literal(DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2),
  evidence: OperationalDesignCandidateAuthorityTerminationEvidenceV1Schema,
}).strict().superRefine((value, context) => {
  if (value.terminalizedAt === null) {
    context.addIssue({
      code: "custom",
      path: ["terminalizedAt"],
      message: "Canonical design candidate termination must be terminalized",
    });
  }
});

export const OperationalTerminationRequestV3Schema = z.union([
  OperationalV3DesignCandidateAuthorityTerminationRequestV1Schema,
  OperationalTerminationRequestV1Schema,
]);

export const CanonicalOperationalFailureV3Schema = z.object({
  terminationRequestRef: CanonicalRefSchema,
  failureIdentity: OperationalFailureIdentityV2Schema,
}).strict();

type SnapshotHashInput = Readonly<Record<string, unknown>>;

/** Hashes v3 operational state while excluding observation clocks. */
export function computeRunOperationalSnapshotHashV3(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Run operational snapshot hash input must be an object");
  }
  const record = snapshot as SnapshotHashInput;
  if (typeof record.generatedAt !== "string") {
    throw new TypeError("Run operational snapshot hash input requires generatedAt");
  }
  if (!Array.isArray(record.invariants)) {
    throw new TypeError("Run operational snapshot hash input requires invariants");
  }
  const {
    generatedAt: _generatedAt,
    snapshotHash: _snapshotHash,
    ...state
  } = record;
  const invariants = record.invariants.map((invariant) => {
    if (!invariant || typeof invariant !== "object" || Array.isArray(invariant)) {
      throw new TypeError("Run operational snapshot invariant must be an object");
    }
    const { observedAt: _observedAt, ...stableInvariant } = invariant as Record<string, unknown>;
    return stableInvariant;
  });
  return hashCanonicalJson({ ...state, invariants });
}

function isDesignCandidateTermination(
  request: z.infer<typeof OperationalTerminationRequestV3Schema>,
): request is z.infer<typeof OperationalV3DesignCandidateAuthorityTerminationRequestV1Schema> {
  return request.requestedBy === DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2
    && request.evidence.schema === DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2;
}

function v2CompatibleTermination(
  request: z.infer<typeof OperationalTerminationRequestV3Schema>,
): OperationalTerminationRequestV1 {
  if (!isDesignCandidateTermination(request)) return request;
  return {
    ...request,
    evidence: {},
  };
}

function evidenceCause(
  request: z.infer<typeof OperationalTerminationRequestV3Schema>,
) {
  return Object.hasOwn(request.evidence, "operationalFailureCause")
    ? OperationalFailureCauseV1Schema.safeParse(request.evidence.operationalFailureCause)
    : null;
}

function bindOperationalFailure(
  value: z.infer<typeof RunOperationalSnapshotV3ShapeSchema>,
  context: z.RefinementCtx,
): void {
  const capability = value.source.capabilities.operationalFailureAuthority;
  const designTerminations = value.terminationRequests.filter(isDesignCandidateTermination);
  if (!capability && designTerminations.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["terminationRequests"],
      message: "Typed design candidate termination requires operational failure authority",
    });
  }
  if (!capability && value.operationalFailure !== null) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailure"],
      message: "Unsupported operational failure authority must remain absent",
    });
    return;
  }

  const canonicalCauseRequests = value.terminationRequests.filter((request) =>
    request.targetStatus === "failed"
    && request.state === "terminalized"
    && evidenceCause(request)?.success === true);
  if (capability && canonicalCauseRequests.length > 0 && value.operationalFailure === null) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailure"],
      message: "Canonical terminal operational failure must be projected",
    });
    return;
  }
  if (value.operationalFailure === null) return;

  const matches = canonicalCauseRequests.filter((request) =>
    request.ref === value.operationalFailure?.terminationRequestRef);
  if (matches.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailure", "terminationRequestRef"],
      message: "Operational failure must bind exactly one canonical terminalized request",
    });
    return;
  }
  if (!value.run.terminal || value.run.status.toLowerCase() !== "failed") {
    context.addIssue({
      code: "custom",
      path: ["run", "status"],
      message: "Canonical operational failure requires an exact failed terminal run",
    });
  }

  const request = matches[0]!;
  const identity = value.operationalFailure.failureIdentity;
  const schema = typeof request.evidence.schema === "string" ? request.evidence.schema : null;
  const causeResult = evidenceCause(request);
  if (!causeResult?.success) return;
  if (
    identity.requestedBy !== request.requestedBy
    || identity.evidenceSchema !== schema
    || identity.operationalCauseHash !== operationalFailureCauseHashV1(causeResult.data)
    || hashCanonicalJson(identity.operationalCause) !== hashCanonicalJson(causeResult.data)
  ) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailure", "failureIdentity"],
      message: "Operational failure identity must bind the exact trusted termination authority",
    });
  }

  if (isDesignCandidateTermination(request)) {
    const exact = identity.exactFailure;
    if (
      !exact
      || exact.refKey !== request.evidence.failureRefKey
      || exact.artifactType !== request.evidence.failureArtifactType
      || exact.failureArtifactHash !== request.evidence.failureArtifactHash
      || exact.failureFingerprint !== request.evidence.failureFingerprint
      || exact.candidateSelectionHash !== request.evidence.candidateSelectionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["operationalFailure", "failureIdentity", "exactFailure"],
        message: "Exact failure identity must bind the canonical termination artifact fields",
      });
    }
  } else if (identity.exactFailure !== null) {
    context.addIssue({
      code: "custom",
      path: ["operationalFailure", "failureIdentity", "exactFailure"],
      message: "Legacy canonical termination cannot claim an unbound exact failure artifact",
    });
  }
}

const RunOperationalSnapshotV3ShapeSchema = z.object({
  ...RunOperationalSnapshotV2Schema.shape,
  schema: z.literal("setfarm.run-operational-snapshot.v3"),
  source: OperationalProjectionSourceV3Schema,
  terminationRequests: z.array(OperationalTerminationRequestV3Schema).max(100_000),
  operationalFailure: CanonicalOperationalFailureV3Schema.nullable(),
}).strict();

export const RunOperationalSnapshotV3Schema = RunOperationalSnapshotV3ShapeSchema.superRefine(
  (value, context) => {
    const {
      operationalFailure: _operationalFailure,
      source,
      terminationRequests,
      ...v2Snapshot
    } = value;
    const {
      operationalFailureAuthority: _operationalFailureAuthority,
      ...v2Capabilities
    } = source.capabilities;
    const v2Projection = RunOperationalSnapshotV2Schema.safeParse({
      ...v2Snapshot,
      schema: "setfarm.run-operational-snapshot.v2",
      source: { ...source, capabilities: v2Capabilities },
      terminationRequests: terminationRequests.map(v2CompatibleTermination),
    });
    if (!v2Projection.success) {
      for (const issue of v2Projection.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }

    const { snapshotHash, ...hashable } = value;
    if (snapshotHash !== computeRunOperationalSnapshotHashV3(hashable)) {
      context.addIssue({
        code: "custom",
        path: ["snapshotHash"],
        message: "Snapshot hash must bind canonical v3 operational state",
      });
    }
    bindOperationalFailure(value, context);
  },
);

export type OperationalProjectionCapabilitiesV3 = z.infer<
  typeof OperationalProjectionCapabilitiesV3Schema
>;
export type OperationalProjectionSourceV3 = z.infer<
  typeof OperationalProjectionSourceV3Schema
>;
export type OperationalTerminationRequestV3 = z.infer<
  typeof OperationalTerminationRequestV3Schema
>;
export type CanonicalOperationalFailureV3 = z.infer<
  typeof CanonicalOperationalFailureV3Schema
>;
export type RunOperationalSnapshotV3 = z.infer<typeof RunOperationalSnapshotV3Schema>;
