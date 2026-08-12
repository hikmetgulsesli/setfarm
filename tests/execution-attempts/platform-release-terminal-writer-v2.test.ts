import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  defaultNodeToolchainProvisionerHostIdentityHashV3,
} from
  "../../src/product-compiler/node-toolchain-provisioner-physical-census-v3.js";
import {
  CompletedPlatformReleaseStageCandidateV2,
  PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
  PlatformReleaseTerminalWriteV2Error,
  inspectCompletedPlatformReleaseStageCandidateV2,
  inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2,
  terminalWritePlatformReleaseManifestObservationFailureForTestV2,
  terminalWritePlatformReleaseManifestForTestV2,
} from
  "../../src/execution/platform-release-terminal-writer-v2.js";
import * as terminalWriterV2 from
  "../../src/execution/platform-release-terminal-writer-v2.js";
import {
  PlatformReleaseCandidateEnvelopeV2Schema,
  hashPlatformReleaseBuildAttestationV2,
} from
  "../../src/execution/schemas/platform-release-build-attestation-v2.js";
import {
  PlatformReleaseManifestV2Schema,
  hashPlatformReleaseManifestV2,
} from
  "../../src/execution/schemas/platform-release-manifest-v2.js";
import {
  hashPlatformReleaseModuleRefV2,
  hashPlatformRunnerCatalogEntryV2,
  hashPlatformRunnerCatalogV2,
  hashPlatformRunnerToolchainV2,
} from
  "../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  hashPlatformReleaseRequiredModuleClosureEntryV2,
  hashPlatformReleaseRequiredModuleClosureV2,
} from
  "../../src/execution/schemas/platform-release-required-module-closure-v2.js";
import {
  PlatformReleaseTerminalTestObservationV2Schema,
  hashPlatformReleaseTerminalTestObservationV2,
  parsePlatformReleaseTerminalTestObservationV2,
} from
  "../../src/execution/schemas/platform-release-terminal-test-observation-v2.js";
import {
  bindPlatformReleaseCandidateEnvelopeFixtureToStageV2,
  createDistinctPlatformReleaseBuildAttemptFixtureV2,
  createPlatformReleaseManifestFixtureV2,
  fixtureShaV2,
} from
  "./fixtures/platform-release-manifest-v2-fixture.js";

const clearMetadata = () => ({ status: "clear" as const });

function chmodTreeWritable(root: string): void {
  let stat;
  try {
    stat = lstatSync(root);
  } catch {
    return;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return;
  chmodSync(root, 0o700);
  for (const name of readdirSync(root)) {
    const child = path.join(root, name);
    const childStat = lstatSync(child);
    if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
      chmodTreeWritable(child);
    } else if (childStat.isFile()) {
      chmodSync(child, 0o600);
    }
  }
}

function cleanupStage(root: string): void {
  chmodTreeWritable(root);
  rmSync(root, { recursive: true, force: true });
}

function writeReleaseFile(
  root: string,
  relativeLocator: string,
  content: string,
): void {
  const absolutePath = path.join(root, relativeLocator);
  mkdirSync(path.dirname(absolutePath), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(absolutePath, content, {
    flag: "wx",
    mode: 0o600,
  });
  chmodSync(absolutePath, 0o444);
}

function normalizeDirectoriesReadOnly(root: string): void {
  const children = readdirSync(root);
  for (const name of children) {
    const child = path.join(root, name);
    const stat = lstatSync(child);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      normalizeDirectoriesReadOnly(child);
    }
  }
  chmodSync(root, 0o555);
}

function createStage(): Readonly<{
  root: string;
  manifest: ReturnType<
    typeof bindPlatformReleaseCandidateEnvelopeFixtureToStageV2
  >["manifest"];
  buildAttestation: ReturnType<
    typeof bindPlatformReleaseCandidateEnvelopeFixtureToStageV2
  >["buildAttestation"];
}> {
  const created = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-release-terminal-v2-"),
  );
  const root = realpathSync(created);
  const raw = createPlatformReleaseManifestFixtureV2();
  try {
    mkdirSync(path.join(root, "payload", "dist"), {
      recursive: true,
      mode: 0o700,
    });
    mkdirSync(path.join(root, "payload", "node_modules"), {
      recursive: true,
      mode: 0o700,
    });
    writeReleaseFile(
      root,
      "payload/package.json",
      `${JSON.stringify({
        name: "setfarm",
        type: "module",
        version: "2.3.79",
      })}\n`,
    );
    for (
      const [index, entry]
        of raw.requiredModuleClosure.entries.entries()
    ) {
      const bootstrapSource =
        `fixture-bootstrap-source-${index}`;
      writeReleaseFile(
        root,
        entry.module.payloadLocator,
        `${entry.definition.requiredExports.map(
          (exportContract, exportIndex) =>
            exportContract.kind === "function"
              ? `export function ${exportContract.name}() { return ${exportIndex}; }`
              : `export const ${exportContract.name} = ${JSON.stringify(
                exportContract.name.endsWith("_HASH_V2")
                  ? fixtureShaV2(bootstrapSource)
                  : bootstrapSource,
              )};`,
        ).join("\n")}\n`,
      );
    }
    writeReleaseFile(
      root,
      raw.legacyAssets.stitchConverter.locator,
      "export function convertStitchFixtureV2() {}\n",
    );
    normalizeDirectoriesReadOnly(path.join(root, "payload"));
    chmodSync(root, 0o700);
    const envelope =
      bindPlatformReleaseCandidateEnvelopeFixtureToStageV2(
      root,
      clearMetadata,
    );
    assert.equal(
      PlatformReleaseCandidateEnvelopeV2Schema
        .safeParse(envelope).success,
      true,
    );
    return Object.freeze({
      root,
      manifest: envelope.manifest,
      buildAttestation: envelope.buildAttestation,
    });
  } catch (error) {
    cleanupStage(root);
    throw error;
  }
}

