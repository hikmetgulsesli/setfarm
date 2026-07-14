import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  ProductIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "./execution-attempt-v1.js";
import { ProcessIdentityV1Schema } from "./process-identity-v1.js";
import {
  V3RuntimeIsolationAuthorityV1Schema,
  V3RuntimeIsolationProofV1Schema,
  V3RuntimeVolumeProvisioningV1Schema,
  exactV3RuntimeIsolationAuthorityContext,
} from "./v3-runtime-isolation-v1.js";

const ProjectIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const CandidateIdSchema = z.string().regex(/^ACPT_[a-f0-9]{64}$/);
export const V3_BUILD_ARTIFACT_MAX_FILES = 50_000;
export const V3_BUILD_ARTIFACT_MAX_FILE_BYTES = 1_073_741_824;
export const V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES = 4_294_967_296;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameProcessIdentityValue(
  left: z.infer<typeof ProcessIdentityV1Schema>,
  right: z.infer<typeof ProcessIdentityV1Schema>,
): boolean {
  return left.schema === right.schema
    && left.pid === right.pid
    && left.processStartedAt === right.processStartedAt
    && left.processGroupId === right.processGroupId
    && left.source === right.source;
}

export const V3BuildArtifactFileV1Schema = z.object({
  path: NormalizedRelativeLocatorSchema,
  byteLength: z.number().int().nonnegative().max(V3_BUILD_ARTIFACT_MAX_FILE_BYTES),
  contentHash: Sha256Schema,
  executable: z.boolean(),
}).strict();

const V3BuildArtifactIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-build-artifact.v1"),
  outputPaths: z.array(NormalizedRelativeLocatorSchema).min(1).max(500),
  files: z.array(V3BuildArtifactFileV1Schema).min(1).max(V3_BUILD_ARTIFACT_MAX_FILES),
  totalBytes: z.number().int().nonnegative().max(V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES),
}).strict().superRefine((value, context) => {
  const outputPaths = [...value.outputPaths].sort();
  if (
    !hasUniqueStrings(value.outputPaths)
    || value.outputPaths.some((entry, index) => entry !== outputPaths[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["outputPaths"],
      message: "Build output paths must be unique and canonically sorted",
    });
  }
  outputPaths.forEach((entry, index) => {
    if (outputPaths.some((candidate, candidateIndex) =>
      candidateIndex !== index && entry.startsWith(`${candidate}/`))) {
      context.addIssue({
        code: "custom",
        path: ["outputPaths", index],
        message: "Build output paths cannot overlap",
      });
    }
  });
  const files = [...value.files].sort((left, right) => compareCodeUnits(left.path, right.path));
  if (
    !hasUniqueStrings(value.files.map((file) => file.path))
    || value.files.some((entry, index) => entry.path !== files[index]?.path)
  ) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Build artifact files must be unique and canonically sorted",
    });
  }
  value.files.forEach((file, index) => {
    if (!outputPaths.some((outputPath) => file.path === outputPath || file.path.startsWith(`${outputPath}/`))) {
      context.addIssue({
        code: "custom",
        path: ["files", index, "path"],
        message: "Build artifact file is outside its sealed output paths",
      });
    }
  });
  outputPaths.forEach((outputPath, index) => {
    if (!value.files.some((file) => file.path === outputPath || file.path.startsWith(`${outputPath}/`))) {
      context.addIssue({
        code: "custom",
        path: ["outputPaths", index],
        message: "Every sealed build output path must contain at least one file",
      });
    }
  });
  const totalBytes = value.files.reduce((sum, file) => sum + file.byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes !== value.totalBytes) {
    context.addIssue({
      code: "custom",
      path: ["totalBytes"],
      message: "Build artifact total bytes do not match its file manifest",
    });
  }
});

export const V3BuildArtifactV1Schema = V3BuildArtifactIdentityV1Schema.extend({
  artifactHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const { artifactHash: _artifactHash, evidenceRef: _evidenceRef, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.artifactHash) {
    context.addIssue({ code: "custom", path: ["artifactHash"], message: "Build artifact hash mismatch" });
  }
});

