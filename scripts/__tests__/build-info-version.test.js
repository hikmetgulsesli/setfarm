import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(__dirname, "..", "..");
const DEFAULT_CONVERTER = 'process.stdout.write("fixture converter\\n");\n';

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createFixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "setfarm-build-info-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(
    join(sourceRoot, "scripts", "write-build-info.mjs"),
    join(root, "scripts", "write-build-info.mjs"),
  );
  writeFileSync(join(root, ".gitignore"), "dist/\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.8.7" }));
  writeFileSync(
    join(root, "scripts", "stitch-to-jsx.mjs"),
    options.converterText ?? DEFAULT_CONVERTER,
  );
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "setfarm-tests@example.invalid"]);
  git(root, ["config", "user.name", "Setfarm Tests"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixture"]);
  return root;
}

function runProducer(root, phase, options = {}) {
  const env = { ...process.env, ...options.env };
  delete env.SETFARM_ALLOW_DIRTY_BUILD;
  if (options.allowDirty) env.SETFARM_ALLOW_DIRTY_BUILD = "1";
  const args = ["scripts/write-build-info.mjs"];
  if (phase) args.push(phase);
  return spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function manifestPath(root) {
  return join(root, "dist", "PLATFORM_RELEASE_MANIFEST.json");
}

function prepareReceiptPath(root) {
  return join(root, "dist", "PLATFORM_BUILD_PREPARE.json");
}

describe("build info and platform release stamping", () => {
  it("wires explicit prepare/finalize phases around the complete npm build", () => {
    const pkg = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
    assert.match(pkg.scripts.prebuild, /^node scripts\/write-build-info\.mjs --prepare && /);
    assert.ok(
      pkg.scripts.prebuild.indexOf("write-build-info.mjs --prepare")
        < pkg.scripts.prebuild.indexOf("check-version-contract.mjs"),
    );
    assert.equal(pkg.scripts.postbuild, "node scripts/write-build-info.mjs --finalize");
    assert.doesNotMatch(pkg.scripts.build, /write-build-info/);
  });

  it("prepare removes authority and finalize issues exact committed bytes last", () => {
    const root = createFixture();
    try {
      const prepared = runProducer(root, "--prepare");
      assert.equal(prepared.status, 0, prepared.stderr);
      assert.equal(existsSync(manifestPath(root)), false);

      const releaseSha = git(root, ["rev-parse", "HEAD"]);
      const receipt = JSON.parse(readFileSync(prepareReceiptPath(root), "utf8"));
      assert.deepEqual(Object.keys(receipt).sort(), [
        "branch",
        "buildId",
        "dirty",
        "porcelainFingerprint",
        "schema",
        "sha",
      ]);
      assert.equal(receipt.schema, "setfarm.platform-build-prepare.v1");
      assert.match(
        receipt.buildId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assert.equal(receipt.sha, releaseSha);
      assert.equal(receipt.branch, "main");
      assert.equal(receipt.dirty, false);
      assert.equal(
        receipt.porcelainFingerprint,
        createHash("sha256").update("").digest("hex"),
      );
      const converterBytes = execFileSync(
        "git",
        ["show", `${releaseSha}:scripts/stitch-to-jsx.mjs`],
        { cwd: root },
      );
      const finalized = runProducer(root, "--finalize");
      assert.equal(finalized.status, 0, finalized.stderr);
      assert.equal(existsSync(prepareReceiptPath(root)), false);

      const info = JSON.parse(readFileSync(join(root, "dist", "BUILD_INFO.json"), "utf8"));
      const manifest = JSON.parse(readFileSync(manifestPath(root), "utf8"));
      assert.equal(info.packageVersion, "9.8.7");
      assert.equal(info.sha, releaseSha);
      assert.equal(info.branch, "main");
      assert.equal(info.dirty, false);
      assert.deepEqual(manifest, {
        schema: "setfarm.platform-release-manifest.v1",
        releaseSha,
        branch: "main",
        dirty: false,
        stitchConverter: {
          converterId: "setfarm.stitch-to-jsx",
          source: {
            schema: "setfarm.source-artifact-ref.v1",
            hash: createHash("sha256").update(converterBytes).digest("hex"),
            mediaType: "text/javascript",
            locator: "scripts/stitch-to-jsx.mjs",
            byteLength: converterBytes.byteLength,
          },
        },
      });
      assert.deepEqual(
        readdirSync(join(root, "dist")).filter((name) => name.endsWith(".tmp")),
        [],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("invalidates an old manifest before a failed prebuild check and replaces the receipt", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      const firstReceipt = JSON.parse(readFileSync(prepareReceiptPath(root), "utf8"));
      assert.equal(runProducer(root, "--finalize").status, 0);
      assert.equal(existsSync(manifestPath(root)), true);
      assert.equal(existsSync(prepareReceiptPath(root)), false);

      const failedPrebuild = spawnSync(
        "/bin/sh",
        [
          "-c",
          '"$SETFARM_TEST_NODE" scripts/write-build-info.mjs --prepare'
            + ' && "$SETFARM_TEST_NODE" -e "process.exit(19)"',
        ],
        {
          cwd: root,
          env: { ...process.env, SETFARM_TEST_NODE: process.execPath },
          encoding: "utf8",
        },
      );
      assert.equal(failedPrebuild.status, 19, failedPrebuild.stderr);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), true);
      const failedReceipt = JSON.parse(readFileSync(prepareReceiptPath(root), "utf8"));
      assert.notEqual(failedReceipt.buildId, firstReceipt.buildId);

      assert.equal(runProducer(root, "--prepare").status, 0);
      const replacement = JSON.parse(readFileSync(prepareReceiptPath(root), "utf8"));
      assert.notEqual(replacement.buildId, failedReceipt.buildId);
      assert.equal(existsSync(manifestPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("withholds release authority for dirty or non-main override builds", () => {
    const dirtyRoot = createFixture();
    const branchRoot = createFixture();
    try {
      writeFileSync(join(dirtyRoot, "scripts", "stitch-to-jsx.mjs"), "// dirty converter\n");
      assert.equal(runProducer(dirtyRoot, "--prepare", { allowDirty: true }).status, 0);
      const dirtyFinalized = runProducer(dirtyRoot, "--finalize", { allowDirty: true });
      assert.equal(dirtyFinalized.status, 0, dirtyFinalized.stderr);
      assert.equal(existsSync(manifestPath(dirtyRoot)), false);
      assert.equal(existsSync(prepareReceiptPath(dirtyRoot)), false);
      const dirtyInfo = JSON.parse(
        readFileSync(join(dirtyRoot, "dist", "BUILD_INFO.json"), "utf8"),
      );
      assert.equal(dirtyInfo.dirty, true);

      git(branchRoot, ["checkout", "-b", "topic"]);
      assert.equal(runProducer(branchRoot, "--prepare", { allowDirty: true }).status, 0);
      const branchFinalized = runProducer(branchRoot, "--finalize", { allowDirty: true });
      assert.equal(branchFinalized.status, 0, branchFinalized.stderr);
      assert.equal(existsSync(manifestPath(branchRoot)), false);
      assert.equal(existsSync(prepareReceiptPath(branchRoot)), false);
      const branchInfo = JSON.parse(
        readFileSync(join(branchRoot, "dist", "BUILD_INFO.json"), "utf8"),
      );
      assert.equal(branchInfo.branch, "topic");
      assert.equal(branchInfo.dirty, false);
    } finally {
      rmSync(dirtyRoot, { recursive: true, force: true });
      rmSync(branchRoot, { recursive: true, force: true });
    }
  });

  it("rejects live converter bytes that differ from the committed release blob", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      git(root, ["update-index", "--assume-unchanged", "scripts/stitch-to-jsx.mjs"]);
      writeFileSync(join(root, "scripts", "stitch-to-jsx.mjs"), "// hidden live drift\n");
      assert.equal(git(root, ["status", "--porcelain"]), "");

      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /do not match the committed release blob/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a worktree change during finalize source capture", () => {
    const root = createFixture();
    const wrapperDir = mkdtempSync(join(tmpdir(), "setfarm-git-wrapper-"));
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      const wrapperPath = join(wrapperDir, "git");
      const countPath = join(wrapperDir, "count");
      writeFileSync(countPath, "0\n");
      writeFileSync(wrapperPath, [
        "#!/bin/sh",
        'count="$(cat "$GIT_WRAPPER_COUNT")"',
        'count="$((count + 1))"',
        'printf "%s\\n" "$count" > "$GIT_WRAPPER_COUNT"',
        'if [ "$count" -eq 5 ]; then',
        '  printf "// concurrent drift\\n" > "$GIT_WRAPPER_MUTATE"',
        "fi",
        'exec "$GIT_WRAPPER_REAL" "$@"',
        "",
      ].join("\n"));
      chmodSync(wrapperPath, 0o755);
      const realGit = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();
      const finalized = runProducer(root, "--finalize", {
        env: {
          PATH: `${wrapperDir}:${process.env.PATH}`,
          GIT_WRAPPER_COUNT: countPath,
          GIT_WRAPPER_MUTATE: join(root, "scripts", "stitch-to-jsx.mjs"),
          GIT_WRAPPER_REAL: realGit,
        },
      });
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /Git state changed while release source was being captured/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);
    } finally {
      rmSync(wrapperDir, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an empty committed converter and ambiguous direct invocation", () => {
    const root = createFixture({ converterText: "" });
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /must not be empty/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);

      const ambiguous = runProducer(root, undefined);
      assert.notEqual(ambiguous.status, 0);
      assert.match(ambiguous.stderr, /exactly one explicit phase is required/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a tampered prepare receipt and removes all release authority", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      const receipt = JSON.parse(readFileSync(prepareReceiptPath(root), "utf8"));
      writeFileSync(
        prepareReceiptPath(root),
        `${JSON.stringify({ ...receipt, extra: true }, null, 2)}\n`,
      );

      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /unknown or missing fields/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a clean HEAD switch between prepare and finalize", () => {
    const root = createFixture();
    try {
      assert.equal(runProducer(root, "--prepare").status, 0);
      const preparedSha = git(root, ["rev-parse", "HEAD"]);
      writeFileSync(join(root, "HEAD_SWITCH.txt"), "next release\n");
      git(root, ["add", "HEAD_SWITCH.txt"]);
      git(root, ["commit", "-m", "switch release head"]);
      assert.equal(git(root, ["status", "--porcelain"]), "");
      assert.notEqual(git(root, ["rev-parse", "HEAD"]), preparedSha);

      const finalized = runProducer(root, "--finalize");
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /does not match the exact build prepare receipt/);
      assert.equal(existsSync(manifestPath(root)), false);
      assert.equal(existsSync(prepareReceiptPath(root)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinked dist and scripts parents without writing through them", () => {
    const distRoot = createFixture();
    const scriptsRoot = createFixture();
    const outsideDist = mkdtempSync(join(tmpdir(), "setfarm-outside-dist-"));
    const outsideScriptsHome = mkdtempSync(join(tmpdir(), "setfarm-outside-scripts-"));
    const outsideScripts = join(outsideScriptsHome, "scripts-real");
    try {
      symlinkSync(outsideDist, join(distRoot, "dist"));
      const distPrepared = runProducer(distRoot, "--prepare");
      assert.notEqual(distPrepared.status, 0);
      assert.match(distPrepared.stderr, /Platform dist parent must be one real directory/);
      assert.deepEqual(readdirSync(outsideDist), []);

      renameSync(join(scriptsRoot, "scripts"), outsideScripts);
      symlinkSync(outsideScripts, join(scriptsRoot, "scripts"));
      const scriptsPrepared = runProducer(scriptsRoot, "--prepare");
      assert.notEqual(scriptsPrepared.status, 0);
      assert.match(scriptsPrepared.stderr, /Platform scripts parent must be one real directory/);
      assert.equal(existsSync(join(scriptsRoot, "dist")), false);
    } finally {
      rmSync(distRoot, { recursive: true, force: true });
      rmSync(scriptsRoot, { recursive: true, force: true });
      rmSync(outsideDist, { recursive: true, force: true });
      rmSync(outsideScriptsHome, { recursive: true, force: true });
    }
  });
});
