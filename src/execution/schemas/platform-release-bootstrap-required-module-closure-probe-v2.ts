import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformReleaseModuleRefV2Schema,
  hashPlatformReleaseModuleRefV2,
  type PlatformReleaseModuleRefV2,
} from "./platform-release-module-catalogs-v2.js";
import {
  PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
  PlatformReleaseRequiredModuleRoleV2Schema,
  PlatformReleaseRequiredModuleRequirementV2Schema,
  getPlatformReleaseRequiredModuleRequirementV2,
  type PlatformReleaseRequiredModuleDefinitionV2,
  type PlatformReleaseRequiredModuleRoleV2,
  type PlatformReleaseRequiredModuleRequirementV2,
} from "./platform-release-required-module-closure-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENTRY_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-entry-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_OCCURRENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-occurrence-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MODULE_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-module-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_OCCURRENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-process-occurrence-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-closure-probe-projection-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_CANONICAL_BYTES_V2 =
  4 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_MODULE_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT_MS_V2 =
  8_000;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENVIRONMENT_POLICY_V2 =
  "deny_all_empty_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_full_required_module_closure_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PAYLOAD_BINDING_V2 =
  "typescript_source_fixture_only_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_TRUST_CONCLUSION_V2 =
  "characterization_only" as const;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);
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
const ExportV2Schema = z.object({
  name: z.string().min(1).max(160).regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u),
  kind: ExportKindV2Schema,
}).strict();
const ExportListV2Schema = z.array(ExportV2Schema)
  .min(1)
  .max(64)
  .superRefine((value, context) => {
    for (let index = 1; index < value.length; index += 1) {
      if (value[index - 1]!.name >= value[index]!.name) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: "Export names must be strictly UTF-16 sorted",
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
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_MODULE_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

const ModuleObservationV2Schema = z.object({
  stableIdentity: StableIdentityV2Schema,
  mutableFingerprint: MutableFingerprintV2Schema,
  moduleObservationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { moduleObservationHash: _hash, ...identity } = value;
  if (
    value.moduleObservationHash
      !== hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2(identity)
  ) {
    context.addIssue({
      code: "custom",
      path: ["moduleObservationHash"],
      message: "Module observation hash mismatch",
    });
  }
});

type ProcessHashInputV2 = Readonly<{
  executableRef: "NODE_RUNTIME_V2";
  executableStableIdentity: z.infer<typeof StableIdentityV2Schema>;
  executableMutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
  executableContentHash: string;
  argvHash: string;
  environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENVIRONMENT_POLICY_V2;
  shell: "forbidden";
  pid: number;
  startedAt: number;
  finishedAt: number;
  status: "exited" | "spawn_failed" | "timed_out" | "output_limit_exceeded";
  exitCode: number | null;
  signal: string | null;
  stdoutByteLength: number;
  stderrByteLength: number;
  stdoutHash: string;
  stderrHash: string;
}>;

export function hashPlatformReleaseRequiredModuleClosureProbeProcessOccurrenceV2(
  value: ProcessHashInputV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_OCCURRENCE_HASH_V2_SCHEMA,
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
    PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENVIRONMENT_POLICY_V2,
  ),
  shell: z.literal("forbidden"),
  pid: z.number().int().safe().min(-1),
  startedAt: z.number().int().nonnegative().safe(),
  finishedAt: z.number().int().nonnegative().safe(),
  status: z.enum(["exited", "spawn_failed", "timed_out", "output_limit_exceeded"]),
  exitCode: z.number().int().safe().nullable(),
  signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
  stdoutByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2),
  stderrByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2),
  stdoutHash: Sha256Schema,
  stderrHash: Sha256Schema,
  processOccurrenceHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.status === "exited" && value.exitCode === null) {
    context.addIssue({ code: "custom", path: ["exitCode"], message: "Exited process needs an exit code" });
  }
  if (value.status !== "exited" && value.exitCode !== null) {
    context.addIssue({ code: "custom", path: ["exitCode"], message: "Non-exited process cannot have an exit code" });
  }
  if (value.finishedAt < value.startedAt) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Process finished before it started" });
  }
  if (value.status === "exited" && value.pid < 0) {
    context.addIssue({ code: "custom", path: ["pid"], message: "Exited process needs a pid" });
  }
  if (value.executableContentHash !== value.executableMutableFingerprint.contentHash) {
    context.addIssue({ code: "custom", path: ["executableContentHash"], message: "Executable hash must equal its mutable content hash" });
  }
  const { processOccurrenceHash: _hash, ...identity } = value;
  if (
    value.processOccurrenceHash
      !== hashPlatformReleaseRequiredModuleClosureProbeProcessOccurrenceV2(identity)
  ) {
    context.addIssue({ code: "custom", path: ["processOccurrenceHash"], message: "Process occurrence hash mismatch" });
  }
});

