import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const sourceRoot = path.resolve(import.meta.dirname, "../../src/internal-production");
const cliSource = path.join(sourceRoot, "baseline-task6a-current-entry-cli-v2.ts");
const controllerSource = path.join(sourceRoot, "baseline-task6a-current-entry-controller-v2.ts");
const tsxLoader = import.meta.resolve("tsx");

test("Task6A V2 source graph is a separate default-deny entry with no V1 effect import", () => {
  const cli = readFileSync(cliSource, "utf8");
  const controller = readFileSync(controllerSource, "utf8");
  assert.doesNotMatch(cli + controller, /baseline-post-handoff-(?:receipt-v1|cli)(?:\.[jt]s)?|resumeInternalProductionCurrentEntryAuthorityV1|prepareInternalProductionCurrentEntryOperationV1/);
  assert.doesNotMatch(controller, /process\.env|SETFARM_|cutoverAdmission|diagnosticHash|pgMigrate|launchctl/);
  assert.match(controller, /TASK6A_V2_ADMISSION_NOT_GRANTED/);
});

test("Task6A V2 prepare and resume refuse before poisoned V1 import or any sentinel effect", () => {
  const root = mkdtempSync(path.join(tmpdir(), "setfarm-task6a-v2-entry-"));
  try {
    const internal = path.join(root, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n');
    copyFileSync(cliSource, path.join(internal, path.basename(cliSource)));
    copyFileSync(controllerSource, path.join(internal, path.basename(controllerSource)));
    const sentinel = path.join(root, "sentinel.txt");
    writeFileSync(sentinel, "unchanged\n");
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(sentinel)}, "V1 imported\\n");
throw new Error("V1_IMPORT_FORBIDDEN");
`);
    writeFileSync(path.join(internal, "baseline-post-handoff-cli.ts"), `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(sentinel)}, "V1 CLI imported\\n");
throw new Error("V1_CLI_IMPORT_FORBIDDEN");
`);
    const cli = path.join(internal, path.basename(cliSource));
    const run = (args: readonly string[]) => spawnSync(process.execPath, ["--import", tsxLoader, cli, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, TASK6A_V2_ADMISSION: "granted", SETFARM_PG_URL: "postgresql://fixture.invalid/ignored" },
    });
    for (const verb of ["prepare-current-entry-v2", "resume-current-entry-v2"]) {
      const result = run([verb, "--json"]);
      assert.equal(result.status, 1, `${verb}: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "TASK6A_V2_ADMISSION_NOT_GRANTED\n");
      assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
    }
    for (const args of [[], ["prepare-current-entry-v2"], ["resume-current-entry-v2", "--json", "extra"], ["prepare-current-entry", "--json"], ["resume-current-entry-v2", "--help"]]) {
      const result = run(args);
      assert.equal(result.status, 1, `${args.join(" ")}: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "TASK6A_V2_CURRENT_ENTRY_CLI_USAGE_INVALID\n");
      assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
    }
    writeFileSync(path.join(internal, path.basename(controllerSource)), `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(sentinel)}, "V2 controller imported\\n");
throw new Error("V2_CONTROLLER_IMPORT_FORBIDDEN");
`);
    const invalidBeforeController = run(["prepare-current-entry-v2", "--help"]);
    assert.equal(invalidBeforeController.status, 1);
    assert.equal(invalidBeforeController.stderr, "TASK6A_V2_CURRENT_ENTRY_CLI_USAGE_INVALID\n");
    assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
