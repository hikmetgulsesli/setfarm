import { createHash } from "node:crypto";
import { isProxy, isUint8Array } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2,
  verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-capture-transcripts-v2.js";
import {
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
  StableFsObjectKindV2Schema,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 } from "./platform-release-bootstrap-registry-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { hashCanonicalJson } from "./canonical-json.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-slot-ledger.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-slot-ledger-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AUTHORITY_V2 =
  "test_fixture_node_ledger_joining_native_descriptor_capture_frames_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_SIGNING_AUTHORITY_V2 =
  "adhoc_or_unsigned_test_fixture" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AMFI_ADMISSION_V2 =
  "unproven_test_fixture" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_NOTARIZATION_ADMISSION_V2 =
  "unproven_test_fixture" as const;

const SLOT_BYTES_V2 = 32;
const SLOT_CATALOG_HEADER_BYTES_V2 = 4;
const SLOT_CATALOG_RECORD_BYTES_V2 = 37;
const CONTENT_HEADER_BYTES_V2 = 61;
const CONTENT_CHUNK_BYTES_V2 = 256 * 1024;
const CONTENT_MAX_BYTES_V2 = 1024 * 1024;
const CONTENT_MAX_CHUNKS_V2 = 4;
const SLOT_DOMAIN_V2 = "setfarm.darwin.descriptor-backed-member-slot.v2";

const SlotTextV2Schema = z.string().regex(/^slot_[a-f0-9]{64}$/u);
const ExpectedCatalogEntryV2Schema = z.object({
  objectKind: StableFsObjectKindV2Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
}).strict();
const SlotLedgerInputV2Schema = z.object({
  sessionOccurrenceHash: Sha256Schema,
  aggregateCensusHash: Sha256Schema,
  challengeHex: z.string().regex(/^[a-f0-9]{64}$/u),
  sessionSlot: SlotTextV2Schema,
  beginRequestHash: Sha256Schema,
  captureSlot: SlotTextV2Schema,
  expectedEntryIndex: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 - 1,
  ),
  expectedCatalog: z.array(ExpectedCatalogEntryV2Schema).min(1).max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  sourceObjectIdentity: StableFsObjectIdentityV2Schema,
  sourceFingerprint: FsObservationFingerprintV2Schema,
  sourceContentHash: Sha256Schema,
}).strict();

type SlotCatalogRecordV2 = Readonly<{
  slot: string;
  entryIndex: number;
  objectKind: "ordinary_file" | "directory";
}>;

type ContentChunkV2 = Readonly<{
  observationOrdinal: 0 | 1;
  chunkIndex: number;
  chunkCount: number;
  offset: number;
  total: number;
  bytes: Buffer;
}>;

type SlotLedgerStateV2 = {
  readonly input: z.infer<typeof SlotLedgerInputV2Schema>;
  catalog: readonly SlotCatalogRecordV2[] | undefined;
  catalogHash: string | undefined;
  selectedSlot: string | undefined;
  chunks: Map<0 | 1, Map<number, ContentChunkV2>>;
  finalized: boolean;
  disposed: boolean;
};

const handleCapabilityV2 = Object.freeze({});
const privateStateV2 = new WeakMap<object, SlotLedgerStateV2>();
const activeOccurrencesV2 = new Set<string>();
const consumedOccurrencesV2 = new Set<string>();

export class PlatformReleaseBootstrapDarwinSlotLedgerHandleV2 {
  constructor(capability: object) {
    if (capability !== handleCapabilityV2) {
      throw new TypeError("Slot-ledger handles are module-private capabilities");
    }
    Object.freeze(this);
  }
}

export type PlatformReleaseBootstrapDarwinSlotLedgerReceiptV2 = Readonly<{
  schema: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_RECEIPT_V2_SCHEMA;
  version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
  admissionScope: "test_fixture";
  productionAuthority: false;
  authority: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AUTHORITY_V2;
  signingAuthority: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_SIGNING_AUTHORITY_V2;
  amfiAdmission: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AMFI_ADMISSION_V2;
  notarizationAdmission: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_NOTARIZATION_ADMISSION_V2;
  settlementStatus: "pre_accept_content_join_only";
  sessionOccurrenceHash: string;
  aggregateCensusHash: string;
  beginRequestHash: string;
  slotCatalogHash: string;
  sessionSlot: string;
  sourceSlot: string;
  captureSlot: string;
  sourceEntryIndex: number;
  sourceObjectIdentity: StableFsObjectIdentityV2;
  sourceFingerprint: FsObservationFingerprintV2;
  sourceContentHash: string;
  contentReceiptHash: string;
  terminalCommitmentHash: string;
  receiptHash: string;
}>;