type ProcessEvidenceV2 = z.infer<typeof ProcessEvidenceV2Schema>;
type ModuleObservationV2 = z.infer<typeof ModuleObservationV2Schema>;
type ExportV2 = z.infer<typeof ExportV2Schema>;

function hashExportSetV2(value: readonly ExportV2[]): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA}.export-set.v2`,
    exports: value,
  });
}
function hashExportKindSetV2(value: readonly ExportV2[]): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA}.export-kind-set.v2`,
    exports: value.map((entry) => ({ name: entry.name, kind: entry.kind })),
  });
}
function hashProjectionV2(value: Readonly<{
  moduleRefHash: string;
  requiredExportSetHash: string;
  observedExportSetHash: string;
  observedExportKindSetHash: string;
  semanticOutcome: "required_exports_loaded";
}>): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PROJECTION_HASH_V2_SCHEMA,
    ...value,
  });
}

const OccurrenceIdentityV2Schema = z.object({
  occurrenceRef: z.enum(["first", "second"]),
  moduleRef: PlatformReleaseModuleRefV2Schema,
  moduleObservation: ModuleObservationV2Schema,
  requiredExports: ExportListV2Schema,
  requiredExportSetHash: Sha256Schema,
  observedExports: ExportListV2Schema,
  observedExportSetHash: Sha256Schema,
  observedExportKindSetHash: Sha256Schema,
  semanticOutcome: z.literal("required_exports_loaded"),
  semanticProjectionHash: Sha256Schema,
  process: ProcessEvidenceV2Schema,
}).strict();

export type PlatformReleaseRequiredModuleClosureProbeOccurrenceHashPayloadV2 =
  z.infer<typeof OccurrenceIdentityV2Schema>;

export function hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const occurrence = { ...value } as Record<string, unknown>;
  delete occurrence.occurrenceHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_OCCURRENCE_HASH_V2_SCHEMA,
    occurrence,
  });
}

const OccurrenceV2Schema = OccurrenceIdentityV2Schema.extend({
  occurrenceHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.moduleRef.moduleRefHash !== hashPlatformReleaseModuleRefV2(value.moduleRef)) {
    context.addIssue({ code: "custom", path: ["moduleRef", "moduleRefHash"], message: "Occurrence module ref hash mismatch" });
  }
  if (value.requiredExportSetHash !== hashExportSetV2(value.requiredExports)) {
    context.addIssue({ code: "custom", path: ["requiredExportSetHash"], message: "Required export set hash mismatch" });
  }
  if (value.observedExportSetHash !== hashExportSetV2(value.observedExports)) {
    context.addIssue({ code: "custom", path: ["observedExportSetHash"], message: "Observed export set hash mismatch" });
  }
  if (value.observedExportKindSetHash !== hashExportKindSetV2(value.observedExports)) {
    context.addIssue({ code: "custom", path: ["observedExportKindSetHash"], message: "Observed export kind hash mismatch" });
  }
  if (value.moduleObservation.mutableFingerprint.contentHash !== value.moduleRef.contentHash
      || value.moduleObservation.mutableFingerprint.byteLength !== value.moduleRef.byteLength
      || value.moduleObservation.mutableFingerprint.mode !== value.moduleRef.mode) {
    context.addIssue({ code: "custom", path: ["moduleObservation"], message: "Module observation must join the module ref bytes" });
  }
  const required = value.requiredExports;
  const observed = value.observedExports;
  if (canonicalJsonStringify(required) !== canonicalJsonStringify(observed)) {
    context.addIssue({ code: "custom", path: ["observedExports"], message: "Observed exports must equal required exports" });
  }
  const expectedProjection = hashProjectionV2({
    moduleRefHash: value.moduleRef.moduleRefHash,
    requiredExportSetHash: value.requiredExportSetHash,
    observedExportSetHash: value.observedExportSetHash,
    observedExportKindSetHash: value.observedExportKindSetHash,
    semanticOutcome: value.semanticOutcome,
  });
  if (value.semanticProjectionHash !== expectedProjection) {
    context.addIssue({ code: "custom", path: ["semanticProjectionHash"], message: "Semantic projection hash mismatch" });
  }
  if (value.process.status !== "exited" || value.process.exitCode !== 0 || value.process.signal !== null) {
    context.addIssue({ code: "custom", path: ["process"], message: "Closure occurrence process must exit successfully" });
  }
  const { occurrenceHash: _hash, ...identity } = value;
  if (value.occurrenceHash !== hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2(identity)) {
    context.addIssue({ code: "custom", path: ["occurrenceHash"], message: "Occurrence hash mismatch" });
  }
});

