import type postgres from "postgres";
import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RecoveryOwnerV1Schema,
  RecoveryTerminalV1Schema,
} from "./recovery-case.js";

type TransactionSql = postgres.TransactionSql;

const ActiveDeliveryStateSchema = z.enum([
  "authorized",
  "leased",
  "attempt_reserved",
  "running",
]);
const ActiveCaseStatusSchema = z.enum(["open", "repairing", "evidencing"]);

type DeliveryRow = Readonly<{
  dispatch_id: string;
  recovery_case_id: string;
  revision_id: string;
  run_id: string;
  story_id: string;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  claim_id: string | number | null;
  execution_slice_hash: string | null;
  updated_at: Date | string;
}>;

type CaseRow = Readonly<{
  recovery_case_id: string;
  current_revision_id: string;
  run_id: string;
  story_id: string;
  owner: string;
  status: string;
  state_version: number;
  decision_refs: unknown;
}>;

export type V3TerminalRecoverySnapshot = Readonly<{
  deliveries: readonly DeliveryRow[];
  cases: readonly CaseRow[];
}>;

export type V3TerminalRecoverySettlement = Readonly<{
  closedDeliveries: number;
  closedRecoveryCases: number;
  decisionRefs: readonly string[];
}>;

function stringArray(value: unknown, code: string): string[] {
  const parsed = z.array(z.string().min(1)).safeParse(value);
  if (!parsed.success) throw new Error(code);
  return parsed.data;
}

/**
 * Lock the recovery owner segment after runtime/attempt locks and before claim
 * locks. The caller must already own the run row, which prevents a canonical
 * recovery writer from entering this segment after the snapshot.
 */
export async function lockV3TerminalRecoveryChainInTransaction(
  sql: TransactionSql,
  runId: string,
): Promise<V3TerminalRecoverySnapshot> {
  const deliveries = await sql.unsafe<DeliveryRow[]>(
    `SELECT dispatch_id, recovery_case_id, revision_id, run_id, story_id, state,
            owner_instance_id, lease_token, lease_expires_at, attempt_id,
            claim_id, execution_slice_hash, updated_at
       FROM recovery_dispatch_deliveries
      WHERE run_id = $1
        AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
      ORDER BY dispatch_id
      FOR UPDATE`,
    [runId],
  );
  for (const delivery of deliveries) ActiveDeliveryStateSchema.parse(delivery.state);

  const caseIds = [...new Set(deliveries.map((delivery) => delivery.recovery_case_id))].sort();
  const cases = await sql.unsafe<CaseRow[]>(
    `SELECT recovery_case_id, current_revision_id, run_id, story_id, owner,
            status, state_version, decision_refs
       FROM recovery_cases
      WHERE run_id = $1
        AND (
          status IN ('open', 'repairing', 'evidencing')
          OR recovery_case_id = ANY($2::text[])
        )
      ORDER BY recovery_case_id
      FOR UPDATE`,
    [runId, caseIds],
  );
  const casesById = new Map(cases.map((recoveryCase) => [recoveryCase.recovery_case_id, recoveryCase]));
  for (const delivery of deliveries) {
    const recoveryCase = casesById.get(delivery.recovery_case_id);
    if (
      !recoveryCase
      || recoveryCase.run_id !== runId
      || recoveryCase.story_id !== delivery.story_id
    ) {
      throw new Error(`RUN_TERMINAL_RECOVERY_CHAIN_MISMATCH:${delivery.dispatch_id}`);
    }
  }
  return Object.freeze({ deliveries, cases });
}

/**
 * The canonical terminal run is the bounded recovery owner of last resort.
 * Failure blocks unfinished recovery; cancellation supersedes it. Successful
 * completion never erases a recovery owner and therefore rejects any residue.
 */
