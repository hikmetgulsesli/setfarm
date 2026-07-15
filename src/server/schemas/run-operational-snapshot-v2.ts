import { z } from "zod";

import { RuntimeCompletionSubmissionEvidenceV1Schema } from "../../execution/schemas/runtime-completion-submission-evidence-v1.js";
import {
  OperationalCompletionRequestV1Schema,
  OperationalProjectionCapabilitiesV1Schema,
  OperationalProjectionSourceV1Schema,
  RunOperationalSnapshotV1Schema,
} from "./run-operational-snapshot-v1.js";

const CanonicalRefSchema = z.string()
  .regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/)
  .max(4_000);

export const OperationalProjectionCapabilitiesV2Schema =
  OperationalProjectionCapabilitiesV1Schema.safeExtend({
    implementationSubmissionEvidence: z.boolean(),
  });

const LIFECYCLE_PROJECTION_CAPABILITIES = [
  "attempts",
  "claimBinding",
  "runtimeOwnership",
  "managerCompletion",
  "effectLedger",
  "findingRecovery",
  "evidenceLedger",
  "acceptedCandidate",
  "deploymentReceipt",
  "projectTransferAck",
] as const;

export const OperationalProjectionSourceV2Schema = z.object({
  ...OperationalProjectionSourceV1Schema.shape,
  capabilities: OperationalProjectionCapabilitiesV2Schema,
}).strict().superRefine((value, context) => {
    const sorted = [...value.migrationVersions].sort((left, right) => left - right);
    if (
      new Set(sorted).size !== sorted.length
      || sorted.some((version, index) => version !== value.migrationVersions[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["migrationVersions"],
        message: "Migration versions must be unique and sorted",
      });
    }
    const lifecycleProjectionComplete = LIFECYCLE_PROJECTION_CAPABILITIES.every(
      (capability) => value.capabilities[capability],
    );
    if (value.projection === "complete" && !lifecycleProjectionComplete) {
      context.addIssue({
        code: "custom",
        path: ["projection"],
        message: "A complete projection requires every lifecycle capability",
      });
    }
    if (
      value.capabilities.implementationSubmissionEvidence
      && (!value.migrationVersions.includes(19) || value.verifiedReleaseSha === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["capabilities", "implementationSubmissionEvidence"],
        message: "Implementation submission evidence requires an attested migration 19 shape",
      });
    }
  });

export const OperationalImplementationSubmissionEvidenceV2Schema = z.object({
  receipt: RuntimeCompletionSubmissionEvidenceV1Schema,
  sourceProposalRef: CanonicalRefSchema,
}).strict();

export const OperationalCompletionRequestV2Schema =
  OperationalCompletionRequestV1Schema.safeExtend({
    implementationSubmissionEvidence:
      OperationalImplementationSubmissionEvidenceV2Schema.nullable(),
  }).superRefine((value, context) => {
    const evidence = value.implementationSubmissionEvidence;
    if (!evidence) return;
    if (evidence.receipt.canonicalOutputHash !== value.outputHash) {
      context.addIssue({
        code: "custom",
        path: ["implementationSubmissionEvidence", "receipt", "canonicalOutputHash"],
        message: "Implementation submission receipt must bind the completion output hash",
      });
    }
    const expectedRef = `setfarm://runtime-completion/${value.requestId}/source-proposal/${evidence.receipt.sourceProposalHash}`;
    if (evidence.sourceProposalRef !== expectedRef) {
      context.addIssue({
        code: "custom",
        path: ["implementationSubmissionEvidence", "sourceProposalRef"],
        message: "Source proposal ref must bind the completion request and proposal hash",
      });
    }
  });

export const RunOperationalSnapshotV2Schema = z.object({
  ...RunOperationalSnapshotV1Schema.shape,
  schema: z.literal("setfarm.run-operational-snapshot.v2"),
  source: OperationalProjectionSourceV2Schema,
  completionRequests: z.array(OperationalCompletionRequestV2Schema).max(100_000),
}).strict().superRefine((value, context) => {
    const {
      implementationSubmissionEvidence: _implementationSubmissionEvidence,
      ...v1Capabilities
    } = value.source.capabilities;
    const v1CompletionRequests = value.completionRequests.map((request) => {
      const {
        implementationSubmissionEvidence: _requestSubmissionEvidence,
        ...v1Request
      } = request;
      return v1Request;
    });
    const v1Projection = RunOperationalSnapshotV1Schema.safeParse({
      ...value,
      schema: "setfarm.run-operational-snapshot.v1",
      source: { ...value.source, capabilities: v1Capabilities },
      completionRequests: v1CompletionRequests,
    });
    if (!v1Projection.success) {
      for (const issue of v1Projection.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
    if (
      value.source.capabilities.implementationSubmissionEvidence
      && !value.source.capabilities.managerCompletion
    ) {
      context.addIssue({
        code: "custom",
        path: ["source", "capabilities", "implementationSubmissionEvidence"],
        message: "Implementation submission evidence requires manager completion authority",
      });
    }
    if (
      !value.source.capabilities.implementationSubmissionEvidence
      && value.completionRequests.some((request) => request.implementationSubmissionEvidence !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["completionRequests"],
        message: "Unsupported implementation submission evidence must remain absent",
      });
    }
  });

export type OperationalProjectionCapabilitiesV2 = z.infer<
  typeof OperationalProjectionCapabilitiesV2Schema
>;
export type OperationalProjectionSourceV2 = z.infer<
  typeof OperationalProjectionSourceV2Schema
>;
export type OperationalImplementationSubmissionEvidenceV2 = z.infer<
  typeof OperationalImplementationSubmissionEvidenceV2Schema
>;
export type OperationalCompletionRequestV2 = z.infer<
  typeof OperationalCompletionRequestV2Schema
>;
export type RunOperationalSnapshotV2 = z.infer<typeof RunOperationalSnapshotV2Schema>;
