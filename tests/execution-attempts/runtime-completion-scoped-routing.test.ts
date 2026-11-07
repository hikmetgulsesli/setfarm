import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import ts from "typescript";
import { RUN_STATUS, STORY_STATUS, isStepOutputContextKeyProtected } from "../../src/installer/constants.js";

// Execute the full existing bodies, not a copied routing predicate. Loading the
// operational module directly opens installation/SQL/Git boundaries; these
// ports are inert here, while the supervisor handler and its publication remain
// real. This component fixture cannot qualify DB roles or GitHub acceptance.
function declarations(file: string, names: string[]): string {
  const location = new URL(file, import.meta.url);
  const tree = ts.createSourceFile(location.pathname, readFileSync(location, "utf8"), ts.ScriptTarget.ESNext, true);
  return names.map(name => {
    const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.ok(node, `actual declaration ${name}`);
    return node.getText(tree).replace(/^export\s+/, "");
  }).join("\n");
}
const bodies = declarations("../../src/installer/step-ops.ts", [
  "resumeRuntimeCompletionEffects", "handleSuperviseEachCompletion", "handleVerifyEachCompletion",
  "parseLoopConfigSafe", "firstOutputWord", "parseStoryIdSet", "markStorySupervised",
  "clearVerifiedStoryFailureContext", "parseDeclaredScopeFiles",
]) + "\n" + declarations("../../src/installer/context-ops.ts", ["parseOutputKeyValues"]);
const compiled = ts.transpileModule(bodies, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function fixture(kind: "supervise" | "verify" | "implement" = "supervise", options: {
  missingVerifyStory?: boolean; crossedSubject?: boolean; refusal?: boolean;
} = {}) {
  const runId = "run-scoped-completion", storyDbId = "story-owned", storyId = "US-001";
  const loop = { id: "step-loop", loop_config: JSON.stringify({
    verifyEach: true, verifyStep: "verify", superviseEach: true, superviseStep: "supervise", mergeStrategy: "pr-each",
  }) };
  const step = { id: kind === "implement" ? loop.id : `step-${kind}`, run_id: runId,
    step_id: kind, step_index: kind === "implement" ? 5 : kind === "verify" ? 6 : 7,
    type: kind === "implement" ? "loop" : "single", loop_config: kind === "implement" ? loop.loop_config : null,
    current_story_id: null, agent_id: `feature-dev_${kind}`, status: kind === "implement" ? "running" : "waiting" };
  const story = { id: storyDbId, story_id: storyId, title: "Owned story", status: "done",
    retry_count: 0, max_retries: 2, pr_url: "https://github.com/owned/fixture/pull/1", story_branch: "owned-us-001", scope_files: null };
  const subject = { kind: "story_member", storyDbId, storyId, storyClaimGeneration: 1 };
  const context: Record<string, string> = { supervised_story_ids: "", current_story_id: storyId };
  const publications: { query: string; values: unknown[] }[] = [];
  const state = { supervised: "", verifyPending: false, loopChecks: [] as string[], refused: false };
  const input = { protocol: "v3", claimId: 9, runtimeSessionId: "RTS_owned", runId, stepDbId: step.id,
    workflowStepId: kind, storyDbId, storyId,
    output: "STATUS: done\nSUPERVISOR_DECISION: pass",
    completionPlan: { continuation: { type: kind === "supervise" ? "supervise_each_decision"
      : kind === "verify" ? "verify_each_decision" : "story_loop_continue" },
    subject: { storyDbId, storyId }, effects: [] } };
  const ports = {
    RUN_STATUS, STORY_STATUS, isStepOutputContextKeyProtected,
    SUPERVISED_STORY_IDS_CONTEXT_KEY: "supervised_story_ids",
    logger: { info() {}, warn() {}, error() {} }, now: () => "2026-11-07T19:00:00.000Z",
    pgGet: async (query: string, values: unknown[]) => {
      if (query === "SELECT protocol FROM runs WHERE id = $1") return { protocol: "v3" };
      if (query === "SELECT status FROM runs WHERE id = $1") return { status: "running" };
      if (query.includes("SELECT id, run_id, step_id, step_index, type, loop_config")) {
        assert.deepEqual(values, [step.id, runId, kind]); return step;
      }
      if (query === "SELECT id, loop_config FROM steps WHERE run_id = $1 AND type = 'loop' LIMIT 1") return loop;
      if (query === "SELECT status FROM steps WHERE id = $1 AND run_id = $2") return { status: "waiting" };
      if (query.startsWith("SELECT story_id FROM stories WHERE id = $1")) return options.missingVerifyStory ? undefined : story;
      if (query.startsWith("SELECT id, story_id, title") || query.includes("FROM stories WHERE id = $1 AND run_id = $2 AND story_id = $3")) return story;
      throw Error("UNEXPECTED_READ:" + query);
    },
    pgRun: async (query: string, values: unknown[]) => {
      publications.push({ query, values });
      if (query.startsWith("UPDATE steps SET status = 'pending'")) {
        assert.deepEqual(values.slice(1), [runId, "verify"]); state.verifyPending = true;
      } else assert.ok(query.startsWith("UPDATE steps SET status = 'running'"));
      return { changes: 1 };
    },
    getRunContext: async () => context,
    updateRunContext: async (id: string, value: Record<string, string>) => {
      assert.equal(id, runId); state.supervised = value.supervised_story_ids;
    },
    authenticatedV3CompletionSubject: async () => options.crossedSubject ? { ...subject, storyId: "US-OTHER" } : subject,
    authenticatedV3SupervisorRetryProjection: async () => undefined,
    v3RefusalCompletionEffect: () => options.refusal ? { kind: "owned-refusal" } : undefined,
    settleV3RefusalRecoveryLineage: async () => { state.refused = true; },
    checkLoopContinuation: async (_run: string, id: string) => { state.loopChecks.push(id); return { advanced: false, runCompleted: false }; },
    authenticatedV3SupervisorStoryWorktree: async () => ({ workdir: "/owned-inert-worktree", storyBranch: story.story_branch }),
    revalidateAuthenticatedV3SupervisorStoryWorktree: async () => {}, assertExactGitBranchWorktree() {},
    findBlockingSupervisorEvidenceForStory: () => undefined,
    commitStoryWorktreeScopeIfNeeded: () => ({ committed: false }), pushStoryBranch: () => ({}),
    recordStepTransition: async () => {}, recordObservation: async () => {},
    refreshRunContractSafe: async () => {}, updateProjectMemory() {},
    markStorySupervisorStatePassedInWorkdir() {},
    upsertSupervisorRunMetadata() {}, markSupervisorInterventions() {},
    require: (name: string) => {
      if (name === "./product-supervisor.js") return { updateSupervisorMemory() {} };
      throw Error("UNEXPECTED_EXTERNAL_IMPORT:" + name);
    },
  };
  const resume = new Function(...Object.keys(ports), compiled + ";return resumeRuntimeCompletionEffects;")(...Object.values(ports));
  return { run: () => resume(input), state, publications };
}

// Mutation caught: scope IDs routing a persisted single supervisor to generic
// loop continuation instead of the existing real supervisor publication body.
it("single supervisor story scope publishes supervised marker and queues exact verify step", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { advanced: false, runCompleted: false });
  assert.equal(f.state.supervised, "US-001");
  assert.equal(f.state.verifyPending, true);
  assert.deepEqual(f.state.loopChecks, []);
});

