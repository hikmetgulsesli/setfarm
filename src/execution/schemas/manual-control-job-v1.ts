import path from "node:path";
import { z } from "zod";
import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Source = z.string().regex(/^[a-f0-9]{40}$/);
const Id = z.string().uuid().refine(value => value === value.toLowerCase());
const AbsolutePath = z.string().min(1).max(4096).refine(value =>
  !/[\u0000-\u001f\u007f]/.test(value) && path.isAbsolute(value) && path.normalize(value) === value);
const Time = z.string().datetime().refine(value => Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value);
const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Code = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);

export const ControlSelectionIdentityV1Schema = z.object({
  schema: z.literal("setfarm.manual-control-selection.v1"), installationId: Id, sourceSha: Source,
  installationDir: AbsolutePath, releaseDir: AbsolutePath, catalogHash: Hash,
  activationPreparedHash: Hash, activationAcknowledgedHash: Hash,
}).strict();
export type ControlSelectionIdentityV1 = Readonly<z.infer<typeof ControlSelectionIdentityV1Schema>>;
export function hashControlSelectionIdentityV1(input: ControlSelectionIdentityV1): string {
  return hashCanonicalJson(ControlSelectionIdentityV1Schema.parse(input));
}

export const ControlJobKindV1Schema = z.enum(["activation_preflight", "convergence_full8", "ui_regression"]);
export type ControlJobKindV1 = z.infer<typeof ControlJobKindV1Schema>;
export const ControlReportRefsV1Schema = z.object({
  activationHash: Hash.optional(), resultHash: Hash.optional(), gateHash: Hash.optional(), uiReportHash: Hash.optional(),
}).strict();
export type ControlReportRefsV1 = Readonly<z.infer<typeof ControlReportRefsV1Schema>>;
export const ControlJobReceiptV1Schema = z.object({
  schema: z.literal("mission-control.control-job.v1"), jobId: Id, kind: ControlJobKindV1Schema,
  revision: Count, selectionHash: Hash, sourceSha: Source, mcSourceSha: Source, mcBuildHash: Hash,
  suiteHash: Hash.nullable(),
  state: z.enum(["accepted", "starting", "running", "cancelling", "completed", "failed", "blocked", "cancelled", "ownership_unknown"]),
  requestedAt: Time, startedAt: Time.nullable(), updatedAt: Time, finishedAt: Time.nullable(),
  phase: Code, code: Code.nullable(), currentCaseId: Code.nullable(), ownedRunId: Code.nullable(),
  completedCases: Count, plannedCases: Count, reportRefs: ControlReportRefsV1Schema, cancelRequested: z.boolean(),
}).strict().superRefine((value, context) => {
  if ((value.kind === "convergence_full8") !== (value.suiteHash !== null)) context.addIssue({ code: "custom", path: ["suiteHash"], message: "Suite must match job kind" });
  if (value.completedCases > value.plannedCases) context.addIssue({ code: "custom", path: ["completedCases"], message: "Completed count exceeds plan" });
  if (value.kind === "convergence_full8" && value.plannedCases !== 8) context.addIssue({ code: "custom", path: ["plannedCases"], message: "Full evaluation requires eight cases" });
});
export type ControlJobReceiptV1 = Readonly<z.infer<typeof ControlJobReceiptV1Schema>>;
export const ControlPrivateIntentV1Schema = z.object({
  schema: z.literal("mission-control.control-intent.v1"), receipt: ControlJobReceiptV1Schema,
  installationDir: AbsolutePath, releaseDir: AbsolutePath, nonceDigest: Hash,
  fixedSuiteRelativePath: z.literal("evals/suites/product-convergence-codex-v1.json").nullable(),
}).strict().superRefine((value, context) => {
  if ((value.receipt.kind === "convergence_full8") !== (value.fixedSuiteRelativePath !== null)) {
    context.addIssue({ code: "custom", path: ["fixedSuiteRelativePath"], message: "Fixed recipe must match job kind" });
  }
});
export type ControlPrivateIntentV1 = Readonly<z.infer<typeof ControlPrivateIntentV1Schema>>;
export const ControlWorkerCustodyV1Schema = z.object({
  schema: z.literal("mission-control.control-custody.v1"), jobId: Id,
  selectionHash: Hash, sourceSha: Source, mcBuildHash: Hash, nonce: z.string().min(32).max(512).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
export type ControlWorkerCustodyV1 = Readonly<z.infer<typeof ControlWorkerCustodyV1Schema>>;

export const ControlEvidenceExpectedV1Schema = z.object({
  selectionHash: Hash, sourceSha: Source, releaseSha: Source, suiteHash: Hash.nullable(), refs: ControlReportRefsV1Schema,
}).strict();
export type ControlEvidenceExpectedV1 = Readonly<z.infer<typeof ControlEvidenceExpectedV1Schema>>;
export const ControlEvidenceAvailabilityV1Schema = z.object({
  state: z.enum(["available", "unconfigured", "missing", "invalid", "unsafe"]), code: Code.nullable(),
}).strict();
export type ControlEvidenceAvailabilityV1 = Readonly<z.infer<typeof ControlEvidenceAvailabilityV1Schema>>;
export const ControlEvidenceProjectionV1Schema = z.object({
  activation: z.object({ availability: ControlEvidenceAvailabilityV1Schema, report: z.object({
    hash: Hash, status: z.enum(["pass", "fail"]), protocol: z.enum(["shadow", "v3"]),
    compatibility: z.enum(["current", "historical"]), observedAt: Time.nullable(),
    checks: z.array(z.object({ id: Code, status: z.enum(["pass", "fail", "advisory"]), blocking: z.boolean(), code: Code }).strict()),
  }).strict().nullable() }).strict(),
  evaluation: z.object({ availability: ControlEvidenceAvailabilityV1Schema, report: z.object({
    resultHash: Hash, gateHash: Hash.nullable(), compatibility: z.enum(["current", "historical"]),
    executionMode: z.enum(["preflight", "execute"]), resultStatus: z.enum(["planned", "pass", "fail", "blocked"]),
    gateDecision: z.enum(["go", "no_go"]).nullable(), qualification: z.enum(["qualified", "unqualified", "historical"]),
    preflightChecks: z.array(z.object({ id: Code, status: z.enum(["pass", "fail"]), code: Code }).strict()),
    cases: z.array(z.object({ caseId: Code, repetition: z.literal(1), evidenceState: z.enum(["not_started", "recorded"]),
      disposition: z.enum(["completed", "failed", "cancelled", "timeout", "invalidated"]).nullable(),
      passed: z.boolean().nullable(), runId: Code.nullable(), resultHash: Hash.nullable() }).strict()),
    completedCases: Count, plannedCases: z.literal(8), blockerCodes: z.array(Code),
  }).strict().nullable() }).strict(),
}).strict();
export type ControlEvidenceProjectionV1 = Readonly<z.infer<typeof ControlEvidenceProjectionV1Schema>>;
