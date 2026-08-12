import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformReleaseModuleRefV2Schema,
  hashPlatformReleaseModuleRefV2,
} from "./platform-release-module-catalogs-v2.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-module-export-probe.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-module-export-probe-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OCCURRENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-module-export-probe-occurrence-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_STABLE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-module-export-probe-stable-projection-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2 =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TIMEOUT_MS_V2 =
  8_000;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2 =
  "exact_empty_environment_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2 =
  "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TRUST_CONCLUSION_V2 =
  "characterization_only" as const;

export function hashPlatformReleaseBootstrapModuleExportLoadObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-load-observation-hash.v2",
    observation: value,
  });
}

const moduleExportOperation =
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.find(
    (operation) =>
      operation.abiRef
        === PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
  );
if (moduleExportOperation === undefined) {
  throw new Error(
    "Code-owned module-export operation ABI is missing from the bootstrap ABI set",
  );
}
export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2 =
  moduleExportOperation.operationHash;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u, "Expected one canonical unsigned decimal");

const CanonicalModeV2Schema = z.string()
  .regex(/^[0-7]{4}$/u, "Expected one canonical four-digit mode");

const ExportKindV2Schema = z.enum([
  "function",
  "string",
  "number",
  "boolean",
  "object",
  "undefined",
  "symbol",
  "bigint",
]);

const ExportContractV2Schema = z.object({
  name: z.string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u),
  kind: ExportKindV2Schema,
}).strict();

const ExportContractListV2Schema = z.array(ExportContractV2Schema)
  .min(1)
  .max(64)
  .superRefine((value, context) => {
    for (let index = 1; index < value.length; index += 1) {
      const previous = value[index - 1]!;
      const current = value[index]!;
      if (previous.name >= current.name) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: "Module export names must be strictly UTF-16 sorted",
        });
      }
    }
  });

const StableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.literal("ordinary_file"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const MutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.literal(1),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

function hashModuleObservationV2(
  value: Readonly<{
    stableIdentity: z.infer<typeof StableIdentityV2Schema>;
    mutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-probe-module-observation-hash.v2",
    stableIdentity: value.stableIdentity,
    mutableFingerprint: value.mutableFingerprint,
  });
}

const ModuleObservationV2Schema = z.object({
  stableIdentity: StableIdentityV2Schema,
  mutableFingerprint: MutableFingerprintV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.observationHash
      !== hashModuleObservationV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Module physical observation hash mismatch",
    });
  }
});

type ModuleObservationV2 = z.infer<typeof ModuleObservationV2Schema>;

type ModuleExportProbeProcessStatusV2 =
  | "exited"
  | "spawn_failed"
  | "timed_out"
  | "output_limit_exceeded";

type ModuleExportProbeProcessHashInputV2 = Readonly<{
  executableRef: "NODE_RUNTIME_V2";
  executableStableIdentity: z.infer<typeof StableIdentityV2Schema>;
  executableContentHash: string;
  argvHash: string;
  environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2;
  shell: "forbidden";
  pid: number;
  startedAt: number;
  finishedAt: number;
  status: ModuleExportProbeProcessStatusV2;
  exitCode: number | null;
  signal: string | null;
  stdoutByteLength: number;
  stderrByteLength: number;
  stdoutHash: string;
  stderrHash: string;
}>;

export function hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2(
  value: ModuleExportProbeProcessHashInputV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-probe-process-occurrence.v2",
    ...value,
  });
}

