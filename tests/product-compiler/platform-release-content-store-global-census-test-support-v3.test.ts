import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  spawnSync,
} from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
} from "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_DESCRIPTOR_CAPABILITY_TEST_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS,
  assertPlatformReleaseContentStoreGlobalCensusContentFileSizesForTestV3,
  capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3,
  parsePlatformReleaseContentStoreGlobalCensusRejoinTestCandidateV3,
  rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3,
} from "../../src/product-compiler/platform-release-content-store-global-census-test-support-v3.js";
import {
  hashPlatformReleaseBuildAttestationV2,
  type PlatformReleaseBuildAttestationV2,
} from "../../src/execution/schemas/platform-release-build-attestation-v2.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3,
  type PlatformReleaseContentStoreGlobalCensusV3,
} from "../../src/execution/schemas/platform-release-content-store-census-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
  buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3,
  hashPlatformReleaseContentStoreCandidateDeltaTestV3,
  hashPlatformReleaseContentStoreCandidateTestV3,
  hashPlatformReleaseContentStorePublisherPreflightTestV3,
  parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3,
  type PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3,
} from "../../src/execution/schemas/platform-release-content-store-test-v3.js";
import {
  hashPlatformReleaseManifestV2,
  type PlatformReleaseManifestV2,
} from "../../src/execution/schemas/platform-release-manifest-v2.js";
import {
  createDistinctPlatformReleaseBuildAttemptFixtureV2,
  createPlatformReleaseCandidateEnvelopeFixtureV2,
} from "../execution-attempts/fixtures/platform-release-manifest-v2-fixture.js";

const SUPPORTED_PLATFORM = process.platform === "darwin" || process.platform === "linux";

type CandidatePairV3 = Readonly<{
  manifest: PlatformReleaseManifestV2;
  attestation: PlatformReleaseBuildAttestationV2;
}>;

type StoreFixtureV3 = Readonly<{
  root: string;
  rootDescriptor: number;
  emptyBaseline: PlatformReleaseContentStoreGlobalCensusV3;
  initial: CandidatePairV3;
  dispose(): void;
}>;

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJsonStringify(value), "utf8");
}

function writeCanonicalLeaf(absolutePath: string, value: unknown): void {
  writeFileSync(absolutePath, canonicalBytes(value), {
    flag: "wx",
    mode: 0o444,
  });
  chmodSync(absolutePath, 0o444);
}

function publishPair(root: string, pair: CandidatePairV3): void {
  const releaseRoot = path.join(
    root,
    "releases",
    pair.manifest.manifestPayloadHash,
  );
  mkdirSync(releaseRoot, { mode: 0o700 });
  chmodSync(releaseRoot, 0o700);
  writeCanonicalLeaf(path.join(releaseRoot, "manifest.json"), pair.manifest);
  chmodSync(releaseRoot, 0o555);
  writeCanonicalLeaf(
    path.join(root, "attestations", `${pair.attestation.attestationHash}.json`),
    pair.attestation,
  );
}

function publishAttestation(
  root: string,
  attestation: PlatformReleaseBuildAttestationV2,
): void {
  writeCanonicalLeaf(
    path.join(root, "attestations", `${attestation.attestationHash}.json`),
    attestation,
  );
}

function createSecondRelease(source: CandidatePairV3): CandidatePairV3 {
  const manifest = structuredClone(source.manifest) as any;
  manifest.release.packageVersion = "2.3.80";
  manifest.manifestPayloadHash = hashPlatformReleaseManifestV2(manifest);
  const attestation = structuredClone(source.attestation) as any;
  attestation.releaseContentHash = manifest.manifestPayloadHash;
  attestation.attestationHash = hashPlatformReleaseBuildAttestationV2(attestation);
  return { manifest, attestation };
}

function removeStoreFixtureRoot(root: string): void {
  for (const releaseName of readdirSync(path.join(root, "releases"))) {
    chmodSync(path.join(root, "releases", releaseName), 0o700);
  }
  rmSync(root, { recursive: true, force: true });
}

