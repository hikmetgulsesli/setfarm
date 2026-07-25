import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  ExactHostOwnedFileRefV2Schema,
  PlatformReleaseStableReferenceV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
} from "./network-isolation-negative-probe-v2.js";

export {
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  NetworkIsolationNegativeProbeReceiptV2Schema,
  hashNetworkIsolationNegativeProbeReceiptV2,
  networkIsolationNegativeProbeReceiptSchemaHashV2,
  parseNetworkIsolationNegativeProbeReceiptV2,
} from "./network-isolation-negative-probe-v2.js";

export const EVIDENCE_ENVIRONMENT_CAPSULE_V2_SCHEMA =
  "setfarm.evidence-environment-capsule.v2" as const;
export const METADATA_PROBE_AUTHORITY_V2_SCHEMA =
  "setfarm.metadata-probe-authority.v2" as const;
export const NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA =
  "setfarm.network-isolation-authority.v2" as const;
export const NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA =
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA;
export const METADATA_PROBE_RECEIPT_V2_SCHEMA =
  "setfarm.metadata-probe-receipt.v2" as const;
export const EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES = 64 * 1024;
export const EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2 =
  "ENV_SANDBOX_MACOS_V2" as const;
export const EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2 =
  "dist/execution/network-sandbox-v2.js" as const;
export const EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2 =
  "runNetworkIsolatedV2" as const;
export const EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2 =
  "EXEC_MACOS_SANDBOX_EXEC_V2" as const;

const JavascriptExportNameV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "Expected one JavaScript export name");

const MetadataProbeToolBindingV2Schema = z.object({
  executableRef: PlatformReleaseStableReferenceV2Schema,
  executableHash: Sha256Schema,
}).strict();

const MetadataProbeAuthorityIdentityV2Schema = z.object({
  schema: z.literal(METADATA_PROBE_AUTHORITY_V2_SCHEMA),
  installationScope: z.literal("root_owned_separately_installed"),
  bootstrapModule: ExactHostOwnedFileRefV2Schema,
  bootstrapExport: JavascriptExportNameV2Schema,
  xattrTool: MetadataProbeToolBindingV2Schema,
  aclTool: MetadataProbeToolBindingV2Schema,
  canonicalClearPolicyHash: Sha256Schema,
  probeReceiptSchema: z.literal(METADATA_PROBE_RECEIPT_V2_SCHEMA),
  probeReceiptSchemaHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.bootstrapModule.mode !== "0444") {
    context.addIssue({
      code: "custom",
      path: ["bootstrapModule", "mode"],
      message: "Metadata-probe bootstrap module must be a read-only host-owned file",
    });
  }
  if (value.xattrTool.executableRef === value.aclTool.executableRef) {
    context.addIssue({
      code: "custom",
      path: ["aclTool", "executableRef"],
      message: "xattr and ACL probes must bind distinct exact tool refs",
    });
  }
});

export type MetadataProbeAuthorityHashPayloadV2 = z.infer<
  typeof MetadataProbeAuthorityIdentityV2Schema
>;

export function hashMetadataProbeAuthorityV2(
  value: MetadataProbeAuthorityHashPayloadV2 | MetadataProbeAuthorityCandidateV2,
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.authorityHash;
  return hashCanonicalJson({
    schema: "setfarm.metadata-probe-authority-hash.v2",
    candidate,
  });
}

export const MetadataProbeAuthorityCandidateV2Schema =
  MetadataProbeAuthorityIdentityV2Schema.safeExtend({
    authorityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.authorityHash !== hashMetadataProbeAuthorityV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["authorityHash"],
        message: "Metadata-probe authority hash must bind the exact candidate",
      });
    }
  });

export type MetadataProbeAuthorityCandidateV2 = z.infer<
  typeof MetadataProbeAuthorityCandidateV2Schema
>;

const NetworkIsolationAuthorityIdentityV2Schema = z.object({
  schema: z.literal(NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA),
  enforcementRef: z.literal(EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2),
  wrapperModuleLocator: z.literal(EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2),
  wrapperExport: z.literal(EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2),
  wrapperModuleHash: Sha256Schema,
  sandboxExecutableRef: z.literal(EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2),
  canonicalProfileHash: Sha256Schema,
  hostRuntimeIdentityHash: Sha256Schema,
  negativeProbeReceiptSchema: z.literal(NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA),
  negativeProbeReceiptSchemaHash: z.literal(
    NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  ),
}).strict();