const ProcessEvidenceV2Schema = z.object({
  executableRef: z.literal("NODE_RUNTIME_V2"),
  executableStableIdentity: StableIdentityV2Schema,
  executableMutableFingerprint: MutableFingerprintV2Schema,
  executableContentHash: Sha256Schema,
  argvHash: Sha256Schema,
  environmentPolicy: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2,
  ),
  shell: z.literal("forbidden"),
  pid: z.number().int().safe().min(-1),
  startedAt: z.number().int().nonnegative().safe(),
  finishedAt: z.number().int().nonnegative().safe(),
  status: z.enum([
    "exited",
    "spawn_failed",
    "timed_out",
    "output_limit_exceeded",
  ]),
  exitCode: z.number().int().safe().nullable(),
  signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
  stdoutByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2),
  stderrByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2),
  stdoutHash: Sha256Schema,
  stderrHash: Sha256Schema,
  processOccurrenceHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.status === "exited" && value.exitCode === null) {
    context.addIssue({
      code: "custom",
      path: ["exitCode"],
      message: "Exited module probe must carry an exit code",
    });
  }
  if (value.status !== "exited" && value.exitCode !== null) {
    context.addIssue({
      code: "custom",
      path: ["exitCode"],
      message: "Non-exited module probe cannot carry an exit code",
      });
  }
  if (value.finishedAt < value.startedAt) {
    context.addIssue({
      code: "custom",
      path: ["finishedAt"],
      message: "Module probe process cannot finish before it starts",
    });
  }
  if (value.status === "exited" && value.pid < 0) {
    context.addIssue({
      code: "custom",
      path: ["pid"],
      message: "Exited module probe must carry a process identity",
    });
  }
  if (
    value.executableContentHash
      !== value.executableMutableFingerprint.contentHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["executableContentHash"],
      message:
        "Module probe executable hash must equal its mutable fingerprint hash",
    });
  }
  const {
    processOccurrenceHash: _processOccurrenceHash,
    ...processHashInput
  } = value;
  if (
    value.processOccurrenceHash
      !== hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2(
        processHashInput,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["processOccurrenceHash"],
      message: "Module probe process occurrence hash mismatch",
    });
  }
});

export type PlatformReleaseBootstrapModuleExportProbeProcessEvidenceV2 =
  z.infer<typeof ProcessEvidenceV2Schema>;

export type PlatformReleaseBootstrapModuleExportProbeExportV2 =
  z.infer<typeof ExportContractV2Schema>;

const ModuleExportOccurrenceIdentityV2Schema = z.object({
  occurrenceRef: z.enum(["first", "second"]),
  moduleObservation: ModuleObservationV2Schema,
  observedExports: ExportContractListV2Schema,
  observedExportSetHash: Sha256Schema,
  observedExportKindSetHash: Sha256Schema,
  semanticOutcome: z.literal("required_exports_loaded"),
  semanticProjectionHash: Sha256Schema,
  process: ProcessEvidenceV2Schema,
}).strict();

type ModuleExportOccurrenceIdentityV2 = z.infer<
  typeof ModuleExportOccurrenceIdentityV2Schema
>;

function occurrenceHashV2(
  value: ModuleExportOccurrenceIdentityV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OCCURRENCE_HASH_V2_SCHEMA,
    occurrence: value,
  });
}

const ModuleExportOccurrenceV2Schema =
  ModuleExportOccurrenceIdentityV2Schema.extend({
    occurrenceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { occurrenceHash: _occurrenceHash, ...identity } = value;
    if (value.occurrenceHash !== occurrenceHashV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["occurrenceHash"],
        message: "Module export occurrence hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapModuleExportProbeOccurrenceV2 =
  z.infer<typeof ModuleExportOccurrenceV2Schema>;

function hashExportSetV2(
  exports: readonly PlatformReleaseBootstrapModuleExportProbeExportV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-probe-export-set-hash.v2",
    exports,
  });
}

function hashExportKindSetV2(
  exports: readonly PlatformReleaseBootstrapModuleExportProbeExportV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-probe-export-kind-set-hash.v2",
    exports: exports.map((entry) => ({
      name: entry.name,
      kind: entry.kind,
    })),
  });
}

function stableProjectionHashV2(
  value: Readonly<{
    moduleRefHash: string;
    requiredExportSetHash: string;
    observedExportSetHash: string;
    observedExportKindSetHash: string;
    semanticOutcome: "required_exports_loaded";
  }>,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_STABLE_PROJECTION_HASH_V2_SCHEMA,
    moduleRefHash: value.moduleRefHash,
    requiredExportSetHash: value.requiredExportSetHash,
    observedExportSetHash: value.observedExportSetHash,
    observedExportKindSetHash: value.observedExportKindSetHash,
    semanticOutcome: value.semanticOutcome,
  });
}

const ModuleExportProbeIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TRUST_CONCLUSION_V2,
  ),
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
  ),
  hostCompositionReceiptHash: Sha256Schema,
  challengeHash: Sha256Schema,
  moduleRef: PlatformReleaseModuleRefV2Schema,
  requiredExports: ExportContractListV2Schema,
  requiredExportSetHash: Sha256Schema,
  occurrences: z.tuple([
    ModuleExportOccurrenceV2Schema,
    ModuleExportOccurrenceV2Schema,
  ]),
  stableProjectionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const moduleRef = value.moduleRef;
  if (
    moduleRef.moduleRefHash
      !== hashPlatformReleaseModuleRefV2(moduleRef)
    || value.requiredExportSetHash
      !== hashExportSetV2(value.requiredExports)
    || value.occurrences[0]!.occurrenceRef !== "first"
    || value.occurrences[1]!.occurrenceRef !== "second"
    || value.occurrences[0]!.moduleObservation.stableIdentity.hostIdentityHash
      !== value.occurrences[1]!.moduleObservation.stableIdentity.hostIdentityHash
    || value.occurrences[0]!.moduleObservation.stableIdentity.device
      === value.occurrences[1]!.moduleObservation.stableIdentity.device
      && value.occurrences[0]!.moduleObservation.stableIdentity.inode
        === value.occurrences[1]!.moduleObservation.stableIdentity.inode
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Module export observations must bind one module ref, host and two distinct physical occurrences",
    });
  }

  for (const [index, occurrence] of value.occurrences.entries()) {
    const observedNames = occurrence.observedExports.map((entry) => entry.name);
    const requiredNames = value.requiredExports.map((entry) => entry.name);
    const requiredByName = new Map(
      value.requiredExports.map((entry) => [entry.name, entry.kind]),
    );
    const observedByName = new Map(
      occurrence.observedExports.map((entry) => [entry.name, entry.kind]),
    );
    const exactRequiredExports =
      observedNames.length === requiredNames.length
      && observedNames.every((name, nameIndex) => name === requiredNames[nameIndex])
      && requiredNames.every((name) => observedByName.get(name) === requiredByName.get(name));
    const expectedObservedExportSetHash = hashExportSetV2(
      occurrence.observedExports,
    );
    const expectedObservedExportKindSetHash = hashExportKindSetV2(
      occurrence.observedExports,
    );
    const expectedStableProjectionHash = stableProjectionHashV2({
      moduleRefHash: moduleRef.moduleRefHash,
      requiredExportSetHash: value.requiredExportSetHash,
      observedExportSetHash: occurrence.observedExportSetHash,
      observedExportKindSetHash: occurrence.observedExportKindSetHash,
      semanticOutcome: occurrence.semanticOutcome,
    });
    const {
      occurrenceHash: _occurrenceHash,
      ...occurrenceIdentity
    } = occurrence;
    const expectedOccurrenceHash = occurrenceHashV2(occurrenceIdentity);
    const fingerprint = occurrence.moduleObservation.mutableFingerprint;
    const contentJoin =
      fingerprint.contentHash === moduleRef.contentHash
      && fingerprint.byteLength === moduleRef.byteLength
      && fingerprint.mode === moduleRef.mode;
    if (
      !exactRequiredExports
      || occurrence.observedExportSetHash !== expectedObservedExportSetHash
      || occurrence.observedExportKindSetHash !== expectedObservedExportKindSetHash
      || occurrence.semanticProjectionHash !== expectedStableProjectionHash
      || occurrence.process.status !== "exited"
      || occurrence.process.exitCode !== 0
      || occurrence.process.signal !== null
      || !contentJoin
      || occurrence.process.stdoutByteLength >
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2
      || occurrence.process.stderrByteLength >
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2
      || expectedOccurrenceHash !== occurrence.occurrenceHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences", index],
        message:
          "Module export occurrence must bind exact exports, bytes, process success and its hash",
      });
    }
  }

  const first = value.occurrences[0]!;
  const second = value.occurrences[1]!;
  if (
    canonicalJsonStringify(first.process.executableStableIdentity)
      !== canonicalJsonStringify(second.process.executableStableIdentity)
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Module export occurrences must use one stable Node executable identity",
    });
  }
  if (
    canonicalJsonStringify(first.process.executableMutableFingerprint)
      !== canonicalJsonStringify(second.process.executableMutableFingerprint)
    || first.process.executableContentHash
      !== second.process.executableContentHash
    || first.process.argvHash !== second.process.argvHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Module export occurrences must use one stable executable and argv fingerprint",
    });
  }
  const moduleHostIdentityHash =
    first.moduleObservation.stableIdentity.hostIdentityHash;
  for (const [index, occurrence] of value.occurrences.entries()) {
    if (
      occurrence.process.executableStableIdentity.hostIdentityHash
        !== moduleHostIdentityHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences", index, "process", "executableStableIdentity"],
        message:
          "Module and Node executable observations must bind one host identity",
      });
    }
  }
  if (
    first.semanticProjectionHash !== second.semanticProjectionHash
    || first.process.processOccurrenceHash === second.process.processOccurrenceHash
    || value.stableProjectionHash !== first.semanticProjectionHash
    || value.stableProjectionHash !== second.semanticProjectionHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["stableProjectionHash"],
      message:
        "Module export stable projection must match across distinct process and physical occurrences",
    });
  }
});

