import path from "node:path";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

// A pure comparison only. No supplied receipt authenticates its own producer.
const SCHEMA = "setfarm.internal-production-positive-worktree-binding-candidate.v1";
const RECEIPT_SCHEMA = "setfarm.internal-production-positive-worktree-binding-receipt.v1";
const IDENTITY_SCHEMA = "setfarm.internal-production-positive-worktree-identity.v2";
const FENCE_SCHEMA = "setfarm.internal-production-positive-worktree-fence-commitment.v1";
const NAME = /^[A-Za-z0-9._-]+$/;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_CONTRACT_INVALID"); }

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string"
    || !keys.includes(key) || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function boundedText(value: unknown, maxBytes: number): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")
    || Buffer.byteLength(value) > maxBytes || value.normalize("NFC") !== value
    || Buffer.from(value, "utf8").toString("utf8") !== value) fail();
  return value;
}

function root(value: unknown): string {
  const text = boundedText(value, 1024);
  if (text === "/" || !path.posix.isAbsolute(text) || path.posix.normalize(text) !== text
    || text.split("/").slice(1).some((segment) => !NAME.test(segment)
      || segment === "." || segment === "..")) fail();
  return text;
}

function sha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
}

function gitOid(value: unknown): string {
  if (typeof value !== "string" || !(/^([a-f0-9]{40}|[a-f0-9]{64})$/).test(value)) fail();
  return value;
}

function identityText(value: unknown): string { return boundedText(value, 256); }

function claimId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)
    || BigInt(value) > 9_223_372_036_854_775_807n) fail();
  return value;
}

function positiveDecimal(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)) fail();
  return value;
}

function attempt(value: unknown) {
  const row = exact(value, ["runId", "claimId", "attemptId", "generation", "fenceToken",
    "worktreeRoot", "sourceSha", "sourceTreeHash", "disposition"]);
  if (!Number.isSafeInteger(row.generation) || (row.generation as number) <= 0
    || (row.disposition !== "claimed" && row.disposition !== "running")) fail();
  const attemptId = identityText(row.attemptId);
  const generation = row.generation as number;
  const fenceToken = sha256(row.fenceToken);
  return Object.freeze({ runId: identityText(row.runId), claimId: claimId(row.claimId),
    attemptId, generation,
    fenceTokenHash: hashCanonicalJson({ schema: FENCE_SCHEMA, attemptId, generation, fenceToken }),
    worktreeRoot: root(row.worktreeRoot),
    sourceSha: gitOid(row.sourceSha), sourceTreeHash: gitOid(row.sourceTreeHash),
    disposition: row.disposition as "claimed" | "running" });
}

function session(value: unknown) {
  const row = exact(value, ["runId", "claimId", "attemptId", "sessionId", "ownerInstanceId",
    "worktreeRoot", "state"]);
  if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(row.state as string)) fail();
  return Object.freeze({ runId: identityText(row.runId), claimId: claimId(row.claimId),
    attemptId: identityText(row.attemptId), sessionId: identityText(row.sessionId),
    ownerInstanceId: identityText(row.ownerInstanceId), worktreeRoot: root(row.worktreeRoot),
    state: row.state as "reserved" | "starting" | "running" | "drain_requested" | "drained" });
}

function physical(value: unknown) {
  const row = exact(value, ["root", "dev", "ino", "birthtimeNs", "gitPrimaryRoot"]);
  return Object.freeze({ root: root(row.root), dev: positiveDecimal(row.dev), ino: positiveDecimal(row.ino),
    birthtimeNs: positiveDecimal(row.birthtimeNs), gitPrimaryRoot: root(row.gitPrimaryRoot) });
}

function receipt(value: unknown) {
  const row = exact(value, ["schema", "runId", "claimId", "attemptId", "sessionId",
    "ownerInstanceId", "generation", "fenceTokenHash", "root", "physicalIdentityHash",
    "sourceSha", "sourceTreeHash", "receiptHash"]);
  if (row.schema !== RECEIPT_SCHEMA || !Number.isSafeInteger(row.generation)
    || (row.generation as number) <= 0) fail();
  const body = Object.freeze({ schema: RECEIPT_SCHEMA, runId: identityText(row.runId),
    claimId: claimId(row.claimId), attemptId: identityText(row.attemptId),
    sessionId: identityText(row.sessionId), ownerInstanceId: identityText(row.ownerInstanceId),
    generation: row.generation as number, fenceTokenHash: sha256(row.fenceTokenHash),
    root: root(row.root), physicalIdentityHash: sha256(row.physicalIdentityHash),
    sourceSha: gitOid(row.sourceSha), sourceTreeHash: gitOid(row.sourceTreeHash) });
  const receiptHash = sha256(row.receiptHash);
  if (hashCanonicalJson(body) !== receiptHash) fail();
  return Object.freeze({ ...body, receiptHash });
}

export function projectPositiveWorktreeBindingCandidateV1(value: unknown) {
  const input = exact(value, ["attempt", "session", "physical", "receipt"]);
  const a = attempt(input.attempt);
  const s = session(input.session);
  const p = physical(input.physical);
  const r = receipt(input.receipt);
  const physicalIdentityHash = hashCanonicalJson({ schema: IDENTITY_SCHEMA, root: p.root,
    dev: p.dev, ino: p.ino, birthtimeNs: p.birthtimeNs, gitPrimaryRoot: p.gitPrimaryRoot });
  if (a.runId !== s.runId || a.runId !== r.runId || a.claimId !== s.claimId
    || a.claimId !== r.claimId || a.attemptId !== s.attemptId || a.attemptId !== r.attemptId
    || s.sessionId !== r.sessionId || s.ownerInstanceId !== r.ownerInstanceId
    || a.generation !== r.generation || a.fenceTokenHash !== r.fenceTokenHash
    || a.worktreeRoot !== s.worktreeRoot || a.worktreeRoot !== p.root || p.root !== r.root
    || a.sourceSha !== r.sourceSha || a.sourceTreeHash !== r.sourceTreeHash
    || physicalIdentityHash !== r.physicalIdentityHash) fail();
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, status: "consistent-candidate" as const,
    attempt: a, session: s, physical: p, receipt: r };
  return Object.freeze({ ...body, projectionHash: hashCanonicalJson(body) });
}
