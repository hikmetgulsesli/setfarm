import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const builder = join(sourceRoot, "scripts", "build-node-toolchain-provisioner-bundle-v2.mjs");

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function buildBundle(output) {
  return spawnSync(process.execPath, [builder, "--out-file", output], {
    cwd: sourceRoot,
    encoding: "utf8",
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
    },
  });
}

describe("Node toolchain provisioner bootstrap bundle", () => {
  it("builds deterministic self-contained bytes and emits canonical bootstrap failure", () => {
    const firstRootAlias = mkdtempSync(join(tmpdir(), "setfarm-provisioner-bundle-a-"));
    const secondRootAlias = mkdtempSync(join(tmpdir(), "setfarm-provisioner-bundle-b-"));
    const firstRoot = realpathSync(firstRootAlias);
    const secondRoot = realpathSync(secondRootAlias);
    try {
      chmodSync(firstRoot, 0o700);
      chmodSync(secondRoot, 0o700);
      const firstPath = join(firstRoot, "provisioner.cjs");
      const secondPath = join(secondRoot, "provisioner.cjs");
      const firstBuild = buildBundle(firstPath);
      const secondBuild = buildBundle(secondPath);
      assert.equal(firstBuild.status, 0, firstBuild.stderr);
      assert.equal(secondBuild.status, 0, secondBuild.stderr);
      assert.equal(firstBuild.stdout.endsWith("\n"), false);

      const firstBytes = readFileSync(firstPath);
      const secondBytes = readFileSync(secondPath);
      const receipt = JSON.parse(firstBuild.stdout);
      assert.deepEqual(firstBytes, secondBytes);
      assert.equal(receipt.schema, "setfarm.node-toolchain-provisioner-bundle-build-receipt.v2");
      assert.equal(receipt.bundler.version, "0.28.1");
      assert.equal(receipt.bundle.byteLength, firstBytes.byteLength);
      assert.equal(receipt.bundle.sha256, sha256(firstBytes));
      assert.ok(receipt.externalNodeBuiltins.length > 0);
      assert.ok(receipt.externalNodeBuiltins.every((entry) => entry.startsWith("node:")));
      assert.equal(statSync(firstPath).mode & 0o7777, 0o600);
      assert.doesNotMatch(firstBytes.toString("utf8"), /require\(["'](?:zod|tsx|esbuild)["']\)/);

      const rerun = buildBundle(firstPath);
      assert.equal(rerun.status, 1);
      assert.equal(sha256(readFileSync(firstPath)), receipt.bundle.sha256);

      const invoked = spawnSync(process.execPath, [firstPath, "inspect"], {
        cwd: firstRoot,
        encoding: "utf8",
        env: {
          HOME: "/hostile-home",
          LANG: "tr_TR.UTF-8",
          NODE_PATH: "/hostile-node-path",
          PATH: "/hostile-path",
        },
      });
      assert.equal(invoked.status, 70, invoked.stderr);
      assert.equal(invoked.stdout.endsWith("\n"), false);
      const failure = JSON.parse(invoked.stdout);
      assert.equal(failure.schema, "setfarm.node-toolchain-provisioner-bootstrap-failure.v2");
      assert.match(failure.failureCode, /^NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_/);
      const { failureHash, ...identity } = failure;
      assert.equal(
        failureHash,
        sha256(Buffer.from(canonicalJson({
          schema: "setfarm.node-toolchain-provisioner-bootstrap-failure-hash.v2",
          failure: identity,
        }))),
      );
    } finally {
      rmSync(firstRootAlias, { recursive: true, force: true });
      rmSync(secondRootAlias, { recursive: true, force: true });
    }
  });
});
