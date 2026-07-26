import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
} from "./canonical-runtime-tree-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA =
  "setfarm.canonical-runtime-tree-binding.v2" as const;
export const PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA =
  "setfarm.platform-runtime-payload.v2" as const;
export const EXACT_BUNDLED_FILE_REF_V2_SCHEMA =
  "setfarm.exact-bundled-file-ref.v2" as const;
export const RELEASE_LAYOUT_V2_SCHEMA = "setfarm.release-layout.v2" as const;
export const RUNTIME_PAYLOAD_LAYOUT_V2_SCHEMA =
  "setfarm.runtime-payload-layout.v2" as const;
export const PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES = 64 * 1024;
export const PLATFORM_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2 = 4 * 1024 * 1024;

const CanonicalRuntimeTreeBindingCommonV2Shape = {
  schema: z.literal(CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  treeHash: Sha256Schema,
  treePayloadHash: Sha256Schema,
  fileCount: z.number().int().nonnegative(),
  directoryCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  bindingHash: Sha256Schema,
};

export type CanonicalRuntimeTreeBindingHashPayloadV2 = Readonly<{
  schema: typeof CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA;
  treeSchema: typeof CANONICAL_RUNTIME_TREE_V2_SCHEMA;
  profile: "dist" | "dependencies";
  rootLocator: "payload/dist" | "payload/node_modules";
  treeHash: string;
  treePayloadHash: string;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
}>;

export function hashCanonicalRuntimeTreeBindingV2(
  value:
    | CanonicalRuntimeTreeBindingHashPayloadV2
    | CanonicalRuntimeTreeBindingCandidateV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.canonical-runtime-tree-binding-payload.v2",
    binding,
  });
}

export const CanonicalRuntimeDistTreeBindingCandidateV2Schema = z.object({
  ...CanonicalRuntimeTreeBindingCommonV2Shape,
  profile: z.literal("dist"),
  rootLocator: z.literal("payload/dist"),
}).strict().superRefine((value, context) => {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dist;
  if (value.fileCount > limits.maxFiles) {
    context.addIssue({ code: "custom", path: ["fileCount"], message: "Dist tree file limit exceeded" });
  }
  if (value.directoryCount > limits.maxDirectories) {
    context.addIssue({ code: "custom", path: ["directoryCount"], message: "Dist tree directory limit exceeded" });
  }
  if (value.totalBytes > limits.maxTotalBytes) {
    context.addIssue({ code: "custom", path: ["totalBytes"], message: "Dist tree total-byte limit exceeded" });
  }
  if (value.bindingHash !== hashCanonicalRuntimeTreeBindingV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["bindingHash"],
      message: "Dist tree binding hash must bind the exact bounded tree summary",
    });
  }
});

export const CanonicalRuntimeDependencyTreeBindingCandidateV2Schema = z.object({
  ...CanonicalRuntimeTreeBindingCommonV2Shape,
  profile: z.literal("dependencies"),
  rootLocator: z.literal("payload/node_modules"),
}).strict().superRefine((value, context) => {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  if (value.fileCount > limits.maxFiles) {
    context.addIssue({ code: "custom", path: ["fileCount"], message: "Dependency tree file limit exceeded" });
  }
  if (value.directoryCount > limits.maxDirectories) {
    context.addIssue({ code: "custom", path: ["directoryCount"], message: "Dependency tree directory limit exceeded" });
  }
  if (value.totalBytes > limits.maxTotalBytes) {
    context.addIssue({ code: "custom", path: ["totalBytes"], message: "Dependency tree total-byte limit exceeded" });
  }
  if (value.bindingHash !== hashCanonicalRuntimeTreeBindingV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["bindingHash"],
      message: "Dependency tree binding hash must bind the exact bounded tree summary",
    });
  }
});

export type CanonicalRuntimeDependencyTreeBindingCandidateV2 = z.infer<
  typeof CanonicalRuntimeDependencyTreeBindingCandidateV2Schema
