import type { ProcessIdentityV1 } from "../../../src/execution/schemas/process-identity-v1.js";
import {
  createV3RuntimeIsolationAuthorityV1,
  createV3RuntimeIsolationChallengeV1,
  createV3RuntimeVolumeProvisioningV1,
  V3RuntimeIsolationProofV1Schema,
} from "../../../src/execution/schemas/v3-runtime-isolation-v1.js";

/**
 * Canonical no-host-volume runtime authority for deploy/eval fixtures.
 * Production code remains the only source of hashes and evidence references.
 */
export function buildNoVolumeRuntimeAuthorityFixture(input: Readonly<{
  runId: string;
  projectId: string;
  candidateHash: string;
  buildArtifactHash: string;
  ownerProcess: ProcessIdentityV1;
  checkedAt: string;
}>) {
  const checkedAtMs = Date.parse(input.checkedAt);
  if (!Number.isFinite(checkedAtMs)) throw new Error("FIXTURE_CHECKED_AT_INVALID");
  const runtimeDataContractHash = "c".repeat(64);
  const volumeProvisioning = createV3RuntimeVolumeProvisioningV1({
    schema: "setfarm.v3-runtime-volume-provisioning.v1",
    runId: input.runId,
    projectId: input.projectId,
    runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" },
  });
  const runtimeIsolation = createV3RuntimeIsolationAuthorityV1({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: "darwin-sandbox-exec",
    adapterVersion: "1.0.0",
    runId: input.runId,
    projectId: input.projectId,
    candidateHash: input.candidateHash,
    buildArtifactHash: input.buildArtifactHash,
    policyHash: "9".repeat(64),
    profileHash: "a".repeat(64),
    wrapperArtifactHash: "f".repeat(64),
    runtimeDataContractHash,
    volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
  });
  const challenge = createV3RuntimeIsolationChallengeV1({
    schema: "setfarm.v3-runtime-isolation-challenge.v1",
    nonce: "7".repeat(64),
    authorityHash: runtimeIsolation.authorityHash,
    wrapperProcessIdentity: input.ownerProcess,
    deniedRootProbes: [
      { rootId: "sealed-runtime", outcome: "denied" },
      { rootId: "state-authority", outcome: "denied" },
    ],
    deniedReadProbes: [
      { authorityId: "launch-agents", outcome: "denied" },
      { authorityId: "mission-control-config", outcome: "denied" },
      { authorityId: "setfarm-config", outcome: "denied" },
    ],
    deniedNetworkProbes: [{ authorityId: "all-outbound", outcome: "denied" }],
    deniedProcessExecProbes: [{ executableId: "launchctl", outcome: "denied" }],
    deniedSignalProbes: [{ authorityId: "control-sentinel", outcome: "denied" }],
    allowedVolumeProbes: [],
    challengedAt: new Date(checkedAtMs - 1_000).toISOString(),
  });
  const runtimeIsolationProof = V3RuntimeIsolationProofV1Schema.parse({
    ...runtimeIsolation,
    schema: "setfarm.v3-runtime-isolation-proof.v1",
    challenge,
    checkedAt: input.checkedAt,
    checks: { runtimeIsolation: "pass" },
  });
  const sealAuthorityHash = "d".repeat(64);
  return Object.freeze({
    runtimeDataContractHash,
    volumeProvisioning,
    runtimeIsolation,
    runtimeIsolationProof,
    sealAuthorityHash,
    sealAuthorityEvidenceRef: `setfarm://deploy/seal-authority/${input.runId}/${input.candidateHash}/${input.buildArtifactHash}/${sealAuthorityHash}`,
  });
}
