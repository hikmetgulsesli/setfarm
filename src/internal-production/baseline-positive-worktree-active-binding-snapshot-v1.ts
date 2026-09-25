import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observePositiveWorktreeActiveRowSnapshotInTransactionV2,
  type ActiveOwnerRowQueryV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import { observePositiveWorktreeBindingRowsInTransactionV1 } from "./baseline-positive-worktree-binding-rows-v1.js";

// This non-pre32 snapshot can display positive active rows. Its text paths and
// hash-only fence commitments are not physical provenance or cutover authority.
const MODE = "isolation level repeatable read read only";
const SCHEMA = "setfarm.internal-production-positive-worktree-active-binding-snapshot.v1";

export type ActiveBindingBeginV1 = <T>(mode: typeof MODE,
  operation: (query: ActiveOwnerRowQueryV2) => Promise<T>) => Promise<T>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_SNAPSHOT_INVALID"); }

export async function observePositiveWorktreeActiveBindingSnapshotInTransactionV1(query: ActiveOwnerRowQueryV2) {
  const activeRows = await observePositiveWorktreeActiveRowSnapshotInTransactionV2(query);
  const bindingRows = await observePositiveWorktreeBindingRowsInTransactionV1(query);
  if (activeRows.counts.attemptCount !== bindingRows.counts.attemptCount
    || activeRows.counts.sessionCount !== bindingRows.counts.sessionCount) fail();
  for (let index = 0; index < activeRows.activeAttempts.length; index += 1) {
    const active = activeRows.activeAttempts[index]!, binding = bindingRows.activeAttempts[index]!;
    if ((["attemptId", "runId", "claimId", "worktreeRoot", "disposition"] as const)
      .some(key => active[key] !== binding[key])) fail();
  }
  for (let index = 0; index < activeRows.activeSessions.length; index += 1) {
    const active = activeRows.activeSessions[index]!, binding = bindingRows.activeSessions[index]!;
    if ((["sessionId", "runId", "claimId", "attemptId", "ownerInstanceId", "worktreeRoot", "state"] as const)
      .some(key => active[key] !== binding[key])) fail();
  }
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, activeRows, bindingRows };
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreeActiveBindingSnapshotWithTransactionV1(begin: ActiveBindingBeginV1) {
  return begin(MODE, observePositiveWorktreeActiveBindingSnapshotInTransactionV1);
}
