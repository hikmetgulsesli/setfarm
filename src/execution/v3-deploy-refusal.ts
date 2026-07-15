import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  acquireClaimMutationAuthorityInTransaction,
  ClaimMutationAuthorityError,
} from "./claim-mutation-authority.js";
import { closeExactSingleStepClaimInTransaction } from "./claim-attempt-transition.js";
import { requestRunTerminationInTransaction } from "./run-termination.js";
import { releaseReservedRuntimeSessionInTransaction } from "./runtime-session-repository.js";
import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import type { V3DeployAuthorityError } from "./v3-deploy-authority.js";

export type V3DeployAuthorityRefusalResult = Readonly<{
  refusalHash: string;
  record: string;
  terminationRequestId: string;
  claimClosure: "pre_spawn_released" | "termination_owned";
}>;

export class V3DeployRefusalLifecycleError extends Error {
  readonly hardPreClaim = true;
  readonly authorityCode: V3DeployAuthorityError["code"];

  constructor(authorityError: V3DeployAuthorityError, cause: unknown) {
    super(`V3_DEPLOY_REFUSAL_TRANSITION_FAILED:${authorityError.code}:${String(cause).slice(0, 800)}`, {
      cause,
    });
    this.name = "V3DeployRefusalLifecycleError";
    this.authorityCode = authorityError.code;
  }
}

type AuthorityRow = Readonly<{
  claim_run_id: string;
  claim_step_id: string;
  claim_story_id: string | null;
  claim_agent_id: string;
  claim_outcome: string | null;
  protocol: string;
  run_status: string;
  step_db_id: string;
  step_status: string;
}>;

type RuntimeAuthorityRow = Readonly<{
  session_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_id: string | null;
  attempt_id: string | null;
  claim_agent_id: string;
  runtime_agent_id: string;
  owner_instance_id: string;
  state: string;
}>;

/**
 * Convert a deploy preclaim authority failure into one compiler-owned terminal
 * decision. The exact claim intentionally remains open until the canonical
 * termination owner proves runtime drain; closing it here would be unsafe when
 * an idempotent claim reissue races a runtime that already crossed `reserved`.
 */