function failV2(message: string): never {
  throw new TypeError(message);
}

function stateForV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
): SlotLedgerStateV2 {
  if (
    handle === null
    || typeof handle !== "object"
    || isProxy(handle)
  ) {
    return failV2("Slot-ledger handle is forged");
  }
  const state = privateStateV2.get(handle);
  if (!state || state.disposed) return failV2("Slot-ledger handle is disposed");
  return state;
}

function exactBytesV2(input: Uint8Array, label: string): Buffer {
  if (
    !isUint8Array(input)
    || isProxy(input)
    || (
      Object.getPrototypeOf(input) !== Uint8Array.prototype
      && Object.getPrototypeOf(input) !== Buffer.prototype
    )
    || Object.hasOwn(input, "byteLength")
    || Object.hasOwn(input, "buffer")
    || Object.hasOwn(input, "byteOffset")
    || Object.hasOwn(input, "length")
  ) {
    return failV2(`${label} must be one exact non-proxied byte array`);
  }
  const bytes = Buffer.from(input);
  return bytes;
}

function slotTextV2(bytes: Uint8Array, label: string): string {
  const copied = exactBytesV2(bytes, label);
  try {
    if (copied.byteLength !== SLOT_BYTES_V2) {
      return failV2(`${label} has an invalid slot width`);
    }
    const text = `slot_${copied.toString("hex")}`;
    SlotTextV2Schema.parse(text);
    return text;
  } finally {
    copied.fill(0);
  }
}

function sha256V2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function u32V2(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value, 0);
  return bytes;
}

function u64V2(value: string, label: string): Buffer {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch (error) {
    return failV2(`${label} is not an unsigned 64-bit integer`);
  }
  if (parsed < 0n || parsed > 0xffff_ffff_ffff_ffffn) {
    return failV2(`${label} is outside the unsigned 64-bit bound`);
  }
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(parsed, 0);
  return bytes;
}

function expectedSlotV2(
  challengeHex: string,
  entryIndex: number,
  objectKind: "ordinary_file" | "directory",
  objectIdentity: StableFsObjectIdentityV2,
): string {
  const challenge = Buffer.from(challengeHex, "hex");
  const index = u32V2(entryIndex);
  const kind = Buffer.from([objectKind === "ordinary_file" ? 1 : 2]);
  const device = u64V2(objectIdentity.device, "stable device");
  const inode = u64V2(objectIdentity.inode, "stable inode");
  try {
    return `slot_${sha256V2(Buffer.concat([
      Buffer.from(SLOT_DOMAIN_V2, "utf8"),
      challenge,
      index,
      kind,
      device,
      inode,
    ]))}`;
  } finally {
    challenge.fill(0);
    index.fill(0);
    kind.fill(0);
    device.fill(0);
    inode.fill(0);
  }
}

function derivedSessionSlotV2(sessionOccurrenceHash: string): string {
  return `slot_${sha256V2(Buffer.from(`session:${sessionOccurrenceHash}`, "utf8"))}`;
}

function derivedCaptureSlotV2(
  sessionOccurrenceHash: string,
  entryIndex: number,
): string {
  return `slot_${sha256V2(Buffer.from(`capture:${sessionOccurrenceHash}:${entryIndex}`, "utf8"))}`;
}

function readU32V2(bytes: Buffer, offset: number): number {
  return bytes.readUInt32BE(offset);
}

function readU64SafeV2(bytes: Buffer, offset: number, label: string): number {
  const value = bytes.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return failV2(`${label} exceeds the safe integer bound`);
  }
  return Number(value);
}

function ensureOpenV2(state: SlotLedgerStateV2): void {
  if (state.finalized) return failV2("Slot-ledger has already finalized");
}

