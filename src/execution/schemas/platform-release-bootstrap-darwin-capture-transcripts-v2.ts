import { createHash } from "node:crypto";
import { isProxy, isUint8Array } from "node:util/types";

import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  filesystemObjectLocatorKeyV2,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
  StableFsObjectKindV2Schema,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from "../../product-compiler/platform-release-bootstrap-physical-census-v2.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  comparePlatformReleaseUtf16V2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-capture-transcript-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-capture-transcript-header.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-directory-capture-page.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-content-capture-chunk.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-directory-capture-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-content-capture-receipt.v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2 =
  1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_HEADER_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  128 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2 = 512;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2 = 16_384;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2 = 32;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2 =
  1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2 = 4;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_OBSERVATION_ORDINALS_V2 =
  Object.freeze([0, 1] as const);

const captureContractIdentityV2 = {
  schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  headerSchemaRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
  directoryPageSchemaRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
  contentChunkSchemaRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
  directoryReceiptSchemaRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_RECEIPT_V2_SCHEMA,
  contentReceiptSchemaRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_RECEIPT_V2_SCHEMA,
  observationOrdinals: [0, 1],
  maxRecordCanonicalBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
  maxDirectoryBindingsPerPage: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  maxDirectoryTotalBindings: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
  maxDirectoryPagesPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
  maxContentRawBytesPerChunk: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
  maxContentTotalRawBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  maxContentChunksPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2,
  emptyDirectoryPolicy: "one_terminal_empty_page_per_observation_v2",
  emptyContentPolicy: "one_terminal_zero_byte_chunk_per_observation_v2",
  authorityPolicy: "serialized_transcript_never_live_slot_ledger_authority_v2",
} as const;

export function hashPlatformReleaseBootstrapDarwinCaptureTranscriptContractV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const contract = { ...value };
  delete contract.captureTranscriptContractHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-capture-transcript-contract-hash.v2",
    contract,
  });
}

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2 =
  deepFreezePlatformReleaseJsonV2({
    ...captureContractIdentityV2,
    captureTranscriptContractHash:
      hashPlatformReleaseBootstrapDarwinCaptureTranscriptContractV2(
        captureContractIdentityV2,
      ),
  });

const OpaqueSlotV2Schema = z.string().regex(/^slot_[a-f0-9]{64}$/);
const BasenameV2Schema = z.string().min(1).max(255).refine(
  (value) => value !== "." && value !== ".." && !/[\\/\0]/u.test(value),
  "Expected one exact direct-child basename",
);
const ObservationOrdinalV2Schema = z.union([z.literal(0), z.literal(1)]);

const CaptureBindingV2Schema = z.object({
  captureTranscriptContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  ),
  sessionOccurrenceHash: Sha256Schema,
  sessionSlot: OpaqueSlotV2Schema,
  beginRequestHash: Sha256Schema,
  sourceSlot: OpaqueSlotV2Schema,
  captureSlot: OpaqueSlotV2Schema,
  sourceObjectIdentity: StableFsObjectIdentityV2Schema,
  sourceFingerprint: FsObservationFingerprintV2Schema,
  objectKind: StableFsObjectKindV2Schema,
  captureOccurrenceHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinCaptureBindingInputV2 = Readonly<{
  sessionOccurrenceHash: string;
  sessionSlot: string;
  beginRequestHash: string;
  sourceSlot: string;
  captureSlot: string;
  sourceObjectIdentity: StableFsObjectIdentityV2;
  sourceFingerprint: FsObservationFingerprintV2;
  objectKind: StableFsObjectKindV2;
}>;

function hashCaptureOccurrenceV2(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-capture-occurrence-hash.v2",
    binding: value,
  });
}

function bindingWithoutOccurrenceV2(value: z.infer<typeof CaptureBindingV2Schema>) {
  return {
    captureTranscriptContractHash: value.captureTranscriptContractHash,
    sessionOccurrenceHash: value.sessionOccurrenceHash,
    sessionSlot: value.sessionSlot,
    beginRequestHash: value.beginRequestHash,
    sourceSlot: value.sourceSlot,
    captureSlot: value.captureSlot,
    sourceObjectIdentity: value.sourceObjectIdentity,
    sourceFingerprint: value.sourceFingerprint,
    objectKind: value.objectKind,
  } as const;
}

