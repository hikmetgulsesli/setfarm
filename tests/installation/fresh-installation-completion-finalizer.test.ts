import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import {
  currentRuntimeCompletionOwnerCapability,
  runWithRuntimeCompletionOwner,
} from "../../src/execution/runtime-completion-owner-context.js";

// Actual complete Source function bodies, genuine AsyncLocalStorage owner context,
// and explicitly synthetic selection/entry/repository DATA ports. No application
// module import, database, source/build qualification or operational authority.
const completionText = readFileSync(new URL("../../src/execution/runtime-completion.ts", import.meta.url), "utf8");
const spawnerText = readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");
function exactFunction(text: string, name: string): string {
  const tree = ts.createSourceFile("component.ts", text, ts.ScriptTarget.Latest, true);
  const matches = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, `exact genuine Source function ${name}`);
  return matches[0]!.getText(tree).replace(/^export\s+/, "");
}
function compile(text: string): string {
  return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None } }).outputText;
}
function replaceOnce(text: string, original: string, replacement: string): string {
  assert.equal(text.split(original).length - 1, 1, `one fixed import DATA seam: ${original}`);
  return text.replace(original, replacement);
}
const creatorName = "createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1";
const creatorSource = replaceOnce(exactFunction(completionText, creatorName),
  'await import("../internal-production/baseline-post-handoff-receipt-v1.js")', "await loadLegacy()");
const ownerWrapperSource = replaceOnce(exactFunction(spawnerText, "withRuntimeCompletionOwnerCapability"),
  'await import(\n    "./execution/runtime-completion-owner-context.js",\n  )', "await loadOwner()");
const dispatchSource = replaceOnce(exactFunction(spawnerText, "applyAndAcceptRuntimeCompletionEffects"),
  'await import("./execution/runtime-completion.js")', "await loadBootstrap()");
const request = Object.freeze({ requestId: "RCR_component-finalizer-0001", ownerInstanceId: "component-spawner",
  ownerAttemptCount: 3, leaseExpiresAt: "2099-01-01T00:00:00.000Z", claimId: 11, runId: "component-run",
  runtimeSessionId: "RTS_component-finalizer-0001", stepDbId: "component-step", workflowStepId: "plan",
  output: "component output", claimEnvelope: { protocol: "v3" }, storyId: null, storyDbId: null });
type Options = { selected?: boolean; selectionError?: Error; entryError?: Error; ledgerError?: Error;
  acceptError?: Error; legacyVerification?: object; request?: typeof request };
function component(options: Options = {}) {
  const events: string[] = [], accepted: any[] = [], emitted: any[] = [];
  const legacyImportError = new Error("LEGACY_IMPORT_SENTINEL_DATA");
  const selected = options.selected ?? true;
  const bindings: Record<string, unknown> = {
    currentRuntimeCompletionOwnerCapability,
    selectedFreshInstallationRootV1() {
      events.push("selection");
      if (options.selectionError) throw options.selectionError;
      return selected ? "/component/fresh-installation" : null;
    },
    assertFreshInstallationOperationalEntryV1() {
      events.push("entry");
      assert.equal(currentRuntimeCompletionOwnerCapability()?.requestId, request.requestId,
        "actual ALS owner must reach the fresh branch");
      if (options.entryError) throw options.entryError;
    },
    completionBootstrapFailV1(message: string): never { throw new Error(message); },
    async loadLegacy() { events.push("legacy-import"); throw legacyImportError; },
  };
  const creator = new Function(...Object.keys(bindings), compile(creatorSource) + `;return ${creatorName};`)
    (...Object.values(bindings)) as () => Promise<unknown | null>;
  const repository = {
    async markEffectsCommitted(input: any) { events.push("effects-committed"); assert.equal(input.requestId, request.requestId); },
    async acceptAndRelease(input: any) {
      events.push("accept");
      assert.deepEqual(currentRuntimeCompletionOwnerCapability(), {
        requestId: request.requestId, ownerInstanceId: request.ownerInstanceId,
        leaseExpiresAt: request.leaseExpiresAt, ownerAttemptCount: request.ownerAttemptCount,
      });
      if (options.acceptError) throw options.acceptError;
      accepted.push(input);
    },
  };
  const ports = {
    SPAWNER_INSTANCE_ID: "component-spawner",
    isRuntimeCompletionRecoveryOwnerInstanceIdV1: () => false,
    async loadOwner() { return { runWithRuntimeCompletionOwner }; },
    getSql: () => Object.freeze({ componentSqlData: true }),
    createRuntimeCompletionRepository: () => repository,
    createRuntimeCompletionEffectRepository: () => Object.freeze({ componentEffectsData: true }),
    withRuntimeCompletionHeartbeat: async (_request: unknown, action: () => Promise<unknown>) => action(),
    async runRuntimeCompletionEffectLedger(_input: unknown) {
      events.push("ledger");
      assert.equal(currentRuntimeCompletionOwnerCapability()?.requestId, request.requestId);
      if (options.ledgerError) throw options.ledgerError;
      return { componentEffectResult: true };
    },
    async loadBootstrap() {
      events.push("bootstrap-import");
      return {
        createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1:
          options.legacyVerification ? async function () {
            events.push("legacy-verify");
            assert.equal(currentRuntimeCompletionOwnerCapability()?.requestId, request.requestId);
            return options.legacyVerification;
          } : creator,
        async continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1(input: any) {
          events.push("legacy-continue");
          assert.equal(currentRuntimeCompletionOwnerCapability()?.requestId, request.requestId);
          assert.equal(input.verification, options.legacyVerification);
        },
      };
    },
    async cleanupQuiescedStoryWorktree() { events.push("story-cleanup"); },
    emitEvent(event: unknown) { events.push("event"); emitted.push(event); },
  };
  const dispatch = new Function(...Object.keys(ports), compile(ownerWrapperSource + "\n" + dispatchSource)
    + ";return applyAndAcceptRuntimeCompletionEffects;")(...Object.values(ports)) as (request: unknown) => Promise<void>;
  return { creator, dispatch: () => dispatch(options.request ?? request), events, accepted, emitted, legacyImportError };
}
function withOwner<T>(action: () => Promise<T>): Promise<T> {
  return runWithRuntimeCompletionOwner({ requestId: request.requestId, ownerInstanceId: request.ownerInstanceId,
    ownerAttemptCount: request.ownerAttemptCount, leaseExpiresAt: request.leaseExpiresAt }, action);
}