function rewriteReadOnlyFile(
  absolutePath: string,
  content: string,
): void {
  const parent = path.dirname(absolutePath);
  chmodSync(parent, 0o755);
  chmodSync(absolutePath, 0o600);
  writeFileSync(absolutePath, content);
  chmodSync(absolutePath, 0o444);
  chmodSync(parent, 0o555);
}

function attestationForManifest(
  manifest: Readonly<{ manifestPayloadHash: string }>,
  source: unknown,
): any {
  const candidate: any = structuredClone(source);
  candidate.releaseContentHash =
    manifest.manifestPayloadHash;
  candidate.attestationHash =
    hashPlatformReleaseBuildAttestationV2(candidate);
  return candidate;
}

function rebindRequiredModuleClaim(
  manifest: any,
  module: any,
): void {
  const closureEntry =
    manifest.requiredModuleClosure.entries.find(
      (entry: any) =>
        entry.module.moduleLocator === module.moduleLocator,
    );
  assert.ok(closureEntry);
  closureEntry.module = structuredClone(module);
  closureEntry.entryHash =
    hashPlatformReleaseRequiredModuleClosureEntryV2(
      closureEntry,
    );
  manifest.requiredModuleClosure.closureHash =
    hashPlatformReleaseRequiredModuleClosureV2(
      manifest.requiredModuleClosure,
    );
  manifest.runnerCatalog.requiredModuleClosureHash =
    manifest.requiredModuleClosure.closureHash;
  for (const entry of manifest.runnerCatalog.entries) {
    entry.toolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash: manifest.runnerCatalog.platformTreeHash,
      dependencyTreeHash:
        manifest.runnerCatalog.dependencyTreeHash,
      runtimePayloadHash:
        manifest.runnerCatalog.runtimePayloadHash,
      externalResolutionHash:
        manifest.runnerCatalog.externalResolutionHash,
      productionResolutionGraphHash:
        manifest.runnerCatalog.productionResolutionGraphHash,
      environmentCapsuleHash:
        manifest.runnerCatalog.environmentCapsuleHash,
      launcherCatalogHash:
        manifest.runnerCatalog.launcherCatalogHash,
      requiredModuleClosureHash:
        manifest.runnerCatalog.requiredModuleClosureHash,
      transportCodecCatalogHash:
        manifest.runnerCatalog.transportCodecCatalogHash,
      receiptSchemaHash:
        manifest.runnerCatalog.receiptSchemaHash,
      adapterDefinitionCatalogHash:
        manifest.runnerCatalog.adapterDefinitionCatalogHash,
      executionAdmissionHash:
        entry.admission.kind === "invocation"
          ? entry.admission.executionLeaseContractHash
          : entry.abiHash,
    });
    entry.entryHash =
      hashPlatformRunnerCatalogEntryV2(entry);
  }
  manifest.runnerCatalog.catalogHash =
    hashPlatformRunnerCatalogV2(manifest.runnerCatalog);
}

function distinctAttemptAttestation(source: unknown): any {
  return createDistinctPlatformReleaseBuildAttemptFixtureV2(
    source as any,
    "terminal-second-clean-attempt",
  );
}

function expectTerminalError(
  callback: () => unknown,
  code: PlatformReleaseTerminalWriteV2Error["code"],
): void {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof PlatformReleaseTerminalWriteV2Error
      && error.code === code,
  );
}

