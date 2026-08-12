import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import {
  fileURLToPath,
} from "node:url";
import path from "node:path";

import {
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
  type PlatformReleaseRequiredModuleDefinitionV2,
} from "../execution/schemas/platform-release-required-module-closure-v2.js";
import type {
  PlatformReleaseRequiredModuleClosureProbeV2,
} from "../execution/schemas/platform-release-bootstrap-required-module-closure-probe-v2.js";
import {
  buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2,
  observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2,
  PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
  type PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2,
} from "./platform-release-bootstrap-required-module-closure-probe-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_PAYLOAD_BINDING_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_SOURCE_OBSERVATION_HASH_V2_SCHEMA,
  hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionV2,
  parsePlatformReleaseRequiredModuleSemanticProjectionCandidateV2,
  type PlatformReleaseRequiredModuleSemanticProjectionEntryV2,
  type PlatformReleaseRequiredModuleSemanticProjectionExportV2,
  type PlatformReleaseRequiredModuleSemanticProjectionEvidenceV2,
  type PlatformReleaseRequiredModuleSemanticProjectionV2,
} from "../execution/schemas/platform-release-bootstrap-required-module-semantic-projection-v2.js";

import * as nodeCliBootstrap from "../execution/schemas/node-cli-launcher-v2.js";
import * as nodeExpressBootstrap from "../execution/schemas/node-express-api-launcher-v2.js";
import * as adapterCatalog from "../evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import * as evidenceCatalog from "../execution/schemas/platform-evidence-definition-catalogs-v2.js";
import * as profileCatalog from "./product-delivery-profile-catalog-v2.js";
import * as codecCatalog from "./schemas/invocation-input-transport-v2.js";
import * as codecRuntime from "./invocation-input-transport-v2.js";
import * as evaluator from "../evidence/invocation-evidence-evaluator-v2.js";
import * as launcherCli from "../execution/launchers/node-cli-v2.js";
import * as launcherHttp from "../execution/launchers/node-express-api-v2.js";
import * as network from "../execution/network-sandbox-v2.js";
import * as receiptAbi from "../evidence/schemas/evidence-receipt-v2.js";
import * as resultAbi from "../evidence/schemas/evidence-runner-v2.js";
import * as runnerCli from "../evidence/runners/cli-process-v2.js";
import * as runnerCommand from "../evidence/runners/command-v2.js";
import * as runnerHttp from "../evidence/runners/http-service-v2.js";
import * as runnerInvocationCore from "../evidence/invocation-evidence-runner-execution-v2.js";