export const V3ListenerOwnershipV1Schema = z.object({
  schema: z.literal("setfarm.v3-listener-ownership.v1"),
  ownerProcess: ProcessIdentityV1Schema,
  listenerPids: z.array(z.number().int().positive()).min(1).max(10_000),
  listenerProcesses: z.array(ProcessIdentityV1Schema).min(1).max(10_000),
  host: z.string().min(1).max(500),
  port: z.number().int().min(1).max(65_535),
  checkedAt: z.string().datetime({ offset: true }),
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const canonicalPids = [...value.listenerPids].sort((left, right) => left - right);
  if (
    !hasUniqueStrings(value.listenerPids.map(String))
    || value.listenerPids.some((pid, index) => pid !== canonicalPids[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["listenerPids"],
      message: "Listener PIDs must be unique and canonically sorted",
    });
  }
  if (
    value.listenerProcesses.length !== value.listenerPids.length
    || value.listenerProcesses.some((listener, index) => listener.pid !== value.listenerPids[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["listenerProcesses"],
      message: "Listener process identities must exactly match the canonical listener PID list",
    });
  }
  if (
    value.ownerProcess.source !== "observed_os"
    || value.ownerProcess.processGroupId === undefined
    || value.ownerProcess.processGroupId !== value.ownerProcess.pid
  ) {
    context.addIssue({
      code: "custom",
      path: ["ownerProcess"],
      message: "Listener owner must be an observed process-group leader",
    });
  }
  value.listenerProcesses.forEach((listener, index) => {
    if (
      listener.source !== "observed_os"
      || listener.processGroupId !== value.ownerProcess.pid
    ) {
      context.addIssue({
        code: "custom",
        path: ["listenerProcesses", index],
        message: "Every listener must be an observed member of the exact owner process group",
      });
    }
  });
});

export const V3DeployProjectV1Schema = z.object({
  schema: z.literal("setfarm.v3-deploy-project.v1"),
  productId: ProductIdSchema,
  projectId: ProjectIdSchema,
  displayName: z.string().min(1).max(200),
  summary: z.string().min(1).max(2_000),
}).strict();

export const V3DeployStackV1Schema = z.object({
  schema: z.literal("setfarm.v3-deploy-stack.v1"),
  stackPackId: z.string().min(1).max(160),
  stackPackVersion: z.string().min(1).max(100),
  stackPackContentHash: Sha256Schema,
  platform: z.enum(["web", "mobile", "desktop", "api", "cli", "game"]).nullable(),
  techStack: z.enum([
    "vite-react",
    "nextjs",
    "static-html",
    "browser-game",
    "node-express",
    "python-web",
    "node-cli",
    "python-cli",
    "react-native-expo",
    "android-native",
    "ios-native",
    "desktop-electron",
  ]).nullable(),
}).strict();

export const V3RuntimeDeploymentV1Schema = z.object({
  schema: z.literal("setfarm.v3-runtime-deployment.v1"),
  mode: z.literal("local"),
  projectId: ProjectIdSchema,
  serviceId: z.string().min(1).max(500),
  host: z.literal("127.0.0.1"),
  port: z.number().int().min(1).max(65_535),
  healthUrl: z.string().url(),
  deployUrl: z.string().url(),
  evidenceRef: z.string().min(1).max(2_000),
  buildArtifactHash: Sha256Schema,
  buildArtifactEvidenceRef: z.string().min(1).max(2_000),
  sealedRuntimeRef: z.string().min(1).max(2_000),
  sealedRuntimeManifestHash: Sha256Schema,
  sealedRuntimeManifestEvidenceRef: z.string().min(1).max(2_000),
  sealAuthorityHash: Sha256Schema,
  sealAuthorityEvidenceRef: z.string().min(1).max(2_000),
  runtimeDataContractHash: Sha256Schema,
  volumeProvisioning: V3RuntimeVolumeProvisioningV1Schema,
  runtimeIsolation: V3RuntimeIsolationAuthorityV1Schema,
}).strict().superRefine((value, context) => {
  const expectedUrl = `http://127.0.0.1:${value.port}/`;
  if (value.healthUrl !== expectedUrl || value.deployUrl !== expectedUrl) {
    context.addIssue({ code: "custom", path: ["healthUrl"], message: "Local runtime URLs must bind exact loopback listener" });
  }
});

export const V3DeployHealthProofV1Schema = z.object({
  schema: z.literal("setfarm.v3-deploy-health-proof.v1"),
  status: z.literal("pass"),
  httpStatus: z.number().int().min(200).max(399),
  checkedAt: z.string().datetime({ offset: true }),
  evidenceRef: z.string().min(1).max(2_000),
  buildArtifactHash: Sha256Schema,
  buildArtifactEvidenceRef: z.string().min(1).max(2_000),
  sealedRuntimeManifestHash: Sha256Schema,
  sealedRuntimeManifestEvidenceRef: z.string().min(1).max(2_000),
  listenerOwnership: V3ListenerOwnershipV1Schema,
  runtimeIsolation: V3RuntimeIsolationProofV1Schema,
}).strict();

