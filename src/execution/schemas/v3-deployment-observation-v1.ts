import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  V3ListenerOwnershipV1Schema,
  V3RuntimeDeploymentV1Schema,
} from "./v3-deploy-receipt-v1.js";
import { V3RuntimeIsolationProofV1Schema } from "./v3-runtime-isolation-v1.js";

const V3DeploymentObservationIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-deployment-observation.v1"),
  observationVersion: z.literal(1),
  runId: z.string().min(1).max(500),
  deploymentReceiptHash: Sha256Schema,
  receiptCompletedAt: z.string().datetime({ offset: true }),
  candidateHash: Sha256Schema,
  packetHash: Sha256Schema,
  projectId: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  buildArtifactHash: Sha256Schema,
  sealedRuntimeManifestHash: Sha256Schema,
  sealedRuntimeManifestEvidenceRef: z.string().min(1).max(2_000),
  sealAuthorityHash: Sha256Schema,
  sealAuthorityEvidenceRef: z.string().min(1).max(2_000),
  runtime: V3RuntimeDeploymentV1Schema,
  listenerOwnership: V3ListenerOwnershipV1Schema,
  runtimeIsolation: V3RuntimeIsolationProofV1Schema,
  deploymentStateHash: Sha256Schema,
  deploymentStateEvidenceRef: z.string().min(1).max(2_000),
  controlBindingHash: Sha256Schema,
  leaseIdentityHash: Sha256Schema,
  leaseIdentityEvidenceRef: z.string().min(1).max(2_000),
  httpProof: z.object({
    schema: z.literal("setfarm.v3-runtime-http-proof.v1"),
    healthUrl: z.string().url(),
    httpStatus: z.number().int().min(200).max(399),
    checkedAt: z.string().datetime({ offset: true }),
    evidenceRef: z.string().min(1).max(2_000),
  }).strict(),
  checks: z.object({
    receiptIdentity: z.literal("pass"),
    processIdentity: z.literal("pass"),
    listenerOwnership: z.literal("pass"),
    runtimeHttp: z.literal("pass"),
    sealedRuntime: z.literal("pass"),
    runtimeIsolation: z.literal("pass"),
  }).strict(),
  observedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  const expectedManifestRef = `setfarm://deploy/sealed-runtime-manifest/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.sealedRuntimeManifestHash}`;
  const expectedSealAuthorityRef = `setfarm://deploy/seal-authority/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.sealAuthorityHash}`;
  const expectedRuntimeRef = `setfarm://deploy/runtime/${value.runId}/${value.runtime.projectId}`;
  const expectedBuildArtifactRef = `setfarm://deploy/build-artifact/${value.runId}/${value.buildArtifactHash}`;
  const expectedSealedRuntimeRef = `setfarm://deploy/sealed-runtime/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}`;
  const expectedStateRef = `setfarm://deploy/runtime-state/${value.runId}/${value.projectId}/${value.deploymentStateHash}`;
  const expectedLeaseRef = `setfarm://deploy/runtime-lease/${value.runId}/${value.projectId}/${value.leaseIdentityHash}`;
  const owner = value.listenerOwnership.ownerProcess;
  const challenged = value.runtimeIsolation.challenge.wrapperProcessIdentity;
  if (
    value.runtime.buildArtifactHash !== value.buildArtifactHash
    || value.runtime.projectId !== value.projectId
    || value.runtime.evidenceRef !== expectedRuntimeRef
    || value.runtime.buildArtifactEvidenceRef !== expectedBuildArtifactRef
    || value.runtime.sealedRuntimeRef !== expectedSealedRuntimeRef
    || value.runtime.sealedRuntimeManifestHash !== value.sealedRuntimeManifestHash
    || value.runtime.sealedRuntimeManifestEvidenceRef !== value.sealedRuntimeManifestEvidenceRef
    || value.sealedRuntimeManifestEvidenceRef !== expectedManifestRef
    || value.runtime.sealAuthorityHash !== value.sealAuthorityHash
    || value.runtime.sealAuthorityEvidenceRef !== value.sealAuthorityEvidenceRef
    || value.sealAuthorityEvidenceRef !== expectedSealAuthorityRef
    || value.runtime.runtimeIsolation.authorityHash !== value.runtimeIsolation.authorityHash
    || value.runtime.runtimeDataContractHash !== value.runtime.runtimeIsolation.runtimeDataContractHash
    || value.runtime.runtimeDataContractHash !== value.runtimeIsolation.runtimeDataContractHash
    || value.runtime.runtimeDataContractHash !== value.runtime.volumeProvisioning.runtimeDataContractHash
    || value.runtime.volumeProvisioning.volumeProvisioningHash !== value.runtime.runtimeIsolation.volumeProvisioningHash
    || value.runtime.volumeProvisioning.volumeProvisioningHash !== value.runtimeIsolation.volumeProvisioningHash
    || value.runtime.volumeProvisioning.runId !== value.runId
    || value.runtime.volumeProvisioning.projectId !== value.runtime.projectId
    || value.runtimeIsolation.runId !== value.runId
    || value.runtimeIsolation.projectId !== value.runtime.projectId
    || value.runtimeIsolation.candidateHash !== value.candidateHash
    || value.runtimeIsolation.buildArtifactHash !== value.buildArtifactHash
    || value.runtimeIsolation.evidenceRef !== value.runtime.runtimeIsolation.evidenceRef
    || value.runtime.serviceId !== `process:${owner.pid}`
    || value.listenerOwnership.host !== value.runtime.host
    || value.listenerOwnership.port !== value.runtime.port
    || value.listenerOwnership.evidenceRef !== `${expectedRuntimeRef}/listener/${owner.pid}`
    || value.deploymentStateEvidenceRef !== expectedStateRef
    || value.leaseIdentityEvidenceRef !== expectedLeaseRef
    || value.httpProof.healthUrl !== value.runtime.healthUrl
    || value.httpProof.evidenceRef !== `${expectedRuntimeRef}/http/${value.deploymentReceiptHash}`
    || owner.pid !== challenged.pid
    || owner.processStartedAt !== challenged.processStartedAt
    || owner.processGroupId !== challenged.processGroupId
    || owner.source !== challenged.source
    || owner.source !== "observed_os"
    || owner.processGroupId !== owner.pid
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtime"],
      message: "Deployment observation must bind exact receipt, runtime, process, seal, and isolation authority",
    });
  }
  const observedAt = Date.parse(value.observedAt);
  if (observedAt < Date.parse(value.receiptCompletedAt)) {
    context.addIssue({ code: "custom", path: ["observedAt"], message: "Deployment observation predates receipt" });
  }
  for (const [label, timestamp] of [
    ["listenerOwnership", value.listenerOwnership.checkedAt],
    ["runtimeIsolation", value.runtimeIsolation.checkedAt],
    ["httpProof", value.httpProof.checkedAt],
  ] as const) {
    const elapsed = observedAt - Date.parse(timestamp);
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 15_000) {
      context.addIssue({ code: "custom", path: [label], message: "Deployment observation evidence is stale" });
    }
  }
});

export const V3DeploymentObservationV1Schema = V3DeploymentObservationIdentityV1Schema.extend({
  observationHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const { observationHash: _hash, evidenceRef: _ref, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.observationHash) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "Deployment observation hash mismatch" });
  }
  const expected = `setfarm://deploy/observation/${value.runId}/${value.deploymentReceiptHash}/${value.observationHash}`;
  if (value.evidenceRef !== expected) {
    context.addIssue({ code: "custom", path: ["evidenceRef"], message: "Deployment observation evidence reference mismatch" });
  }
});

export type V3DeploymentObservationV1 = z.infer<typeof V3DeploymentObservationV1Schema>;

export function createV3DeploymentObservationV1(
  input: z.input<typeof V3DeploymentObservationIdentityV1Schema>,
): V3DeploymentObservationV1 {
  const identity = V3DeploymentObservationIdentityV1Schema.parse(input);
  const observationHash = hashCanonicalJson(identity);
  return V3DeploymentObservationV1Schema.parse({
    ...identity,
    observationHash,
    evidenceRef: `setfarm://deploy/observation/${identity.runId}/${identity.deploymentReceiptHash}/${observationHash}`,
  });
}
