import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";

const repo = new URL("../../", import.meta.url);
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const commitHash = value => digest(canonical(value));
const git = (root, ...args) => execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).trim();
function write(root, locator, bytes, mode = 0o644) {
  const target = path.join(root, locator); fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  fs.writeFileSync(target, bytes, { mode }); fs.chmodSync(target, mode);
}
function fixture(body, instrument = source => source) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-bootstrap-")));
  try {
    for (const name of ["deployment-cutover.mjs", "deployment-cutover-owner.mjs", "build-generation-retention.mjs", "build-generation-maintenance-owner-observer.mjs", "build-generation-maintenance-journal.mjs"]) {
      let source = fs.readFileSync(new URL(`scripts/${name}`, repo), "utf8");
      if (name === "deployment-cutover.mjs") {
        // Keep even an accidental runtime-store call inside this owned fixture.
        source = source.replace('const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));',
          'const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));\nimport os from "node:os"; import {syncBuiltinESMExports} from "node:module"; const fixtureIdentity=os.userInfo();os.userInfo=()=>({...fixtureIdentity,homedir:root});os.homedir=()=>root;syncBuiltinESMExports();');
        source = instrument(source);
      }
      write(root, `scripts/${name}`, source);
    }
    write(root, "package.json", '{"name":"cutover-bootstrap-fixture","version":"1.0.0","type":"module"}\n');
    write(root, ".gitignore", "dist/\n.setfarm/\n");
    write(root, "scripts/stitch-to-jsx.mjs", "export const fixtureConverter = true;\n");
    const sources = ["internal-production/baseline-deployment-cutover-records-v1", "internal-production/baseline-deployment-cutover-owner-store-v1",
      "internal-production/baseline-workspace-authority-path-v1", "product-compiler/canonical-json"];
    for (const locator of sources) write(root, `src/${locator}.ts`, fs.readFileSync(new URL(`src/${locator}.ts`, repo)));
    write(root, "src/cli/cli.ts", "export const fixtureCli = true;\n"); sources.push("cli/cli");
    git(root, "init", "-q", "-b", "main"); git(root, "config", "user.name", "Setfarm Fixture");
    git(root, "config", "user.email", "setfarm-fixture@example.invalid"); git(root, "config", "commit.gpgsign", "false");
    git(root, "config", "remote.origin.url", "https://github.com/hikmetgulsesli/setfarm.git");
    git(root, "add", "."); git(root, "commit", "-qm", "bootstrap fixture"); git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
    const sha = git(root, "rev-parse", "HEAD"), treeHash = git(root, "rev-parse", "HEAD^{tree}");
    const inputEntries = execFileSync("/usr/bin/git", ["ls-tree", "-r", "-z", "--full-tree", "HEAD"], { cwd: root }).toString().split("\0").filter(Boolean).map(row => {
      const [, gitMode, gitBlobHash, locator] = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
      return { locator, gitMode, gitBlobHash };
    }).sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    const buildInputSetHash = commitHash({ schema: "setfarm.internal-production-pinned-build-input-set.v1", sourceSha: sha, sourceTreeHash: treeHash, entries: inputEntries });
    const entries = sources.map(locator => {
      const bytes = Buffer.from(transformSync(fs.readFileSync(path.join(root, `src/${locator}.ts`), "utf8"), { loader: "ts", format: "esm", target: "node22" }).code);
      const output = `dist/${locator}.js`, mode = locator === "cli/cli" ? 0o755 : 0o644;
      write(root, output, bytes, mode); return { locator: output, mode, byteLength: bytes.length, sha256: digest(bytes) };
    }).sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    const projection = { schema: "setfarm.platform-build-output-tree.v1", sourceSha: sha, sourceTreeHash: treeHash, entries };
    const output = { ...projection, outputTreeHash: commitHash(projection) }, stitch = fs.readFileSync(path.join(root, "scripts/stitch-to-jsx.mjs"));
    const manifest = { schema: "setfarm.platform-release-manifest.v1", releaseSha: sha, branch: "main", dirty: false,
      stitchConverter: { converterId: "setfarm.stitch-to-jsx", source: { schema: "setfarm.source-artifact-ref.v1", hash: digest(stitch), mediaType: "text/javascript", locator: "scripts/stitch-to-jsx.mjs", byteLength: stitch.length } } };
    const info = { sha, shortSha: sha.slice(0, 8), branch: "main", dirty: false, packageVersion: "1.0.0", displayVersion: `1.0.0+${sha.slice(0, 8)}`, builtAt: "2026-09-16T00:00:00.000Z" };
    write(root, "dist/BUILD_INFO.json", `${JSON.stringify(info, null, 2)}\n`, 0o444);
    write(root, "dist/PLATFORM_BUILD_OUTPUT_TREE.json", `${JSON.stringify(output)}\n`, 0o444);
    write(root, "dist/PLATFORM_RELEASE_MANIFEST.json", `${JSON.stringify(manifest)}\n`, 0o444);
    const { builtAt: ignored, ...stable } = info;
    const buildHash = commitHash({ schema: "setfarm.internal-production-controller-build.v1", stableBuildInfo: { schema: "setfarm.internal-production-stable-setfarm-build-info.v1", ...stable }, buildInputSetHash, outputTreeHash: output.outputTreeHash, releaseManifestHash: commitHash(manifest) });
    body(root, { branch: "main", clean: true, sha, treeHash, buildHash, originMainSha: sha });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function run(root, args = ["inspect", "--json"], extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(root, "scripts/deployment-cutover.mjs"), ...args], {
    cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC", ...extraEnv }, encoding: "utf8", timeout: 30000,
  });
}
test("fresh bootstrap authenticates source and finalized output without runtime writes", () => fixture((root, expected) => {
  const result = run(root); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout); assert.deepEqual(value.sourceBuild, expected);
  assert.match(value.controllerSourceHash, /^[a-f0-9]{64}$/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
  assert.equal(git(root, "status", "--porcelain"), "");
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));
for (const fault of ["dirty-script", "wrong-origin", "output-bytes"]) test(`fresh bootstrap refuses ${fault} before reporting authority`, () => fixture(root => {
  if (fault === "dirty-script") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-owner.mjs"), "\n");
  if (fault === "wrong-origin") git(root, "config", "remote.origin.url", "https://example.invalid/foreign.git");
  if (fault === "output-bytes") fs.appendFileSync(path.join(root, "dist/cli/cli.js"), "\n");
  const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.match(result.stderr, /DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
}));

for (const locator of ["scripts/build-generation-retention.mjs", "dist/internal-production/baseline-deployment-cutover-records-v1.js"]) {
  test(`load-time replacement of ${locator} never evaluates swapped bytes`, () => fixture(root => {
    const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n$/);
    assert.equal(fs.existsSync(path.join(root, "executed-marker")), false);
    assert.match(fs.readFileSync(path.join(root, locator), "utf8"), /executed-marker/);
    assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }, source => source.replace('check(); return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };',
    `check(); if(entry.locator===${JSON.stringify(locator)}){fs.writeFileSync(entry.target,"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(path.join(root,'executed-marker'))+",'executed');export const swapped=true;\\n");}
      return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };`)));
}

for (const args of [[], ["prepare"], ["inspect"], ["inspect", "--json", "extra"]]) {
  test(`bootstrap rejects unsupported arguments ${JSON.stringify(args)} without runtime writes`, () => fixture(root => {
    const result = run(root, args); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }));
}

test("bootstrap rejects unexpected secret-bearing environment without disclosing it", () => fixture(root => {
  const result = run(root, ["inspect", "--json"], { SETFARM_PG_URL: "fixture-secret-never-print" });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.doesNotMatch(result.stderr, /fixture-secret/);
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));

test("bootstrap refuses being imported by an unsupported existing entry process", () => fixture(root => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(path.join(root, "scripts/deployment-cutover.mjs"))});`], {
    cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC" }, encoding: "utf8", timeout: 30000,
  });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));
