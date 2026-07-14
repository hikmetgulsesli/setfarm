import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import { closeExactSingleStepClaimInTransaction } from "./claim-attempt-transition.js";
import { markRuntimeCompletionOwnerCommittedInTransaction } from "./runtime-completion.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";
import { requestRunTerminationInTransaction } from "./run-termination.js";
import { getSql } from "../db-pg.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  canonicalizeProductSpecRejectionV1,
  type ProductSpecRejectionV1,
} from "../product-compiler/producers/plan-product-spec-proposal.js";

export type V3PlanProductSpecRefusalResult = Readonly<{
  rejection: ProductSpecRejectionV1;
  rejectionHash: string;
  record: string;
  terminationRequestId: string;
}>;

/**
 * Publish a valid PLAN refusal as a compiler-owned terminal clarification.
 * The successful refusal report closes its exact claim, fails the PLAN step,
 * and requests canonical run termination with zero model redispatch budget.
 */
export async function completeV3PlanProductSpecRefusal(input: Readonly<{
  envelope: ClaimEnvelopeV1;
  task: string;
  rejection: unknown;
}>): Promise<V3PlanProductSpecRefusalResult> {
  const { envelope } = input;
  if (
    envelope.protocol !== "v3"
    || envelope.workflowStepId !== "plan"
    || envelope.storyId
    || envelope.storyDbId
    || envelope.attempt
  ) {
    throw new Error("V3_PLAN_REFUSAL_CLAIM_IDENTITY_INVALID");
  }
  const rejection = canonicalizeProductSpecRejectionV1({
    task: input.task,
    rejection: input.rejection,
  });
  const rejectionHash = hashCanonicalJson(rejection);
  const reasonCodes = [...new Set(rejection.reasons.map((reason) => reason.code))].sort();
  const requirementRefs = [...new Set(rejection.reasons.flatMap((reason) => reason.requirementRefs))].sort();
  const diagnostic = `V3_PLAN_CLARIFICATION_REQUIRED:${reasonCodes.join(",")}:${requirementRefs.join(",")}`;
  const record = canonicalJsonStringify({
    schema: "setfarm.v3-plan-clarification-record.v1",
    disposition: "clarification_required",
    owner: "compiler",
    runId: envelope.runId,
    stepDbId: envelope.stepId,
    claimId: envelope.claimId,
    sourceTaskHash: rejection.sourceTaskHash,
    rejectionHash,
    rejection,
    terminal: {
      outcome: "blocked",
      reasonCode: "product_spec_clarification_required",
      modelRedispatchBudget: 0,
    },
  });
  const completionPlan = createSingleEffectCompletionPlanDescriptorV1({
    kind: "single_failure",
    continuation: { type: "failure_finalize" },
    effectType: "v3.plan.clarification.recorded",
    effectPayload: {
      schema: "setfarm.v3-plan-clarification-effect.v1",
      owner: "compiler",
      rejectionHash,
      sourceTaskHash: rejection.sourceTaskHash,
      reasonCodes,
      requirementRefs,
      modelRedispatchBudget: 0,
    },
  });

  const sql = getSql();
  const terminationRequestId = await sql.begin(async (transaction) => {
    await closeExactSingleStepClaimInTransaction(transaction, {
      envelope,
      outcome: "completed",
      diagnostic,
    });
    const step = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'failed', output = $2, current_story_id = NULL, updated_at = NOW()
        WHERE id = $1
          AND run_id = $3
          AND step_id = 'plan'
          AND status IN ('running', 'pending')
        RETURNING id`,
      [envelope.stepId, record, envelope.runId],
    );
    if (step.length !== 1) throw new Error("V3_PLAN_REFUSAL_STEP_CAS_LOST");
    const ownerCommitted = await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
      claimId: envelope.claimId,
      claimOutcome: "completed",
      plan: completionPlan,
    });
    if (!ownerCommitted) throw new Error("V3_PLAN_REFUSAL_RUNTIME_COMPLETION_REQUIRED");
    const termination = await requestRunTerminationInTransaction(transaction, {
      runId: envelope.runId,
      targetStatus: "failed",
      requestedBy: "setfarm.product-compiler.plan-refusal",
      diagnostic,
      evidence: {
        schema: "setfarm.v3-plan-clarification-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        rejectionHash,
        sourceTaskHash: rejection.sourceTaskHash,
        reasonCodes,
        requirementRefs,
        modelRedispatchBudget: 0,
      },
    });
    if (termination.status === "already_terminal") {
      throw new Error("V3_PLAN_REFUSAL_RUN_ALREADY_TERMINAL");
    }
    return termination.request.requestId;
  });

  try {
    await sql`SELECT pg_notify('run_termination_requested', ${JSON.stringify({
      runId: envelope.runId,
      terminationRequestId,
    })})`;
  } catch {
    // Notification is a wake-up only; the durable termination row is authority.
  }
  return { rejection, rejectionHash, record, terminationRequestId };
}
