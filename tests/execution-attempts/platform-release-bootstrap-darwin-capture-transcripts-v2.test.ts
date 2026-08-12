import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
  buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2,
  buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2,
  hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2,
  hashPlatformReleaseBootstrapDarwinContentCaptureChunkV2,
  hashPlatformReleaseBootstrapDarwinDirectoryCapturePageV2,
  parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2,
  parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2,
  parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2,
  verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2,
  verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-capture-transcripts-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

function hashV2(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slotV2(value: string): string {
  return `slot_${hashV2(value)}`;
}

const scopeV2 = buildBootstrapFilesystemScopeIdentityV2({ scopeNonce: hashV2("scope") });

function identityV2(kind: "directory" | "ordinary_file", inode: number) {
  return buildStableFsObjectIdentityV2({
    filesystemScope: scopeV2,
    objectKind: kind,
    device: "7",
    inode: String(inode),
  });
}

function bindingV2(
  kind: "directory" | "ordinary_file",
  label = "capture",
  byteLength = 0,
) {
  const sourceObjectIdentity = identityV2(kind, kind === "directory" ? 1 : 2);
  return {
    sessionOccurrenceHash: hashV2(`session:${label}`),
    sessionSlot: slotV2(`session:${label}`),
    beginRequestHash: hashV2(`begin:${label}`),
    sourceSlot: slotV2(`source:${label}`),
    captureSlot: slotV2(`capture:${label}`),
    sourceObjectIdentity,
    sourceFingerprint: buildFsObservationFingerprintV2({
      objectIdentity: sourceObjectIdentity,
      ownerUid: 0,
      ownerGid: 0,
      mode: kind === "directory" ? "0755" : "0600",
      linkCount: 1,
      byteLength,
      modifiedTimeNanoseconds: "1",
      changedTimeNanoseconds: "2",
    }),
    objectKind: kind,
  } as const;
}

function membersV2(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    basename: `member-${String(index).padStart(5, "0")}`,
    objectKind: "ordinary_file" as const,
    memberSlot: slotV2(`member:${index}`),
    objectIdentity: identityV2("ordinary_file", 100 + index),
  }));
}

function canonicalBytesV2(value: unknown): number {
  return Buffer.byteLength(canonicalJsonStringify(value), "utf8");
}

function rehashDirectoryPageV2(page: Record<string, unknown>) {
  page.pageHash = hashPlatformReleaseBootstrapDarwinDirectoryCapturePageV2(page);
}

function rehashContentChunkV2(chunk: Record<string, unknown>) {
  chunk.chunkHash = hashPlatformReleaseBootstrapDarwinContentCaptureChunkV2(chunk);
}

function directoryRollingHashV2(
  kind: "semantic" | "binding",
  previous: string | null,
  totalEntryCount: number,
  entries: readonly Record<string, unknown>[],
): string {
  return hashCanonicalJson({
    schema: `setfarm.platform-release-bootstrap-darwin-directory-${kind}-rolling-hash.v2`,
    previous,
    totalEntryCount,
    entries: kind === "semantic"
      ? entries.map(({ membershipIndex, basename, objectKind }) => ({
          membershipIndex,
          basename,
          objectKind,
        }))
      : entries,
  });
}

