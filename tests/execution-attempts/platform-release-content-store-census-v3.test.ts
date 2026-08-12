import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  assertPlatformReleaseContentStoreAppendOnlySupersetV3,
  buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3,
  buildPlatformReleaseContentStoreGlobalCensusV3,
  buildPlatformReleaseContentStoreObservationV3,
  hashPlatformReleaseContentStoreGlobalCensusV3,
  parsePlatformReleaseContentStoreGlobalCensusCandidateV3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3,
  type PlatformReleaseContentStoreAttestationCensusEntryV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
  type PlatformReleaseContentStoreMutableFingerprintV3,
  type PlatformReleaseContentStoreObservationV3,
  type PlatformReleaseContentStorePersistentAnchorsV3,
  type PlatformReleaseContentStoreReleaseCensusEntryV3,
} from "../../src/execution/schemas/platform-release-content-store-census-v3.js";

const HOST_HASH = sha("host");
const DEVICE = "16777229";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function observation(
  objectKind: "directory" | "ordinary_file",
  inode: number,
  mode: string,
  contentLabel: string,
  byteLength: number,
  mutable: Partial<PlatformReleaseContentStoreMutableFingerprintV3> = {},
): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      hostIdentityHash: HOST_HASH,
      objectKind,
      device: DEVICE,
      inode: String(inode),
    },
    mutableFingerprint: {
      ownerUid: 501,
      ownerGid: 20,
      mode,
      linkCount: 1,
      byteLength,
      contentHash: sha(contentLabel),
      modifiedTimeNanoseconds: "1000000000",
      changedTimeNanoseconds: "1000000001",
      ...mutable,
    },
  });
}

function replaceObservation(
  source: PlatformReleaseContentStoreObservationV3,
  input: Readonly<{
    stableIdentity?: Partial<PlatformReleaseContentStoreObservationV3["stableIdentity"]>;
    mutableFingerprint?: Partial<PlatformReleaseContentStoreObservationV3["mutableFingerprint"]>;
  }>,
): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      ...source.stableIdentity,
      ...input.stableIdentity,
    },
    mutableFingerprint: {
      ...source.mutableFingerprint,
      ...input.mutableFingerprint,
    },
  });
}

function directoryObservation(
  inode: number,
  mode: "0700" | "0555",
  role: Parameters<
    typeof buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3
  >[0],
  entryNames: readonly string[],
  mutable: Partial<PlatformReleaseContentStoreMutableFingerprintV3> = {},
): PlatformReleaseContentStoreObservationV3 {
  const membership =
    buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
      role,
      entryNames,
    );
  return observation(
    "directory",
    inode,
    mode,
    `${role}:unused`,
    membership.byteLength,
    { ...mutable, contentHash: membership.contentHash },
  );
}

function persistentAnchors(
  releaseHashes: readonly string[] = [],
  attestationHashes: readonly string[] = [],
): PlatformReleaseContentStorePersistentAnchorsV3 {
  return {
    storeRoot: directoryObservation(
      1,
      "0700",
      "store_root",
      [".locks", ".staging", "attestations", "releases"],
    ),
    locksRoot: directoryObservation(2, "0700", "locks_root", []),
    stagingRoot: directoryObservation(3, "0700", "staging_root", []),
    releasesRoot: directoryObservation(
      4,
      "0700",
      "releases_root",
      [...releaseHashes].sort(),
    ),
    attestationsRoot: directoryObservation(
      5,
      "0700",
      "attestations_root",
      attestationHashes.map((hash) => `${hash}.json`).sort(),
    ),
  };
}

function releaseEntry(
  label: string,
  inode: number,
  byteLength = 1_024,
): PlatformReleaseContentStoreReleaseCensusEntryV3 {
  return {
    manifestPayloadHash: sha(`${label}:manifest-payload`),
    releaseRoot: directoryObservation(
      inode,
      "0555",
      "release_root",
      ["manifest.json"],
    ),
    manifest: observation(
      "ordinary_file",
      inode + 1,
      "0444",
      `${label}:manifest-file`,
      byteLength,
    ),
  };
}

function attestationEntry(
  label: string,
  releaseContentHash: string,
  inode: number,
  byteLength = 512,
): PlatformReleaseContentStoreAttestationCensusEntryV3 {
  return {
    attestationHash: sha(`${label}:attestation`),
    releaseContentHash,
    attestation: observation(
      "ordinary_file",
      inode,
      "0444",
      `${label}:attestation-file`,
      byteLength,
    ),
  };
}

function sortedReleases(
  entries: readonly PlatformReleaseContentStoreReleaseCensusEntryV3[],
): PlatformReleaseContentStoreReleaseCensusEntryV3[] {
  return [...entries].sort((left, right) =>
    left.manifestPayloadHash < right.manifestPayloadHash
      ? -1
      : left.manifestPayloadHash > right.manifestPayloadHash ? 1 : 0);
}

