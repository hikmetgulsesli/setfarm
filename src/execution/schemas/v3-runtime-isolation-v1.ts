import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import { ProcessIdentityV1Schema } from "./process-identity-v1.js";

const ProjectIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const RuntimeVolumeIdSchema = z.string().min(8).max(160).regex(/^VOLUME_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);
const RuntimeQuotaSchema = z.object({
  maxBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  maxFiles: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

const RuntimeVolumeRootIdentityV1Schema = z.object({
  dev: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ino: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();

const V3RuntimeWritableVolumeProvisionV1Schema = z.object({
  volumeId: RuntimeVolumeIdSchema,
  persistenceClass: z.enum(["project", "run", "ephemeral"]),
  purpose: z.enum(["application-data", "database", "uploads"]),
  rootEvidenceRef: z.string().min(1).max(2_000),
  rootIdentity: RuntimeVolumeRootIdentityV1Schema,
  quota: RuntimeQuotaSchema,
  migrationCommandRef: z.string().min(1).max(160),
}).strict();

const V3RuntimeScratchProvisionV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("platform-managed"),
    rootEvidenceRef: z.string().min(1).max(2_000),
    rootIdentity: RuntimeVolumeRootIdentityV1Schema,
    quota: RuntimeQuotaSchema,
  }).strict(),
]);

const V3RuntimeVolumeProvisioningIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-volume-provisioning.v1"),
  runId: z.string().min(1).max(500),
  projectId: ProjectIdSchema,
  runtimeDataContractHash: Sha256Schema,
  writableVolumes: z.array(V3RuntimeWritableVolumeProvisionV1Schema).max(1_000),
  scratch: V3RuntimeScratchProvisionV1Schema,
}).strict().superRefine((value, context) => {
  const volumeIds = value.writableVolumes.map((entry) => entry.volumeId);
  const sorted = [...volumeIds].sort();
  if (new Set(volumeIds).size !== volumeIds.length || volumeIds.some((entry, index) => entry !== sorted[index])) {
    context.addIssue({
      code: "custom",
      path: ["writableVolumes"],
      message: "Runtime volume provisioning must be unique and canonically sorted",
    });
  }
  value.writableVolumes.forEach((entry, index) => {
    const expected = `setfarm://deploy/runtime-volume-root/${value.runId}/${value.projectId}/${entry.volumeId}/${entry.rootIdentity.dev}:${entry.rootIdentity.ino}`;
    if (entry.rootEvidenceRef !== expected) {
      context.addIssue({ code: "custom", path: ["writableVolumes", index, "rootEvidenceRef"], message: "Runtime volume root reference mismatch" });
    }
  });
  if (value.scratch.kind === "platform-managed") {
    const expected = `setfarm://deploy/runtime-volume-root/${value.runId}/${value.projectId}/scratch/${value.scratch.rootIdentity.dev}:${value.scratch.rootIdentity.ino}`;
    if (value.scratch.rootEvidenceRef !== expected) {
      context.addIssue({ code: "custom", path: ["scratch", "rootEvidenceRef"], message: "Runtime scratch root reference mismatch" });
    }
  }
});

export const V3RuntimeVolumeProvisioningV1Schema = V3RuntimeVolumeProvisioningIdentityV1Schema.extend({
  volumeProvisioningHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const { volumeProvisioningHash: _hash, evidenceRef: _ref, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.volumeProvisioningHash) {
    context.addIssue({ code: "custom", path: ["volumeProvisioningHash"], message: "Runtime volume provisioning hash mismatch" });
  }
  const expected = `setfarm://deploy/runtime-volumes/${value.runId}/${value.projectId}/${value.volumeProvisioningHash}`;
  if (value.evidenceRef !== expected) {
    context.addIssue({ code: "custom", path: ["evidenceRef"], message: "Runtime volume provisioning reference mismatch" });
  }
});

export type V3RuntimeVolumeProvisioningV1 = z.infer<typeof V3RuntimeVolumeProvisioningV1Schema>;

