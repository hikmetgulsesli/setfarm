import path from "node:path";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

// This is a held physical/row join, not a producer receipt or an owner grant.
const SCHEMA = "setfarm.internal-production-held-binding-candidates.v1";
const IDENTITY_SCHEMA = "setfarm.internal-production-positive-worktree-identity.v2";
const NAME = /^[A-Za-z0-9._-]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID"); }

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype || !Object.isFrozen(value)) fail();
  const fields = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(fields);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)
    || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value as unknown]));
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype
    || !Object.isFrozen(value) || value.length > 256) fail();
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" &&
    (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length
      || !fields[key]!.enumerable || !("value" in fields[key]!)))) fail();
  return Array.from({ length: value.length }, (_, index) => fields[String(index)]!.value as unknown);
}

function text(value: unknown, max = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")
    || Buffer.byteLength(value) > max || value.normalize("NFC") !== value
    || Buffer.from(value, "utf8").toString("utf8") !== value) fail();
  return value;
}

function root(value: unknown): string {
  const result = text(value, 2048);
  if (result === "/" || !path.posix.isAbsolute(result) || path.posix.normalize(result) !== result
    || result.split("/").slice(1).some(segment => !NAME.test(segment)
      || segment === "." || segment === "..")) fail();
  return result;
}

function decimal(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,20}$/.test(value)) fail();
  return value;
}

function hash(value: unknown, pattern = SHA256): string {
  if (typeof value !== "string" || !pattern.test(value)) fail();
  return value;
}

function candidate(value: unknown) {
  const row = exact(value, ["root", "zone", "kind", "dev", "ino", "birthtimeNs",
    "gitPrimaryRoot", "dirty", "sourceBuildProvenance", "referencingPids"]);
  if (row.zone !== "retained-zone" && row.zone !== "runtime-zone") fail();
  if (!["unresolved", "linked-git", "primary-git"].includes(row.kind as string)
    || (row.dirty !== null && typeof row.dirty !== "boolean")
    || row.sourceBuildProvenance !== "unverified") fail();
  const pids = list(row.referencingPids);
  if (pids.some((pid, index) => !Number.isSafeInteger(pid) || (pid as number) <= 0
    || (index > 0 && (pids[index - 1] as number) >= (pid as number)))) fail();
  return Object.freeze({ root: root(row.root), zone: row.zone as "retained-zone" | "runtime-zone",
    kind: row.kind as "unresolved" | "linked-git" | "primary-git", dev: decimal(row.dev),
    ino: decimal(row.ino), birthtimeNs: decimal(row.birthtimeNs),
    gitPrimaryRoot: row.gitPrimaryRoot === null ? null : root(row.gitPrimaryRoot) });
}

function attempt(value: unknown) {
  const row = exact(value, ["attemptId", "runId", "claimId", "generation", "fenceTokenHash",
    "sourceSha", "sourceTreeHash", "worktreeRoot", "disposition"]);
  if (!Number.isSafeInteger(row.generation) || (row.generation as number) <= 0
    || (row.disposition !== "claimed" && row.disposition !== "running")) fail();
  return Object.freeze({ attemptId: text(row.attemptId), runId: text(row.runId),
    claimId: row.claimId === null ? null : decimal(row.claimId),
    generation: row.generation as number, fenceTokenHash: hash(row.fenceTokenHash),
    sourceSha: hash(row.sourceSha, GIT_OID), sourceTreeHash: hash(row.sourceTreeHash, GIT_OID),
    worktreeRoot: row.worktreeRoot === null ? null : root(row.worktreeRoot) });
}

function session(value: unknown) {
  const row = exact(value, ["sessionId", "runId", "claimId", "attemptId", "ownerInstanceId",
    "worktreeRoot", "state"]);
  if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(row.state as string)) fail();
  return Object.freeze({ sessionId: text(row.sessionId), runId: text(row.runId),
    claimId: decimal(row.claimId), attemptId: row.attemptId === null ? null : text(row.attemptId),
    ownerInstanceId: text(row.ownerInstanceId),
    worktreeRoot: row.worktreeRoot === null ? null : root(row.worktreeRoot) });
}