it("single verify story scope reaches its existing exact target validation", async () => {
  const f = fixture("verify", { missingVerifyStory: true });
  await assert.rejects(f.run(), /VERIFY_EFFECT_BOUND_STORY_MISSING/);
  assert.deepEqual(f.state.loopChecks, []);
  assert.deepEqual(f.publications, []);
});

it("persisted loop completion retains story continuation", async () => {
  const f = fixture("implement");
  assert.deepEqual(await f.run(), { advanced: false, runCompleted: false });
  assert.deepEqual(f.state.loopChecks, ["step-loop"]);
  assert.equal(f.state.supervised, "");
});

it("crossed authenticated story scope still refuses before publication", async () => {
  const f = fixture("supervise", { crossedSubject: true });
  await assert.rejects(f.run(), /V3_STORY_COMPLETION_EFFECT_SUBJECT_MISMATCH/);
  assert.deepEqual(f.publications, []);
  assert.deepEqual(f.state.loopChecks, []);
});

it("refusal lineage settles before scoped dispatch", async () => {
  const f = fixture("supervise", { refusal: true });
  assert.deepEqual(await f.run(), { advanced: false, runCompleted: false });
  assert.equal(f.state.refused, true);
  assert.deepEqual(f.publications, []);
  assert.deepEqual(f.state.loopChecks, []);
});
