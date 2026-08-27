import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
  "build-generation-retention:inspect": "node scripts/build-generation-retention.mjs inspect",
  "build-generation-retention:prepare": "node scripts/build-generation-retention.mjs prepare",
  "build-generation-retention:resume": "node scripts/build-generation-retention.mjs resume",
});
const EXACT_TSCONFIG = Object.freeze({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["src/**/*.ts"],
});

function git(root, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function canonicalHash(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function fixtureFile(root, locator, bytes, mode = 0o644) {
  const target = join(root, locator);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "setfarm-oa17-build-"));
  fixtureFile(root, "scripts/write-build-info.mjs", readFileSync(join(sourceRoot, "scripts/write-build-info.mjs")));
  fixtureFile(root, "scripts/build-generation-retention.mjs", readFileSync(join(sourceRoot, "scripts/build-generation-retention.mjs")), 0o755);
  fixtureFile(root, "scripts/stitch-to-jsx.mjs", 'process.stdout.write("fixture converter\\n");\n');
  fixtureFile(root, "scripts/copy-step-assets.mjs", readFileSync(join(sourceRoot, "scripts/copy-step-assets.mjs")), 0o755);
  fixtureFile(root, "scripts/inject-version.js", "// fixture version injection\n");
  fixtureFile(root, ".gitignore", "dist/\n.setfarm/\n");
  fixtureFile(root, "package.json", `${JSON.stringify({ version: "9.8.7", scripts: EXACT_SCRIPTS }, null, 2)}\n`);
  fixtureFile(root, "tsconfig.json", `${JSON.stringify(EXACT_TSCONFIG, null, 2)}\n`);
  fixtureFile(root, "src/cli/cli.ts", 'console.log("fixture");\n');
  fixtureFile(root, "src/server/index.ts", "export const server = true;\n");
  fixtureFile(root, "src/server/index.html", "<!doctype html>fixture\n");
  fixtureFile(root, "src/installer/compat-rules.json", "{}\n");
  fixtureFile(root, "src/installer/prompts/prompt.md", "prompt\n");
  fixtureFile(root, "src/installer/steps/nested/step.md", "step\n");
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.name", "Setfarm Test"]);
  git(root, ["config", "user.email", "setfarm-test@example.invalid"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "fixture"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  return root;
}

function runProducer(root, phase) {
  return spawnSync(process.execPath, ["scripts/write-build-info.mjs", phase], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function commitProducerTransform(root, transform, message) {
  const producerPath = join(root, "scripts/write-build-info.mjs");
  const before = readFileSync(producerPath, "utf8");
  const after = transform(before);
  assert.notEqual(after, before, `${message} must transform the committed producer fixture`);
  writeFileSync(producerPath, after);
  git(root, ["add", "scripts/write-build-info.mjs"]);
  git(root, ["commit", "--amend", "-qm", message]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function commitRetentionTransform(root, transform, message) {
  const modulePath = join(root, "scripts/build-generation-retention.mjs");
  const before = readFileSync(modulePath, "utf8");
  const after = transform(before);
  assert.notEqual(after, before, `${message} must transform the committed retention fixture`);
  writeFileSync(modulePath, after);
  git(root, ["add", "scripts/build-generation-retention.mjs"]);
  git(root, ["commit", "--amend", "-qm", message]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function createFullBuildFixture() {
  const root = createFixture();
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.type = "module";
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  copyFileSync(join(sourceRoot, "scripts", "copy-step-assets.mjs"), join(root, "scripts", "copy-step-assets.mjs"));
  copyFileSync(join(sourceRoot, "scripts", "inject-version.js"), join(root, "scripts", "inject-version.js"));
  fixtureFile(root, "scripts/check-version-contract.mjs", "// fixture check\n");
  fixtureFile(root, "scripts/check-english-contract.mjs", "// fixture check\n");
  fixtureFile(root, "scripts/check-path-contract.mjs", "// fixture check\n");
  fixtureFile(root, "scripts/check-contract-spine-migration-digests.ts", "// fixture check\n");
  fixtureFile(root, "scripts/mission-control-contract-artifacts.ts", "// fixture check\n");
  fixtureFile(
    root,
    "src/internal-production/baseline-post-handoff-receipt-v1.ts",
    "export const fixtureBaselinePostHandoffReceiptV1 = true;\n",
  );
  fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(join(sourceRoot, "src/product-compiler/canonical-json.ts")));
  fixtureFile(root, "landing/index.html", '<span class="version-badge">v9.8.7</span>\n');
  fixtureFile(root, "README.md", "fixture\n");
  fixtureFile(root, "scripts/install.sh", "#!/bin/sh\n", 0o755);
  writeFileSync(join(root, ".gitignore"), "node_modules/\ndist/\n.setfarm/\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--amend", "-qm", "full fixture"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

  mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
  mkdirSync(join(root, "node_modules/@types"), { recursive: true });
  cpSync(join(sourceRoot, "node_modules/typescript"), join(root, "node_modules/typescript"), { recursive: true });
  cpSync(join(sourceRoot, "node_modules/@types/node"), join(root, "node_modules/@types/node"), { recursive: true });
  cpSync(join(sourceRoot, "node_modules/undici-types"), join(root, "node_modules/undici-types"), { recursive: true });
  symlinkSync("../typescript/bin/tsc", join(root, "node_modules/.bin/tsc"));
  fixtureFile(root, "node_modules/tsx/package.json", `${JSON.stringify({ name: "tsx", type: "module", exports: "./index.mjs" })}\n`);
  fixtureFile(root, "node_modules/tsx/index.mjs", "// Node 26 runs the fixture's syntax-compatible .ts checks directly.\n");
  return root;
}

function runLiteralNpmBuild(root, parentUmask) {
  return spawnSync("/bin/sh", ["-c", `umask ${parentUmask} && npm run build`], {
    cwd: root,
    env: { ...process.env },
    encoding: "utf8",
  });
}

function materializeOutputs(root) {
  const outputs = Object.freeze({
    "dist/cli/cli.js": 'console.log("fixture");\n',
    "dist/installer/compat-rules.json": "{}\n",
    "dist/installer/prompts/prompt.md": "prompt\n",
    "dist/installer/steps/nested/step.md": "step\n",
    "dist/server/index.html": "<!doctype html>fixture\n",
    "dist/server/index.js": "export const server = true;\n",
  });
  for (const [locator, bytes] of Object.entries(outputs)) fixtureFile(root, locator, bytes, 0o600);
  return outputs;
}

function finalizeFixture(root) {
  const prepared = runProducer(root, "--prepare");
  assert.equal(prepared.status, 0, prepared.stderr);
  const outputs = materializeOutputs(root);
  const finalized = runProducer(root, "--finalize");
  assert.equal(finalized.status, 0, finalized.stderr);
  return outputs;
}

function mode(root, locator) {
  return statSync(join(root, locator)).mode & 0o777;
}

describe("OA17 build source and output authority", () => {
  it("exposes only the code-owned prepare and finalize writer commands", () => {
    const root = createFixture();
    try {
      for (const phase of ["--prepare-preflight", "--prepare-locked-sanitize", "--prepare-locked-create"]) {
        const selected = runProducer(root, phase);
        assert.equal(selected.status, 1, `${phase} unexpectedly selected a private writer phase`);
        assert.match(selected.stderr, /exactly one public build-writer command is required/);
      }
      const producer = readFileSync(join(root, "scripts/write-build-info.mjs"), "utf8");
      assert.doesNotMatch(producer, /--prepare-(?:preflight|locked-sanitize|locked-create)/);
      assert.doesNotMatch(producer, /readFileSync\(0\)/);
      assert.doesNotMatch(producer, /Symbol\.for|globalThis|runBuildGenerationWriterPrepareV1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the exact package build topology under one inner umask", () => {
    const pkg = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
    for (const [name, value] of Object.entries(EXACT_SCRIPTS)) assert.equal(pkg.scripts[name], value);
    assert.equal(pkg.scripts.build.startsWith("umask 077 && "), true);
    assert.equal(pkg.scripts.build.match(/umask/g)?.length, 1);
    const producer = readFileSync(join(sourceRoot, "scripts/write-build-info.mjs"), "utf8");
    assert.doesNotMatch(producer, /\b(?:rmSync|rmdirSync|openat|renameat2|dlopen)\b/);
    assert.doesNotMatch(producer, /process\.env\b|SETFARM_[A-Z0-9_]*FAULT|faultInjection|testHook/);
    assert.doesNotMatch(producer, /\bexport\s+(?:function|const|class)\b/);
    assert.doesNotMatch(producer, /runBuildGenerationWriterPrepareV1|Symbol\.for|globalThis/);
    assert.doesNotMatch(producer, /withBuildGenerationWriterMaintenanceLockV1|runBuildGenerationWriterRotationV1/);
  });

  it("runs two literal full npm builds under hostile and restrictive parent umasks", () => {
    const root = createFullBuildFixture();
    try {
      const hostile = runLiteralNpmBuild(root, "000");
      assert.equal(hostile.status, 0, hostile.stderr || hostile.stdout);
      const restrictive = runLiteralNpmBuild(root, "077");
      assert.equal(restrictive.status, 0, restrictive.stderr || restrictive.stdout);
      const archiveNames = readdirSync(join(root, ".setfarm/build-generations-v1"));
      assert.equal(archiveNames.length, 1);
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/intents")).length, 1);
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")).length, 1);
      assert.equal(existsSync(join(root, ".setfarm/build-generation-maintenance-lock-v1.json")), false);
      assert.equal(mode(root, "dist"), 0o755);
      assert.equal(mode(root, "dist/cli/cli.js"), 0o755);
      assert.equal(mode(root, "dist/server/index.js"), 0o644);
      assert.equal(mode(root, "dist/PLATFORM_RELEASE_MANIFEST.json"), 0o444);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("restarts literal npm builds after each authority fixed-link crash", () => {
    const cases = [
      ["BUILD_INFO.json", "000"],
      ["PLATFORM_BUILD_OUTPUT_TREE.json", "077"],
      ["PLATFORM_RELEASE_MANIFEST.json", "000"],
    ];
    for (const [basename, parentUmask] of cases) {
      const root = createFullBuildFixture();
      try {
        commitProducerTransform(root, (source) => {
          const needle = "    linkSync(tempPath, fixedPath);";
          const offset = source.indexOf(needle, source.indexOf("function publishExactArtifact"));
          assert.notEqual(offset, -1, "publisher link boundary must exist");
          return `${source.slice(0, offset)}${[
            needle,
            `    if (basename === ${JSON.stringify(basename)}) process.exit(91);`,
          ].join("\n")}${source.slice(offset + needle.length)}`;
        }, `crash ${basename} after fixed link`);
        const crashed = runLiteralNpmBuild(root, parentUmask);
        assert.notEqual(crashed.status, 0, `${basename} fixture did not crash`);
        const publisherNames = readdirSync(join(root, "dist")).filter((name) => (
          name === basename || name.startsWith(`.${basename}.`)
        ));
        assert.equal(publisherNames.includes(basename), true);
        assert.equal(publisherNames.some((name) => name.startsWith(`.${basename}.`)), true);

        copyFileSync(join(sourceRoot, "scripts/write-build-info.mjs"), join(root, "scripts/write-build-info.mjs"));
        git(root, ["add", "scripts/write-build-info.mjs"]);
        git(root, ["commit", "-qm", `restart after ${basename} crash`]);
        git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        const restarted = runLiteralNpmBuild(root, parentUmask);
        assert.equal(restarted.status, 0, restarted.stderr || restarted.stdout);
        const archives = readdirSync(join(root, ".setfarm/build-generations-v1"));
        assert.equal(archives.length, 1);
        assert.equal(
          readdirSync(join(root, ".setfarm/build-generations-v1", archives[0])).some((name) => name.startsWith(`.${basename}.`)),
          false,
        );
        assert.equal(mode(root, "dist/BUILD_INFO.json"), 0o444);
        assert.equal(mode(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), 0o444);
        assert.equal(mode(root, "dist/PLATFORM_RELEASE_MANIFEST.json"), 0o444);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects local includes, noncanonical origin cardinality, and origin-main drift before authority", () => {
    const includeRoot = createFixture();
    const originRoot = createFixture();
    const driftRoot = createFixture();
    try {
      git(includeRoot, ["config", "include.path", "/tmp/forbidden-setfarm-config"]);
      const included = runProducer(includeRoot, "--prepare");
      assert.notEqual(included.status, 0);
      assert.match(included.stderr, /include/i);

      git(originRoot, ["remote", "set-url", "--add", "origin", "https://example.invalid/second.git"]);
      const multiple = runProducer(originRoot, "--prepare");
      assert.notEqual(multiple.status, 0);
      assert.match(multiple.stderr, /origin/i);

      fixtureFile(driftRoot, "next.txt", "next\n");
      git(driftRoot, ["add", "next.txt"]);
      git(driftRoot, ["commit", "-qm", "advance head only"]);
      const drifted = runProducer(driftRoot, "--prepare");
      assert.notEqual(drifted.status, 0);
      assert.match(drifted.stderr, /origin/i);
    } finally {
      rmSync(includeRoot, { recursive: true, force: true });
      rmSync(originRoot, { recursive: true, force: true });
      rmSync(driftRoot, { recursive: true, force: true });
    }
  });

  it("rejects a committed copy-step traversal whose source semantics drift from the pinned projection", () => {
    const root = createFixture();
    try {
      writeFileSync(join(root, "scripts/copy-step-assets.mjs"), "// silently skips recursive Markdown assets\n");
      git(root, ["add", "scripts/copy-step-assets.mjs"]);
      git(root, ["commit", "-qm", "break copy-step semantics"]);
      git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /copy-step|topology|semantic/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects recursively non-strict prepare receipt identities and raw bytes", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      materializeOutputs(root);
      const receiptPath = join(root, "dist/PLATFORM_BUILD_PREPARE.json");
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      receipt.repositoryDirectoryIdentity.extra = true;
      chmodSync(receiptPath, 0o644);
      writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
      chmodSync(receiptPath, 0o444);
      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /receipt|identity|field/i);
      assert.equal(existsSync(join(root, "dist/PLATFORM_RELEASE_MANIFEST.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes strict prepare, output-tree, build-info, and terminal manifest authority", () => {
    const root = createFixture();
    try {
      const outputs = finalizeFixture(root);
      const sha = git(root, ["rev-parse", "HEAD"]);
      const treeHash = git(root, ["rev-parse", "HEAD^{tree}"]);
      const infoBytes = readFileSync(join(root, "dist/BUILD_INFO.json"), "utf8");
      const info = JSON.parse(infoBytes);
      assert.deepEqual(Object.keys(info), [
        "sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt",
      ]);
      assert.equal(infoBytes, `${JSON.stringify(info, null, 2)}\n`);
      assert.match(info.builtAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.equal(mode(root, "dist/BUILD_INFO.json"), 0o444);
      assert.equal(statSync(join(root, "dist/BUILD_INFO.json")).nlink, 1);
      assert.equal(existsSync(join(root, "dist/PLATFORM_BUILD_PREPARE.json")), false);

      const outputTreeBytes = readFileSync(join(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), "utf8");
      const outputTree = JSON.parse(outputTreeBytes);
      assert.equal(outputTreeBytes, `${JSON.stringify(outputTree)}\n`);
      assert.equal(outputTree.schema, "setfarm.platform-build-output-tree.v1");
      assert.equal(outputTree.sourceSha, sha);
      assert.equal(outputTree.sourceTreeHash, treeHash);
      assert.deepEqual(outputTree.entries.map((entry) => entry.locator), Object.keys(outputs).sort());
      assert.deepEqual(outputTree.entries.map((entry) => entry.mode), [0o755, 0o644, 0o644, 0o644, 0o644, 0o644]);
      assert.equal(outputTree.outputTreeHash, canonicalHash({
        schema: outputTree.schema,
        sourceSha: sha,
        sourceTreeHash: treeHash,
        entries: outputTree.entries,
      }));
      assert.equal(mode(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), 0o444);

      const manifest = JSON.parse(readFileSync(join(root, "dist/PLATFORM_RELEASE_MANIFEST.json"), "utf8"));
      const converter = readFileSync(join(root, "scripts/stitch-to-jsx.mjs"));
      assert.deepEqual(manifest, {
        schema: "setfarm.platform-release-manifest.v1",
        releaseSha: sha,
        branch: "main",
        dirty: false,
        stitchConverter: {
          converterId: "setfarm.stitch-to-jsx",
          source: {
            schema: "setfarm.source-artifact-ref.v1",
            hash: createHash("sha256").update(converter).digest("hex"),
            mediaType: "text/javascript",
            locator: "scripts/stitch-to-jsx.mjs",
            byteLength: converter.byteLength,
          },
        },
      });
      assert.equal(mode(root, "dist/PLATFORM_RELEASE_MANIFEST.json"), 0o444);
      assert.deepEqual(readdirSync(join(root, "dist")).filter((name) => name.endsWith(".tmp")), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects hidden live drift against every pinned Git blob", () => {
    const root = createFixture();
    try {
      git(root, ["update-index", "--assume-unchanged", "package.json"]);
      writeFileSync(join(root, "package.json"), `${readFileSync(join(root, "package.json"), "utf8")} `);
      assert.equal(git(root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /pinned Git blob|live tracked/i);
      assert.equal(existsSync(join(root, "dist/BUILD_INFO.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects hidden TypeScript, copied-asset, converter, and executable-mode drift", () => {
    const cases = [
      ["src/server/index.ts", "--skip-worktree", "bytes"],
      ["src/server/index.html", "--assume-unchanged", "bytes"],
      ["scripts/stitch-to-jsx.mjs", "--skip-worktree", "bytes"],
      ["scripts/copy-step-assets.mjs", "--assume-unchanged", "mode"],
    ];
    for (const [locator, indexFlag, mutation] of cases) {
      const root = createFixture();
      try {
        git(root, ["update-index", indexFlag, locator]);
        if (mutation === "mode") chmodSync(join(root, locator), 0o644);
        else writeFileSync(join(root, locator), Buffer.concat([readFileSync(join(root, locator)), Buffer.from("hidden\n")]));
        assert.equal(git(root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
        const prepared = runProducer(root, "--prepare");
        assert.notEqual(prepared.status, 0, `${locator} hidden drift was accepted`);
        assert.match(prepared.stderr, /pinned Git (?:blob|mode)|live tracked/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rotates the whole prior dist append-only and precreates the exact directory closure", () => {
    const root = createFixture();
    try {
      mkdirSync(join(root, "dist/old/empty"), { recursive: true, mode: 0o700 });
      chmodSync(join(root, "dist"), 0o755);
      chmodSync(join(root, "dist/old"), 0o750);
      chmodSync(join(root, "dist/old/empty"), 0o700);
      writeFileSync(join(root, "dist/stale.bin"), "stale\n", { mode: 0o600 });
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      const archiveRoot = join(root, ".setfarm/build-generations-v1");
      const archives = readdirSync(archiveRoot);
      assert.equal(archives.length, 1);
      assert.match(archives[0], /^[0-9a-f-]{36}\.dist$/);
      assert.equal(readFileSync(join(archiveRoot, archives[0], "stale.bin"), "utf8"), "stale\n");
      assert.equal(mode(root, `.setfarm/build-generations-v1/${archives[0]}/old`), 0o755);
      for (const locator of ["dist/cli", "dist/installer", "dist/installer/prompts", "dist/installer/steps", "dist/installer/steps/nested", "dist/server"]) {
        assert.equal(mode(root, locator), 0o755, locator);
      }
      assert.equal(existsSync(join(root, "dist/stale.bin")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reopens an indexed retained archive before the next prepare", () => {
    const root = createFixture();
    try {
      mkdirSync(join(root, "dist"), { mode: 0o755 });
      writeFileSync(join(root, "dist/stale.bin"), "stale\n", { mode: 0o600 });
      const first = runProducer(root, "--prepare");
      assert.equal(first.status, 0, first.stderr);

      const archiveRoot = join(root, ".setfarm/build-generations-v1");
      const firstArchive = readdirSync(archiveRoot);
      const completionRoot = join(root, ".setfarm/build-generation-rotation-ledger-v1/completions");
      const firstCompletionName = readdirSync(completionRoot);
      assert.equal(firstArchive.length, 1);
      assert.equal(firstCompletionName.length, 1);
      const firstCompletion = JSON.parse(readFileSync(join(completionRoot, firstCompletionName[0]), "utf8"));
      assert.equal(firstArchive[0], `${firstCompletion.buildId}.dist`);

      const second = runProducer(root, "--prepare");
      assert.equal(second.status, 0, second.stderr);
      assert.equal(readdirSync(archiveRoot).length, 2);
      assert.equal(readdirSync(completionRoot).length, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("adopts an exact response-lost whole-dist rename", () => {
    const root = createFixture();
    try {
      commitProducerTransform(root, (source) => {
        const needle = "    renameSync(dist, destination);";
        assert.equal(source.includes(needle), true, "rotation rename boundary must exist");
        return source.replace(needle, `${needle}\n    if (!optionalWriterLstat(path.join(roots.root, ".setfarm/.fixture-rename-response-loss"))) {\n      writeFileSync(path.join(roots.root, ".setfarm/.fixture-rename-response-loss"), "crashed\\n");\n      process.exit(91);\n    }`);
      }, "inject whole-dist rename response loss");
      mkdirSync(join(root, "dist"), { mode: 0o755 });
      writeFileSync(join(root, "dist/old.bin"), "old\n", { mode: 0o600 });
      const crashed = runProducer(root, "--prepare");
      assert.equal(crashed.status, 91, crashed.stderr);
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      assert.equal(readFileSync(join(root, "dist/BUILD_INFO.json"), "utf8").length > 0, true);
      const archives = readdirSync(join(root, ".setfarm/build-generations-v1"));
      assert.equal(archives.length, 1);
      assert.equal(readFileSync(join(root, ".setfarm/build-generations-v1", archives[0], "old.bin"), "utf8"), "old\n");
      assert.equal(readdirSync(join(root, ".setfarm/build-generation-rotation-ledger-v1/completions")).length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a forged disposed generation through the strict retention closure", () => {
    const root = createFullBuildFixture();
    try {
      assert.equal(runLiteralNpmBuild(root, "077").status, 0);
      assert.equal(runLiteralNpmBuild(root, "077").status, 0);
      const ledger = join(root, ".setfarm/build-generation-rotation-ledger-v1");
      const completionName = readdirSync(join(ledger, "completions"))[0];
      const completion = JSON.parse(readFileSync(join(ledger, "completions", completionName), "utf8"));
      rmSync(join(root, completion.archiveLocator), { recursive: true });
      const fakeOperationHash = "a".repeat(64);
      const fakeReceiptHash = "b".repeat(64);
      const projection = {
        schema: "setfarm.platform-build-generation-rotation-disposition.v1",
        ordinal: completion.ordinal,
        buildId: completion.buildId,
        completion: { completionRef: completion.completionRef, completionHash: completion.completionHash },
        retentionOperation: { operationRef: `setfarm://internal-production/build-generation-retention-operation/sha256/${fakeOperationHash}`, operationHash: fakeOperationHash },
        retentionReceipt: { receiptRef: `setfarm://internal-production/build-generation-retention-receipt/sha256/${fakeReceiptHash}`, receiptHash: fakeReceiptHash },
        sourceAbsent: true,
        quarantineLocator: `.setfarm/build-generation-quarantine-v1/${completion.buildId}.dist`,
        disposedRootPhysicalIdentity: completion.inventory.rootPhysicalIdentity,
        physicalInventoryHash: completion.inventory.physicalInventoryHash,
        contentInventoryHash: completion.inventory.contentInventoryHash,
        permanentDisposition: true,
        quarantineAbsent: true,
      };
      const dispositionHash = canonicalHash(projection);
      const disposition = {
        ...projection,
        dispositionRef: `setfarm://internal-production/build-generation-rotation-disposition/${String(completion.ordinal).padStart(20, "0")}/${completion.buildId}/sha256/${dispositionHash}`,
        dispositionHash,
      };
      fixtureFile(root, `.setfarm/build-generation-rotation-ledger-v1/dispositions/${completionName}`, `${canonical(disposition)}\n`, 0o600);
      const before = readFileSync(join(root, "dist/BUILD_INFO.json"));
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0, "writer accepted a disposition without its operation/erase/receipt closure");
      assert.match(prepared.stderr, /retention|receipt|operation|closure|authority/i);
      assert.deepEqual(readFileSync(join(root, "dist/BUILD_INFO.json")), before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("acquires the writer-attempt lock before creating or recovering rotation authority", () => {
    const root = createFixture();
    try {
      commitProducerTransform(root, (source) => {
        const boundary = "function acquireWriterMaintenanceLock(setfarm, candidateKeyHash) {";
        assert.equal(source.includes(boundary), true);
        return source.replace(boundary, `${boundary}\n  process.exit(91);`);
      }, "crash at writer-attempt lock acquisition");
      const ledger = join(root, ".setfarm/build-generation-rotation-ledger-v1");
      const crashed = runProducer(root, "--prepare");
      assert.equal(crashed.status, 91, crashed.stderr);
      assert.equal(existsSync(ledger), false, "rotation authority was created before the writer-attempt lock");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not consume an orphan rotation publisher temporary before the writer-attempt lock", () => {
    const root = createFixture();
    try {
      const ledger = join(root, ".setfarm/build-generation-rotation-ledger-v1");
      for (const directory of [
        ".setfarm",
        ".setfarm/build-generations-v1",
        ".setfarm/build-generation-rotation-ledger-v1",
        ".setfarm/build-generation-rotation-ledger-v1/intents",
        ".setfarm/build-generation-rotation-ledger-v1/completions",
        ".setfarm/build-generation-rotation-ledger-v1/dispositions",
      ]) mkdirSync(join(root, directory), { recursive: true, mode: 0o700 });
      const temp = join(ledger, "intents/.00000000000000000001-10000000-0000-4000-8000-000000000001.json.90000000-0000-4000-8000-000000000009.tmp");
      writeFileSync(temp, "partial\n", { mode: 0o600 });
      commitProducerTransform(root, (source) => source.replace(
        "function acquireWriterMaintenanceLock(setfarm, candidateKeyHash) {",
        "function acquireWriterMaintenanceLock(setfarm, candidateKeyHash) {\n  process.exit(91);",
      ), "crash before rotation publisher recovery");
      const crashed = runProducer(root, "--prepare");
      assert.equal(crashed.status, 91, crashed.stderr);
      assert.equal(existsSync(temp), true, "orphan rotation publisher state was consumed before lock acquisition");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("cleans rather than promotes semantic-invalid sole temps in all retention stores", () => {
    const workspace = mkdtempSync(join(tmpdir(), "setfarm-oa18-writer-retention-"));
    const original = createFixture();
    const root = join(workspace, "setfarm");
    renameSync(original, root);
    try {
      const retentionRoot = join(workspace, "data/internal-production-baseline/build-generation-retention-v1");
      const basename = `${"a".repeat(64)}.json`;
      const tempName = `.${basename}.90000000-0000-4000-8000-000000000009.tmp`;
      for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
        const directory = join(retentionRoot, store, "sha256");
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        chmodSync(retentionRoot, 0o700);
        chmodSync(join(retentionRoot, store), 0o700);
        chmodSync(directory, 0o700);
        writeFileSync(join(directory, tempName), "{}\n", { mode: 0o600 });
      }
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
        assert.deepEqual(readdirSync(join(retentionRoot, store, "sha256")), [], store);
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("blocks semantic-invalid fixed authority in every retention store", () => {
    for (const rejectedStore of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
      const workspace = mkdtempSync(join(tmpdir(), "setfarm-oa18-writer-retention-fixed-"));
      const original = createFixture();
      const root = join(workspace, "setfarm");
      renameSync(original, root);
      try {
        const retentionRoot = join(workspace, "data/internal-production-baseline/build-generation-retention-v1");
        const basename = `${"a".repeat(64)}.json`;
        for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
          const directory = join(retentionRoot, store, "sha256");
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          chmodSync(retentionRoot, 0o700);
          chmodSync(join(retentionRoot, store), 0o700);
          chmodSync(directory, 0o700);
          if (store === rejectedStore) writeFileSync(join(directory, basename), "{}\n", { mode: 0o600 });
        }
        const prepared = runProducer(root, "--prepare");
        assert.notEqual(prepared.status, 0, rejectedStore);
        assert.match(prepared.stderr, /semantically invalid/, rejectedStore);
        assert.equal(readFileSync(join(retentionRoot, rejectedStore, "sha256", basename), "utf8"), "{}\n");
        assert.equal(existsSync(join(root, "dist")), false, rejectedStore);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  });

  it("blocks wrong-mode and multiply-linked semantic-invalid retention temps without cleanup", () => {
    for (const physicalCase of ["mode-0644", "nlink-2", "nlink-3"]) {
      const workspace = mkdtempSync(join(tmpdir(), "setfarm-oa18-writer-retention-physical-"));
      const original = createFixture();
      const root = join(workspace, "setfarm");
      renameSync(original, root);
      try {
        const retentionRoot = join(workspace, "data/internal-production-baseline/build-generation-retention-v1");
        const basename = `${"a".repeat(64)}.json`;
        const tempName = `.${basename}.90000000-0000-4000-8000-000000000009.tmp`;
        let temp;
        for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
          const directory = join(retentionRoot, store, "sha256");
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          chmodSync(retentionRoot, 0o700);
          chmodSync(join(retentionRoot, store), 0o700);
          chmodSync(directory, 0o700);
          if (store === "operations") {
            temp = join(directory, tempName);
            writeFileSync(temp, "{}\n", { mode: physicalCase === "mode-0644" ? 0o644 : 0o600 });
            chmodSync(temp, physicalCase === "mode-0644" ? 0o644 : 0o600);
          }
        }
        if (physicalCase !== "mode-0644") {
          linkSync(temp, join(workspace, ".external-retention-link-1"));
          if (physicalCase === "nlink-3") linkSync(temp, join(workspace, ".external-retention-link-2"));
        }
        const prepared = runProducer(root, "--prepare");
        assert.notEqual(prepared.status, 0, physicalCase);
        assert.match(prepared.stderr, /mode|link|physical|publisher/i, physicalCase);
        assert.equal(readFileSync(temp, "utf8"), "{}\n", physicalCase);
        assert.equal(existsSync(join(dirname(temp), basename)), false, physicalCase);
        assert.equal(existsSync(join(root, "dist")), false, physicalCase);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  });

  it("blocks a retention temp chmod between preliminary lstat and stable read", () => {
    const workspace = mkdtempSync(join(tmpdir(), "setfarm-oa18-writer-retention-mode-race-"));
    const original = createFixture();
    const root = join(workspace, "setfarm");
    renameSync(original, root);
    try {
      commitProducerTransform(root, (source) => {
        const boundary = "        const observed = readStableRegular(filePath, MAX_AUTHORITY_BYTES_V1, { device: storeDevice, nlink: linkCount });";
        assert.equal(source.includes(boundary), true);
        return source.replace(boundary, `        chmodSync(filePath, 0o644);\n${boundary}`);
      }, "inject retention member mode race");
      const retentionRoot = join(workspace, "data/internal-production-baseline/build-generation-retention-v1");
      const basename = `${"a".repeat(64)}.json`;
      const tempName = `.${basename}.90000000-0000-4000-8000-000000000009.tmp`;
      let temp;
      for (const store of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
        const directory = join(retentionRoot, store, "sha256");
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        chmodSync(retentionRoot, 0o700);
        chmodSync(join(retentionRoot, store), 0o700);
        chmodSync(directory, 0o700);
        if (store === "operations") {
          temp = join(directory, tempName);
          writeFileSync(temp, "{}\n", { mode: 0o600 });
          chmodSync(temp, 0o600);
        }
      }
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0, "last-instant retention chmod was accepted");
      assert.match(prepared.stderr, /mode|physical|publisher/i);
      assert.equal(readFileSync(temp, "utf8"), "{}\n");
      assert.equal(statSync(temp).mode & 0o777, 0o644);
      assert.equal(existsSync(join(dirname(temp), basename)), false);
      assert.equal(existsSync(join(root, "dist")), false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("fails before mutation when eight archives require operator retention", () => {
    const root = createFixture();
    try {
      mkdirSync(join(root, ".setfarm/build-generations-v1"), { recursive: true, mode: 0o700 });
      chmodSync(join(root, ".setfarm"), 0o700);
      chmodSync(join(root, ".setfarm/build-generations-v1"), 0o700);
      for (let index = 0; index < 8; index += 1) {
        const archive = join(root, `.setfarm/build-generations-v1/00000000-0000-4000-8000-${String(index).padStart(12, "0")}.dist`);
        mkdirSync(archive, { mode: 0o755 });
        chmodSync(archive, 0o755);
      }
      mkdirSync(join(root, "dist"));
      writeFileSync(join(root, "dist/keep.txt"), "keep\n");
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /BUILD_GENERATION_RETENTION_REQUIRED/);
      assert.equal(readFileSync(join(root, "dist/keep.txt"), "utf8"), "keep\n");
      assert.equal(readdirSync(join(root, ".setfarm/build-generations-v1")).length, 8);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an extra output after prepare instead of hashing it", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      materializeOutputs(root);
      writeFileSync(join(root, "dist/extra.js"), "extra\n", { mode: 0o600 });
      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /unexpected output|exact output/i);
      assert.equal(existsSync(join(root, "dist/PLATFORM_RELEASE_MANIFEST.json")), false);
      assert.equal(mode(root, "dist/cli/cli.js"), 0o600, "topology rejection must precede output-mode normalization");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects concurrent mutation of an ordinary pre-rotation storage file", async () => {
    const root = createFixture();
    let mutator;
    try {
      mkdirSync(join(root, "dist"), { mode: 0o755 });
      const target = join(root, "dist/unstable.bin");
      writeFileSync(target, "a".repeat(1024 * 1024), { mode: 0o600 });
      mutator = spawn(process.execPath, ["-e", [
        "const fs=require('node:fs');",
        "const target=process.argv[1];",
        "process.stdout.write('ready\\n');",
        "const end=Date.now()+3000; let bit=false;",
        "while(Date.now()<end){fs.writeFileSync(target,(bit?'a':'b').repeat(1024*1024));bit=!bit;}",
      ].join(""), target], { stdio: ["ignore", "pipe", "pipe"] });
      await once(mutator.stdout, "data");
      const prepared = runProducer(root, "--prepare");
      assert.notEqual(prepared.status, 0);
      assert.match(prepared.stderr, /changed|unstable|storage/i);
    } finally {
      mutator?.kill("SIGKILL");
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects C1 control locators and derived output depth overflow before dist mutation", () => {
    const c1Root = createFixture();
    const depthRoot = createFixture();
    try {
      fixtureFile(c1Root, "src/control-\u0080.ts", "export {};\n");
      git(c1Root, ["add", "."]);
      git(c1Root, ["commit", "-qm", "add C1 path"]);
      git(c1Root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      const c1 = runProducer(c1Root, "--prepare");
      assert.notEqual(c1.status, 0);
      assert.match(c1.stderr, /locator|control/i);

      const deep = `src/${Array.from({ length: 65 }, (_, index) => `d${index}`).join("/")}/deep.ts`;
      fixtureFile(depthRoot, deep, "export {};\n");
      git(depthRoot, ["add", "."]);
      git(depthRoot, ["commit", "-qm", "add deep path"]);
      git(depthRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      const depth = runProducer(depthRoot, "--prepare");
      assert.notEqual(depth.status, 0);
      assert.match(depth.stderr, /depth|cap/i);
      assert.equal(existsSync(join(depthRoot, "dist")), false);
    } finally {
      rmSync(c1Root, { recursive: true, force: true });
      rmSync(depthRoot, { recursive: true, force: true });
    }
  });

  it("sanitizes only the exact same-inode publisher sibling before rotation", () => {
    const root = createFixture();
    try {
      mkdirSync(join(root, "dist"));
      const fixed = join(root, "dist/BUILD_INFO.json");
      const sibling = join(root, "dist/.BUILD_INFO.json.00000000-0000-4000-8000-000000000000.tmp");
      writeFileSync(fixed, "old\n", { mode: 0o444 });
      chmodSync(fixed, 0o444);
      linkSync(fixed, sibling);
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      const archive = readdirSync(join(root, ".setfarm/build-generations-v1"))[0];
      assert.equal(readFileSync(join(root, `.setfarm/build-generations-v1/${archive}/BUILD_INFO.json`), "utf8"), "old\n");
      assert.equal(existsSync(join(root, `.setfarm/build-generations-v1/${archive}/.BUILD_INFO.json.00000000-0000-4000-8000-000000000000.tmp`)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a last-instant sibling replacement before sanitizer unlink for every authority basename", () => {
    const basenames = [
      "BUILD_INFO.json",
      "PLATFORM_BUILD_OUTPUT_TREE.json",
      "PLATFORM_RELEASE_MANIFEST.json",
    ];
    for (const basename of basenames) {
      const root = createFixture();
      try {
        commitProducerTransform(root, (source) => {
          const sanitizerStart = source.indexOf("function sanitizePublisherFamily(");
          const sanitizerEnd = source.indexOf("\nfunction validateArchiveRoot(", sanitizerStart);
          assert.notEqual(sanitizerStart, -1);
          assert.notEqual(sanitizerEnd, -1);
          const prefix = source.slice(0, sanitizerStart);
          const body = source.slice(sanitizerStart, sanitizerEnd);
          const suffix = source.slice(sanitizerEnd);
          const currentNeedle = "  unlinkSync(tempPath);\n  fsyncDirectory(distPath);\n  readStableRegular(fixedPath";
          const hardenedNeedle = "  unlinkRevalidated(tempPath, temp, fixedPath, fixed, `${basename} linked temporary`);\n  readStableRegular(fixedPath";
          const needle = body.includes(hardenedNeedle) ? hardenedNeedle : currentNeedle;
          assert.equal(body.includes(needle), true, "sanitizer linked-unlink anchor must exist");
          const mutation = [
            `  if (basename === ${JSON.stringify(basename)}) {`,
            "    unlinkSync(tempPath);",
            "    writeFileSync(tempPath, Buffer.from('raced\\n'), { mode: 0o444 });",
            "    chmodSync(tempPath, 0o444);",
            "  }",
          ].join("\n");
          return `${prefix}${body.replace(needle, `${mutation}\n${needle}`)}${suffix}`;
        }, `inject ${basename} sanitizer race`);
        mkdirSync(join(root, "dist"));
        const fixed = join(root, "dist", basename);
        const sibling = join(root, "dist", `.${basename}.00000000-0000-4000-8000-000000000000.tmp`);
        writeFileSync(fixed, "old\n", { mode: 0o444 });
        chmodSync(fixed, 0o444);
        linkSync(fixed, sibling);
        const prepared = runProducer(root, "--prepare");
        assert.notEqual(prepared.status, 0, `${basename} race was accepted`);
        assert.match(prepared.stderr, /changed|race|identity|link|publisher/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects an identical-byte inode replacement at the link boundary for every authority basename", () => {
    const basenames = [
      "BUILD_INFO.json",
      "PLATFORM_BUILD_OUTPUT_TREE.json",
      "PLATFORM_RELEASE_MANIFEST.json",
    ];
    for (const basename of basenames) {
      const root = createFixture();
      try {
        commitProducerTransform(root, (source) => {
          const needle = "    linkSync(tempPath, fixedPath);";
          const offset = source.indexOf(needle, source.indexOf("function publishExactArtifact"));
          assert.notEqual(offset, -1, "publisher link boundary must exist");
          const mutation = [
            `    if (basename === ${JSON.stringify(basename)}) {`,
            "      const racedBytes = readFileSync(tempPath);",
            "      unlinkSync(tempPath);",
            "      writeFileSync(tempPath, racedBytes, { mode: 0o444 });",
            "      chmodSync(tempPath, 0o444);",
            "    }",
          ].join("\n");
          return `${source.slice(0, offset)}${mutation}\n${needle}${source.slice(offset + needle.length)}`;
        }, `inject ${basename} link race`);
        let result;
        if (basename === "BUILD_INFO.json") {
          result = runProducer(root, "--prepare");
        } else {
          const prepared = runProducer(root, "--prepare");
          assert.equal(prepared.status, 0, prepared.stderr);
          materializeOutputs(root);
          result = runProducer(root, "--finalize");
        }
        assert.notEqual(result.status, 0, `${basename} identical-byte inode race was accepted`);
        assert.match(result.stderr, /changed|identity|descriptor|link/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects over-cap prior storage before rotation mutation", () => {
    const fileRoot = createFixture();
    const wideRoot = createFixture();
    try {
      mkdirSync(join(fileRoot, "dist"), { mode: 0o755 });
      writeFileSync(join(fileRoot, "dist/too-large.bin"), Buffer.alloc(33_554_433), { mode: 0o600 });
      const oversized = runProducer(fileRoot, "--prepare");
      assert.notEqual(oversized.status, 0);
      assert.match(oversized.stderr, /exceeds|cap/i);
      assert.equal(existsSync(join(fileRoot, ".setfarm/build-generations-v1")), true);
      assert.equal(readdirSync(join(fileRoot, ".setfarm/build-generations-v1")).length, 0);

      mkdirSync(join(wideRoot, "dist"), { mode: 0o755 });
      for (let index = 0; index <= 10_000; index += 1) {
        mkdirSync(join(wideRoot, "dist", `d${String(index).padStart(5, "0")}`), { mode: 0o755 });
      }
      const tooWide = runProducer(wideRoot, "--prepare");
      assert.notEqual(tooWide.status, 0);
      assert.match(tooWide.stderr, /entry|cap/i);
      assert.equal(readdirSync(join(wideRoot, ".setfarm/build-generations-v1")).length, 0);
    } finally {
      rmSync(fileRoot, { recursive: true, force: true });
      rmSync(wideRoot, { recursive: true, force: true });
    }
  });

  it("adopts same-inode post-link output-tree and terminal-manifest recovery states", () => {
    const root = createFixture();
    try {
      finalizeFixture(root);
      const outputTree = join(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json");
      const manifest = join(root, "dist/PLATFORM_RELEASE_MANIFEST.json");
      const outputSibling = join(root, "dist/.PLATFORM_BUILD_OUTPUT_TREE.json.00000000-0000-4000-8000-000000000000.tmp");
      const manifestSibling = join(root, "dist/.PLATFORM_RELEASE_MANIFEST.json.00000000-0000-4000-8000-000000000001.tmp");
      linkSync(outputTree, outputSibling);
      linkSync(manifest, manifestSibling);
      const recovered = runProducer(root, "--finalize");
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.equal(existsSync(outputSibling), false);
      assert.equal(existsSync(manifestSibling), false);
      assert.equal(statSync(outputTree).nlink, 1);
      assert.equal(statSync(manifest).nlink, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps receipt-absent terminal recovery read-only on ordinary-output drift", () => {
    const root = createFixture();
    try {
      finalizeFixture(root);
      const outputPath = join(root, "dist/server/index.js");
      chmodSync(outputPath, 0o600);
      const recovered = runProducer(root, "--finalize");
      assert.notEqual(recovered.status, 0);
      assert.match(recovered.stderr, /output|mode|authority|drift|changed/i);
      assert.equal(mode(root, "dist/server/index.js"), 0o600, "terminal recovery must not repair published output drift");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
