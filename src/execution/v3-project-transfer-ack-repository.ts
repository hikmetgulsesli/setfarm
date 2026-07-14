import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { buildRunOperationalSnapshotInTransaction } from "../server/run-operational-snapshot.js";
import { operationalOutboxIdForEventKey } from "./operational-outbox-repository.js";
import {
  V3DeployReceiptV1Schema,
  type V3DeployReceiptV1,
} from "./schemas/v3-deploy-receipt-v1.js";
import {
  V3ProjectTransferAckV1Schema,
  type V3CanonicalMissionControlProjectProjectionV1,
  type V3ProjectTransferAckV1,
} from "./schemas/v3-project-transfer-ack-v1.js";

export type V3ProjectTransferAckRepositoryErrorCode =
  | "V3_PROJECT_TRANSFER_ACK_RUN_NOT_FOUND"
  | "V3_PROJECT_TRANSFER_ACK_RUN_NOT_TERMINAL"
  | "V3_PROJECT_TRANSFER_ACK_AUTHORITY_MISMATCH"
  | "V3_PROJECT_TRANSFER_ACK_SNAPSHOT_MISMATCH"
  | "V3_PROJECT_TRANSFER_ACK_PROJECTION_MISMATCH"
  | "V3_PROJECT_TRANSFER_ACK_CONFLICT"
  | "V3_PROJECT_TRANSFER_ACK_PUBLICATION_FAILED";

export class V3ProjectTransferAckRepositoryError extends Error {
  readonly code: V3ProjectTransferAckRepositoryErrorCode;

  constructor(code: V3ProjectTransferAckRepositoryErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "V3ProjectTransferAckRepositoryError";
    this.code = code;
  }
}

type AckRow = Readonly<{
  ack_hash: string;
  run_id: string;
  candidate_id: string;
  candidate_hash: string;
  packet_hash: string;
  source_sha: string;
  source_tree_hash: string;
  deploy_receipt_hash: string;
  source_snapshot_hash: string;
  project_id: string;
  projection_hash: string;
  project_record_hash: string;
  project_record_ref: string;
  persisted_at: Date | string;
  payload: unknown;
}>;

type AuthorityRow = Readonly<{
  protocol: string;
  status: string;
  run_number: number | null;
  packet_hash: string | null;
  accepted_candidate_hash: string | null;
  deploy_receipt_hash: string | null;
  project_transfer_ack_hash: string | null;
  candidate_id: string | null;
  candidate_source_sha: string | null;
  candidate_source_tree_hash: string | null;
  receipt_payload: unknown;
}>;

function parsedJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "40001";
}

function ackFromRow(row: AckRow): V3ProjectTransferAckV1 {
  const ack = V3ProjectTransferAckV1Schema.parse(parsedJson(row.payload));
  if (
    ack.ackHash !== row.ack_hash
    || ack.runId !== row.run_id
    || ack.candidateId !== row.candidate_id
    || ack.candidateHash !== row.candidate_hash
    || ack.packetHash !== row.packet_hash
    || ack.sourceRevision.sha !== row.source_sha
    || ack.sourceRevision.treeHash !== row.source_tree_hash
    || ack.deploymentReceiptHash !== row.deploy_receipt_hash
    || ack.sourceSnapshotHash !== row.source_snapshot_hash
    || ack.projectId !== row.project_id
    || ack.projectionHash !== row.projection_hash
    || ack.projectRecordHash !== row.project_record_hash
    || ack.projectRecordRef !== row.project_record_ref
    || ack.persistedAt !== new Date(row.persisted_at).toISOString()
  ) {
    throw new V3ProjectTransferAckRepositoryError(
      "V3_PROJECT_TRANSFER_ACK_PUBLICATION_FAILED",
      `Project transfer acknowledgement row ${row.ack_hash} violates its payload binding`,
    );
  }
  return ack;
}

async function readAckByRun(
  sql: postgres.Sql | postgres.TransactionSql,
  runId: string,
): Promise<AckRow | undefined> {
  const rows = await sql.unsafe<AckRow[]>(
    `SELECT ack_hash, run_id, candidate_id, candidate_hash, packet_hash,
            source_sha, source_tree_hash, deploy_receipt_hash,
            source_snapshot_hash, project_id, projection_hash,
            project_record_hash, project_record_ref, persisted_at, payload
       FROM v3_project_transfer_acks
      WHERE run_id = $1
      LIMIT 1`,
    [runId],
  );
  return rows[0];
}

