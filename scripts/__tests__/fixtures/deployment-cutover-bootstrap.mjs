import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { transformSync, buildSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { materialize } from "./deployment-cutover-dependencies.mjs";

const repo = new URL("../../../", import.meta.url);
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const commitHash = value => digest(canonical(value));
export const git = (root, ...args) => execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).trim();
export function write(root, locator, bytes, mode = 0o644) {
  const target = path.join(root, locator); fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  fs.writeFileSync(target, bytes, { mode }); fs.chmodSync(target, mode);
}
export function fixture(body, instrument = source => source, { genuine = false, census = false, envAbsence = false, helpers = false, phaseClosure = false, prepare = () => {}, sourceInstrument = (_locator, source) => source,
  extraSources = {}, temporaryParent = os.tmpdir() } = {}) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(temporaryParent, "cutover-bootstrap-")));
  const root = path.join(home, "ai/setrox/controller");
  try {
    for (const name of ["deployment-cutover.mjs", "deployment-cutover-owner.mjs", "build-generation-retention.mjs", "build-generation-maintenance-owner-observer.mjs", "build-generation-maintenance-journal.mjs",
      "deployment-cutover-retained-profile.mjs", "deployment-cutover-retained-profile.v1.json",
      "deployment-cutover-default-context.mjs",
      "deployment-cutover-passive-home.mjs", "deployment-cutover-passive-home.py"]) {
      let source = fs.readFileSync(new URL(`scripts/${name}`, repo), "utf8");
      if (name === "deployment-cutover.mjs") {
        // Keep even an accidental runtime-store call inside this owned fixture.
        source = source.replace('const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));',
          'const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));\nimport os from "node:os"; import {syncBuiltinESMExports} from "node:module"; const fixtureHome=path.resolve(root,"../../.."),fixtureIdentity=os.userInfo();os.userInfo=()=>({...fixtureIdentity,homedir:fixtureHome});os.homedir=()=>fixtureHome;syncBuiltinESMExports();');
        source = instrument(source);
      }
      write(root, `scripts/${name}`, source);
    }
    write(root, "package.json", '{"name":"cutover-bootstrap-fixture","version":"1.0.0","type":"module"}\n');
    write(root, ".gitignore", "dist/\n.setfarm/\nnode_modules/\n");
    materialize(root, home, { genuine, installed: true });
    write(root, "scripts/stitch-to-jsx.mjs", "export const fixtureConverter = true;\n");
    const sources = ["internal-production/baseline-deployment-cutover-records-v1", "internal-production/baseline-deployment-cutover-owner-store-v1",
      "internal-production/baseline-deployment-cutover-publication-v1", "internal-production/baseline-deployment-cutover-v1",
      "internal-production/baseline-workspace-authority-path-v1", "product-compiler/canonical-json",
      "internal-production/baseline-deployment-cutover-cli-observation-v1",
      "internal-production/baseline-deployment-cutover-launcher-observation-v1",
      "internal-production/baseline-deployment-cutover-node-path-v1",
      "internal-production/baseline-deployment-cutover-process-observation-v1"];
    if (envAbsence) sources.push("internal-production/baseline-deployment-cutover-env-absence-v1");
    if (helpers) sources.push("internal-production/baseline-deployment-cutover-helper-observation-v1",
      "internal-production/baseline-restart-authority-retirement-v1", "internal-production/baseline-spawner-launch-environment-v1",
      "findings/legacy-finding-publication-inventory-v1");
    if (phaseClosure) sources.push("internal-production/baseline-deployment-cutover-phase-observation-v1");
    if (census) {
      const metadata = buildSync({ absWorkingDir: fileURLToPath(repo), entryPoints: ["src/internal-production/baseline-legacy-database-census-v1.ts"],
        bundle: true, write: false, metafile: true, packages: "external", platform: "node", format: "esm" }).metafile;
      for (const input of Object.keys(metadata.inputs)) {
        assert.match(input, /^src\/.+\.ts$/);
        const locator = input.slice(4, -3); if (!sources.includes(locator)) sources.push(locator);
      }
    }
    for (const locator of sources) write(root, `src/${locator}.ts`, sourceInstrument(locator, fs.readFileSync(new URL(`src/${locator}.ts`, repo), "utf8")));
    write(root, "src/cli/cli.ts", "export const fixtureCli = true;\n"); sources.push("cli/cli");
    for (const [locator, source] of Object.entries(extraSources)) {
      assert.match(locator, /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/);
      write(root, `src/${locator}.ts`, source); if (!sources.includes(locator)) sources.push(locator);
    }
    prepare(root, home);
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
    body(root, { branch: "main", clean: true, sha, treeHash, buildHash, originMainSha: sha }, home);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
export function run(root, args = ["inspect", "--json"], extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(root, "scripts/deployment-cutover.mjs"), ...args], {
    cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC", ...extraEnv }, encoding: "utf8", timeout: 30000,
  });
}
