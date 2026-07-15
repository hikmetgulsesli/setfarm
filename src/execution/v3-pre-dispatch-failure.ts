import { z } from "zod";

import {
  decideV3PreparationFailure,
  V3PreparationDecisionV1Schema,
  type V3PreparationIdentityV1,
} from "./v3-preparation-decision.js";

export const V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT = 3;

export const V3PreDispatchFailureV1Schema = z.object({
  schema: z.literal("setfarm.v3-pre-dispatch-failure.v1"),
  decision: V3PreparationDecisionV1Schema,
  detail: z.string().min(1).max(4_000),
  diagnosticPrefix: z.string().min(1).max(1_000),
}).strict();

export type V3PreDispatchFailureV1 = z.infer<typeof V3PreDispatchFailureV1Schema>;

export const V3PreDispatchDispositionV1Schema = z.object({
  schema: z.literal("setfarm.v3-pre-dispatch-disposition.v1"),
  failure: V3PreDispatchFailureV1Schema,
  occurrence: z.number().int().positive(),
  transientAttemptLimit: z.number().int().positive(),
  disposition: z.enum(["retry_transient", "terminal_contract"]),
  claimOutcome: z.enum(["infra_retry", "failed"]),
  runTerminal: z.boolean(),
  diagnostic: z.string().min(1).max(4_000),
}).strict().superRefine((value, context) => {
  const retry = value.disposition === "retry_transient";
  if (
    retry !== (value.claimOutcome === "infra_retry")
    || retry === value.runTerminal
  ) {
    context.addIssue({
      code: "custom",
      path: ["disposition"],
      message: "Pre-dispatch disposition, claim outcome, and run terminality must agree",
    });
  }
  if (retry && value.occurrence >= value.transientAttemptLimit) {
    context.addIssue({
      code: "custom",
      path: ["occurrence"],
      message: "Transient retry cannot exceed its exact preparation budget",
    });
  }
});

export type V3PreDispatchDispositionV1 = z.infer<typeof V3PreDispatchDispositionV1Schema>;

function errorDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = raw.trim().slice(0, 4_000);
  return detail || "Unknown pre-dispatch failure";
}

export function createV3PreDispatchFailureV1(input: Readonly<{
  identity: Omit<V3PreparationIdentityV1, "schema" | "errorCode">;
  error: unknown;
}>): V3PreDispatchFailureV1 {
  const decision = decideV3PreparationFailure({
    identity: input.identity,
    error: input.error,
  });
  const diagnosticPrefix = [
    "V3_PRE_DISPATCH_FAILED",
    decision.phase,
    decision.action,
    decision.errorCode,
    decision.fingerprint,
  ].join(":");
  return V3PreDispatchFailureV1Schema.parse({
    schema: "setfarm.v3-pre-dispatch-failure.v1",
    decision,
    detail: errorDetail(input.error),
    diagnosticPrefix,
  });
}

export function decideV3PreDispatchDispositionV1(input: Readonly<{
  failure: V3PreDispatchFailureV1;
  priorEquivalentFailures: number;
  forceTerminal?: boolean;
}>): V3PreDispatchDispositionV1 {
  const failure = V3PreDispatchFailureV1Schema.parse(input.failure);
  if (!Number.isSafeInteger(input.priorEquivalentFailures) || input.priorEquivalentFailures < 0) {
    throw new Error("V3_PRE_DISPATCH_FAILURE_COUNT_INVALID");
  }
  const occurrence = input.priorEquivalentFailures + 1;
  // Only failures whose structural code was classified as transient or as an
  // exact source-ownership race may consume this bounded preparation budget.
  // Packet, compiler, reservation, and untyped failures fail closed on their
  // first occurrence because neither a model retry nor an unchanged worktree
  // can repair their authoritative inputs.
  const transient = !input.forceTerminal
    && ["bounded_infra", "ownership_wait"].includes(failure.decision.action)
    && occurrence < V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT;
  const disposition = transient ? "retry_transient" as const : "terminal_contract" as const;
  const diagnostic = `${failure.diagnosticPrefix}:occurrence=${occurrence}/${V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT}:${failure.detail}`
    .slice(0, 4_000);
  return V3PreDispatchDispositionV1Schema.parse({
    schema: "setfarm.v3-pre-dispatch-disposition.v1",
    failure,
    occurrence,
    transientAttemptLimit: V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT,
    disposition,
    claimOutcome: transient ? "infra_retry" : "failed",
    runTerminal: !transient,
    diagnostic,
  });
}
