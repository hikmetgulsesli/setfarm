import assert from "node:assert/strict";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  assertNodeCandidateRuntimeExactFilesystemIdentityCurrentInternalV2,
  captureNodeCandidateRuntimeExactFilesystemIdentityInternalV2,
} from "../../src/product-compiler/node-candidate-runtime-private-materializer-v2.js";

test("candidate runtime cleanup fence rejects exact replacement and kind drift", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "setfarm-candidate-runtime-identity-test-"),
  );
  try {
    const lockPath = path.join(root, "package-lock.json");
    await writeFile(lockPath, "original\n", { mode: 0o444 });
    const lockIdentity =
      captureNodeCandidateRuntimeExactFilesystemIdentityInternalV2(
        lockPath,
        "ordinary_file",
      );
    assert.doesNotThrow(() =>
      assertNodeCandidateRuntimeExactFilesystemIdentityCurrentInternalV2({
        absolutePath: lockPath,
        expected: lockIdentity,
      }),
    );

    const replacementPath = path.join(root, "replacement");
    await writeFile(replacementPath, "replacement\n", { mode: 0o444 });
    await rename(replacementPath, lockPath);
    assert.throws(
      () =>
        assertNodeCandidateRuntimeExactFilesystemIdentityCurrentInternalV2({
          absolutePath: lockPath,
          expected: lockIdentity,
        }),
      (error: unknown) =>
        error !== null
        && typeof error === "object"
        && "code" in error
        && error.code === "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
    );

    const bundlePath = path.join(root, "candidate-bundle");
    await mkdir(bundlePath, { mode: 0o700 });
    const bundleIdentity =
      captureNodeCandidateRuntimeExactFilesystemIdentityInternalV2(
        bundlePath,
        "directory",
      );
    assert.doesNotThrow(() =>
      assertNodeCandidateRuntimeExactFilesystemIdentityCurrentInternalV2({
        absolutePath: bundlePath,
        expected: bundleIdentity,
      }),
    );
    await rm(bundlePath, { recursive: true, force: true });
    await writeFile(bundlePath, "not-a-directory\n", { mode: 0o600 });
    assert.throws(
      () =>
        assertNodeCandidateRuntimeExactFilesystemIdentityCurrentInternalV2({
          absolutePath: bundlePath,
          expected: bundleIdentity,
        }),
      (error: unknown) =>
        error !== null
        && typeof error === "object"
        && "code" in error
        && error.code === "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
