import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { operationalOutboxIdForEventKey } from "./operational-outbox-repository.js";
import {
  completeSingleStepClaimAndStateInTransaction,
  type CompleteSingleStepClaimAndStateInput,
  type CompletedSingleStepClaimTransitionResult,
} from "./claim-attempt-transition.js";
import {
  V3DeployReceiptV1Schema,
  type V3DeployReceiptV1,
} from "./schemas/v3-deploy-receipt-v1.js";

export type V3DeployReceiptRepositoryErrorCode =
  | "V3_DEPLOY_RECEIPT_RUN_NOT_FOUND"
  | "V3_DEPLOY_RECEIPT_RUN_NOT_ACTIVE"
  | "V3_DEPLOY_RECEIPT_PROTOCOL_MISMATCH"
  | "V3_DEPLOY_RECEIPT_CLAIM_MISMATCH"
  | "V3_DEPLOY_RECEIPT_ACCEPTED_CANDIDATE_MISMATCH"
  | "V3_DEPLOY_RECEIPT_PACKET_MISMATCH"
  | "V3_DEPLOY_RECEIPT_SOURCE_MISMATCH"
  | "V3_DEPLOY_RECEIPT_CONFLICT"
  | "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED";

export class V3DeployReceiptRepositoryError extends Error {
  readonly code: V3DeployReceiptRepositoryErrorCode;

  constructor(code: V3DeployReceiptRepositoryErrorCode, message: string) {
    super(message);
    this.name = "V3DeployReceiptRepositoryError";
    this.code = code;
  }
}

type ReceiptRow = Readonly<{
  receipt_hash: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  claim_id: string;
  candidate_id: string;
  candidate_hash: string;
  packet_hash: string;
  source_sha: string;
  source_tree_hash: string;
  build_artifact_hash: string;
  build_manifest_file_count: number;
  build_manifest_total_bytes: string;
  build_manifest_ref: string;
  sealed_runtime_ref: string;
  runtime_owner_pid: number;
  runtime_owner_started_at: string;
  runtime_owner_process_group_id: number;
  payload: unknown;
}>;

type LockedRunRow = Readonly<{
  protocol: string;
  status: string;
  packet_hash: string | null;
  accepted_candidate_hash: string | null;
  deploy_receipt_hash: string | null;
  candidate_id: string | null;
  candidate_packet_hash: string | null;
  candidate_source_sha: string | null;
  candidate_source_tree_hash: string | null;
}>;

export type V3DeployReceiptCommitResult = Readonly<{
  status: "committed" | "existing";
  receipt: V3DeployReceiptV1;
  transition?: CompletedSingleStepClaimTransitionResult;
}>;

function receiptFromRow(row: ReceiptRow): V3DeployReceiptV1 {
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  const receipt = V3DeployReceiptV1Schema.parse(payload);
  if (
    receipt.receiptHash !== row.receipt_hash
    || receipt.runId !== row.run_id
    || receipt.candidateId !== row.candidate_id
    || receipt.candidateHash !== row.candidate_hash
    || receipt.packetHash !== row.packet_hash
    || receipt.sourceAfter.sha !== row.source_sha
    || receipt.sourceAfter.treeHash !== row.source_tree_hash
    || receipt.buildArtifact.artifactHash !== row.build_artifact_hash
    || receipt.buildArtifact.files.length !== row.build_manifest_file_count
    || String(receipt.buildArtifact.totalBytes) !== row.build_manifest_total_bytes
    || receipt.buildArtifact.evidenceRef !== row.build_manifest_ref
    || receipt.runtime.sealedRuntimeRef !== row.sealed_runtime_ref
    || receipt.health.listenerOwnership.ownerProcess.pid !== row.runtime_owner_pid
    || receipt.health.listenerOwnership.ownerProcess.processStartedAt !== new Date(row.runtime_owner_started_at).toISOString()
    || receipt.health.listenerOwnership.ownerProcess.processGroupId !== row.runtime_owner_process_group_id
  ) {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED",
      `Canonical deploy receipt row ${row.receipt_hash} violates its payload binding`,
    );
  }
  return receipt;
}

function exactExistingReceipt(row: ReceiptRow, receipt: V3DeployReceiptV1): boolean {
  const existing = receiptFromRow(row);
  return existing.receiptHash === receipt.receiptHash
    && JSON.stringify(existing) === JSON.stringify(receipt);
}

