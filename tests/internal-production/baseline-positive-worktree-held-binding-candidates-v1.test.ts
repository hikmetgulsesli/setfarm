import assert from "node:assert/strict";
import test from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { projectHeldPositiveWorktreeBindingCandidatesV1 } from
  "../../src/internal-production/baseline-positive-worktree-held-binding-candidates-v1.js";

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const root = "/Users/setrox/ai/setrox/data/runtime/story-worktrees/us-1";
const primary = "/Users/setrox/ai/setrox/data/projects/sample";
const attempt = Object.freeze({ attemptId: "ATT_1234567890abcdef", runId: "run-1", claimId: "7",
  generation: 3, fenceTokenHash: "a".repeat(64), sourceSha: "b".repeat(40),
  sourceTreeHash: "c".repeat(40), worktreeRoot: root, disposition: "running" });
const session = Object.freeze({ sessionId: "RTS_1234567890abcdef", runId: "run-1", claimId: "7",
  attemptId: attempt.attemptId, ownerInstanceId: "owner-1", worktreeRoot: root, state: "running" });
const runtime = freeze({ root, zone: "runtime-zone", kind: "linked-git", dev: "7", ino: "11",
  birthtimeNs: "123", gitPrimaryRoot: primary, dirty: true,
  sourceBuildProvenance: "unverified", referencingPids: [1234] });
const retained = freeze({ ...runtime, root: "/Users/setrox/ai/setrox/deployments/sample",
  zone: "retained-zone", kind: "primary-git", gitPrimaryRoot: null,
  referencingPids: [] });

function binding(attempts: readonly unknown[] = [attempt], sessions: readonly unknown[] = [session]) {
  const body = freeze({ schema: "setfarm.internal-production-positive-worktree-binding-rows.v1",
    authority: "diagnostic-only", physicalIdentityProvenance: "unverified",
    activeAttempts: [...attempts], activeSessions: [...sessions],
    counts: { attemptCount: attempts.length, sessionCount: sessions.length } });
  return freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

test("held join emits only a receipt-required runtime candidate and retains nonowners", () => {
  const joined = projectHeldPositiveWorktreeBindingCandidatesV1(freeze([retained, runtime]), binding());
  assert.equal(joined.schema, "setfarm.internal-production-held-binding-candidates.v1");
  assert.equal(joined.authority, "diagnostic-only");
  assert.equal(joined.physicalIdentityProvenance, "unverified");
  assert.equal(joined.receiptStatus, "required-unpublished");
  assert.equal(joined.candidates.length, 1);
  assert.deepEqual(joined.unresolvedAttemptIds, []);
  assert.deepEqual(joined.unresolvedSessionIds, []);
  assert.equal(joined.candidates[0]!.attemptId, attempt.attemptId);
  assert.equal(joined.candidates[0]!.sessionId, session.sessionId);
  assert.equal(joined.candidates[0]!.generation, 3);
  assert.equal(joined.candidates[0]!.fenceTokenHash, attempt.fenceTokenHash);
  assert.equal(joined.candidates[0]!.physical.dev, "7");
  assert.equal(joined.candidates[0]!.physical.gitPrimaryRoot, primary);
  assert.equal(joined.candidates[0]!.physicalIdentityHash, hashCanonicalJson({
    schema: "setfarm.internal-production-positive-worktree-identity.v2", root,
    dev: "7", ino: "11", birthtimeNs: "123", gitPrimaryRoot: primary }));
  assert.equal(JSON.stringify(joined).includes("/deployments/sample"), false);
  const { projectionHash, ...body } = joined;
  assert.equal(projectionHash, hashCanonicalJson(body));
});

test("null, orphaned, crossed and duplicate active rows remain unresolved", () => {
  const cases = [
    { attempts: [attempt], sessions: [{ ...session, attemptId: null }] },
    { attempts: [attempt], sessions: [] },
    { attempts: [], sessions: [session] },
    { attempts: [attempt], sessions: [{ ...session, worktreeRoot: "/runtime/other" }] },
    { attempts: [attempt, { ...attempt, attemptId: "ATT_2222222222abcdef" }], sessions: [session] },
    { attempts: [attempt], sessions: [session, { ...session, sessionId: "RTS_2222222222abcdef" }] },
    { attempts: [attempt], sessions: [session, { ...session, sessionId: "RTS_2222222222abcdef",
      worktreeRoot: "/runtime/other" }] },
  ];
  for (const current of cases) {
    const joined = projectHeldPositiveWorktreeBindingCandidatesV1(freeze([runtime]),
      binding(current.attempts, current.sessions));
    assert.deepEqual(joined.candidates, []);
    assert.equal(joined.unresolvedAttemptIds.length, current.attempts.length);
    assert.equal(joined.unresolvedSessionIds.length, current.sessions.length);
  }
});

test("a retained development or deployment root remains visible but never becomes a candidate", () => {
  const retainedAttempt = Object.freeze({ ...attempt, worktreeRoot: retained.root });
  const retainedSession = Object.freeze({ ...session, worktreeRoot: retained.root });
  const joined = projectHeldPositiveWorktreeBindingCandidatesV1(freeze([retained]),
    binding([retainedAttempt], [retainedSession]));
  assert.deepEqual(joined.candidates, []);
  assert.deepEqual(joined.unresolvedAttemptIds, [attempt.attemptId]);
  assert.deepEqual(joined.unresolvedSessionIds, [session.sessionId]);
});

test("held join rejects duplicate, unfrozen or impossible physical input", () => {
  for (const entries of [freeze([runtime, runtime]), [runtime],
    freeze([{ ...runtime, dev: "0" }]), freeze([{ ...runtime, zone: "unknown" }])]) {
    assert.throws(() => projectHeldPositiveWorktreeBindingCandidatesV1(entries, binding()),
      /INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID/);
  }
});

test("held join rejects forged binding hash or authority", () => {
  const valid = binding();
  for (const forged of [freeze({ ...valid, snapshotHash: "d".repeat(64) }),
    freeze({ ...valid, authority: "cutover-ready" })]) {
    assert.throws(() => projectHeldPositiveWorktreeBindingCandidatesV1(freeze([runtime]), forged),
      /INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID/);
  }
});
