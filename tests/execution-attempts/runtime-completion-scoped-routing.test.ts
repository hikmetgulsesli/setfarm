import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import ts from "typescript";
import { RUN_STATUS, STORY_STATUS, isStepOutputContextKeyProtected, PR_REVIEW_DELAY_MS } from "../../src/installer/constants.js";

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
  "clearStoryFailureContext", "clearVerifiedStoryFailureContext", "parseDeclaredScopeFiles",
  "injectVerifyContext", "isStorySupervised",
]) + "\n" + declarations("../../src/installer/context-ops.ts", ["parseOutputKeyValues"]);
const compiled = ts.transpileModule(bodies, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

// Select the existing PR URL declaration and its complete production gate by
// AST, rather than copying its timer predicate or building the whole claim
// harness. Only the external GitHub read import is replaced by an inert port.
function actualReviewGateBody(): string {
  const location = new URL("../../src/installer/step-ops.ts", import.meta.url);
  const tree = ts.createSourceFile(location.pathname, readFileSync(location, "utf8"), ts.ScriptTarget.ESNext, true);
  const claim = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "claimSingleStep");
  assert.ok(claim && ts.isFunctionDeclaration(claim) && claim.body);
  const statements = claim.body.statements;
  const index = statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(
    declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "reviewPrUrl"));
  assert.ok(index >= 0 && ts.isIfStatement(statements[index + 1]));
  const body = [statements[index].getText(tree), statements[index + 1].getText(tree)].join("\n")
    .replaceAll('await import("./steps/07-verify/pr-comments.js")', "await githubReads");
  return ts.transpileModule(`async function reviewGate() { ${body}\nreturn { found: true }; }`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const compiledReviewGate = actualReviewGateBody();

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

// Mutation caught: pre-VERIFY cleanup erases the same PR's elapsed wait. Real
// context injection/cleanup execute; only external DB, Git worktree, evidence
// and display-format ports are inert. No new production helper is assumed RED.
function verifyDelayContextFixture() {
  const runId = "run-review-delay", pr = "https://github.com/owned/fixture/pull/1";
  const context: Record<string, string> = { supervised_story_ids: "US-001", repo: "/inert/repo",
    pr_url: pr, verify_pending_pr_url: pr, verify_pending_since: "2026-11-08T10:40:54.035Z",
    verify_feedback: "stale feedback", previous_failure: "stale failure", failure_category: "BUILD_FAILED",
    failure_suggestion: "stale suggestion", verify_infra_retry: "1", verify_visual_scope_deferred: "1" };
  const story = { id: "story-owned", run_id: runId, story_id: "US-001", story_index: 0,
    title: "Owned story", description: "Literal fixture", acceptance_criteria: "[]", status: "done",
    output: null, retry_count: 0, max_retries: 2, pr_url: pr, story_branch: "owned-us-001" };
  let persisted: Record<string, string> | undefined;
  const handoffs: { outcome: string; diagnostic: string }[] = [];
  const ports = {
    isStepOutputContextKeyProtected, SUPERVISED_STORY_IDS_CONTEXT_KEY: "supervised_story_ids",
    logger: { info() {}, warn() {}, error() {} }, now: () => "2026-11-08T10:46:54.035Z",
    findLoopStep: async () => ({ id: "step-loop", loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }) }),
    autoVerifyDoneStories: async () => story,
    ensureStoryAuditWorkdir: () => "/inert/story-worktree",
    routeBlockingSupervisorEvidenceToImplement: async () => false,
    parseAcceptanceCriteria: (raw: string) => JSON.parse(raw), formatStoryForTemplate: () => "US-001: literal story",
    resolveStoryScreens: async () => {},
    pgRun: async (query: string, values: unknown[]) => {
      assert.equal(query, "UPDATE runs SET context = $1, updated_at = $2 WHERE id = $3");
      assert.equal(values[2], runId); persisted = JSON.parse(values[0] as string); return { changes: 1 };
    },
    updateRunContext: async (_id: string, value: Record<string, string>) => { persisted = { ...value }; },
  };
  const actual = new Function(...Object.keys(ports), compiled
    + ";return { injectVerifyContext, clearVerifiedStoryFailureContext };")(...Object.values(ports));
  const fixedTime = Date.parse("2026-11-08T10:46:54.035Z");
  class FixedDate extends Date {
    constructor(value?: string | number) { super(value === undefined ? fixedTime : value); }
    static now() { return fixedTime; }
  }
  const gatePorts = { ...ports, context, PR_REVIEW_DELAY_MS, Date: FixedDate,
    step: { id: "step-verify", run_id: runId, step_id: "verify" }, runProtocol: { protocol: "v3" },
    singleStepClaimId: 16, agentId: "feature-dev_reviewer",
    routeExactV3GithubReviewBeforeVerifyAgent: async (input: { storyId: string; repositoryPath: string }) => {
      assert.equal(input.storyId, "US-001"); assert.equal(input.repositoryPath, "/inert/repo");
      return { blockAgent: false, result: { status: "clean", headSha: "a".repeat(40) } };
    },
    githubReads: { fetchPrState: async () => ({ comments: [], checksStatus: "passing", mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN", createdAt: "2026-11-08T10:00:00.000Z" }) },
    closeSingleStepHandoff: async (outcome: string, diagnostic: string) => { handoffs.push({ outcome, diagnostic }); },
    // Surface an unexpected fixture/setup error instead of laundering it into
    // the production retry branch or inventing an accepted review receipt.
    v3ReviewErrorCode: (error: unknown) => { throw error; },
    pgRun: async (query: string, values: unknown[]) => {
      assert.equal(query, "UPDATE steps SET status = 'pending' WHERE id = $1");
      assert.deepEqual(values, ["step-verify"]); return { changes: 1 };
    },
  };
  const reviewGate = new Function(...Object.keys(gatePorts), compiledReviewGate
    + ";return reviewGate;")(...Object.values(gatePorts));
  return { context, get persisted() { return persisted; },
    inject: () => actual.injectVerifyContext({ id: "step-verify", run_id: runId, step_id: "verify", retry_count: 0 }, context, {}, "feature-dev_reviewer"),
    setStoryPr: (url: string) => { story.pr_url = url; }, reviewGate, handoffs,
    completeClear: () => actual.clearVerifiedStoryFailureContext(context) };
}

it("verify pre-claim preserves the original same-PR delay timestamp while clearing stale failures", async () => {
  const f = verifyDelayContextFixture();
  assert.equal(await f.inject(), true);
  assert.equal(f.context.verify_pending_since, "2026-11-08T10:40:54.035Z");
  assert.equal(f.context.verify_pending_pr_url, "https://github.com/owned/fixture/pull/1");
  assert.equal(f.persisted?.verify_pending_since, "2026-11-08T10:40:54.035Z");
  for (const key of ["verify_feedback", "previous_failure", "failure_category", "failure_suggestion", "verify_infra_retry", "verify_visual_scope_deferred"]) {
    assert.equal(f.context[key], undefined, key);
  }
  assert.equal(f.context.supervised_story_ids, "US-001");
});

it("successful verified-story cleanup still removes the review markers and stale failure context", () => {
  const f = verifyDelayContextFixture();
  f.completeClear();
  for (const key of ["verify_pending_since", "verify_pending_pr_url", "verify_feedback", "previous_failure",
    "failure_category", "failure_suggestion", "verify_infra_retry", "verify_visual_scope_deferred"]) {
    assert.equal(f.context[key], undefined, key);
  }
  assert.equal(f.context.repo, "/inert/repo");
});

it("a second same-PR verify injection after the deadline passes the actual gate without restarting its wait", async () => {
  const f = verifyDelayContextFixture();
  await f.inject(); await f.inject();
  assert.deepEqual(await f.reviewGate(), { found: true });
  assert.deepEqual(f.handoffs, []);
  assert.equal(f.context.verify_pending_since, undefined);
  assert.equal(f.context.verify_pending_pr_url, undefined);
});

it("a changed PR still starts the actual gate's normal fresh 300-second wait", async () => {
  const f = verifyDelayContextFixture();
  f.setStoryPr("https://github.com/owned/fixture/pull/2");
  await f.inject();
  assert.deepEqual(await f.reviewGate(), { found: false });
  assert.equal(f.context.verify_pending_pr_url, "https://github.com/owned/fixture/pull/2");
  assert.equal(f.context.verify_pending_since, "2026-11-08T10:46:54.035Z");
  assert.deepEqual(f.handoffs, [{ outcome: "infra_retry", diagnostic: "PR review delay deferral; 300s remaining before agent spawn" }]);
});

it("preserving the same-PR marker does not bypass an unelapsed actual review wait", async () => {
  const f = verifyDelayContextFixture();
  f.context.verify_pending_since = "2026-11-08T10:45:54.035Z";
  await f.inject();
  assert.deepEqual(await f.reviewGate(), { found: false });
  assert.equal(f.context.verify_pending_since, "2026-11-08T10:45:54.035Z");
  assert.deepEqual(f.handoffs, [{ outcome: "infra_retry", diagnostic: "PR review delay deferral; 240s remaining before agent spawn" }]);
});