async function readReceiptByRun(
  sql: postgres.Sql | postgres.TransactionSql,
  runId: string,
): Promise<ReceiptRow | undefined> {
  const rows = await sql.unsafe<ReceiptRow[]>(
    `SELECT receipt_hash, run_id, step_db_id, workflow_step_id, claim_id::text,
            candidate_id, candidate_hash, packet_hash, source_sha,
            source_tree_hash, build_artifact_hash, build_manifest_file_count,
            build_manifest_total_bytes::text, build_manifest_ref, sealed_runtime_ref,
            runtime_owner_pid, runtime_owner_started_at,
            runtime_owner_process_group_id, payload
       FROM v3_deploy_receipts
      WHERE run_id = $1
      LIMIT 1`,
    [runId],
  );
  return rows[0];
}

async function readCanonicalReceiptByRunAndHash(
  sql: postgres.Sql | postgres.TransactionSql,
  runId: string,
  receiptHash: string,
): Promise<ReceiptRow | undefined> {
  const rows = await sql.unsafe<ReceiptRow[]>(
    `SELECT receipt.receipt_hash, receipt.run_id, receipt.step_db_id, receipt.workflow_step_id,
            receipt.claim_id::text, receipt.candidate_id, receipt.candidate_hash,
            receipt.packet_hash, receipt.source_sha, receipt.source_tree_hash,
            receipt.build_artifact_hash, receipt.build_manifest_file_count,
            receipt.build_manifest_total_bytes::text, receipt.build_manifest_ref,
            receipt.sealed_runtime_ref, receipt.runtime_owner_pid,
            receipt.runtime_owner_started_at, receipt.runtime_owner_process_group_id,
            receipt.payload
       FROM v3_deploy_receipts receipt
       JOIN runs run
         ON run.id = receipt.run_id
        AND run.protocol = 'v3'
        AND run.deploy_receipt_hash = receipt.receipt_hash
      WHERE receipt.run_id = $1
        AND receipt.receipt_hash = $2
      LIMIT 1`,
    [runId, receiptHash],
  );
  return rows[0];
}

function assertEnvelopeAndReceipt(
  completion: CompleteSingleStepClaimAndStateInput,
  receipt: V3DeployReceiptV1,
): void {
  const envelope = completion.envelope;
  if (
    envelope.protocol !== "v3"
    || envelope.runId !== receipt.runId
    || envelope.workflowStepId !== "deploy"
    || envelope.storyId
    || envelope.storyDbId
    || envelope.attempt
  ) {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_CLAIM_MISMATCH",
      "Deploy receipt completion does not own the exact v3 deploy claim",
    );
  }
}

function assertRunAuthority(run: LockedRunRow, receipt: V3DeployReceiptV1): void {
  if (run.protocol !== "v3") {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_PROTOCOL_MISMATCH",
      `Run ${receipt.runId} is not a v3 receipt owner`,
    );
  }
  if (!run.packet_hash || run.packet_hash !== receipt.packetHash) {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_PACKET_MISMATCH",
      `Run ${receipt.runId} packet differs from its deploy receipt`,
    );
  }
  if (
    run.accepted_candidate_hash !== receipt.candidateHash
    || run.candidate_id !== receipt.candidateId
    || run.candidate_packet_hash !== receipt.packetHash
  ) {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_ACCEPTED_CANDIDATE_MISMATCH",
      `Run ${receipt.runId} AcceptedCandidate differs from its deploy receipt`,
    );
  }
  if (
    run.candidate_source_sha !== receipt.sourceAfter.sha
    || run.candidate_source_tree_hash !== receipt.sourceAfter.treeHash
  ) {
    throw new V3DeployReceiptRepositoryError(
      "V3_DEPLOY_RECEIPT_SOURCE_MISMATCH",
      `Run ${receipt.runId} final source differs from its deploy receipt`,
    );
  }
}