export type PlatformReleaseRequiredModuleClosureProbeOccurrenceV2 = z.infer<typeof OccurrenceV2Schema>;

const EntryIdentityV2Schema = z.object({
  role: PlatformReleaseRequiredModuleRoleV2Schema,
  sourceModuleLocator: PlatformReleasePortableLocatorV2Schema.refine(
    (value) => value.startsWith("src/") && value.endsWith(".ts"),
    "Source locator must be one TypeScript module below src",
  ),
  implementationUse: z.enum([
    "bootstrap_source",
    "code_owned_definition",
    "runtime",
    "test_fixture_runtime_blocked",
  ]),
  verificationPolicy: z.enum([
    "bootstrap_source_hash_pair_v2",
    "function_exports_present_v2",
    "manifest_adapter_definition_catalog_projection_v2",
    "manifest_evidence_definition_catalog_projection_v2",
    "manifest_profile_catalog_projection_v2",
    "manifest_receipt_abi_projection_v2",
    "manifest_transport_codec_catalog_projection_v2",
    "test_fixture_only_function_exports_present_v2",
  ]),
  moduleRef: PlatformReleaseModuleRefV2Schema,
  occurrences: z.tuple([OccurrenceV2Schema, OccurrenceV2Schema]),
}).strict();

export function hashPlatformReleaseRequiredModuleClosureProbeEntryV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENTRY_HASH_V2_SCHEMA,
    entry,
  });
}

const EntryV2Schema = EntryIdentityV2Schema.extend({
  entryHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.moduleRef.moduleRefHash !== hashPlatformReleaseModuleRefV2(value.moduleRef)) {
    context.addIssue({ code: "custom", path: ["moduleRef", "moduleRefHash"], message: "Entry module ref hash mismatch" });
  }
  for (const [index, occurrence] of value.occurrences.entries()) {
    if (occurrence.moduleRef.moduleRefHash !== value.moduleRef.moduleRefHash
        || occurrence.moduleRef.moduleLocator !== value.moduleRef.moduleLocator
        || occurrence.occurrenceRef !== (["first", "second"] as const)[index]) {
      context.addIssue({ code: "custom", path: ["occurrences", index], message: "Occurrence must join its entry module and canonical role" });
    }
  }
  if (value.occurrences[0]!.semanticProjectionHash !== value.occurrences[1]!.semanticProjectionHash) {
    context.addIssue({ code: "custom", path: ["occurrences"], message: "Independent occurrences must share one semantic projection" });
  }
  if (value.occurrences[0]!.process.processOccurrenceHash === value.occurrences[1]!.process.processOccurrenceHash) {
    context.addIssue({ code: "custom", path: ["occurrences"], message: "Independent process occurrences must be distinct" });
  }
  const first = value.occurrences[0]!.moduleObservation.stableIdentity;
  const second = value.occurrences[1]!.moduleObservation.stableIdentity;
  if (first.hostIdentityHash !== second.hostIdentityHash
      || (first.device === second.device && first.inode === second.inode)) {
    context.addIssue({ code: "custom", path: ["occurrences"], message: "Module occurrences must share a host and be physically distinct" });
  }
  const { entryHash: _hash, ...identity } = value;
  if (value.entryHash !== hashPlatformReleaseRequiredModuleClosureProbeEntryV2(identity)) {
    context.addIssue({ code: "custom", path: ["entryHash"], message: "Entry hash mismatch" });
  }
});

