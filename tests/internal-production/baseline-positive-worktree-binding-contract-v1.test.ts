import assert from "node:assert/strict";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { derivePositiveWorktreeBindingReceiptCandidateV1, projectPositiveWorktreeBindingCandidateV1 } from "../../src/internal-production/baseline-positive-worktree-binding-contract-v1.js";

const RECEIPT_SCHEMA = "setfarm.internal-production-positive-worktree-binding-receipt.v1";
const IDENTITY_SCHEMA = "setfarm.internal-production-positive-worktree-identity.v2";
const FENCE_SCHEMA = "setfarm.internal-production-positive-worktree-fence-commitment.v1";
const SHA = "a".repeat(40);
const TREE = "b".repeat(40);
const FENCE = "c".repeat(64);

function fixture(attemptId = "ATT_1234567890abcdef", sessionId = "RTS_1234567890abcdef") {
  const physical = { root: "/runtime/story-worktrees/us-1", dev: "1", ino: "2",
    birthtimeNs: "3", gitPrimaryRoot: "/runtime/project" };
  const attempt = { runId: "run-1", claimId: "7", attemptId, generation: 1,
    fenceToken: FENCE, worktreeRoot: physical.root, sourceSha: SHA,
    sourceTreeHash: TREE, disposition: "running" };
  const session = { runId: "run-1", claimId: "7", attemptId,
    sessionId, ownerInstanceId: "owner-1", worktreeRoot: physical.root,
    state: "running" };
  const physicalIdentityHash = hashCanonicalJson({ schema: IDENTITY_SCHEMA, ...physical });
  const fenceTokenHash = hashCanonicalJson({ schema: FENCE_SCHEMA, attemptId: attempt.attemptId,
    generation: attempt.generation, fenceToken: attempt.fenceToken });
  const receiptBody = { schema: RECEIPT_SCHEMA, runId: attempt.runId, claimId: attempt.claimId,
    attemptId: attempt.attemptId, sessionId: session.sessionId,
    ownerInstanceId: session.ownerInstanceId, generation: attempt.generation,
    fenceTokenHash, root: physical.root, physicalIdentityHash,
    sourceSha: SHA, sourceTreeHash: TREE };
  return { attempt, session, physical, receipt: { ...receiptBody,
    receiptHash: hashCanonicalJson(receiptBody) } };
}

test("matching rows, physical identity and receipt produce only a frozen diagnostic candidate", () => {
  const input = fixture();
  const result = projectPositiveWorktreeBindingCandidateV1(input);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.status, "consistent-candidate");
  assert.equal(result.receipt.receiptHash, input.receipt.receiptHash);
  assert.equal(result.projectionHash, hashCanonicalJson({ schema: result.schema,
    authority: result.authority, physicalIdentityProvenance: result.physicalIdentityProvenance,
    status: result.status, attempt: result.attempt, session: result.session,
    physical: result.physical, receipt: result.receipt }));
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.attempt));
  assert(Object.isFrozen(result.session));
  assert(Object.isFrozen(result.physical));
  assert(Object.isFrozen(result.receipt));
  assert.equal(result.attempt.fenceTokenHash, input.receipt.fenceTokenHash);
  assert(!JSON.stringify(result).includes(FENCE));
  assert(!JSON.stringify(result.receipt).includes(FENCE));
  assert.deepEqual(Object.keys(result).sort(), ["schema", "authority", "physicalIdentityProvenance",
    "status", "attempt", "session", "physical", "receipt", "projectionHash"].sort());
});

