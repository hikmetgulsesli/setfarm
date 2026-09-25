import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Read-only input for a future same-transaction physical/DB binder. Even a
// complete empty result is diagnostic, not admission or cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-binding-rows.v1";
const FENCE_SCHEMA = "setfarm.internal-production-positive-worktree-fence-commitment.v1";
const MAX_ROWS = 256;

const COUNTS_SQL = `SELECT
  (SELECT COUNT(*)::text FROM public.execution_attempts WHERE disposition IN ('claimed','running')) AS "attemptCount",
  (SELECT COUNT(*)::text FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined')) AS "sessionCount",
  (SELECT COUNT(*)::text FROM public.execution_attempts WHERE disposition IN ('claimed','running')
    AND (octet_length(attempt_id)>256 OR octet_length(run_id)>256 OR octet_length(fence_token)>64
      OR octet_length(source_before_sha)>64 OR octet_length(source_before_tree_hash)>64
      OR COALESCE(octet_length(worktree),0)>2048)) AS "oversizedAttemptCount",
  (SELECT COUNT(*)::text FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined')
    AND (octet_length(session_id)>256 OR octet_length(run_id)>256
      OR COALESCE(octet_length(attempt_id),0)>256 OR octet_length(owner_instance_id)>256
      OR COALESCE(octet_length(worktree),0)>2048)) AS "oversizedSessionCount"`;
const ATTEMPTS_SQL = `SELECT attempt_id AS "attemptId", run_id AS "runId", claim_id::text AS "claimId",
  generation, fence_token AS "fenceToken", source_before_sha AS "sourceSha",
  source_before_tree_hash AS "sourceTreeHash", worktree AS "worktreeRoot", disposition
  FROM public.execution_attempts WHERE disposition IN ('claimed','running')
  ORDER BY attempt_id COLLATE "C" LIMIT 257`;
const SESSIONS_SQL = `SELECT session_id AS "sessionId", run_id AS "runId", claim_id::text AS "claimId",
  attempt_id AS "attemptId", owner_instance_id AS "ownerInstanceId",
  worktree AS "worktreeRoot", state FROM public.runtime_sessions
  WHERE state NOT IN ('released','quarantined')
  ORDER BY session_id COLLATE "C" LIMIT 257`;

export type BindingRowsQueryV1 = (statement: string) => Promise<readonly Record<string, unknown>[]>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_BINDING_ROWS_INVALID"); }

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string"
    || !keys.includes(key) || !descriptors[key]!.enumerable || !Object.hasOwn(descriptors[key]!, "value"))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function rows(value: unknown, expected: number): readonly unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== expected || value.length > MAX_ROWS) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some((key) => {
    if (key === "length") return false;
    return typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)
      || Number(key) >= value.length || !descriptors[key]!.enumerable
      || !Object.hasOwn(descriptors[key]!, "value");
  })) fail();
  return Array.from({ length: value.length }, (_, index) => descriptors[String(index)]!.value as unknown);
}

function count(value: unknown): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail();
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail();
  return number;
}

function text(value: unknown, maxBytes: number): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")
    || Buffer.byteLength(value) > maxBytes || Buffer.from(value, "utf8").toString("utf8") !== value) fail();
  return value;
}

function optionalText(value: unknown, maxBytes: number): string | null {
  return value === null ? null : text(value, maxBytes);
}

function claimId(value: unknown, optional: boolean): string | null {
  if (value === null && optional) return null;
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)
    || BigInt(value) > 9_223_372_036_854_775_807n) fail();
  return value;
}

function oid(value: unknown): string {
  if (typeof value !== "string" || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) fail();
  return value;
}

function attempt(value: unknown) {
  const row = exact(value, ["attemptId", "runId", "claimId", "generation", "fenceToken",
    "sourceSha", "sourceTreeHash", "worktreeRoot", "disposition"]);
  if (!Number.isSafeInteger(row.generation) || (row.generation as number) <= 0
    || (row.disposition !== "claimed" && row.disposition !== "running")) fail();
  const attemptId = text(row.attemptId, 256);
  const fenceToken = row.fenceToken;
  if (typeof fenceToken !== "string" || !/^[a-f0-9]{64}$/.test(fenceToken)) fail();
  const generation = row.generation as number;
  return Object.freeze({ attemptId, runId: text(row.runId, 256), claimId: claimId(row.claimId, true),
    generation, fenceTokenHash: hashCanonicalJson({ schema: FENCE_SCHEMA, attemptId, generation, fenceToken }),
    sourceSha: oid(row.sourceSha), sourceTreeHash: oid(row.sourceTreeHash),
    worktreeRoot: optionalText(row.worktreeRoot, 2048), disposition: row.disposition });
}

function session(value: unknown) {
  const row = exact(value, ["sessionId", "runId", "claimId", "attemptId", "ownerInstanceId",
    "worktreeRoot", "state"]);
  if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(row.state as string)) fail();
  return Object.freeze({ sessionId: text(row.sessionId, 256), runId: text(row.runId, 256),
    claimId: claimId(row.claimId, false)!, attemptId: optionalText(row.attemptId, 256),
    ownerInstanceId: text(row.ownerInstanceId, 256), worktreeRoot: optionalText(row.worktreeRoot, 2048),
    state: row.state });
}

function ordered<T>(value: readonly T[], key: (row: T) => string): readonly T[] {
  for (let index = 1; index < value.length; index += 1) {
    if (Buffer.compare(Buffer.from(key(value[index - 1]!), "utf8"), Buffer.from(key(value[index]!), "utf8")) >= 0) fail();
  }
  return Object.freeze(value);
}

export async function observePositiveWorktreeBindingRowsInTransactionV1(query: BindingRowsQueryV1) {
  const rawCounts = exact(rows(await query(COUNTS_SQL), 1)[0], ["attemptCount", "sessionCount",
    "oversizedAttemptCount", "oversizedSessionCount"]);
  const attemptCount = count(rawCounts.attemptCount);
  const sessionCount = count(rawCounts.sessionCount);
  if (attemptCount > MAX_ROWS || sessionCount > MAX_ROWS
    || count(rawCounts.oversizedAttemptCount) !== 0 || count(rawCounts.oversizedSessionCount) !== 0) fail();
  const activeAttempts = ordered(rows(await query(ATTEMPTS_SQL), attemptCount).map(attempt), row => row.attemptId);
  const activeSessions = ordered(rows(await query(SESSIONS_SQL), sessionCount).map(session), row => row.sessionId);
  const attemptsById = new Map(activeAttempts.map(row => [row.attemptId, row]));
  for (const current of activeSessions) {
    if (current.attemptId === null) continue;
    const prior = attemptsById.get(current.attemptId);
    if (prior && (prior.runId !== current.runId || prior.claimId !== current.claimId
      || prior.worktreeRoot !== current.worktreeRoot)) fail();
  }
  const counts = Object.freeze({ attemptCount, sessionCount });
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, activeAttempts, activeSessions, counts };
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}
