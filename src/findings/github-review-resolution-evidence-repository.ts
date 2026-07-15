import type postgres from "postgres";

import { FindingSetV1Schema } from "./finding-set.js";
import {
  GithubReviewResolutionEvidenceV1Schema,
  githubReviewResolutionTerminalResultV1,
  type GithubReviewResolutionEvidenceV1,
} from "./github-review-resolution-evidence.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from "../recovery/v3-recovery-run-mutation-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type ResolutionRow = Readonly<{
  evidence_hash: string;
  run_id: string;
  story_id: string;
  packet_hash: string;
  contract_slice_hash: string;
  recovery_case_id: string;
  recovery_case_revision_id: string;
  recovery_dispatch_id: string;
  attempt_id: string;
  finding_set_hash: string;
  repository_node_id: string;
  repository_owner: string;
  repository_name: string;
  pr_number: number;
  original_head_sha: string;
  original_source_tree_hash: string;
  observed_head_sha: string;
  observed_source_tree_hash: string;
  thread_ids: unknown;
  original_artifact_hashes: unknown;
  payload: unknown;
}>;

type AuthorityRow = Readonly<{
  case_run_id: string;
  case_story_id: string;
  case_finding_set_hash: string;
  case_packet_hash: string;
  case_slice_hash: string;
  case_source_sha: string;
  case_source_tree_hash: string;
  case_owner: string;
  case_status: string;
  current_revision_id: string | null;
  finding_payload: unknown;
  revision_run_id: string;
  revision_story_id: string;
  revision_finding_set_hash: string;
  revision_packet_hash: string;
  revision_slice_hash: string;
  revision_source_sha: string;
  revision_source_tree_hash: string;
  revision_owner: string;
  dispatch_class: string;
  dispatch_run_id: string;
  dispatch_story_id: string;
  dispatch_finding_set_hash: string;
  dispatch_packet_hash: string;
  dispatch_slice_hash: string;
  dispatch_source_sha: string;
  dispatch_source_tree_hash: string;
  delivery_state: string;
  delivery_attempt_id: string | null;
  execution_slice_hash: string | null;
  attempt_run_id: string;
  attempt_story_id: string;
  attempt_class: string;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_finding_set_hash: string | null;
  attempt_source_before_sha: string;
  attempt_source_before_tree_hash: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_disposition: string;
}>;

type ResolutionCommitRow = Readonly<{
  case_status: string;
  case_owner: string;
  case_state_version: number;
  case_current_revision_id: string | null;
  case_resolution_hash: string | null;
  case_terminal: unknown | null;
  case_prior_attempt_refs: unknown;
  case_decision_refs: unknown;
  delivery_state: string;
  delivery_terminal_result: unknown;
  attempt_disposition: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
}>;

async function one<T>(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  query: string,
  params: unknown[],
): Promise<T | undefined> {
  const rows = await sql.unsafe<T[]>(query, params as any[]);
  return rows[0];
}

function stringArray(value: unknown, code: string): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new GithubReviewResolutionEvidenceRepositoryError(code, "Stored resolution identity is not a string array");
  }
  return parsed;
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

export class GithubReviewResolutionEvidenceRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "GithubReviewResolutionEvidenceRepositoryError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new GithubReviewResolutionEvidenceRepositoryError(code, message);
}

