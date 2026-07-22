import { z } from "zod";

import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
  PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
} from "../../product-compiler/schemas/executable-invocation-transport-binding-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
  CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CandidateRuntimeApplicationTreeBindingV2Schema,
  CandidateRuntimeSourceBindingV2Schema,
} from "./candidate-runtime-bundle-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
} from "./canonical-runtime-tree-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  PlatformReleaseVersionIdentityV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANDIDATE_LAUNCH_TARGET_V2_SCHEMA =
  "setfarm.candidate-launch-target.v2" as const;
export const CANDIDATE_BUNDLED_APPLICATION_MODULE_REF_V2_SCHEMA =
  "setfarm.candidate-bundled-application-module-ref.v2" as const;
export const CANDIDATE_NODE_ESM_CLI_TARGET_V2_SCHEMA =
  "setfarm.candidate-node-esm-cli-target.v2" as const;
export const HTTP_HANDLER_EXPORT_V2_SCHEMA =
  "setfarm.http-handler-export.v2" as const;

export const CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES = 256 * 1024;

const CandidateBundledApplicationModuleLocatorV2Schema =
  PlatformReleasePortableLocatorV2Schema.refine(
    (value) =>
      value.startsWith("candidate-bundle/application/")
      && /\.(?:js|mjs)$/u.test(value),
    "Expected one portable JavaScript module below candidate-bundle/application",
  );

const CandidateBundledApplicationModuleRefIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUNDLED_APPLICATION_MODULE_REF_V2_SCHEMA),
  logicalLocator: CandidateBundledApplicationModuleLocatorV2Schema,
  mediaType: z.literal("text/javascript"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dist.maxFileBytes),
  mode: z.enum(["0444", "0555"]),
}).strict();

export type CandidateBundledApplicationModuleRefHashPayloadV2 = z.infer<
  typeof CandidateBundledApplicationModuleRefIdentityV2Schema
>;

export function hashCandidateBundledApplicationModuleRefV2(
  value:
    | CandidateBundledApplicationModuleRefHashPayloadV2
    | CandidateBundledApplicationModuleRefV2,
): string {
  const moduleRef = { ...value } as Record<string, unknown>;
  delete moduleRef.moduleRefHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-bundled-application-module-ref-hash.v2",
    moduleRef,
  });
}

export const CandidateBundledApplicationModuleRefV2Schema =
  CandidateBundledApplicationModuleRefIdentityV2Schema.extend({
    moduleRefHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.moduleRefHash !== hashCandidateBundledApplicationModuleRefV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["moduleRefHash"],
        message: "Bundled application module ref hash must bind its exact logical module identity",
      });
    }
  });

export type CandidateBundledApplicationModuleRefV2 = z.infer<
  typeof CandidateBundledApplicationModuleRefV2Schema
>;

const CandidateNodeEsmCliTargetIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NODE_ESM_CLI_TARGET_V2_SCHEMA),
  kind: z.literal("cli"),
  module: CandidateBundledApplicationModuleRefV2Schema,
  moduleSystem: z.literal("node_esm"),
  entrypointAbi: z.literal("NODE_ESM_CLI_ENTRYPOINT_ABI_V2"),
  argvOwnership: z.literal("executable_invocation_transport_binding_v2"),
  argvLayout: z.object({
    nodeOptionTokens: z.tuple([]),
    moduleArgumentLocator: CandidateBundledApplicationModuleLocatorV2Schema,
    transportArguments: z.literal("append_after_module"),
  }).strict(),
}).strict();

export type CandidateNodeEsmCliTargetHashPayloadV2 = z.infer<
  typeof CandidateNodeEsmCliTargetIdentityV2Schema
>;

export function hashCandidateNodeEsmCliTargetV2(
  value: CandidateNodeEsmCliTargetHashPayloadV2 | CandidateNodeEsmCliTargetV2,
): string {
  const target = { ...value } as Record<string, unknown>;
  delete target.targetHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-node-esm-cli-target-hash.v2",
    target,
  });
}