const SOURCE_ROOT_V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAMESPACE_BY_SOURCE_LOCATOR_V2: ReadonlyMap<string, Readonly<Record<string, unknown>>> =
  new Map<string, Readonly<Record<string, unknown>>>([
    ["src/execution/schemas/node-cli-launcher-v2.ts", nodeCliBootstrap as unknown as Readonly<Record<string, unknown>>],
    ["src/execution/schemas/node-express-api-launcher-v2.ts", nodeExpressBootstrap as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/schemas/evidence-adapter-definition-catalog-v2.ts", adapterCatalog as unknown as Readonly<Record<string, unknown>>],
    ["src/execution/schemas/platform-evidence-definition-catalogs-v2.ts", evidenceCatalog as unknown as Readonly<Record<string, unknown>>],
    ["src/product-compiler/product-delivery-profile-catalog-v2.ts", profileCatalog as unknown as Readonly<Record<string, unknown>>],
    ["src/product-compiler/schemas/invocation-input-transport-v2.ts", codecCatalog as unknown as Readonly<Record<string, unknown>>],
    ["src/product-compiler/invocation-input-transport-v2.ts", codecRuntime as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/invocation-evidence-evaluator-v2.ts", evaluator as unknown as Readonly<Record<string, unknown>>],
    ["src/execution/launchers/node-cli-v2.ts", launcherCli as unknown as Readonly<Record<string, unknown>>],
    ["src/execution/launchers/node-express-api-v2.ts", launcherHttp as unknown as Readonly<Record<string, unknown>>],
    ["src/execution/network-sandbox-v2.ts", network as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/schemas/evidence-receipt-v2.ts", receiptAbi as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/schemas/evidence-runner-v2.ts", resultAbi as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/runners/cli-process-v2.ts", runnerCli as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/runners/command-v2.ts", runnerCommand as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/runners/http-service-v2.ts", runnerHttp as unknown as Readonly<Record<string, unknown>>],
    ["src/evidence/invocation-evidence-runner-execution-v2.ts", runnerInvocationCore as unknown as Readonly<Record<string, unknown>>],
  ]);

export type PlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureV2 = Readonly<{
  dispose(): void;
}>;

export class PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2 extends Error {
  constructor(readonly code: "SEMANTIC_PROJECTION_FIXTURE_HANDLE_UNAUTHENTICATED" | "SEMANTIC_PROJECTION_SOURCE_INVALID" | "SEMANTIC_PROJECTION_OBSERVATION_INVALID", message: string, options?: ErrorOptions) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2";
  }
}

type FixtureStateV2 = Readonly<{
  physicalFixture: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(code: PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2["code"], message: string, cause?: unknown): never {
  throw new PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2(code, message, cause === undefined ? undefined : { cause });
}

function sha256BytesV2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type SourceBigIntStatV2 = ReturnType<typeof lstatSync> & {
  dev: bigint;
  ino: bigint;
  uid: bigint;
  gid: bigint;
  mode: bigint;
  nlink: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};

type SourcePhysicalObservationV2 = Readonly<{
  stableIdentity: Readonly<{
    hostIdentityHash: string;
    objectKind: "ordinary_file";
    device: string;
    inode: string;
  }>;
  mutableFingerprint: Readonly<{
    ownerUid: number;
    ownerGid: number;
    mode: string;
    linkCount: number;
    byteLength: number;
    contentHash: string;
    modifiedTimeNanoseconds: string;
    changedTimeNanoseconds: string;
  }>;
  observationHash: string;
}>;

function sourceModeV2(stat: SourceBigIntStatV2): string {
  return (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0");
}

function sourceIdentityV2(stat: SourceBigIntStatV2): Readonly<{ device: string; inode: string }> {
  return Object.freeze({ device: stat.dev.toString(10), inode: stat.ino.toString(10) });
}

function sameSourceIdentityV2(left: Readonly<{ device: string; inode: string }>, right: Readonly<{ device: string; inode: string }>): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function captureSourceModuleV2(sourceModuleLocator: string, hostIdentityHash: string): SourcePhysicalObservationV2 {
  const absolutePath = path.join(SOURCE_ROOT_V2, sourceModuleLocator.slice("src/".length));
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as SourceBigIntStatV2;
    if (pathBefore.isSymbolicLink() || !pathBefore.isFile() || pathBefore.nlink < 1n || pathBefore.size <= 0n || pathBefore.size > 8n * 1024n * 1024n) {
      return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module is not one bounded regular file");
    }
    descriptor = openSync(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0));
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as SourceBigIntStatV2;
    if (!sameSourceIdentityV2(sourceIdentityV2(pathBefore), sourceIdentityV2(descriptorBefore))) {
      return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module changed between path and descriptor admission");
    }
    const byteLength = Number(descriptorBefore.size);
    const bytes = Buffer.alloc(byteLength);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < byteLength) {
      const count = readSync(descriptor, bytes, offset, byteLength - offset, offset);
      if (count <= 0) {
        bytes.fill(0);
        return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module reached EOF before its descriptor-bounded byte length");
      }
      digest.update(bytes.subarray(offset, offset + count));
      offset += count;
    }
    const eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, byteLength) !== 0) {
      bytes.fill(0);
      eof.fill(0);
      return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module grew during descriptor-bounded observation");
    }
    bytes.fill(0);
    eof.fill(0);
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as SourceBigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as SourceBigIntStatV2;
    if (!sameSourceIdentityV2(sourceIdentityV2(descriptorBefore), sourceIdentityV2(descriptorAfter))
        || !sameSourceIdentityV2(sourceIdentityV2(descriptorAfter), sourceIdentityV2(pathAfter))
        || descriptorBefore.uid !== descriptorAfter.uid
        || descriptorBefore.gid !== descriptorAfter.gid
        || descriptorBefore.mode !== descriptorAfter.mode
        || descriptorBefore.nlink !== descriptorAfter.nlink
        || descriptorBefore.size !== descriptorAfter.size
        || descriptorBefore.mtimeNs !== descriptorAfter.mtimeNs
        || descriptorBefore.ctimeNs !== descriptorAfter.ctimeNs) {
      return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module changed during descriptor-bounded observation");
    }
    const stableIdentity = Object.freeze({
      hostIdentityHash,
      objectKind: "ordinary_file" as const,
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    });
    const mutableFingerprint = Object.freeze({
      ownerUid: Number(descriptorAfter.uid),
      ownerGid: Number(descriptorAfter.gid),
      mode: sourceModeV2(descriptorAfter),
      linkCount: Number(descriptorAfter.nlink),
      byteLength: Number(descriptorAfter.size),
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
    });
    const identity = { stableIdentity, mutableFingerprint };
    return Object.freeze({
      ...identity,
      observationHash: hashCanonicalJson({
        schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_SOURCE_OBSERVATION_HASH_V2_SCHEMA,
        observation: identity,
      }),
    });
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2) throw error;
    return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Source module could not be read", error);
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function sourceExportsV2(namespace: Readonly<Record<string, unknown>>): readonly PlatformReleaseRequiredModuleSemanticProjectionExportV2[] {
  return Object.freeze(Object.keys(namespace).sort().map((name) => ({ name, kind: typeof namespace[name] }) as PlatformReleaseRequiredModuleSemanticProjectionExportV2));
}

