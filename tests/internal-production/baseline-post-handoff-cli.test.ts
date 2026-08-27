import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-cli.ts");
const tsxLoader = import.meta.resolve("tsx");

test("P4 current-entry CLI exposes only fixed zero-input verbs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "setfarm-p4-current-entry-cli-"));
  try {
    const internal = path.join(root, "src/internal-production");
    const callLog = path.join(root, "observer-calls.log");
    mkdirSync(internal, { recursive: true });
    writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n');
    writeFileSync(path.join(internal, "baseline-post-handoff-cli.ts"), readFileSync(sourcePath));
    writeFileSync(path.join(internal, "product-build-authority-v2-delivery-evidence-v1.ts"), `
import {appendFileSync} from "node:fs";
if(process.env.CLI_FIXTURE_FORBID_PBA_IMPORT==="1")throw new Error("PBA_IMPORT_FORBIDDEN");
const record=()=>appendFileSync(process.env.CLI_FIXTURE_CALL_LOG,"pba\\n");
export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return Object.freeze({
  ...(record(),process.env.CLI_FIXTURE_FAILURE==="pba"?(()=>{throw new Error("PBA_FAILED")})():{}),
  schema:"setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
  observationTransport:"source-cli",
  response:Object.freeze({schema:"mission-control.product-build-authority-v2-delivery-evidence-response.v1",currentStatus:"current",deliveryEvidenceRef:"mission-control://fixture/delivery",deliveryEvidenceHash:"${"e".repeat(64)}",evidence:Object.freeze({fixture:true})})
})}
`);
    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), `
import {appendFileSync} from "node:fs";
if(process.env.CLI_FIXTURE_FORBID_CONTROLLER_IMPORT==="1")throw new Error("CONTROLLER_IMPORT_FORBIDDEN");
const record=(kind)=>{appendFileSync(process.env.CLI_FIXTURE_CALL_LOG,kind+"\\n");if(process.env.CLI_FIXTURE_FAILURE===kind)throw new Error(kind+"_FAILED")};
const pair=(kind)=>Object.freeze({kind,ref:"setfarm://fixture/"+kind,hash:"${"a".repeat(64)}"});
export async function prepareInternalProductionCurrentEntryOperationV1(){return Object.freeze({operationRef:"setfarm://fixture/operation",operationHash:"${"b".repeat(64)}"})}
export async function resumeInternalProductionCurrentEntryAuthorityV1(){return pair("resume")}
export async function observeInternalProductionCurrentEntryAuthorityStatusV1(){return pair("status")}
export async function verifyCurrentInternalProductionCurrentEntryV1(){return pair("verify")}
export async function prepareInternalProductionRecoverySourceBootstrapRunV1(){return Object.freeze({operationRef:"setfarm://fixture/source-operation",operationHash:"${"c".repeat(64)}"})}
export async function resumeActiveInternalProductionRecoverySourceBootstrapRunV1(){return Object.freeze({sourceRunRef:"setfarm://fixture/source-run",sourceRunHash:"${"d".repeat(64)}"})}
export async function observeInternalProductionRecoverySourceBootstrapStatusV1(){return pair("source-status")}
export async function observeCurrentInternalProductionAuthorityV3Migration31AuditV1(){record("v31-audit");return pair("v31-audit")}
export async function observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1(){record("pending-successor");return pair("pending-successor")}
export async function observeInternalProductionServiceCensusV1(){record("service-census");return pair("service-census")}
`);
    const cli = path.join(internal, "baseline-post-handoff-cli.ts");
    const run = (args: readonly string[], fixtureEnv: Readonly<Record<string, string>> = {}) => {
      writeFileSync(callLog, "");
      const result = spawnSync(process.execPath, ["--import", tsxLoader, cli, ...args], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          SETFARM_PG_URL: undefined,
          SETFARM_TEST_PG_ADMIN_URL: undefined,
          CLI_FIXTURE_CALL_LOG: callLog,
          ...fixtureEnv,
        },
      });
      return { result, calls: readFileSync(callLog, "utf8") };
    };
    for (const verb of [
      "prepare-current-entry", "resume-current-entry", "current-entry-status", "verify-current-entry",
      "prepare-recovery-source-bootstrap", "resume-recovery-source-bootstrap", "recovery-source-bootstrap-status",
      "observe-product-build-authority-v2-delivery-evidence", "audit-authority-v3-migration31",
      "inspect-pending-bootstrap-handoff-successor", "service-census",
    ] as const) {
      const fixtureEnv = verb === "observe-product-build-authority-v2-delivery-evidence"
        ? { CLI_FIXTURE_FORBID_CONTROLLER_IMPORT: "1" }
        : ["audit-authority-v3-migration31", "inspect-pending-bootstrap-handoff-successor", "service-census"].includes(verb)
          ? { CLI_FIXTURE_FORBID_PBA_IMPORT: "1" }
          : {};
      const { result, calls } = run([verb, "--json"], fixtureEnv);
      assert.equal(result.status, 0, `${verb}: ${result.stderr}`);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      if (verb === "observe-product-build-authority-v2-delivery-evidence") {
        assert.deepEqual(parsed, {
          schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
          currentStatus: "current",
          deliveryEvidenceRef: "mission-control://fixture/delivery",
          deliveryEvidenceHash: "e".repeat(64),
          evidence: { fixture: true },
          observationTransport: "source-cli",
        });
        assert.equal(calls, "pba\n");
      } else if (verb === "audit-authority-v3-migration31") {
        assert.deepEqual(parsed, { kind: "v31-audit", ref: "setfarm://fixture/v31-audit", hash: "a".repeat(64) });
        assert.equal(calls, "v31-audit\n");
      } else if (verb === "inspect-pending-bootstrap-handoff-successor") {
        assert.deepEqual(parsed, { kind: "pending-successor", ref: "setfarm://fixture/pending-successor", hash: "a".repeat(64) });
        assert.equal(calls, "pending-successor\n");
      } else if (verb === "service-census") {
        assert.deepEqual(parsed, { kind: "service-census", ref: "setfarm://fixture/service-census", hash: "a".repeat(64) });
        assert.equal(calls, "service-census\n");
      } else {
        assert.equal(calls, "");
      }
    }
    for (const args of [
      [], ["prepare-current-entry"], ["prepare-current-entry", "--json", "extra"], ["unknown", "--json"], ["prepare-current-entry", "--json", "--json"],
      ["observe-product-build-authority-v2-delivery-evidence"], ["audit-authority-v3-migration31", "--JSON"],
      ["inspect-pending-bootstrap-handoff-successor", "--json", "extra"], ["service-census", "--json", "--json"],
    ]) {
      const { result, calls } = run(args);
      assert.notEqual(result.status, 0, args.join(" "));
      assert.equal(result.stdout, "");
      assert.equal(calls, "");
    }
    for (const [verb, failure, expectedCall] of [
      ["observe-product-build-authority-v2-delivery-evidence", "pba", "pba\n"],
      ["service-census", "service-census", "service-census\n"],
    ] as const) {
      const { result, calls } = run([verb, "--json"], { CLI_FIXTURE_FAILURE: failure });
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "");
      assert.equal(calls, expectedCall);
    }
    writeFileSync(path.join(internal, "product-build-authority-v2-delivery-evidence-v1.ts"), "export const fixture=true;\n");
    const missingPba = run(["observe-product-build-authority-v2-delivery-evidence", "--json"]);
    assert.notEqual(missingPba.result.status, 0);
    assert.equal(missingPba.result.stdout, "");
    assert.equal(missingPba.calls, "");

    writeFileSync(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), "export const observeCurrentInternalProductionAuthorityV3Migration31AuditV1=null;\n");
    const nonfunctionAudit = run(["audit-authority-v3-migration31", "--json"]);
    assert.notEqual(nonfunctionAudit.result.status, 0);
    assert.equal(nonfunctionAudit.result.stdout, "");
    assert.equal(nonfunctionAudit.calls, "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