export function beginPlatformReleaseBootstrapDarwinSlotLedgerV2(
  input: Readonly<{
    sessionOccurrenceHash: string;
    aggregateCensusHash: string;
    challengeHex: string;
    sessionSlot: string;
    beginRequestHash: string;
    captureSlot: string;
    expectedEntryIndex: number;
    expectedCatalog: readonly Readonly<{
      objectKind: "ordinary_file" | "directory";
      objectIdentity: StableFsObjectIdentityV2;
    }>[];
    sourceObjectIdentity: StableFsObjectIdentityV2;
    sourceFingerprint: FsObservationFingerprintV2;
    sourceContentHash: string;
  }>,
): PlatformReleaseBootstrapDarwinSlotLedgerHandleV2 {
  if (
    typeof input !== "object"
    || input === null
    || isProxy(input)
  ) return failV2("Slot-ledger input must be one ordinary object");
  const parsed = SlotLedgerInputV2Schema.parse(input);
  if (
    parsed.sourceObjectIdentity.objectKind !== "ordinary_file"
    || parsed.sourceFingerprint.objectIdentityHash
      !== parsed.sourceObjectIdentity.objectIdentityHash
    || parsed.sessionSlot === parsed.captureSlot
    || parsed.expectedCatalog[parsed.expectedEntryIndex] === undefined
    || parsed.expectedCatalog[parsed.expectedEntryIndex]!.objectKind !== "ordinary_file"
    || parsed.expectedCatalog[parsed.expectedEntryIndex]!.objectIdentity.objectIdentityHash
      !== parsed.sourceObjectIdentity.objectIdentityHash
    || parsed.sessionOccurrenceHash !== hashCanonicalJson({
      schema: "setfarm.platform-release-bootstrap-node-native-controller-session-occurrence-hash.v2",
      challenge: parsed.challengeHex,
      aggregateEvidenceStreamHash: parsed.aggregateCensusHash,
    })
    || parsed.sessionSlot !== derivedSessionSlotV2(parsed.sessionOccurrenceHash)
    || parsed.captureSlot !== derivedCaptureSlotV2(
      parsed.sessionOccurrenceHash,
      parsed.expectedEntryIndex,
    )
    || activeOccurrencesV2.has(parsed.sessionOccurrenceHash)
    || consumedOccurrencesV2.has(parsed.sessionOccurrenceHash)
  ) {
    return failV2("Slot-ledger source identity and distinct slots do not join");
  }
  const handle = new PlatformReleaseBootstrapDarwinSlotLedgerHandleV2(
    handleCapabilityV2,
  );
  privateStateV2.set(handle, {
    input: parsed,
    catalog: undefined,
    catalogHash: undefined,
    selectedSlot: undefined,
    chunks: new Map(),
    finalized: false,
    disposed: false,
  });
  activeOccurrencesV2.add(parsed.sessionOccurrenceHash);
  return handle;
}

export function issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
  payload: Uint8Array,
): readonly SlotCatalogRecordV2[] {
  const state = stateForV2(handle);
  ensureOpenV2(state);
  if (state.catalog !== undefined) return failV2("Slot catalog was issued twice");
  const bytes = exactBytesV2(payload, "Slot catalog");
  try {
    if (bytes.byteLength < SLOT_CATALOG_HEADER_BYTES_V2) {
      return failV2("Slot catalog is truncated");
    }
    const count = readU32V2(bytes, 0);
    if (
      count === 0
      || count !== state.input.expectedCatalog.length
      || count > PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2
    ) return failV2("Slot catalog count is invalid");
    if (bytes.byteLength !== SLOT_CATALOG_HEADER_BYTES_V2 + count * SLOT_CATALOG_RECORD_BYTES_V2) {
      return failV2("Slot catalog length is not exact");
    }
    const records: SlotCatalogRecordV2[] = [];
    const slots = new Set<string>();
    const indices = new Set<number>();
    for (let index = 0; index < count; index += 1) {
      const offset = SLOT_CATALOG_HEADER_BYTES_V2 + index * SLOT_CATALOG_RECORD_BYTES_V2;
      const slot = slotTextV2(bytes.subarray(offset, offset + SLOT_BYTES_V2), "Catalog slot");
      const entryIndex = readU32V2(bytes, offset + SLOT_BYTES_V2);
      const objectKindByte = bytes[offset + SLOT_BYTES_V2 + 4]!;
      const objectKind = objectKindByte === 1
        ? "ordinary_file"
        : objectKindByte === 2 ? "directory" : undefined;
      const expected = state.input.expectedCatalog[index];
      if (
        objectKind === undefined
        || entryIndex !== index
        || expected === undefined
        || expected.objectKind !== objectKind
        || expected.objectIdentity.objectKind !== objectKind
        || slot !== expectedSlotV2(
          state.input.challengeHex,
          index,
          objectKind,
          expected.objectIdentity,
        )
        || slots.has(slot)
        || indices.has(entryIndex)
      ) {
        return failV2("Slot catalog contains an alias or invalid entry");
      }
      slots.add(slot);
      indices.add(entryIndex);
      records.push(Object.freeze({ slot, entryIndex, objectKind }));
    }
    state.catalog = Object.freeze(records);
    state.catalogHash = sha256V2(bytes);
    return state.catalog;
  } finally {
    bytes.fill(0);
  }
}

