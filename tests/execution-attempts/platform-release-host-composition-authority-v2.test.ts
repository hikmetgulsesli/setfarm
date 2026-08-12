import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
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
  acquirePlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2,
  acquirePlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2,
  acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2,
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
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
} from
  "../../src/execution/platform-release-bootstrap-network-negative-operation-v2.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
  PlatformReleaseHostCompositionPlatformProjectionV2Schema,
  PlatformReleaseHostCompositionReceiptV2Schema,
  hashPlatformReleaseHostCompositionHostSemanticProfileV2,
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

async function capturedRejectionV2(
  promise: Promise<unknown>,
): Promise<unknown> {
  let captured: unknown;
  try {
    await promise;
  } catch (error) {
    captured = error;
  }
  assert.notEqual(captured, undefined);
  return captured;
}

function assertPrimaryFirstFilesystemFailureV2(
  error: unknown,
  primaryMessage: RegExp,
  closeFailure: Error,
): void {
  assert.ok(
    error
      instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
  );
  assert.equal(
    error.code,
    "HOST_COMPOSITION_FILESYSTEM_DRIFT",
  );
  assert.ok(error.cause instanceof AggregateError);
  const failures = Array.from(error.cause.errors);
  assert.equal(failures.length, 2);
  const primary = failures[0];
  const close = failures[1];
  assert.ok(
    primary
      instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
  );
  assert.equal(
    primary.code,
    "HOST_COMPOSITION_FILESYSTEM_DRIFT",
  );
  assert.match(primary.message, primaryMessage);
  assert.ok(
    close
      instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
  );
  assert.equal(
    close.code,
    "HOST_COMPOSITION_FILESYSTEM_DRIFT",
  );
  assert.equal(close.cause, closeFailure);
  assert.equal(error.cause.cause, primary);
}