function bindingRelationsHoldV2(
  value: z.infer<typeof CaptureBindingV2Schema>,
): boolean {
  return value.sessionSlot !== value.sourceSlot
    && value.sessionSlot !== value.captureSlot
    && value.sourceSlot !== value.captureSlot
    && value.sourceObjectIdentity.objectKind === value.objectKind
    && value.sourceFingerprint.objectIdentityHash
      === value.sourceObjectIdentity.objectIdentityHash
    && value.captureOccurrenceHash
      === hashCaptureOccurrenceV2(bindingWithoutOccurrenceV2(value));
}

function addBindingIssueV2(
  value: z.infer<typeof CaptureBindingV2Schema>,
  context: z.RefinementCtx,
): void {
  if (!bindingRelationsHoldV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["captureOccurrenceHash"],
      message: "Capture binding must join one distinct-slot physical occurrence",
    });
  }
}

const DirectoryMemberBindingV2Schema = z.object({
  membershipIndex: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2 - 1,
  ),
  basename: BasenameV2Schema,
  objectKind: StableFsObjectKindV2Schema,
  memberSlot: OpaqueSlotV2Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
}).strict();

const DirectoryMemberBindingBuildInputV2Schema = z.object({
  basename: BasenameV2Schema,
  objectKind: StableFsObjectKindV2Schema,
  memberSlot: OpaqueSlotV2Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2 =
  z.infer<typeof DirectoryMemberBindingV2Schema>;

const DirectoryPageIdentityV2Schema = CaptureBindingV2Schema.extend({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  transcriptKind: z.literal("directory_membership"),
  observationOrdinal: ObservationOrdinalV2Schema,
  pageIndex: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2 - 1,
  ),
  pageCount: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
  ),
  startIndex: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
  ),
  entryCount: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  ),
  totalEntryCount: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
  ),
  orderedEntries: z.array(DirectoryMemberBindingV2Schema).max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  ),
  priorPageHash: Sha256Schema.nullable(),
  semanticMembershipHash: Sha256Schema,
  bindingAggregateHash: Sha256Schema,
  semanticRollingHash: Sha256Schema,
  bindingRollingHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseBootstrapDarwinDirectoryCapturePageV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const page = { ...value };
  delete page.pageHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-directory-capture-page-hash.v2",
    page,
  });
}

export const PlatformReleaseBootstrapDarwinDirectoryCapturePageV2Schema =
  DirectoryPageIdentityV2Schema.extend({ pageHash: Sha256Schema }).strict()
    .superRefine((value, context) => {
      addBindingIssueV2(value, context);
      if (
        value.objectKind !== "directory"
        || value.entryCount !== value.orderedEntries.length
        || !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
        )
        || value.pageHash
          !== hashPlatformReleaseBootstrapDarwinDirectoryCapturePageV2(value)
      ) {
        context.addIssue({ code: "custom", message: "Directory page is not one exact bounded self-hashed record" });
      }
    });

export type PlatformReleaseBootstrapDarwinDirectoryCapturePageV2 =
  z.infer<typeof PlatformReleaseBootstrapDarwinDirectoryCapturePageV2Schema>;

const ContentChunkIdentityV2Schema = CaptureBindingV2Schema.extend({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  transcriptKind: z.literal("regular_file_content"),
  observationOrdinal: ObservationOrdinalV2Schema,
  chunkIndex: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2 - 1,
  ),
  chunkCount: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2,
  ),
  byteOffset: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  ),
  chunkByteLength: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
  ),
  totalByteLength: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  ),
  contentBase64: z.string().max(
    Math.ceil(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2 / 3) * 4,
  ),
  rawChunkHash: Sha256Schema,
  priorChunkHash: Sha256Schema.nullable(),
  fullContentHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseBootstrapDarwinContentCaptureChunkV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const chunk = { ...value };
  delete chunk.chunkHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-content-capture-chunk-hash.v2",
    chunk,
  });
}

function decodeCanonicalBase64V2(value: string): Buffer | undefined {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    return undefined;
  }
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : undefined;
}

export const PlatformReleaseBootstrapDarwinContentCaptureChunkV2Schema =
  ContentChunkIdentityV2Schema.extend({ chunkHash: Sha256Schema }).strict()
    .superRefine((value, context) => {
      addBindingIssueV2(value, context);
      const raw = decodeCanonicalBase64V2(value.contentBase64);
      if (
        value.objectKind !== "ordinary_file"
        || raw === undefined
        || raw.byteLength !== value.chunkByteLength
        || createHash("sha256").update(raw).digest("hex") !== value.rawChunkHash
        || !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
        )
        || value.chunkHash
          !== hashPlatformReleaseBootstrapDarwinContentCaptureChunkV2(value)
      ) {
        context.addIssue({ code: "custom", message: "Content chunk is not one exact bounded canonical record" });
      }
    });

