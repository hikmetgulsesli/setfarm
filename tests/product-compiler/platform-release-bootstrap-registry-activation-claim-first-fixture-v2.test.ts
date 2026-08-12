import assert from "node:assert/strict";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  publishCooperativeActivationMemberV2,
} from "../../src/product-compiler/platform-release-bootstrap-activation-member-publication-cooperative-v2.js";
import {
  PlatformReleaseBootstrapActivationClaimFirstCheckpointV2,
  createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2,
  inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2,
  hashPlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2,
  resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-claim-first-fixture-v2.js";

async function fixtureV2() {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-claim-first-v2-"));
  const namespaceParentPath = path.join(root, "namespace");
  const stagingDirectoryPath = path.join(root, "staging");
  await mkdir(namespaceParentPath, { mode: 0o700 });
  await mkdir(stagingDirectoryPath, { mode: 0o700 });
  return {
    root,
    namespaceParentPath,
    stagingDirectoryPath,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function inputV2(
  fixture: Awaited<ReturnType<typeof fixtureV2>>,
  payloadScale = 1,
) {
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "b".repeat(64),
  });
  return {
    filesystemScope: scope,
    namespaceParentPath: fixture.namespaceParentPath,
    stagingDirectoryPath: fixture.stagingDirectoryPath,
    transactionIdentityHash: "1".repeat(64),
    claimDocument: {
      transactionKind: "activation",
      expectedReceipt: "2".repeat(64),
      scopeIdentityHash: scope.scopeIdentityHash,
      padding: "p".repeat(8_000),
    },
    members: [
      {
        memberKind: "staged_activation_receipt" as const,
        bytes: Buffer.from("receipt:" + "r".repeat(4_096 * payloadScale)),
      },
      {
        memberKind: "staged_genesis_epoch_state" as const,
        bytes: Buffer.from("genesis:" + "g".repeat(32)),
      },
      {
        memberKind: "staged_shared_lock" as const,
        bytes: Buffer.from("shared-lock"),
      },
    ],
  } as const;
}

function claimPathV2(fixture: Awaited<ReturnType<typeof fixtureV2>>): string {
  return path.join(
    fixture.namespaceParentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationClaimBasename,
  );
}

async function expectCodeV2(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.equal((error as { code?: string }).code, code);
    return true;
  });
}