function assertCloseOnlyFilesystemFailureV2(
  error: unknown,
  closeFailure: Error,
): void {
  assert.ok(
    error
      instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
  );
  assert.equal(
    error.code,
    "HOST_COMPOSITION_FILESYSTEM_DRIFT",
  );
  assert.equal(error.cause, closeFailure);
}

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
    hostIdentitySource: "authenticated_machine_identity_v3" as const,
    hostIdentityHash: "f".repeat(64),
    hostSemanticProfileHash:
      hashPlatformReleaseHostCompositionHostSemanticProfileV2(host),
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
  it("separates stable machine identity from the mutable OS semantic profile", () => {
    const first = platformHostV2();
    const differentMachineIdentity = {
      ...first,
      hostIdentityHash: "1".repeat(64),
      projectionHash: "",
    };
    differentMachineIdentity.projectionHash =
      hashPlatformReleaseHostCompositionPlatformProjectionV2((({
        projectionHash: _projectionHash,
        ...identity
      }) => identity)(differentMachineIdentity));
    const differentMachine =
      PlatformReleaseHostCompositionPlatformProjectionV2Schema.parse(
        differentMachineIdentity,
      );
    const changedHost = {
      ...first.host,
      macosBuildVersion: "25F85",
    };
    const changedSemanticIdentity = {
      ...first,
      host: changedHost,
      hostSemanticProfileHash:
        hashPlatformReleaseHostCompositionHostSemanticProfileV2(
          changedHost,
        ),
      projectionHash: "",
    };
    changedSemanticIdentity.projectionHash =
      hashPlatformReleaseHostCompositionPlatformProjectionV2((({
        projectionHash: _projectionHash,
        ...identity
      }) => identity)(changedSemanticIdentity));
    const changedSemantic =
      PlatformReleaseHostCompositionPlatformProjectionV2Schema.parse(
        changedSemanticIdentity,
      );

    assert.equal(
      differentMachine.hostSemanticProfileHash,
      first.hostSemanticProfileHash,
    );
    assert.notEqual(
      differentMachine.hostIdentityHash,
      first.hostIdentityHash,
    );
    assert.notEqual(differentMachine.projectionHash, first.projectionHash);
    assert.equal(changedSemantic.hostIdentityHash, first.hostIdentityHash);
    assert.notEqual(
      changedSemantic.hostSemanticProfileHash,
      first.hostSemanticProfileHash,
    );
  });

  it("keeps the zero-input composition requirement deterministic", () => {
    const requirement =
      getPlatformReleaseHostCompositionRequirementV2();
    assert.equal(
      requirement.requirementHash,
      "9bc58f9a2b83d3b79647f48969fbd63d1b52cea677434dae192903e342f7598f",
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
        "acquirePlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2",
        "acquirePlatformReleaseHostCompositionModuleExportLaunchContextInternalV2",
        "acquirePlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2",
        "acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2",
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
        "hashPlatformReleaseHostCompositionHostSemanticProfileV2",
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

  it("pins bounded descriptor census and primary-first close source contracts", async () => {
    assert.equal(
      createPlatformReleaseHostCompositionAuthorityV2ForTest.length,
      1,
    );
    const source = await readFile(
      new URL(
        "../../src/execution/platform-release-host-composition-authority-v2.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.doesNotMatch(source, /\breaddirSync\b/u);
    assert.match(
      source,
      /const DIRECTORY_MEMBER_CAPS_V2 = Object\.freeze\(\{\s*"\.": 3,\s*bin: 2,\s*lib: 3,\s*tools: 5,/u,
    );
    const directorySource = source.slice(
      source.indexOf("function captureDirectoryV2("),
      source.indexOf("function captureFileV2("),
    );
    const orderedDirectoryContracts = [
      "before = lstatSync(absolutePath, { bigint: true })",
      "before.isSymbolicLink()",
      "!before.isDirectory()",
      'modeText(before) !== "0700"',
      "Number(before.uid) !== expectedOwner.uid",
      "opendirSync(absolutePath, { bufferSize: 1 })",
      "directory.readSync()",
      "hooks?.afterDirectoryEntryRead?.(",
      "names.length >= maximumNames",
      "names.push(entry.name)",
      "directory.closeSync()",
      "hooks?.afterDirectoryDescriptorClose?.(",
      "after = lstatSync(absolutePath, { bigint: true })",
      "sameFingerprint(fingerprint(before), fingerprint(after))",
      "names.sort()",
      "exactNames(names, expectedNames)",
    ];
    let directoryCursor = -1;
    for (const contract of orderedDirectoryContracts) {
      const next = directorySource.indexOf(
        contract,
        directoryCursor + 1,
      );
      assert.ok(
        next > directoryCursor,
        `missing ordered bounded directory contract: ${contract}`,
      );
      directoryCursor = next;
    }
    const fileSource = source.slice(
      source.indexOf("function captureFileV2("),
      source.indexOf("function captureInstallationV2("),
    );
    assert.doesNotMatch(
      fileSource,
      /finally\s*\{[\s\S]*closeSync\(descriptor\)/u,
    );
    assert.match(fileSource, /closeSync\(descriptor\)/u);
    assert.match(
      fileSource,
      /hooks\?\.afterFileRead\?\.\(/u,
    );
    assert.match(
      fileSource,
      /hooks\?\.afterFileDescriptorClose\?\.\(/u,
    );
    assert.match(
      source,
      /new AggregateError\(\s*\[primaryError, closeError\],[\s\S]*\{ cause: primaryError \}/u,
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

    const expectedImplementations = [
      [
        "ABI_PLATFORM_RELEASE_HOST_OPERATION_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
        "lib/release-bootstrap.mjs",
      ],
      [
        "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2",
        "lib/metadata-bootstrap.mjs",
      ],
      [
        "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
        "lib/release-bootstrap.mjs",
      ],
      [
        "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
        "lib/network-wrapper.mjs",
      ],
    ] as const;
    for (const [operationAbiRef, memberRef, locator] of
      expectedImplementations) {
      const context =
        await acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
          handle,
          operationAbiRef,
        );
      assert.equal(context.admissionScope, "test_fixture");
      assert.equal(context.operationAbiRef, operationAbiRef);
      assert.equal(context.implementationMemberRef, memberRef);
      assert.equal(
        context.releaseBootstrapExecutablePath,
        materialized.files["bin/release-bootstrap"],
      );
      assert.equal(
        context.implementationPath,
        materialized.files[locator],
      );
      assert.equal(
        context.hostCompositionReceiptHash,
        receipt.receiptHash,
      );
    }
    for (const invalidOperationAbiRef of [
      "ABI_PLATFORM_RELEASE_VERIFY_PACKAGE_V2",
      "__proto__",
    ]) {
      await assert.rejects(
        acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
          handle,
          invalidOperationAbiRef as never,
        ),
        { code: "HOST_COMPOSITION_INPUT_INVALID" },
      );
    }
    const metadataContext =
      await acquirePlatformReleaseHostCompositionMetadataOperationLaunchContextInternalV2(
        handle,
      );
    assert.equal(metadataContext.admissionScope, "test_fixture");
    assert.equal(
      metadataContext.implementationPath,
      materialized.files["lib/metadata-bootstrap.mjs"],
    );
    assert.equal(
      metadataContext.xattrObserverExecutablePath,
      materialized.files["tools/xattr-observe"],
    );
    assert.equal(
      metadataContext.aclObserverExecutablePath,
      materialized.files["tools/acl-observe"],
    );
    assert.equal(
      "xattrClearExecutablePath" in metadataContext,
      false,
    );
    assert.equal(
      "aclClearExecutablePath" in metadataContext,
      false,
    );
    assert.equal(Object.isFrozen(metadataContext), true);
  });

  it("binds the test-only network-negative context to the exact wrapper, sandbox and policy", async () => {
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
    const genericContext =
      await acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
        handle,
        "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
      );
    const context =
      await acquirePlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2(
        handle,
      );
    const sandboxReceipt = receipt.files.find(
      (file) => file.role === "sandbox_executable",
    )!;
    const wrapperReceipt = receipt.files.find(
      (file) => file.role === "network_wrapper_module",
    )!;
    const executableReceipt = receipt.files.find(
      (file) => file.role === "release_bootstrap_executable",
    )!;

    assert.equal(context.admissionScope, "test_fixture");
    assert.equal(
      context.operationAbiRef,
      "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
    );
    assert.equal(
      context.implementationMemberRef,
      "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
    );
    assert.equal(
      context.hostIdentityHash,
      receipt.platformHost.hostIdentityHash,
    );
    assert.equal(
      context.hostCompositionReceiptHash,
      receipt.receiptHash,
    );
    assert.equal(
      context.releaseBootstrapExecutablePath,
      materialized.files["bin/release-bootstrap"],
    );
    assert.equal(
      context.releaseBootstrapExecutableContentHash,
      executableReceipt.contentHash,
    );
    assert.equal(
      context.releaseBootstrapExecutablePhysicalIdentityHash,
      executableReceipt.physicalIdentityHash,
    );
    assert.equal(
      context.implementationPath,
      materialized.files["lib/network-wrapper.mjs"],
    );
    assert.equal(
      context.implementationContentHash,
      wrapperReceipt.contentHash,
    );
    assert.equal(
      context.implementationPhysicalIdentityHash,
      wrapperReceipt.physicalIdentityHash,
    );
    assert.equal(
      context.sandboxPolicyHash,
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
    );
    assert.equal(
      context.sandboxExecutablePath,
      materialized.files["tools/sandbox-exec"],
    );
    assert.equal(
      context.sandboxExecutableContentHash,
      sandboxReceipt.contentHash,
    );
    assert.equal(
      context.sandboxExecutablePhysicalIdentityHash,
      sandboxReceipt.physicalIdentityHash,
    );
    const {
      sandboxPolicyHash: _sandboxPolicyHash,
      sandboxExecutablePath: _sandboxExecutablePath,
      sandboxExecutableContentHash: _sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        _sandboxExecutablePhysicalIdentityHash,
      ...baseContext
    } = context;
    assert.deepEqual(baseContext, genericContext);
    assert.equal(Object.isFrozen(context), true);

    for (const unauthenticated of [
      structuredClone(handle),
      Object.create(handle),
      {
        ...structuredClone(receipt),
        admissionScope: "production_host",
      },
    ]) {
      await assert.rejects(
        acquirePlatformReleaseHostCompositionTargetOperationLaunchContextInternalV2(
          unauthenticated as never,
          "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
        ),
        { code: "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED" },
      );
      await assert.rejects(
        acquirePlatformReleaseHostCompositionNetworkNegativeOperationLaunchContextInternalV2(
          unauthenticated as never,
        ),
        { code: "HOST_COMPOSITION_HANDLE_UNAUTHENTICATED" },
      );
    }
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
      "d".repeat(64);
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

  it("bounds hostile directory census reads to each expected member count plus one", async () => {
    const cases = [
      { relativeLocator: "." as const, maximumNames: 3 },
      { relativeLocator: "bin" as const, maximumNames: 2 },
      { relativeLocator: "lib" as const, maximumNames: 3 },
      { relativeLocator: "tools" as const, maximumNames: 5 },
    ];
    for (const testCase of cases) {
      const materialized =
        materializePlatformReleaseHostCompositionFixtureV2();
      cleanupRoots.push(materialized.root);
      const directoryPath = testCase.relativeLocator === "."
        ? materialized.root
        : `${materialized.root}/${testCase.relativeLocator}`;
      for (let index = 0; index < 64; index += 1) {
        writeFileSync(
          `${directoryPath}/hostile-${index
            .toString()
            .padStart(2, "0")}`,
          "hostile\n",
          { mode: 0o444 },
        );
      }
      let reads = 0;
      const error = await capturedRejectionV2(
        createPlatformReleaseHostCompositionAuthorityV2ForTest(
          {
            platformHost: platformHostV2(),
            fixture: materialized.fixture,
          },
          {
            afterDirectoryEntryRead: (context) => {
              if (
                context.relativeLocator
                  === testCase.relativeLocator
              ) {
                reads += 1;
              }
            },
          },
        ),
      );
      assert.ok(
        error
          instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
      );
      assert.equal(
        error.code,
        "HOST_COMPOSITION_FILESYSTEM_DRIFT",
      );
      assert.match(error.message, /admitted member bound/u);
      assert.equal(reads, testCase.maximumNames + 1);
    }
  });

  it("post-fences a directory replacement made after descriptor close", async () => {
    const materialized =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(materialized.root);
    let replaced = false;
    const error = await capturedRejectionV2(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        {
          platformHost: platformHostV2(),
          fixture: materialized.fixture,
        },
        {
          afterDirectoryDescriptorClose: (context) => {
            if (
              !replaced
              && context.relativeLocator === "lib"
            ) {
              replaced = true;
              renameSync(
                `${materialized.root}/lib`,
                `${materialized.root}/lib-displaced`,
              );
              mkdirSync(`${materialized.root}/lib`, {
                mode: 0o700,
              });
              chmodSync(`${materialized.root}/lib`, 0o700);
            }
          },
        },
      ),
    );
    assert.equal(replaced, true);
    assert.ok(
      error
        instanceof PlatformReleaseHostCompositionAuthorityErrorV2,
    );
    assert.equal(
      error.code,
      "HOST_COMPOSITION_FILESYSTEM_DRIFT",
    );
    assert.match(
      error.message,
      /changed during bounded membership capture/u,
    );
  });

  it("preserves directory primary-first close aggregation and typed close-only failure", async () => {
    const primaryAndClose =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(primaryAndClose.root);
    for (let index = 0; index < 64; index += 1) {
      writeFileSync(
        `${primaryAndClose.root}/hostile-${index
          .toString()
          .padStart(2, "0")}`,
        "hostile\n",
        { mode: 0o444 },
      );
    }
    const aggregateCloseFailure =
      new Error("injected directory close failure");
    const aggregateError = await capturedRejectionV2(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        {
          platformHost: platformHostV2(),
          fixture: primaryAndClose.fixture,
        },
        {
          afterDirectoryDescriptorClose: (context) => {
            if (context.relativeLocator === ".") {
              throw aggregateCloseFailure;
            }
          },
        },
      ),
    );
    assertPrimaryFirstFilesystemFailureV2(
      aggregateError,
      /admitted member bound/u,
      aggregateCloseFailure,
    );

    const closeOnly =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(closeOnly.root);
    const closeOnlyFailure =
      new Error("injected directory close-only failure");
    const closeOnlyError = await capturedRejectionV2(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        {
          platformHost: platformHostV2(),
          fixture: closeOnly.fixture,
        },
        {
          afterDirectoryDescriptorClose: (context) => {
            if (context.relativeLocator === ".") {
              throw closeOnlyFailure;
            }
          },
        },
      ),
    );
    assertCloseOnlyFilesystemFailureV2(
      closeOnlyError,
      closeOnlyFailure,
    );
  });

  it("preserves file primary-first close aggregation and typed close-only failure", async () => {
    const primaryAndClose =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(primaryAndClose.root);
    const aggregateCloseFailure =
      new Error("injected file close failure");
    const aggregateError = await capturedRejectionV2(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        {
          platformHost: platformHostV2(),
          fixture: primaryAndClose.fixture,
        },
        {
          afterFileRead: (context) => {
            if (
              context.relativeLocator
                === "bin/release-bootstrap"
            ) {
              chmodSync(context.absolutePath, 0o444);
            }
          },
          afterFileDescriptorClose: (context) => {
            if (
              context.relativeLocator
                === "bin/release-bootstrap"
            ) {
              throw aggregateCloseFailure;
            }
          },
        },
      ),
    );
    assertPrimaryFirstFilesystemFailureV2(
      aggregateError,
      /or its parent changed during descriptor admission/u,
      aggregateCloseFailure,
    );

    const closeOnly =
      materializePlatformReleaseHostCompositionFixtureV2();
    cleanupRoots.push(closeOnly.root);
    const closeOnlyFailure =
      new Error("injected file close-only failure");
    const closeOnlyError = await capturedRejectionV2(
      createPlatformReleaseHostCompositionAuthorityV2ForTest(
        {
          platformHost: platformHostV2(),
          fixture: closeOnly.fixture,
        },
        {
          afterFileDescriptorClose: (context) => {
            if (
              context.relativeLocator
                === "bin/release-bootstrap"
            ) {
              throw closeOnlyFailure;
            }
          },
        },
      ),
    );
    assertCloseOnlyFilesystemFailureV2(
      closeOnlyError,
      closeOnlyFailure,
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
