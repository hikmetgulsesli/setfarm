import assert from "node:assert/strict";
import { it } from "node:test";
import { createV3StageClaimHandoffV1 } from "../../src/execution/v3-stage-execution-context.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";

// Pure DATA projection only. v3-stage-execution-context and its transitive
// dependencies are schemas/canonical hashing/path helpers; they do not import
// selected installation, operational-retry profile, DB, credentials or worker.
// Implementation context schema imports selected profile eagerly, so it must
// remain out of this direct test's import graph.
let api: Record<string, unknown> | undefined;
try { api = await import("../../src/execution/subscription-coding-runtime-binding-v1.js"); }
catch (error) {
  const missing = error as { code?: string; url?: string };
  if (missing.code !== "ERR_MODULE_NOT_FOUND" || ![".js", ".ts"].some(ext => missing.url ===
    new URL("../../src/execution/subscription-coding-runtime-binding-v1" + ext, import.meta.url).href)) throw error;
}
function required(name: string): (input: unknown) => any {
  assert.equal(typeof api?.[name], "function", `${name} DATA projection is required`);
  return api![name] as (input: unknown) => any;
}
const sessionId = "RTS_00000000-0000-0000-0000-000000000901";
const ownerInstanceId = "real-host.local:43100:12345678-1234-4234-8234-123456789abc";
const profile = { schema: "setfarm.model-execution-profile.v1", providerId: "minimax",
  modelId: "minimax/MiniMax-M3.1-Flash", selection: "primary" };
function stage() {
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-04T12:00:00.000Z",
    runId: "run-stage-genuine-1", stepId: "step-stage-genuine-1", workflowStepId: "plan",
    claimId: 41, claimGeneration: 0, claimAgentId: "feature-dev_planner", runtimeAgentId: "planner",
    workdir: "/installation/runtime/agent-scratch", repo: "/installation/runtime/agent-scratch",
  };
  const authority = createV3StageClaimHandoffV1({ claimEnvelope: envelope,
    workflow: "feature-dev", role: "planner", workdir: envelope.workdir!,
    outputFile: "/tmp/legacy-plan-output.txt", instructionContent: "Prepare the typed ProductSpec proposal." });
  return { envelope, authority, runtimeSessionId: sessionId, ownerInstanceId,
    selectedProfile: profile, platformSourceSha: "a".repeat(40) };
}
it("derives disjoint journal worker transcript siblings without claiming filesystem admission", () => {
  const paths = required("deriveSubscriptionCodingRuntimePathsV1")({
    runtimeRoot: "/installation/runtime", runtimeSessionId: sessionId,
  });
  const container = `/installation/runtime/attempt-workspaces/subscription/${sessionId}`;
  assert.deepEqual(paths, { container, runtimePath: `${container}/owner`, root: `${container}/worker`,
    transcriptPath: `${container}/worker-output.log` });
});
for (const runtimeSessionId of ["../escape", "RTS_bad/path", "", "RTS_bad\\path"]) {
  it(`refuses session path escape ${JSON.stringify(runtimeSessionId)}`, () => {
    assert.throws(() => required("deriveSubscriptionCodingRuntimePathsV1")({
      runtimeRoot: "/installation/runtime", runtimeSessionId,
    }), /REFUSED|INVALID/);
  });
}
it("projects real stage claim without execution attempt and preserves hostname pid UUID owner", () => {
  const result = required("projectSubscriptionCodingRuntimeBindingV1")(stage());
  assert.deepEqual(result, { kind: "stage-claim", runtimeSessionId: sessionId, claimId: 41,
    ownerInstanceId, modelRef: "minimax/MiniMax-M3.1-Flash", sourceSha: "a".repeat(40),
    worktree: "/installation/runtime/agent-scratch" });
  assert.equal(Object.hasOwn(result, "generation"), false);
  assert.equal(Object.hasOwn(result, "fenceToken"), false);
});
it("projects selected PLATFORM source supplied by genuine facade without using product source", () => {
  const input = stage();
  // DATA projection cannot establish selected Source admission. Its contract is
  // to preserve the exact guarded selected origin passed by the real facade.
  const result = required("projectSubscriptionCodingRuntimeBindingV1")({ ...input, platformSourceSha: "f".repeat(40) });
  assert.equal(result.sourceSha, "f".repeat(40));
});
it("refuses crossed authentic stage envelope instead of rebuilding a caller tuple", () => {
  const input = stage();
  for (const envelope of [{ ...input.envelope, claimId: 42 }, { ...input.envelope, runId: "another-run" },
    { ...input.envelope, stepId: "another-step" }, { ...input.envelope, claimAgentId: "other-agent" },
    { ...input.envelope, workdir: "/other/worktree" }]) {
    assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...input, envelope }), /MISMATCH|REFUSED/);
  }
});
it("stage primary cannot be retargeted to fallback or crossed provider model", () => {
  const input = stage();
  for (const selectedProfile of [{ ...profile, providerId: "kimi", modelId: "kimi/k3.1-pro", selection: "fallback" },
    { ...profile, providerId: "codex", modelId: "codex/gpt-test" },
    { ...profile, providerId: "minimax", modelId: "kimi/k3.1-pro" }]) {
    assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...input, selectedProfile }), /MISMATCH|REFUSED/);
  }
});
it("published worker identity requires original pid start group and complete observed identity", () => {
  const processIdentity = { schema: "setfarm.process-identity.v1", pid: 43101,
    processStartedAt: "2026-11-04T12:00:00.000Z", processGroupId: 43000, source: "observed_os" };
  const published = { pid: 43101, processStartedAt: "2026-11-04T12:00:00.000Z",
    processGroupId: 43000, processIdentity };
  const check = required("assertSubscriptionRuntimePublishedWorkerV1");
  // This API takes two DATA arguments; it neither observes nor starts a process.
  const join = (session: unknown) => (api!.assertSubscriptionRuntimePublishedWorkerV1 as Function)(session, { processIdentity });
  assert.equal(typeof check, "function");
  assert.doesNotThrow(() => join(published));
  for (const crossed of [{}, { ...published, pid: undefined }, { ...published, pid: 43102 },
    { ...published, processStartedAt: "2026-11-04T12:00:01.000Z" }, { ...published, processGroupId: 43001 },
    { ...published, processIdentity: undefined },
    { ...published, processIdentity: { ...processIdentity, pid: 43102 } }]) {
    assert.throws(() => join(crossed), /REFUSED/);
  }
});

