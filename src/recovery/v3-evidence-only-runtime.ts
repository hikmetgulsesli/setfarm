import type postgres from "postgres";

import { getSql } from "../db-pg.js";
import { runImplementEvidenceIfRequested } from "../installer/implement-evidence-runner.js";
import { captureShadowSourceRevision } from "../execution/shadow-attempt-recorder.js";
import {
  loadV3ImplementationAttemptContext,
  reserveV3EvidenceOnlyImplementationAttempt,
} from "../execution/v3-implementation-attempt.js";
import {
  createV3EvidenceOnlyPublication,
  type V3EvidenceOnlyPublicationLeaseV1,
} from "./v3-evidence-only-publication.js";
import type {
  V3EvidenceOnlyLeaseV1,
  V3EvidenceOnlyWorkerDependencies,
} from "./v3-evidence-only-worker.js";

type Sql = postgres.Sql;

type SourceOwnerRow = Readonly<{
  attempt_id: string;
  branch: string | null;
  worktree: string | null;
}>;

export class V3EvidenceOnlyRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3EvidenceOnlyRuntimeError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3EvidenceOnlyRuntimeError(code, message);
}

function publicationLease(lease: V3EvidenceOnlyLeaseV1): V3EvidenceOnlyPublicationLeaseV1 {
  return {
    mode: "fresh_execution",
    runId: lease.runId,
    stepDbId: lease.stepDbId,
    storyDbId: lease.storyDbId,
    storyId: lease.storyId,
    recoveryCaseId: lease.recoveryCaseId,
    revisionId: lease.revisionId,
    dispatchId: lease.dispatchId,
    packetHash: lease.packetHash,
    contractSliceHash: lease.contractSliceHash,
    findingSetHash: lease.findingSetHash,
    sourceRevision: lease.sourceRevision,
    evidencePlan: lease.evidencePlan,
    ...(lease.priorEvidencePlanArtifactHash
      ? { priorEvidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash }
      : {}),
    ownerInstanceId: lease.ownerInstanceId,
    leaseToken: lease.leaseToken,
    leaseExpiresAt: lease.leaseExpiresAt,
  };
}

async function resolveExactPriorSourceOwner(
  sql: Sql,
  lease: V3EvidenceOnlyLeaseV1,
): Promise<Readonly<{ worktree: string; branch: string }>> {
  const rows = await sql.unsafe<SourceOwnerRow[]>(
    `SELECT attempt.attempt_id, attempt.branch, attempt.worktree
       FROM recovery_cases recovery_case
       CROSS JOIN LATERAL jsonb_array_elements_text(
         recovery_case.prior_attempt_refs::jsonb
       ) AS prior(attempt_id)
       JOIN execution_attempts attempt
         ON attempt.attempt_id = prior.attempt_id
      WHERE recovery_case.recovery_case_id = $1
        AND recovery_case.current_revision_id = $2
        AND recovery_case.run_id = $3
        AND recovery_case.story_id = $4
        AND recovery_case.packet_hash = $5
        AND recovery_case.slice_hash = $6
        AND recovery_case.finding_set_hash = $7
        AND recovery_case.source_sha = $8
        AND recovery_case.source_tree_hash = $9
        AND attempt.run_id = recovery_case.run_id
        AND attempt.step_id = 'implement'
        AND attempt.story_id = recovery_case.story_id
        AND attempt.packet_hash = recovery_case.packet_hash
        AND attempt.source_after_sha = recovery_case.source_sha
        AND attempt.source_after_tree_hash = recovery_case.source_tree_hash
        AND attempt.disposition NOT IN ('claimed', 'running', 'superseded')
        AND attempt.worktree IS NOT NULL
        AND attempt.branch IS NOT NULL
      ORDER BY attempt.attempt_id
      LIMIT 50`,
    [
      lease.recoveryCaseId,
      lease.revisionId,
      lease.runId,
      lease.storyId,
      lease.packetHash,
      lease.contractSliceHash,
      lease.findingSetHash,
      lease.sourceRevision.sha,
      lease.sourceRevision.treeHash,
    ],
  );
  if (rows.length === 0) {
    fail(
      "V3_EVIDENCE_ONLY_SOURCE_OWNER_MISSING",
      "current recovery case has no terminal prior attempt owning the exact unchanged source worktree",
    );
  }
  const identities = new Map<string, { worktree: string; branch: string }>();
  for (const row of rows) {
    if (!row.worktree || !row.branch) continue;
    identities.set(`${row.worktree}\u0000${row.branch}`, {
      worktree: row.worktree,
      branch: row.branch,
    });
  }
  if (identities.size !== 1) {
    fail(
      "V3_EVIDENCE_ONLY_SOURCE_OWNER_AMBIGUOUS",
      "current recovery case prior attempts disagree on the exact source worktree or branch",
    );
  }
  return [...identities.values()][0]!;
}

