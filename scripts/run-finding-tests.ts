#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TEST_ROOT = path.join(ROOT, "tests/findings");
const TEST_PREFIX = "tests/findings/";

const OWNER_BACKED_TESTS = new Set([
  "migration-recovery-compatibility.test.ts",
  "migration.test.ts",
  "recovery-delivery-repository.test.ts",
  "repository.test.ts",
  "v3-evidence-only-worker.test.ts",
  "v3-github-review-authorization.integration.test.ts",
  "v3-recovery-claim-authority.test.ts",
  "v3-recovery-coordinator.test.ts",
  "v3-recovery-lifecycle-reconciler.test.ts",
  "v3-recovery-work-router.test.ts",
]);

function run(args: string[]): void {
  const env = { ...process.env };
  delete env.SETFARM_PG_URL;
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`FINDING_TEST_SIGNAL:${result.signal}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const discovered = readdirSync(TEST_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
  .map((entry) => entry.name)
  .sort();
for (const file of OWNER_BACKED_TESTS) {
  if (!discovered.includes(file)) throw new Error(`FINDING_OWNER_TEST_MISSING:${file}`);
}
for (const file of discovered) {
  if (
    readFileSync(path.join(TEST_ROOT, file), "utf8").includes("createIsolatedTestDatabase")
    && !OWNER_BACKED_TESTS.has(file)
  ) throw new Error(`FINDING_OWNER_TEST_UNREGISTERED:${file}`);
}

const requested = process.argv.slice(2).map((locator) => {
  const normalized = locator.startsWith(TEST_PREFIX) ? locator.slice(TEST_PREFIX.length) : locator;
  if (!discovered.includes(normalized)) throw new Error(`FINDING_TEST_UNKNOWN:${locator}`);
  return normalized;
});
const selected = requested.length === 0 ? discovered : [...new Set(requested)].sort();
const pure = selected.filter((file) => !OWNER_BACKED_TESTS.has(file));
const ownerBacked = selected.filter((file) => OWNER_BACKED_TESTS.has(file));

if (pure.length > 0) {
  run(["--import", "tsx", "--test", ...pure.map((file) => `${TEST_PREFIX}${file}`)]);
}
for (const file of ownerBacked) {
  if (!process.env.SETFARM_TEST_PG_ADMIN_URL) {
    throw new Error("FINDING_OWNER_TEST_ADMIN_URL_REQUIRED");
  }
  run([
    "--import",
    "tsx",
    "scripts/run-isolated-postgres-tests.ts",
    "--",
    "node",
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    `${TEST_PREFIX}${file}`,
  ]);
}