function sortedAttestations(
  entries: readonly PlatformReleaseContentStoreAttestationCensusEntryV3[],
): PlatformReleaseContentStoreAttestationCensusEntryV3[] {
  return [...entries].sort((left, right) =>
    left.attestationHash < right.attestationHash
      ? -1
      : left.attestationHash > right.attestationHash ? 1 : 0);
}

function twoReleaseThreeAttestationCensus(): PlatformReleaseContentStoreGlobalCensusV3 {
  const first = releaseEntry("release-a", 100);
  const second = releaseEntry("release-b", 200);
  const releaseEntries = sortedReleases([first, second]);
  const attestationEntries = sortedAttestations([
    attestationEntry("attestation-a1", first.manifestPayloadHash, 300),
    attestationEntry("attestation-a2", first.manifestPayloadHash, 301),
    attestationEntry("attestation-b1", second.manifestPayloadHash, 302),
  ]);
  return buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: HOST_HASH,
    persistentAnchors: persistentAnchors(
      releaseEntries.map((entry) => entry.manifestPayloadHash),
      attestationEntries.map((entry) => entry.attestationHash),
    ),
    releaseEntries,
    attestationEntries,
  });
}

function appendThirdRelease(
  baseline: PlatformReleaseContentStoreGlobalCensusV3,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const third = releaseEntry("release-c", 400);
  const releaseEntries = sortedReleases([...baseline.releaseEntries, third]);
  const attestationEntries = sortedAttestations([
    ...baseline.attestationEntries,
    attestationEntry("attestation-c1", third.manifestPayloadHash, 500),
  ]);
  const exactMembershipAnchors = persistentAnchors(
    releaseEntries.map((entry) => entry.manifestPayloadHash),
    attestationEntries.map((entry) => entry.attestationHash),
  );
  const anchors = Object.fromEntries(
    Object.entries(baseline.persistentAnchors).map(([name, anchor], index) => [
      name,
      replaceObservation(anchor, {
        mutableFingerprint: {
          linkCount: anchor.mutableFingerprint.linkCount + 1,
          byteLength: exactMembershipAnchors[
            name as keyof PlatformReleaseContentStorePersistentAnchorsV3
          ].mutableFingerprint.byteLength,
          contentHash: exactMembershipAnchors[
            name as keyof PlatformReleaseContentStorePersistentAnchorsV3
          ].mutableFingerprint.contentHash,
          modifiedTimeNanoseconds: String(2_000_000_000 + index),
          changedTimeNanoseconds: String(2_000_000_100 + index),
        },
      }),
    ]),
  ) as PlatformReleaseContentStorePersistentAnchorsV3;
  return buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: HOST_HASH,
    persistentAnchors: anchors,
    releaseEntries,
    attestationEntries,
  });
}

function replaceEveryOwner(
  source: PlatformReleaseContentStoreGlobalCensusV3,
  ownerUid: number,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const replaceOwner = (entry: PlatformReleaseContentStoreObservationV3) =>
    replaceObservation(entry, { mutableFingerprint: { ownerUid } });
  return buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: source.hostIdentityHash,
    persistentAnchors: Object.fromEntries(
      Object.entries(source.persistentAnchors).map(([name, entry]) => [
        name,
        replaceOwner(entry),
      ]),
    ) as PlatformReleaseContentStorePersistentAnchorsV3,
    releaseEntries: source.releaseEntries.map((entry) => ({
      ...entry,
      releaseRoot: replaceOwner(entry.releaseRoot),
      manifest: replaceOwner(entry.manifest),
    })),
    attestationEntries: source.attestationEntries.map((entry) => ({
      ...entry,
      attestation: replaceOwner(entry.attestation),
    })),
  });
}