function assertRowIdentity(row: ResolutionRow): GithubReviewResolutionEvidenceV1 {
  const evidence = GithubReviewResolutionEvidenceV1Schema.parse(row.payload);
  const threadIds = evidence.threads.map((thread) => thread.threadId);
  const artifactHashes = evidence.threads.map((thread) => thread.originalEvidenceArtifactHash).sort();
  if (
    row.evidence_hash !== evidence.evidenceHash
    || row.run_id !== evidence.runId
    || row.story_id !== evidence.storyId
    || row.packet_hash !== evidence.packetHash
    || row.contract_slice_hash !== evidence.contractSliceHash
    || row.recovery_case_id !== evidence.recoveryCaseId
    || row.recovery_case_revision_id !== evidence.recoveryCaseRevisionId
    || row.recovery_dispatch_id !== evidence.recoveryDispatchId
    || row.attempt_id !== evidence.attemptId
    || row.finding_set_hash !== evidence.findingSetHash
    || row.repository_node_id !== evidence.repository.nodeId
    || row.repository_owner !== evidence.repository.owner
    || row.repository_name !== evidence.repository.name
    || Number(row.pr_number) !== evidence.prNumber
    || row.original_head_sha !== evidence.originalHeadSha
    || row.original_source_tree_hash !== evidence.originalSourceRevision.treeHash
    || row.observed_head_sha !== evidence.observedHeadSha
    || row.observed_source_tree_hash !== evidence.observedSourceRevision.treeHash
    || !sameCanonical(stringArray(row.thread_ids, "GITHUB_REVIEW_RESOLUTION_THREAD_IDS_INVALID"), threadIds)
    || !sameCanonical(
      stringArray(row.original_artifact_hashes, "GITHUB_REVIEW_RESOLUTION_ARTIFACT_HASHES_INVALID"),
      artifactHashes,
    )
  ) {
    fail("GITHUB_REVIEW_RESOLUTION_ROW_IDENTITY_MISMATCH", "Stored columns differ from the immutable payload");
  }
  return evidence;
}

