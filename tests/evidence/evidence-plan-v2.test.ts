import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { compileEvidencePlanV2 } from "../../src/evidence/evidence-plan-v2.js";
import { compileActionInputTransportV2 } from "../../src/product-compiler/schemas/action-input-transport-v2.js";
import { buildContainedGameProductSpecV2 } from "../product-compiler/fixtures/product-semantics-v2.js";
import { WebPreviewRuntimeDriver } from "../../src/installer/web-runtime-driver.js";
import type { RuntimeSession } from "../../src/installer/runtime-driver.js";
import { runImplementEvidenceIfRequested } from "../../src/installer/implement-evidence-runner.js";
import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { nativeBrowserFixture, writeNativeBrowserRuntime, NATIVE_BROWSER_CANDIDATE } from "./native-packet-v3-evidence-fixture.js";

async function runNative(value: Awaited<ReturnType<typeof nativeBrowserFixture>>, suffix: string) {
  return runImplementEvidenceIfRequested({ runId: "run-native-browser-evidence", storyId: "US-001", workdir: value.workdir, stackPackId: "browser-game-canvas",
    v3: { slice: value.slice, sliceHash: value.sliceHash, sourceRevision: NATIVE_BROWSER_CANDIDATE, attemptId: `ATT_native-browser-evidence-${suffix}` } });
}

function nativeDiagnostic(result: Awaited<ReturnType<typeof runNative>>, workdir: string): string {
  const bundle = result.canonicalEvidence?.bundle;
  const traceRef = bundle?.artifacts.find(artifact => artifact.locator.endsWith("runtime-trace.json"));
  const trace = traceRef ? JSON.parse(fs.readFileSync(path.join(workdir, traceRef.locator), "utf8")) : undefined;
  return `${result.reason}\n${JSON.stringify({ predicates: bundle?.predicates.filter(predicate => predicate.verdict !== "pass"),
    flows: result.evidencePlan?.flows, runtimeError: trace?.runtimeError,
    captures: trace?.interactions.map((interaction: { request: unknown; result: unknown; before: { stateBridge: unknown }; after: { stateBridge: unknown; domSnapshotPath?: string } }) => ({
      request: interaction.request, result: interaction.result, before: interaction.before.stateBridge, after: interaction.after.stateBridge,
      dom: interaction.after.domSnapshotPath ? JSON.parse(fs.readFileSync(interaction.after.domSnapshotPath, "utf8")).elements : undefined,
    })) })}`;
}

function assertExactNativePredicates(value: Awaited<ReturnType<typeof nativeBrowserFixture>>, result: Awaited<ReturnType<typeof runNative>>) {
  const bundle = result.canonicalEvidence?.bundle;
  assert.ok(bundle);
  const expected = value.slice.contract.product.evidencePredicates.filter(predicate => predicate.required).map(predicate => predicate.id).sort();
  const actual = bundle.predicates.filter(predicate => !predicate.invariantRef.startsWith("INV_COMMAND_")).map(predicate => predicate.predicateRef).sort();
  assert.deepEqual(actual, expected);
  assert.equal(new Set(bundle.predicates.map(predicate => predicate.predicateRef)).size, bundle.predicates.length);
  return bundle;
}