export function createV3RuntimeVolumeProvisioningV1(
  input: z.input<typeof V3RuntimeVolumeProvisioningIdentityV1Schema>,
): V3RuntimeVolumeProvisioningV1 {
  const identity = V3RuntimeVolumeProvisioningIdentityV1Schema.parse(input);
  const volumeProvisioningHash = hashCanonicalJson(identity);
  return V3RuntimeVolumeProvisioningV1Schema.parse({
    ...identity,
    volumeProvisioningHash,
    evidenceRef: `setfarm://deploy/runtime-volumes/${identity.runId}/${identity.projectId}/${volumeProvisioningHash}`,
  });
}

const V3RuntimeIsolationPolicyIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-isolation-policy.v1"),
  adapterId: z.literal("darwin-sandbox-exec"),
  adapterVersion: z.literal("1.0.0"),
  runId: z.string().min(1).max(500),
  projectId: ProjectIdSchema,
  candidateHash: Sha256Schema,
  buildArtifactHash: Sha256Schema,
  profileHash: Sha256Schema,
  wrapperArtifactHash: Sha256Schema,
  runtimeDataContractHash: Sha256Schema,
  volumeProvisioningHash: Sha256Schema,
  deniedWriteRoots: z.tuple([
    z.object({ rootId: z.literal("sealed-runtime"), canonicalPath: z.string().min(1).max(4_000) }).strict(),
    z.object({ rootId: z.literal("state-authority"), canonicalPath: z.string().min(1).max(4_000) }).strict(),
  ]),
  deniedReadRoots: z.tuple([
    z.object({ rootId: z.literal("launch-agents"), canonicalPath: z.string().min(1).max(4_000) }).strict(),
    z.object({ rootId: z.literal("mission-control-config"), canonicalPath: z.string().min(1).max(4_000) }).strict(),
    z.object({ rootId: z.literal("setfarm-config"), canonicalPath: z.string().min(1).max(4_000) }).strict(),
  ]),
  homeAuthorityRoot: z.string().min(1).max(4_000),
  readExceptions: z.array(z.object({
    rootId: z.string().min(1).max(160),
    canonicalPath: z.string().min(1).max(4_000),
  }).strict()).min(1).max(1_002),
  readTraversalPaths: z.array(z.string().min(1).max(4_000)).max(1_000),
  allowedWriteRoots: z.array(z.object({
    rootId: z.string().min(1).max(160),
    canonicalPath: z.string().min(1).max(4_000),
  }).strict()).max(1_001),
  executableAllowlist: z.array(z.string().min(1).max(4_000)).min(1).max(100),
  networkPolicy: z.object({ outbound: z.literal("deny"), inbound: z.literal("loopback-any-port") }).strict(),
  signalPolicy: z.object({ crossSandbox: z.literal("deny"), sameSandbox: z.literal("allow") }).strict(),
  processInfoPolicy: z.literal("self-and-same-sandbox-only"),
}).strict();

export const V3RuntimeIsolationPolicyV1Schema = V3RuntimeIsolationPolicyIdentityV1Schema.extend({
  policyHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { policyHash: _hash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.policyHash) {
    context.addIssue({ code: "custom", path: ["policyHash"], message: "Runtime isolation policy hash mismatch" });
  }
});

export type V3RuntimeIsolationPolicyV1 = z.infer<typeof V3RuntimeIsolationPolicyV1Schema>;

export function createV3RuntimeIsolationPolicyV1(
  input: z.input<typeof V3RuntimeIsolationPolicyIdentityV1Schema>,
): V3RuntimeIsolationPolicyV1 {
  const identity = V3RuntimeIsolationPolicyIdentityV1Schema.parse(input);
  return V3RuntimeIsolationPolicyV1Schema.parse({ ...identity, policyHash: hashCanonicalJson(identity) });
}

const V3RuntimeIsolationAuthorityIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-isolation-authority.v1"),
  adapterId: z.literal("darwin-sandbox-exec"),
  adapterVersion: z.literal("1.0.0"),
  runId: z.string().min(1).max(500),
  projectId: ProjectIdSchema,
  candidateHash: Sha256Schema,
  buildArtifactHash: Sha256Schema,
  policyHash: Sha256Schema,
  profileHash: Sha256Schema,
  wrapperArtifactHash: Sha256Schema,
  runtimeDataContractHash: Sha256Schema,
  volumeProvisioningHash: Sha256Schema,
}).strict();