>;

export const CanonicalRuntimeTreeBindingCandidateV2Schema = z.discriminatedUnion("profile", [
  CanonicalRuntimeDistTreeBindingCandidateV2Schema,
  CanonicalRuntimeDependencyTreeBindingCandidateV2Schema,
]);

export type CanonicalRuntimeTreeBindingCandidateV2 = z.infer<
  typeof CanonicalRuntimeTreeBindingCandidateV2Schema
>;

export const ExactBundledPackageJsonRefV2Schema = z.object({
  schema: z.literal(EXACT_BUNDLED_FILE_REF_V2_SCHEMA),
  locator: z.literal("payload/package.json"),
  mediaType: z.literal("application/json"),
  hash: Sha256Schema,
  byteLength: z.number().int().positive().max(PLATFORM_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2),
  mode: z.literal("0444"),
}).strict();

export type ExactBundledPackageJsonRefV2 = z.infer<
  typeof ExactBundledPackageJsonRefV2Schema
>;

export const ReleaseLayoutV2Schema = z.object({
  schema: z.literal(RELEASE_LAYOUT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  rootMode: z.literal("0555"),
  allowedRootEntries: z.tuple([
    z.literal("PLATFORM_RELEASE_MANIFEST.v2.json"),
    z.literal("payload"),
  ]),
  manifest: z.object({
    locator: z.literal("PLATFORM_RELEASE_MANIFEST.v2.json"),
    kind: z.literal("file"),
    mode: z.literal("0444"),
    placement: z.literal("adjacent_to_payload"),
  }).strict(),
  runtimePayload: z.object({
    locator: z.literal("payload"),
    kind: z.literal("directory"),
    mode: z.literal("0555"),
  }).strict(),
}).strict();

export type ReleaseLayoutV2 = z.infer<typeof ReleaseLayoutV2Schema>;

export const RuntimePayloadLayoutV2Schema = z.object({
  schema: z.literal(RUNTIME_PAYLOAD_LAYOUT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  rootLocator: z.literal("payload"),
  rootMode: z.literal("0555"),
  allowedRootEntries: z.tuple([
    z.literal("dist"),
    z.literal("node_modules"),
    z.literal("package.json"),
  ]),
  platformTreeRoot: z.object({
    locator: z.literal("payload/dist"),
    kind: z.literal("directory"),
    mode: z.literal("0555"),
    profile: z.literal("dist"),
  }).strict(),
  dependencyTreeRoot: z.object({
    locator: z.literal("payload/node_modules"),
    kind: z.literal("directory"),
    mode: z.literal("0555"),
    profile: z.literal("dependencies"),
  }).strict(),
  packageJsonFile: z.object({
    locator: z.literal("payload/package.json"),
    kind: z.literal("file"),
    mode: z.literal("0444"),
  }).strict(),
}).strict();

export type RuntimePayloadLayoutV2 = z.infer<typeof RuntimePayloadLayoutV2Schema>;

export const PlatformRuntimePayloadOwnershipV2Schema = z.object({
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  runtimeUid: z.number().int().positive().max(4_294_967_294),
  runtimeMustNotOwnRelease: z.literal(true),
  rootMode: z.literal("0555"),
}).strict().superRefine((value, context) => {
  if (value.ownerUid === value.runtimeUid) {
    context.addIssue({
      code: "custom",
      path: ["runtimeUid"],
      message: "Runtime UID must differ from the release-owner UID",
    });
  }
});

export type PlatformRuntimePayloadOwnershipV2 = z.infer<
  typeof PlatformRuntimePayloadOwnershipV2Schema
>;

export const RELEASE_LAYOUT_V2 = deepFreezePlatformReleaseJsonV2(ReleaseLayoutV2Schema.parse({
  schema: RELEASE_LAYOUT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  rootMode: "0555",
  allowedRootEntries: ["PLATFORM_RELEASE_MANIFEST.v2.json", "payload"],
  manifest: {
    locator: "PLATFORM_RELEASE_MANIFEST.v2.json",
    kind: "file",
    mode: "0444",
    placement: "adjacent_to_payload",
  },
  runtimePayload: { locator: "payload", kind: "directory", mode: "0555" },
}));

export const RUNTIME_PAYLOAD_LAYOUT_V2 = deepFreezePlatformReleaseJsonV2(
  RuntimePayloadLayoutV2Schema.parse({
    schema: RUNTIME_PAYLOAD_LAYOUT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    rootLocator: "payload",
    rootMode: "0555",
    allowedRootEntries: ["dist", "node_modules", "package.json"],
    platformTreeRoot: {
      locator: "payload/dist",
      kind: "directory",
      mode: "0555",
      profile: "dist",
    },
    dependencyTreeRoot: {
      locator: "payload/node_modules",
      kind: "directory",
      mode: "0555",
      profile: "dependencies",
    },
    packageJsonFile: { locator: "payload/package.json", kind: "file", mode: "0444" },
  }),
);

const PlatformRuntimePayloadIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  layout: RuntimePayloadLayoutV2Schema,
  rootLocator: z.literal("payload"),
  allowedRootEntries: z.tuple([
    z.literal("dist"),
    z.literal("node_modules"),
    z.literal("package.json"),
  ]),
  platformTree: CanonicalRuntimeDistTreeBindingCandidateV2Schema,
  dependencyTree: CanonicalRuntimeDependencyTreeBindingCandidateV2Schema,
  packageJson: ExactBundledPackageJsonRefV2Schema,
  ownership: PlatformRuntimePayloadOwnershipV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.layout.rootLocator !== value.rootLocator
    || value.layout.allowedRootEntries.some((entry, index) =>
      entry !== value.allowedRootEntries[index])
    || value.layout.platformTreeRoot.locator !== value.platformTree.rootLocator
    || value.layout.platformTreeRoot.profile !== value.platformTree.profile
    || value.layout.dependencyTreeRoot.locator !== value.dependencyTree.rootLocator
    || value.layout.dependencyTreeRoot.profile !== value.dependencyTree.profile
    || value.layout.packageJsonFile.locator !== value.packageJson.locator
    || value.layout.packageJsonFile.mode !== value.packageJson.mode
    || value.layout.rootMode !== value.ownership.rootMode
  ) {
    context.addIssue({
      code: "custom",
      path: ["layout"],
      message: "Runtime payload fields must be exact projections of RuntimePayloadLayoutV2",
    });
  }
});

