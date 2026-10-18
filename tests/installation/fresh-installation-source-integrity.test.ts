import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

// Fresh behavior is bound to its actual source identity, not to rewritten
// historical migration checksums. No fixture is represented as a built release.
test("fresh operative genesis and current-origin checks are bound by actual source capture", async () => {
  const fixture = await freshSourceCheckoutFixture();
  const file = path.join(fixture.root, "src/db/contract-spine-migrations.ts");
  const original = readFileSync(file, "utf8");
  const git = (args: string[]) => execFileSync("/usr/bin/git", ["-c", "core.fsmonitor=false", ...args], {
    cwd: fixture.root, encoding: "utf8", timeout: 5000, maxBuffer: 1024 * 1024,
  });
  git(["update-index", "--assume-unchanged", "src/db/contract-spine-migrations.ts"]);
  try { for (const statement of [
    "await verifyFreshApplicationOnConnectionV1(sql, current.migrationApplication, row.release_sha);",
    "await verifyFreshInstallationDatabaseIdentityV1(sql, application.origin);",
    "await verifyFreshInstallationGenesisApplicationV1(transaction);",
  ]) {
    assert.equal(original.split(statement).length, 2, "mutation must remove exactly one operative check");
    writeFileSync(file, original.replace(statement, "/* removed by source-integrity regression */"));
    assert.equal(git(["status", "--porcelain=v1"]), "", "Git status alone must not detect this mutation");
    try { await assert.rejects(fixture.capture.captureFreshInstallationSourceShaV1(), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/); }
    finally { writeFileSync(file, original); }
    assert.equal(await fixture.capture.captureFreshInstallationSourceShaV1(), fixture.sha);
  } } finally {
    writeFileSync(file, original);
    git(["update-index", "--no-assume-unchanged", "src/db/contract-spine-migrations.ts"]);
  }
});
