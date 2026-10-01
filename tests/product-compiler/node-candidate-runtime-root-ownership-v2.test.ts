import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

// Execute the actual unexported production constructor, not a copied fixture.
// The finite VM module adds a test-context export without changing production
// APIs. Real imports stay bound to the source filename; no DB/run is started.
const filename = fileURLToPath(new URL(
  "../../src/product-compiler/node-candidate-runtime-private-materializer-v2.ts",
  import.meta.url,
));
const compiled = ts.transpileModule(
  `${fs.readFileSync(filename, "utf8")}\nexports.layoutForThisTest = createLayout;`,
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } },
).outputText;
const finiteModule = { exports: {} as Record<string, unknown> };
new Script(`(function(require,exports,module,__filename,__dirname){${compiled}\n})`, {
  filename,
}).runInThisContext()(
  createRequire(filename), finiteModule.exports, finiteModule, filename, path.dirname(filename),
);
const createLayout = finiteModule.exports.layoutForThisTest as (
  scope: "production_host" | "test_fixture",
) => Readonly<{
  attemptRoot: string; bundleRoot: string; applicationRoot: string;
  attemptIdentity: { device: number; inode: number; ownerUid: number; ownerGid: number };
}>;

for (const scope of ["production_host", "test_fixture"] as const) {
  it(`prepares the actual ${scope} runtime root with the current process group`, {
    skip: process.platform !== "darwin",
  }, (t) => {
    // Removing descriptor GID preparation must fail before this layout exists.
    const originalCreate = fs.mkdtempSync;
    let created: fs.BigIntStats | undefined;
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      const root = originalCreate(prefix);
      created = fs.lstatSync(root, { bigint: true });
      t.diagnostic(`fresh root UID=${created.uid} inheritedGID=${created.gid}`);
      return root;
    });
    syncBuiltinESMExports();
    try {
      const layout = createLayout(scope);
      assert.ok(created);
      for (const root of [layout.attemptRoot, layout.bundleRoot, layout.applicationRoot]) {
        const status = fs.lstatSync(root, { bigint: true });
        assert.ok(status.isDirectory() && !status.isSymbolicLink());
        assert.equal(status.uid, BigInt(process.getuid!()));
        assert.equal(status.gid, BigInt(process.getgid!()));
        assert.equal(status.mode & 0o7777n, 0o700n);
        assert.equal(fs.realpathSync(root), root);
      }
      const current = fs.lstatSync(layout.attemptRoot, { bigint: true });
      assert.equal(current.dev, created.dev);
      assert.equal(current.ino, created.ino);
      assert.equal(current.mode, created.mode);
      assert.equal(layout.attemptIdentity.ownerGid, process.getgid!());
      assert.deepEqual(fs.readdirSync(layout.applicationRoot), []);
      // Retain the invocation-owned layout; no pathname-based test cleanup.
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const boundary of ["numeric_lstat", "empty_census", "bundle_capture"] as const) {
  it(`does not adopt a same-owner empty replacement at the ${boundary} layout boundary`, {
    skip: process.platform !== "darwin",
  }, (t) => {
    const original = {
      mkdtempSync: fs.mkdtempSync, lstatSync: fs.lstatSync,
      readdirSync: fs.readdirSync, mkdirSync: fs.mkdirSync,
      chmodSync: fs.chmodSync, rmSync: fs.rmSync,
    };
    let alias = "";
    let created: fs.BigIntStats;
    let replacement: fs.BigIntStats | undefined;
    let effectsAfterRebind = 0;
    let consumerStatObserved = false;
    const rebind = (): void => {
      fs.renameSync(alias, `${alias}-retained`);
      original.mkdirSync(alias, { mode: 0o700 });
      const fd = fs.openSync(alias,
        fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
      finally { fs.closeSync(fd); }
      replacement = original.lstatSync(alias, { bigint: true });
    };
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      alias = original.mkdtempSync(prefix);
      created = original.lstatSync(alias, { bigint: true });
      return alias;
    });
    t.mock.method(fs, "lstatSync", (target: fs.PathLike, options?: { bigint: true }) => {
      if (target === alias && !options) {
        consumerStatObserved = true;
        if (!replacement && boundary === "numeric_lstat") rebind();
      }
      const status = original.lstatSync(target, options as { bigint: true });
      if (!replacement && boundary === "bundle_capture"
        && target === path.join(alias, "candidate-bundle") && options?.bigint) rebind();
      return status;
    });
    t.mock.method(fs, "readdirSync", (...args: Parameters<typeof fs.readdirSync>) => {
      const value = original.readdirSync(...args);
      if (args[0] === alias && consumerStatObserved && !replacement
        && boundary === "empty_census") rebind();
      return value;
    });
    t.mock.method(fs, "mkdirSync", (...args: Parameters<typeof fs.mkdirSync>) => {
      if (replacement) effectsAfterRebind++;
      return original.mkdirSync(...args);
    });
    t.mock.method(fs, "chmodSync", (...args: Parameters<typeof fs.chmodSync>) => {
      if (replacement) effectsAfterRebind++;
      return original.chmodSync(...args);
    });
    t.mock.method(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
      if (replacement) effectsAfterRebind++;
      return original.rmSync(...args);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => createLayout("production_host"), {
        code: "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID",
      });
      assert.ok(replacement);
      assert.equal(effectsAfterRebind, 0);
      assert.deepEqual(original.readdirSync(alias), []);
      const current = original.lstatSync(alias, { bigint: true });
      for (const key of ["dev", "ino", "uid", "gid", "mode"] as const) {
        assert.equal(current[key], replacement[key]);
      }
      const retained = original.lstatSync(`${alias}-retained`, { bigint: true });
      assert.equal(retained.dev, created!.dev);
      assert.equal(retained.ino, created!.ino);
      assert.equal(retained.mode, created!.mode);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const scenario of [
  "pre_identity_drift", "group_denial", "post_identity_drift",
  "close_denial", "group_and_close_denial", "pre_path_rebind",
  "closed_path_rebind", "child_layout_denial", "partial_layout_denial",
] as const) {
  it(`retains the actual layout and denies admission after ${scenario}`, {
    skip: process.platform !== "darwin",
  }, (t) => {
    const originals = {
      mkdtempSync: fs.mkdtempSync, openSync: fs.openSync,
      fstatSync: fs.fstatSync, fchownSync: fs.fchownSync,
      closeSync: fs.closeSync, lstatSync: fs.lstatSync,
      mkdirSync: fs.mkdirSync, chmodSync: fs.chmodSync, rmSync: fs.rmSync,
    };
    const groupError = new Error("injected candidate group denial");
    const closeError = new Error("injected candidate close denial");
    const layoutError = new Error("injected candidate child layout denial");
    let alias = "";
    let created: fs.BigIntStats;
    let replacement: fs.BigIntStats | undefined;
    let held: number | undefined;
    let closed = false;
    let groupCalls = 0;
    let statusCalls = 0;
    let chmodCalls = 0;
    let deletionCalls = 0;
    const rebind = (): void => {
      fs.renameSync(alias, `${alias}-retained`);
      originals.mkdirSync(alias, { mode: 0o700 });
      fs.writeFileSync(path.join(alias, "foreign-evidence"), "preserve\n", { mode: 0o600 });
      replacement = originals.lstatSync(alias, { bigint: true });
    };
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      alias = originals.mkdtempSync(prefix);
      created = originals.lstatSync(alias, { bigint: true });
      return alias;
    });
    t.mock.method(fs, "openSync", (...args: Parameters<typeof fs.openSync>) => {
      const descriptor = originals.openSync(...args);
      if (args[0] === alias && held === undefined) {
        held = descriptor;
        if (scenario === "pre_path_rebind") rebind();
      }
      return descriptor;
    });
    t.mock.method(fs, "fstatSync", (descriptor: number, options?: { bigint: true }) => {
      const status = originals.fstatSync(descriptor, options as { bigint: true });
      if (descriptor === held && !closed) {
        statusCalls++;
        if ((scenario === "pre_identity_drift" && statusCalls === 1)
          || (scenario === "post_identity_drift" && statusCalls === 2)) {
          return Object.assign(Object.create(status), { ino: status.ino + 1n });
        }
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
      originals.closeSync(descriptor);
      if (descriptor === held && !closed) {
        closed = true;
        if (scenario === "closed_path_rebind") rebind();
        if (scenario === "close_denial" || scenario === "group_and_close_denial") {
          throw closeError;
        }
      }
    });
    t.mock.method(fs, "mkdirSync", (...args: Parameters<typeof fs.mkdirSync>) => {
      if (scenario === "child_layout_denial" && args[0] === path.join(alias, "candidate-bundle")) {
        throw layoutError;
      }
      if (scenario === "partial_layout_denial"
        && args[0] === path.join(alias, "candidate-bundle", "application")) throw layoutError;
      return originals.mkdirSync(...args);
    });
    t.mock.method(fs, "chmodSync", (...args: Parameters<typeof fs.chmodSync>) => {
      chmodCalls++;
      return originals.chmodSync(...args);
    });
    t.mock.method(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
      deletionCalls++;
      return originals.rmSync(...args);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => createLayout("production_host"), (error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID");
        if (scenario === "group_and_close_denial") {
          assert.ok(error.cause instanceof AggregateError);
          assert.deepEqual(error.cause.errors, [groupError, closeError]);
          assert.equal(error.cause.cause, groupError);
        } else if (scenario === "group_denial") {
          assert.equal(error.cause, groupError);
        } else if (scenario === "close_denial") {
          assert.equal(error.cause, closeError);
        } else if (scenario === "child_layout_denial" || scenario === "partial_layout_denial") {
          assert.equal(error.cause, layoutError);
        } else {
          assert.match(String(error.cause ?? error), /identity/u);
        }
        return true;
      });
      assert.equal(chmodCalls, 0);
      assert.equal(deletionCalls, 0);
      assert.ok(closed);
      assert.throws(() => originals.fstatSync(held!), { code: "EBADF" });
      assert.equal(groupCalls,
        scenario === "pre_identity_drift" || scenario === "pre_path_rebind" ? 0 : 1);
      const retained = originals.lstatSync(replacement ? `${alias}-retained` : alias, {
        bigint: true,
      });
      for (const key of ["dev", "ino", "uid", "mode"] as const) {
        assert.equal(retained[key], created![key]);
      }
      assert.equal(retained.gid, scenario === "pre_identity_drift"
        || scenario === "pre_path_rebind" || scenario === "group_denial"
        || scenario === "group_and_close_denial" ? created!.gid : BigInt(process.getgid!()));
      if (replacement) {
        const current = originals.lstatSync(alias, { bigint: true });
        for (const key of ["dev", "ino", "uid", "gid", "mode"] as const) {
          assert.equal(current[key], replacement[key]);
        }
        assert.equal(fs.readFileSync(path.join(alias, "foreign-evidence"), "utf8"), "preserve\n");
      } else {
        assert.deepEqual(fs.readdirSync(alias), scenario === "partial_layout_denial"
          ? ["candidate-bundle"] : []);
        if (scenario === "partial_layout_denial") {
          const bundle = originals.lstatSync(path.join(alias, "candidate-bundle"));
          assert.ok(bundle.isDirectory());
          assert.equal(bundle.mode & 0o7777, 0o700);
          assert.equal(bundle.uid, process.getuid!());
          assert.equal(bundle.gid, process.getgid!());
          assert.deepEqual(fs.readdirSync(path.join(alias, "candidate-bundle")), []);
        }
      }
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
      // No cleanup by pathname: failed owned roots and replacements are retained.
    }
  });
}