describe("genuine native PacketV3 evidence plan", () => {
  it("compiles exact physical control slots and generated source bindings from a verified native designed slice", async () => {
    const value = await nativeBrowserFixture();
    try {
      const plan = compileEvidencePlanV2({ slice: value.slice, sliceHash: value.sliceHash });
      const mapped = value.slice.storySourceMap.screens[0]!;
      assert.equal(plan.schema, "setfarm.evidence-plan.v2");
      assert.equal(plan.sliceHash, value.sliceHash);
      assert.equal(plan.packetHash, value.slice.packetHash);
      assert.deepEqual(plan.predicateRefs, value.slice.contract.product.evidencePredicates.filter(predicate => predicate.required).map(predicate => predicate.id).sort());
      const flow = plan.flows.find(candidate => candidate.actionRef === "ACT_START_GAME");
      assert.ok(flow);
      assert.equal(flow.controlRef, mapped.controls[0]!.physicalControlRef);
      assert.equal(flow.controlSlotRef, mapped.controls[0]!.controlSlotRef);
      assert.deepEqual(flow.controlSource, mapped.controls[0]);
      assert.deepEqual(flow.observableSources, mapped.observables.filter(observable => observable.actionRef === "ACT_START_GAME"));
      assert.equal(flow.interactions.find(interaction => interaction.id === flow.actionInteractionId)?.target, mapped.controls[0]!.generatedSelector);
      assert.deepEqual(compileEvidencePlanV2({ slice: value.slice, sliceHash: value.sliceHash }), plan);
      assert.throws(() => compileEvidencePlanV2({ slice: value.slice, sliceHash: "0".repeat(64) }), /SLICE_HASH_MISMATCH/);
    } finally { value.cleanup(); }
  });

  it("executes exact native physical controls and typed state/outcome predicates in the real browser runner", async () => {
    const value = await nativeBrowserFixture();
    try {
      writeNativeBrowserRuntime(value);
      const result = await runNative(value, "baseline-001");
      assert.equal(result.ok, true, nativeDiagnostic(result, value.workdir));
      const bundle = assertExactNativePredicates(value, result);
      assert.equal(bundle.aggregateVerdict, "pass");
      assert.deepEqual(bundle.sourceRevision, NATIVE_BROWSER_CANDIDATE);
      assert.notDeepEqual(bundle.sourceRevision, value.slice.sourceRevision);
      assert.ok(bundle.observations.some(observation => observation.kind === "control"));
      const invocation = value.slice.contract.product.evidencePredicates.find(predicate => predicate.kind === "action_invocation" && predicate.subjectRef === "ACT_START_GAME")!;
      assert.equal(bundle.predicates.find(predicate => predicate.predicateRef === invocation.id)?.verdict, "pass");
      const traceRef = bundle.artifacts.find(artifact => artifact.locator.endsWith("runtime-trace.json"))!;
      const trace = JSON.parse(fs.readFileSync(path.join(value.workdir, traceRef.locator), "utf8"));
      const action = trace.interactions.find((interaction: { request: { id: string } }) => interaction.request.id === result.evidencePlan!.flows[0]!.actionInteractionId);
      assert.deepEqual(action.before.stateBridge.states.STATE_GAME_PHASE, { phase: "ready" });
      assert.deepEqual(action.after.stateBridge.states.STATE_GAME_PHASE, { phase: "playing" });
    } finally { value.cleanup(); }
  });

  for (const [label, options] of [
    ["empty input and after/reload non-native value", { input: "empty-string", persistence: true }],
    ["boolean checked input", { input: "boolean" }],
    ["prerequisite state and persisted reload", { prerequisite: true, persistence: true }],
  ]) {
    it(`executes native ${label} through genuine producer and browser evidence semantics`, async () => {
      const value = await nativeBrowserFixture(options);
      try {
        writeNativeBrowserRuntime(value);
        const result = await runNative(value, `variant-${String(label).replaceAll(/[^a-z]/g, "").slice(0, 30)}`);
        assert.equal(result.ok, true, nativeDiagnostic(result, value.workdir));
        assert.equal(result.canonicalEvidence?.bundle.aggregateVerdict, "pass");
        assertExactNativePredicates(value, result);
        const plan = result.evidencePlan;
        assert.ok(plan);
        if (options.input === "empty-string") {
          assert.ok(plan.flows.flatMap(flow => flow.interactions).some(interaction => interaction.action === "fill" && interaction.value === ""));
          assert.ok(plan.flows.some(flow => flow.reloadInteractionId));
        }
        if (options.input === "boolean") {
          assert.ok(value.slice.actionInputTransports.some(transport => transport.codecId === "boolean-checked.v2"));
          assert.ok(plan.flows.flatMap(flow => flow.interactions).some(interaction => interaction.action === "set_checked" && interaction.value === "true"));
        }
        if (options.prerequisite) {
          const target = plan.flows.find(flow => flow.actionRef === "ACT_START_GAME");
          assert.ok(target?.interactions.some(interaction => interaction.target === "ACT_PREPARE_GAME" && interaction.action === "invoke"));
        }
      } finally { value.cleanup(); }
    });
  }

  it("refuses altered native plans or malformed candidate source before publishing canonical artifacts", async () => {
    const value = await nativeBrowserFixture();
    try {
      const plan = compileEvidencePlanV2({ slice: value.slice, sliceHash: value.sliceHash });
      const common = { runId: "run-native-browser-fence", storyId: "US-001", workdir: value.workdir,
        attemptId: "ATT_native-browser-fence-0001", slice: value.slice, sourceRevision: NATIVE_BROWSER_CANDIDATE,
        startedAt: "2026-11-05T00:00:00.000Z", completedAt: "2026-11-05T00:00:01.000Z", execution: { commands: [], interactions: [] } };
      const altered = JSON.parse(JSON.stringify(plan));
      altered.predicateRefs.pop();
      altered.flows.forEach((flow: { predicateRefs: string[] }) => { flow.predicateRefs = flow.predicateRefs.filter(ref => altered.predicateRefs.includes(ref)); });
      const { planHash: _hash, ...identity } = altered; altered.planHash = hashCanonicalJson(identity);
      assert.throws(() => createCanonicalEvidenceBundleV2({ ...common, plan: altered }), /IDENTITY_MISMATCH|predicates|coverage/);
      assert.throws(() => createCanonicalEvidenceBundleV2({ ...common, plan, sourceRevision: { sha: "0", treeHash: "0" } }));
      assert.equal(fs.existsSync(path.join(value.workdir, ".setfarm/evidence-v2/US-001/ATT_native-browser-fence-0001")), false);
    } finally { value.cleanup(); }
  });

  it("fails native evidence for exact slot ambiguity surface value prerequisite or persistence defects", async () => {
    const value = await nativeBrowserFixture({ input: "empty-string", persistence: true, prerequisite: true });
    try {
      writeNativeBrowserRuntime(value);
      const baseline = await runNative(value, "defect-baseline-001");
      assert.equal(baseline.ok, true, nativeDiagnostic(baseline, value.workdir));
      for (const [label, faults] of [
        ["slot", { wrongSlot: true }], ["duplicate", { duplicateControl: true }], ["surface", { wrongSurface: true }],
        ["after-value", { wrongValue: true }], ["reload-value", { wrongReloadValue: true }],
        ["prerequisite", { skipPrerequisite: true }], ["persistence", { losePersistence: true }],
      ]) {
        writeNativeBrowserRuntime(value, faults);
        const result = await runNative(value, `failure-${label}-001`);
        assert.equal(result.ok, false, `${label} must not pass from a generic snapshot or app-state-only claim`);
        assert.ok(result.canonicalEvidence?.bundle.predicates.some(predicate => predicate.required && predicate.verdict !== "pass"), String(label));
        const traceRef = result.canonicalEvidence?.bundle.artifacts.find(artifact => artifact.locator.endsWith("runtime-trace.json"));
        assert.ok(traceRef);
        const trace = JSON.parse(fs.readFileSync(path.join(value.workdir, traceRef.locator), "utf8"));
        assert.equal(trace.runtimeError, null, nativeDiagnostic(result, value.workdir));
        assert.ok(trace.interactions.every((interaction: { result: { status: string } }) => interaction.result.status === "pass"), nativeDiagnostic(result, value.workdir));
        const primary = value.slice.contract.product.actions.find(action => action.id === "ACT_START_GAME")!;
        const valueEffect = primary.observableEffects.find(effect => effect.selector.kind === "accessibility" && effect.selector.name === "Game value")!;
        const expected = value.slice.contract.product.evidencePredicates.find(predicate =>
          label === "slot" || label === "duplicate" || label === "prerequisite"
            ? predicate.kind === "action_invocation" && predicate.subjectRef === primary.id
            : label === "persistence" ? predicate.kind === "persistence_round_trip" && primary.evidenceRefs.includes(predicate.id)
              : predicate.kind === "observable_outcome" && predicate.subjectRef === valueEffect.id)!;
        assert.ok(expected, `${label} must resolve to a genuine required native contract predicate`);
        const bundle = assertExactNativePredicates(value, result);
        const observed = bundle.predicates.find(predicate => predicate.predicateRef === expected.id)!;
        assert.equal(observed.actionRef, primary.id);
        assert.equal(observed.controlRef, value.slice.contract.design!.controls.find(control => control.identity.actionRef === primary.id)!.id);
        assert.notEqual(observed.verdict, "pass", `${label}:${nativeDiagnostic(result, value.workdir)}`);
      }
    } finally { value.cleanup(); }
  });

  it("evaluates every permitted native physical placement when only the second slot is defective", async () => {
    const value = await nativeBrowserFixture({ twoPlacements: true });
    try {
      const plan = compileEvidencePlanV2({ slice: value.slice, sliceHash: value.sliceHash });
      const controls = value.slice.contract.design!.controls;
      assert.equal(controls.length, 2);
      assert.equal(plan.flows.length, 2);
      assert.deepEqual(plan.flows.map(flow => flow.controlSlotRef).sort(), controls.map(control => control.identity.controlSlotRef).sort());
      writeNativeBrowserRuntime(value);
      const baseline = await runNative(value, "two-placement-baseline-001");
      assert.equal(baseline.ok, true, nativeDiagnostic(baseline, value.workdir));
      const positive = assertExactNativePredicates(value, baseline);
      writeNativeBrowserRuntime(value, { wrongSecondarySlot: true });
      const defective = await runNative(value, "two-placement-defect-001");
      const traceRef = defective.canonicalEvidence?.bundle.artifacts.find(artifact => artifact.locator.endsWith("runtime-trace.json"));
      assert.ok(traceRef);
      const trace = JSON.parse(fs.readFileSync(path.join(value.workdir, traceRef.locator), "utf8"));
      assert.equal(trace.runtimeError, null);
      assert.ok(trace.interactions.every((interaction: { result: { status: string } }) => interaction.result.status === "pass"));
      assert.equal(defective.ok, false, "a valid first physical slot cannot certify the defective second placement");
      const invocation = value.slice.contract.product.evidencePredicates.find(predicate => predicate.kind === "action_invocation" && predicate.subjectRef === "ACT_START_GAME")!;
      const failed = assertExactNativePredicates(value, defective);
      const predicate = failed.predicates.find(predicate => predicate.predicateRef === invocation.id)!;
      assert.notEqual(predicate.verdict, "pass");
      const secondarySource = value.slice.storySourceMap.screens[0]!.controls[1]!;
      assert.equal(predicate.controlRef, secondarySource.physicalControlRef, "second-placement failure must retain its actual physical identity");
      assert.notEqual(predicate.controlRef, value.slice.storySourceMap.screens[0]!.controls[0]!.physicalControlRef);
      for (const observation of failed.observations.filter(observation => observation.kind === "control")) {
        assert.ok(predicate.observationRefs.includes(observation.observationRef), "one exact contract predicate must bind all evaluated owned placements");
      }
      assert.deepEqual(positive.observations.filter(observation => observation.kind === "control").map(observation => observation.controlRef).sort(), controls.map(control => control.id).sort());
      assert.deepEqual(failed.observations.filter(observation => observation.kind === "control").map(observation => observation.controlRef).sort(), controls.map(control => control.id).sort());
    } finally { value.cleanup(); }
  });

  for (const phase of ["after", "reload"]) {
    it(`refuses the exact native control observable when the control relocates only ${phase}`, async () => {
      const value = await nativeBrowserFixture(phase === "reload" ? { persistence: true, controlReload: true } : {});
      try {
        const action = value.slice.contract.product.actions.find(action => action.id === "ACT_START_GAME")!;
        const effect = action.observableEffects.find(effect => effect.selector.kind === "control")!;
        assert.ok(effect.assertions.some(assertion => assertion.phase === phase && assertion.property === "visibility"));
        const source = value.slice.storySourceMap.screens[0]!.controls[0]!;
        writeNativeBrowserRuntime(value);
        const baseline = await runNative(value, `control-surface-${phase}-baseline`);
        assert.equal(baseline.ok, true, nativeDiagnostic(baseline, value.workdir));
        assert.equal(assertExactNativePredicates(value, baseline).predicates.find(predicate => predicate.predicateRef === effect.evidenceRef)?.verdict, "pass");
        writeNativeBrowserRuntime(value, phase === "reload" ? { relocateControlOnReload: true } : { relocateControlAfter: true });
        const relocated = await runNative(value, `control-surface-${phase}-relocated`);
        const bundle = assertExactNativePredicates(value, relocated);
        const traceRef = bundle.artifacts.find(artifact => artifact.locator.endsWith("runtime-trace.json"))!;
        const trace = JSON.parse(fs.readFileSync(path.join(value.workdir, traceRef.locator), "utf8"));
        assert.equal(trace.runtimeError, null);
        assert.ok(trace.interactions.every((interaction: { result: { status: string } }) => interaction.result.status === "pass"));
        const flow = relocated.evidencePlan!.flows.find(flow => flow.actionRef === action.id)!;
        const actionTrace = trace.interactions.find((interaction: { request: { id: string } }) => interaction.request.id === flow.actionInteractionId);
        const observedPhase = phase === "after" ? actionTrace.after
          : trace.interactions.find((interaction: { request: { id: string } }) => interaction.request.id === flow.reloadInteractionId).after;
        const beforeDom = JSON.parse(fs.readFileSync(actionTrace.before.domSnapshotPath, "utf8"));
        const afterDom = JSON.parse(fs.readFileSync(observedPhase.domSnapshotPath, "utf8"));
        assert.equal(beforeDom.elements.find((element: { actionId: string }) => element.actionId === source.generatedLocalId).containingSurfaceId, source.placement.surfaceRef);
        assert.equal(afterDom.elements.find((element: { actionId: string }) => element.actionId === source.generatedLocalId).containingSurfaceId, "SURF_RELOCATED_CONTROL");
        assert.deepEqual(actionTrace.after.stateBridge.states.STATE_GAME_PHASE, { phase: "playing" });
        const invocation = value.slice.contract.product.evidencePredicates.find(predicate => predicate.kind === "action_invocation" && predicate.subjectRef === action.id)!;
        assert.equal(bundle.predicates.find(predicate => predicate.predicateRef === invocation.id)?.verdict, "pass");
        const observed = bundle.predicates.find(predicate => predicate.predicateRef === effect.evidenceRef)!;
        assert.equal(observed.actionRef, action.id);
        assert.equal(observed.controlRef, source.physicalControlRef);
        assert.notEqual(observed.verdict, "pass", `${phase} relocation must fail the exact native control observable`);
        assert.equal(relocated.ok, false);
      } finally { value.cleanup(); }
    });
  }

  it("preserves a native control observable whose own after-enabled assertion is false", async () => {
    const value = await nativeBrowserFixture({ controlDisabledAfter: true });
    try {
      writeNativeBrowserRuntime(value);
      const result = await runNative(value, "control-disabled-after-valid");
      assert.equal(result.ok, true, nativeDiagnostic(result, value.workdir));
      const effect = value.slice.contract.product.actions[0]!.observableEffects.find(effect => effect.selector.kind === "control")!;
      assert.ok(effect.assertions.some(assertion => assertion.phase === "after" && assertion.property === "enabled" && assertion.expected === false));
      assert.equal(assertExactNativePredicates(value, result).predicates.find(predicate => predicate.predicateRef === effect.evidenceRef)?.verdict, "pass");
    } finally { value.cleanup(); }
  });
});