function assertExactAuthority(row: AuthorityRow, evidence: GithubReviewResolutionEvidenceV1): void {
  const findingSet = FindingSetV1Schema.parse(row.finding_payload);
  const authorityChecks: Readonly<Record<string, boolean>> = {
    "case.runId": row.case_run_id === evidence.runId,
    "case.storyId": row.case_story_id === evidence.storyId,
    "case.findingSetHash": row.case_finding_set_hash === evidence.findingSetHash,
    "case.packetHash": row.case_packet_hash === evidence.packetHash,
    "case.contractSliceHash": row.case_slice_hash === evidence.contractSliceHash,
    "case.sourceSha": row.case_source_sha === evidence.originalSourceRevision.sha,
    "case.sourceTreeHash": row.case_source_tree_hash === evidence.originalSourceRevision.treeHash,
    "case.owner": row.case_owner === "supervisor",
    "case.active": ["open", "repairing", "evidencing"].includes(row.case_status),
    "case.currentRevisionId": row.current_revision_id === evidence.recoveryCaseRevisionId,
    "revision.runId": row.revision_run_id === evidence.runId,
    "revision.storyId": row.revision_story_id === evidence.storyId,
    "revision.findingSetHash": row.revision_finding_set_hash === evidence.findingSetHash,
    "revision.packetHash": row.revision_packet_hash === evidence.packetHash,
    "revision.contractSliceHash": row.revision_slice_hash === evidence.contractSliceHash,
    "revision.sourceSha": row.revision_source_sha === evidence.originalSourceRevision.sha,
    "revision.sourceTreeHash": row.revision_source_tree_hash === evidence.originalSourceRevision.treeHash,
    "revision.owner": row.revision_owner === "supervisor",
    "dispatch.class": row.dispatch_class === "supervisor_repair",
    "dispatch.runId": row.dispatch_run_id === evidence.runId,
    "dispatch.storyId": row.dispatch_story_id === evidence.storyId,
    "dispatch.findingSetHash": row.dispatch_finding_set_hash === evidence.findingSetHash,
    "dispatch.packetHash": row.dispatch_packet_hash === evidence.packetHash,
    "dispatch.contractSliceHash": row.dispatch_slice_hash === evidence.contractSliceHash,
    "dispatch.sourceSha": row.dispatch_source_sha === evidence.originalSourceRevision.sha,
    "dispatch.sourceTreeHash": row.dispatch_source_tree_hash === evidence.originalSourceRevision.treeHash,
    "delivery.attemptId": row.delivery_attempt_id === evidence.attemptId,
    "delivery.active": ["attempt_reserved", "running"].includes(row.delivery_state),
    "delivery.executionSliceHash": row.execution_slice_hash === row.attempt_slice_hash,
    "attempt.runId": row.attempt_run_id === evidence.runId,
    "attempt.storyId": row.attempt_story_id === evidence.storyId,
    "attempt.class": row.attempt_class === "supervisor_repair",
    "attempt.packetHash": row.attempt_packet_hash === evidence.packetHash,
    "attempt.findingSetHash": row.attempt_finding_set_hash === evidence.findingSetHash,
    "attempt.sourceBeforeSha": row.attempt_source_before_sha === evidence.originalSourceRevision.sha,
    "attempt.sourceBeforeTreeHash": row.attempt_source_before_tree_hash === evidence.originalSourceRevision.treeHash,
    "attempt.sourceAfterSha": row.attempt_source_after_sha === evidence.observedSourceRevision.sha,
    "attempt.sourceAfterTreeHash": row.attempt_source_after_tree_hash === evidence.observedSourceRevision.treeHash,
    "attempt.terminal": !["claimed", "running", "superseded"].includes(row.attempt_disposition),
  };
  const mismatches = Object.entries(authorityChecks)
    .filter(([, matches]) => !matches)
    .map(([field]) => field);
  if (mismatches.length > 0) {
    fail(
      "GITHUB_REVIEW_RESOLUTION_RECOVERY_AUTHORITY_MISMATCH",
      `Resolution does not match one active terminal supervisor attempt: ${mismatches.join(",")}`,
    );
  }
  if (
    findingSet.findingSetHash !== evidence.findingSetHash
    || findingSet.runId !== evidence.runId
    || findingSet.storyId !== evidence.storyId
    || findingSet.packetHash !== evidence.packetHash
    || findingSet.sliceHash !== evidence.contractSliceHash
    || findingSet.sourceRevision.sha !== evidence.originalSourceRevision.sha
    || findingSet.sourceRevision.treeHash !== evidence.originalSourceRevision.treeHash
    || findingSet.findings.length !== evidence.threads.length
  ) {
    fail("GITHUB_REVIEW_RESOLUTION_FINDING_SET_MISMATCH", "Resolution finding-set identity is stale or incomplete");
  }
  const evidenceByFinding = new Map(evidence.threads.map((thread) => [thread.findingId, thread]));
  for (const finding of findingSet.findings) {
    const thread = evidenceByFinding.get(finding.findingId);
    const external = finding.externalRef;
    if (
      !thread
      || finding.classification !== "unstructured_review"
      || finding.origin !== "review"
      || finding.invariantRef !== "INV_UNSTRUCTURED_REVIEW"
      || finding.status !== "open"
      || finding.observedEvidenceRefs.length !== 1
      || finding.observedEvidenceRefs[0] !== thread.originalEvidenceArtifactHash
      || !external
      || external.repositoryNodeId !== evidence.repository.nodeId
      || external.prNumber !== evidence.prNumber
      || external.threadId !== thread.threadId
      || external.headSha !== evidence.originalHeadSha
      || external.commentRevisionHash !== thread.originalBodyRevisionHash
    ) {
      fail("GITHUB_REVIEW_RESOLUTION_THREAD_SET_MISMATCH", "Resolution is missing, stale, or adds an original review thread");
    }
  }
}

export type PutGithubReviewResolutionEvidenceResult =
  | Readonly<{ status: "inserted"; evidence: GithubReviewResolutionEvidenceV1 }>
  | Readonly<{ status: "duplicate"; evidence: GithubReviewResolutionEvidenceV1 }>;