export function selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
  slotBytes: Uint8Array,
): Readonly<{ slot: string; entryIndex: number }> {
  const state = stateForV2(handle);
  ensureOpenV2(state);
  if (state.catalog === undefined) return failV2("Slot catalog is not issued");
  if (state.selectedSlot !== undefined) return failV2("Slot was selected twice");
  const slot = slotTextV2(slotBytes, "Requested slot");
  const matches = state.catalog.filter((record) => record.slot === slot);
  if (matches.length !== 1) return failV2("Requested slot was not issued");
  const selected = matches[0]!;
  if (
    selected.entryIndex !== state.input.expectedEntryIndex
    || selected.objectKind !== "ordinary_file"
  ) return failV2("Requested slot does not join the exact source entry");
  state.selectedSlot = selected.slot;
  return Object.freeze({ slot: selected.slot, entryIndex: selected.entryIndex });
}

export function recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
  payload: Uint8Array,
): void {
  const state = stateForV2(handle);
  ensureOpenV2(state);
  if (state.selectedSlot === undefined) return failV2("No slot was selected");
  const bytes = exactBytesV2(payload, "Slot content frame");
  try {
    if (
      bytes.byteLength < CONTENT_HEADER_BYTES_V2
      || bytes.byteLength > CONTENT_HEADER_BYTES_V2 + CONTENT_CHUNK_BYTES_V2
    ) return failV2("Slot content frame width is invalid");
    const slot = slotTextV2(bytes.subarray(0, SLOT_BYTES_V2), "Content slot");
    const observationOrdinal = bytes[32];
    const chunkIndex = readU32V2(bytes, 33);
    const chunkCount = readU32V2(bytes, 37);
    const offset = readU64SafeV2(bytes, 41, "Content offset");
    const total = readU64SafeV2(bytes, 49, "Content total");
    const chunkLength = readU32V2(bytes, 57);
    if (
      slot !== state.selectedSlot
      || (observationOrdinal !== 0 && observationOrdinal !== 1)
      || chunkCount < 1
      || chunkCount > CONTENT_MAX_CHUNKS_V2
      || chunkIndex >= chunkCount
      || total > CONTENT_MAX_BYTES_V2
      || total !== state.input.sourceFingerprint.byteLength
      || chunkLength > CONTENT_CHUNK_BYTES_V2
      || bytes.byteLength !== CONTENT_HEADER_BYTES_V2 + chunkLength
    ) return failV2("Slot content frame does not match its source binding");
    const expectedChunkCount = Math.max(1, Math.ceil(total / CONTENT_CHUNK_BYTES_V2));
    const expectedOffset = chunkIndex * CONTENT_CHUNK_BYTES_V2;
    const expectedLength = total === 0
      ? 0
      : Math.min(CONTENT_CHUNK_BYTES_V2, total - expectedOffset);
    if (
      chunkCount !== expectedChunkCount
      || offset !== expectedOffset
      || chunkLength !== expectedLength
    ) return failV2("Slot content chunk geometry is not canonical");
    const ordinal = observationOrdinal as 0 | 1;
    let chunks = state.chunks.get(ordinal);
    if (!chunks) {
      chunks = new Map();
      state.chunks.set(ordinal, chunks);
    }
    if (chunks.has(chunkIndex)) return failV2("Slot content chunk was replayed");
    chunks.set(chunkIndex, Object.freeze({
      observationOrdinal: ordinal,
      chunkIndex,
      chunkCount,
      offset,
      total,
      bytes: Buffer.from(bytes.subarray(CONTENT_HEADER_BYTES_V2)),
    }));
  } finally {
    bytes.fill(0);
  }
}