export const V3TerminalProjectProjectionV1Schema = z.object({
  schema: z.literal("setfarm.v3-terminal-project-projection.v1"),
  owner: z.literal("mission-control-terminal-projector"),
  state: z.literal("pending_terminal_projection"),
  runId: z.string().min(1).max(500),
  candidateHash: Sha256Schema,
  projectId: ProjectIdSchema,
  serviceId: z.string().min(1).max(500),
  port: z.number().int().min(1).max(65_535),
  healthUrl: z.string().url(),
  evidenceRef: z.string().min(1).max(2_000),
  buildArtifactHash: Sha256Schema,
}).strict();

export const V3DeployReceiptIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-deploy-receipt.v1"),
  runId: z.string().min(1).max(500),
  candidateId: CandidateIdSchema,
  candidateHash: Sha256Schema,
  packetHash: Sha256Schema,
  project: V3DeployProjectV1Schema,
  stack: V3DeployStackV1Schema,
  buildCommandId: z.string().min(1).max(160),
  previewCommandId: z.string().min(1).max(160),
  sourceBefore: SourceRevisionV1Schema,
  sourceAfter: SourceRevisionV1Schema,
  buildArtifact: V3BuildArtifactV1Schema,
  runtime: V3RuntimeDeploymentV1Schema,
  health: V3DeployHealthProofV1Schema,
  terminalProjectProjection: V3TerminalProjectProjectionV1Schema,
  environmentNames: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)).max(500),
  completedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.candidateId !== `ACPT_${value.candidateHash}`) {
    context.addIssue({ code: "custom", path: ["candidateId"], message: "Deploy candidate identity mismatch" });
  }
  if (
    value.sourceBefore.sha !== value.sourceAfter.sha
    || value.sourceBefore.treeHash !== value.sourceAfter.treeHash
  ) {
    context.addIssue({ code: "custom", path: ["sourceAfter"], message: "Deploy changed AcceptedCandidate source" });
  }
  const canonicalEnvironmentNames = [...value.environmentNames].sort();
  if (
    !hasUniqueStrings(value.environmentNames)
    || value.environmentNames.some((name, index) => name !== canonicalEnvironmentNames[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["environmentNames"],
      message: "Deploy environment names must be unique and canonically sorted",
    });
  }
  if (value.runtime.projectId !== value.project.projectId) {
    context.addIssue({ code: "custom", path: ["runtime", "projectId"], message: "Runtime project identity mismatch" });
  }
  const expectedArtifactEvidenceRef = `setfarm://deploy/build-artifact/${value.runId}/${value.buildArtifact.artifactHash}`;
  const expectedSealedRuntimeRef = `setfarm://deploy/sealed-runtime/${value.runId}/${value.candidateHash}/${value.buildArtifact.artifactHash}`;
  const expectedManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${value.runId}/${value.candidateHash}/${value.buildArtifact.artifactHash}/${value.runtime.sealedRuntimeManifestHash}`;
  const expectedSealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${value.runId}/${value.candidateHash}/${value.buildArtifact.artifactHash}/${value.runtime.sealAuthorityHash}`;
  const expectedRuntimeEvidenceRef = `setfarm://deploy/runtime/${value.runId}/${value.project.projectId}`;
  if (
    value.buildArtifact.evidenceRef !== expectedArtifactEvidenceRef
    || value.runtime.buildArtifactHash !== value.buildArtifact.artifactHash
    || value.runtime.buildArtifactEvidenceRef !== expectedArtifactEvidenceRef
    || value.health.buildArtifactHash !== value.buildArtifact.artifactHash
    || value.health.buildArtifactEvidenceRef !== expectedArtifactEvidenceRef
    || value.terminalProjectProjection.buildArtifactHash !== value.buildArtifact.artifactHash
    || value.runtime.sealedRuntimeRef !== expectedSealedRuntimeRef
    || value.runtime.sealedRuntimeManifestHash !== value.health.sealedRuntimeManifestHash
    || value.runtime.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || value.health.sealedRuntimeManifestEvidenceRef !== expectedManifestEvidenceRef
    || value.runtime.sealAuthorityEvidenceRef !== expectedSealAuthorityEvidenceRef
    || value.runtime.evidenceRef !== expectedRuntimeEvidenceRef
    || value.health.evidenceRef !== `${expectedRuntimeEvidenceRef}/health`
    || value.health.listenerOwnership.evidenceRef !== `${expectedRuntimeEvidenceRef}/listener/${value.health.listenerOwnership.ownerProcess.pid}`
    || value.terminalProjectProjection.evidenceRef !== `setfarm://run/${value.runId}/deploy-receipt`
    || value.runtime.runtimeDataContractHash !== value.runtime.runtimeIsolation.runtimeDataContractHash
    || value.runtime.runtimeDataContractHash !== value.runtime.volumeProvisioning.runtimeDataContractHash
    || value.runtime.volumeProvisioning.runId !== value.runId
    || value.runtime.volumeProvisioning.projectId !== value.project.projectId
    || value.runtime.runtimeIsolation.volumeProvisioningHash !== value.runtime.volumeProvisioning.volumeProvisioningHash
    || value.health.runtimeIsolation.authorityHash !== value.runtime.runtimeIsolation.authorityHash
    || value.health.runtimeIsolation.challenge.authorityHash !== value.runtime.runtimeIsolation.authorityHash
    || value.health.runtimeIsolation.evidenceRef !== value.runtime.runtimeIsolation.evidenceRef
    || !exactV3RuntimeIsolationAuthorityContext(value.runtime.runtimeIsolation, {
      runId: value.runId,
      projectId: value.project.projectId,
      candidateHash: value.candidateHash,
      buildArtifactHash: value.buildArtifact.artifactHash,
    })
  ) {
    context.addIssue({
      code: "custom",
      path: ["buildArtifact"],
      message: "Deploy runtime and health must bind the exact sealed runtime; terminal projection must bind its build artifact",
    });
  }
  if (
    value.runtime.serviceId !== `process:${value.health.listenerOwnership.ownerProcess.pid}`
    || value.health.listenerOwnership.host !== value.runtime.host
    || value.health.listenerOwnership.port !== value.runtime.port
    || !sameProcessIdentityValue(
      value.health.runtimeIsolation.challenge.wrapperProcessIdentity,
      value.health.listenerOwnership.ownerProcess,
    )
    || value.health.runtimeIsolation.challenge.wrapperProcessIdentity.source !== "observed_os"
    || value.health.runtimeIsolation.challenge.wrapperProcessIdentity.processGroupId !== value.health.runtimeIsolation.challenge.wrapperProcessIdentity.pid
  ) {
    context.addIssue({
      code: "custom",
      path: ["health", "listenerOwnership"],
      message: "Health proof listener ownership is not bound to the runtime",
    });
  }
  if (
    value.terminalProjectProjection.runId !== value.runId
    || value.terminalProjectProjection.candidateHash !== value.candidateHash
    || value.terminalProjectProjection.projectId !== value.project.projectId
    || value.terminalProjectProjection.serviceId !== value.runtime.serviceId
    || value.terminalProjectProjection.port !== value.runtime.port
    || value.terminalProjectProjection.healthUrl !== value.runtime.healthUrl
    || value.terminalProjectProjection.buildArtifactHash !== value.runtime.buildArtifactHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["terminalProjectProjection"],
      message: "Terminal project projection is not bound to deploy authority",
    });
  }
});