/**
 * Production dependency owner for the non-model evidence-only worker.
 * It deliberately exposes no prompt, model session, story mutation, or legacy
 * claim path: the sealed compiler, operational publication transaction, typed
 * evidence runner, and coordinator are the complete execution boundary.
 */
export function createV3EvidenceOnlyRuntimeDependencies(
  sql: Sql = getSql(),
): V3EvidenceOnlyWorkerDependencies {
  const publication = createV3EvidenceOnlyPublication(sql);
  return Object.freeze({
    async loadOrReserveAttempt({ lease }) {
      if (lease.mode === "fresh_execution") {
        const owner = await resolveExactPriorSourceOwner(sql, lease);
        const compiled = await reserveV3EvidenceOnlyImplementationAttempt({
          lease: publicationLease(lease),
          worktree: owner.worktree,
          branch: owner.branch,
        });
        return {
          attempt: compiled.attempt,
          workdir: owner.worktree,
          slice: compiled.slice,
          sliceHash: compiled.sliceHash,
          evidencePlan: compiled.evidencePlan,
          evidencePlanArtifactHash: compiled.evidencePlanArtifactHash,
        };
      }

      if (!lease.attemptId) {
        fail("V3_EVIDENCE_ONLY_REPLAY_ATTEMPT_MISSING", "coordinator replay has no terminal attempt identity");
      }
      const compiled = await loadV3ImplementationAttemptContext({
        runId: lease.runId,
        storyId: lease.storyId,
        attemptId: lease.attemptId,
      });
      if (!compiled.attempt.worktree) {
        fail("V3_EVIDENCE_ONLY_REPLAY_WORKTREE_MISSING", "terminal evidence-only attempt has no exact source worktree");
      }
      return {
        attempt: compiled.attempt,
        workdir: compiled.attempt.worktree,
        slice: compiled.slice,
        sliceHash: compiled.sliceHash,
        evidencePlan: compiled.evidencePlan,
        evidencePlanArtifactHash: compiled.evidencePlanArtifactHash,
      };
    },

    captureSource: (workdir) => captureShadowSourceRevision(workdir),

    async executeEvidence({ lease, context }) {
      const result = await runImplementEvidenceIfRequested({
        runId: lease.runId,
        storyId: lease.storyId,
        workdir: context.workdir,
        stackPackId: context.slice.runtimeEvidence?.stackPackId,
        v3: {
          slice: context.slice,
          sliceHash: context.sliceHash,
          attemptId: context.attempt.attemptId,
          sourceRevision: lease.sourceRevision,
        },
      });
      if (!result.canonicalEvidence) {
        fail(
          "V3_EVIDENCE_ONLY_CANONICAL_RESULT_MISSING",
          "typed evidence execution completed without one canonical evidence bundle",
        );
      }
      return result.canonicalEvidence;
    },

    completeClaim: ({ lease, attempt, diagnostic }) => publication.completeClaim({
      lease: publicationLease(lease),
      attempt,
      diagnostic,
    }),
  });
}
