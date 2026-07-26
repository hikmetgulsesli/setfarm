import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const commandPath = path.join(
  repoRoot,
  "scripts",
  "build-platform-release-v2.mjs",
);
const sourceSha = "a".repeat(40);
const sourceEpoch = "1700000000";

function chmodTree(root, directoryMode, fileMode) {
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return;
  chmodSync(root, directoryMode);
  for (const name of readdirSync(root)) {
    const child = path.join(root, name);
    const childStat = lstatSync(child);
    if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
      chmodTree(child, directoryMode, fileMode);
    } else if (childStat.isFile()) {
      chmodSync(child, fileMode);
    }
  }
}

function cleanup(root) {
  try {
    chmodTree(root, 0o700, 0o600);
  } catch {
    // A test may intentionally replace a child with invalid topology.
  }
  rmSync(root, { recursive: true, force: true });
}

function writeFixtureFile(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, content, { flag: "wx", mode: 0o600 });
}

function createFixture(options = {}) {
  const created = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-build-command-v2-"),
  );
  const root = realpathSync(created);
  const context = path.join(root, "context");
  const source = path.join(context, "source");
  const toolchain = path.join(context, "node_modules");
  const outputA = path.join(root, "output-a");
  const outputB = path.join(root, "output-b");
  const outside = path.join(root, "outside");
  mkdirSync(context, { mode: 0o700 });
  mkdirSync(source, { mode: 0o700 });
  mkdirSync(toolchain, { mode: 0o700 });
  mkdirSync(outputA, { mode: 0o700 });
  mkdirSync(outputB, { mode: 0o700 });
  mkdirSync(outside, { mode: 0o700 });
  writeFixtureFile(
    source,
    "package.json",
    `${JSON.stringify({
      name: "setfarm",
      type: "module",
      version: "9.8.7",
    })}\n`,
  );
  writeFixtureFile(source, "tsconfig.json", "{}\n");
  writeFixtureFile(
    source,
    "scripts/stitch-to-jsx.mjs",
    "export function convert() {}\n",
  );
  writeFixtureFile(source, "src/server/index.html", "<main>Setfarm</main>\n");
  writeFixtureFile(
    source,
    "src/installer/compat-rules.json",
    "{\"rules\":[]}\n",
  );
  writeFixtureFile(
    source,
    "src/installer/prompts/runtime.md",
    "# Runtime\n",
  );
  writeFixtureFile(
    source,
    "src/installer/steps/plan/RULES.md",
    "# Plan\n",
  );
  writeFixtureFile(source, "src/cli/cli.ts", "export {};\n");
  const compiler = path.join(toolchain, "typescript", "bin", "tsc");
  writeFixtureFile(
    toolchain,
    "typescript/package.json",
    `${JSON.stringify({ name: "typescript", version: "5.9.3" })}\n`,
  );
  writeFixtureFile(
    toolchain,
    "typescript/bin/tsc",
    options.compilerSource ?? `
      import {
        chmodSync,
        mkdirSync,
        symlinkSync,
        writeFileSync,
      } from "node:fs";
      import path from "node:path";
      const outIndex = process.argv.indexOf("--outDir");
      const rootIndex = process.argv.indexOf("--rootDir");
      const out = process.argv[outIndex + 1];
      const sourceRoot = path.dirname(process.argv[rootIndex + 1]);
      mkdirSync(path.join(out, "cli"), { recursive: true });
      writeFileSync(path.join(out, "cli", "cli.js"), "export const cli = true;\\n");
      ${options.escapeAssetDestination ? `
        symlinkSync(
          ${JSON.stringify(outside)},
          path.join(out, "server"),
          "dir",
        );
      ` : ""}
      ${options.nonPortableOutput ? `
        writeFileSync(path.join(out, "not portable.js"), "escape\\n");
      ` : ""}
      ${options.mutateSource ? `
        const sourceFile = path.join(sourceRoot, "src", "cli", "cli.ts");
        chmodSync(path.dirname(sourceFile), 0o755);
        chmodSync(sourceFile, 0o600);
        writeFileSync(sourceFile, "export const changed = true;\\n");
        chmodSync(sourceFile, 0o444);
        chmodSync(path.dirname(sourceFile), 0o555);
      ` : ""}
      ${options.mutateToolchain ? `
        const toolchainFile = ${JSON.stringify(
          path.join(toolchain, "typescript", "package.json"),
        )};
        chmodSync(path.dirname(toolchainFile), 0o755);
        chmodSync(toolchainFile, 0o600);
        writeFileSync(toolchainFile, "{\\"name\\":\\"changed\\"}\\n");
        chmodSync(toolchainFile, 0o444);
        chmodSync(path.dirname(toolchainFile), 0o555);
      ` : ""}
    `,
  );
  chmodTree(source, 0o555, 0o444);
  chmodTree(toolchain, 0o555, 0o444);
  chmodSync(compiler, 0o555);
  return {
    root,
    context,
    source,
    toolchain,
    outputA,
    outputB,
    outside,
    compiler,
  };
}