export const V3RuntimeIsolationAuthorityV1Schema = V3RuntimeIsolationAuthorityIdentityV1Schema.extend({
  evidenceRef: z.string().min(1).max(2_000),
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { authorityHash: _hash, evidenceRef: _ref, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) {
    context.addIssue({ code: "custom", path: ["authorityHash"], message: "Runtime isolation authority hash mismatch" });
  }
  const expected = `setfarm://deploy/runtime-isolation/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.authorityHash}`;
  if (value.evidenceRef !== expected) {
    context.addIssue({ code: "custom", path: ["evidenceRef"], message: "Runtime isolation authority reference mismatch" });
  }
});

export type V3RuntimeIsolationAuthorityV1 = z.infer<typeof V3RuntimeIsolationAuthorityV1Schema>;

export function exactV3RuntimeIsolationAuthorityContext(
  authority: V3RuntimeIsolationAuthorityV1,
  context: Readonly<{ runId: string; projectId: string; candidateHash: string; buildArtifactHash: string }>,
): boolean {
  return authority.runId === context.runId
    && authority.projectId === context.projectId
    && authority.candidateHash === context.candidateHash
    && authority.buildArtifactHash === context.buildArtifactHash
    && authority.evidenceRef === `setfarm://deploy/runtime-isolation/${context.runId}/${context.candidateHash}/${context.buildArtifactHash}/${authority.authorityHash}`;
}

export function createV3RuntimeIsolationAuthorityV1(
  input: z.input<typeof V3RuntimeIsolationAuthorityIdentityV1Schema>,
): V3RuntimeIsolationAuthorityV1 {
  const identity = V3RuntimeIsolationAuthorityIdentityV1Schema.parse(input);
  const authorityHash = hashCanonicalJson(identity);
  return V3RuntimeIsolationAuthorityV1Schema.parse({
    ...identity,
    authorityHash,
    evidenceRef: `setfarm://deploy/runtime-isolation/${identity.runId}/${identity.candidateHash}/${identity.buildArtifactHash}/${authorityHash}`,
  });
}

const V3DeniedRootProbeV1Schema = z.object({
  rootId: z.enum(["sealed-runtime", "state-authority"]),
  outcome: z.literal("denied"),
}).strict();

const V3AllowedVolumeProbeV1Schema = z.object({
  volumeId: RuntimeVolumeIdSchema,
  outcome: z.literal("write_read_delete_pass"),
}).strict();

const V3DeniedReadProbeV1Schema = z.object({
  authorityId: z.enum(["launch-agents", "mission-control-config", "setfarm-config"]),
  outcome: z.literal("denied"),
}).strict();

const V3DeniedNetworkProbeV1Schema = z.object({
  authorityId: z.literal("all-outbound"),
  outcome: z.literal("denied"),
}).strict();

const V3DeniedProcessExecProbeV1Schema = z.object({
  executableId: z.literal("launchctl"),
  outcome: z.literal("denied"),
}).strict();

const V3DeniedSignalProbeV1Schema = z.object({
  authorityId: z.literal("control-sentinel"),
  outcome: z.literal("denied"),
}).strict();

const V3RuntimeIsolationChallengeIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-isolation-challenge.v1"),
  nonce: Sha256Schema,
  authorityHash: Sha256Schema,
  wrapperProcessIdentity: ProcessIdentityV1Schema,
  deniedRootProbes: z.array(V3DeniedRootProbeV1Schema).length(2),
  deniedReadProbes: z.array(V3DeniedReadProbeV1Schema).length(3),
  deniedNetworkProbes: z.tuple([V3DeniedNetworkProbeV1Schema]),
  deniedProcessExecProbes: z.tuple([V3DeniedProcessExecProbeV1Schema]),
  deniedSignalProbes: z.tuple([V3DeniedSignalProbeV1Schema]),
  allowedVolumeProbes: z.array(V3AllowedVolumeProbeV1Schema).max(1_000),
  challengedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.deniedRootProbes.map((entry) => entry.rootId).join(",") !== "sealed-runtime,state-authority") {
    context.addIssue({ code: "custom", path: ["deniedRootProbes"], message: "Denied-root probes must have exact canonical coverage" });
  }
  if (value.deniedReadProbes.map((entry) => entry.authorityId).join(",") !== "launch-agents,mission-control-config,setfarm-config") {
    context.addIssue({ code: "custom", path: ["deniedReadProbes"], message: "Denied-read probes must have exact canonical coverage" });
  }
  if (value.deniedNetworkProbes[0].authorityId !== "all-outbound") {
    context.addIssue({ code: "custom", path: ["deniedNetworkProbes"], message: "Denied-network probes must have exact canonical coverage" });
  }
  const volumeIds = value.allowedVolumeProbes.map((entry) => entry.volumeId);
  const sorted = [...volumeIds].sort();
  if (new Set(volumeIds).size !== volumeIds.length || volumeIds.some((entry, index) => entry !== sorted[index])) {
    context.addIssue({ code: "custom", path: ["allowedVolumeProbes"], message: "Allowed-volume probes must be unique and sorted" });
  }
});

export const V3RuntimeIsolationChallengeV1Schema = V3RuntimeIsolationChallengeIdentityV1Schema.extend({
  challengeHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { challengeHash: _hash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.challengeHash) {
    context.addIssue({ code: "custom", path: ["challengeHash"], message: "Runtime isolation challenge hash mismatch" });
  }
});

export type V3RuntimeIsolationChallengeV1 = z.infer<typeof V3RuntimeIsolationChallengeV1Schema>;

export function createV3RuntimeIsolationChallengeV1(
  input: z.input<typeof V3RuntimeIsolationChallengeIdentityV1Schema>,
): V3RuntimeIsolationChallengeV1 {
  const identity = V3RuntimeIsolationChallengeIdentityV1Schema.parse(input);
  return V3RuntimeIsolationChallengeV1Schema.parse({
    ...identity,
    challengeHash: hashCanonicalJson(identity),
  });
}

export const V3RuntimeIsolationProofV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-isolation-proof.v1"),
  adapterId: z.literal("darwin-sandbox-exec"),
  adapterVersion: z.literal("1.0.0"),
  runId: z.string().min(1).max(500),
  projectId: ProjectIdSchema,
  candidateHash: Sha256Schema,
  buildArtifactHash: Sha256Schema,
  policyHash: Sha256Schema,
  profileHash: Sha256Schema,
  wrapperArtifactHash: Sha256Schema,
  runtimeDataContractHash: Sha256Schema,
  volumeProvisioningHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
  authorityHash: Sha256Schema,
  challenge: V3RuntimeIsolationChallengeV1Schema,
  checkedAt: z.string().datetime({ offset: true }),
  checks: z.object({ runtimeIsolation: z.literal("pass") }).strict(),
}).strict().superRefine((value, context) => {
  const authority = V3RuntimeIsolationAuthorityV1Schema.safeParse({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: value.adapterId,
    adapterVersion: value.adapterVersion,
    runId: value.runId,
    projectId: value.projectId,
    candidateHash: value.candidateHash,
    buildArtifactHash: value.buildArtifactHash,
    policyHash: value.policyHash,
    profileHash: value.profileHash,
    wrapperArtifactHash: value.wrapperArtifactHash,
    runtimeDataContractHash: value.runtimeDataContractHash,
    volumeProvisioningHash: value.volumeProvisioningHash,
    evidenceRef: value.evidenceRef,
    authorityHash: value.authorityHash,
  });
  if (!authority.success || value.challenge.authorityHash !== value.authorityHash) {
    context.addIssue({ code: "custom", path: ["authorityHash"], message: "Runtime isolation proof authority mismatch" });
  }
  const elapsed = Date.parse(value.checkedAt) - Date.parse(value.challenge.challengedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 15_000) {
    context.addIssue({ code: "custom", path: ["checkedAt"], message: "Runtime isolation proof challenge is stale" });
  }
});

export type V3RuntimeIsolationProofV1 = z.infer<typeof V3RuntimeIsolationProofV1Schema>;
