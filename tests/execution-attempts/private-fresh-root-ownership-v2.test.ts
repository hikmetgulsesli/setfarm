import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { it as nodeIt, type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

// This leaf characterizes Darwin's inherited temporary-root group and its
// Darwin-only fixture consumers. It must not emulate macOS on another host.
const it = (name: string, run: (t: TestContext) => void | Promise<void>) =>
  nodeIt(name, { skip: process.platform !== "darwin" }, run);

// Execute complete actual modules. Only the finite test context exposes private
// constructors; their imports and filesystem effects remain real.
function actualPrivateFunction(source: string, name: string, afterFresh?: (fresh: { absolutePath: string }) => void, setup = ""): (...args: any[]) => any {
  const filename = fileURLToPath(new URL(`../../src/${source}.ts`, import.meta.url));
  const compiled = ts.transpileModule(
    `${fs.readFileSync(filename, "utf8")}\n${setup}\nexports.constructorForThisTest = ${name};`,
    { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    }, transformers: { before: [(context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
          return ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment("dirname", ts.factory.createStringLiteral(path.dirname(filename))),
            ts.factory.createPropertyAssignment("filename", ts.factory.createStringLiteral(filename)),
            ts.factory.createPropertyAssignment("url", ts.factory.createStringLiteral(pathToFileURL(filename).href)),
          ]);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
    }] } },
  ).outputText;
  const finiteModule = { exports: {} as Record<string, unknown> };
  const realRequire = createRequire(filename);
  const requireForTest = (specifier: string): unknown => {
    const imported = realRequire(specifier);
    if (afterFresh && specifier.endsWith("node-candidate-runtime-attempt-root-ownership-v2.js")) {
      return { ...imported, createNodeCandidateRuntimeAttemptRootInternalV2: (prefix: string) => {
        const fresh = imported.createNodeCandidateRuntimeAttemptRootInternalV2(prefix);
        afterFresh(fresh);
        return fresh;
      } };
    }
    return imported;
  };
  new Script(`(function(require,exports,module,__filename,__dirname){${compiled}\n})`, {
    filename,
  }).runInThisContext()(
    requireForTest, finiteModule.exports, finiteModule, filename, path.dirname(filename),
  );
  return finiteModule.exports.constructorForThisTest as (...args: any[]) => any;
}