describe("native boolean transport through the existing browser primitive", () => {
  it("sets checked false/true idempotently from the genuine boolean codec without toggling", async () => {
    const productSpec = structuredClone(buildContainedGameProductSpecV2());
    const action = productSpec.actions[0]!;
    action.input.fields = [{ name: "enabled", valueType: "boolean", required: true }];
    action.evidenceScenario.targetInputValues = { enabled: true };
    action.stateDeltas[0]!.valueFrom = { kind: "input", field: "enabled" };
    const compiled = compileActionInputTransportV2({ productSpec, actionRef: action.id, fieldName: "enabled" });
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") throw Error("boolean codec fixture rejected");
    assert.equal(compiled.contract.codecId, "boolean-checked.v2");
    assert.deepEqual(compiled.contract.domRequirements, [{ tagName: "input", inputType: "checkbox", valueChannel: "checked", evidenceAction: "set_checked" }]);
    const requirement = compiled.contract.domRequirements[0]!;
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-checked-"));
    const html = `<main id="root"><input type="checkbox" data-action-id="checked-input" onchange="globalThis.changes++;document.querySelector('[data-observable-refs=OBS_CHECKED]').setAttribute('data-value',String(this.checked));document.querySelector('[data-observable-refs=OBS_CHANGES]').setAttribute('data-value',String(globalThis.changes))"><div data-observable-refs="OBS_CHECKED" data-value="false">Checked</div><div data-observable-refs="OBS_CHANGES" data-value="0">Changes</div></main><script>globalThis.changes=0</script>`;
    fs.writeFileSync(path.join(workdir, "server.cjs"), `require('node:http').createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(${JSON.stringify(html)})}).listen(Number(process.env.PORT),process.env.HOST);`);
    const driver = new WebPreviewRuntimeDriver({ exactCommand: { argv: [process.execPath, "server.cjs"], cwd: ".", env: { HOST: "{{HOST}}", PORT: "{{PORT}}" } } });
    let session: RuntimeSession | undefined;
    try {
      session = await driver.start({ runId: "run-native-checked", storyId: "US-001", workdir });
      await driver.waitReady(session);
      for (const [desired, expectedChanges] of [[false, 0], [true, 1], [true, 1], [false, 2], [false, 2]]) {
        const result = await driver.interact(session, { id: `checked-${desired}-${expectedChanges}`, action: requirement.evidenceAction,
          target: '[data-action-id="checked-input"]', value: String(desired), timeoutMs: 5_000 });
        assert.equal(result.status, "pass", result.detail);
        const capture = await driver.captureState(session);
        const observed = JSON.parse(fs.readFileSync(capture.domSnapshotPath!, "utf8"));
        assert.equal(observed.elements.find((element: { observableRefs: string[] }) => element.observableRefs.includes("OBS_CHECKED"))?.value, String(desired));
        assert.equal(observed.elements.find((element: { observableRefs: string[] }) => element.observableRefs.includes("OBS_CHANGES"))?.value, String(expectedChanges));
      }
      for (const value of [undefined, "", "TRUE", "1"]) {
        const result = await driver.interact(session, { id: "malformed-checked", action: requirement.evidenceAction, target: '[data-action-id="checked-input"]', value });
        assert.equal(result.status, "fail");
      }
    } finally {
      if (session) await driver.stop(session);
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });
});
