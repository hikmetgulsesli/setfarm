import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

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

function counts(value: unknown): ActiveOwnerRowSnapshotV2["counts"] {
  if (!Array.isArray(value) || value.length !== 1 || value[0] === null || typeof value[0] !== "object") fail();
  const row = value[0] as Record<string, unknown>;
  const keys = ["runCount", "claimCount", "attemptCount", "sessionCount",
    "oversizedRunCount", "oversizedClaimCount", "oversizedAttemptCount", "oversizedSessionCount"];
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key))) fail();
  const parsed = Object.fromEntries(keys.map((key) => [key, decimal(row[key])])) as Record<string, number>;
  if (keys.slice(4).some((key) => parsed[key] !== 0) || keys.slice(0, 4).some((key) => parsed[key]! > MAX_ROWS)) fail();
  return Object.freeze({ runCount: parsed.runCount!, claimCount: parsed.claimCount!,
    attemptCount: parsed.attemptCount!, sessionCount: parsed.sessionCount! });
}

function emptyRows(value: unknown, expected: number): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length !== expected || value.length > MAX_ROWS || expected !== 0) fail();
  return Object.freeze([]);
}

export async function observePositiveWorktreeActiveRowSnapshotInTransactionV2(
  query: ActiveOwnerRowQueryV2,
): Promise<ActiveOwnerRowSnapshotV2> {
  const observedCounts = counts(await query(COUNTS_SQL));
  const activeRuns = emptyRows(await query(RUNS_SQL), observedCounts.runCount);
  const openClaims = emptyRows(await query(CLAIMS_SQL), observedCounts.claimCount);
  const activeAttempts = emptyRows(await query(ATTEMPTS_SQL), observedCounts.attemptCount);
  const activeSessions = emptyRows(await query(SESSIONS_SQL), observedCounts.sessionCount);
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