function namespaceV2(definition: PlatformReleaseRequiredModuleDefinitionV2): Readonly<Record<string, unknown>> {
  const namespace = NAMESPACE_BY_SOURCE_LOCATOR_V2.get(definition.sourceModuleLocator);
  if (namespace === undefined) return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", `No code-owned source namespace is mapped for ${definition.role}`);
  return namespace;
}

function catalogEvidenceV2(definition: PlatformReleaseRequiredModuleDefinitionV2, namespace: Readonly<Record<string, unknown>>): PlatformReleaseRequiredModuleSemanticProjectionEvidenceV2 {
  if (definition.verificationPolicy === "manifest_adapter_definition_catalog_projection_v2") {
    const catalog = (namespace.getEvidenceAdapterDefinitionCatalogV2 as () => ReturnType<typeof adapterCatalog.getEvidenceAdapterDefinitionCatalogV2>)();
    return { kind: "manifest_catalog_projection_v2", catalogSchema: catalog.schema, catalogHash: catalog.catalogHash, catalogProjection: catalog, readiness: catalog.readiness, productionUse: catalog.productionUse, blockerCodes: [...catalog.blockerCodes] };
  }
  if (definition.verificationPolicy === "manifest_evidence_definition_catalog_projection_v2") {
    const catalog = (namespace.getPlatformEvidenceDefinitionCatalogsV2 as () => ReturnType<typeof evidenceCatalog.getPlatformEvidenceDefinitionCatalogsV2>)();
    return { kind: "manifest_catalog_projection_v2", catalogSchema: catalog.schema, catalogHash: catalog.catalogHash, catalogProjection: catalog, readiness: catalog.readiness, productionUse: catalog.productionUse, blockerCodes: [...catalog.blockerCodes] };
  }
  if (definition.verificationPolicy === "manifest_profile_catalog_projection_v2") {
    const catalog = (namespace.getProductDeliveryProfileCatalogV2 as () => ReturnType<typeof profileCatalog.getProductDeliveryProfileCatalogV2>)();
    return { kind: "manifest_catalog_projection_v2", catalogSchema: catalog.schema, catalogHash: catalog.catalogHash, catalogProjection: catalog, readiness: "shadow_blocked", productionUse: "forbidden", blockerCodes: ["SEMANTIC_PROJECTION_TEST_FIXTURE_ONLY"] };
  }
  if (definition.verificationPolicy === "manifest_transport_codec_catalog_projection_v2") {
    const catalog = (namespace.getInvocationTransportCodecCatalogV2 as () => ReturnType<typeof codecCatalog.getInvocationTransportCodecCatalogV2>)();
    const hash = (namespace.invocationTransportCodecCatalogHashV2 as () => string)();
    if (hash !== catalog.catalogHash) return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Invocation codec catalog hash function disagrees with its catalog");
    return { kind: "manifest_catalog_projection_v2", catalogSchema: catalog.schema, catalogHash: hash, catalogProjection: catalog, readiness: "shadow_blocked", productionUse: "forbidden", blockerCodes: ["SEMANTIC_PROJECTION_TEST_FIXTURE_ONLY"] };
  }
  const policy = (namespace.getEvidenceReceiptAbiPolicyV2 as () => ReturnType<typeof receiptAbi.getEvidenceReceiptAbiPolicyV2>)();
  const hash = (namespace.evidenceReceiptAbiPolicyHashV2 as () => string)();
  return { kind: "manifest_catalog_projection_v2", catalogSchema: policy.schema, catalogHash: hash, catalogProjection: policy, readiness: "shadow_blocked", productionUse: "forbidden", blockerCodes: ["SEMANTIC_PROJECTION_TEST_FIXTURE_ONLY"] };
}