describe("Platform release terminal manifest writer V2", () => {
  it("pins retained-residue and primary-first descriptor settlement source contracts", () => {
    assert.equal(terminalWritePlatformReleaseManifestForTestV2.length, 1);
    assert.equal(
      terminalWritePlatformReleaseManifestObservationFailureForTestV2.length,
      2,
    );
    assert.equal(
      inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2.length,
      1,
    );
    assert.deepEqual(
      Object.keys(terminalWriterV2).sort(),
      [
        "CompletedPlatformReleaseStageCandidateV2",
        "PLATFORM_RELEASE_MANIFEST_V2_FILENAME",
        "PlatformReleaseTerminalWriteV2Error",
        "inspectCompletedPlatformReleaseStageCandidateV2",
        "inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2",
        "terminalWritePlatformReleaseManifestForTestV2",
        "terminalWritePlatformReleaseManifestObservationFailureForTestV2",
      ],
    );
    const source = readFileSync(
      "src/execution/platform-release-terminal-writer-v2.ts",
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /\bcleanupOwnedTerminalRootV2\b|\brmSync\b|\breaddirSync\b/u,
    );
    assert.match(source, /unlinkSync\(manifestPath\)/u);
    assert.match(
      source,
      /new AggregateError\(\s*errors,[\s\S]*\{ cause: authoritativeError \}/u,
    );
    assert.match(source, /opendirSync\(absolutePath, \{ bufferSize: 1 \}\)/u);
    assert.match(
      source,
      /not an atomic same-UID compare-and-swap/u,
    );
    assert.match(
      source,
      /defaultNodeToolchainProvisionerHostIdentityHashV3\(\)/u,
    );
    assert.match(source, /stat\.uid !== owner\.uid/u);
    assert.match(source, /stat\.gid !== owner\.gid/u);
    assert.match(
      source,
      /constants\.O_RDONLY \| constants\.O_NOFOLLOW \| constants\.O_NONBLOCK/u,
    );
    assert.match(
      source,
      /constants\.O_RDONLY \| constants\.O_DIRECTORY \| constants\.O_NOFOLLOW/u,
    );
    for (const [start, end] of [
      ["function readStableFileV2(", "function bindingFromTreeV2("],
      ["function fsyncDirectoryV2(", "function finalizeRootReadOnlyV2("],
      ["function finalizeRootReadOnlyV2(", "function writeAllV2("],
      ["function terminalWriteManifestV2(", "function completedInspectionV2("],
    ] as const) {
      const scoped = source.slice(source.indexOf(start), source.indexOf(end));
      assert.notEqual(scoped.length, 0);
      assert.doesNotMatch(scoped, /\bfinally\s*\{/u);
    }
    const finalization = source.slice(
      source.indexOf("function finalizeRootReadOnlyV2("),
      source.indexOf("function writeAllV2("),
    );
    const rootReadOnly = finalization.indexOf("fchmodSync(descriptor, 0o555)");
    const closeRollback = finalization.indexOf("onRootReadOnly()", rootReadOnly);
    const postFence = finalization.indexOf(
      "const after = fstatSync(descriptor, { bigint: true })",
      closeRollback,
    );
    assert.equal(rootReadOnly >= 0, true);
    assert.equal(closeRollback > rootReadOnly, true);
    assert.equal(postFence > closeRollback, true);
  });

  it("recaptures exact bytes and writes the canonical manifest as the terminal durable file", () => {
    const stage = createStage();
    try {
      const handle =
        terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        });
      const inspection = handle;
      assert.equal(Object.isFrozen(handle), true);
      assert.equal(Object.isFrozen(inspection), true);
      assert.equal(handle.productionAuthority, false);
      assert.equal(handle.productionAdmission, "forbidden");
      assert.equal(handle.credentialUse, "none");
      assert.equal(handle.mutationAuthority, false);
      assert.equal(handle.trustConclusion, "characterization_only");
      assert.equal(handle.sealedRoot.stableIdentity.objectKind, "directory");
      assert.equal(
        handle.sealedRoot.stableIdentity.hostIdentityHash,
        defaultNodeToolchainProvisionerHostIdentityHashV3(),
      );
      assert.match(handle.sealedRoot.stableIdentity.device, /^(?:0|[1-9][0-9]*)$/u);
      assert.match(handle.sealedRoot.stableIdentity.inode, /^(?:0|[1-9][0-9]*)$/u);
      assert.equal(handle.sealedRoot.mutableFingerprint.mode, "0555");
      assert.equal(Object.isFrozen(handle.sealedRoot), true);
      assert.equal(Object.isFrozen(handle.sealedRoot.stableIdentity), true);
      assert.equal(Object.isFrozen(handle.sealedRoot.mutableFingerprint), true);
      assert.match(handle.sealedRoot.observationHash, /^[a-f0-9]{64}$/u);
      assert.match(handle.sealedRoot.membershipHash, /^[a-f0-9]{64}$/u);
      assert.match(handle.observationHash, /^[a-f0-9]{64}$/u);
      assert.match(
        handle.sealedRoot.mutableFingerprint.modifiedTimeNanoseconds,
        /^(?:0|[1-9][0-9]*)$/u,
      );
      assert.equal(
        Number.isSafeInteger(handle.sealedRoot.mutableFingerprint.linkCount),
        true,
      );
      assert.equal(
        Number.isSafeInteger(handle.sealedRoot.mutableFingerprint.byteLength),
        true,
      );
      assert.equal(handle instanceof CompletedPlatformReleaseStageCandidateV2, false);
      const parsedObservation =
        parsePlatformReleaseTerminalTestObservationV2(structuredClone(handle));
      assert.deepEqual(parsedObservation, handle);
      assert.equal(Object.isFrozen(parsedObservation), true);
      assert.equal(
        PlatformReleaseTerminalTestObservationV2Schema.safeParse(
          structuredClone(handle),
        ).success,
        true,
      );
      assert.equal(JSON.stringify(handle).includes(stage.root), false);
      assert.equal(
        Object.hasOwn(terminalWriterV2, "terminalWritePlatformReleaseManifestCandidateV2"),
        false,
      );
      assert.equal(
        readFileSync(
          "src/execution/platform-release-terminal-writer-v2.ts",
          "utf8",
        ).includes("new CompletedPlatformReleaseStageCandidateV2("),
        false,
      );
      assert.equal(
        inspection.productionUse,
        "forbidden_until_publication_lease_and_fresh_verification",
      );
      assert.equal(
        inspection.manifestPayloadHash,
        stage.manifest.manifestPayloadHash,
      );
      assert.equal(
        inspection.releaseId,
        stage.manifest.manifestPayloadHash,
      );
      assert.equal(
        inspection.buildAttestationHash,
        stage.buildAttestation.attestationHash,
      );
      assert.equal(
        inspection.requiredModuleClosureHash,
        stage.manifest.requiredModuleClosure.closureHash,
      );
      assert.equal(
        inspection.requiredModuleCount,
        stage.manifest.requiredModuleClosure.entries.length,
      );
      const manifestPath = path.join(
        stage.root,
        PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
      );
      const expected = Buffer.from(
        `${canonicalJsonStringify(stage.manifest)}\n`,
        "utf8",
      );
      assert.equal(readFileSync(manifestPath).equals(expected), true);
      assert.equal(
        readFileSync(manifestPath, "utf8").includes(
          stage.buildAttestation.attestationHash,
        ),
        false,
      );
      assert.equal(statSync(manifestPath).mode & 0o7777, 0o444);
      assert.equal(statSync(stage.root).mode & 0o7777, 0o555);
      assert.deepEqual(
        readdirSync(stage.root).sort(),
        [PLATFORM_RELEASE_MANIFEST_V2_FILENAME, "payload"],
      );
      const manifestStat = lstatSync(path.join(
        stage.root,
        PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
      ), { bigint: true });
      const payloadStat = lstatSync(path.join(stage.root, "payload"), {
        bigint: true,
      });
      assert.equal(
        handle.sealedRoot.membershipHash,
        hashCanonicalJson({
          schema: "setfarm.platform-release-terminal-test-sealed-root-membership.v2",
          entries: [
            {
              basename: PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
              objectKind: "ordinary_file",
              device: manifestStat.dev.toString(10),
              inode: manifestStat.ino.toString(10),
            },
            {
              basename: "payload",
              objectKind: "directory",
              device: payloadStat.dev.toString(10),
              inode: payloadStat.ino.toString(10),
            },
          ].sort((left, right) => left.basename.localeCompare(right.basename)),
        }),
      );
      const sealedRootIdentity = {
        stableIdentity: handle.sealedRoot.stableIdentity,
        mutableFingerprint: handle.sealedRoot.mutableFingerprint,
        membershipHash: handle.sealedRoot.membershipHash,
      };
      assert.equal(
        handle.sealedRoot.observationHash,
        hashCanonicalJson({
          schema: "setfarm.platform-release-terminal-test-sealed-root-observation.v2",
          observation: sealedRootIdentity,
        }),
      );
      const { observationHash, ...observationIdentity } = handle;
      assert.equal(
        observationHash,
        hashCanonicalJson({
          schema: "setfarm.platform-release-terminal-test-observation-hash.v2",
          observation: observationIdentity,
        }),
      );
      const forgedObservation = structuredClone(handle) as Record<string, any>;
      forgedObservation.productionAuthority = true;
      delete forgedObservation.observationHash;
      forgedObservation.observationHash =
        hashPlatformReleaseTerminalTestObservationV2(forgedObservation);
      assert.equal(
        PlatformReleaseTerminalTestObservationV2Schema.safeParse(
          forgedObservation,
        ).success,
        false,
      );
      assert.equal(
        inspection.manifestCanonicalByteLength,
        expected.byteLength - 1,
      );
      expectTerminalError(
        () => inspectCompletedPlatformReleaseStageCandidateV2(handle as never),
        "COMPLETED_STAGE_UNAUTHENTICATED",
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("retains a sealed terminal root and authenticates one pathless false-authority receipt on observation failure", () => {
    const stage = createStage();
    const primary = new Error("injected terminal observation failure");
    try {
      let captured: unknown;
      try {
        terminalWritePlatformReleaseManifestObservationFailureForTestV2(
          {
            stageRoot: stage.root,
            manifest: stage.manifest,
            buildAttestation: stage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          primary,
        );
      } catch (error) {
        captured = error;
      }
      assert.equal(captured, primary);

      const rootStat = lstatSync(stage.root, { bigint: true });
      const manifestPath = path.join(
        stage.root,
        PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
      );
      assert.equal(Number(rootStat.mode & 0o7777n), 0o555);
      assert.equal(statSync(manifestPath).mode & 0o7777, 0o444);
      assert.deepEqual(
        readdirSync(stage.root).sort(),
        [PLATFORM_RELEASE_MANIFEST_V2_FILENAME, "payload"],
      );

      const receipt =
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary);
      assert.deepEqual(receipt, {
        schema: "setfarm.platform-release-terminal-retained-residue-receipt.v2",
        version: "2.0.0",
        authorityState:
          "test_fixture_terminalized_observation_failure_retained",
        admissionScope: "test_fixture",
        productionAuthority: false,
        productionAdmission: "forbidden",
        mutationAuthority: false,
        deletionAuthority: false,
        fsMutation: false,
        rootDisposition: "retained_for_external_owner_inspection",
        rootIdentity: {
          hostIdentityHash:
            defaultNodeToolchainProvisionerHostIdentityHashV3(),
          objectKind: "directory",
          device: rootStat.dev.toString(10),
          inode: rootStat.ino.toString(10),
        },
      });
      assert.equal(Object.isFrozen(receipt), true);
      assert.equal(Object.isFrozen(receipt.rootIdentity), true);
      assert.equal(JSON.stringify(receipt).includes(stage.root), false);
      assert.equal(JSON.stringify(receipt).includes("absolutePath"), false);
      assert.equal(
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary),
        receipt,
      );

      for (const unauthenticated of [
        structuredClone(primary),
        new Error(primary.message),
        Object.create(primary),
      ]) {
        expectTerminalError(
          () =>
            inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(
              unauthenticated,
            ),
          "RETAINED_RESIDUE_UNAUTHENTICATED",
        );
      }
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("rejects non-exact observation-failure injections before terminalization without invoking proxy traps", () => {
    const stage = createStage();
    let traps = 0;
    const proxyFailure = new Proxy(new Error("proxy failure"), {
      getPrototypeOf() {
        traps += 1;
        throw new Error("proxy failure prototype trap must not execute");
      },
    });
    try {
      for (const invalidFailure of [
        proxyFailure,
        Object.assign(Object.create(Error.prototype), { message: "forged" }),
        new (class extends Error {})("derived"),
      ]) {
        expectTerminalError(
          () =>
            terminalWritePlatformReleaseManifestObservationFailureForTestV2(
              {
                stageRoot: stage.root,
                manifest: stage.manifest,
                buildAttestation: stage.buildAttestation,
                metadataProbe: clearMetadata,
              },
              invalidFailure,
            ),
          "INPUT_INVALID",
        );
      }
      assert.equal(traps, 0);
      assert.equal(statSync(stage.root).mode & 0o7777, 0o700);
      assert.equal(
        existsSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        false,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("rejects a stage root whose owner is not the effective process owner", () => {
    const stage = createStage();
    const originalGeteuid = process.geteuid;
    try {
      assert.equal(typeof originalGeteuid, "function");
      Object.defineProperty(process, "geteuid", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: () => originalGeteuid() + 1,
      });
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "ROOT_INVALID",
      );
      assert.equal(statSync(stage.root).mode & 0o7777, 0o700);
      assert.equal(
        existsSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        false,
      );
    } finally {
      Object.defineProperty(process, "geteuid", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: originalGeteuid,
      });
      cleanupStage(stage.root);
    }
  });

  it("retains the manifest without pathname rollback after an ambiguous close result", () => {
    const stage = createStage();
    const closeFailure = new Error("injected ambiguous manifest close");
    let closeSettlements = 0;
    try {
      assert.throws(
        () => terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: stage.root,
            manifest: stage.manifest,
            buildAttestation: stage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          {
            afterManifestDescriptorClose: () => {
              closeSettlements += 1;
              throw closeFailure;
            },
          },
        ),
        (error: unknown) => {
          assert.ok(error instanceof PlatformReleaseTerminalWriteV2Error);
          assert.equal(error.code, "MANIFEST_WRITE_FAILED");
          assert.equal(error.cause, closeFailure);
          return true;
        },
      );
      assert.equal(closeSettlements, 1);
      assert.equal(statSync(stage.root).mode & 0o7777, 0o700);
      assert.equal(
        statSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )).mode & 0o7777,
        0o444,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("preserves the primary manifest failure and orders rollback failure after it", () => {
    const stage = createStage();
    const primaryFailure = new Error("injected pre-finalization failure");
    const cleanupFailure = new Error("injected manifest rollback failure");
    try {
      let observed: unknown;
      try {
        terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: stage.root,
            manifest: stage.manifest,
            buildAttestation: stage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          {
            beforeRootReadOnlyFinalization: () => {
              throw primaryFailure;
            },
            beforeManifestRollback: () => {
              throw cleanupFailure;
            },
          },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(observed instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(observed.code, "MANIFEST_WRITE_FAILED");
      assert.ok(observed.cause instanceof AggregateError);
      const aggregate = observed.cause;
      const errors = aggregate.errors as unknown[];
      assert.equal(errors.length, 2);
      assert.ok(errors[0] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[0].code, "MANIFEST_WRITE_FAILED");
      assert.equal(errors[0].cause, primaryFailure);
      assert.ok(errors[1] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[1].code, "CLEANUP_FAILED");
      assert.equal(errors[1].cause, cleanupFailure);
      assert.equal(aggregate.cause, errors[0]);
      assert.equal(
        existsSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        true,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("preserves typed directory primary and close failures with one ordered cause", () => {
    const stage = createStage();
    const closeOnlyStage = createStage();
    const closeFailure = new Error("injected directory close failure");
    try {
      writeReleaseFile(stage.root, "unexpected-entry", "unexpected\n");
      let observed: unknown;
      try {
        terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: stage.root,
            manifest: stage.manifest,
            buildAttestation: stage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          {
            afterDirectoryDescriptorClose: ({ label }) => {
              if (label === "Release root") throw closeFailure;
            },
          },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(observed instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(observed.code, "LAYOUT_INVALID");
      assert.ok(observed.cause instanceof AggregateError);
      const aggregate = observed.cause;
      const errors = aggregate.errors as unknown[];
      assert.equal(errors.length, 2);
      assert.ok(errors[0] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[0].code, "LAYOUT_INVALID");
      assert.ok(errors[1] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[1].code, "LAYOUT_INVALID");
      assert.equal(errors[1].cause, closeFailure);
      assert.equal(aggregate.cause, errors[0]);

      const closeOnlyFailure = new Error("injected close-only failure");
      assert.throws(
        () => terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: closeOnlyStage.root,
            manifest: closeOnlyStage.manifest,
            buildAttestation: closeOnlyStage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          {
            afterDirectoryDescriptorClose: ({ label }) => {
              if (label === "Release root") throw closeOnlyFailure;
            },
          },
        ),
        (error: unknown) => {
          assert.ok(error instanceof PlatformReleaseTerminalWriteV2Error);
          assert.equal(error.code, "LAYOUT_INVALID");
          assert.equal(error.cause, closeOnlyFailure);
          return true;
        },
      );
    } finally {
      cleanupStage(stage.root);
      cleanupStage(closeOnlyStage.root);
    }
  });

  it("descriptor-fences sealed members and authenticates the natural typed failure", () => {
    const stage = createStage();
    const closeFailure = new Error("injected sealed member close failure");
    let swapped = false;
    try {
      let observed: unknown;
      try {
        terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: stage.root,
            manifest: stage.manifest,
            buildAttestation: stage.buildAttestation,
            metadataProbe: clearMetadata,
          },
          {
            afterSealedMembershipDescriptorAdmission: ({
              absolutePath,
              basename,
            }) => {
              if (swapped || basename !== PLATFORM_RELEASE_MANIFEST_V2_FILENAME) {
                return;
              }
              swapped = true;
              const bytes = readFileSync(absolutePath);
              chmodSync(stage.root, 0o700);
              renameSync(absolutePath, `${absolutePath}.retained`);
              writeFileSync(absolutePath, bytes, { flag: "wx", mode: 0o400 });
              chmodSync(absolutePath, 0o444);
              chmodSync(stage.root, 0o555);
            },
            afterSealedMembershipDescriptorClose: ({ basename }) => {
              if (basename === PLATFORM_RELEASE_MANIFEST_V2_FILENAME) {
                throw closeFailure;
              }
            },
          },
        );
      } catch (error) {
        observed = error;
      }
      assert.equal(swapped, true);
      assert.ok(observed instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(observed.code, "ROOT_CHANGED");
      assert.ok(observed.cause instanceof AggregateError);
      const aggregate = observed.cause;
      const errors = aggregate.errors as unknown[];
      assert.equal(errors.length, 2);
      assert.ok(errors[0] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[0].code, "ROOT_CHANGED");
      assert.ok(errors[1] instanceof PlatformReleaseTerminalWriteV2Error);
      assert.equal(errors[1].code, "ROOT_CHANGED");
      assert.equal(errors[1].cause, closeFailure);
      assert.equal(aggregate.cause, errors[0]);
      const receipt =
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(observed);
      assert.equal(
        receipt.rootIdentity.hostIdentityHash,
        defaultNodeToolchainProvisionerHostIdentityHashV3(),
      );
      expectTerminalError(
        () => inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(
          new PlatformReleaseTerminalWriteV2Error(
            observed.code,
            observed.message,
          ),
        ),
        "RETAINED_RESIDUE_UNAUTHENTICATED",
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("totally binds a reused hostile natural error to distinct retained residues", () => {
    const first = createStage();
    const second = createStage();
    const primary = new PlatformReleaseTerminalWriteV2Error(
      "ROOT_CHANGED",
      "reused natural observation failure",
    );
    const hooks = {
      afterSealedMembershipDescriptorClose: ({ basename }: {
        basename: string;
      }) => {
        if (basename === PLATFORM_RELEASE_MANIFEST_V2_FILENAME) throw primary;
      },
    };
    try {
      let firstThrown: unknown;
      try {
        terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: first.root,
            manifest: first.manifest,
            buildAttestation: first.buildAttestation,
            metadataProbe: clearMetadata,
          },
          hooks,
        );
      } catch (error) {
        firstThrown = error;
      }
      assert.equal(firstThrown, primary);
      const firstReceipt =
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary);
      const firstRootStat = lstatSync(first.root, { bigint: true });
      assert.equal(
        firstReceipt.rootIdentity.device,
        firstRootStat.dev.toString(10),
      );
      assert.equal(
        firstReceipt.rootIdentity.inode,
        firstRootStat.ino.toString(10),
      );

      let hostilePropertyReads = 0;
      for (const property of ["code", "message"] as const) {
        Object.defineProperty(primary, property, {
          configurable: true,
          enumerable: false,
          get() {
            hostilePropertyReads += 1;
            throw new Error(`reused error ${property} must not be read`);
          },
        });
      }

      let secondThrown: unknown;
      try {
        terminalWritePlatformReleaseManifestForTestV2(
          {
            stageRoot: second.root,
            manifest: second.manifest,
            buildAttestation: second.buildAttestation,
            metadataProbe: clearMetadata,
          },
          hooks,
        );
      } catch (error) {
        secondThrown = error;
      }
      assert.equal(hostilePropertyReads, 0);
      assert.ok(secondThrown instanceof PlatformReleaseTerminalWriteV2Error);
      assert.notEqual(secondThrown, primary);
      assert.equal(secondThrown.code, "ROOT_CHANGED");
      assert.equal(
        secondThrown.message,
        "ROOT_CHANGED: Repeated natural terminal observation failure retained",
      );
      assert.equal(secondThrown.cause, primary);
      const secondReceipt =
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(
          secondThrown,
        );
      const secondRootStat = lstatSync(second.root, { bigint: true });
      assert.equal(
        secondReceipt.rootIdentity.device,
        secondRootStat.dev.toString(10),
      );
      assert.equal(
        secondReceipt.rootIdentity.inode,
        secondRootStat.ino.toString(10),
      );
      assert.notDeepEqual(firstReceipt.rootIdentity, secondReceipt.rootIdentity);
      assert.equal(
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary),
        firstReceipt,
      );
      for (const [root, receipt] of [
        [first.root, firstReceipt],
        [second.root, secondReceipt],
      ] as const) {
        assert.equal(statSync(root).mode & 0o7777, 0o555);
        assert.equal(receipt.productionAuthority, false);
        assert.equal(receipt.deletionAuthority, false);
        assert.equal(receipt.fsMutation, false);
        assert.equal(JSON.stringify(receipt).includes(root), false);
        assert.equal(JSON.stringify(receipt).includes("absolutePath"), false);
      }
    } finally {
      cleanupStage(first.root);
      cleanupStage(second.root);
    }
  });

  it("rejects reuse of one observation Error before mutating another fixture", () => {
    const first = createStage();
    const second = createStage();
    const primary = new Error("single-use observation failure");
    try {
      assert.throws(
        () => terminalWritePlatformReleaseManifestObservationFailureForTestV2(
          {
            stageRoot: first.root,
            manifest: first.manifest,
            buildAttestation: first.buildAttestation,
            metadataProbe: clearMetadata,
          },
          primary,
        ),
        (error: unknown) => error === primary,
      );
      const firstReceipt =
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary);
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestObservationFailureForTestV2(
          {
            stageRoot: second.root,
            manifest: second.manifest,
            buildAttestation: second.buildAttestation,
            metadataProbe: clearMetadata,
          },
          primary,
        ),
        "INPUT_INVALID",
      );
      assert.equal(
        inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(primary),
        firstReceipt,
      );
      assert.equal(statSync(second.root).mode & 0o7777, 0o700);
      assert.equal(
        existsSync(path.join(
          second.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        false,
      );
    } finally {
      cleanupStage(first.root);
      cleanupStage(second.root);
    }
  });

  it("converges distinct build attempts on one byte-identical release root", () => {
    const first = createStage();
    const second = createStage();
    try {
      const secondAttestation =
        distinctAttemptAttestation(second.buildAttestation);
      assert.notEqual(
        secondAttestation.attestationHash,
        first.buildAttestation.attestationHash,
      );
      const firstHandle =
        terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: first.root,
          manifest: first.manifest,
          buildAttestation: first.buildAttestation,
          metadataProbe: clearMetadata,
        });
      const secondHandle =
        terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: second.root,
          manifest: second.manifest,
          buildAttestation: secondAttestation,
          metadataProbe: clearMetadata,
        });
      const firstInspection = firstHandle;
      const secondInspection = secondHandle;
      assert.equal(firstHandle.releaseId, secondHandle.releaseId);
      assert.equal(
        firstInspection.manifestPayloadHash,
        secondInspection.manifestPayloadHash,
      );
      assert.notEqual(
        firstInspection.buildAttestationHash,
        secondInspection.buildAttestationHash,
      );
      assert.equal(
        readFileSync(path.join(
          first.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )).equals(readFileSync(path.join(
          second.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        ))),
        true,
      );
      assert.deepEqual(
        readdirSync(first.root).sort(),
        [PLATFORM_RELEASE_MANIFEST_V2_FILENAME, "payload"],
      );
      assert.deepEqual(
        readdirSync(second.root).sort(),
        [PLATFORM_RELEASE_MANIFEST_V2_FILENAME, "payload"],
      );
    } finally {
      cleanupStage(first.root);
      cleanupStage(second.root);
    }
  });

  it("rejects fresh runtime-tree drift before creating a manifest", () => {
    const stage = createStage();
    try {
      const dist = path.join(stage.root, "payload", "dist");
      chmodSync(dist, 0o755);
      writeReleaseFile(
        stage.root,
        "payload/dist/unmanifested.js",
        "export const drift = true;\n",
      );
      chmodSync(dist, 0o555);
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "RUNTIME_TREE_MISMATCH",
      );
      assert.equal(
        readdirSync(stage.root).includes(
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        ),
        false,
      );
      assert.equal(statSync(stage.root).mode & 0o7777, 0o700);
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("bounds stage membership before materializing a polluted namespace", () => {
    const implementationSource = readFileSync(
      "src/execution/platform-release-terminal-writer-v2.ts",
      "utf8",
    );
    assert.match(
      implementationSource,
      /opendirSync\(absolutePath, \{ bufferSize: 1 \}\)/u,
    );
    assert.match(
      implementationSource,
      /names\.length >= maximumEntries/u,
    );

    const stage = createStage();
    try {
      chmodSync(stage.root, 0o700);
      for (let index = 0; index < 64; index += 1) {
        writeFileSync(
          path.join(stage.root, `unexpected-${index.toString().padStart(2, "0")}`),
          "unexpected\n",
          { flag: "wx", mode: 0o600 },
        );
      }
      chmodSync(stage.root, 0o700);

      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "LAYOUT_INVALID",
      );
      assert.equal(
        existsSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        false,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("rejects a coherent catalog claim whose module bytes are absent from the captured tree", () => {
    const stage = createStage();
    try {
      const candidate: any = structuredClone(stage.manifest);
      const entry = candidate.runnerCatalog.entries[0];
      entry.module.contentHash = fixtureShaV2(
        "claimed-but-absent-module-bytes",
      );
      entry.module.moduleRefHash =
        hashPlatformReleaseModuleRefV2(entry.module);
      entry.toolchainHash = hashPlatformRunnerToolchainV2({
        runnerEntrypointRef: entry.runnerEntrypointRef,
        runnerModuleHash: entry.module.contentHash,
        runnerAbiHash: entry.abiHash,
        platformTreeHash: candidate.runnerCatalog.platformTreeHash,
        dependencyTreeHash:
          candidate.runnerCatalog.dependencyTreeHash,
        runtimePayloadHash:
          candidate.runnerCatalog.runtimePayloadHash,
        externalResolutionHash:
          candidate.runnerCatalog.externalResolutionHash,
        productionResolutionGraphHash:
          candidate.runnerCatalog.productionResolutionGraphHash,
        environmentCapsuleHash:
          candidate.runnerCatalog.environmentCapsuleHash,
        launcherCatalogHash:
          candidate.runnerCatalog.launcherCatalogHash,
        requiredModuleClosureHash:
          candidate.runnerCatalog.requiredModuleClosureHash,
        transportCodecCatalogHash:
          candidate.runnerCatalog.transportCodecCatalogHash,
        receiptSchemaHash:
          candidate.runnerCatalog.receiptSchemaHash,
        adapterDefinitionCatalogHash:
          candidate.runnerCatalog.adapterDefinitionCatalogHash,
        executionAdmissionHash:
          entry.admission.executionLeaseContractHash,
      });
      entry.entryHash =
        hashPlatformRunnerCatalogEntryV2(entry);
      candidate.runnerCatalog.catalogHash =
        hashPlatformRunnerCatalogV2(candidate.runnerCatalog);
      rebindRequiredModuleClaim(candidate, entry.module);
      candidate.manifestPayloadHash =
        hashPlatformReleaseManifestV2(candidate);
      assert.equal(
        PlatformReleaseManifestV2Schema.safeParse(candidate).success,
        true,
      );

      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: candidate,
          buildAttestation: attestationForManifest(
            candidate,
            stage.buildAttestation,
          ),
          metadataProbe: clearMetadata,
        }),
        "MODULE_BYTES_MISMATCH",
      );
      assert.equal(
        readdirSync(stage.root).includes(
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        ),
        false,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("rejects a coherent noncatalog module claim whose bytes are absent from the captured tree", () => {
    const stage = createStage();
    try {
      const candidate: any = structuredClone(stage.manifest);
      const closureEntry =
        candidate.requiredModuleClosure.entries.find(
          (entry: any) =>
            entry.definition.role === "codec_runtime",
        );
      assert.ok(closureEntry);
      const module = structuredClone(closureEntry.module);
      module.contentHash = fixtureShaV2(
        "claimed-but-absent-codec-runtime-bytes",
      );
      module.moduleRefHash =
        hashPlatformReleaseModuleRefV2(module);
      rebindRequiredModuleClaim(candidate, module);
      candidate.manifestPayloadHash =
        hashPlatformReleaseManifestV2(candidate);
      assert.equal(
        PlatformReleaseManifestV2Schema.safeParse(candidate).success,
        true,
      );

      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: candidate,
          buildAttestation: attestationForManifest(
            candidate,
            stage.buildAttestation,
          ),
          metadataProbe: clearMetadata,
        }),
        "MODULE_BYTES_MISMATCH",
      );
      assert.equal(
        readdirSync(stage.root).includes(
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        ),
        false,
      );
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("rejects package drift and a pre-existing terminal file without replacing either", () => {
    const packageStage = createStage();
    try {
      rewriteReadOnlyFile(
        path.join(packageStage.root, "payload", "package.json"),
        "{\"name\":\"changed\"}\n",
      );
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: packageStage.root,
          manifest: packageStage.manifest,
          buildAttestation:
            packageStage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "PACKAGE_JSON_MISMATCH",
      );
    } finally {
      cleanupStage(packageStage.root);
    }

    const occupiedStage = createStage();
    try {
      writeReleaseFile(
        occupiedStage.root,
        PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        "{}\n",
      );
      writeReleaseFile(
        occupiedStage.root,
        "unexpected-after-manifest",
        "unexpected\n",
      );
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: occupiedStage.root,
          manifest: occupiedStage.manifest,
          buildAttestation:
            occupiedStage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "MANIFEST_ALREADY_PRESENT",
      );
      assert.equal(
        readFileSync(path.join(
          occupiedStage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        ), "utf8"),
        "{}\n",
      );
    } finally {
      cleanupStage(occupiedStage.root);
    }
  });

  it("rejects hostile inputs and forged completed-stage handles", () => {
    let traps = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        traps += 1;
        throw new Error("terminal writer proxy trap must not execute");
      },
    });
    expectTerminalError(
      () => terminalWritePlatformReleaseManifestForTestV2(hostile),
      "INPUT_INVALID",
    );
    expectTerminalError(
      () => terminalWritePlatformReleaseManifestForTestV2({
        stageRoot: path.join(
          os.tmpdir(),
          "setfarm-release-terminal-v2-missing-attestation",
        ),
        manifest: {},
        metadataProbe: clearMetadata,
      }),
      "INPUT_INVALID",
    );
    expectTerminalError(
      () => terminalWritePlatformReleaseManifestForTestV2({
        stageRoot: path.join(os.tmpdir(), "foreign-terminal-fixture"),
        manifest: {},
        buildAttestation: {},
        metadataProbe: clearMetadata,
      }),
      "ROOT_INVALID",
    );
    assert.equal(traps, 0);
    expectTerminalError(
      () => new CompletedPlatformReleaseStageCandidateV2(
        {},
        fixtureShaV2("forged"),
      ),
      "COMPLETED_STAGE_UNAUTHENTICATED",
    );
    const structural = Object.create(
      CompletedPlatformReleaseStageCandidateV2.prototype,
    );
    structural.releaseId = fixtureShaV2("structural");
    expectTerminalError(
      () =>
        inspectCompletedPlatformReleaseStageCandidateV2(structural),
      "COMPLETED_STAGE_UNAUTHENTICATED",
    );
  });

  it("removes the terminal file when the post-fsync source fence detects a race", () => {
    const stage = createStage();
    try {
      let mutated = false;
      const racedModule = path.join(
        stage.root,
        stage.manifest.runnerCatalog.entries[0].module.payloadLocator,
      );
      const metadataProbe = () => {
        if (
          !mutated
          && existsSync(path.join(
            stage.root,
            PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
          ))
        ) {
          mutated = true;
          rewriteReadOnlyFile(
            racedModule,
            "export const racedAfterManifestFsync = true;\n",
          );
        }
        return { status: "clear" as const };
      };
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe,
        }),
        "RUNTIME_TREE_MISMATCH",
      );
      assert.equal(mutated, true);
      assert.equal(
        existsSync(path.join(
          stage.root,
          PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
        )),
        false,
      );
      assert.equal(statSync(stage.root).mode & 0o7777, 0o700);
    } finally {
      cleanupStage(stage.root);
    }
  });

  it("does not accept a lying manifest hash even when stage bytes are otherwise unchanged", () => {
    const stage = createStage();
    try {
      const candidate: any = structuredClone(stage.manifest);
      candidate.manifestPayloadHash = fixtureShaV2("wrong-root");
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestForTestV2({
          stageRoot: stage.root,
          manifest: candidate,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        }),
        "INPUT_INVALID",
      );
    } finally {
      cleanupStage(stage.root);
    }
  });
});
