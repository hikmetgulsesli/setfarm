import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const sourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-post-handoff-cli.ts");
const tsxLoader = import.meta.resolve("tsx");

function task6aStep1ShellV1(): string {
  const plan = readFileSync(path.resolve(import.meta.dirname, "../../docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md"), "utf8");
  const task = plan.indexOf("### Task 6A:");
  const step = plan.indexOf("**Step 1:", task);
  const fence = String.fromCharCode(96).repeat(3);
  const start = plan.indexOf(fence + "bash\n", step) + fence.length + 5;
  const end = plan.indexOf("\n" + fence, start);
  assert.ok(task >= 0 && step > task && end > start);
  return plan.slice(start, end);
}

function task6aStep1ResponsesV1(cold: boolean) {
  const hash = "a".repeat(64), sha = "b".repeat(40);
  const pair = (kind: string, refKey: string, hashKey: string) => ({ [refKey]: "setfarm://internal-production/" + kind + "/sha256/" + hash, [hashKey]: hash });
  const operation = pair("current-entry-operation", "operationRef", "operationHash");
  const pbaPair = { deliveryEvidenceRef: "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/" + hash, deliveryEvidenceHash: hash };
  const v31Pair = pair("authority-v3-migration31-audit", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash");
  const pendingPair = pair("pending-bootstrap-handoff-migration", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash");
  const service = (pid: number, port: number | null) => ({ pid, processStartTimeEpochMs: 1000, processIdentityHash: hash,
    serviceIdentityHash: hash, generationHash: hash, processOwnerCount: 1, loadedSourceSha: sha, loadedTreeHash: sha, loadedBuildHash: hash,
    ...(port === null ? { listener: null } : { listenerOwnerCount: 1, listener: { host: "127.0.0.1", port, listenerIdentityHash: hash } }),
  });
  const census = { schema: "setfarm.internal-production-service-census.v1", censusHash: hash,
    spawner: service(1001, null), dashboard: service(1002, 3333), missionControl: service(1003, 3080),
    openClaw: { ...service(1004, 18789), loadedSourceSha: null, loadedTreeHash: null, loadedBuildHash: null },
  };
  const preMutationPair = pair("pre-mutation-loaded-runtime-service-authority", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash");
  const preMutation = { schema: "setfarm.internal-production-pre-mutation-loaded-runtime-service-projection-set.v" + (cold ? "2" : "1"),
    currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, observedServiceCensusHash: hash,
    spawner: census.spawner, dashboard: census.dashboard, missionControl: census.missionControl, openClaw: census.openClaw,
    serviceProjectionSetHash: hash, ...preMutationPair,
    ...(cold ? { coldSpawnerPredecessor: { ...pair("cold-spawner-controller-settlement", "settlementRef", "settlementHash"),
      settlementIdentity: ["1", "2", String(process.getuid?.()), "20", String(0o100600), "1", "1024", "1", "1", "1"] } } : {}),
  };
  const status = { schema: "setfarm.internal-production-current-entry-authority-status.v1", state: "operation_prepared", ...operation,
    controllerSourceAuthority: { controllerSourceSha: sha, controllerTreeHash: sha, controllerBuildHash: hash },
    productBuildAuthorityV2DeliveryEvidence: pbaPair, authorityV3Migration31Audit: v31Pair, pendingBootstrapHandoffMigration: pendingPair,
    ...preMutationPair, preMutationLoadedRuntimeServiceAuthority: preMutation, preSchemaSpawnerRebindStatus: null,
    preSchemaSpawnerRebindStatusBody: null, migrationApplyingPhase: null, manifestActivation: null, spawnerAdmissionTransitionPhase: null,
    canaryRunningPhase: null, settledPhase: null, entryAuthority: null, blockedReason: null,
    ...pair("current-entry-authority-status", "statusRef", "statusHash"),
  };
  const controllerSource = { branch: "main", clean: true, sha, originMainSha: sha };
  return {
    "prepare-current-entry": operation, "current-entry-status": status, "service-census": census,
    "observe-product-build-authority-v2-delivery-evidence": { ...pbaPair, currentStatus: "current", observationTransport: "source-cli",
      evidence: { deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a", deliveredPathBlobs: Array(8).fill({}), vendorLock: { artifacts: Array(12).fill({}) }, focusedTests: { passed: true } } },
    "audit-authority-v3-migration31": { ...v31Pair, schema: "setfarm.internal-production-authority-v3-migration31-audit.v1", currentStatus: "current", controllerSource,
      pr86Delivery: { pullRequestNumber: 86, mergeSha: "1d691c89760339ea905dfe17f8e9188e62603c1c", mergeTreeHash: "04f1d95a58360d06e866fe816138655efa916284", expectedMergeBase: "1d691c89760339ea905dfe17f8e9188e62603c1c" },
      authorityV3ContractSpineThroughMigration31: { schema: "setfarm.authority-v3-contract-spine-through-migration-31-audit.v1", status: "verified", throughVersion: 31,
        migrations: Array.from({ length: 31 }, (_, index) => ({ version: index + 1, migrationClass: "automatic", state: "applied", name: "migration-" + (index + 1), checksum: hash })) },
      currentAuthorityAudit: { schema: "setfarm.contract-spine-current-authority-ledgers-audit.v2", status: "verified" }, currentAuthorityAuditHash: hash,
      migration31SemanticDigest: hash, migration31SourceManifestEntryHash: hash },
    "inspect-pending-bootstrap-handoff-successor": { ...pendingPair, schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1", currentStatus: "current", controllerSource,
      pendingSuccessor: { schema: "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1", status: "exact_pending_guarded_successor",
        migration: { version: 32, name: "contract-spine-bootstrap-main-claim-handoff-v1", migrationClass: "guarded", state: "pending", checksum: hash },
        orderedStatementsHash: hash, namedMigrationDigestEntryHash: hash, migrationDigest: hash, expectedSchemaProjectionHash: hash },
      migrationImplementation: { locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts", gitMode: "100644", gitBlobHash: sha } },
  };
}

for (const scenario of ["ordinary", "cold", "source-drift", "operation-drift", "later-phase", "cold-extra", "unknown-schema",
  "prerequisite-drift", "census-drift", "prepare-replay-drift", "status-replay-drift"] as const) {
  test("Task 6A documented preparation sequence: " + scenario, () => {
    const workspace = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-task6a-shell-")));
    try {
      const root = path.join(workspace, "setfarm"), bin = path.join(workspace, "bin"), elsewhere = path.join(workspace, "elsewhere");
      for (const directory of [root, bin, elsewhere]) mkdirSync(directory);
      const log = path.join(workspace, "calls.jsonl"), fixture = path.join(workspace, "responses.json");
      writeFileSync(log, "");
      writeFileSync(fixture, JSON.stringify(task6aStep1ResponsesV1(scenario.startsWith("cold"))));
      const gateFiles = ["tests/execution-attempts/operational-failure-cause-v3.test.ts", "tests/execution-attempts/operational-failure-cause-migration.test.ts",
        "tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts", "tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts",
        "tests/execution-attempts/v3-platform-preclaim-termination-race.integration.test.ts"];
      const adapter = [
        "#!" + process.execPath,
        "const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');",
        "const root=" + JSON.stringify(root) + ",log=" + JSON.stringify(log) + ",scenario=" + JSON.stringify(scenario) + ",sha=" + JSON.stringify("b".repeat(40)) + ";",
        "const tool=path.basename(process.argv[1]),args=process.argv.slice(2),calls=fs.readFileSync(log,'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);",
        "const record=verb=>fs.appendFileSync(log,JSON.stringify(verb)+'\\n');",
        "if(tool==='git'){",
        "assert.deepEqual(args.slice(0,2),['-C',root]);const command=args.slice(2).join(' ');",
        "const replies={'rev-parse --show-toplevel':root,'branch --show-current':'main','rev-parse HEAD':sha,'rev-parse refs/remotes/origin/main':sha,'status --porcelain=v1 --untracked-files=all':''};",
        "if(command==='merge-base --is-ancestor 1d691c89760339ea905dfe17f8e9188e62603c1c '+sha)process.exit(0);",
        "assert.ok(Object.hasOwn(replies,command),'unexpected git: '+command);process.stdout.write(replies[command]+'\\n');process.exit(0);}",
        "if(tool==='node'){",
        "assert.equal(process.cwd(),root);assert.deepEqual(args.slice(0,9),['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node','--import','tsx','--test','--test-concurrency=1']);",
        "assert.equal(args.length,10);assert.ok(" + JSON.stringify(gateFiles) + ".includes(args[9]));",
        "assert.equal(process.env.SETFARM_PG_URL,undefined);record('gate:'+args[9]);process.exit(0);}",
        "assert.equal(tool,'npm');assert.deepEqual(args.slice(0,3),['--prefix',root,'run']);",
        "if(args.length===4&&args[3]==='check:migration-digests'){record('digests');process.exit(0)}",
        "assert.deepEqual(args.slice(3,6),['--silent','acceptance:baseline-post-handoff','--']);assert.equal(args.length,8);assert.equal(args[7],'--json');",
        "const verb=args[6],data=JSON.parse(fs.readFileSync(" + JSON.stringify(fixture) + ",'utf8'));assert.ok(Object.hasOwn(data,verb),'forbidden verb: '+verb);",
        "if(verb!=='prepare-current-entry'&&!calls.includes('prepare-current-entry'))throw new Error('PREPARE_REQUIRED_BEFORE_PUBLIC_OBSERVATION');",
        "const prior=calls.filter(call=>call===verb).length;record(verb);const result=data[verb];",
        "if(scenario==='source-drift'&&verb==='current-entry-status')result.controllerSourceAuthority.controllerSourceSha='c'.repeat(40);",
        "if(scenario==='operation-drift'&&verb==='current-entry-status')result.operationHash='c'.repeat(64);",
        "if(scenario==='later-phase'&&verb==='current-entry-status')result.state='ready';",
        "if(scenario==='cold-extra'&&verb==='current-entry-status')result.preMutationLoadedRuntimeServiceAuthority.coldSpawnerPredecessor.extra=true;",
        "if(scenario==='unknown-schema'&&verb==='current-entry-status')result.preMutationLoadedRuntimeServiceAuthority.schema='setfarm.internal-production-pre-mutation-loaded-runtime-service-projection-set.v3';",
        "if(scenario==='prerequisite-drift'&&verb==='audit-authority-v3-migration31'){result.authorityV3Migration31AuditHash='c'.repeat(64);result.authorityV3Migration31AuditRef=result.authorityV3Migration31AuditRef.slice(0,-64)+'c'.repeat(64)}",
        "if(scenario==='census-drift'&&verb==='service-census')result.dashboard.pid++;",
        "if(scenario==='prepare-replay-drift'&&verb==='prepare-current-entry'&&prior>0)result.operationHash='c'.repeat(64);",
        "if(scenario==='status-replay-drift'&&verb==='current-entry-status'&&calls.filter(call=>call==='prepare-current-entry').length>1)result.statusHash='c'.repeat(64);",
        "process.stdout.write(JSON.stringify(result)+'\\n');",
      ].join("\n");
      for (const tool of ["git", "npm", "node"]) writeFileSync(path.join(bin, tool), adapter, { mode: 0o700 });
      const result = spawnSync("/bin/bash", ["-c", task6aStep1ShellV1()], { cwd: elsewhere, encoding: "utf8",
        env: { ...process.env, BASH_ENV: undefined, ENV: undefined, PATH: bin + ":/usr/bin:/bin", SETFARM_ROOT: root,
          SETFARM_ROOT_EXPECTED_SHA: "b".repeat(40), SETFARM_PG_URL: undefined, SETFARM_TEST_PG_ADMIN_URL: "postgresql://fixture.invalid/unused" },
      });
      const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as string);
      const verbs = calls.filter(call => call !== "digests" && !call.startsWith("gate:"));
      assert.deepEqual(calls.filter(call => call.startsWith("gate:")), gateFiles.map(file => "gate:" + file), result.stderr);
      assert.equal(verbs[0], "prepare-current-entry", result.stderr);
      if (scenario === "ordinary" || scenario === "cold") {
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(verbs, ["prepare-current-entry", "current-entry-status", "observe-product-build-authority-v2-delivery-evidence",
          "audit-authority-v3-migration31", "inspect-pending-bootstrap-handoff-successor", "service-census", "current-entry-status", "prepare-current-entry", "current-entry-status"]);
      } else {
        assert.notEqual(result.status, 0, scenario + " must stop the actual operator shell");
        if (scenario === "source-drift" || scenario === "operation-drift" || scenario === "later-phase") assert.deepEqual(verbs, ["prepare-current-entry", "current-entry-status"]);
        else if (scenario === "prerequisite-drift" || scenario === "census-drift" || scenario === "cold-extra" || scenario === "unknown-schema") {
          assert.equal(verbs.filter(verb => verb === "prepare-current-entry").length, 1);
          assert.equal(verbs.at(-1), "current-entry-status", "must reach full status comparison before refusing this isolated drift");
        }
        else assert.equal(verbs.filter(verb => verb === "prepare-current-entry").length, 2, "must reach the replay mismatch rather than an earlier unrelated refusal");
      }
    } finally { rmSync(workspace, { recursive: true, force: true }); }
  });
}

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
