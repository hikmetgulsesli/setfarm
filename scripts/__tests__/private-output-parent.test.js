import assert from "node:assert/strict";
import * as fs from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createPrivateOutputParent } from "./fixtures/private-output-parent.mjs";

function withFixture(action) {
  const paths = [];
  const opened = [];
  const closed = [];
  const groups = [];
  const io = {
    ...fs,
    mkdtempSync(prefix) {
      const created = fs.mkdtempSync(prefix);
      paths.push(created);
      return created;
    },
    openSync(...args) {
      const descriptor = fs.openSync(...args);
      opened.push(descriptor);
      return descriptor;
    },
    fchownSync(...args) {
      groups.push(args);
      return fs.fchownSync(...args);
    },
    closeSync(descriptor) {
      closed.push(descriptor);
      return fs.closeSync(descriptor);
    },
  };
  const prefix = join("/tmp", "setfarm-output-parent-test-");
  try {
    action({ io, prefix, paths, opened, closed, groups });
  } finally {
    // Only this test's newly created paths/descriptors are owned by this harness.
    for (const descriptor of opened) {
      try {
        fs.fstatSync(descriptor);
      } catch (error) {
        if (error.code === "EBADF") continue;
        throw error;
      }
      fs.closeSync(descriptor);
    }
    for (const path of paths.reverse()) fs.rmSync(path, { recursive: true });
  }
}

function assertClosedOnce(opened, closed) {
  assert.deepEqual(closed, opened);
  for (const descriptor of opened) {
    assert.throws(() => fs.fstatSync(descriptor), { code: "EBADF" });
  }
}

function errorFrom(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail("expected preparation to refuse");
}

function identityMetadata(path) {
  const { dev, ino, uid, gid, mode } = fs.lstatSync(path);
  return { dev, ino, uid, gid, mode };
}