export async function completeV3DeployAuthorityRefusal(input: Readonly<{
  sql: postgres.Sql;
  envelope: ClaimEnvelopeV1;
  error: V3DeployAuthorityError;
  now?: Date;
}>): Promise<V3DeployAuthorityRefusalResult> {
  const { envelope } = input;
  if (
    envelope.protocol !== "v3"
    || envelope.workflowStepId !== "deploy"
    || envelope.storyId
    || envelope.storyDbId
    || envelope.attempt
  ) {
    throw new Error("V3_DEPLOY_REFUSAL_CLAIM_IDENTITY_INVALID");
  }
  const callerTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(callerTime.getTime())) {
    throw new Error("V3_DEPLOY_REFUSAL_TIME_INVALID");
  }
  const refusalPayload = {
    schema: "setfarm.v3-deploy-authority-refusal.v1" as const,
    disposition: "terminal_refusal" as const,
    owner: "compiler" as const,
    runId: envelope.runId,
    stepDbId: envelope.stepId,
    claimId: envelope.claimId,
    authority: {
      code: input.error.code,
      message: input.error.message,
      evidence: input.error.evidence,
    },
    terminal: {
      outcome: "failed" as const,
      reasonCode: "accepted_candidate_deploy_authority_failed" as const,
      modelRedispatchBudget: 0 as const,
    },
  };
  const refusalHash = hashCanonicalJson(refusalPayload);
  const record = canonicalJsonStringify({ ...refusalPayload, refusalHash });
  const diagnostic = `${input.error.code}:compiler-owned deploy authority refusal ${refusalHash}`;

  const transition = await input.sql.begin(async (transaction) => {
    let runtimeOwnsClaim = false;
    try {
      await acquireClaimMutationAuthorityInTransaction(transaction, {
        claimId: envelope.claimId,
        runId: envelope.runId,
        workflowStepId: envelope.workflowStepId,
        storyId: null,
        claimAgentId: envelope.claimAgentId,
      }, "pre_dispatch_withdrawal");
    } catch (error) {
      if (error instanceof ClaimMutationAuthorityError && error.ownerType === "runtime_session") {
        runtimeOwnsClaim = true;
      } else {
        throw error;
      }
    }
    const rows = await transaction.unsafe<AuthorityRow[]>(
      `SELECT cl.run_id AS claim_run_id,
              cl.step_id AS claim_step_id,
              cl.story_id AS claim_story_id,
              cl.agent_id AS claim_agent_id,
              cl.outcome AS claim_outcome,
              run.protocol,
              run.status AS run_status,
              step.id AS step_db_id,
              step.status AS step_status
         FROM claim_log cl
         JOIN runs run ON run.id = cl.run_id
         JOIN steps step
           ON step.id = $2
          AND step.run_id = cl.run_id
          AND step.step_id = cl.step_id
        WHERE cl.id = $1
        FOR UPDATE OF cl, run, step`,
      [envelope.claimId, envelope.stepId],
    );
    const row = rows[0];
    if (!row) throw new Error("V3_DEPLOY_REFUSAL_AUTHORITY_NOT_FOUND");
    if (
      row.claim_run_id !== envelope.runId
      || row.claim_step_id !== envelope.workflowStepId
      || row.claim_story_id !== null
      || row.claim_agent_id !== envelope.claimAgentId
      || row.step_db_id !== envelope.stepId
    ) {
      throw new Error("V3_DEPLOY_REFUSAL_AUTHORITY_IDENTITY_MISMATCH");
    }
    if (row.protocol !== "v3") throw new Error("V3_DEPLOY_REFUSAL_PROTOCOL_MISMATCH");
    if (row.claim_outcome !== null) throw new Error("V3_DEPLOY_REFUSAL_CLAIM_TERMINAL");
    if (!["running", "resuming"].includes(row.run_status)) {
      throw new Error(`V3_DEPLOY_REFUSAL_RUN_NOT_ACTIVE:${row.run_status}`);
    }
    if (row.step_status !== "running") {
      throw new Error(`V3_DEPLOY_REFUSAL_STEP_NOT_RUNNING:${row.step_status}`);
    }
    const runtimes = await transaction.unsafe<RuntimeAuthorityRow[]>(
      `SELECT session_id, run_id, step_db_id, workflow_step_id, story_id,
              attempt_id, claim_agent_id, runtime_agent_id, owner_instance_id, state
         FROM runtime_sessions
        WHERE claim_id = $1
        ORDER BY session_id
        FOR UPDATE`,
      [envelope.claimId],
    );
    // Compiler protocols publish a runtime capability with every claim. One
    // exact non-released session is required so termination can prove process
    // absence before it closes the claim.
    const activeRuntimes = runtimes.filter((runtime) =>
      ["reserved", "starting", "running", "drain_requested", "drained"].includes(runtime.state));
    if (runtimes.length !== 1 || activeRuntimes.length !== 1) {
      throw new Error(
        `V3_DEPLOY_REFUSAL_RUNTIME_AUTHORITY_INVALID:${runtimes.length}:${activeRuntimes.length}`,
      );
    }
    const runtime = activeRuntimes[0]!;
    if (
      runtime.run_id !== envelope.runId
      || runtime.step_db_id !== envelope.stepId
      || runtime.workflow_step_id !== envelope.workflowStepId
      || runtime.story_id !== null
      || runtime.attempt_id !== null
      || runtime.claim_agent_id !== envelope.claimAgentId
      || runtime.runtime_agent_id !== envelope.runtimeAgentId
    ) {
      throw new Error("V3_DEPLOY_REFUSAL_RUNTIME_IDENTITY_MISMATCH");
    }
    const claimClosure = runtime.state === "reserved"
      ? "pre_spawn_released" as const
      : "termination_owned" as const;
    if (runtimeOwnsClaim !== (claimClosure === "termination_owned")) {
      throw new Error("V3_DEPLOY_REFUSAL_MUTATION_AUTHORITY_MISMATCH");
    }

    if (claimClosure === "pre_spawn_released") {
      await closeExactSingleStepClaimInTransaction(transaction, {
        envelope,
        outcome: "failed",
        diagnostic,
        now: callerTime,
      });
    }

    const transitionTime = await readDatabaseWallClock(
      transaction,
      "V3_DEPLOY_REFUSAL_DATABASE_TIME_UNAVAILABLE",
    );

    const updated = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'failed', output = $2, current_story_id = NULL, updated_at = $3
        WHERE id = $1
          AND run_id = $4
          AND step_id = 'deploy'
          AND status = 'running'
        RETURNING id`,
      [envelope.stepId, record, transitionTime, envelope.runId],
    );
    if (updated.length !== 1) throw new Error("V3_DEPLOY_REFUSAL_STEP_CAS_LOST");

    if (claimClosure === "pre_spawn_released") {
      await releaseReservedRuntimeSessionInTransaction(transaction, {
        sessionId: runtime.session_id,
        claimId: envelope.claimId,
        ownerInstanceId: runtime.owner_instance_id,
        diagnostic,
        now: transitionTime,
      });
    }

    const termination = await requestRunTerminationInTransaction(transaction, {
      runId: envelope.runId,
      targetStatus: "failed",
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      diagnostic,
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        refusalHash,
        authorityCode: input.error.code,
        authorityEvidence: input.error.evidence,
        claimId: envelope.claimId,
        modelRedispatchBudget: 0,
      },
      now: transitionTime,
    });
    if (termination.status === "already_terminal") {
      throw new Error("V3_DEPLOY_REFUSAL_RUN_ALREADY_TERMINAL");
    }
    return {
      terminationRequestId: termination.request.requestId,
      claimClosure,
    };
  }) as Readonly<{
    terminationRequestId: string;
    claimClosure: "pre_spawn_released" | "termination_owned";
  }>;
  const { terminationRequestId, claimClosure } = transition;

  try {
    await input.sql`SELECT pg_notify('run_termination_requested', ${JSON.stringify({
      runId: envelope.runId,
      terminationRequestId,
    })})`;
  } catch {
    // Wake-up notification is advisory; the durable termination row is authority.
  }
  return { refusalHash, record, terminationRequestId, claimClosure };
}