function expectedProjection(
  ack: V3ProjectTransferAckV1,
  receipt: V3DeployReceiptV1,
  runNumber: number | null,
): V3CanonicalMissionControlProjectProjectionV1 {
  return {
    id: receipt.project.projectId,
    name: receipt.project.displayName,
    description: receipt.project.summary,
    type: receipt.stack.platform === "mobile" ? "mobile" : "web",
    ports: { frontend: receipt.runtime.port },
    deployUrl: receipt.runtime.deployUrl,
    service: receipt.runtime.serviceId,
    serviceStatus: "active",
    status: "active",
    stack: [receipt.stack.techStack ?? receipt.stack.stackPackId].sort(),
    createdBy: "setfarm-v3-terminal-projector",
    productCompilerProtocol: "v3",
    workflowRunId: receipt.runId,
    setfarmRunIds: [receipt.runId],
    ...(runNumber && runNumber > 0 ? { runNumber } : {}),
    acceptedCandidateId: receipt.candidateId,
    acceptedCandidateHash: receipt.candidateHash,
    acceptedPacketHash: receipt.packetHash,
    acceptedSourceSha: receipt.sourceAfter.sha,
    acceptedSourceTreeHash: receipt.sourceAfter.treeHash,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
    deploymentHealthRef: receipt.health.evidenceRef,
    deploymentHealthUrl: receipt.runtime.healthUrl,
    deployedAt: receipt.completedAt,
    completedAt: receipt.completedAt,
  };
}

function assertAuthority(
  run: AuthorityRow,
  ack: V3ProjectTransferAckV1,
  receipt: V3DeployReceiptV1,
): void {
  if (
    run.protocol !== "v3"
    || run.packet_hash !== ack.packetHash
    || run.accepted_candidate_hash !== ack.candidateHash
    || run.deploy_receipt_hash !== ack.deploymentReceiptHash
    || run.candidate_id !== ack.candidateId
    || run.candidate_source_sha !== ack.sourceRevision.sha
    || run.candidate_source_tree_hash !== ack.sourceRevision.treeHash
    || receipt.runId !== ack.runId
    || receipt.candidateId !== ack.candidateId
    || receipt.candidateHash !== ack.candidateHash
    || receipt.packetHash !== ack.packetHash
    || receipt.sourceAfter.sha !== ack.sourceRevision.sha
    || receipt.sourceAfter.treeHash !== ack.sourceRevision.treeHash
    || receipt.receiptHash !== ack.deploymentReceiptHash
  ) {
    throw new V3ProjectTransferAckRepositoryError(
      "V3_PROJECT_TRANSFER_ACK_AUTHORITY_MISMATCH",
      `Run ${ack.runId} canonical candidate/deploy authority differs from the acknowledgement`,
    );
  }
}