function bootstrapEvidenceV2(definition: PlatformReleaseRequiredModuleDefinitionV2, namespace: Readonly<Record<string, unknown>>): PlatformReleaseRequiredModuleSemanticProjectionEvidenceV2 {
  const sourceExport = definition.role === "bootstrap_cli" ? "NODE_CLI_BOOTSTRAP_SOURCE_V2" : "NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2";
  const hashExport = definition.role === "bootstrap_cli" ? "NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2" : "NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2";
  const source = namespace[sourceExport];
  const exportedHash = namespace[hashExport];
  if (typeof source !== "string" || typeof exportedHash !== "string") return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Bootstrap source/hash exports have the wrong runtime kind");
  const sourceHash = sha256BytesV2(Buffer.from(source, "utf8"));
  if (sourceHash !== exportedHash) return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", "Bootstrap source/hash pair is not self-consistent");
  return { kind: "bootstrap_source_hash_pair_v2", sourceHash, exportedSourceHash: exportedHash, sourceByteLength: Buffer.byteLength(source, "utf8"), sourceHashMatches: true };
}

function functionEvidenceV2(definition: PlatformReleaseRequiredModuleDefinitionV2, exports: readonly PlatformReleaseRequiredModuleSemanticProjectionExportV2[]): PlatformReleaseRequiredModuleSemanticProjectionEvidenceV2 {
  const actual = new Map(exports.map((entry) => [entry.name, entry.kind]));
  const presentExports = definition.requiredExports.map((required) => {
    if (actual.get(required.name) !== required.kind) return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", `Required source export ${required.name} is absent or has the wrong kind`);
    return { name: required.name, kind: required.kind };
  });
  return { kind: "function_export_presence_v2", presentExports: [...presentExports] };
}