function createSemanticallyMismatchedRelease(
  source: CandidatePairV3,
): CandidatePairV3 {
  const manifest = structuredClone(source.manifest) as any;
  manifest.build.sourceDateEpoch = String(
    BigInt(manifest.build.sourceDateEpoch) + 1n,
  );
  manifest.manifestPayloadHash = hashPlatformReleaseManifestV2(manifest);
  const attestation = structuredClone(source.attestation) as any;
  attestation.releaseContentHash = manifest.manifestPayloadHash;
  attestation.attestationHash = hashPlatformReleaseBuildAttestationV2(attestation);
  return { manifest, attestation };
}

function createStoreFixture(): StoreFixtureV3 {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-global-content-store-census-v3-"),
  );
  chmodSync(root, 0o700);
  for (const name of [".locks", ".staging", "releases", "attestations"]) {
    const child = path.join(root, name);
    mkdirSync(child, { mode: 0o700 });
    chmodSync(child, 0o700);
  }
  const envelope = createPlatformReleaseCandidateEnvelopeFixtureV2();
  const initial = {
    manifest: envelope.manifest,
    attestation: envelope.buildAttestation,
  };
  const rootDescriptor = openSync(
    root,
    fsConstants.O_RDONLY
      | (fsConstants.O_DIRECTORY ?? 0)
      | (fsConstants.O_NOFOLLOW ?? 0),
  );
  let emptyBaseline: PlatformReleaseContentStoreGlobalCensusV3;
  try {
    emptyBaseline =
      capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        rootDescriptor,
      );
    publishPair(root, initial);
  } catch (error) {
    closeSync(rootDescriptor);
    removeStoreFixtureRoot(root);
    throw error;
  }
  let disposed = false;
  return Object.freeze({
    root,
    rootDescriptor,
    emptyBaseline,
    initial,
    dispose() {
      if (disposed) return;
      disposed = true;
      closeSync(rootDescriptor);
      removeStoreFixtureRoot(root);
    },
  });
}

function buildLeafReceiptForPublishedCensus(
  baseline: PlatformReleaseContentStoreGlobalCensusV3,
  published: PlatformReleaseContentStoreGlobalCensusV3,
) {
  const release = published.releaseEntries[0]!;
  const attestation = published.attestationEntries[0]!;
  const candidateIdentity = {
    manifestPayloadHash: release.manifestPayloadHash,
    attestationHash: attestation.attestationHash,
    releaseContentHash: attestation.releaseContentHash,
    manifestFileContentHash: release.manifest.mutableFingerprint.contentHash,
    attestationFileContentHash:
      attestation.attestation.mutableFingerprint.contentHash,
    manifestByteLength: release.manifest.mutableFingerprint.byteLength,
    attestationByteLength:
      attestation.attestation.mutableFingerprint.byteLength,
  };
  const candidate = {
    ...candidateIdentity,
    candidateHash:
      hashPlatformReleaseContentStoreCandidateTestV3(candidateIdentity),
  };
  const deltaIdentity = {
    addedReleaseCount: 1,
    addedAttestationCount: 1,
    addedContentBytes:
      candidate.manifestByteLength + candidate.attestationByteLength,
  };
  const identity: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
    version: "3.0.0",
    admissionScope: "test_fixture",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    trustConclusion: "characterization_only",
    productionBlockers: [...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS],
    authorityState: "test_fixture_publisher_preflight_unverified",
    operationMode: "test_fixture_preflight_only",
    baselineCensus: baseline,
    candidateFinalCensus: published,
    candidate,
    disposition: "append_candidate_delta",
    delta: {
      ...deltaIdentity,
      deltaHash:
        hashPlatformReleaseContentStoreCandidateDeltaTestV3(deltaIdentity),
    },
    expectedFinalCensusHash: published.censusHash,
  };
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3({
      ...identity,
      preflightHash:
        hashPlatformReleaseContentStorePublisherPreflightTestV3(identity),
    });
  return buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(
    preflight,
  );
}