export function createV3ProjectTransferAckRepository(
  sql: postgres.Sql,
  dependencies: Readonly<{ now?: () => Date }> = {},
) {
  const now = dependencies.now ?? (() => new Date());
  return Object.freeze({
    async findByRunId(runId: string): Promise<V3ProjectTransferAckV1 | undefined> {
      const row = await readAckByRun(sql, runId);
      return row ? ackFromRow(row) : undefined;
    },

    async publish(input: unknown): Promise<Readonly<{
      status: "committed" | "existing";
      acknowledgement: V3ProjectTransferAckV1;
    }>> {
      const acknowledgement = V3ProjectTransferAckV1Schema.parse(input);
      const commit = () => sql.begin("isolation level repeatable read", async (transaction) => {
        const rows = await transaction.unsafe<AuthorityRow[]>(
          `SELECT r.protocol, r.status, r.run_number, r.packet_hash,
                  r.accepted_candidate_hash, r.deploy_receipt_hash,
                  r.project_transfer_ack_hash,
                  candidate.candidate_id,
                  candidate.source_sha AS candidate_source_sha,
                  candidate.source_tree_hash AS candidate_source_tree_hash,
                  receipt.payload AS receipt_payload
             FROM runs r
             LEFT JOIN accepted_candidates candidate
               ON candidate.run_id = r.id
              AND candidate.candidate_hash = r.accepted_candidate_hash
             LEFT JOIN v3_deploy_receipts receipt
               ON receipt.run_id = r.id
              AND receipt.receipt_hash = r.deploy_receipt_hash
            WHERE r.id = $1
            FOR UPDATE OF r`,
          [acknowledgement.runId],
        );
        const run = rows[0];
        if (!run) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_RUN_NOT_FOUND",
            `Run ${acknowledgement.runId} does not exist`,
          );
        }
        const existing = await readAckByRun(transaction, acknowledgement.runId);
        if (run.project_transfer_ack_hash || existing) {
          if (
            run.project_transfer_ack_hash === acknowledgement.ackHash
            && existing
            && hashCanonicalJson(ackFromRow(existing)) === hashCanonicalJson(acknowledgement)
          ) {
            return Object.freeze({ status: "existing" as const, acknowledgement });
          }
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_CONFLICT",
            `Run ${acknowledgement.runId} already owns another transfer acknowledgement`,
          );
        }
        if (!run.receipt_payload) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_AUTHORITY_MISMATCH",
            `Run ${acknowledgement.runId} has no exact deploy receipt authority`,
          );
        }
        if (!['completed', 'done'].includes(run.status.toLowerCase())) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_RUN_NOT_TERMINAL",
            `Run ${acknowledgement.runId} is not successfully terminal`,
          );
        }
        const receipt = V3DeployReceiptV1Schema.parse(parsedJson(run.receipt_payload));
        assertAuthority(run, acknowledgement, receipt);
        const projection = expectedProjection(acknowledgement, receipt, run.run_number);
        if (hashCanonicalJson(projection) !== hashCanonicalJson(acknowledgement.projectProjection)) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_PROJECTION_MISMATCH",
            `Mission Control projection for run ${acknowledgement.runId} differs from deploy authority`,
          );
        }

        const snapshot = await buildRunOperationalSnapshotInTransaction(
          transaction,
          acknowledgement.runId,
        );
        if (
          !snapshot
          || snapshot.snapshotHash !== acknowledgement.sourceSnapshotHash
          || snapshot.source.projection !== "complete"
          || snapshot.summary.lifecycleState !== "terminal"
          || snapshot.summary.health !== "ok"
          || snapshot.invariants.length !== 0
          || snapshot.acceptedCandidate?.candidate.candidateHash !== acknowledgement.candidateHash
          || snapshot.deploymentReceipt?.receipt.receiptHash !== acknowledgement.deploymentReceiptHash
        ) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_SNAPSHOT_MISMATCH",
            `Mission Control acknowledgement is not based on the current settled operational snapshot`,
          );
        }

        const createdAt = now();
        const inserted = await transaction.unsafe<Array<{ ack_hash: string }>>(
          `INSERT INTO v3_project_transfer_acks (
             ack_hash, run_id, candidate_id, candidate_hash, packet_hash,
             source_sha, source_tree_hash, deploy_receipt_hash,
             source_snapshot_hash, project_id, projection_hash,
             project_record_hash, project_record_ref, persisted_at,
             payload, created_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::text::jsonb,$16
           ) RETURNING ack_hash`,
          [
            acknowledgement.ackHash,
            acknowledgement.runId,
            acknowledgement.candidateId,
            acknowledgement.candidateHash,
            acknowledgement.packetHash,
            acknowledgement.sourceRevision.sha,
            acknowledgement.sourceRevision.treeHash,
            acknowledgement.deploymentReceiptHash,
            acknowledgement.sourceSnapshotHash,
            acknowledgement.projectId,
            acknowledgement.projectionHash,
            acknowledgement.projectRecordHash,
            acknowledgement.projectRecordRef,
            acknowledgement.persistedAt,
            JSON.stringify(acknowledgement),
            createdAt,
          ],
        );
        if (inserted.length !== 1) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_PUBLICATION_FAILED",
            `Run ${acknowledgement.runId} acknowledgement insert failed`,
          );
        }
        const pointed = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE runs
              SET project_transfer_ack_hash = $2, updated_at = $3
            WHERE id = $1 AND project_transfer_ack_hash IS NULL
            RETURNING id`,
          [acknowledgement.runId, acknowledgement.ackHash, createdAt],
        );
        if (pointed.length !== 1) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_CONFLICT",
            `Run ${acknowledgement.runId} acknowledgement pointer CAS lost`,
          );
        }
        const eventKey = `v3-project-transfer/${acknowledgement.runId}/${acknowledgement.ackHash}/acknowledged`;
        const outbox = await transaction.unsafe<Array<{ outbox_id: string }>>(
          `INSERT INTO operational_outbox (
             outbox_id, request_id, event_key, event_type, aggregate_type,
             aggregate_id, payload, state, created_at, updated_at
           ) VALUES ($1, NULL, $2, 'v3.project_transfer_acknowledged',
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
            acknowledgement.runId,
            JSON.stringify({
              schema: "setfarm.v3-project-transfer-acknowledged.v1",
              runId: acknowledgement.runId,
              ackHash: acknowledgement.ackHash,
              projectId: acknowledgement.projectId,
              projectRecordRef: acknowledgement.projectRecordRef,
            }),
            createdAt,
          ],
        );
        if (outbox.length !== 1) {
          throw new V3ProjectTransferAckRepositoryError(
            "V3_PROJECT_TRANSFER_ACK_PUBLICATION_FAILED",
            `Run ${acknowledgement.runId} acknowledgement outbox publication conflicted`,
          );
        }
        return Object.freeze({ status: "committed" as const, acknowledgement });
      }) as Promise<Readonly<{
        status: "committed" | "existing";
        acknowledgement: V3ProjectTransferAckV1;
      }>>;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await commit();
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 2) throw error;
        }
      }
      throw new V3ProjectTransferAckRepositoryError(
        "V3_PROJECT_TRANSFER_ACK_PUBLICATION_FAILED",
        `Run ${acknowledgement.runId} acknowledgement serialization retries exhausted`,
      );
    },
  });
}
