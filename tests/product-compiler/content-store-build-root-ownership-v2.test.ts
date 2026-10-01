import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { it } from "node:test";
import {
  observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2,
} from "../../src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.js";

// Missing fresh-root group preparation must prevent this from reaching the
// lower injected builder failure; it must never be replaced by a TMPDIR fix.
it("prepares its fresh root before the contained false-authority builder fault", {
  skip: process.platform !== "darwin",
}, async () => {
  const result = await observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2(
    "stdout_stream_error",
  );
  assert.match(result.error.message, /stdout stream failed/u);
  assert.equal(result.productionAuthority, false);
  assert.equal(result.admissionScope, "test_fixture");
  assert.equal(result.retainedEvidence.rootMode, 0o700);
  assert.equal(result.retainedEvidence.binaryPresent, false);
  assert.equal(result.retentionDisposition.filesystemMutationPerformed, false);
  assert.equal(result.retentionDisposition.deletionAuthority, false);
});

for (const scenario of [
  "pre_identity_drift", "group_denial", "post_identity_drift",
  "close_denial", "group_and_close_denial",
  "closed_path_rebind",
] as const) {
  it(`denies fresh-root admission and retains evidence after ${scenario}`, {
    skip: process.platform !== "darwin",
  }, async (t) => {
    const originals = {
      mkdtempSync: fs.mkdtempSync, openSync: fs.openSync,
      fstatSync: fs.fstatSync, fchownSync: fs.fchownSync,
      closeSync: fs.closeSync, lstatSync: fs.lstatSync,
    };
    const groupError = new Error("injected held-root group denial");
    const closeError = new Error("injected held-root close denial");
    let alias = "";
    let before: fs.BigIntStats;
    const opened: number[] = [];
    const closed: number[] = [];
    let groupCalls = 0;
    let statusCalls = 0;
    let spawnCalls = 0;
    let replacement: fs.BigIntStats | undefined;
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      alias = originals.mkdtempSync(prefix);
      before = originals.lstatSync(alias, { bigint: true });
      return alias;
    });
    t.mock.method(fs, "openSync", (...args: Parameters<typeof fs.openSync>) => {
      const descriptor = originals.openSync(...args);
      opened.push(descriptor);
      return descriptor;
    });
    t.mock.method(fs, "fstatSync", (descriptor: number, options: { bigint: true }) => {
      const status = originals.fstatSync(descriptor, options);
      statusCalls++;
      if ((scenario === "pre_identity_drift" && statusCalls === 1)
        || (scenario === "post_identity_drift" && statusCalls === 2)) {
        return Object.assign(Object.create(status), { ino: status.ino + 1n });
      }
      return status;
    });
    t.mock.method(fs, "fchownSync", (descriptor: number, uid: number, gid: number) => {
      groupCalls++;
      if (scenario === "group_denial" || scenario === "group_and_close_denial") {
        throw groupError;
      }
      originals.fchownSync(descriptor, uid, gid);
    });
    t.mock.method(fs, "closeSync", (descriptor: number) => {
      closed.push(descriptor);
      originals.closeSync(descriptor);
      if (scenario === "closed_path_rebind" && closed.length === 1) {
        fs.renameSync(alias, `${alias}-retained`);
        fs.mkdirSync(alias, { mode: 0o700 });
        const foreign = originals.openSync(alias,
          fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        try {
          originals.fchownSync(foreign, process.getuid!(), process.getgid!());
        } finally {
          originals.closeSync(foreign);
        }
        replacement = originals.lstatSync(alias, { bigint: true });
      }
      if (scenario === "close_denial" || scenario === "group_and_close_denial") {
        throw closeError;
      }
    });
    t.mock.method(childProcess, "spawn", () => {
      spawnCalls++;
      throw new Error("builder must not start after root preparation denial");
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2(
          "stdout_stream_error",
        ),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          const cause = error.cause;
          if (scenario === "group_and_close_denial") {
            assert.ok(cause instanceof AggregateError);
            assert.deepEqual(cause.errors, [groupError, closeError]);
            assert.equal(cause.cause, groupError);
          } else if (scenario === "group_denial") {
            assert.equal(cause, groupError);
          } else if (scenario === "close_denial") {
            assert.equal(cause, closeError);
          } else {
            assert.match(error.message, /fresh build-root identity/u);
          }
          return true;
        },
      );
      assert.equal(spawnCalls, 0);
      assert.equal(opened.length, 1);
      assert.deepEqual(closed, opened);
      assert.throws(() => originals.fstatSync(opened[0]!), { code: "EBADF" });
      assert.equal(groupCalls, scenario === "pre_identity_drift" ? 0 : 1);
      const retained = originals.lstatSync(scenario === "closed_path_rebind"
        ? `${alias}-retained` : alias, { bigint: true });
      assert.equal(retained.dev, before!.dev);
      assert.equal(retained.ino, before!.ino);
      assert.equal(retained.uid, before!.uid);
      assert.equal(retained.mode, before!.mode);
      assert.equal(retained.gid, scenario === "pre_identity_drift"
        || scenario === "group_denial" || scenario === "group_and_close_denial"
        ? before!.gid : BigInt(process.getgid!()));
      assert.deepEqual(fs.readdirSync(alias), []);
      if (replacement !== undefined) {
        const current = originals.lstatSync(alias, { bigint: true });
        for (const key of ["dev", "ino", "uid", "gid", "mode"] as const) {
          assert.equal(current[key], replacement[key]);
        }
      }
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
      // The fixture contract retains roots on failure: no path-based cleanup.
    }
  });
}
