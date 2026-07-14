import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";

const IdentitySchema = z.string().min(1).max(500);
const ProjectIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);

export const V3CanonicalMissionControlProjectProjectionV1Schema = z.object({
  id: ProjectIdSchema,
  name: z.string().min(1).max(500),
  description: z.string().max(4_000),
  type: z.enum(["web", "mobile"]),
  ports: z.object({ frontend: z.number().int().min(1).max(65_535) }).strict(),
  deployUrl: z.string().url(),
  service: z.string().min(1).max(500),
  serviceStatus: z.literal("active"),
  status: z.literal("active"),
  stack: z.array(z.string().min(1).max(500)).min(1).max(100),
  createdBy: z.literal("setfarm-v3-terminal-projector"),
  productCompilerProtocol: z.literal("v3"),
  workflowRunId: IdentitySchema,
  setfarmRunIds: z.array(IdentitySchema).length(1),
  runNumber: z.number().int().positive().optional(),
  acceptedCandidateId: z.string().regex(/^ACPT_[a-f0-9]{64}$/),
  acceptedCandidateHash: Sha256Schema,
  acceptedPacketHash: Sha256Schema,
  acceptedSourceSha: GitObjectHashSchema,
  acceptedSourceTreeHash: GitObjectHashSchema,
  deploymentReceiptHash: Sha256Schema,
  deploymentReceiptRef: z.string().min(1).max(2_000),
  deploymentHealthRef: z.string().min(1).max(2_000),
  deploymentHealthUrl: z.string().url(),
  deployedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.setfarmRunIds[0] !== value.workflowRunId) {
    context.addIssue({
      code: "custom",
      path: ["setfarmRunIds"],
      message: "Canonical project projection must bind exactly its workflow run",
    });
  }
  if (value.acceptedCandidateId !== `ACPT_${value.acceptedCandidateHash}`) {
    context.addIssue({
      code: "custom",
      path: ["acceptedCandidateId"],
      message: "Canonical project projection candidate ID mismatch",
    });
  }
  const canonicalStack = [...value.stack].sort();
  if (!hasUniqueStrings(value.stack)
    || value.stack.some((item, index) => item !== canonicalStack[index])) {
    context.addIssue({
      code: "custom",
      path: ["stack"],
      message: "Canonical project stack must be unique and sorted",
    });
  }
});

const V3ProjectTransferAckPayloadV1Schema = z.object({
  schema: z.literal("setfarm.v3-project-transfer-ack.v1"),
  ackVersion: z.literal(1),
  runId: IdentitySchema,
  candidateId: z.string().regex(/^ACPT_[a-f0-9]{64}$/),
  candidateHash: Sha256Schema,
  packetHash: Sha256Schema,
  sourceRevision: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
  deploymentReceiptHash: Sha256Schema,
  deploymentReceiptRef: z.string().min(1).max(2_000),
  sourceSnapshotHash: Sha256Schema,
  projectId: ProjectIdSchema,
  projectProjection: V3CanonicalMissionControlProjectProjectionV1Schema,
  projectionHash: Sha256Schema,
  projectRecordHash: Sha256Schema,
  projectRecordRef: z.string().regex(/^mission-control:\/\/projects\/[a-z0-9-]+\/[a-f0-9]{64}$/).max(1_000),
  persistedAt: z.string().datetime({ offset: true }),
  projector: z.object({
    service: z.literal("mission-control"),
    protocol: z.literal("v3"),
  }).strict(),
}).strict().superRefine((value, context) => {
  const projectionHash = hashCanonicalJson(value.projectProjection);
  if (value.projectionHash !== projectionHash) {
    context.addIssue({ code: "custom", path: ["projectionHash"], message: "Project projection hash mismatch" });
  }
  const projectRecordHash = hashCanonicalJson({
    schema: "mission-control.v3-canonical-project-record.v1",
    projection: value.projectProjection,
    projectionHash,
    persistedAt: value.persistedAt,
  });
  if (value.projectRecordHash !== projectRecordHash) {
    context.addIssue({ code: "custom", path: ["projectRecordHash"], message: "Project record hash mismatch" });
  }
  if (value.projectRecordRef !== `mission-control://projects/${value.projectId}/${projectRecordHash}`) {
    context.addIssue({ code: "custom", path: ["projectRecordRef"], message: "Project record ref mismatch" });
  }
  if (
    value.projectId !== value.projectProjection.id
    || value.runId !== value.projectProjection.workflowRunId
    || value.candidateId !== value.projectProjection.acceptedCandidateId
    || value.candidateHash !== value.projectProjection.acceptedCandidateHash
    || value.packetHash !== value.projectProjection.acceptedPacketHash
    || value.sourceRevision.sha !== value.projectProjection.acceptedSourceSha
    || value.sourceRevision.treeHash !== value.projectProjection.acceptedSourceTreeHash
    || value.deploymentReceiptHash !== value.projectProjection.deploymentReceiptHash
    || value.deploymentReceiptRef !== value.projectProjection.deploymentReceiptRef
  ) {
    context.addIssue({
      code: "custom",
      path: ["projectProjection"],
      message: "Project projection does not bind the acknowledgement authority",
    });
  }
});

export const V3ProjectTransferAckV1Schema = V3ProjectTransferAckPayloadV1Schema.extend({
  ackHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { ackHash: _ackHash, ...payload } = value;
  if (value.ackHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["ackHash"], message: "Project transfer acknowledgement hash mismatch" });
  }
});

export type V3CanonicalMissionControlProjectProjectionV1 = z.infer<
  typeof V3CanonicalMissionControlProjectProjectionV1Schema
>;
export type V3ProjectTransferAckV1 = z.infer<typeof V3ProjectTransferAckV1Schema>;