function buildEntryV2(definition: PlatformReleaseRequiredModuleDefinitionV2, physicalProbe: PlatformReleaseRequiredModuleClosureProbeV2): PlatformReleaseRequiredModuleSemanticProjectionEntryV2 {
  const physicalEntry = physicalProbe.entries.find((entry) => entry.role === definition.role);
  if (physicalEntry === undefined) return failV2("SEMANTIC_PROJECTION_OBSERVATION_INVALID", `Physical closure probe is missing ${definition.role}`);
  const namespace = namespaceV2(definition);
  const sourceObservationBefore = captureSourceModuleV2(definition.sourceModuleLocator, physicalProbe.hostIdentityHash);
  const sourceExports = sourceExportsV2(namespace);
  const semanticEvidence = definition.verificationPolicy === "bootstrap_source_hash_pair_v2"
    ? bootstrapEvidenceV2(definition, namespace)
    : definition.verificationPolicy === "manifest_adapter_definition_catalog_projection_v2"
      || definition.verificationPolicy === "manifest_evidence_definition_catalog_projection_v2"
      || definition.verificationPolicy === "manifest_profile_catalog_projection_v2"
      || definition.verificationPolicy === "manifest_receipt_abi_projection_v2"
      || definition.verificationPolicy === "manifest_transport_codec_catalog_projection_v2"
      ? catalogEvidenceV2(definition, namespace)
      : definition.verificationPolicy === "test_fixture_only_function_exports_present_v2"
        ? { kind: "test_fixture_runtime_blocked_v2" as const, blocker: "test_fixture_runtime_blocked" as const }
        : functionEvidenceV2(definition, sourceExports);
  const sourceObservationAfter = captureSourceModuleV2(definition.sourceModuleLocator, physicalProbe.hostIdentityHash);
  if (sourceObservationBefore.observationHash !== sourceObservationAfter.observationHash) {
    return failV2("SEMANTIC_PROJECTION_SOURCE_INVALID", `Source module ${definition.role} changed during semantic projection`);
  }
  const sourceModuleHashBefore = sourceObservationBefore.mutableFingerprint.contentHash;
  const sourceModuleHashAfter = sourceObservationAfter.mutableFingerprint.contentHash;
  const semanticEvidenceHash = hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2(semanticEvidence);
  const identity = {
    role: definition.role,
    sourceModuleLocator: definition.sourceModuleLocator,
    implementationUse: definition.implementationUse,
    verificationPolicy: definition.verificationPolicy,
    moduleRefHash: physicalEntry.moduleRef.moduleRefHash,
    sourceModuleHash: sourceModuleHashBefore,
    sourceModuleHashBefore,
    sourceModuleHashAfter,
    sourcePhysicalObservationBefore: sourceObservationBefore,
    sourcePhysicalObservationAfter: sourceObservationAfter,
    sourceExports: [...sourceExports],
    semanticEvidence,
    semanticEvidenceHash,
  };
  return { ...identity, entryHash: hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(identity) };
}

function authenticFixtureStateV2(fixture: PlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureV2): FixtureStateV2 {
  if (typeof fixture !== "object" || fixture === null) return failV2("SEMANTIC_PROJECTION_FIXTURE_HANDLE_UNAUTHENTICATED", "Semantic projection requires an authentic fixture handle");
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) return failV2("SEMANTIC_PROJECTION_FIXTURE_HANDLE_UNAUTHENTICATED", "Semantic projection fixture handle is not code-owned");
  return state;
}

export function buildPlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureForTestV2(): PlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureV2 {
  const physicalFixture = buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
  let fixture: PlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureV2;
  fixture = Object.freeze({
    dispose(): void {
      const state = fixtureStatesV2.get(fixture);
      if (state === undefined) return;
      state.physicalFixture.dispose();
      fixtureStatesV2.delete(fixture);
    },
  });
  fixtureStatesV2.set(fixture, Object.freeze({ physicalFixture }));
  return fixture;
}

export async function observePlatformReleaseBootstrapRequiredModuleSemanticProjectionForTestV2(
  fixture: PlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureV2,
  options: Readonly<{ challenge?: Uint8Array }> = {},
): Promise<PlatformReleaseRequiredModuleSemanticProjectionV2> {
  const state = authenticFixtureStateV2(fixture);
  let physicalProbe: PlatformReleaseRequiredModuleClosureProbeV2;
  try {
    physicalProbe = await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(state.physicalFixture, options);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2) {
      return failV2("SEMANTIC_PROJECTION_OBSERVATION_INVALID", "Physical closure probe did not produce a valid semantic projection input", error);
    }
    throw error;
  }
  const requirement = getPlatformReleaseRequiredModuleRequirementV2();
  const semanticEntries = requirement.entries.map((definition) => buildEntryV2(definition, physicalProbe));
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    implementationScope: "test_fixture_source_semantics_projection_v2" as const,
    payloadBinding: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_PAYLOAD_BINDING_V2,
    requiredModuleClosureProbe: physicalProbe,
    requiredModuleRequirement: requirement,
    challengeHash: physicalProbe.challengeHash,
    observationOutcome: "all_required_source_semantics_projected" as const,
    semanticEntries,
    semanticCatalogHash: hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(semanticEntries),
  };
  const observationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(identity);
  const withObservation = { ...identity, observationHash };
  return parsePlatformReleaseRequiredModuleSemanticProjectionCandidateV2({
    ...withObservation,
    probeHash: hashPlatformReleaseRequiredModuleSemanticProjectionV2(withObservation),
  });
}
