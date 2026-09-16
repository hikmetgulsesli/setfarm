import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Exercise the actual refusal branch without importing modules whose selectors
// can publish durable activation evidence. This is not a physical barrier test.
const source = readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");

function compileRetainedGate(status) {
  const retained = execFileSync("/usr/bin/git", ["show", "eef9f6c4059daa487a5a367f8f1609b1d1e39142:src/spawner.ts"],
    { cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8", timeout: 5000, maxBuffer: 2097152 });
  const name = "enforceInternalProductionPreSchemaSpawnerStartupGateV1";
  const js = ts.transpileModule(extractFunction(retained, name), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const gate = new Function(`${js}\nreturn ${name};`)();
  return () => gate({ startupAdmission: {
    observeInternalProductionPreSchemaSpawnerRebindStatusV1: async () => {
      if (status instanceof Error) throw status;
      return status;
    },
  } });
}

function extractFunction(text, name) {
  const tree = ts.createSourceFile("spawner.ts", text, ts.ScriptTarget.Latest, true);
  const matches = tree.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `exactly one ${name}`);
  return matches[0].getText(tree);
}

function compileColdGate(cold, status, mutate = text => text) {
  const name = "observeOrdinarySpawnerColdRecoveryAdmissionV1";
  const original = extractFunction(source, name);
  const dependency = 'await import("./internal-production/baseline-spawner-startup-admission-v1.js")';
  assert.equal(original.split(dependency).length, 2, "replace only the external authority import");
  const isolated = mutate(original.replace(dependency, "startupPort"));
  const js = ts.transpileModule(isolated, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const startupPort = {
    observeInternalProductionPreSchemaSpawnerRebindStatusV1: async () => {
      if (status instanceof Error) throw status;
      return status;
    },
    resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1: async () => {
      throw Error("unexpected restart resolver");
    },
  };
  return new Function("observeInternalProductionColdSpawnerBootstrapJournalCensusV1", "startupPort",
    `${js}\nreturn ${name};`)(() => cold, startupPort);
}

const absentStatus = Object.freeze({
  state: "absent", currentEntryOperation: null, authorization: null,
  startupToken: null, restartAuthority: null, dispatchPrefix: null,
  sealedAdmission: null, admissionReady: null, refusalCode: null,
});

// A wrong default admission or a removed early refusal must fail these tests.
test("absent cold history alone does not establish maintenance refusal", async () => {
  assert.equal(await compileColdGate({ state: "absent" }, absentStatus)(), null);
});

test("settled cold history rejects absent pre-schema status", async () => {
  await assert.rejects(compileColdGate({ state: "settled", incompleteOwnerCount: 0 }, absentStatus),
    /COLD_BOOTSTRAP_NOT_ABSENT/);
});

test("unsettled cold history rejects ordinary admission", async () => {
  await assert.rejects(compileColdGate({ state: "unsettled", incompleteOwnerCount: 1 },
    Error("unexpected status observation before cold settlement")),
    /COLD_BOOTSTRAP_NOT_ABSENT/);
});

test("ready label without authority pairs does not authorize admission", async () => {
  await assert.rejects(compileColdGate({ state: "settled", incompleteOwnerCount: 0 },
    { ...absentStatus, state: "normal_task0_admission_ready" }), /COLD_BOOTSTRAP_NOT_ABSENT/);
});

test("qualification detects a fail-open absent-status mutation", async () => {
  const needle = 'if (status.state !== "normal_task0_admission_ready" || !status.currentEntryOperation || !status.restartAuthority || !status.admissionReady) throw Error("COLD_BOOTSTRAP_NOT_ABSENT");';
  const mutant = compileColdGate({ state: "settled", incompleteOwnerCount: 0 }, absentStatus, text => {
    assert.equal(text.split(needle).length, 2);
    return text.replace(needle, 'if (status.state === "absent") return null;');
  });
  await assert.rejects(async () => {
    await assert.rejects(mutant, /COLD_BOOTSTRAP_NOT_ABSENT/);
  }, { code: "ERR_ASSERTION", message: "Missing expected rejection." });
});

test("retained ordinary gate permits absent status and cannot supply maintenance refusal", async () => {
  assert.equal(await compileRetainedGate(absentStatus)(), "normal");
});

test("retained ordinary gate rejects a prepared status without invoking owner producers", async () => {
  await assert.rejects(compileRetainedGate({ ...absentStatus, state: "prepared" }),
    /INTERNAL_PRODUCTION_PRE_SCHEMA_SPAWNER_ADMISSION_BLOCKED/);
});

test("retained observer error is distinguishable from authenticated admission refusal", async () => {
  const error = Error("historical Git evidence unavailable");
  await assert.rejects(compileRetainedGate(error), value => value === error);
});
