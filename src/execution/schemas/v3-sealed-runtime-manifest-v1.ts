import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "./execution-attempt-v1.js";

export const V3_SEALED_RUNTIME_MAX_FILES = 250_000;
export const V3_SEALED_RUNTIME_MAX_DIRECTORIES = 250_000;
export const V3_SEALED_RUNTIME_MAX_FILE_BYTES = 1_073_741_824;
export const V3_SEALED_RUNTIME_MAX_TOTAL_BYTES = 8_589_934_592;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export const V3SealedRuntimeFileV1Schema = z.object({
  path: NormalizedRelativeLocatorSchema,
  byteLength: z.number().int().nonnegative().max(V3_SEALED_RUNTIME_MAX_FILE_BYTES),
  contentHash: Sha256Schema,
  executable: z.boolean(),
}).strict();

const V3SealedRuntimeManifestIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-sealed-runtime-manifest.v1"),
  runId: z.string().min(1).max(500),
  candidateHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  buildArtifactHash: Sha256Schema,
  runtimeDataContractHash: Sha256Schema,
  dependencyRoots: z.array(NormalizedRelativeLocatorSchema).max(500),
  directories: z.array(NormalizedRelativeLocatorSchema).max(V3_SEALED_RUNTIME_MAX_DIRECTORIES),
  files: z.array(V3SealedRuntimeFileV1Schema).min(1).max(V3_SEALED_RUNTIME_MAX_FILES),
  totalBytes: z.number().int().nonnegative().max(V3_SEALED_RUNTIME_MAX_TOTAL_BYTES),
}).strict().superRefine((value, context) => {
  const canonicalRoots = [...value.dependencyRoots].sort(compareCodeUnits);
  if (
    !hasUniqueStrings(value.dependencyRoots)
    || value.dependencyRoots.some((entry, index) => entry !== canonicalRoots[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyRoots"],
      message: "Sealed runtime dependency roots must be unique and canonically sorted",
    });
  }
  value.dependencyRoots.forEach((root, index) => {
    if (!value.directories.includes(root)) {
      context.addIssue({
        code: "custom",
        path: ["dependencyRoots", index],
        message: "Every sealed runtime dependency root must be a manifested directory",
      });
    }
  });
  const canonicalDirectories = [...value.directories].sort(compareCodeUnits);
  if (
    !hasUniqueStrings(value.directories)
    || value.directories.some((entry, index) => entry !== canonicalDirectories[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["directories"],
      message: "Sealed runtime directories must be unique and canonically sorted",
    });
  }
  const canonicalFiles = [...value.files].sort((left, right) => compareCodeUnits(left.path, right.path));
  if (
    !hasUniqueStrings(value.files.map((file) => file.path))
    || value.files.some((entry, index) => entry.path !== canonicalFiles[index]?.path)
  ) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Sealed runtime files must be unique and canonically sorted",
    });
  }
  const totalBytes = value.files.reduce((sum, file) => sum + file.byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes !== value.totalBytes) {
    context.addIssue({
      code: "custom",
      path: ["totalBytes"],
      message: "Sealed runtime total bytes do not match its file manifest",
    });
  }
});

export const V3SealedRuntimeManifestV1Schema = V3SealedRuntimeManifestIdentityV1Schema.extend({
  manifestHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const { manifestHash: _manifestHash, evidenceRef: _evidenceRef, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.manifestHash) {
    context.addIssue({ code: "custom", path: ["manifestHash"], message: "Sealed runtime manifest hash mismatch" });
  }
  const expectedEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.manifestHash}`;
  if (value.evidenceRef !== expectedEvidenceRef) {
    context.addIssue({
      code: "custom",
      path: ["evidenceRef"],
      message: "Sealed runtime manifest evidence reference mismatch",
    });
  }
});

export type V3SealedRuntimeFileV1 = z.infer<typeof V3SealedRuntimeFileV1Schema>;
export type V3SealedRuntimeManifestV1 = z.infer<typeof V3SealedRuntimeManifestV1Schema>;

export function createV3SealedRuntimeManifestV1(
  input: z.input<typeof V3SealedRuntimeManifestIdentityV1Schema>,
): V3SealedRuntimeManifestV1 {
  const identity = V3SealedRuntimeManifestIdentityV1Schema.parse(input);
  const manifestHash = hashCanonicalJson(identity);
  return V3SealedRuntimeManifestV1Schema.parse({
    ...identity,
    manifestHash,
    evidenceRef: `setfarm://deploy/sealed-runtime-manifest/${identity.runId}/${identity.candidateHash}/${identity.buildArtifactHash}/${manifestHash}`,
  });
}