export type PlatformRuntimePayloadHashPayloadV2 = z.infer<
  typeof PlatformRuntimePayloadIdentityV2Schema
>;

export function hashPlatformRuntimePayloadV2(
  value: PlatformRuntimePayloadHashPayloadV2 | PlatformRuntimePayloadCandidateV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.runtimePayloadHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-runtime-payload-binding-payload.v2",
    runtimePayload: payload,
  });
}

export const PlatformRuntimePayloadCandidateV2Schema = PlatformRuntimePayloadIdentityV2Schema.extend({
  runtimePayloadHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    value,
    PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES,
  )) {
    context.addIssue({
      code: "custom",
      message: `Runtime payload candidate exceeds ${PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES} canonical bytes`,
    });
    return;
  }
  if (value.runtimePayloadHash !== hashPlatformRuntimePayloadV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["runtimePayloadHash"],
      message: "Runtime payload hash must bind the exact domain-separated payload summary",
    });
  }
});

export type PlatformRuntimePayloadCandidateV2 = z.infer<
  typeof PlatformRuntimePayloadCandidateV2Schema
>;

export function parsePlatformRuntimePayloadCandidateV2(
  input: unknown,
): PlatformRuntimePayloadCandidateV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformRuntimePayloadCandidateV2Schema.parse(snapshot),
  );
}