describe("claim-first activation staging fixture v2", () => {
  it("preallocates and binds stable member inodes before payload, then resumes a partial write", async () => {
    const skeletonFixture = await fixtureV2();
    try {
      const input = inputV2(skeletonFixture);
      let skeletonStopped = false;
      await expectCodeV2(
        () =>
          createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
            input,
            (checkpoint) => {
              if (
                !skeletonStopped &&
                checkpoint ===
                  PlatformReleaseBootstrapActivationClaimFirstCheckpointV2
                    .afterSkeletonDirectorySync
              ) {
                skeletonStopped = true;
                throw new Error("simulated crash before claim");
              }
            },
          ),
        "CLAIM_FIRST_UNAVAILABLE",
      );
      assert.equal(skeletonStopped, true);
      const unclaimed = await inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(
        input,
      );
      assert.equal(unclaimed.status, "unclaimed_skeleton");
      assert.equal(
        (await lstat(path.join(skeletonFixture.stagingDirectoryPath, "staged_activation_receipt"))).size,
        0,
      );
      await expectCodeV2(
        () => resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input),
        "CLAIM_FIRST_CLAIM_REQUIRED",
      );
    } finally {
      await skeletonFixture.cleanup();
    }

    const fixture = await fixtureV2();
    try {
      const input = inputV2(fixture, 2);
      let partialStopped = false;
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
        input,
        (checkpoint, context) => {
          if (
            !partialStopped &&
            checkpoint ===
              PlatformReleaseBootstrapActivationClaimFirstCheckpointV2
                .duringMemberWrite &&
            context.basename === "staged_activation_receipt" &&
            context.offset < context.totalBytes
          ) {
            partialStopped = true;
            throw new Error("simulated crash during payload");
          }
        },
      );
      await expectCodeV2(
        () => session.writeMember("staged_activation_receipt"),
        "CLAIM_FIRST_UNAVAILABLE",
      );
      await session.close();
      assert.equal(partialStopped, true);

      const partial = await inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(
        input,
      );
      assert.equal(partial.status, "partial");
      assert.ok(partial.observedMembers[0]!.byteLength > 0);
      assert.ok(
        partial.observedMembers[0]!.byteLength < input.members[0]!.bytes.byteLength,
      );
      assert.equal(partial.productionAuthority, false);
      assert.equal(partial.productionAdmission, "forbidden");
      assert.equal(partial.claimSemantics, "opaque_fixture_claim_document_join_only");
      assert.equal(partial.ownershipAuthority, false);
      assert.equal(partial.cleanupAuthority, false);
      assert.equal(partial.completionScope, "staging_payload_members_only");
      assert.equal(partial.activationStatus, "not_attempted");
      assert.equal(partial.terminalAuthority, false);
      assert.equal(typeof partial.claimDocumentHash, "string");
      assert.equal(typeof partial.claimRawContentHash, "string");

      const recovery = await resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
        input,
      );
      for (const member of input.members) {
        await recovery.writeMember(member.memberKind);
      }
      const complete = await recovery.inspect();
      assert.equal(complete.status, "complete");
      assert.deepEqual(
        complete.observedMembers.map((member) => member.byteLength),
        input.members.map((member) => member.bytes.byteLength),
      );
      assert.deepEqual(
        complete.expectedMembers.map((member) => member.objectIdentity.inode),
        complete.observedMembers.map((member) => member.objectIdentity.inode),
      );
      assert.equal(
        complete.receiptHash,
        hashPlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2(
          complete,
        ),
      );
      const authorityClone = structuredClone(complete) as typeof complete & {
        productionAuthority: boolean;
      };
      authorityClone.productionAuthority = true;
      assert.notEqual(
        authorityClone.receiptHash,
        hashPlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2(
          authorityClone,
        ),
      );
      const claimHashClone = structuredClone(complete) as typeof complete & {
        claimDocumentHash: string;
      };
      claimHashClone.claimDocumentHash = "0".repeat(64);
      assert.notEqual(
        claimHashClone.receiptHash,
        hashPlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2(
          claimHashClone,
        ),
      );
      for (const expected of complete.expectedMembers) {
        const published = await publishCooperativeActivationMemberV2({
          filesystemScope: input.filesystemScope,
          stagingDirectoryPath: input.stagingDirectoryPath,
          namespaceParentPath: input.namespaceParentPath,
          memberKind: expected.memberKind,
          expectedRawContentHash: expected.rawContentHash,
          expectedObjectIdentity: expected.objectIdentity,
        });
        assert.equal(
          published.objectIdentity.objectIdentityHash,
          expected.objectIdentity.objectIdentityHash,
        );
      }
      await recovery.close();
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects close during an in-flight member write without zeroing its payload", async () => {
    const fixture = await fixtureV2();
    let release: (() => void) | undefined;
    try {
      const input = inputV2(fixture, 4);
      let enteredResolve!: () => void;
      const entered = new Promise<void>((resolve) => {
        enteredResolve = resolve;
      });
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      let pausedOnce = false;
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
        input,
        async (checkpoint, context) => {
          if (
            !pausedOnce &&
            checkpoint === PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.duringMemberWrite &&
            context.basename === "staged_activation_receipt"
          ) {
            pausedOnce = true;
            enteredResolve();
            await paused;
          }
        },
      );
      const writePromise = session.writeMember("staged_activation_receipt");
      await entered;
      const closePromise = session.close();
      await expectCodeV2(
        () => closePromise,
        "CLAIM_FIRST_LIFECYCLE_INVALID",
      );
      release!();
      await writePromise;
      await session.close();
      assert.deepEqual(
        await readFile(path.join(fixture.stagingDirectoryPath, "staged_activation_receipt")),
        input.members[0]!.bytes,
      );
    } finally {
      release?.();
      await fixture.cleanup();
    }
  });

  it("never adopts a claimless, foreign, replaced, or prefix-spliced stage", async () => {
    const partialClaimFixture = await fixtureV2();
    try {
      const input = inputV2(partialClaimFixture);
      let claimStopped = false;
      await expectCodeV2(
        () =>
          createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
            input,
            (checkpoint, context) => {
              if (
                !claimStopped &&
                checkpoint ===
                  PlatformReleaseBootstrapActivationClaimFirstCheckpointV2
                    .duringClaimWrite &&
                context.offset < context.totalBytes
              ) {
                claimStopped = true;
                throw new Error("simulated crash during claim");
              }
            },
          ),
        "CLAIM_FIRST_UNAVAILABLE",
      );
      assert.equal(claimStopped, true);
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
    } finally {
      await partialClaimFixture.cleanup();
    }

    const claimlessFixture = await fixtureV2();
    try {
      const input = inputV2(claimlessFixture);
      await writeFile(
        path.join(
          claimlessFixture.stagingDirectoryPath,
          "staged_activation_receipt",
        ),
        "foreign-prefix",
        { mode: 0o600 },
      );
      const claimless = await inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(
        input,
      );
      assert.equal(claimless.status, "unclaimed_skeleton");
      await expectCodeV2(
        () => resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input),
        "CLAIM_FIRST_CLAIM_REQUIRED",
      );
    } finally {
      await claimlessFixture.cleanup();
    }

    const foreignFixture = await fixtureV2();
    try {
      const input = inputV2(foreignFixture);
      await writeFile(
        claimPathV2(foreignFixture),
        JSON.stringify({ schema: "foreign" }),
        { mode: 0o600 },
      );
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
    } finally {
      await foreignFixture.cleanup();
    }

    const extraKeyFixture = await fixtureV2();
    try {
      const input = inputV2(extraKeyFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const claimPath = claimPathV2(extraKeyFixture);
      const claim = JSON.parse((await readFile(claimPath)).toString()) as Record<string, unknown>;
      claim.extra = "not-bound";
      await writeFile(claimPath, canonicalJsonStringify(claim), { mode: 0o600 });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
    } finally {
      await extraKeyFixture.cleanup();
    }

    const replacedFixture = await fixtureV2();
    try {
      const input = inputV2(replacedFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const claimPath = claimPathV2(replacedFixture);
      const bytes = await readFile(claimPath);
      await unlink(claimPath);
      await writeFile(claimPath, bytes, { mode: 0o600 });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
    } finally {
      await replacedFixture.cleanup();
    }

    const spliceFixture = await fixtureV2();
    try {
      const input = inputV2(spliceFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      const memberPath = path.join(
        spliceFixture.stagingDirectoryPath,
        "staged_activation_receipt",
      );
      await writeFile(
        memberPath,
        "wrong",
        { mode: 0o600 },
      );
      const before = await lstat(memberPath, { bigint: true });
      await expectCodeV2(
        () => session.inspect(),
        "CLAIM_FIRST_CONFLICT",
      );
      const after = await lstat(memberPath, { bigint: true });
      assert.equal(after.ino, before.ino);
      assert.equal((await readFile(memberPath)).toString(), "wrong");
      await session.close();
    } finally {
      await spliceFixture.cleanup();
    }
  });

  it("replays every claim and member sync checkpoint through a fresh recovery invocation", async () => {
    const claimCheckpoints: readonly PlatformReleaseBootstrapActivationClaimFirstCheckpointV2[] = [
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimFileSync,
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimDirectorySync,
    ];
    for (const checkpoint of claimCheckpoints) {
      const fixture = await fixtureV2();
      try {
        const input = inputV2(fixture);
        await expectCodeV2(
          () =>
            createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
              input,
              (observed) => {
                if (observed === checkpoint) throw new Error("simulated claim sync interruption");
              },
            ),
          "CLAIM_FIRST_UNAVAILABLE",
        );
        const claimedEmpty = await inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input);
        assert.equal(claimedEmpty.status, "claimed_empty");
        const recovery = await resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
        for (const member of input.members) await recovery.writeMember(member.memberKind);
        assert.equal((await recovery.inspect()).status, "complete");
        await recovery.close();
      } finally {
        await fixture.cleanup();
      }
    }

    const memberCheckpoints: readonly PlatformReleaseBootstrapActivationClaimFirstCheckpointV2[] = [
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterMemberFileSync,
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterMemberDirectorySync,
    ];
    for (const checkpoint of memberCheckpoints) {
      const fixture = await fixtureV2();
      try {
        const input = inputV2(fixture);
        const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
          input,
          (observed, context) => {
            if (
              observed === checkpoint &&
              context.basename === "staged_activation_receipt"
            ) {
              throw new Error("simulated member sync interruption");
            }
          },
        );
        await expectCodeV2(
          () => session.writeMember("staged_activation_receipt"),
          "CLAIM_FIRST_UNAVAILABLE",
        );
        await session.close();
        const partial = await inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input);
        assert.equal(partial.status, "partial");
        assert.equal(
          partial.observedMembers[0]!.byteLength,
          input.members[0]!.bytes.byteLength,
        );
        const recovery = await resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
        for (const member of input.members) await recovery.writeMember(member.memberKind);
        assert.equal((await recovery.inspect()).status, "complete");
        await recovery.close();
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("fails closed when a checkpoint swaps the namespace parent toward an outside target", async () => {
    const checkpoints: readonly PlatformReleaseBootstrapActivationClaimFirstCheckpointV2[] = [
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterSkeletonDirectorySync,
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimFileSync,
      PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimDirectorySync,
    ];
    for (const checkpoint of checkpoints) {
      const fixture = await fixtureV2();
      const outside = await mkdtemp(
        path.join(os.tmpdir(), "setfarm-claim-first-hook-escape-"),
      );
      try {
        const input = inputV2(fixture);
        let swapped = false;
        await expectCodeV2(
          () =>
            createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
              input,
              async (observed) => {
                if (observed !== checkpoint || swapped) return;
                swapped = true;
                await rename(
                  fixture.namespaceParentPath,
                  path.join(fixture.root, "namespace-hook-old"),
                );
                await symlink(outside, fixture.namespaceParentPath);
              },
            ),
          "CLAIM_FIRST_CONFLICT",
        );
        assert.equal(swapped, true);
        assert.deepEqual(await readdir(outside), []);
        assert.equal(
          (await lstat(path.join(fixture.root, "namespace-hook-old"))).isDirectory(),
          true,
        );
      } finally {
        await fixture.cleanup();
        await rm(outside, { recursive: true, force: true });
      }
    }
  });

  it("rejects replacement namespace and staging directory identities without cleanup", async () => {
    const stagingFixture = await fixtureV2();
    try {
      const input = inputV2(stagingFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const oldStaging = path.join(stagingFixture.root, "staging-old");
      const expectedStageEntries = (await readdir(stagingFixture.stagingDirectoryPath)).sort();
      await rename(stagingFixture.stagingDirectoryPath, oldStaging);
      await mkdir(stagingFixture.stagingDirectoryPath, { mode: 0o700 });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      assert.equal((await lstat(oldStaging)).isDirectory(), true);
      assert.deepEqual((await readdir(oldStaging)).sort(), expectedStageEntries);
      assert.deepEqual(await readdir(stagingFixture.stagingDirectoryPath), []);
    } finally {
      await stagingFixture.cleanup();
    }

    const namespaceFixture = await fixtureV2();
    try {
      const input = inputV2(namespaceFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const claimBytes = await readFile(claimPathV2(namespaceFixture));
      const oldNamespace = path.join(namespaceFixture.root, "namespace-old");
      await rename(namespaceFixture.namespaceParentPath, oldNamespace);
      await mkdir(namespaceFixture.namespaceParentPath, { mode: 0o700 });
      await rename(
        path.join(oldNamespace, PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationClaimBasename),
        claimPathV2(namespaceFixture),
      );
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      assert.equal((await lstat(oldNamespace)).isDirectory(), true);
      assert.deepEqual(await readdir(oldNamespace), []);
      assert.deepEqual(await readFile(claimPathV2(namespaceFixture)), claimBytes);
    } finally {
      await namespaceFixture.cleanup();
    }
  });

  it("rejects malformed claim bytes and leaves the namespace untouched before mutation", async () => {
    const invalidUtf8Fixture = await fixtureV2();
    try {
      const input = inputV2(invalidUtf8Fixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const claimPath = claimPathV2(invalidUtf8Fixture);
      const claimBytes = await readFile(claimPath);
      const invalidOffset = claimBytes.findIndex((byte) => byte === 0x22);
      assert.ok(invalidOffset >= 0);
      const claimHandle = await open(claimPath, "r+");
      try {
        await claimHandle.write(Buffer.from([0x80]), 0, 1, invalidOffset);
        await claimHandle.sync();
      } finally {
        await claimHandle.close();
      }
      const malformedBytes = await readFile(claimPath);
      const malformedStat = await lstat(claimPath, { bigint: true });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      const afterMalformedStat = await lstat(claimPath, { bigint: true });
      assert.equal(afterMalformedStat.ino, malformedStat.ino);
      assert.deepEqual(await readFile(claimPath), malformedBytes);
    } finally {
      await invalidUtf8Fixture.cleanup();
    }

    const oversizedFixture = await fixtureV2();
    try {
      const base = inputV2(oversizedFixture);
      const oversized = {
        ...base,
        claimDocument: {
          ...base.claimDocument,
          padding: "p".repeat(100_000),
        },
      };
      await expectCodeV2(
        () => createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(oversized),
        "CLAIM_FIRST_INPUT_INVALID",
      );
      assert.deepEqual(await readdir(oversizedFixture.stagingDirectoryPath), []);
      await assert.rejects(
        () => lstat(claimPathV2(oversizedFixture)),
        (error: unknown) => (error as { code?: string }).code === "ENOENT",
      );
    } finally {
      await oversizedFixture.cleanup();
    }

    const authorityDocumentFixture = await fixtureV2();
    try {
      const base = inputV2(authorityDocumentFixture);
      const authorityDocumentInput = {
        ...base,
        claimDocument: {
          ...base.claimDocument,
          productionAuthority: false,
        },
      };
      await expectCodeV2(
        () => createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(authorityDocumentInput),
        "CLAIM_FIRST_INPUT_INVALID",
      );
      assert.deepEqual(await readdir(authorityDocumentFixture.stagingDirectoryPath), []);
      await assert.rejects(
        () => lstat(claimPathV2(authorityDocumentFixture)),
        (error: unknown) => (error as { code?: string }).code === "ENOENT",
      );
    } finally {
      await authorityDocumentFixture.cleanup();
    }

    const symlinkedRootFixture = await fixtureV2();
    const escapedTarget = await mkdtemp(
      path.join(os.tmpdir(), "setfarm-claim-first-escape-target-"),
    );
    try {
      const alias = path.join(symlinkedRootFixture.root, "alias");
      await symlink(escapedTarget, alias);
      const escapedRoot = path.join(alias, "setfarm-claim-first-v2-escaped");
      const escapedNamespace = path.join(escapedRoot, "namespace");
      const escapedStaging = path.join(escapedRoot, "staging");
      await mkdir(escapedRoot, { mode: 0o700 });
      await mkdir(escapedNamespace, { mode: 0o700 });
      await mkdir(escapedStaging, { mode: 0o700 });
      const base = inputV2(symlinkedRootFixture);
      const escapedInput = {
        ...base,
        namespaceParentPath: escapedNamespace,
        stagingDirectoryPath: escapedStaging,
      };
      await expectCodeV2(
        () => createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(escapedInput),
        "CLAIM_FIRST_INPUT_INVALID",
      );
      assert.deepEqual(await readdir(escapedStaging), []);
    } finally {
      await symlinkedRootFixture.cleanup();
      await rm(escapedTarget, { recursive: true, force: true });
    }
  });

  it("rejects symlink, hard-link, same-byte, and claim-race substitution without cleanup authority", async () => {
    const symlinkFixture = await fixtureV2();
    try {
      const input = inputV2(symlinkFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const memberPath = path.join(
        symlinkFixture.stagingDirectoryPath,
        "staged_shared_lock",
      );
      const outside = path.join(symlinkFixture.root, "outside");
      await writeFile(outside, "outside", { mode: 0o600 });
      await unlink(memberPath);
      await symlink(outside, memberPath);
      const linkBefore = await lstat(memberPath, { bigint: true });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      const linkAfter = await lstat(memberPath, { bigint: true });
      assert.equal(linkAfter.isSymbolicLink(), true);
      assert.equal(linkAfter.ino, linkBefore.ino);
      assert.equal((await readFile(outside)).toString(), "outside");
    } finally {
      await symlinkFixture.cleanup();
    }

    const hardlinkFixture = await fixtureV2();
    try {
      const input = inputV2(hardlinkFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.close();
      const memberPath = path.join(
        hardlinkFixture.stagingDirectoryPath,
        "staged_shared_lock",
      );
      const outside = path.join(hardlinkFixture.root, "outside");
      await writeFile(outside, "outside", { mode: 0o600 });
      await unlink(memberPath);
      await link(outside, memberPath);
      const hardlinkBefore = await lstat(memberPath, { bigint: true });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      const hardlinkAfter = await lstat(memberPath, { bigint: true });
      assert.equal(hardlinkAfter.ino, hardlinkBefore.ino);
      assert.equal((await readFile(outside)).toString(), "outside");
    } finally {
      await hardlinkFixture.cleanup();
    }

    const sameByteFixture = await fixtureV2();
    try {
      const input = inputV2(sameByteFixture);
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(input);
      await session.writeMember("staged_shared_lock");
      await session.close();
      const memberPath = path.join(
        sameByteFixture.stagingDirectoryPath,
        "staged_shared_lock",
      );
      const bytes = await readFile(memberPath);
      await unlink(memberPath);
      await writeFile(memberPath, bytes, { mode: 0o600 });
      const replacementBefore = await lstat(memberPath, { bigint: true });
      await expectCodeV2(
        () => inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(input),
        "CLAIM_FIRST_CONFLICT",
      );
      const replacementAfter = await lstat(memberPath, { bigint: true });
      assert.equal(replacementAfter.ino, replacementBefore.ino);
      assert.deepEqual(await readFile(memberPath), bytes);
    } finally {
      await sameByteFixture.cleanup();
    }

    const claimRaceFixture = await fixtureV2();
    try {
      const input = inputV2(claimRaceFixture);
      let replaced = false;
      let replacedClaimBytes: Buffer | undefined;
      let replacedClaimInode: bigint | undefined;
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
        input,
        async (checkpoint) => {
          if (
            !replaced &&
            checkpoint ===
              PlatformReleaseBootstrapActivationClaimFirstCheckpointV2
                .afterMemberFileSync
          ) {
            replaced = true;
            const claimPath = claimPathV2(claimRaceFixture);
            const bytes = await readFile(claimPath);
            await unlink(claimPath);
            await writeFile(claimPath, bytes, { mode: 0o600 });
            replacedClaimBytes = Buffer.from(bytes);
            replacedClaimInode = (await lstat(claimPath, { bigint: true })).ino;
          }
        },
      );
      await expectCodeV2(
        () => session.writeMember("staged_activation_receipt"),
        "CLAIM_FIRST_CONFLICT",
      );
      assert.equal(replaced, true);
      assert.ok(replacedClaimBytes);
      assert.equal((await lstat(claimPathV2(claimRaceFixture), { bigint: true })).ino, replacedClaimInode);
      assert.deepEqual(await readFile(claimPathV2(claimRaceFixture)), replacedClaimBytes);
      await session.close();
    } finally {
      await claimRaceFixture.cleanup();
    }

    const stagingRaceFixture = await fixtureV2();
    try {
      const input = inputV2(stagingRaceFixture);
      let swapped = false;
      const session = await createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
        input,
        async (checkpoint) => {
          if (
            !swapped &&
            checkpoint ===
              PlatformReleaseBootstrapActivationClaimFirstCheckpointV2
                .afterMemberFileSync
          ) {
            swapped = true;
            await rename(
              stagingRaceFixture.stagingDirectoryPath,
              path.join(stagingRaceFixture.root, "staging-race-old"),
            );
            await mkdir(stagingRaceFixture.stagingDirectoryPath, { mode: 0o700 });
          }
        },
      );
      await expectCodeV2(
        () => session.writeMember("staged_activation_receipt"),
        "CLAIM_FIRST_CONFLICT",
      );
      assert.equal(swapped, true);
      assert.deepEqual(await readdir(stagingRaceFixture.stagingDirectoryPath), []);
      assert.ok(
        (await readdir(path.join(stagingRaceFixture.root, "staging-race-old"))).includes(
          "staged_activation_receipt",
        ),
      );
      await session.close();
    } finally {
      await stagingRaceFixture.cleanup();
    }
  });
});
