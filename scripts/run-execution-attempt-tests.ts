#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TEST_ROOT = path.join(ROOT, "tests/execution-attempts");
const TEST_PREFIX = "tests/execution-attempts/";

const OWNER_BACKED_TESTS = new Set([
  "attempt-reconciler.test.ts",
  "claim-authority.test.ts",
  "claim-attempt-transition.test.ts",
  "claim-runtime-publication.test.ts",
  "claim-step-v3-recovery.integration.test.ts",
  "compiler-claim-fence.test.ts",
  "concurrency.test.ts",
  "migration-runtime-preservation.test.ts",
  "v3-pre-dispatch-failure.integration.test.ts",
  "v3-preparation-claim-authority.test.ts",
  "v3-setup-build-failure-cause.integration.test.ts",
  "v3-setup-build-untyped-build-failure.integration.test.ts",
  "v3-stage-input-unresolved.integration.test.ts",
]);

function run(args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`EXECUTION_ATTEMPT_TEST_SIGNAL:${result.signal}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const discovered = readdirSync(TEST_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
  .map((entry) => entry.name)
  .sort();
for (const file of OWNER_BACKED_TESTS) {
  if (!discovered.includes(file)) throw new Error(`EXECUTION_ATTEMPT_OWNER_TEST_MISSING:${file}`);
}

const requested = process.argv.slice(2).map((locator) => {
  const normalized = locator.startsWith(TEST_PREFIX) ? locator.slice(TEST_PREFIX.length) : locator;
  if (!discovered.includes(normalized)) throw new Error(`EXECUTION_ATTEMPT_TEST_UNKNOWN:${locator}`);
  return normalized;
});
const selected = requested.length === 0 ? discovered : [...new Set(requested)].sort();
const raw = selected.filter((file) => !OWNER_BACKED_TESTS.has(file));
const ownerBacked = selected.filter((file) => OWNER_BACKED_TESTS.has(file));

if (raw.length > 0) {
  const env = { ...process.env };
  delete env.SETFARM_PG_URL;
  run([
    "--import",
    "tsx",
    "--test",
    ...raw.map((file) => `${TEST_PREFIX}${file}`),
  ], env);
}

for (const file of ownerBacked) {
  const env = { ...process.env };
  delete env.SETFARM_PG_URL;
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
  ], env);
}
