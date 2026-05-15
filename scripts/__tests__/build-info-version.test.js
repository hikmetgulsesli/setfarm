import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

describe("build info version stamping", () => {
  it("ties runtime display version to package semver plus git sha", () => {
    execFileSync("node", ["scripts/write-build-info.mjs"], {
      cwd: root,
      env: { ...process.env, SETFARM_ALLOW_DIRTY_BUILD: "1" },
    });

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const info = JSON.parse(readFileSync(join(root, "dist", "BUILD_INFO.json"), "utf8"));

    assert.equal(info.packageVersion, pkg.version);
    assert.match(info.shortSha, /^[0-9a-f]{8}$/i);
    assert.equal(info.displayVersion, `${pkg.version}+${info.shortSha}${info.dirty ? ".dirty" : ""}`);
  });
});
