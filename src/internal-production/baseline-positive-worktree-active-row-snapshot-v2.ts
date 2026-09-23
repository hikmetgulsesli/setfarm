import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { types } from "node:util";

// Diagnostic only. PostgreSQL path text is not physical identity or cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-active-rows.v2";
const MODE = "isolation level repeatable read read only";
const MAX_ROWS = 256;

export type ActiveOwnerRowSnapshotV2 = Readonly<{
  schema: typeof SCHEMA;
  authority: "diagnostic-only";
  physicalIdentityProvenance: "unverified";
  activeRuns: readonly Readonly<Record<string, unknown>>[];
  openClaims: readonly Readonly<Record<string, unknown>>[];
  activeAttempts: readonly Readonly<Record<string, unknown>>[];
  activeSessions: readonly Readonly<Record<string, unknown>>[];
  counts: Readonly<{ runCount: number; claimCount: number; attemptCount: number; sessionCount: number }>;
  snapshotHash: string;
}>;

export type ActiveOwnerRowQueryV2 = (statement: string) => Promise<readonly Record<string, unknown>[]>;
export type ActiveOwnerRowBeginV2 = (mode: typeof MODE,
  operation: (query: ActiveOwnerRowQueryV2) => Promise<ActiveOwnerRowSnapshotV2>) => Promise<ActiveOwnerRowSnapshotV2>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID"); }

// postgres.js returns Result extends Array with non-row metadata. Strip only the
// container metadata at the DB boundary; the strict row/array parser remains below.
export function normalizeActiveOwnerRowPgResultV2(
  result: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  if (!Array.isArray(result) || types.isProxy(result) || result.length > MAX_ROWS + 1
    || Object.getPrototypeOf(Object.getPrototypeOf(result)) !== Array.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(result);
  const metadata = ["count", "state", "command", "columns", "statement"];
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== result.length + metadata.length + 1) fail();
  for (const key of metadata) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable || !('value' in descriptor)) fail();
  }
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < result.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail();
    rows.push(descriptor.value as Record<string, unknown>);
  }
  return rows;
}

const COUNTS_SQL = `SELECT
  (SELECT COUNT(*)::text FROM public.runs WHERE status IN ('running','resuming','cancelling','failing')) AS "runCount",
  (SELECT COUNT(*)::text FROM public.claim_log WHERE outcome IS NULL) AS "claimCount",
  (SELECT COUNT(*)::text FROM public.execution_attempts WHERE disposition IN ('claimed','running')) AS "attemptCount",
  (SELECT COUNT(*)::text FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined')) AS "sessionCount",
  (SELECT COUNT(*)::text FROM public.runs WHERE status IN ('running','resuming','cancelling','failing')
    AND (octet_length(id)>256 OR octet_length(status)>256)) AS "oversizedRunCount",
  (SELECT COUNT(*)::text FROM public.claim_log WHERE outcome IS NULL
    AND (octet_length(run_id)>256 OR octet_length(step_id)>256
      OR COALESCE(octet_length(story_id),0)>256 OR octet_length(agent_id)>256)) AS "oversizedClaimCount",
  (SELECT COUNT(*)::text FROM public.execution_attempts WHERE disposition IN ('claimed','running')
    AND (octet_length(attempt_id)>256 OR octet_length(run_id)>256 OR octet_length(step_id)>256
      OR octet_length(story_id)>256 OR COALESCE(octet_length(worktree),0)>2048
      OR octet_length(disposition)>256)) AS "oversizedAttemptCount",
  (SELECT COUNT(*)::text FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined')
    AND (octet_length(session_id)>256 OR octet_length(run_id)>256
      OR COALESCE(octet_length(attempt_id),0)>256 OR COALESCE(octet_length(worktree),0)>2048
      OR octet_length(state)>256 OR octet_length(owner_instance_id)>256)) AS "oversizedSessionCount"`;

const RUNS_SQL = `SELECT id AS "runId", status FROM public.runs
  WHERE status IN ('running','resuming','cancelling','failing') ORDER BY id COLLATE "C" LIMIT 257`;
const CLAIMS_SQL = `SELECT id::text AS "claimId", run_id AS "runId", step_id AS "stepId",
  story_id AS "storyId", agent_id AS "agentId" FROM public.claim_log
  WHERE outcome IS NULL ORDER BY id LIMIT 257`;
const ATTEMPTS_SQL = `SELECT attempt_id AS "attemptId", run_id AS "runId", step_id AS "stepId",
  story_id AS "storyId", claim_id::text AS "claimId", worktree AS "worktreeRoot",
  disposition FROM public.execution_attempts
  WHERE disposition IN ('claimed','running') ORDER BY attempt_id COLLATE "C" LIMIT 257`;
const SESSIONS_SQL = `SELECT session_id AS "sessionId", run_id AS "runId", claim_id::text AS "claimId",
  attempt_id AS "attemptId", worktree AS "worktreeRoot", state,
  owner_instance_id AS "ownerInstanceId" FROM public.runtime_sessions
  WHERE state NOT IN ('released','quarantined') ORDER BY session_id COLLATE "C" LIMIT 257`;

function decimal(value: unknown): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail();
  return parsed;
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key)
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function text(value: unknown, maxBytes: number, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || value.includes("\0")
    || Buffer.byteLength(value) > maxBytes || Buffer.from(value, "utf8").toString("utf8") !== value) fail();
  return value;
}