export const CandidateNodeEsmCliTargetV2Schema =
  CandidateNodeEsmCliTargetIdentityV2Schema.extend({
    targetHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.argvLayout.moduleArgumentLocator !== value.module.logicalLocator) {
      context.addIssue({
        code: "custom",
        path: ["argvLayout", "moduleArgumentLocator"],
        message: "CLI argv layout must target the exact bundled module locator",
      });
    }
    if (value.targetHash !== hashCandidateNodeEsmCliTargetV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["targetHash"],
        message: "CLI target hash must bind the exact bundled module and argv ownership ABI",
      });
    }
  });

export type CandidateNodeEsmCliTargetV2 = z.infer<
  typeof CandidateNodeEsmCliTargetV2Schema
>;

const JavascriptExportNameV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u);

const HttpHandlerExportIdentityV2Schema = z.object({
  schema: z.literal(HTTP_HANDLER_EXPORT_V2_SCHEMA),
  kind: z.literal("http_handler"),
  module: CandidateBundledApplicationModuleRefV2Schema,
  exportName: JavascriptExportNameV2Schema,
  handlerAbi: z.literal("EXPRESS_REQUEST_HANDLER_ABI_V2"),
  serverOwnership: z.literal("platform_owned"),
  listenerOwnership: z.literal("platform_owned"),
  socketOwnership: z.literal("platform_owned"),
  candidateListen: z.literal("forbidden"),
}).strict();

export type HttpHandlerExportHashPayloadV2 = z.infer<
  typeof HttpHandlerExportIdentityV2Schema
>;

export function hashHttpHandlerExportV2(
  value: HttpHandlerExportHashPayloadV2 | HttpHandlerExportV2,
): string {
  const handler = { ...value } as Record<string, unknown>;
  delete handler.exportHash;
  return hashCanonicalJson({
    schema: "setfarm.http-handler-export-hash.v2",
    handler,
  });
}

export const HttpHandlerExportV2Schema = HttpHandlerExportIdentityV2Schema.extend({
  exportHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.exportHash !== hashHttpHandlerExportV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["exportHash"],
      message: "HTTP handler export hash must bind the exact module, export, ABI, and ownership policy",
    });
  }
});

export type HttpHandlerExportV2 = z.infer<typeof HttpHandlerExportV2Schema>;

const CandidateRuntimeBundleLaunchBindingIdentityV2Schema = z.object({
  runtimeBundleSchema: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA),
  runtimeBundleVersion: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_VERSION),
  runtimeBundleContractHash: z.literal(CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2),
  runtimeBundleHash: Sha256Schema,
  packetEnvelopeHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  sourceAuthority: CandidateRuntimeSourceBindingV2Schema,
  applicationTreeBinding: CandidateRuntimeApplicationTreeBindingV2Schema,
  applicationTreeBindingHash: Sha256Schema,
  applicationTreeHash: Sha256Schema,
}).strict();

type CandidateRuntimeBundleLaunchBindingHashPayloadV2 = z.infer<
  typeof CandidateRuntimeBundleLaunchBindingIdentityV2Schema
>;

export function hashCandidateRuntimeBundleLaunchBindingV2(
  value:
    | CandidateRuntimeBundleLaunchBindingHashPayloadV2
    | CandidateRuntimeBundleLaunchBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-bundle-launch-binding-hash.v2",
    binding,
  });
}

export const CandidateRuntimeBundleLaunchBindingV2Schema =
  CandidateRuntimeBundleLaunchBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.applicationTreeBindingHash !== value.applicationTreeBinding.bindingHash
      || value.applicationTreeHash !== value.applicationTreeBinding.treeHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["applicationTreeBinding"],
        message: "Runtime-bundle launch binding must join the exact application-tree binding and hash",
      });
    }
    if (value.bindingHash !== hashCandidateRuntimeBundleLaunchBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Runtime-bundle launch binding hash must bind the exact bundle and application-tree projection",
      });
    }
  });

export type CandidateRuntimeBundleLaunchBindingV2 = z.infer<
  typeof CandidateRuntimeBundleLaunchBindingV2Schema
