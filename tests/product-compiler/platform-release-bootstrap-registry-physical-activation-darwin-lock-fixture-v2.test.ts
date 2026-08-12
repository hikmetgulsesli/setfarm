import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_LEGAL_ORDERS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_SCOPE_V2,
  PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2,
  createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2,
  type PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2,
  type PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-darwin-lock-fixture-v2.js";

const darwinTestOptions = { skip: process.platform !== "darwin" } as const;
const LEGACY_BYTES = Buffer.from("setfarm-test-legacy-lock-v2\n", "utf8");
const SHARED_BYTES = Buffer.from("setfarm-test-shared-lock-v2\n", "utf8");
const PACKAGE_BYTES = Buffer.from("setfarm-test-package-lock-v2\n", "utf8");

async function writeCanonicalLockFilesV2(root: string): Promise<void> {
  const paths = [
    [path.join(root, "legacy.lock"), LEGACY_BYTES],
    [path.join(root, "shared.lock"), SHARED_BYTES],
    [path.join(root, "package.lock"), PACKAGE_BYTES],
  ] as const;
  await Promise.all(
    paths.map(([lockPath, bytes]) => writeFile(lockPath, bytes, { mode: 0o600 })),
  );
  await Promise.all(paths.map(([lockPath]) => chmod(lockPath, 0o600)));
}

function retargetLockBoundaryV2(
  input: PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2["locks"],
  root: string,
): PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2["locks"] {
  const retarget = (
    boundary: PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2["locks"]["shared_parent_lock"],
  ) => Object.freeze({
    ...boundary,
    parentPath: root,
    lockPath: path.join(root, path.basename(boundary.lockPath)),
  });
  return Object.freeze({
    legacy_node_package_lock: retarget(input.legacy_node_package_lock),
    shared_parent_lock: retarget(input.shared_parent_lock),
    package_lock: retarget(input.package_lock),
  });
}

async function makeLockBoundaryV2(): Promise<Readonly<{
  root: string;
  input: PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2["locks"];
}>> {
  const root = await mkdtemp(
    path.join(tmpdir(), "setfarm-darwin-dual-lock-fixture-v2-"),
  );
  await chmod(root, 0o700);
  const paths = {
    legacy_node_package_lock: path.join(root, "legacy.lock"),
    shared_parent_lock: path.join(root, "shared.lock"),
    package_lock: path.join(root, "package.lock"),
  } as const;
  await writeCanonicalLockFilesV2(root);
  const expectedOwner = Object.freeze({
    uid: process.getuid!(),
    gid: process.getgid!(),
  });
  const boundary = (lockPath: string, lockBytes: Uint8Array) =>
    Object.freeze({
      parentPath: root,
      lockPath,
      lockBytes,
      expectedOwner,
      allowedParentModes: Object.freeze([0o700] as const),
    });
  return Object.freeze({
    root,
    input: Object.freeze({
      legacy_node_package_lock: boundary(
        paths.legacy_node_package_lock,
        LEGACY_BYTES,
      ),
      shared_parent_lock: boundary(paths.shared_parent_lock, SHARED_BYTES),
      package_lock: boundary(paths.package_lock, PACKAGE_BYTES),
    }),
  });
}

async function releaseQuietlyV2(
  session: PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2 | undefined,
): Promise<void> {
  await session?.releaseAll().catch(() => undefined);
}