function optionalText(value: unknown, maxBytes: number, allowEmpty = false): string | null {
  return value === null ? null : text(value, maxBytes, allowEmpty);
}

function claimId(value: unknown, optional = false): string | null {
  if (value === null && optional) return null;
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)
    || BigInt(value) > 9_223_372_036_854_775_807n) fail();
  return value;
}

function array(value: unknown, expected: number): readonly unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== expected || value.length > MAX_ROWS) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expected + 1 || keys.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= expected) return true;
    return !descriptors[key]!.enumerable || !("value" in descriptors[key]!);
  })) fail();
  return Array.from({ length: expected }, (_, index) => descriptors[String(index)]!.value as unknown);
}

function counts(value: unknown): ActiveOwnerRowSnapshotV2["counts"] {
  const keys = ["runCount", "claimCount", "attemptCount", "sessionCount",
    "oversizedRunCount", "oversizedClaimCount", "oversizedAttemptCount", "oversizedSessionCount"];
  const row = exact(array(value, 1)[0], keys);
  const parsed = Object.fromEntries(keys.map((key) => [key, decimal(row[key])])) as Record<string, number>;
  if (keys.slice(4).some((key) => parsed[key] !== 0) || keys.slice(0, 4).some((key) => parsed[key]! > MAX_ROWS)) fail();
  return Object.freeze({ runCount: parsed.runCount!, claimCount: parsed.claimCount!,
    attemptCount: parsed.attemptCount!, sessionCount: parsed.sessionCount! });
}

type RowKind = "run" | "claim" | "attempt" | "session";

function parsedRow(value: unknown, kind: RowKind): Readonly<Record<string, unknown>> {
  if (kind === "run") {
    const row = exact(value, ["runId", "status"]);
    const status = text(row.status, 256);
    if (!["running", "resuming", "cancelling", "failing"].includes(status)) fail();
    return Object.freeze({ runId: text(row.runId, 256), status });
  }
  if (kind === "claim") {
    const row = exact(value, ["claimId", "runId", "stepId", "storyId", "agentId"]);
    return Object.freeze({ claimId: claimId(row.claimId), runId: text(row.runId, 256),
      stepId: text(row.stepId, 256), storyId: optionalText(row.storyId, 256, true),
      agentId: text(row.agentId, 256) });
  }
  if (kind === "attempt") {
    const row = exact(value, ["attemptId", "runId", "stepId", "storyId", "claimId", "worktreeRoot", "disposition"]);
    const disposition = text(row.disposition, 256);
    if (disposition !== "claimed" && disposition !== "running") fail();
    return Object.freeze({ attemptId: text(row.attemptId, 256), runId: text(row.runId, 256),
      stepId: text(row.stepId, 256), storyId: text(row.storyId, 256, true),
      claimId: claimId(row.claimId, true), worktreeRoot: optionalText(row.worktreeRoot, 2048, true),
      disposition });
  }
  const row = exact(value, ["sessionId", "runId", "claimId", "attemptId", "worktreeRoot", "state", "ownerInstanceId"]);
  const state = text(row.state, 256);
  if (!["reserved", "starting", "running", "drain_requested", "drained"].includes(state)) fail();
  return Object.freeze({ sessionId: text(row.sessionId, 256), runId: text(row.runId, 256),
    claimId: claimId(row.claimId), attemptId: optionalText(row.attemptId, 256),
    worktreeRoot: optionalText(row.worktreeRoot, 2048, true), state,
    ownerInstanceId: text(row.ownerInstanceId, 256) });
}

function rows(value: unknown, expected: number, kind: RowKind): readonly Readonly<Record<string, unknown>>[] {
  const result = array(value, expected).map((row) => parsedRow(row, kind));
  for (let index = 1; index < result.length; index += 1) {
    const key = kind === "run" ? "runId" : kind === "claim" ? "claimId"
      : kind === "attempt" ? "attemptId" : "sessionId";
    const previous = result[index - 1]![key] as string;
    const current = result[index]![key] as string;
    if (kind === "claim" ? BigInt(previous) >= BigInt(current)
      : Buffer.compare(Buffer.from(previous, "utf8"), Buffer.from(current, "utf8")) >= 0) fail();
  }
  return Object.freeze(result);
}

export async function observePositiveWorktreeActiveRowSnapshotInTransactionV2(
  query: ActiveOwnerRowQueryV2,
): Promise<ActiveOwnerRowSnapshotV2> {
  const observedCounts = counts(await query(COUNTS_SQL));
  const activeRuns = rows(await query(RUNS_SQL), observedCounts.runCount, "run");
  const openClaims = rows(await query(CLAIMS_SQL), observedCounts.claimCount, "claim");
  const activeAttempts = rows(await query(ATTEMPTS_SQL), observedCounts.attemptCount, "attempt");
  const activeSessions = rows(await query(SESSIONS_SQL), observedCounts.sessionCount, "session");
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    activeRuns, openClaims, activeAttempts, activeSessions, counts: observedCounts } as const;
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreeActiveRowSnapshotWithTransactionV2(
  begin: ActiveOwnerRowBeginV2,
): Promise<ActiveOwnerRowSnapshotV2> {
  return begin(MODE, observePositiveWorktreeActiveRowSnapshotInTransactionV2);
}