function joinedContentV2(
  state: SlotLedgerStateV2,
  ordinal: 0 | 1,
): Buffer {
  const total = state.input.sourceFingerprint.byteLength;
  const chunkCount = Math.max(1, Math.ceil(total / CONTENT_CHUNK_BYTES_V2));
  const chunks = state.chunks.get(ordinal);
  if (!chunks || chunks.size !== chunkCount) return failV2("Slot content observation is incomplete");
  const joined = Buffer.alloc(total);
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = chunks.get(index);
    if (!chunk || chunk.offset !== index * CONTENT_CHUNK_BYTES_V2) {
      joined.fill(0);
      return failV2("Slot content observation has a gap");
    }
    chunk.bytes.copy(joined, chunk.offset);
  }
  return joined;
}

export function finalizePlatformReleaseBootstrapDarwinSlotLedgerV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
): PlatformReleaseBootstrapDarwinSlotLedgerReceiptV2 {
  const state = stateForV2(handle);
  ensureOpenV2(state);
  if (state.catalogHash === undefined || state.selectedSlot === undefined) {
    return failV2("Slot ledger has no complete catalog selection");
  }
  let first: Buffer | undefined;
  let second: Buffer | undefined;
  try {
    first = joinedContentV2(state, 0);
    second = joinedContentV2(state, 1);
    const firstHash = sha256V2(first);
    const secondHash = sha256V2(second);
    if (
      firstHash !== state.input.sourceContentHash
      || secondHash !== firstHash
      || !first.equals(second)
    ) return failV2("Slot observations disagree with the mutable content binding");
    const captureSlot = state.input.captureSlot;
    const binding = {
      sessionOccurrenceHash: state.input.sessionOccurrenceHash,
      sessionSlot: state.input.sessionSlot,
      beginRequestHash: state.input.beginRequestHash,
      sourceSlot: state.selectedSlot,
      captureSlot,
      sourceObjectIdentity: state.input.sourceObjectIdentity,
      sourceFingerprint: state.input.sourceFingerprint,
      objectKind: "ordinary_file" as const,
    };
    const transcript = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({
      binding,
      content: new Uint8Array(first),
    });
    const contentReceipt =
      verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
        transcript.header,
        transcript.chunks,
      );
    const identity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_RECEIPT_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      authority: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AUTHORITY_V2,
      signingAuthority: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_SIGNING_AUTHORITY_V2,
      amfiAdmission: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_AMFI_ADMISSION_V2,
      notarizationAdmission: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SLOT_LEDGER_NOTARIZATION_ADMISSION_V2,
      settlementStatus: "pre_accept_content_join_only" as const,
      sessionOccurrenceHash: state.input.sessionOccurrenceHash,
      aggregateCensusHash: state.input.aggregateCensusHash,
      beginRequestHash: state.input.beginRequestHash,
      slotCatalogHash: state.catalogHash,
      sessionSlot: state.input.sessionSlot,
      sourceSlot: state.selectedSlot,
      captureSlot,
      sourceEntryIndex: state.input.expectedEntryIndex,
      sourceObjectIdentity: state.input.sourceObjectIdentity,
      sourceFingerprint: state.input.sourceFingerprint,
      sourceContentHash: state.input.sourceContentHash,
      contentReceiptHash: contentReceipt.receiptHash,
      terminalCommitmentHash: contentReceipt.terminalCommitmentHash,
    } as const;
    const receipt = deepFreezePlatformReleaseJsonV2({
      ...identity,
      receiptHash: hashCanonicalJson({
        schema: "setfarm.platform-release-bootstrap-darwin-slot-ledger-receipt-hash.v2",
        receipt: identity,
      }),
    });
    state.finalized = true;
    activeOccurrencesV2.delete(state.input.sessionOccurrenceHash);
    consumedOccurrencesV2.add(state.input.sessionOccurrenceHash);
    return receipt as PlatformReleaseBootstrapDarwinSlotLedgerReceiptV2;
  } finally {
    first?.fill(0);
    second?.fill(0);
  }
}

export function disposePlatformReleaseBootstrapDarwinSlotLedgerV2(
  handle: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
): void {
  const state = stateForV2(handle);
  for (const chunks of state.chunks.values()) {
    for (const chunk of chunks.values()) chunk.bytes.fill(0);
    chunks.clear();
  }
  state.chunks.clear();
  state.catalog = undefined;
  state.catalogHash = undefined;
  state.selectedSlot = undefined;
  state.disposed = true;
  if (!state.finalized) {
    activeOccurrencesV2.delete(state.input.sessionOccurrenceHash);
  }
  privateStateV2.delete(handle);
}