function coherentlyReplaceDirectoryTailV2(
  transcript: ReturnType<
    typeof buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2
  >,
  replacement: readonly Record<string, unknown>[],
) {
  const header = structuredClone(transcript.header) as unknown as Record<
    string,
    unknown
  >;
  const pages = structuredClone(transcript.pages) as unknown as Array<
    Record<string, unknown> & { orderedEntries: Array<Record<string, unknown>> }
  >;
  const pageCount = header.recordsPerObservation as number;
  let semanticAggregateHash = "";
  let bindingAggregateHash = "";
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    let semantic: string | null = null;
    let binding: string | null = null;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = pages[(ordinal * pageCount) + pageIndex]!;
      if (pageIndex === pageCount - 1) {
        page.orderedEntries = structuredClone(replacement);
        page.entryCount = replacement.length;
      }
      semantic = directoryRollingHashV2(
        "semantic",
        semantic,
        header.totalUnitCount as number,
        page.orderedEntries,
      );
      binding = directoryRollingHashV2(
        "binding",
        binding,
        header.totalUnitCount as number,
        page.orderedEntries,
      );
      page.semanticRollingHash = semantic;
      page.bindingRollingHash = binding;
    }
    if (ordinal === 0) {
      semanticAggregateHash = semantic!;
      bindingAggregateHash = binding!;
    } else {
      assert.equal(semantic, semanticAggregateHash);
      assert.equal(binding, bindingAggregateHash);
    }
  }
  const terminalHashes: string[] = [];
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    let priorPageHash: string | null = null;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = pages[(ordinal * pageCount) + pageIndex]!;
      page.semanticMembershipHash = semanticAggregateHash;
      page.bindingAggregateHash = bindingAggregateHash;
      page.priorPageHash = priorPageHash;
      rehashDirectoryPageV2(page);
      priorPageHash = page.pageHash as string;
    }
    terminalHashes.push(priorPageHash!);
  }
  header.semanticAggregateHash = semanticAggregateHash;
  header.bindingAggregateHash = bindingAggregateHash;
  header.firstTerminalRecordHash = terminalHashes[0]!;
  header.secondTerminalRecordHash = terminalHashes[1]!;
  header.terminalCommitmentHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-capture-terminal-commitment-hash.v2",
    kind: "directory_membership",
    captureOccurrenceHash: header.captureOccurrenceHash,
    count: header.totalUnitCount,
    semanticAggregateHash,
    bindingAggregateHash,
    firstTerminalRecordHash: terminalHashes[0],
    secondTerminalRecordHash: terminalHashes[1],
  });
  header.headerHash =
    hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(header);
  return { header, pages };
}

function coherentlyDetachContentFingerprintLengthV2(
  transcript: ReturnType<
    typeof buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2
  >,
) {
  const header = structuredClone(transcript.header) as unknown as Record<
    string,
    unknown
  >;
  const chunks = structuredClone(transcript.chunks) as unknown as Array<
    Record<string, unknown>
  >;
  const sourceObjectIdentity = header.sourceObjectIdentity as ReturnType<
    typeof identityV2
  >;
  const wrongFingerprint = buildFsObservationFingerprintV2({
    objectIdentity: sourceObjectIdentity,
    ownerUid: 0,
    ownerGid: 0,
    mode: "0600",
    linkCount: 1,
    byteLength: 0,
    modifiedTimeNanoseconds: "1",
    changedTimeNanoseconds: "2",
  });
  const binding = {
    captureTranscriptContractHash: header.captureTranscriptContractHash,
    sessionOccurrenceHash: header.sessionOccurrenceHash,
    sessionSlot: header.sessionSlot,
    beginRequestHash: header.beginRequestHash,
    sourceSlot: header.sourceSlot,
    captureSlot: header.captureSlot,
    sourceObjectIdentity,
    sourceFingerprint: wrongFingerprint,
    objectKind: header.objectKind,
  };
  const captureOccurrenceHash = hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-capture-occurrence-hash.v2",
    binding,
  });
  header.sourceFingerprint = wrongFingerprint;
  header.captureOccurrenceHash = captureOccurrenceHash;
  const terminalHashes: string[] = [];
  const chunkCount = header.recordsPerObservation as number;
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    let priorChunkHash: string | null = null;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const chunk = chunks[(ordinal * chunkCount) + chunkIndex]!;
      chunk.sourceFingerprint = wrongFingerprint;
      chunk.captureOccurrenceHash = captureOccurrenceHash;
      chunk.priorChunkHash = priorChunkHash;
      rehashContentChunkV2(chunk);
      priorChunkHash = chunk.chunkHash as string;
    }
    terminalHashes.push(priorChunkHash!);
  }
  const bindingAggregateHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-content-binding-aggregate-hash.v2",
    captureOccurrenceHash,
    totalByteLength: header.totalUnitCount,
    fullContentHash: header.semanticAggregateHash,
  });
  header.bindingAggregateHash = bindingAggregateHash;
  header.firstTerminalRecordHash = terminalHashes[0]!;
  header.secondTerminalRecordHash = terminalHashes[1]!;
  header.terminalCommitmentHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-capture-terminal-commitment-hash.v2",
    kind: "regular_file_content",
    captureOccurrenceHash,
    count: header.totalUnitCount,
    semanticAggregateHash: header.semanticAggregateHash,
    bindingAggregateHash,
    firstTerminalRecordHash: terminalHashes[0],
    secondTerminalRecordHash: terminalHashes[1],
  });
  header.headerHash =
    hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(header);
  return { header, chunks };
}