export function projectHeldPositiveWorktreeBindingCandidatesV1(firstPass: unknown, bindingRows: unknown) {
  const physical = list(firstPass).map(candidate);
  const physicalByRoot = new Map<string, (typeof physical)[number]>();
  for (const entry of physical) {
    if (physicalByRoot.has(entry.root)) fail();
    physicalByRoot.set(entry.root, entry);
  }
  const binding = exact(bindingRows, ["schema", "authority", "physicalIdentityProvenance",
    "activeAttempts", "activeSessions", "counts", "snapshotHash"]);
  const counts = exact(binding.counts, ["attemptCount", "sessionCount"]);
  const attempts = list(binding.activeAttempts).map(attempt);
  const sessions = list(binding.activeSessions).map(session);
  if (binding.schema !== "setfarm.internal-production-positive-worktree-binding-rows.v1"
    || binding.authority !== "diagnostic-only" || binding.physicalIdentityProvenance !== "unverified"
    || counts.attemptCount !== attempts.length || counts.sessionCount !== sessions.length
    || hashCanonicalJson({ schema: binding.schema, authority: binding.authority,
      physicalIdentityProvenance: binding.physicalIdentityProvenance,
      activeAttempts: binding.activeAttempts, activeSessions: binding.activeSessions,
      counts: binding.counts }) !== hash(binding.snapshotHash)) fail();
  if (new Set(attempts.map(row => row.attemptId)).size !== attempts.length
    || new Set(sessions.map(row => row.sessionId)).size !== sessions.length) fail();
  const matchedAttempts = new Set<string>(), matchedSessions = new Set<string>();
  const candidates = [] as Array<Readonly<Record<string, unknown>>>;
  for (const current of attempts) {
    if (current.claimId === null || current.worktreeRoot === null) continue;
    const physicalEntry = physicalByRoot.get(current.worktreeRoot);
    if (!physicalEntry || physicalEntry.zone !== "runtime-zone" || physicalEntry.kind !== "linked-git"
      || physicalEntry.gitPrimaryRoot === null) continue;
    if (attempts.filter(row => row.worktreeRoot === current.worktreeRoot).length !== 1) continue;
    if (sessions.filter(row => row.attemptId === current.attemptId).length !== 1) continue;
    const related = sessions.filter(row => row.worktreeRoot === current.worktreeRoot);
    if (related.length !== 1) continue;
    const bound = related[0]!;
    if (bound.attemptId !== current.attemptId || bound.runId !== current.runId
      || bound.claimId !== current.claimId) continue;
    const identity = Object.freeze({ root: current.worktreeRoot, dev: physicalEntry.dev,
      ino: physicalEntry.ino, birthtimeNs: physicalEntry.birthtimeNs,
      gitPrimaryRoot: physicalEntry.gitPrimaryRoot });
    const physicalIdentityHash = hashCanonicalJson({ schema: IDENTITY_SCHEMA, ...identity });
    candidates.push(Object.freeze({ attemptId: current.attemptId, sessionId: bound.sessionId,
      runId: current.runId, claimId: current.claimId, ownerInstanceId: bound.ownerInstanceId,
      generation: current.generation, fenceTokenHash: current.fenceTokenHash,
      sourceSha: current.sourceSha, sourceTreeHash: current.sourceTreeHash,
      worktreeRoot: current.worktreeRoot, physical: identity, physicalIdentityHash }));
    matchedAttempts.add(current.attemptId);
    matchedSessions.add(bound.sessionId);
  }
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    receiptStatus: "required-unpublished" as const, candidates: Object.freeze(candidates),
    unresolvedAttemptIds: Object.freeze(attempts.filter(row => !matchedAttempts.has(row.attemptId))
      .map(row => row.attemptId)),
    unresolvedSessionIds: Object.freeze(sessions.filter(row => !matchedSessions.has(row.sessionId))
      .map(row => row.sessionId)) };
  return Object.freeze({ ...body, projectionHash: hashCanonicalJson(body) });
}
