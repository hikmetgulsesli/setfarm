import assert from "node:assert/strict";
import { test } from "node:test";

import { observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1 } from "../../src/internal-production/baseline-positive-worktree-receipt-protocol-v1.js";

const FENCE = "c".repeat(64);
const SHA = "a".repeat(40);
const TREE = "b".repeat(40);

function fixture() {
  const physical = { root: "/runtime/story-worktrees/us-1", dev: "1", ino: "2",
    birthtimeNs: "3", gitPrimaryRoot: "/runtime/project" };
  const attempt = { runId: "run-1", claimId: "7", attemptId: "ATT_1234567890abcdef",
    generation: 1, fenceToken: FENCE, worktreeRoot: physical.root, sourceSha: SHA,
    sourceTreeHash: TREE, disposition: "running" };
  const session = { runId: "run-1", claimId: "7", attemptId: attempt.attemptId,
    sessionId: "RTS_1234567890abcdef", ownerInstanceId: "owner-1",
    worktreeRoot: physical.root, state: "running" };
  const source = { root: physical.root, gitPrimaryRoot: physical.gitPrimaryRoot,
    sourceSha: SHA, sourceTreeHash: TREE };
  return { physical, attempt, session, source };
}

function ports(input = fixture(), trace: string[] = []) {
  return {
    trace,
    input,
    holdPhysical: async <T>(within: (physical: unknown,
      recheckPhysical: () => Promise<unknown>) => Promise<T>): Promise<T> => {
      trace.push("hold-open");
      try { return await within(input.physical, async () => {
        trace.push("physical-recheck");
        return input.physical;
      }); }
      finally { trace.push("hold-close"); }
    },
    withReadOnlyDatabaseSnapshot: async <T>(within: (snapshot: unknown) => Promise<T>): Promise<T> => {
      trace.push("db-open");
      try {
        trace.push("db-read");
        return await within({ attempts: Object.freeze([input.attempt]),
          sessions: Object.freeze([input.session]) });
      } finally { trace.push("db-close"); }
    },
    observeSource: async () => {
      trace.push("source");
      return input.source;
    },
  };
}

test("held diagnostic receipt protocol brackets exactly one read-only DB snapshot and hides raw fence", async () => {
  const wired = ports();
  const candidate = await observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(wired);
  assert.deepEqual(wired.trace, ["hold-open", "source", "db-open", "db-read",
    "source", "physical-recheck", "db-close", "hold-close"]);
  assert.equal(candidate.authority, "diagnostic-only");
  assert.equal(candidate.physicalIdentityProvenance, "unverified");
  assert.equal(candidate.producerAuthentication, "unverified");
  assert.equal(candidate.receiptStatus, "required-unpublished");
  assert.equal(candidate.receipt.root, wired.input.physical.root);
  assert.ok(Object.isFrozen(candidate));
  assert.ok(!JSON.stringify(candidate).includes(FENCE));
  assert.deepEqual(wired.input.attempt.fenceToken, FENCE);
});

test("held diagnostic receipt protocol refuses missing, crossed, terminal, and drifted inputs", async () => {
  const variants: Array<[string, (wired: ReturnType<typeof ports>) => void]> = [
    ["crossed claim", (wired) => { wired.input.session.claimId = "8"; }],
    ["crossed attempt", (wired) => { wired.input.session.attemptId = "ATT_2222222222222222"; }],
    ["crossed root", (wired) => { wired.input.session.worktreeRoot = "/runtime/other"; }],
    ["terminal attempt", (wired) => { wired.input.attempt.disposition = "succeeded"; }],
    ["terminal session", (wired) => { wired.input.session.state = "released"; }],
    ["source SHA", (wired) => { wired.input.source.sourceSha = "d".repeat(40); }],
    ["source tree", (wired) => { wired.input.source.sourceTreeHash = "d".repeat(40); }],
    ["source root", (wired) => { wired.input.source.root = "/runtime/other"; }],
    ["source primary", (wired) => { wired.input.source.gitPrimaryRoot = "/runtime/other"; }],
    ["physical inode", (wired) => { wired.input.physical.ino = "0"; }],
    ["physical birthtime", (wired) => { wired.input.physical.birthtimeNs = "0"; }],
  ];
  for (const [name, mutate] of variants) {
    const wired = ports();
    mutate(wired);
    await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(wired),
      /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID|INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_CONTRACT_INVALID/, name);
    assert.equal(wired.trace.at(-1), "hold-close", name);
  }
});