export function createV3DeployReceiptRepository(sql: postgres.Sql) {
  return Object.freeze({
    async findByRunId(runId: string): Promise<V3DeployReceiptV1 | undefined> {
      const row = await readReceiptByRun(sql, runId);
      return row ? receiptFromRow(row) : undefined;
    },

    async findCanonicalByRunIdAndHash(
      runId: string,
      receiptHash: string,
    ): Promise<V3DeployReceiptV1 | undefined> {
      const row = await readCanonicalReceiptByRunAndHash(sql, runId, receiptHash);
      return row ? receiptFromRow(row) : undefined;
    },

    /**
     * Publish the immutable receipt, exact run pointer, deploy claim/step
     * completion, and canonical operational outbox record in one transaction.
     * A byte-identical committed receipt is idempotent and never re-completes
     * the claim or advances the pipeline a second time.
     */
    async publishAndComplete(input: Readonly<{
      receipt: V3DeployReceiptV1;
      completion: CompleteSingleStepClaimAndStateInput;
    }>): Promise<V3DeployReceiptCommitResult> {
      const receipt = V3DeployReceiptV1Schema.parse(input.receipt);
      assertEnvelopeAndReceipt(input.completion, receipt);
      if (input.completion.now && !Number.isFinite(input.completion.now.getTime())) {
        throw new V3DeployReceiptRepositoryError(
          "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED",
          "Deploy receipt compatibility clock is invalid",
        );
      }
      return sql.begin(async (transaction) => {
        const runs = await transaction.unsafe<LockedRunRow[]>(
          `SELECT r.protocol, r.status, r.packet_hash, r.accepted_candidate_hash,
                  r.deploy_receipt_hash, candidate.candidate_id,
                  candidate.packet_hash AS candidate_packet_hash,
                  candidate.source_sha AS candidate_source_sha,
                  candidate.source_tree_hash AS candidate_source_tree_hash
             FROM runs r
             LEFT JOIN accepted_candidates candidate
               ON candidate.candidate_hash = r.accepted_candidate_hash
              AND candidate.run_id = r.id
            WHERE r.id = $1
            FOR UPDATE OF r`,
          [receipt.runId],
        );
        const run = runs[0];
        if (!run) {
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_RUN_NOT_FOUND",
            `Run ${receipt.runId} does not exist`,
          );
        }
        assertRunAuthority(run, receipt);

        const existing = await readReceiptByRun(transaction, receipt.runId);
        if (run.deploy_receipt_hash || existing) {
          if (
            run.deploy_receipt_hash === receipt.receiptHash
            && existing
            && existing.step_db_id === input.completion.envelope.stepId
            && existing.workflow_step_id === input.completion.envelope.workflowStepId
            && existing.claim_id === String(input.completion.envelope.claimId)
            && exactExistingReceipt(existing, receipt)
          ) {
            return Object.freeze({ status: "existing" as const, receipt });
          }
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_CONFLICT",
            `Run ${receipt.runId} already owns a different deploy receipt`,
          );
        }
        if (!["running", "resuming"].includes(run.status)) {
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_RUN_NOT_ACTIVE",
            `Run ${receipt.runId} is not active for deploy receipt publication`,
          );
        }

        const commitTime = await readDatabaseWallClock(
          transaction,
          "V3_DEPLOY_RECEIPT_DATABASE_TIME_UNAVAILABLE",
        );
        const transition = await completeSingleStepClaimAndStateInTransaction(transaction, {
          ...input.completion,
          now: commitTime,
        });
        const now = commitTime;
        const inserted = await transaction.unsafe<Array<{ receipt_hash: string }>>(
          `INSERT INTO v3_deploy_receipts (
             receipt_hash, run_id, step_db_id, workflow_step_id, claim_id,
             candidate_id, candidate_hash, packet_hash, product_id, project_id,
             display_name, summary, stack_pack_id, stack_pack_version,
             stack_pack_content_hash, platform, tech_stack, source_sha,
             source_tree_hash, build_artifact_hash, build_manifest_file_count,
             build_manifest_total_bytes, build_manifest_ref, sealed_runtime_ref, service_id,
             deployment_mode, host, port,
             health_url, deploy_url, health_http_status, health_checked_at,
             runtime_owner_pid, runtime_owner_started_at,
             runtime_owner_process_group_id,
             terminal_projection_ref, completed_at, payload, created_at
           ) VALUES (
             $1, $2, $3, 'deploy', $4, $5, $6, $7, $8, $9,
             $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
             $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
             $30, $31, $32, $33, $34, $35, $36, $37::text::jsonb, $38
           )
           RETURNING receipt_hash`,
          [
            receipt.receiptHash,
            receipt.runId,
            input.completion.envelope.stepId,
            input.completion.envelope.claimId,
            receipt.candidateId,
            receipt.candidateHash,
            receipt.packetHash,
            receipt.project.productId,
            receipt.project.projectId,
            receipt.project.displayName,
            receipt.project.summary,
            receipt.stack.stackPackId,
            receipt.stack.stackPackVersion,
            receipt.stack.stackPackContentHash,
            receipt.stack.platform,
            receipt.stack.techStack,
            receipt.sourceAfter.sha,
            receipt.sourceAfter.treeHash,
            receipt.buildArtifact.artifactHash,
            receipt.buildArtifact.files.length,
            receipt.buildArtifact.totalBytes,
            receipt.buildArtifact.evidenceRef,
            receipt.runtime.sealedRuntimeRef,
            receipt.runtime.serviceId,
            receipt.runtime.mode,
            receipt.runtime.host,
            receipt.runtime.port,
            receipt.runtime.healthUrl,
            receipt.runtime.deployUrl,
            receipt.health.httpStatus,
            receipt.health.checkedAt,
            receipt.health.listenerOwnership.ownerProcess.pid,
            receipt.health.listenerOwnership.ownerProcess.processStartedAt,
            receipt.health.listenerOwnership.ownerProcess.processGroupId!,
            receipt.terminalProjectProjection.evidenceRef,
            receipt.completedAt,
            JSON.stringify(receipt),
            now,
          ],
        );
        if (inserted.length !== 1) {
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED",
            `Run ${receipt.runId} deploy receipt insert failed`,
          );
        }
        const pointed = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE runs
              SET deploy_receipt_hash = $2, updated_at = $3
            WHERE id = $1 AND deploy_receipt_hash IS NULL
            RETURNING id`,
          [receipt.runId, receipt.receiptHash, now],
        );
        if (pointed.length !== 1) {
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_CONFLICT",
            `Run ${receipt.runId} deploy receipt pointer CAS lost`,
          );
        }

        const eventKey = `v3-deploy/${receipt.runId}/${receipt.receiptHash}/committed`;
        const eventPayload = {
          schema: "setfarm.v3-deploy-receipt-committed.v1",
          runId: receipt.runId,
          receiptHash: receipt.receiptHash,
          candidateHash: receipt.candidateHash,
          packetHash: receipt.packetHash,
          projectId: receipt.project.projectId,
          serviceId: receipt.runtime.serviceId,
          port: receipt.runtime.port,
          healthUrl: receipt.runtime.healthUrl,
          deployUrl: receipt.runtime.deployUrl,
          terminalProjectProjectionRef: receipt.terminalProjectProjection.evidenceRef,
          receipt,
        };
        const outbox = await transaction.unsafe<Array<{ outbox_id: string }>>(
          `INSERT INTO operational_outbox (
             outbox_id, request_id, event_key, event_type, aggregate_type,
             aggregate_id, payload, state, created_at, updated_at
           ) VALUES ($1, NULL, $2, 'v3.deploy_receipt_committed',
             'run', $3, $4::text::jsonb, 'pending', $5, $5)
           ON CONFLICT (event_key) DO UPDATE
             SET event_key = EXCLUDED.event_key
           WHERE operational_outbox.outbox_id = EXCLUDED.outbox_id
             AND operational_outbox.request_id IS NULL
             AND operational_outbox.event_type = EXCLUDED.event_type
             AND operational_outbox.aggregate_type = EXCLUDED.aggregate_type
             AND operational_outbox.aggregate_id = EXCLUDED.aggregate_id
             AND operational_outbox.payload = EXCLUDED.payload
           RETURNING operational_outbox.outbox_id`,
          [
            operationalOutboxIdForEventKey(eventKey),
            eventKey,
            receipt.runId,
            JSON.stringify(eventPayload),
            now,
          ],
        );
        if (outbox.length !== 1) {
          throw new V3DeployReceiptRepositoryError(
            "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED",
            `Run ${receipt.runId} canonical deploy outbox publication conflicted`,
          );
        }
        return Object.freeze({ status: "committed" as const, receipt, transition });
      }) as Promise<V3DeployReceiptCommitResult>;
    },
  });
}
