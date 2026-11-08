import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";
import type postgres from "postgres";
import {
  authenticateNativeGitCustody, captureNativeAttemptFileSignatures,
} from "../../src/execution/v3-preparation-authority-v2-repository.js";
import { readNativeAcceptedModelSourceAuthority } from "../../src/recovery/v3-evidence-only-publication.js";
import { readNativeOperationalSuccessAuthority } from "../../src/execution/v3-native-operational-success-authority.js";
import { createOperationalRetryDirectiveV1 } from "../../src/execution/operational-retry-directive.js";
import { RuntimeCompletionPlanV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { V3ImplementationAgentOutputV1Schema } from "../../src/execution/v3-implementation-output.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const RUN = "run-failed-fallback-custody", INITIAL = "ATT_initial-custody-00001", FALLBACK = "ATT_fallback-custody-0001";
const PACKET = hash("packet"), SLICE = hash("slice"), AUTHORITY = hash("initial-preparation");
const ORIGINAL = '{"name":"custody-fixture","version":"1.0.0"}\n';

async function fixture() {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "setfarm-failed-fallback-custody-")));
  const repo = path.join(root, "repo"), initialWorktree = path.join(root, "initial"), fallbackWorktree = path.join(root, "fallback");
  mkdirSync(repo);
  const git = (cwd: string, args: string[]) => execFileSync("git", ["--no-replace-objects", ...args], {
    cwd, encoding: "utf8", stdio: "pipe", timeout: 10000,
  }).trim();
  try {
    git(repo, ["init", "-q"]); git(repo, ["config", "user.name", "Custody Fixture"]);
    git(repo, ["config", "user.email", "custody-fixture@example.invalid"]);
    git(repo, ["config", "commit.gpgsign", "false"]);
    writeFileSync(path.join(repo, "package.json"), ORIGINAL);
    git(repo, ["add", "package.json"]); git(repo, ["commit", "-qm", "initial fixture source"]);
    const sourceBefore = { sha: git(repo, ["rev-parse", "HEAD"]), treeHash: git(repo, ["rev-parse", "HEAD^{tree}"]) };
    git(repo, ["worktree", "add", "-q", "-b", "custody-initial", initialWorktree, sourceBefore.sha]);
    git(repo, ["worktree", "add", "-q", "-b", "custody-fallback", fallbackWorktree, sourceBefore.sha]);
    writeFileSync(path.join(fallbackWorktree, "package.json"), '{"name":"custody-fixture","version":"2.0.0"}\n');
    git(fallbackWorktree, ["add", "package.json"]); git(fallbackWorktree, ["commit", "-qm", "failed candidate source"]);
    const sourceAfter = { sha: git(fallbackWorktree, ["rev-parse", "HEAD"]), treeHash: git(fallbackWorktree, ["rev-parse", "HEAD^{tree}"]) };
    const initial: any = { attempt_id: INITIAL, claim_id: "10", generation: 1, disposition: "inconclusive", outcome: "infra_retry",
      branch: "custody-initial", worktree: initialWorktree, evidence_refs: "[]", step_id: "implement", story_id: "US-001",
      packet_hash: PACKET, slice_hash: SLICE, compilation_report_hash: hash("report"), attempt_class: "product_implementation",
      source_before_sha: sourceBefore.sha, source_before_tree_hash: sourceBefore.treeHash,
      source_after_sha: null, source_after_tree_hash: null, recovery_dispatch_id: null, accepted: false };
    const successor: any = { ...initial, attempt_id: FALLBACK, claim_id: "11", generation: 2,
      disposition: "failed", outcome: "completed", branch: "custody-fallback", worktree: fallbackWorktree,
      source_after_sha: sourceAfter.sha, source_after_tree_hash: sourceAfter.treeHash, attempt_class: "infrastructure_retry" };
    const state = { initial, successor, model: {} as any, rcrState: "accepted", applyPhase: "effects_committed", runtimeState: "released", retryArtifactHash: "", directiveHash: "" };
    // This closed SQL boundary models selected rows, not authority decisions.
    // Its small predicate subset makes changed SQL selectors observable. Real
    // DB joins still require Root's separate read-only retained-row proof.
    const query = { unsafe: async (statement: string, parameters: readonly unknown[] = []) => {
      const sql = statement.replace(/\s+/g, " ").trim();
      if (sql.startsWith("SELECT r.context FROM runs")) return [{ context: JSON.stringify({ repo }) }];
      if (sql.includes(" AS accepted FROM execution_attempts a")) {
        assert.equal(parameters[0], RUN);
        return [structuredClone(parameters[1] === INITIAL ? state.initial : state.successor)];
      }
      if (sql.startsWith("SELECT successor.attempt_id")) {
        const selected = /successor\.disposition\s*=\s*'([^']+)'/.exec(sql)?.[1];
        const selectedSet = /successor\.disposition\s+IN\s*\(([^)]+)\)/i.exec(sql)?.[1];
        if (selected && selected !== state.successor.disposition) return [];
        if (selectedSet && !selectedSet.includes(`'${state.successor.disposition}'`)) return [];
        if (sql.includes("successor.generation=prior.generation+1") && state.successor.generation !== state.initial.generation + 1) return [];
        if (sql.includes("successor.slice_hash=prior.slice_hash") && state.successor.slice_hash !== state.initial.slice_hash) return [];
        if (sql.includes("successor.source_before_sha=prior.source_before_sha") && state.successor.source_before_sha !== state.initial.source_before_sha) return [];
        if (sql.includes("successor.source_before_tree_hash=prior.source_before_tree_hash") && state.successor.source_before_tree_hash !== state.initial.source_before_tree_hash) return [];
        return [{ ...structuredClone(state.successor), prior_attempt_id: INITIAL, prior_claim_id: state.initial.claim_id,
          prior_generation: state.initial.generation, prior_slice_hash: state.initial.slice_hash }];
      }
      if (sql.includes("initial.attempt_id AS initial_attempt_id") && sql.includes("q.completion_plan")) {
        if (parameters[0] !== FALLBACK || state.rcrState !== "accepted" || state.applyPhase !== "effects_committed" || state.runtimeState !== "released") return [];
        return [structuredClone(state.model)];
      }
      if (sql.startsWith("SELECT a.artifact_hash,a.artifact_type FROM semantic_artifacts a")) {
        assert.deepEqual(parameters.slice(0, 3), [state.retryArtifactHash, RUN,
          `OPERATIONAL_RETRY_${state.directiveHash.slice(0, 16).toUpperCase()}`]);
        return [{ artifact_hash: state.retryArtifactHash, artifact_type: "setfarm.operational-retry-directive.v1" }];
      }
      if (sql.includes("bundle.payload AS bundle_payload")) return []; // FAILED is never dependency success.
      if (sql.startsWith("SELECT a.attempt_id") && sql.includes("JOIN recovery_dispatch_deliveries")) return [];
      if (sql.startsWith("SELECT a.attempt_id") && sql.includes("JOIN runtime_completion_requests")) {
        return parameters[0] === FALLBACK && state.rcrState === "accepted" && state.applyPhase === "effects_committed"
          && state.runtimeState === "released" ? [{ attempt_id: FALLBACK }] : [];
      }
      throw Error("UNEXPECTED_CUSTODY_FIXTURE_SQL:" + sql);
    } } as unknown as Pick<postgres.Sql, "unsafe">;
    const custody = await authenticateNativeGitCustody(query, { runId: RUN, claimId: 10,
      branch: initial.branch, worktree: initialWorktree, sourceBefore });
    const directive = createOperationalRetryDirectiveV1({ runId: RUN, stepId: "implement", storyId: "US-001",
      priorAttempt: { claimId: 10, attemptId: INITIAL, generation: 1, attemptClass: "product_implementation",
        packetHash: PACKET, sliceHash: SLICE, sourceBefore, terminalDisposition: "inconclusive" },
      failure: { code: "SUBSCRIPTION_AUTH_FAILED", diagnostic: "fixture authenticated transport refusal" },
      nextSourceRevision: sourceBefore, allowedPaths: ["package.json"] });
    const retryArtifactHash = hashCanonicalJson({ schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.operational-retry-directive.v1", producer: { pass: "fixture", codeSha: "1234567", toolVersions: {} }, payload: directive });
    state.retryArtifactHash = retryArtifactHash; state.directiveHash = directive.directiveHash;
    initial.evidence_refs = JSON.stringify([custody.evidenceRef, `setfarm://preparation-authority-v2/${AUTHORITY}`]);
    successor.evidence_refs = JSON.stringify([...JSON.parse(initial.evidence_refs), `setfarm://artifact/${SLICE}`,
      `setfarm://operational-retry/${directive.directiveHash}`, `setfarm://operational-retry-artifact/${retryArtifactHash}`,
      `setfarm://artifact/${retryArtifactHash}`]);
    const output = JSON.stringify(V3ImplementationAgentOutputV1Schema.parse({
      schema: "setfarm.v3-implementation-agent-proposal.v1", disposition: "ready_for_evidence",
      handoffHash: hash("fallback handoff"), attemptId: FALLBACK, packetHash: PACKET, sliceHash: SLICE, sourceBefore,
      summary: "Candidate ready for platform evidence", changes: [{ path: "package.json", summary: "Candidate implementation" }],
    }));
    const plan = RuntimeCompletionPlanV1Schema.parse({ schema: "setfarm.runtime-completion-plan.v1", planVersion: 1,
      requestId: "RCR_accepted-fallback-00001", claimId: 11, runId: RUN, stepDbId: "step-implement", workflowStepId: "implement",
      outputHash: hash(output), kind: "story_completion", continuation: { type: "story_loop_continue" },
      subject: { storyId: "US-001", storyDbId: "story-owned", sourceSha: sourceAfter.sha },
      effects: [{ effectKey: "continue/implement", ordinal: 0, effectType: "story.loop.continue", mandatory: true, payload: {} }],
      preparedAt: "2026-11-08T14:00:00.000Z" });
    state.model = { ...successor, output, output_hash: hash(output), completion_plan: plan, completion_plan_hash: hashCanonicalJson(plan),
      request_id: plan.requestId, step_db_id: plan.stepDbId, story_db_id: plan.subject!.storyDbId, authority_hash: AUTHORITY,
      initial_attempt_id: INITIAL, initial_claim_id: "10", initial_branch: initial.branch, initial_worktree: initialWorktree,
      initial_sha: sourceBefore.sha, initial_tree_hash: sourceBefore.treeHash, initial_evidence_refs: initial.evidence_refs };
    const sourceLocator = { runId: RUN, storyId: "US-001", packetHash: PACKET, attemptId: FALLBACK };
    const capture = () => captureNativeAttemptFileSignatures(query, { runId: RUN, attemptId: INITIAL, source: sourceBefore,
      files: [{ pathRef: "PATH_PACKAGE", path: "package.json" }] });
    const removeWorktrees = () => { git(repo, ["worktree", "remove", initialWorktree]); git(repo, ["worktree", "remove", fallbackWorktree]); };
    return { query, state, sourceLocator, capture, removeWorktrees, initialWorktree, fallbackWorktree, directive,
      close: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) { rmSync(root, { recursive: true, force: true }); throw error; }
}

it("removed initial custody remains readable through its exact accepted FAILED model fallback", async () => {
  const value = await fixture();
  try {
    const source = await readNativeAcceptedModelSourceAuthority(value.query, value.sourceLocator);
    assert.equal(source.initial_attempt_id, INITIAL);
    assert.equal(source.modelOutput.disposition, "ready_for_evidence");
    value.removeWorktrees();
    assert.equal(existsSync(value.initialWorktree), false); assert.equal(existsSync(value.fallbackWorktree), false);
    assert.deepEqual(await value.capture(), [{ pathRef: "PATH_PACKAGE", path: "package.json", presence: "present", contentHash: hash(ORIGINAL) }]);
  } finally { value.close(); }
});

it("surviving original worktree keeps ordinary authenticated custody", async () => {
  const value = await fixture();
  try { assert.equal((await value.capture())[0]!.contentHash, hash(ORIGINAL)); }
  finally { value.close(); }
});

it("accepted FAILED source is never successful native dependency authority", async () => {
  const value = await fixture();
  try {
    await readNativeAcceptedModelSourceAuthority(value.query, value.sourceLocator);
    await assert.rejects(readNativeOperationalSuccessAuthority(value.query, { ...value.sourceLocator, stepId: "implement" }),
      /V3_NATIVE_OPERATIONAL_SUCCESS_AUTHORITY_MISMATCH/);
  } finally { value.close(); }
});

it("removed initial custody rejects missing or crossed fallback provenance", async () => {
  const mutations: ReadonlyArray<readonly [string, (state: Awaited<ReturnType<typeof fixture>>["state"]) => void]> = [
    ["missing accepted RCR", state => { state.rcrState = "requested"; }],
    ["unreleased runtime", state => { state.runtimeState = "drained"; }],
    ["crossed initial claim", state => { state.initial.claim_id = "999"; }],
    ["crossed initial authority", state => { state.model.authority_hash = hash("foreign authority"); }],
    ["crossed generation", state => { state.successor.generation = 3; state.model.generation = 3; }],
    ["crossed slice", state => { state.successor.slice_hash = hash("foreign slice"); state.model.slice_hash = state.successor.slice_hash; }],
    ["crossed reset source", state => { state.successor.source_before_sha = "f".repeat(40); state.model.source_before_sha = state.successor.source_before_sha; }],
    ["crossed genuine custody", state => { state.initial.evidence_refs = JSON.stringify([`setfarm://native-git-custody-v1/${hash("foreign custody")}`]); }],
    ["missing reset directive", state => { state.model.evidence_refs = JSON.stringify(JSON.parse(state.model.evidence_refs)
      .filter((ref: string) => !ref.startsWith("setfarm://operational-retry/"))); }],
  ];
  for (const [label, mutate] of mutations) {
    const value = await fixture();
    try {
      value.removeWorktrees(); mutate(value.state);
      await assert.rejects(value.capture(), /V3_NATIVE_(?:GIT_CUSTODY|MODEL_SOURCE|ORIGINAL_SOURCE|OPERATIONAL)/, label);
    } finally { value.close(); }
  }
});