>;

const CandidateExecutableTransportBindingCommonShape = {
  bindingSchema: z.literal(EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA),
  bindingVersion: z.literal(EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION),
  bindingHash: Sha256Schema,
  transportSchema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  transportContractHash: Sha256Schema,
} as const;

const CandidateCliExecutableTransportBindingIdentityV2Schema = z.object({
  ...CandidateExecutableTransportBindingCommonShape,
  transportKind: z.literal("cli_command"),
}).strict();

const CandidateApiExecutableTransportBindingIdentityV2Schema = z.object({
  ...CandidateExecutableTransportBindingCommonShape,
  transportKind: z.literal("http_request"),
}).strict();

export type CandidateExecutableTransportLaunchBindingHashPayloadV2 =
  | z.infer<typeof CandidateCliExecutableTransportBindingIdentityV2Schema>
  | z.infer<typeof CandidateApiExecutableTransportBindingIdentityV2Schema>;

export function hashCandidateExecutableTransportLaunchBindingV2(
  value:
    | CandidateExecutableTransportLaunchBindingHashPayloadV2
    | CandidateExecutableTransportLaunchBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.transportBindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-executable-transport-launch-binding-hash.v2",
    binding,
  });
}

const CandidateCliExecutableTransportLaunchBindingV2Schema =
  CandidateCliExecutableTransportBindingIdentityV2Schema.extend({
    transportBindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.transportBindingHash
      !== hashCandidateExecutableTransportLaunchBindingV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transportBindingHash"],
        message: "Executable transport launch binding hash must bind its exact contract projection",
      });
    }
  });

const CandidateApiExecutableTransportLaunchBindingV2Schema =
  CandidateApiExecutableTransportBindingIdentityV2Schema.extend({
    transportBindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.transportBindingHash
      !== hashCandidateExecutableTransportLaunchBindingV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transportBindingHash"],
        message: "Executable transport launch binding hash must bind its exact contract projection",
      });
    }
  });

export const CandidateExecutableTransportLaunchBindingV2Schema =
  z.discriminatedUnion("transportKind", [
    CandidateCliExecutableTransportLaunchBindingV2Schema,
    CandidateApiExecutableTransportLaunchBindingV2Schema,
  ]);

export type CandidateExecutableTransportLaunchBindingV2 = z.infer<
  typeof CandidateExecutableTransportLaunchBindingV2Schema
>;

const CandidateProfileBindingCommonShape = {
  catalogSchema: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA),
  profileSchema: z.literal(PRODUCT_DELIVERY_PROFILE_V2_SCHEMA),
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  catalogHash: Sha256Schema,
  profileHash: Sha256Schema,
} as const;

const CandidateCliProfileBindingV2Schema = z.object({
  ...CandidateProfileBindingCommonShape,
  profileId: z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
}).strict();

const CandidateApiProfileBindingV2Schema = z.object({
  ...CandidateProfileBindingCommonShape,
  profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
}).strict();

const CandidateStackPackBindingCommonShape = {
  stackPackVersion: PlatformReleaseVersionIdentityV2Schema,
  stackPackContentHash: Sha256Schema,
} as const;

const CandidateCliStackPackBindingV2Schema = z.object({
  ...CandidateStackPackBindingCommonShape,
  stackPackId: z.literal("node-cli"),
}).strict();

const CandidateApiStackPackBindingV2Schema = z.object({
  ...CandidateStackPackBindingCommonShape,
  stackPackId: z.literal("node-express-api"),
}).strict();

const CandidateLauncherBindingCommonShape = {
  launcherDefinitionHash: Sha256Schema,
  launcherModuleHash: Sha256Schema,
  launcherAbiHash: Sha256Schema,
} as const;

const CandidateCliLauncherBindingV2Schema = z.object({
  ...CandidateLauncherBindingCommonShape,
  launcherRef: z.literal("LAUNCH_NODE_CLI_V2"),
}).strict();