it("Kimi primary projects a genuine stage while both fallback models remain forbidden for stages", () => {
  const f = stage();
  const kimi = { ...profile, providerId: "kimi", modelId: "kimi/k3.1-pro" };
  assert.equal(required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, selectedProfile: kimi }).modelRef, "kimi/k3.1-pro");
  for (const selectedProfile of [kimi, profile].map(p => ({ ...p, selection: "fallback" })))
    assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, selectedProfile }), /REFUSED/);
  assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, selectedProfile: kimi,
    envelope: { ...f.envelope, claimId: f.envelope.claimId + 1 } }), /REFUSED/);
});

it("implementation DATA retains exact handoff joins for all four closed annual model selection pairs", async () => {
  const { hashCanonicalJson } = await import("../../src/product-compiler/canonical-json.js");
  for (const [providerId, modelId] of [["minimax", "minimax/MiniMax-M3.1-Flash"], ["kimi", "kimi/k3.1-pro"]])
    for (const selection of ["primary", "fallback"]) {
      const f = stage(), selectedProfile = { ...profile, providerId, modelId, selection };
      const envelope = { ...f.envelope, workflowStepId: "implement", storyId: "US-001", storyDbId: "story-db",
        attempt: { attemptId: "ATT_00000000-0000-0000-0000-000000000901", generation: 1, fenceToken: "f".repeat(64) } };
      const h = { runId: envelope.runId, stepId: envelope.stepId, workflowStepId: envelope.workflowStepId,
        storyId: envelope.storyId, storyDbId: envelope.storyDbId, claimId: envelope.claimId,
        attemptId: envelope.attempt.attemptId, attemptGeneration: 1, workdir: envelope.workdir, executionProfile: selectedProfile };
      const authority = { schema: "setfarm.implementation-context.v3", handoff: h, handoffHash: hashCanonicalJson(h) };
      assert.equal(required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, envelope, authority, selectedProfile }).modelRef, modelId);
      assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, envelope, authority,
        selectedProfile: { ...selectedProfile, selection: selection === "primary" ? "fallback" : "primary" } }), /REFUSED/);
      assert.throws(() => required("projectSubscriptionCodingRuntimeBindingV1")({ ...f, envelope, authority,
        selectedProfile: { ...selectedProfile, providerId: providerId === "kimi" ? "minimax" : "kimi" } }), /REFUSED/);
    }
});