describe("platform release content-store global census v3", () => {
  it("admits a bounded two-release, three-attestation census with two occurrences for one release", () => {
    const census = twoReleaseThreeAttestationCensus();
    assert.equal(census.releaseCount, 2);
    assert.equal(census.attestationCount, 3);
    assert.deepEqual(
      census.releaseEntries.map((release) =>
        census.attestationEntries.filter((attestation) =>
          attestation.releaseContentHash === release.manifestPayloadHash).length)
        .sort((left, right) => left - right),
      [1, 2],
    );
    assert.equal(hashPlatformReleaseContentStoreGlobalCensusV3(census), census.censusHash);
    const parsed = parsePlatformReleaseContentStoreGlobalCensusCandidateV3(
      structuredClone(census),
    );
    assert.deepEqual(parsed, census);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.releaseEntries), true);
    assert.equal(Object.isFrozen(parsed.releaseEntries[0]!.manifest), true);
  });

  it("rejects stale or omitted exact directory membership despite valid leaf arrays", () => {
    const census = twoReleaseThreeAttestationCensus();
    const extraReleaseMembership =
      buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
        "releases_root",
        [
          ...census.releaseEntries.map((entry) => entry.manifestPayloadHash),
          sha("unreported-release"),
        ].sort(),
      );
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: census.hostIdentityHash,
      persistentAnchors: {
        ...census.persistentAnchors,
        releasesRoot: replaceObservation(
          census.persistentAnchors.releasesRoot,
          { mutableFingerprint: extraReleaseMembership },
        ),
      },
      releaseEntries: census.releaseEntries,
      attestationEntries: census.attestationEntries,
    }), /exact canonical membership/u);

    const staleReleaseMembership =
      buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
        "releases_root",
        [],
      );
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: census.hostIdentityHash,
      persistentAnchors: {
        ...census.persistentAnchors,
        releasesRoot: replaceObservation(
          census.persistentAnchors.releasesRoot,
          { mutableFingerprint: staleReleaseMembership },
        ),
      },
      releaseEntries: census.releaseEntries,
      attestationEntries: census.attestationEntries,
    }), /exact canonical membership/u);
  });

  it("keeps an old census valid under a pure append despite shared-root membership drift", () => {
    const baseline = twoReleaseThreeAttestationCensus();
    const current = appendThirdRelease(baseline);
    assert.notEqual(current.censusHash, baseline.censusHash);
    assert.notEqual(
      current.persistentAnchors.releasesRoot.observationHash,
      baseline.persistentAnchors.releasesRoot.observationHash,
    );
    assert.equal(
      assertPlatformReleaseContentStoreAppendOnlySupersetV3(baseline, current)
        .censusHash,
      current.censusHash,
    );
  });

  it("rejects removal and exact leaf replacement from an otherwise valid current census", () => {
    const baseline = twoReleaseThreeAttestationCensus();
    const multiplyAttestedRelease = baseline.releaseEntries.find((release) =>
      baseline.attestationEntries.filter((attestation) =>
        attestation.releaseContentHash === release.manifestPayloadHash).length === 2)!;
    const removedAttestation = baseline.attestationEntries.find((attestation) =>
      attestation.releaseContentHash === multiplyAttestedRelease.manifestPayloadHash)!;
    const remainingAttestations = baseline.attestationEntries.filter((entry) =>
      entry.attestationHash !== removedAttestation.attestationHash);
    const afterRemoval = buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: persistentAnchors(
        baseline.releaseEntries.map((entry) => entry.manifestPayloadHash),
        remainingAttestations.map((entry) => entry.attestationHash),
      ),
      releaseEntries: baseline.releaseEntries,
      attestationEntries: remainingAttestations,
    });
    assert.throws(
      () => assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        baseline,
        afterRemoval,
      ),
      /CONTENT_STORE_APPEND_ONLY_VIOLATION/u,
    );

    const replacedRelease = baseline.releaseEntries[0]!;
    const afterReplacement = buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: sortedReleases(baseline.releaseEntries.map((entry) =>
        entry.manifestPayloadHash === replacedRelease.manifestPayloadHash
          ? {
            ...entry,
            manifest: replaceObservation(entry.manifest, {
              stableIdentity: { inode: "999999" },
            }),
          }
          : entry)),
      attestationEntries: baseline.attestationEntries,
    });
    assert.throws(
      () => assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        baseline,
        afterReplacement,
      ),
      /CONTENT_STORE_APPEND_ONLY_VIOLATION/u,
    );
  });

  it("rejects leaf mode, owner, link-count and content fingerprint drift", () => {
    const baseline = twoReleaseThreeAttestationCensus();
    const first = baseline.releaseEntries[0]!;
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: sortedReleases(baseline.releaseEntries.map((entry) =>
        entry.manifestPayloadHash === first.manifestPayloadHash
          ? {
            ...entry,
            manifest: replaceObservation(entry.manifest, {
              mutableFingerprint: { mode: "0400" },
            }),
          }
          : entry)),
      attestationEntries: baseline.attestationEntries,
    }));

    const ownerChanged = replaceEveryOwner(baseline, 502);
    assert.throws(
      () => assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        baseline,
        ownerChanged,
      ),
      /CONTENT_STORE_APPEND_ONLY_VIOLATION/u,
    );

    const linkChanged = buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: sortedReleases(baseline.releaseEntries.map((entry) =>
        entry.manifestPayloadHash === first.manifestPayloadHash
          ? {
            ...entry,
            releaseRoot: replaceObservation(entry.releaseRoot, {
              mutableFingerprint: { linkCount: 2 },
            }),
          }
          : entry)),
      attestationEntries: baseline.attestationEntries,
    });
    assert.throws(
      () => assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        baseline,
        linkChanged,
      ),
      /CONTENT_STORE_APPEND_ONLY_VIOLATION/u,
    );

    const contentChanged = buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: sortedReleases(baseline.releaseEntries.map((entry) =>
        entry.manifestPayloadHash === first.manifestPayloadHash
          ? {
            ...entry,
            manifest: replaceObservation(entry.manifest, {
              mutableFingerprint: { contentHash: sha("different-bytes") },
            }),
          }
          : entry)),
      attestationEntries: baseline.attestationEntries,
    });
    assert.throws(
      () => assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        baseline,
        contentChanged,
      ),
      /CONTENT_STORE_APPEND_ONLY_VIOLATION/u,
    );
  });

  it("rejects orphan attestations, unattested releases, order violations and duplicates", () => {
    const baseline = twoReleaseThreeAttestationCensus();
    const orphan = {
      ...baseline.attestationEntries[0]!,
      releaseContentHash: sha("absent-release"),
    };
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: baseline.releaseEntries,
      attestationEntries: sortedAttestations([
        orphan,
        ...baseline.attestationEntries.slice(1),
      ]),
    }));

    const unattested = releaseEntry("unattested", 600);
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: sortedReleases([...baseline.releaseEntries, unattested]),
      attestationEntries: baseline.attestationEntries,
    }));

    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: [...baseline.releaseEntries].reverse(),
      attestationEntries: baseline.attestationEntries,
    }));
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: baseline.hostIdentityHash,
      persistentAnchors: baseline.persistentAnchors,
      releaseEntries: baseline.releaseEntries,
      attestationEntries: [
        baseline.attestationEntries[0]!,
        baseline.attestationEntries[0]!,
        ...baseline.attestationEntries.slice(1),
      ],
    }));
  });

  it("enforces release, attestation and aggregate content-byte bounds", () => {
    const anchors = persistentAnchors();
    const releases = Array.from(
      { length: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3 + 1 },
      (_, index) => releaseEntry(`bounded-release-${index}`, 1_000 + index * 2, 1),
    );
    const attestations = releases.map((entry, index) =>
      attestationEntry(
        `bounded-attestation-${index}`,
        entry.manifestPayloadHash,
        10_000 + index,
        1,
      ));
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: HOST_HASH,
      persistentAnchors: anchors,
      releaseEntries: sortedReleases(releases),
      attestationEntries: sortedAttestations(attestations),
    }));

    const oneRelease = releaseEntry("attestation-bound-release", 20_000, 1);
    const tooManyAttestations = Array.from(
      {
        length:
          PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3 + 1,
      },
      (_, index) => attestationEntry(
        `attestation-bound-${index}`,
        oneRelease.manifestPayloadHash,
        21_000 + index,
        1,
      ),
    );
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: HOST_HASH,
      persistentAnchors: anchors,
      releaseEntries: [oneRelease],
      attestationEntries: sortedAttestations(tooManyAttestations),
    }));

    const largeRelease = releaseEntry(
      "aggregate-byte-bound-release",
      30_000,
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
    );
    const largeAttestations = Array.from({ length: 8 }, (_, index) =>
      attestationEntry(
        `aggregate-byte-bound-${index}`,
        largeRelease.manifestPayloadHash,
        31_000 + index,
        PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
      ));
    assert.throws(() => buildPlatformReleaseContentStoreGlobalCensusV3({
      hostIdentityHash: HOST_HASH,
      persistentAnchors: anchors,
      releaseEntries: [largeRelease],
      attestationEntries: sortedAttestations(largeAttestations),
    }));
  });

  it("rejects forged census hashes, proxies and accessors without invoking hostile traps", () => {
    const census = twoReleaseThreeAttestationCensus();
    const forged = structuredClone(census) as any;
    forged.censusHash = sha("forged-census");
    assert.throws(() =>
      parsePlatformReleaseContentStoreGlobalCensusCandidateV3(forged));

    let proxyTrapCalls = 0;
    const proxy = new Proxy(census, {
      ownKeys() {
        proxyTrapCalls += 1;
        throw new Error("proxy trap must not run");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseContentStoreGlobalCensusCandidateV3(proxy));
    assert.equal(proxyTrapCalls, 0);

    let accessorCalls = 0;
    const accessor = structuredClone(census) as Record<string, unknown>;
    Object.defineProperty(accessor, "releaseEntries", {
      enumerable: true,
      configurable: true,
      get() {
        accessorCalls += 1;
        throw new Error("accessor must not run");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseContentStoreGlobalCensusCandidateV3(accessor));
    assert.equal(accessorCalls, 0);
  });
});