export type PlatformReleaseRequiredModuleClosureProbeEntryV2 = z.infer<typeof EntryV2Schema>;

const ProbeIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_TRUST_CONCLUSION_V2),
  implementationScope: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_IMPLEMENTATION_SCOPE_V2),
  payloadBinding: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PAYLOAD_BINDING_V2),
  hostIdentityHash: Sha256Schema,
  challengeHash: Sha256Schema,
  requiredModuleClosure: PlatformReleaseRequiredModuleRequirementV2Schema,
  catalogHash: Sha256Schema,
  observationOutcome: z.literal("all_required_exports_loaded"),
  entries: z.array(EntryV2Schema).length(17),
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const required = getPlatformReleaseRequiredModuleRequirementV2();
  if (canonicalJsonStringify(value.requiredModuleClosure) !== canonicalJsonStringify(required)) {
    context.addIssue({ code: "custom", path: ["requiredModuleClosure"], message: "Probe must bind the exact code-owned 17-module requirement" });
  }
  const defs = required.entries;
  if (value.entries.some((entry, index) => {
    const definition = defs[index] as PlatformReleaseRequiredModuleDefinitionV2 | undefined;
    return definition === undefined
      || entry.role !== definition.role
      || entry.sourceModuleLocator !== definition.sourceModuleLocator
      || entry.implementationUse !== definition.implementationUse
      || entry.verificationPolicy !== definition.verificationPolicy
      || entry.moduleRef.moduleLocator !== definition.moduleLocator
      || canonicalJsonStringify(entry.occurrences[0]!.requiredExports) !== canonicalJsonStringify(definition.requiredExports)
      || canonicalJsonStringify(entry.occurrences[1]!.requiredExports) !== canonicalJsonStringify(definition.requiredExports);
  })) {
    context.addIssue({ code: "custom", path: ["entries"], message: "Probe entries must follow the exact zero-input role and export order" });
  }
  if (value.entries.some((entry) => entry.occurrences.some((occurrence) => occurrence.moduleObservation.stableIdentity.hostIdentityHash !== value.hostIdentityHash))) {
    context.addIssue({ code: "custom", path: ["hostIdentityHash"], message: "Every module occurrence must join one host identity" });
  }
  const firstProcess = value.entries[0]!.occurrences[0]!.process;
  const physicalKeys = new Set<string>();
  const processKeys = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    for (const [occurrenceIndex, occurrence] of entry.occurrences.entries()) {
      const process = occurrence.process;
      const stable = occurrence.moduleObservation.stableIdentity;
      const physicalKey = `${stable.hostIdentityHash}:${stable.objectKind}:${stable.device}:${stable.inode}`;
      if (physicalKeys.has(physicalKey)) {
        context.addIssue({ code: "custom", path: ["entries", index, "occurrences", occurrenceIndex, "moduleObservation", "stableIdentity"], message: "Every closure module occurrence must have one globally unique physical object identity" });
      }
      physicalKeys.add(physicalKey);
      if (processKeys.has(process.processOccurrenceHash)) {
        context.addIssue({ code: "custom", path: ["entries", index, "occurrences", occurrenceIndex, "process", "processOccurrenceHash"], message: "Every closure child process occurrence must be globally unique" });
      }
      processKeys.add(process.processOccurrenceHash);
      if (process.executableStableIdentity.hostIdentityHash !== value.hostIdentityHash
          || canonicalJsonStringify(process.executableStableIdentity) !== canonicalJsonStringify(firstProcess.executableStableIdentity)
          || canonicalJsonStringify(process.executableMutableFingerprint) !== canonicalJsonStringify(firstProcess.executableMutableFingerprint)
          || process.executableContentHash !== firstProcess.executableContentHash
          || process.argvHash !== firstProcess.argvHash) {
        context.addIssue({ code: "custom", path: ["entries", index, "occurrences", occurrenceIndex, "process"], message: "All closure processes must join one executable and argv fingerprint" });
      }
    }
  }
  if (value.catalogHash !== hashPlatformReleaseRequiredModuleClosureProbeRoleCatalogV2(required)) {
    context.addIssue({ code: "custom", path: ["catalogHash"], message: "Role catalog hash mismatch" });
  }
  const { observationHash: _hash, ...identity } = value;
  if (value.observationHash !== hashPlatformReleaseRequiredModuleClosureProbeObservationV2(identity)) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "Observation hash mismatch" });
  }
});

