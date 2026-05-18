import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

describe("install legacy runtime link", () => {
  it("backs up stale non-git legacy runtimes instead of leaving them active", () => {
    const install = readFileSync(join(root, "scripts", "install.sh"), "utf8");

    assert.match(install, /link_legacy_runtime\(\)/);
    assert.match(install, /Backing up stale legacy runtime/);
    assert.match(install, /mv "\$LEGACY_DEST" "\$backup"/);
    assert.match(install, /ln -s "\$DEST" "\$LEGACY_DEST"/);
    assert.doesNotMatch(install, /already exists; leaving it unchanged/);
  });

  it("keeps an explicit escape hatch for separate git checkouts", () => {
    const install = readFileSync(join(root, "scripts", "install.sh"), "utf8");

    assert.match(install, /SETFARM_REPLACE_LEGACY/);
    assert.match(install, /separate git checkout/);
  });

  it("migrates runtime secrets out of legacy repo-local env files", () => {
    const install = readFileSync(join(root, "scripts", "install.sh"), "utf8");

    assert.match(install, /CONFIG_ENV="\$\{CONFIG_DIR\}\/\.env\.local"/);
    assert.match(install, /migrate_runtime_env\(\)/);
    assert.match(install, /migrate_runtime_env_from_backups/);
    assert.match(install, /STITCH_API_KEY/);
    assert.match(install, /chmod 600 "\$CONFIG_ENV"/);
  });
});