export type PlatformReleaseBootstrapDarwinContentCaptureChunkV2 =
  z.infer<typeof PlatformReleaseBootstrapDarwinContentCaptureChunkV2Schema>;

const TranscriptHeaderIdentityV2Schema = CaptureBindingV2Schema.extend({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  transcriptKind: z.enum(["directory_membership", "regular_file_content"]),
  observationCount: z.literal(2),
  recordsPerObservation: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
  ),
  totalUnitCount: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  ),
  semanticAggregateHash: Sha256Schema,
  bindingAggregateHash: Sha256Schema,
  firstTerminalRecordHash: Sha256Schema,
  secondTerminalRecordHash: Sha256Schema,
  terminalCommitmentHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const header = { ...value };
  delete header.headerHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-capture-transcript-header-hash.v2",
    header,
  });
}

export const PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2Schema =
  TranscriptHeaderIdentityV2Schema.extend({ headerHash: Sha256Schema }).strict()
    .superRefine((value, context) => {
      addBindingIssueV2(value, context);
      if (
        (value.transcriptKind === "regular_file_content"
          && (value.objectKind !== "ordinary_file"
            || value.recordsPerObservation > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2
            || value.totalUnitCount > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2))
        || (value.transcriptKind === "directory_membership"
          && (value.objectKind !== "directory"
            || value.totalUnitCount > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2))
        || !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_HEADER_MAX_CANONICAL_BYTES_V2,
        )
        || value.headerHash !== hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(value)
      ) {
        context.addIssue({ code: "custom", message: "Capture header is not one exact bounded self-hashed record" });
      }
    });

export type PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2 =
  z.infer<typeof PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2Schema>;

function parseBoundedRecordV2<T>(input: unknown, schema: z.ZodType<T>, maxBytes: number): T {
  return deepFreezePlatformReleaseJsonV2(schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(input, maxBytes),
  ));
}

function exactArrayDataValuesV2(input: unknown, maximumLength: number): unknown[] {
  if (
    !Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Array.prototype
    || input.length > maximumLength
  ) {
    throw new TypeError("Capture record list must be one bounded non-proxied array");
  }
  const expectedKeys = new Set<string>(["length"]);
  for (let index = 0; index < input.length; index += 1) {
    expectedKeys.add(String(index));
  }
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== expectedKeys.size
    || ownKeys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    throw new TypeError("Capture record list must contain only its exact indexed data properties");
  }
  const values: unknown[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError("Capture record list entries must be enumerable data properties");
    }
    values.push(descriptor.value);
  }
  return values;
}

export function parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2(input: unknown) {
  return parseBoundedRecordV2(input, PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2Schema, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_HEADER_MAX_CANONICAL_BYTES_V2);
}

export function parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2(input: unknown) {
  return parseBoundedRecordV2(input, PlatformReleaseBootstrapDarwinDirectoryCapturePageV2Schema, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2);
}

export function parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2(input: unknown) {
  return parseBoundedRecordV2(input, PlatformReleaseBootstrapDarwinContentCaptureChunkV2Schema, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2);
}

function commonBindingFromInputV2(
  input: PlatformReleaseBootstrapDarwinCaptureBindingInputV2,
): z.infer<typeof CaptureBindingV2Schema> {
  const parsedInput = z.object({
    sessionOccurrenceHash: Sha256Schema,
    sessionSlot: OpaqueSlotV2Schema,
    beginRequestHash: Sha256Schema,
    sourceSlot: OpaqueSlotV2Schema,
    captureSlot: OpaqueSlotV2Schema,
    sourceObjectIdentity: StableFsObjectIdentityV2Schema,
    sourceFingerprint: FsObservationFingerprintV2Schema,
    objectKind: StableFsObjectKindV2Schema,
  }).strict().parse(boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_HEADER_MAX_CANONICAL_BYTES_V2,
  ));
  const identity = {
    captureTranscriptContractHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    ...parsedInput,
  } as const;
  return CaptureBindingV2Schema.parse({
    ...identity,
    captureOccurrenceHash: hashCaptureOccurrenceV2(identity),
  });
}

function sameCommonBindingV2(
  left: z.infer<typeof CaptureBindingV2Schema>,
  right: z.infer<typeof CaptureBindingV2Schema>,
): boolean {
  return left.captureOccurrenceHash === right.captureOccurrenceHash
    && hashCanonicalJson(bindingWithoutOccurrenceV2(left))
      === hashCanonicalJson(bindingWithoutOccurrenceV2(right));
}