export type PlatformReleaseBootstrapModuleExportProbeHashPayloadV2 = z.infer<
  typeof ModuleExportProbeIdentityV2Schema
>;

export function hashPlatformReleaseBootstrapModuleExportProbeV2(
  value:
    | PlatformReleaseBootstrapModuleExportProbeHashPayloadV2
    | PlatformReleaseBootstrapModuleExportProbeV2
    | Readonly<Record<string, unknown>>,
): string {
  const probe = { ...value } as Record<string, unknown>;
  delete probe.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_HASH_V2_SCHEMA,
    probe,
  });
}

export const PlatformReleaseBootstrapModuleExportProbeV2Schema =
  ModuleExportProbeIdentityV2Schema.extend({
    probeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_CANONICAL_BYTES_V2,
      )
      || value.probeHash
        !== hashPlatformReleaseBootstrapModuleExportProbeV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["probeHash"],
        message:
          "Module export probe must remain bounded and bind every observed field",
      });
    }
  });

export type PlatformReleaseBootstrapModuleExportProbeV2 = z.infer<
  typeof PlatformReleaseBootstrapModuleExportProbeV2Schema
>;

export function parsePlatformReleaseBootstrapModuleExportProbeCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapModuleExportProbeV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapModuleExportProbeV2Schema.parse(snapshot),
  );
}

export function hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(
  exports: readonly PlatformReleaseBootstrapModuleExportProbeExportV2[],
): string {
  return hashExportSetV2(exports);
}

export function hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2(
  exports: readonly PlatformReleaseBootstrapModuleExportProbeExportV2[],
): string {
  return hashExportKindSetV2(exports);
}

export function hashPlatformReleaseBootstrapModuleExportProbeModuleObservationV2(
  value: Readonly<{
    stableIdentity: z.infer<typeof StableIdentityV2Schema>;
    mutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
  }>,
): string {
  return hashModuleObservationV2(value);
}

export function hashPlatformReleaseBootstrapModuleExportProbeStableProjectionV2(
  value: Readonly<{
    moduleRefHash: string;
    requiredExportSetHash: string;
    observedExportSetHash: string;
    observedExportKindSetHash: string;
    semanticOutcome: "required_exports_loaded";
  }>,
): string {
  return stableProjectionHashV2(value);
}

export function hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2(
  value:
    | ModuleExportOccurrenceIdentityV2
    | PlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
): string {
  const occurrence = { ...value } as Record<string, unknown>;
  delete occurrence.occurrenceHash;
  return occurrenceHashV2(
    occurrence as ModuleExportOccurrenceIdentityV2,
  );
}

export function getPlatformReleaseBootstrapModuleExportProbeOperationAbiHashV2(): string {
  return PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2;
}
