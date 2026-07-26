import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCanonicalNpmExactVersionV2,
  isCanonicalNpmLockPackagePathV2,
  isCanonicalNpmPackageNameV2,
  isCanonicalNpmRootPackagePathV2,
  isSupportedNpmDependencySpecV2,
  npmPackageNameFromLockPathV2,
  npmVersionSatisfiesDependencySpecV2,
  resolveNpmDependencyPathV2,
} from
  "../../src/product-compiler/schemas/npm-lock-v3-grammar-v2.js";

describe("npm lock-v3 grammar V2", () => {
  it("owns one exact package-name and lock-path grammar", () => {
    const maximumSegment = `a${"b".repeat(99)}`;
    for (const accepted of [
      "a",
      "a-b_c.d",
      "@scope/package",
      maximumSegment,
      `@${maximumSegment}/${maximumSegment}`,
    ]) {
      assert.equal(
        isCanonicalNpmPackageNameV2(accepted),
        true,
        accepted,
      );
    }
    for (const rejected of [
      "",
      "A",
      "a~b",
      ".hidden",
      "@scope",
      "@scope/package/extra",
      `a${"b".repeat(100)}`,
      "../package",
    ]) {
      assert.equal(
        isCanonicalNpmPackageNameV2(rejected),
        false,
        rejected,
      );
    }

    const nested =
      "node_modules/@scope/owner/node_modules/child";
    assert.equal(
      isCanonicalNpmLockPackagePathV2(nested),
      true,
    );
    assert.equal(
      isCanonicalNpmRootPackagePathV2(
        "node_modules/@scope/owner",
      ),
      true,
    );
    assert.equal(
      isCanonicalNpmRootPackagePathV2(nested),
      false,
    );
    assert.equal(
      npmPackageNameFromLockPathV2(nested),
      "child",
    );
    for (const rejected of [
      "node_modules/a~b",
      `node_modules/a${"b".repeat(100)}`,
      "node_modules/../package",
      "packages/package",
    ]) {
      assert.equal(
        isCanonicalNpmLockPackagePathV2(rejected),
        false,
        rejected,
      );
    }
  });

  it("admits only canonical exact versions and supported dependency specs", () => {
    for (const accepted of [
      "0.0.0",
      "1.2.3",
      "999999999999999999.0.1",
    ]) {
      assert.equal(
        isCanonicalNpmExactVersionV2(accepted),
        true,
        accepted,
      );
    }
    for (const rejected of [
      "01.2.3",
      "1.2",
      "1.2.3-beta.1",
      "1.2.3+build",
      " 1.2.3",
    ]) {
      assert.equal(
        isCanonicalNpmExactVersionV2(rejected),
        false,
        rejected,
      );
    }
    for (const accepted of [
      "*",
      "1",
      "^1",
      "1.2.3",
      "^1.2.3",
      "~1.2.3",
      ">= 1.2.3 < 2.0.0",
    ]) {
      assert.equal(
        isSupportedNpmDependencySpecV2(accepted),
        true,
        accepted,
      );
    }
    for (const rejected of [
      "latest",
      "1.x",
      "^1.2.3-beta.1",
      ">=1.2.3 <2.0.0",
      ">=2.0.0 <1.0.0",
      "",
    ]) {
      assert.equal(
        isSupportedNpmDependencySpecV2(rejected),
        false,
        rejected,
      );
    }
  });

  it("uses the admitted spec grammar for exact satisfaction and nearest resolution", () => {
    assert.equal(
      npmVersionSatisfiesDependencySpecV2(
        "1.5.0",
        "^1.2.3",
      ),
      true,
    );
    assert.equal(
      npmVersionSatisfiesDependencySpecV2(
        "2.0.0",
        "^1.2.3",
      ),
      false,
    );
    assert.equal(
      npmVersionSatisfiesDependencySpecV2(
        "1.2.9",
        "~1.2.3",
      ),
      true,
    );
    assert.equal(
      npmVersionSatisfiesDependencySpecV2(
        "1.3.0",
        "~1.2.3",
      ),
      false,
    );
    assert.equal(
      npmVersionSatisfiesDependencySpecV2(
        "1.5.0",
        "latest",
      ),
      false,
    );

    const packagePaths = new Set([
      "node_modules/owner",
      "node_modules/owner/node_modules/child",
      "node_modules/hoisted",
    ]);
    assert.equal(
      resolveNpmDependencyPathV2(
        packagePaths,
        "node_modules/owner",
        "child",
      ),
      "node_modules/owner/node_modules/child",
    );
    assert.equal(
      resolveNpmDependencyPathV2(
        packagePaths,
        "node_modules/owner",
        "hoisted",
      ),
      "node_modules/hoisted",
    );
    assert.equal(
      resolveNpmDependencyPathV2(
        packagePaths,
        "node_modules/owner",
        "a~b",
      ),
      null,
    );
  });
});