const CandidateApiLauncherBindingV2Schema = z.object({
  ...CandidateLauncherBindingCommonShape,
  launcherRef: z.literal("LAUNCH_NODE_EXPRESS_API_V2"),
}).strict();

const CandidateLaunchTargetCommonShape = {
  schema: z.literal(CANDIDATE_LAUNCH_TARGET_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_unverified"),
  productionUse: z.literal("forbidden"),
  packetEnvelopeHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  sourceAuthority: CandidateRuntimeSourceBindingV2Schema,
  runtimeBundle: CandidateRuntimeBundleLaunchBindingV2Schema,
} as const;

const CandidateCliLaunchTargetIdentityV2Schema = z.object({
  ...CandidateLaunchTargetCommonShape,
  kind: z.literal("cli"),
  profile: CandidateCliProfileBindingV2Schema,
  stackPack: CandidateCliStackPackBindingV2Schema,
  launcher: CandidateCliLauncherBindingV2Schema,
  executableTransport: CandidateCliExecutableTransportLaunchBindingV2Schema,
  target: CandidateNodeEsmCliTargetV2Schema,
}).strict();

const CandidateApiLaunchTargetIdentityV2Schema = z.object({
  ...CandidateLaunchTargetCommonShape,
  kind: z.literal("http_handler"),
  profile: CandidateApiProfileBindingV2Schema,
  stackPack: CandidateApiStackPackBindingV2Schema,
  launcher: CandidateApiLauncherBindingV2Schema,
  executableTransport: CandidateApiExecutableTransportLaunchBindingV2Schema,
  target: HttpHandlerExportV2Schema,
}).strict();

export type CandidateLaunchTargetHashPayloadV2 =
  | z.infer<typeof CandidateCliLaunchTargetIdentityV2Schema>
  | z.infer<typeof CandidateApiLaunchTargetIdentityV2Schema>;

export function hashCandidateLaunchTargetV2(
  value: CandidateLaunchTargetHashPayloadV2 | CandidateLaunchTargetV2,
): string {
  const target = { ...value } as Record<string, unknown>;
  delete target.launchTargetHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-launch-target-hash.v2",
    target,
  });
}

function addCandidateLaunchTargetIssuesV2(
  value: CandidateLaunchTargetHashPayloadV2 & { launchTargetHash: string },
  context: z.RefinementCtx,
): void {
  if (
    value.packetEnvelopeHash !== value.runtimeBundle.packetEnvelopeHash
    || value.buildTopologyHash !== value.runtimeBundle.buildTopologyHash
    || JSON.stringify(value.sourceAuthority)
      !== JSON.stringify(value.runtimeBundle.sourceAuthority)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeBundle"],
      message: "Candidate launch target must join the runtime bundle's exact packet, topology and content-first source authority",
    });
  }
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    value,
    CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES,
  )) {
    context.addIssue({
      code: "custom",
      message: `Candidate launch target exceeds ${CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES} canonical bytes`,
    });
    return;
  }
  if (value.launchTargetHash !== hashCandidateLaunchTargetV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["launchTargetHash"],
      message: "Candidate launch-target hash must bind the exact domain-separated candidate",
    });
  }
}

const CandidateCliLaunchTargetV2Schema =
  CandidateCliLaunchTargetIdentityV2Schema.extend({
    launchTargetHash: Sha256Schema,
  }).strict();

const CandidateApiLaunchTargetV2Schema =
  CandidateApiLaunchTargetIdentityV2Schema.extend({
    launchTargetHash: Sha256Schema,
  }).strict();

export const CandidateLaunchTargetV2Schema = z.discriminatedUnion("kind", [
  CandidateCliLaunchTargetV2Schema,
  CandidateApiLaunchTargetV2Schema,
]).superRefine(addCandidateLaunchTargetIssuesV2);

export type CandidateLaunchTargetV2 = z.infer<
  typeof CandidateLaunchTargetV2Schema
>;

export function parseCandidateLaunchTargetV2(input: unknown): CandidateLaunchTargetV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    CandidateLaunchTargetV2Schema.parse(snapshot),
  );
}