function appendMultiReleaseOccurrences(fixture: StoreFixtureV3): Readonly<{
  secondAttestation: PlatformReleaseBuildAttestationV2;
  secondRelease: CandidatePairV3;
}> {
  const secondAttestation = createDistinctPlatformReleaseBuildAttemptFixtureV2(
    fixture.initial.attestation,
    "global-census-v3-second-occurrence",
  );
  publishAttestation(fixture.root, secondAttestation);
  const secondRelease = createSecondRelease(fixture.initial);
  publishPair(fixture.root, secondRelease);
  return { secondAttestation, secondRelease };
}

describe("descriptor-anchored global content-store census test support v3", () => {
  it("captures multi-release occurrences and rejoins a cloned full leaf receipt", {
    skip: !SUPPORTED_PLATFORM,
  }, (context) => {
    const fixture = createStoreFixture();
    context.after(() => fixture.dispose());
    const published =
      capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        fixture.rootDescriptor,
      );
    const leafReceipt = buildLeafReceiptForPublishedCensus(
      fixture.emptyBaseline,
      published,
    );
    const immutableBefore = canonicalJsonStringify(leafReceipt);
    appendMultiReleaseOccurrences(fixture);

    const clonedReceipt = structuredClone(leafReceipt);
    const rejoin =
      rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3(
        fixture.rootDescriptor,
        clonedReceipt,
      );
    assert.equal(rejoin.productionAuthority, false);
    assert.equal(rejoin.productionAdmission, "forbidden");
    assert.equal(rejoin.mutationAuthority, false);
    assert.equal(
      rejoin.descriptorCapability,
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_DESCRIPTOR_CAPABILITY_TEST_V3,
    );
    assert.deepEqual(
      rejoin.productionBlockers,
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS,
    );
    assert.equal(rejoin.currentCensus.releaseCount, 2);
    assert.equal(rejoin.currentCensus.attestationCount, 3);
    assert.deepEqual(
      rejoin.currentCensus.releaseEntries.map((release) =>
        rejoin.currentCensus.attestationEntries.filter((attestation) =>
          attestation.releaseContentHash === release.manifestPayloadHash).length)
        .sort((left, right) => left - right),
      [1, 2],
    );
    assert.equal(canonicalJsonStringify(leafReceipt), immutableBefore);
    assert.equal(Object.isFrozen(leafReceipt), true);
    assert.equal(Object.isFrozen(rejoin), true);
    assert.equal(Object.isFrozen(rejoin.currentCensus.releaseEntries), true);

    const jsonRoundTrip = JSON.parse(JSON.stringify(leafReceipt));
    const secondRejoin =
      rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3(
        fixture.rootDescriptor,
        jsonRoundTrip,
      );
    assert.deepEqual(secondRejoin.currentCensus, rejoin.currentCensus);
    assert.notStrictEqual(secondRejoin, rejoin);
  });

  it("rejoins after restart through one inherited root descriptor", {
    skip: !SUPPORTED_PLATFORM,
  }, (context) => {
    const fixture = createStoreFixture();
    context.after(() => fixture.dispose());
    const published =
      capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        fixture.rootDescriptor,
      );
    const leafReceipt = buildLeafReceiptForPublishedCensus(
      fixture.emptyBaseline,
      published,
    );
    appendMultiReleaseOccurrences(fixture);
    const moduleUrl = pathToFileURL(path.resolve(
      "src/product-compiler/platform-release-content-store-global-census-test-support-v3.ts",
    )).href;
    const childSource = `
      import { readFileSync } from "node:fs";
      import {
        rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3,
      } from ${JSON.stringify(moduleUrl)};
      const receipt = JSON.parse(readFileSync(0, "utf8"));
      const rejoin =
        rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3(
          3,
          receipt,
        );
      process.stdout.write(JSON.stringify(rejoin));
    `;
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", childSource],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: JSON.stringify(leafReceipt),
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe", fixture.rootDescriptor],
      },
    );
    assert.equal(child.status, 0, child.stderr);
    const rejoin =
      parsePlatformReleaseContentStoreGlobalCensusRejoinTestCandidateV3(
        JSON.parse(child.stdout),
      );
    assert.equal(rejoin.rootDescriptorNumber, 3);
    assert.equal(
      rejoin.descriptorAnchor,
      process.platform === "darwin"
        ? "darwin_f_getpath_joined_to_inherited_fd"
        : "linux_proc_self_fd",
    );
    assert.equal(rejoin.currentCensus.releaseCount, 2);
    assert.equal(rejoin.currentCensus.attestationCount, 3);
    assert.equal(
      rejoin.rootStableIdentity.inode,
      published.persistentAnchors.storeRoot.stableIdentity.inode,
    );
  });

  it("rejects non-canonical leaves, non-empty ephemeral roots and removals", {
    skip: !SUPPORTED_PLATFORM,
  }, (context) => {
    const nonCanonical = createStoreFixture();
    context.after(() => nonCanonical.dispose());
    const releaseRoot = path.join(
      nonCanonical.root,
      "releases",
      nonCanonical.initial.manifest.manifestPayloadHash,
    );
    const manifestPath = path.join(releaseRoot, "manifest.json");
    chmodSync(releaseRoot, 0o700);
    unlinkSync(manifestPath);
    writeFileSync(
      manifestPath,
      `${canonicalJsonStringify(nonCanonical.initial.manifest)}\n`,
      { flag: "wx", mode: 0o444 },
    );
    chmodSync(manifestPath, 0o444);
    chmodSync(releaseRoot, 0o555);
    assert.throws(
      () => capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        nonCanonical.rootDescriptor,
      ),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID/u,
    );

    const polluted = createStoreFixture();
    context.after(() => polluted.dispose());
    writeFileSync(path.join(polluted.root, ".locks", "unexpected"), "x", {
      flag: "wx",
      mode: 0o600,
    });
    assert.throws(
      () => capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        polluted.rootDescriptor,
      ),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID/u,
    );

    const semanticMismatch = createStoreFixture();
    context.after(() => semanticMismatch.dispose());
    publishPair(
      semanticMismatch.root,
      createSemanticallyMismatchedRelease(semanticMismatch.initial),
    );
    assert.throws(
      () => capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        semanticMismatch.rootDescriptor,
      ),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID/u,
    );

    const removed = createStoreFixture();
    context.after(() => removed.dispose());
    const published =
      capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        removed.rootDescriptor,
      );
    const leafReceipt = buildLeafReceiptForPublishedCensus(
      removed.emptyBaseline,
      published,
    );
    const secondOccurrence = createDistinctPlatformReleaseBuildAttemptFixtureV2(
      removed.initial.attestation,
      "global-census-v3-surviving-occurrence",
    );
    publishAttestation(removed.root, secondOccurrence);
    unlinkSync(path.join(
      removed.root,
      "attestations",
      `${removed.initial.attestation.attestationHash}.json`,
    ));
    assert.throws(
      () => rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3(
        removed.rootDescriptor,
        leafReceipt,
      ),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_RECEIPT_INVALID/u,
    );
  });

  it("rejects an over-bound release namespace before leaf traversal", {
    skip: !SUPPORTED_PLATFORM,
  }, (context) => {
    const fixture = createStoreFixture();
    context.after(() => fixture.dispose());
    const releasesRoot = path.join(fixture.root, "releases");
    for (
      let index = 0;
      index < PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3;
      index += 1
    ) {
      const releaseRoot = path.join(releasesRoot, sha(`over-bound-${index}`));
      mkdirSync(releaseRoot, { mode: 0o555 });
      chmodSync(releaseRoot, 0o555);
    }
    assert.throws(
      () => capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
        fixture.rootDescriptor,
      ),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID/u,
    );
  });

  it("rejects the first byte beyond the aggregate content budget", () => {
    const maximumFileBytes =
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3;
    assert.doesNotThrow(() =>
      assertPlatformReleaseContentStoreGlobalCensusContentFileSizesForTestV3(
        Array.from({ length: 8 }, () => maximumFileBytes),
      )
    );
    assert.throws(
      () =>
        assertPlatformReleaseContentStoreGlobalCensusContentFileSizesForTestV3([
          ...Array.from({ length: 8 }, () => maximumFileBytes),
          1,
        ]),
      /CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID:.*aggregate content byte budget/u,
    );
  });
});