function directorySemanticRollingV2(
  previous: string | null,
  entries: readonly PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2[],
  totalEntryCount: number,
): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-directory-semantic-rolling-hash.v2",
    previous,
    totalEntryCount,
    entries: entries.map(({ membershipIndex, basename, objectKind }) => ({ membershipIndex, basename, objectKind })),
  });
}

function directoryBindingRollingV2(
  previous: string | null,
  entries: readonly PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2[],
  totalEntryCount: number,
): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-directory-binding-rolling-hash.v2",
    previous,
    totalEntryCount,
    entries,
  });
}

function terminalCommitmentV2(
  kind: "directory_membership" | "regular_file_content",
  common: z.infer<typeof CaptureBindingV2Schema>,
  count: number,
  semanticAggregateHash: string,
  bindingAggregateHash: string,
  firstTerminalRecordHash: string,
  secondTerminalRecordHash: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-capture-terminal-commitment-hash.v2",
    kind,
    captureOccurrenceHash: common.captureOccurrenceHash,
    count,
    semanticAggregateHash,
    bindingAggregateHash,
    firstTerminalRecordHash,
    secondTerminalRecordHash,
  });
}

export type PlatformReleaseBootstrapDarwinDirectoryCaptureBuildInputV2 = Readonly<{
  binding: PlatformReleaseBootstrapDarwinCaptureBindingInputV2;
  orderedEntries: readonly Omit<PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2, "membershipIndex">[];
}>;

export function buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
  input: PlatformReleaseBootstrapDarwinDirectoryCaptureBuildInputV2,
): Readonly<{
  header: PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2;
  pages: readonly PlatformReleaseBootstrapDarwinDirectoryCapturePageV2[];
}> {
  if (typeof input !== "object" || input === null || isProxy(input)) {
    throw new TypeError("Directory capture input must be one ordinary object");
  }
  const bindingDescriptor = Object.getOwnPropertyDescriptor(input, "binding");
  const entriesDescriptor = Object.getOwnPropertyDescriptor(input, "orderedEntries");
  if (bindingDescriptor === undefined || !("value" in bindingDescriptor) || entriesDescriptor === undefined || !("value" in entriesDescriptor)) {
    throw new TypeError("Directory capture input properties must be data properties");
  }
  const common = commonBindingFromInputV2(bindingDescriptor.value as PlatformReleaseBootstrapDarwinCaptureBindingInputV2);
  const orderedEntries = entriesDescriptor.value as readonly Omit<PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2, "membershipIndex">[];
  if (common.objectKind !== "directory" || !Array.isArray(orderedEntries) || isProxy(orderedEntries)) {
    throw new TypeError("Directory capture requires one ordinary code-owned entries array");
  }
  if (orderedEntries.length > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2) {
    throw new RangeError("Directory capture exceeds its total member bound");
  }
  const rawEntries = exactArrayDataValuesV2(
    orderedEntries,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
  );
  const entries = rawEntries.map((entry, membershipIndex) => {
    const parsedEntry = DirectoryMemberBindingBuildInputV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        entry,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_HEADER_MAX_CANONICAL_BYTES_V2,
      ),
    );
    return DirectoryMemberBindingV2Schema.parse({ ...parsedEntry, membershipIndex });
  });
  const pageCount = Math.max(1, Math.ceil(entries.length / PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2));
  let semanticRolling: string | null = null;
  let bindingRolling: string | null = null;
  const pageParts: Array<Readonly<{
    startIndex: number;
    orderedEntries: readonly PlatformReleaseBootstrapDarwinDirectoryMemberBindingV2[];
    semanticRollingHash: string;
    bindingRollingHash: string;
  }>> = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const startIndex = pageIndex * PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2;
    const pageEntries = entries.slice(startIndex, startIndex + PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2);
    semanticRolling = directorySemanticRollingV2(semanticRolling, pageEntries, entries.length);
    bindingRolling = directoryBindingRollingV2(bindingRolling, pageEntries, entries.length);
    pageParts.push({ startIndex, orderedEntries: pageEntries, semanticRollingHash: semanticRolling, bindingRollingHash: bindingRolling });
  }
  const semanticMembershipHash = semanticRolling!;
  const bindingAggregateHash = bindingRolling!;
  const pages: PlatformReleaseBootstrapDarwinDirectoryCapturePageV2[] = [];
  const terminalHashes: string[] = [];
  for (const observationOrdinal of PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_OBSERVATION_ORDINALS_V2) {
    let priorPageHash: string | null = null;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const part = pageParts[pageIndex]!;
      const identity = {
        ...common,
        schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
        version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
        transcriptKind: "directory_membership",
        observationOrdinal,
        pageIndex,
        pageCount,
        startIndex: part.startIndex,
        entryCount: part.orderedEntries.length,
        totalEntryCount: entries.length,
        orderedEntries: part.orderedEntries,
        priorPageHash,
        semanticMembershipHash,
        bindingAggregateHash,
        semanticRollingHash: part.semanticRollingHash,
        bindingRollingHash: part.bindingRollingHash,
      } as const;
      const page = parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2({
        ...identity,
        pageHash: hashPlatformReleaseBootstrapDarwinDirectoryCapturePageV2(identity),
      });
      pages.push(page);
      priorPageHash = page.pageHash;
    }
    terminalHashes.push(priorPageHash!);
  }
  const terminalCommitmentHash = terminalCommitmentV2("directory_membership", common, entries.length, semanticMembershipHash, bindingAggregateHash, terminalHashes[0]!, terminalHashes[1]!);
  const headerIdentity = {
    ...common,
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    transcriptKind: "directory_membership",
    observationCount: 2,
    recordsPerObservation: pageCount,
    totalUnitCount: entries.length,
    semanticAggregateHash: semanticMembershipHash,
    bindingAggregateHash,
    firstTerminalRecordHash: terminalHashes[0]!,
    secondTerminalRecordHash: terminalHashes[1]!,
    terminalCommitmentHash,
  } as const;
  const header = parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2({
    ...headerIdentity,
    headerHash: hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(headerIdentity),
  });
  return deepFreezePlatformReleaseJsonV2({ header, pages });
}