describe("platform release bootstrap Darwin bounded capture transcripts v2", () => {
  it("builds and verifies exact empty, page-boundary, and maximum directory observations", () => {
    for (const count of [0, 512, 513, 16_384]) {
      const transcript = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", `directory:${count}`),
        orderedEntries: membersV2(count),
      });
      assert.equal(transcript.header.totalUnitCount, count);
      assert.equal(transcript.header.recordsPerObservation, Math.max(1, Math.ceil(count / 512)));
      assert.equal(transcript.pages.length, transcript.header.recordsPerObservation * 2);
      const expectedPageLengths = Array.from(
        { length: transcript.header.recordsPerObservation },
        (_, pageIndex) => Math.min(512, count - (pageIndex * 512)),
      );
      if (count === 0) expectedPageLengths[0] = 0;
      assert.deepEqual(
        transcript.pages.map((page) => page.entryCount),
        [...expectedPageLengths, ...expectedPageLengths],
      );
      assert.ok(transcript.pages.every((page) => canonicalBytesV2(page) <= PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2));
      assert.equal(Object.isFrozen(transcript.header), true);
      assert.equal(Object.isFrozen(transcript.pages), true);
      const receipt = verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, transcript.pages);
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.totalEntryCount, count);
      assert.equal(Object.isFrozen(receipt), true);
    }
  });

  it("builds and verifies exact empty, chunk-boundary, and maximum content observations", () => {
    for (const byteLength of [
      0,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2 + 1,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
    ]) {
      const content = new Uint8Array(byteLength);
      for (let index = 0; index < content.length; index += 1) content[index] = index % 251;
      const transcript = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({
        binding: bindingV2("ordinary_file", `content:${byteLength}`, byteLength),
        content,
      });
      assert.equal(transcript.header.totalUnitCount, byteLength);
      assert.equal(transcript.header.recordsPerObservation, Math.max(1, Math.ceil(byteLength / (256 * 1024))));
      const expectedChunkLengths = Array.from(
        { length: transcript.header.recordsPerObservation },
        (_, chunkIndex) => Math.min(
          256 * 1024,
          byteLength - (chunkIndex * 256 * 1024),
        ),
      );
      if (byteLength === 0) expectedChunkLengths[0] = 0;
      assert.deepEqual(
        transcript.chunks.map((chunk) => chunk.chunkByteLength),
        [...expectedChunkLengths, ...expectedChunkLengths],
      );
      assert.ok(transcript.chunks.every((chunk) => canonicalBytesV2(chunk) <= PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2));
      assert.equal(Object.isFrozen(transcript.header), true);
      assert.equal(Object.isFrozen(transcript.chunks), true);
      assert.equal(Object.isFrozen(transcript.chunks[0]), true);
      const receipt = verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, transcript.chunks);
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.totalByteLength, byteLength);
      assert.equal(Object.isFrozen(receipt), true);
    }
  });

  it("rejects skipped, duplicated, reordered, replayed, rebound, aliased, and cross-page unordered directory pages", () => {
    const transcript = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "hostile-directory"), orderedEntries: membersV2(513) });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, transcript.pages.slice(1)));
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, [transcript.pages[0], transcript.pages[0], ...transcript.pages.slice(2)]));
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, [transcript.pages[1], transcript.pages[0], ...transcript.pages.slice(2)]));

    const wrongPrior = structuredClone(transcript.pages);
    (wrongPrior[1] as unknown as Record<string, unknown>).priorPageHash = hashV2("wrong-prior");
    rehashDirectoryPageV2(wrongPrior[1] as unknown as Record<string, unknown>);
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, wrongPrior));

    const alias = structuredClone(transcript.pages);
    const aliasPage = alias[0] as unknown as { orderedEntries: Array<Record<string, unknown>> } & Record<string, unknown>;
    aliasPage.orderedEntries[0]!.memberSlot = transcript.header.sessionSlot;
    rehashDirectoryPageV2(aliasPage);
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, alias));

    const reordered = structuredClone(transcript.pages);
    const boundaryPage = reordered[1] as unknown as { orderedEntries: Array<Record<string, unknown>> } & Record<string, unknown>;
    boundaryPage.orderedEntries[0]!.basename = "member-00000";
    rehashDirectoryPageV2(boundaryPage);
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, reordered));

    const other = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "other-occurrence"), orderedEntries: membersV2(513) });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(transcript.header, [other.pages[0], ...transcript.pages.slice(1)]));

    const coherentlyUnorderedEntries = membersV2(513);
    coherentlyUnorderedEntries[512] = {
      ...coherentlyUnorderedEntries[512]!,
      basename: "member-00000",
    };
    const coherentlyUnordered =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", "coherent-boundary-order"),
        orderedEntries: coherentlyUnorderedEntries,
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        coherentlyUnordered.header,
        coherentlyUnordered.pages,
      ),
    );
  });

  it("rejects fully rehashed short and long final directory pages", () => {
    const transcript =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", "tail-cardinality"),
        orderedEntries: membersV2(513),
      });
    const short = coherentlyReplaceDirectoryTailV2(transcript, []);
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        short.header,
        short.pages,
      ),
    );

    const originalTail = structuredClone(
      transcript.pages[1]!.orderedEntries,
    ) as unknown as Array<Record<string, unknown>>;
    const extra = membersV2(514)[513]!;
    const long = coherentlyReplaceDirectoryTailV2(transcript, [
      ...originalTail,
      { ...extra, membershipIndex: 513 },
    ]);
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        long.header,
        long.pages,
      ),
    );
  });

  it("rejects content gaps, duplicate/reordered chunks, wrong offset/total/prior/base64/chunk/full hashes, and cross occurrence", () => {
    const transcript = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "hostile-content", (256 * 1024) + 1), content: new Uint8Array((256 * 1024) + 1).fill(19) });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, transcript.chunks.slice(1)));
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, [transcript.chunks[0], transcript.chunks[0], ...transcript.chunks.slice(2)]));
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, [transcript.chunks[1], transcript.chunks[0], ...transcript.chunks.slice(2)]));

    for (const mutation of ["byteOffset", "totalByteLength", "priorChunkHash", "fullContentHash"] as const) {
      const changed = structuredClone(transcript.chunks);
      const chunk = changed[1] as unknown as Record<string, unknown>;
      chunk[mutation] = mutation === "priorChunkHash" || mutation === "fullContentHash" ? hashV2(`wrong:${mutation}`) : 0;
      rehashContentChunkV2(chunk);
      assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, changed));
    }

    const changedBytes = structuredClone(transcript.chunks);
    const chunk = changedBytes[0] as unknown as Record<string, unknown>;
    const bytes = Buffer.from(chunk.contentBase64 as string, "base64");
    bytes[0] ^= 1;
    chunk.contentBase64 = bytes.toString("base64");
    chunk.rawChunkHash = createHash("sha256").update(bytes).digest("hex");
    rehashContentChunkV2(chunk);
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, changedBytes));

    const other = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "other-content", (256 * 1024) + 1), content: new Uint8Array((256 * 1024) + 1).fill(19) });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(transcript.header, [other.chunks[0], ...transcript.chunks.slice(1)]));

    for (const [field, value] of [
      ["chunkIndex", 1],
      ["chunkCount", 1],
      ["chunkByteLength", 1],
      ["rawChunkHash", hashV2("wrong-raw-chunk")],
    ] as const) {
      const changed = structuredClone(transcript.chunks);
      const first = changed[0] as unknown as Record<string, unknown>;
      first[field] = value;
      rehashContentChunkV2(first);
      assert.throws(() =>
        verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
          transcript.header,
          changed,
        ),
      );
    }

    const wrongFinalHeader = structuredClone(
      transcript.header,
    ) as unknown as Record<string, unknown>;
    wrongFinalHeader.firstTerminalRecordHash = hashV2("wrong-final");
    wrongFinalHeader.headerHash =
      hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(
        wrongFinalHeader,
      );
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
        wrongFinalHeader,
        transcript.chunks,
      ),
    );

    const wrongAggregateHeader = structuredClone(
      transcript.header,
    ) as unknown as Record<string, unknown>;
    wrongAggregateHeader.bindingAggregateHash = hashV2("wrong-aggregate");
    wrongAggregateHeader.terminalCommitmentHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-capture-terminal-commitment-hash.v2",
      kind: "regular_file_content",
      captureOccurrenceHash: wrongAggregateHeader.captureOccurrenceHash,
      count: wrongAggregateHeader.totalUnitCount,
      semanticAggregateHash: wrongAggregateHeader.semanticAggregateHash,
      bindingAggregateHash: wrongAggregateHeader.bindingAggregateHash,
      firstTerminalRecordHash: wrongAggregateHeader.firstTerminalRecordHash,
      secondTerminalRecordHash: wrongAggregateHeader.secondTerminalRecordHash,
    });
    wrongAggregateHeader.headerHash =
      hashPlatformReleaseBootstrapDarwinCaptureTranscriptHeaderV2(
        wrongAggregateHeader,
      );
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
        wrongAggregateHeader,
        transcript.chunks,
      ),
    );
  });

  it("rejects invalid scope/device/kind/locator aliases and control-slot/member-slot aliases", () => {
    const entries = membersV2(2);
    entries[1] = { ...entries[1]!, memberSlot: entries[0]!.memberSlot };
    const duplicateSlot = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "duplicate-slot"), orderedEntries: entries });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(duplicateSlot.header, duplicateSlot.pages));

    const locatorEntries = membersV2(2);
    locatorEntries[1] = { ...locatorEntries[1]!, objectIdentity: locatorEntries[0]!.objectIdentity };
    const duplicateLocator = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "duplicate-locator"), orderedEntries: locatorEntries });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(duplicateLocator.header, duplicateLocator.pages));

    const wrongDeviceEntries = membersV2(1);
    const foreignScope = buildBootstrapFilesystemScopeIdentityV2({ scopeNonce: hashV2("foreign-scope") });
    wrongDeviceEntries[0] = { ...wrongDeviceEntries[0]!, objectIdentity: buildStableFsObjectIdentityV2({ filesystemScope: foreignScope, objectKind: "ordinary_file", device: "8", inode: "999" }) };
    const wrongDevice = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "wrong-device"), orderedEntries: wrongDeviceEntries });
    assert.throws(() => verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(wrongDevice.header, wrongDevice.pages));

    const controlBinding = bindingV2("directory", "control-slot-aliases");
    for (const memberSlot of [
      controlBinding.sessionSlot,
      controlBinding.sourceSlot,
      controlBinding.captureSlot,
    ]) {
      const aliased =
        buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
          binding: controlBinding,
          orderedEntries: [{ ...membersV2(1)[0]!, memberSlot }],
        });
      assert.throws(() =>
        verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
          aliased.header,
          aliased.pages,
        ),
      );
    }

    const isolatedWrongDevice = membersV2(1);
    isolatedWrongDevice[0] = {
      ...isolatedWrongDevice[0]!,
      objectIdentity: buildStableFsObjectIdentityV2({
        filesystemScope: scopeV2,
        objectKind: "ordinary_file",
        device: "8",
        inode: "999",
      }),
    };
    const wrongDeviceOnly =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", "wrong-device-only"),
        orderedEntries: isolatedWrongDevice,
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        wrongDeviceOnly.header,
        wrongDeviceOnly.pages,
      ),
    );

    const isolatedForeignScope = membersV2(1);
    isolatedForeignScope[0] = {
      ...isolatedForeignScope[0]!,
      objectIdentity: buildStableFsObjectIdentityV2({
        filesystemScope: foreignScope,
        objectKind: "ordinary_file",
        device: "7",
        inode: "999",
      }),
    };
    const wrongScopeOnly =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", "wrong-scope-only"),
        orderedEntries: isolatedForeignScope,
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        wrongScopeOnly.header,
        wrongScopeOnly.pages,
      ),
    );

    const kindMismatch = membersV2(1);
    kindMismatch[0] = {
      ...kindMismatch[0]!,
      objectKind: "directory",
    };
    const wrongKind =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: bindingV2("directory", "wrong-kind"),
        orderedEntries: kindMismatch,
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        wrongKind.header,
        wrongKind.pages,
      ),
    );

    const selfBinding = bindingV2("directory", "source-self-alias");
    const selfAlias =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: selfBinding,
        orderedEntries: [
          {
            basename: "self-alias",
            objectKind: "directory",
            memberSlot: slotV2("source-self-alias-member"),
            objectIdentity: selfBinding.sourceObjectIdentity,
          },
        ],
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        selfAlias.header,
        selfAlias.pages,
      ),
    );

    const crossKindSelfLocator =
      buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({
        binding: selfBinding,
        orderedEntries: [
          {
            basename: "cross-kind-self-locator",
            objectKind: "ordinary_file",
            memberSlot: slotV2("cross-kind-self-locator-member"),
            objectIdentity: buildStableFsObjectIdentityV2({
              filesystemScope: scopeV2,
              objectKind: "ordinary_file",
              device: selfBinding.sourceObjectIdentity.device,
              inode: selfBinding.sourceObjectIdentity.inode,
            }),
          },
        ],
      });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        crossKindSelfLocator.header,
        crossKindSelfLocator.pages,
      ),
    );
  });

  it("rejects proxies, accessors, cycles, oversize-before-copy, shared/subclass inputs, while ignoring Symbol.species", () => {
    const directory = buildPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2({ binding: bindingV2("directory", "parser-hostile"), orderedEntries: [] });
    assert.throws(() => parsePlatformReleaseBootstrapDarwinCaptureTranscriptHeaderCandidateV2(new Proxy(directory.header, {})));
    const accessor = { ...directory.pages[0] } as Record<string, unknown>;
    Object.defineProperty(accessor, "pageHash", { enumerable: true, get: () => directory.pages[0]!.pageHash });
    assert.throws(() => parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2(accessor));
    const cycle: Record<string, unknown> = { ...directory.pages[0] };
    cycle.cycle = cycle;
    assert.throws(() => parsePlatformReleaseBootstrapDarwinDirectoryCapturePageCandidateV2(cycle));

    for (const property of ["named-extra", Symbol("symbol-extra")] as const) {
      const extra = structuredClone(directory.pages) as unknown as Record<
        PropertyKey,
        unknown
      >;
      extra[property] = true;
      assert.throws(() =>
        verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
          directory.header,
          extra as unknown as readonly unknown[],
        ),
      );
    }
    class PageArraySubclass extends Array<unknown> {}
    const subclassPages = new PageArraySubclass(...directory.pages);
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinDirectoryCaptureTranscriptV2(
        directory.header,
        subclassPages,
      ),
    );

    assert.throws(() => buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "oversize", PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2 + 1), content: new Uint8Array(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2 + 1) }), RangeError);
    class BytesSubclass extends Uint8Array {}
    assert.throws(() => buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "subclass", 1), content: new BytesSubclass(1) }));
    if (typeof SharedArrayBuffer !== "undefined") {
      assert.throws(() => buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "shared", 1), content: new Uint8Array(new SharedArrayBuffer(1)) }));
    }
    const priorSpecies = Object.getOwnPropertyDescriptor(Uint8Array, Symbol.species);
    Object.defineProperty(Uint8Array, Symbol.species, { configurable: true, get: () => { throw new Error("species must not be read"); } });
    try {
      const content = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "species", 3), content: new Uint8Array([1, 2, 3]) });
      assert.equal(verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(content.header, content.chunks).totalByteLength, 3);
    } finally {
      if (priorSpecies === undefined) delete (Uint8Array as unknown as Record<PropertyKey, unknown>)[Symbol.species];
      else Object.defineProperty(Uint8Array, Symbol.species, priorSpecies);
    }
    assert.equal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.authorityPolicy, "serialized_transcript_never_live_slot_ledger_authority_v2");
  });

  it("rejects content whose mutable fingerprint byte length is detached", () => {
    assert.throws(() =>
      buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({
        binding: bindingV2("ordinary_file", "fingerprint-length", 0),
        content: new Uint8Array([1]),
      }),
    );

    const valid = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({
      binding: bindingV2("ordinary_file", "fingerprint-verifier", 1),
      content: new Uint8Array([1]),
    });
    const detached = coherentlyDetachContentFingerprintLengthV2(valid);
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2(
        detached.header,
        detached.chunks,
      ),
    );
  });

  it("strict per-record parsers reject malformed canonical base64 and oversized records", () => {
    const transcript = buildPlatformReleaseBootstrapDarwinContentCaptureTranscriptV2({ binding: bindingV2("ordinary_file", "strict-record", 1), content: new Uint8Array([1]) });
    const malformed = structuredClone(transcript.chunks[0]) as unknown as Record<string, unknown>;
    malformed.contentBase64 = "AQ";
    malformed.chunkByteLength = 1;
    malformed.rawChunkHash = createHash("sha256")
      .update(Uint8Array.of(1))
      .digest("hex");
    rehashContentChunkV2(malformed);
    assert.throws(() => parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2(malformed));
    assert.throws(() => parsePlatformReleaseBootstrapDarwinContentCaptureChunkCandidateV2({ ...transcript.chunks[0], padding: "x".repeat(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2) }));
  });
});
