import assert from "node:assert/strict";
import {
  chmod,
  link,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { afterEach, describe, it } from "node:test";

import {
  PlatformReleaseHostCompositionAuthorityErrorV2,
  PlatformReleaseHostCompositionAuthorityV2,
  createPlatformReleaseHostCompositionAuthorityV2ForTest,
  inspectPlatformReleaseHostCompositionReceiptV2,
  isProductionPlatformReleaseHostCompositionAuthorityV2,
  openPlatformReleaseHostCompositionAuthorityV2Internal,
  revalidatePlatformReleaseHostCompositionAuthorityV2,
} from
  "../../src/execution/platform-release-host-composition-authority-v2.js";
import * as hostCompositionAuthorityV2 from
  "../../src/execution/platform-release-host-composition-authority-v2.js";
import {
  canonicalJsonStringify,
} from
  "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
  PlatformReleaseHostCompositionReceiptV2Schema,
  hashPlatformReleaseHostCompositionHostIdentityV2,
  hashPlatformReleaseHostCompositionPlatformProjectionV2,
  getPlatformReleaseHostCompositionRequirementV2,
  parsePlatformReleaseHostCompositionReceiptCandidateV2,
  type PlatformReleaseHostCompositionPlatformProjectionV2,
  type PlatformReleaseHostCompositionReceiptV2,
} from
  "../../src/execution/schemas/platform-release-host-composition-v2.js";
import * as hostCompositionSchemaV2 from
  "../../src/execution/schemas/platform-release-host-composition-v2.js";
import {
  materializePlatformReleaseHostCompositionFixtureV2,
} from
  "./helpers/platform-release-host-composition-fixture-v2.js";

const cleanupRoots: string[] = [];

function platformHostV2():
PlatformReleaseHostCompositionPlatformProjectionV2 {
  const host = Object.freeze({
    platform: "darwin" as const,
    architecture: "arm64" as const,
    macosProductVersion: "26.5.2",
    macosBuildVersion: "25F84",
    darwinKernelRelease: "25.5.0",
  });
  const identity = {
    schema:
      PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
    platformHostToolchainReceiptHash: "a".repeat(64),
    host,
    hostIdentityHash:
      hashPlatformReleaseHostCompositionHostIdentityV2(host),
    nodeIdentityHash: "b".repeat(64),
    npmClosureHash: "c".repeat(64),
    dynamicLibraryClosureHash: "d".repeat(64),
  };
  return Object.freeze({
    ...identity,
    projectionHash:
      hashPlatformReleaseHostCompositionPlatformProjectionV2(
        identity,
      ),
  });
}

function rehashFileReceiptV2(
  file: PlatformReleaseHostCompositionReceiptV2["files"][number],
  requirementHash: string,
): void {
  file.physicalIdentityHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionFilePhysicalIdentityV2({
        role: file.role,
        fileRef: file.fileRef,
        origin: file.origin,
        hostIdentityHash: file.hostIdentityHash,
        contentHash: file.contentHash,
        byteLength: file.byteLength,
        ownerUid: file.ownerUid,
        ownerGid: file.ownerGid,
        mode: file.mode,
        linkCount: file.linkCount,
        device: file.device,
        inode: file.inode,
        modifiedTimeNanoseconds:
          file.modifiedTimeNanoseconds,
        changedTimeNanoseconds:
          file.changedTimeNanoseconds,
        parent: file.parent,
      });
  file.verifierBindingHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionVerifierBindingV2({
        verifierIdentityHash: file.verifierIdentityHash,
        filePhysicalIdentityHash:
          file.physicalIdentityHash,
        requirementHash,
      });
  file.receiptHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionFileReceiptV2(
        file,
      );
}

function rehashAggregateReceiptV2(
  receipt: PlatformReleaseHostCompositionReceiptV2,
): void {
  for (const file of receipt.files) {
    rehashFileReceiptV2(
      file,
      receipt.requirement.requirementHash,
    );
  }
  receipt.runtimeAccount.receiptHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2(
        receipt.runtimeAccount,
      );
  receipt.installation.fileSetMembershipHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionFileSetMembershipV2(
        receipt.files,
      );
  receipt.installation.receiptHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionInstallationReceiptV2(
        receipt.installation,
      );
  receipt.physicalClosureHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionPhysicalClosureV2(
        receipt.files,
      );
  receipt.receiptHash =
    hostCompositionSchemaV2
      .hashPlatformReleaseHostCompositionReceiptV2(
        receipt,
      );
}