const V3SealAuthorityIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-seal-authority.v1"),
  runId: z.string().min(1).max(500),
  candidateHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  buildArtifactHash: Sha256Schema,
  buildArtifactEvidenceRef: z.string().min(1).max(2_000),
  runtimeDataContractHash: Sha256Schema,
  sealedRuntimeRef: z.string().min(1).max(2_000),
  manifestHash: Sha256Schema,
  manifestEvidenceRef: z.string().min(1).max(2_000),
  fileCount: z.number().int().positive().max(V3_SEALED_RUNTIME_MAX_FILES + 1),
  totalBytes: z.number().int().nonnegative().max(V3_SEALED_RUNTIME_MAX_TOTAL_BYTES + V3_SEALED_RUNTIME_MAX_FILE_BYTES),
}).strict().superRefine((value, context) => {
  const expectedBuildArtifactRef = `setfarm://deploy/build-artifact/${value.runId}/${value.buildArtifactHash}`;
  const expectedSealedRuntimeRef = `setfarm://deploy/sealed-runtime/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}`;
  const expectedManifestRef = `setfarm://deploy/sealed-runtime-manifest/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.manifestHash}`;
  if (value.buildArtifactEvidenceRef !== expectedBuildArtifactRef) {
    context.addIssue({ code: "custom", path: ["buildArtifactEvidenceRef"], message: "Seal authority build artifact reference mismatch" });
  }
  if (value.sealedRuntimeRef !== expectedSealedRuntimeRef) {
    context.addIssue({ code: "custom", path: ["sealedRuntimeRef"], message: "Seal authority runtime reference mismatch" });
  }
  if (value.manifestEvidenceRef !== expectedManifestRef) {
    context.addIssue({ code: "custom", path: ["manifestEvidenceRef"], message: "Seal authority manifest reference mismatch" });
  }
});

export const V3SealAuthorityV1Schema = V3SealAuthorityIdentityV1Schema.extend({
  authorityHash: Sha256Schema,
  evidenceRef: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const { authorityHash: _authorityHash, evidenceRef: _evidenceRef, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) {
    context.addIssue({ code: "custom", path: ["authorityHash"], message: "Seal authority hash mismatch" });
  }
  const expectedEvidenceRef = `setfarm://deploy/seal-authority/${value.runId}/${value.candidateHash}/${value.buildArtifactHash}/${value.authorityHash}`;
  if (value.evidenceRef !== expectedEvidenceRef) {
    context.addIssue({ code: "custom", path: ["evidenceRef"], message: "Seal authority evidence reference mismatch" });
  }
});

export type V3SealAuthorityV1 = z.infer<typeof V3SealAuthorityV1Schema>;

export function createV3SealAuthorityV1(
  input: z.input<typeof V3SealAuthorityIdentityV1Schema>,
): V3SealAuthorityV1 {
  const identity = V3SealAuthorityIdentityV1Schema.parse(input);
  const authorityHash = hashCanonicalJson(identity);
  return V3SealAuthorityV1Schema.parse({
    ...identity,
    authorityHash,
    evidenceRef: `setfarm://deploy/seal-authority/${identity.runId}/${identity.candidateHash}/${identity.buildArtifactHash}/${authorityHash}`,
  });
}