describe("fresh private output-parent preparation", () => {
  it("establishes actual current GID under /tmp before a builder consumes it", () => {
    withFixture(({ io, prefix, opened, closed }) => {
      const root = createPrivateOutputParent(prefix, io);
      const stat = fs.lstatSync(root);
      assert.equal(root, fs.realpathSync(root));
      assert.equal(stat.uid, process.getuid());
      assert.equal(stat.gid, process.getgid());
      assert.equal(stat.mode & 0o7777, 0o700);
      assert.equal(stat.isDirectory(), true);
      assert.equal(stat.isSymbolicLink(), false);
      assert.deepEqual(fs.readdirSync(root), []);
      assert.equal(opened.length, 1);
      assertClosedOnce(opened, closed);
    });
  });

  it("returns distinct canonical identities from alias and canonical prefixes", () => {
    withFixture(({ io, prefix, opened, closed }) => {
      const first = createPrivateOutputParent(prefix, io);
      const second = createPrivateOutputParent(
        join(fs.realpathSync("/tmp"), "setfarm-output-parent-test-"), io,
      );
      assert.notEqual(first, second);
      assert.notEqual(fs.lstatSync(first).ino, fs.lstatSync(second).ino);
      for (const root of [first, second]) {
        assert.equal(root, fs.realpathSync(root));
        assert.equal(fs.lstatSync(root).gid, process.getgid());
      }
      assert.equal(opened.length, 2);
      assertClosedOnce(opened, closed);
    });
  });

  it("rejects invalid prefixes before creating any path", () => {
    withFixture(({ io, paths, opened }) => {
      for (const prefix of [null, 1, "", "relative-", "/tmp/../tmp/test-",
        "/tmp/nul\0-", `/tmp/${"x".repeat(4097)}`, `/tmp/${"é".repeat(2050)}`]) {
        assert.throws(() => createPrivateOutputParent(prefix, io), /prefix/u);
      }
      assert.deepEqual(paths, []);
      assert.deepEqual(opened, []);
    });
  });

  it("propagates creation and canonicalization failures without opening a descriptor", () => {
    withFixture(({ io, prefix, paths, opened }) => {
      const failure = new Error("fixture creation denied");
      assert.equal(errorFrom(() => createPrivateOutputParent(prefix, {
        ...io, mkdtempSync() { throw failure; },
      })), failure);
      assert.deepEqual(paths, []);
      const resolution = new Error("canonicalization denied");
      assert.equal(errorFrom(() => createPrivateOutputParent(prefix, {
        ...io, realpathSync() { throw resolution; },
      })), resolution);
      assert.equal(paths.length, 1);
      assert.equal(fs.lstatSync(paths[0]).isDirectory(), true);
      assert.deepEqual(opened, []);
    });
  });

  it("does not repair a newly created parent with invalid mode or ownership", () => {
    withFixture(({ io, prefix, opened, groups, paths }) => {
      assert.throws(() => createPrivateOutputParent(prefix, {
        ...io,
        mkdtempSync(value) {
          const root = io.mkdtempSync(value);
          fs.chmodSync(root, 0o755);
          return root;
        },
      }), /private|ownership|metadata/u);
      assert.equal(fs.lstatSync(paths[0]).mode & 0o7777, 0o755);
      assert.deepEqual(opened, []);
      assert.deepEqual(groups, []);

      // Only the OS metadata observation is interposed; do not chown foreign UID.
      assert.throws(() => createPrivateOutputParent(prefix, {
        ...io,
        lstatSync(...args) {
          const stat = fs.lstatSync(...args);
          stat.uid += 1n;
          return stat;
        },
      }), /private|ownership|metadata/u);
      assert.deepEqual(groups, []);
    });
  });

  it("refuses an open failure and retains the new path without group effects", () => {
    withFixture(({ io, prefix, paths, opened, closed, groups }) => {
      const failure = new Error("directory open denied");
      assert.equal(errorFrom(() => createPrivateOutputParent(prefix, {
        ...io, openSync() { throw failure; },
      })), failure);
      assert.equal(fs.lstatSync(paths[0]).isDirectory(), true);
      assert.deepEqual(opened, []);
      assert.deepEqual(closed, []);
      assert.deepEqual(groups, []);
    });
  });

  it("refuses pre-group metadata drift and closes the held descriptor once", () => {
    for (const field of ["uid", "gid", "mode"]) {
      withFixture(({ io, prefix, opened, closed, groups }) => {
        assert.throws(() => createPrivateOutputParent(prefix, {
          ...io,
          fstatSync(...args) {
            const stat = fs.fstatSync(...args);
            stat[field] += 1n;
            return stat;
          },
        }), /private|ownership|metadata/u);
        assert.equal(opened.length, 1);
        assert.deepEqual(groups, []);
        assertClosedOnce(opened, closed);
      });
    }
  });

  it("rejects pre-group path replacement without preparing the replacement", () => {
    withFixture(({ io, prefix, paths, opened, closed, groups }) => {
      let replaced = false;
      let original;
      let replacement;
      assert.throws(() => createPrivateOutputParent(prefix, {
        ...io,
        openSync(path, flags) {
          const descriptor = io.openSync(path, flags);
          original = identityMetadata(path);
          const moved = `${path}.original`;
          fs.renameSync(path, moved);
          paths.push(moved);
          fs.mkdirSync(path, { mode: 0o700 });
          replacement = identityMetadata(path);
          replaced = true;
          return descriptor;
        },
      }), /private|ownership|identity|metadata/u);
      assert.equal(replaced, true);
      assert.equal(fs.lstatSync(paths[0]).mode & 0o7777, 0o700);
      assert.notEqual(replacement.ino, original.ino);
      assert.equal(replacement.uid, original.uid);
      assert.equal(replacement.gid, original.gid);
      assert.deepEqual(identityMetadata(paths[0]), replacement);
      assert.deepEqual(identityMetadata(paths[1]), original);
      assert.deepEqual(groups, []);
      assertClosedOnce(opened, closed);
    });
  });

  it("retains inherited group and closes once when group preparation is denied", () => {
    withFixture(({ io, prefix, paths, opened, closed }) => {
      let inherited;
      const failure = new Error("group preparation denied");
      const result = errorFrom(() => createPrivateOutputParent(prefix, {
        ...io,
        mkdtempSync(value) {
          const root = io.mkdtempSync(value);
          inherited = fs.lstatSync(root).gid;
          return root;
        },
        fchownSync() { throw failure; },
      }));
      assert.equal(result, failure);
      assert.equal(fs.lstatSync(paths[0]).gid, inherited);
      assert.equal(fs.lstatSync(paths[0]).mode & 0o7777, 0o700);
      assertClosedOnce(opened, closed);
    });
  });

  it("rejects post-group path rebinding without changing the replacement", () => {
    withFixture(({ io, prefix, paths, opened, closed, groups }) => {
      let replacement;
      assert.throws(() => createPrivateOutputParent(prefix, {
        ...io,
        fchownSync(descriptor, uid, gid) {
          io.fchownSync(descriptor, uid, gid);
          const root = fs.realpathSync(paths[0]);
          const moved = `${root}.original`;
          fs.renameSync(root, moved);
          paths.push(moved);
          fs.mkdirSync(root, { mode: 0o700 });
          fs.chownSync(root, process.getuid(), process.getgid());
          replacement = identityMetadata(root);
        },
      }), /private|ownership|identity|metadata/u);
      assert.equal(groups.length, 1);
      assert.equal(fs.lstatSync(paths[0]).mode & 0o7777, 0o700);
      assert.equal(fs.lstatSync(paths[0]).gid, process.getgid());
      assert.equal(fs.lstatSync(paths[1]).gid, process.getgid());
      assert.notEqual(replacement.ino, fs.lstatSync(paths[1]).ino);
      assert.deepEqual(identityMetadata(paths[0]), replacement);
      assertClosedOnce(opened, closed);
    });
  });

  it("requires a successful close before returning and never retries close", () => {
    withFixture(({ io, prefix, opened, closed }) => {
      const failure = new Error("close failed after actual closure");
      assert.equal(errorFrom(() => createPrivateOutputParent(prefix, {
        ...io,
        closeSync(descriptor) {
          io.closeSync(descriptor);
          throw failure;
        },
      })), failure);
      assert.equal(opened.length, 1);
      assertClosedOnce(opened, closed);
    });
  });

  it("preserves operation and close failures with the operation as cause", () => {
    withFixture(({ io, prefix, opened, closed }) => {
      const operation = new Error("held metadata failed");
      const close = new Error("close also failed");
      const error = errorFrom(() => createPrivateOutputParent(prefix, {
        ...io,
        fstatSync() { throw operation; },
        closeSync(descriptor) {
          io.closeSync(descriptor);
          throw close;
        },
      }));
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [operation, close]);
      assert.equal(error.cause, operation);
      assertClosedOnce(opened, closed);
    });
  });
});
