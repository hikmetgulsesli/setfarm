import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { it } from "node:test";
import { createV3StageClaimHandoffV1 } from "../../src/execution/v3-stage-execution-context.js";
import { createV3StageFailureV1, createV3StageRetrySourceV1, serializeV3StageFailureDiagnostic }
  from "../../src/execution/v3-stage-retry-authority.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { ProductSpecV2Schema } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { CONTAINED_GAME_TASK, containedGamePlanProposalV2 } from "../product-compiler/fixtures/product-semantics-v2.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";

// Direct inert DATA / owned temporary-file mechanics only. No selected profile,
// credential, SQL, broker, worker, SDK, subprocess or provider import/execution.
let api: Record<string, any> | undefined;
try { api = await import("../../src/execution/subscription-workflow-transport-v1.js"); }
catch (error) {
  const e = error as {code?: string; url?: string};
  if (e.code !== "ERR_MODULE_NOT_FOUND" || ![".js", ".ts"].some(ext => e.url ===
    new URL("../../src/execution/subscription-workflow-transport-v1" + ext, import.meta.url).href)) throw error;
}
function required(name: string): (...args: any[]) => any {
  assert.equal(typeof api?.[name], "function", `${name} implementation required`); return api![name];
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const PAIRS = [
  ["plan", "planner"], ["design", "designer"], ["stories", "planner"], ["setup-repo", "setup-repo"],
  ["setup-build", "setup-build"], ["verify", "reviewer"], ["supervise", "supervisor"],
  ["security-gate", "security-gate"], ["qa-test", "qa-tester"], ["final-test", "tester"], ["deploy", "deployer"],
] as const;
function stage(step = "plan", role = "planner", workdir = "/project/claim-worktree", instructionContent = "Produce the exact existing stage report.", previousOutputContent?: string) {
  const claim: ClaimEnvelopeV1 = { schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-04T12:00:00.000Z",
    runId: "run-subscription-transport", stepId: "step-subscription-transport", workflowStepId: step,
    claimId: 41, claimGeneration: 0, claimAgentId: `feature-dev_${role}`, runtimeAgentId: `mapped-${role}`,
    workdir, repo: workdir, input: instructionContent };
  const failure = previousOutputContent === undefined ? undefined : createV3StageFailureV1({
    workflowStepId: step, kind: "output_contract_invalid", diagnostics: [{ code: "OUTPUT_INVALID", path: "/status", message: "Previous report rejected" }],
  });
  const retrySource = failure ? createV3StageRetrySourceV1({ workflowStepId: step, retryOrdinal: 1, maxRetries: 2,
    previousClaimId: 40, previousInstructionContent: instructionContent, previousOutputContent: previousOutputContent!,
    diagnostic: serializeV3StageFailureDiagnostic("V3_PLAN_OUTPUT_REJECTED", failure) }) : undefined;
  const authority = createV3StageClaimHandoffV1({ claimEnvelope: claim, workflow: "feature-dev", role, workdir,
    outputFile: "/tmp/legacy-transport-output.txt", instructionContent, ...(retrySource ? {retrySource} : {}) });
  return { claim, authority };
}
for (const [step, role] of PAIRS) it(`preserves ${step}/${role} exact stage report without inventing an attempt`, () => {
  const input = stage(step, role);
  required("assertSubscriptionWorkflowRoleV1")({ workflow: "feature-dev", role });
  const output = step === "supervise" ? "STATUS: done\nSUPERVISOR_DECISION: fixed\nAC_COVERAGE: checked 2/2 acceptance criteria\nCHANGES: exact owned file"
    : `STATUS: done\nRESULT: ${step} report for existing module validation`;
  assert.deepEqual(required("parseSubscriptionWorkflowReportV1")({ ...input, assistantText: output }), { output });
  assert.equal(input.claim.attempt, undefined);
});
it("role gate rejects unsupported workflow or role before a claim can be requested", () => {
  const gate = required("assertSubscriptionWorkflowRoleV1");
  for (const value of [{workflow: "unknown-workflow", role: "planner"}, {workflow: "feature-dev", role: "unknown-role"}])
    assert.throws(() => gate(value), /UNSUPPORTED|REFUSED/);
});
it("planned raw fragments reconstruct complete canonical bytes and decoded instruction bytes", () => {
  const input = stage("plan", "planner", "/project/claim-worktree", "é🧭\n".repeat(16000));
  const plan = required("planSubscriptionWorkflowHandoffV1")(input);
  const expected = Buffer.from(JSON.stringify(input.authority, null, 2) + "\n");
  const rows = plan.files.filter((f: any) => f.kind === "canonical").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.ok(rows.length > 1); assert.deepEqual(Buffer.concat(rows.map((f: any) => Buffer.from(f.contents))), expected);
  assert.equal(plan.manifest.canonical.sha256, hash(expected)); assert.equal(plan.manifest.canonical.bytes, expected.length);
  const decoded = plan.files.filter((f: any) => f.kind === "instruction").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.equal(decoded.map((f: any) => f.contents).join(""), input.authority.instructionContent);
  assert.ok(plan.files.length <= 256); assert.equal(plan.readOnlyControlPaths.length, plan.files.length);
  for (const file of plan.files) {
    assert.ok(file.path.startsWith("/project/claim-worktree/.setfarm/stage-executions/claim-41/subscription-handoff/"));
    if (file.kind !== "manifest") assert.ok(Buffer.byteLength(file.contents) <= 40 * 1024);
    assert.equal(file.sha256, hash(file.contents));
  }
});
it("typical complete 4MiB retry fits original path caps and preserves every prior-output byte", () => {
  const previous = "A".repeat(4 * 1024 * 1024), input = stage("plan", "planner", "/project/claim-worktree", "Plan instruction.\n".repeat(6000), previous);
  const plan = required("planSubscriptionWorkflowHandoffV1")(input);
  assert.ok(plan.files.length <= 256);
  const rows = plan.files.filter((f: any) => f.kind === "previous-output").sort((a: any, b: any) => a.byteOffset - b.byteOffset);
  assert.equal(rows.map((f: any) => f.contents).join(""), previous);
  assert.equal(plan.manifest.previousOutput.sha256, hash(previous));
});
it("escaped worst-case expansion refuses pure planning before any filesystem or credential effects", () => {
  const input = stage("plan", "planner", "/nonexistent-subscription-capacity-worktree", "Plan instruction.", "\t".repeat(4 * 1024 * 1024));
  assert.throws(() => required("planSubscriptionWorkflowHandoffV1")(input), /CAPACITY/);
});
it("short prompt names the protected hash-bound handoff and line-based read tool without shell bootstrap", () => {
  const input = stage(), plan = required("planSubscriptionWorkflowHandoffV1")(input);
  const prompt = required("renderSubscriptionWorkflowPromptV1")({ ...input, handoffRef: plan.handoffRef });
  assert.ok(Buffer.byteLength(prompt) <= 65536); assert.ok(prompt.includes(plan.handoffRef.path));
  assert.ok(prompt.includes(plan.handoffRef.sha256)); assert.match(prompt, /path/); assert.match(prompt, /offset/); assert.match(prompt, /limit/);
  assert.doesNotMatch(prompt, /\/tmp\/|setfarm step|setfarm-summary|bash -|node -|CLAIM_FILE|BOOTSTRAP_FILE/);
});
it("materializer exclusively writes private protected files with exact plan bytes", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sf-workflow-handoff-"))); chmodSync(root, 0o700);
  try {
    const input = stage("plan", "planner", root), plan = required("planSubscriptionWorkflowHandoffV1")(input);
    const actual = required("materializeSubscriptionWorkflowHandoffV1")(input);
    assert.deepEqual(actual.handoffRef, plan.handoffRef);
    for (const file of plan.files) {
      assert.equal(lstatSync(file.path).mode & 0o777, 0o600); assert.equal(lstatSync(dirname(file.path)).mode & 0o777, 0o700);
      assert.deepEqual(readFileSync(file.path), Buffer.from(file.contents));
    }
    assert.throws(() => required("materializeSubscriptionWorkflowHandoffV1")(input), /EXIST|REFUSED/);
    for (const file of plan.files) assert.deepEqual(readFileSync(file.path), Buffer.from(file.contents));
  } finally { rmSync(root, {recursive:true,force:true}); }
});
it("materializer refuses a symlinked metadata ancestor without writing its target", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sf-workflow-handoff-link-"))); chmodSync(root, 0o700);
  try {
    const outside = join(root, "outside"); mkdirSync(outside, {mode:0o700}); symlinkSync(outside, join(root, ".setfarm"));
    assert.throws(() => required("materializeSubscriptionWorkflowHandoffV1")(stage("plan", "planner", root)), /REFUSED|SYMLINK/);
    assert.throws(() => lstatSync(join(outside, "stage-executions")), /ENOENT/);
  } finally { rmSync(root, {recursive:true,force:true}); }
});
it("transport refuses crossed original claim and tampered stage authority", () => {
  const input = stage(), plan = required("planSubscriptionWorkflowHandoffV1")(input);
  for (const changed of [{ ...input, claim: {...input.claim, claimId:42} },
    { ...input, authority: {...input.authority, instructionContent:"changed after sealing"} }]) {
    assert.throws(() => required("renderSubscriptionWorkflowPromptV1")({...changed,handoffRef:plan.handoffRef}), /MISMATCH|REFUSED|hash|length/);
  }
});
it("stage report boundary rejects empty nul oversized and missing-status output", () => {
  const input = stage();
  for (const assistantText of ["", "STATUS: done\0", "x".repeat(65537), "I finished the work."]) {
    assert.throws(() => required("parseSubscriptionWorkflowReportV1")({...input,assistantText}), /REFUSED|SIZE|STATUS|INVALID/);
  }
});
it("typed PLAN payload remains exact for the existing ProductSpec compiler", () => {
  const compiled = compilePlanSemanticProposalV2({task:CONTAINED_GAME_TASK,proposal:containedGamePlanProposalV2()});
  assert.equal(compiled.status,"canonicalized");
  if(compiled.status!=="canonicalized") throw Error("complete ProductSpec fixture must compile");
  const spec=ProductSpecV2Schema.parse(compiled.productSpec), output=renderProductSpecV2Compatibility(spec);
  const transported=required("parseSubscriptionWorkflowReportV1")({...stage(),assistantText:output});
  assert.deepEqual(transported,{output});
  const canonicalFence=transported.output.match(/```product-spec-v2\n([\s\S]*?)\n```/);
  assert.ok(canonicalFence);assert.deepEqual(ProductSpecV2Schema.parse(JSON.parse(canonicalFence[1]!)),spec);
});
