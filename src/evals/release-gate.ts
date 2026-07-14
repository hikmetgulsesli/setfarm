import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { ConvergenceEvalResultV1Schema, type ConvergenceEvalResultV1 } from "./result-schema.js";

const GateCodeSchema = z.enum([
  "CONVERGENCE_EXECUTION_REQUIRED",
  "CONVERGENCE_PREFLIGHT_FAILED",
  "CONVERGENCE_RUN_COUNT_INCOMPLETE",
  "CONVERGENCE_PRODUCT_CLASS_COVERAGE_INCOMPLETE",
  "CONVERGENCE_RUN_FAILED",
  "CONVERGENCE_REPEATED_ROOT_CAUSE",
  "CONVERGENCE_RELEASE_GATE_PASSED",
]);

const ReleaseGatePayloadV1Schema = z.object({
  schema: z.literal("setfarm.product-convergence-release-gate.v1"),
  resultHash: Sha256Schema,
  releaseSha: GitObjectHashSchema,
  decision: z.enum(["go", "no_go"]),
  codes: z.array(GateCodeSchema).min(1).max(10),
  runCount: z.number().int().nonnegative(),
  passedRunCount: z.number().int().nonnegative(),
  productClassCounts: z.object({
    utility: z.number().int().nonnegative(),
    operations: z.number().int().nonnegative(),
    game: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const ConvergenceReleaseGateV1Schema = ReleaseGatePayloadV1Schema.extend({
  gateHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { gateHash, ...payload } = value;
  if (gateHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["gateHash"], message: "Release gate hash mismatch" });
  }
});

export type ConvergenceReleaseGateV1 = z.infer<typeof ConvergenceReleaseGateV1Schema>;

export function evaluateConvergenceReleaseGate(value: ConvergenceEvalResultV1): ConvergenceReleaseGateV1 {
  const result = ConvergenceEvalResultV1Schema.parse(value);
  const counts = {
    utility: result.runs.filter((item) => item.productClass === "utility").length,
    operations: result.runs.filter((item) => item.productClass === "operations").length,
    game: result.runs.filter((item) => item.productClass === "game").length,
    negative: result.runs.filter((item) => item.productClass === "negative").length,
  };
  const codes: z.infer<typeof GateCodeSchema>[] = [];
  if (result.executionMode !== "execute") codes.push("CONVERGENCE_EXECUTION_REQUIRED");
  if (result.preflight.status !== "pass") codes.push("CONVERGENCE_PREFLIGHT_FAILED");
  if (result.runs.length !== result.plannedRuns) codes.push("CONVERGENCE_RUN_COUNT_INCOMPLETE");
  const repetitions = result.plannedRuns / 8;
  if (!Number.isInteger(repetitions) || Object.values(counts).some((count) => count !== repetitions * 2)) {
    codes.push("CONVERGENCE_PRODUCT_CLASS_COVERAGE_INCOMPLETE");
  }
  if (result.runs.some((item) => !item.passed)) codes.push("CONVERGENCE_RUN_FAILED");
  if (result.stoppedOnRepeatedRootCause) codes.push("CONVERGENCE_REPEATED_ROOT_CAUSE");
  const decision = codes.length === 0 && result.status === "pass" ? "go" as const : "no_go" as const;
  if (decision === "go") codes.push("CONVERGENCE_RELEASE_GATE_PASSED");
  const payload = ReleaseGatePayloadV1Schema.parse({
    schema: "setfarm.product-convergence-release-gate.v1",
    resultHash: result.resultHash,
    releaseSha: result.releaseSha,
    decision,
    codes,
    runCount: result.runs.length,
    passedRunCount: result.runs.filter((item) => item.passed).length,
    productClassCounts: counts,
  });
  return ConvergenceReleaseGateV1Schema.parse({ ...payload, gateHash: hashCanonicalJson(payload) });
}