export type PlatformReleaseRequiredModuleClosureProbeHashPayloadV2 = z.infer<typeof ProbeIdentityV2Schema>;

export function hashPlatformReleaseRequiredModuleClosureProbeRoleCatalogV2(
  requirement: PlatformReleaseRequiredModuleRequirementV2,
): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA}.role-catalog.v2`,
    entries: requirement.entries,
  });
}

export function getPlatformReleaseRequiredModuleClosureProbeRoleCatalogV2(): readonly PlatformReleaseRequiredModuleDefinitionV2[] {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(getPlatformReleaseRequiredModuleRequirementV2().entries),
  ) as readonly PlatformReleaseRequiredModuleDefinitionV2[];
}

export function hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2(
  value: Readonly<{
    stableIdentity: z.infer<typeof StableIdentityV2Schema>;
    mutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
  }>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MODULE_OBSERVATION_HASH_V2_SCHEMA,
    stableIdentity: value.stableIdentity,
    mutableFingerprint: value.mutableFingerprint,
  });
}

export function hashPlatformReleaseRequiredModuleClosureProbeProjectionV2(
  value: Readonly<{
    moduleRefHash: string;
    requiredExportSetHash: string;
    observedExportSetHash: string;
    observedExportKindSetHash: string;
    semanticOutcome: "required_exports_loaded";
  }>,
): string {
  return hashProjectionV2(value);
}

export function hashPlatformReleaseRequiredModuleClosureProbeExportSetV2(value: readonly ExportV2[]): string {
  return hashExportSetV2(value);
}
export function hashPlatformReleaseRequiredModuleClosureProbeExportKindSetV2(value: readonly ExportV2[]): string {
  return hashExportKindSetV2(value);
}

export function hashPlatformReleaseRequiredModuleClosureProbeObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const observation = { ...value } as Record<string, unknown>;
  delete observation.observationHash;
  delete observation.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_OBSERVATION_HASH_V2_SCHEMA,
    observation,
  });
}

export function hashPlatformReleaseRequiredModuleClosureProbeV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const probe = { ...value } as Record<string, unknown>;
  delete probe.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_HASH_V2_SCHEMA,
    probe,
  });
}

export const PlatformReleaseRequiredModuleClosureProbeV2Schema =
  ProbeIdentityV2Schema.extend({
    probeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(value, PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_CANONICAL_BYTES_V2)) {
      context.addIssue({ code: "custom", message: "Closure probe exceeds its canonical byte cap" });
    }
    if (value.probeHash !== hashPlatformReleaseRequiredModuleClosureProbeV2(value)) {
      context.addIssue({ code: "custom", path: ["probeHash"], message: "Closure probe hash mismatch" });
    }
  });

export type PlatformReleaseRequiredModuleClosureProbeV2 = z.infer<typeof PlatformReleaseRequiredModuleClosureProbeV2Schema>;

export function parsePlatformReleaseRequiredModuleClosureProbeCandidateV2(
  input: unknown,
): PlatformReleaseRequiredModuleClosureProbeV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseRequiredModuleClosureProbeV2Schema.parse(snapshot),
  );
}

export type PlatformReleaseRequiredModuleClosureProbeStableIdentityV2 = z.infer<typeof StableIdentityV2Schema>;
export type PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2 = z.infer<typeof MutableFingerprintV2Schema>;
export type PlatformReleaseRequiredModuleClosureProbeProcessEvidenceV2 = ProcessEvidenceV2;
export type PlatformReleaseRequiredModuleClosureProbeExportV2 = ExportV2;
export type PlatformReleaseRequiredModuleClosureProbeModuleRefV2 = PlatformReleaseModuleRefV2;
export type PlatformReleaseRequiredModuleClosureProbeRoleV2 = PlatformReleaseRequiredModuleRoleV2;