export type NetworkIsolationAuthorityHashPayloadV2 = z.infer<
  typeof NetworkIsolationAuthorityIdentityV2Schema
>;

export function hashNetworkIsolationAuthorityV2(
  value: NetworkIsolationAuthorityHashPayloadV2 | NetworkIsolationAuthorityCandidateV2,
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.authorityHash;
  return hashCanonicalJson({
    schema: "setfarm.network-isolation-authority-hash.v2",
    candidate,
  });
}

export const NetworkIsolationAuthorityCandidateV2Schema =
  NetworkIsolationAuthorityIdentityV2Schema.extend({
    authorityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.authorityHash !== hashNetworkIsolationAuthorityV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["authorityHash"],
        message: "Network-isolation authority hash must bind the exact candidate",
      });
    }
  });

export type NetworkIsolationAuthorityCandidateV2 = z.infer<
  typeof NetworkIsolationAuthorityCandidateV2Schema
>;

const EvidenceEnvironmentCapsuleIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_ENVIRONMENT_CAPSULE_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  childProcess: z.object({
    inheritAmbientEnvironment: z.literal(false),
    shell: z.literal("forbidden"),
    executableResolution: z.literal("manifest_exact_absolute"),
    baseEnvironment: z.object({
      CI: z.literal("true"),
      LANG: z.literal("C.UTF-8"),
      LC_ALL: z.literal("C.UTF-8"),
      NO_COLOR: z.literal("1"),
      TZ: z.literal("UTC"),
    }).strict(),
    runtimeTokens: z.tuple([
      z.literal("HOST"),
      z.literal("HOME"),
      z.literal("PORT"),
      z.literal("RUNTIME_URL"),
      z.literal("RUN_CACHE_DIR"),
      z.literal("RUN_HOME"),
      z.literal("RUN_TMPDIR"),
      z.literal("TEMP"),
      z.literal("TMP"),
      z.literal("TMPDIR"),
    ]),
    attemptScopedDirectoryMappings: z.object({
      HOME: z.literal("RUN_HOME"),
      TEMP: z.literal("RUN_TMPDIR"),
      TMP: z.literal("RUN_TMPDIR"),
      TMPDIR: z.literal("RUN_TMPDIR"),
    }).strict(),
    credentialRefs: z.tuple([]),
    cwdPolicy: z.literal("candidate_runtime_bundle_descendant_only"),
    umask: z.literal("0077"),
  }).strict(),
  network: z.object({
    mode: z.literal("loopback_only"),
    outboundInternet: z.literal("forbidden"),
    dns: z.literal("forbidden"),
    authority: NetworkIsolationAuthorityCandidateV2Schema,
  }).strict(),
  portLease: z.object({
    mode: z.literal("exclusive_socket_lease"),
    host: z.literal("127.0.0.1"),
    bandsHash: Sha256Schema,
  }).strict(),
  filesystem: z.object({
    releaseRoot: z.literal("immutable_read_only"),
    runtimeScratch: z.literal("attempt_scoped"),
    metadataProbeAuthorityHash: Sha256Schema,
  }).strict(),
}).strict();

export type EvidenceEnvironmentCapsuleHashPayloadV2 = z.infer<
  typeof EvidenceEnvironmentCapsuleIdentityV2Schema
>;

export function hashEvidenceEnvironmentCapsuleV2(
  value:
    | EvidenceEnvironmentCapsuleHashPayloadV2
    | EvidenceEnvironmentCapsuleCandidateV2,
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.environmentCapsuleHash;
  return hashCanonicalJson({
    schema: "setfarm.evidence-environment-capsule-hash.v2",
    candidate,
  });
}

export const EvidenceEnvironmentCapsuleCandidateV2Schema =
  EvidenceEnvironmentCapsuleIdentityV2Schema.extend({
    environmentCapsuleHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: `Environment capsule candidate exceeds ${EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.environmentCapsuleHash !== hashEvidenceEnvironmentCapsuleV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["environmentCapsuleHash"],
        message: "Environment capsule hash must bind the exact candidate capsule",
      });
    }
  });

export type EvidenceEnvironmentCapsuleCandidateV2 = z.infer<
  typeof EvidenceEnvironmentCapsuleCandidateV2Schema
>;

export function parseEvidenceEnvironmentCapsuleCandidateV2(
  input: unknown,
): EvidenceEnvironmentCapsuleCandidateV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    EvidenceEnvironmentCapsuleCandidateV2Schema.parse(snapshot),
  );
}