test("held diagnostic receipt protocol refuses source A-to-B drift and callback misuse", async () => {
  const drifted = ports();
  let reads = 0;
  drifted.observeSource = async () => {
    drifted.trace.push("source");
    reads += 1;
    return reads === 1 ? drifted.input.source
      : { ...drifted.input.source, sourceSha: "d".repeat(40) };
  };
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(drifted),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);
  assert.equal(drifted.trace.at(-1), "hold-close");

  const physicalDrift = ports();
  physicalDrift.holdPhysical = async <T>(within: (physical: unknown,
    recheckPhysical: () => Promise<unknown>) => Promise<T>): Promise<T> =>
    within(physicalDrift.input.physical, async () => ({ ...physicalDrift.input.physical, ino: "9" }));
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(physicalDrift),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const doubleHold = ports();
  doubleHold.holdPhysical = async <T>(within: (physical: unknown,
    recheckPhysical: () => Promise<unknown>) => Promise<T>): Promise<T> => {
    const recheck = async () => doubleHold.input.physical;
    const first = await within(doubleHold.input.physical, recheck);
    await within(doubleHold.input.physical, recheck);
    return first;
  };
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(doubleHold),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const doubleDb = ports();
  doubleDb.withReadOnlyDatabaseSnapshot = async <T>(within: (snapshot: unknown) => Promise<T>): Promise<T> => {
    const snapshot = { attempts: [doubleDb.input.attempt], sessions: [doubleDb.input.session] };
    const first = await within(snapshot);
    await within(snapshot);
    return first;
  };
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(doubleDb),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const noDb = ports();
  noDb.withReadOnlyDatabaseSnapshot = async <T>(_within: (snapshot: unknown) => Promise<T>): Promise<T> =>
    undefined as T;
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(noDb),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const duplicate = ports();
  duplicate.withReadOnlyDatabaseSnapshot = async <T>(within: (snapshot: unknown) => Promise<T>): Promise<T> =>
    within({ attempts: [duplicate.input.attempt, duplicate.input.attempt],
      sessions: [duplicate.input.session] });
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(duplicate),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const missing = ports();
  missing.withReadOnlyDatabaseSnapshot = async <T>(within: (snapshot: unknown) => Promise<T>): Promise<T> =>
    within({ attempts: [], sessions: [missing.input.session] });
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(missing),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);

  const noHold = ports();
  noHold.holdPhysical = async <T>(_within: (physical: unknown,
    recheckPhysical: () => Promise<unknown>) => Promise<T>): Promise<T> => undefined as T;
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(noHold),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_PROTOCOL_INVALID/);
});

test("held cleanup refusal never returns a candidate", async () => {
  const wired = ports();
  wired.holdPhysical = async <T>(within: (physical: unknown,
    recheckPhysical: () => Promise<unknown>) => Promise<T>): Promise<T> => {
    await within(wired.input.physical, async () => wired.input.physical);
    throw new Error("HELD_CLEANUP_UNCERTAIN");
  };
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(wired),
    /HELD_CLEANUP_UNCERTAIN/);

  const databaseClose = ports();
  databaseClose.withReadOnlyDatabaseSnapshot = async <T>(within: (snapshot: unknown) => Promise<T>): Promise<T> => {
    await within({ attempts: [databaseClose.input.attempt], sessions: [databaseClose.input.session] });
    throw new Error("DATABASE_CLOSE_UNCERTAIN");
  };
  await assert.rejects(observeHeldDiagnosticPositiveWorktreeReceiptCandidateV1(databaseClose),
    /DATABASE_CLOSE_UNCERTAIN/);
});
