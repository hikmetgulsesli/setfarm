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
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
} from "../../src/product-compiler/canonical-json.js";
import {
  CompletedPlatformReleaseStageCandidateV2,
  PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
  PlatformReleaseTerminalWriteV2Error,
  inspectCompletedPlatformReleaseStageCandidateV2,
  terminalWritePlatformReleaseManifestCandidateV2,
} from
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
    const moduleLocators = [
      ...raw.launcherCatalog.entries.map(
        (entry) => entry.module.payloadLocator,
      ),
      ...raw.runnerCatalog.entries.map(
        (entry) => entry.module.payloadLocator,
      ),
    ];
    for (const [index, locator] of moduleLocators.entries()) {
      writeReleaseFile(
        root,
        locator,
        `export const fixtureModule${index} = ${index};\n`,
      );
    }
    writeReleaseFile(
      root,
      `payload/${raw.environmentCapsule.network.authority
        .wrapperModuleLocator}`,
      "export async function runNetworkIsolatedV2() {}\n",
    );
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
  it("recaptures exact bytes and writes the canonical manifest as the terminal durable file", () => {
    const stage = createStage();
    try {
      const handle =
        terminalWritePlatformReleaseManifestCandidateV2({
          stageRoot: stage.root,
          manifest: stage.manifest,
          buildAttestation: stage.buildAttestation,
          metadataProbe: clearMetadata,
        });
      const inspection =
        inspectCompletedPlatformReleaseStageCandidateV2(handle);
      assert.equal(Object.isFrozen(handle), true);
      assert.equal(Object.isFrozen(inspection), true);
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
        Object.prototype.hasOwnProperty.call(inspection, "root"),
        false,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(inspection, "path"),
        false,
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
      assert.equal(
        inspection.manifestCanonicalByteLength,
        expected.byteLength - 1,
      );
    } finally {
      cleanupStage(stage.root);
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
        terminalWritePlatformReleaseManifestCandidateV2({
          stageRoot: first.root,
          manifest: first.manifest,
          buildAttestation: first.buildAttestation,
          metadataProbe: clearMetadata,
        });
      const secondHandle =
        terminalWritePlatformReleaseManifestCandidateV2({
          stageRoot: second.root,
          manifest: second.manifest,
          buildAttestation: secondAttestation,
          metadataProbe: clearMetadata,
        });
      const firstInspection =
        inspectCompletedPlatformReleaseStageCandidateV2(
          firstHandle,
        );
      const secondInspection =
        inspectCompletedPlatformReleaseStageCandidateV2(
          secondHandle,
        );
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
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
      candidate.manifestPayloadHash =
        hashPlatformReleaseManifestV2(candidate);
      assert.equal(
        PlatformReleaseManifestV2Schema.safeParse(candidate).success,
        true,
      );

      expectTerminalError(
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
      expectTerminalError(
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
      () => terminalWritePlatformReleaseManifestCandidateV2(hostile),
      "INPUT_INVALID",
    );
    expectTerminalError(
      () => terminalWritePlatformReleaseManifestCandidateV2({
        stageRoot: "/tmp/missing-attestation",
        manifest: {},
        metadataProbe: clearMetadata,
      }),
      "INPUT_INVALID",
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
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
        () => terminalWritePlatformReleaseManifestCandidateV2({
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