export const V3DeployReceiptV1Schema = V3DeployReceiptIdentityV1Schema.extend({
  receiptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { receiptHash: _receiptHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.receiptHash) {
    context.addIssue({ code: "custom", path: ["receiptHash"], message: "Deploy receipt hash mismatch" });
  }
});

export type V3DeployProjectV1 = z.infer<typeof V3DeployProjectV1Schema>;
export type V3BuildArtifactFileV1 = z.infer<typeof V3BuildArtifactFileV1Schema>;
export type V3BuildArtifactV1 = z.infer<typeof V3BuildArtifactV1Schema>;
export type V3ListenerOwnershipV1 = z.infer<typeof V3ListenerOwnershipV1Schema>;
export type V3DeployStackV1 = z.infer<typeof V3DeployStackV1Schema>;
export type V3RuntimeDeploymentV1 = z.infer<typeof V3RuntimeDeploymentV1Schema>;
export type V3DeployHealthProofV1 = z.infer<typeof V3DeployHealthProofV1Schema>;
export type V3TerminalProjectProjectionV1 = z.infer<typeof V3TerminalProjectProjectionV1Schema>;
export type V3DeployReceiptIdentityV1 = z.infer<typeof V3DeployReceiptIdentityV1Schema>;
export type V3DeployReceiptV1 = z.infer<typeof V3DeployReceiptV1Schema>;

export function createV3DeployReceiptV1(
  input: z.input<typeof V3DeployReceiptIdentityV1Schema>,
): V3DeployReceiptV1 {
  const identity = V3DeployReceiptIdentityV1Schema.parse(input);
  return V3DeployReceiptV1Schema.parse({
    ...identity,
    receiptHash: hashCanonicalJson(identity),
  });
}

export function createV3BuildArtifactV1(
  input: z.input<typeof V3BuildArtifactIdentityV1Schema> & Readonly<{ runId: string }>,
): V3BuildArtifactV1 {
  const { runId, ...rawIdentity } = input;
  const identity = V3BuildArtifactIdentityV1Schema.parse(rawIdentity);
  const artifactHash = hashCanonicalJson(identity);
  return V3BuildArtifactV1Schema.parse({
    ...identity,
    artifactHash,
    evidenceRef: `setfarm://deploy/build-artifact/${runId}/${artifactHash}`,
  });
}