test("path-only, stale and crossed evidence refuses instead of becoming an owner", () => {
  const variants: Array<[string, (input: ReturnType<typeof fixture>) => void]> = [
    ["null attempt root", (input) => { (input.attempt as { worktreeRoot: unknown }).worktreeRoot = null; }],
    ["null session root", (input) => { (input.session as { worktreeRoot: unknown }).worktreeRoot = null; }],
    ["crossed claim", (input) => { input.session.claimId = "8"; }],
    ["crossed run", (input) => { input.session.runId = "run-2"; }],
    ["crossed attempt", (input) => { input.session.attemptId = "ATT_2"; }],
    ["crossed receipt session", (input) => { input.receipt.sessionId = "RTS_2"; }],
    ["changed fence", (input) => { input.attempt.fenceToken = "d".repeat(64); }],
    ["changed generation", (input) => { input.attempt.generation = 2; }],
    ["changed source", (input) => { input.attempt.sourceSha = "c".repeat(40); }],
    ["changed tree", (input) => { input.attempt.sourceTreeHash = "c".repeat(40); }],
    ["recreated inode", (input) => { input.physical.ino = "9"; }],
    ["recreated birthtime", (input) => { input.physical.birthtimeNs = "9"; }],
    ["changed primary", (input) => { input.physical.gitPrimaryRoot = "/runtime/other"; }],
    ["copied receipt at path", (input) => { input.physical.root = "/runtime/story-worktrees/us-2"; input.attempt.worktreeRoot = input.physical.root; input.session.worktreeRoot = input.physical.root; }],
    ["inactive attempt", (input) => { input.attempt.disposition = "succeeded"; }],
    ["inactive session", (input) => { input.session.state = "released"; }],
    ["wrong receipt hash", (input) => { input.receipt.receiptHash = "f".repeat(64); }],
    ["path traversal", (input) => { input.physical.root = "/runtime/../other"; }],
    ["invalid source hash", (input) => { input.attempt.sourceSha = "f".repeat(39); }],
  ];
  for (const [name, mutate] of variants) {
    const input = fixture();
    mutate(input);
    assert.throws(() => projectPositiveWorktreeBindingCandidateV1(input),
      /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_CONTRACT_INVALID$/, name);
  }
});

test("shape and exotic-object refusals", () => {
  const extra = fixture() as ReturnType<typeof fixture> & { owner?: boolean };
  extra.owner = true;
  assert.throws(() => projectPositiveWorktreeBindingCandidateV1(extra), /BINDING_CONTRACT_INVALID/);
  const accessor = fixture();
  Object.defineProperty(accessor.receipt, "root", { get: () => accessor.physical.root, enumerable: true });
  assert.throws(() => projectPositiveWorktreeBindingCandidateV1(accessor), /BINDING_CONTRACT_INVALID/);
  const proxied = fixture();
  assert.throws(() => projectPositiveWorktreeBindingCandidateV1(new Proxy(proxied, {})), /BINDING_CONTRACT_INVALID/);
  const malformed = fixture();
  malformed.receipt.physicalIdentityHash = "a".repeat(64);
  assert.throws(() => projectPositiveWorktreeBindingCandidateV1(malformed), /BINDING_CONTRACT_INVALID/);
});

test("self-consistent receipts cannot bless noncanonical attempt or session IDs", () => {
  for (const input of [fixture("ATT_short"), fixture(undefined, "RTS_short"),
    fixture("ATT_1234567890abcdef!"), fixture(undefined, "RTS_1234567890abcdef!")]) {
    assert.throws(() => projectPositiveWorktreeBindingCandidateV1(input),
      /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_CONTRACT_INVALID$/);
  }
});

function candidateInput() {
  const { attempt, session, physical } = fixture();
  return { attempt, session, physical };
}

test("receipt candidate has canonical exact wire and round-trips without producer authority", () => {
  const input = candidateInput();
  const result = derivePositiveWorktreeBindingReceiptCandidateV1(input);
  const expected = fixture().receipt;
  const body = { schema: "setfarm.internal-production-positive-worktree-receipt-candidate.v1",
    authority: "diagnostic-only", physicalIdentityProvenance: "unverified",
    producerAuthentication: "unverified", receiptStatus: "required-unpublished",
    receipt: expected };
  assert.deepEqual(result, { ...body, candidateHash: hashCanonicalJson(body) });
  assert.deepEqual(Object.keys(result), [...Object.keys(body), "candidateHash"]);
  assert.deepEqual(Object.keys(result.receipt), Object.keys(expected));
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.receipt));
  assert.equal(projectPositiveWorktreeBindingCandidateV1({ ...input, receipt: result.receipt }).status,
    "consistent-candidate");
  assert(!JSON.stringify(result).includes(FENCE));
  assert(!JSON.stringify(result).includes("fenceToken\""));
});