test("fresh creator requires actual owner context before reading selection or entry DATA", async () => {
  const c = component();
  await assert.rejects(c.creator(), { message: "OWNER_CONTEXT_REQUIRED" });
  assert.deepEqual(c.events, []);
});
test("fresh creator returns ordinary finalization only after current operational entry", async () => {
  const c = component();
  assert.equal(await withOwner(c.creator), null);
  assert.deepEqual(c.events, ["selection", "entry"]);
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("selection refusal is preserved before entry or legacy authority reads", async () => {
  const error = new Error("SELECTION_REFUSED_DATA"), c = component({ selectionError: error });
  await assert.rejects(withOwner(c.creator), candidate => candidate === error);
  assert.deepEqual(c.events, ["selection"]);
});
test("unprepared or drifted selected entry cannot produce the ordinary-null result", async () => {
  const error = new Error("ENTRY_REFUSED_DATA"), c = component({ entryError: error });
  await assert.rejects(withOwner(c.creator), candidate => candidate === error);
  assert.deepEqual(c.events, ["selection", "entry"]);
});
test("unselected creator retains strict original legacy authority path", async () => {
  const c = component({ selected: false });
  await assert.rejects(withOwner(c.creator), candidate => candidate === c.legacyImportError);
  assert.deepEqual(c.events, ["selection", "legacy-import"]);
});
test("actual finalizer Source carries owner through fresh verification and exact acceptance", async () => {
  const c = component();
  await c.dispatch();
  assert.deepEqual(c.events, ["ledger", "effects-committed", "bootstrap-import", "selection", "entry", "accept", "event"]);
  assert.deepEqual(c.accepted, [{ requestId: request.requestId, ownerInstanceId: request.ownerInstanceId,
    ownerAttemptCount: request.ownerAttemptCount, result: { componentEffectResult: true } }]);
  assert.equal(c.emitted.length, 1);
  assert.equal(c.emitted[0].event, "runtime.completion_accepted");
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("fresh entry failure after committed effects remains unaccepted and propagates", async () => {
  const error = new Error("ENTRY_REFUSED_DATA"), c = component({ entryError: error });
  await assert.rejects(c.dispatch(), candidate => candidate === error);
  assert.ok(c.events.includes("effects-committed"));
  assert.equal(c.events.includes("accept"), false);
  assert.equal(c.accepted.length + c.emitted.length, 0);
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("durable accept refusal never emits a completed event", async () => {
  const error = new Error("EXACT_OWNER_LEASE_OR_EFFECT_REFUSAL_DATA"), c = component({ acceptError: error });
  await assert.rejects(c.dispatch(), candidate => candidate === error);
  assert.ok(c.events.includes("accept"));
  assert.equal(c.accepted.length + c.emitted.length, 0);
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("legacy continuation retains its owner scope and returns before ordinary acceptance or cleanup", async () => {
  const c = component({ legacyVerification: Object.freeze({ componentOpaqueLegacyData: true }),
    request: { ...request, storyId: "component-story", storyDbId: "component-story-db" } as any });
  await c.dispatch();
  assert.deepEqual(c.events, ["ledger", "effects-committed", "bootstrap-import", "legacy-verify", "legacy-continue"]);
  assert.equal(c.accepted.length + c.emitted.length, 0);
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("failed effect ledger cannot mark effects, verify bootstrap or accept", async () => {
  const error = new Error("EFFECT_LEASE_REFUSED_DATA"), c = component({ ledgerError: error });
  await assert.rejects(c.dispatch(), candidate => candidate === error);
  assert.deepEqual(c.events, ["ledger"]);
  assert.equal(currentRuntimeCompletionOwnerCapability(), undefined);
});
test("foreign owner instance remains refused before any effect or finalization work", async () => {
  const c = component({ request: { ...request, ownerInstanceId: "foreign-instance" } });
  await assert.rejects(c.dispatch(), /RUNTIME_COMPLETION_OWNER_CAPABILITY_INCOMPLETE/);
  assert.deepEqual(c.events, []);
});