function runCommand(fixture, output, overrides = {}) {
  return spawnSync(
    process.execPath,
    [
      commandPath,
      "--source-root",
      fixture.source,
      "--output-root",
      output,
      "--build-toolchain-root",
      overrides.toolchain ?? fixture.toolchain,
      "--build-toolchain-hash",
      overrides.toolchainHash ?? toolchainTreeHash(fixture.toolchain),
      "--source-sha",
      overrides.sourceSha ?? sourceSha,
      "--source-date-epoch",
      overrides.sourceEpoch ?? sourceEpoch,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    },
  );
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
  ).join(",")}}`;
}

function toolchainTreeHash(root) {
  const snapshot = treeSnapshot(root);
  const entries = snapshot.map((entry) => {
    if (entry.type === "directory") {
      return {
        path: entry.path,
        type: "directory",
        mode: "0555",
      };
    }
    const executable = entry.mode === 0o555;
    return {
      path: entry.path,
      type: "file",
      mode: executable ? "0555" : "0444",
      executable,
      byteLength: Buffer.from(entry.bytes, "base64").byteLength,
      contentHash: entry.hash,
    };
  });
  const files = entries.filter((entry) => entry.type === "file");
  const directories = entries.filter((entry) => entry.type === "directory");
  const identity = {
    schema: "setfarm.canonical-runtime-tree-content.v2",
    profile: "dependencies",
    rootMode: "0555",
    entries,
    fileCount: files.length,
    directoryCount: directories.length,
    totalBytes: files.reduce((sum, entry) => sum + entry.byteLength, 0),
  };
  return createHash("sha256").update(canonicalJson(identity)).digest("hex");
}

function treeSnapshot(root) {
  const entries = [];
  function visit(absolute, relative) {
    for (const name of readdirSync(absolute).sort()) {
      const child = path.join(absolute, name);
      const childRelative = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(child);
      if (stat.isDirectory()) {
        entries.push({
          path: childRelative,
          type: "directory",
          mode: stat.mode & 0o7777,
        });
        visit(child, childRelative);
      } else {
        const bytes = readFileSync(child);
        entries.push({
          path: childRelative,
          type: "file",
          mode: stat.mode & 0o7777,
          bytes: bytes.toString("base64"),
          hash: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  visit(root, "");
  return entries;
}

test("BUILD_PLATFORM_RELEASE_V2 produces identical output in two empty roots", () => {
  const fixture = createFixture();
  try {
    const first = runCommand(fixture, fixture.outputA);
    const second = runCommand(fixture, fixture.outputB);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    const firstResult = JSON.parse(first.stdout);
    const secondResult = JSON.parse(second.stdout);
    assert.deepEqual(firstResult, secondResult);
    assert.equal(
      firstResult.productionUse,
      "forbidden_until_dependency_materialization_and_manifest_verification",
    );
    assert.equal(
      firstResult.buildToolchainTreeHash,
      toolchainTreeHash(fixture.toolchain),
    );
    assert.deepEqual(
      treeSnapshot(fixture.outputA),
      treeSnapshot(fixture.outputB),
    );
    assert.deepEqual(
      readdirSync(fixture.outputA),
      ["payload"],
    );
    assert.deepEqual(
      readdirSync(path.join(fixture.outputA, "payload")).sort(),
      ["dist", "package.json"],
    );
    assert.equal(
      statSync(path.join(
        fixture.outputA,
        "payload",
        "dist",
        "cli",
        "cli.js",
      )).mode & 0o7777,
      0o555,
    );
    assert.equal(
      statSync(path.join(
        fixture.outputA,
        "payload",
        "package.json",
      )).mode & 0o7777,
      0o444,
    );
    const buildInfo = JSON.parse(readFileSync(path.join(
      fixture.outputA,
      "payload",
      "dist",
      "BUILD_INFO.json",
    ), "utf8"));
    assert.deepEqual(buildInfo, {
      branch: "main",
      builtAt: "2023-11-14T22:13:20.000Z",
      dirty: false,
      displayVersion: "9.8.7+aaaaaaaa",
      packageVersion: "9.8.7",
      sha: sourceSha,
      shortSha: "aaaaaaaa",
    });
    assert.equal(
      first.stdout.includes(fixture.root)
        || JSON.stringify(treeSnapshot(fixture.outputA)).includes(fixture.root),
      false,
    );
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 detects source mutation after compiler exit", () => {
  const fixture = createFixture({ mutateSource: true });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SOURCE_OR_OUTPUT_CHANGED/);
    assert.equal(
      readdirSync(fixture.source).includes("dist"),
      false,
    );
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 refuses non-empty output and invalid source clock", () => {
  const fixture = createFixture();
  try {
    writeFileSync(path.join(fixture.outputA, "occupied"), "x");
    const occupied = runCommand(fixture, fixture.outputA);
    assert.equal(occupied.status, 1);
    assert.match(occupied.stderr, /OUTPUT_ROOT_NOT_EMPTY/);

    const badEpoch = runCommand(
      fixture,
      fixture.outputB,
      { sourceEpoch: "01" },
    );
    assert.equal(badEpoch.status, 1);
    assert.match(badEpoch.stderr, /ARGUMENTS_INVALID/);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 rejects a non-canonical source tree before execution", () => {
  const fixture = createFixture();
  try {
    chmodSync(fixture.source, 0o755);
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SOURCE_ROOT_INVALID/);
    assert.deepEqual(readdirSync(fixture.outputA), []);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 never follows a compiler-created asset symlink", () => {
  const fixture = createFixture({ escapeAssetDestination: true });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ASSET_DESTINATION_INVALID/);
    assert.deepEqual(readdirSync(fixture.outside), []);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 rejects non-portable compiler output", () => {
  const fixture = createFixture({ nonPortableOutput: true });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /OUTPUT_TREE_INVALID/);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 preserves a typed compiler failure", () => {
  const fixture = createFixture({
    compilerSource: `
      process.stderr.write("compiler fixture failed");
      process.exit(19);
    `,
  });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TYPESCRIPT_BUILD_FAILED/);
    assert.match(result.stderr, /status=19/);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 rejects successful compiler prose", () => {
  const fixture = createFixture({
    compilerSource: `
      process.stdout.write("unbound compiler prose");
    `,
  });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TYPESCRIPT_BUILD_OUTPUT_UNEXPECTED/);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 rejects a toolchain through an aliased parent", () => {
  const fixture = createFixture();
  try {
    const aliasRoot = path.join(fixture.root, "toolchain-alias");
    symlinkSync(fixture.toolchain, aliasRoot, "dir");
    const result = runCommand(
      fixture,
      fixture.outputA,
      { toolchain: aliasRoot },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BUILD_TOOLCHAIN_ROOT_INVALID/);
    assert.deepEqual(readdirSync(fixture.outputA), []);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 rejects detached or mismatched toolchain authority", () => {
  const fixture = createFixture();
  try {
    const mismatched = runCommand(
      fixture,
      fixture.outputA,
      { toolchainHash: "f".repeat(64) },
    );
    assert.equal(mismatched.status, 1);
    assert.match(mismatched.stderr, /BUILD_TOOLCHAIN_HASH_MISMATCH/);

    writeFileSync(path.join(fixture.context, "ambient"), "x");
    const ambient = runCommand(fixture, fixture.outputB);
    assert.equal(ambient.status, 1);
    assert.match(ambient.stderr, /BUILD_CONTEXT_INVALID/);
  } finally {
    cleanup(fixture.root);
  }
});

test("BUILD_PLATFORM_RELEASE_V2 detects toolchain mutation after compiler exit", () => {
  const fixture = createFixture({ mutateToolchain: true });
  try {
    const result = runCommand(fixture, fixture.outputA);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SOURCE_OR_OUTPUT_CHANGED|BUILD_TOOLCHAIN/);
  } finally {
    cleanup(fixture.root);
  }
});
