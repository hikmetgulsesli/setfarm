import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchesExactStableFilesystemObjectIdentityV2,
  matchesExactStableFilesystemObjectV2,
  projectExactStableFilesystemIdentityToSafeNumbersV2,
} from "../../src/product-compiler/exact-stable-filesystem-identity-v2.js";

describe("exact stable filesystem identity V2 bridge", () => {
  it("projects only identities whose device and inode values are injective in the V2 number ABI", () => {
    assert.deepEqual(
      projectExactStableFilesystemIdentityToSafeNumbersV2({
        device: 9_007_199_254_740_991n,
        inode: 9_007_199_254_740_990n,
      }),
      {
        device: Number.MAX_SAFE_INTEGER,
        inode: Number.MAX_SAFE_INTEGER - 1,
      },
    );
    assert.equal(
      projectExactStableFilesystemIdentityToSafeNumbersV2({
        device: 9_007_199_254_740_993n,
        inode: 1n,
      }),
      undefined,
    );
    assert.equal(
      projectExactStableFilesystemIdentityToSafeNumbersV2({
        device: 1n,
        inode: -1n,
      }),
      undefined,
    );
  });

  it("requires the exact projected identity and object kind at a destructive boundary", () => {
    const fileStat = {
      dev: 41n,
      ino: 73n,
      isSymbolicLink: () => false,
      isFile: () => true,
      isDirectory: () => false,
    };
    assert.equal(
      matchesExactStableFilesystemObjectV2({
        stat: fileStat,
        expected: { device: 41, inode: 73 },
        objectKind: "ordinary_file",
      }),
      true,
    );
    assert.equal(
      matchesExactStableFilesystemObjectV2({
        stat: fileStat,
        expected: { device: 41, inode: 73 },
        objectKind: "directory",
      }),
      false,
    );
    assert.equal(
      matchesExactStableFilesystemObjectV2({
        stat: {
          ...fileStat,
          dev: BigInt(Number.MAX_SAFE_INTEGER) + 2n,
        },
        expected: { device: 41, inode: 73 },
        objectKind: "ordinary_file",
      }),
      false,
    );
    assert.equal(
      matchesExactStableFilesystemObjectV2({
        stat: {
          ...fileStat,
          isSymbolicLink: () => true,
        },
        expected: { device: 41, inode: 73 },
        objectKind: "ordinary_file",
      }),
      false,
    );
  });

  it("keeps bigint identities exact without a legacy number projection", () => {
    const directoryStat = {
      dev: BigInt(Number.MAX_SAFE_INTEGER) + 2n,
      ino: BigInt(Number.MAX_SAFE_INTEGER) + 3n,
      isSymbolicLink: () => false,
      isFile: () => false,
      isDirectory: () => true,
    };
    assert.equal(
      matchesExactStableFilesystemObjectIdentityV2({
        stat: directoryStat,
        expected: {
          device: BigInt(Number.MAX_SAFE_INTEGER) + 2n,
          inode: BigInt(Number.MAX_SAFE_INTEGER) + 3n,
        },
        objectKind: "directory",
      }),
      true,
    );
    assert.equal(
      matchesExactStableFilesystemObjectIdentityV2({
        stat: directoryStat,
        expected: {
          device: BigInt(Number.MAX_SAFE_INTEGER) + 2n,
          inode: BigInt(Number.MAX_SAFE_INTEGER) + 4n,
        },
        objectKind: "directory",
      }),
      false,
    );
  });
});