export function createGithubReviewResolutionEvidenceRepository(sql: Sql) {
  return Object.freeze({
    async findByHash(evidenceHash: string): Promise<GithubReviewResolutionEvidenceV1 | undefined> {
      const row = await one<ResolutionRow>(
        sql,
        "SELECT * FROM github_review_resolution_evidence WHERE evidence_hash = $1",
        [evidenceHash],
      );
      return row ? assertRowIdentity(row) : undefined;
    },

    async put(input: unknown): Promise<PutGithubReviewResolutionEvidenceResult> {
      const evidence = GithubReviewResolutionEvidenceV1Schema.parse(input);
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [evidence.evidenceHash]);
        const existing = await one<ResolutionRow>(
          transaction,
          "SELECT * FROM github_review_resolution_evidence WHERE evidence_hash = $1 FOR KEY SHARE",
          [evidence.evidenceHash],
        );
        if (existing) {
          const stored = assertRowIdentity(existing);
          if (!sameCanonical(stored, evidence)) {
            fail("GITHUB_REVIEW_RESOLUTION_HASH_COLLISION", "Existing immutable evidence has different content");
          }
          return { status: "duplicate" as const, evidence: stored };
        }
        const authority = await one<AuthorityRow>(
          transaction,
          `SELECT recovery.run_id AS case_run_id,
                  recovery.story_id AS case_story_id,
                  recovery.finding_set_hash AS case_finding_set_hash,
                  recovery.packet_hash AS case_packet_hash,
                  recovery.slice_hash AS case_slice_hash,
                  recovery.source_sha AS case_source_sha,
                  recovery.source_tree_hash AS case_source_tree_hash,
                  recovery.owner AS case_owner,
                  recovery.status AS case_status,
                  recovery.current_revision_id,
                  finding.payload AS finding_payload,
                  revision.run_id AS revision_run_id,
                  revision.story_id AS revision_story_id,
                  revision.finding_set_hash AS revision_finding_set_hash,
                  revision.packet_hash AS revision_packet_hash,
                  revision.contract_slice_hash AS revision_slice_hash,
                  revision.source_sha AS revision_source_sha,
                  revision.source_tree_hash AS revision_source_tree_hash,
                  revision.owner AS revision_owner,
                  dispatch.dispatch_class,
                  revision.run_id AS dispatch_run_id,
                  revision.story_id AS dispatch_story_id,
                  dispatch.finding_set_hash AS dispatch_finding_set_hash,
                  dispatch.packet_hash AS dispatch_packet_hash,
                  dispatch.contract_slice_hash AS dispatch_slice_hash,
                  dispatch.source_sha AS dispatch_source_sha,
                  dispatch.source_tree_hash AS dispatch_source_tree_hash,
                  delivery.state AS delivery_state,
                  delivery.attempt_id AS delivery_attempt_id,
                  delivery.execution_slice_hash,
                  attempt.run_id AS attempt_run_id,
                  attempt.story_id AS attempt_story_id,
                  attempt.attempt_class,
                  attempt.packet_hash AS attempt_packet_hash,
                  attempt.slice_hash AS attempt_slice_hash,
                  attempt.finding_set_hash AS attempt_finding_set_hash,
                  attempt.source_before_sha AS attempt_source_before_sha,
                  attempt.source_before_tree_hash AS attempt_source_before_tree_hash,
                  attempt.source_after_sha AS attempt_source_after_sha,
                  attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
                  attempt.disposition AS attempt_disposition
             FROM recovery_cases recovery
             JOIN finding_sets finding
               ON finding.finding_set_hash = recovery.finding_set_hash
             JOIN recovery_case_revisions revision
               ON revision.revision_id = $2
              AND revision.recovery_case_id = recovery.recovery_case_id
             JOIN recovery_revision_dispatches dispatch
               ON dispatch.dispatch_id = $3
              AND dispatch.revision_id = revision.revision_id
              AND dispatch.recovery_case_id = recovery.recovery_case_id
             JOIN recovery_dispatch_deliveries delivery
               ON delivery.dispatch_id = dispatch.dispatch_id
              AND delivery.revision_id = revision.revision_id
             JOIN execution_attempts attempt
               ON attempt.attempt_id = $4
              AND attempt.recovery_dispatch_id = dispatch.dispatch_id
              AND attempt.recovery_case_revision_id = revision.revision_id
            WHERE recovery.recovery_case_id = $1
            FOR KEY SHARE OF recovery, finding, revision, dispatch, delivery, attempt`,
          [
            evidence.recoveryCaseId,
            evidence.recoveryCaseRevisionId,
            evidence.recoveryDispatchId,
            evidence.attemptId,
          ],
        );
        if (!authority) {
          fail("GITHUB_REVIEW_RESOLUTION_RECOVERY_AUTHORITY_MISSING", "Recovery evidence authority chain does not exist");
        }
        assertExactAuthority(authority, evidence);
        const artifactHashes = evidence.threads
          .map((thread) => thread.originalEvidenceArtifactHash)
          .sort();
        const artifactRows = await transaction.unsafe<Array<{ artifact_hash: string; artifact_type: string }>>(
          `SELECT artifact.artifact_hash, artifact.artifact_type
             FROM semantic_artifacts artifact
            WHERE artifact.artifact_hash = ANY($1::text[])
              AND EXISTS (
                SELECT 1 FROM run_artifact_refs run_ref
                 WHERE run_ref.run_id = $2
                   AND run_ref.artifact_hash = artifact.artifact_hash
              )
            ORDER BY artifact.artifact_hash`,
          [artifactHashes, evidence.runId],
        );
        if (
          artifactRows.length !== artifactHashes.length
          || artifactRows.some((artifact, index) =>
            artifact.artifact_hash !== artifactHashes[index]
            || artifact.artifact_type !== "setfarm.github-review-thread-evidence.v1")
        ) {
          fail("GITHUB_REVIEW_RESOLUTION_ORIGINAL_ARTIFACT_MISSING", "Original review artifacts are missing, extra, or wrong type");
        }
        const threadIds = evidence.threads.map((thread) => thread.threadId);
        const inserted = await one<ResolutionRow>(
          transaction,
          `INSERT INTO github_review_resolution_evidence (
             evidence_hash, run_id, story_id, packet_hash, contract_slice_hash,
             recovery_case_id, recovery_case_revision_id, recovery_dispatch_id,
             attempt_id, finding_set_hash, repository_node_id, repository_owner,
             repository_name, pr_number, original_head_sha,
             original_source_tree_hash, observed_head_sha, observed_source_tree_hash,
             thread_ids, original_artifact_hashes, payload
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $19::text::jsonb, $20::text::jsonb, $21::text::jsonb
           ) RETURNING *`,
          [
            evidence.evidenceHash,
            evidence.runId,
            evidence.storyId,
            evidence.packetHash,
            evidence.contractSliceHash,
            evidence.recoveryCaseId,
            evidence.recoveryCaseRevisionId,
            evidence.recoveryDispatchId,
            evidence.attemptId,
            evidence.findingSetHash,
            evidence.repository.nodeId,
            evidence.repository.owner,
            evidence.repository.name,
            evidence.prNumber,
            evidence.originalHeadSha,
            evidence.originalSourceRevision.treeHash,
            evidence.observedHeadSha,
            evidence.observedSourceRevision.treeHash,
            JSON.stringify(threadIds),
            JSON.stringify(artifactHashes),
            JSON.stringify(evidence),
          ],
        );
        if (!inserted) fail("GITHUB_REVIEW_RESOLUTION_INSERT_LOST", "Immutable evidence insertion returned no row");
        return { status: "inserted" as const, evidence: assertRowIdentity(inserted) };
      }) as Promise<PutGithubReviewResolutionEvidenceResult>;
    },

    async resolve(
      evidenceHash: string,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<Readonly<{
      status: "resolved" | "duplicate";
      evidence: GithubReviewResolutionEvidenceV1;
    }>> {
      const requestedTime = new Date(options.now ?? new Date());
      if (!Number.isFinite(requestedTime.getTime())) {
        fail("GITHUB_REVIEW_RESOLUTION_TIME_INVALID", "Resolution commit time is invalid");
      }
      const discoveredRow = await one<ResolutionRow>(
        sql,
        "SELECT * FROM github_review_resolution_evidence WHERE evidence_hash = $1",
        [evidenceHash],
      );
      if (!discoveredRow) {
        fail("GITHUB_REVIEW_RESOLUTION_EVIDENCE_NOT_FOUND", "Durable resolution evidence does not exist");
      }
      const discovered = assertRowIdentity(discoveredRow);
      return sql.begin(async (transaction) => {
        const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(transaction, {
          runId: discovered.runId,
          storyId: discovered.storyId,
        });
        const now = authority.observedAt;
        const evidenceRow = await one<ResolutionRow>(
          transaction,
          "SELECT * FROM github_review_resolution_evidence WHERE evidence_hash = $1 FOR KEY SHARE",
          [evidenceHash],
        );
        if (!evidenceRow) {
          fail("GITHUB_REVIEW_RESOLUTION_EVIDENCE_NOT_FOUND", "Durable resolution evidence does not exist");
        }
        const evidence = assertRowIdentity(evidenceRow);
        if (evidence.evidenceHash !== discovered.evidenceHash) {
          fail("GITHUB_REVIEW_RESOLUTION_EVIDENCE_CHANGED", "Resolution evidence identity changed after discovery");
        }
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
          `setfarm:github-review-resolution:${evidence.recoveryCaseId}`,
        ]);
        const row = await one<ResolutionCommitRow>(
          transaction,
          `SELECT recovery.status AS case_status,
                  recovery.owner AS case_owner,
                  recovery.state_version AS case_state_version,
                  recovery.current_revision_id AS case_current_revision_id,
                  recovery.github_review_resolution_evidence_hash AS case_resolution_hash,
                  recovery.terminal AS case_terminal,
                  recovery.prior_attempt_refs AS case_prior_attempt_refs,
                  recovery.decision_refs AS case_decision_refs,
                  delivery.state AS delivery_state,
                  delivery.terminal_result AS delivery_terminal_result,
                  attempt.disposition AS attempt_disposition,
                  attempt.source_after_sha AS attempt_source_after_sha,
                  attempt.source_after_tree_hash AS attempt_source_after_tree_hash
             FROM recovery_cases recovery
             JOIN recovery_dispatch_deliveries delivery
               ON delivery.dispatch_id = $2
              AND delivery.revision_id = $3
              AND delivery.attempt_id = $4
             JOIN execution_attempts attempt
               ON attempt.attempt_id = $4
              AND attempt.recovery_dispatch_id = $2
              AND attempt.recovery_case_revision_id = $3
            WHERE recovery.recovery_case_id = $1
            FOR UPDATE OF recovery, delivery, attempt`,
          [
            evidence.recoveryCaseId,
            evidence.recoveryDispatchId,
            evidence.recoveryCaseRevisionId,
            evidence.attemptId,
          ],
        );
        if (!row) {
          fail("GITHUB_REVIEW_RESOLUTION_COMMIT_AUTHORITY_MISSING", "Resolution commit authority chain is missing");
        }
        const terminalResult = githubReviewResolutionTerminalResultV1(evidence);
        if (row.case_status === "resolved") {
          const terminal = row.case_terminal as { evidenceBundleHashes?: unknown } | null;
          const terminalHashes = terminal
            ? stringArray(terminal.evidenceBundleHashes, "GITHUB_REVIEW_RESOLUTION_TERMINAL_HASHES_INVALID")
            : [];
          if (
            row.case_resolution_hash !== evidence.evidenceHash
            || terminalHashes.length !== 1
            || terminalHashes[0] !== evidence.evidenceHash
            || row.delivery_state !== "succeeded"
            || !sameCanonical(row.delivery_terminal_result, terminalResult)
          ) {
            fail("GITHUB_REVIEW_RESOLUTION_TERMINAL_CONFLICT", "Recovery already has a different terminal authority");
          }
          return { status: "duplicate" as const, evidence };
        }
        if (
          ["blocked", "superseded"].includes(row.case_status)
          || row.case_resolution_hash !== null
          || row.case_current_revision_id !== evidence.recoveryCaseRevisionId
          || ["failed", "blocked", "superseded"].includes(row.delivery_state)
          || ["claimed", "running", "superseded"].includes(row.attempt_disposition)
          || row.attempt_source_after_sha !== evidence.observedSourceRevision.sha
          || row.attempt_source_after_tree_hash !== evidence.observedSourceRevision.treeHash
        ) {
          fail("GITHUB_REVIEW_RESOLUTION_COMMIT_AUTHORITY_MISMATCH", "Resolution recovery state is stale or conflicting");
        }
        if (row.delivery_state === "succeeded") {
          if (!sameCanonical(row.delivery_terminal_result, terminalResult)) {
            fail("GITHUB_REVIEW_RESOLUTION_DELIVERY_CONFLICT", "Delivery already succeeded with different evidence");
          }
        } else if (["attempt_reserved", "running"].includes(row.delivery_state)) {
          const deliveryRows = await transaction.unsafe<Array<{ dispatch_id: string }>>(
            `UPDATE recovery_dispatch_deliveries
                SET state = 'succeeded',
                    terminal_result = $5::text::jsonb,
                    terminal_at = $6,
                    updated_at = $6
              WHERE dispatch_id = $1
                AND revision_id = $2
                AND attempt_id = $3
                AND state = $4
              RETURNING dispatch_id`,
            [
              evidence.recoveryDispatchId,
              evidence.recoveryCaseRevisionId,
              evidence.attemptId,
              row.delivery_state,
              JSON.stringify(terminalResult),
              now,
            ],
          );
          if (deliveryRows.length !== 1) {
            fail("GITHUB_REVIEW_RESOLUTION_DELIVERY_CAS_LOST", "Delivery terminalization lost exact ownership");
          }
        } else {
          fail("GITHUB_REVIEW_RESOLUTION_DELIVERY_NOT_ATTEMPT_BOUND", `Delivery is ${row.delivery_state}`);
        }
        const priorAttemptRefs = [...new Set([
          ...stringArray(row.case_prior_attempt_refs, "GITHUB_REVIEW_RESOLUTION_ATTEMPT_REFS_INVALID"),
          evidence.attemptId,
        ])].sort();
        const decisionRef = hashCanonicalJson({
          schema: "setfarm.github-review-resolution-decision.v1",
          evidenceHash: evidence.evidenceHash,
        });
        const decisionRefs = [...new Set([
          ...stringArray(row.case_decision_refs, "GITHUB_REVIEW_RESOLUTION_DECISION_REFS_INVALID"),
          decisionRef,
        ])].sort();
        const terminal = {
          owner: row.case_owner,
          outcome: "resolved",
          reasonCode: "evidence_satisfied",
          // Legacy recovery-case v1 names this generic terminal field after
          // evidence bundles. The typed v17 pointer below is the authority that
          // distinguishes this immutable review-resolution artifact.
          evidenceBundleHashes: [evidence.evidenceHash],
        };
        const caseRows = await transaction.unsafe<Array<{ recovery_case_id: string }>>(
          `UPDATE recovery_cases
              SET status = 'resolved',
                  terminal = $4::text::jsonb,
                  prior_attempt_refs = $5::text::jsonb,
                  decision_refs = $6::text::jsonb,
                  github_review_resolution_evidence_hash = $7,
                  state_version = state_version + 1,
                  updated_at = $8
            WHERE recovery_case_id = $1
              AND state_version = $2
              AND current_revision_id = $3
              AND github_review_resolution_evidence_hash IS NULL
              AND status IN ('open', 'repairing', 'evidencing')
            RETURNING recovery_case_id`,
          [
            evidence.recoveryCaseId,
            row.case_state_version,
            evidence.recoveryCaseRevisionId,
            JSON.stringify(terminal),
            JSON.stringify(priorAttemptRefs),
            JSON.stringify(decisionRefs),
            evidence.evidenceHash,
            now,
          ],
        );
        if (caseRows.length !== 1) {
          fail("GITHUB_REVIEW_RESOLUTION_CASE_CAS_LOST", "Recovery terminalization lost exact ownership");
        }
        return { status: "resolved" as const, evidence };
      });
    },
  });
}
