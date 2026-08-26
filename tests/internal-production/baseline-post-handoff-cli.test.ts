import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-cli.ts");
const tsxLoader = import.meta.resolve("tsx");

test("P4 current-entry CLI exposes only fixed zero-input verbs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "setfarm-p4-current-entry-cli-"));
  try {
    const internal = path.join(root, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n');
    writeFileSync(path.join(internal, "baseline-post-handoff-cli.ts"), readFileSync(sourcePath));
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
const pair=(kind)=>Object.freeze({kind,ref:"setfarm://fixture/"+kind,hash:"${"a".repeat(64)}"});
export async function prepareInternalProductionCurrentEntryOperationV1(){return Object.freeze({operationRef:"setfarm://fixture/operation",operationHash:"${"b".repeat(64)}"})}
export async function resumeInternalProductionCurrentEntryAuthorityV1(){return pair("resume")}
export async function observeInternalProductionCurrentEntryAuthorityStatusV1(){return pair("status")}
export async function verifyCurrentInternalProductionCurrentEntryV1(){return pair("verify")}
export async function prepareInternalProductionRecoverySourceBootstrapRunV1(){return Object.freeze({operationRef:"setfarm://fixture/source-operation",operationHash:"${"c".repeat(64)}"})}
export async function resumeActiveInternalProductionRecoverySourceBootstrapRunV1(){return Object.freeze({sourceRunRef:"setfarm://fixture/source-run",sourceRunHash:"${"d".repeat(64)}"})}
export async function observeInternalProductionRecoverySourceBootstrapStatusV1(){return pair("source-status")}
`);
    const cli = path.join(internal, "baseline-post-handoff-cli.ts");
    const run = (args: readonly string[]) => spawnSync(process.execPath, ["--import", tsxLoader, cli, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SETFARM_PG_URL: undefined, SETFARM_TEST_PG_ADMIN_URL: undefined },
    });
    for (const verb of [
      "prepare-current-entry", "resume-current-entry", "current-entry-status", "verify-current-entry",
      "prepare-recovery-source-bootstrap", "resume-recovery-source-bootstrap", "recovery-source-bootstrap-status",
    ] as const) {
      const result = run([verb, "--json"]);
      assert.equal(result.status, 0, `${verb}: ${result.stderr}`);
      assert.doesNotThrow(() => JSON.parse(result.stdout));
    }
    for (const args of [[], ["prepare-current-entry"], ["prepare-current-entry", "--json", "extra"], ["unknown", "--json"], ["prepare-current-entry", "--json", "--json"]]) {
      const result = run(args);
      assert.notEqual(result.status, 0, args.join(" "));
      assert.equal(result.stdout, "");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