const DirectoryReceiptV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionAuthority: z.literal(false),
  captureOccurrenceHash: Sha256Schema,
  headerHash: Sha256Schema,
  totalEntryCount: z.number().int().nonnegative().max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2),
  semanticMembershipHash: Sha256Schema,
  bindingAggregateHash: Sha256Schema,
  terminalCommitmentHash: Sha256Schema,
  receiptHash: Sha256Schema,
}).strict();

export function verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
  headerCandidate: unknown,
  pageCandidates: readonly unknown[],
) {
  const header = parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2(headerCandidate);
  const expectedPageCount = Math.max(1, Math.ceil(
    header.totalUnitCount / PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  ));
  if (header.transcriptKind !== "directory_membership" || header.recordsPerObservation !== expectedPageCount) {
    throw new TypeError("Directory capture transcript has the wrong record envelope");
  }
  const pages = exactArrayDataValuesV2(
    pageCandidates,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2 * 2,
  ).map(parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2);
  if (pages.length !== header.recordsPerObservation * 2) throw new TypeError("Directory capture transcript has the wrong record count");
  const globalSlots = new Set<string>();
  const globalLocators = new Set<string>();
  const sourceLocator = filesystemObjectLocatorKeyV2(
    header.sourceObjectIdentity,
  );
  let firstSemantic: string | undefined;
  let firstBinding: string | undefined;
  for (const ordinal of PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_OBSERVATION_ORDINALS_V2) {
    let priorPageHash: string | null = null;
    let semanticRolling: string | null = null;
    let bindingRolling: string | null = null;
    let previousBasename: string | undefined;
    const ordinalSlots = new Set<string>();
    const ordinalLocators = new Set<string>();
    for (let pageIndex = 0; pageIndex < header.recordsPerObservation; pageIndex += 1) {
      const page = pages[(ordinal * header.recordsPerObservation) + pageIndex]!;
      const expectedEntryCount = Math.min(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
        header.totalUnitCount - page.startIndex,
      );
      if (!sameCommonBindingV2(header, page) || page.observationOrdinal !== ordinal || page.pageIndex !== pageIndex || page.pageCount !== header.recordsPerObservation || page.startIndex !== pageIndex * PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2 || page.entryCount !== expectedEntryCount || page.totalEntryCount !== header.totalUnitCount || page.priorPageHash !== priorPageHash || (header.totalUnitCount === 0 && (page.pageCount !== 1 || page.entryCount !== 0))) {
        throw new TypeError("Directory capture page sequence is not exact");
      }
      for (let localIndex = 0; localIndex < page.orderedEntries.length; localIndex += 1) {
        const entry = page.orderedEntries[localIndex]!;
        const locator = filesystemObjectLocatorKeyV2(entry.objectIdentity);
        if (entry.membershipIndex !== page.startIndex + localIndex || entry.objectKind !== entry.objectIdentity.objectKind || entry.objectIdentity.filesystemScopeIdentityHash !== header.sourceObjectIdentity.filesystemScopeIdentityHash || entry.objectIdentity.device !== header.sourceObjectIdentity.device || locator === sourceLocator || entry.memberSlot === header.sessionSlot || entry.memberSlot === header.sourceSlot || entry.memberSlot === header.captureSlot || ordinalSlots.has(entry.memberSlot) || ordinalLocators.has(locator) || (previousBasename !== undefined && comparePlatformReleaseUtf16V2(previousBasename, entry.basename) >= 0)) {
          throw new TypeError("Directory capture member binding is aliased, unordered, or physically rebound");
        }
        ordinalSlots.add(entry.memberSlot);
        ordinalLocators.add(locator);
        previousBasename = entry.basename;
      }
      semanticRolling = directorySemanticRollingV2(semanticRolling, page.orderedEntries, header.totalUnitCount);
      bindingRolling = directoryBindingRollingV2(bindingRolling, page.orderedEntries, header.totalUnitCount);
      if (page.semanticRollingHash !== semanticRolling || page.bindingRollingHash !== bindingRolling || page.semanticMembershipHash !== header.semanticAggregateHash || page.bindingAggregateHash !== header.bindingAggregateHash) {
        throw new TypeError("Directory capture rolling commitment mismatch");
      }
      priorPageHash = page.pageHash;
    }
    if (priorPageHash !== (ordinal === 0 ? header.firstTerminalRecordHash : header.secondTerminalRecordHash) || semanticRolling !== header.semanticAggregateHash || bindingRolling !== header.bindingAggregateHash) {
      throw new TypeError("Directory capture terminal commitment mismatch");
    }
    if (ordinal === 0) {
      firstSemantic = semanticRolling!;
      firstBinding = bindingRolling!;
      for (const slot of ordinalSlots) globalSlots.add(slot);
      for (const locator of ordinalLocators) globalLocators.add(locator);
    } else if (semanticRolling !== firstSemantic || bindingRolling !== firstBinding || ordinalSlots.size !== globalSlots.size || ordinalLocators.size !== globalLocators.size || [...ordinalSlots].some((slot) => !globalSlots.has(slot)) || [...ordinalLocators].some((locator) => !globalLocators.has(locator))) {
      throw new TypeError("Directory capture observations disagree");
    }
  }
  if (header.terminalCommitmentHash !== terminalCommitmentV2("directory_membership", header, header.totalUnitCount, header.semanticAggregateHash, header.bindingAggregateHash, header.firstTerminalRecordHash, header.secondTerminalRecordHash)) {
    throw new TypeError("Directory capture aggregate commitment mismatch");
  }
  const receiptIdentity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionAuthority: false,
    captureOccurrenceHash: header.captureOccurrenceHash,
    headerHash: header.headerHash,
    totalEntryCount: header.totalUnitCount,
    semanticMembershipHash: header.semanticAggregateHash,
    bindingAggregateHash: header.bindingAggregateHash,
    terminalCommitmentHash: header.terminalCommitmentHash,
  } as const;
  return parseBoundedRecordV2({ ...receiptIdentity, receiptHash: hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-directory-capture-receipt-hash.v2", receipt: receiptIdentity }) }, DirectoryReceiptV2Schema, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECEIPT_MAX_CANONICAL_BYTES_V2);
}

const typedArrayPrototypeV2 = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayByteLengthGetterV2 = Object.getOwnPropertyDescriptor(typedArrayPrototypeV2, "byteLength")!.get!;
const typedArrayBufferGetterV2 = Object.getOwnPropertyDescriptor(typedArrayPrototypeV2, "buffer")!.get!;
const uint8ArraySetV2 = Uint8Array.prototype.set;

function copyBoundedBytesV2(input: Uint8Array): Uint8Array {
  if (!isUint8Array(input) || isProxy(input) || Object.getPrototypeOf(input) !== Uint8Array.prototype) {
    throw new TypeError("Content input must be one ordinary non-proxied Uint8Array");
  }
  const byteLength = Reflect.apply(typedArrayByteLengthGetterV2, input, []) as number;
  if (byteLength > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2) {
    throw new RangeError("Content input exceeds its raw byte bound");
  }
  const backing = Reflect.apply(typedArrayBufferGetterV2, input, []) as ArrayBufferLike;
  if (typeof SharedArrayBuffer !== "undefined" && backing instanceof SharedArrayBuffer) {
    throw new TypeError("Shared content backing is forbidden");
  }
  for (const shadowed of ["byteLength", "buffer", "set", "subarray", "constructor"]) {
    if (Object.hasOwn(input, shadowed)) throw new TypeError("Shadowed content intrinsics are forbidden");
  }
  const copy = new Uint8Array(byteLength);
  Reflect.apply(uint8ArraySetV2, copy, [input, 0]);
  return copy;
}

export type PlatformReleaseBootstrapDarwinContentCaptureBuildInputV2 = Readonly<{
  binding: PlatformReleaseBootstrapDarwinCaptureBindingInputV2;
  content: Uint8Array;
}>;

export function buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
  input: PlatformReleaseBootstrapDarwinContentCaptureBuildInputV2,
): Readonly<{
  header: PlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2;
  chunks: readonly PlatformReleaseBootstrapDarwinContentCaptureChunkV2[];
}> {
  if (typeof input !== "object" || input === null || isProxy(input)) throw new TypeError("Content capture input must be one ordinary object");
  const bindingDescriptor = Object.getOwnPropertyDescriptor(input, "binding");
  const contentDescriptor = Object.getOwnPropertyDescriptor(input, "content");
  if (bindingDescriptor === undefined || !("value" in bindingDescriptor) || contentDescriptor === undefined || !("value" in contentDescriptor)) throw new TypeError("Content capture input properties must be data properties");
  const common = commonBindingFromInputV2(bindingDescriptor.value as PlatformReleaseBootstrapDarwinCaptureBindingInputV2);
  if (common.objectKind !== "ordinary_file") throw new TypeError("Content capture requires one regular file binding");
  const content = copyBoundedBytesV2(contentDescriptor.value as Uint8Array);
  if (common.sourceFingerprint.byteLength !== content.byteLength) {
    throw new TypeError("Content capture fingerprint byte length must match the exact raw content");
  }
  const fullContentHash = createHash("sha256").update(content).digest("hex");
  const chunkCount = Math.max(1, Math.ceil(content.byteLength / PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2));
  const chunks: PlatformReleaseBootstrapDarwinContentCaptureChunkV2[] = [];
  const terminalHashes: string[] = [];
  for (const observationOrdinal of PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_OBSERVATION_ORDINALS_V2) {
    let priorChunkHash: string | null = null;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const byteOffset = chunkIndex * PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2;
      const chunkByteLength = Math.min(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2, content.byteLength - byteOffset);
      const raw = new Uint8Array(chunkByteLength);
      if (chunkByteLength > 0) {
        const sourceView = new Uint8Array(content.buffer, byteOffset, chunkByteLength);
        Reflect.apply(uint8ArraySetV2, raw, [sourceView, 0]);
      }
      const rawChunkHash = createHash("sha256").update(raw).digest("hex");
      const identity = {
        ...common,
        schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
        version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
        transcriptKind: "regular_file_content",
        observationOrdinal,
        chunkIndex,
        chunkCount,
        byteOffset,
        chunkByteLength,
        totalByteLength: content.byteLength,
        contentBase64: Buffer.from(raw).toString("base64"),
        rawChunkHash,
        priorChunkHash,
        fullContentHash,
      } as const;
      const chunk = parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2({ ...identity, chunkHash: hashPlatformReleaseBootstrapDarwinContentCaptureChunkV2(identity) });
      chunks.push(chunk);
      priorChunkHash = chunk.chunkHash;
    }
    terminalHashes.push(priorChunkHash!);
  }
  const bindingAggregateHash = hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-content-binding-aggregate-hash.v2", captureOccurrenceHash: common.captureOccurrenceHash, totalByteLength: content.byteLength, fullContentHash });
  const terminalCommitmentHash = terminalCommitmentV2("regular_file_content", common, content.byteLength, fullContentHash, bindingAggregateHash, terminalHashes[0]!, terminalHashes[1]!);
  const headerIdentity = {
    ...common,
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    transcriptKind: "regular_file_content",
    observationCount: 2,
    recordsPerObservation: chunkCount,
    totalUnitCount: content.byteLength,
    semanticAggregateHash: fullContentHash,
    bindingAggregateHash,
    firstTerminalRecordHash: terminalHashes[0]!,
    secondTerminalRecordHash: terminalHashes[1]!,
    terminalCommitmentHash,
  } as const;
  const header = parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2({ ...headerIdentity, headerHash: hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(headerIdentity) });
  return deepFreezePlatformReleaseJsonV2({ header, chunks });
}