test("receipt candidate refuses crossed or malformed inputs rather than fabricating evidence", () => {
  const variants: Array<[string, (input: ReturnType<typeof candidateInput>) => void]> = [
    ["crossed run", (input) => { input.session.runId = "run-2"; }],
    ["crossed claim", (input) => { input.session.claimId = "8"; }],
    ["crossed attempt", (input) => { input.session.attemptId = "ATT_2222222222222222"; }],
    ["crossed root", (input) => { input.physical.root = "/runtime/story-worktrees/us-2"; }],
    ["inactive attempt", (input) => { input.attempt.disposition = "succeeded"; }],
    ["inactive session", (input) => { input.session.state = "released"; }],
    ["invalid attempt ID", (input) => { input.attempt.attemptId = "ATT_short"; }],
    ["invalid session ID", (input) => { input.session.sessionId = "RTS_short"; }],
    ["noncanonical root", (input) => { input.physical.root = "/runtime/../elsewhere"; }],
    ["invalid physical ID", (input) => { input.physical.ino = "0"; }],
  ];
  for (const [name, mutate] of variants) {
    const input = candidateInput();
    mutate(input);
    assert.throws(() => derivePositiveWorktreeBindingReceiptCandidateV1(input),
      /^Error: INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_CONTRACT_INVALID$/, name);
  }
  const extra = { ...candidateInput(), receipt: fixture().receipt };
  assert.throws(() => derivePositiveWorktreeBindingReceiptCandidateV1(extra), /BINDING_CONTRACT_INVALID/);
  const accessor = candidateInput();
  Object.defineProperty(accessor.attempt, "fenceToken", { get: () => FENCE, enumerable: true });
  assert.throws(() => derivePositiveWorktreeBindingReceiptCandidateV1(accessor), /BINDING_CONTRACT_INVALID/);
  assert.throws(() => derivePositiveWorktreeBindingReceiptCandidateV1(new Proxy(candidateInput(), {})),
    /BINDING_CONTRACT_INVALID/);
});

test("receipt candidate binds every generation, fence, source, physical and owner change", () => {
  const baseline = derivePositiveWorktreeBindingReceiptCandidateV1(candidateInput());
  const variants: Array<[string, (input: ReturnType<typeof candidateInput>) => void]> = [
    ["generation", (input) => { input.attempt.generation = 2; }],
    ["fence", (input) => { input.attempt.fenceToken = "d".repeat(64); }],
    ["source SHA", (input) => { input.attempt.sourceSha = "c".repeat(40); }],
    ["source tree", (input) => { input.attempt.sourceTreeHash = "c".repeat(40); }],
    ["device", (input) => { input.physical.dev = "9"; }],
    ["inode", (input) => { input.physical.ino = "9"; }],
    ["birthtime", (input) => { input.physical.birthtimeNs = "9"; }],
    ["primary root", (input) => { input.physical.gitPrimaryRoot = "/runtime/other"; }],
    ["owner", (input) => { input.session.ownerInstanceId = "owner-2"; }],
    ["session", (input) => { input.session.sessionId = "RTS_2222222222222222"; }],
  ];
  for (const [name, mutate] of variants) {
    const input = candidateInput();
    mutate(input);
    const changed = derivePositiveWorktreeBindingReceiptCandidateV1(input);
    assert.notEqual(changed.receipt.receiptHash, baseline.receipt.receiptHash, name);
    assert.notEqual(changed.candidateHash, baseline.candidateHash, name);
    assert.equal(projectPositiveWorktreeBindingCandidateV1({ ...input, receipt: changed.receipt }).status,
      "consistent-candidate", name);
  }
});
