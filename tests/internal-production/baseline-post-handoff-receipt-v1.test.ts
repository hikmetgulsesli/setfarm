import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const observerSource = path.join(sourceRoot, "src/internal-production/baseline-post-handoff-receipt-v1.ts");
const tsxLoader = import.meta.resolve("tsx");
const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
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

function git(root: string, args: readonly string[]): string {
  return execFileSync("/usr/bin/git", [...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function fixtureFile(root: string, locator: string, bytes: string | Buffer, mode = 0o644): void {
  const target = path.join(root, locator);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function createFixture(): string {
  assert.equal(existsSync(observerSource), true, "production observer module must exist before fixture creation");
  const root = mkdtempSync(path.join(tmpdir(), "setfarm-oa17-observer-"));
  fixtureFile(root, "scripts/write-build-info.mjs", readFileSync(path.join(sourceRoot, "scripts/write-build-info.mjs")));
  fixtureFile(root, "scripts/stitch-to-jsx.mjs", 'process.stdout.write("fixture converter\\n");\n');
  fixtureFile(root, "scripts/copy-step-assets.mjs", readFileSync(path.join(sourceRoot, "scripts/copy-step-assets.mjs")), 0o755);
  fixtureFile(root, "scripts/inject-version.js", "// fixture inject\n");
  fixtureFile(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts", readFileSync(observerSource));
  fixtureFile(root, "src/product-compiler/canonical-json.ts", readFileSync(path.join(sourceRoot, "src/product-compiler/canonical-json.ts")));
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

function runProducer(root: string, phase: "--prepare" | "--finalize") {
  return spawnSync(process.execPath, ["scripts/write-build-info.mjs", phase], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function materializeOutputs(root: string): void {
  const outputs: Readonly<Record<string, string>> = Object.freeze({
    "dist/cli/cli.js": 'console.log("fixture");\n',
    "dist/installer/compat-rules.json": "{}\n",
    "dist/installer/prompts/prompt.md": "prompt\n",
    "dist/installer/steps/nested/step.md": "step\n",
    "dist/internal-production/baseline-post-handoff-receipt-v1.js": "// compiled observer fixture\n",
    "dist/product-compiler/canonical-json.js": "// compiled canonical fixture\n",
    "dist/server/index.html": "<!doctype html>fixture\n",
    "dist/server/index.js": "export const server = true;\n",
  });
  for (const [locator, bytes] of Object.entries(outputs)) fixtureFile(root, locator, bytes, 0o600);
}

function finalizedFixture(): Readonly<{ root: string; buildInputSetHash: string }> {
  const root = createFixture();
  const prepared = runProducer(root, "--prepare");
  assert.equal(prepared.status, 0, prepared.stderr);
  const receipt = JSON.parse(readFileSync(path.join(root, "dist/PLATFORM_BUILD_PREPARE.json"), "utf8"));
  materializeOutputs(root);
  const finalized = runProducer(root, "--finalize");
  assert.equal(finalized.status, 0, finalized.stderr);
  return Object.freeze({ root, buildInputSetHash: receipt.buildInputSetHash });
}

function runObserver(root: string): ReturnType<typeof spawnSync> {
  const moduleUrl = pathToFileURL(path.join(root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
  const program = `import(${JSON.stringify(moduleUrl)}).then(async (m) => process.stdout.write(JSON.stringify(await m.observeCurrentInternalProductionCleanSetfarmSourceBuildV1()) + "\\n"))`;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

describe("OA17 zero-input current Setfarm source/build observation", () => {
  it("exports the zero-input observer from an import-inert module", async () => {
    const loaded = existsSync(observerSource)
      ? await import(`${pathToFileURL(observerSource).href}?oa17=${Date.now()}`)
      : undefined;
    assert.equal(
      typeof loaded?.observeCurrentInternalProductionCleanSetfarmSourceBuildV1,
      "function",
      "production must export observeCurrentInternalProductionCleanSetfarmSourceBuildV1",
    );
  });

  it("keeps the observer boundary zero-input, code-owned, and free of fallback seams", () => {
    const source = readFileSync(observerSource, "utf8");
    const runtimeExports = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)]
      .map((match) => match[1]);
    assert.deepEqual(runtimeExports, ["observeCurrentInternalProductionCleanSetfarmSourceBuildV1"]);
    assert.match(source, /export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1\(\)/);
    assert.doesNotMatch(source, /process\.(?:env|argv|cwd)\b/);
    assert.doesNotMatch(source, /\b(?:fallback|packagedFallback|repositoryRoot|gitBinary|toolPath)\s*[:=]/i);
    assert.match(source, /spawnSync\("\/usr\/bin\/git"/);
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(imports.filter((specifier) => specifier.startsWith(".")), ["../product-compiler/canonical-json.js"]);
  });

  it("returns only the clean current source tuple and exact controller build hash", () => {
    const fixture = finalizedFixture();
    try {
      const observed = runObserver(fixture.root);
      assert.equal(observed.status, 0, observed.stderr);
      const value = JSON.parse(observed.stdout.trim());
      const sha = git(fixture.root, ["rev-parse", "HEAD"]);
      const treeHash = git(fixture.root, ["rev-parse", "HEAD^{tree}"]);
      const info = JSON.parse(readFileSync(path.join(fixture.root, "dist/BUILD_INFO.json"), "utf8"));
      const outputTree = JSON.parse(readFileSync(path.join(fixture.root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"), "utf8"));
      const manifest = JSON.parse(readFileSync(path.join(fixture.root, "dist/PLATFORM_RELEASE_MANIFEST.json"), "utf8"));
      const stableBuildInfo = {
        schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
        sha: info.sha,
        shortSha: info.shortSha,
        branch: info.branch,
        dirty: info.dirty,
        packageVersion: info.packageVersion,
        displayVersion: info.displayVersion,
      };
      const expectedBuildHash = canonicalHash({
        schema: "setfarm.internal-production-controller-build.v1",
        stableBuildInfo,
        buildInputSetHash: fixture.buildInputSetHash,
        outputTreeHash: outputTree.outputTreeHash,
        releaseManifestHash: canonicalHash(manifest),
      });
      assert.deepEqual(value, {
        branch: "main",
        clean: true,
        sha,
        treeHash,
        buildHash: expectedBuildHash,
        originMainSha: sha,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("excludes valid builtAt metadata from controller build identity", () => {
    const fixture = finalizedFixture();
    try {
      const first = runObserver(fixture.root);
      assert.equal(first.status, 0, first.stderr);
      const infoPath = path.join(fixture.root, "dist/BUILD_INFO.json");
      const info = JSON.parse(readFileSync(infoPath, "utf8"));
      info.builtAt = "2040-01-02T03:04:05.006Z";
      chmodSync(infoPath, 0o644);
      writeFileSync(infoPath, `${JSON.stringify(info, null, 2)}\n`);
      chmodSync(infoPath, 0o444);
      const second = runObserver(fixture.root);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(JSON.parse(second.stdout).buildHash, JSON.parse(first.stdout).buildHash);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects deterministic manifest tamper and hidden tracked drift", () => {
    const manifestFixture = finalizedFixture();
    const driftFixture = finalizedFixture();
    try {
      const manifestPath = path.join(manifestFixture.root, "dist/PLATFORM_RELEASE_MANIFEST.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.stitchConverter.source.byteLength += 1;
      chmodSync(manifestPath, 0o644);
      writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
      chmodSync(manifestPath, 0o444);
      const tampered = runObserver(manifestFixture.root);
      assert.notEqual(tampered.status, 0);
      assert.match(tampered.stderr, /manifest|pinned/i);

      git(driftFixture.root, ["update-index", "--skip-worktree", "package.json"]);
      writeFileSync(path.join(driftFixture.root, "package.json"), `${readFileSync(path.join(driftFixture.root, "package.json"), "utf8")} `);
      assert.equal(git(driftFixture.root, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
      const drifted = runObserver(driftFixture.root);
      assert.notEqual(drifted.status, 0);
      assert.match(drifted.stderr, /pinned Git blob|live tracked/i);
    } finally {
      rmSync(manifestFixture.root, { recursive: true, force: true });
      rmSync(driftFixture.root, { recursive: true, force: true });
    }
  });

  it("rejects reordered, duplicate-key, and alternate-whitespace authority bytes", () => {
    const infoFixture = finalizedFixture();
    const treeFixture = finalizedFixture();
    try {
      const infoPath = path.join(infoFixture.root, "dist/BUILD_INFO.json");
      const info = JSON.parse(readFileSync(infoPath, "utf8")) as Record<string, unknown>;
      const reordered = {
        builtAt: info.builtAt,
        sha: info.sha,
        shortSha: info.shortSha,
        branch: info.branch,
        dirty: info.dirty,
        packageVersion: info.packageVersion,
        displayVersion: info.displayVersion,
      };
      chmodSync(infoPath, 0o644);
      writeFileSync(infoPath, `${JSON.stringify(reordered, null, 2)}\n`);
      chmodSync(infoPath, 0o444);
      const reorderedResult = runObserver(infoFixture.root);
      assert.notEqual(reorderedResult.status, 0);
      assert.match(reorderedResult.stderr, /BUILD_INFO|field|raw bytes/i);

      const treePath = path.join(treeFixture.root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json");
      const treeText = readFileSync(treePath, "utf8").trimEnd();
      const duplicateSchema = treeText.replace(
        '"schema":"setfarm.platform-build-output-tree.v1",',
        '"schema":"setfarm.platform-build-output-tree.v1","schema":"setfarm.platform-build-output-tree.v1",',
      );
      chmodSync(treePath, 0o644);
      writeFileSync(treePath, `${duplicateSchema}\n`);
      chmodSync(treePath, 0o444);
      const duplicateResult = runObserver(treeFixture.root);
      assert.notEqual(duplicateResult.status, 0);
      assert.match(duplicateResult.stderr, /output tree|raw bytes|field/i);
    } finally {
      rmSync(infoFixture.root, { recursive: true, force: true });
      rmSync(treeFixture.root, { recursive: true, force: true });
    }
  });

  it("rejects multiple local origin values even when source and artifacts are unchanged", () => {
    const fixture = finalizedFixture();
    try {
      git(fixture.root, ["remote", "set-url", "--add", "origin", "https://example.invalid/second.git"]);
      const observed = runObserver(fixture.root);
      assert.notEqual(observed.status, 0);
      assert.match(observed.stderr, /origin/i);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