const fixtures = [
  ["content-store", "platform-release-content-store", "privateRootV2", "CONTENT_STORE_FIXTURE_BUILD_FAILED"],
  ["local trust", "platform-release-bootstrap-darwin-local-package-trust-audit", "exactPrivateRootV2", "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BUILD_FAILED"],
  ["metadata", "platform-release-bootstrap-darwin-metadata-probe", "exactPrivateRootV2", "METADATA_PROBE_FIXTURE_BUILD_FAILED"],
  ["module export", "platform-release-bootstrap-module-export-probe", "exactPrivateRootV2", "MODULE_EXPORT_PROBE_FIXTURE_BUILD_FAILED"],
  ["required modules", "platform-release-bootstrap-required-module-closure-probe", "exactPrivateRootV2", "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED"],
  ["host self", "platform-release-bootstrap-darwin-host-self-observation", "exactPrivateRootV2", "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED"],
  ["suspended exec", "platform-release-bootstrap-darwin-suspended-exec-binding", "exactPrivateRootV2", "DARWIN_SUSPENDED_EXEC_BUILD_FAILED"],
].map(([label, source, name, code]) => ({
  label, code, source: `product-compiler/${source}-test-support-v2`, name: name!,
  create: actualPrivateFunction(`product-compiler/${source}-test-support-v2`, name!),
}));
const materialize = actualPrivateFunction("execution/platform-release-source-admission-v2", "materializeSourceStage");
const probe = actualPrivateFunction("product-compiler/host-node-toolchain-authority-v2", "probeToolchain");
const allocateOutput = actualPrivateFunction("execution/platform-release-source-admission-v2", "allocateSourceOwnedOutputRootV2");
const buildScope = actualPrivateFunction("execution/platform-release-source-admission-v2", "createPrivateBuildToolchainInstallScope");
const dependencyScope = actualPrivateFunction("execution/platform-release-source-admission-v2", "createPrivateProductionDependencyInstallScopeV2");
const installedMetadataBuilder = "buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2";
const installedMetadataSource = "product-compiler/platform-release-bootstrap-installed-metadata-operation-test-support-v2";
const installedMetadataFixture = {
  label: "installed metadata", source: installedMetadataSource, name: installedMetadataBuilder,
  code: "INSTALLED_METADATA_OPERATION_FIXTURE_BUILD_FAILED",
};
it("prepares the actual installed metadata target with current process ownership", (t) => {
  // This builder becomes reachable after the authentic Node/npm pair is repaired.
  const create = actualPrivateFunction(installedMetadataSource, installedMetadataBuilder);
  const originalCreate = fs.mkdtempSync;
  let alias = "";
  t.mock.method(fs, "mkdtempSync", (prefix: string) => { alias = originalCreate(prefix); return alias; });
  syncBuiltinESMExports();
  try {
    create();
    const stat = fs.lstatSync(alias, { bigint: true });
    assert.equal(stat.uid, BigInt(process.getuid!()));
    assert.equal(stat.gid, BigInt(process.getgid!()));
    assert.equal(stat.mode & 0o7777n, 0o700n);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
const builders = [
  [fixtures[1]!, "buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2"],
  [fixtures[2]!, "buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2"],
  [fixtures[3]!, "buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2"],
  [fixtures[4]!, "buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2"],
  [installedMetadataFixture, installedMetadataBuilder],
] as const;

for (const [fixture, name] of builders.filter(([fixture]) => fixture.label !== "required modules")) {
  it(`preserves ${fixture.label} primary then authenticated cleanup failure`, (t) => {
    let root = "";
    const create = actualPrivateFunction(fixture.source, name, (fresh) => { root = fresh.absolutePath; });
    const primary = new Error("real fixture child write denied");
    const cleanup = new Error("real authenticated cleanup denied");
    t.mock.method(fs, "writeFileSync", () => { throw primary; });
    t.mock.method(fs, "rmSync", () => { throw cleanup; });
    syncBuiltinESMExports();
    try {
      assert.throws(() => create(), (error: any) => error.code === fixture.code
        && error.cause instanceof AggregateError && error.cause.cause === primary
        && error.cause.errors.length === 2 && error.cause.errors[0] === primary
        && error.cause.errors[1] === cleanup);
      assert.ok(fs.lstatSync(root).isDirectory());
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const [fixture, name, args] of [
  [fixtures[5]!, "buildFixtureV2", [undefined]],
  [fixtures[6]!, "buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2", [undefined]],
] as const) {
  it(`refuses ${fixture.label} original-root replacement before decoding native builder output`, async () => {
    let root = "";
    let created: fs.BigIntStats;
    let replacement: fs.BigIntStats;
    let decoded = 0;
    const create = actualPrivateFunction(fixture.source,
      `(dispatch, observe) => { runContainedProcessV2 = dispatch; return ${name}(undefined, observe); }`);
    const dispatch = async () => {
      fs.renameSync(root, `${root}-retained`);
      fs.mkdirSync(root, { mode: 0o700 });
      const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
      finally { fs.closeSync(fd); }
      replacement = fs.lstatSync(root, { bigint: true });
      const stdout = Buffer.from("{}\n");
      Object.defineProperty(stdout, "toString", { value: () => {
        decoded++;
        throw new Error("detached root output must not be decoded");
      } });
      // Complete real boundary result; no child process or native build occurs.
      return { stdout, stderr: Buffer.alloc(0) };
    };
    await assert.rejects(create(dispatch, (candidate: { root: string }) => {
      root = candidate.root;
      created = fs.lstatSync(root, { bigint: true });
    }), (error: any) => error.code === fixture.code && error.cause === undefined);
    assert.equal(decoded, 0);
    assert.equal(fs.lstatSync(`${root}-retained`, { bigint: true }).ino, created!.ino);
    assert.equal(fs.lstatSync(root, { bigint: true }).ino, replacement!.ino);
  });
  it(`refuses ${fixture.label} original-root replacement before native builder dispatch`, async () => {
    let root = "";
    let created: fs.BigIntStats;
    let replacement: fs.BigIntStats;
    const create = actualPrivateFunction(fixture.source, name, undefined,
      `runContainedProcessV2 = async () => { throw new Error("forbidden native dispatch"); };`);
    await assert.rejects(create(...args, (candidate: { root: string }) => {
      root = candidate.root;
      created = fs.lstatSync(root, { bigint: true });
      fs.renameSync(root, `${root}-retained`);
      fs.mkdirSync(root, { mode: 0o700 });
      const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
      finally { fs.closeSync(fd); }
      replacement = fs.lstatSync(root, { bigint: true });
    }), (error: any) => error.code === fixture.code && error.cause === undefined);
    assert.equal(fs.lstatSync(`${root}-retained`, { bigint: true }).ino, created!.ino);
    assert.equal(fs.lstatSync(root, { bigint: true }).ino, replacement!.ino);
    assert.deepEqual(fs.readdirSync(root), []);
  });
}

for (const fixture of [
  ...fixtures,
  { label: "source anchor", source: "execution/platform-release-source-admission-v2", name: "materializeSourceStage" },
  { label: "probe capture", source: "product-compiler/host-node-toolchain-authority-v2", name: "probeToolchain" },
]) {
  it(`refuses replacement before the actual ${fixture.label} first consumer capture`, async (t) => {
    // Deleting original-pin comparisons would adopt this genuine empty owned root.
    let root = "";
    let created: fs.BigIntStats;
    let replacement: fs.BigIntStats;
    let effects = 0;
    const create = actualPrivateFunction(fixture.source, fixture.name, (fresh) => {
      root = fresh.absolutePath;
      created = fs.lstatSync(root, { bigint: true });
      fs.renameSync(root, `${root}-retained`);
      fs.mkdirSync(root, { mode: 0o700 });
      const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
      finally { fs.closeSync(fd); }
      replacement = fs.lstatSync(root, { bigint: true });
      for (const name of ["mkdirSync", "chmodSync", "rmSync"] as const) {
        const operation = fs[name] as (...args: any[]) => any;
        t.mock.method(fs, name, (...args: any[]) => { effects++; return operation(...args); });
      }
      syncBuiltinESMExports();
    });
    try {
      if (fixture.label === "probe capture") await assert.rejects(create({}));
      else assert.throws(() => create([], new Map()));
      assert.ok(root);
      assert.equal(effects, 0);
      assert.equal(fs.lstatSync(`${root}-retained`, { bigint: true }).ino, created!.ino);
      assert.equal(fs.lstatSync(root, { bigint: true }).ino, replacement!.ino);
      assert.deepEqual(fs.readdirSync(root), []);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const label of ["source", "probe"] as const) {
  it(`preserves the ${label} typed preparation refusal and original cause`, async (t) => {
    const sentinel = new Error("fresh descriptor preparation denied");
    t.mock.method(fs, "fchownSync", () => { throw sentinel; });
    syncBuiltinESMExports();
    try {
      const code = label === "source" ? "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID" : "HOST_NODE_TOOLCHAIN_V2_PROBE_CLEANUP_FAILED";
      const check = (error: any): boolean => error.code === code && error.cause === sentinel;
      if (label === "source") assert.throws(() => materialize([], new Map()), check);
      else await assert.rejects(probe({}), check);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const fixture of fixtures) {
  it(`keeps ${fixture.label} disappearing post-preparation paths inside typed refusal`, () => {
    let retained = "";
    const create = actualPrivateFunction(fixture.source, fixture.name, (fresh) => {
      retained = `${fresh.absolutePath}-retained`;
      fs.renameSync(fresh.absolutePath, retained);
    });
    assert.throws(() => create(), (error: any) => error.code === fixture.code && error.cause?.code === "ENOENT");
    assert.ok(fs.lstatSync(retained).isDirectory());
  });
  it(`prepares the actual ${fixture.label} fresh root with the current process group`, (t) => {
    // Removing fresh FD group preparation must reject this ordinary constructor.
    const originalCreate = fs.mkdtempSync;
    let created: fs.BigIntStats | undefined;
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      const alias = originalCreate(prefix);
      created = fs.lstatSync(alias, { bigint: true });
      t.diagnostic(`fresh UID=${created.uid} inheritedGID=${created.gid}`);
      return alias;
    });
    syncBuiltinESMExports();
    try {
      const result = fixture.create();
      assert.ok(created);
      const current = fs.lstatSync(result.root, { bigint: true });
      assert.ok(current.isDirectory() && !current.isSymbolicLink());
      assert.equal(current.uid, BigInt(process.getuid!()));
      assert.equal(current.gid, BigInt(process.getgid!()));
      assert.equal(current.mode & 0o7777n, 0o700n);
      assert.equal(current.mode, created.mode);
      assert.equal(current.dev, created.dev);
      assert.equal(current.ino, created.ino);
      assert.equal(fs.realpathSync(result.root), result.root);
      assert.deepEqual(fs.readdirSync(result.root), []);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const [fixture, name] of builders.slice(0, 3)) {
  it(`reports ${fixture.label} authenticated cleanup failure without hiding its cause`, (t) => {
    let root = "";
    const create = actualPrivateFunction(fixture.source, name, (fresh) => { root = fresh.absolutePath; });
    const handle = create();
    const sentinel = new Error("authenticated fixture removal denied");
    t.mock.method(fs, "rmSync", () => { throw sentinel; });
    syncBuiltinESMExports();
    try {
      assert.throws(() => handle.dispose(), (error: unknown) => error === sentinel);
      assert.ok(fs.lstatSync(root).isDirectory());
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const [fixture, name] of builders) {
  for (const boundary of ["build failure", "dispose", "later state capture"] as const) {
    if (boundary === "later state capture" && fixture.label === "local trust") continue;
    it(`retains a same-owner replacement at ${fixture.label} ${boundary}`, (t) => {
      const original = { mkdir: fs.mkdirSync, lstat: fs.lstatSync, rm: fs.rmSync, write: fs.writeFileSync };
      let root = "";
      let created: fs.BigIntStats;
      let replacement: fs.BigIntStats | undefined;
      let rootStats = 0;
      let removalAttempts = 0;
      const rebind = (): void => {
        fs.renameSync(root, `${root}-retained`);
        original.mkdir(root, { mode: 0o700 });
        const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
        finally { fs.closeSync(fd); }
        if (boundary === "later state capture") {
          fs.cpSync(`${root}-retained`, root, { recursive: true });
          // Darwin also gives copied descendants inherited GID0; make this
          // controlled replacement genuinely same-owner, not a wrong-GID test.
          const pending = [root];
          while (pending.length) {
            const target = pending.pop()!;
            const stat = original.lstat(target);
            assert.ok(!stat.isSymbolicLink());
            const retained = original.lstat(path.join(`${root}-retained`, path.relative(root, target)));
            if ((stat.mode & 0o7777) !== (retained.mode & 0o7777)) fs.chmodSync(target, retained.mode & 0o7777);
            const copiedFd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
              | (stat.isDirectory() ? fs.constants.O_DIRECTORY : 0));
            try { fs.fchownSync(copiedFd, process.getuid!(), process.getgid!()); }
            finally { fs.closeSync(copiedFd); }
            if (stat.isDirectory()) pending.push(...fs.readdirSync(target).map((child) => path.join(target, child)));
          }
        }
        replacement = original.lstat(root, { bigint: true });
      };
      const create = actualPrivateFunction(fixture.source, name, (fresh) => {
        root = fresh.absolutePath;
        created = original.lstat(root, { bigint: true });
      });
      t.mock.method(fs, "mkdirSync", (target: string, options: fs.MakeDirectoryOptions) => {
        if (root && target.startsWith(`${root}${path.sep}`) && boundary === "build failure" && !replacement) {
          rebind();
          throw new Error("controlled child creation failure after real rebind");
        }
        return original.mkdir(target, options);
      });
      t.mock.method(fs, "writeFileSync", (...args: Parameters<typeof fs.writeFileSync>) => {
        if (fixture.label === "installed metadata" && boundary === "build failure" && !replacement) {
          rebind();
          throw new Error("controlled entry write failure after real rebind");
        }
        return original.write(...args);
      });
      t.mock.method(fs, "lstatSync", (target: fs.PathLike, options?: { bigint: true }) => {
        if (target === root && !replacement && boundary === "later state capture" && ++rootStats === 2) rebind();
        return original.lstat(target, options as { bigint: true });
      });
      t.mock.method(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
        if (replacement) removalAttempts++;
        return original.rm(...args);
      });
      syncBuiltinESMExports();
      try {
        if (boundary === "dispose") {
          const handle = create();
          rebind();
          handle.dispose();
        } else {
          assert.throws(() => create(), (error: any) => error.code === fixture.code);
        }
        assert.ok(replacement, "the real replacement boundary must be reached");
        assert.equal(removalAttempts, 0, "replacement cannot be removed by an old root's cleanup");
        assert.equal(original.lstat(`${root}-retained`, { bigint: true }).ino, created!.ino);
        assert.equal(original.lstat(root, { bigint: true }).ino, replacement.ino);
      } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
      }
    });
  }
}

for (const boundary of ["content inventory", "source empty census"] as const) {
  it(`refuses a same-owner empty replacement at the actual ${boundary} boundary`, (t) => {
    // A fresh later stat/census must never replace the original creation pin.
    const original = {
      lstat: fs.lstatSync, readdir: fs.readdirSync, mkdir: fs.mkdirSync,
      chmod: fs.chmodSync, rm: fs.rmSync,
    };
    let root = "";
    let originalStat: fs.BigIntStats;
    let replacement: fs.BigIntStats | undefined;
    let consumerStats = 0;
    let effects = 0;
    const rebind = (): void => {
      fs.renameSync(root, `${root}-retained`);
      original.mkdir(root, { mode: 0o700 });
      const fd = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      try { fs.fchownSync(fd, process.getuid!(), process.getgid!()); }
      finally { fs.closeSync(fd); }
      replacement = original.lstat(root, { bigint: true });
    };
    const create = actualPrivateFunction(
      boundary === "content inventory" ? fixtures[0]!.source : "execution/platform-release-source-admission-v2",
      boundary === "content inventory" ? "privateRootV2" : "materializeSourceStage",
      (fresh) => { root = fresh.absolutePath; originalStat = original.lstat(root, { bigint: true }); },
    );
    t.mock.method(fs, "lstatSync", (target: fs.PathLike, options?: { bigint: true }) => {
      if (root && target === root && !replacement && boundary === "content inventory"
        && ++consumerStats === 2) rebind();
      return original.lstat(target, options as { bigint: true });
    });
    t.mock.method(fs, "readdirSync", (target: fs.PathLike, options?: any) => {
      const result = original.readdir(target, options);
      if (root && target === root && !replacement && boundary === "source empty census") rebind();
      return result;
    });
    for (const name of ["mkdirSync", "chmodSync", "rmSync"] as const) {
      const operation = fs[name] as (...args: any[]) => any;
      t.mock.method(fs, name, (...args: any[]) => {
        if (replacement) effects++;
        return operation(...args);
      });
    }
    syncBuiltinESMExports();
    try {
      assert.throws(() => create([], new Map()));
      assert.ok(replacement, "real path replacement must reach the consumer boundary");
      assert.equal(effects, 0, "uncertain original/replacement must not be mutated or removed");
      assert.equal(original.lstat(`${root}-retained`, { bigint: true }).ino, originalStat!.ino);
      assert.equal(original.lstat(root, { bigint: true }).ino, replacement.ino);
      assert.deepEqual(original.readdir(root), []);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

for (const fixture of fixtures) {
  it(`retains ${fixture.label} fresh preparation failure with its existing typed cause`, (t) => {
    // A raw helper exception must not escape the domain's established refusal.
    const originalCreate = fs.mkdtempSync;
    const sentinel = new Error("descriptor ownership preparation failed");
    let alias = "";
    t.mock.method(fs, "mkdtempSync", (prefix: string) => {
      alias = originalCreate(prefix);
      return alias;
    });
    t.mock.method(fs, "fchownSync", () => { throw sentinel; });
    syncBuiltinESMExports();
    try {
      assert.throws(() => fixture.create(), (error: any) => error.code === fixture.code && error.cause === sentinel);
      assert.ok(fs.lstatSync(alias).isDirectory());
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}

it("prepares the actual source context before creating its read-only stage", () => {
  // A missing context group preparation must fail the authentic stage anchor.
  const result = materialize([], new Map());
  for (const [root, mode] of [[result.contextRoot, 0o700n], [result.stageRoot, 0o555n]] as const) {
    const current = fs.lstatSync(root, { bigint: true });
    assert.equal(current.uid, BigInt(process.getuid!()));
    assert.equal(current.gid, BigInt(process.getgid!()));
    assert.equal(current.mode & 0o7777n, mode);
    assert.equal(fs.realpathSync(root), root);
  }
});

it("prepares actual Node probe HOME/cache/tmp ownership before invoking the adapter", async () => {
  // Without root group preparation, the real npm isolation layout inherits GID0.
  const observed: fs.BigIntStats[] = [];
  const sentinel = new Error("finite probe boundary; no executable is run");
  await assert.rejects(probe({
    root: { nodePath: process.execPath, realRoot: path.dirname(process.execPath) },
    probeAdapter: async (invocation: { env: Record<string, string> }) => {
      for (const key of ["HOME", "NPM_CONFIG_CACHE", "TMPDIR"]) {
        observed.push(fs.lstatSync(invocation.env[key]!, { bigint: true }));
      }
      throw sentinel;
    },
  }), (error: any) => error.code === "HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED" && error.cause === sentinel);
  assert.equal(observed.length, 3);
  for (const current of observed) {
    assert.equal(current.uid, BigInt(process.getuid!()));
    assert.equal(current.gid, BigInt(process.getgid!()));
    assert.equal(current.mode & 0o7777n, 0o700n);
  }
});

for (const occurrence of ["first", "second"] as const) {
  it(`prepares actual ${occurrence} compiled output parent before anchoring its child`, () => {
    const state = {
      ...materialize([], new Map()),
      lifecycle: "double_build_running",
      ownedOutputRoots: { cleanupState: "open", first: { status: "empty" }, second: { status: "empty" } },
    };
    const result = allocateOutput(state, occurrence);
    for (const anchor of [result.privateParent, result.outputRoot]) {
      const stat = fs.lstatSync(anchor.absolutePath, { bigint: true });
      assert.equal(stat.gid, BigInt(process.getgid!()));
      assert.equal(stat.uid, BigInt(process.getuid!()));
      assert.equal(stat.mode & 0o7777n, 0o700n);
      assert.equal(anchor.identity.device, String(stat.dev));
      assert.equal(anchor.identity.inode, String(stat.ino));
    }
  });
}

for (const [label, create, occurrence] of [
  ["build toolchain", buildScope, undefined],
  ["first dependency", dependencyScope, "first"],
  ["second dependency", dependencyScope, "second"],
] as const) {
  it(`prepares actual ${label} environment/install ownership before source copying`, (t) => {
    // A wrong fresh-root GID rejects the anchor before any valid child layout.
    const originalMkdir = fs.mkdirSync;
    const observed: fs.BigIntStats[] = [];
    const sentinel = new Error("finite before-source-copy boundary");
    t.mock.method(fs, "mkdirSync", (target: string, options: fs.MakeDirectoryOptions) => {
      if (["cache", "project"].includes(path.basename(target))) {
        observed.push(fs.lstatSync(path.dirname(target), { bigint: true }));
        if (path.basename(target) === "project") throw sentinel;
      }
      return originalMkdir(target, options);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => create({}, occurrence));
      assert.equal(observed.length, 2, "both real roots must reach the ordinary source-copy boundary");
      for (const stat of observed) {
        assert.equal(stat.uid, BigInt(process.getuid!()));
        assert.equal(stat.gid, BigInt(process.getgid!()));
        assert.equal(stat.mode & 0o7777n, 0o700n);
      }
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });
}