describe(
  "platform release bootstrap registry Darwin real-kernel lock fixture v2",
  darwinTestOptions,
  () => {
    it("holds actual shared then package lockf leases through contention and releases them", async () => {
      const boundary = await makeLockBoundaryV2();
      let holder:
        | PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
        | undefined;
      let contender:
        | PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
        | undefined;
      try {
        holder = createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
          acquisitionOrder: ["shared_parent_lock", "package_lock"],
          locks: boundary.input,
        });
        assert.equal(
          holder.fixtureScope,
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_SCOPE_V2,
        );
        assert.equal(holder.productionAuthority, false);
        await holder.acquireSharedParentLock();
        await holder.acquireRegisteredPackageLock();
        holder.assertAllHeldAndCurrent();

        contender =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: ["shared_parent_lock", "package_lock"],
            locks: boundary.input,
          });
        let contenderSharedSettled = false;
        const contenderShared = contender.acquireSharedParentLock().then(() => {
          contenderSharedSettled = true;
        });
        await delay(150);
        assert.equal(
          contenderSharedSettled,
          false,
          "the second real lockf lease must contend while shared is held",
        );

        await holder.releaseAll();
        await contenderShared;
        await contender.acquireRegisteredPackageLock();
        contender.assertAllHeldAndCurrent();
        await contender.releaseAll();
        await contender.releaseAll();
        assert.throws(() => contender?.assertAllHeldAndCurrent(), {
          code: "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        });
      } finally {
        await releaseQuietlyV2(contender);
        await releaseQuietlyV2(holder);
        await rm(boundary.root, { recursive: true, force: true });
      }
    });

    it("accepts only the four exact orders and rejects inversion, duplicates, and split boundaries", async () => {
      const boundary = await makeLockBoundaryV2();
      try {
        for (const acquisitionOrder of
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_LEGAL_ORDERS_V2) {
          const session =
            createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
              acquisitionOrder,
              locks: boundary.input,
            });
          assert.deepEqual(session.acquisitionOrder, acquisitionOrder);
          await session.releaseAll();
        }
        for (const acquisitionOrder of [
          ["package_lock", "shared_parent_lock"],
          ["shared_parent_lock"],
          ["legacy_node_package_lock", "legacy_node_package_lock"],
          ["shared_parent_lock", "package_lock", "legacy_node_package_lock"],
        ] as const) {
          assert.throws(
            () =>
              createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
                acquisitionOrder,
                locks: boundary.input,
              }),
            (error) =>
              error instanceof
                PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2 &&
              error.code === "DARWIN_LOCK_FIXTURE_ORDER_INVALID",
          );
        }

        const wrongFirst =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: ["shared_parent_lock", "package_lock"],
            locks: boundary.input,
          });
        await assert.rejects(wrongFirst.acquireRegisteredPackageLock(), {
          code: "DARWIN_LOCK_FIXTURE_ORDER_INVALID",
        });
        await assert.rejects(wrongFirst.acquireSharedParentLock(), {
          code: "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        });

        assert.throws(
          () =>
            createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
              acquisitionOrder: ["shared_parent_lock", "package_lock"],
              locks: {
                ...boundary.input,
                package_lock: {
                  ...boundary.input.package_lock,
                  lockPath: boundary.input.shared_parent_lock.lockPath,
                },
              },
            }),
          { code: "DARWIN_LOCK_FIXTURE_INPUT_INVALID" },
        );

        const splitRoot = await mkdtemp(
          path.join(tmpdir(), "setfarm-darwin-split-lock-fixture-v2-"),
        );
        try {
          const splitPackagePath = path.join(splitRoot, "package.lock");
          await chmod(splitRoot, 0o700);
          await writeFile(splitPackagePath, PACKAGE_BYTES, { mode: 0o600 });
          await chmod(splitPackagePath, 0o600);
          assert.throws(
            () =>
              createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
                acquisitionOrder: ["shared_parent_lock", "package_lock"],
                locks: {
                  ...boundary.input,
                  package_lock: {
                    ...boundary.input.package_lock,
                    parentPath: splitRoot,
                    lockPath: splitPackagePath,
                  },
                },
              }),
            { code: "DARWIN_LOCK_FIXTURE_INPUT_INVALID" },
          );
        } finally {
          await rm(splitRoot, { recursive: true, force: true });
        }
      } finally {
        await rm(boundary.root, { recursive: true, force: true });
      }
    });

    it("releases the already-held legacy lease when the second acquisition fails", async () => {
      const boundary = await makeLockBoundaryV2();
      let contender:
        | PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
        | undefined;
      try {
        const missingSharedPath = path.join(boundary.root, "missing-shared.lock");
        const failing =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: [
              "legacy_node_package_lock",
              "shared_parent_lock",
            ],
            locks: {
              ...boundary.input,
              shared_parent_lock: {
                ...boundary.input.shared_parent_lock,
                lockPath: missingSharedPath,
              },
            },
          });
        await failing.acquireLegacyNodeLock();
        await assert.rejects(failing.acquireSharedParentLock(), {
          code: "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
        });

        contender =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: ["legacy_node_package_lock"],
            locks: boundary.input,
          });
        await contender.acquireLegacyNodeLock();
        contender.assertAllHeldAndCurrent();
      } finally {
        await releaseQuietlyV2(contender);
        await rm(boundary.root, { recursive: true, force: true });
      }
    });

    it("pins one physical parent and rejects path replacement between role acquisitions", async () => {
      const boundary = await makeLockBoundaryV2();
      const displacedRoot = `${boundary.root}-displaced`;
      let session:
        | PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
        | undefined;
      let displacedContender:
        | PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
        | undefined;
      try {
        session =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: ["shared_parent_lock", "package_lock"],
            locks: boundary.input,
          });
        assert.equal(session.productionAuthority, false);
        await session.acquireSharedParentLock();

        await rename(boundary.root, displacedRoot);
        await mkdir(boundary.root, { mode: 0o700 });
        await chmod(boundary.root, 0o700);
        await writeCanonicalLockFilesV2(boundary.root);

        await assert.rejects(session.acquireRegisteredPackageLock(), {
          code: "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
        });
        await assert.rejects(session.acquireRegisteredPackageLock(), {
          code: "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        });

        displacedContender =
          createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
            acquisitionOrder: ["shared_parent_lock", "package_lock"],
            locks: retargetLockBoundaryV2(boundary.input, displacedRoot),
          });
        await displacedContender.acquireSharedParentLock();
        await displacedContender.acquireRegisteredPackageLock();
        displacedContender.assertAllHeldAndCurrent();
      } finally {
        await releaseQuietlyV2(displacedContender);
        await releaseQuietlyV2(session);
        await rm(boundary.root, { recursive: true, force: true });
        await rm(displacedRoot, { recursive: true, force: true });
      }
    });
  },
);