export async function settleV3TerminalRecoveryChainInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    runId: string;
    status: "completed" | "failed" | "cancelled";
    diagnostic: string;
    transitionTime: Date;
    snapshot: V3TerminalRecoverySnapshot;
  }>,
): Promise<V3TerminalRecoverySettlement> {
  if (!Number.isFinite(input.transitionTime.getTime())) {
    throw new Error("RUN_TERMINAL_RECOVERY_TIME_INVALID");
  }
  const activeCases = input.snapshot.cases.filter((recoveryCase) =>
    ActiveCaseStatusSchema.safeParse(recoveryCase.status).success);
  if (input.status === "completed") {
    if (input.snapshot.deliveries.length > 0 || activeCases.length > 0) {
      throw new Error(
        `RUN_TERMINAL_ACTIVE_RECOVERY:deliveries=${input.snapshot.deliveries.length}:cases=${activeCases.length}`,
      );
    }
    return Object.freeze({ closedDeliveries: 0, closedRecoveryCases: 0, decisionRefs: [] });
  }

  const caseStatus = input.status === "cancelled" ? "superseded" : "blocked";
  const deliveryState = input.status === "cancelled" ? "superseded" : "blocked";
  const reasonCode = input.status === "cancelled" ? "source_superseded" : "evidence_inconclusive";
  const casesById = new Map(input.snapshot.cases.map((recoveryCase) => [
    recoveryCase.recovery_case_id,
    recoveryCase,
  ]));
  const deliveriesByCase = new Map<string, DeliveryRow[]>();
  for (const delivery of input.snapshot.deliveries) {
    const grouped = deliveriesByCase.get(delivery.recovery_case_id) ?? [];
    grouped.push(delivery);
    deliveriesByCase.set(delivery.recovery_case_id, grouped);
  }

  const decisionRefs = new Map<string, string>();
  for (const recoveryCase of activeCases) {
    const ref = hashCanonicalJson({
      schema: "setfarm.run-terminal-recovery-decision.v1",
      runId: input.runId,
      runStatus: input.status,
      recoveryCaseId: recoveryCase.recovery_case_id,
      recoveryCaseVersion: recoveryCase.state_version,
      recoveryCaseStatus: recoveryCase.status,
      activeDispatchIds: (deliveriesByCase.get(recoveryCase.recovery_case_id) ?? [])
        .map((delivery) => delivery.dispatch_id)
        .sort(),
      outcome: caseStatus,
      reasonCode,
    });
    decisionRefs.set(recoveryCase.recovery_case_id, ref);
  }

  let closedDeliveries = 0;
  for (const delivery of input.snapshot.deliveries) {
    const recoveryCase = casesById.get(delivery.recovery_case_id)!;
    const decisionRef = decisionRefs.get(recoveryCase.recovery_case_id)
      ?? hashCanonicalJson({
        schema: "setfarm.run-terminal-recovery-decision.v1",
        runId: input.runId,
        runStatus: input.status,
        recoveryCaseId: recoveryCase.recovery_case_id,
        recoveryCaseVersion: recoveryCase.state_version,
        recoveryCaseStatus: recoveryCase.status,
        activeDispatchIds: [delivery.dispatch_id],
        outcome: deliveryState,
        reasonCode,
      });
    const terminalResult = {
      schema: "setfarm.run-terminal-recovery-chain.v1",
      runId: input.runId,
      runStatus: input.status,
      recoveryCaseId: delivery.recovery_case_id,
      revisionId: delivery.revision_id,
      dispatchId: delivery.dispatch_id,
      previousState: ActiveDeliveryStateSchema.parse(delivery.state),
      outcome: deliveryState,
      reasonCode,
      decisionRef,
      priorOwner: {
        ownerInstanceId: delivery.owner_instance_id,
        leaseToken: delivery.lease_token,
        leaseExpiresAt: delivery.lease_expires_at instanceof Date
          ? delivery.lease_expires_at.toISOString()
          : delivery.lease_expires_at,
        attemptId: delivery.attempt_id,
        claimId: delivery.claim_id === null ? null : Number(delivery.claim_id),
        executionSliceHash: delivery.execution_slice_hash,
      },
    };
    const updated = await sql.unsafe<Array<{ dispatch_id: string }>>(
      `UPDATE recovery_dispatch_deliveries
          SET state = $7,
              owner_instance_id = NULL,
              lease_token = NULL,
              lease_expires_at = NULL,
              terminal_result = $8::text::jsonb,
              diagnostic = $9,
              terminal_at = $10,
              updated_at = $10
        WHERE dispatch_id = $1
          AND recovery_case_id = $2
          AND revision_id = $3
          AND run_id = $4
          AND story_id = $5
          AND state = $6
        RETURNING dispatch_id`,
      [
        delivery.dispatch_id,
        delivery.recovery_case_id,
        delivery.revision_id,
        delivery.run_id,
        delivery.story_id,
        delivery.state,
        deliveryState,
        JSON.stringify(terminalResult),
        `RUN_TERMINAL_RECOVERY_${input.status.toUpperCase()}: ${input.diagnostic}`.slice(0, 10_000),
        input.transitionTime,
      ],
    );
    if (updated.length !== 1) {
      throw new Error(`RUN_TERMINAL_RECOVERY_DELIVERY_CAS_LOST:${delivery.dispatch_id}`);
    }
    closedDeliveries += 1;
  }

  let closedRecoveryCases = 0;
  for (const recoveryCase of activeCases) {
    const owner = RecoveryOwnerV1Schema.parse(recoveryCase.owner);
    const terminal = RecoveryTerminalV1Schema.parse({
      owner,
      outcome: caseStatus,
      reasonCode,
      evidenceBundleHashes: [],
    });
    const decisionRef = decisionRefs.get(recoveryCase.recovery_case_id)!;
    const nextDecisionRefs = [...new Set([
      ...stringArray(recoveryCase.decision_refs, "RUN_TERMINAL_RECOVERY_DECISION_REFS_INVALID"),
      decisionRef,
    ])].sort();
    const updated = await sql.unsafe<Array<{ recovery_case_id: string }>>(
      `UPDATE recovery_cases
          SET status = $5,
              terminal = $6::text::jsonb,
              decision_refs = $7::text::jsonb,
              state_version = state_version + 1,
              updated_at = $8
        WHERE recovery_case_id = $1
          AND run_id = $2
          AND current_revision_id = $3
          AND state_version = $4
          AND status IN ('open', 'repairing', 'evidencing')
        RETURNING recovery_case_id`,
      [
        recoveryCase.recovery_case_id,
        input.runId,
        recoveryCase.current_revision_id,
        recoveryCase.state_version,
        caseStatus,
        JSON.stringify(terminal),
        JSON.stringify(nextDecisionRefs),
        input.transitionTime,
      ],
    );
    if (updated.length !== 1) {
      throw new Error(`RUN_TERMINAL_RECOVERY_CASE_CAS_LOST:${recoveryCase.recovery_case_id}`);
    }
    closedRecoveryCases += 1;
  }

  return Object.freeze({
    closedDeliveries,
    closedRecoveryCases,
    decisionRefs: [...new Set(decisionRefs.values())].sort(),
  });
}