afterEach(async () => {
  await Promise.all(
    cleanupRoots.splice(0).map(
      (root) => rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("PlatformReleaseHostCompositionAuthorityV2", () => {
  it("keeps the zero-input composition requirement deterministic", () => {
    const requirement =
      getPlatformReleaseHostCompositionRequirementV2();
    assert.equal(
      requirement.requirementHash,
      "a6999121a09bc3b89b3248008e2eb4431063a6735f7e6a1e2ccb4a0ecb9cb459",
    );
    assert.equal(
      Buffer.byteLength(canonicalJsonStringify(requirement)),
      3_123,
    );
    assert.equal(Object.isFrozen(requirement), true);
    assert.equal(Object.isFrozen(requirement.roles), true);
    assert.deepEqual(
      requirement.roles.map((role) => role.requiredExports),
      [
        [],
        [
          "runPlatformReleaseHostOperationV2",
          "runPlatformReleaseModuleExportProbeV2",
        ],
        [],
        ["runPlatformReleaseMetadataProbeV2"],
        [],
        [],
        [],
        [],
        [],
        ["runPlatformReleaseNetworkNegativeProbeV2"],
      ],
    );
    assert.deepEqual(
      Object.keys(hostCompositionAuthorityV2).sort(),
      [
        "PlatformReleaseHostCompositionAuthorityErrorV2",
        "PlatformReleaseHostCompositionAuthorityV2",
        "createPlatformReleaseHostCompositionAuthorityV2ForTest",
        "inspectPlatformReleaseHostCompositionReceiptV2",
        "isProductionPlatformReleaseHostCompositionAuthorityV2",
        "openPlatformReleaseHostCompositionAuthorityV2Internal",
        "revalidatePlatformReleaseHostCompositionAuthorityV2",
      ],
    );
    assert.deepEqual(
      Object.keys(hostCompositionSchemaV2).sort(),
      [
        "PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_REF_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_VERSION_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_FILE_RECEIPT_V2_SCHEMA",
        "PLATFORM_RELEASE_HOST_COMPOSITION_INSTALLATION_RECEIPT_V2_SCHEMA",
        "PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA",
        "PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_MAX_CANONICAL_BYTES_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_V2_SCHEMA",
        "PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2_SCHEMA",
        "PLATFORM_RELEASE_HOST_COMPOSITION_ROLE_REQUIREMENTS_V2",
        "PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA",
        "PlatformReleaseHostCompositionFileReceiptV2Schema",
        "PlatformReleaseHostCompositionInstallationReceiptV2Schema",
        "PlatformReleaseHostCompositionPlatformProjectionV2Schema",
        "PlatformReleaseHostCompositionReceiptV2Schema",
        "PlatformReleaseHostCompositionRequirementV2Schema",
        "PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema",
        "getPlatformReleaseHostCompositionRequirementV2",
        "hashPlatformReleaseHostCompositionFilePhysicalIdentityV2",
        "hashPlatformReleaseHostCompositionFileReceiptV2",
        "hashPlatformReleaseHostCompositionFileSetMembershipV2",
        "hashPlatformReleaseHostCompositionHostIdentityV2",
        "hashPlatformReleaseHostCompositionInstallationReceiptV2",
        "hashPlatformReleaseHostCompositionParentIdentityV2",
        "hashPlatformReleaseHostCompositionPhysicalClosureV2",
        "hashPlatformReleaseHostCompositionPlatformProjectionV2",
        "hashPlatformReleaseHostCompositionReceiptV2",
        "hashPlatformReleaseHostCompositionRequirementV2",
        "hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2",
        "hashPlatformReleaseHostCompositionVerifierBindingV2",
        "hashPlatformReleaseHostCompositionVerifierIdentityV2",
        "parsePlatformReleaseHostCompositionReceiptCandidateV2",
      ],
    );
  });

  it("keeps the production opener zero-input and typed unavailable without fallback", async () => {
    assert.equal(
      openPlatformReleaseHostCompositionAuthorityV2Internal
        .length,
      0,
    );
    await assert.rejects(
      openPlatformReleaseHostCompositionAuthorityV2Internal(),
      {
        code: "HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE",
      },
    );
  });

  it("issues one pathless non-promotable test authority from an exact physical census", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    const handle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: materialized.fixture,
      });
    const receipt =
      inspectPlatformReleaseHostCompositionReceiptV2(handle);

    assert.equal(handle.admissionScope, "test_fixture");
    assert.equal(Object.isFrozen(handle), true);
    assert.deepEqual(
      Reflect.ownKeys(handle).sort(),
      ["admissionScope", "receiptHash"],
    );
    assert.equal(
      isProductionPlatformReleaseHostCompositionAuthorityV2(
        handle,
      ),
      false,
    );
    assert.equal(receipt.fileCount, 10);
    assert.equal(receipt.files.length, 10);
    assert.equal(
      receipt.productionUse,
      "forbidden_test_fixture",
    );
    assert.equal(
      receipt.runtimeAccount.authorityState,
      "test_fixture_identity_unverified",
    );
    assert.deepEqual(
      receipt.files.map((file) => file.mode),
      [
        "0555",
        "0444",
        "0555",
        "0444",
        "0755",
        "0755",
        "0755",
        "0755",
        "0755",
        "0444",
      ],
    );
    assert.equal(
      PlatformReleaseHostCompositionReceiptV2Schema.parse(
        receipt,
      ).receiptHash,
      receipt.receiptHash,
    );
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.files), true);
    assert.equal(Object.isFrozen(receipt.files[0]), true);
    const serialized = JSON.stringify(receipt);
    assert.doesNotMatch(
      serialized,
      /\/private\/|\/tmp\/|\/Users\/|file:\/\/|setfarm-platform-host-composition-v2-/iu,
    );
    const pending: unknown[] = [receipt];
    while (pending.length > 0) {
      const current = pending.pop();
      if (
        current === null
        || typeof current !== "object"
      ) {
        continue;
      }
      for (const [key, value] of Object.entries(current)) {
        assert.doesNotMatch(
          key,
          /^(?:fixtureRoot|absolutePath|realpath|fd|descriptor|environment|command|argv|callback|capability)$/iu,
        );
        pending.push(value);
      }
    }

    const fresh =
      await revalidatePlatformReleaseHostCompositionAuthorityV2(
        handle,
      );
    assert.deepEqual(fresh, receipt);
    assert.notEqual(fresh, receipt);
  });

  it("keeps constructor, parsed receipts, proxies and accessors outside the capability boundary", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    const handle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: materialized.fixture,
      });
    const candidate =
      parsePlatformReleaseHostCompositionReceiptCandidateV2(
        inspectPlatformReleaseHostCompositionReceiptV2(handle),
      );
    assert.equal(Object.isFrozen(candidate), true);
    assert.equal(Object.isFrozen(candidate.files), true);
    assert.equal(Object.isFrozen(candidate.files[0]), true);
    assert.equal(
      Object.isFrozen(candidate.files[0].parent),
      true,
    );

    assert.throws(
      () => new PlatformReleaseHostCompositionAuthorityV2(
        {},
        {} as never,
      ),
      {
        code: "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
      },
    );
    assert.throws(
      () =>
        inspectPlatformReleaseHostCompositionReceiptV2(
          candidate as never,
        ),
      {
        code: "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
      },
    );
    const hostile = new Proxy(
      {
        platformHost: platformHostV2(),
        fixture: materialized.fixture,
      },
      {
        ownKeys() {
          throw new Error("proxy trap must not execute");
        },
      },
    );
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        hostile,
      ),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
    let getterCalls = 0;
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        Object.defineProperty(
          { fixture: materialized.fixture },
          "platformHost",
          {
            enumerable: true,
            get() {
              getterCalls += 1;
              return platformHostV2();
            },
          },
        ),
      ),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
    assert.equal(getterCalls, 0);
    assert.ok(PlatformReleaseHostCompositionAuthorityErrorV2);
  });

  it("accepts exact test records independent of insertion order", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    const handle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        fixture: {
          runtimeAccount: {
            gid: materialized.fixture.runtimeAccount.gid,
            uid: materialized.fixture.runtimeAccount.uid,
            accountRef:
              "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
          },
          fixtureRoot: materialized.fixture.fixtureRoot,
        },
        platformHost: platformHostV2(),
      });

    assert.equal(handle.admissionScope, "test_fixture");
    assert.equal(
      inspectPlatformReleaseHostCompositionReceiptV2(handle)
        .fileCount,
      10,
    );
  });

  it("rejects nested proxies, accessors, cycles and non-plain input without invoking traps", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    let proxyTrapCalls = 0;
    const nestedProxy = new Proxy(
      materialized.fixture.runtimeAccount,
      {
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("nested proxy trap must not execute");
        },
      },
    );
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: {
          fixtureRoot: materialized.fixture.fixtureRoot,
          runtimeAccount: nestedProxy,
        },
      }),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
    assert.equal(proxyTrapCalls, 0);

    let getterCalls = 0;
    const accessorAccount = Object.defineProperty(
      {
        accountRef:
          "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
        gid: materialized.fixture.runtimeAccount.gid,
      },
      "uid",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return materialized.fixture.runtimeAccount.uid;
        },
      },
    );
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: {
          fixtureRoot: materialized.fixture.fixtureRoot,
          runtimeAccount: accessorAccount,
        },
      }),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
    assert.equal(getterCalls, 0);

    const cyclicAccount: Record<string, unknown> = {
      accountRef:
        "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
      uid: materialized.fixture.runtimeAccount.uid,
      gid: materialized.fixture.runtimeAccount.gid,
    };
    cyclicAccount.self = cyclicAccount;
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: {
          fixtureRoot: materialized.fixture.fixtureRoot,
          runtimeAccount: cyclicAccount,
        },
      }),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );

    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        Object.create({
          platformHost: platformHostV2(),
          fixture: materialized.fixture,
        }),
      ),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
  });

  it("keeps serialized, cloned, spread, prototyped and proxied values outside the capability boundary", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    const handle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: materialized.fixture,
      });
    const receipt =
      inspectPlatformReleaseHostCompositionReceiptV2(handle);
    const candidates: unknown[] = [
      JSON.parse(JSON.stringify(handle)),
      { ...handle },
      structuredClone(handle),
      Object.create(handle),
      Object.create(
        PlatformReleaseHostCompositionAuthorityV2.prototype,
      ),
      new Proxy(handle, {}),
      {
        ...structuredClone(receipt),
        admissionScope: "production_host",
        productionUse:
          "production_host_private_capability_only",
      },
    ];
    for (const candidate of candidates) {
      assert.throws(
        () =>
          inspectPlatformReleaseHostCompositionReceiptV2(
            candidate as never,
          ),
        {
          code: "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED",
        },
      );
    }
  });

  it("rejects self-rehashed host drift and test-to-production promotion", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    const receipt =
      inspectPlatformReleaseHostCompositionReceiptV2(
        await createPlatformReleaseHostCompositionAuthorityV2ForTest({
          platformHost: platformHostV2(),
          fixture: materialized.fixture,
        }),
      );

    const fileHostDrift = structuredClone(receipt);
    fileHostDrift.files[0].hostIdentityHash = "e".repeat(64);
    rehashAggregateReceiptV2(fileHostDrift);
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          fileHostDrift,
        ),
    );

    const accountHostDrift = structuredClone(receipt);
    accountHostDrift.runtimeAccount.hostIdentityHash =
      "f".repeat(64);
    rehashAggregateReceiptV2(accountHostDrift);
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          accountHostDrift,
        ),
    );

    const promoted = structuredClone(receipt);
    promoted.admissionScope = "production_host";
    promoted.productionUse =
      "production_host_private_capability_only";
    promoted.receiptHash =
      hostCompositionSchemaV2
        .hashPlatformReleaseHostCompositionReceiptV2(
          promoted,
        );
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          promoted,
        ),
    );
  });

  it("bounds hostile receipt candidates without invoking proxy or accessor traps", () => {
    let proxyTrapCalls = 0;
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("receipt proxy trap must not execute");
        },
      },
    );
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          proxy,
        ),
    );
    assert.equal(proxyTrapCalls, 0);

    let getterCalls = 0;
    const accessor = Object.defineProperty(
      {},
      "schema",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "forbidden";
        },
      },
    );
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          accessor,
        ),
    );
    assert.equal(getterCalls, 0);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2(
          cycle,
        ),
    );
    assert.throws(
      () =>
        parsePlatformReleaseHostCompositionReceiptCandidateV2({
          oversized: "x".repeat(
            hostCompositionSchemaV2
              .PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_MAX_CANONICAL_BYTES_V2,
          ),
        }),
    );
  });

  it("detects content, mode and hard-link drift on fresh revalidation", async () => {
    const first =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(first.root);
    const contentHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: first.fixture,
      });
    await chmod(
      first.files["lib/network-wrapper.mjs"]!,
      0o644,
    );
    await writeFile(
      first.files["lib/network-wrapper.mjs"]!,
      "mutated\n",
    );
    await chmod(
      first.files["lib/network-wrapper.mjs"]!,
      0o444,
    );
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        contentHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );

    const second =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(second.root);
    const modeHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: second.fixture,
      });
    await chmod(
      second.files["tools/sandbox-exec"]!,
      0o555,
    );
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        modeHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );

    const third =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(third.root);
    const linkHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: third.fixture,
      });
    await link(
      third.files["bin/host-verifier"]!,
      `${third.files["bin/host-verifier"]!}.alias`,
    );
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        linkHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );
  });

  it("detects symlink substitution, same-byte inode replacement and parent swap", async () => {
    const symlinked =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(symlinked.root);
    const symlinkHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: symlinked.fixture,
      });
    await unlink(
      symlinked.files["tools/acl-observe"]!,
    );
    await symlink(
      symlinked.files["tools/acl-clear"]!,
      symlinked.files["tools/acl-observe"]!,
    );
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        symlinkHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );

    const replaced =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(replaced.root);
    const replacementPath =
      replaced.files["lib/network-wrapper.mjs"]!;
    const originalBytes = await readFile(replacementPath);
    const replacementHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: replaced.fixture,
      });
    await unlink(replacementPath);
    await writeFile(replacementPath, originalBytes, {
      mode: 0o444,
    });
    await chmod(replacementPath, 0o444);
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        replacementHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );

    const swapped =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(swapped.root);
    const swapHandle =
      await createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: swapped.fixture,
      });
    const libPath = `${swapped.root}/lib`;
    const temporaryLibPath = `${swapped.root}/lib-swapped`;
    await rename(libPath, temporaryLibPath);
    await rename(temporaryLibPath, libPath);
    await assert.rejects(
      revalidatePlatformReleaseHostCompositionAuthorityV2(
        swapHandle,
      ),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );
  });

  it("rejects extra members and a runtime UID that owns the fixture", async () => {
    const extra =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(extra.root);
    await writeFile(
      `${extra.root}/lib/unexpected.mjs`,
      "unexpected\n",
      { mode: 0o444 },
    );
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: extra.fixture,
      }),
      {
        code: "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      },
    );

    const collision =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(collision.root);
    const owner =
      inspectPlatformReleaseHostCompositionReceiptV2(
        await createPlatformReleaseHostCompositionAuthorityV2ForTest({
          platformHost: platformHostV2(),
          fixture: collision.fixture,
        }),
      ).installation;
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: {
          ...collision.fixture,
          runtimeAccount: {
            ...collision.fixture.runtimeAccount,
            uid: owner.ownerUid,
          },
        },
      }),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
    await assert.rejects(
      createPlatformReleaseHostCompositionAuthorityV2ForTest({
        platformHost: platformHostV2(),
        fixture: {
          ...collision.fixture,
          runtimeAccount: {
            ...collision.fixture.runtimeAccount,
            gid: owner.ownerGid,
          },
        },
      }),
      {
        code: "HOST_COMPOSITION_INPUT_INVALID",
      },
    );
  });
});