const ContentReceiptV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionAuthority: z.literal(false),
  captureOccurrenceHash: Sha256Schema,
  headerHash: Sha256Schema,
  totalByteLength: z.number().int().nonnegative().max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2),
  fullContentHash: Sha256Schema,
  bindingAggregateHash: Sha256Schema,
  terminalCommitmentHash: Sha256Schema,
  receiptHash: Sha256Schema,
}).strict();

export function verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
  headerCandidate: unknown,
  chunkCandidates: readonly unknown[],
) {
  const header = parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2(headerCandidate);
  const expectedChunkCount = Math.max(1, Math.ceil(
    header.totalUnitCount / PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
  ));
  if (header.transcriptKind !== "regular_file_content" || header.recordsPerObservation !== expectedChunkCount || header.sourceFingerprint.byteLength !== header.totalUnitCount) throw new TypeError("Content capture transcript has the wrong record envelope");
  const chunks = exactArrayDataValuesV2(
    chunkCandidates,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2 * 2,
  ).map(parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2);
  if (chunks.length !== header.recordsPerObservation * 2) throw new TypeError("Content capture transcript has the wrong record count");
  let firstContentHash: string | undefined;
  for (const ordinal of PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_OBSERVATION_ORDINALS_V2) {
    let priorChunkHash: string | null = null;
    const fullHasher = createHash("sha256");
    for (let chunkIndex = 0; chunkIndex < header.recordsPerObservation; chunkIndex += 1) {
      const chunk = chunks[(ordinal * header.recordsPerObservation) + chunkIndex]!;
      const expectedOffset = chunkIndex * PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2;
      const expectedLength = Math.min(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2, header.totalUnitCount - expectedOffset);
      const raw = decodeCanonicalBase64V2(chunk.contentBase64)!;
      if (!sameCommonBindingV2(header, chunk) || chunk.observationOrdinal !== ordinal || chunk.chunkIndex !== chunkIndex || chunk.chunkCount !== header.recordsPerObservation || chunk.byteOffset !== expectedOffset || chunk.chunkByteLength !== expectedLength || chunk.totalByteLength !== header.totalUnitCount || chunk.priorChunkHash !== priorChunkHash || chunk.fullContentHash !== header.semanticAggregateHash || (header.totalUnitCount === 0 && (chunk.chunkCount !== 1 || chunk.chunkByteLength !== 0))) throw new TypeError("Content capture chunk sequence is not exact");
      fullHasher.update(raw);
      priorChunkHash = chunk.chunkHash;
    }
    const fullContentHash = fullHasher.digest("hex");
    if (fullContentHash !== header.semanticAggregateHash || priorChunkHash !== (ordinal === 0 ? header.firstTerminalRecordHash : header.secondTerminalRecordHash)) throw new TypeError("Content capture terminal commitment mismatch");
    if (ordinal === 0) firstContentHash = fullContentHash;
    else if (fullContentHash !== firstContentHash) throw new TypeError("Content capture observations disagree");
  }
  const expectedBindingHash = hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-content-binding-aggregate-hash.v2", captureOccurrenceHash: header.captureOccurrenceHash, totalByteLength: header.totalUnitCount, fullContentHash: header.semanticAggregateHash });
  if (header.bindingAggregateHash !== expectedBindingHash || header.terminalCommitmentHash !== terminalCommitmentV2("regular_file_content", header, header.totalUnitCount, header.semanticAggregateHash, header.bindingAggregateHash, header.firstTerminalRecordHash, header.secondTerminalRecordHash)) throw new TypeError("Content capture aggregate commitment mismatch");
  const receiptIdentity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionAuthority: false,
    captureOccurrenceHash: header.captureOccurrenceHash,
    headerHash: header.headerHash,
    totalByteLength: header.totalUnitCount,
    fullContentHash: header.semanticAggregateHash,
    bindingAggregateHash: header.bindingAggregateHash,
    terminalCommitmentHash: header.terminalCommitmentHash,
  } as const;
  return parseBoundedRecordV2({ ...receiptIdentity, receiptHash: hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-content-capture-receipt-hash.v2", receipt: receiptIdentity }) }, ContentReceiptV2Schema, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECEIPT_MAX_CANONICAL_BYTES_V2);
}
