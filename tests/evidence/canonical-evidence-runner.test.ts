import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { CapturedRuntimeState, InteractionRequest, InteractionResult } from "../../src/installer/runtime-driver.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };

describe("canonical evidence runner", () => {
  function fixture(reloadedTitle = "Task from state", includeState = true, clockPrefix = "2026-07-13T00:00:") {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-canonical-evidence-"));
    const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
    const plan = compileEvidencePlanV1({ slice, sliceHash: "f".repeat(64) });
    const dom = path.join(workdir, ".setfarm", "runtime", "dom.json");
    fs.mkdirSync(path.dirname(dom), { recursive: true });
    fs.writeFileSync(dom, JSON.stringify({ rootHtml: '<button data-action-id="save-task-1">Save</button>' }));
    const capture = (at: string, title: string, url = "http://127.0.0.1:3000/editor"): CapturedRuntimeState => ({
      capturedAt: at,
      url,
      domSnapshotPath: dom,
      ...(includeState ? { stateBridge: { state: { title } } } : { stateBridge: null }),
    });
    const request = (id: string, action: InteractionRequest["action"]): InteractionRequest => ({ id, action, timeoutMs: 1_000 });
    const result = (id: string, action: InteractionResult["action"], start: string, end: string): InteractionResult => ({
      id,
      action,
      status: "pass",
      startedAt: start,
      completedAt: end,
    });
    const routed = capture(`${clockPrefix}02.000Z`, "Task from state");
    const afterAction = capture(`${clockPrefix}04.000Z`, "Task from state");
    const afterReload = capture(`${clockPrefix}06.000Z`, reloadedTitle);
    return {
      workdir,
      slice,
      plan,
      execution: {
        runtimeSessionId: "runtime-session-1",
        initialCapture: capture(`${clockPrefix}00.500Z`, "Task from state", "http://127.0.0.1:3000/"),
        commands: plan.commands.map((command, index) => ({
          commandRef: command.commandRef,
          exitCode: 0,
          stdout: `${command.commandRef} passed\n`,
          stderr: "",
          startedAt: `${clockPrefix}0${index}.000Z`,
          completedAt: `${clockPrefix}0${index}.250Z`,
        })),
        interactions: [
          {
            request: { ...request("route:ACT_SAVE_TASK", "navigate"), value: "__SETFARM_RUNTIME_URL__/editor" },
            result: result("route:ACT_SAVE_TASK", "navigate", `${clockPrefix}01.000Z`, `${clockPrefix}02.000Z`),
            before: capture(`${clockPrefix}00.500Z`, "Task from state", "http://127.0.0.1:3000/"),
            after: routed,
          },
          {
            request: { ...request("action:ACT_SAVE_TASK", "click"), target: '[data-action-id="save-task-1"]' },
            result: result("action:ACT_SAVE_TASK", "click", `${clockPrefix}03.000Z`, `${clockPrefix}04.000Z`),
            before: routed,
            after: afterAction,
          },
          {
            request: { ...request("reload:ACT_SAVE_TASK", "navigate"), value: "__SETFARM_RUNTIME_URL__/editor" },
            result: result("reload:ACT_SAVE_TASK", "navigate", `${clockPrefix}05.000Z`, `${clockPrefix}06.000Z`),
            before: afterAction,
            after: afterReload,
          },
        ],
      },
    };
  }

  function stageIdentity(workdir: string, storyId: string) {
    const envelope = { schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:"2026-11-04T12:00:00.000Z",
      runId:"run-supervise-stage-evidence",stepId:"step-supervise-stage-evidence",workflowStepId:"supervise",claimId:901,
      claimAgentId:"feature-dev_supervisor",runtimeAgentId:"supervisor",workdir,repo:workdir };
    return { workflowStepId:"supervise",claimId:901,runtimeSessionId:"RTS_00000000-0000-0000-0000-000000000901",
      requestId:"RCR_00000000-0000-0000-0000-000000000901",ownerAttemptCount:1,outputHash:"9".repeat(64),envelope,
      boundSubject:{kind:"story_member",storyDbId:"story-db-001",storyId,storyIndex:1,storyClaimGeneration:4},sourceBefore:SOURCE };
  }
  it("stage evidence binds fresh candidate to actual stage tuple without attributing it to a terminal attempt", () => {
    const value=fixture("Task from state",true,"2026-11-04T12:00:");
    try {
      const stageClaim=stageIdentity(value.workdir,value.slice.storyId);
      const currentSource={sha:"3".repeat(40),treeHash:"4".repeat(40)};
      const result=createCanonicalEvidenceBundleV2({runId:stageClaim.envelope.runId,storyId:value.slice.storyId,
        workdir:value.workdir,stageClaim,sourceRevision:currentSource,slice:value.slice,plan:value.plan,execution:value.execution,
        startedAt:"2026-11-04T12:00:00.000Z",completedAt:"2026-11-04T12:00:07.000Z"} as any);
      assert.equal(Object.hasOwn(result.bundle,"attemptId"),false);
      assert.equal(result.bundle.aggregateVerdict,"pass");
      assert.deepEqual(result.bundle.sourceRevision,currentSource);
      const artifact=result.bundle.artifacts.find(row=>row.locator.endsWith("STAGE_CLAIM_BINDING.json"));
      assert.ok(artifact,"bundle must hash the exact current stage binding artifact");
      const binding=JSON.parse(fs.readFileSync(path.join(value.workdir,artifact.locator),"utf8"));
      assert.equal(binding.claimId,901);assert.equal(binding.runtimeSessionId,stageClaim.runtimeSessionId);
      assert.equal(binding.requestId,stageClaim.requestId);assert.equal(binding.ownerAttemptCount,1);
      assert.deepEqual(binding.envelope,stageClaim.envelope);assert.equal(binding.outputHash,stageClaim.outputHash);
      assert.deepEqual(binding.boundSubject,stageClaim.boundSubject);
      assert.deepEqual(binding.sourceBefore,SOURCE);assert.deepEqual(binding.sourceAfter,currentSource);
      assert.equal(binding.sliceHash,value.plan.sliceHash);assert.equal(binding.planHash,value.plan.planHash);
      assert.ok(artifact.locator.includes("stage-claim-901"));
      assert.ok(artifact.locator.includes(stageClaim.runtimeSessionId));
    } finally {fs.rmSync(value.workdir,{recursive:true,force:true});}
  });
  it("stage evidence rejects mixed attempt ownership and crossed original envelope before artifacts",()=>{
    const value=fixture("Task from state",true,"2026-11-04T12:00:");try {
      const stageClaim=stageIdentity(value.workdir,value.slice.storyId);
      const common={runId:stageClaim.envelope.runId,storyId:value.slice.storyId,workdir:value.workdir,
        sourceRevision:SOURCE,slice:value.slice,plan:value.plan,execution:value.execution,
        startedAt:"2026-11-04T12:00:00.000Z",completedAt:"2026-11-04T12:00:07.000Z"};
      for(const change of [{stageClaim,attemptId:"ATT_terminal-historical-0001"},
        {stageClaim:{...stageClaim,envelope:{...stageClaim.envelope,claimId:902}}},
        {stageClaim:{...stageClaim,boundSubject:{...stageClaim.boundSubject,storyId:"US-999"}}}]){
        assert.throws(()=>createCanonicalEvidenceBundleV2({...common,...change} as any),/STAGE|MISMATCH|REFUSED|IDENTITY/);
      }
    } finally {fs.rmSync(value.workdir,{recursive:true,force:true});}
  });
  it("stage evidence refuses historical successful traces outside this completion generation",()=>{
    const value=fixture();try {
      const stageClaim=stageIdentity(value.workdir,value.slice.storyId);
      assert.throws(()=>createCanonicalEvidenceBundleV2({runId:stageClaim.envelope.runId,storyId:value.slice.storyId,
        workdir:value.workdir,stageClaim,sourceRevision:SOURCE,slice:value.slice,plan:value.plan,execution:value.execution,
        startedAt:"2026-11-04T12:00:00.000Z",completedAt:"2026-11-04T12:00:07.000Z"} as any),/STAGE|STALE|FRESH|TIME/);
    } finally {fs.rmSync(value.workdir,{recursive:true,force:true});}
  });
  it("new completion generation cannot silently reuse earlier stage evidence identity",()=>{
    const value=fixture("Task from state",true,"2026-11-04T12:00:");try {
      const stageClaim=stageIdentity(value.workdir,value.slice.storyId);
      const common={runId:stageClaim.envelope.runId,storyId:value.slice.storyId,workdir:value.workdir,
        sourceRevision:SOURCE,slice:value.slice,plan:value.plan,execution:value.execution,
        startedAt:"2026-11-04T12:00:00.000Z",completedAt:"2026-11-04T12:00:07.000Z"};
      const first=createCanonicalEvidenceBundleV2({...common,stageClaim} as any);
      const second=createCanonicalEvidenceBundleV2({...common,stageClaim:{...stageClaim,ownerAttemptCount:2}} as any);
      assert.notEqual(first.bundleHash,second.bundleHash);
      assert.equal(Object.hasOwn(second.bundle,"attemptId"),false);
    } finally {fs.rmSync(value.workdir,{recursive:true,force:true});}
  });

  it("binds a passing persistence round trip to the exact attempt candidate", () => {
    const value = fixture();
    try {
      const result = createCanonicalEvidenceBundleV2({
        runId: "run-canonical-1",
        storyId: value.slice.storyId,
        workdir: value.workdir,
        attemptId: "ATT_canonical-evidence-0001",
        sourceRevision: SOURCE,
        slice: value.slice,
        plan: value.plan,
        execution: value.execution,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      });
      assert.equal(result.bundle.aggregateVerdict, "pass");
      assert.deepEqual(result.bundle.sourceRevision, SOURCE);
      assert.equal(result.bundle.attemptId, "ATT_canonical-evidence-0001");
      assert.equal(result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_RELOAD")?.verdict, "pass");
      assert.ok(result.bundle.predicates.some((predicate) => predicate.predicateRef === "EVID_COMMAND_CMD_BUILD"));
      assert.ok(result.bundle.observations.some((observation) => observation.kind === "control"));
      assert.ok(result.bundle.observations.some((observation) => observation.kind === "runtime"));
      assert.ok(result.artifactPaths.some((file) => file.endsWith("EVIDENCE_BUNDLE.json")));
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });

  it("fails a reload mismatch and never promotes missing state instrumentation", () => {
    const mismatch = fixture("Different title");
    const missing = fixture("Task from state", false);
    try {
      const common = {
        runId: "run-canonical-2",
        storyId: mismatch.slice.storyId,
        attemptId: "ATT_canonical-evidence-0002",
        sourceRevision: SOURCE,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      };
      const failed = createCanonicalEvidenceBundleV2({
        ...common,
        workdir: mismatch.workdir,
        slice: mismatch.slice,
        plan: mismatch.plan,
        execution: mismatch.execution,
      });
      assert.equal(failed.bundle.aggregateVerdict, "fail");
      const inconclusive = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-evidence-0003",
        workdir: missing.workdir,
        slice: missing.slice,
        plan: missing.plan,
        execution: missing.execution,
      });
      assert.equal(inconclusive.bundle.aggregateVerdict, "inconclusive");
    } finally {
      fs.rmSync(mismatch.workdir, { recursive: true, force: true });
      fs.rmSync(missing.workdir, { recursive: true, force: true });
    }
  });

  it("evaluates produced passes metadata through exact action deltas instead of treating metadata as a boolean", () => {
    const value = fixture();
    try {
      const binding = value.slice.contract.bindings.find((candidate) => candidate.disposition === "action");
      assert.ok(binding && binding.disposition === "action");
      binding.inputBindings = [{
        inputField: "title",
        valueFrom: { kind: "literal", value: "Task after" },
      }];
      value.slice.contract.actions[0]!.evidenceScenario.targetInputValues = { title: "Task after" };
      const passesAssertion = {
        operator: "passes" as const,
        expected: {
          policyRef: "PERSIST_TASK_LOCAL",
          durability: "reload",
          operation: "write",
          statePaths: [{ stateRef: "STATE_EDITOR", path: "/title" }],
        },
      };
      value.slice.contract.evidencePredicates[0]!.assertion = passesAssertion;
      value.slice.requiredEvidence[0]!.assertion = passesAssertion;
      value.plan = compileEvidencePlanV1({ slice: value.slice, sliceHash: "f".repeat(64) });
      const exactState = (title: string, unrelated = false) => ({
        schema: "setfarm.runtime-state-bridge.v1",
        captureSchema: "setfarm.browser-state-capture.v1",
        globalName: "__SETFARM_TEST_BRIDGE__",
        states: { STATE_EDITOR: { title, ...(unrelated ? { unrelated: true } : {}) } },
        missingStateRefs: [],
      });
      const actionTrace = value.execution.interactions.find((trace) => trace.request.id === "action:ACT_SAVE_TASK")!;
      const reloadTrace = value.execution.interactions.find((trace) => trace.request.id === "reload:ACT_SAVE_TASK")!;
      actionTrace.before.stateBridge = exactState("Before");
      actionTrace.after.stateBridge = exactState("Task after");
      reloadTrace.before.stateBridge = exactState("Task after");
      reloadTrace.after.stateBridge = exactState("Task after");
      const common = {
        runId: "run-canonical-passes",
        storyId: value.slice.storyId,
        workdir: value.workdir,
        sourceRevision: SOURCE,
        slice: value.slice,
        plan: value.plan,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      };
      const passed = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-passes-0001",
        execution: value.execution,
      });
      assert.equal(
        passed.bundle.predicates.find((candidate) => candidate.predicateRef === "EVID_SAVE_RELOAD")?.verdict,
        "pass",
      );

      actionTrace.after.stateBridge = exactState("Before", true);
      reloadTrace.before.stateBridge = exactState("Before", true);
      reloadTrace.after.stateBridge = exactState("Before", true);
      const failed = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-passes-0002",
        execution: value.execution,
      });
      assert.equal(
        failed.bundle.predicates.find((candidate) => candidate.predicateRef === "EVID_SAVE_RELOAD")?.verdict,
        "fail",
        "an unrelated state mutation cannot satisfy the contracted title delta",
      );
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });
});
